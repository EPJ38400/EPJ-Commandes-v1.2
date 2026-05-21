// ═══════════════════════════════════════════════════════════════
//  functions/gmailPoll.js — v1.13.0
//
//  Cloud Function planifiée (toutes les 2 minutes).
//  Aspire les mails de la boîte sav@epj-electricite.com via Gmail API,
//  les rattache automatiquement aux réserves correspondantes ou les
//  place en file "à classer" avec proposition Claude IA.
//
//  Architecture cohérente avec functions/index.js (v10.O + Brevo) :
//    - Firebase Functions v2 (ES modules)
//    - defineSecret (Google Secret Manager) — comme BREVO_API_KEY
//    - Région europe-west1
//
//  Pour configurer les secrets côté serveur :
//    firebase functions:secrets:set GMAIL_CLIENT_ID
//    firebase functions:secrets:set GMAIL_CLIENT_SECRET
//    firebase functions:secrets:set GMAIL_REFRESH_TOKEN
//    firebase functions:secrets:set ANTHROPIC_API_KEY
// ═══════════════════════════════════════════════════════════════

import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";
import { google } from "googleapis";

// Firebase Admin déjà initialisé dans index.js. Ici on récupère
// seulement les références si Admin n'est pas encore init (mode test).
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

// ─── Secrets ────────────────────────────────────────────────
const GMAIL_CLIENT_ID = defineSecret("GMAIL_CLIENT_ID");
const GMAIL_CLIENT_SECRET = defineSecret("GMAIL_CLIENT_SECRET");
const GMAIL_REFRESH_TOKEN = defineSecret("GMAIL_REFRESH_TOKEN");
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

// L'URI de redirection est constante et non sensible : pas besoin de secret.
const GMAIL_REDIRECT_URI = "https://developers.google.com/oauthplayground";

// ─── Constantes ─────────────────────────────────────────────
const COLLECTION_RESERVES = "reserves";
const COLLECTION_MAILS = "reserveMails";
const COLLECTION_A_CLASSER = "reserveMailsAClasser";
const COLLECTION_CONFIG = "gmailConfig";
const CONFIG_DOC = "main";

// Modèles Claude utilisés
const CLAUDE_MODEL_RATTACH = "claude-haiku-4-5-20251001";
const CLAUDE_MODEL_BROUILLON = "claude-sonnet-4-6";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// ─── Cloud Function : déclenchée toutes les 2 minutes ────────
export const gmailPoll = onSchedule(
  {
    schedule: "every 2 minutes",
    timeoutSeconds: 300,
    memory: "512MiB",
    region: "europe-west1",
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN, ANTHROPIC_API_KEY],
  },
  async () => {
    console.log("[gmailPoll v1.13.0] démarrage");

    // 1. Charger la config
    const configSnap = await db.collection(COLLECTION_CONFIG).doc(CONFIG_DOC).get();
    if (!configSnap.exists) {
      console.warn("[gmailPoll] config absente (gmailConfig/main), abandon");
      return;
    }
    const config = configSnap.data();
    if (config.actif === false) {
      console.log("[gmailPoll] désactivé via config.actif=false, abandon");
      return;
    }

    // 2. Authentification OAuth Gmail
    const oauth2Client = new google.auth.OAuth2(
      GMAIL_CLIENT_ID.value(),
      GMAIL_CLIENT_SECRET.value(),
      GMAIL_REDIRECT_URI,
    );
    oauth2Client.setCredentials({
      refresh_token: GMAIL_REFRESH_TOKEN.value(),
    });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // 3. Récupérer les nouveaux messages
    //    Stratégie hybride :
    //      a) History API depuis dernierHistoryId : capte les mails entrants standards
    //      b) Listing INBOX en parallèle : capte AUSSI les mails déplacés/glissés
    //         depuis une autre boîte (qui peuvent ne pas apparaître en History si
    //         le client mail les écrit déjà comme lus)
    //      c) Déduplication par gmailId avant traitement
    let messages = [];
    try {
      const collected = new Map(); // gmailId -> message

      // a) History API (détection incrémentale standard)
      if (config.dernierHistoryId) {
        try {
          const history = await gmail.users.history.list({
            userId: "me",
            startHistoryId: config.dernierHistoryId,
            historyTypes: ["messageAdded"],
          });
          const fromHistory = (history.data.history || [])
            .flatMap(h => (h.messagesAdded || []).map(ma => ma.message))
            .filter(m => m.labelIds?.includes("INBOX"));
          for (const m of fromHistory) collected.set(m.id, m);
        } catch (e) {
          // History peut renvoyer 404 si dernierHistoryId est trop vieux (>30j)
          // ou si l'historyId n'est plus valide. On continue avec le fallback.
          console.warn("[gmailPoll] History API a échoué (probable historyId trop vieux), fallback sur listing:", e.message);
        }
      }

      // b) Listing INBOX (capture les mails glissés depuis une autre boîte)
      //    On scanne les 50 derniers mails de la boîte de réception (30j max)
      //    pour ne pas rater ceux que History n'a pas vus.
      const list = await gmail.users.messages.list({
        userId: "me",
        q: "in:inbox newer_than:30d",
        maxResults: 50,
      });
      for (const m of (list.data.messages || [])) {
        if (!collected.has(m.id)) collected.set(m.id, m);
      }

      messages = Array.from(collected.values());
    } catch (e) {
      console.error("[gmailPoll] erreur lecture Gmail:", e.message);
      throw e;
    }

    console.log(`[gmailPoll] ${messages.length} mails à traiter`);

    // 4. Traiter chaque mail
    let nbRattaches = 0;
    let nbAClasser = 0;
    let nbNouveaux = 0;        // v1.18.2 — compte UNIQUEMENT les nouveaux mails effectivement traités
    let nbDejaTraites = 0;     // pour debug (logs uniquement)
    let nbErreurs = 0;         // pour debug
    for (const msg of messages) {
      try {
        const result = await processMail(gmail, msg.id);
        if (result === "rattache") { nbRattaches++; nbNouveaux++; }
        else if (result === "a_classer") { nbAClasser++; nbNouveaux++; }
        else if (result === "deja_traite") { nbDejaTraites++; }
        else if (result === "erreur") { nbErreurs++; }
      } catch (e) {
        console.error(`[gmailPoll] erreur sur mail ${msg.id}:`, e.message);
        nbErreurs++;
      }
    }

    // 5. Mettre à jour la config (historyId + stats + dernière sync)
    // v1.18.2 — statsAspires n'incrémente QUE pour les vrais nouveaux mails
    // (auparavant on incrémentait pour TOUT mail listé, ce qui explique le
    // 902 délirant alors qu'il n'y avait que 2 vrais mails).
    const profile = await gmail.users.getProfile({ userId: "me" });
    await db.collection(COLLECTION_CONFIG).doc(CONFIG_DOC).update({
      dernierHistoryId: String(profile.data.historyId),
      derniereSync: admin.firestore.FieldValue.serverTimestamp(),
      statsAspires: admin.firestore.FieldValue.increment(nbNouveaux),
      statsRattachesAuto: admin.firestore.FieldValue.increment(nbRattaches),
      statsAClasser: admin.firestore.FieldValue.increment(nbAClasser),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[gmailPoll] terminé : ${nbNouveaux} nouveaux (${nbRattaches} rattachés, ${nbAClasser} à classer), ${nbDejaTraites} déjà traités ignorés, ${nbErreurs} erreurs`);
  }
);

// ═══════════════════════════════════════════════════════════════
//  Traitement d'un mail individuel
// ═══════════════════════════════════════════════════════════════
async function processMail(gmail, gmailId) {
  // v1.18.2 — try/catch global pour ne JAMAIS laisser le code partiellement
  // exécuté (download fait + écriture Firestore pas faite). Toute erreur est
  // remontée comme "erreur" sans planter le cycle complet.
  try {
    const full = await gmail.users.messages.get({
      userId: "me", id: gmailId, format: "full",
    });
    const msg = full.data;

    // ─── 1. Dédup AVANT tout (ne pas faire d'I/O coûteuse en doublon) ───
    const existing = await db.collection(COLLECTION_MAILS)
      .where("gmailId", "==", gmailId).limit(1).get();
    if (!existing.empty) return "deja_traite";
    const existingAClasser = await db.collection(COLLECTION_A_CLASSER)
      .where("gmailId", "==", gmailId).limit(1).get();
    if (!existingAClasser.empty) return "deja_traite";

    // ─── 2. Parser le mail (gratuit, en mémoire) ───
    const parsed = parseGmailMessage(msg);

    // ─── 3. Rattachement déterministe AVANT téléchargement PJ ───
    // v1.18.2 — On déplace le rattachement AVANT downloadAttachments.
    // Comme ça, si le rattachement plante (ex: index manquant), on n'a
    // PAS gaspillé de Storage. Le cycle suivant retentera proprement.
    const match = await tryRattachementDeterministe(parsed, msg.threadId);

    // ─── 4. Téléchargement des PJ (path déterministe : pas de doublons) ───
    const piecesJointes = await downloadAttachments(gmail, gmailId, msg.payload);

    const mailDoc = {
      gmailId,
      gmailThreadId: msg.threadId,
      direction: "in",
      expediteurNom: parsed.fromName,
      expediteurEmail: parsed.fromEmail,
      destinataires: parsed.to,
      cc: parsed.cc,
      bcc: [],
      sujet: parsed.subject,
      dateEnvoi: parsed.date,
      dateAspiration: admin.firestore.FieldValue.serverTimestamp(),
      corpsHtml: parsed.html,
      corpsTexte: parsed.text,
      apercu: parsed.text.slice(0, 180),
      piecesJointes,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // ─── 5. Écriture Firestore selon rattachement trouvé ou non ───
    if (match) {
      await db.collection(COLLECTION_MAILS).add({
        ...mailDoc,
        reserveId: match.reserveId,
        reserveNum: match.reserveNum,
        chantierNum: match.chantierNum,
        rattachementMethode: match.methode,
        rattachementScore: match.score,
        rattachementDate: admin.firestore.FieldValue.serverTimestamp(),
      });
      return "rattache";
    }

    // Sinon : IA Claude
    const propositions = await askClaude(parsed);
    await db.collection(COLLECTION_A_CLASSER).add({
      ...mailDoc,
      statut: "en_attente",
      iaPropositions: propositions,
      iaTraiteLe: admin.firestore.FieldValue.serverTimestamp(),
    });
    return "a_classer";
  } catch (err) {
    // v1.18.2 — Log l'erreur sans planter tout le cycle. Si on est arrivé
    // ici APRÈS downloadAttachments, le path déterministe garantit qu'au
    // prochain cycle Storage ne créera pas de doublon (overwrite).
    console.error(`[processMail] gmailId=${gmailId} erreur:`, err);
    return "erreur";
  }
}

// ═══════════════════════════════════════════════════════════════
//  Parsing Gmail
// ═══════════════════════════════════════════════════════════════
function parseGmailMessage(msg) {
  const headers = {};
  (msg.payload?.headers || []).forEach(h => {
    headers[h.name.toLowerCase()] = h.value;
  });
  const { fromName, fromEmail } = parseFrom(headers["from"] || "");
  const to = parseEmailList(headers["to"]);
  const cc = parseEmailList(headers["cc"]);
  const subject = headers["subject"] || "(sans objet)";
  const date = headers["date"]
    ? new Date(headers["date"]).toISOString()
    : new Date().toISOString();
  const { html, text } = extractBodies(msg.payload);
  return { fromName, fromEmail, to, cc, subject, date, html, text };
}

function parseFrom(s) {
  const m = /^(.*?)<([^>]+)>$/.exec(s.trim());
  if (m) return { fromName: m[1].trim().replace(/^"|"$/g, ""), fromEmail: m[2].trim() };
  return { fromName: "", fromEmail: s.trim() };
}

function parseEmailList(s) {
  if (!s) return [];
  return s.split(",").map(part => parseFrom(part).fromEmail).filter(Boolean);
}

function extractBodies(payload) {
  let html = "", text = "";
  const walk = (part) => {
    if (!part) return;
    if (part.mimeType === "text/html" && part.body?.data) {
      html += Buffer.from(part.body.data, "base64").toString("utf8");
    } else if (part.mimeType === "text/plain" && part.body?.data) {
      text += Buffer.from(part.body.data, "base64").toString("utf8");
    }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  if (!text && html) {
    text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  }
  return { html, text };
}

// ═══════════════════════════════════════════════════════════════
//  Téléchargement pièces jointes
// ═══════════════════════════════════════════════════════════════
async function downloadAttachments(gmail, gmailId, payload) {
  const pjs = [];
  const walk = async (part) => {
    if (!part) return;
    if (part.filename && part.body?.attachmentId) {
      const att = await gmail.users.messages.attachments.get({
        userId: "me", messageId: gmailId, id: part.body.attachmentId,
      });
      const buffer = Buffer.from(att.data.data, "base64");
      const safeName = part.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      // v1.18.2 — Path DÉTERMINISTE basé sur l'attachmentId Gmail.
      // Si la fonction re-tente le téléchargement (cas où processMail
      // crashait après downloadAttachments avant l'écriture Firestore),
      // Storage écrasera le fichier existant au lieu d'en créer un
      // doublon. C'est ce qui causait l'accumulation de ~40 doublons
      // par image sur le mail Adrien ROCHAS (~30 Mo gaspillés).
      // L'attachmentId est stable pour un même mail + même PJ.
      const safeAttId = String(part.body.attachmentId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
      const path = `mails/${gmailId}/${safeAttId}_${safeName}`;
      const file = bucket.file(path);
      await file.save(buffer, {
        contentType: part.mimeType,
        metadata: { contentType: part.mimeType },
        resumable: false,
      });
      // v1.18.2 — URL signée raccourcie de 2099 à 30 jours.
      // Recommandation audit 4.7 : limiter l'exposition en cas de fuite
      // d'URL. Si le mail est consulté >30j après réception, l'app
      // pourra régénérer une URL fraîche via storage_get_signed_url.
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const [url] = await file.getSignedUrl({
        action: "read",
        expires,
      });
      pjs.push({
        // ID déterministe aussi pour éviter les "doublons logiques"
        // dans le tableau piecesJointes du doc Firestore.
        id: `pj_${safeAttId}`,
        nom: part.filename,
        contentType: part.mimeType,
        tailleKo: Math.round(buffer.length / 1024),
        url, path,
        kind: classifyAttachment(part.mimeType, part.filename),
      });
    }
    for (const p of (part.parts || [])) await walk(p);
  };
  await walk(payload);
  return pjs;
}

function classifyAttachment(mime, name) {
  if (!mime) mime = "";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (/(word|officedocument)/i.test(mime)) return "doc";
  if (/\.(jpe?g|png|gif|webp|heic)$/i.test(name || "")) return "image";
  if (/\.pdf$/i.test(name || "")) return "pdf";
  return "other";
}

// ═══════════════════════════════════════════════════════════════
//  Rattachement déterministe (3 méthodes en cascade)
// ═══════════════════════════════════════════════════════════════
async function tryRattachementDeterministe(parsed, threadId) {
  // 1. Tag sujet [RES-XXX]
  const tagMatch = /\[RES-([^\]]+)\]/.exec(parsed.subject || "");
  if (tagMatch) {
    const numReserve = tagMatch[1].trim();
    const q = await db.collection(COLLECTION_RESERVES)
      .where("numReserve", "==", numReserve).limit(1).get();
    if (!q.empty) {
      const d = q.docs[0];
      return {
        reserveId: d.id, reserveNum: numReserve,
        chantierNum: d.data().chantierNum,
        methode: "tag_sujet", score: 1.0,
      };
    }
  }

  // 2. Thread Gmail déjà connu
  if (threadId) {
    const q = await db.collection(COLLECTION_MAILS)
      .where("gmailThreadId", "==", threadId).limit(1).get();
    if (!q.empty) {
      const m = q.docs[0].data();
      if (m.reserveId) {
        return {
          reserveId: m.reserveId, reserveNum: m.reserveNum,
          chantierNum: m.chantierNum,
          methode: "thread", score: 0.95,
        };
      }
    }
  }

  // 3. Contact + chantier mentionné
  if (parsed.fromEmail) {
    const q = await db.collection(COLLECTION_MAILS)
      .where("expediteurEmail", "==", parsed.fromEmail)
      .orderBy("dateEnvoi", "desc").limit(5).get();
    if (!q.empty) {
      const reservesCandidates = [...new Set(q.docs.map(d => d.data().reserveId).filter(Boolean))];
      for (const rid of reservesCandidates) {
        const rsnap = await db.collection(COLLECTION_RESERVES).doc(rid).get();
        if (!rsnap.exists) continue;
        const r = rsnap.data();
        const haystack = `${parsed.subject} ${parsed.text}`.toLowerCase();
        if (
          (r.chantierNum && haystack.includes(r.chantierNum.toLowerCase())) ||
          (r.chantierNom && haystack.includes(r.chantierNom.toLowerCase()))
        ) {
          return {
            reserveId: rid, reserveNum: r.numReserve,
            chantierNum: r.chantierNum,
            methode: "contact", score: 0.85,
          };
        }
      }
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
//  Appel Claude API (Haiku + Sonnet)
// ═══════════════════════════════════════════════════════════════
async function askClaude(parsed) {
  const apiKey = ANTHROPIC_API_KEY.value();
  if (!apiKey) {
    console.warn("[gmailPoll] ANTHROPIC_API_KEY non configurée, IA désactivée");
    return [];
  }

  // Contexte EPJ
  const chantiersSnap = await db.collection("chantiers")
    .where("statut", "==", "actif").limit(50).get();
  const chantiers = chantiersSnap.docs.map(d => {
    const data = d.data();
    return {
      num: data.numAffaire || data.num,
      nom: data.nom,
      adresse: data.adresse,
    };
  });

  const reservesSnap = await db.collection(COLLECTION_RESERVES)
    .where("statut", "in", ["creee", "attribuee", "planifiee", "intervention"])
    .orderBy("dateCreation", "desc").limit(30).get();
  const reservesOuvertes = reservesSnap.docs.map(d => ({
    id: d.id,
    num: d.data().numReserve,
    chantier: d.data().chantierNom,
    description: (d.data().description || "").slice(0, 150),
  }));

  // Haiku : rattachement rapide
  const rattachResult = await callClaudeRattach(apiKey, parsed, chantiers, reservesOuvertes);
  const meilleurRattach = (rattachResult || []).find(p => p.type === "rattach" && p.score >= 0.75);
  if (meilleurRattach) return [meilleurRattach];

  // Sonnet : brouillon nouvelle réserve
  const brouillonResult = await callClaudeBrouillon(apiKey, parsed, chantiers);

  return [
    ...(rattachResult || []).filter(p => p.type === "rattach"),
    ...(brouillonResult || []).filter(p => p.type === "create"),
  ].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3);
}

async function callClaudeRattach(apiKey, parsed, chantiers, reservesOuvertes) {
  const userPrompt = `Tu analyses un mail entrant pour EPJ Électricité (Saint-Égrève, Isère).
Tu dois identifier s'il correspond à une réserve EXISTANTE ouverte.

CHANTIERS ACTIFS :
${chantiers.map(c => `- ${c.num} : ${c.nom}${c.adresse ? ` (${c.adresse})` : ""}`).join("\n")}

RÉSERVES OUVERTES :
${reservesOuvertes.map(r => `- id:${r.id} | ${r.num} | ${r.chantier} | ${r.description}`).join("\n")}

MAIL :
De : ${parsed.fromName} <${parsed.fromEmail}>
Sujet : ${parsed.subject}
Corps :
${(parsed.text || "").slice(0, 2000)}

Réponds UNIQUEMENT en JSON valide, sans aucun texte avant ou après.
Format :
{ "propositions": [ { "type": "rattach", "reserveId": "id-de-la-reserve", "score": 0.0-1.0, "raison": "courte explication" } ] }

Maximum 2 propositions. Si aucune réserve existante ne correspond, retourne un tableau vide.
Sois prudent : score >= 0.75 seulement si tu es sûr.`;

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL_RATTACH,
        max_tokens: 1000,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) {
      console.error("[gmailPoll/claude/rattach] HTTP", res.status, await res.text());
      return [];
    }
    const data = await res.json();
    const content = data.content?.[0]?.text || "{}";
    return JSON.parse(extractJson(content)).propositions || [];
  } catch (e) {
    console.error("[gmailPoll/claude/rattach] erreur:", e.message);
    return [];
  }
}

async function callClaudeBrouillon(apiKey, parsed, chantiers) {
  const userPrompt = `Tu analyses un mail entrant pour EPJ Électricité (Saint-Égrève, Isère).
Tu dois proposer la CRÉATION d'une nouvelle réserve à partir de ce mail.

CHANTIERS ACTIFS (essaie d'identifier celui concerné) :
${chantiers.map(c => `- ${c.num} : ${c.nom}${c.adresse ? ` (${c.adresse})` : ""}`).join("\n")}

CATÉGORIES DE RÉSERVES POSSIBLES :
- appareillage, tableau, eclairage, interphone, vmc, chauffage, volets_roulants, alarme, domotique, autre

ÉMETTEURS POSSIBLES :
- Client final, Syndic, Maître d'œuvre, Promoteur, Architecte, Bailleur social, Autre

MAIL :
De : ${parsed.fromName} <${parsed.fromEmail}>
Sujet : ${parsed.subject}
Corps :
${(parsed.text || "").slice(0, 3000)}

Réponds UNIQUEMENT en JSON valide. Format :
{ "propositions": [ {
  "type": "create", "score": 0.0-1.0,
  "brouillon": {
    "chantierNum": "...", "categorieGuess": "...", "priorite": "bloquante|normale",
    "description": "...", "emisParLabel": "...", "emisParNom": "...",
    "emplacement": "...",
    "clientFinal": { "nom": "...", "email": "...", "telephone": null }
  }
} ] }

Une seule proposition. Le score reflète ta confiance globale.`;

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL_BROUILLON,
        max_tokens: 1500,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
    if (!res.ok) {
      console.error("[gmailPoll/claude/brouillon] HTTP", res.status, await res.text());
      return [];
    }
    const data = await res.json();
    const content = data.content?.[0]?.text || "{}";
    return JSON.parse(extractJson(content)).propositions || [];
  } catch (e) {
    console.error("[gmailPoll/claude/brouillon] erreur:", e.message);
    return [];
  }
}

function extractJson(s) {
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1) return "{}";
  return s.slice(first, last + 1);
}

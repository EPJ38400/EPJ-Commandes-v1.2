/* ═══════════════════════════════════════════════════════════════
   gmailPoll.js — Cloud Function planifiée (toutes les 2 minutes)
   v1.13.0 — Brique mail
   v2 : Boîte Workspace dédiée sav@ + Claude API (Haiku 4.5 + Sonnet 4.6)

   Mission :
   1. S'authentifier sur la boîte sav@epj-electricite.com via OAuth2
   2. Lire les nouveaux mails depuis le dernier historyId stocké
   3. Pour chaque mail :
      - Stocker pièces jointes dans Firebase Storage
      - Tenter le rattachement (3 méthodes déterministes + IA Claude)
      - Si rattaché → écrire dans reserveMails
      - Sinon → écrire dans reserveMailsAClasser + appeler Claude pour
        proposer rattachement ou brouillon de nouvelle réserve

   PRÉREQUIS :
   - Firebase Blaze actif (déjà en place sur ap-epj)
   - Boîte Workspace sav@epj-electricite.com créée
   - OAuth Gmail : doc gmailConfig/main avec refreshToken valide
   - Variable d'environnement : ANTHROPIC_API_KEY
   ═══════════════════════════════════════════════════════════════ */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { google } = require("googleapis");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

const COLLECTION_RESERVES = "reserves";
const COLLECTION_MAILS = "reserveMails";
const COLLECTION_A_CLASSER = "reserveMailsAClasser";
const COLLECTION_CONFIG = "gmailConfig";
const CONFIG_DOC = "main";

// Modèles Claude utilisés
const CLAUDE_MODEL_RATTACH = "claude-haiku-4-5-20251001"; // rapide + pas cher
const CLAUDE_MODEL_BROUILLON = "claude-sonnet-4-6";       // meilleure compréhension métier
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// ─── Point d'entrée : déclenché toutes les 2 minutes ─────────
exports.gmailPoll = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .pubsub.schedule("every 2 minutes")
  .onRun(async () => {
    console.log("[gmailPoll] démarrage");

    // 1. Charger la config
    const configSnap = await db.collection(COLLECTION_CONFIG).doc(CONFIG_DOC).get();
    if (!configSnap.exists) {
      console.warn("[gmailPoll] config absente, abandon");
      return null;
    }
    const config = configSnap.data();
    if (!config.actif) {
      console.log("[gmailPoll] désactivé, abandon");
      return null;
    }

    // 2. Authentification OAuth Gmail sur la boîte sav@
    const oauth2Client = new google.auth.OAuth2(
      functions.config().gmail.client_id,
      functions.config().gmail.client_secret,
      functions.config().gmail.redirect_uri,
    );
    oauth2Client.setCredentials({
      refresh_token: config.oauthRefreshToken,
    });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    // 3. Récupérer la liste des nouveaux messages
    let messages = [];
    try {
      if (config.dernierHistoryId) {
        // Lecture incrémentale par History API
        const history = await gmail.users.history.list({
          userId: "me",
          startHistoryId: config.dernierHistoryId,
          historyTypes: ["messageAdded"],
        });
        messages = (history.data.history || [])
          .flatMap(h => (h.messagesAdded || []).map(ma => ma.message))
          .filter(m => m.labelIds?.includes("INBOX"));
      } else {
        // Première fois : on prend les 20 derniers mails de la boîte
        const list = await gmail.users.messages.list({
          userId: "me",
          q: "in:inbox newer_than:7d",
          maxResults: 20,
        });
        messages = list.data.messages || [];
      }
    } catch (e) {
      console.error("[gmailPoll] erreur lecture Gmail:", e.message);
      throw e;
    }

    console.log(`[gmailPoll] ${messages.length} mails à traiter`);

    // 4. Traiter chaque mail
    let nbRattaches = 0;
    let nbAClasser = 0;
    for (const msg of messages) {
      try {
        const result = await processMail(gmail, msg.id);
        if (result === "rattache") nbRattaches++;
        else if (result === "a_classer") nbAClasser++;
      } catch (e) {
        console.error(`[gmailPoll] erreur sur mail ${msg.id}:`, e.message);
      }
    }

    // 5. Mettre à jour la config (historyId + stats + dernière sync)
    const profile = await gmail.users.getProfile({ userId: "me" });
    await db.collection(COLLECTION_CONFIG).doc(CONFIG_DOC).update({
      dernierHistoryId: String(profile.data.historyId),
      derniereSync: admin.firestore.FieldValue.serverTimestamp(),
      statsAspires: admin.firestore.FieldValue.increment(messages.length),
      statsRattachesAuto: admin.firestore.FieldValue.increment(nbRattaches),
      statsAClasser: admin.firestore.FieldValue.increment(nbAClasser),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`[gmailPoll] terminé : ${nbRattaches} rattachés, ${nbAClasser} à classer`);
    return null;
  });

// ═══════════════════════════════════════════════════════════════
//  Traitement d'un mail individuel
// ═══════════════════════════════════════════════════════════════
async function processMail(gmail, gmailId) {
  // 1. Récupérer le contenu complet du mail
  const full = await gmail.users.messages.get({
    userId: "me", id: gmailId, format: "full",
  });
  const msg = full.data;

  // 2. Vérifier qu'on ne l'a pas déjà
  const existing = await db.collection(COLLECTION_MAILS)
    .where("gmailId", "==", gmailId).limit(1).get();
  if (!existing.empty) return "deja_traite";

  const existingAClasser = await db.collection(COLLECTION_A_CLASSER)
    .where("gmailId", "==", gmailId).limit(1).get();
  if (!existingAClasser.empty) return "deja_traite";

  // 3. Parser headers et corps
  const parsed = parseGmailMessage(msg);

  // 4. Stocker pièces jointes
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

  // 5. Tentative de rattachement déterministe (méthodes 1-3)
  const match = await tryRattachementDeterministe(parsed, msg.threadId);

  if (match) {
    // Rattachement automatique → reserveMails
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

  // 6. Pas de rattachement direct → Claude IA pour propositions
  const propositions = await askClaude(parsed);
  await db.collection(COLLECTION_A_CLASSER).add({
    ...mailDoc,
    statut: "en_attente",
    iaPropositions: propositions,
    iaTraiteLe: admin.firestore.FieldValue.serverTimestamp(),
  });
  return "a_classer";
}

// ═══════════════════════════════════════════════════════════════
//  Parse Gmail message : extraction headers + corps + apercu
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
  // Formats : "Nom <email@x>" ou "email@x" ou "<email@x>"
  const m = /^(.*?)<([^>]+)>$/.exec(s.trim());
  if (m) return { fromName: m[1].trim().replace(/^"|"$/g, ""), fromEmail: m[2].trim() };
  return { fromName: "", fromEmail: s.trim() };
}

function parseEmailList(s) {
  if (!s) return [];
  return s.split(",")
    .map(part => {
      const { fromEmail } = parseFrom(part);
      return fromEmail;
    })
    .filter(Boolean);
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
//  Téléchargement et stockage des pièces jointes
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
      const path = `mails/${gmailId}/${Date.now()}_${safeName}`;
      const file = bucket.file(path);
      await file.save(buffer, {
        contentType: part.mimeType,
        metadata: { contentType: part.mimeType },
      });
      // URL signée longue durée
      const [url] = await file.getSignedUrl({
        action: "read",
        expires: "2099-12-31",
      });
      pjs.push({
        id: `pj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        nom: part.filename,
        contentType: part.mimeType,
        tailleKo: Math.round(buffer.length / 1024),
        url,
        path,
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
//  Appel Claude API (Haiku pour rattachement, Sonnet pour brouillon)
//  Format JSON structuré, prompt entièrement en français
// ═══════════════════════════════════════════════════════════════
async function askClaude(parsed) {
  const apiKey = functions.config().anthropic?.api_key
    || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn("[gmailPoll] ANTHROPIC_API_KEY non configurée, IA désactivée");
    return [];
  }

  // Contexte EPJ : chantiers actifs + réserves ouvertes
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

  // ─── Étape 1 : Haiku 4.5 pour tenter un rattachement rapide
  const rattachResult = await callClaudeRattach(apiKey, parsed, chantiers, reservesOuvertes);

  // Si Haiku a trouvé avec confiance >= 0.75, on s'arrête là
  const meilleurRattach = (rattachResult || []).find(p => p.type === "rattach" && p.score >= 0.75);
  if (meilleurRattach) {
    return [meilleurRattach];
  }

  // ─── Étape 2 : Sonnet 4.6 pour brouillon de nouvelle réserve
  const brouillonResult = await callClaudeBrouillon(apiKey, parsed, chantiers);

  // Combiner les propositions de Haiku (rattach faibles) + Sonnet (création)
  const propositions = [
    ...(rattachResult || []).filter(p => p.type === "rattach"),
    ...(brouillonResult || []).filter(p => p.type === "create"),
  ].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 3);

  return propositions;
}

// ─── Haiku 4.5 : rattachement à une réserve existante ───────
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
{
  "propositions": [
    { "type": "rattach", "reserveId": "id-de-la-reserve", "score": 0.0-1.0, "raison": "courte explication" }
  ]
}

Maximum 2 propositions. Si aucune réserve existante ne correspond,
retourne un tableau vide. Sois prudent : score >= 0.75 seulement
si tu es sûr.`;

  const body = {
    model: CLAUDE_MODEL_RATTACH,
    max_tokens: 1000,
    messages: [{ role: "user", content: userPrompt }],
  };

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("[gmailPoll/claude/rattach] HTTP", res.status, await res.text());
      return [];
    }
    const data = await res.json();
    const content = data.content?.[0]?.text || "{}";
    const parsed2 = JSON.parse(extractJson(content));
    return parsed2.propositions || [];
  } catch (e) {
    console.error("[gmailPoll/claude/rattach] erreur:", e.message);
    return [];
  }
}

// ─── Sonnet 4.6 : brouillon de nouvelle réserve ─────────────
async function callClaudeBrouillon(apiKey, parsed, chantiers) {
  const userPrompt = `Tu analyses un mail entrant pour EPJ Électricité (Saint-Égrève, Isère).
Tu dois proposer la CRÉATION d'une nouvelle réserve à partir de ce mail.

CHANTIERS ACTIFS (essaie d'identifier celui concerné) :
${chantiers.map(c => `- ${c.num} : ${c.nom}${c.adresse ? ` (${c.adresse})` : ""}`).join("\n")}

CATÉGORIES DE RÉSERVES POSSIBLES :
- appareillage (prises, interrupteurs, télérupteurs)
- tableau (disjoncteurs, contacteurs)
- eclairage (luminaires, spots)
- interphone
- vmc
- chauffage
- volets_roulants
- alarme
- domotique
- autre

ÉMETTEURS POSSIBLES :
- Client final (locataire, propriétaire)
- Syndic
- Maître d'œuvre
- Promoteur
- Architecte
- Bailleur social
- Autre

MAIL :
De : ${parsed.fromName} <${parsed.fromEmail}>
Sujet : ${parsed.subject}
Corps :
${(parsed.text || "").slice(0, 3000)}

Réponds UNIQUEMENT en JSON valide, sans aucun texte avant ou après.
Format :
{
  "propositions": [
    {
      "type": "create",
      "score": 0.0-1.0,
      "brouillon": {
        "chantierNum": "numéro du chantier ou null si pas identifiable",
        "categorieGuess": "catégorie ci-dessus",
        "priorite": "bloquante" ou "normale",
        "description": "résumé court et factuel du problème",
        "emisParLabel": "type d'émetteur ci-dessus",
        "emisParNom": "nom de l'émetteur tel que dans le mail",
        "emplacement": "bâtiment/appartement/pièce si mentionné",
        "clientFinal": {
          "nom": "nom du client si mentionné",
          "email": "email du client si différent de l'expéditeur",
          "telephone": "tel si mentionné, sinon null"
        }
      }
    }
  ]
}

Une seule proposition. Le score reflète ta confiance globale.`;

  const body = {
    model: CLAUDE_MODEL_BROUILLON,
    max_tokens: 1500,
    messages: [{ role: "user", content: userPrompt }],
  };

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("[gmailPoll/claude/brouillon] HTTP", res.status, await res.text());
      return [];
    }
    const data = await res.json();
    const content = data.content?.[0]?.text || "{}";
    const parsed2 = JSON.parse(extractJson(content));
    return parsed2.propositions || [];
  } catch (e) {
    console.error("[gmailPoll/claude/brouillon] erreur:", e.message);
    return [];
  }
}

// ─── Helper : extraire le JSON pur même si entouré de texte ─
function extractJson(s) {
  // Cherche le premier { jusqu'au dernier } correspondant
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1) return "{}";
  return s.slice(first, last + 1);
}

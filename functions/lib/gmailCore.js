// ═══════════════════════════════════════════════════════════════
//  functions/lib/gmailCore.js — Cœur Gmail réutilisable (boîte-agnostique)
//
//  Factorisation FIDÈLE du cœur de functions/gmailPoll.js (v1.13.0+).
//  Aucune logique métier sav@ ici : ce qui dépend de la boîte
//  (refresh token, doc de config, quoi faire de chaque mail) est injecté
//  par l'appelant. Tous les fix éprouvés sont préservés :
//    • anti-doublons v1.18.2 (path Storage déterministe via attachmentId)
//    • bascule resync complet 60j si historyId périmé (404)
//    • dédup gmailId, idempotence
//    • dédup-AVANT-get : gmailCore passe l'id au handler ; c'est le handler
//      qui décide de faire (ou non) le messages.get coûteux → préserve la
//      protection anti-timeout du resync.
//
//  Module `lib` : importé par les fonctions par boîte (gmailPollAchat…),
//  PAS exporté dans functions/index.js. NE remplace PAS gmailPoll.js : le
//  rebranchement de gmailPoll sur ce module est une étape ultérieure testée
//  à part.
// ═══════════════════════════════════════════════════════════════

import { google } from "googleapis";
import admin from "firebase-admin";

// Admin est initialisé par index.js ; guard pour un chargement isolé.
if (!admin.apps.length) admin.initializeApp();
const bucket = admin.storage().bucket();

// ─── Constantes ─────────────────────────────────────────────
const DEFAULT_REDIRECT_URI = "https://developers.google.com/oauthplayground";
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// Défauts repris à l'identique de gmailPoll.js (comportement sav actuel).
const DEFAULT_RESYNC_QUERY = "newer_than:60d -in:sent -in:draft -in:chats";
const DEFAULT_INBOX_QUERY = "in:inbox";
const DEFAULT_MAX_RESYNC = 500;

// ═══════════════════════════════════════════════════════════════
//  Client Gmail OAuth — paramétré par refresh token (multi-boîtes)
// ═══════════════════════════════════════════════════════════════
export function buildGmailClient({ clientId, clientSecret, refreshToken, redirectUri = DEFAULT_REDIRECT_URI }) {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  return google.gmail({ version: "v1", auth: oauth2Client });
}

// ═══════════════════════════════════════════════════════════════
//  Moteur de synchronisation — History API incrémentale + bascule
//  resync complet, dédup gmailId, reset historyId. Boîte-agnostique.
//
//  Stratégie (identique gmailPoll) :
//    • History API depuis dernierHistoryId (chemin normal).
//    • Si historyId périmé/invalide (404) OU absent → resync complet paginé.
//    • Dédup par gmailId (Map). L'idempotence fine (ne pas retraiter un mail
//      déjà en base) est de la responsabilité du handler (dédup-avant-get).
//    • dernierHistoryId réinitialisé en fin de cycle.
//
//  handler({ gmail, message }) traite UN mail (id/threadId fournis) et
//  retourne un label string. Le tally est générique : tout label autre que
//  "deja_traite"/"erreur" compte comme un nouveau. Le handler fait lui-même
//  le messages.get (préserve la dédup-avant-get anti-timeout).
//
//  extraConfigFields(counts) (optionnel) → champs additionnels fusionnés
//  dans la MAJ de config (ex. stats spécifiques boîte).
// ═══════════════════════════════════════════════════════════════
export async function runGmailSync({
  gmail,
  configRef,
  handler,
  trigger = "schedule",
  logPrefix = "gmailSync",
  resyncQuery = DEFAULT_RESYNC_QUERY,
  inboxQuery = DEFAULT_INBOX_QUERY,
  maxResync = DEFAULT_MAX_RESYNC,
  extraConfigFields = null,
}) {
  console.log(`[${logPrefix}] démarrage (trigger=${trigger})`);

  // 1. Charger la config
  const configSnap = await configRef.get();
  if (!configSnap.exists) {
    console.warn(`[${logPrefix}] config absente (${configRef.path}), abandon`);
    return { skipped: "config_absente", counts: {}, nbNouveaux: 0, nbErreurs: 0, nbDejaTraites: 0, fullResync: false, historyId: null };
  }
  const config = configSnap.data();
  if (config.actif === false) {
    console.log(`[${logPrefix}] désactivé via config.actif=false, abandon`);
    return { skipped: "inactif", counts: {}, nbNouveaux: 0, nbErreurs: 0, nbDejaTraites: 0, fullResync: false, historyId: null };
  }

  // 2. Collecter les messages (gmailId -> message)
  const collected = new Map();
  let fullResync = false;

  // a) History API incrémentale
  if (config.dernierHistoryId) {
    try {
      let pageToken;
      do {
        const history = await gmail.users.history.list({
          userId: "me",
          startHistoryId: config.dernierHistoryId,
          historyTypes: ["messageAdded"],
          pageToken,
        });
        const fromHistory = (history.data.history || [])
          .flatMap(h => (h.messagesAdded || []).map(ma => ma.message))
          .filter(m => m.labelIds?.includes("INBOX"));
        for (const m of fromHistory) collected.set(m.id, m);
        pageToken = history.data.nextPageToken;
      } while (pageToken);
    } catch (e) {
      const status = e?.code ?? e?.response?.status;
      if (status === 404) {
        // historyId périmé/invalide : seule sortie correcte = resync complet.
        fullResync = true;
        console.warn(`[${logPrefix}] historyId ${config.dernierHistoryId} périmé/invalide (404) → BASCULEMENT resync complet`);
      } else {
        console.warn(`[${logPrefix}] History API en échec (non-404), on continue:`, e.message);
      }
    }
  } else {
    fullResync = true;
    console.log(`[${logPrefix}] aucun dernierHistoryId connu → resync complet initial`);
  }

  // b) Collecte selon le mode
  if (fullResync) {
    let pageToken;
    let scanned = 0;
    do {
      const list = await gmail.users.messages.list({
        userId: "me",
        q: resyncQuery,
        maxResults: 100,
        pageToken,
      });
      const batch = list.data.messages || [];
      for (const m of batch) {
        if (!collected.has(m.id)) collected.set(m.id, m);
      }
      scanned += batch.length;
      pageToken = list.data.nextPageToken;
    } while (pageToken && scanned < maxResync);
    console.log(`[${logPrefix}] resync complet : ${scanned} messages scannés (cap ${maxResync})`);
  } else {
    const list = await gmail.users.messages.list({
      userId: "me",
      q: inboxQuery,
      maxResults: 100,
    });
    for (const m of (list.data.messages || [])) {
      if (!collected.has(m.id)) collected.set(m.id, m);
    }
  }

  const messages = Array.from(collected.values());
  console.log(`[${logPrefix}] ${messages.length} mails à traiter (fullResync=${fullResync})`);

  // 3. Traiter chaque mail via le handler (idempotence fine = handler)
  const counts = {};
  let nbNouveaux = 0;
  let nbDejaTraites = 0;
  let nbErreurs = 0;
  for (const message of messages) {
    try {
      const result = await handler({ gmail, message });
      const label = result == null ? "ignore" : String(result);
      counts[label] = (counts[label] || 0) + 1;
      if (label === "deja_traite") nbDejaTraites++;
      else if (label === "erreur") nbErreurs++;
      else nbNouveaux++;
    } catch (e) {
      console.error(`[${logPrefix}] erreur sur mail ${message.id}:`, e.message);
      counts.erreur = (counts.erreur || 0) + 1;
      nbErreurs++;
    }
  }

  // 4. MAJ config (reset historyId sur le historyId courant)
  const profile = await gmail.users.getProfile({ userId: "me" });
  const historyId = String(profile.data.historyId);
  const update = {
    dernierHistoryId: historyId,
    derniereSync: admin.firestore.FieldValue.serverTimestamp(),
    derniereSyncTrigger: trigger,
    derniereSyncFullResync: fullResync,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  if (typeof extraConfigFields === "function") {
    Object.assign(update, extraConfigFields(counts) || {});
  }
  await configRef.update(update);

  console.log(`[${logPrefix}] terminé : ${nbNouveaux} nouveaux, ${nbDejaTraites} déjà traités, ${nbErreurs} erreurs, fullResync=${fullResync}`);

  return { counts, nbNouveaux, nbErreurs, nbDejaTraites, fullResync, historyId };
}

// ═══════════════════════════════════════════════════════════════
//  Parsing Gmail (lifté tel quel de gmailPoll.js)
// ═══════════════════════════════════════════════════════════════
export function parseGmailMessage(message) {
  const headers = {};
  (message.payload?.headers || []).forEach(h => {
    headers[h.name.toLowerCase()] = h.value;
  });
  const { fromName, fromEmail } = parseFrom(headers["from"] || "");
  const to = parseEmailList(headers["to"]);
  const cc = parseEmailList(headers["cc"]);
  const subject = headers["subject"] || "(sans objet)";
  const date = headers["date"]
    ? new Date(headers["date"]).toISOString()
    : new Date().toISOString();
  const { html, text } = extractBodies(message.payload);
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
//  Téléchargement pièces jointes — fix anti-doublons v1.18.2 préservé.
//  `prefix` paramètre le dossier Storage racine (sav: "mails", achat: "ar").
// ═══════════════════════════════════════════════════════════════
export async function downloadAttachments({ gmail, gmailId, payload, prefix = "mails" }) {
  const pjs = [];
  const walk = async (part) => {
    if (!part) return;
    if (part.filename && part.body?.attachmentId) {
      const att = await gmail.users.messages.attachments.get({
        userId: "me", messageId: gmailId, id: part.body.attachmentId,
      });
      const buffer = Buffer.from(att.data.data, "base64");
      const safeName = part.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
      // Path DÉTERMINISTE basé sur l'attachmentId Gmail (stable pour un même
      // mail + même PJ) → une re-tentative écrase au lieu de dupliquer.
      const safeAttId = String(part.body.attachmentId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
      const path = `${prefix}/${gmailId}/${safeAttId}_${safeName}`;
      const file = bucket.file(path);
      await file.save(buffer, {
        contentType: part.mimeType,
        metadata: { contentType: part.mimeType },
        resumable: false,
      });
      // URL signée 30 jours (recommandation audit 4.7).
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const [url] = await file.getSignedUrl({ action: "read", expires });
      pjs.push({
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

export function classifyAttachment(mime, name) {
  if (!mime) mime = "";
  if (mime.startsWith("image/")) return "image";
  if (mime === "application/pdf") return "pdf";
  if (/(word|officedocument)/i.test(mime)) return "doc";
  if (/\.(jpe?g|png|gif|webp|heic)$/i.test(name || "")) return "image";
  if (/\.pdf$/i.test(name || "")) return "pdf";
  return "other";
}

// ═══════════════════════════════════════════════════════════════
//  Appel Claude → JSON. content = string OU tableau de blocs Anthropic
//  (texte + document PDF base64). Retourne l'objet parsé ou null.
// ═══════════════════════════════════════════════════════════════
export async function callClaudeJson({ apiKey, model, system, content, maxTokens = 1500 }) {
  if (!apiKey) {
    console.warn("[gmailCore/callClaudeJson] apiKey absente, IA désactivée");
    return null;
  }
  const messageContent = typeof content === "string"
    ? [{ type: "text", text: content }]
    : content;
  const body = {
    model,
    max_tokens: maxTokens,
    messages: [{ role: "user", content: messageContent }],
  };
  if (system) body.system = system;

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
      console.error("[gmailCore/callClaudeJson] HTTP", res.status, await res.text());
      return null;
    }
    const data = await res.json();
    const text = data.content?.find(b => b.type === "text")?.text
      || data.content?.[0]?.text
      || "";
    return extractJson(text);
  } catch (e) {
    console.error("[gmailCore/callClaudeJson] erreur:", e.message);
    return null;
  }
}

function extractJson(s) {
  const first = s.indexOf("{");
  const last = s.lastIndexOf("}");
  if (first === -1 || last === -1) return null;
  try {
    return JSON.parse(s.slice(first, last + 1));
  } catch (e) {
    console.error("[gmailCore/extractJson] JSON invalide:", e.message);
    return null;
  }
}

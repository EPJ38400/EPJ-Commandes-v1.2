// ═══════════════════════════════════════════════════════════════
//  gmailLabels — Application du label Gmail quand un mail
//                est classé manuellement depuis l'app
//  v1.18.0 — Brique labels Gmail
//
//  Trigger : quand un doc dans reserveMailsAClasser passe de
//  statut "en_attente" à "classe" (depuis l'app, après création
//  ou rattachement à une réserve), on applique le label Gmail
//  correspondant et on retire INBOX + label "A-classer".
//
//  Cette fonction est nécessaire parce que gmailPoll ne réagit
//  qu'aux nouveaux mails entrants, pas aux changements d'état.
// ═══════════════════════════════════════════════════════════════
import { onDocumentUpdated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";
import { google } from "googleapis";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// Mêmes secrets que gmailPoll/gmailSend
const GMAIL_CLIENT_ID = defineSecret("GMAIL_CLIENT_ID");
const GMAIL_CLIENT_SECRET = defineSecret("GMAIL_CLIENT_SECRET");
const GMAIL_REFRESH_TOKEN = defineSecret("GMAIL_REFRESH_TOKEN");
const GMAIL_REDIRECT_URI = "https://developers.google.com/oauthplayground";

const LABEL_ROOT = "EPJ";
const LABEL_A_CLASSER = `${LABEL_ROOT}/A-classer`;

// ─── Utils labels ───────────────────────────────────────────
const _labelCache = new Map();

async function ensureLabel(gmail, name) {
  if (_labelCache.has(name)) return _labelCache.get(name);
  const list = await gmail.users.labels.list({ userId: "me" });
  for (const lbl of (list.data.labels || [])) {
    _labelCache.set(lbl.name, lbl.id);
  }
  if (_labelCache.has(name)) return _labelCache.get(name);
  const res = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name,
      messageListVisibility: "hide",
      labelListVisibility: "labelShow",
    },
  });
  _labelCache.set(name, res.data.id);
  return res.data.id;
}

function sanitizeLabelFragment(s) {
  return String(s || "")
    .replace(/[\\/\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function buildChantierLabelName(chantierNum, chantierNom) {
  const num = sanitizeLabelFragment(chantierNum || "");
  const nom = sanitizeLabelFragment(chantierNom || "");
  if (!num && !nom) return null;
  const tail = nom ? `${num} — ${nom}` : num;
  return `${LABEL_ROOT}/${tail}`;
}

// ─── Trigger : mail "à classer" → "classé" ──────────────────
export const onMailAClasserUpdate = onDocumentUpdated(
  {
    document: "reserveMailsAClasser/{mailId}",
    region: "europe-west1",
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN],
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // On ne réagit qu'à la transition en_attente → classe
    if (before.statut === after.statut) return;
    if (after.statut !== "classe") return;
    if (!after.gmailId) return;

    // Récupérer le chantierNum/chantierNom depuis la réserve liée
    let chantierNum = "";
    let chantierNom = "";
    if (after.classeVersReserveId) {
      try {
        const rsnap = await db.collection("reserves").doc(after.classeVersReserveId).get();
        if (rsnap.exists) {
          const r = rsnap.data();
          chantierNum = r.chantierNum || "";
          chantierNom = r.chantierNom || "";
        }
      } catch (e) {
        console.warn("[onMailAClasserUpdate] lecture réserve échouée:", e.message);
      }
    }

    const labelName = buildChantierLabelName(chantierNum, chantierNom);
    if (!labelName) {
      console.log("[onMailAClasserUpdate] pas de chantier identifiable, label non appliqué.");
      return;
    }

    // Auth Gmail
    const oauth2Client = new google.auth.OAuth2(
      GMAIL_CLIENT_ID.value(),
      GMAIL_CLIENT_SECRET.value(),
      GMAIL_REDIRECT_URI,
    );
    oauth2Client.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN.value() });
    const gmail = google.gmail({ version: "v1", auth: oauth2Client });

    try {
      const chantierLabelId = await ensureLabel(gmail, labelName);

      // Récupère aussi l'ID du label A-classer (création si besoin)
      const aClasserLabelId = await ensureLabel(gmail, LABEL_A_CLASSER);

      await gmail.users.messages.modify({
        userId: "me",
        id: after.gmailId,
        requestBody: {
          addLabelIds: [chantierLabelId],
          removeLabelIds: ["INBOX", aClasserLabelId],
        },
      });
      console.log(`[onMailAClasserUpdate] mail ${after.gmailId} déplacé vers ${labelName}`);
    } catch (e) {
      console.warn(`[onMailAClasserUpdate] application label échouée:`, e.message);
    }
  }
);

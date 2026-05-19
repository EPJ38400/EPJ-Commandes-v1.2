// ═══════════════════════════════════════════════════════════════
//  functions/gmailSend.js — v1.13.0
//
//  Cloud Function trigger : déclenchée à la création d'un document
//  dans la collection mailOutbox. Envoie le mail via Gmail API depuis
//  la boîte sav@epj-electricite.com, archive le mail sortant dans
//  reserveMails, puis nettoie l'entrée outbox.
//
//  Architecture cohérente avec index.js (Brevo) :
//    - Firebase Functions v2 (onDocumentCreated)
//    - ES modules
//    - defineSecret pour les credentials Gmail
//    - Région europe-west1
// ═══════════════════════════════════════════════════════════════

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";
import { google } from "googleapis";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const GMAIL_CLIENT_ID = defineSecret("GMAIL_CLIENT_ID");
const GMAIL_CLIENT_SECRET = defineSecret("GMAIL_CLIENT_SECRET");
const GMAIL_REFRESH_TOKEN = defineSecret("GMAIL_REFRESH_TOKEN");
const GMAIL_REDIRECT_URI = "https://developers.google.com/oauthplayground";

const COLLECTION_MAILS = "reserveMails";
const COLLECTION_OUTBOX = "mailOutbox";
const COLLECTION_CONFIG = "gmailConfig";

const SENDER_NAME = "EPJ Électricité — SAV";
const SENDER_EMAIL_DEFAULT = "sav@epj-electricite.com";

// ─── Cloud Function : trigger onCreate sur mailOutbox ────────
export const gmailSend = onDocumentCreated(
  {
    document: `${COLLECTION_OUTBOX}/{docId}`,
    timeoutSeconds: 120,
    memory: "256MiB",
    region: "europe-west1",
    secrets: [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN],
  },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      console.warn("[gmailSend] Event sans snapshot, on ignore");
      return;
    }
    const draft = snap.data();
    if (!draft || draft.statut !== "pending") {
      console.log("[gmailSend] doc non pending, skip");
      return;
    }

    const outboxRef = snap.ref;
    console.log("[gmailSend] envoi", draft.sujet);

    try {
      // OAuth Gmail
      const configSnap = await db.collection(COLLECTION_CONFIG).doc("main").get();
      const config = configSnap.exists ? configSnap.data() : {};
      const senderEmail = config.boiteEmail || SENDER_EMAIL_DEFAULT;

      const oauth2Client = new google.auth.OAuth2(
        GMAIL_CLIENT_ID.value(),
        GMAIL_CLIENT_SECRET.value(),
        GMAIL_REDIRECT_URI,
      );
      oauth2Client.setCredentials({
        refresh_token: GMAIL_REFRESH_TOKEN.value(),
      });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      // Construire le sujet avec tag [RES-XXX]
      let sujet = draft.sujet || "";
      if (draft.reserveNum && !sujet.includes(`[RES-${draft.reserveNum}]`)) {
        sujet = `[RES-${draft.reserveNum}] ${sujet}`;
      }

      // Construire le MIME
      const mime = buildMime({
        from: `${SENDER_NAME} <${senderEmail}>`,
        to: (draft.to || []).join(", "),
        cc: (draft.cc || []).join(", "),
        subject: sujet,
        body: draft.corps || "",
      });
      const encoded = Buffer.from(mime).toString("base64")
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      // Envoyer
      const sendOpts = { userId: "me", requestBody: { raw: encoded } };
      if (draft.gmailThreadId) sendOpts.requestBody.threadId = draft.gmailThreadId;

      const result = await gmail.users.messages.send(sendOpts);
      const gmailId = result.data.id;
      const threadId = result.data.threadId;

      // Archiver dans reserveMails
      if (draft.reserveId) {
        const rsnap = await db.collection("reserves").doc(draft.reserveId).get();
        const chantierNum = rsnap.exists ? rsnap.data().chantierNum : null;

        await db.collection(COLLECTION_MAILS).add({
          gmailId,
          gmailThreadId: threadId,
          reserveId: draft.reserveId,
          reserveNum: draft.reserveNum,
          chantierNum,
          direction: "out",
          expediteurNom: SENDER_NAME,
          expediteurEmail: senderEmail,
          destinataires: draft.to || [],
          cc: draft.cc || [],
          bcc: [],
          sujet,
          dateEnvoi: admin.firestore.FieldValue.serverTimestamp(),
          dateAspiration: admin.firestore.FieldValue.serverTimestamp(),
          corpsHtml: textToHtml(draft.corps || ""),
          corpsTexte: draft.corps || "",
          apercu: (draft.corps || "").slice(0, 180),
          piecesJointes: [],
          rattachementMethode: "manuel",
          rattachementScore: 1.0,
          rattachementParUserId: draft.senderUserId,
          rattachementDate: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      // Marquer sent (gardé 60s pour traçabilité côté UI, puis supprimé)
      await outboxRef.update({
        statut: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        gmailId, gmailThreadId: threadId,
      });
      setTimeout(async () => {
        try { await outboxRef.delete(); } catch {}
      }, 60_000);

      console.log("[gmailSend] OK", gmailId);
    } catch (e) {
      console.error("[gmailSend] erreur:", e.message);
      await outboxRef.update({
        statut: "failed",
        erreur: e.message,
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw e;
    }
  }
);

// ─── Helpers MIME ───────────────────────────────────────────
function buildMime({ from, to, cc, subject, body }) {
  const lines = [];
  lines.push(`From: ${from}`);
  lines.push(`To: ${to}`);
  if (cc) lines.push(`Cc: ${cc}`);
  lines.push(`Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`);
  lines.push(`MIME-Version: 1.0`);
  lines.push(`Content-Type: text/html; charset=UTF-8`);
  lines.push(`Content-Transfer-Encoding: base64`);
  lines.push("");
  const html = textToHtml(body);
  const encoded = Buffer.from(html, "utf8").toString("base64");
  const chunks = encoded.match(/.{1,76}/g) || [encoded];
  lines.push(chunks.join("\r\n"));
  return lines.join("\r\n");
}

function textToHtml(text) {
  const escaped = String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const html = escaped.replace(/\n/g, "<br>");
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>body{font-family:Inter,Arial,sans-serif;font-size:14px;color:#1A1A1A;line-height:1.5}</style>
</head>
<body>${html}</body>
</html>`;
}

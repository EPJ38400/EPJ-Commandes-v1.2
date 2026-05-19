/* ═══════════════════════════════════════════════════════════════
   gmailSend.js — Cloud Function trigger
   v1.13.0 — Brique mail

   Déclencheur : création d'un document dans la collection `mailOutbox`.
   Action : envoie le mail via Gmail API depuis la boîte sav@,
   archive le mail sortant dans `reserveMails` (rattaché à la réserve),
   puis supprime le doc de la file d'attente.

   PRÉREQUIS : mêmes que gmailPoll (OAuth Gmail + config)
   ═══════════════════════════════════════════════════════════════ */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { google } = require("googleapis");

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const COLLECTION_MAILS = "reserveMails";
const COLLECTION_OUTBOX = "mailOutbox";
const COLLECTION_CONFIG = "gmailConfig";

// ─── Trigger : nouveau document dans mailOutbox ─────────────
exports.gmailSend = functions
  .runWith({ timeoutSeconds: 120, memory: "256MB" })
  .firestore.document(`${COLLECTION_OUTBOX}/{docId}`)
  .onCreate(async (snap, context) => {
    const draft = snap.data();
    if (!draft || draft.statut !== "pending") return null;

    const outboxRef = snap.ref;
    console.log("[gmailSend] envoi", draft.sujet);

    try {
      // 1. OAuth
      const configSnap = await db.collection(COLLECTION_CONFIG).doc("main").get();
      if (!configSnap.exists) {
        throw new Error("Config Gmail absente");
      }
      const config = configSnap.data();
      const oauth2Client = new google.auth.OAuth2(
        functions.config().gmail.client_id,
        functions.config().gmail.client_secret,
        functions.config().gmail.redirect_uri,
      );
      oauth2Client.setCredentials({ refresh_token: config.oauthRefreshToken });
      const gmail = google.gmail({ version: "v1", auth: oauth2Client });

      // 2. Construire le MIME
      // Sujet : on ajoute le tag [RES-XXX] s'il n'y est pas déjà
      let sujet = draft.sujet || "";
      if (draft.reserveNum && !sujet.includes(`[RES-${draft.reserveNum}]`)) {
        sujet = `[RES-${draft.reserveNum}] ${sujet}`;
      }

      const senderEmail = config.boiteEmail || "sav@epj-electricite.com";
      const senderName = "EPJ Électricité — SAV";

      const mime = buildMime({
        from: `${senderName} <${senderEmail}>`,
        to: (draft.to || []).join(", "),
        cc: (draft.cc || []).join(", "),
        subject: sujet,
        body: draft.corps || "",
      });

      const encoded = Buffer.from(mime).toString("base64")
        .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

      // 3. Envoyer
      const sendOpts = { userId: "me", requestBody: { raw: encoded } };
      if (draft.gmailThreadId) sendOpts.requestBody.threadId = draft.gmailThreadId;

      const result = await gmail.users.messages.send(sendOpts);
      const gmailId = result.data.id;
      const threadId = result.data.threadId;

      // 4. Archiver dans reserveMails (mail sortant)
      if (draft.reserveId) {
        // Récupérer le chantierNum depuis la réserve
        const rsnap = await db.collection("reserves").doc(draft.reserveId).get();
        const chantierNum = rsnap.exists ? rsnap.data().chantierNum : null;

        await db.collection(COLLECTION_MAILS).add({
          gmailId,
          gmailThreadId: threadId,
          reserveId: draft.reserveId,
          reserveNum: draft.reserveNum,
          chantierNum,
          direction: "out",
          expediteurNom: senderName,
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

      // 5. Marquer le doc outbox comme envoyé puis supprimer
      await outboxRef.update({
        statut: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        gmailId, gmailThreadId: threadId,
      });
      // On garde 1 minute pour traçabilité côté UI, puis cleanup côté GC
      setTimeout(async () => {
        try { await outboxRef.delete(); } catch {}
      }, 60_000);

      console.log("[gmailSend] OK", gmailId);
      return null;
    } catch (e) {
      console.error("[gmailSend] erreur:", e.message);
      await outboxRef.update({
        statut: "failed",
        erreur: e.message,
        failedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      throw e;
    }
  });

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
  // Découper en lignes de 76 caractères (RFC 2045)
  const chunks = encoded.match(/.{1,76}/g) || [encoded];
  lines.push(chunks.join("\r\n"));
  return lines.join("\r\n");
}

function textToHtml(text) {
  // Conversion simple texte → HTML (préserve sauts de ligne)
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

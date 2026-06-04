// ═══════════════════════════════════════════════════════════════
//  functions/prepareAchatReclamation.js — Dashboard achat V2
//
//  Callable HTTPS : prépare un BROUILLON de réclamation fournisseur pour
//  un écart de prix (achatEcartsPrix/{ecartId}).
//
//  Workflow :
//    1. Lit l'écart + la commande Esabora associée (contexte prix).
//    2. Résout le destinataire :
//         customEmail fourni  → utilisé + mémorisé fournisseursContacts.
//         sinon fournisseursContacts/{codeFournisseur}.email (mémoire).
//         sinon expéditeur de l'AR original
//               (gmailAchatExtractions/{arRef.gmailId}.fromEmail).
//    3. Claude Haiku 4.5 rédige objet + corps du mail (JSON strict).
//    4. Crée un BROUILLON dans la boîte achat@ (Gmail API, refresh token
//       GMAIL_ACHAT_REFRESH_TOKEN). L'utilisateur valide et envoie depuis
//       Gmail comme d'habitude.
//    5. Merge sur l'écart : statut="RECLAME", reclame* (qui/quand/draftId).
//
//  ⚠ Pas d'OAuth par utilisateur dans cette app : le brouillon vit dans
//  achat@ (boîte métier des achats, là où l'AR est arrivé).
//
//  Secrets : GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_ACHAT_REFRESH_TOKEN,
//            ANTHROPIC_API_KEY (tous déjà configurés, réutilisés tels quels).
// ═══════════════════════════════════════════════════════════════

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";
import { buildGmailClient, callClaudeJson } from "./lib/gmailCore.js";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const GMAIL_CLIENT_ID = defineSecret("GMAIL_CLIENT_ID");
const GMAIL_CLIENT_SECRET = defineSecret("GMAIL_CLIENT_SECRET");
const GMAIL_ACHAT_REFRESH_TOKEN = defineSecret("GMAIL_ACHAT_REFRESH_TOKEN");
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const SECRETS = [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_ACHAT_REFRESH_TOKEN, ANTHROPIC_API_KEY];

const COL_ECARTS = "achatEcartsPrix";
const COL_COMMANDES_ESABORA = "commandesEsabora";
const COL_CACHE = "gmailAchatExtractions";
const COL_CONTACTS = "fournisseursContacts";

const CLAUDE_MODEL = "claude-haiku-4-5-20251001";
const ACHAT_EMAIL = "achat@epj-electricite.com";
const SENDER_NAME = "EPJ Électricité — Achats";
const PILOTAGE = ["Admin", "Direction", "Conducteur travaux", "Assistante"];

export const prepareAchatReclamation = onCall(
  { region: "europe-west1", timeoutSeconds: 120, memory: "512MiB", secrets: SECRETS },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Vous devez être connecté.");
    }
    const role = request.auth.token?.role;
    if (!PILOTAGE.includes(role)) {
      throw new HttpsError("permission-denied", "Réservé aux rôles de pilotage.");
    }

    const ecartId = String(request.data?.ecartId || "").trim();
    const customEmail = request.data?.customEmail != null
      ? String(request.data.customEmail).trim()
      : null;
    if (!ecartId) {
      throw new HttpsError("invalid-argument", "ecartId manquant.");
    }
    if (customEmail && !isEmail(customEmail)) {
      throw new HttpsError("invalid-argument", "Adresse e-mail invalide.");
    }

    // 1. Écart + commande
    const ecartRef = db.collection(COL_ECARTS).doc(ecartId);
    const ecartSnap = await ecartRef.get();
    if (!ecartSnap.exists) {
      throw new HttpsError("not-found", `Écart ${ecartId} introuvable.`);
    }
    const ecart = ecartSnap.data() || {};
    const numero = ecart.numero || null;

    let ce = {};
    if (numero) {
      const ceSnap = await db.collection(COL_COMMANDES_ESABORA).doc(numero).get();
      if (ceSnap.exists) ce = ceSnap.data() || {};
    }

    const codeFournisseur = sanitizeId(ce.codeFournisseur || ecart.fournisseur || "INCONNU");
    const fournisseurNom = ce.arRef?.fournisseur || ecart.fournisseur || "votre société";

    // 2. Destinataire
    let destinataire = customEmail;
    if (!destinataire) {
      const contactSnap = await db.collection(COL_CONTACTS).doc(codeFournisseur).get();
      if (contactSnap.exists) destinataire = contactSnap.data()?.email || null;
    }
    if (!destinataire && ce.arRef?.gmailId) {
      const cacheSnap = await db.collection(COL_CACHE).doc(ce.arRef.gmailId).get();
      if (cacheSnap.exists) destinataire = cacheSnap.data()?.fromEmail || null;
    }
    if (!destinataire || !isEmail(destinataire)) {
      throw new HttpsError(
        "failed-precondition",
        "Destinataire introuvable. Précisez l'adresse du fournisseur (customEmail).",
      );
    }

    // 3. Rédaction IA
    const ia = await redigerReclamation(ANTHROPIC_API_KEY.value(), {
      numero, fournisseurNom,
      reference: ecart.reference,
      designation: ecart.designation,
      prixCommande: ecart.prixUnitaireCommande,
      prixAR: ecart.prixUnitaireAR,
      ecart: ecart.ecart,
      ecartPct: ecart.ecartPct,
      quantite: ecart.quantite,
    });
    const objet = (ia?.objet || `Écart de prix — commande ${numero || ""}`).trim();
    const corps = (ia?.corps || corpsFallback({ numero, fournisseurNom, ecart })).trim();

    // 4. Brouillon dans achat@
    const gmail = buildGmailClient({
      clientId: GMAIL_CLIENT_ID.value(),
      clientSecret: GMAIL_CLIENT_SECRET.value(),
      refreshToken: GMAIL_ACHAT_REFRESH_TOKEN.value(),
    });
    const raw = buildRawMessage({
      from: `${SENDER_NAME} <${ACHAT_EMAIL}>`,
      to: destinataire,
      subject: objet,
      body: corps,
    });
    let draftId = null;
    let draftMessageId = null;
    try {
      const res = await gmail.users.drafts.create({
        userId: "me",
        requestBody: { message: { raw } },
      });
      draftId = res.data.id;
      draftMessageId = res.data.message?.id || null;
    } catch (e) {
      console.error("[prepareAchatReclamation] échec création brouillon:", e.message);
      throw new HttpsError("internal", "Impossible de créer le brouillon Gmail.");
    }
    const draftWebUrl = draftMessageId
      ? `https://mail.google.com/mail/u/0/#drafts/${draftMessageId}`
      : "https://mail.google.com/mail/u/0/#drafts";

    // 5a. Mémorise / met à jour le contact fournisseur
    await db.collection(COL_CONTACTS).doc(codeFournisseur).set({
      email: destinataire,
      fournisseurNom,
      derniereUtilisation: admin.firestore.FieldValue.serverTimestamp(),
      creePar: request.auth.uid,
    }, { merge: true });

    // 5b. Merge sur l'écart : statut RECLAME + traçabilité
    await ecartRef.set({
      statut: "RECLAME",
      reclameLe: admin.firestore.FieldValue.serverTimestamp(),
      reclamePar: request.auth.uid,
      reclameMailMessageId: draftId,
      reclameDraftUrl: draftWebUrl,
    }, { merge: true });

    return { success: true, draftId, draftWebUrl, destinataire };
  },
);

// ═══════════════════════════════════════════════════════════════
//  Rédaction IA — objet + corps en JSON strict (Claude Haiku 4.5)
// ═══════════════════════════════════════════════════════════════
async function redigerReclamation(apiKey, ctx) {
  const ecartTxt = ctx.ecart != null ? `${ctx.ecart > 0 ? "+" : ""}${ctx.ecart} € HT/u` : "écart constaté";
  const pctTxt = ctx.ecartPct != null ? ` (${ctx.ecartPct > 0 ? "+" : ""}${ctx.ecartPct} %)` : "";
  const system = "Tu es l'assistant achats d'EPJ Électricité Générale (PME du bâtiment). Tu rédiges des courriers professionnels, courtois et factuels, en français. Tu réponds UNIQUEMENT en JSON valide, sans texte avant/après.";
  const prompt = `Rédige un e-mail de réclamation à un fournisseur pour un écart de prix entre notre commande et son accusé de réception (AR).

Contexte :
- Fournisseur : ${ctx.fournisseurNom}
- N° de commande : ${ctx.numero || "(non précisé)"}
- Référence article : ${ctx.reference || "(non précisée)"}
- Désignation : ${ctx.designation || "(non précisée)"}
- Quantité : ${ctx.quantite != null ? ctx.quantite : "(non précisée)"}
- Prix unitaire commandé : ${ctx.prixCommande != null ? ctx.prixCommande + " € HT" : "(inconnu)"}
- Prix unitaire confirmé sur l'AR : ${ctx.prixAR != null ? ctx.prixAR + " € HT" : "(inconnu)"}
- Écart : ${ecartTxt}${pctTxt}

Consignes :
- Ton courtois mais ferme. Demande l'alignement sur le prix commandé OU une explication écrite.
- Cite précisément la référence, le n° de commande et les deux prix.
- Signature : "Service Achats — EPJ Électricité Générale". Pas de coordonnées inventées.
- Pas de markdown, texte brut avec sauts de ligne.

Réponds STRICTEMENT : { "objet": "...", "corps": "..." }`;

  return callClaudeJson({ apiKey, model: CLAUDE_MODEL, system, content: prompt, maxTokens: 1200 });
}

function corpsFallback({ numero, fournisseurNom, ecart }) {
  const e = ecart || {};
  return `Bonjour,

Nous constatons un écart de prix sur votre accusé de réception concernant la commande ${numero || "(réf. à préciser)"}.

Article : ${e.reference || ""} ${e.designation ? "— " + e.designation : ""}
Prix commandé : ${e.prixUnitaireCommande != null ? e.prixUnitaireCommande + " € HT" : "?"}
Prix confirmé (AR) : ${e.prixUnitaireAR != null ? e.prixUnitaireAR + " € HT" : "?"}
Écart : ${e.ecart != null ? (e.ecart > 0 ? "+" : "") + e.ecart + " € HT/u" : "?"}

Merci de bien vouloir aligner ce prix sur notre commande, ou de nous transmettre une explication écrite.

Cordialement,
Service Achats — EPJ Électricité Générale`;
}

// ═══════════════════════════════════════════════════════════════
//  Helpers MIME / divers
// ═══════════════════════════════════════════════════════════════
function buildRawMessage({ from, to, subject, body }) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset=UTF-8',
    "Content-Transfer-Encoding: base64",
    "",
  ];
  const encodedBody = Buffer.from(String(body || ""), "utf8").toString("base64");
  const chunks = encodedBody.match(/.{1,76}/g) || [encodedBody];
  const mime = lines.join("\r\n") + chunks.join("\r\n");
  return Buffer.from(mime, "utf8").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || ""));
}

function sanitizeId(s) {
  return String(s).trim().replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 200) || "INCONNU";
}

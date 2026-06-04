// ═══════════════════════════════════════════════════════════════
//  functions/prepareAchatReclamation.js — Dashboard achat V2
//
//  Callable HTTPS : prépare UN brouillon de réclamation fournisseur pour
//  UNE commande (regroupe TOUS ses écarts de prix ouverts dans un seul mail).
//
//  Workflow :
//    1. Charge tous les écarts NON résolus de la commande (achatEcartsPrix
//       where numero == numero) + la commande Esabora associée.
//    2. Résout le destinataire :
//         customEmail fourni  → utilisé + mémorisé fournisseursContacts.
//         sinon fournisseursContacts/{codeFournisseur}.email (mémoire).
//         sinon expéditeur de l'AR original
//               (gmailAchatExtractions/{arRef.gmailId}.fromEmail).
//    3. Claude Haiku 4.5 rédige objet + corps listant TOUTES les lignes.
//    4. Crée UN brouillon dans la boîte achat@ (Gmail API, refresh token
//       GMAIL_ACHAT_REFRESH_TOKEN — scope gmail.compose requis).
//    5. Batch sur les écarts : statut="RECLAME", reclame* (qui/quand/draft).
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

    const numero = String(request.data?.numero || "").trim();
    const customEmail = request.data?.customEmail != null
      ? String(request.data.customEmail).trim()
      : null;
    if (!numero) {
      throw new HttpsError("invalid-argument", "numero manquant.");
    }
    if (customEmail && !isEmail(customEmail)) {
      throw new HttpsError("invalid-argument", "Adresse e-mail invalide.");
    }

    // 1. Tous les écarts NON résolus de la commande
    const ecartsSnap = await db.collection(COL_ECARTS).where("numero", "==", numero).get();
    const ecartsDocs = ecartsSnap.docs.filter((d) => (d.data()?.statut || "OUVERT") !== "RESOLU");
    if (!ecartsDocs.length) {
      throw new HttpsError("failed-precondition", `Aucun écart ouvert pour la commande ${numero}.`);
    }
    const lignes = ecartsDocs.map((d) => d.data());

    // Commande Esabora associée (codeFournisseur, expéditeur AR)
    let ce = {};
    const ceSnap = await db.collection(COL_COMMANDES_ESABORA).doc(numero).get();
    if (ceSnap.exists) ce = ceSnap.data() || {};

    const fournisseurRef = ce.codeFournisseur || lignes.find((l) => l.fournisseur)?.fournisseur || "INCONNU";
    const codeFournisseur = sanitizeId(fournisseurRef);
    const fournisseurNom = ce.arRef?.fournisseur || lignes.find((l) => l.fournisseur)?.fournisseur || "votre société";

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

    // 3. Rédaction IA (toutes les lignes)
    const ia = await redigerReclamation(ANTHROPIC_API_KEY.value(), { numero, fournisseurNom, lignes });
    const objet = (ia?.objet || `Écart de prix — commande ${numero}`).trim();
    const corps = (ia?.corps || corpsFallback({ numero, lignes })).trim();

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
      const detail = e?.errors?.[0]?.message || e?.message || String(e);
      console.error("[prepareAchatReclamation] échec création brouillon:", detail);
      // Cas le plus probable : token achat@ en gmail.readonly (pas de droit
      // d'écriture). On le rend explicite côté UI plutôt qu'un "internal" opaque.
      if (/scope|insufficient|permission|403/i.test(detail)) {
        throw new HttpsError(
          "failed-precondition",
          "Le compte achat@ n'a pas le droit de créer des brouillons (scope gmail.compose manquant). Régénérer GMAIL_ACHAT_REFRESH_TOKEN avec ce scope.",
        );
      }
      throw new HttpsError("internal", `Brouillon Gmail impossible : ${detail}`);
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

    // 5b. Batch : tous les écarts de la commande → RECLAME + traçabilité
    const batch = db.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();
    for (const d of ecartsDocs) {
      batch.set(d.ref, {
        statut: "RECLAME",
        reclameLe: now,
        reclamePar: request.auth.uid,
        reclameMailMessageId: draftId,
        reclameDraftUrl: draftWebUrl,
      }, { merge: true });
    }
    await batch.commit();

    return { success: true, draftId, draftWebUrl, destinataire, nbEcarts: ecartsDocs.length };
  },
);

// ═══════════════════════════════════════════════════════════════
//  Rédaction IA — objet + corps en JSON strict (Claude Haiku 4.5)
// ═══════════════════════════════════════════════════════════════
async function redigerReclamation(apiKey, { numero, fournisseurNom, lignes }) {
  const lignesTxt = lignes.map((l, i) => {
    const cmd = l.prixUnitaireCommande != null ? `${l.prixUnitaireCommande} € HT` : "?";
    const ar = l.prixUnitaireAR != null ? `${l.prixUnitaireAR} € HT` : "?";
    const ec = l.ecart != null ? `${l.ecart > 0 ? "+" : ""}${l.ecart} € HT/u` : "?";
    const pct = l.ecartPct != null ? ` (${l.ecartPct > 0 ? "+" : ""}${l.ecartPct} %)` : "";
    return `${i + 1}. Réf ${l.reference || "?"}${l.designation ? ` — ${l.designation}` : ""}${l.quantite != null ? ` · qté ${l.quantite}` : ""} : commandé ${cmd}, confirmé sur AR ${ar}, écart ${ec}${pct}`;
  }).join("\n");

  const system = "Tu es l'assistant achats d'EPJ Électricité Générale (PME du bâtiment). Tu rédiges des courriers professionnels, courtois et factuels, en français. Tu réponds UNIQUEMENT en JSON valide, sans texte avant/après.";
  const prompt = `Rédige UN e-mail de réclamation à un fournisseur pour PLUSIEURS écarts de prix constatés sur une même commande, entre notre bon de commande et son accusé de réception (AR).

Contexte :
- Fournisseur : ${fournisseurNom}
- N° de commande : ${numero}
- Nombre de lignes en écart : ${lignes.length}

Lignes en écart :
${lignesTxt}

Consignes :
- UN SEUL e-mail couvrant TOUTES les lignes ci-dessus (ne pas en omettre).
- Présente les lignes sous forme de liste claire et lisible (référence, prix commandé, prix AR, écart) dans le corps.
- Ton courtois mais ferme. Demande l'alignement sur les prix commandés OU une explication écrite, pour chaque ligne.
- Cite le n° de commande. Pas de markdown : texte brut avec sauts de ligne.
- Signature : "Service Achats — EPJ Électricité Générale". Pas de coordonnées inventées.

Réponds STRICTEMENT : { "objet": "...", "corps": "..." }`;

  return callClaudeJson({ apiKey, model: CLAUDE_MODEL, system, content: prompt, maxTokens: 1500 });
}

function corpsFallback({ numero, lignes }) {
  const lignesTxt = lignes.map((l) => {
    const cmd = l.prixUnitaireCommande != null ? `${l.prixUnitaireCommande} € HT` : "?";
    const ar = l.prixUnitaireAR != null ? `${l.prixUnitaireAR} € HT` : "?";
    const ec = l.ecart != null ? `${l.ecart > 0 ? "+" : ""}${l.ecart} € HT/u` : "?";
    return `- ${l.reference || ""}${l.designation ? " — " + l.designation : ""} : commandé ${cmd}, AR ${ar} (écart ${ec})`;
  }).join("\n");
  return `Bonjour,

Nous constatons ${lignes.length > 1 ? `${lignes.length} écarts de prix` : "un écart de prix"} sur votre accusé de réception concernant la commande ${numero}.

${lignesTxt}

Merci de bien vouloir aligner ces prix sur notre commande, ou de nous transmettre une explication écrite pour chaque ligne concernée.

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

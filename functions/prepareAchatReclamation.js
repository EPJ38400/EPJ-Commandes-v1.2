// ═══════════════════════════════════════════════════════════════
//  functions/prepareAchatReclamation.js — Dashboard achat (Lot 3)
//
//  Callable HTTPS : prépare UN brouillon de réclamation/relance fournisseur
//  pour UNE commande. Corps généré en GABARIT DÉTERMINISTE (pas d'IA),
//  en texte brut. Deux modes :
//
//   • "ecart"   (arStatut RECU avec écarts) → liste les écarts de PRIX
//     unitaire (depuis achatEcartsPrix ouverts) ET les écarts de QUANTITÉ
//     (recalculés via le MÊME appariement de réfs que le price-watch).
//   • "relance" (arStatut MANQUANT)         → relance pour AR non reçu.
//
//  Destinataire (ordre) :
//    0. customEmail fourni (override modal)
//    1. expéditeur de l'AR (gmailAchatExtractions/{arRef.gmailId}.fromEmail)
//    2. getFournisseurEmail(codeFournisseur, "relance") sur fournisseurs/{code}
//    3. sinon vide → brouillon sans destinataire, PJ complète dans Gmail.
//
//  Auto-apprentissage : quand l'expéditeur de l'AR est résolu et qu'aucun
//  contact "relance" n'existe pour ce code, UPSERT d'un contact
//  { email, usages:["relance"], source:"auto" } dans fournisseurs/{code}.
//  N'écrase JAMAIS un contact source:"manuel".
//
//  Source UNIQUE des contacts = collection `fournisseurs` (la legacy
//  `fournisseursContacts` n'est plus ni lue ni écrite).
//
//  Secrets : GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_ACHAT_REFRESH_TOKEN
//            (scope gmail.compose requis). Plus d'ANTHROPIC : rédaction
//            déterministe.
// ═══════════════════════════════════════════════════════════════

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";
import { buildGmailClient } from "./lib/gmailCore.js";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const GMAIL_CLIENT_ID = defineSecret("GMAIL_CLIENT_ID");
const GMAIL_CLIENT_SECRET = defineSecret("GMAIL_CLIENT_SECRET");
const GMAIL_ACHAT_REFRESH_TOKEN = defineSecret("GMAIL_ACHAT_REFRESH_TOKEN");
const SECRETS = [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_ACHAT_REFRESH_TOKEN];

const COL_ECARTS = "achatEcartsPrix";
const COL_COMMANDES_ESABORA = "commandesEsabora";
const COL_CACHE = "gmailAchatExtractions";
const COL_FOURNISSEURS = "fournisseurs";

const ACHAT_EMAIL = "achat@epj-electricite.com";
const SENDER_NAME = "EPJ Électricité — Achats";
const PILOTAGE = ["Admin", "Direction", "Conducteur travaux", "Assistante"];
const QTE_EPSILON = 0.001;

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
    const customEmail = request.data?.customEmail != null ? String(request.data.customEmail).trim() : null;
    const askedMode = request.data?.mode === "relance" || request.data?.mode === "ecart"
      ? request.data.mode : null;
    if (!numero) throw new HttpsError("invalid-argument", "numero manquant.");
    if (customEmail && !isEmail(customEmail)) {
      throw new HttpsError("invalid-argument", "Adresse e-mail invalide.");
    }

    // Commande Esabora
    const ceSnap = await db.collection(COL_COMMANDES_ESABORA).doc(numero).get();
    if (!ceSnap.exists) {
      throw new HttpsError("failed-precondition", `Commande ${numero} introuvable.`);
    }
    const ce = ceSnap.data() || {};
    const mode = askedMode || (ce.arStatut === "MANQUANT" ? "relance" : "ecart");
    const codeFournisseur = ce.codeFournisseur ? String(ce.codeFournisseur).trim() : null;
    const fournisseurNom = ce.arRef?.fournisseur || null;

    // Expéditeur de l'AR (cache d'extraction)
    let arSenderEmail = null;
    if (ce.arRef?.gmailId) {
      const cacheSnap = await db.collection(COL_CACHE).doc(ce.arRef.gmailId).get();
      if (cacheSnap.exists) {
        const fe = cacheSnap.data()?.fromEmail || null;
        if (fe && isEmail(fe)) arSenderEmail = fe;
      }
    }

    // Auto-apprentissage : capture l'expéditeur AR comme contact "relance"
    // (source:auto), sans jamais écraser un contact manuel.
    if (arSenderEmail && codeFournisseur) {
      await autoCaptureRelanceContact(codeFournisseur, arSenderEmail, fournisseurNom, request.auth.uid);
    }

    // Destinataire (ordre : custom → AR → fournisseurs[relance] → vide)
    let destinataire = customEmail && isEmail(customEmail) ? customEmail : null;
    if (!destinataire) destinataire = arSenderEmail;
    if (!destinataire && codeFournisseur) destinataire = await pickRelanceEmail(codeFournisseur);
    const destinataireFinal = destinataire && isEmail(destinataire) ? destinataire : "";

    // Construction du corps déterministe selon le mode
    let objet, corps, ecartsDocs = [];
    if (mode === "relance") {
      ({ objet, corps } = buildRelanceMail(ce, numero));
    } else {
      // Écarts de PRIX ouverts (price-watch)
      const ecartsSnap = await db.collection(COL_ECARTS).where("numero", "==", numero).get();
      ecartsDocs = ecartsSnap.docs.filter((d) => (d.data()?.statut || "OUVERT") !== "RESOLU");
      const priceLines = ecartsDocs.map((d) => d.data());
      // Écarts de QUANTITÉ via le MÊME appariement que le price-watch
      const qtyLines = matchLignes(ce.lignesCommande, ce.lignesAR)
        .filter((p) => p.qtyCmd != null && p.qtyAR != null && Math.abs(p.qtyCmd - p.qtyAR) > QTE_EPSILON);
      if (!priceLines.length && !qtyLines.length) {
        throw new HttpsError("failed-precondition", `Aucun écart ouvert pour la commande ${numero}.`);
      }
      ({ objet, corps } = buildEcartMail(ce, numero, priceLines, qtyLines));
    }

    // Brouillon dans achat@
    const gmail = buildGmailClient({
      clientId: GMAIL_CLIENT_ID.value(),
      clientSecret: GMAIL_CLIENT_SECRET.value(),
      refreshToken: GMAIL_ACHAT_REFRESH_TOKEN.value(),
    });
    const raw = buildRawMessage({
      from: `${SENDER_NAME} <${ACHAT_EMAIL}>`,
      to: destinataireFinal,
      subject: objet,
      body: corps,
    });
    let draftId = null, draftMessageId = null;
    try {
      const res = await gmail.users.drafts.create({ userId: "me", requestBody: { message: { raw } } });
      draftId = res.data.id;
      draftMessageId = res.data.message?.id || null;
    } catch (e) {
      const detail = e?.errors?.[0]?.message || e?.message || String(e);
      console.error("[prepareAchatReclamation] échec création brouillon:", detail);
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

    const now = admin.firestore.FieldValue.serverTimestamp();
    if (mode === "ecart" && ecartsDocs.length) {
      // Écarts de prix → RECLAME + traçabilité
      const batch = db.batch();
      for (const d of ecartsDocs) {
        batch.set(d.ref, {
          statut: "RECLAME", reclameLe: now, reclamePar: request.auth.uid,
          reclameMailMessageId: draftId, reclameDraftUrl: draftWebUrl,
        }, { merge: true });
      }
      await batch.commit();
    } else if (mode === "relance") {
      // Traçabilité relance AR manquant sur la commande
      await db.collection(COL_COMMANDES_ESABORA).doc(numero).set({
        arRelanceLe: now, arRelancePar: request.auth.uid, arRelanceDraftUrl: draftWebUrl,
      }, { merge: true });
    }

    return {
      success: true, mode, draftId, draftWebUrl,
      destinataire: destinataireFinal || null,
      nbEcarts: ecartsDocs.length,
    };
  },
);

// ═══════════════════════════════════════════════════════════════
//  Gabarits déterministes (texte brut)
// ═══════════════════════════════════════════════════════════════
function chantierPart(ce) {
  const lbl = ce.affaireTitre || ce.chantierNum || null;
  return lbl ? ` – chantier ${lbl}` : "";
}
function appPart(ce) {
  return ce.appCommandeNum ? ` (${ce.appCommandeNum})` : "";
}

function buildRelanceMail(ce, numero) {
  const datePart = ce.dateCommande ? ` passée le ${fmtDateFr(ce.dateCommande)}` : "";
  const objet = `Relance accusé de réception — commande ${numero}`;
  const corps = `Bonjour,

Nous n'avons pas reçu votre accusé de réception pour notre commande n° ${numero}${appPart(ce)}${chantierPart(ce)}${datePart}.
Merci de bien vouloir nous le transmettre dans les meilleurs délais.

Cordialement,
Service Achats — EPJ Électricité Générale`;
  return { objet, corps };
}

function buildEcartMail(ce, numero, priceLines, qtyLines) {
  const objet = `Écarts sur accusé de réception — commande ${numero}`;
  const arDatePart = ce.arRef?.dateAR ? ` du ${fmtDateFr(ce.arRef.dateAR)}` : "";
  const parts = [];
  parts.push(`Bonjour,

Suite à votre accusé de réception${arDatePart} concernant notre commande n° ${numero}${appPart(ce)}${chantierPart(ce)}, nous relevons les écarts suivants.`);

  if (priceLines.length) {
    const lignes = priceLines.map((l) => {
      const ref = l.reference || "—";
      const desg = l.designation ? ` – ${l.designation}` : "";
      const delta = numOrNull(l.ecart);
      const deltaTxt = delta != null ? ` (${delta > 0 ? "+" : ""}${fmtEuro(delta)}/u)` : "";
      return `- Réf. ${ref}${desg} : commandé ${fmtEuro(l.prixUnitaireCommande)} / AR ${fmtEuro(l.prixUnitaireAR)}${deltaTxt}`;
    }).join("\n");
    parts.push(`Écarts de prix unitaire HT :\n${lignes}`);
  }

  if (qtyLines.length) {
    const lignes = qtyLines.map((p) => {
      const ref = p.reference || "—";
      return `- Réf. ${ref} : ${fmtQte(p.qtyCmd)} commandée(s), votre AR en mentionne ${fmtQte(p.qtyAR)}. Merci de confirmer.`;
    }).join("\n");
    parts.push(`Écarts de quantité :\n${lignes}`);
  }

  const totalHT = numOrNull(ce.totalHT);
  const totalAR = numOrNull(ce.totalAR);
  const ecartTotal = numOrNull(ce.ecartTotal);
  if (ecartTotal != null && totalAR != null && totalHT != null) {
    const sens = ecartTotal >= 0 ? "surcoût" : "économie";
    parts.push(`Au global, ${sens} de ${fmtEuro(Math.abs(ecartTotal))} HT (AR ${fmtEuro(totalAR)} au lieu de ${fmtEuro(totalHT)}).`);
  }

  parts.push(`Merci de nous adresser un AR rectifié ou la justification de ces écarts avant livraison.

Cordialement,
Service Achats — EPJ Électricité Générale`);

  return { objet, corps: parts.join("\n\n") };
}

// ═══════════════════════════════════════════════════════════════
//  Appariement réfs — MIROIR EXACT du price-watch (gmailPollAchat.js) :
//  match exact prioritaire, fallback préfixe-tolérant si non ambigu.
// ═══════════════════════════════════════════════════════════════
function matchLignes(lignesCommande, lignesAR) {
  const lc = Array.isArray(lignesCommande) ? lignesCommande : [];
  const la = Array.isArray(lignesAR) ? lignesAR : [];
  const exactMap = new Map(), normMap = new Map(), normAmbigu = new Set();
  for (const l of lc) {
    const ex = exactRef(l.reference);
    if (ex) exactMap.set(ex, l);
    const nr = normRef(l.reference);
    if (nr) { if (normMap.has(nr)) normAmbigu.add(nr); else normMap.set(nr, l); }
  }
  const pairs = [];
  for (const a of la) {
    let c = exactMap.get(exactRef(a.reference));
    if (!c) {
      const nr = normRef(a.reference);
      if (nr && !normAmbigu.has(nr)) c = normMap.get(nr);
    }
    if (!c) continue;
    pairs.push({
      reference: a.reference || c.reference || null,
      designation: a.designation || c.designation || null,
      qtyCmd: numOrNull(c.quantite),
      qtyAR: numOrNull(a.quantite),
      puCmd: numOrNull(c.prixUnitaireCommande),
      puAr: numOrNull(a.prixUnitaireAR),
    });
  }
  return pairs;
}

function exactRef(ref) {
  if (ref == null) return "";
  return String(ref).trim().toUpperCase().replace(/\s+/g, " ");
}
function normRef(ref) {
  if (ref == null) return "";
  return String(ref).trim().toUpperCase().replace(/^[A-Z]{3}\s+/, "").replace(/\s+/g, "");
}

// ═══════════════════════════════════════════════════════════════
//  Référentiel fournisseurs (source unique) — pick + auto-capture
// ═══════════════════════════════════════════════════════════════
// MIROIR de core/fournisseurs.js pickFournisseurEmail (front/back partagés).
async function pickRelanceEmail(code) {
  const id = String(code).trim();
  if (!id) return null;
  const snap = await db.collection(COL_FOURNISSEURS).doc(id).get();
  if (!snap.exists) return null;
  const f = snap.data() || {};
  const contacts = Array.isArray(f.contacts) ? f.contacts : [];
  const withEmail = contacts.filter((c) => c && c.email);
  const byUsage = withEmail.find((c) => Array.isArray(c.usages) && c.usages.includes("relance"));
  return (byUsage || withEmail[0])?.email || null;
}

async function autoCaptureRelanceContact(code, email, nom, uid) {
  const id = String(code).trim();
  if (!id || !email || !isEmail(email)) return;
  const ref = db.collection(COL_FOURNISSEURS).doc(id);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const snap = await ref.get();

  if (!snap.exists) {
    await ref.set({
      code: id, nom: nom || "", actif: true, telephone: "",
      contacts: [{ id: genContactId(), nom: nom || "", email, telephone: "", usages: ["relance"], source: "auto" }],
      createdAt: now, updatedAt: now, autoCapturedAt: now, autoCapturedPar: uid || null,
    }, { merge: true });
    return;
  }

  const f = snap.data() || {};
  const contacts = Array.isArray(f.contacts) ? f.contacts.map((c) => ({ ...c })) : [];
  const idx = contacts.findIndex((c) => Array.isArray(c?.usages) && c.usages.includes("relance"));

  if (idx >= 0) {
    const existing = contacts[idx];
    if (existing.source === "manuel") return;                 // protégé : jamais écrasé
    if ((existing.email || "").toLowerCase() === email.toLowerCase()) return; // déjà à jour
    contacts[idx] = { ...existing, email, source: "auto" };   // rafraîchit l'auto
  } else {
    contacts.push({ id: genContactId(), nom: nom || "", email, telephone: "", usages: ["relance"], source: "auto" });
  }
  await ref.set({ contacts, updatedAt: now, autoCapturedAt: now, autoCapturedPar: uid || null }, { merge: true });
}

// ═══════════════════════════════════════════════════════════════
//  Helpers MIME / format
// ═══════════════════════════════════════════════════════════════
function buildRawMessage({ from, to, subject, body }) {
  const lines = [
    `From: ${from}`,
    `To: ${to || ""}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject, "utf8").toString("base64")}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
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
function genContactId() {
  return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
function numOrNull(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[\s  ]/g, "");
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}
function fmtEuro(v) {
  const n = numOrNull(v);
  if (n == null) return "?";
  return `${n.toFixed(2).replace(".", ",")} €`;
}
function fmtQte(v) {
  const n = numOrNull(v);
  if (n == null) return "?";
  return Number.isInteger(n) ? String(n) : String(n).replace(".", ",");
}
function fmtDateFr(v) {
  if (!v) return "";
  let d;
  if (typeof v === "object" && typeof v.toDate === "function") d = v.toDate();
  else d = new Date(v);
  if (Number.isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

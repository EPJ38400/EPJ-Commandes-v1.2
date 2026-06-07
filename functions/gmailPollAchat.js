// ═══════════════════════════════════════════════════════════════
//  functions/gmailPollAchat.js — Module Commande, étape 3
//
//  Aspire la boîte achat@epj-electricite.com (sans libellé) et n'exploite
//  QUE les mails dont on extrait un numero Esabora qui matche un
//  commandesEsabora/{numero} existant (créé par le webhook Zapier étape 1).
//  Tout le reste est ignoré.
//
//  Deux types de mail par numero :
//    • expéditeur @esabora.solutions → COPIE de commande EPJ (prix
//      unitaires commandés) → alimente lignesCommande.
//    • expéditeur ≠ @esabora.solutions → AR FOURNISSEUR → alimente
//      lignesAR + totalAR + dates de livraison, arStatut = "RECU".
//
//  Price-watch ligne à ligne dès que lignesCommande ET lignesAR présents.
//
//  S'appuie sur functions/lib/gmailCore.js (boîte-agnostique). Ne touche
//  PAS gmailPoll.js (sav) ni gmailCore.js.
//
//  Secrets : GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_ACHAT_REFRESH_TOKEN,
//            ANTHROPIC_API_KEY.
// ═══════════════════════════════════════════════════════════════

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";
import pdfParse from "pdf-parse/lib/pdf-parse.js";

import {
  buildGmailClient,
  runGmailSync,
  parseGmailMessage,
  downloadAttachments,
  callClaudeJson,
} from "./lib/gmailCore.js";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ─── Secrets ────────────────────────────────────────────────
const GMAIL_CLIENT_ID = defineSecret("GMAIL_CLIENT_ID");
const GMAIL_CLIENT_SECRET = defineSecret("GMAIL_CLIENT_SECRET");
const GMAIL_ACHAT_REFRESH_TOKEN = defineSecret("GMAIL_ACHAT_REFRESH_TOKEN");
const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const ACHAT_SECRETS = [GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_ACHAT_REFRESH_TOKEN, ANTHROPIC_API_KEY];

// ─── Constantes ─────────────────────────────────────────────
const COL_COMMANDES_ESABORA = "commandesEsabora";
const COL_ECARTS = "achatEcartsPrix";
const COL_CACHE = "gmailAchatExtractions"; // cache terminal par gmailId
const COL_CONFIG = "gmailConfigAchat";
const CONFIG_DOC = "main";

const CLAUDE_MODEL_AR = "claude-sonnet-4-6";
const ESABORA_DOMAIN = "@esabora.solutions";
// Domaine EPJ : un mail venant d'une adresse interne (ex. copie de BC qui
// atterrit dans achat@) n'est JAMAIS un AR fournisseur — cf. incident 235236.
const EPJ_DOMAIN = "@epj-electricite.com";
// Scope élargi : on ne se limite plus à in:inbox pour capter aussi les mails
// rangés hors boîte de réception (archivés / classés). Le matching par numero
// (commande existante dans commandesEsabora) + la logique sender-based restent
// les seuls garde-fous d'exploitation.
const SCOPE_QUERY = "has:attachment newer_than:30d";
const PRIX_EPSILON = 0.01; // 1 centime
const DEFAULT_ALERTE_JOURS = 2;
const MAX_CANDIDATS = 8;

// ═══════════════════════════════════════════════════════════════
//  Cloud Function planifiée (toutes les 5 minutes)
// ═══════════════════════════════════════════════════════════════
export const gmailPollAchat = onSchedule(
  {
    schedule: "every 5 minutes",
    region: "europe-west1",
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: ACHAT_SECRETS,
  },
  async () => {
    await runAchatSync("schedule");
    await markMissingAR();
  },
);

// ═══════════════════════════════════════════════════════════════
//  Callable — "Forcer le sync achat@" (Admin + Direction)
// ═══════════════════════════════════════════════════════════════
export const forceSyncAchat = onCall(
  {
    region: "europe-west1",
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: ACHAT_SECRETS,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Vous devez être connecté.");
    }
    const role = request.auth.token?.role;
    if (role !== "Admin" && role !== "Direction") {
      throw new HttpsError("permission-denied", "Réservé à l'administration et à la direction.");
    }
    const res = await runAchatSync("manuel");
    const missing = await markMissingAR();
    return { ok: true, ...res, arMarquesManquants: missing };
  },
);

// ═══════════════════════════════════════════════════════════════
//  Orchestration du cycle via gmailCore
// ═══════════════════════════════════════════════════════════════
async function runAchatSync(trigger) {
  const configRef = db.collection(COL_CONFIG).doc(CONFIG_DOC);

  // Auto-bootstrap : crée la config si absente (1er run → resync complet).
  const snap = await configRef.get();
  if (!snap.exists) {
    await configRef.set({
      actif: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log("[gmailPollAchat] config gmailConfigAchat/main créée (bootstrap)");
  }

  const gmail = buildGmailClient({
    clientId: GMAIL_CLIENT_ID.value(),
    clientSecret: GMAIL_CLIENT_SECRET.value(),
    refreshToken: GMAIL_ACHAT_REFRESH_TOKEN.value(),
  });

  return runGmailSync({
    gmail,
    configRef,
    handler: achatHandler,
    trigger,
    logPrefix: "gmailPollAchat",
    resyncQuery: SCOPE_QUERY,
    inboxQuery: SCOPE_QUERY,
    maxResync: 200,
    extraConfigFields: (counts) => ({
      derniereSyncCounts: counts,
    }),
  });
}

// ═══════════════════════════════════════════════════════════════
//  Handler par mail (séquence anti-coût)
// ═══════════════════════════════════════════════════════════════
async function achatHandler({ gmail, message }) {
  const gmailId = message.id;
  try {
    // 1. Dédup-AVANT-get (aucun I/O coûteux si déjà traité)
    const cacheSnap = await db.collection(COL_CACHE).doc(gmailId).get();
    if (cacheSnap.exists) return "deja_traite";

    // 2. messages.get + parsing
    const full = await gmail.users.messages.get({ userId: "me", id: gmailId, format: "full" });
    const msg = full.data;
    const parsed = parseGmailMessage(msg);
    const fromEmail = (parsed.fromEmail || "").toLowerCase();
    const isEsaboraCopie = fromEmail.endsWith(ESABORA_DOMAIN);

    // GARDE-FOU 235236 : un mail venant d'une adresse EPJ (copie de BC
    // ré-envoyée / atterrie dans achat@) n'est NI un AR fournisseur NI la
    // copie Esabora autoritative. Le traiter comme AR écraserait le vrai AR
    // (arRef) avec le BC. On le neutralise par un cache terminal.
    if (fromEmail.endsWith(EPJ_DOMAIN)) {
      await db.collection(COL_CACHE).doc(gmailId).set({
        gmailId, status: "ignore_self_epj", sujet: parsed.subject,
        fromEmail: parsed.fromEmail || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return "ignore_self_epj";
    }

    // 3. Détection numero GRATUITE : sujet+corps d'abord, puis texte PDF
    let candidats = extractNumeroCandidates(`${parsed.subject} ${parsed.text}`);
    let pdfPart = null;
    let pdfBuffer = null;
    let pdfTexte = null; // null = PDF jamais lu ; "" ou texte = lu
    if (!candidats.length) {
      pdfPart = findFirstPdfPart(msg.payload);
      if (pdfPart) {
        pdfBuffer = await fetchAttachmentBuffer(gmail, gmailId, pdfPart.body.attachmentId);
        pdfTexte = await safePdfText(pdfBuffer);
        candidats = extractNumeroCandidates(pdfTexte);
      }
    }

    // 4a. Aucun numero détecté.
    if (!candidats.length) {
      // Cas AR scanné/image : PDF présent mais texte ~vide. NE PAS poser de
      // cache terminal (sinon l'AR est perdu à jamais) → retry au prochain
      // cycle (le numero pourra venir d'un OCR/texte ultérieur ou du sujet).
      const pdfIllisible = pdfPart && (pdfTexte || "").replace(/\s/g, "").length < 20;
      if (pdfIllisible) {
        console.warn(`[gmailPollAchat] ${gmailId} PDF sans texte exploitable (scanné ?) → retry, pas de cache terminal`);
        return "pending_pdf_scanne";
      }
      // Du texte a bien été lu (sujet/corps et/ou PDF) sans numero → pas notre
      // mail → cache terminal (stoppe le re-scan inutile).
      await db.collection(COL_CACHE).doc(gmailId).set({
        gmailId, status: "no_numero", sujet: parsed.subject,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return "ignore_no_numero";
    }

    // 4b. Gate dur : un candidat correspond-il à un commandesEsabora existant ?
    let numero = null;
    let ceSnap = null;
    for (const c of candidats.slice(0, MAX_CANDIDATS)) {
      const s = await db.collection(COL_COMMANDES_ESABORA).doc(c).get();
      if (s.exists) { numero = c; ceSnap = s; break; }
    }
    // candidat(s) mais aucune commande qui matche encore.
    if (!numero) {
      // Copie Esabora (@esabora.solutions) : peut arriver quasi en même temps
      // que le webhook Zapier → course possible. NE PAS cacher → retry (borné
      // par la fenêtre 30 j). C'est de la donnée qu'on veut.
      if (isEsaboraCopie) return "pending_commande";
      // Tout autre expéditeur : invariant EPJ = la commande est TOUJOURS créée
      // (webhook Zapier) avant l'AR fournisseur. Donc si aucune commande ne
      // matche, ce mail n'a rien à voir → cache terminal, lu une seule fois.
      await db.collection(COL_CACHE).doc(gmailId).set({
        gmailId, status: "no_match", sujet: parsed.subject,
        fromEmail: parsed.fromEmail || null,
        candidats: candidats.slice(0, MAX_CANDIDATS),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return "ignore_no_match";
    }

    // 5. Persistance des PJ (path déterministe, URL 30j)
    const pieces = await downloadAttachments({ gmail, gmailId, payload: msg.payload, prefix: "achat" });

    // Assure le buffer PDF pour l'extraction (réutilise celui de la détection)
    if (!pdfPart) pdfPart = findFirstPdfPart(msg.payload);
    if (pdfPart && !pdfBuffer) {
      pdfBuffer = await fetchAttachmentBuffer(gmail, gmailId, pdfPart.body.attachmentId);
    }

    const apiKey = ANTHROPIC_API_KEY.value();

    // 6. Extraction Sonnet (seulement maintenant : on a payé le gate)
    if (!pdfBuffer) {
      // Mail matché mais sans PDF exploitable : on log et on retentera (transitoire)
      console.warn(`[gmailPollAchat] ${gmailId} matché numero=${numero} mais aucun PDF exploitable`);
      return "erreur";
    }
    const pdfBase64 = pdfBuffer.toString("base64");
    const extraction = isEsaboraCopie
      ? await extraireCopieCommande(apiKey, pdfBase64, numero)
      : await extraireAR(apiKey, pdfBase64, numero);

    if (!extraction) {
      // Échec IA (transitoire) → pas de cache → retente au prochain cycle.
      console.warn(`[gmailPollAchat] extraction Sonnet nulle pour ${gmailId} (numero=${numero})`);
      return "erreur";
    }

    // 7. Écriture merge dans commandesEsabora/{numero}
    const ceRef = db.collection(COL_COMMANDES_ESABORA).doc(numero);
    const piecesPdf = pieces.filter((p) => p.kind === "pdf");
    if (isEsaboraCopie) {
      await ceRef.set({
        lignesCommande: extraction.lignesCommande || [],
        copieRef: {
          gmailId,
          dateCopie: parsed.date,
          pieces: piecesPdf,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    } else {
      await ceRef.set({
        lignesAR: extraction.lignesAR || [],
        totalAR: numOrNull(extraction.totalAR),
        arStatut: "RECU",
        arRef: {
          gmailId,
          fournisseur: extraction.fournisseur || parsed.fromName || parsed.fromEmail || null,
          dateAR: extraction.dateAR || parsed.date,
          pieces: piecesPdf,
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
    }

    // 8. Price-watch ligne à ligne (si les deux côtés sont présents)
    await runPriceWatch(numero);

    // 9. Cache terminal (extraction mémorisée → jamais re-payée)
    await db.collection(COL_CACHE).doc(gmailId).set({
      gmailId,
      numero,
      type: isEsaboraCopie ? "copie" : "ar",
      fromEmail: parsed.fromEmail || null,
      extraction,
      status: "done",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return isEsaboraCopie ? "copie" : "ar";
  } catch (err) {
    console.error(`[gmailPollAchat/handler] gmailId=${gmailId} erreur:`, err);
    return "erreur";
  }
}

// ═══════════════════════════════════════════════════════════════
//  Price-watch : matche lignesCommande ↔ lignesAR par référence
//  (tolérant au préfixe fabricant 3 lettres) et écrit les écarts.
// ═══════════════════════════════════════════════════════════════
async function runPriceWatch(numero) {
  const ceRef = db.collection(COL_COMMANDES_ESABORA).doc(numero);
  const snap = await ceRef.get();
  if (!snap.exists) return;
  const ce = snap.data() || {};

  const lignesCommande = Array.isArray(ce.lignesCommande) ? ce.lignesCommande : [];
  const lignesAR = Array.isArray(ce.lignesAR) ? ce.lignesAR : [];

  // ecartTotal calculable dès qu'on a totalAR (totalHT = entête webhook).
  const totalHT = numOrNull(ce.totalHT);
  const totalAR = numOrNull(ce.totalAR);
  const ecartTotal = (totalHT != null && totalAR != null) ? round2(totalAR - totalHT) : null;

  // Price-watch ligne uniquement si les deux côtés sont présents.
  let nbLignesEnEcart = null;
  if (lignesCommande.length && lignesAR.length) {
    // Deux index commande : match EXACT (réf brute) prioritaire, fallback
    // préfixe-tolérant SEULEMENT si non ambigu (sinon deux fabricants au même
    // numéro nu — SCH 12345 / BLI 12345 → 12345 — produiraient un faux match).
    const exactMap = new Map();
    const normMap = new Map();
    const normAmbigu = new Set();
    for (const l of lignesCommande) {
      const ex = exactRef(l.reference);
      if (ex) exactMap.set(ex, l);
      const nr = normRef(l.reference);
      if (nr) {
        if (normMap.has(nr)) normAmbigu.add(nr);
        else normMap.set(nr, l);
      }
    }
    nbLignesEnEcart = 0;
    const idsVus = new Set();
    for (let i = 0; i < lignesAR.length; i++) {
      const la = lignesAR[i];
      // 1) réf exacte ; 2) sinon fallback tolérant uniquement si non ambigu
      let lc = exactMap.get(exactRef(la.reference));
      if (!lc) {
        const nr = normRef(la.reference);
        if (nr && !normAmbigu.has(nr)) lc = normMap.get(nr);
      }
      if (!lc) continue;
      const puCmd = numOrNull(lc.prixUnitaireCommande);
      const puAr = numOrNull(la.prixUnitaireAR);
      if (puCmd == null || puAr == null) continue;
      const ecart = round2(puAr - puCmd);
      // id basé sur la réf RÉELLE de la ligne AR (jamais la forme normalisée
      // partagée) → deux réf distinctes ne fusionnent jamais. Anti-collision
      // résiduelle (même réf 2× dans un AR) via suffixe d'index.
      const refForId = sanitizeId(exactRef(la.reference) || normRef(la.reference) || `idx${i}`);
      let ecartId = `${numero}__${refForId}`;
      if (idsVus.has(ecartId)) ecartId = `${ecartId}__${i}`;
      idsVus.add(ecartId);
      ecartId = ecartId.slice(0, 1400);
      if (Math.abs(ecart) > PRIX_EPSILON) {
        nbLignesEnEcart++;
        await db.collection(COL_ECARTS).doc(ecartId).set({
          numero,
          fournisseur: ce.arRef?.fournisseur || ce.codeFournisseur || null,
          chantierNum: ce.chantierNum || null,
          reference: la.reference || lc.reference || null,
          designation: la.designation || lc.designation || null,
          quantite: numOrNull(la.quantite),
          prixUnitaireCommande: puCmd,
          prixUnitaireAR: puAr,
          ecart,
          ecartPct: puCmd ? round2((ecart / puCmd) * 100) : null,
          source: "PRICE_WATCH",
          dateConstat: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      } else {
        // Ligne revenue dans la tolérance : nettoie un écart éventuel précédent.
        await db.collection(COL_ECARTS).doc(ecartId).delete().catch(() => {});
      }
    }
  }

  await ceRef.set({
    ecartTotal,
    nbLignesEnEcart,
    priceWatchAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
}

// ═══════════════════════════════════════════════════════════════
//  AR manquant : EN_ATTENTE depuis > arAlerteDelaiJours et non acquitté
//  → MANQUANT.
// ═══════════════════════════════════════════════════════════════
async function markMissingAR() {
  let jours = DEFAULT_ALERTE_JOURS;
  try {
    const cfg = await db.collection("config").doc("settings").get();
    const v = cfg.exists ? cfg.data()?.arAlerteDelaiJours : null;
    if (typeof v === "number" && v >= 0) jours = v;
  } catch { /* défaut */ }

  const cutoff = new Date(Date.now() - jours * 24 * 60 * 60 * 1000);
  const snap = await db.collection(COL_COMMANDES_ESABORA)
    .where("arStatut", "==", "EN_ATTENTE")
    .limit(500)
    .get();
  if (snap.empty) return 0;

  let n = 0;
  for (const d of snap.docs) {
    const data = d.data() || {};
    if (data.arAcquitte === true) continue;
    const created = tsToDate(data.createdAt);
    if (created && created < cutoff) {
      await d.ref.set({
        arStatut: "MANQUANT",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      n++;
    }
  }
  if (n) console.log(`[gmailPollAchat] ${n} commande(s) passée(s) AR MANQUANT (> ${jours} j)`);
  return n;
}

// ═══════════════════════════════════════════════════════════════
//  Extraction Sonnet — copie de commande (@esabora.solutions)
// ═══════════════════════════════════════════════════════════════
async function extraireCopieCommande(apiKey, pdfBase64, numero) {
  const system = "Tu es un assistant d'extraction de données pour EPJ Électricité. Tu réponds UNIQUEMENT en JSON valide, sans texte avant/après.";
  const prompt = `Ce PDF est une COPIE DE COMMANDE Esabora (n° ${numero}) émise par EPJ vers un fournisseur. Extrais les lignes d'articles commandés.

Règles :
- Le numéro de commande Esabora est ${numero} (6 chiffres, type 235xxx). NE le confonds PAS avec un éventuel n° interne fournisseur (autre format).
- Prix : décimales en virgule OU point. Si un prix est exprimé "au /100" ou "/C" (par cent), ramène-le au prix unitaire réel (prixUnitaire = total ligne / quantité).
- Les références peuvent comporter un préfixe fabricant 3 lettres (ex. "SCH S520059") ou non ("S520059") — garde la référence telle qu'imprimée.
- Ignore les pages de CGV / conditions générales.

Réponds STRICTEMENT :
{ "lignesCommande": [ { "reference": "...", "designation": "...", "quantite": 0, "unite": "...", "prixUnitaireCommande": 0.0, "totalLigneCommande": 0.0 } ] }`;

  return callClaudeJson({
    apiKey,
    model: CLAUDE_MODEL_AR,
    system,
    maxTokens: 4000,
    content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
      { type: "text", text: prompt },
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
//  Extraction Sonnet — AR fournisseur
// ═══════════════════════════════════════════════════════════════
async function extraireAR(apiKey, pdfBase64, numero) {
  const system = "Tu es un assistant d'extraction de données pour EPJ Électricité. Tu réponds UNIQUEMENT en JSON valide, sans texte avant/après.";
  const prompt = `Ce PDF est un ACCUSÉ DE RÉCEPTION (AR) de commande envoyé par un FOURNISSEUR à EPJ, en réponse à la commande Esabora n° ${numero}. Extrais l'entête et les lignes.

Règles :
- Le n° de commande EPJ/Esabora est ${numero} (6 chiffres, type 235xxx). Le fournisseur peut aussi afficher SON propre n° interne (autre format, ex. 477212) : NE le confonds PAS.
- Prix : décimales virgule OU point. Si un prix est "au /100" ou "/C" (par cent), ramène au prix unitaire réel (= total ligne / quantité).
- Références : préfixe fabricant 3 lettres parfois présent ("SCH S520059"), parfois absent ("S520059") — garde la référence telle qu'imprimée.
- Date de livraison prévue par ligne : libellée diversement ("Date Prévisionnelle", "A expédier le", "Date estimée", "Livraison prévue"…). Renvoie-la au format ISO AAAA-MM-JJ si possible, sinon la chaîne brute.
- dateAR = date de l'accusé. totalAR = total HT de l'AR.
- Ignore les pages de CGV / conditions générales.

Réponds STRICTEMENT :
{ "fournisseur": "...", "dateAR": "AAAA-MM-JJ", "totalAR": 0.0,
  "lignesAR": [ { "reference": "...", "designation": "...", "quantite": 0, "unite": "...", "prixUnitaireAR": 0.0, "totalLigneAR": 0.0, "dateLivraisonPrevue": "AAAA-MM-JJ" } ] }`;

  return callClaudeJson({
    apiKey,
    model: CLAUDE_MODEL_AR,
    system,
    maxTokens: 4000,
    content: [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
      { type: "text", text: prompt },
    ],
  });
}

// ═══════════════════════════════════════════════════════════════
//  Helpers
// ═══════════════════════════════════════════════════════════════

// Candidats numero : 235xxx prioritaires, puis 6-chiffres génériques.
function extractNumeroCandidates(text) {
  const out = new Set();
  const s = String(text || "");
  for (const m of s.matchAll(/\b(2\d{5})\b/g)) out.add(m[1]);
  for (const m of s.matchAll(/\b(\d{6})\b/g)) out.add(m[1]);
  return [...out];
}

function findFirstPdfPart(payload) {
  let found = null;
  const walk = (part) => {
    if (!part || found) return;
    const isPdf = part.mimeType === "application/pdf" || /\.pdf$/i.test(part.filename || "");
    if (isPdf && part.body?.attachmentId) { found = part; return; }
    (part.parts || []).forEach(walk);
  };
  walk(payload);
  return found;
}

async function fetchAttachmentBuffer(gmail, gmailId, attachmentId) {
  const att = await gmail.users.messages.attachments.get({
    userId: "me", messageId: gmailId, id: attachmentId,
  });
  return Buffer.from(att.data.data, "base64");
}

async function safePdfText(buffer) {
  try {
    const data = await pdfParse(buffer);
    return data?.text || "";
  } catch (e) {
    console.warn("[gmailPollAchat] pdf-parse échec (détection numero):", e.message);
    return "";
  }
}

// Réf EXACTE : MAJ + espaces internes normalisés, SANS retirer le préfixe
// fabricant → clé de match prioritaire (ne fusionne jamais deux fabricants).
function exactRef(ref) {
  if (ref == null) return "";
  return String(ref).trim().toUpperCase().replace(/\s+/g, " ");
}

// Réf TOLÉRANTE : strip préfixe fabricant 3 lettres + tous espaces, MAJ →
// fallback quand l'AR omet le préfixe (SCH S520059 ↔ S520059).
function normRef(ref) {
  if (ref == null) return "";
  return String(ref).trim().toUpperCase()
    .replace(/^[A-Z]{3}\s+/, "")
    .replace(/\s+/g, "");
}

// Rend une chaîne sûre comme suffixe d'id Firestore.
function sanitizeId(s) {
  return String(s).replace(/[^A-Za-z0-9._-]/g, "_");
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

function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function tsToDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === "function") return ts.toDate();
  if (ts instanceof Date) return ts;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

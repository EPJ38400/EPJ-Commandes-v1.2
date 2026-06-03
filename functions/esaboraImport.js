// ═══════════════════════════════════════════════════════════════
//  functions/esaboraImport.js — Module Commande, étape 1 (Pull Esabora)
//
//  Chaîne d'entrée :   Esabora → Zapier → ce webhook HTTP (onRequest).
//  PAS de Drive, PAS de fichier : tout est dans l'entête JSON Zapier.
//
//  Rôle :
//    1. esaboraWebhook (onRequest) — reçoit l'entête d'une commande Esabora,
//       vérifie un token secret en header, écrit le payload BRUT dans
//       esabora_import/{numero} (idempotent par numero), répond 200, puis
//       déclenche le tri. numero manquant/malformé → dead-letter.
//    2. esaboraSweep (onSchedule, 10 min) — reprend les esabora_import
//       restés "pending" (filet de sécurité si le tri inline a échoué).
//
//  Tri / jointure (exact, sans fenêtre de date, sans fallback ambigu) :
//    • parse CMD-\d{4}-\d{4} dans `titre` :
//        - trouvé  → origine "APP",     lien commandes.num == CMD → appCommandeId
//        - absent  → origine "ESABORA"  (saisie directe dans Esabora)
//    • chantier via affaireNumero → chantiers/{affaireNumero},
//      chantierActif = exists && statut === "Actif"  (⚠ majuscule)
//    • écrit commandesEsabora/{numero} en merge → préserve les champs AR
//      (lignesAR, totalAR, arStatut…) posés plus tard par gmailPollAchat.
//    • scission : 1 commande app = plusieurs numero Esabora (un par
//      fournisseur), tous le même CMD dans `titre`. Chaque numero = son
//      propre doc commandesEsabora, tous liés au même appCommandeId ;
//      codeFournisseur identifie la tranche.
//
//  Cohérent avec le patron functions/index.js + gmailPoll.js :
//    - Firebase Functions v2 (ES modules), région europe-west1
//    - defineSecret (Google Secret Manager)
//
//  Secret à provisionner côté serveur :
//    firebase functions:secrets:set ESABORA_WEBHOOK_TOKEN
// ═══════════════════════════════════════════════════════════════

import { onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";

// Firebase Admin déjà initialisé dans index.js ; ici on sécurise le cas
// d'un chargement isolé (tests).
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

// ─── Secret ─────────────────────────────────────────────────
// Token partagé Zapier ↔ webhook. Toute requête sans ce token est rejetée.
const ESABORA_WEBHOOK_TOKEN = defineSecret("ESABORA_WEBHOOK_TOKEN");

// ─── Constantes ─────────────────────────────────────────────
const COL_IMPORT = "esabora_import";
const COL_COMMANDES_ESABORA = "commandesEsabora";
const COL_DEADLETTER = "esabora_deadletter";
const COL_CHANTIERS = "chantiers";
const COL_COMMANDES = "commandes";

const REGION = "europe-west1";

// ═══════════════════════════════════════════════════════════════
//  Webhook HTTP — point d'entrée Zapier
// ═══════════════════════════════════════════════════════════════
export const esaboraWebhook = onRequest(
  {
    region: REGION,
    timeoutSeconds: 60,
    memory: "256MiB",
    secrets: [ESABORA_WEBHOOK_TOKEN],
    cors: false,
  },
  async (req, res) => {
    // ─── Méthode ───
    if (req.method !== "POST") {
      res.status(405).json({ ok: false, error: "method_not_allowed" });
      return;
    }

    // ─── Token secret (header) ───
    // Accepte x-epj-token: <token> OU Authorization: Bearer <token>.
    const headerToken = req.get("x-epj-token");
    const auth = req.get("authorization") || "";
    const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
    const provided = headerToken || bearer;
    const expected = ESABORA_WEBHOOK_TOKEN.value();
    if (!expected || provided !== expected) {
      console.warn("[esaboraWebhook] token invalide ou absent → 401");
      res.status(401).json({ ok: false, error: "unauthorized" });
      return;
    }

    // ─── Payload ───
    // Zapier poste du JSON ; req.body est déjà parsé par le runtime v2.
    const payload = (req.body && typeof req.body === "object") ? req.body : {};
    const numero = normNumero(payload.numero);

    // ─── numero manquant/malformé → dead-letter (pas de commandesEsabora) ───
    if (!numero) {
      console.warn("[esaboraWebhook] numero manquant/malformé → dead-letter");
      await db.collection(COL_DEADLETTER).add({
        raw: payload,
        reason: "numero manquant ou malformé",
        receivedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      // 200 : Zapier ne doit pas retenter (rien à corriger côté Zap).
      res.status(200).json({ ok: false, deadLetter: true });
      return;
    }

    // ─── Écriture DURABLE du brut (idempotent par numero) ───
    try {
      await db.collection(COL_IMPORT).doc(numero).set(
        {
          raw: payload,
          numero,
          affaireNumero: strOrNull(payload.affaireNumero),
          affaireTitre: strOrNull(payload.affaireTitre),
          titre: strOrNull(payload.titre),
          categorie: strOrNull(payload.categorie),
          codeFournisseur: strOrNull(payload.codeFournisseur),
          etat: strOrNull(payload.etat),
          dateCreation: strOrNull(payload.dateCreation),
          totalHT: strOrNull(payload.totalHT),
          importStatus: "pending",
          importedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (e) {
      // Si même l'écriture durable échoue, on demande à Zapier de retenter.
      console.error(`[esaboraWebhook] échec écriture esabora_import/${numero}:`, e);
      res.status(500).json({ ok: false, error: "store_failed" });
      return;
    }

    // ─── Réponse 200 immédiate (le brut est persisté, le sweep est le filet) ───
    res.status(200).json({ ok: true, numero });

    // ─── Tri inline best-effort ; en cas d'échec, esaboraSweep reprendra ───
    try {
      await processImport(numero);
    } catch (e) {
      console.error(`[esaboraWebhook] tri inline échoué pour ${numero} (repris par le sweep):`, e);
    }
  },
);

// ═══════════════════════════════════════════════════════════════
//  Sweep planifié — reprend les pending oubliés
// ═══════════════════════════════════════════════════════════════
export const esaboraSweep = onSchedule(
  {
    schedule: "every 10 minutes",
    region: REGION,
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    const snap = await db
      .collection(COL_IMPORT)
      .where("importStatus", "==", "pending")
      .limit(200)
      .get();
    if (snap.empty) {
      console.log("[esaboraSweep] aucun import pending");
      return;
    }
    let ok = 0;
    let ko = 0;
    for (const d of snap.docs) {
      try {
        await processImport(d.id);
        ok++;
      } catch (e) {
        console.error(`[esaboraSweep] échec sur ${d.id}:`, e);
        ko++;
      }
    }
    console.log(`[esaboraSweep] terminé : ${ok} traités, ${ko} en échec`);
  },
);

// ═══════════════════════════════════════════════════════════════
//  Cœur : tri d'un import → commandesEsabora/{numero}
//  Idempotent : skip si déjà processed ; merge qui préserve les champs AR.
// ═══════════════════════════════════════════════════════════════
async function processImport(numero) {
  const impRef = db.collection(COL_IMPORT).doc(numero);
  const impSnap = await impRef.get();
  if (!impSnap.exists) {
    console.warn(`[processImport] esabora_import/${numero} absent, skip`);
    return;
  }
  const imp = impSnap.data() || {};
  if (imp.importStatus === "processed") return; // idempotent

  const raw = imp.raw || {};

  // ─── Normalisation ───
  const affaireNumero = strOrNull(raw.affaireNumero ?? imp.affaireNumero);
  const affaireTitre = strOrNull(raw.affaireTitre ?? imp.affaireTitre);
  const titre = strOrNull(raw.titre ?? imp.titre) || "";
  const categorie = strOrNull(raw.categorie ?? imp.categorie);
  const codeFournisseur = strOrNull(raw.codeFournisseur ?? imp.codeFournisseur);
  const etat = strOrNull(raw.etat ?? imp.etat);
  const dateCommande = parseEsaboraDate(raw.dateCreation ?? imp.dateCreation);
  const totalHT = parseEsaboraNumber(raw.totalHT ?? imp.totalHT);

  // ─── Origine via CMD-\d{4}-\d{4} dans titre ───
  let origine = "ESABORA";
  let appCommandeNum = null;
  let appCommandeId = null;
  const cmdMatch = /CMD-\d{4}-\d{4}/.exec(titre);
  if (cmdMatch) {
    origine = "APP";
    appCommandeNum = cmdMatch[0];
    const q = await db
      .collection(COL_COMMANDES)
      .where("num", "==", appCommandeNum)
      .limit(1)
      .get();
    if (!q.empty) appCommandeId = q.docs[0].id;
  }

  // ─── Chantier via affaireNumero ───
  let chantierActif = false;
  if (affaireNumero) {
    const chSnap = await db.collection(COL_CHANTIERS).doc(affaireNumero).get();
    chantierActif = chSnap.exists && chSnap.data()?.statut === "Actif";
  }

  // ─── Écriture commandesEsabora/{numero} (merge, préserve AR) ───
  const ceRef = db.collection(COL_COMMANDES_ESABORA).doc(numero);
  const ceSnap = await ceRef.get();

  const doc = {
    numero,
    affaireNumero,
    affaireTitre,
    titre,
    categorie,
    chantierNum: affaireNumero, // = affaireNumero (alias lisible côté front)
    chantierActif,
    codeFournisseur,
    etat,
    dateCommande, // ISO ou null
    totalHT, // number ou null
    origine, // "APP" | "ESABORA"
    appCommandeId, // commandes/{id} ou null
    appCommandeNum, // "CMD-YYYY-NNNN" ou null
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Champs AR initialisés UNIQUEMENT à la création (jamais écrasés ensuite).
  if (!ceSnap.exists) {
    Object.assign(doc, {
      arStatut: "EN_ATTENTE",
      lignesAR: [],
      totalAR: null,
      ecartTotal: null,
      arRef: null,
      arAcquitte: false,
      arAcquitPar: null,
      arAcquitLe: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }

  await ceRef.set(doc, { merge: true });

  // ─── Marque l'import traité ───
  await impRef.update({
    importStatus: "processed",
    processedAt: admin.firestore.FieldValue.serverTimestamp(),
    // miroir normalisé pour debug/inspection rapide
    affaireNumero,
    codeFournisseur,
    etat,
    dateCommandeIso: dateCommande,
    totalHTNum: totalHT,
    origine,
    appCommandeId,
  });

  console.log(
    `[processImport] ${numero} → commandesEsabora (origine=${origine}, chantier=${affaireNumero || "?"}, actif=${chantierActif}, fournisseur=${codeFournisseur || "?"}, appCmd=${appCommandeNum || "—"})`,
  );
}

// ═══════════════════════════════════════════════════════════════
//  Helpers de normalisation
// ═══════════════════════════════════════════════════════════════

// numero : clé du doc + de l'AR. Rejette vide ou contenant '/' (interdit
// dans un doc id Firestore) → traité comme "malformé" en amont.
function normNumero(v) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.includes("/")) return null;
  return s;
}

function strOrNull(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

// dateCreation Esabora : "JJ/MM/AAAA" OU "JJ/MM/AAAA HH:MM" → ISO 8601 (UTC).
function parseEsaboraDate(v) {
  if (v == null) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(String(v).trim());
  if (!m) return null;
  const [, dd, mm, yyyy, hh = "0", mi = "0"] = m;
  const d = new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi));
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// totalHT Esabora : string virgule ("1359,62", "1 091,70") → number.
function parseEsaboraNumber(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[\s  ]/g, ""); // espaces, nbsp, narrow nbsp
  if (s.includes(",") && s.includes(".")) {
    // format FR avec séparateur de milliers '.' et décimale ',' → "1.359,62"
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// ═══════════════════════════════════════════════════════════════
//  esaboraUtils.js — v10.L
//
//  Pont EPJ App → Zapier Catch Hook → Esabora "Create Order"
//
//  PAS de Make (l'app fait tout) :
//    1. groupBy par codeEsabora (lu depuis le catalogue)
//    2. génération d'un fichier Excel par groupe (format Esabora :
//       2 feuilles "INFORMATIONS GÉNÉRALES" + "CONTENU DU DOCUMENT")
//    3. POST multipart/form-data direct vers le Catch Hook Zapier
//    4. update Firestore (esaboraStatus, esaboraResults, …)
//
//  Articles sans codeEsabora :
//    → IGNORÉS (Q2=3 décidée par PJY). Restent dans la commande EPJ
//    et l'email PDF, mais ne partent pas dans Esabora.
//
//  Plusieurs fournisseurs sur une commande :
//    → N appels Zapier indépendants (1 par groupe). Si certains OK et
//    d'autres KO → esaboraStatus = "partial".
// ═══════════════════════════════════════════════════════════════

import * as XLSX from "xlsx";
import { db } from "../../firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";

// ─── Configuration ─────────────────────────────────────────────

export async function getEsaboraConfig() {
  try {
    const snap = await getDoc(doc(db, "config", "settings"));
    if (!snap.exists()) return { esaboraEnabled: false, esaboraWebhookUrl: "" };
    const d = snap.data() || {};
    return {
      esaboraEnabled: d.esaboraEnabled === true,
      esaboraWebhookUrl: d.esaboraWebhookUrl || "",
    };
  } catch (e) {
    console.error("[esabora] getEsaboraConfig:", e);
    return { esaboraEnabled: false, esaboraWebhookUrl: "" };
  }
}

// ─── GROUP BY par codeEsabora ──────────────────────────────────

/**
 * Retourne le codeEsabora d'un article à partir du catalogue.
 * @param {object} item - article de la commande (ex: { r:"SCH S520059", n:"...", qty:5 })
 * @param {Array}  catalog - le catalogue complet (chaque entrée doit avoir { r, codeEsabora })
 * @returns {string} - codeEsabora ou "" si non trouvé
 */
export function getCodeEsabora(item, catalog) {
  if (!item || !Array.isArray(catalog)) return "";
  // Match exact sur la référence
  const ref = (item.r || item.ref || "").trim();
  if (!ref) return "";
  const cat = catalog.find(c => (c.r || "").trim() === ref);
  return cat?.codeEsabora || "";
}

/**
 * Groupe les items d'une commande par codeEsabora.
 * Les items sans codeEsabora (ou avec codeEsabora vide) sont IGNORÉS (Q2=3).
 *
 * @returns {{ groups: Array<{codeEsabora, items}>, ignored: Array<item> }}
 */
export function groupItemsByEsaboraCode(items, catalog) {
  const out = {};
  const ignored = [];
  if (!Array.isArray(items)) return { groups: [], ignored };
  for (const it of items) {
    const code = getCodeEsabora(it, catalog);
    if (!code) {
      ignored.push(it);
      continue;
    }
    if (!out[code]) out[code] = [];
    out[code].push(it);
  }
  const groups = Object.keys(out).sort().map(code => ({
    codeEsabora: code,
    items: out[code],
  }));
  return { groups, ignored };
}

// ─── GÉNÉRATION FICHIER EXCEL ESABORA ──────────────────────────

/**
 * Construit le fichier Excel au format Esabora "ImportCommandes" pour UN groupe.
 * Format validé en conv N2 :
 *  - Feuille "INFORMATIONS GÉNÉRALES" : 36 colonnes, 1 ligne de données
 *  - Feuille "CONTENU DU DOCUMENT" : 9 colonnes, N lignes (1 par article)
 *
 * @param {object} group - { codeEsabora, items }
 * @param {object} order - la commande EPJ (avec num, chantier, dateReception, etc.)
 * @param {object} chantier - le chantier (avec numAffaire, adresse, etc.) ou null
 * @param {object} opts - { tvaDefault } : taux TVA par défaut (v10.L.1)
 * @returns {Blob} - le fichier .xlsx prêt à envoyer
 */
export function buildEsaboraExcel(group, order, chantier, opts) {
  // v10.L.1 — TVA par défaut sur l'entête (Esabora a besoin de cette info
  // pour calculer les montants). Les colonnes TVA des lignes d'articles
  // restent vides : Esabora applique automatiquement la TVA d'entête.
  const tvaDefault = (opts && opts.tvaDefault != null) ? opts.tvaDefault : 20;
  // ── Feuille 1 : INFORMATIONS GÉNÉRALES ──
  const headerGen = [
    "Titre",                     // A
    "Numéro",                    // B (vide, généré par Esabora)
    "Code fournisseur",          // C ← codeEsabora
    "Nom interlocuteur",         // D
    "Prénom interlocuteur",      // E
    "Date création",             // F
    "TVA 1", "TVA 2", "TVA 3", "TVA 4",  // G-J
    "Adresse commande - titre",  // K
    "Adresse 1", "Adresse 2", "Adresse 3",  // L-N
    "Code postal",               // O
    "Ville",                     // P
    "Pays",                      // Q
    "Adresse livraison - titre", // R
    "Adresse liv 1", "Adresse liv 2", "Adresse liv 3", // S-U
    "CP livraison",              // V
    "Ville livraison",           // W
    "Pays livraison",            // X
    "Numéro affaire",            // Y ← order.numAffaire
    "Trigramme",                 // Z
    "Date livraison prévue",     // AA
    "Commentaire",               // AB ← order.num (clé de jointure EPJ)
    "Répartition 1", "Répartition 2", "Répartition 3", // AC-AE
    "Tri 1", "Tri 2", "Tri 3",   // AF-AH
    "Ventilation 1", "Ventilation 2", // AI-AJ
  ];

  // Adresse livraison = chantier si renseigné, sinon vide
  const livAdr1 = chantier?.adresse || "";
  const livCP = chantier?.codePostal || "";
  const livVille = chantier?.ville || "";

  const rowGen = [
    `Commande EPJ ${order.num || ""}`,           // A Titre
    "",                                          // B Numéro (Esabora rempli)
    group.codeEsabora,                           // C Code fournisseur
    "", "",                                      // D-E interlocuteur
    todayFR(),                                   // F Date création
    tvaDefault, "", "", "",                      // G-J TVA (v10.L.1 : TVA 1 = défaut)
    "EPJ — Électricité Générale",                // K Adresse cmd titre
    "3 rue Georges Pérec", "", "",               // L-N
    "38400",                                     // O
    "Saint-Martin-d'Hères",                      // P
    "FR",                                        // Q
    chantier?.nom || "Chantier",                 // R Titre liv
    livAdr1, "", "",                             // S-U
    livCP,                                       // V
    livVille,                                    // W
    "FR",                                        // X
    order.numAffaire || order.chantierNum || "", // Y Numéro affaire
    "",                                          // Z trigramme
    order.dateReception || "",                   // AA date livraison
    order.num || "",                             // AB Commentaire = clé EPJ
    "", "", "",                                  // AC-AE répartition
    "", "", "",                                  // AF-AH tri
    "", "",                                      // AI-AJ ventilation
  ];

  const ws1 = XLSX.utils.aoa_to_sheet([headerGen, rowGen]);

  // ── Feuille 2 : CONTENU DU DOCUMENT ──
  const headerArt = [
    "Référence",                 // A
    "Désignation",               // B
    "Quantité",                  // C
    "Prix unitaire",             // D (vide à l'import)
    "Date livraison prévue",     // E
    "TVA",                       // F
    "Ventilation 1",             // G
    "Ventilation 2",             // H
    "Unité",                     // I
  ];

  const rowsArt = (group.items || []).map(it => [
    it.r || it.ref || "",
    it.n || it.designation || "",
    Number(it.qty || it.qte || 0),
    "",                          // Prix unitaire (vide à l'import)
    order.dateReception || "",
    "",                          // TVA
    "", "",                      // Ventilations
    it.u || it.unite || "Pièce",
  ]);

  const ws2 = XLSX.utils.aoa_to_sheet([headerArt, ...rowsArt]);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws1, "INFORMATIONS GÉNÉRALES");
  XLSX.utils.book_append_sheet(wb, ws2, "CONTENU DU DOCUMENT");

  // Écrit en ArrayBuffer puis en Blob
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ─── ENVOI ZAPIER ──────────────────────────────────────────────

/**
 * POST le fichier xlsx vers le Catch Hook Zapier en multipart/form-data.
 * @returns {Promise<{ok: bool, status: number, body?: any, error?: string}>}
 */
export async function sendFileToZapier(webhookUrl, fileBlob, filename, meta) {
  if (!webhookUrl) {
    return { ok: false, error: "URL Zapier non configurée" };
  }
  try {
    const fd = new FormData();
    fd.append("file", fileBlob, filename);
    // Métadonnées utiles côté Zapier
    if (meta) {
      Object.entries(meta).forEach(([k, v]) => {
        fd.append(k, String(v ?? ""));
      });
    }
    const res = await fetch(webhookUrl, { method: "POST", body: fd });
    let body = null;
    try { body = await res.json(); } catch { body = await res.text(); }
    if (!res.ok) {
      return { ok: false, status: res.status, body, error: `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, body };
  } catch (e) {
    return { ok: false, error: e.message || String(e) };
  }
}

// ─── ORCHESTRATION : sendOrderToEsabora ────────────────────────

/**
 * Envoie une commande entière vers Esabora via Zapier.
 *   - Groupe les items par codeEsabora (ignore les sans-code)
 *   - Génère 1 fichier Excel par groupe
 *   - POST chaque fichier au webhook Zapier
 *   - Met à jour la commande dans Firestore avec le résultat agrégé
 *
 * @returns {Promise<{ok: bool, results: Array, ignored: Array, error?: string}>}
 */
export async function sendOrderToEsabora({ order, catalog, chantier, user, webhookUrl, tvaDefault }) {
  if (!order || !order._id) {
    return { ok: false, error: "Commande invalide", results: [], ignored: [] };
  }
  if (!webhookUrl) {
    return { ok: false, error: "URL Zapier non configurée dans Admin", results: [], ignored: [] };
  }

  const { groups, ignored } = groupItemsByEsaboraCode(order.items || [], catalog || []);
  if (groups.length === 0) {
    return {
      ok: false,
      error: "Aucun article avec codeEsabora — rien à envoyer dans Esabora",
      results: [],
      ignored,
    };
  }

  // Marque pending au tout début
  try {
    await updateDoc(doc(db, "commandes", order._id), {
      esaboraStatus: "pending",
      esaboraStartedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[esabora] markPending:", e.message);
  }

  // Envoi 1 fichier par groupe
  const results = [];
  for (const group of groups) {
    const blob = buildEsaboraExcel(group, order, chantier, { tvaDefault });
    const filename = `EPJ_${order.num || "CMD"}_${group.codeEsabora}.xlsx`;
    const res = await sendFileToZapier(webhookUrl, blob, filename, {
      orderNum: order.num || "",
      codeEsabora: group.codeEsabora,
      nbArticles: group.items.length,
    });
    results.push({
      codeEsabora: group.codeEsabora,
      nbArticles: group.items.length,
      ok: res.ok,
      status: res.status || 0,
      error: res.error || "",
    });
  }

  // Agrégation du statut
  const okCount = results.filter(r => r.ok).length;
  let aggStatus = "error";
  if (okCount === results.length) aggStatus = "synced";
  else if (okCount > 0) aggStatus = "partial";

  // Update Firestore avec le résultat final
  try {
    await updateDoc(doc(db, "commandes", order._id), {
      esaboraStatus: aggStatus,
      esaboraSyncedAt: new Date().toISOString(),
      esaboraSyncedBy: user ? `${user.prenom||""} ${user.nom||""}`.trim() : "",
      esaboraSyncedById: user?._id || user?.id || "",
      esaboraResults: results,
      esaboraIgnoredCount: ignored.length,
    });
  } catch (e) {
    console.warn("[esabora] update Firestore final:", e.message);
  }

  return { ok: aggStatus !== "error", results, ignored, status: aggStatus };
}

// ─── Helper date FR ────────────────────────────────────────────

function todayFR() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

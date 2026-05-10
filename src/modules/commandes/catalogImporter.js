// ═══════════════════════════════════════════════════════════════
//  catalogImporter.js — v10.G
//
//  Fonctions pures pour parser et exporter un fichier Excel de catalogue.
//  Format attendu : 9 colonnes (A-I) — voir catalogSeed.js pour le détail.
//
//  Toutes les fonctions sont DESIGN-PURE (pas d'effets de bord Firestore,
//  pas d'effets sur le DOM) pour faciliter les tests unitaires.
// ═══════════════════════════════════════════════════════════════

// ─── Constantes ───────────────────────────────────────────────
export const EXPECTED_HEADERS = [
  "Catégorie", "Sous-catégorie", "Référence", "Désignation",
  "Unité", "Stock", "Fournisseur principal", "Code Esabora", "Photo URL",
];

const FIELD_MAPPING = {
  "Catégorie":             "c",
  "Sous-catégorie":        "s",
  "Référence":             "r",
  "Désignation":           "n",
  "Unité":                 "u",
  "Stock":                 "stock",
  "Fournisseur principal": "fournisseur",
  "Code Esabora":          "codeEsabora",
  "Photo URL":             "img",
};

// ─── Parser ───────────────────────────────────────────────────
/**
 * Parse une AOA (Array of Arrays) issue d'un fichier Excel en tableau d'articles.
 * @param {Array<Array>} aoa - Données brutes (la première ligne = en-têtes)
 * @returns {{ articles: Array, errors: Array<string>, warnings: Array<string> }}
 */
export function parseCatalogAoa(aoa) {
  const errors = [];
  const warnings = [];
  const articles = [];

  if (!Array.isArray(aoa) || aoa.length < 1) {
    errors.push("Le fichier est vide.");
    return { articles, errors, warnings };
  }

  const headers = (aoa[0] || []).map(h => (h ?? "").toString().trim());
  // Vérifier les colonnes obligatoires (Catégorie, Sous-catégorie, Référence, Désignation)
  const missing = [];
  for (const required of ["Catégorie", "Sous-catégorie", "Référence", "Désignation"]) {
    if (!headers.includes(required)) missing.push(required);
  }
  if (missing.length > 0) {
    errors.push(`Colonnes obligatoires manquantes : ${missing.join(", ")}`);
    return { articles, errors, warnings };
  }

  // Mapping colonne → index
  const colIdx = {};
  for (const h of EXPECTED_HEADERS) {
    colIdx[h] = headers.indexOf(h);
  }

  // Parser les lignes
  for (let i = 1; i < aoa.length; i++) {
    const row = aoa[i] || [];
    const get = (h) => {
      const idx = colIdx[h];
      if (idx < 0) return "";
      const v = row[idx];
      if (v === null || v === undefined) return "";
      return v.toString().trim();
    };

    const ref = get("Référence");
    if (!ref) {
      // Ligne vide ou sans référence — on saute silencieusement
      const hasContent = row.some(c => c !== null && c !== undefined && String(c).trim() !== "");
      if (hasContent) {
        warnings.push(`Ligne ${i + 1} ignorée (référence manquante).`);
      }
      continue;
    }

    // Conversion Stock "Oui"/"Non" → boolean
    const stockStr = get("Stock").toLowerCase();
    const stock = stockStr === "oui" || stockStr === "yes" || stockStr === "true";

    const article = {
      c: get("Catégorie"),
      s: get("Sous-catégorie") || "Général",
      r: ref,
      n: get("Désignation"),
      u: get("Unité") || "Pièce",
      stock,
      fournisseur: get("Fournisseur principal"),
      codeEsabora: get("Code Esabora"),
      img: get("Photo URL"),
    };

    // Validation minimale
    if (!article.c) {
      warnings.push(`Ligne ${i + 1} : catégorie vide pour ${ref}.`);
    }
    if (!article.n) {
      warnings.push(`Ligne ${i + 1} : désignation vide pour ${ref}.`);
    }

    articles.push(article);
  }

  return { articles, errors, warnings };
}

// ─── Détection de doublons ────────────────────────────────────
/**
 * Détecte les références en doublon dans une liste d'articles.
 * @param {Array} articles
 * @returns {Array<{ref: string, count: number}>}
 */
export function findDuplicateRefs(articles) {
  const counts = {};
  for (const a of articles) {
    const r = (a.r || "").trim();
    if (!r) continue;
    counts[r] = (counts[r] || 0) + 1;
  }
  return Object.entries(counts)
    .filter(([, c]) => c > 1)
    .map(([ref, count]) => ({ ref, count }));
}

// ─── Comparaison avant/après pour rapport de pré-import ──────
/**
 * Compare le catalogue actuel (Firestore) au catalogue à importer.
 * Sert au rapport de pré-import affiché à l'utilisateur.
 * @param {Array} current - articles actuellement dans Firestore
 * @param {Array} incoming - articles à importer
 * @returns {{
 *   newCount: number,
 *   updatedCount: number,
 *   removedCount: number,    // mode Remplacer uniquement
 *   newCategories: Array<string>,
 *   removedCategories: Array<string>,
 *   currentCategories: Array<string>,
 *   incomingCategories: Array<string>,
 * }}
 */
export function compareCatalogues(current, incoming) {
  const currentByRef = new Map();
  for (const a of current) currentByRef.set(a.r, a);
  const incomingByRef = new Map();
  for (const a of incoming) incomingByRef.set(a.r, a);

  let newCount = 0, updatedCount = 0;
  for (const [ref] of incomingByRef) {
    if (currentByRef.has(ref)) updatedCount++;
    else newCount++;
  }
  let removedCount = 0;
  for (const [ref] of currentByRef) {
    if (!incomingByRef.has(ref)) removedCount++;
  }

  const currentCategories = [...new Set(current.map(a => a.c).filter(Boolean))].sort();
  const incomingCategories = [...new Set(incoming.map(a => a.c).filter(Boolean))].sort();
  const newCategories = incomingCategories.filter(c => !currentCategories.includes(c));
  const removedCategories = currentCategories.filter(c => !incomingCategories.includes(c));

  return {
    newCount, updatedCount, removedCount,
    newCategories, removedCategories,
    currentCategories, incomingCategories,
  };
}

// ─── Sérialisation pour export Excel (AoA) ────────────────────
/**
 * Convertit un catalogue en AoA pour export Excel.
 * @param {Array} articles
 * @returns {Array<Array>}
 */
export function articlesToAoa(articles) {
  const rows = [EXPECTED_HEADERS.slice()];
  // Tri stable : par catégorie puis sous-catégorie puis référence
  const sorted = [...articles].sort((a, b) => {
    const cc = (a.c || "").localeCompare(b.c || "");
    if (cc !== 0) return cc;
    const ss = (a.s || "").localeCompare(b.s || "");
    if (ss !== 0) return ss;
    return (a.r || "").localeCompare(b.r || "");
  });
  for (const a of sorted) {
    rows.push([
      a.c || "",
      a.s || "",
      a.r || "",
      a.n || "",
      a.u || "Pièce",
      a.stock ? "Oui" : "Non",
      a.fournisseur || "",
      a.codeEsabora || "",
      a.img || "",
    ]);
  }
  return rows;
}

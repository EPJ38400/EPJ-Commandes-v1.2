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
// v10.G.1 : un "vrai doublon" = même CATÉGORIE + même RÉFÉRENCE.
// Un article qui apparaît dans plusieurs catégories n'est PAS un doublon
// (c'est un classement multi-catégories voulu).
/**
 * Détecte les vrais doublons (même catégorie + même référence) dans un fichier.
 * @param {Array} articles
 * @returns {Array<{ref: string, cat: string, count: number}>}
 */
export function findDuplicateRefs(articles) {
  const counts = {};
  for (const a of articles) {
    const r = (a.r || "").trim();
    const c = (a.c || "").trim();
    if (!r) continue;
    const key = `${c}__${r}`;
    if (!counts[key]) counts[key] = { ref: r, cat: c, count: 0 };
    counts[key].count++;
  }
  return Object.values(counts).filter(x => x.count > 1);
}

/**
 * Compte combien d'articles distincts (par référence physique) sont dans
 * l'import. Utile pour informer l'utilisateur : "583 lignes mais seulement
 * 565 articles physiques — 18 sont classés dans plusieurs catégories".
 * @param {Array} articles
 * @returns {{ totalLines: number, uniqueRefs: number, multiCategoryCount: number }}
 */
export function countMultiCategoryArticles(articles) {
  const byRef = new Map();
  for (const a of articles) {
    const r = (a.r || "").trim();
    if (!r) continue;
    if (!byRef.has(r)) byRef.set(r, new Set());
    byRef.get(r).add((a.c || "").trim());
  }
  let multiCategoryCount = 0;
  for (const cats of byRef.values()) {
    if (cats.size > 1) multiCategoryCount++;
  }
  return {
    totalLines: articles.filter(a => a.r).length,
    uniqueRefs: byRef.size,
    multiCategoryCount,
  };
}

// ─── Comparaison avant/après pour rapport de pré-import ──────
// v10.G.1 : la "clé d'identité" d'un article est désormais (catégorie, référence),
// pas juste la référence. Cela permet de gérer correctement les articles
// classés dans plusieurs catégories.
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
  const keyOf = (a) => `${(a.c || "").trim()}__${(a.r || "").trim()}`;

  const currentByKey = new Map();
  for (const a of current) currentByKey.set(keyOf(a), a);
  const incomingByKey = new Map();
  for (const a of incoming) incomingByKey.set(keyOf(a), a);

  let newCount = 0, updatedCount = 0;
  for (const [key] of incomingByKey) {
    if (currentByKey.has(key)) updatedCount++;
    else newCount++;
  }
  let removedCount = 0;
  for (const [key] of currentByKey) {
    if (!incomingByKey.has(key)) removedCount++;
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

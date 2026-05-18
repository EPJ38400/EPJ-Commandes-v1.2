// ═══════════════════════════════════════════════════════════════
//  outilsImporter.js — v10.M
//
//  Import/Export Excel du parc d'outils.
//
//  Exports :
//    - exportOutilsToExcel(outils, categories) → Blob (.xlsx)
//    - parseOutilsFromExcel(file) → Promise<{ rows, errors }>
//    - validateImportRows(rows, existingOutils) → { valid, duplicatesInFile, errors }
//    - buildOutilDocFromRow(row, existing?) → doc Firestore prêt à upsert
//    - hasActiveSorties(outils, sorties) → bool (gate du mode "Tout remplacer")
//
//  La logique d'écriture Firestore (batch upsert / wipe + recharge) est
//  dans AdminOutillage.jsx, ce module ne fait que la transformation.
// ═══════════════════════════════════════════════════════════════

import * as XLSX from "xlsx";

// ─── Colonnes du fichier Excel ────────────────────────────────
export const EXPORT_COLUMNS = [
  "Référence",            // A
  "Nom",                  // B
  "Catégorie ID",         // C
  "Catégorie Label",      // D (informatif uniquement)
  "Code barres",          // E
  "Numéro de série",      // F
  "Marque",               // G
  "Notes",                // H
  "Statut",               // I
  "Affectation permanente UID",  // J
  "Pack",                 // K (oui/non)
  "Contenu pack",         // L (refs séparées par ;)
  "Photo URL",            // M
  "Photo Path",           // N
];

// ─── EXPORT : Firestore → Excel ───────────────────────────────

export function exportOutilsToExcel(outils, categories) {
  const safeCats = Array.isArray(categories) ? categories : [];
  const catLabelById = (id) => {
    const c = safeCats.find(cat => cat.id === id);
    return c ? c.label : "";
  };

  const safeOutils = Array.isArray(outils) ? outils : [];
  // Tri : catégorie puis référence (lecture humaine plus facile)
  const sorted = [...safeOutils].sort((a, b) => {
    const ca = (a.categorieId || "").localeCompare(b.categorieId || "");
    if (ca !== 0) return ca;
    return (a.ref || "").localeCompare(b.ref || "");
  });

  const rows = sorted.map(o => [
    o.ref || "",
    o.nom || "",
    o.categorieId || "",
    catLabelById(o.categorieId),
    o.codeBarres || "",
    o.numSerie || "",
    o.marque || "",
    o.notes || "",
    o.statut || "disponible",
    o.affectationPermanenteUserId || "",
    o.isPack ? "oui" : "non",
    Array.isArray(o.packContent) ? o.packContent.join(";") : "",
    o.photoURL || "",
    o.photoPath || "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([EXPORT_COLUMNS, ...rows]);
  // Largeurs raisonnables pour la lecture
  ws["!cols"] = [
    { wch: 18 }, { wch: 32 }, { wch: 16 }, { wch: 18 },
    { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 30 },
    { wch: 14 }, { wch: 14 }, { wch: 6 }, { wch: 24 },
    { wch: 32 }, { wch: 32 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Parc outils EPJ");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

// ─── PARSE : Excel → lignes normalisées ───────────────────────

/**
 * @param {ArrayBuffer} arrayBuffer - contenu lu via FileReader
 * @returns {{ rows: Array<object>, errors: Array<string> }}
 */
export function parseOutilsArrayBuffer(arrayBuffer) {
  const errors = [];
  let wb;
  try {
    wb = XLSX.read(arrayBuffer, { type: "array" });
  } catch (e) {
    return { rows: [], errors: ["Fichier illisible : " + (e.message || e)] };
  }
  if (!wb.SheetNames || wb.SheetNames.length === 0) {
    return { rows: [], errors: ["Fichier vide"] };
  }
  // Premier sheet (peu importe son nom)
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  if (raw.length < 2) {
    return { rows: [], errors: ["Fichier vide (pas de lignes de données)"] };
  }
  // raw[0] = en-têtes (ignorées), raw[1+] = données
  const rows = [];
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] || [];
    // Skip lignes totalement vides (ref ET nom vides)
    const ref = String(r[0] || "").trim();
    const nom = String(r[1] || "").trim();
    if (!ref && !nom) continue;
    rows.push({
      _line: i + 1,                  // numéro de ligne Excel (header = ligne 1)
      ref,
      nom,
      categorieId: String(r[2] || "").trim(),
      // r[3] = catégorie label : ignoré (informatif uniquement)
      codeBarres: String(r[4] || "").trim(),
      numSerie: String(r[5] || "").trim(),
      marque: String(r[6] || "").trim(),
      notes: String(r[7] || "").trim(),
      statut: String(r[8] || "disponible").trim() || "disponible",
      affectationPermanenteUserId: String(r[9] || "").trim() || null,
      isPack: String(r[10] || "").trim().toLowerCase() === "oui",
      packContent: String(r[11] || "").split(";")
        .map(s => s.trim()).filter(Boolean),
      photoURL: String(r[12] || "").trim(),
      photoPath: String(r[13] || "").trim(),
    });
  }
  return { rows, errors };
}

/**
 * Convenience : prend un File (DOM) et retourne une Promise.
 */
export function parseOutilsFromExcel(file) {
  return new Promise((resolve) => {
    if (!file) return resolve({ rows: [], errors: ["Aucun fichier"] });
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        resolve(parseOutilsArrayBuffer(e.target.result));
      } catch (err) {
        resolve({ rows: [], errors: ["Échec lecture : " + (err.message || err)] });
      }
    };
    reader.onerror = () => resolve({ rows: [], errors: ["FileReader error"] });
    reader.readAsArrayBuffer(file);
  });
}

// ─── VALIDATION ──────────────────────────────────────────────

/**
 * Valide les lignes parsées :
 *   - ref et nom obligatoires
 *   - pas de doublons de ref dans le fichier
 *
 * Retourne :
 *   {
 *     valid: Array<row>,
 *     errors: Array<string>,
 *     duplicatesInFile: Array<string>,   // refs dupliquées dans le fichier
 *     newCount, existingCount             // pour preview à l'utilisateur
 *   }
 */
export function validateImportRows(rows, existingOutils) {
  const errors = [];
  const duplicatesInFile = [];
  const seen = new Set();
  const safe = Array.isArray(rows) ? rows : [];
  const existingByRef = new Map();
  (existingOutils || []).forEach(o => {
    if (o.ref) existingByRef.set(o.ref.toLowerCase(), o);
  });
  let newCount = 0, existingCount = 0;
  const valid = [];
  for (const r of safe) {
    if (!r.ref) {
      errors.push(`Ligne ${r._line} : référence manquante`);
      continue;
    }
    if (!r.nom) {
      errors.push(`Ligne ${r._line} : nom manquant pour "${r.ref}"`);
      continue;
    }
    const key = r.ref.toLowerCase();
    if (seen.has(key)) {
      duplicatesInFile.push(r.ref);
      errors.push(`Ligne ${r._line} : référence "${r.ref}" en doublon dans le fichier`);
      continue;
    }
    seen.add(key);
    if (existingByRef.has(key)) existingCount++;
    else newCount++;
    valid.push(r);
  }
  return { valid, errors, duplicatesInFile, newCount, existingCount };
}

// ─── CONSTRUCTION DU DOC FIRESTORE ────────────────────────────

/**
 * Construit le doc Firestore à partir d'une ligne Excel.
 * Si `existing` est fourni, on conserve les champs auto (createdAt, _id)
 * et on rafraîchit updatedAt.
 *
 * @param {object} row - ligne parsée
 * @param {object|null} existing - outil existant (si update)
 * @param {string} newId - ID à utiliser si création
 */
export function buildOutilDocFromRow(row, existing, newId) {
  const now = new Date().toISOString();
  const id = existing?.id || existing?._id || newId;
  return {
    id,
    ref: row.ref,
    nom: row.nom,
    categorieId: row.categorieId || "",
    codeBarres: row.codeBarres || "",
    numSerie: row.numSerie || "",
    marque: row.marque || "",
    notes: row.notes || "",
    statut: row.statut || "disponible",
    photoURL: row.photoURL || (existing?.photoURL || ""),
    photoPath: row.photoPath || (existing?.photoPath || ""),
    affectationPermanenteUserId: row.affectationPermanenteUserId || null,
    isPack: row.isPack === true,
    packContent: Array.isArray(row.packContent) ? row.packContent : [],
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
}

// ─── GATE : sorties actives ──────────────────────────────────

/**
 * Une sortie est "active" si pas encore retournée (cf. règles outillageRappel).
 * Le mode "Tout remplacer" doit être BLOQUÉ s'il y a des sorties actives,
 * pour éviter de casser des sorties en cours en supprimant les outils.
 */
export function hasActiveSorties(outillageSorties) {
  if (!Array.isArray(outillageSorties)) return false;
  return outillageSorties.some(s => {
    if (!s) return false;
    if (s.dateRetourReelle) return false;
    if (s.etatRetour) return false;
    return true;
  });
}

export function countActiveSorties(outillageSorties) {
  if (!Array.isArray(outillageSorties)) return 0;
  return outillageSorties.filter(s => s && !s.dateRetourReelle && !s.etatRetour).length;
}

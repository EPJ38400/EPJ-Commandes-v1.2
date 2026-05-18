// outilsImporter.test.js v10.M - Tests purs sur validation + buildDoc + gates

// Reproduction locale (sans XLSX) des helpers purs testables
function validateImportRows(rows, existingOutils) {
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
    if (!r.ref) { errors.push("Ligne " + r._line + " : référence manquante"); continue; }
    if (!r.nom) { errors.push("Ligne " + r._line + " : nom manquant pour \"" + r.ref + "\""); continue; }
    const key = r.ref.toLowerCase();
    if (seen.has(key)) {
      duplicatesInFile.push(r.ref);
      errors.push("Ligne " + r._line + " : référence \"" + r.ref + "\" en doublon dans le fichier");
      continue;
    }
    seen.add(key);
    if (existingByRef.has(key)) existingCount++;
    else newCount++;
    valid.push(r);
  }
  return { valid, errors, duplicatesInFile, newCount, existingCount };
}

function buildOutilDocFromRow(row, existing, newId) {
  const now = new Date().toISOString();
  const id = (existing && (existing.id || existing._id)) || newId;
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
    photoURL: row.photoURL || ((existing && existing.photoURL) || ""),
    photoPath: row.photoPath || ((existing && existing.photoPath) || ""),
    affectationPermanenteUserId: row.affectationPermanenteUserId || null,
    isPack: row.isPack === true,
    packContent: Array.isArray(row.packContent) ? row.packContent : [],
    createdAt: (existing && existing.createdAt) || now,
    updatedAt: now,
  };
}

function hasActiveSorties(s) {
  if (!Array.isArray(s)) return false;
  return s.some(x => x && !x.dateRetourReelle && !x.etatRetour);
}

function countActiveSorties(s) {
  if (!Array.isArray(s)) return 0;
  return s.filter(x => x && !x.dateRetourReelle && !x.etatRetour).length;
}

let pass = 0, fail = 0;
function assertEq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log("✓ " + label); pass++; }
  else { console.error("✗ " + label + "\n  attendu: " + JSON.stringify(expected) + "\n  recu:    " + JSON.stringify(actual)); fail++; }
}
function assertTrue(actual, label) { assertEq(!!actual, true, label); }
function assertFalse(actual, label) { assertEq(!!actual, false, label); }

// ─── validateImportRows ──────────────────────────────────────
// Cas heureux : 3 lignes valides, 1 existante, 2 nouvelles
{
  const rows = [
    { _line: 2, ref: "REF-001", nom: "Perforateur", categorieId: "decoupe" },
    { _line: 3, ref: "REF-002", nom: "Scie sauteuse", categorieId: "decoupe" },
    { _line: 4, ref: "REF-003", nom: "Visseuse", categorieId: "fixation" },
  ];
  const existing = [
    { id: "u1", ref: "REF-001", nom: "ancien nom" },
  ];
  const r = validateImportRows(rows, existing);
  assertEq(r.valid.length, 3, "3 lignes valides");
  assertEq(r.errors.length, 0, "0 erreurs");
  assertEq(r.newCount, 2, "2 nouvelles");
  assertEq(r.existingCount, 1, "1 existante");
}

// Ref manquante
{
  const r = validateImportRows([{ _line: 5, ref: "", nom: "Sans ref" }], []);
  assertEq(r.valid.length, 0, "ref vide → invalide");
  assertEq(r.errors.length, 1, "1 erreur");
  assertTrue(r.errors[0].includes("référence manquante"), "message correct");
}

// Nom manquant
{
  const r = validateImportRows([{ _line: 7, ref: "REF-X", nom: "" }], []);
  assertEq(r.valid.length, 0, "nom vide → invalide");
  assertTrue(r.errors[0].includes("nom manquant"), "message correct");
}

// Doublon dans le fichier (insensible à la casse)
{
  const rows = [
    { _line: 2, ref: "REF-001", nom: "A" },
    { _line: 3, ref: "ref-001", nom: "B" },  // doublon en minuscules
  ];
  const r = validateImportRows(rows, []);
  assertEq(r.valid.length, 1, "1 valide, 1 doublon");
  assertEq(r.duplicatesInFile.length, 1, "1 doublon détecté");
  assertEq(r.duplicatesInFile[0], "ref-001", "ref doublon");
}

// Lignes mixtes : ref vide + valide
{
  const rows = [
    { _line: 2, ref: "REF-OK", nom: "OK" },
    { _line: 3, ref: "", nom: "Sans ref" },
    { _line: 4, ref: "REF-2", nom: "OK 2" },
  ];
  const r = validateImportRows(rows, []);
  assertEq(r.valid.length, 2, "2 valides sur 3");
  assertEq(r.errors.length, 1, "1 erreur");
}

// existingOutils null/undefined ne plante pas
{
  const r = validateImportRows([{ _line: 2, ref: "X", nom: "Y" }], null);
  assertEq(r.newCount, 1, "null existing → tout nouveau");
  assertEq(r.existingCount, 0, "0 existantes");
}

// rows null ne plante pas
{
  const r = validateImportRows(null, []);
  assertEq(r.valid.length, 0, "rows null → 0 valide");
}

// ─── buildOutilDocFromRow ───────────────────────────────────
// Création : pas d'existing
{
  const row = {
    ref: "REF-100", nom: "Marteau", categorieId: "fixation",
    codeBarres: "123", numSerie: "S100", marque: "Stanley",
    notes: "Outil de base", statut: "disponible",
    isPack: false, packContent: [],
    photoURL: "", photoPath: "",
    affectationPermanenteUserId: null,
  };
  const doc = buildOutilDocFromRow(row, null, "outil_new_123");
  assertEq(doc.id, "outil_new_123", "ID = newId pour création");
  assertEq(doc.ref, "REF-100", "ref OK");
  assertEq(doc.nom, "Marteau", "nom OK");
  assertEq(doc.statut, "disponible", "statut OK");
  assertEq(doc.isPack, false, "isPack false");
  assertTrue(doc.createdAt, "createdAt présent");
  assertTrue(doc.updatedAt, "updatedAt présent");
}

// Mise à jour : conserve l'ID et createdAt de l'existant
{
  const existingDoc = {
    id: "outil_xyz",
    ref: "REF-100",
    createdAt: "2025-01-15T10:00:00.000Z",
    photoURL: "https://photo-ancienne.jpg",
    photoPath: "outils/ancien.jpg",
  };
  const row = {
    ref: "REF-100", nom: "Marteau v2", categorieId: "fixation",
    photoURL: "", photoPath: "", // vides dans le fichier
    statut: "disponible", isPack: false, packContent: [],
  };
  const doc = buildOutilDocFromRow(row, existingDoc, "ignored_id");
  assertEq(doc.id, "outil_xyz", "ID conservé de l'existant");
  assertEq(doc.createdAt, "2025-01-15T10:00:00.000Z", "createdAt conservé");
  assertEq(doc.photoURL, "https://photo-ancienne.jpg", "photo conservée si vide dans fichier");
  assertEq(doc.nom, "Marteau v2", "nom mis à jour");
}

// Pack avec contenu
{
  const row = {
    ref: "PACK-1", nom: "Pack Fixation", categorieId: "fixation",
    isPack: true, packContent: ["REF-100", "REF-200"],
    statut: "disponible",
  };
  const doc = buildOutilDocFromRow(row, null, "outil_new");
  assertEq(doc.isPack, true, "isPack true");
  assertEq(doc.packContent, ["REF-100", "REF-200"], "packContent OK");
}

// Statut absent → défaut "disponible"
{
  const row = { ref: "X", nom: "Y", statut: "", isPack: false, packContent: [] };
  const doc = buildOutilDocFromRow(row, null, "id1");
  assertEq(doc.statut, "disponible", "statut défaut");
}

// ─── hasActiveSorties / countActiveSorties ──────────────────
// 0 sorties → false
assertFalse(hasActiveSorties([]), "0 sorties → false");
assertEq(countActiveSorties([]), 0, "count 0");

// Toutes retournées
{
  const sorties = [
    { dateRetourReelle: "2026-05-10" },
    { dateRetourReelle: "2026-05-11" },
  ];
  assertFalse(hasActiveSorties(sorties), "toutes retournées → false");
  assertEq(countActiveSorties(sorties), 0, "count 0");
}

// 1 active
{
  const sorties = [
    { dateRetourReelle: "2026-05-10" },
    { /* pas de date retour */ },
  ];
  assertTrue(hasActiveSorties(sorties), "1 active → true");
  assertEq(countActiveSorties(sorties), 1, "count 1");
}

// etatRetour = retournée
{
  const sorties = [{ etatRetour: "ok" }];
  assertFalse(hasActiveSorties(sorties), "etatRetour set → pas active");
}

// null safe
assertFalse(hasActiveSorties(null), "null → false");
assertEq(countActiveSorties(undefined), 0, "undefined → 0");

console.log("\n────────────────────────────────────────");
console.log("Tests outilsImporter v10.M : " + pass + " OK, " + fail + " KO");
if (fail > 0) process.exit(1);

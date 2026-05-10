// ═══════════════════════════════════════════════════════════════
//  catalogImporter.test.js — v10.G (Charte Option D)
//
//  Tests unitaires sur la logique pure de parsing/import/export.
//  Pas de dépendance Firestore ni DOM, exécutable via Node.
//  Lancement : node src/modules/commandes/catalogImporter.test.js
// ═══════════════════════════════════════════════════════════════
import {
  parseCatalogAoa,
  findDuplicateRefs,
  compareCatalogues,
  articlesToAoa,
  EXPECTED_HEADERS,
} from "./catalogImporter.js";

let pass = 0, fail = 0;
function assertEq(actual, expected, name) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`✓ ${name}`); pass++; }
  else {
    console.log(`✗ ${name}`);
    console.log(`  Attendu: ${JSON.stringify(expected)}`);
    console.log(`  Obtenu : ${JSON.stringify(actual)}`);
    fail++;
  }
}
function assertTrue(cond, name) {
  if (cond) { console.log(`✓ ${name}`); pass++; }
  else { console.log(`✗ ${name}`); fail++; }
}

// ─── Test 1 : parseCatalogAoa — fichier vide ─────────────────
{
  const r = parseCatalogAoa([]);
  assertEq(r.articles, [], "parseCatalogAoa(vide) → 0 articles");
  assertTrue(r.errors.length > 0, "parseCatalogAoa(vide) → 1 erreur");
}

// ─── Test 2 : parseCatalogAoa — colonnes obligatoires manquantes ──
{
  const r = parseCatalogAoa([["Catégorie", "Référence"]]); // manque Sous-cat et Désignation
  assertTrue(r.errors.length > 0, "Colonnes manquantes → erreur");
  assertEq(r.articles, [], "Colonnes manquantes → 0 articles");
}

// ─── Test 3 : parseCatalogAoa — cas nominal ──────────────────
{
  const aoa = [
    EXPECTED_HEADERS,
    ["Béton + Descente", "Capri", "CAP 959922", "BOITE", "Pièce", "Non", "SONEPAR", "SONE", ""],
    ["Plexo", "Boite", "PLE 001", "Boîte plexo", "Pièce", "Oui", "Sonepar", "SONE", ""],
  ];
  const r = parseCatalogAoa(aoa);
  assertEq(r.errors, [], "Cas nominal : 0 erreur");
  assertEq(r.articles.length, 2, "Cas nominal : 2 articles");
  assertEq(r.articles[0].r, "CAP 959922", "Article 1 : référence OK");
  assertEq(r.articles[0].stock, false, 'Article 1 : "Non" → false');
  assertEq(r.articles[1].stock, true, 'Article 2 : "Oui" → true');
}

// ─── Test 4 : parseCatalogAoa — ligne sans référence ignorée ──
{
  const aoa = [
    EXPECTED_HEADERS,
    ["Cat A", "Sub", "REF1", "Désig 1", "Pièce", "Non", "", "", ""],
    ["Cat A", "Sub", "", "Sans réf", "Pièce", "Non", "", "", ""], // ligne ignorée
    ["Cat A", "Sub", "REF2", "Désig 2", "Pièce", "Oui", "", "", ""],
  ];
  const r = parseCatalogAoa(aoa);
  assertEq(r.articles.length, 2, "Lignes sans réf ignorées → 2 articles");
  assertTrue(r.warnings.length > 0, "Ligne sans réf → warning");
}

// ─── Test 5 : parseCatalogAoa — sous-catégorie défaut ────────
{
  const aoa = [
    EXPECTED_HEADERS,
    ["Cat A", "", "REF1", "D", "Pièce", "Non", "", "", ""],
  ];
  const r = parseCatalogAoa(aoa);
  assertEq(r.articles[0].s, "Général", 'Sous-cat vide → "Général"');
}

// ─── Test 6 : parseCatalogAoa — unité défaut ─────────────────
{
  const aoa = [
    EXPECTED_HEADERS,
    ["Cat A", "Sub", "REF1", "D", "", "Non", "", "", ""],
  ];
  const r = parseCatalogAoa(aoa);
  assertEq(r.articles[0].u, "Pièce", 'Unité vide → "Pièce"');
}

// ─── Test 7 : parseCatalogAoa — variantes de Stock ───────────
{
  const aoa = [
    EXPECTED_HEADERS,
    ["C", "S", "R1", "D", "P", "OUI", "", "", ""],
    ["C", "S", "R2", "D", "P", "Non", "", "", ""],
    ["C", "S", "R3", "D", "P", "yes", "", "", ""],
    ["C", "S", "R4", "D", "P", "true", "", "", ""],
    ["C", "S", "R5", "D", "P", "FAUX", "", "", ""],
  ];
  const r = parseCatalogAoa(aoa);
  assertEq(r.articles[0].stock, true, "Stock 'OUI' (majuscules) → true");
  assertEq(r.articles[1].stock, false, "Stock 'Non' → false");
  assertEq(r.articles[2].stock, true, "Stock 'yes' → true");
  assertEq(r.articles[3].stock, true, "Stock 'true' → true");
  assertEq(r.articles[4].stock, false, "Stock 'FAUX' → false");
}

// ─── Test 8 : parseCatalogAoa — null/undefined dans cellules ──
{
  const aoa = [
    EXPECTED_HEADERS,
    [null, undefined, "REF1", "Désig", "Pièce", null, "SONEPAR", undefined, ""],
  ];
  const r = parseCatalogAoa(aoa);
  assertEq(r.articles.length, 1, "Null/undefined → article créé quand même");
  assertEq(r.articles[0].r, "REF1", "null/undefined → champs vides");
  assertEq(r.articles[0].fournisseur, "SONEPAR", "null/undefined : autres champs OK");
}

// ─── Test 9 : findDuplicateRefs ─────────────────────────────
{
  const articles = [
    { r: "REF1" }, { r: "REF2" }, { r: "REF1" }, { r: "REF3" }, { r: "REF1" }, { r: "REF2" },
  ];
  const dups = findDuplicateRefs(articles);
  assertEq(dups.length, 2, "findDuplicateRefs : 2 références en doublon");
  const ref1 = dups.find(d => d.ref === "REF1");
  const ref2 = dups.find(d => d.ref === "REF2");
  assertEq(ref1?.count, 3, "REF1 apparaît 3 fois");
  assertEq(ref2?.count, 2, "REF2 apparaît 2 fois");
}

// ─── Test 10 : findDuplicateRefs — pas de doublons ──────────
{
  const articles = [{ r: "A" }, { r: "B" }, { r: "C" }];
  assertEq(findDuplicateRefs(articles), [], "findDuplicateRefs : 0 doublon");
}

// ─── Test 11 : findDuplicateRefs — refs vides ignorées ───────
{
  const articles = [{ r: "" }, { r: "" }, { r: null }, { r: "X" }];
  assertEq(findDuplicateRefs(articles), [], "findDuplicateRefs : refs vides ignorées");
}

// ─── Test 12 : compareCatalogues — cas nominal ──────────────
{
  const current = [
    { r: "A", c: "Cat1" }, { r: "B", c: "Cat1" }, { r: "C", c: "Cat2" },
  ];
  const incoming = [
    { r: "A", c: "Cat1" }, // mis à jour
    { r: "D", c: "Cat3" }, // nouveau
    { r: "B", c: "Cat1" }, // mis à jour
  ];
  const cmp = compareCatalogues(current, incoming);
  assertEq(cmp.updatedCount, 2, "compareCatalogues : 2 mis à jour");
  assertEq(cmp.newCount, 1, "compareCatalogues : 1 nouveau");
  assertEq(cmp.removedCount, 1, "compareCatalogues : 1 supprimé");
  assertEq(cmp.newCategories, ["Cat3"], "compareCatalogues : nouvelle catégorie Cat3");
  assertEq(cmp.removedCategories, ["Cat2"], "compareCatalogues : catégorie supprimée Cat2");
}

// ─── Test 13 : compareCatalogues — listes vides ─────────────
{
  const cmp = compareCatalogues([], []);
  assertEq(cmp.newCount, 0, "compare(vide,vide) : 0 nouveau");
  assertEq(cmp.updatedCount, 0, "compare(vide,vide) : 0 mis à jour");
  assertEq(cmp.removedCount, 0, "compare(vide,vide) : 0 supprimé");
}

// ─── Test 14 : articlesToAoa — round-trip parse → serialize ─
{
  const articles = [
    { c: "Cat A", s: "Sub", r: "R1", n: "Désig 1", u: "Pièce", stock: false, fournisseur: "Sone", codeEsabora: "SONE", img: "" },
    { c: "Cat B", s: "Sub", r: "R2", n: "Désig 2", u: "ML", stock: true, fournisseur: "", codeEsabora: "", img: "" },
  ];
  const aoa = articlesToAoa(articles);
  assertEq(aoa[0], EXPECTED_HEADERS, "articlesToAoa : en-têtes corrects");
  assertEq(aoa.length, 3, "articlesToAoa : 1 en-tête + 2 lignes");
  // Le tri trie par catégorie : Cat A avant Cat B
  assertEq(aoa[1][0], "Cat A", "Tri par catégorie : Cat A avant Cat B");
  assertEq(aoa[1][5], "Non", "stock: false → 'Non'");
  assertEq(aoa[2][5], "Oui", "stock: true → 'Oui'");
}

// ─── Test 15 : round-trip parse → serialize → parse ────────
{
  const original = [
    { c: "Cat", s: "Sub", r: "R1", n: "D1", u: "Pièce", stock: false, fournisseur: "F", codeEsabora: "FX", img: "" },
    { c: "Cat", s: "Sub", r: "R2", n: "D2", u: "ML", stock: true, fournisseur: "", codeEsabora: "", img: "" },
  ];
  const aoa = articlesToAoa(original);
  const reparsed = parseCatalogAoa(aoa);
  assertEq(reparsed.errors, [], "Round-trip : pas d'erreur");
  assertEq(reparsed.articles.length, 2, "Round-trip : 2 articles");
  assertEq(reparsed.articles[0].r, "R1", "Round-trip : R1 préservée");
  assertEq(reparsed.articles[1].stock, true, "Round-trip : stock préservé");
}

// ─── Test 16 : caractères spéciaux ───────────────────────────
{
  const aoa = [
    EXPECTED_HEADERS,
    ["Béton + Descente", "Sub à accents", "RÉF #1", `Désig "avec guillemets" et 'apostrophe'`, "Pièce", "Non", "", "", ""],
  ];
  const r = parseCatalogAoa(aoa);
  assertEq(r.articles[0].c, "Béton + Descente", "Accents préservés");
  assertEq(r.articles[0].n, `Désig "avec guillemets" et 'apostrophe'`, "Guillemets et apostrophes préservés");
}

// ─── Test 17 : Headers dans un ordre différent ───────────────
{
  // Si l'utilisateur met les colonnes dans le désordre, ça doit marcher
  const aoa = [
    ["Référence", "Désignation", "Catégorie", "Sous-catégorie", "Unité", "Stock", "Fournisseur principal", "Code Esabora", "Photo URL"],
    ["R1", "D", "C", "S", "P", "Non", "F", "FX", ""],
  ];
  const r = parseCatalogAoa(aoa);
  assertEq(r.articles.length, 1, "Ordre colonnes différent : OK");
  assertEq(r.articles[0].r, "R1", "Ordre colonnes différent : ref OK");
  assertEq(r.articles[0].c, "C", "Ordre colonnes différent : catégorie OK");
}

// ─── Test 18 : ligne entièrement vide ignorée ───────────────
{
  const aoa = [
    EXPECTED_HEADERS,
    ["", "", "", "", "", "", "", "", ""],
    [null, null, null, null, null, null, null, null, null],
    ["C", "S", "REF", "D", "P", "Non", "", "", ""],
  ];
  const r = parseCatalogAoa(aoa);
  assertEq(r.articles.length, 1, "Lignes vides ignorées sans bruit");
  assertEq(r.warnings.length, 0, "Lignes vides → pas de warning");
}

// ─── Récap ───────────────────────────────────────────────────
console.log("\n────────────────────────────────────────");
console.log(`Tests : ${pass} OK, ${fail} KO`);
if (fail > 0) process.exit(1);

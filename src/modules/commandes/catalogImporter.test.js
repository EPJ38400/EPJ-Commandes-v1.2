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
  countMultiCategoryArticles,
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

// ─── Test 9 : findDuplicateRefs — VRAIS doublons (même cat+ref) ──
// v10.G.1 : un article dans 2 catégories différentes n'est PAS un doublon
{
  const articles = [
    { c: "Cat1", r: "REF1" },
    { c: "Cat1", r: "REF2" },
    { c: "Cat2", r: "REF1" }, // pas un doublon : autre catégorie
    { c: "Cat3", r: "REF3" },
    { c: "Cat1", r: "REF1" }, // VRAI doublon : même cat+ref que la 1ère
    { c: "Cat1", r: "REF2" }, // VRAI doublon : même cat+ref
  ];
  const dups = findDuplicateRefs(articles);
  assertEq(dups.length, 2, "findDuplicateRefs : 2 vrais doublons (cat+ref)");
  const d1 = dups.find(d => d.ref === "REF1" && d.cat === "Cat1");
  const d2 = dups.find(d => d.ref === "REF2" && d.cat === "Cat1");
  assertEq(d1?.count, 2, "REF1 en Cat1 → 2 fois");
  assertEq(d2?.count, 2, "REF2 en Cat1 → 2 fois");
}

// ─── Test 9b : findDuplicateRefs — multi-catégories OK ──
{
  // Un article classé dans 3 catégories différentes : aucun doublon
  const articles = [
    { c: "Cat1", r: "TUBE" },
    { c: "Cat2", r: "TUBE" },
    { c: "Cat3", r: "TUBE" },
  ];
  assertEq(findDuplicateRefs(articles), [], "Multi-catégories : pas de doublon");
}

// ─── Test 9c : countMultiCategoryArticles ───────────────────
{
  const articles = [
    { c: "C1", r: "A" },
    { c: "C2", r: "A" },  // A est dans 2 catégories
    { c: "C1", r: "B" },
    { c: "C1", r: "C" },
    { c: "C2", r: "C" },  // C est dans 2 catégories
    { c: "C3", r: "C" },  // C est dans 3 catégories
  ];
  const stats = countMultiCategoryArticles(articles);
  assertEq(stats.totalLines, 6, "Total lignes : 6");
  assertEq(stats.uniqueRefs, 3, "Références uniques : 3 (A, B, C)");
  assertEq(stats.multiCategoryCount, 2, "Multi-catégories : 2 (A et C)");
}

// ─── Test 10 : findDuplicateRefs — pas de doublons ──────────
{
  const articles = [
    { c: "C", r: "A" }, { c: "C", r: "B" }, { c: "C", r: "C" },
  ];
  assertEq(findDuplicateRefs(articles), [], "findDuplicateRefs : 0 doublon");
}

// ─── Test 11 : findDuplicateRefs — refs vides ignorées ───────
{
  const articles = [
    { c: "C", r: "" }, { c: "C", r: "" }, { c: "C", r: null }, { c: "C", r: "X" },
  ];
  assertEq(findDuplicateRefs(articles), [], "findDuplicateRefs : refs vides ignorées");
}

// ─── Test 12 : compareCatalogues — cas nominal (clé cat+ref) ──
// v10.G.1 : la clé est désormais (catégorie, référence)
{
  const current = [
    { r: "A", c: "Cat1" }, { r: "B", c: "Cat1" }, { r: "C", c: "Cat2" },
  ];
  const incoming = [
    { r: "A", c: "Cat1" }, // mis à jour (même cat+ref)
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

// ─── Test 12b : compareCatalogues — multi-catégories ─────────
// v10.G.1 : un article qui change de catégorie est comptabilisé comme nouveau+supprimé
{
  const current = [
    { r: "TUBE", c: "Conduit" },
  ];
  const incoming = [
    { r: "TUBE", c: "Conduit" }, // pareil → mis à jour
    { r: "TUBE", c: "Béton" },   // même réf, autre catégorie → nouveau
  ];
  const cmp = compareCatalogues(current, incoming);
  assertEq(cmp.updatedCount, 1, "compareCatalogues multi-cat : TUBE en Conduit conservé");
  assertEq(cmp.newCount, 1, "compareCatalogues multi-cat : TUBE en Béton ajouté");
  assertEq(cmp.removedCount, 0, "compareCatalogues multi-cat : 0 supprimé");
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

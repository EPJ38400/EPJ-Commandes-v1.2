// esaboraUtils.test.js v10.L - Tests purs des helpers Esabora

// Reproduction locale (sans imports Firebase/XLSX pour test pur)
function getCodeEsabora(item, catalog) {
  if (!item || !Array.isArray(catalog)) return "";
  const ref = (item.r || item.ref || "").trim();
  if (!ref) return "";
  const cat = catalog.find(c => (c.r || "").trim() === ref);
  return (cat && cat.codeEsabora) || "";
}

function groupItemsByEsaboraCode(items, catalog) {
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

let pass = 0, fail = 0;
function assertEq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log("✓ " + label); pass++; }
  else { console.error("✗ " + label + "\n  attendu: " + JSON.stringify(expected) + "\n  recu:    " + JSON.stringify(actual)); fail++; }
}

// ─── getCodeEsabora ─────────────────────────────────────────
const catalog = [
  { r: "SCH S520059", codeEsabora: "SCH" },
  { r: "BLI 560409", codeEsabora: "BLI" },
  { r: "DIV-12345", codeEsabora: "" }, // pas de code (article divers)
  { r: "WUR 0556500300", codeEsabora: "WUR" },
];

assertEq(getCodeEsabora({ r: "SCH S520059" }, catalog), "SCH", "code trouvé SCH");
assertEq(getCodeEsabora({ r: "BLI 560409" }, catalog), "BLI", "code trouvé BLI");
assertEq(getCodeEsabora({ r: "DIV-12345" }, catalog), "", "code vide -> ''");
assertEq(getCodeEsabora({ r: "UNKNOWN" }, catalog), "", "ref inconnue -> ''");
assertEq(getCodeEsabora({}, catalog), "", "item sans ref -> ''");
assertEq(getCodeEsabora(null, catalog), "", "item null -> ''");
assertEq(getCodeEsabora({ r: "SCH S520059" }, null), "", "catalog null -> ''");
// Avec champ ref au lieu de r
assertEq(getCodeEsabora({ ref: "SCH S520059" }, catalog), "SCH", "support ref au lieu de r");

// ─── groupItemsByEsaboraCode ───────────────────────────────
// Cas 1 : 3 articles sur 3 fournisseurs différents
{
  const items = [
    { r: "SCH S520059", n: "A", qty: 5 },
    { r: "BLI 560409", n: "B", qty: 10 },
    { r: "WUR 0556500300", n: "C", qty: 2 },
  ];
  const { groups, ignored } = groupItemsByEsaboraCode(items, catalog);
  assertEq(groups.length, 3, "3 groupes pour 3 fournisseurs");
  assertEq(groups[0].codeEsabora, "BLI", "tri alphabétique : BLI en premier");
  assertEq(groups[1].codeEsabora, "SCH", "tri alphabétique : SCH en 2e");
  assertEq(groups[2].codeEsabora, "WUR", "tri alphabétique : WUR en 3e");
  assertEq(ignored.length, 0, "aucun ignoré");
}

// Cas 2 : plusieurs articles même fournisseur → un seul groupe avec N items
{
  const items = [
    { r: "SCH S520059", n: "A", qty: 5 },
    { r: "SCH S520059", n: "A bis", qty: 3 },
  ];
  // Ajout d'un 2e article SCH au catalogue pour tester
  const cat2 = [
    { r: "SCH S520059", codeEsabora: "SCH" },
    { r: "SCH S520060", codeEsabora: "SCH" },
  ];
  const { groups } = groupItemsByEsaboraCode(items, cat2);
  assertEq(groups.length, 1, "1 groupe car même codeEsabora");
  assertEq(groups[0].items.length, 2, "2 items dans le groupe SCH");
}

// Cas 3 : articles sans codeEsabora -> ignorés (Q2=3)
{
  const items = [
    { r: "SCH S520059", n: "A", qty: 5 },
    { r: "DIV-12345", n: "Article divers", qty: 1 },
    { r: "UNKNOWN-REF", n: "?", qty: 1 },
  ];
  const { groups, ignored } = groupItemsByEsaboraCode(items, catalog);
  assertEq(groups.length, 1, "1 groupe (SCH seul)");
  assertEq(ignored.length, 2, "2 articles ignorés (DIV vide + UNKNOWN)");
  assertEq(ignored[0].r, "DIV-12345", "ignored conserve la ref");
}

// Cas 4 : items vide
{
  const { groups, ignored } = groupItemsByEsaboraCode([], catalog);
  assertEq(groups.length, 0, "items vide -> 0 groupe");
  assertEq(ignored.length, 0, "items vide -> 0 ignoré");
}

// Cas 5 : items null
{
  const { groups, ignored } = groupItemsByEsaboraCode(null, catalog);
  assertEq(groups.length, 0, "items null -> 0 groupe");
  assertEq(ignored.length, 0, "items null -> 0 ignoré");
}

// Cas 6 : 5 fournisseurs (réaliste pour grosse commande)
{
  const items = [
    { r: "SCH S520059", qty: 1 },
    { r: "BLI 560409", qty: 1 },
    { r: "WUR 0556500300", qty: 1 },
    { r: "DIV-X", qty: 1 }, // ignoré
    { r: "SCH S520059", qty: 1 }, // doublon SCH
  ];
  const { groups, ignored } = groupItemsByEsaboraCode(items, catalog);
  assertEq(groups.length, 3, "3 groupes distincts");
  assertEq(ignored.length, 1, "1 article divers ignoré");
  const sch = groups.find(g => g.codeEsabora === "SCH");
  assertEq(sch.items.length, 2, "SCH agrège ses 2 lignes");
}

console.log("\n────────────────────────────────────────");
console.log("Tests esaboraUtils v10.L : " + pass + " OK, " + fail + " KO");
if (fail > 0) process.exit(1);

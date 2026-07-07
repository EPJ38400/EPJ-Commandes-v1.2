// planningModel.test.js — Tests purs (multi-tâches lot 1).
// Reproduction locale des helpers (mêmes règles que planningModel.js, sans la
// chaîne d'imports browser d'avancementTasks/theme, pour rester runnable en `node`).

function demiJourneeHeures(dayIdx) {
  return dayIdx === 4 ? 3.5 : 4;
}

function getCreneauTaches(cr) {
  if (!cr) return [];
  if (Array.isArray(cr.taches) && cr.taches.length) return cr.taches;
  const hasTask = cr.chantierId || cr.posteAvancementKey || cr.posteLabel;
  if (!hasTask) return [];
  return [{
    id: "t0",
    chantierId: cr.chantierId || null,
    batiment: cr.batiment || null,
    posteAvancementKey: cr.posteAvancementKey || null,
    posteLabel: cr.posteLabel || null,
    tempsEstimeH: cr.tempsEstimeH ?? null,
    etatValidationMonteur: cr.etatValidationMonteur || "NON",
    etatValidationMonteurAt: cr.etatValidationMonteurAt || null,
    etatValidationMonteurPar: cr.etatValidationMonteurPar || null,
    etatValidationConducteur: cr.etatValidationConducteur || "NON",
    etatValidationConducteurAt: cr.etatValidationConducteurAt || null,
    etatValidationConducteurPar: cr.etatValidationConducteurPar || null,
  }];
}

function creneauTotalHours(cr, dayIdx) {
  const taches = getCreneauTaches(cr);
  if (!taches.length) return 0;
  return taches.reduce((s, t) =>
    s + (t.tempsEstimeH != null ? Number(t.tempsEstimeH) : demiJourneeHeures(dayIdx)), 0);
}

let ok = 0, ko = 0;
function eq(got, want, msg) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { ok++; console.log(`  ✓ ${msg}`); }
  else { ko++; console.log(`  ✗ ${msg}\n     attendu ${w}\n     obtenu ${g}`); }
}

console.log("getCreneauTaches");
// (a) doc plat legacy → 1 tâche normalisée
eq(getCreneauTaches({
  chantierId: "251234", batiment: "A", posteAvancementKey: "log-1",
  posteLabel: "Logement", tempsEstimeH: 4,
  etatValidationMonteur: "OUI", etatValidationMonteurAt: "2026-07-07",
}), [{
  id: "t0", chantierId: "251234", batiment: "A", posteAvancementKey: "log-1",
  posteLabel: "Logement", tempsEstimeH: 4,
  etatValidationMonteur: "OUI", etatValidationMonteurAt: "2026-07-07",
  etatValidationMonteurPar: null,
  etatValidationConducteur: "NON", etatValidationConducteurAt: null,
  etatValidationConducteurPar: null,
}], "doc plat legacy → 1 tâche");

// (b) doc avec taches[] → passthrough intégral
const taches = [{ id: "t1", chantierId: "9", posteLabel: "X" }, { id: "t2", posteLabel: "libre" }];
eq(getCreneauTaches({ taches }), taches, "taches[] → passthrough");

// (c) slot vide (pool sans tâche) → []
eq(getCreneauTaches({ ressourceId: null }), [], "slot vide → []");
eq(getCreneauTaches(null), [], "null → []");

console.log("creneauTotalHours");
// legacy sans temps → demiJourneeHeures(dayIdx)
eq(creneauTotalHours({ chantierId: "251234" }, 0), 4, "legacy sans temps lundi → 4");
eq(creneauTotalHours({ chantierId: "251234" }, 4), 3.5, "legacy sans temps vendredi → 3,5");
// legacy avec temps explicite → ce temps
eq(creneauTotalHours({ chantierId: "251234", tempsEstimeH: 2 }, 0), 2, "legacy temps explicite → 2");
// multi-tâches → somme
eq(creneauTotalHours({ taches: [
  { id: "a", tempsEstimeH: 2 }, { id: "b", tempsEstimeH: 1.5 },
] }, 0), 3.5, "multi-tâches somme temps → 3,5");
// multi-tâches, une sans temps → fallback demi-journée
eq(creneauTotalHours({ taches: [
  { id: "a", tempsEstimeH: 2 }, { id: "b" },
] }, 4), 5.5, "multi-tâches fallback vendredi → 2 + 3,5");
// slot vide → 0
eq(creneauTotalHours({}, 0), 0, "slot vide → 0");

console.log("\n────────────────────────────────────────");
console.log(`Tests planningModel : ${ok} OK, ${ko} KO`);
if (ko > 0) process.exit(1);

// planningModel.test.js — Tests purs (multi-tâches lot 1).
// Reproduction locale des helpers (mêmes règles que planningModel.js, sans la
// chaîne d'imports browser d'avancementTasks/theme, pour rester runnable en `node`).

function demiJourneeHeures(dayIdx, periode) {
  if (dayIdx === 4) return periode === "PM" ? 3 : 4;   // Ven : 4h matin + 3h aprem
  return 4;
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
    s + (t.tempsEstimeH != null ? Number(t.tempsEstimeH) : demiJourneeHeures(dayIdx, cr?.periode)), 0);
}

function tacheValMonteur(cr, tacheId) {
  const m = cr?.validationMonteur?.[tacheId];
  if (m?.etat) return m.etat;
  if (tacheId === "t0" && cr?.etatValidationMonteur) return cr.etatValidationMonteur;
  return "NON";
}
function tacheValConducteur(cr, tacheId) {
  const c = cr?.validationConducteur?.[tacheId];
  if (c?.etat) return c.etat;
  if (tacheId === "t0" && cr?.etatValidationConducteur) return cr.etatValidationConducteur;
  return "NON";
}

function slotToCell(idx) {
  return { dayIdx: Math.floor(idx / 2), periode: idx % 2 === 0 ? "AM" : "PM" };
}
function creneauId(ressourceId, date, periode) {
  return `${ressourceId}_${date}_${periode}`;
}
function tacheBarKey(t) {
  return `${t.chantierId || ""}|${t.batiment || ""}|${t.posteAvancementKey || t.posteLabel || ""}`;
}
function rowSegments(resourceId, weekCols, creneauMap) {
  const nbSlots = weekCols.length * 2;
  const slots = [];
  for (let i = 0; i < nbSlots; i++) {
    const { dayIdx, periode } = slotToCell(i);
    slots.push(creneauMap.get(creneauId(resourceId, weekCols[dayIdx].iso, periode)) || null);
  }
  const segments = [];
  let i = 0;
  while (i < nbSlots) {
    const cr = slots[i];
    const taches = getCreneauTaches(cr);
    if (!taches.length) { segments.push({ kind: "empty", start: i, end: i }); i++; continue; }
    const { dayIdx } = slotToCell(i);
    if (taches.length > 1) {
      segments.push({
        kind: "bar", multi: true, start: i, end: i, count: taches.length,
        hours: creneauTotalHours(cr, dayIdx), chantierId: taches[0].chantierId || null, taches,
      });
      i++; continue;
    }
    const t0 = taches[0];
    const key = tacheBarKey(t0);
    let j = i, hours = 0;
    const creneaux = [];
    while (j < nbSlots) {
      const jt = getCreneauTaches(slots[j]);
      if (jt.length !== 1 || tacheBarKey(jt[0]) !== key) break;
      creneaux.push(slots[j]);
      const { dayIdx: jd } = slotToCell(j);
      hours += creneauTotalHours(slots[j], jd);
      j++;
    }
    segments.push({
      kind: "bar", start: i, end: j - 1,
      chantierId: t0.chantierId || null, batiment: t0.batiment || null,
      posteAvancementKey: t0.posteAvancementKey || null,
      posteLabel: t0.posteLabel || null,
      hours, creneaux, taches: [t0],
    });
    i = j;
  }
  return segments;
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
// legacy sans temps → demiJourneeHeures(dayIdx, periode)
eq(creneauTotalHours({ chantierId: "251234" }, 0), 4, "legacy sans temps lundi → 4");
// Vendredi : matin 4h, aprem 3h (7h/jour).
eq(creneauTotalHours({ chantierId: "251234", periode: "AM" }, 4), 4, "legacy sans temps vendredi matin → 4");
eq(creneauTotalHours({ chantierId: "251234", periode: "PM" }, 4), 3, "legacy sans temps vendredi aprem → 3");
// legacy avec temps explicite → ce temps
eq(creneauTotalHours({ chantierId: "251234", tempsEstimeH: 2 }, 0), 2, "legacy temps explicite → 2");
// multi-tâches → somme
eq(creneauTotalHours({ taches: [
  { id: "a", tempsEstimeH: 2 }, { id: "b", tempsEstimeH: 1.5 },
] }, 0), 3.5, "multi-tâches somme temps → 3,5");
// multi-tâches, une sans temps → fallback demi-journée (vendredi aprem = 3h)
eq(creneauTotalHours({ periode: "PM", taches: [
  { id: "a", tempsEstimeH: 2 }, { id: "b" },
] }, 4), 5, "multi-tâches fallback vendredi aprem → 2 + 3");
// slot vide → 0
eq(creneauTotalHours({}, 0), 0, "slot vide → 0");

console.log("rowSegments");
const WEEK = ["2026-07-06", "2026-07-07", "2026-07-08", "2026-07-09", "2026-07-10"]
  .map((iso) => ({ iso }));
const mapOf = (entries) => new Map(entries.map(([slot, cr]) => {
  const { dayIdx, periode } = slotToCell(slot);
  return [creneauId("r1", WEEK[dayIdx].iso, periode), cr];
}));

// (a) mono-tâche legacy sur 2 slots contigus même clé → 1 barre fusionnée, comme avant.
{
  const segs = rowSegments("r1", WEEK, mapOf([
    [0, { chantierId: "251234", batiment: "A", posteAvancementKey: "log-1", tempsEstimeH: 4 }],
    [1, { chantierId: "251234", batiment: "A", posteAvancementKey: "log-1", tempsEstimeH: 4 }],
  ]));
  const bar = segs.find((s) => s.kind === "bar");
  eq(
    { start: bar.start, end: bar.end, chantierId: bar.chantierId, poste: bar.posteAvancementKey, hours: bar.hours, multi: !!bar.multi, nbTaches: bar.taches.length },
    { start: 0, end: 1, chantierId: "251234", poste: "log-1", hours: 8, multi: false, nbTaches: 1 },
    "mono-tâche legacy contiguë → 1 barre fusionnée (identique à avant)",
  );
  eq(segs.filter((s) => s.kind === "empty").length, 8, "reste des slots → 8 empties");
}

// (b) taches[] à 2 sur un slot → 1 segment multi count=2, jamais fusionné.
{
  const segs = rowSegments("r1", WEEK, mapOf([
    [0, { chantierId: "251234", taches: [
      { id: "a", chantierId: "251234", tempsEstimeH: 2 },
      { id: "b", chantierId: "999999", tempsEstimeH: 1.5 },
    ] }],
  ]));
  const bar = segs.find((s) => s.kind === "bar");
  eq(
    { multi: !!bar.multi, count: bar.count, start: bar.start, end: bar.end, hours: bar.hours, chantierId: bar.chantierId },
    { multi: true, count: 2, start: 0, end: 0, hours: 3.5, chantierId: "251234" },
    "taches[] à 2 → segment multi count=2 (non fusionné)",
  );
}

// (c) tâche libre SANS chantier → 1 barre (plus "empty"), chantierId null.
{
  const segs = rowSegments("r1", WEEK, mapOf([
    [0, { chantierId: null, posteAvancementKey: null, posteLabel: "Formation SST" }],
  ]));
  const first = segs[0];
  eq(
    { kind: first.kind, chantierId: first.chantierId, posteLabel: first.posteLabel },
    { kind: "bar", chantierId: null, posteLabel: "Formation SST" },
    "tâche libre sans chantier → 1 barre (plus empty)",
  );
}

console.log("tacheValMonteur / tacheValConducteur");
// map présente → lit la map
eq(tacheValMonteur({ validationMonteur: { t5: { etat: "FAIT" } } }, "t5"), "FAIT", "map monteur présente → FAIT");
eq(tacheValConducteur({ validationConducteur: { t5: { etat: "VALIDE" } } }, "t5"), "VALIDE", "map conducteur présente → VALIDE");
// repli legacy t0 → champ plat de tête
eq(tacheValMonteur({ etatValidationMonteur: "FAIT" }, "t0"), "FAIT", "repli legacy t0 monteur → FAIT");
eq(tacheValConducteur({ etatValidationConducteur: "REFUSE" }, "t0"), "REFUSE", "repli legacy t0 conducteur → REFUSE");
// map prioritaire sur le plat pour t0
eq(tacheValMonteur({ etatValidationMonteur: "NON", validationMonteur: { t0: { etat: "FAIT" } } }, "t0"), "FAIT", "map t0 prioritaire sur plat");
// pas de repli plat pour un id != t0
eq(tacheValMonteur({ etatValidationMonteur: "FAIT" }, "t3"), "NON", "id != t0 sans map → NON (pas de repli plat)");
// défaut NON
eq(tacheValMonteur(null, "t0"), "NON", "cr null → NON");
eq(tacheValConducteur({}, "t9"), "NON", "aucune donnée → NON");

console.log("\n────────────────────────────────────────");
console.log(`Tests planningModel : ${ok} OK, ${ko} KO`);
if (ko > 0) process.exit(1);

// planningWrites.test.js — Tests purs (multi-tâches, écriture L3).
// Reproduction locale du cœur des builders (cleanTaches + primaryTache + miroir
// primaire), sans les dépendances Firestore/browser (serverTimestamp, planningModel).

function demiJourneeHeures(dayIdx) { return dayIdx === 4 ? 3.5 : 4; }
let seq = 0;
function makeTacheId() { return "gen" + (++seq); }

function cleanTaches(taches) {
  return (taches || []).map((t) => ({
    id: t.id || makeTacheId(),
    chantierId: t.chantierId || null,
    batiment: t.chantierId ? (t.batiment || null) : null,
    posteAvancementKey: t.chantierId ? (t.posteAvancementKey || null) : null,
    posteLabel: t.posteLabel || null,
    tempsEstimeH: (t.tempsEstimeH !== "" && t.tempsEstimeH != null) ? Number(t.tempsEstimeH) : null,
  })).filter((t) => t.chantierId || t.posteAvancementKey || t.posteLabel);
}
function primaryTache(clean) { return clean.find((t) => t.chantierId) || clean[0] || null; }

// Cœur commun du doc écrit (affecté ET pool) : taches[] + miroir primaire.
function docCore(taches, dayIdx) {
  const clean = cleanTaches(taches);
  const primary = primaryTache(clean);
  return {
    taches: clean,
    chantierId: primary?.chantierId || null,
    batiment: primary?.batiment || null,
    posteAvancementKey: primary?.posteAvancementKey || null,
    posteLabel: primary?.posteLabel || null,
    tempsEstimeH: primary ? (primary.tempsEstimeH ?? demiJourneeHeures(dayIdx)) : null,
  };
}

let ok = 0, ko = 0;
function eq(got, want, msg) {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g === w) { ok++; console.log(`  ✓ ${msg}`); }
  else { ko++; console.log(`  ✗ ${msg}\n     attendu ${w}\n     obtenu ${g}`); }
}

console.log("planningWrites — docCore");

// (1) 1 tâche → taches len 1 + miroir = cette tâche (byte-compat legacy mono).
{
  const d = docCore([{ id: "t0", chantierId: "251234", batiment: "A", posteAvancementKey: "log-1", posteLabel: "Logement", tempsEstimeH: 4 }], 0);
  eq(d, {
    taches: [{ id: "t0", chantierId: "251234", batiment: "A", posteAvancementKey: "log-1", posteLabel: "Logement", tempsEstimeH: 4 }],
    chantierId: "251234", batiment: "A", posteAvancementKey: "log-1", posteLabel: "Logement", tempsEstimeH: 4,
  }, "1 tâche → taches[1] + miroir = cette tâche");
}

// (1bis) 1 tâche sans temps → miroir tempsEstimeH = défaut demi-journée (vendredi 3,5).
{
  const d = docCore([{ id: "t0", chantierId: "251234", batiment: "A", posteAvancementKey: "log-1", posteLabel: "Logement" }], 4);
  eq({ tache: d.taches[0].tempsEstimeH, miroir: d.tempsEstimeH }, { tache: null, miroir: 3.5 },
    "1 tâche sans temps → tâche null, miroir = 3,5 (vendredi)");
}

// (2) 2 tâches (2 chantiers) → taches len 2, primary = 1re avec chantier, miroir = primary.
{
  const d = docCore([
    { id: "a", chantierId: "251234", batiment: "A", posteAvancementKey: "log-1", tempsEstimeH: 2 },
    { id: "b", chantierId: "999999", batiment: "B", posteAvancementKey: "cf-10", tempsEstimeH: 1.5 },
  ], 0);
  eq({ len: d.taches.length, chantierId: d.chantierId, poste: d.posteAvancementKey, temps: d.tempsEstimeH },
    { len: 2, chantierId: "251234", poste: "log-1", temps: 2 },
    "2 tâches → taches[2], miroir = 1re (chantier de tête)");
}

// (2bis) 1re sans chantier, 2e avec chantier → primary = 2e (1re avec chantier).
{
  const d = docCore([
    { id: "libre", posteLabel: "Formation" },
    { id: "b", chantierId: "251234", posteAvancementKey: "log-1", tempsEstimeH: 3 },
  ], 0);
  eq({ len: d.taches.length, chantierId: d.chantierId }, { len: 2, chantierId: "251234" },
    "primary = 1re AVEC chantier même si pas en tête de liste");
}

// (3) 1 tâche libre sans chantier → chantierId de tête null, posteLabel de tête = la libre.
{
  const d = docCore([{ id: "t0", posteLabel: "Formation SST" }], 0);
  eq({ chantierId: d.chantierId, batiment: d.batiment, poste: d.posteAvancementKey, posteLabel: d.posteLabel, len: d.taches.length },
    { chantierId: null, batiment: null, poste: null, posteLabel: "Formation SST", len: 1 },
    "tâche libre sans chantier → miroir chantierId null, posteLabel = libre");
}

// (4) lignes vides filtrées.
{
  const d = docCore([
    { id: "vide1" },
    { id: "vide2", chantierId: "", posteAvancementKey: "", posteLabel: "" },
    { id: "ok", chantierId: "251234", posteAvancementKey: "log-1" },
  ], 0);
  eq({ len: d.taches.length, id: d.taches[0].id }, { len: 1, id: "ok" }, "lignes vides filtrées");
}

// (5) tâche libre : batiment/poste forcés à null (pas de chantier).
{
  const d = docCore([{ id: "t0", chantierId: null, batiment: "A", posteAvancementKey: "log-1", posteLabel: "Libre" }], 0);
  eq({ bat: d.taches[0].batiment, poste: d.taches[0].posteAvancementKey, label: d.taches[0].posteLabel },
    { bat: null, poste: null, label: "Libre" }, "sans chantier → batiment/poste null, label conservé");
}

console.log("\n────────────────────────────────────────");
console.log(`Tests planningWrites : ${ok} OK, ${ko} KO`);
if (ko > 0) process.exit(1);

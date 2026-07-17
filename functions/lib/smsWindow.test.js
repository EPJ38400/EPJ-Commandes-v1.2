// smsWindow.test.js — Tests purs (fenêtre horaire SMS). Importe le module réel.
import {
  DEFAULT_FENETRE, joursFeriesFrance, estDansFenetre, prochaineOuverture,
} from "./smsWindow.js";

let pass = 0, fail = 0;
function assertEq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log("✓ " + label); pass++; }
  else { console.error("✗ " + label + "\n  attendu: " + JSON.stringify(expected) + "\n  recu:    " + JSON.stringify(actual)); fail++; }
}

// ─── Jours fériés France 2026 ─────────────────────────────────
const f2026 = joursFeriesFrance(2026);
assertEq(f2026.has("2026-01-01"), true, "férié : Jour de l'an");
assertEq(f2026.has("2026-04-06"), true, "férié : Lundi de Pâques 2026 (Pâques = 05/04)");
assertEq(f2026.has("2026-05-14"), true, "férié : Ascension 2026");
assertEq(f2026.has("2026-05-25"), true, "férié : Lundi de Pentecôte 2026");
assertEq(f2026.has("2026-07-14"), true, "férié : Fête nationale");
assertEq(f2026.has("2026-12-25"), true, "férié : Noël");
assertEq(f2026.has("2026-07-15"), false, "non férié : 15 juillet");

// ─── estDansFenetre (défaut 8-17, lun-ven, hors fériés) ───────
// 2026-07-15 (mercredi) 10:00 Paris (été, UTC+2) = 08:00 UTC
assertEq(estDansFenetre(new Date("2026-07-15T08:00:00Z"), DEFAULT_FENETRE), true, "mercredi 10h → dans la fenêtre");
// 2026-07-17 (vendredi) 02:49 Paris = 00:49 UTC (scénario bug prod)
assertEq(estDansFenetre(new Date("2026-07-17T00:49:00Z"), DEFAULT_FENETRE), false, "vendredi 02:49 → hors fenêtre");
// 2026-07-15 17:30 Paris = 15:30 UTC → après heureFin
assertEq(estDansFenetre(new Date("2026-07-15T15:30:00Z"), DEFAULT_FENETRE), false, "mercredi 17:30 → hors fenêtre");
// 2026-07-19 (dimanche) 10:00 Paris = 08:00 UTC
assertEq(estDansFenetre(new Date("2026-07-19T08:00:00Z"), DEFAULT_FENETRE), false, "dimanche → hors fenêtre");
// 2026-07-14 (mardi, férié) 10:00 Paris
assertEq(estDansFenetre(new Date("2026-07-14T08:00:00Z"), DEFAULT_FENETRE), false, "férié → hors fenêtre");

// ─── prochaineOuverture ───────────────────────────────────────
// Vendredi 02:49 → même jour 08:00 Paris (= 06:00 UTC été)
assertEq(
  prochaineOuverture(new Date("2026-07-17T00:49:00Z"), DEFAULT_FENETRE).toISOString(),
  "2026-07-17T06:00:00.000Z",
  "ouverture : vendredi 02:49 → vendredi 08:00"
);
// Vendredi 18:00 Paris (16:00 UTC) → lundi 08:00 (2026-07-20)
assertEq(
  prochaineOuverture(new Date("2026-07-17T16:00:00Z"), DEFAULT_FENETRE).toISOString(),
  "2026-07-20T06:00:00.000Z",
  "ouverture : vendredi soir → lundi 08:00"
);
// Mardi férié (14/07) 10:00 → mercredi 15/07 08:00
assertEq(
  prochaineOuverture(new Date("2026-07-14T08:00:00Z"), DEFAULT_FENETRE).toISOString(),
  "2026-07-15T06:00:00.000Z",
  "ouverture : 14 juillet (férié) → 15 juillet 08:00"
);
// Déjà dans la fenêtre → renvoie l'instant tel quel
{
  const d = new Date("2026-07-15T08:00:00Z");
  assertEq(prochaineOuverture(d, DEFAULT_FENETRE).getTime(), d.getTime(), "ouverture : déjà dans la fenêtre → inchangé");
}

console.log("\n────────────────────────────────────────");
console.log("Tests smsWindow : " + pass + " OK, " + fail + " KO");
if (fail > 0) process.exit(1);

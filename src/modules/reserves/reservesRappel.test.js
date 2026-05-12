// reservesRappel.test.js v10.N — Tests purs

function parseReserveDate(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function isReserveActive(reserve) {
  if (!reserve) return false;
  const closedStatuses = ["levee", "quitus_signe", "cloturee", "partiellement_levee"];
  if (closedStatuses.includes(reserve.statut)) return false;
  if (!reserve.affecteAUserId) return false;
  return true;
}

function getDateRefLevee(reserve) {
  if (!reserve) return null;
  return reserve.dateSouhaiteLevee || reserve.dateLevee || null;
}

function daysOverdue(reserve, today) {
  const d = parseReserveDate(getDateRefLevee(reserve));
  if (!d) return null;
  const ref = today || new Date();
  const todayUTC = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const diffMs = todayUTC - d.getTime();
  return Math.floor(diffMs / 86400000);
}

function shouldSendRappelLevee(reserve, today) {
  if (!isReserveActive(reserve)) return false;
  if (reserve.smsRappelRetardSent === true) return false;
  const d = daysOverdue(reserve, today);
  if (d === null) return false;
  return d >= 0;
}

function isPrivilegedReserves(user) {
  if (!user || typeof user !== "object") return false;
  const roles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
  if (roles.includes("Admin") || roles.includes("Direction")) return true;
  if (user.fonction === "Admin" || user.fonction === "Direction") return true;
  if (roles.includes("Conducteur travaux") || user.fonction === "Conducteur travaux") return true;
  if (user.responsableParc === true) return true;
  return false;
}

function canDemanderLevee(reserve, user) {
  if (!reserve || !user) return false;
  if (!isReserveActive(reserve)) return false;
  return isPrivilegedReserves(user);
}

function buildTransfertPayload(reserve, newAffecteUserId, newAffecteUserNom, transfereParUser) {
  return {
    affecteAUserId: newAffecteUserId || "",
    affecteANom: newAffecteUserNom || "",
    dateAffectation: new Date().toISOString(),
    transfereParId: transfereParUser ? (transfereParUser._id || transfereParUser.id || "") : "",
    transfereParNom: transfereParUser ? ((transfereParUser.prenom||"")+" "+(transfereParUser.nom||"")).trim() : "",
    smsRappelRetardSent: false,
    smsRappelRetardSentAt: null,
  };
}

let pass = 0, fail = 0;
function assertEq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log("✓ " + label); pass++; }
  else { console.error("✗ " + label + "\n  attendu: " + JSON.stringify(expected) + "\n  recu:    " + JSON.stringify(actual)); fail++; }
}
function assertTrue(a, l) { assertEq(!!a, true, l); }
function assertFalse(a, l) { assertEq(!!a, false, l); }

const today = new Date(Date.UTC(2026, 4, 12)); // 12 mai 2026

// ─── parseReserveDate ───────────────────────────────
assertEq(parseReserveDate("2026-05-15")?.toISOString().slice(0,10), "2026-05-15", "parse ISO");
assertEq(parseReserveDate("15/05/2026")?.toISOString().slice(0,10), "2026-05-15", "parse FR");
assertEq(parseReserveDate(""), null, "vide");
assertEq(parseReserveDate(null), null, "null");

// ─── isReserveActive ────────────────────────────────
assertTrue(isReserveActive({ statut: "attribuee", affecteAUserId: "u1" }), "attribuée+affectée → active");
assertTrue(isReserveActive({ statut: "planifiee", affecteAUserId: "u1" }), "planifiée → active");
assertTrue(isReserveActive({ statut: "intervention", affecteAUserId: "u1" }), "intervention → active");
assertFalse(isReserveActive({ statut: "levee", affecteAUserId: "u1" }), "levée → non active");
assertFalse(isReserveActive({ statut: "quitus_signe", affecteAUserId: "u1" }), "quitus_signe → non");
assertFalse(isReserveActive({ statut: "cloturee", affecteAUserId: "u1" }), "cloturee → non");
assertFalse(isReserveActive({ statut: "attribuee" }), "pas affectée → non");
assertFalse(isReserveActive(null), "null → non");

// ─── daysOverdue ────────────────────────────────────
assertEq(daysOverdue({ dateSouhaiteLevee: "2026-05-12" }, today), 0, "today → 0");
assertEq(daysOverdue({ dateSouhaiteLevee: "2026-05-10" }, today), 2, "J+2");
assertEq(daysOverdue({ dateSouhaiteLevee: "2026-05-20" }, today), -8, "futur");
assertEq(daysOverdue({}, today), null, "pas de date → null");

// ─── shouldSendRappelLevee ──────────────────────────
{
  const r = { statut: "attribuee", affecteAUserId: "u1", dateSouhaiteLevee: "2026-05-10" };
  assertTrue(shouldSendRappelLevee(r, today), "active + dépassée + pas envoyé → OUI");
}
{
  const r = { statut: "attribuee", affecteAUserId: "u1", dateSouhaiteLevee: "2026-05-10", smsRappelRetardSent: true };
  assertFalse(shouldSendRappelLevee(r, today), "déjà envoyé → NON");
}
{
  const r = { statut: "levee", affecteAUserId: "u1", dateSouhaiteLevee: "2026-05-10" };
  assertFalse(shouldSendRappelLevee(r, today), "réserve levée → NON");
}
{
  const r = { statut: "attribuee", affecteAUserId: "u1", dateSouhaiteLevee: "2026-05-20" };
  assertFalse(shouldSendRappelLevee(r, today), "date future → NON");
}
{
  const r = { statut: "attribuee", dateSouhaiteLevee: "2026-05-10" }; // pas d'attribution
  assertFalse(shouldSendRappelLevee(r, today), "pas attribuée → NON");
}
// Date pile aujourd'hui = J → envoi (d >= 0)
{
  const r = { statut: "attribuee", affecteAUserId: "u1", dateSouhaiteLevee: "2026-05-12" };
  assertTrue(shouldSendRappelLevee(r, today), "date = today → OUI (J)");
}

// ─── isPrivilegedReserves ───────────────────────────
assertTrue(isPrivilegedReserves({ roles: ["Admin"] }), "Admin");
assertTrue(isPrivilegedReserves({ roles: ["Direction"] }), "Direction");
assertTrue(isPrivilegedReserves({ fonction: "Conducteur travaux" }), "Conducteur travaux");
assertTrue(isPrivilegedReserves({ responsableParc: true, roles: ["Monteur"] }), "responsableParc=true");
assertFalse(isPrivilegedReserves({ roles: ["Monteur"] }), "Monteur seul → NON");
assertFalse(isPrivilegedReserves(null), "null → NON");

// ─── canDemanderLevee ───────────────────────────────
{
  const r = { statut: "attribuee", affecteAUserId: "u1" };
  assertTrue(canDemanderLevee(r, { roles: ["Admin"] }), "Admin sur active → OUI");
  assertFalse(canDemanderLevee(r, { roles: ["Monteur"] }), "Monteur sur active → NON");
  assertFalse(canDemanderLevee({ statut: "levee" }, { roles: ["Admin"] }), "Admin sur levée → NON");
}

// ─── buildTransfertPayload ──────────────────────────
{
  const p = buildTransfertPayload(
    { affecteAUserId: "u1", smsRappelRetardSent: true },
    "u2", "Pierre DUPONT",
    { _id: "uX", prenom: "PJ", nom: "YVER" }
  );
  assertEq(p.affecteAUserId, "u2", "nouvel affecté");
  assertEq(p.affecteANom, "Pierre DUPONT", "nouveau nom");
  assertEq(p.transfereParId, "uX", "transferé par ID");
  assertEq(p.transfereParNom, "PJ YVER", "transferé par nom");
  assertEq(p.smsRappelRetardSent, false, "reset flag rappel");
  assertEq(p.smsRappelRetardSentAt, null, "reset timestamp");
  assertTrue(p.dateAffectation, "dateAffectation présente");
}

console.log("\n────────────────────────────────────────");
console.log("Tests reservesRappel v10.N : " + pass + " OK, " + fail + " KO");
if (fail > 0) process.exit(1);

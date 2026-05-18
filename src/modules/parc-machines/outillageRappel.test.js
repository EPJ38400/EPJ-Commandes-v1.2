// outillageRappel.test.js v10.K — Tests purs

// Reproduction locale des helpers
function parseSortieDate(raw) {
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

function daysOverdue(dueRaw, today) {
  const due = parseSortieDate(dueRaw);
  if (!due) return null;
  const ref = today || new Date();
  const todayUTC = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const diffMs = todayUTC - due.getTime();
  return Math.floor(diffMs / 86400000);
}

function isSortieActive(sortie) {
  if (!sortie) return false;
  if (sortie.dateRetourReelle) return false;
  if (sortie.etatRetour) return false;
  return true;
}

function shouldSendRappelJ(sortie, today) {
  if (!isSortieActive(sortie)) return false;
  if (sortie.smsRappelJSent === true) return false;
  const d = daysOverdue(sortie.dateRetourPrevue, today);
  if (d === null) return false;
  return d >= 0;
}

function shouldFlagAnomalieJ2(sortie, today) {
  if (!isSortieActive(sortie)) return false;
  if (sortie.anomalieJ2 === true) return false;
  const d = daysOverdue(sortie.dateRetourPrevue, today);
  if (d === null) return false;
  return d >= 2;
}

function isPrivilegedParc(user) {
  if (!user || typeof user !== "object") return false;
  const roles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
  if (roles.includes("Admin") || roles.includes("Direction")) return true;
  if (user.fonction === "Admin" || user.fonction === "Direction") return true;
  if (user.responsableParc === true) return true;
  return false;
}

function canProlonger(sortie, user) {
  if (!sortie || !user) return false;
  if (!isSortieActive(sortie)) return false;
  if (isPrivilegedParc(user)) return true;
  return sortie.prolonge !== true;
}

function canDemanderRetour(sortie, user) {
  if (!sortie || !user) return false;
  if (!isSortieActive(sortie)) return false;
  return isPrivilegedParc(user);
}

function computeProlongedDate(sortie, daysToAdd) {
  const cur = parseSortieDate(sortie && sortie.dateRetourPrevue);
  if (!cur) return null;
  const n = Number(daysToAdd) || 7;
  const next = new Date(cur.getTime() + n * 86400000);
  const yyyy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return yyyy + "-" + mm + "-" + dd;
}

function buildProlongationPayload(sortie, user, opts) {
  const o = opts || {};
  const newDate = computeProlongedDate(sortie, o.days || 7);
  if (!newDate) throw new Error("Date prevue invalide");
  return {
    dateRetourPrevue: newDate,
    dateRetourPrevueOriginale: sortie.dateRetourPrevueOriginale || sortie.dateRetourPrevue,
    prolonge: true,
    dateProlongation: new Date().toISOString(),
    prolongeParId: (user && (user._id || user.id)) || "",
    prolongeParNom: user ? ((user.prenom || "") + " " + (user.nom || "")).trim() : "",
    smsRappelJSent: false,
    smsRappelJSentAt: null,
    anomalieJ2: false,
  };
}

let pass = 0, fail = 0;
function assertEq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log("✓ " + label); pass++; }
  else { console.error("✗ " + label + "\n  attendu: " + JSON.stringify(expected) + "\n  recu:    " + JSON.stringify(actual)); fail++; }
}

const today = new Date(Date.UTC(2026, 4, 11)); // 11 mai 2026

// ─── parseSortieDate ──────────────────────────────────────────
assertEq(parseSortieDate("2026-05-15") && parseSortieDate("2026-05-15").toISOString().slice(0,10), "2026-05-15", "parseSortieDate ISO");
assertEq(parseSortieDate("15/05/2026") && parseSortieDate("15/05/2026").toISOString().slice(0,10), "2026-05-15", "parseSortieDate FR");
assertEq(parseSortieDate(""), null, "parseSortieDate vide");
assertEq(parseSortieDate(null), null, "parseSortieDate null");

// ─── daysOverdue ──────────────────────────────────────────────
assertEq(daysOverdue("2026-05-11", today), 0, "daysOverdue: due = today → 0");
assertEq(daysOverdue("2026-05-10", today), 1, "daysOverdue: J+1");
assertEq(daysOverdue("2026-05-09", today), 2, "daysOverdue: J+2");
assertEq(daysOverdue("2026-05-15", today), -4, "daysOverdue: futur → négatif");
assertEq(daysOverdue(null, today), null, "daysOverdue: date null → null");

// ─── isSortieActive ──────────────────────────────────────────
assertEq(isSortieActive({ dateRetourPrevue: "2026-05-10" }), true, "active: pas rendu");
assertEq(isSortieActive({ dateRetourReelle: "2026-05-08" }), false, "active: retourné → non");
assertEq(isSortieActive({ etatRetour: "ok" }), false, "active: etatRetour → non");
assertEq(isSortieActive(null), false, "active: null → non");

// ─── shouldSendRappelJ ────────────────────────────────────────
// Cas 1 : pas rendu, date dépassée, jamais envoyé → OUI
{
  const s = { dateRetourPrevue: "2026-05-10" };
  assertEq(shouldSendRappelJ(s, today), true, "rappel: dépassée 1j + pas envoyé → OUI");
}
// Cas 2 : déjà envoyé → NON
{
  const s = { dateRetourPrevue: "2026-05-10", smsRappelJSent: true };
  assertEq(shouldSendRappelJ(s, today), false, "rappel: déjà envoyé → NON");
}
// Cas 3 : date pile aujourd'hui → OUI (d >= 0)
{
  const s = { dateRetourPrevue: "2026-05-11" };
  assertEq(shouldSendRappelJ(s, today), true, "rappel: due = today → OUI (J)");
}
// Cas 4 : date future → NON
{
  const s = { dateRetourPrevue: "2026-05-15" };
  assertEq(shouldSendRappelJ(s, today), false, "rappel: future → NON");
}
// Cas 5 : déjà retourné → NON
{
  const s = { dateRetourPrevue: "2026-05-10", dateRetourReelle: "2026-05-09" };
  assertEq(shouldSendRappelJ(s, today), false, "rappel: déjà retourné → NON");
}
// Cas 6 : pas de date prévue → NON
{
  const s = {};
  assertEq(shouldSendRappelJ(s, today), false, "rappel: pas de date → NON");
}

// ─── shouldFlagAnomalieJ2 ─────────────────────────────────────
{
  const s = { dateRetourPrevue: "2026-05-09" };
  assertEq(shouldFlagAnomalieJ2(s, today), true, "anomalie: J+2 → OUI");
}
{
  const s = { dateRetourPrevue: "2026-05-10" };
  assertEq(shouldFlagAnomalieJ2(s, today), false, "anomalie: J+1 seulement → NON");
}
{
  const s = { dateRetourPrevue: "2026-05-09", anomalieJ2: true };
  assertEq(shouldFlagAnomalieJ2(s, today), false, "anomalie: déjà flaggée → NON");
}
{
  const s = { dateRetourPrevue: "2026-05-07" };
  assertEq(shouldFlagAnomalieJ2(s, today), true, "anomalie: J+4 → OUI");
}

// ─── isPrivilegedParc ─────────────────────────────────────────
assertEq(isPrivilegedParc({ roles: ["Admin"] }), true, "privileged: Admin roles");
assertEq(isPrivilegedParc({ roles: ["Direction"] }), true, "privileged: Direction roles");
assertEq(isPrivilegedParc({ fonction: "Admin" }), true, "privileged: fonction Admin");
assertEq(isPrivilegedParc({ responsableParc: true, roles: ["Monteur"] }), true, "privileged: responsableParc=true");
assertEq(isPrivilegedParc({ roles: ["Monteur"] }), false, "privileged: monteur seul → NON");
assertEq(isPrivilegedParc({ roles: ["Conducteur travaux"] }), false, "privileged: conducteur seul → NON");
assertEq(isPrivilegedParc(null), false, "privileged: null → NON");

// ─── canProlonger ─────────────────────────────────────────────
// Cas : monteur lambda, sortie non encore prolongée → OUI
{
  const s = { dateRetourPrevue: "2026-05-15" };
  const u = { roles: ["Monteur"] };
  assertEq(canProlonger(s, u), true, "prolonger: monteur 1ère fois → OUI");
}
// Cas : monteur lambda, deja prolongée → NON
{
  const s = { dateRetourPrevue: "2026-05-15", prolonge: true };
  const u = { roles: ["Monteur"] };
  assertEq(canProlonger(s, u), false, "prolonger: monteur 2e fois → NON");
}
// Cas : Admin, déjà prolongée → OUI (peut re-prolonger)
{
  const s = { dateRetourPrevue: "2026-05-15", prolonge: true };
  const u = { roles: ["Admin"] };
  assertEq(canProlonger(s, u), true, "prolonger: Admin peut re-prolonger");
}
// Cas : responsableParc, déjà prolongée → OUI
{
  const s = { dateRetourPrevue: "2026-05-15", prolonge: true };
  const u = { roles: ["Monteur"], responsableParc: true };
  assertEq(canProlonger(s, u), true, "prolonger: responsable parc peut re-prolonger");
}
// Cas : sortie déjà retournée → NON même Admin
{
  const s = { dateRetourPrevue: "2026-05-15", dateRetourReelle: "2026-05-10" };
  const u = { roles: ["Admin"] };
  assertEq(canProlonger(s, u), false, "prolonger: sortie retournée → NON");
}

// ─── canDemanderRetour ────────────────────────────────────────
{
  const s = { dateRetourPrevue: "2026-05-15" };
  assertEq(canDemanderRetour(s, { roles: ["Admin"] }), true, "demander retour: Admin OUI");
  assertEq(canDemanderRetour(s, { roles: ["Direction"] }), true, "demander retour: Direction OUI");
  assertEq(canDemanderRetour(s, { responsableParc: true, roles: ["Monteur"] }), true, "demander retour: resp parc OUI");
  assertEq(canDemanderRetour(s, { roles: ["Monteur"] }), false, "demander retour: monteur NON");
  assertEq(canDemanderRetour(s, { roles: ["Conducteur travaux"] }), false, "demander retour: conducteur NON");
}

// ─── computeProlongedDate ────────────────────────────────────
assertEq(computeProlongedDate({ dateRetourPrevue: "2026-05-10" }, 7), "2026-05-17", "prolong +7j ISO");
assertEq(computeProlongedDate({ dateRetourPrevue: "2026-05-25" }, 7), "2026-06-01", "prolong franchit mois");
assertEq(computeProlongedDate({ dateRetourPrevue: "2026-12-28" }, 7), "2027-01-04", "prolong franchit année");
assertEq(computeProlongedDate({ dateRetourPrevue: "bad" }, 7), null, "prolong date invalide → null");

// ─── buildProlongationPayload ────────────────────────────────
{
  const s = { dateRetourPrevue: "2026-05-10", smsRappelJSent: true, anomalieJ2: true };
  const u = { _id: "uid123", prenom: "PJ", nom: "YVER" };
  const p = buildProlongationPayload(s, u, { days: 7 });
  assertEq(p.dateRetourPrevue, "2026-05-17", "payload: nouvelle date +7j");
  assertEq(p.dateRetourPrevueOriginale, "2026-05-10", "payload: date originale conservée");
  assertEq(p.prolonge, true, "payload: prolonge=true");
  assertEq(p.prolongeParId, "uid123", "payload: prolongeParId");
  assertEq(p.prolongeParNom, "PJ YVER", "payload: prolongeParNom");
  assertEq(p.smsRappelJSent, false, "payload: reset smsRappelJSent");
  assertEq(p.anomalieJ2, false, "payload: reset anomalieJ2");
}
// Cas : prolongation 2e fois → on garde la date ORIGINALE de la 1ère sortie
{
  const s = { dateRetourPrevue: "2026-05-17", dateRetourPrevueOriginale: "2026-05-10", prolonge: true };
  const u = { _id: "uid123", prenom: "PJ", nom: "YVER" };
  const p = buildProlongationPayload(s, u);
  assertEq(p.dateRetourPrevueOriginale, "2026-05-10", "payload 2e prolong: garde originale");
  assertEq(p.dateRetourPrevue, "2026-05-24", "payload 2e prolong: +7j depuis la prolongée");
}

console.log("\n────────────────────────────────────────");
console.log("Tests outillageRappel v10.K : " + pass + " OK, " + fail + " KO");
if (fail > 0) process.exit(1);

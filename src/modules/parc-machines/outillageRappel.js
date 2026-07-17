// outillageRappel.js v10.K — Logique PURE de rappel retour outil.
// Aucun side-effect : pas de Firestore, pas de Date.now() implicite.
//
// Règles métier :
//   1. SMS de rappel envoyé à J (date prévue dépassée, strict).
//   2. SMS unique par sortie (idempotence via flag smsRappelJSent).
//   3. Si à J+2 toujours pas rendu, marquer l'anomalie pour le Dashboard.
//   4. Si l'utilisateur prolonge (+7j), on RESET smsRappelJSent et anomalieJ2.
//      Si la nouvelle date est à son tour dépassée, le cycle redémarre.

export function parseSortieDate(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  // ISO YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  // FR DD/MM/YYYY
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

// Combien de jours d'écart entre `today` et `due` (positif = en retard).
// Comparaison au niveau jour, pas heure.
export function daysOverdue(dueRaw, today) {
  const due = parseSortieDate(dueRaw);
  if (!due) return null;
  const ref = today || new Date();
  const todayUTC = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const diffMs = todayUTC - due.getTime();
  return Math.floor(diffMs / 86400000);
}

// Une sortie est "active" si pas encore retournee
export function isSortieActive(sortie) {
  if (!sortie) return false;
  if (sortie.dateRetourReelle) return false;
  if (sortie.etatRetour) return false;
  return true;
}

// Doit-on declencher le SMS de rappel J ?
// - sortie active
// - date prévue strictement dépassée
// - SMS pas déjà envoyé (idempotence)
export function shouldSendRappelJ(sortie, today) {
  if (!isSortieActive(sortie)) return false;
  if (sortie.smsRappelJSent === true) return false;
  const d = daysOverdue(sortie.dateRetourPrevue, today);
  if (d === null) return false;
  return d >= 0;
}

// Doit-on flagger l'anomalie Dashboard J+2 ?
// - sortie active
// - date prevue dépassée d'au moins 2 jours
// - flag pas déjà posé
export function shouldFlagAnomalieJ2(sortie, today) {
  if (!isSortieActive(sortie)) return false;
  if (sortie.anomalieJ2 === true) return false;
  const d = daysOverdue(sortie.dateRetourPrevue, today);
  if (d === null) return false;
  return d >= 2;
}

// L'utilisateur a-t-il le droit de prolonger ?
//   - Toujours OUI pour Admin, Direction, responsable parc
//   - Pour les autres : seulement si sortie.prolonge !== true
export function canProlonger(sortie, user) {
  if (!sortie || !user) return false;
  if (!isSortieActive(sortie)) return false;
  if (isPrivilegedParc(user)) return true;
  return sortie.prolonge !== true;
}

// L'utilisateur peut-il déclencher "Demander le retour" ?
// = Admin, Direction, responsable parc uniquement
export function canDemanderRetour(sortie, user) {
  if (!sortie || !user) return false;
  if (!isSortieActive(sortie)) return false;
  return isPrivilegedParc(user);
}

// Identification des roles privilegies parc
export function isPrivilegedParc(user) {
  if (!user || typeof user !== "object") return false;
  const roles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
  if (roles.includes("Admin") || roles.includes("Direction")) return true;
  if (user.fonction === "Admin" || user.fonction === "Direction") return true;
  if (user.responsableParc === true) return true;
  return false;
}

// Calcule la nouvelle date de retour apres prolongation +7 jours.
// Repart de la date prevue actuelle (pas de today).
// Retourne null si la date prevue est invalide.
export function computeProlongedDate(sortie, daysToAdd) {
  const cur = parseSortieDate(sortie?.dateRetourPrevue);
  if (!cur) return null;
  const n = Number(daysToAdd) || 7;
  const next = new Date(cur.getTime() + n * 86400000);
  // Format ISO YYYY-MM-DD
  const yyyy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(next.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Construit le patch Firestore (champs scalaires) pour une prolongation.
//   - opts.newDate : date cible explicite (ISO YYYY-MM-DD) → prolongation libre.
//   - sinon opts.days (défaut 7) → raccourci « +N jours » depuis la date prévue.
// Reset smsRappelJSent et anomalieJ2 (nouveau cycle si la nouvelle date passe).
export function buildProlongationPayload(sortie, user, opts) {
  const o = opts || {};
  const newDate = o.newDate || computeProlongedDate(sortie, o.days || 7);
  if (!newDate || !parseSortieDate(newDate)) throw new Error("Date prevue invalide");
  return {
    dateRetourPrevue: newDate,
    dateRetourPrevueOriginale: sortie.dateRetourPrevueOriginale || sortie.dateRetourPrevue,
    prolonge: true,
    dateProlongation: new Date().toISOString(),
    prolongeParId: user?._id || user?.id || "",
    prolongeParNom: user ? ((user.prenom || "") + " " + (user.nom || "")).trim() : "",
    // Reset des flags de notification : nouveau cycle
    smsRappelJSent: false,
    smsRappelJSentAt: null,
    anomalieJ2: false,
  };
}

// Formate un objet Date (UTC) en ISO YYYY-MM-DD.
function toISODate(d) {
  if (!d || isNaN(d.getTime())) return null;
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Date minimale autorisée pour une prolongation libre (ISO) :
// max(aujourd'hui, date de sortie). todayISO = date du jour (ISO).
export function prolongationMinDateISO(sortie, todayISO) {
  const today = parseSortieDate(todayISO) || new Date(Date.UTC(1970, 0, 1));
  const sortieDate = parseSortieDate(sortie && sortie.dateSortie);
  const min = (sortieDate && sortieDate.getTime() > today.getTime()) ? sortieDate : today;
  return toISODate(min);
}

// Valide une date de prolongation libre. Retourne { ok, error }.
export function validateProlongation(sortie, newDateISO, todayISO) {
  const nd = parseSortieDate(newDateISO);
  if (!nd) return { ok: false, error: "Date invalide." };
  const minISO = prolongationMinDateISO(sortie, todayISO);
  const min = parseSortieDate(minISO);
  if (min && nd.getTime() < min.getTime()) {
    return { ok: false, error: "Date antérieure à aujourd'hui — refusée." };
  }
  return { ok: true, error: null };
}

// Construit UNE entrée d'historique de prolongation (élément du tableau
// additif `prolongations[]`). `le` est fourni par l'appelant (Timestamp).
export function buildProlongationEntry(sortie, user, newDateISO, le) {
  return {
    ancienneDate: (sortie && sortie.dateRetourPrevue) || null,
    nouvelleDate: newDateISO,
    par: (user && (user._id || user.id)) || "",
    parNom: user ? ((user.prenom || "") + " " + (user.nom || "")).trim() : "",
    le: le || null,
  };
}

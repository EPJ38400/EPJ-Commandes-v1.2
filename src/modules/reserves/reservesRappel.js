// ═══════════════════════════════════════════════════════════════
//  reservesRappel.js — v10.N
//  Helpers PURS pour rappel SMS de levée de réserve.
//
//  Décisions PJY :
//  - Pas de SMS à la création (Point 1 = A)
//  - SMS uniquement à l'attribution + rappel auto si retard + rappel manuel
//  - Le SMS de retard part au destinataire COURANT (qui peut avoir changé via transfert)
//  - Watcher : 5 min, 1 SMS unique par cycle, reset si la date est repoussée
// ═══════════════════════════════════════════════════════════════

export function parseReserveDate(raw) {
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

// Une réserve est "active" si :
//   - pas encore levée (statut != levee / quitus_signe / cloturee)
//   - attribuée à quelqu'un (affecteAUserId présent)
export function isReserveActive(reserve) {
  if (!reserve) return false;
  const closedStatuses = ["levee", "quitus_signe", "cloturee", "partiellement_levee"];
  if (closedStatuses.includes(reserve.statut)) return false;
  if (!reserve.affecteAUserId) return false;
  return true;
}

// La date de référence pour le rappel est dateSouhaiteLevee
// (renseignée à la création — délai de levée souhaité).
export function getDateRefLevee(reserve) {
  if (!reserve) return null;
  return reserve.dateSouhaiteLevee || reserve.dateLevee || null;
}

export function daysOverdue(reserve, today) {
  const d = parseReserveDate(getDateRefLevee(reserve));
  if (!d) return null;
  const ref = today || new Date();
  const todayUTC = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const diffMs = todayUTC - d.getTime();
  return Math.floor(diffMs / 86400000);
}

// Doit-on envoyer le SMS de rappel maintenant ?
//   - réserve active
//   - date dépassée (au moins 0 jour, donc J)
//   - flag pas encore posé (idempotence)
export function shouldSendRappelLevee(reserve, today) {
  if (!isReserveActive(reserve)) return false;
  if (reserve.smsRappelRetardSent === true) return false;
  const d = daysOverdue(reserve, today);
  if (d === null) return false;
  return d >= 0;
}

// Rôles privilégiés pour le rappel manuel + transfert :
// Admin + Direction + responsableParc (alignement avec parc machines v10.K).
export function isPrivilegedReserves(user) {
  if (!user || typeof user !== "object") return false;
  const roles = Array.isArray(user.roles) ? user.roles : (user.role ? [user.role] : []);
  if (roles.includes("Admin") || roles.includes("Direction")) return true;
  if (user.fonction === "Admin" || user.fonction === "Direction") return true;
  // Conducteur travaux a aussi le droit (c'est lui qui pilote)
  if (roles.includes("Conducteur travaux") || user.fonction === "Conducteur travaux") return true;
  if (user.responsableParc === true) return true;
  return false;
}

// Bouton "Demander la levée" : visible si user privilégié ET réserve active
export function canDemanderLevee(reserve, user) {
  if (!reserve || !user) return false;
  if (!isReserveActive(reserve)) return false;
  return isPrivilegedReserves(user);
}

// Détecte un changement d'attribution → reset des flags de notification
// (pour que le nouveau destinataire soit re-notifié à son tour si retard)
export function buildTransfertPayload(reserve, newAffecteUserId, newAffecteUserNom, transfereParUser) {
  return {
    affecteAUserId: newAffecteUserId || "",
    affecteANom: newAffecteUserNom || "",
    dateAffectation: new Date().toISOString(),
    transfereParId: transfereParUser ? (transfereParUser._id || transfereParUser.id || "") : "",
    transfereParNom: transfereParUser ? ((transfereParUser.prenom||"")+" "+(transfereParUser.nom||"")).trim() : "",
    // Reset du flag de rappel : si la nouvelle attribution dépasse le délai,
    // le nouveau destinataire sera notifié.
    smsRappelRetardSent: false,
    smsRappelRetardSentAt: null,
  };
}

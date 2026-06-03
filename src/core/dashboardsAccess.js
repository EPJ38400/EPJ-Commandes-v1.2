// ═══════════════════════════════════════════════════════════════
//  dashboardsAccess.js — visibilité de la « Collection Dashboards »
//
//  Brique transverse (page CollectionDashboards + tuile HomePage).
//  Reproduit l'esprit du modèle 3 couches de permissions.js SANS y toucher
//  (permissions.js = trio sensible) :
//   • FACTORY  : un rôle de la liste DASHBOARDS_DEFAULT_ROLES voit la
//                collection par défaut.
//   • OVERRIDE UTILISATEUR : user.permissionsOverride.dashboards
//        === false  → masqué pour cet utilisateur (même s'il a un rôle qui
//                     y donne droit) ;
//        === true / "all" → forcé visible (utile pour un futur rôle « Achat »
//                     pas encore câblé en FACTORY, via la fiche user).
//
//  Pas de couche rolesConfig ici : ces dashboards ne sont pas un module de
//  permissions.js, donc aucun override de rôle Firestore ne les cible.
// ═══════════════════════════════════════════════════════════════
import { getRoles } from "./permissions";

// Rôles qui voient la collection par défaut. « Achat » est listé en
// prévision du rôle à créer ; il est sans effet tant qu'il n'existe pas
// (aucun utilisateur ne le porte), et reste activable au cas par cas via
// permissionsOverride.dashboards = true.
export const DASHBOARDS_DEFAULT_ROLES = [
  "Admin",
  "Direction",
  "Assistante",
  "Conducteur travaux",
  "Achat",
];

export function canSeeDashboards(user) {
  if (!user) return false;

  const ov = user.permissionsOverride?.dashboards;
  if (ov === false) return false;
  if (ov === true || ov === "all") return true;

  return getRoles(user).some((r) => DASHBOARDS_DEFAULT_ROLES.includes(r));
}

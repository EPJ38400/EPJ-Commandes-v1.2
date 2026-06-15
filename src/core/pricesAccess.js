// ═══════════════════════════════════════════════════════════════
//  pricesAccess.js — visibilité des PRIX (cloisonnement achat)
//
//  Brique transverse calquée sur dashboardsAccess.js. Reproduit l'esprit
//  du modèle 3 couches de permissions.js SANS y toucher (permissions.js =
//  trio sensible) :
//   • FACTORY  : un rôle de PRICES_DEFAULT_ROLES voit les prix par défaut.
//   • OVERRIDE UTILISATEUR : user.permissionsOverride.prix
//        === false        → prix masqués pour cet utilisateur (même s'il a
//                           un rôle qui y donne droit) ;
//        === true / "all" → forcé visible.
//
//  Pas de couche rolesConfig ici : la visibilité prix n'est pas un module
//  de permissions.js, donc aucun override de rôle Firestore ne la cible.
// ═══════════════════════════════════════════════════════════════
import { getRoles } from "./permissions";

// Rôles qui voient les prix par défaut. « Conducteur travaux » est EXCLU
// (décision PJ — cloisonnement achat dans la fiche chantier). « Achat » est
// inclus pour rester cohérent avec dashboardsAccess.js.
export const PRICES_DEFAULT_ROLES = [
  "Admin",
  "Direction",
  "Assistante",
  "Achat",
];

export function canSeePrix(user) {
  if (!user) return false;

  const ov = user.permissionsOverride?.prix;
  if (ov === false) return false;
  if (ov === true || ov === "all") return true;

  return getRoles(user).some((r) => PRICES_DEFAULT_ROLES.includes(r));
}

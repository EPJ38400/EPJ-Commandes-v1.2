// ═══════════════════════════════════════════════════════════════
//  CommandesModule — Module 1 de l'EPJ App Globale
//
//  Ce fichier encapsule tout le code de l'ancien App.jsx V1.3
//  (page d'accueil Commandes, catalogue, panier, validation,
//  PDF, admin catalogue…) en supprimant uniquement :
//    - la vue "login"   → désormais gérée par le Socle
//    - la vue "home"    → devient la page de garde globale
//
//  Le module reçoit :
//    - user          : l'utilisateur courant (AuthContext)
//    - onExitModule  : pour revenir à la page de garde globale
// ═══════════════════════════════════════════════════════════════

import { CommandesInner } from "./CommandesInner";

export function CommandesModule({ onExitModule }) {
  return <CommandesInner onExitModule={onExitModule}/>;
}

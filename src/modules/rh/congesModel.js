// ═══════════════════════════════════════════════════════════════
//  congesModel — logique PURE des congés / absences (RH-2a)
//
//  Aucune dépendance Firestore. Réutilise PERIODES + helpers de dates
//  du Planning (../planning/planningModel) — jamais réinventés. Les
//  couleurs de type pointent vers les tokens EPJ (core/theme).
//
//  Modèle d'un congé (collection racine `conges`) :
//    { ressourceId, ressourceNom, ressourceType, type, du, au,
//      demiJourneeDebut, demiJourneeFin, motif, statut, creePar,
//      creeParNom, createdAt, updatedAt }
//    • du / au = dates ISO YYYY-MM-DD incluses.
//    • demiJourneeDebut/Fin = "AM" | "PM" (bornes de demi-journée).
// ═══════════════════════════════════════════════════════════════
import { EPJ } from "../../core/theme";
import { PERIODES, fromISO, toISODate, addDays } from "../planning/planningModel";

// ─── Workflow de validation (RH-2c) ────────────────────────────
// DEMANDE → VALIDEE_N1 → VALIDEE (+ REFUSEE, ANNULEE).
//   • DEMANDE     : demande d'absence en attente de validation N1 (conducteur).
//   • VALIDEE_N1  : validée N1, en attente de validation N2 (direction/assistante).
//   • VALIDEE     : validée définitivement (ferme le créneau au planning).
//   • REFUSEE     : refusée par N1 ou N2 (n'apparaît plus au planning).
//   • ANNULEE     : annulée par le demandeur (jamais de delete).
// Maladie / saisie gestionnaire → VALIDEE direct (pas de circuit N1/N2).
export const CONGE_STATUTS = ["DEMANDE", "VALIDEE_N1", "VALIDEE", "REFUSEE", "ANNULEE"];

export const CONGE_STATUT_LABEL = {
  DEMANDE: "En attente N1",
  VALIDEE_N1: "En attente N2",
  VALIDEE: "Validé",
  REFUSEE: "Refusé",
  ANNULEE: "Annulé",
};

// Ferme = validé définitivement (grisé PLEIN au planning).
export const isFerme = (c) => c?.statut === "VALIDEE";
// En attente = demande non encore validée (hachures PÂLES « en attente »).
export const isEnAttente = (c) => c?.statut === "DEMANDE" || c?.statut === "VALIDEE_N1";
// Visible au planning = ferme OU en attente (exclut REFUSEE / ANNULEE).
export const isVisiblePlanning = (c) => isFerme(c) || isEnAttente(c);

// ─── Types de congé ────────────────────────────────────────────
export const CONGE_TYPES = ["CP", "RTT", "MALADIE", "SANS_SOLDE", "AUTRE"];

export const CONGE_TYPE_LABEL = {
  CP: "Congés payés",
  RTT: "RTT",
  MALADIE: "Maladie",
  SANS_SOLDE: "Sans solde",
  AUTRE: "Autre",
};

// Abrégés courts pour l'affichage en cellule étroite (overlay planning).
export const CONGE_TYPE_SHORT = {
  CP: "CP", RTT: "RTT", MALADIE: "Mal.", SANS_SOLDE: "SS", AUTRE: "Abs.",
};

// Couleur métier par type → tokens EPJ (core/theme). Source unique.
export const CONGE_TYPE_COLOR = {
  CP: EPJ.blue,
  RTT: EPJ.green,
  MALADIE: EPJ.red,
  SANS_SOLDE: EPJ.gray600,
  AUTRE: EPJ.orange,
};

// ─── Couverture d'une demi-journée ─────────────────────────────
// Un congé couvre chaque jour de du..au × PERIODES, SAUF :
//   • "AM" du jour `du` si la 1re demi-journée commence l'après-midi
//     (demiJourneeDebut === "PM") ;
//   • "PM" du jour `au` si la dernière demi-journée finit le matin
//     (demiJourneeFin === "AM").
// Les deux exclusions s'appliquent indépendamment (gère aussi du === au).
export function congeCoversSlot(conge, dateIso, periode) {
  if (!conge || !dateIso || !periode) return false;
  const { du, au, demiJourneeDebut, demiJourneeFin } = conge;
  if (!du || !au) return false;
  if (!PERIODES.includes(periode)) return false;
  if (dateIso < du || dateIso > au) return false;
  if (dateIso === du && demiJourneeDebut === "PM" && periode === "AM") return false;
  if (dateIso === au && demiJourneeFin === "AM" && periode === "PM") return false;
  return true;
}

// ─── Liste des jours ISO couverts (du..au inclus) ──────────────
// Renvoie [] si bornes absentes ou plage inversée (au < du).
export function congeDaysList(conge) {
  if (!conge?.du || !conge?.au) return [];
  const out = [];
  let d = fromISO(conge.du);
  const end = fromISO(conge.au);
  while (d <= end) {
    out.push(toISODate(d));
    d = addDays(d, 1);
  }
  return out;
}

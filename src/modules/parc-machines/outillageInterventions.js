// ═══════════════════════════════════════════════════════════════
//  outillageInterventions.js — Modèle + logique PURE du suivi SAV
//  (déclaration de panne autonome, complémentaire au flux retour).
//
//  Collection racine : outillageInterventions/{id}
//    { outilId, outilRef, outilNom, panneIds[], descriptionLibre,
//      statut, dateSignalement, dateReparation, notes,
//      declareePar, declareeParNom, createdAt, updatedAt }
//
//  Aucun side-effect ici (pas de Firestore, pas de Date.now()) hormis
//  la table visuelle INTERVENTION_STATUTS qui lit les tokens du thème.
// ═══════════════════════════════════════════════════════════════
import { EPJ } from "../../core/theme";

// ─── Statuts d'une intervention ─────────────────────────────────
export const INTERVENTION_STATUTS = {
  signalee:      { label: "Signalée",      color: EPJ.orange,   icon: "⚠" },
  en_reparation: { label: "En réparation", color: EPJ.catEtude, icon: "🛠" },
  reparee:       { label: "Réparée",       color: EPJ.green,    icon: "✓" },
  reformee:      { label: "Réformée",      color: EPJ.gray500,  icon: "✕" },
};

// Une intervention est "ouverte" tant qu'elle n'est pas clôturée
// (réparée ou réformée).
export const INTERVENTION_STATUTS_OUVERTS = ["signalee", "en_reparation"];

export function isInterventionOuverte(it) {
  return INTERVENTION_STATUTS_OUVERTS.includes(it?.statut);
}

// Transitions de statut autorisées.
const INTERVENTION_TRANSITIONS = {
  signalee:      ["en_reparation", "reparee", "reformee"],
  en_reparation: ["reparee", "reformee"],
  reparee:       [],
  reformee:      [],
};

export function nextInterventionStatuts(from) {
  return INTERVENTION_TRANSITIONS[from] || [];
}

export function canTransitionInterventionTo(from, to) {
  return nextInterventionStatuts(from).includes(to);
}

// ─── Construction du doc à la déclaration ───────────────────────
export function buildInterventionPayload({ outil, panneIds, descriptionLibre, user, nowISO }) {
  return {
    outilId: outil?._id || "",
    outilRef: outil?.ref || "",
    outilNom: outil?.nom || "",
    panneIds: Array.isArray(panneIds) ? panneIds : [],
    descriptionLibre: (descriptionLibre || "").trim(),
    statut: "signalee",
    dateSignalement: nowISO,
    dateReparation: null,
    notes: "",
    declareePar: user?.id || "",
    declareeParNom: `${user?.prenom || ""} ${user?.nom || ""}`.trim(),
    createdAt: nowISO,
    updatedAt: nowISO,
  };
}

// ─── Statut de l'outil après déclaration ────────────────────────
// Une panne bloquante (au moins) → hors_service ; sinon maintenance.
export function outilStatutForDeclaration(pannes, selectedCodes) {
  const list = Array.isArray(pannes) ? pannes : [];
  const codes = Array.isArray(selectedCodes) ? selectedCodes : [];
  const hasBloquante = codes.some(code => {
    const p = list.find(x => x.code === code || x._id === code);
    return p?.bloquante === true;
  });
  return hasBloquante ? "hors_service" : "maintenance";
}

// ─── Patch d'intervention lors d'un changement de statut ────────
export function buildStatusChangePayload({ newStatut, nowISO }) {
  const patch = { statut: newStatut, updatedAt: nowISO };
  if (newStatut === "reparee" || newStatut === "reformee") {
    patch.dateReparation = nowISO;
  }
  return patch;
}

// ─── Statut de l'outil après clôture d'une intervention ─────────
// reparee  → "disponible" SAUF s'il reste une autre intervention ouverte
//            sur ce même outil (auquel cas null = ne pas toucher l'outil).
// reformee → toujours "hors_service".
// Retourne le nouveau statut outil, ou null si l'outil ne doit pas changer.
export function outilStatutAfterStatusChange({ newStatut, outilId, interventions, currentInterventionId }) {
  if (newStatut === "reformee") return "hors_service";
  if (newStatut === "reparee") {
    const autresOuvertes = (interventions || []).some(it =>
      it.outilId === outilId &&
      (it._id || it.id) !== currentInterventionId &&
      isInterventionOuverte(it)
    );
    return autresOuvertes ? null : "disponible";
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
//  planningWrites — builders de PAYLOAD planningCreneaux (V3)
//
//  Source UNIQUE des champs d'un créneau, partagée par AffectationModal
//  (édition mono-tâche) et la création « bulk » de la vue mensuelle —
//  zéro duplication des écritures. Module « writes » : dépendance Firestore
//  (serverTimestamp) assumée ici, PAS dans planningModel (qui reste pur).
//
//  Deux formes : AFFECTÉ (ressourceId non nul, id déterministe) et
//  POOL « à affecter » (ressourceId null, doc auto-id).
// ═══════════════════════════════════════════════════════════════
import { serverTimestamp } from "firebase/firestore";
import { demiJourneeHeures } from "./planningModel";

// Champs d'un créneau AFFECTÉ. `existing` = doc actuel (préserve états de
// validation/SMS/créateur lors d'un merge). `dayIdx` 0..4 (Lun→Ven) pour la
// durée par défaut (3,5 h le vendredi). `tempsEstimeH` "" / null → défaut.
export function affectedCreneauPayload({
  res, date, periode, dayIdx, chantierId, batiment, poste, posteLabel, tempsEstimeH, existing, userId,
}) {
  const hasChantier = !!chantierId;
  return {
    ressourceId: res.id, ressourceNom: res.nom, ressourceType: res.type,
    date, periode,
    chantierId: chantierId || null,
    batiment: hasChantier ? (batiment || null) : null,
    posteAvancementKey: hasChantier ? (poste || null) : null,
    posteLabel: hasChantier ? (posteLabel || null) : null,
    tempsEstimeH: hasChantier
      ? (tempsEstimeH !== "" && tempsEstimeH != null ? Number(tempsEstimeH) : demiJourneeHeures(dayIdx))
      : null,
    tacheId: null,
    etatValidationMonteur: existing?.etatValidationMonteur || "NON",
    smsEnvoye: existing?.smsEnvoye ?? false,
    creePar: existing?.creePar || userId,
    modifiePar: userId,
    updatedAt: serverTimestamp(),
  };
}

// Champs d'un créneau POOL « à affecter ». `source` = tâche pool existante
// (préserve creePar/createdAt lors d'un merge), sinon création.
export function poolCreneauPayload({
  date, periode, chantierId, batiment, poste, posteLabel, tempsEstimeH, source, userId,
}) {
  return {
    ressourceId: null,
    date, periode,
    chantierId: chantierId || null,
    batiment: chantierId ? (batiment || null) : null,
    posteAvancementKey: chantierId ? (poste || null) : null,
    posteLabel: chantierId ? (posteLabel || null) : null,
    tempsEstimeH: tempsEstimeH !== "" && tempsEstimeH != null ? Number(tempsEstimeH) : null,
    tacheId: null,
    creePar: source?.creePar || userId,
    modifiePar: userId,
    createdAt: source?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

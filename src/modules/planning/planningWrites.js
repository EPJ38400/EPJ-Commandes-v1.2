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
import { demiJourneeHeures, makeTacheId } from "./planningModel";

// Normalise + filtre les lignes de tâches d'un créneau (multi-tâches, L3).
// Chaque ligne : { id?, chantierId, batiment, posteAvancementKey, posteLabel,
// tempsEstimeH }. Une ligne « vide » (ni chantier, ni poste, ni label) est
// retirée. tempsEstimeH "" / null → null au niveau tâche (le défaut demi-journée
// est appliqué au MIROIR primaire, pas à chaque tâche).
function cleanTaches(taches) {
  return (taches || []).map((t) => ({
    id: t.id || makeTacheId(),
    chantierId: t.chantierId || null,
    batiment: t.chantierId ? (t.batiment || null) : null,
    posteAvancementKey: t.chantierId ? (t.posteAvancementKey || null) : null,
    posteLabel: t.posteLabel || null,
    tempsEstimeH: (t.tempsEstimeH !== "" && t.tempsEstimeH != null) ? Number(t.tempsEstimeH) : null,
  })).filter((t) => t.chantierId || t.posteAvancementKey || t.posteLabel);
}
// Tâche primaire = 1re avec chantier (miroir requête mois + L9 primaire),
// sinon 1re tâche. Détermine les champs plats de compat.
function primaryTache(clean) {
  return clean.find((t) => t.chantierId) || clean[0] || null;
}

// Champs d'un créneau AFFECTÉ. `existing` = doc actuel (préserve états de
// validation/SMS/créateur lors d'un merge). `dayIdx` 0..4 (Lun→Ven) pour la
// durée par défaut (vendredi : 4 h matin, 3 h aprem). `taches` = tableau de lignes.
// Le doc porte `taches[]` + un MIROIR primaire (chantierId/… plats) pour la
// compat : requête mois (where chantierId), L9 primaire, lecteurs plats.
export function affectedCreneauPayload({ res, date, periode, dayIdx, taches, existing, userId }) {
  const clean = cleanTaches(taches);
  const primary = primaryTache(clean);
  return {
    ressourceId: res.id, ressourceNom: res.nom, ressourceType: res.type,
    date, periode,
    taches: clean,
    chantierId: primary?.chantierId || null,
    batiment: primary?.batiment || null,
    posteAvancementKey: primary?.posteAvancementKey || null,
    posteLabel: primary?.posteLabel || null,
    tempsEstimeH: primary ? (primary.tempsEstimeH ?? demiJourneeHeures(dayIdx, periode)) : null,
    tacheId: null,
    // États de validation (L9) — préservés au merge lors d'une ré-affectation /
    // édition (comme etatValidationMonteur). Strictement additif : aucun champ
    // existant touché, défauts = état neutre "NON". ⚠️ Interim : L9 ne valide
    // que la tâche PRIMAIRE jusqu'à L4 (validation par tâche).
    etatValidationMonteur: existing?.etatValidationMonteur || "NON",
    etatValidationMonteurAt: existing?.etatValidationMonteurAt ?? null,
    etatValidationMonteurPar: existing?.etatValidationMonteurPar ?? null,
    etatValidationConducteur: existing?.etatValidationConducteur || "NON",
    etatValidationConducteurAt: existing?.etatValidationConducteurAt ?? null,
    etatValidationConducteurPar: existing?.etatValidationConducteurPar ?? null,
    // Validation L9 PAR TÂCHE (lot 4) — maps { [tacheId]: {etat,at,par} }
    // préservées au merge (comme les champs plats). Additif : jamais écrasées.
    validationMonteur: existing?.validationMonteur || {},
    validationConducteur: existing?.validationConducteur || {},
    aValiderConducteur: existing?.aValiderConducteur ?? false,
    smsEnvoye: existing?.smsEnvoye ?? false,
    creePar: existing?.creePar || userId,
    modifiePar: userId,
    updatedAt: serverTimestamp(),
  };
}

// Champs d'un créneau POOL « à affecter ». `source` = tâche pool existante
// (préserve creePar/createdAt lors d'un merge), sinon création. Même corps
// `taches[]` + miroir primaire que l'affecté.
export function poolCreneauPayload({ date, periode, dayIdx, taches, source, userId }) {
  const clean = cleanTaches(taches);
  const primary = primaryTache(clean);
  return {
    ressourceId: null,
    date, periode,
    taches: clean,
    chantierId: primary?.chantierId || null,
    batiment: primary?.batiment || null,
    posteAvancementKey: primary?.posteAvancementKey || null,
    posteLabel: primary?.posteLabel || null,
    tempsEstimeH: primary ? (primary.tempsEstimeH ?? demiJourneeHeures(dayIdx, periode)) : null,
    tacheId: null,
    // Maps de validation L9 par tâche préservées au merge (additif, cf. affecté).
    validationMonteur: source?.validationMonteur || {},
    validationConducteur: source?.validationConducteur || {},
    aValiderConducteur: source?.aValiderConducteur ?? false,
    creePar: source?.creePar || userId,
    modifiePar: userId,
    createdAt: source?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

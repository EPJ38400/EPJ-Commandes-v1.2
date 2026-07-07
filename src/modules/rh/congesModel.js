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
export const CONGE_TYPES = ["CP", "RECUP", "MALADIE", "SANS_SOLDE", "AUTRE"];

export const CONGE_TYPE_LABEL = {
  CP: "Congés payés",
  RECUP: "Récupération",
  MALADIE: "Maladie",
  SANS_SOLDE: "Sans solde",
  AUTRE: "Autre",
};

// Abrégés courts pour l'affichage en cellule étroite (overlay planning).
export const CONGE_TYPE_SHORT = {
  CP: "CP", RECUP: "Récup", MALADIE: "Mal.", SANS_SOLDE: "SS", AUTRE: "Abs.",
};

// Couleur métier par type → tokens EPJ (core/theme). Source unique.
export const CONGE_TYPE_COLOR = {
  CP: EPJ.blue,
  RECUP: EPJ.green,
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

// ═══════════════════════════════════════════════════════════════
//  Périmètre des congés (RH-3c) — salariés EPJ éligibles aux congés
//
//  Périmètre plus large que les seuls rôles « terrain » : inclut aussi
//  Achat (Thomas SILVESTRE) et Assistante (Audrey LAMENDOLA), qui ont bien
//  des congés. Exclut Direction / Admin / Artisan. Tri par NOM DE FAMILLE.
// ═══════════════════════════════════════════════════════════════
export const SALARIE_CONGES_ROLES =
  ["Conducteur travaux", "Chef chantier", "Monteur", "Assistante", "Achat"];

export function salariesConges(users) {
  return (users || [])
    .filter((u) => {
      const roles = u.roles || [];
      if (roles.includes("Direction") || roles.includes("Admin") || roles.includes("Artisan")) return false;
      return roles.some((r) => SALARIE_CONGES_ROLES.includes(r));
    })
    .map((u) => ({
      id: u._id || u.id,
      nom: `${u.prenom || ""} ${u.nom || ""}`.trim() || (u._id || u.id),
      _nomFamille: u.nom || "",
    }))
    .sort((a, b) => (a._nomFamille).localeCompare(b._nomFamille, "fr", { sensitivity: "base" }));
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

// ═══════════════════════════════════════════════════════════════
//  Compteur Congés payés — décompte BTP en jours OUVRABLES (RH-3a)
//
//  Convention BTP bâtiment : on décompte lundi→samedi (le dimanche est
//  seul exclu) et le « samedi rattaché » — une absence qui finit un
//  vendredi consomme aussi le samedi suivant. La période d'acquisition
//  court du 1er mai au 30 avril (2,5 j ouvrables acquis par mois).
// ═══════════════════════════════════════════════════════════════

// Nombre de jours OUVRABLES décomptés pour une absence [du..au] (bornes
// de demi-journée). Dimanche exclu ; samedi rattaché si `au` = vendredi.
export function joursOuvrablesDecomptes(du, au, demiDebut = "AM", demiFin = "PM") {
  if (!du || !au) return 0;
  if (au < du) return 0;
  let n = 0;
  let d = fromISO(du);
  const end = fromISO(au);
  while (d <= end) {
    const dow = d.getDay();            // 0=dim … 6=sam
    if (dow !== 0) n += 1;             // lun-sam comptent, dim non
    d = addDays(d, 1);
  }
  if (fromISO(au).getDay() === 5) n += 1;   // au = vendredi → samedi rattaché
  if (demiDebut === "PM") n -= 0.5;
  if (demiFin === "AM") n -= 0.5;
  return Math.max(0, n);
}

// 1er mai de la période d'acquisition courante :
//   mois >= mai (index 4) → 1er mai année courante ; sinon année précédente.
export function debutPeriodeMai(dateRef = new Date()) {
  const y = dateRef.getMonth() >= 4 ? dateRef.getFullYear() : dateRef.getFullYear() - 1;
  return new Date(y, 4, 1); // 1er mai (mois index 4)
}

// Jours de CP acquis depuis le 1er mai courant : 2,5 × mois entamés (mois
// courant inclus). Ex. juillet → mai,juin,juillet = 3 mois → 7,5 j.
export function joursAcquisCP(dateRef = new Date()) {
  const start = debutPeriodeMai(dateRef);
  const mois = (dateRef.getFullYear() - start.getFullYear()) * 12
    + (dateRef.getMonth() - start.getMonth()) + 1;
  return 2.5 * Math.max(0, mois);
}

// Solde CP d'un salarié (RH-3c) : on distingue l'acquis N-1 (report disponible =
// soldeInitial + ajustement) de l'acquis N (période courante, en cours d'acquisition,
// 2,5 j/mois depuis le 1er mai). `congesUser` = congés VALIDEE de ce salarié ; on ne
// compte comme « pris » que les CP dont `du` >= 1er mai courant (remise à zéro annuelle).
// ⚠️ Règle PJ : l'acquis N n'entre PAS dans le disponible (disponible = acquisN1 − pris).
export function soldeCongesCP({ soldeInitial = 0, ajustement = 0 } = {}, congesUser = [], dateRef = new Date()) {
  const debutISO = toISODate(debutPeriodeMai(dateRef));
  const acquisN1 = (soldeInitial || 0) + (ajustement || 0);  // report N-1 disponible
  const acquisN = joursAcquisCP(dateRef);                     // en cours (2,5/mois depuis 1er mai)
  const pris = (congesUser || [])
    .filter((c) => c.type === "CP" && c.du && c.du >= debutISO)
    .reduce((s, c) => s + joursOuvrablesDecomptes(c.du, c.au, c.demiJourneeDebut, c.demiJourneeFin), 0);
  return { acquisN1, acquisN, pris, disponible: acquisN1 - pris };
}

// ═══════════════════════════════════════════════════════════════
//  Compteur RCR / Récupération — décompte en MINUTES (RH-3b)
//
//  Une journée ouvrable de récup = 7 h (420 min), une demi-journée = 3 h 30
//  (210 min). Le décompte réutilise la logique BTP de joursOuvrablesDecomptes
//  (dimanche exclu, samedi rattaché) : minutes = jours ouvrables × 420. Le
//  compteur est ANNUEL CIVIL (remise à zéro le 1er janvier, art. 4.3).
// ═══════════════════════════════════════════════════════════════
export const RCR_MIN_JOUR = 420; // 7 h
export const RCR_MIN_DEMI = 210; // 3 h 30

// Minutes de récup décomptées pour une absence [du..au] (bornes de demi-journée).
// La récup se décompte en jours OUVRÉS (lun-ven), en temps travaillé réel :
// PAS de samedi rattaché (règle propre aux CP). Journée = 420 ; demi = 210.
export function minutesRCRDecomptees(du, au, demiDebut = "AM", demiFin = "PM") {
  if (!du || !au || au < du) return 0;
  let jours = 0;
  let d = fromISO(du);
  const end = fromISO(au);
  while (d <= end) {
    const dow = d.getDay();                 // 0=dim … 6=sam
    if (dow >= 1 && dow <= 5) jours += 1;    // lun-ven : récup = temps travaillé réel
    d = addDays(d, 1);
  }
  // PAS de samedi rattaché (règle propre aux CP, pas à la récup).
  if (demiDebut === "PM") jours -= 0.5;
  if (demiFin === "AM") jours -= 0.5;
  return Math.round(Math.max(0, jours) * RCR_MIN_JOUR);
}

// 1er janvier de l'année civile de référence (remise à zéro du compteur RCR).
export function debutAnneeCivile(dateRef = new Date()) {
  return new Date(dateRef.getFullYear(), 0, 1);
}

// Solde RCR d'un salarié (en minutes). `rcrSoldeMinutes` = crédit saisi par le
// gestionnaire ; `pris` = Σ minutes des RECUP VALIDEE de l'année civile courante.
// Solde négatif possible (sur-consommation).
export function soldeRCR({ rcrSoldeMinutes = 0 } = {}, congesUser = [], dateRef = new Date()) {
  const debutISO = toISODate(debutAnneeCivile(dateRef));
  const pris = (congesUser || [])
    .filter((c) => c.type === "RECUP" && c.statut === "VALIDEE" && c.du && c.du >= debutISO)
    .reduce((s, c) => s + minutesRCRDecomptees(c.du, c.au, c.demiJourneeDebut, c.demiJourneeFin), 0);
  const saisi = Number(rcrSoldeMinutes) || 0;
  return { saisi, pris, solde: saisi - pris };
}

// Formate des minutes en "Xh MM" (ex. 210 → "3h30", 60 → "1h00"). Gère le signe
// négatif (solde sur-consommé) : -90 → "-1h30".
export function formatMinutes(min) {
  const m = Math.round(Number(min) || 0);
  const sign = m < 0 ? "-" : "";
  const abs = Math.abs(m);
  const h = Math.floor(abs / 60);
  const mm = abs % 60;
  return `${sign}${h}h${String(mm).padStart(2, "0")}`;
}

// ═══════════════════════════════════════════════════════════════
//  planningSmsBody — corps des SMS planning (front, ENVOI MANUEL)
//
//  Source UNIQUE du texte d'un SMS planning déclenché depuis l'app
//  (bouton « Envoyer le planning » d'AffectationModal). Le rendu est
//  ALIGNÉ sur le cron functions/planningSms.js (GSM-7 + libellés) pour
//  que manuel et automatique soient indiscernables côté monteur.
//
//  Module PUR : aucune dépendance Firestore / React.
// ═══════════════════════════════════════════════════════════════

// Normalisation GSM-7 (~160 car/segment vs 70 en unicode) : retire les
// accents (diacritiques ̀-ͯ) et remplace tirets longs (— –) /
// apostrophe typographique (’).
export function gsmSafe(s) {
  return String(s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[—–]/g, "-").replace(/[’]/g, "'");
}

// Libellé poste lisible depuis une clé tâche ("beton-dalle-rdc" → "Beton dalle rdc").
// Repli quand le créneau n'a pas de posteLabel persisté (anciens créneaux).
export function prettifyPoste(key) {
  if (!key) return "";
  const s = String(key).replace(/[-_]+/g, " ").trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Corps complet d'un SMS planning. `prefix` = "" (récap) ou "MODIF - " (modif).
export function buildPlanningMessage({ prenom, dateLabel, lignes, prefix }) {
  return gsmSafe(
    `${prefix || ""}Bonjour ${prenom}, ton planning EPJ du ${dateLabel} :\n` +
    `${lignes.join("\n")}\n- EPJ`,
  );
}

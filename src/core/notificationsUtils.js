// ═══════════════════════════════════════════════════════════════
//  notificationsUtils.js — Helpers pour les notifications HomePage
// ═══════════════════════════════════════════════════════════════

// ─── Date utils ──────────────────────────────────────────
export function currentMonthKey() {
  // Retourne "YYYY-MM" pour le mois courant
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function currentMonthLabel() {
  // Retourne "avril 2026" pour le mois courant
  const d = new Date();
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function monthLabel(monthKey) {
  // "2026-04" → "avril 2026"
  if (!monthKey) return "—";
  const [year, month] = monthKey.split("-");
  const d = new Date(parseInt(year), parseInt(month) - 1, 1);
  return d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
}

export function dayOfMonth() {
  return new Date().getDate();
}

// Le rappel d'avancement est actif à partir du 20 du mois
export const RAPPEL_AVANCEMENT_JOUR = 20;

export function isRappelAvancementActif() {
  return dayOfMonth() >= RAPPEL_AVANCEMENT_JOUR;
}

// ─── Notifications Parc machines ─────────────────────────
export function computeParcNotifications(outillageSorties) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const enRetard = outillageSorties.filter(s => {
    if (s.dateRetourReelle) return false;
    if (!s.dateRetourPrevue) return false;
    const d = new Date(s.dateRetourPrevue + "T00:00:00");
    return d < today;
  });
  return {
    count: enRetard.length,
    label: enRetard.length > 0
      ? `${enRetard.length} outil${enRetard.length > 1 ? "s" : ""} en retard`
      : null,
  };
}

// ─── Notifications Avancement ────────────────────────────
// Retourne le nombre de chantiers qui n'ont pas encore validé l'avancement du mois courant
// Si on est avant le 20 du mois, pas de notification.
// Seul compte les chantiers qui concernent cet utilisateur (conducteur/chef).
export function computeAvancementNotifications({
  avancementValidations,
  chantiers,
  user,
}) {
  if (!isRappelAvancementActif()) {
    return { count: 0, label: null };
  }
  const monthKey = currentMonthKey();

  // Chantiers actifs concernant l'utilisateur
  const mesChantiers = (chantiers || []).filter(c => {
    if (c.archive) return false;
    // Si user est Admin ou Direction → tous les chantiers actifs
    const roles = (user?.roles || []);
    if (roles.includes("Admin") || roles.includes("Direction") || roles.includes("Assistante")) {
      return true;
    }
    // Sinon : uniquement ses propres chantiers
    const affectations = c.affectations || {};
    return (
      affectations.conducteurId === user?.id ||
      affectations.chefChantierId === user?.id ||
      (Array.isArray(affectations.monteurIds) && affectations.monteurIds.includes(user?.id))
    );
  });

  // Chantiers sans validation pour le mois courant
  const nonValides = mesChantiers.filter(c => {
    const chantierNum = c.num || c._id;
    const validation = avancementValidations.find(
      v => v.chantierNum === chantierNum && v.mois === monthKey
    );
    return !validation;
  });

  return {
    count: nonValides.length,
    label: nonValides.length > 0
      ? `${nonValides.length} chantier${nonValides.length > 1 ? "s" : ""} à valider pour ${currentMonthLabel()}`
      : null,
    chantiersNonValides: nonValides,
  };
}

// ─── Helper pour vérifier si un chantier a été validé pour un mois donné ───
export function isAvancementValide(chantierNum, monthKey, avancementValidations) {
  if (!chantierNum || !monthKey) return false;
  return avancementValidations.some(
    v => v.chantierNum === chantierNum && v.mois === monthKey
  );
}

// ─── Récupère la validation d'un chantier/mois ───
export function getValidation(chantierNum, monthKey, avancementValidations) {
  return avancementValidations.find(
    v => v.chantierNum === chantierNum && v.mois === monthKey
  ) || null;
}

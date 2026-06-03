// ═══════════════════════════════════════════════════════════════
//  esaboraFormat.js — helpers d'affichage du Module Commande (front)
//  Formatage montants / dates + métadonnées de statut AR.
//  Pur (pas de dépendance React) → réutilisable dans EsaboraHistory,
//  AchatDashboard et un futur onglet fiche chantier.
// ═══════════════════════════════════════════════════════════════
import { EPJ } from "../../../core/theme";

const MONEY = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function fmtMoney(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  return MONEY.format(Number(n));
}

export function fmtPct(n) {
  if (n == null || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)} %`;
}

// Accepte une string ISO (dateCommande) OU un Timestamp Firestore
// (arAcquitLe, dateConstat — issus de serverTimestamp()).
function toDate(value) {
  if (!value) return null;
  if (typeof value === "object" && typeof value.toDate === "function") {
    return value.toDate();
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtDate(value) {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// Ancienneté en jours pleins depuis la date donnée (≥ 0), null si invalide.
export function daysSince(value) {
  const d = toDate(value);
  if (!d) return null;
  const ms = Date.now() - d.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

// Métadonnées de rendu des 4 statuts AR (cf. commandesEsabora.arStatut).
export const AR_STATUT_META = {
  EN_ATTENTE: { icon: "⏳", label: "En attente", color: EPJ.gray500 },
  RECU:       { icon: "✓",  label: "Reçu",       color: EPJ.green },
  MANQUANT:   { icon: "⚠",  label: "Manquant",   color: EPJ.red },
  SANS_AR:    { icon: "—",  label: "Sans AR",    color: EPJ.gray500 },
};

export function arStatutMeta(statut) {
  return AR_STATUT_META[statut] || { icon: "?", label: statut || "—", color: EPJ.gray500 };
}

export const ORIGINE_META = {
  APP:     { label: "App",     color: EPJ.blue },
  ESABORA: { label: "Esabora", color: EPJ.gray500 },
};

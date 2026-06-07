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

// Comme fmtDate, mais conserve la chaîne brute si elle n'est pas parsable
// (les dates de livraison AR peuvent être libellées "semaine 23", "fin mai"…).
export function fmtDateOrRaw(value) {
  const d = toDate(value);
  if (d) return fmtDate(d);
  const s = String(value || "").trim();
  return s || "—";
}

// Dérive l'affichage "livraison" d'une commande Esabora :
//   • arStatut ≠ RECU            → "En attente AR" (pas de plage).
//   • sinon : plage min → max, depuis dateLivraisonMin/Max (backend) si présents,
//     sinon recalculée depuis lignesAR[].dateLivraisonPrevue.
// Retourne { label, min, max } (min/max = ISO ou null).
export function deriveLivraison(ce) {
  if (!ce || ce.arStatut !== "RECU") {
    return { label: "En attente AR", min: null, max: null };
  }
  let min = ce.dateLivraisonMin || null;
  let max = ce.dateLivraisonMax || null;
  if (!min || !max) {
    const ds = (ce.lignesAR || [])
      .map((l) => toDate(l?.dateLivraisonPrevue))
      .filter(Boolean)
      .sort((a, b) => a - b);
    if (ds.length) {
      min = min || ds[0].toISOString().slice(0, 10);
      max = max || ds[ds.length - 1].toISOString().slice(0, 10);
    }
  }
  if (!min && !max) return { label: "—", min: null, max: null };
  const a = fmtDate(min), b = fmtDate(max);
  return { label: a === b ? a : `${a} → ${b}`, min, max };
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

// ─── Pièces de l'AR fournisseur ───────────────────────────────
// Résout les PDF qui sont VRAIMENT l'AR fournisseur d'une commande
// (commandesEsabora), et JAMAIS la copie de commande EPJ.
//
//  • Aucun AR reçu (arStatut ≠ RECU) → [] (le bouton « Voir AR » disparaît).
//  • La branche AR de gmailPollAchat stocke toutes les PJ PDF du mail
//    fournisseur dans arRef.pieces : si le fournisseur a ré-attaché notre
//    bon de commande, la copie EPJ s'y retrouve. On l'exclut en la comparant
//    à copieRef.pieces (même path/id, ou même nom de fichier).
function isPdfPiece(p) {
  return !!p && (p.kind === "pdf" || /\.pdf$/i.test(p.nom || ""));
}
function normName(n) {
  return String(n || "").trim().toLowerCase();
}
function pieceKey(p) {
  return p?.path || p?.id || p?.url || normName(p?.nom) || null;
}

export function resolveArPieces(ce) {
  if (!ce || ce.arStatut !== "RECU") return [];
  const arPieces = (ce.arRef?.pieces || []).filter(isPdfPiece);
  const copy = ce.copieRef?.pieces || [];
  const copyKeys = new Set(copy.map(pieceKey).filter(Boolean));
  const copyNames = new Set(copy.map((p) => normName(p.nom)).filter(Boolean));
  return arPieces.filter((p) => !copyKeys.has(pieceKey(p)) && !copyNames.has(normName(p.nom)));
}

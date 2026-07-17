// ═══════════════════════════════════════════════════════════════
//  functions/lib/smsWindow.js — Fenêtre horaire d'envoi SMS (pur)
//
//  Logique PURE (aucune dépendance Firestore/Firebase) : détermine si un
//  instant tombe dans la fenêtre d'envoi autorisée et, sinon, calcule la
//  prochaine ouverture. Utilisé par le dispatcher SMS (functions/index.js).
//
//  Fuseau EN DUR : Europe/Paris (via Intl). Jours fériés = France
//  métropolitaine (calcul de Pâques + fêtes fixes/mobiles).
//
//  Convention jours : ISO 1=lundi … 7=dimanche.
// ═══════════════════════════════════════════════════════════════

export const DEFAULT_FENETRE = {
  actif: true,
  heureDebut: 8,
  heureFin: 17,
  jours: [1, 2, 3, 4, 5], // lundi → vendredi
  exclureFeries: true,
  timezone: "Europe/Paris",
};

const TZ = "Europe/Paris";

// ── Décomposition d'un instant en heure murale Paris ───────────
function parisParts(date) {
  const dtf = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour12: false,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const y = +p.year, mo = +p.month, d = +p.day;
  let h = +p.hour; if (h === 24) h = 0; // en-GB rend parfois "24" à minuit
  const mi = +p.minute, se = +p.second;
  const dowSun0 = new Date(Date.UTC(y, mo - 1, d)).getUTCDay(); // 0=dimanche
  const dowISO = dowSun0 === 0 ? 7 : dowSun0;
  const key = `${p.year}-${p.month}-${p.day}`;
  return { y, mo, d, h, mi, se, dowISO, key };
}

// Décalage Paris↔UTC (en minutes) pour un instant donné.
function parisOffsetMinutes(date) {
  const p = parisParts(date);
  const asUTC = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.se);
  return Math.round((asUTC - date.getTime()) / 60000);
}

// Construit l'instant UTC correspondant à une heure murale Paris.
// Exact hors des ~1h de bascule DST (2h-3h du matin) — les fenêtres
// métier (heures ouvrées) n'y touchent jamais.
function parisWallToUTC(y, mo, d, h, mi) {
  const guess = new Date(Date.UTC(y, mo - 1, d, h, mi || 0));
  const off = parisOffsetMinutes(guess);
  return new Date(guess.getTime() - off * 60000);
}

// ── Jours fériés France métropolitaine ─────────────────────────
const _feriesCache = {};

function paques(year) {
  const a = year % 19;
  const b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=mars, 4=avril
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function ymd(date) {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${d}`;
}

export function joursFeriesFrance(year) {
  if (_feriesCache[year]) return _feriesCache[year];
  const p = paques(year);
  const plus = (n) => new Date(p.getTime() + n * 86400000);
  const set = new Set([
    `${year}-01-01`,        // Jour de l'an
    ymd(plus(1)),           // Lundi de Pâques
    `${year}-05-01`,        // Fête du travail
    `${year}-05-08`,        // Victoire 1945
    ymd(plus(39)),          // Ascension
    ymd(plus(50)),          // Lundi de Pentecôte
    `${year}-07-14`,        // Fête nationale
    `${year}-08-15`,        // Assomption
    `${year}-11-01`,        // Toussaint
    `${year}-11-11`,        // Armistice 1918
    `${year}-12-25`,        // Noël
  ]);
  _feriesCache[year] = set;
  return set;
}

// ── API fenêtre ────────────────────────────────────────────────

// L'instant `date` tombe-t-il dans la fenêtre horaire (jour + heure) ?
// N'évalue PAS le flag `actif` (géré par l'appelant).
export function estDansFenetre(date, fenetre) {
  const f = { ...DEFAULT_FENETRE, ...(fenetre || {}) };
  const jours = (Array.isArray(f.jours) && f.jours.length) ? f.jours : DEFAULT_FENETRE.jours;
  const p = parisParts(date);
  if (!jours.includes(p.dowISO)) return false;
  if (f.exclureFeries && joursFeriesFrance(p.y).has(p.key)) return false;
  if (p.h < f.heureDebut || p.h >= f.heureFin) return false;
  return true;
}

// Prochain instant d'ouverture de fenêtre >= `date`.
// Si `date` est déjà dans la fenêtre → renvoie `date`.
export function prochaineOuverture(date, fenetre) {
  const f = { ...DEFAULT_FENETRE, ...(fenetre || {}) };
  const jours = (Array.isArray(f.jours) && f.jours.length) ? f.jours : DEFAULT_FENETRE.jours;
  if (estDansFenetre(date, f)) return date;
  const base = parisParts(date);
  for (let i = 0; i <= 31; i++) {
    const cal = new Date(Date.UTC(base.y, base.mo - 1, base.d + i));
    const y = cal.getUTCFullYear(), mo = cal.getUTCMonth() + 1, d = cal.getUTCDate();
    const dowSun0 = cal.getUTCDay();
    const dowISO = dowSun0 === 0 ? 7 : dowSun0;
    const key = ymd(cal);
    if (!jours.includes(dowISO)) continue;
    if (f.exclureFeries && joursFeriesFrance(y).has(key)) continue;
    const opening = parisWallToUTC(y, mo, d, f.heureDebut, 0);
    if (opening.getTime() > date.getTime()) return opening;
  }
  // Filet de sécurité : lendemain à heureDebut
  return parisWallToUTC(base.y, base.mo, base.d + 1, f.heureDebut, 0);
}

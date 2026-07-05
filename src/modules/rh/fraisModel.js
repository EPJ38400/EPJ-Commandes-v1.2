// ═══════════════════════════════════════════════════════════════
//  fraisModel — logique PURE du référentiel « petits déplacements »
//  FBTP (RH-Frais-1). Aucune dépendance Firestore.
//
//  Barème conventionnel « petits déplacements » du Bâtiment (FBTP Isère) :
//   • Indemnité de REPAS : forfait unique (panier), indépendant de la zone.
//   • Indemnité de TRANSPORT : compense le coût du trajet aller-retour, par
//     ZONE concentrique (1a … 5) mesurée en km depuis le point de départ.
//   • Indemnité de TRAJET : compense le TEMPS passé, même barème de zones.
//  Au-delà de la zone 5 (> 50 km) → grand déplacement, traité à la main.
//
//  Le barème est versionné par année (collection referentielFraisBTP/{annee}),
//  l'historique reste figé — aucune valeur en dur en prod (BAREME_2026 ne sert
//  qu'à pré-remplir la 1re saisie).
// ═══════════════════════════════════════════════════════════════

// Zones concentriques du barème, de la plus proche à la plus lointaine.
export const FRAIS_ZONES = ["1a", "1b", "2", "3", "4", "5"];

// Bornes HAUTES de chaque zone (km) — sert au mapping km → zone.
export const FRAIS_ZONE_KM = {
  "1a": 5,
  "1b": 10,
  "2": 20,
  "3": 30,
  "4": 40,
  "5": 50,
};

// km → zone ("1a".."5") | null (hors barème > 50 km, à traiter à la main).
// 0-5→1a, 5-10→1b, 10-20→2, 20-30→3, 30-40→4, 40-50→5.
export function zonePourKm(km) {
  const v = Number(km);
  if (!Number.isFinite(v) || v < 0) return null;
  for (const z of FRAIS_ZONES) {
    if (v <= FRAIS_ZONE_KM[z]) return z;
  }
  return null; // > 50 km
}

// Barème 2026 pré-rempli depuis le PDF FBTP Isère (effet 01/01/2026).
export const BAREME_2026 = {
  annee: 2026,
  dateEffet: "2026-01-01",
  repas: 12.06,
  transport: { "1a": 1.12, "1b": 3.40, "2": 6.66, "3": 10.89, "4": 15.11, "5": 19.04 },
  trajet: { "1a": 0.69, "1b": 2.02, "2": 3.72, "3": 5.75, "4": 7.78, "5": 9.71 },
  source: "FBTP Isère QS 11/2026",
};

// Indemnités d'UNE journée pour une zone donnée.
//   { transport, trajet, repas, total }
//   • repas = false → salarié logé / non éligible au panier (repas = 0).
//   • zone invalide / barème absent → tout à 0 (jamais NaN).
export function indemnitesJour(bareme, zone, { repas = true } = {}) {
  const b = bareme || {};
  const transport = Number(b.transport?.[zone]) || 0;
  const trajet = Number(b.trajet?.[zone]) || 0;
  const repasVal = repas ? Number(b.repas) || 0 : 0;
  return {
    transport,
    trajet,
    repas: repasVal,
    total: transport + trajet + repasVal,
  };
}

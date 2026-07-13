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

// Composition de l'indemnité d'UNE journée pour une distance routière (km),
// au-delà de la zone 5 comprise (> 50 km n'est plus « grand déplacement » :
// on empile des tranches de 50 km au tarif zone « 5 » + un reliquat < 50 km
// mappé sur sa zone).
//   • Indemnité = UNE SEULE composante déplacement (trajet par défaut, OU
//     transport pour le cas exceptionnel) — JAMAIS les deux cumulées — + repas.
//   • base = "trajet" (défaut) | "transport" : table de zones utilisée.
//   • nb50 = nombre de tranches pleines de 50 km (chacune au tarif zone "5").
//   • reliquat = km restants (< 50), mappés sur zonePourKm (borne haute
//     inclusive : 20 → "2").
//   • repas = false → salarié logé / non éligible au panier (repas = 0).
//   • km invalide / barème absent → null.
// ⚠️ Copie serveur en phase : functions/lib/fraisZones.js.
export function composerIndemnite(km, bareme, { repas = true, base = "trajet" } = {}) {
  if (km == null || km < 0 || !bareme) return null;
  const table = base === "transport" ? bareme.transport : bareme.trajet;  // UNE seule composante
  const nb50 = Math.floor(km / 50);
  const reliquat = Math.round((km - nb50 * 50) * 10) / 10;
  let deplacement = nb50 * (table?.["5"] || 0);
  let zoneReliquat = null;
  if (reliquat > 0) {
    zoneReliquat = zonePourKm(reliquat);          // borne haute inclusive : 20 -> "2"
    if (zoneReliquat) deplacement += table?.[zoneReliquat] || 0;
  }
  const repasVal = repas ? (bareme.repas || 0) : 0;
  const r2 = (x) => Math.round(x * 100) / 100;
  return { base, nb50, reliquat, zoneReliquat,
    deplacement: r2(deplacement),      // trajet (défaut) OU transport, JAMAIS les deux
    repas: r2(repasVal),
    total: r2(deplacement + repasVal) };
}

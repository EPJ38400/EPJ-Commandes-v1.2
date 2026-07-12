// ═══════════════════════════════════════════════════════════════
//  fraisZones — logique PURE zones/indemnité FBTP « petits déplacements »
//  (RH-Frais-2b). Copie SERVEUR de src/modules/rh/fraisModel.js.
//
//  ⚠️ Front et functions = bundles séparés : cette copie DOIT rester en
//  phase avec src/modules/rh/fraisModel.js (zonePourKm + composerIndemnite).
//  Toute modif d'un côté = report immédiat de l'autre.
// ═══════════════════════════════════════════════════════════════

// Zones concentriques du barème, de la plus proche à la plus lointaine.
const FRAIS_ZONES = ["1a", "1b", "2", "3", "4", "5"];

// Bornes HAUTES de chaque zone (km) — sert au mapping km → zone.
const FRAIS_ZONE_KM = {
  "1a": 5,
  "1b": 10,
  "2": 20,
  "3": 30,
  "4": 40,
  "5": 50,
};

// km → zone ("1a".."5") | null (hors barème > 50 km).
// 0-5→1a, 5-10→1b, 10-20→2, 20-30→3, 30-40→4, 40-50→5.
export function zonePourKm(km) {
  const v = Number(km);
  if (!Number.isFinite(v) || v < 0) return null;
  for (const z of FRAIS_ZONES) {
    if (v <= FRAIS_ZONE_KM[z]) return z;
  }
  return null; // > 50 km
}

// Composition de l'indemnité d'UNE journée pour une distance routière (km).
// nb50 tranches de 50 km au tarif zone "5" + reliquat < 50 mappé sur sa zone.
//   • km invalide / barème absent → null.
export function composerIndemnite(km, bareme, { repas = true } = {}) {
  if (km == null || km < 0 || !bareme) return null;
  const nb50 = Math.floor(km / 50);
  const reliquat = Math.round((km - nb50 * 50) * 10) / 10;   // < 50
  let transport = nb50 * (bareme.transport?.["5"] || 0);
  let trajet    = nb50 * (bareme.trajet?.["5"] || 0);
  let zoneReliquat = null;
  if (reliquat > 0) {
    zoneReliquat = zonePourKm(reliquat);        // borne haute inclusive : 20 -> "2"
    if (zoneReliquat) {
      transport += bareme.transport?.[zoneReliquat] || 0;
      trajet    += bareme.trajet?.[zoneReliquat]    || 0;
    }
  }
  const repasVal = repas ? (bareme.repas || 0) : 0;
  const r2 = (x) => Math.round(x * 100) / 100;
  return { nb50, reliquat, zoneReliquat,
    transport: r2(transport), trajet: r2(trajet), repas: r2(repasVal),
    total: r2(transport + trajet + repasVal) };
}

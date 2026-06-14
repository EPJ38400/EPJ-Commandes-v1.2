// ═══════════════════════════════════════════════════════════════
//  pieuvresModel — logique PURE de l'onglet Pieuvres (M5, L2)
//
//  Aucune dépendance Firestore : génération déterministe des lignes
//  attendues par bâtiment, à partir de la typologie buildings[].config.
//  Règle (spec §3.1) : 1 ligne = 1 dalle → sous-sols + RDC + étages +
//  combles (si combles===true). RADIER EXCLU.
//
//  Décisions actées (GO L2) :
//   • combles → posteAvancementKey "beton-combles" (poste M3 réel).
//   • `batiment` = LETTRE affichée du bâtiment (getBuildingLetter).
// ═══════════════════════════════════════════════════════════════
import {
  resolveBuildings, getBuildingLetter, DEFAULT_BUILDING_CONFIG,
} from "../avancement/avancementTasks";

// ─── Référentiels d'affichage ──────────────────────────────────
export const LIEU_OPTIONS = [
  { value: "CHANTIER", label: "Chantier" },
  { value: "BUREAU",   label: "Bureau" },
];

export const STATUT_OPTIONS = [
  { value: "A_DEMANDER", label: "À demander" },
  { value: "DEMANDEE",   label: "Demandée" },
  { value: "PLANS_RECUS", label: "Plans reçus" },
  { value: "LIVREE",     label: "Livrée" },
];

// Tonalité <Badge> par statut (réutilise les tones existants du DS).
export const STATUT_TONE = {
  A_DEMANDER: "neutral",
  DEMANDEE:   "warning",
  PLANS_RECUS: "info",
  LIVREE:     "success",
};

// ─── ID déterministe ───────────────────────────────────────────
// {chantierId}_{batiment}_{niveau} — clé stable d'idempotence.
export function pieuvreId(chantierId, batiment, niveau) {
  return `${chantierId}_${batiment}_${niveau}`;
}

// ─── Niveaux (= dalles) d'un bâtiment, dans l'ordre d'affichage ──
// ss1→ssN, rdc, r1→rN, combles. Aligné 1:1 sur les postes M3
// `beton-dalle-*` (cf. avancementTasks.buildBetonTasks), combles =
// `beton-combles`. Radier jamais inclus.
export function niveauxForConfig(cfg) {
  const c = cfg || DEFAULT_BUILDING_CONFIG;
  const ss = Number(c.nbSousSols || 0);
  const et = Number(c.nbEtages || 0);
  const combles = !!c.combles;
  const L = [];
  for (let i = 1; i <= ss; i++) L.push({ niveau: `ss${i}`, posteAvancementKey: `beton-dalle-ss${i}` });
  L.push({ niveau: "rdc", posteAvancementKey: "beton-dalle-rdc" });
  for (let i = 1; i <= et; i++) L.push({ niveau: `r${i}`, posteAvancementKey: `beton-dalle-r${i}` });
  if (combles) L.push({ niveau: "combles", posteAvancementKey: "beton-combles" });
  return L;
}

// ─── Lignes attendues, tous bâtiments confondus (génération) ────
export function expectedPieuvres(chantier) {
  const rows = [];
  for (const b of resolveBuildings(chantier)) {
    const batiment = getBuildingLetter(b);             // LETTRE (GO L2)
    for (const n of niveauxForConfig(b.config)) {
      rows.push({
        id: pieuvreId(chantier.num, batiment, n.niveau),
        chantierId: chantier.num,
        batiment,
        niveau: n.niveau,
        posteAvancementKey: n.posteAvancementKey,
      });
    }
  }
  return rows;
}

// ─── Libellé lisible d'un niveau ───────────────────────────────
export function niveauLabel(niveau) {
  if (niveau === "rdc") return "RDC";
  if (niveau === "combles") return "Combles";
  if (niveau.startsWith("ss")) return `Sous-sol ${niveau.slice(2)}`;
  if (niveau.startsWith("r"))  return `R+${niveau.slice(1)}`;
  return niveau;
}

// Le chantier a-t-il des bâtiments réellement configurés (≠ fallback) ?
export function hasRealBuildings(chantier) {
  return Array.isArray(chantier?.buildings) && chantier.buildings.length > 0;
}

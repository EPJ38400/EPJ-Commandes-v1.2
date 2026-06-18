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
  getChantierSousSols,
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

// ─── Config d'un SOUS-SOL COMMUN ──────────────────────────────
// La typologie d'un sous-sol commun est APLATIE sur l'item (ss.nbNiveaux),
// PAS rangée dans un sous-objet `config` (≠ buildings[].config). On reconstruit
// la même forme que l'avancement : cf. AvancementChantier qui lit
// `{ nbNiveaux: ss.nbNiveaux ?? 1 }` et la passe à getCategoriesForSousSol.
export function sousSolConfig(ss) {
  return { nbNiveaux: ss?.nbNiveaux ?? 1 };
}

// ─── Niveaux (= dalles) d'un SOUS-SOL COMMUN ───────────────────
// Un sous-sol commun ne porte QUE des niveaux de sous-sol (ss1→ssN) :
// aligné 1:1 sur avancementTasks.buildSousSolBetonTasks (poste `beton-dalle-ss*`),
// pas de RDC / étages / combles. Ordre ascendant ss1→ssN (comme niveauxForConfig).
export function niveauxForSousSol(cfg) {
  const nb = Number(cfg?.nbNiveaux || 0);
  const L = [];
  for (let i = 1; i <= nb; i++) L.push({ niveau: `ss${i}`, posteAvancementKey: `beton-dalle-ss${i}` });
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
  // Sous-sols communs : unités autonomes, batiment = ss.id (≠ lettres de
  // bâtiment → aucune collision d'ID `{chantierId}_{batiment}_{niveau}`).
  for (const ss of getChantierSousSols(chantier)) {
    for (const n of niveauxForSousSol(sousSolConfig(ss))) {
      rows.push({
        id: pieuvreId(chantier.num, ss.id, n.niveau),
        chantierId: chantier.num,
        batiment: ss.id,
        niveau: n.niveau,
        posteAvancementKey: n.posteAvancementKey,
        isSousSol: true,
        sousSolNom: ss.nom || "",
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

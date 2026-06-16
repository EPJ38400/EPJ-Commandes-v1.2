// ═══════════════════════════════════════════════════════════════
//  planningModel — logique PURE du Planning ressources (L8, socle M5/RH)
//
//  Aucune dépendance Firestore. Helpers : identité ressource, semaine,
//  ID déterministe de créneau, options de poste (réutilise la TAXONOMIE
//  M3 de avancement/avancementTasks.js — libellés JAMAIS réinventés).
//
//  Grounding vérifié :
//   • avancementProgress est keyé par building.id (cf. AvancementModule
//     `ch.avancementProgress?.[b.id]`), pas par la lettre.
//   • Le créneau stocke `batiment` = LETTRE affichée (getBuildingLetter),
//     pour lever l'ambiguïté "Dalle R1" entre bâtiments.
//   • ressourceId = user._id (doc id utilisateurs, ex. "Bilardo"). Les
//     tableaux d'affectation chantier stockent u.id → on matche les DEUX
//     (calque GestionChantierModule.isMyChantier).
// ═══════════════════════════════════════════════════════════════
import {
  resolveBuildings, getBuildingLetter, getCategoriesForConfig,
} from "../avancement/avancementTasks";

// ─── Constantes ────────────────────────────────────────────────
export const PERIODES = ["AM", "PM"];
export const PERIODE_LABEL = { AM: "Matin", PM: "Après-midi" };

// Lundi → Samedi (le BTP travaille parfois le samedi ; dimanche exclu).
export const WEEK_DAY_LABELS = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
export const NB_WEEK_DAYS = WEEK_DAY_LABELS.length;

// Rôles considérés comme « ressource planifiable » (= ligne du planning).
// Le Conducteur EST inclus (il tourne de chantier en chantier — GO L8).
export const TERRAIN_ROLES = [
  "Conducteur travaux", "Chef chantier", "Monteur", "Artisan",
];

export const RESSOURCE_TYPES = ["SALARIE", "INTERIM", "ARTISAN"];

// ─── Dates (string YYYY-MM-DD = clé d'ID stable, tri lexicographique) ──
function pad2(n) { return String(n).padStart(2, "0"); }

export function toISODate(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
export function fromISO(str) {
  return new Date(`${str}T00:00:00`);
}
export function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
// Lundi de la semaine contenant `d` (locale FR, lundi = 1er jour).
export function startOfWeek(d) {
  const r = new Date(d);
  const day = r.getDay();                 // 0=dim … 6=sam
  const diff = day === 0 ? -6 : 1 - day;  // recule jusqu'au lundi
  r.setDate(r.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}
// Colonnes de la semaine : [{ iso, dayLabel, dateLabel }]
export function weekColumns(mondayDate) {
  const cols = [];
  for (let i = 0; i < NB_WEEK_DAYS; i++) {
    const d = addDays(mondayDate, i);
    cols.push({
      iso: toISODate(d),
      dayLabel: WEEK_DAY_LABELS[i],
      dateLabel: `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`,
    });
  }
  return cols;
}
// Bornes string de la semaine [lundi … samedi] pour les ranges Firestore.
export function weekRange(mondayDate) {
  return { start: toISODate(mondayDate), end: toISODate(addDays(mondayDate, NB_WEEK_DAYS - 1)) };
}
export function weekLabel(mondayDate) {
  const last = addDays(mondayDate, NB_WEEK_DAYS - 1);
  return `${pad2(mondayDate.getDate())}/${pad2(mondayDate.getMonth() + 1)} – ${pad2(last.getDate())}/${pad2(last.getMonth() + 1)}`;
}

// ─── ID déterministe d'un créneau ──────────────────────────────
// {ressourceId}_{date}_{periode} → ex. "Bilardo_2026-06-17_AM"
export function creneauId(ressourceId, date, periode) {
  return `${ressourceId}_${date}_${periode}`;
}

// ─── Identité ressource ────────────────────────────────────────
export function rolesOf(u) {
  if (Array.isArray(u?.roles)) return u.roles;
  if (u?.role) return [u.role];
  return [];
}
export function isTerrainUser(u) {
  return rolesOf(u).some((r) => TERRAIN_ROLES.includes(r));
}
export function ressourceTypeOf(u) {
  // Confirmé GO L8 : Artisan → ARTISAN, sinon SALARIE.
  // INTERIM réservé dans l'enum mais sans source en base → non produit en L8.
  return rolesOf(u).includes("Artisan") ? "ARTISAN" : "SALARIE";
}
export function ressourceIdOf(u) {
  return u?._id || u?.id || "";
}
export function ressourceNomOf(u) {
  const n = `${u?.prenom || ""} ${u?.nom || ""}`.trim();
  return n || ressourceIdOf(u);
}
// Un user porte parfois `id` (champ data) ET `_id` (doc id) ; les tableaux
// d'affectation chantier stockent `id`. On expose les deux pour le matching.
function userIds(u) {
  return [u?._id, u?.id].filter(Boolean);
}

// ─── Liste des ressources (lignes du planning) ─────────────────
export function terrainResources(users) {
  return (users || [])
    .filter(isTerrainUser)
    .map((u) => ({
      id: ressourceIdOf(u),
      nom: ressourceNomOf(u),
      type: ressourceTypeOf(u),
      _matchIds: userIds(u),
    }))
    .filter((r) => r.id)
    .sort((a, b) => a.nom.localeCompare(b.nom));
}

// Ce chantier est-il « à moi » ? (calque GestionChantierModule.isMyChantier)
export function isMyChantier(user, c) {
  if (!user || !c) return false;
  const ids = userIds(user);
  const match = (v) => v != null && ids.includes(v);
  if (match(c.conducteurId)) return true;
  if (match(c.affectations?.conducteurId)) return true;
  if ((c.chefChantierIds || []).some(match)) return true;
  if ((c.monteurIds || []).some(match)) return true;
  if ((c.artisanIds || []).some(match)) return true;
  return false;
}

// Ressources affectées au périmètre du conducteur (ses chantiers) + lui-même.
export function resourcesForConductor(users, chantiers, user) {
  const myChantiers = (chantiers || []).filter((c) => isMyChantier(user, c));
  const affectedIds = new Set();
  for (const c of myChantiers) {
    if (c.conducteurId) affectedIds.add(c.conducteurId);
    (c.chefChantierIds || []).forEach((i) => affectedIds.add(i));
    (c.monteurIds || []).forEach((i) => affectedIds.add(i));
    (c.artisanIds || []).forEach((i) => affectedIds.add(i));
  }
  userIds(user).forEach((i) => affectedIds.add(i)); // le conducteur est une ligne
  return terrainResources(users).filter(
    (r) => r._matchIds.some((i) => affectedIds.has(i)),
  );
}

// ─── Options de poste (picker) — réutilise la TAXONOMIE M3 ─────
// Retourne, par bâtiment du chantier :
//   { lettre, buildingId, label, postes: [{ key (slug), label, color }] }
// postes = slugs RÉELLEMENT présents dans avancementProgress[building.id],
// libellés + ordonnés via getCategoriesForConfig (jamais de libellé en dur).
export function chantierPlanningOptions(chantier, tasksConfig) {
  if (!chantier) return [];
  const override = chantier.avancementTasksOverride;
  return resolveBuildings(chantier).map((b) => {
    const lettre = getBuildingLetter(b);
    const progress = chantier.avancementProgress?.[b.id] || {};
    const present = new Set(Object.keys(progress));
    const cats = getCategoriesForConfig(b.config, tasksConfig, override, b.id);

    const postes = [];
    const seen = new Set();
    // 1) Ordre/ libellés de la taxonomie, filtré aux slugs présents.
    for (const cat of cats) {
      for (const t of cat.tasks || []) {
        if (present.has(t.id)) {
          postes.push({ key: t.id, label: t.label, color: cat.color });
          seen.add(t.id);
        }
      }
    }
    // 2) Slugs présents mais hors taxonomie courante (config modifiée) :
    //    libellé brut, en queue — on n'invente rien.
    for (const slug of present) {
      if (!seen.has(slug)) postes.push({ key: slug, label: slug, color: null });
    }
    return { lettre, buildingId: b.id, label: `Bâtiment ${lettre}`, postes };
  });
}

// Libellé lisible d'un poste depuis sa clé, pour un chantier+lettre donnés.
export function posteLabel(chantier, batiment, posteKey, tasksConfig) {
  if (!posteKey) return "";
  const groups = chantierPlanningOptions(chantier, tasksConfig);
  const g = groups.find((x) => x.lettre === batiment) || groups[0];
  const p = g?.postes.find((x) => x.key === posteKey);
  return p ? p.label : posteKey;
}

// ─── Couleur de pastille par chantier (déterministe, tokens) ───
// Palette empruntée aux tokens EPJ (importée côté composant pour éviter
// d'importer le thème dans ce module pur — on renvoie un index stable).
const CHANTIER_PALETTE_SIZE = 8;
export function chantierColorIndex(chantierId) {
  if (!chantierId) return 0;
  let h = 0;
  for (let i = 0; i < chantierId.length; i++) {
    h = (h * 31 + chantierId.charCodeAt(i)) >>> 0;
  }
  return h % CHANTIER_PALETTE_SIZE;
}

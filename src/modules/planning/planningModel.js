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
  getCategoriesForSousSol, getChantierSousSols,
} from "../avancement/avancementTasks";

// ─── Constantes ────────────────────────────────────────────────
export const PERIODES = ["AM", "PM"];
export const PERIODE_LABEL = { AM: "Matin", PM: "Après-midi" };

// Lundi → Vendredi (samedi/dimanche exclus — L8b).
export const WEEK_DAY_LABELS = ["Lun.", "Mar.", "Mer.", "Jeu.", "Ven."];
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

// ─── Options de poste (picker) — réutilise la TAXONOMIE M3 (v2) ─
// Libellés courts par cat.id (taxo v2). Source unique de vérité.
const SHORT_CAT = {
  etude: "Étude", beton: "Béton", divers: "Divers", placo: "Placo",
  logements: "Logement", communs: "Commun", "courant-faible": "Courant faible",
  controle: "Contrôle", ssequip: "Sous-sol",
};

// Anti-doublon : ne préfixe pas si le libellé tâche commence déjà par la cat
// courte (ex. "Placo RDC" reste "Placo RDC", pas "Placo — Placo RDC").
function prefixedLabel(catShort, taskLabel) {
  if (!catShort) return taskLabel;
  return taskLabel.toLowerCase().startsWith(catShort.toLowerCase())
    ? taskLabel
    : `${catShort} — ${taskLabel}`;
}

function buildUnit({ unite, label, type, cats }) {
  const categories = [];
  const postesFlat = [];
  for (const cat of cats) {
    const tasks = cat.tasks || [];
    if (tasks.length === 0) continue;
    const short = SHORT_CAT[cat.id] || "";
    categories.push({
      catId: cat.id, catLabel: short || cat.label, color: cat.color,
      postes: tasks.map((t) => ({ key: t.id, label: t.label })),
    });
    for (const t of tasks) {
      postesFlat.push({
        key: t.id, label: prefixedLabel(short, t.label),
        catLabel: short || cat.label, color: cat.color,
      });
    }
  }
  return { unite, label, type, categories, postesFlat };
}

// getPosteOptions : TOUTE la taxonomie générée selon la config (SANS intersection
// avec avancementProgress → un poste est toujours choisissable), bâtiments +
// sous-sols communs. Libellés "Cat — Tâche". posteAvancementKey reste = t.id.
export function getPosteOptions(chantier, tasksConfig) {
  if (!chantier) return [];
  const override = chantier.avancementTasksOverride;
  const units = [];
  for (const b of resolveBuildings(chantier)) {
    const lettre = getBuildingLetter(b);
    units.push(buildUnit({
      unite: lettre, label: `Bâtiment ${lettre}`, type: "BAT",
      cats: getCategoriesForConfig(b.config, tasksConfig, override, b.id),
    }));
  }
  // ⚠️ resolveBuildings n'énumère PAS les sous-sols communs → on les ajoute.
  for (const ss of getChantierSousSols(chantier)) {
    units.push(buildUnit({
      unite: ss.id, label: `Sous-sol commun${ss.nom ? " " + ss.nom : ""}`, type: "SS",
      cats: getCategoriesForSousSol(ss.config, tasksConfig, override, ss.id),
    }));
  }
  return units;
}

// Libellé complet "Cat — Tâche" d'un poste, pour une unité (lettre OU ss.id) donnée.
export function posteLabel(chantier, batiment, posteKey, tasksConfig) {
  if (!posteKey) return "";
  const units = getPosteOptions(chantier, tasksConfig);
  const u = units.find((x) => x.unite === batiment) || units[0];
  const p = u?.postesFlat.find((x) => x.key === posteKey);
  return p ? p.label : posteKey;
}

// ─── Slots de demi-journée (0..NB_WEEK_DAYS*2-1) ───────────────
export function slotIndex(dayIdx, periode) {
  return dayIdx * 2 + (periode === "AM" ? 0 : 1);
}
export function slotToCell(idx) {
  return { dayIdx: Math.floor(idx / 2), periode: idx % 2 === 0 ? "AM" : "PM" };
}
export function expandRange(fromSlot, toSlot) {
  const a = Math.min(fromSlot, toSlot), b = Math.max(fromSlot, toSlot);
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

// ─── Heures ────────────────────────────────────────────────────
// Demi-journée : 4 h (Lun–Jeu) ; 3,5 h (Ven, dayIdx 4). Jour = 8 h / 7 h Ven.
export function demiJourneeHeures(dayIdx) {
  return dayIdx === 4 ? 3.5 : 4;
}
export function weeklyTotalHours(resourceId, weekCols, creneauMap) {
  let total = 0;
  for (let dayIdx = 0; dayIdx < weekCols.length; dayIdx++) {
    for (const p of PERIODES) {
      const cr = creneauMap.get(creneauId(resourceId, weekCols[dayIdx].iso, p));
      if (cr?.chantierId) {
        total += cr.tempsEstimeH != null ? Number(cr.tempsEstimeH) : demiJourneeHeures(dayIdx);
      }
    }
  }
  return total;
}

// ─── Regroupement créneaux → barres (rendu) ────────────────────
// Fusionne les slots contigus de même chantier + bâtiment + poste.
function barKey(cr) {
  return `${cr.chantierId}|${cr.batiment || ""}|${cr.posteAvancementKey || ""}`;
}
export function rowSegments(resourceId, weekCols, creneauMap) {
  const nbSlots = weekCols.length * 2;
  const slots = [];
  for (let i = 0; i < nbSlots; i++) {
    const { dayIdx, periode } = slotToCell(i);
    slots.push(creneauMap.get(creneauId(resourceId, weekCols[dayIdx].iso, periode)) || null);
  }
  const segments = [];
  let i = 0;
  while (i < nbSlots) {
    const cr = slots[i];
    if (!cr?.chantierId) { segments.push({ kind: "empty", start: i, end: i }); i++; continue; }
    const key = barKey(cr);
    let j = i, hours = 0;
    const creneaux = [];
    while (j < nbSlots && slots[j]?.chantierId && barKey(slots[j]) === key) {
      creneaux.push(slots[j]);
      const { dayIdx } = slotToCell(j);
      hours += slots[j].tempsEstimeH != null ? Number(slots[j].tempsEstimeH) : demiJourneeHeures(dayIdx);
      j++;
    }
    segments.push({
      kind: "bar", start: i, end: j - 1,
      chantierId: cr.chantierId, batiment: cr.batiment || null,
      posteAvancementKey: cr.posteAvancementKey || null,
      hours, creneaux,
    });
    i = j;
  }
  return segments;
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

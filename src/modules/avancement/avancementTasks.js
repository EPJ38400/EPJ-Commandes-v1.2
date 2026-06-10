import { EPJ } from "../../core/theme";
// ═══════════════════════════════════════════════════════════════
//  Catalogue des tâches d'avancement — 3 couches
//  1. FACTORY (dans le code, ci-dessous, jamais perdu)
//  2. MODÈLE GLOBAL (Firestore tasksConfig/default) — modifiable par l'admin
//  3. OVERRIDE PAR CHANTIER (chantier.avancementTasksOverride)
//
//  Tâches de certaines catégories sont GÉNÉRÉES (béton, placo) selon la
//  typologie bâtiment. Les autres catégories sont 100% éditables.
// ═══════════════════════════════════════════════════════════════

// ─── 1. FACTORY (modèle d'usine, jamais perdu) ──────────────────
// Les catégories "beton" et "placo" sont générées dynamiquement
// (leurs tâches dépendent de la config bâtiment), donc pas listées ici.

export const FACTORY_CATEGORIES = [
  {
    id: "etude", num: 1, label: "ÉTUDE / TMA", color: EPJ.catEtude,
    generated: false,
    tasks: [
      { id: "etude-1", label: "Préparation du dossier chantier" },
      { id: "etude-2", label: "Demande de renseignement autre lot" },
      { id: "etude-3", label: "Réservation" },
      { id: "etude-4", label: "TMA" },
    ],
  },
  {
    id: "beton", num: 2, label: "INCORPORATION BÉTON", color: EPJ.gray500,
    generated: "beton", // généré selon la config
    tasks: [], // généré
  },
  {
    id: "divers", num: 3, label: "AVANCEMENT DIVERS", color: EPJ.orange,
    generated: false,
    tasks: [
      { id: "divers-1", label: "Installation de chantier" },
      { id: "divers-2", label: "Équipement sous-sol (Lustrerie / bloc secours)" },
      { id: "divers-3", label: "Chemin de câble" },
      { id: "divers-4", label: "Préparation des gaines techniques" },
      { id: "divers-5", label: "Préparation avant doublage" },
      { id: "divers-6", label: "Amorce colonne" },
      { id: "divers-7", label: "Pose coffret de Façade" },
    ],
  },
  {
    id: "placo", num: 4, label: "AVANCEMENT PLACO", color: EPJ.red,
    generated: "placo",
    tasks: [],
  },
  {
    id: "logements", num: 5, label: "ÉQUIPEMENT DES LOGEMENTS", color: EPJ.blue,
    generated: false,
    tasks: [
      { id: "log-1",  label: "Appareillage" },
      { id: "log-2",  label: "Appareillage courant faible" },
      { id: "log-3",  label: "DCL" },
      { id: "log-4",  label: "ECL balcon" },
      { id: "log-5",  label: "Étier interphone" },
      { id: "log-6",  label: "Tableau" },
      { id: "log-7",  label: "Tableau de communication" },
      { id: "log-8",  label: "Interphone" },
      { id: "log-9",  label: "Porte de tableau + Plaque de finition" },
      { id: "log-10", label: "Essai + Ampoule" },
      { id: "log-11", label: "Contrôle qualité" },
      { id: "log-12", label: "Pose DB + Platine" },
    ],
  },
  {
    id: "communs", num: 6, label: "ÉQUIPEMENT DES COMMUNS", color: EPJ.blue,
    generated: false,
    tasks: [
      { id: "com-1",  label: "Colonne Montante + colonne de terre" },
      { id: "com-2",  label: "Colonne service généraux" },
      { id: "com-3",  label: "Colonne interphone" },
      { id: "com-4",  label: "Colonne Fibre" },
      { id: "com-5",  label: "Colonne TV + pose des antennes" },
      { id: "com-6",  label: "Appareillage" },
      { id: "com-7",  label: "Armoire des services généraux" },
      { id: "com-8",  label: "Interphone" },
      { id: "com-9",  label: "Lustrerie coursive" },
      { id: "com-10", label: "Lustrerie escalier" },
      { id: "com-11", label: "Lustrerie extérieur" },
      { id: "com-12", label: "Essai" },
      { id: "com-13", label: "Contrôle qualité" },
    ],
  },
  {
    id: "controle", num: 7, label: "CONTRÔLE ET MISE EN SERVICE", color: EPJ.green,
    generated: false,
    tasks: [
      { id: "ctrl-1", label: "Pré Réception colonne ENEDIS" },
      { id: "ctrl-2", label: "Réception colonne ENEDIS" },
      { id: "ctrl-3", label: "Réception colonne ORANGE" },
      { id: "ctrl-4", label: "Consuel" },
      { id: "ctrl-5", label: "Mise en service colonne" },
      { id: "ctrl-6", label: "Mise en service groupé" },
    ],
  },
];

// ─── Catégories éditables (celles qui ne sont pas générées) ────
export const EDITABLE_CATEGORY_IDS = FACTORY_CATEGORIES
  .filter(c => !c.generated)
  .map(c => c.id);

// ─── Génération BÉTON selon la typologie ───────────────────────
function buildBetonTasks(cfg) {
  const tasks = [{ id: "beton-radier", label: "Radier" }];
  const ss = Number(cfg?.nbSousSols || 0);
  const et = Number(cfg?.nbEtages || 0);
  const combles = !!cfg?.combles;

  for (let i = ss; i >= 1; i--) {
    const suffix = ss > 1 ? ` ${i}` : "";
    tasks.push({ id: `beton-mur-ss${i}`,   label: `Mur Sous-sol${suffix}` });
    tasks.push({ id: `beton-dalle-ss${i}`, label: `Dalle Sous-sol${suffix}` });
  }
  tasks.push({ id: "beton-mur-rdc",   label: "Mur RDC" });
  tasks.push({ id: "beton-dalle-rdc", label: "Dalle RDC" });
  for (let i = 1; i <= et; i++) {
    tasks.push({ id: `beton-mur-r${i}`,   label: `Mur R+${i}` });
    tasks.push({ id: `beton-dalle-r${i}`, label: `Dalle R+${i}` });
  }
  if (combles) tasks.push({ id: "beton-combles", label: `Combles R+${et + 1}` });
  return tasks;
}

// ─── Génération PLACO selon la typologie ───────────────────────
function buildPlacoTasks(cfg) {
  const tasks = [];
  const ss = Number(cfg?.nbSousSols || 0);
  const et = Number(cfg?.nbEtages || 0);
  for (let i = ss; i >= 1; i--) {
    const suffix = ss > 1 ? ` ${i}` : "";
    tasks.push({ id: `placo-ss${i}`, label: `Sous-sol${suffix}` });
  }
  tasks.push({ id: "placo-rdc", label: "RDC" });
  for (let i = 1; i <= et; i++) {
    tasks.push({ id: `placo-r${i}`, label: `R+${i}` });
  }
  return tasks;
}

// ─── Génération des tâches d'un SOUS-SOL COMMUN ────────────────
// cfg = { nbNiveaux }
// Un sous-sol commun ne porte QUE les niveaux de sous-sol :
// pas de radier (il reste sur le bâtiment), pas de RDC / étages.
function buildSousSolBetonTasks(cfg) {
  const tasks = [];
  const nb = Number(cfg?.nbNiveaux || 0);
  for (let i = nb; i >= 1; i--) {
    const suffix = nb > 1 ? ` ${i}` : "";
    tasks.push({ id: `beton-mur-ss${i}`,   label: `Mur Sous-sol${suffix}` });
    tasks.push({ id: `beton-dalle-ss${i}`, label: `Dalle Sous-sol${suffix}` });
  }
  return tasks;
}
function buildSousSolPlacoTasks(cfg) {
  const tasks = [];
  const nb = Number(cfg?.nbNiveaux || 0);
  for (let i = nb; i >= 1; i--) {
    const suffix = nb > 1 ? ` ${i}` : "";
    tasks.push({ id: `placo-ss${i}`, label: `Sous-sol${suffix}` });
  }
  return tasks;
}

// Équipement d'un sous-sol commun (catégorie éditable par chantier)
export const SOUSSOL_EQUIP_TASKS = [
  { id: "ssequip-1", label: "Chemin de câble" },
  { id: "ssequip-2", label: "Éclairage / Lustrerie" },
  { id: "ssequip-3", label: "Bloc secours (BAES)" },
  { id: "ssequip-4", label: "Équipement box / garage" },
  { id: "ssequip-5", label: "Détection / commande" },
  { id: "ssequip-6", label: "Essai + Contrôle qualité" },
];

// Catégories d'un sous-sol commun : béton + placo (générés) + équipement (éditable)
function buildSousSolCategories(cfg) {
  return [
    { id: "beton",   num: 2, label: "INCORPORATION BÉTON",  color: EPJ.gray500, generated: "beton", tasks: buildSousSolBetonTasks(cfg) },
    { id: "placo",   num: 4, label: "AVANCEMENT PLACO",     color: EPJ.red, generated: "placo", tasks: buildSousSolPlacoTasks(cfg) },
    { id: "ssequip", num: 6, label: "ÉQUIPEMENT SOUS-SOL",  color: EPJ.blue, generated: false,   tasks: SOUSSOL_EQUIP_TASKS },
  ];
}

// ─── Fusion FACTORY + MODÈLE GLOBAL ─────────────────────────────
// Le modèle global peut :
//   - Modifier le label d'une tâche existante
//   - Ajouter des tâches (avec id custom)
//   - Supprimer des tâches (en les absentant)
// Le modèle global stocke chaque catégorie comme : { tasks: [...] }
function mergeWithGlobalModel(factory, globalModel) {
  if (!globalModel || !globalModel.categories) return factory;
  return factory.map(cat => {
    const override = globalModel.categories[cat.id];
    if (!override || !Array.isArray(override.tasks)) return cat;
    // Les catégories générées ne sont pas modifiables au niveau modèle global
    if (cat.generated) return cat;
    return { ...cat, tasks: override.tasks };
  });
}

// ─── Fusion avec override CHANTIER ──────────────────────────────
function mergeWithChantierOverride(categories, chantierOverride, buildingId) {
  if (!chantierOverride) return categories;
  const byBuilding = chantierOverride[buildingId] || chantierOverride._all || null;
  if (!byBuilding || !byBuilding.categories) return categories;
  return categories.map(cat => {
    const override = byBuilding.categories[cat.id];
    if (!override || !Array.isArray(override.tasks)) return cat;
    return { ...cat, tasks: override.tasks };
  });
}

// ─── Retourne toutes les catégories pour un chantier/bâtiment ──
// cfg = typologie du bâtiment (sous-sols, étages, combles)
// tasksConfig = modèle global depuis Firestore
// chantierOverride = chantier.avancementTasksOverride
// buildingId = "A" / "B" / "C"... (pour cibler l'override)
export function getCategoriesForConfig(cfg, tasksConfig, chantierOverride, buildingId) {
  // Bâtiment rattaché à un sous-sol commun : ses tâches de sous-sol privées sont
  // MASQUÉES (nbSousSols forcé à 0 pour la génération uniquement). nbSousSols n'est
  // jamais muté en base, donc l'opération est réversible au détachement.
  const genCfg = getSousSolIdFromConfig(cfg) != null ? { ...cfg, nbSousSols: 0 } : cfg;

  // 1. FACTORY (génère les tâches dynamiques)
  let cats = FACTORY_CATEGORIES.map(cat => {
    if (cat.generated === "beton") return { ...cat, tasks: buildBetonTasks(genCfg) };
    if (cat.generated === "placo") return { ...cat, tasks: buildPlacoTasks(genCfg) };
    return cat;
  });

  // 2. Applique le modèle global
  cats = mergeWithGlobalModel(cats, tasksConfig);

  // 3. Applique l'override chantier
  cats = mergeWithChantierOverride(cats, chantierOverride, buildingId);

  return cats;
}

// ─── Catégories d'un SOUS-SOL COMMUN (unité de suivi autonome) ──
// cfg = { nbNiveaux } ; ssId = clé de l'unité (override / progress keyés dessus)
export function getCategoriesForSousSol(cfg, tasksConfig, chantierOverride, ssId) {
  let cats = buildSousSolCategories(cfg);
  cats = mergeWithGlobalModel(cats, tasksConfig);
  cats = mergeWithChantierOverride(cats, chantierOverride, ssId);
  return cats;
}

// ─── Pour l'édition du modèle global ─────────────────────────────
// Retourne les catégories éditables avec leurs tâches (après modèle global)
export function getEditableCategoriesForModel(tasksConfig) {
  const cats = FACTORY_CATEGORIES.filter(c => !c.generated);
  return mergeWithGlobalModel(cats, tasksConfig);
}

// ─── Pour l'édition par chantier ─────────────────────────────────
// Retourne TOUTES les catégories (éditables + générées en read-only)
export function getCategoriesForChantierEdit(cfg, tasksConfig, chantierOverride, buildingId) {
  return getCategoriesForConfig(cfg, tasksConfig, chantierOverride, buildingId);
}

// ─── Calculs ────────────────────────────────────────────────────
export function categoryProgress(category, progressData) {
  if (!category.tasks || category.tasks.length === 0) return 0;
  let sum = 0, count = 0;
  for (const t of category.tasks) {
    sum += Number(progressData?.[t.id] || 0);
    count++;
  }
  return count > 0 ? Math.round(sum / count) : 0;
}

function overallFromCats(cats, progressData) {
  let sum = 0, count = 0;
  for (const cat of cats) {
    for (const t of cat.tasks) {
      sum += Number(progressData?.[t.id] || 0);
      count++;
    }
  }
  return count > 0 ? Math.round(sum / count) : 0;
}

export function overallProgress(cfg, progressData, tasksConfig, chantierOverride, buildingId) {
  return overallFromCats(
    getCategoriesForConfig(cfg, tasksConfig, chantierOverride, buildingId),
    progressData,
  );
}

export function overallProgressSousSol(cfg, progressData, tasksConfig, chantierOverride, ssId) {
  return overallFromCats(
    getCategoriesForSousSol(cfg, tasksConfig, chantierOverride, ssId),
    progressData,
  );
}

export const DEFAULT_BUILDING_CONFIG = {
  nbSousSols: 1, nbEtages: 3, combles: false,
};

export const DEFAULT_SOUSSOL_CONFIG = { nbNiveaux: 1 };

// ─── Lettre / id technique de bâtiment ──────────────────────────
// On découple l'id technique (clé STABLE de stockage de l'avancement,
// jamais modifiée) de la lettre affichée (éditable). Fallback sur l'id
// pour les bâtiments existants qui n'ont pas encore de champ `lettre`.
export function getBuildingLetter(building) {
  return building?.lettre || building?.id || "?";
}
// id technique stable pour un nouveau bâtiment (la lettre, elle, reste libre/éditable)
export function generateBuildingId() {
  return `bat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Helpers sous-sol commun ───────────────────────────────────
// sousSolId reste un SCALAIRE en V1. Passer systématiquement par ce helper
// permettra de le faire évoluer vers un tableau plus tard sans toucher aux appelants.
export function getSousSolIdFromConfig(config) {
  const v = config?.sousSolId;
  return v == null ? null : v;
}
export function getBuildingSousSolId(building) {
  return getSousSolIdFromConfig(building?.config);
}
export function getChantierSousSols(chantier) {
  return Array.isArray(chantier?.sousSolsCommuns) ? chantier.sousSolsCommuns : [];
}
// Liste des bâtiments d'un chantier, avec le bâtiment "A" par défaut si aucun
export function resolveBuildings(chantier) {
  return chantier?.buildings && chantier.buildings.length > 0
    ? chantier.buildings
    : [{ id: "A", lettre: "A", label: "", config: DEFAULT_BUILDING_CONFIG }];
}
export function generateSousSolId() {
  return `ss-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Génère un ID unique pour une nouvelle tâche ────────────────
export function generateTaskId(categoryId) {
  return `${categoryId}-custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Génère un ID unique pour une nouvelle session d'heures ─────
export function generateSessionId() {
  return `sess-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Total d'heures pour une liste de sessions ──────────────────
export function totalHoursFromSessions(sessions) {
  if (!Array.isArray(sessions)) return 0;
  return sessions.reduce((sum, s) => sum + (Number(s?.hours) || 0), 0);
}

// ─── Total d'heures sur un bâtiment complet ─────────────────────
export function totalHoursForBuilding(sessionsMap, legacyHoursMap) {
  // sessionsMap = { taskId: [{hours, ...}] }
  // legacyHoursMap = { taskId: hours } (rétrocompat v6)
  let total = 0;
  const seenTasks = new Set();
  if (sessionsMap) {
    for (const taskId in sessionsMap) {
      total += totalHoursFromSessions(sessionsMap[taskId]);
      seenTasks.add(taskId);
    }
  }
  // Pour les tâches qui n'ont PAS de sessions mais un legacyHours, on l'ajoute
  if (legacyHoursMap) {
    for (const taskId in legacyHoursMap) {
      if (!seenTasks.has(taskId)) {
        total += Number(legacyHoursMap[taskId]) || 0;
      }
    }
  }
  return total;
}

// ─── Total d'heures pour une tâche (avec fallback legacy) ───────
export function totalHoursForTask(sessions, legacyHours) {
  const sessionsTotal = totalHoursFromSessions(sessions);
  if (sessionsTotal > 0 || (Array.isArray(sessions) && sessions.length > 0)) {
    return sessionsTotal;
  }
  return Number(legacyHours) || 0;
}

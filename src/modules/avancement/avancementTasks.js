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
    id: "etude", num: 1, label: "ÉTUDE / TMA", color: "#8E44AD",
    generated: false,
    tasks: [
      { id: "etude-1", label: "Préparation du dossier chantier" },
      { id: "etude-2", label: "Demande de renseignement autre lot" },
      { id: "etude-3", label: "Réservation" },
      { id: "etude-4", label: "TMA" },
    ],
  },
  {
    id: "beton", num: 2, label: "INCORPORATION BÉTON", color: "#6B6B6B",
    generated: "beton", // généré selon la config
    tasks: [], // généré
  },
  {
    id: "divers", num: 3, label: "AVANCEMENT DIVERS", color: "#F5841F",
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
    id: "placo", num: 4, label: "AVANCEMENT PLACO", color: "#E53935",
    generated: "placo",
    tasks: [],
  },
  {
    id: "logements", num: 5, label: "ÉQUIPEMENT DES LOGEMENTS", color: "#00A3E0",
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
    id: "communs", num: 6, label: "ÉQUIPEMENT DES COMMUNS", color: "#00A3E0",
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
    id: "controle", num: 7, label: "CONTRÔLE ET MISE EN SERVICE", color: "#A8C536",
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
// v10.E : nouveau paramètre `skipSousSols` qui supprime les sous-sols
// pour les bâtiments qui ne sont PAS celui qui héberge le sous-sol commun.
function buildBetonTasks(cfg, skipSousSols = false) {
  const tasks = [{ id: "beton-radier", label: "Radier" }];
  const ss = Number(cfg?.nbSousSols || 0);
  const et = Number(cfg?.nbEtages || 0);
  const combles = !!cfg?.combles;

  if (!skipSousSols) {
    for (let i = ss; i >= 1; i--) {
      const suffix = ss > 1 ? ` ${i}` : "";
      tasks.push({ id: `beton-mur-ss${i}`,   label: `Mur Sous-sol${suffix}` });
      tasks.push({ id: `beton-dalle-ss${i}`, label: `Dalle Sous-sol${suffix}` });
    }
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
function buildPlacoTasks(cfg, skipSousSols = false) {
  const tasks = [];
  const ss = Number(cfg?.nbSousSols || 0);
  const et = Number(cfg?.nbEtages || 0);
  if (!skipSousSols) {
    for (let i = ss; i >= 1; i--) {
      const suffix = ss > 1 ? ` ${i}` : "";
      tasks.push({ id: `placo-ss${i}`, label: `Sous-sol${suffix}` });
    }
  }
  tasks.push({ id: "placo-rdc", label: "RDC" });
  for (let i = 1; i <= et; i++) {
    tasks.push({ id: `placo-r${i}`, label: `R+${i}` });
  }
  return tasks;
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
//
// v10.E — buildings = liste complète des bâtiments du chantier (optionnelle).
// Si un autre bâtiment est marqué "sousSolCommun", alors le bâtiment courant
// (s'il n'est PAS celui-ci) ne doit pas afficher de sous-sols dans béton/placo.
export function getCategoriesForConfig(cfg, tasksConfig, chantierOverride, buildingId, buildings) {
  // Détermine si on doit masquer les sous-sols pour CE bâtiment
  let skipSousSols = false;
  if (Array.isArray(buildings) && buildings.length > 1) {
    const commun = buildings.find(b => b?.config?.sousSolCommun === true);
    if (commun && commun.id !== buildingId) {
      // Un autre bâtiment porte le sous-sol commun → pas de sous-sols ici
      skipSousSols = true;
    }
  }

  // 1. FACTORY (génère les tâches dynamiques)
  let cats = FACTORY_CATEGORIES.map(cat => {
    if (cat.generated === "beton") return { ...cat, tasks: buildBetonTasks(cfg, skipSousSols) };
    if (cat.generated === "placo") return { ...cat, tasks: buildPlacoTasks(cfg, skipSousSols) };
    return cat;
  });

  // 2. Applique le modèle global
  cats = mergeWithGlobalModel(cats, tasksConfig);

  // 3. Applique l'override chantier
  cats = mergeWithChantierOverride(cats, chantierOverride, buildingId);

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
export function getCategoriesForChantierEdit(cfg, tasksConfig, chantierOverride, buildingId, buildings) {
  return getCategoriesForConfig(cfg, tasksConfig, chantierOverride, buildingId, buildings);
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

export function overallProgress(cfg, progressData, tasksConfig, chantierOverride, buildingId, buildings) {
  const cats = getCategoriesForConfig(cfg, tasksConfig, chantierOverride, buildingId, buildings);
  let sum = 0, count = 0;
  for (const cat of cats) {
    for (const t of cat.tasks) {
      sum += Number(progressData?.[t.id] || 0);
      count++;
    }
  }
  return count > 0 ? Math.round(sum / count) : 0;
}

export const DEFAULT_BUILDING_CONFIG = {
  nbSousSols: 1, nbEtages: 3, combles: false, sousSolCommun: false,
};

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

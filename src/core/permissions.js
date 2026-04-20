// ═══════════════════════════════════════════════════════════════
//  EPJ App Globale — Système de permissions à 3 COUCHES
//  1. FACTORY (DEFAULT_PERMISSIONS, code, jamais perdu)
//  2. OVERRIDE DE RÔLE (Firestore : rolesConfig/{role})
//  3. OVERRIDE UTILISATEUR (user.permissionsOverride)
// ═══════════════════════════════════════════════════════════════

export const ROLES = [
  "Admin", "Direction", "Conducteur travaux", "Assistante",
  "Chef chantier", "Monteur", "Artisan",
];

export const MODULES = [
  "commandes", "parc-machines", "avancement",
  "reserves-quitus", "suivi-esabora",
];

export const DASHBOARDS = ["direction", "conducteur", "public"];
export const ACTIONS    = ["view", "create", "edit", "delete", "validate", "export"];

export const MODULE_LABELS = {
  commandes: "Commandes",
  "parc-machines": "Parc machines",
  avancement: "Avancement chantier",
  "reserves-quitus": "Réserves & quitus",
  "suivi-esabora": "Suivi chantier",
};

export const ACTION_LABELS = {
  view: "Voir", create: "Créer", edit: "Modifier",
  delete: "Supprimer", validate: "Valider", export: "Exporter",
};

export const SCOPE_LABELS = {
  all: "Tout", own_chantiers: "Mes chantiers", own_items: "Mes éléments",
};

// ─── FACTORY (valeurs usine) ────────────────────────────────────
export const DEFAULT_PERMISSIONS = {
  Admin: {
    commandes:         { _access:"all", view:"all", create:"all", edit:"all", delete:"all", validate:"all", export:"all" },
    "parc-machines":   { _access:"all", view:"all", create:"all", edit:"all", delete:"all", export:"all" },
    avancement:        { _access:"all", view:"all", create:"all", edit:"all", delete:"all", validate:"all", export:"all" },
    "reserves-quitus": { _access:"all", view:"all", create:"all", edit:"all", delete:"all", validate:"all", export:"all" },
    "suivi-esabora":   { _access:"all", view:"all", create:"all", edit:"all", delete:"all", export:"all" },
    _dashboards: { direction:true, conducteur:true, public:true },
    _admin: true,
  },
  Direction: {
    commandes:         { _access:"all", view:"all", create:"all", edit:"all", delete:false, validate:"all", export:"all" },
    "parc-machines":   { _access:"all", view:"all", create:"all", edit:"all", delete:false, export:"all" },
    avancement:        { _access:"all", view:"all", create:"all", edit:"all", delete:false, validate:"all", export:"all" },
    "reserves-quitus": { _access:"all", view:"all", create:"all", edit:"all", delete:false, validate:"all", export:"all" },
    "suivi-esabora":   { _access:"all", view:"all", create:"all", edit:"all", delete:false, export:"all" },
    _dashboards: { direction:true, conducteur:true, public:true },
    _admin: false,
  },
  "Conducteur travaux": {
    commandes:         { _access:"all", view:"own_chantiers", create:"all", edit:"own_items", delete:false, validate:"own_chantiers", export:"own_chantiers" },
    "parc-machines":   { _access:"all", view:"all", create:"all", edit:"own_chantiers", delete:false, export:"own_chantiers" },
    avancement:        { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_chantiers", delete:false, validate:"own_chantiers", export:"own_chantiers" },
    "reserves-quitus": { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_chantiers", delete:false, validate:"own_chantiers", export:"own_chantiers" },
    "suivi-esabora":   { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_chantiers", delete:false, export:"own_chantiers" },
    _dashboards: { direction:false, conducteur:true, public:true },
    _admin: false,
  },
  Assistante: {
    commandes:         { _access:"all", view:"all", create:"all", edit:"all", delete:false, validate:false, export:"all" },
    "parc-machines":   { _access:"all", view:"all", create:"all", edit:"all", delete:false, export:"all" },
    avancement:        { _access:"all", view:"all", create:false, edit:false, delete:false, validate:false, export:"all" },
    "reserves-quitus": { _access:"all", view:"all", create:"all", edit:"all", delete:false, validate:false, export:"all" },
    "suivi-esabora":   { _access:"all", view:"all", create:"all", edit:"all", delete:false, export:"all" },
    _dashboards: { direction:false, conducteur:false, public:true },
    _admin: false,
  },
  "Chef chantier": {
    commandes:         { _access:"all", view:"own_chantiers", create:"all", edit:"own_items", delete:false, validate:false, export:false },
    "parc-machines":   { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_chantiers", delete:false, export:false },
    avancement:        { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_chantiers", delete:false, validate:false, export:false },
    "reserves-quitus": { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_chantiers", delete:false, validate:false, export:false },
    "suivi-esabora":   { _access:"all", view:"own_chantiers", create:false, edit:false, delete:false, export:false },
    _dashboards: { direction:false, conducteur:false, public:true },
    _admin: false,
  },
  Monteur: {
    commandes:         { _access:"all", view:"own_items", create:"all", edit:"own_items", delete:false, validate:false, export:false },
    "parc-machines":   { _access:"all", view:"own_chantiers", create:false, edit:false, delete:false, export:false },
    avancement:        { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_items", delete:false, validate:false, export:false },
    "reserves-quitus": { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_items", delete:false, validate:false, export:false },
    "suivi-esabora":   { _access:false },
    _dashboards: { direction:false, conducteur:false, public:true },
    _admin: false,
  },
  Artisan: {
    commandes:         { _access:false },
    "parc-machines":   { _access:false },
    avancement:        { _access:"all", view:"own_chantiers", create:false, edit:false, delete:false, validate:false, export:false },
    "reserves-quitus": { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_items", delete:false, validate:false, export:false },
    "suivi-esabora":   { _access:false },
    _dashboards: { direction:false, conducteur:false, public:false },
    _admin: false,
  },
};

// ─── Utilitaires ────────────────────────────────────────────────
const SCOPE_RANK = { "all":3, "own_chantiers":2, "own_items":1, false:0, undefined:0 };
function mostPermissive(a, b) {
  return (SCOPE_RANK[a] || 0) >= (SCOPE_RANK[b] || 0) ? a : b;
}

export function getRoles(user) {
  if (!user) return [];
  if (Array.isArray(user.roles) && user.roles.length > 0) return user.roles;
  if (user.role)    return [user.role];
  if (user.fonction) return [legacyRoleFromFonction(user.fonction)];
  return ["Monteur"];
}

// Fusionne FACTORY + override de rôle Firestore
export function getEffectiveRolePerms(roleName, rolesConfig) {
  const factory = DEFAULT_PERMISSIONS[roleName] || {};
  const override = rolesConfig?.[roleName] || null;
  if (!override) return factory;

  // Deep merge factory + override
  const merged = JSON.parse(JSON.stringify(factory));
  for (const key of Object.keys(override)) {
    const val = override[key];
    if (val === null || val === undefined) continue;
    if (typeof val === "object" && !Array.isArray(val)) {
      merged[key] = { ...(merged[key] || {}), ...val };
    } else {
      merged[key] = val;
    }
  }
  return merged;
}

// can() : résout les 3 couches, couche la plus spécifique gagne
export function can(user, module, action, rolesConfig = null) {
  if (!user) return false;

  const userRoles = getRoles(user);
  const userOverride = user.permissionsOverride || {};

  // ── _admin ──
  if (module === "_admin") {
    if (userOverride._admin !== undefined) return userOverride._admin;
    return userRoles.some(r => getEffectiveRolePerms(r, rolesConfig)._admin === true);
  }

  // ── _dashboards ──
  if (module === "_dashboards") {
    const ovDash = userOverride._dashboards || {};
    if (action in ovDash) return !!ovDash[action];
    return userRoles.some(r => getEffectiveRolePerms(r, rolesConfig)._dashboards?.[action] === true);
  }

  // ── Module métier : override user ? ──
  const ovModule = userOverride[module];
  if (ovModule === "all")   return "all";
  if (ovModule === false)   return false;
  if (ovModule && typeof ovModule === "object" && action in ovModule) {
    return ovModule[action];
  }

  // Cumul au + permissif parmi les rôles (après override de rôle DB)
  let bestScope = false;
  for (const role of userRoles) {
    const perms = getEffectiveRolePerms(role, rolesConfig);
    const mod = perms[module];
    if (!mod) continue;
    const scope = mod[action];
    if (scope === undefined) continue;
    bestScope = mostPermissive(bestScope, scope);
  }
  return bestScope;
}

export function legacyRoleFromFonction(fonction) {
  if (!fonction) return "Monteur";
  const f = fonction.toLowerCase();
  if (f.includes("admin"))      return "Admin";
  if (f.includes("direct"))     return "Direction";
  if (f.includes("conducteur")) return "Conducteur travaux";
  if (f.includes("assist"))     return "Assistante";
  if (f.includes("chef"))       return "Chef chantier";
  if (f.includes("artisan"))    return "Artisan";
  return "Monteur";
}

export function rolesLabel(user) {
  const roles = getRoles(user);
  if (roles.length === 0) return "—";
  if (roles.length === 1) return roles[0];
  if (roles.length === 2) return roles.join(" + ");
  return `${roles[0]} + ${roles.length - 1} autres`;
}

export function hasRoleOverride(roleName, rolesConfig) {
  return !!(rolesConfig?.[roleName]);
}

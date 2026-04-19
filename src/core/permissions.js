// ═══════════════════════════════════════════════════════════════
//  EPJ App Globale — Système de permissions
//  - Rôles MULTIPLES par utilisateur (user.roles = [...])
//  - Matrice par défaut rôle × module × action
//  - Surcharge utilisateur (permissionsOverride) au-dessus des rôles
// ═══════════════════════════════════════════════════════════════

// Les 7 rôles officiels de l'EPJ App
export const ROLES = [
  "Admin",
  "Direction",
  "Conducteur travaux",
  "Assistante",
  "Chef chantier",
  "Monteur",
  "Artisan",
];

// Les 5 modules métier
export const MODULES = [
  "commandes",
  "parc-machines",
  "avancement",
  "reserves-quitus",
  "suivi-esabora",
];

// Les 3 dashboards
export const DASHBOARDS = ["direction", "conducteur", "public"];

// Actions standardisées
export const ACTIONS = ["view", "create", "edit", "delete", "validate", "export"];

// Scopes possibles
export const SCOPES = {
  ALL: "all",
  OWN_CHANTIERS: "own_chantiers",
  OWN_ITEMS: "own_items",
  NONE: false,
};

// Libellés jolis pour les modules (utilisés dans l'UI Admin)
export const MODULE_LABELS = {
  commandes:         "Commandes",
  "parc-machines":   "Parc machines",
  avancement:        "Avancement chantier",
  "reserves-quitus": "Réserves & quitus",
  "suivi-esabora":   "Suivi chantier",
};

export const ACTION_LABELS = {
  view:     "Voir",
  create:   "Créer",
  edit:     "Modifier",
  delete:   "Supprimer",
  validate: "Valider",
  export:   "Exporter",
};

export const SCOPE_LABELS = {
  all:            "Tout",
  own_chantiers:  "Mes chantiers",
  own_items:      "Mes éléments",
};

// ─── MATRICE PAR DÉFAUT ─────────────────────────────────────────
export const DEFAULT_PERMISSIONS = {
  Admin: {
    commandes:         { _access:"all", view:"all", create:"all", edit:"all", delete:"all", validate:"all", export:"all" },
    "parc-machines":   { _access:"all", view:"all", create:"all", edit:"all", delete:"all", export:"all" },
    avancement:        { _access:"all", view:"all", create:"all", edit:"all", delete:"all", validate:"all", export:"all" },
    "reserves-quitus": { _access:"all", view:"all", create:"all", edit:"all", delete:"all", validate:"all", export:"all" },
    "suivi-esabora":   { _access:"all", view:"all", create:"all", edit:"all", delete:"all", export:"all" },
    _dashboards:       { direction:true, conducteur:true, public:true },
    _admin:            true,
  },
  Direction: {
    commandes:         { _access:"all", view:"all", create:"all", edit:"all", delete:false, validate:"all", export:"all" },
    "parc-machines":   { _access:"all", view:"all", create:"all", edit:"all", delete:false, export:"all" },
    avancement:        { _access:"all", view:"all", create:"all", edit:"all", delete:false, validate:"all", export:"all" },
    "reserves-quitus": { _access:"all", view:"all", create:"all", edit:"all", delete:false, validate:"all", export:"all" },
    "suivi-esabora":   { _access:"all", view:"all", create:"all", edit:"all", delete:false, export:"all" },
    _dashboards:       { direction:true, conducteur:true, public:true },
    _admin:            false,
  },
  "Conducteur travaux": {
    commandes:         { _access:"all", view:"own_chantiers", create:"all", edit:"own_items", delete:false, validate:"own_chantiers", export:"own_chantiers" },
    "parc-machines":   { _access:"all", view:"all", create:"all", edit:"own_chantiers", delete:false, export:"own_chantiers" },
    avancement:        { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_chantiers", delete:false, validate:"own_chantiers", export:"own_chantiers" },
    "reserves-quitus": { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_chantiers", delete:false, validate:"own_chantiers", export:"own_chantiers" },
    "suivi-esabora":   { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_chantiers", delete:false, export:"own_chantiers" },
    _dashboards:       { direction:false, conducteur:true, public:true },
    _admin:            false,
  },
  Assistante: {
    commandes:         { _access:"all", view:"all", create:"all", edit:"all", delete:false, validate:false, export:"all" },
    "parc-machines":   { _access:"all", view:"all", create:"all", edit:"all", delete:false, export:"all" },
    avancement:        { _access:"all", view:"all", create:false, edit:false, delete:false, validate:false, export:"all" },
    "reserves-quitus": { _access:"all", view:"all", create:"all", edit:"all", delete:false, validate:false, export:"all" },
    "suivi-esabora":   { _access:"all", view:"all", create:"all", edit:"all", delete:false, export:"all" },
    _dashboards:       { direction:false, conducteur:false, public:true },
    _admin:            false,
  },
  "Chef chantier": {
    commandes:         { _access:"all", view:"own_chantiers", create:"all", edit:"own_items", delete:false, validate:false, export:false },
    "parc-machines":   { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_chantiers", delete:false, export:false },
    avancement:        { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_chantiers", delete:false, validate:false, export:false },
    "reserves-quitus": { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_chantiers", delete:false, validate:false, export:false },
    "suivi-esabora":   { _access:"all", view:"own_chantiers", create:false, edit:false, delete:false, export:false },
    _dashboards:       { direction:false, conducteur:false, public:true },
    _admin:            false,
  },
  Monteur: {
    commandes:         { _access:"all", view:"own_items", create:"all", edit:"own_items", delete:false, validate:false, export:false },
    "parc-machines":   { _access:"all", view:"own_chantiers", create:false, edit:false, delete:false, export:false },
    avancement:        { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_items", delete:false, validate:false, export:false },
    "reserves-quitus": { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_items", delete:false, validate:false, export:false },
    "suivi-esabora":   { _access:false },
    _dashboards:       { direction:false, conducteur:false, public:true },
    _admin:            false,
  },
  Artisan: {
    commandes:         { _access:false },
    "parc-machines":   { _access:false },
    avancement:        { _access:"all", view:"own_chantiers", create:false, edit:false, delete:false, validate:false, export:false },
    "reserves-quitus": { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_items", delete:false, validate:false, export:false },
    "suivi-esabora":   { _access:false },
    _dashboards:       { direction:false, conducteur:false, public:false },
    _admin:            false,
  },
};

// ─── UTILITAIRES SCOPES ─────────────────────────────────────────
// Ordonne les scopes du plus permissif au plus restrictif.
// Quand un user a plusieurs rôles, on prend le scope le plus permissif.
const SCOPE_RANK = {
  "all":            3,
  "own_chantiers":  2,
  "own_items":      1,
  false:            0,
  undefined:        0,
};

function mostPermissive(a, b) {
  return (SCOPE_RANK[a] || 0) >= (SCOPE_RANK[b] || 0) ? a : b;
}

// ─── ROLES D'UN USER ────────────────────────────────────────────
// Retourne un tableau de rôles officiels pour un utilisateur donné.
// Priorité : user.roles (array) > user.role (string) > legacy user.fonction
export function getRoles(user) {
  if (!user) return [];
  if (Array.isArray(user.roles) && user.roles.length > 0) return user.roles;
  if (user.role) return [user.role];
  if (user.fonction) return [legacyRoleFromFonction(user.fonction)];
  return ["Monteur"];
}

// ─── FONCTION can() ─────────────────────────────────────────────
// Retourne le scope le plus permissif parmi tous les rôles de l'user,
// puis applique la surcharge user (permissionsOverride).
//
// Exemples :
//   can(user, "commandes", "validate")        → "all" | "own_chantiers" | false
//   can(user, "commandes", "_access")         → "all" | false
//   can(user, "_dashboards", "direction")     → true | false
//   can(user, "_admin")                       → true | false
export function can(user, module, action) {
  if (!user) return false;

  const userRoles = getRoles(user);
  const override = user.permissionsOverride || {};

  // ── _admin ──
  if (module === "_admin") {
    if (override._admin !== undefined) return override._admin;
    return userRoles.some(r => DEFAULT_PERMISSIONS[r]?._admin === true);
  }

  // ── _dashboards ──
  if (module === "_dashboards") {
    const overrideDash = override._dashboards || {};
    if (action in overrideDash) return !!overrideDash[action];
    return userRoles.some(r => DEFAULT_PERMISSIONS[r]?._dashboards?.[action] === true);
  }

  // ── Module métier ──
  const overrideModule = override[module];

  // Raccourcis surcharge
  if (overrideModule === "all")   return "all";
  if (overrideModule === false)   return false;

  // Surcharge fine (par action)
  if (overrideModule && typeof overrideModule === "object" && action in overrideModule) {
    return overrideModule[action];
  }

  // Sinon : on prend le scope le plus permissif parmi tous les rôles
  let bestScope = false;
  for (const role of userRoles) {
    const perms = DEFAULT_PERMISSIONS[role]?.[module];
    if (!perms) continue;
    const scope = perms[action];
    if (scope === undefined) continue;
    bestScope = mostPermissive(bestScope, scope);
  }
  return bestScope;
}

// ─── Compat V1.3 ────────────────────────────────────────────────
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

// ─── Helpers de scope ───────────────────────────────────────────
export function isInScope(scope, user, item, getChantierNum, getCreatorId) {
  if (scope === "all") return true;
  if (scope === false || scope === undefined) return false;
  if (scope === "own_items") {
    return getCreatorId(item) === user.id;
  }
  if (scope === "own_chantiers") {
    const chantierNum = getChantierNum(item);
    if (!chantierNum) return false;
    const myChantiers = user.chantierIds || [];
    return myChantiers.includes(chantierNum);
  }
  return false;
}

// ─── Libellé compact des rôles d'un user ───────────────────────
export function rolesLabel(user) {
  const roles = getRoles(user);
  if (roles.length === 0) return "—";
  if (roles.length === 1) return roles[0];
  if (roles.length === 2) return roles.join(" + ");
  return `${roles[0]} + ${roles.length - 1} autres`;
}

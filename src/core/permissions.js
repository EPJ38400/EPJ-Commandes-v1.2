// ═══════════════════════════════════════════════════════════════
//  EPJ App Globale — Système de permissions
//  Matrice rôle × module × action + surcharge utilisateur
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

// Scopes possibles pour une action
// - "all"           : voit/agit sur tout
// - "own_chantiers" : seulement les chantiers où l'user est affecté
// - "own_items"     : seulement ce que l'user a créé
// - false           : interdit
export const SCOPES = { ALL: "all", OWN_CHANTIERS: "own_chantiers", OWN_ITEMS: "own_items", NONE: false };

// ─── MATRICE PAR DÉFAUT ─────────────────────────────────────────
// Clé : role → module → action → scope
// Module "_access" : droit d'ouvrir le module du tout (tuile visible)
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

// ─── FONCTION can() ─────────────────────────────────────────────
// Retourne le scope ("all" | "own_chantiers" | "own_items") ou false.
//
// Exemples :
//   can(user, "commandes", "validate")        → "all" | "own_chantiers" | false
//   can(user, "commandes", "_access")         → "all" | false
//   can(user, "_dashboards", "direction")     → true | false
//   can(user, "_admin")                       → true | false (accès Administration)
//
// La surcharge utilisateur (user.permissionsOverride) écrase la valeur par défaut
// au niveau le plus fin disponible :
//   permissionsOverride: {
//     commandes: { validate: "all" },       // remplace une seule action
//     "parc-machines": "all"                 // raccourci : module entier accessible
//   }
export function can(user, module, action) {
  if (!user) return false;

  const role = user.role || legacyRoleFromFonction(user.fonction);
  const defaults = DEFAULT_PERMISSIONS[role] || DEFAULT_PERMISSIONS.Monteur;
  const override = user.permissionsOverride || {};

  // Cas 1 : _admin (droit d'accès à la section Administration)
  if (module === "_admin") {
    if (override._admin !== undefined) return override._admin;
    return defaults._admin === true;
  }

  // Cas 2 : _dashboards (ex: can(user, "_dashboards", "direction"))
  if (module === "_dashboards") {
    const overrideDash = override._dashboards || {};
    if (action in overrideDash) return !!overrideDash[action];
    return !!(defaults._dashboards && defaults._dashboards[action]);
  }

  // Cas 3 : module métier
  const defaultModulePerms = defaults[module] || { _access: false };
  const overrideModule = override[module];

  // Raccourci : permissionsOverride.module = "all" ou false
  if (overrideModule === "all")   return action === "_access" ? "all" : "all";
  if (overrideModule === false)   return false;

  // Surcharge fine
  if (overrideModule && typeof overrideModule === "object" && action in overrideModule) {
    return overrideModule[action];
  }

  // Valeur par défaut du rôle
  if (action in defaultModulePerms) return defaultModulePerms[action];

  // Fallback : si on a _access=true pour le module mais l'action n'est pas définie,
  // on retourne false par sécurité (pas d'action non listée autorisée).
  return false;
}

// ─── COMPAT V1.3 ────────────────────────────────────────────────
// L'ancien code utilise user.fonction (ex: "Conducteur de travaux", "Ouvrier").
// Cette fonction fait le pont avec les 7 nouveaux rôles.
export function legacyRoleFromFonction(fonction) {
  if (!fonction) return "Monteur";
  const f = fonction.toLowerCase();
  if (f.includes("admin"))      return "Admin";
  if (f.includes("direct"))     return "Direction";
  if (f.includes("conducteur")) return "Conducteur travaux";
  if (f.includes("assist"))     return "Assistante";
  if (f.includes("chef"))       return "Chef chantier";
  if (f.includes("artisan"))    return "Artisan";
  return "Monteur"; // "Ouvrier" tombe ici par défaut
}

// ─── HELPERS DE SCOPE ───────────────────────────────────────────
// Filtre un item (commande, réserve…) selon le scope retourné par can()
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

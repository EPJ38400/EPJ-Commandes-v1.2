# PLAN L1 — Module 5 « Gestion de chantier » (création)

> **Statut : PLAN, aucun code écrit.** En attente de « GO permissions » (appliquer §3)
> puis « GO L1 » (implémenter module + route + tuile, commit+push
> `feature/m5-gestion-chantier`, URL preview + liste de clics à tester).
> `src/core/permissions.js` fait partie du **trio sensible** → GO écrit obligatoire.

---

## 1) Constat repo (vérifié dans le code, pas supposé)

**Stub M5 = clé `suivi-esabora`** (label « Suivi chantier »). Présent UNIQUEMENT à deux endroits :

- `src/core/permissions.js` :
  - `MODULES` → `"suivi-esabora"` (ligne 15)
  - `MODULE_LABELS` → `"suivi-esabora": "Suivi chantier"` (ligne 26)
  - `DEFAULT_PERMISSIONS` → 1 ligne `"suivi-esabora": {...}` par rôle
    (Admin 45, Direction 54, Conducteur 66, Assistante 75, Chef 85, Monteur 94, Artisan 103)
- `src/pages/HomePage.jsx` :
  - `MODULES_META` → `{ id:"suivi-esabora", title:"Suivi chantier", enabled:false }` (tuile grisée, lignes 56-63)

**Aucune route** dans `src/App.jsx` (pas de `"module:suivi-esabora"` ni équivalent).
**Aucun dossier** `src/modules/` pour M5. → C'est bien une **CRÉATION** ; le stub est
juste une entrée de permissions + une tuile désactivée.

`git diff origin/main` sur `permissions.js` / `App.jsx` / `HomePage.jsx` = **VIDE**
→ local == origin/main, base propre.

**Pattern module établi** (référence = `src/modules/avancement/AvancementModule.jsx`) :

- Landing = liste des chantiers filtrée par le scope de lecture :
  `viewScope = can(user, module, "view", rolesConfig)`
  - `"all"` → tous les chantiers actifs
  - `"own_chantiers"` → filtre via helper `isUserAffectedToChantier(user, c)`
- Détail ouvert par état interne `useState(selectedChantierNum)`, **pas** par route.
- Filtrage actifs : `c.statut !== "Archivé" && c.statut !== "Terminé"`.

**Branchement menu / routes** (trouvé) :

- `HomePage.jsx` : `visibleModules = MODULES_META.filter(can(user, permKey, "_access"))`.
  Tuile cliquée → `onOpenModule(id)`.
- `App.jsx` : `onOpenModule(mod)` → `setRoute(\`module:${mod}\`)`. Chaque route est
  branchée par : (a) lazy import en tête, (b) entrée dans `currentModule()`,
  (c) bloc `{route === "module:xxx" && <XxxModule .../>}` sous `<Suspense>`.

**Filtrage `own_chantiers`** (état réel) :

- `AvancementModule.isUserAffectedToChantier` teste `chantier.conducteurId === user.id`
  (+ `chefChantierIds` / `monteurIds` / `artisanIds`).
- ⚠️ **ÉCART RELEVÉ** : 2 conventions de stockage du conducteur coexistent —
  `chantier.conducteurId` (Avancement / AvancementChantier) ET
  `chantier.affectations?.conducteurId` (HomePage notifications, Réserves).
  Pour L1 je filtrerai sur les **DEUX** (`conducteurId` top-level + fallback
  `affectations.conducteurId`) pour ne rater aucun chantier. Lecture seule, on ne
  réconcilie pas la donnée ici. Signalé, à trancher plus tard.

---

## 2) Fichiers à créer / modifier

### Créer

- `src/modules/gestion-chantier/GestionChantierModule.jsx`
  Landing = liste chantiers. Scope `"own_chantiers"` filtré conducteur + toggle
  « Tout voir » si `can(...) === "all"`. Admin/Direction = tous. Réutilise
  `ModuleSubHeader` + `DataTable` / cartes PWA (calibre Avancement). Clic chantier
  → ouvre `ChantierFiche` (état interne).
- `src/modules/gestion-chantier/ChantierFiche.jsx`
  Fiche à onglets. Barre d'onglets **GATÉE** : un onglet n'apparaît que si
  `can(user, "gestionChantier.<clé>", "_access", rolesConfig)`. Contenu =
  placeholder « à venir » (coquille vide). 7 onglets : pieuvres, commandes,
  financier, suivi, gantt, tma, demarches.
  **AUCUNE écriture Firestore.** Lecture seule de `chantiers` (déjà en cache
  `DataContext`) — aucune nouvelle collection, aucun nouveau listener.

### Modifier

- `src/core/permissions.js` — **TRIO SENSIBLE** (diff exact en §3, GO requis).
- `src/App.jsx` — lazy import `GestionChantierModule` ; entrée `currentModule`
  (`"module:gestionChantier"` → « Gestion de chantier ») ; bloc de rendu
  `{route === "module:gestionChantier" && ...}`.
- `src/pages/HomePage.jsx` — remplacer la tuile `"suivi-esabora"` par
  `{ id:"gestionChantier", title:"Gestion de chantier", subtitle:"Chantiers, onglets & suivi", enabled:true }`.
  Le filtre de visibilité `can(user,"gestionChantier","_access")` marche déjà tel
  quel (pas de remap spécial à ajouter).

**Note nommage** : dossier en kebab `gestion-chantier/` (comme `parc-machines/`) ;
clé de permission + route en camelCase `gestionChantier` (= libellé de la spec +
clé permissions). Cohérent avec l'existant (dossier ≠ route possible).

---

## 3) Diff complet proposé pour `src/core/permissions.js`

> En L1 les onglets ne gèrent que la **VISIBILITÉ** (`_access`) + `view` (scope de la
> landing). `create`/`edit`/`delete`/`validate`/`export` par onglet viendront avec le
> contenu (lots L2+). Onglets fermés pour un rôle = clé **OMISE** → `can()` renvoie
> `false` naturellement.

### 3.a — `MODULES` : retirer `"suivi-esabora"`, ajouter ombrelle + 7 sous-clés

```diff
- export const MODULES = [
-   "commandes", "parc-machines", "avancement",
-   "reserves-quitus", "suivi-esabora",
- ];
+ export const MODULES = [
+   "commandes", "parc-machines", "avancement",
+   "reserves-quitus",
+   "gestionChantier",
+   "gestionChantier.pieuvres", "gestionChantier.commandes", "gestionChantier.financier",
+   "gestionChantier.suivi", "gestionChantier.gantt", "gestionChantier.tma",
+   "gestionChantier.demarches",
+ ];
```

### 3.b — `MODULE_LABELS` : retirer suivi-esabora, ajouter les 8 libellés

```diff
-   "suivi-esabora": "Suivi chantier",
+   gestionChantier: "Gestion de chantier",
+   "gestionChantier.pieuvres":  "Gestion chantier · Pieuvres",
+   "gestionChantier.commandes": "Gestion chantier · Suivi commandes",
+   "gestionChantier.financier": "Gestion chantier · Suivi financier",
+   "gestionChantier.suivi":     "Gestion chantier · Suivi de chantier",
+   "gestionChantier.gantt":     "Gestion chantier · Planning / Gantt",
+   "gestionChantier.tma":       "Gestion chantier · TMA",
+   "gestionChantier.demarches": "Gestion chantier · Démarches admin",
```

### 3.c — `DEFAULT_PERMISSIONS` : dans chaque rôle, remplacer la ligne `"suivi-esabora": {...}` par le bloc `gestionChantier`

**ADMIN** (remplace ligne 45) :

```diff
-   "suivi-esabora":   { _access:"all", view:"all", create:"all", edit:"all", delete:"all", export:"all" },
+   gestionChantier:             { _access:"all", view:"all", create:"all", edit:"all", delete:"all", validate:"all", export:"all" },
+   "gestionChantier.pieuvres":  { _access:"all", view:"all" },
+   "gestionChantier.commandes": { _access:"all", view:"all" },
+   "gestionChantier.financier": { _access:"all", view:"all" },
+   "gestionChantier.suivi":     { _access:"all", view:"all" },
+   "gestionChantier.gantt":     { _access:"all", view:"all" },
+   "gestionChantier.tma":       { _access:"all", view:"all" },
+   "gestionChantier.demarches": { _access:"all", view:"all" },
```

**DIRECTION** (remplace ligne 54 ; idem Admin, `delete:false` sur l'ombrelle) :

```diff
-   "suivi-esabora":   { _access:"all", view:"all", create:"all", edit:"all", delete:false, export:"all" },
+   gestionChantier:             { _access:"all", view:"all", create:"all", edit:"all", delete:false, validate:"all", export:"all" },
+   "gestionChantier.pieuvres":  { _access:"all", view:"all" },
+   "gestionChantier.commandes": { _access:"all", view:"all" },
+   "gestionChantier.financier": { _access:"all", view:"all" },
+   "gestionChantier.suivi":     { _access:"all", view:"all" },
+   "gestionChantier.gantt":     { _access:"all", view:"all" },
+   "gestionChantier.tma":       { _access:"all", view:"all" },
+   "gestionChantier.demarches": { _access:"all", view:"all" },
```

**CONDUCTEUR TRAVAUX** (remplace ligne 66 ; `gestionChantier.*` en `own_chantiers`) :

```diff
-   "suivi-esabora":   { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_chantiers", delete:false, export:"own_chantiers" },
+   gestionChantier:             { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_chantiers", delete:false, validate:"own_chantiers", export:"own_chantiers" },
+   "gestionChantier.pieuvres":  { _access:"all", view:"own_chantiers" },
+   "gestionChantier.commandes": { _access:"all", view:"own_chantiers" },
+   "gestionChantier.financier": { _access:"all", view:"own_chantiers" },
+   "gestionChantier.suivi":     { _access:"all", view:"own_chantiers" },
+   "gestionChantier.gantt":     { _access:"all", view:"own_chantiers" },
+   "gestionChantier.tma":       { _access:"all", view:"own_chantiers" },
+   "gestionChantier.demarches": { _access:"all", view:"own_chantiers" },
```

**ASSISTANTE** (remplace ligne 75 ; financier + demarches uniquement, autres onglets fermés = clés omises) :

```diff
-   "suivi-esabora":   { _access:"all", view:"all", create:"all", edit:"all", delete:false, export:"all" },
+   gestionChantier:             { _access:"all", view:"all", create:"all", edit:"all", delete:false, validate:false, export:"all" },
+   "gestionChantier.financier": { _access:"all", view:"all" },
+   "gestionChantier.demarches": { _access:"all", view:"all" },
```

**CHEF CHANTIER** (remplace ligne 85 ; fermé par défaut, ouvrable par `permissionsOverride` sur la fiche user) :

```diff
-   "suivi-esabora":   { _access:"all", view:"own_chantiers", create:false, edit:false, delete:false, export:false },
+   gestionChantier:             { _access:false },
```

**MONTEUR** (remplace ligne 94 ; pas d'accès au module ici) :

```diff
-   "suivi-esabora":   { _access:false },
+   gestionChantier:             { _access:false },
```

**ARTISAN** (remplace ligne 103 ; pas d'accès) :

```diff
-   "suivi-esabora":   { _access:false },
+   gestionChantier:             { _access:false },
```

### Pourquoi ce design

- `can()` traite `module` comme une clé string plate dans l'objet de perms du rôle
  → les sous-clés `"gestionChantier.<onglet>"` fonctionnent **SANS toucher à la
  logique de `can()`** (zéro modif du moteur du trio sensible).
- Ombrelle `"gestionChantier"` = gate la tuile + le landing (+ son `view` scope =
  filtrage `own_chantiers` de la liste). Chaque `"gestionChantier.<onglet>"` gate
  son onglet dans la fiche.
- Chef chantier : l'override utilisateur
  (`permissionsOverride["gestionChantier"]` + `["gestionChantier.financier"]`, etc.)
  ouvre les onglets choisis ; la couche override est résolue **AVANT** la factory
  dans `can()` → marche même sans entrée factory. Défaut = tout fermé.
- Onglets fermés (Assistante) omis volontairement → `can()` renvoie `false` ;
  diff plus court et lisible, comportement identique à une entrée `_access:false`.

---

## 4) Décision structure : module classique (comme `avancement/`), PAS de split N2

Je suis la structure module **ACTUELLE** : `src/modules/gestion-chantier/` avec
`GestionChantierModule.jsx` (landing) + `ChantierFiche.jsx` (onglets), responsive
PWA/desktop via `useViewport` — exactement le calibre d'`avancement/`.

**Pourquoi (pas de split pwa/desktop)** :

- CLAUDE.md §10 acte explicitement « arbre responsive **UNIQUE** (desktop + PWA même
  base, PAS d'archi deux arbres) » et §13 « chantier design : FERMÉ ».
- L'archi N2 (`pwa/` + `desktop/` + `core/`) est marquée **[S] = SPEC SEULEMENT**,
  zéro code en prod. L'introduire ici serait un écart non demandé au périmètre L1.
- Tous les modules existants (commandes, avancement, parc, réserves) vivent en
  module unique responsive — cohérence + zéro dette d'archi divergente.

---

**STOP — j'attends ton GO.** Rien n'est codé tant que « GO permissions » puis
« GO L1 » ne sont pas donnés. Aucun autre fichier touché.

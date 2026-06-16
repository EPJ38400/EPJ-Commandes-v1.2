# PLAN_L8 — Planning ressources (socle commun M5 / RH)

> Branche : `feature/planning-ressources` (neuve depuis `main`).
> **Étape 1 = ce plan. Aucun code tant que GO écrit non donné** (le diff
> `permissions.js` ci-dessous = TRIO SENSIBLE → relecture obligatoire).
> Grounding vérifié en direct dans le repo (refs citées). Build non lancé
> (aucun code écrit) — confirmation build en §6 = engagement de sortie de lot.

---

## 0. Décision d'architecture (rappel du brief, validé)

UNE page Planning, DEUX entrées sur **la même collection** `planningCreneaux`,
**le même composant** `PlanningGrid` :

| Entrée | Où | Filtre | Droit de visibilité |
|---|---|---|---|
| Globale | Tuile accueil → route `planning` | tous chantiers | `rh.planning` |
| Par chantier | Onglet dans `ChantierFiche` | `chantierId` figé | `gestionChantier.planning` |

Grille hebdo : lignes = ressources terrain, colonnes = jours × 2 demi-journées
(AM/PM), cellule = pastille couleur chantier. Filtre conducteur (ses
ressources / chantiers) + toggle « Tout voir ». Bouton « Copier S-1 ».
Clic sur créneau → modale d'affectation (chantier → bâtiment → POSTE optionnel
+ temps estimé). Vue Monteur = lecture seule de SES créneaux.

**Invariant dur** : écriture **uniquement** dans `planningCreneaux`. Lecture
seule de `chantiers` et `utilisateurs` (cache `DataContext`). Jamais d'écriture
`chantiers` → trio data intact.

---

## 1. Schéma `planningCreneaux` (spec §7.2 + champ `batiment`)

Collection racine. **ID déterministe** `{ressourceId}_{date}_{periode}`
(ex. `Bilardo_2026-06-17_AM`) → 1 ressource × 1 jour × 1 demi-journée = 1 doc,
idempotent, pas de doublon, `setDoc(..., {merge:true})`.

```
planningCreneaux/{ressourceId}_{date}_{periode}
  ressourceId          string   // = id fiche utilisateur (= nom de famille, clé utilisateurs/{id})
  ressourceNom         string   // libellé affiché (snapshot, lecture seule sur utilisateurs)
  ressourceType        "SALARIE" | "INTERIM" | "ARTISAN"
  date                 "YYYY-MM-DD"   // string, pas Timestamp → tri/range simples, clé d'ID stable
  periode              "AM" | "PM"
  chantierId           string | null  // = chantiers.num (n° Esabora 6 chiffres) ; null = dispo/non affecté
  batiment             string | null  // AJOUT vs spec : lettre bâtiment (getBuildingLetter) — lève l'ambiguïté "Dalle R1" entre bâtiments
  posteAvancementKey   string | null  // slug M3 (ex. "beton-dalle-r1") ; null = pas de poste précis
  tempsEstimeH         number | null  // heures estimées sur le créneau
  tacheId              null           // lien tâche ponctuelle = L7 → toujours null en L8
  etatValidationMonteur "NON"         // workflow validation = L9 → constante "NON" en L8
  smsEnvoye            false          // cron récap SMS = lot dédié → constante false en L8
  creePar              string   // uid ou id auteur
  modifiePar           string
  updatedAt            serverTimestamp()
```

Notes :
- `date` en **string `YYYY-MM-DD`** (pas Timestamp) : clé d'ID lisible, tri
  lexicographique = chronologique, ranges `>=`/`<=` sur la semaine sans piège
  de fuseau. Conversion ↔ `<input type="date">` triviale.
- `chantierId === chantiers.num` (même convention que `pieuvres.chantierId`,
  cf. `PieuvresTab` L86 `where("chantierId","==",chantier.num)`).
- Champs `tacheId`/`etatValidationMonteur`/`smsEnvoye` écrits dès L8 (constantes)
  pour figer le schéma → les lots L7/L9/SMS n'auront pas à migrer les docs.

---

## 2. Diff `permissions.js` exact (TRIO — GO ÉCRIT REQUIS)

Ref état actuel : `src/core/permissions.js` (lu en direct). Le modèle 3 couches,
`can()`, `getEffectiveRolePerms()` sont **inchangés** — on ajoute uniquement des
**clés** et des **entrées factory**. Aucune logique touchée.

### 2.1 `MODULES` (L13-20) — ajouts

```diff
 export const MODULES = [
   "commandes", "parc-machines", "avancement",
   "reserves-quitus",
   "gestionChantier",
   "gestionChantier.pieuvres", "gestionChantier.commandes", "gestionChantier.financier",
   "gestionChantier.suivi", "gestionChantier.gantt", "gestionChantier.tma",
   "gestionChantier.demarches",
+  "gestionChantier.planning",
+  // ─── Module RH (socle posé en L8 ; sous-clés conges/frais/analyse = scaffold
+  //     pour ne pas re-toucher le trio aux lots RH suivants) ───
+  "rh",
+  "rh.planning", "rh.conges", "rh.frais", "rh.analyse",
 ];
```

### 2.2 `MODULE_LABELS` (L25-38) — ajouts

```diff
   "gestionChantier.demarches": "Gestion chantier · Démarches admin",
+  "gestionChantier.planning":  "Gestion chantier · Planning ressources",
+  rh:            "RH",
+  "rh.planning": "RH · Planning ressources",
+  "rh.conges":   "RH · Congés / absences",
+  "rh.frais":    "RH · Notes de frais",
+  "rh.analyse":  "RH · Analyse / reporting",
 };
```

### 2.3 `DEFAULT_PERMISSIONS` — ajouts par rôle

Convention : la **sous-clé** (`rh.planning`, `gestionChantier.planning`) =
gate de **visibilité** (`_access` + `view`), exactement comme les autres
`gestionChantier.*`. La **capacité d'écriture** d'un créneau dérive du **module
parent de l'entrée** :
- entrée globale → `can(user,"rh","create"/"edit")`
- onglet chantier → `can(user,"gestionChantier","edit")` (déjà défini par rôle,
  rien à ajouter).

**Admin** (dans le bloc, après `gestionChantier.demarches`) :
```diff
     "gestionChantier.demarches": { _access:"all", view:"all" },
+    "gestionChantier.planning":  { _access:"all", view:"all" },
+    rh:            { _access:"all", view:"all", create:"all", edit:"all", delete:"all", validate:"all", export:"all" },
+    "rh.planning": { _access:"all", view:"all" },
+    "rh.conges":   { _access:"all", view:"all" },
+    "rh.frais":    { _access:"all", view:"all" },
+    "rh.analyse":  { _access:"all", view:"all" },
```

**Direction** (idem, `delete:false` sur le module rh) :
```diff
     "gestionChantier.demarches": { _access:"all", view:"all" },
+    "gestionChantier.planning":  { _access:"all", view:"all" },
+    rh:            { _access:"all", view:"all", create:"all", edit:"all", delete:false, validate:"all", export:"all" },
+    "rh.planning": { _access:"all", view:"all" },
+    "rh.conges":   { _access:"all", view:"all" },
+    "rh.frais":    { _access:"all", view:"all" },
+    "rh.analyse":  { _access:"all", view:"all" },
```

**Conducteur travaux** (scoped `own_chantiers`) :
```diff
     "gestionChantier.demarches": { _access:"all", view:"own_chantiers" },
+    "gestionChantier.planning":  { _access:"all", view:"own_chantiers" },
+    rh:            { _access:"all", view:"own_chantiers", create:"own_chantiers", edit:"own_chantiers", delete:false, validate:"own_chantiers", export:"own_chantiers" },
+    "rh.planning": { _access:"all", view:"own_chantiers" },
```
> `rh.conges/frais/analyse` **non accordés** au Conducteur en L8 (validation
> congés = L12, frais = lot frais). Les leur ouvrir plus tard = édition de
> valeurs (pas de nouvelle clé) → re-touche le fichier trio (GO requis à ce
> lot-là). Le scaffold structurel (clés + module rh) est fait maintenant ;
> seuls des **flags par rôle** restent à poser aux lots RH. Choix volontaire
> pour ne pas sur-provisionner des droits avant que la feature existe.

**Assistante** (`rh.*` complet, pas de validate/delete) :
```diff
     "gestionChantier.financier": { _access:"all", view:"all" },
     "gestionChantier.demarches": { _access:"all", view:"all" },
+    "gestionChantier.planning":  { _access:"all", view:"all" },
+    rh:            { _access:"all", view:"all", create:"all", edit:"all", delete:false, validate:false, export:"all" },
+    "rh.planning": { _access:"all", view:"all" },
+    "rh.conges":   { _access:"all", view:"all" },
+    "rh.frais":    { _access:"all", view:"all" },
+    "rh.analyse":  { _access:"all", view:"all" },
```

**Monteur** (lecture de SON planning uniquement → `own_items`, pas d'écriture) :
```diff
     gestionChantier:             { _access:false },
+    rh:            { _access:"all", view:"own_items", create:false, edit:false, delete:false, validate:false, export:false },
+    "rh.planning": { _access:"all", view:"own_items" },
```
> Le composant filtre `where("ressourceId","==", <id monteur>)` quand le scope
> résolu est `own_items` → il ne voit/charge que ses créneaux. `create:false`
> ⇒ modale d'affectation en lecture seule pour lui.

**Chef chantier** : **inchangé** (`gestionChantier:{_access:false}`, aucune clé
rh). Reste fermé par défaut ; ouverture éventuelle de l'onglet planning d'un
chantier = via `user.permissionsOverride` (mécanisme existant, par utilisateur),
sans toucher la factory.

**Achat** : **inchangé**. Pas de clé `rh` ni `gestionChantier.planning` →
`can()` renvoie `false` (sous-clé absente) → ni tuile ni onglet planning. Achat
garde son périmètre achats actuel.

**Artisan** : **inchangé** (fermé partout sauf avancement/réserves existants).

> Récap scopes résolus par `can()` : Admin/Direction/Assistante = `all` ;
> Conducteur = `own_chantiers` (écrit sur ses chantiers) ; Monteur = `own_items`
> (lecture seule des siens) ; Chef/Artisan/Achat = `false`.

---

## 3. Mapping slug → libellé M3 réutilisé (picker de poste)

**Source unique, NON réinventée** : `src/modules/avancement/avancementTasks.js`.

- `getCategoriesForConfig(cfg, tasksConfig, chantierOverride, buildingId)`
  (L221) retourne, pour la **config typologique d'un bâtiment**, les catégories
  avec leurs tâches `{ id (=slug), label }`. C'est la fabrique officielle des
  libellés (béton/placo générés dynamiquement + catégories éditables + override
  global `tasksConfig` + override chantier `avancementTasksOverride`).
- Bâtiments d'un chantier : `resolveBuildings(chantier)` (L333) ;
  lettre affichée : `getBuildingLetter(building)` (L311).

**Algorithme du picker** (pour le chantier du créneau) :
1. `for (building of resolveBuildings(chantier))` :
   - `lettre = getBuildingLetter(building)`
   - `cats = getCategoriesForConfig(building.config, tasksConfig, chantier.avancementTasksOverride, building.id)`
   - construire `slug→label` à plat depuis `cats[].tasks`
   - **filtrer** par les slugs **réellement présents** dans
     `chantier.avancementProgress?.[lettre]` (grounding : `avancementProgress`
     indexé par lettre bâtiment puis slug ; un bâtiment sans poste → liste vide,
     ex. BAT B).
2. Options groupées par catégorie M3 (label + couleur `cat.color` déjà tokenisée).
3. `posteAvancementKey` stocké = le **slug** ; `batiment` stocké = la **lettre**.
   À l'affichage on relibelle via la même fabrique (jamais de libellé en dur).

> `tasksConfig` (modèle global) : la collection `tasksConfig/default` est
> documentée « toujours absente » (CLAUDE §8) → `getCategoriesForConfig` tolère
> `tasksConfig = undefined` (fallback factory). On passe `undefined`/cache
> existant si `DataContext` ne l'expose pas — **à confirmer en impl** (sinon
> factory pure, ce qui est correct).
> Source des postes en L8 = **`avancementProgress` uniquement** (postes Gantt =
> L6, hors lot).

---

## 4. Fichiers créés / modifiés

### Créés — `src/modules/planning/`
| Fichier | Rôle |
|---|---|
| `planningModel.js` | constantes + helpers purs : `PERIODES=["AM","PM"]`, `creneauId(ressourceId,date,periode)`, math semaine (lundi→dimanche, navigation S±1, libellés jours), `RESSOURCE_TYPES`, `ressourceTypeOf(user)`, `isTerrainUser(user)`, `posteOptionsForChantier(chantier, tasksConfig)` (réutilise `avancementTasks.js`), conversions `date↔input`. **Aucun I/O.** |
| `PlanningGrid.jsx` | **composant cœur partagé**. Props `{ chantierId=null }`. `onSnapshot` sur `planningCreneaux` (query selon scope, cf. §5), lecture `utilisateurs`/`chantiers` via `useData`, grille hebdo responsive (DataTable/cartes calibre Pieuvres), pastilles couleur chantier, navigation semaine, « Copier S-1 », clic cellule → `AffectationModal`. Gating écriture via `can()`. Callback d'erreur `onSnapshot` (état « réessayer », calque `PieuvresTab`). |
| `PlanningPage.jsx` | entrée **globale** : filtre conducteur (ses ressources/chantiers) + toggle « Tout voir », `ModuleSubHeader`, rend `<PlanningGrid chantierId={null} />`. |
| `PlanningTab.jsx` | entrée **chantier** : thin wrapper rendu dans `ChantierFiche`, rend `<PlanningGrid chantierId={chantier.num} />`. |
| `AffectationModal.jsx` | modale clic-créneau : choix chantier (masqué/figé si `chantierId` fourni), bâtiment, picker POSTE (optionnel, §3), `tempsEstimeH`. `setDoc(merge:true)` sur `planningCreneaux`. Bouton « Libérer » (remet `chantierId=null`). Lecture seule si pas de droit write. |

### Modifiés (hors trio data)
| Fichier | Modif |
|---|---|
| `src/core/permissions.js` | **TRIO** — ajouts §2 uniquement. |
| `src/pages/HomePage.jsx` | nouvelle `PLANNING_TILE` (icône 📆), gatée `can(user,"rh.planning","_access",rolesConfig)`, `onClick → onOpenModule("planning")`. Insérée dans `allTiles` (calque `DASHBOARD_TILE`). |
| `src/App.jsx` | lazy `const PlanningPage = named(() => import("./modules/planning/PlanningPage"), "PlanningPage")` ; route `route === "planning"` → `<PlanningPage onExitModule={()=>setRoute("home")}/>` ; `currentModule` : `if (route==="planning") return "Planning"`. |
| `src/modules/gestion-chantier/ChantierFiche.jsx` | `TABS` : insérer `{ key:"planning", label:"Planning", icon:"📆" }` ; import + branchement `<PlanningTab chantier={chantier} />` (calque branche `pieuvres`/`commandes`). |
| `firestore.rules` | règle `planningCreneaux` (§5). |
| `firestore.indexes.json` | 2 index composites (§5). |

**Aucun fichier `.github/workflows/*`** touché (token sans scope workflow ;
le CI déploie déjà rules + indexes au push `main`).

---

## 5. Règle Firestore + index

### 5.1 `firestore.rules` — bloc `planningCreneaux`

À insérer près du bloc `pieuvres` (calque). Helpers existants : `isEmployee()`,
`isAssistante()` (= Admin/Direction/Conducteur/Assistante), `isConducteur()`.
`isChef()` **n'existe pas** → inclusion du Chef inline (write listé Chef au brief).

```
// ─── planningCreneaux/{id} — L8 Planning ressources (socle M5/RH) ──
// read : tout employé (le client borne le Monteur à ses créneaux, scope own_items).
// write : Conducteur/Direction/Admin/Assistante (isAssistante) + Chef chantier (inline).
// delete : Conducteur+ (libération/suppression d'un créneau).
match /planningCreneaux/{id} {
  allow read: if isEmployee();
  allow create, update: if isAssistante() || role() == "Chef chantier";
  allow delete: if isConducteur() || role() == "Chef chantier";
}
```
> Note : la sécurité « own_chantiers/own_items » est appliquée **côté client**
> via `can()` (même posture que `pieuvres`/`reserves` dans ce repo). Le rule est
> le plancher (employé authentifié). Le Monteur a `write:false` côté client →
> lecture seule effective ; le rule lui interdirait l'écriture de toute façon
> (ni isAssistante ni Chef).

### 5.2 `firestore.indexes.json` — 2 index composites

```json
{
  "collectionGroup": "planningCreneaux",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "chantierId", "order": "ASCENDING" },
    { "fieldPath": "date",       "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "planningCreneaux",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "ressourceId", "order": "ASCENDING" },
    { "fieldPath": "date",        "order": "ASCENDING" }
  ]
}
```

Requêtes par entrée :
- **Onglet chantier** : `where(chantierId==X) + where(date>=lundi) + where(date<=dimanche)` → index `(chantierId, date)`.
- **Vue Monteur (own_items)** : `where(ressourceId==me) + range date` → index `(ressourceId, date)`.
- **Vue globale Admin/Direction/Assistante** : `where(date>=lundi) + where(date<=dimanche)` → **range sur un seul champ**, auto-indexé, **pas de composite**.
- **Vue globale Conducteur (own_chantiers)** : range date globale puis **filtrage client** sur ses chantiers/ressources (le set de chantierId peut dépasser la limite `in` à 30 ; range+filtre client = robuste, calque du filtrage `GestionChantierModule`).

---

## 6. Confirmation des invariants (engagements de sortie de lot)

- ✅ **Écrit uniquement dans `planningCreneaux`** (`setDoc merge:true`). Aucune
  écriture `chantiers` ni `utilisateurs` (lecture seule via `DataContext`).
- ✅ **Trio data intact** : `chantiers` jamais mutée ; `CommandesInner.jsx` non
  touché ; `permissions.js` modifié **uniquement** par ajout de clés/entrées
  factory (§2), logique `can()` inchangée — **GO écrit requis sur ce diff**.
- ✅ **Aucun fichier `.github/workflows/*`** dans le commit.
- ✅ Rules + indexes déployés par le CI au push `main` (pas de `firebase deploy`
  manuel). Sans déploiement, la query reste en `permission-denied`/index-missing :
  filet de secours `firebase deploy --only firestore:rules,firestore:indexes`
  **avec GO** si CI non redéclenché.
- ✅ **Build** `npm run build` vert (engagement en fin de lot ; aucun code écrit
  à ce stade). `npm run audit:tokens` : nouveaux écrans en primitives/tokens DS
  (calibre Pieuvres), zéro `fontWeight` numérique.
- ✅ Différés respectés (NON faits en L8) : overlay congés grisé (L12), tâche
  ponctuelle (L7), validation monteur→avancement (L9), cron récap SMS + modèles
  (lot dédié). Drag-drop : **clic→affectation = must-have livré** ; DnD ajouté
  seulement s'il ne met pas le lot en risque, sinon phasé.

---

## 7. Points à confirmer en implémentation (non bloquants pour le GO plan)

1. **`ressourceType` INTERIM** : aucun champ source trouvé dans le repo
   (`AdminChantiers` bucketise par `roles` : Chef/Monteur/Artisan). Mapping L8 :
   rôle `Artisan` → `ARTISAN`, sinon `SALARIE` ; `INTERIM` réservé dans l'enum
   (posé si un futur flag `user.interim` existe). À valider avec PJ si une
   distinction intérim est attendue dès L8 (sinon SALARIE/ARTISAN suffisent).
2. **Liste des ressources terrain** = `utilisateurs` dont `roles` ∩ {Chef
   chantier, Monteur, Artisan} (calque `AdminChantiers` L41). Conducteur non
   listé comme ressource planifiable.
3. **`tasksConfig`** non exposé par `DataContext` aujourd'hui → picker en
   fallback factory (`getCategoriesForConfig(cfg, undefined, override, id)`),
   correct car `tasksConfig/default` est absent en prod.

---

**FIN — STOP.** En attente : (a) GO écrit sur le diff `permissions.js` (§2),
(b) GO global sur le plan. Aucun code ne sera écrit avant.

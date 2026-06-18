# PLAN — Module 5 « Gestion de chantier » + rôle Achat factory

> **Statut : PLAN, aucun code écrit.** `src/core/permissions.js` = **TRIO SENSIBLE**
> → j'attends **« GO permissions »** (appliquer §3) puis **« GO L1 »** (s'il reste
> du code applicatif à écrire — cf. §1, il n'en reste quasi pas).

---

## ⚠️ Écart brief ↔ réalité (à lire en premier)

Le brief décrit un **CONSTAT DÉJÀ ÉTABLI** d'un repo **pré-M5** (stub `suivi-esabora`
encore en place, pas de route, pas de dossier `src/modules/gestion-chantier/`).
**Ce constat est périmé.** Vérifié en direct :

- **M5 L1 est déjà développé ET mergé en prod** (commits `ee36482` permissions →
  `01c3d60` module/nav/onglets → `63d5d29` CLAUDE.md, tous sur `main`).
- Le fichier `PLAN_L1.md` à la racine **était le plan de ce même travail** — il a
  été exécuté. C'est lui que le brief décrit comme « à faire ».
- `grep -rn "suivi-esabora" src/ functions/` = **0 résultat** → stub déjà supprimé partout.

**Conséquence : sur les 3 points du périmètre, seul le point 2-bis (rôle Achat
factory) reste à faire.** Les points 1 (module/nav/onglets) et 2-principal
(gestionChantier dans permissions) sont **livrés**. Le point 3 (intégration admin)
**fonctionne déjà** sans code, car les écrans admin sont pilotés par les exports
de `permissions.js` (détail §4).

---

## 1) État réel vérifié (code lu, pas déduit)

### M5 « Gestion de chantier » — LIVRÉ en prod
| Élément | État | Preuve |
|---|---|---|
| Clé module `gestionChantier` + 7 sous-clés onglets | ✅ dans `permissions.js` | `MODULES` l.13-20, `MODULE_LABELS` l.30-37, `DEFAULT_PERMISSIONS` par rôle |
| Module `src/modules/gestion-chantier/` | ✅ existe | `GestionChantierModule.jsx` (landing) + `ChantierFiche.jsx` (onglets) |
| Route `module:gestionChantier` | ✅ branchée | `App.jsx` l.36 (lazy), l.123 (titre), l.186-187 (rendu sous `<Suspense>`) |
| Tuile HomePage | ✅ `enabled` | `HomePage.jsx` l.57 `id:"gestionChantier"` |
| Nav chantier-first + filtre `own_chantiers` + toggle « Tout voir » | ✅ | `GestionChantierModule.jsx` l.35-51, helper `isMyChantier` l.205-215 (teste `conducteurId` **ET** `affectations.conducteurId` + tableaux chef/monteur/artisan) |
| Onglets gatés `can(user,"gestionChantier.<clé>","_access")`, contenu = placeholder « à venir » | ✅ | `ChantierFiche.jsx` l.36-39 (gating), l.104-120 (coquille) |
| Lecture seule `chantiers`, aucune écriture / nouvelle collection | ✅ vérifié | les 2 fichiers ne lisent que `useData()`/prop `chantier`, zéro `setDoc`/`addDoc` |
| Filtre statuts actifs (exclut Archivé/Terminé) | ✅ | `GestionChantierModule.jsx` l.46-48 |

→ **Rien à recoder côté module L1.** Conforme au périmètre point 1.

### Rôle Achat — état réel
- **N'est PAS un rôle factory** : absent de `ROLES` (l.8-11) **et** de
  `DEFAULT_PERMISSIONS` (l.50-141). Confirmé.
- Existe **uniquement** comme override Firestore `rolesConfig/Achat` (d'après audit
  antérieur : `_admin:true`). ⚠️ **Contenu live de ce doc non relu dans cette
  session** (pas d'accès MCP Firestore ici) → à confirmer avant GO (cf. §3.d).
- À ne pas confondre avec le booléen **`directAchat`** déjà présent sur la fiche
  user (`AdminUsers.jsx` l.54, l.317-321 « 🟢 Achats directs (sans validation) ») :
  c'est un flag métier de circuit de validation, **pas** un rôle. On n'y touche pas.

### Routes / menu (pattern confirmé)
- `HomePage.jsx` : `MODULES_META` filtré par `can(user, permKey, "_access")`, clic → `onOpenModule(id)`.
- `App.jsx` : `onOpenModule(mod)` → `setRoute("module:"+mod)` → bloc `{route === ... && <Module/>}` sous `<Suspense>`. (gestionChantier déjà câblé.)

### Pages admin — comment la grille de droits est générée
- **`AdminRolesTypes.jsx`** (éditeur `rolesConfig/{role}`) : itère **`ROLES.map`**
  (l.110, l.235 `MODULES.map`). Admin verrouillé (l.113). Sauvegarde un **diff vs
  factory** (`computeDiff`, l.341) → ne stocke que l'écart, sinon `deleteDoc`.
- **`AdminUsers.jsx`** (fiche user) : sélecteur de rôle = **`ROLES.map`** (l.282),
  multi-rôles (cases à cocher). Écrit `roles[]` ; `fonction = roles[0]`.
- **`AdminRights.jsx`** (override par user `permissionsOverride`) : itère
  **`MODULES.map`** (l.175) → chaque module + chaque action éditable par cellule.
- **`functions/adminUsers.js`** : `assertAdmin` exige le claim `role === "Admin"`
  (l.42). **Aucune validation par liste blanche de rôles** : il accepte le `roles[]`
  reçu et pose le claim `role = roles[0]` (l.156-162, l.219-228). → **aucun setRole/
  enum à modifier** pour rendre « Achat » sélectionnable.

**Donc : tout l'admin est piloté par les exports `ROLES` / `MODULES` /
`MODULE_LABELS` de `permissions.js`.** Ajouter « Achat » à `ROLES` + un bloc
`DEFAULT_PERMISSIONS` suffit à le faire apparaître **partout** (rôles types +
sélecteur fiche user). `gestionChantier` + ses 7 sous-clés apparaissent **déjà**
dans les deux éditeurs (présents dans `MODULES`/`MODULE_LABELS`).

---

## 2) Fichiers à créer / modifier

### Créer
- **(aucun)** — le module L1 existe déjà.

### Modifier
- **`src/core/permissions.js`** — **TRIO SENSIBLE, GO requis** : ajouter `"Achat"`
  à `ROLES` + un bloc `DEFAULT_PERMISSIONS.Achat`. (Diff exact §3.) **Seul fichier
  touché par ce ticket.**

### Ne PAS toucher (fonctionne déjà / hors périmètre)
- `AdminRolesTypes.jsx`, `AdminUsers.jsx`, `AdminRights.jsx`, `functions/adminUsers.js`
  → data-driven, aucun changement nécessaire.
- `GestionChantierModule.jsx`, `ChantierFiche.jsx`, `App.jsx`, `HomePage.jsx` → L1 livré.
- `firestore.rules` → L1 lecture seule, rôle Achat factory ne crée pas de collection ⇒ rien.
- Champ `directAchat` → distinct, intact.

---

## 3) Diff complet proposé pour `src/core/permissions.js`

> Périmètre = **uniquement l'ajout du rôle Achat**. La partie `gestionChantier`
> (MODULES / MODULE_LABELS / blocs par rôle) est **déjà en place** — aucun diff dessus.

### 3.a — `ROLES` : ajouter « Achat »

Placement entre Assistante et Chef chantier (proximité fonctionnelle bureau) :

```diff
  export const ROLES = [
-   "Admin", "Direction", "Conducteur travaux", "Assistante",
-   "Chef chantier", "Monteur", "Artisan",
+   "Admin", "Direction", "Conducteur travaux", "Assistante", "Achat",
+   "Chef chantier", "Monteur", "Artisan",
  ];
```

### 3.b — `DEFAULT_PERMISSIONS` : ajouter le bloc `Achat`

À insérer après le bloc `Assistante` (l.112), avant `"Chef chantier"` :

```diff
  Assistante: {
    ...
    _admin: false,
  },
+ Achat: {
+   commandes:         { _access:"all", view:"all", create:"all", edit:"all", delete:false, validate:"all", export:"all" },
+   "parc-machines":   { _access:"all", view:"all", create:false, edit:false, delete:false, export:"all" },
+   avancement:        { _access:"all", view:"all", create:false, edit:false, delete:false, validate:false, export:"all" },
+   "reserves-quitus": { _access:false },
+   gestionChantier:             { _access:"all", view:"all", create:false, edit:false, delete:false, validate:false, export:"all" },
+   "gestionChantier.commandes": { _access:"all", view:"all" },
+   "gestionChantier.financier": { _access:"all", view:"all" },
+   _dashboards: { direction:false, conducteur:false, public:true },
+   _admin: true,
+ },
  "Chef chantier": {
```

**Justification du bloc** (le rôle Achat = pilotage achats / dashboard `achat@`) :
- `commandes` = cœur de son métier → plein accès, `delete:false` (aligné Direction/Assistante).
- `gestionChantier` ombrelle ouverte mais **seuls les onglets `commandes` (suivi
  AR) + `financier` ouverts** (les autres onglets = clés omises → `can()` = `false`,
  même logique que l'Assistante). Cohérent avec « accès gestionChantier adapté ».
- `parc-machines` / `avancement` = lecture + export (visibilité chantier sans édition).
- `reserves-quitus` fermé (hors périmètre achat).
- `_admin:true` = aligné sur l'override `rolesConfig/Achat` existant (accès écrans
  admin contacts fournisseurs notamment). ⚠️ voir §3.d.

### 3.c — Interaction avec l'override `rolesConfig/Achat` existant
`getEffectiveRolePerms` fait **factory + override** (override gagne par clé, l.158-175).
Donc après ajout du factory :
- les clés que l'override définit déjà → **inchangées** (override prioritaire) ⇒
  **zéro régression** pour les users Achat actuels ;
- les clés que l'override **n'a pas** (typiquement `gestionChantier.*`, postérieur
  à la création de l'override) → **héritées du nouveau factory** ⇒ l'Achat gagne
  l'accès gestionChantier voulu.

### 3.d — ⚠️ À confirmer avant d'appliquer (1 point)
Je n'ai **pas relu le contenu live de `rolesConfig/Achat`** dans cette session.
Avant GO, **confirme-moi** (ou je le relis via MCP Firestore si tu me le demandes) :
le bloc factory ci-dessus doit **refléter l'intention** de l'override pour qu'à
terme un « Remettre aux valeurs usine » dans AdminRolesTypes donne un résultat
identique. Si l'override live diffère (ex. droits commandes différents), j'ajuste
le factory en conséquence. **Sans confirmation, je propose le bloc ci-dessus comme
base raisonnable** — il ne casse rien (override prioritaire), il ne fait qu'ajouter
un socle propre + l'accès gestionChantier.

---

## 4) Module + onglets + rôle Achat éditables dans l'admin existant

**Rien à coder** — vérifié dans le code :

| Cible | Où ça apparaît | Mécanisme |
|---|---|---|
| Rôle **Achat** dans éditeur rôles types | `AdminRolesTypes.jsx` | `ROLES.map` (l.110) → Achat listé dès qu'il est dans `ROLES` ; éditable + `computeDiff` vs nouveau factory |
| Rôle **Achat** dans fiche user | `AdminUsers.jsx` | `ROLES.map` (l.282) → case à cocher sélectionnable ; `adminUsers.js` accepte sans enum (claim `role=roles[0]`) |
| Module **gestionChantier** + 7 onglets dans éditeur rôles types | `AdminRolesTypes.jsx` | `MODULES.map` (l.235) + `MODULE_LABELS` → déjà présents (à plat, libellés « Gestion chantier · … ») |
| idem dans override par user | `AdminRights.jsx` | `MODULES.map` (l.175) → chaque sous-clé éditable par cellule (`_access` + actions) |

**Rendu « à plat »** (pas de groupe visuel parent/enfant) : c'est le pattern actuel
de l'UI admin (liste plate de `MODULES`), les libellés `gestionChantier.*` portent
déjà le préfixe « Gestion chantier · … » qui assure le regroupement visuel par tri
alpha. **On suit l'existant, on n'ajoute pas de regroupement** (hors périmètre,
modif UI admin non demandée).

> Note (signalée, non corrigée) : dérive de nommage pré-existante — `rolesConfig`
> contient des clés (`chantiers`, `reserves`, `outillage`) qui ne matchent pas
> toutes les clés factory (`reserves-quitus`…). **Hors périmètre, on n'y touche pas.**

> Tension pré-existante (signalée, non corrigée) : un user `_admin:true` non-Admin
> (Achat/Assistante/Direction via override) voit les écrans admin côté front mais
> les **Cloud Functions `adminUsers` exigent le claim `role==="Admin"`** (l.42) →
> il ne peut pas créer/éditer des users. C'est le comportement actuel, **inchangé**
> par ce ticket.

---

## 5) Structure module — confirmation

**Module classique responsive confirmé** (calibre `src/modules/avancement/`), **PAS
de split N2** : `src/modules/gestion-chantier/{GestionChantierModule,ChantierFiche}.jsx`,
arbre unique PWA/desktop via `useViewport`. Déjà en place et conforme (cf. en-têtes
des fichiers + CLAUDE.md §10 « arbre responsive unique » / §13 « chantier design fermé »).

---

## 6) Plan d'exécution après GO

1. **« GO permissions »** → j'applique §3 sur `permissions.js` (branche
   `feature/m5-gestion-chantier`), je te présente le diff exact appliqué.
2. Smoke test : `npm run build` + vérif que Achat apparaît dans les 3 écrans admin
   et que l'Achat voit la tuile gestionChantier (onglets commandes + financier).
3. `git fetch origin` + `git diff origin/main -- src/core/permissions.js` avant push.
4. Commit atomique `feat(permissions): rôle Achat factory + accès gestionChantier`,
   push sur `feature/m5-gestion-chantier`, je te donne l'URL preview Vercel + la
   liste de clics à tester.
5. **Toi seul** : `! git merge` / `! git push` sur `main` après validation preview.

> **Pas de « GO L1 » séparé nécessaire** : le code applicatif L1 est déjà en prod.
> Ce ticket se réduit, en pratique, au seul ajout du rôle Achat dans `permissions.js`.

---

**STOP — j'attends ton « GO permissions ».** Aucun fichier touché tant que tu n'as
pas validé le diff §3 (et idéalement confirmé/relu le contenu live de `rolesConfig/Achat`, §3.d).

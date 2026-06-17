# PLAN_L8b — Planning v2 : FIX picker + barres + affectation sur plage + heures

> Branche : `feature/planning-barres` (neuve depuis `main`, après merge L8).
> **Étape 1 = ce plan. Aucun code applicatif tant que GO non donné.**
> 100 % UI / logique **client**, par-dessus L8. **Aucun** changement de
> modèle de données, de règle, de permission, d'index.
> Grounding : code L8 réel (`src/modules/planning/*`) + taxonomie M3
> (`src/modules/avancement/avancementTasks.js`).

---

## 0. Rappel de l'existant L8 (point de départ)

`planningModel.js` expose aujourd'hui :
- `chantierPlanningOptions(chantier, tasksConfig)` → **À RENOMMER en
  `getPosteOptions`** et **À CORRIGER** (A0).
- `posteLabel(chantier, batiment, posteKey, tasksConfig)` → **À CORRIGER** (A0).
- date/semaine : `PERIODES`, `NB_WEEK_DAYS`, `weekColumns`, `weekRange`,
  `addDays`, `fromISO`, `toISODate`, `creneauId`, etc. (réutilisés tels quels).

`PlanningGrid.jsx` : rendu **case-par-case** (une pastille par demi-journée),
clic case → `AffectationModal` (1 créneau).
`AffectationModal.jsx` : 1 chantier + bâtiment + poste + temps → 1 `setDoc`.

> ⚠️ **Écart brief ↔ réalité signalé** : le brief A0 dit « les sous-sols communs,
> resolveBuildings les énumère déjà ». **Faux** : `resolveBuildings(chantier)`
> ne renvoie que `chantier.buildings[]`. Les sous-sols communs vivent dans
> `chantier.sousSolsCommuns` (helper `getChantierSousSols`) et ont leurs propres
> catégories via `getCategoriesForSousSol(cfg, …, ssId)`. Je les **énumère
> explicitement** en plus des bâtiments (cf. A0), ce qui réalise bien l'intention
> du brief.

---

## A0. FIX PICKER DE POSTES (PRIORITAIRE) — `planningModel.js`

### Problème actuel
`chantierPlanningOptions` **intersecte** la taxonomie avec
`avancementProgress[b.id]` (seuls les slugs déjà présents en avancement sont
proposés) → si l'avancement d'un bâtiment est vide, **aucun poste choisissable**.
De plus le libellé affiché = `t.label` seul (ex. « R+1 »), ambigu entre catégories.

### Correctif
Nouvelle fonction **`getPosteOptions(chantier, tasksConfig)`** (renomme et
remplace `chantierPlanningOptions`) :

1. **Unités** = `resolveBuildings(chantier)` (bâtiments) **+**
   `getChantierSousSols(chantier)` (sous-sols communs).
2. Pour chaque unité, catégories via :
   - bâtiment : `getCategoriesForConfig(b.config, tasksConfig, chantier.avancementTasksOverride, b.id)`
   - sous-sol : `getCategoriesForSousSol(ss.config, tasksConfig, chantier.avancementTasksOverride, ss.id)`
   → **TOUTE la taxonomie générée selon la config** (béton, placo, divers,
   logements, communs, contrôle, étude…), **SANS intersection avec
   `avancementProgress`**. Un poste est toujours choisissable.
3. Forme retournée (groupée par catégorie, prête pour un picker hiérarchique) :

```js
[
  {
    unite: "A",                    // valeur stockée dans creneau.batiment (cf. ci-dessous)
    label: "Bâtiment A",           // ou "Sous-sol commun {nom}"
    type: "BAT" | "SS",
    categories: [
      { catId, catLabel: "Béton", color, postes: [ { key: t.id, label: t.label } ] },
      …
    ],
    // liste à plat (fallback pour un <select> simple) :
    postesFlat: [ { key: t.id, label: "Béton — Mur R+1", catLabel, color } ]
  },
  …
]
```

4. **Libellés** = `"{catégorie courte} — {tâche}"`. Map des libellés courts
   (par `cat.id`, source unique dans `planningModel`) :
   ```
   beton→"Béton", placo→"Placo", logements→"Logement", communs→"Commun",
   etude→"Étude", divers→"Divers", controle→"Contrôle", ssequip→"Sous-sol"
   ```
   Exemples : « Placo — R+1 », « Béton — Mur R+1 », « Logement — Appareillage »,
   « Commun — Colonne Montante ». **Jamais de slug brut, jamais de niveau orphelin.**
5. **`posteAvancementKey` reste = `t.id`** (slug M3) — lien avancement **inchangé**.
6. **`creneau.batiment`** : pour un bâtiment = sa **lettre** (`getBuildingLetter`,
   comme L8) ; pour un sous-sol commun = son **`ss.id`** (clé stable). Ainsi
   `posteLabel` sait retrouver l'unité.

### `posteLabel(chantier, batiment, posteKey, tasksConfig)` corrigé
Réutilise `getPosteOptions` : retrouve l'unité par `batiment` (lettre **ou**
`ss.id`), puis la tâche par `posteKey` dans ses catégories → renvoie
`"{catégorie courte} — {tâche}"`. Fallbacks : unité absente → 1re unité ;
poste introuvable (config modifiée) → libellé brut `posteKey` (jamais d'erreur).
Les **barres et créneaux** affichent donc le libellé complet.

### Picker groupé vs plat (décision)
`<Field as="select">` (DS-1) ne supporte pas `<optgroup>` et **ne sera pas
modifié** (hors périmètre fichiers L8b). → le picker utilise `postesFlat` avec
**libellés préfixés catégorie** (« Béton — Mur R+1 »), ordre = catégories puis
tâches. Le **regroupement visuel par catégorie** (optgroup) est noté comme
amélioration optionnelle ultérieure (nécessiterait une évolution additive de
`<Field>`, donc un autre lot). Le must-have (libellés complets, jamais de slug)
est couvert.

---

## A. AFFICHAGE EN BARRES — `PlanningGrid.jsx` (+ helper `planningModel`)

### Index de demi-journée (slot)
Sur la semaine affichée (Lun→Sam = `NB_WEEK_DAYS`=6, × AM/PM = **12 slots**) :
```
slotIndex(dayIdx, periode) = dayIdx * 2 + (periode === "AM" ? 0 : 1)   // 0..11
```
Helpers ajoutés à `planningModel` : `slotIndex`, `slotToCell(idx)`
(→ `{ dayIdx, periode }`), `expandRange(fromSlot, toSlot)` (→ liste de slots).

### Algo de regroupement créneaux → barre (`rowSegments`)
`rowSegments(resourceId, weekCols, creneauMap)` :
1. Construire `slots[0..11]` : pour chaque slot, le doc
   `creneauMap.get(creneauId(resourceId, weekCols[dayIdx].iso, periode))` ou `null`.
2. Parcourir de gauche à droite et **fusionner les slots contigus** partageant
   la **même clé de barre** :
   ```
   barKey = chantierId + "|" + (batiment||"") + "|" + (posteAvancementKey||"")
   ```
   (clé = chantier **+ bâtiment + poste** — on inclut `batiment` pour ne pas
   fusionner deux bâtiments différents quand le poste est nul ; le brief ne cite
   que chantier+poste, j'ajoute batiment par correction de robustesse.)
   - slot non affecté (`chantierId` nul) → **cellule vide** d'1 slot (cliquable).
   - slots affectés consécutifs de même `barKey` → **une barre** `[start..end]`.
   - rupture dès que `barKey` change ou qu'un slot vide s'intercale.
3. Émettre une liste ordonnée de segments :
   ```
   { kind: "bar", start, end, chantierId, batiment, posteAvancementKey,
     hours: Σ tempsEstimeH des slots, creneaux: [...] }
   | { kind: "empty", start, end }   // end===start (slots vides unitaires)
   ```
**Plusieurs barres par ligne** = naturellement géré (chaque rupture crée un
segment). **Précision demi-journée aux extrémités** = la barre démarre au slot
`start` (AM ou PM) et finit au slot `end`, rendue par `grid-column` (cf. ci-dessous).
**Rendu seul** : aucune écriture, mêmes docs `planningCreneaux`.

### Rendu (remplace les pastilles case-par-case)
La ligne reste un **CSS grid** identique en colonnes (`CELL_TEMPLATE`), mais on
place chaque segment via `gridColumn` explicite :
```
barre  : gridColumn = `${2 + start} / ${2 + end + 1}`   // +1 car col 1 = ressource
vide   : gridColumn = `${2 + start} / ${2 + start + 1}` // 1 slot, cliquable "+"
```
- Barre = div coloré (`PALETTE[chantierColorIndex(chantierId)]`, déjà L8), label
  = `n° chantier` + `posteLabel(...)` tronqué + `({hours} h)`, `title` complet.
  Clic barre → modale **pré-remplie** (chantier/poste/bâtiment + Du=start, Au=end).
- Cellule vide = « + » faible (si `canWrite`), clic → modale **plage Du=Au=slot**.
Les en-têtes (ligne jours + ligne AM/PM) sont **inchangés**.

---

## B. AFFECTATION SUR PLAGE — `AffectationModal.jsx`

### Champs
- **Chantier** (figé si onglet, sinon picker — comme L8).
- **Bâtiment / unité** (bâtiments + sous-sols communs, via `getPosteOptions`).
- **Poste (optionnel)** : `postesFlat` de l'unité (libellés « Cat — Tâche »).
- **Du** : `{ jour (weekCols), AM/PM }` · **Au** : `{ jour, AM/PM }`.
  Normalisation : si `toSlot < fromSlot`, on **échange** (jamais d'erreur).
- **Temps estimé (h)** : optionnel. Vide → défaut par slot = la demi-journée
  (cf. C). Rempli → applique cette valeur à **chaque** slot de la plage.

### Valider (écriture)
1. `slots = expandRange(fromSlot, toSlot)` → pour chaque : `{ dayIdx, periode,
   dateIso = weekCols[dayIdx].iso }`.
2. **Détection de collision** : pour chaque slot, `existing = getExisting(dateIso,
   periode)` ; collision si `existing?.chantierId` **non nul ET ≠ chantier choisi**.
3. Si collisions → **`window.confirm`** listant les demi-journées en conflit et
   leurs chantiers actuels (« Écraser N demi-journée(s) déjà affectée(s) à
   d'autres chantiers ? »). **Annuler = abandon total** (aucune écriture). Jamais
   d'écrasement silencieux.
4. Écriture : **boucle `setDoc(merge:true)`** sur `planningCreneaux/{creneauId}`,
   **schéma L8 strictement identique** (mêmes constantes `tacheId:null`,
   `etatValidationMonteur` préservé/`"NON"`, `smsEnvoye` préservé/`false`,
   `creePar` préservé sinon `user._id`, `modifiePar:user._id`, `updatedAt`).
   Champs métier : `chantierId`, `batiment`, `posteAvancementKey`,
   `tempsEstimeH = override ?? demiJourneeHeures(dayIdx)`.
   `Promise.all` des `setDoc`. Le `onSnapshot` L8 rafraîchit la grille.
5. `onClose()`.

### « Libérer sur la plage »
Visible si la plage contient ≥1 créneau affecté. → pour chaque slot de la plage
ayant un doc existant : `setDoc(merge:true)` avec `chantierId:null, batiment:null,
posteAvancementKey:null, tempsEstimeH:null, modifiePar, updatedAt`. (Update =
autorisé `isAssistante`/Chef par les rules L8 ; **pas de delete**.) Pas de collision.

### Lecture seule
`canWrite=false` (Monteur) → champs désactivés, seul « Fermer ». Inchangé vs L8.

### Accès aux créneaux existants pour la collision
`PlanningGrid` passe à la modale un `getExisting(dateIso, periode)` = closure sur
son `creneauMap` (clé `creneauId(ressource.id, …)`), + `weekCols`. Aucune lecture
Firestore supplémentaire (la semaine est déjà chargée par le `onSnapshot` L8).

---

## C. HEURES — `planningModel.js` + `PlanningGrid.jsx`

- `demiJourneeHeures(dayIdx)` : **Ven (dayIdx 4) → 3,5 h ; sinon → 4 h**
  (Lun–Jeu = 4 h ; **Sam (dayIdx 5) : non spécifié au brief → 4 h par défaut**,
  hypothèse signalée). Jour plein = 8 h (Lun–Jeu) / 7 h (Ven) par construction.
- **`tempsEstimeH` par défaut** d'un créneau = `demiJourneeHeures(dayIdx)` au
  moment de l'affectation (modale plage). Éditable via le champ « Temps estimé ».
- **Total hebdo par ressource** : `weeklyTotalHours(resourceId, weekCols,
  creneauMap)` = Σ `tempsEstimeH` (fallback `demiJourneeHeures` si null sur un
  créneau affecté) des créneaux **affectés** de la semaine.
  Affiché en **colonne de bout de ligne** : `CELL_TEMPLATE` passe de
  `170px repeat(12,1fr)` à `170px repeat(12,1fr) 72px` (+ cellules d'en-tête
  « Total » sur les 2 lignes de header). Pur affichage.

---

## D. TÂCHE MULTI-JOURS

Aucune donnée nouvelle : poser un poste sur une plage écrit le **même
`posteAvancementKey`** sur tous les créneaux de la plage (B.4). `rowSegments`
(A) les regroupe alors en **une seule barre** (même `chantierId + batiment +
posteAvancementKey` sur slots consécutifs). Rien d'autre à faire.

---

## 5. Fichiers touchés (3 fichiers, 0 nouveau)

| Fichier | Modifs |
|---|---|
| `src/modules/planning/planningModel.js` | **A0** rename+fix `getPosteOptions` (taxonomie complète, bâtiments **+ sous-sols communs**, libellés « Cat — Tâche », map cat courtes) ; fix `posteLabel`. **A** `slotIndex`/`slotToCell`/`expandRange`/`rowSegments`. **C** `demiJourneeHeures`/`weeklyTotalHours`. |
| `src/modules/planning/PlanningGrid.jsx` | **A** rendu en **barres** (segments `gridColumn`) au lieu des pastilles case-par-case ; vides cliquables. **C** colonne « Total » + en-têtes. Passe `weekCols`+`getExisting`+plage initiale à la modale ; clic barre = plage pré-remplie. |
| `src/modules/planning/AffectationModal.jsx` | **B** UI **Du/Au** (jour+AM/PM), **collisions** (confirm), **« Libérer sur la plage »**, défaut temps/demi-journée, boucle `setDoc`. Utilise `getPosteOptions` (libellés complets). |

`PlanningPage.jsx` / `PlanningTab.jsx` : **inchangés** (mêmes props). `Field`,
`Button`, thème, DataContext : **inchangés**.

---

## 6. Confirmation des invariants

- ✅ Écrit **uniquement** dans `planningCreneaux` (`setDoc merge:true`, boucle sur
  la plage). **Aucune** écriture `chantiers`/`utilisateurs` (lecture seule via
  `DataContext` + props chantier).
- ✅ **`permissions.js` / `firestore.rules` / `firestore.indexes.json` :
  INCHANGÉS** — rien de trio, aucune nouvelle clé de permission, aucun nouvel
  index (les barres lisent les mêmes docs ; les écritures de plage sont N×`setDoc`
  sur la collection existante, mêmes requêtes qu'en L8).
- ✅ **Aucun** fichier `.github/workflows/`.
- ✅ Schéma `planningCreneaux` **identique** à L8 (mêmes champs/constantes
  `tacheId:null`, `etatValidationMonteur:"NON"`, `smsEnvoye:false`) — L8b ne fait
  qu'écrire plusieurs docs au lieu d'un.
- ✅ `npm run build` + `npm run audit:tokens` verts (objectif : 0 `fontWeight`
  numérique, 0 hex brut dans `planning/`, comme L8).
- ✅ Périmètre = **UI / logique client** par-dessus L8, 3 fichiers, 0 nouveau
  fichier, 0 nouvelle collection.

---

**FIN — STOP.** En attente du GO écrit sur ce plan avant tout code applicatif.

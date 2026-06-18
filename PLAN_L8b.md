# PLAN_L8b — Planning v2 : FIX picker + barres + affectation sur plage + heures

> Branche : `feature/planning-barres` (neuve depuis `main`, qui contient L8 +
> taxo avancement v2). 100 % UI / logique **client**, par-dessus L8.
> **Aucun** changement de modèle, règle, permission, index.
> Grounding : code L8 réel (`src/modules/planning/*`) + taxonomie M3 **v2**
> (`src/modules/avancement/avancementTasks.js` — 8 catégories + générateurs par étage).

---

## Corrections intégrées (vs 1re rédaction)

1. **Semaine Lun→Ven** : `NB_WEEK_DAYS = 5`, **10 slots**, `demiJourneeHeures(ven)=3,5 h`
   sinon 4 h, `CELL_TEMPLATE = 170px repeat(10,1fr) 72px`, tout le slot-math sur 10 slots.
2. **A0 map des libellés courts COMPLÈTE** (taxo v2, 9 `cat.id` y compris `courant-faible`
   → « Courant faible » et `ssequip` → « Sous-sol »).
3. **A0 anti-doublon de préfixe** : ne pas préfixer si le libellé de la tâche commence
   déjà par le libellé court de la catégorie (évite « Placo — Placo R+1 »).

---

## 0. Existant L8 (point de départ)

`planningModel.js` : `chantierPlanningOptions(chantier, tasksConfig)` (→ **renommer
`getPosteOptions` + corriger** A0), `posteLabel(...)` (→ **corriger** A0), date/semaine
(`PERIODES`, `NB_WEEK_DAYS`, `weekColumns`, `weekRange`, `addDays`, `fromISO`,
`toISODate`, `creneauId`…), identité ressource (réutilisés).
`PlanningGrid.jsx` : rendu **case-par-case** (pastille / demi-journée), clic → modale 1 créneau.
`AffectationModal.jsx` : 1 chantier + bâtiment + poste + temps → 1 `setDoc`.

> ⚠️ **Écart brief ↔ réalité** : `resolveBuildings(chantier)` n'énumère **PAS** les
> sous-sols communs (renvoie `chantier.buildings[]`). Ils vivent dans
> `chantier.sousSolsCommuns` (`getChantierSousSols`) avec catégories propres
> (`getCategoriesForSousSol`). Je les énumère explicitement en plus des bâtiments.

---

## A0. FIX PICKER DE POSTES (PRIORITAIRE) — `planningModel.js`

### Problème
`chantierPlanningOptions` intersecte la taxonomie avec `avancementProgress[b.id]`
→ si l'avancement est vide, **aucun poste choisissable**. Et libellé = `t.label`
seul (« R+1 »), ambigu entre catégories.

### Correctif `getPosteOptions(chantier, tasksConfig)` (renomme + remplace)
1. **Unités** = `resolveBuildings(chantier)` (bâtiments) **+**
   `getChantierSousSols(chantier)` (sous-sols communs).
2. Catégories via **toute la taxonomie générée selon la config**, **SANS**
   intersection `avancementProgress` :
   - bâtiment : `getCategoriesForConfig(b.config, tasksConfig, chantier.avancementTasksOverride, b.id)`
   - sous-sol : `getCategoriesForSousSol(ss.config, tasksConfig, chantier.avancementTasksOverride, ss.id)`
   → un poste est **toujours** choisissable, même avancement vide.
3. Forme retournée :
```js
[
  { unite, label, type:"BAT"|"SS",
    categories: [ { catId, catLabel, color, postes:[{key:t.id, label:t.label}] } ],
    postesFlat: [ { key:t.id, label:"Béton — Mur R+1", catLabel, color } ] }
]
```
4. **Libellés** `postesFlat` = `"{cat courte} — {tâche}"`. **Map des libellés courts
   (source unique, par `cat.id` taxo v2)** :
   ```
   etude→"Étude", beton→"Béton", divers→"Divers", placo→"Placo",
   logements→"Logement", communs→"Commun", "courant-faible"→"Courant faible",
   controle→"Contrôle", ssequip→"Sous-sol"
   ```
   **Anti-doublon** : si `t.label` (insensible casse) commence déjà par la cat courte
   → **pas de préfixe** (ex. « Placo RDC » reste « Placo RDC », pas « Placo — Placo RDC » ;
   idem « Appareillage RJ45 R+1 » non concerné → « Courant faible — Appareillage RJ45 R+1 »).
   Cat courte inconnue → pas de préfixe (libellé tâche seul). **Jamais de slug brut.**
5. **`posteAvancementKey` reste = `t.id`** (slug M3) — lien avancement inchangé.
6. **`creneau.batiment`** : bâtiment = sa **lettre** (`getBuildingLetter`) ;
   sous-sol commun = son **`ss.id`**. `posteLabel` retrouve l'unité par l'un ou l'autre.

### `posteLabel(chantier, batiment, posteKey, tasksConfig)` corrigé
Réutilise `getPosteOptions` : unité par `batiment` (lettre **ou** `ss.id`) → tâche par
`posteKey` dans `postesFlat` → renvoie le libellé complet « Cat — Tâche ». Fallbacks :
unité absente → 1re unité ; poste introuvable → `posteKey` brut (jamais d'erreur).

### Picker plat (décision)
`<Field as="select">` ne gère pas `<optgroup>` et **n'est pas modifié** (hors périmètre).
→ picker = `postesFlat` (libellés préfixés catégorie, ordre catégories puis tâches).
Regroupement visuel optgroup = amélioration ultérieure (évolution additive de `<Field>`).

---

## A. AFFICHAGE EN BARRES — `PlanningGrid.jsx` (+ helpers `planningModel`)

### Semaine Lun→Ven
`WEEK_DAY_LABELS = ["Lun.","Mar.","Mer.","Jeu.","Ven."]` → **`NB_WEEK_DAYS = 5`**.
Slot-math sur **10 slots** (5 jours × AM/PM).

### Index de demi-journée (slot)
```
slotIndex(dayIdx, periode) = dayIdx * 2 + (periode === "AM" ? 0 : 1)   // 0..9
```
Helpers ajoutés : `slotIndex`, `slotToCell(idx)` (→ `{dayIdx, periode}`),
`expandRange(fromSlot, toSlot)` (→ liste de slots, bornes incluses, swap si inversé).

### Algo de regroupement créneaux → barre (`rowSegments`)
`rowSegments(resourceId, weekCols, creneauMap)` :
1. `slots[0..9]` : `creneauMap.get(creneauId(resourceId, weekCols[dayIdx].iso, periode))` ou `null`.
2. Fusionner les slots **contigus** de même clé :
   `barKey = chantierId + "|" + (batiment||"") + "|" + (posteAvancementKey||"")`
   (j'inclus `batiment` pour ne pas fusionner deux bâtiments quand le poste est nul).
   - slot non affecté (`chantierId` nul) → cellule vide d'1 slot (cliquable).
   - slots affectés consécutifs de même `barKey` → **une barre** `[start..end]`.
   - rupture dès que `barKey` change ou qu'un vide s'intercale.
3. Segments : `{kind:"bar", start, end, chantierId, batiment, posteAvancementKey,
   hours:Σ tempsEstimeH, creneaux:[...]}` | `{kind:"empty", start}`.

**Plusieurs barres/ligne** = naturel. **Précision demi-journée** = bornes `start`/`end`
de slot (AM/PM), rendues par `grid-column`. **Rendu seul**, mêmes docs.

### Rendu (remplace les pastilles)
Ligne = CSS grid `CELL_TEMPLATE` ; chaque segment placé via `gridColumn` :
```
barre : `${2 + start} / ${2 + end + 1}`     (col 1 = ressource)
vide  : `${2 + start} / ${2 + start + 1}`    (1 slot, clic "+")
```
Barre = div coloré (`PALETTE[chantierColorIndex(chantierId)]`), label = n° chantier +
`posteLabel(...)` tronqué + `({hours} h)`, `title` complet. Clic barre → modale
**pré-remplie** (chantier/poste/bâtiment, Du=start, Au=end). Vide → modale plage Du=Au=slot.
En-têtes (jours, AM/PM) inchangés + **colonne « Total »** ajoutée (cf. C).

---

## B. AFFECTATION SUR PLAGE — `AffectationModal.jsx`

### Champs
- **Chantier** (figé si onglet, sinon picker).
- **Bâtiment / unité** (bâtiments + sous-sols communs, via `getPosteOptions`).
- **Poste (optionnel)** : `postesFlat` de l'unité (« Cat — Tâche »).
- **Du** `{jour, AM/PM}` · **Au** `{jour, AM/PM}` (sur `weekCols`). Swap si `to < from`.
- **Temps estimé (h)** : vide → défaut par slot = la demi-journée (cf. C) ;
  rempli → applique cette valeur à **chaque** slot de la plage.

### Valider (écriture)
1. `slots = expandRange(fromSlot, toSlot)` → `{dayIdx, periode, dateIso = weekCols[dayIdx].iso}`.
2. **Collision** : par slot, `existing = getExisting(dateIso, periode)` ; collision si
   `existing?.chantierId` **non nul ET ≠ chantier choisi**.
3. Si collisions → **`window.confirm`** listant les demi-journées en conflit ;
   **Annuler = abandon total** (aucune écriture). Jamais d'écrasement silencieux.
4. **Boucle `setDoc(merge:true)`** sur `planningCreneaux/{creneauId}`, **schéma L8
   identique** (`tacheId:null`, `etatValidationMonteur` préservé/`"NON"`, `smsEnvoye`
   préservé/`false`, `creePar` préservé sinon `user._id`, `modifiePar`, `updatedAt`).
   Métier : `chantierId`, `batiment`, `posteAvancementKey`,
   `tempsEstimeH = override ?? demiJourneeHeures(dayIdx)`. `Promise.all`. `onSnapshot` rafraîchit.
5. `onClose()`.

### « Libérer sur la plage »
Si la plage contient ≥1 créneau affecté → par slot existant : `setDoc(merge:true)`
`chantierId/batiment/posteAvancementKey/tempsEstimeH = null` + `modifiePar/updatedAt`.
(Update = autorisé `isAssistante`/Chef ; **pas de delete**.)

### Lecture seule
`canWrite=false` → champs désactivés, seul « Fermer ».

### Collision sans lecture Firestore extra
`PlanningGrid` passe `getExisting(dateIso, periode)` (closure sur `creneauMap`) +
`weekCols`. La semaine est déjà chargée par le `onSnapshot` L8.

---

## C. HEURES — `planningModel.js` + `PlanningGrid.jsx`

- `demiJourneeHeures(dayIdx)` : **Ven (dayIdx 4) → 3,5 h ; sinon (Lun–Jeu) → 4 h**.
  (Jour plein = 8 h Lun–Jeu / 7 h Ven. Pas de samedi.)
- **`tempsEstimeH` par défaut** d'un créneau (à l'affectation) = `demiJourneeHeures(dayIdx)`,
  éditable via le champ « Temps estimé ».
- **Total hebdo / ressource** : `weeklyTotalHours(resourceId, weekCols, creneauMap)` =
  Σ `tempsEstimeH` (fallback `demiJourneeHeures` si null sur un créneau affecté) des
  créneaux affectés de la semaine. Affiché en **colonne de bout de ligne** :
  `CELL_TEMPLATE = 170px repeat(10,1fr) 72px` (+ cellules d'en-tête « Total » sur les
  2 lignes de header ; `DAY_TEMPLATE = 170px repeat(5,2fr) 72px`). Pur affichage.

---

## D. TÂCHE MULTI-JOURS
Poste posé sur une plage = **même `posteAvancementKey`** sur tous les créneaux (B.4) ;
`rowSegments` les regroupe en **une barre** (même `chantierId+batiment+poste` contigu).
Aucune donnée nouvelle.

---

## 5. Fichiers touchés (3 fichiers, 0 nouveau)

| Fichier | Modifs |
|---|---|
| `planningModel.js` | semaine Lun→Ven (5/10 slots) ; **A0** `getPosteOptions` (taxo complète, bâtiments + sous-sols, libellés « Cat — Tâche » + map courte + anti-doublon) + `posteLabel` ; **A** `slotIndex`/`slotToCell`/`expandRange`/`rowSegments` ; **C** `demiJourneeHeures`/`weeklyTotalHours`. |
| `PlanningGrid.jsx` | **A** rendu **barres** (segments `gridColumn`), vides cliquables ; **C** colonne « Total » + en-têtes ; passe `weekCols`/`getExisting`/plage à la modale ; clic barre = plage pré-remplie. |
| `AffectationModal.jsx` | **B** UI **Du/Au**, **collisions** (confirm), **« Libérer sur la plage »**, défaut temps/demi-journée, boucle `setDoc` ; `getPosteOptions` (libellés complets). |

`PlanningPage.jsx` / `PlanningTab.jsx` / `Field` / `Button` / thème / DataContext : **inchangés**.

---

## 6. Invariants confirmés
- ✅ Écrit **uniquement** `planningCreneaux` (`setDoc merge:true`, boucle plage). Aucune
  écriture `chantiers`/`utilisateurs`.
- ✅ `permissions.js` / `firestore.rules` / `firestore.indexes.json` **INCHANGÉS**
  (rien de trio, aucune clé/index nouveau ; mêmes requêtes qu'en L8).
- ✅ Aucun `.github/workflows/`.
- ✅ Schéma `planningCreneaux` identique à L8 (mêmes champs/constantes).
- ✅ `npm run build` + `npm run audit:tokens` verts (0 `fontWeight` numérique,
  0 hex brut dans `planning/`).
- ✅ Périmètre = UI / logique client, 3 fichiers, 0 nouveau.

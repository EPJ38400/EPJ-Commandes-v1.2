# PLAN L2 — Onglet « Pieuvres » (Module 5, fiche chantier)

> **Statut : PLAN, aucun code écrit.** J'attends **« GO L2 »**.
> Lecture seule de `chantiers` (jamais d'écriture). Nouvelle collection racine
> `pieuvres`. **`permissions.js` non touché.** `firestore.rules` modifié (déploiement
> manuel requis, cf. §3 + §5).

---

## 1) Constat (vérifié dans le code, pas déduit)

### a. Où insérer le contenu Pieuvres
`src/modules/gestion-chantier/ChantierFiche.jsx` — le contenu de l'onglet actif est
un placeholder unique (l.104-120 : `À venir — cet onglet sera développé…`). Le
gating par onglet est déjà en place (`visibleTabs` l.36-39, clé `pieuvres`).
→ **Point d'insertion** : remplacer le placeholder **uniquement** quand
`active.key === "pieuvres"` par `<PieuvresTab chantier={chantier} />` ; les 6 autres
onglets gardent le placeholder.

### b. Format réel des clés dalle M3 (vérifié `avancementTasks.js` l.106-126)
Générées par `buildBetonTasks(cfg)` à partir de `cfg.{nbSousSols,nbEtages,combles}` :

| Niveau | Clé poste M3 | Note |
|---|---|---|
| Sous-sol i | `beton-dalle-ss{i}` | i de `nbSousSols`→1 |
| RDC | `beton-dalle-rdc` | |
| Étage i | `beton-dalle-r{i}` | i de 1→`nbEtages` |
| Combles | **`beton-combles`** | ⚠️ **PAS** `beton-dalle-combles` — préfixe différent |
| Radier | `beton-radier` | **EXCLU** des pieuvres (brief) |

⚠️ **Décision à trancher (combles)** : le brief dit « si combles n'a pas de poste M3
→ `posteAvancementKey: null` ». Vérif faite : **combles A un poste M3 = `beton-combles`**
(ce n'est juste pas une clé `beton-dalle-*`). Comme la jointure date-dalle est tout
l'intérêt (§3.1 spec), **je recommande `posteAvancementKey: "beton-combles"`** pour la
ligne combles (pas `null`). → **confirme en GO** : `"beton-combles"` (reco) ou `null`.

### c. Structure réelle `buildings[].config` (vérifié `AdminChantiers.jsx` l.54 + `avancementTasks.js` l.301)
```js
chantier.buildings = [
  { id: "A"|"bat-xxx", lettre: "A", label: "", config: { nbSousSols, nbEtages, combles, sousSolId } },
  ...
]
DEFAULT_BUILDING_CONFIG = { nbSousSols: 1, nbEtages: 3, combles: false }
```
Helpers **déjà exportés** (`avancementTasks.js`) à réutiliser, **pas de duplication** :
- `resolveBuildings(chantier)` → tableau des bâtiments (fallback bâtiment « A » + config défaut si aucun).
- `getBuildingLetter(building)` → lettre affichée (`lettre || id || "?"`).

⚠️ **id technique stable vs lettre éditable** : `building.id` est la clé STABLE
(jamais modifiée), `building.lettre` est éditable. Pour que l'**idempotence** survive
à un renommage de lettre, j'utilise **`building.id`** dans l'ID déterministe + le champ
`batiment`, et j'affiche la lettre via `getBuildingLetter()` au rendu. (Le brief écrit
`batiment:"A"` à titre d'exemple ; en pratique `"A"` = aussi l'id du 1er bâtiment, donc
cohérent.) → si tu préfères stocker la lettre dans `batiment`, dis-le en GO.

### d. Lecture de la collection `pieuvres`
**Pas d'ajout à `DataContext`** (collection per-chantier, potentiellement volumineuse
tous chantiers confondus). La tab interroge **directement** :
`onSnapshot(query(collection(db,"pieuvres"), where("chantierId","==", chantier.num)))`,
**tri client** (ss→rdc→r→combles). → 1 seule clause `where` d'égalité + tri client =
**aucun index composite** (conforme brief). `chantierId` = `chantier.num` (= id Esabora 6 chiffres = id du doc `chantiers`).

---

## 2) Fichiers à créer / modifier

### Créer
- **`src/modules/gestion-chantier/pieuvresModel.js`** — logique PURE (testable, zéro Firestore) :
  - `niveauxForConfig(cfg)` → liste ordonnée `[{ niveau, posteAvancementKey }]`
    (ss1..ssN, rdc, r1..rN, combles si `combles===true`).
  - `expectedPieuvres(chantier)` → lignes attendues tous bâtiments
    `[{ id, chantierId, batiment, niveau, posteAvancementKey }]` (id déterministe).
  - `pieuvreId(chantierId, batiment, niveau)` → `` `${chantierId}_${batiment}_${niveau}` ``.
  - Constantes `LIEUX = ["CHANTIER","BUREAU"]`, `STATUTS = ["A_DEMANDER","DEMANDEE","PLANS_RECUS","LIVREE"]` + labels.
- **`src/modules/gestion-chantier/PieuvresTab.jsx`** — UI + I/O Firestore :
  - `onSnapshot` filtré `chantierId`, tri client.
  - Auto-génération idempotente à la 1re ouverture (cf. §4) si `buildings` présents,
    snapshot vide, et `can(user,"gestionChantier","edit",rolesConfig)` truthy.
  - Bouton **« Compléter les pieuvres »** (visible si droit edit) → crée seulement les
    lignes manquantes (jamais d'écrasement).
  - Rendu : **1 `<DataTable>` par bâtiment** (desktop) / **cartes** (PWA) via
    `useViewport` — calibre `GestionChantierModule`/Avancement. Édition en ligne :
    3 date pickers (`<input type="date">`), `<select>` lieu, `<select>` statut,
    `<input>` remarques. Sauvegarde **par doc** `setDoc(..., {merge:true})` + `updatedAt`.
    Inputs **désactivés** si pas de droit edit (lecture seule).
  - État vide propre si `resolveBuildings` ne donne que le fallback **et** que le
    chantier n'a réellement pas de `buildings` (message « Aucun bâtiment configuré
    sur ce chantier — renseignez les bâtiments dans l'admin chantier »).

### Modifier
- **`src/modules/gestion-chantier/ChantierFiche.jsx`** — importer `PieuvresTab` ; dans
  le rendu du contenu, `if (active.key === "pieuvres") → <PieuvresTab chantier={chantier}/>`
  sinon placeholder inchangé. (Aucune autre tab touchée.)
- **`firestore.rules`** — ajouter le bloc `match /pieuvres/{id}` (diff §3).

### NE PAS toucher
`permissions.js`, `chantiers` (aucune écriture), `DataContext.jsx`, `firestore.indexes.json`,
`avancementTasks.js` (réutilisé en lecture seule via imports), les 6 autres onglets.

---

## 3) Diff complet proposé pour `firestore.rules`

Pattern **calqué exactement** sur `reserves/{id}` (l.109-112) et `commandes/{id}`
(l.101-104) — collection per-chantier éditable par tout employé (le gating fin
Admin/Direction/Conducteur est côté client via `can()`), suppression réservée. Insertion
après le bloc `avancementValidations` (l.168-171) :

```diff
     match /avancementValidations/{id} {
       allow read: if isEmployee();
       allow create, update: if isEmployee();
       allow delete: if isAdmin();
     }
+
+    // ─── pieuvres/{id} — M5 Gestion de chantier (onglet Pieuvres) ──
+    // Per-chantier, éditable par tout employé (gating fin Admin/Direction/
+    // Conducteur own_chantiers assuré côté client par can()). Suppression
+    // réservée au conducteur (calque reserves/commandes).
+    match /pieuvres/{id} {
+      allow read: if isEmployee();
+      allow create, update: if isEmployee();
+      allow delete: if isConducteur();
+    }
```

> `isEmployee()`, `isConducteur()` existent déjà (helpers l.34-66 + usages
> `commandes`/`reserves`). Aucun nouveau helper, aucun schéma de règle inventé.
> **⚠️ Les rules ne passent pas par le CI** → après merge, déploiement **manuel** :
> `firebase deploy --only firestore:rules --project ap-epj` (avec ton GO), sinon
> écritures `pieuvres` en `permission-denied`.

---

## 4) Logique de génération + idempotence (pseudo-code court)

```
// pieuvresModel.js — PUR
niveauxForConfig(cfg):
  ss = Number(cfg.nbSousSols||0); et = Number(cfg.nbEtages||0); combles = !!cfg.combles
  L = []
  for i in 1..ss:  L.push({ niveau:"ss"+i, posteAvancementKey:"beton-dalle-ss"+i })
  L.push({ niveau:"rdc", posteAvancementKey:"beton-dalle-rdc" })
  for i in 1..et:  L.push({ niveau:"r"+i, posteAvancementKey:"beton-dalle-r"+i })
  if combles:      L.push({ niveau:"combles", posteAvancementKey:"beton-combles" }) // (ou null, cf §1.b)
  return L                                   // radier JAMAIS inclus ; ordre = ss→rdc→r→combles

expectedPieuvres(chantier):
  rows = []
  for b in resolveBuildings(chantier):
    bat = b.id
    for n in niveauxForConfig(b.config || DEFAULT_BUILDING_CONFIG):
      rows.push({ id: `${chantier.num}_${bat}_${n.niveau}`, chantierId: chantier.num,
                  batiment: bat, niveau: n.niveau, posteAvancementKey: n.posteAvancementKey })
  return rows
```

```
// PieuvresTab.jsx — idempotence (création des MANQUANTES uniquement)
ensurePieuvres(chantier, existingDocs):
  if !canEdit: return                         // jamais d'écriture sans droit
  existingIds = Set(existingDocs.map(d => d.id))
  for e in expectedPieuvres(chantier):
    if existingIds.has(e.id): continue        // NE TOUCHE PAS une ligne existante (dates/statut préservés)
    setDoc(doc(db,"pieuvres",e.id), {
      chantierId:e.chantierId, batiment:e.batiment, niveau:e.niveau,
      posteAvancementKey:e.posteAvancementKey,
      jourDemande:null, dateReceptionPlansCotes:null, dateLivraison:null,
      lieuLivraison:"CHANTIER", statut:"A_DEMANDER", commandeId:null, remarques:null,
      createdAt:serverTimestamp(), updatedAt:serverTimestamp(),
    }, { merge:true })                        // merge + id déterministe = idempotent
```

**Auto-génération à la 1re ouverture** : dans `PieuvresTab`, après réception du 1er
snapshot, si `existingDocs.length === 0` **et** `resolveBuildings` donne des bâtiments
réels **et** `canEdit` → `ensurePieuvres()` une seule fois (garde par `useRef` anti-rejeu
+ l'idempotence du `setDoc` couvre toute race). Si pas de droit edit et aucune pieuvre :
état vide en lecture seule (pas d'écriture).

**Édition en ligne** : à chaque champ modifié → `setDoc(doc(db,"pieuvres",row.id),
{ <champ>:<val>, updatedAt:serverTimestamp() }, {merge:true})`. Dates : `<input type="date">`
(string `YYYY-MM-DD`) → `Timestamp.fromDate(new Date(v))` à l'écriture, et l'inverse au rendu ;
champ vidé → `null`.

**Idempotence garantie par 3 mécanismes** : (1) ID déterministe `{num}_{bat}_{niveau}` ;
(2) on n'écrit QUE les ids absents du snapshot ; (3) `setDoc merge:true` n'écrase pas les
champs non fournis. → relancer « Compléter les pieuvres » après ajout d'un étage crée la
ligne `r{N+1}` manquante sans toucher aux autres.

---

## 5) Après GO — plan d'exécution
1. `git checkout -b feature/pieuvres-l2`.
2. Créer `pieuvresModel.js` + `PieuvresTab.jsx`, brancher dans `ChantierFiche.jsx`, éditer `firestore.rules`.
3. `npm run build` + `git fetch origin` + `git diff origin/main`.
4. Commit atomique (2 commits : `feat(gestion-chantier): onglet Pieuvres L2` + `security(rules): collection pieuvres`), push branche.
5. URL preview + checklist de test. **Pas de merge `main`** (à toi) + **rappel déploiement manuel des rules** (à toi, avec GO).

---

**STOP — j'attends ton « GO L2 »** (+ confirme : combles → `"beton-combles"` ou `null` ;
`batiment` = id stable ou lettre). Rien n'est codé avant.

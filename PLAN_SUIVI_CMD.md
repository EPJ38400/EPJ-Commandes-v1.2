# PLAN — Onglet « Suivi commandes » (fiche chantier M5)

> Branche `feature/suivi-commandes` (poussée, NON mergée).
> **100 % LECTURE SEULE.** Aucune écriture, aucune règle, aucune Cloud Function.
> `permissions.js`, `CommandesInner.jsx`, collection `chantiers` : INTOUCHÉS.

- **LOT 1 — Suivi commandes app** : ✅ LIVRÉ (commit `2944d93`, voir §§0-5 plus bas).
- **LOT 2 — AR fournisseurs (dates de livraison par ligne)** : 📋 CE PLAN, **STOP, attends GO**.

---

# LOT 2 — Enrichir l'onglet avec les AR fournisseurs (Esabora)

## L2.0 — Vérifications faites (audit live, branche `feature/suivi-commandes`)

### a) Composant Dashboard achat réutilisé = `EsaboraHistory.jsx` ✅
- Le Dashboard achat (`src/modules/commandes/AchatDashboard.jsx`) monte déjà
  **`<EsaboraHistory chantierNum=… />`** (`src/modules/commandes/EsaboraHistory.jsx`).
  Son en-tête le dit : *« Composant réutilisable… branchable plus tard dans la fiche
  chantier. »* → **C'est exactement ce qu'on réutilise.**
- Il lit `commandesEsabora` via **`onSnapshot` SCOPÉ** :
  `query(col, where("chantierNum","==", chantierNum))` quand la prop est fournie
  (sinon collection complète pour le dashboard). **Pas de listener global, pas d'index
  composite.** Tri client `dateCommande` **décroissant** (lignes 67-72). ✅ conforme au brief.
- Il rend **déjà tout** ce que le brief demande, par commande Esabora :
  `numero` · fournisseur (`codeFournisseur` → `arRef.fournisseur`) · `etat` ·
  **`<ArStatusBadge statut={arStatut} acquitte={arAcquitte}>`** · livraison dérivée ·
  **`<ArPdfLink>` (Voir AR)** · dépli → lignes `lignesAR[]` avec `reference`,
  `designation`, `qté {quantite} {unite}`, et **`livr. {dateLivraisonPrevue}`** (ligne
  247-248 / 300-301). Desktop = grille, PWA = cartes (`useIsNarrow`). Lecture seule stricte.
- **Finitions déjà couvertes par le composant** : aucune commande → `NoticeBox` vide ;
  commande sans `lignesAR` → « Lignes disponibles après réception de l'AR. » (+ badge
  MANQUANT/EN_ATTENTE) ; ligne sans `dateLivraisonPrevue` → « livr. — » ; dépli/repli par
  commande. → **rien à réécrire**, on hérite de tout.

### b) Mécanisme « Voir AR » (URL signée GCS) ✅ réutilisé tel quel
- `<ArPdfLink pieces={resolveArPieces(r)} />` (`components/ArPdfLink.jsx`). Chaque pièce
  `arRef.pieces[]` porte une **URL signée 30 j** (générée par `gmailCore`) ouverte direct
  via `window.open(piece.url)` ; **fallback** `getDownloadURL(storageRef(path))` si l'URL
  signée manque/expire. **Visible POUR TOUS** (le brief l'assume — PDF avec prix). Aucune
  modif : on garde `ArPdfLink` intégré dans `EsaboraHistory`.

### c) ⚠️ ÉCART BRIEF ↔ RÉALITÉ — la « gate prix du Dashboard achat » N'EXISTE PAS
- Le brief dit : *« réutiliser la MÊME gate de visibilité prix que le Dashboard achat
  (Direction/Assistante/Achat voient ; conducteur non) »*. **Or :**
  - Le Dashboard achat **n'a AUCUNE gate prix interne** : il affiche `Total HT`,
    `prixUnitaireAR`, `ecartTotal`… **sans condition** à quiconque y accède.
  - Sa seule gate est l'**accès** à la page (`canSeeDashboards`, `src/core/dashboardsAccess.js`),
    dont la liste `DASHBOARDS_DEFAULT_ROLES` **INCLUT « Conducteur travaux »** (ligne 28).
  - **Donc aujourd'hui le Conducteur VOIT déjà les prix** sur le Dashboard achat.
  - Recherche exhaustive : **aucun** helper `canSeePrix`/`voirPrix`/`prixVisible`… dans
    tout `src/` (0 occurrence). Il n'existe rien à « réutiliser ».
- 👉 **Pour honorer ton intention (conducteur NE voit PAS les prix dans l'onglet chantier),
  je dois CRÉER une nouvelle gate prix.** Je ne touche PAS `permissions.js` (trio) : je
  calque le pattern de `dashboardsAccess.js` dans un petit fichier neuf.
- **Proposition `src/core/pricesAccess.js`** (lecture seule, hors trio) :
  ```js
  export const PRIX_DEFAULT_ROLES = ["Admin", "Direction", "Assistante", "Achat"]; // PAS Conducteur
  export function canSeePrix(user){
    if(!user) return false;
    const ov = user.permissionsOverride?.prix;        // override user optionnel
    if(ov === false) return false;
    if(ov === true || ov === "all") return true;
    return getRoles(user).some(r => PRIX_DEFAULT_ROLES.includes(r));
  }
  ```
  - 🟡 **À CONFIRMER dans ton GO** : (1) liste des rôles prix = `Admin/Direction/Assistante/Achat`
    (Conducteur exclu) — OK ? (2) garder l'override user `permissionsOverride.prix` ? (3) ne
    touche-t-on PAS au Dashboard achat existant (le Conducteur continue d'y voir les prix) ?
    Par défaut je laisse le Dashboard achat **inchangé** et je n'applique `canSeePrix` qu'au
    nouvel onglet chantier.

### d) Schéma `commandesEsabora` — champs confirmés présents en base
- `numero`, `codeFournisseur`, `etat`, `arStatut` (RECU/MANQUANT/EN_ATTENTE/SANS_AR),
  `arAcquitte`, `dateCommande`, `chantierNum` (n° 6 chiffres), `arRef.pieces[]`,
  `lignesAR[]{ reference, designation, quantite, unite, dateLivraisonPrevue }`.
- Prix présents mais à MASQUER hors rôles prix : `totalHT` (seul affiché par
  `EsaboraHistory`). `totalAR`/`prixUnitaireAR`/`totalLigneAR`/`ecartTotal` **ne sont pas
  rendus** par `EsaboraHistory` (ils vivent dans `AchatDashboard`/`LigneEcart`, non réutilisés
  ici) → rien à masquer de ce côté. Les lignes de détail AR **n'affichent aucun prix**. ✅

---

## L2.1 — Fichiers modifiés / créés

| Fichier | Action | Détail |
|---|---|---|
| `src/core/pricesAccess.js` | **CRÉÉ** | Helper `canSeePrix(user)` + `PRIX_DEFAULT_ROLES`. Calque `dashboardsAccess.js`, **ne touche pas `permissions.js`**. Lecture seule. |
| `src/modules/commandes/EsaboraHistory.jsx` | **MODIFIÉ (additif)** | Nouvelle prop **`showPrix` (défaut `true`)**. Quand `false` : retire la colonne « Total HT » (desktop : GRID + en-tête + cellule TableRow) et la ligne « Total HT » (PWA CardRow). **Défaut = comportement actuel inchangé → Dashboard achat NON régressé.** Aucune autre modif. |
| `src/modules/gestion-chantier/SuiviCommandesTab.jsx` | **MODIFIÉ** | Ajout d'une 2ᵉ section « AR fournisseurs » sous la liste app existante : `<EsaboraHistory chantierNum={chantier.num} showPrix={canSeePrix(user)} />`. `import { useAuth }` + `canSeePrix`. La liste app du LOT 1 reste intacte. |

- **NON touchés** : `permissions.js`, `CommandesInner.jsx`, `chantiers`, `firestore.rules`,
  `functions/**`, `AchatDashboard.jsx`, `ArPdfLink.jsx`, `dashboardsAccess.js`, `ChantierFiche.jsx`.
- Pas de nouvelle collection, pas de code mort.

---

## L2.2 — Maquette texte (section « AR fournisseurs » dans l'onglet)

```
┌─ Suivi commandes ─────────────────────────────────────────────────────────┐
│ [Section LOT 1 — commandes app : liste existante inchangée]                │
│ ────────────────────────────────────────────────────────────────────────  │
│ AR fournisseurs — dates de livraison                                       │
│ [Tous] [Origine App] [Origine Esabora] [AR manquant] [Avec écart]          │
│                                                                            │
│  ▸ 100123  12/06/2026  REXEL   [Total HT 1 240 €*]  Soldée  [App CMD-…]    │
│            AR ✓ reçu                      livr. 18/06 → 24/06   [📄 Voir AR]│
│  ▾ 100124  11/06/2026  SONEPAR [Total HT   980 €*]  En cours [Esabora]     │
│            AR ⛔ manquant                 livr. —              [📄 Voir AR]│
│      ── Livraison prévue : 20/06/2026 ─────────────────────────────────    │
│      C520059  Câble U1000 R2V 3G2.5   qté 100 m   livr. 20/06/2026         │
│      A9F77216 Disjoncteur 16A C       qté 6        livr. —                 │
└────────────────────────────────────────────────────────────────────────────┘
  * « Total HT » affiché UNIQUEMENT si canSeePrix(user). Conducteur : colonne/
    ligne « Total HT » absente. « Voir AR » (PDF) : visible pour TOUS.
```
- **Conducteur** : tout pareil **sauf** la colonne/ligne « Total HT » (retirée).
  Les lignes AR (réf · désignation · qté/unité · **date de livraison**) et « Voir AR »
  restent visibles. PWA : carte sans la ligne « Total HT ».
- Vide : « Aucune commande Esabora pour ce filtre. » (NoticeBox du composant — scopé chantier).

---

## L2.3 — Confirmation invariants
- ✅ **Prix masqués hors rôles prix** : `Total HT` retiré quand `!canSeePrix(user)`
  (Conducteur exclu). `totalAR`/`prixUnitaireAR`/`totalLigneAR`/`ecartTotal` non rendus ici.
- ✅ **« Voir AR » pour TOUS** : `ArPdfLink` inchangé, URL signée GCS (+ fallback) intacte.
- ✅ **Lecture seule** : `EsaboraHistory` est read-only (`onSnapshot` scopé) ; le nouvel
  onglet n'ajoute aucun `setDoc`/`updateDoc`/`delete`. `chantiers` lu via prop seulement.
- ✅ **Zéro règle / function / write** : `firestore.rules` inchangé (lecture `commandesEsabora`
  déjà autorisée employé), aucune Cloud Function touchée/appelée.
- ✅ **Trio intact** : `permissions.js`, `CommandesInner.jsx`, `chantiers` non modifiés.
- ✅ **Dashboard achat non régressé** : `showPrix` défaut `true`.

## ⏸️ STOP — j'attends ton GO.
Confirme dans ton GO les 3 points 🟡 du L2.0.c (liste rôles prix · override `prix` ·
Dashboard achat laissé inchangé). Sans contre-ordre, j'implémente avec
`PRIX_DEFAULT_ROLES = Admin/Direction/Assistante/Achat`.

---
---

# LOT 1 — Suivi commandes app (✅ LIVRÉ, commit `2944d93`) — archive du plan initial

---

## 0. Vérifications faites (audit live du code, branche `main`)

### a) Mapping statut → libellé/couleur : DÉJÀ centralisé et réutilisable ✅
- La table statut→couleur **n'est PAS verrouillée dans `CommandesInner.jsx`**. Elle vit
  dans la primitive **`<Badge>`** (`src/core/components/Badge.jsx`, `STATUS_MAP`,
  ligne 31). Commentaire en tête du fichier : *« Table de correspondance statut → couleur
  CENTRALISÉE ici : aucun écran ne décide de ses propres couleurs de statut. »*
- `STATUS_MAP` couvre **tous** les statuts commande rencontrés en prod, avec les couleurs
  validées par toi au lot trio :
  - `En attente de validation` → warning · `Validée` / `Envoyée aux achats` → info (bleu)
  - `Commandée` → success (vert clair) · `Réceptionnée` → successStrong (vert plein)
  - `Commandée partiellement` / `Réceptionnée partiellement` → violet
  - `Refusée` → danger · `Scindée` → neutral
- **Décision : on RÉUTILISE `<Badge status={o.statut} />`** tel quel. Zéro recopie de table,
  aucun import depuis `CommandesInner.jsx`. Le nouvel onglet ne décide d'aucune couleur.
- ⚠️ **`CommandesInner.jsx` n'est ni importé, ni lu, ni modifié** (trio sensible respecté).
  On ne reprend PAS son helper `getStatusDisplay` (qui réétiquette un enfant de scission) :
  le brief définit son propre rendu de scission (badge « Scindée — `parentOrderNum` »).

### b) Schéma `commandes` (champs vérifiés dans le code)
- `num`, `statut`, `date` (string `"JJ/MM/AAAA"`), `dateReception` (souhaitée, peut être vide),
  `dateReceptionEffective` (présente si réceptionnée), `livraison` (`"Dépôt"`/`"Chantier"`),
  `urgent` (bool), `items[]`, `chantierNum` (n° 6 chiffres), `esaboraStatus`
  (`pending`/`synced`/absent), `createdBySplit` (bool), `parentOrderNum`, `parentOrderId`.
- **Items** : champs réels `r` (réf), `n` (désignation), `c` (catégorie), `s` (sous-cat),
  `qty`, `u` (unité, défaut `"Pièce"`). `img` et `signatureData` **ignorés**. **Aucun prix.**

### c) ⚠️ ÉCART BRIEF ↔ RÉALITÉ — source de données
- Le brief demande *« Lecture via `onSnapshot` filtré `chantierNum` (pas de listener
  global) »*. **Or `commandes` est DÉJÀ chargé globalement** par `DataContext.jsx`
  (listener `onSnapshot(collection(db,"commandes"))`, ligne 189-195) et exposé via
  `useData().commandes`. C'est le même flux que celui qui alimente le Module Commandes.
- Ajouter un **2e** listener filtré ferait double-lecture de la même collection (coût
  Firestore inutile) — et contredit en pratique le « pas de listener global » puisque le
  global existe déjà indépendamment de cet onglet.
- **Recommandation (option A, retenue par défaut)** : consommer `useData().commandes`
  (déjà en mémoire) et **filtrer côté client** `c.chantierNum === chantier.num`. Strictement
  lecture seule, **zéro nouveau read, zéro index, zéro listener supplémentaire**. C'est aussi
  l'approche la plus légère pour iPhone.
- **Option B (si tu y tiens)** : `onSnapshot` dédié `where("chantierNum","==",chantier.num)`
  dans le composant (filtre simple sur un champ → pas d'index composite requis). Plus proche
  de la lettre du brief mais redondant avec le global.
- 👉 **Dis-moi A ou B dans ton GO.** (Je code A sauf indication contraire.)

---

## 1. Fichiers créés / modifiés

| Fichier | Action | Détail |
|---|---|---|
| `src/modules/gestion-chantier/SuiviCommandesTab.jsx` | **CRÉÉ** | Onglet lecture seule. Consomme `useData().commandes`, filtre `chantierNum`, tri client, liste + détail dépliable. Réutilise `<Badge>`, tokens `theme.js`, `useViewport`. |
| `src/modules/gestion-chantier/ChantierFiche.jsx` | **MODIFIÉ** | Branchement de l'onglet : `import { SuiviCommandesTab }` + bloc de rendu `active.key === "commandes"` (calqué sur le bloc `pieuvres`). Le `case "pieuvres"` reste intact ; le placeholder générique ne s'affiche plus pour `commandes`. **Aucune autre modif** (TABS, gating, permissions inchangés). |

- **Aucun** autre fichier touché. `permissions.js`, `firestore.rules`, `functions/**`,
  `CommandesInner.jsx`, `DataContext.jsx`, `Badge.jsx`, `theme.js` : **intouchés**.
- Pas de fichier orphelin, pas de code mort.

---

## 2. Garde-fous d'accès
- Onglet déjà gaté en L1 par `can(user,"gestionChantier.commandes","_access")` dans
  `ChantierFiche` (rien à changer). Le contenu n'exige que la lecture — cohérent avec
  `can(user,"gestionChantier","view")`. Aucun bouton/action d'écriture.

---

## 3. Maquette texte

### Liste (une ligne par commande, tri récent en haut)
```
┌─────────────────────────────────────────────────────────────────────────┐
│ CMD-2026-0142   [Réceptionnée]   ⚠ urgent           12 art.              │
│ 14/06/2026 · récept. souhaitée 18/06/2026 · reçue 17/06/2026             │
│ Livraison : Chantier · Esabora : synchronisée                         ▸  │
├─────────────────────────────────────────────────────────────────────────┤
│ CMD-2026-0138   [Commandée partiellement]          5 art.                │
│ 11/06/2026 · récept. souhaitée 16/06/2026                                │
│ Livraison : Dépôt · Esabora : —                                       ▸  │
├─────────────────────────────────────────────────────────────────────────┤
│ CMD-2026-0131-2 [Scindée — CMD-2026-0131]          3 art.                │
│ 09/06/2026 · récept. souhaitée —                                         │
│ Livraison : Chantier                                                  ▸  │
└─────────────────────────────────────────────────────────────────────────┘
```
Par ligne : `num` · `<Badge status={statut}>` · pastille `urgent` si `urgent===true` ·
`date` · `dateReception` (souhaitée, « — » si vide) · `dateReceptionEffective` (« reçue … »
si présente) · `livraison` (Dépôt/Chantier) · état Esabora (`esaboraStatus` → libellé doux :
`synced`→« synchronisée », `pending`→« en cours », absent→« — ») · nb d'articles
(`items.length`) · chevron ▸ pour déplier. Si `createdBySplit` → badge « Scindée —
`parentOrderNum` » (en plus du badge statut).
- **Desktop** : `<DataTable>` (calibre étalon DS-2). **PWA** : cartes empilées (même bascule
  `useViewport` que les autres onglets). Aucune donnée masquée selon le device.

### Détail dépliable (clic sur une ligne)
```
  Articles (12)
  ┌────────────┬──────────────────────────┬───────────┬──────────┬─────┬────────┐
  │ Réf (r)    │ Désignation (n)          │ Cat. (c)  │ S/cat(s) │ Qté │ Unité  │
  ├────────────┼──────────────────────────┼───────────┼──────────┼─────┼────────┤
  │ SCH A9F... │ Disjoncteur 16A courbe C │ Protection│ Modulaire│  6  │ Pièce  │
  │ REX 1234.. │ Câble U1000 R2V 3G2.5    │ Câble     │ Rigide   │ 100 │ m      │
  └────────────┴──────────────────────────┴───────────┴──────────┴─────┴────────┘
```
Tableau `items` : `r · n · c · s · qty · u`. **SANS PRIX.** `img`/`signatureData` ignorés.
PWA : mêmes colonnes en cartes compactes.

---

## 4. Stratégie de tri (parse de date)
- Le champ `date` est une **string `"JJ/MM/AAAA"`** → non chronologique en tri lexical.
  `createdAt` est **absent sur les enfants de scission** → inutilisable.
- Helper local **lecture seule** :
  ```js
  function parseFrDate(s){
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s||"").trim());
    return m ? new Date(+m[3], +m[2]-1, +m[1]).getTime() : 0; // invalide → 0 (en bas)
  }
  ```
- Tri **décroissant** : `[...filtrées].sort((a,b)=>parseFrDate(b.date)-parseFrDate(a.date))`
  (copie → pas de mutation du tableau `useData`). Récent en haut. Dates illisibles/vides
  rejetées en bas, jamais d'exception.

---

## 5. Confirmation lecture seule + zéro règle/function/permission
- ✅ **Aucune écriture** : pas de `setDoc`/`updateDoc`/`addDoc`/`deleteDoc`/`serverTimestamp`
  dans le nouveau code. Aucun bouton déclenchant une écriture.
- ✅ **`chantiers`** : seulement lu via la prop `chantier` (jamais écrit).
- ✅ **`firestore.rules`** : **inchangé** — la règle `commandes` autorise déjà la lecture
  employé ; rien à déployer côté rules/CI.
- ✅ **Cloud Functions** : aucune touchée, aucune appelée.
- ✅ **Trio sensible préservé** : `permissions.js` intouché · `chantiers` lecture seule ·
  `CommandesInner.jsx` ni importé ni modifié.
- ✅ Mapping statut réutilisé via `<Badge>` (source unique), pas de recopie de table.

---

## ⏸️ STOP — j'attends ton GO.
Merci de confirmer dans ton GO : **option A** (réutiliser `useData().commandes`, recommandé)
**ou option B** (`onSnapshot` dédié filtré `chantierNum`).

# CLAUDE.md — ÉTAT RÉEL — App EPJ Globale

> **Source de vérité unique.** Lu en premier par tout assistant Claude qui ouvre
> le repo, et par toutes les conversations de ce Projet. **Prime sur les vieux
> briefs et résumés contradictoires.**
>
> Fiabilité de chaque info : **[V]** = Vérifié en direct (MCP Firebase / Vercel /
> GitHub) · **[C]** = lu dans le Code du repo · **[S]** = décidé en Spec, PAS déployé.
>
> **Dernier audit live : 2026-06-07.** Ré-auditer avant toute décision structurante.

---

## 0. En une phrase

Ce qui tourne = **Commandes (M1)** — désormais avec un **dashboard achat complet
en prod** (suivi AR fournisseurs, résync, réclamations déterministes, référentiel
fournisseurs, acquit réversible) — + **Avancement (M3, 21 chantiers ; taxonomie 2026-07 +
Étude/TMA au niveau chantier)** + serveur MCP. Développé mais peu adopté = Réserves
(M4, 1 réserve) + Parc machines (M2, désormais **déclaration de panne + suivi SAV** —
collection `outillageInterventions`).
**Gestion de chantier (M5) en prod** (nav chantier-first + permissions par onglet ;
onglets livrés = Pieuvres, Suivi commandes [+ Esabora-directes], Planning, Validation des
avancements L9, Suivi de chantier [placeholder] ; coquilles = financier, tma, démarches).
**Planning ressources (L8) en prod** — socle partagé M5/RH : **multi-tâches par créneau +
validation L9 par tâche + multi-ressources**, taxonomie postes M3, tâche libre hors avancement,
SMS récap (cron + manuel), export ICS, overlay congés + agenda mobile PWA.
**Module RH (séparé, `src/modules/rh/`) en prod** : Congés/Récupération avec **workflow
N1 (conducteur) → N2 (gestionnaire)** (`conges` DEMANDE→VALIDEE_N1→VALIDEE, soldes `rhSoldes`,
CP mai→mai jours ouvrables BTP, RCR minutes) ; **Frais de déplacement** (barème FBTP
`referentielFraisBTP`, moteur récap serveur `genererRecapFrais` → `fraisRecap`, cache
`fraisDistances`) ; **Heures salariés** (import Esabora → `heures` transverse) ; Analyse = coquille.
Rôle **Achat** en factory (`permissions.js`) — **gère l'intégralité du parc machines**. Overrides
data `rolesConfig` (Chef chantier ≈ Conducteur ; visibilité tuiles par rôle via `AdminHomeVisibility`).
Spec seulement = Chiffrage, cockpits, archi N2, mode admin, migration v11, RH-Frais-3b2 (récap éditable).

- **Nom interne** : `epj-commandes` (package.json), aussi appelé **EPJ App Globale**.
- **Cible métier** : **EPJ Électricité Générale**, PME du bâtiment.
- **PWA / mobile-first** : usage iPhone majoritaire (safe-area gérée, cf. patch v10.1).
- **Utilisateurs** : terrain (monteurs, chefs chantier, artisans), conducteurs
  travaux, assistantes, direction, admin.

---

## 1. Infrastructure réelle

### Repos GitHub [C]
- App : `EPJ38400/EPJ-Commandes-v1.2`, prod = `main` (public).
- MCP : `EPJ38400/epj-mcp`, prod = `main` (privé).
- Répertoire local canonique : `/Users/pierre-ju/Documents/APP EPJ/APP EPJ GENERALE`
  — **jamais** les snapshots du Bureau.

### Vercel — team « EPJ's projects » [V]
| Projet | Framework | Prod | Note |
|---|---|---|---|
| epj-commandes-v1-2 | Vite | READY | HEAD `main` = `2c55249` (AR EN_ATTENTE visibles) |
| epj-mcp | JS pur | READY | FIGÉ depuis ~15 mai |

À clarifier (bénin) : domaines custom `app.epj-electricite.fr` /
`mcp.epj-electricite.com` non listés Vercel (probable CNAME IONOS) ; flag
`live:false` sur les 2 projets malgré déploiements prod READY.

### Firebase [V]
- Projet : `ap-epj`. **Une seule base Firestore**, partagée par l'app ET le MCP
  (collections OAuth `mcp*`) ET les previews Vercel.
- Firebase Auth ACTIF : chaque fiche `utilisateurs` porte un `uid` Auth.
  **L'objet user porte `roles` (TABLEAU)**, pas `role` — piège corrigé en juin (cf. §11).
- Cloud Functions Node 22, europe-west1.
- **Déploiement auto via GitHub Actions sur push `main`** (`.github/workflows/main.yml`,
  paths : `functions/**`, `firebase.json`, `.firebaserc`, `firestore.rules`,
  `firestore.indexes.json`, le workflow). Le job enchaîne `firebase deploy --only functions`
  **puis** `firebase deploy --only firestore:rules,firestore:indexes` (étape « Deploy
  Firestore rules », ajoutée juin 2026 ; **correction 2026 : les indexes, d'abord oubliés,
  sont désormais inclus**). Jamais `firebase deploy` manuel sans GO.
- **⚠️ Règles ET indexes Firestore SONT désormais déployés par le CI** (depuis juin 2026 ;
  avant : déploiement manuel obligatoire). Un push `main` touchant `firestore.rules`/
  `firestore.indexes.json` les déploie automatiquement. Déploiement manuel `firebase deploy
  --only firestore:rules,firestore:indexes --project ap-epj` = filet de secours possible
  **avec GO** (ex. règle/index déjà mergé mais CI non redéclenché).
- **⚠️ CORS configuré sur le bucket Storage `ap-epj.firebasestorage.app`** (2026-07 ;
  origin `"*"`, method `GET`) — **requis pour html2canvas** (quitus : feuille en-tête,
  signature technicien, photos avant/après). Sans CORS, les `<img crossorigin="anonymous">`
  Storage sortent **blanches** du PDF. Config via gcloud/Cloud Shell
  (`gcloud storage buckets update … --cors-file`).

### Authentification Gmail [V]
- `sav@` : OAuth, aspiration + envoi.
- `achat@` : OAuth. **Token régénéré en scope `gmail.modify` (secret v3, 2026-06-07)**
  — couvre lecture poller + création de brouillons (réclamations). N'autorise PAS
  l'envoi. Régénération : toujours via OAuth Playground avec « Use your own OAuth
  credentials » coché.

### Automatisations — état définitif [V]
- **Zapier** = bridge Esabora UNIQUEMENT (`esaboraWebhookUrl` dans `config/settings`,
  `esaboraEnabled: true`).
- **Brevo** = SMS (Cloud Function sur collection `smsQueue`).
- **Gmail API** = `sav@` (réserves) + `achat@` (commandes/AR, `emailAchats` dans
  `config/settings`).
- **Claude API** = Haiku/Sonnet (`ANTHROPIC_API_KEY`). Sonnet `claude-sonnet-4-6`
  = extraction copie commande + AR. (La réclamation n'utilise PLUS d'IA, cf. §4.)
- **Make = MORT.** Ne jamais le proposer. Tout brief qui le cite comme actif est obsolète.

---

## 2. Stack technique [C]

| Couche        | Techno                                                       |
|---------------|--------------------------------------------------------------|
| Frontend      | React 18.2 + Vite 5 (`vite.config.js`)                       |
| Hosting front | Vercel (auto-deploy sur push `main`, `vercel.json`)          |
| Backend       | Firebase Cloud Functions, Node.js 22 (`firebase.json`)       |
| Auth          | Firebase Auth (JWT custom claims via `AuthContext.jsx`)      |
| Base          | Firestore (`firestore.rules`, `firestore.indexes.json`)      |
| Storage       | Firebase Storage (`storage.rules`)                           |
| Mail          | Gmail API (`sav@` et `achat@epj-electricite.com`)            |
| Imports       | `xlsx` (catalogues outils, articles)                         |
| Extraction PDF| `pdf-parse` (détection n° hors-IA) + Claude Sonnet (extraction AR) |
| CI/CD         | GitHub Actions (déploiement functions sur push `main`)       |

Versions clés : `firebase ^10.12.0`, `react ^18.2.0`, `xlsx ^0.18.5`,
`vite ^5.0.0` ; backend : `googleapis`, `firebase-admin`, `pdf-parse ^1.1.4`.

---

## 3. Structure du repo [C]

```
.
├── CLAUDE.md                       ← ce fichier (source de vérité)
├── README.md                       ← release notes courantes
├── ARCHITECTURE.md                 ← schémas Firestore Parc Machines v8
├── firebase.json · firestore.rules · firestore.indexes.json · storage.rules
├── vite.config.js · vercel.json · package.json · index.html
│
├── firestore/SCHEMA_MAILS.js       ← doc schéma collection mails
│
├── functions/                      ← Cloud Functions (Node 22)
│   ├── index.js                    ← point d'entrée (préserver require('./gmailLabels') — FIX 312260b)
│   ├── adminUsers.js · backups.js · gmailLabels.js
│   ├── gmailPoll.js                ← aspiration sav@
│   ├── gmailSend.js                ← envoi mails depuis l'app
│   ├── esaboraImport.js            ← étape 1 : webhook Zapier → tri commandesEsabora
│   ├── gmailPollAchat.js           ← étape 3 : achat@ → AR + price-watch + dateLivraisonMin/Max
│   ├── prepareAchatReclamation.js  ← réclamation/relance fournisseur (gabarit déterministe, 2 modes)
│   ├── clotureEcartAchat.js        ← clôture d'un écart (ACCORDE|REFUSE|ABANDONNE)
│   ├── planningSms.js              ← crons récap SMS planning (recap 15h30 + rappel lundi 7h)
│   ├── lib/gmailCore.js            ← cœur Gmail réutilisable (étape 2, boîte-agnostique)
│   └── package.json
│
└── src/
    ├── main.jsx · App.jsx · firebase.js · initFirestore.js
    ├── core/                       ← SOCLE transversal
    │   ├── AuthContext.jsx         ← auth + claims + refresh JWT (v1.13.6)
    │   ├── DataContext.jsx         ← cache Firestore global
    │   ├── Layout.jsx · theme.js · permissions.js
    │   ├── fournisseurs.js         ← référentiel fournisseurs partagé (getFournisseurEmail, usages)
    │   ├── smsService.js · notificationsUtils.js · emojiLibrary.js · logo.js
    │   ├── gmail/useReserveMails.js
    │   └── components/ (EmojiPicker, ErrorBoundary, ModuleSubHeader, SignaturePad, Spinner, Toast)
    ├── pages/
    │   ├── HomePage.jsx · LoginPage.jsx · DashboardDirection.jsx …
    │   └── admin/                  ← écrans Admin (dont AdminFournisseurs.jsx)
    └── modules/
        ├── commandes/              ← M1 (CommandesInner.jsx, AchatDashboard.jsx, EsaboraHistory.jsx, …)
        ├── parc-machines/          ← M2
        ├── avancement/             ← M3 (avancementTasks.js = TAXONOMIE postes, réutilisée par Planning)
        ├── reserves/               ← M4 (Brique Mail)
        ├── gestion-chantier/       ← M5 (ChantierFiche onglets, PieuvresTab, SuiviCommandesTab, pieuvresModel/Pdf)
        └── planning/               ← Planning ressources L8 (socle M5/RH) — voir §4
```

---

## 4. Modules — état réel vérifié

| # | Module | Code [C] | Usage réel [V] |
|---|---|---|---|
| M1 | Commandes | EN PROD + **dashboard achat complet** | 40 commandes — usage réel |
| M2 | Parc machines | Développé (schémas v8) + **panne & suivi SAV (2026-07)** | panne + suivi SAV livré (2026-07) ; attente photos |
| M3 | Avancement | EN PROD, dev récent intense | 21 chantiers — usage réel |
| M4 | Réserves + quitus | Développé (Brique Mail très active) | 1 seule réserve — quasi pas adopté |
| M5 | Gestion de chantier | **EN PROD** — 8 onglets : Pieuvres, Suivi commandes (+ Esabora-directes), Planning, Validation des avancements L9, Suivi de chantier (placeholder, clé `gantt`) ; financier/tma/demarches coquilles | nouveau — usage débutant |
| L8 | Planning ressources | **EN PROD** — socle transversal (`src/modules/planning/`), **multi-tâches par créneau + validation L9 par tâche + multi-ressources** ; page dédiée `module:planning` + onglet M5 | usage réel croissant |
| RH | Ressources humaines (module séparé) | **EN PROD** — onglets Congés/Récupération (workflow N1/N2), Notes de frais (barème FBTP + moteur récap serveur), Heures salariés (import Esabora) ; Analyse = coquille | usage réel croissant |

Liste officielle des modules : `src/core/permissions.js` → `MODULES`.

### M5 Gestion de chantier — L1 + onglet Pieuvres L2 (EN PROD) [C]

Renommage du stub `suivi-esabora` (« Suivi chantier ») → module `gestionChantier`
(« Gestion de chantier »). **Navigation chantier-first** : landing = liste des
chantiers filtrée `own_chantiers` pour le Conducteur (helper testant `conducteurId`
+ `affectations.conducteurId` + tableaux d'affectation, calibre Avancement) avec
toggle « Tout voir » ; Admin/Direction = tous ; ouvrir un chantier → **fiche à
onglets**. **8 onglets**, chacun = **clé de permission** `gestionChantier.<onglet>`
(pieuvres, commandes, planning, financier, suivi, gantt, tma, demarches) ; visibilité
gatée par `can()`. **Livrés** : Pieuvres (L2), Suivi commandes (`SuiviCommandesTab`),
Planning (`PlanningTab`, cf. §4 Planning), Validation des avancements (clé `suivi` →
`ValidationAvancement`, L9), **Suivi de chantier** (clé ORPHELINE `gestionChantier.gantt`
réutilisée → placeholder). **Coquilles** : financier, tma, demarches.
Assistante ne voit que financier + demarches ; Chef/Monteur/Artisan fermés par défaut
(Chef ouvrable via `permissionsOverride`, désormais aussi via l'override `rolesConfig/Chef chantier`,
cf. §6). **Lecture seule de `chantiers`** (jamais
d'écriture). Structure module classique
(`src/modules/gestion-chantier/`, calibre `avancement/`), pas de split N2.
Fichiers : `GestionChantierModule.jsx` (landing), `ChantierFiche.jsx` (onglets) ;
branché dans `App.jsx` (route `module:gestionChantier`) + tuile `HomePage.jsx`.

**Onglet Pieuvres (L2) livré** [C] : nouvelle **collection racine `pieuvres`**
(`PieuvresTab.jsx` + `pieuvresModel.js`). Génération **idempotente** des lignes
« 1 dalle = 1 pieuvre » par bâtiment depuis `buildings[].config` (ss→rdc→r→combles,
radier exclu ; `posteAvancementKey` aligné M3 : `beton-dalle-*`, combles =
`beton-combles`) ; ID déterministe `{chantierId}_{batiment}_{niveau}` (`batiment` =
lettre affichée) → ne duplique/n'écrase jamais (auto à la 1re ouverture si droit
edit + bouton « Compléter les pieuvres »). Lecture via `onSnapshot` filtré
`chantierId` (tri client, **pas d'index composite**, pas de listener global) +
**callback d'erreur** (état « réessayer », pas de blocage). Édition en ligne par
doc (`merge:true`), gardée par `can(user,"gestionChantier","edit")`. Rule
`match /pieuvres/{id}` (read employee / create-update employee / delete conducteur,
calque `reserves`). **Toujours lecture seule de `chantiers`.**

**Onglet Suivi commandes** (`SuiviCommandesTab`) : affiche AUSSI les commandes
**Esabora-DIRECTES** du chantier (`commandesEsabora` où `chantierNum == chantier.num`
ET `appCommandeId`/`appCommandeNum == null`), badge « Esabora », tri chronologique
unifié via `createdAt` (ISO). Les commandes Esabora liées à l'app (`appCommandeId`
présent) ne servent qu'à enrichir les dates — pas de doublon.

**Reste à développer** : les onglets coquilles (financier, tma, demarches) + le
placeholder Suivi de chantier + lots restants de la spec
`Spec_M5_GestionChantier_et_RH_V1.md`. Le **module RH** séparé existe désormais
(`src/modules/rh/`, cf. section dédiée ci-dessous).

### Planning ressources (L8) — socle M5/RH (EN PROD) [C]

Module transversal `src/modules/planning/` (logique pure `planningModel.js` — **aucune
dépendance Firestore**, réutilise la **taxonomie postes M3** de `avancement/avancementTasks.js`,
libellés jamais réinventés). **Deux points d'entrée** : page dédiée (route `module:planning`
dans `App.jsx`, tuile HomePage gatée `rh.planning`) **et** onglet chantier
(`gestionChantier.planning` → `PlanningTab`). Écrit **UNIQUEMENT** `planningCreneaux`
(jamais `chantiers`).

**Modèle multi-tâches** (`AffectationModal.jsx` + `planningWrites.js` + `planningModel.js`) :
un créneau `planningCreneaux/{ressourceId}_{date}_{AM|PM}` porte **`taches[]`** (chaque
tâche = `chantierId`, `batiment`, `posteAvancementKey`, `posteLabel`, `tempsEstimeH`) +
un **miroir « tâche primaire »** au niveau du doc (le `chantierId` de tête sert de clé à
la requête vue mois). Helpers : `getCreneauTaches` / `creneauTotalHours` /
`demiJourneeHeures(dayIdx, periode)`. **Compat legacy** : un ancien créneau mono-tâche
(champs plats) est lu comme 1 tâche `t0`. Anti-collision inter-chantiers par `getDoc`
autoritatif + `window.confirm` (jamais d'écrasement silencieux) ; `writeBatch` atomique.
**Affectation MULTI-RESSOURCES** : une tâche est affectable à plusieurs ressources
(écrasement de leur créneau sur le slot). **Vendredi = 4 h matin + 3 h après-midi (7 h)**.

- **Tâche libre (hors avancement)** : sans `posteAvancementKey` (label seul), avec ou sans
  chantier → part au planning. Validable par le monteur (accusé, **SANS écriture d'avancement**).
- **Validation L9 PAR TÂCHE** (`ValidationAvancement.jsx`, onglet chantier « Validation des
  avancements », clé `suivi`) : maps `validationMonteur{tacheId}` / `validationConducteur{tacheId}`
  + flag `aValiderConducteur`. Rule monteur `planningCreneaux` : update autorisé si
  `hasOnly(["validationMonteur","aValiderConducteur"])`. La vue = requête **UNION** legacy
  (`etatValidationMonteur=="FAIT"`) + `aValiderConducteur==true`. Confirmer une tâche à poste
  → `chantiers.avancementProgress[unitId][poste]=100` (`setDoc merge`, **pattern trio INCHANGÉ**) ;
  tâche libre → accusé sans avancement. **Index composite** `(chantierId ASC, aValiderConducteur ASC)`.
- **SMS planning** : cron (`functions/planningSms.js` — `planningSmsRecap` lun-ven 15h30 →
  prochain jour ouvré ; `planningSmsRappelLundi` lundi 7h → rappel du jour), **MONTEURS
  uniquement**, idempotent, **kill-switch** `config/settings.planningSmsEnabled` (OFF par défaut).
  + **SMS manuel** : bouton jour (`AffectationModal`) + bouton semaine par ressource
  (`PlanningGrid`) → `smsQueue {recipientPhone, message, type PLANNING_MANUEL|PLANNING_SEMAINE_MANUEL}`.
- **Export ICS** (`icsExport.js`) : bouton « Ajouter à mon agenda » (pur client, lecture seule,
  **non gaté** `canWrite`).
- Picker postes **groupé par catégorie** (`GroupedPosteSelect.jsx`) ; création « bulk »
  mensuelle (`PlanningBulkCreate.jsx`, `ChantierPlanningMonth.jsx`, `PlanningGrid.jsx`).

### Module RH — Congés / Récupération / Frais (EN PROD) [V][C]

Module **séparé** `src/modules/rh/`, tuile `rh._access`, shell `RHModule.jsx`
(onglets : **Congés · Notes de frais · Heures salariés · Analyse** [coquille] — gatés
par `can()` via un `permKey` : ex. onglet Heures = clé `rh.heures` mais **gate `rh.frais`**).
Socle demi-journées = **Planning ressources L8** (`planningModel.js` : `terrainResources`,
`resourcesForConductor`). Le Planning reste la **tuile standalone L8** (`module:planning`,
gatée `rh.planning`) — pas d'onglet Planning dans le shell RH.

**Congés / Récupération**
- Collection `conges` : workflow **`DEMANDE → VALIDEE_N1 → VALIDEE`** (+ REFUSEE/ANNULEE).
  N1 = conducteur (`own_chantiers`) ; N2 = direction/assistante (`all`, mode gestionnaire =
  saisie directe VALIDEE + maladie). Conducteur/Achat/Assistante demandeurs → **N1 sauté** (`sauteN1`).
- Collection `rhSoldes/{ressourceId}` : `congesSoldeInitial`, `congesAjustement` (jours),
  `rcrSoldeMinutes`. Saisie gestionnaire. **« Pris » jamais stocké** (recalculé depuis `conges` VALIDEE).
- **CP** (`congesModel.js`) : acquis 2,5 j/mois période **mai→mai**, décompte **jours ouvrables BTP**
  (`joursOuvrablesDecomptes` : lun→sam, **samedi rattaché** si vendredi), remise à zéro 1er mai.
  Solde = **acquis N-1** (initial+ajustement, disponible) / **acquis N** (2,5/mois en cours, hors
  disponible) / pris / **disponible = acquisN1 − pris**.
- **RCR/Récupération** : type `RECUP` (remplace `RTT`), prise journée=420 min / demi=210 min,
  décompte **jours ouvrés lun-ven** (`minutesRCRDecomptees`, **PAS de samedi rattaché**), solde en
  minutes (h:min), remise à zéro année civile.
- Périmètre = `salariesConges(users)` : rôles {Conducteur, Chef chantier, Monteur, Assistante,
  Achat} ; **exclut Direction/Admin/Artisan** ; trié par nom de famille.
- Badge « X à valider » sur la tuile RH (listener ciblé validateur) ; overlay planning
  (VALIDEE grisé plein / en-attente hachures) ; agenda mobile PWA (`PlanningAgendaMobile.jsx`).
- Rule `conges` **durcie** : transitions bornées par rôle (→VALIDEE_N1=conducteur, →VALIDEE=
  gestionnaire, création non-gestionnaire forcée DEMANDE), **pas de delete**. Overrides `rolesConfig`
  (data) : Monteur/Chef `rh.conges{_access:all, view/create:own_items}` ; Conducteur
  `{view:own_chantiers, create:own_items, validate:own_chantiers}` ; Direction/Assistante
  `{view/validate:all}` ; **Artisan `{_access:false}`**.

**Frais de déplacement (barème FBTP Isère)**
- `referentielFraisBTP/{annee}` : barème versionné (repas 12,06 € + 6 zones transport + 6 zones
  trajet + seuils km 5/10/20/30/40/50). Écran `FraisPage.jsx` (gestionnaire).
- `fraisModel.js` : `zonePourKm` (bornes **haute inclusive** : 20 km → zone 2) ;
  `composerIndemnite(km, bareme, {repas, base})` = **UNE composante** `trajet` (défaut) OU
  `transport`, **JAMAIS cumulées**, + **repas 12,06 € 1×/jour**. >50 km : `nb50` tranches de 50
  (zone 5) + reliquat dans sa zone (ex. 120 km trajet = 2×9,71 + 3,72 + repas).
- Adresses : `adresseDomicile` + `pointDepartFrais` (DEPOT|DOMICILE, défaut DEPOT) sur
  `utilisateurs` (**AdminUsers** via CF `adminUpdateUser`) ; adresse dépôt = `config/company`
  (**AdminCompany**, siège = dépôt). Matching salarié import = nom normalisé + `fraisMappingSalaries`.
- **Cloud Functions frais** (europe-west1, secret `GOOGLE_MAPS_API_KEY`, gate gestionnaire RH) :
  `functions/lib/distanceCore.js` (primitives partagées `resoudreOrigine`/`resoudreDestination`
  cascade `chantiers/{num}.adresse` → `chantiersEsabora/{num}` → throw / `calculerDistanceCache` /
  `loadBaremeCourant` ; erreurs porteuses de `.code`) ; `computeDistanceFrais` (wrapper + cache
  `fraisDistances/{salarieId__chantierNum__origineType}`, rule **write:false**) ; `genererRecapFrais`
  (callable, timeout 300 s) = **récap mensuel** : lit `heures where mois==`, groupe (salarié, jour),
  retient le **chantier le plus éloigné/jour** (1 indemnité/jour), flag `jourBureau`
  (`/BUREAU|DÉPÔT|ATELIER/i` → « à valider »), lit surcharges `fraisOverrides`, écrit
  `fraisRecap/{mois}` ; non-mappés / adresses manquantes → **alertes** (pas de crash).
  `functions/lib/fraisZones.js` = copie serveur de `fraisModel.js` (bundle séparé, garder en phase).

**Heures & affaires (collections transverses)**
- `heures/{mois__salarieId__chantierNum__jour}` : import xlsx Esabora (onglet « Heures salariés »,
  `HeuresSalariesPage.jsx`, `heuresModel.js` ; champs mois/date/jour/salarieId|null/trigramme/
  chantierNum/chantierLibelle/heures/rubrique). **Transverse** (servira au Suivi financier M5,
  requêtable par `chantierNum`). Idempotent. Bouton « Générer le récap {mois} » → `genererRecapFrais`.
- `chantiersEsabora/{num}` : référentiel affaires léger (num, titre, adresse, CP, ville…), import
  `AFFAIRES.xlsx` via **Administration → Chantiers & tâches → Injection affaires Esabora**
  (`AdminAffairesEsabora.jsx`, `affairesModel.js`). **NE touche PAS `chantiers` ni AdminChantiers
  (trio).** Fallback d'adresse (chantier calculable sans le créer dans le trio).
- `fraisOverrides/{mois__salarieId__chantierNum}` : surcharges (origineType, base, exclu) — **lues**
  par le moteur, **éditées en RH-Frais-3b2** (à venir).

**Roadmap RH** : RH-Frais-3b2 (récap **éditable** : surcharges Dépôt/Domicile & Trajet/Transport
par salarié×chantier, exclusion de lignes, inclusion jours bureau + **export .xlsx comptable**) ;
onglet **Analyse** (coquille) ; lien **Suivi financier M5** (lira `heures` par chantier).

### M2 Parc machines — déclaration de panne + suivi SAV (2026-07) [C]

Collection racine `outillageInterventions` (panne autonome **hors flux retour** + suivi
léger). Composants `ParcDeclarerPanne.jsx`, `ParcInterventionsTab.jsx` (onglet « Pannes &
SAV »), logique pure `outillageInterventions.js`. Statuts
`signalee→en_reparation→reparee|reformee` + notes + dates ; réutilise le catalogue
`outillagePannes`. Effets sur l'outil (`setDoc merge:true`) : panne bloquante →
`hors_service`, sinon `maintenance` ; `reparee` → `disponible` (sauf autre intervention
ouverte) ; `reformee` → `hors_service`. **Flux retour existant (`outillageSorties`)
inchangé.**

### M3 Avancement — taxonomie 2026-07 + Étude/TMA au niveau chantier [C]

**Taxonomie** (`avancementTasks.js`, ids **NEUFS**, aucun ancien id renuméroté) :
`log-10` « Pose des sèche-serviette », `cf-10` « Platine Interphone », `divers-14`
« Équipement sous-sol bloc secours » (+ relabel `divers-2` « …lustrerie »), `pla-1`
« Pose BAC D'encastrement » (`FIXED_PLACO_TASKS`), `ssequip-7..11` IRVE ; retrait factory
`com-7` (Interphone) + `com-11` (Contrôle qualité), relabel `com-1` « Colonne Montante ».
**Masquage conditionnel `hasSousSolCommun`** (défaut `false`) → `getCategoriesForConfig`
masque 9 tâches divers **PAR BÂTIMENT** quand ≥1 sous-sol commun (affichage + %).
**Étude/TMA** : catégorie `etude` sortie des catégories par bâtiment → **UNITÉ UNIQUE au
niveau chantier** (clé `etude` dans `avancementProgress`), via `getCategoriesForEtude` +
flag `excludeEtude` ; le planning `getPosteOptions` expose l'unité « Étude / TMA » ;
jointure L9 `progressUnitIdForCreneau` écrit sous `etude` (fallback). Migration des saisies
existantes (bâtiment le plus avancé → clé `etude`) faite via MCP.

### Autres fixes prod 2026-07 [C]

- **Quitus** : feuille en-tête via asset repo (`src/modules/reserves/assets/papier-entete.jpg`)
  + fallback `config/company.papierEnteteDataUri` (généré à l'upload dans `AdminCompany`)
  → en-tête présent dans le PDF ; signature technicien + photos avant/après OK grâce au
  **CORS bucket** (cf. §1).
- **Esabora** : adresse de livraison suit `order.livraison` (`'Dépôt'` → adresse dépôt EPJ
  depuis `config/company` ; `'Chantier'` → adresse chantier) (`esaboraUtils.js`).
- **Messages commandes** : helper partagé `src/modules/commandes/orderMessages.js`
  (`hasUnreadMessages`) ; enveloppe bleue par ligne d'historique + ouverture directe du fil
  depuis la bannière accueil (prop `initialOrderId`).
- **HomePage** : bannière « outil en retard » gardée par `canParc` (accès parc-machines)
  → plus visible par les monteurs.

### M1 Commandes — dashboard achat (EN PROD depuis 2026-06-07) [V][C]

**Pipeline backend (étapes 1-3, prod)** : `esaboraWebhook` (Zapier) crée
`commandesEsabora/{numero}` ; `gmailPollAchat` lit `achat@`, route par expéditeur
(`@esabora.solutions` = copie commande → `lignesCommande` ; autre domaine = AR
fournisseur → `lignesAR` + `arStatut: RECU`) ; price-watch ligne à ligne
(normalisation des préfixes fabricant) → `achatEcartsPrix`.

**Dashboard achat (front + functions, mergés `62c8b27` → `93b8b3c` → `2c55249`)** :
- **Section « AR à suivre »** (`AchatDashboard.jsx`, ex « AR manquants à relancer ») :
  affiche les commandes **MANQUANT** (AR en retard) **ET EN_ATTENTE** (AR pas
  encore reçu) non acquittées → une commande est visible dès qu'elle part, donc
  acquittable tout de suite (cas dernière minute sans AR). Badges distincts :
  « En attente · depuis Xj » (gris, depuis `copieRef.dateCopie`/`createdAt`) vs
  « En retard · Xj » (orange/rouge). Tri : retard d'abord, puis EN_ATTENTE date desc.
- **Résync manuelle** : bouton « ↻ Relancer la recherche des AR » (`forceSyncAchat`) ;
  scope élargi `has:attachment newer_than:30d` (capte les AR rangés hors inbox).
  Visible Admin/Direction (lecture `user.roles`).
- **Réclamations déterministes** (`prepareAchatReclamation`, plus d'IA) : 2 modes —
  `ecart` (prix + quantités) / `relance` (AR manquant). Destinataire : custom →
  expéditeur AR → `fournisseurs[relance]` → vide. Auto-capture du contact
  (`source: auto`, n'écrase jamais un contact `manuel`). Brouillon créé dans `achat@`.
- **Référentiel fournisseurs partagé** : page admin « Contacts fournisseurs »
  (Direction/Admin), source unique Commande + futures consultations Chiffrage.
- **Dates de livraison** : `dateLivraisonPrevue` par ligne (`lignesAR`) + plage
  dérivée par commande (`dateLivraisonMin/Max`) ; affichées dans l'historique.
- **Acquit / Sans AR réversibles** : confirmation avant action + sous-section
  « Traitées récemment » avec bouton « Annuler ». Écritures bornées aux 4 champs
  autorisés par les rules.

**Invariants** : ingestion lecture seule de `chantiers`/`commandes` (jamais
d'écriture) ; collections achat/Esabora **neuves** ; `codeFournisseur` Esabora ==
`codeEsabora` catalogue ; commande **toujours** créée (webhook) avant l'AR ;
préfixe réf 3 lettres = **fabricant** (tolérance au matching, jamais déduction du
fournisseur).

### Utilisateurs [V]
26 fiches en base `utilisateurs` (effectif + sous-traitants + comptes admin/compta).
**3 accès actifs réels.** Les autres fiches servent aux SMS et affectations chantier.

---

## 5. Les 3 dashboards [C]

(`src/core/permissions.js` → `DASHBOARDS`)

| Code           | Accès par défaut                                    |
|----------------|-----------------------------------------------------|
| `direction`    | Admin + Direction                                   |
| `conducteur`   | Admin + Direction + Conducteur travaux              |
| `public`       | Tous sauf Artisan                                   |

Dashboard direction : `src/pages/DashboardDirection.jsx`. Dashboard achat :
`src/modules/commandes/AchatDashboard.jsx` (suivi AR fournisseurs).

---

## 6. Les 8 rôles & le modèle de permissions [C]

Rôles (`ROLES` dans `permissions.js`) : **Admin** (total + écrans admin) ·
**Direction** (total sauf delete) · **Conducteur travaux** (scoped `own_chantiers`) ·
**Assistante** (large, pas validate/delete) · **Achat** (pilotage achats : commandes
plein, avancement/réserves lecture, **parc machines plein — gère l'intégralité**,
gestionChantier onglets pieuvres/commandes/financier, `_admin:true` ; factory depuis
juin 2026, l'override `rolesConfig/Achat` reste prioritaire par clé — à ne pas confondre
avec le flag user `directAchat`) · **Chef chantier** (`own_chantiers`, crée/édite) ·
**Monteur** (ses items) · **Artisan** (très restreint).

**Achat & parc machines (2026-07)** : le rôle **gère l'intégralité du parc** — outils
`create/update/delete`, catalogues `outillageCategories`/`outillagePannes`, suppression
`outillageSorties`/`outillageInterventions`. Côté rules via le helper **`isAchat()`**
(`outils.update` + catalogues parc l'acceptent désormais) ; côté front via **`parcUtils.js`**
(`canSortirOutil`/`canGererCatalogue`/`canImportExportOutils` incluent `"achat"`).
⚠️ **Rappel token** : le claim `role="Achat"` doit être **frais** → logout/login après
pose du rôle (sinon rules en `permission-denied`).

**Modèle 3 couches** : (1) **FACTORY** `DEFAULT_PERMISSIONS` (code, jamais perdu) ;
(2) **OVERRIDE DE RÔLE** Firestore `rolesConfig/{role}` ; (3) **OVERRIDE
UTILISATEUR** `user.permissionsOverride`. Permission =
`{ _access, view, create, edit, delete, validate, export }` avec scopes
`all | own_chantiers | own_items | false`.

**Overrides de rôle posés en data (2026, `permissions.js` NON touché)** :
- `rolesConfig/Chef chantier` = **clone des droits effectifs du Conducteur travaux**
  (chef ≈ conducteur : validation avancement `own_chantiers`, gestion de chantier +
  planning + financier `own_chantiers`). Effet au **logout/login** (refresh claim),
  prioritaire par clé.
- **Visibilité d'accueil par rôle** (`AdminHomeVisibility`, `src/pages/admin`) : tuiles
  d'accueil + dashboards visibles PAR RÔLE, stockés dans
  `rolesConfig[role]._homeTiles` / `._dashboards` (**données pures — `can()` les ignore**,
  `permissions.js` non touché). `HomePage` filtre via `getEffectiveRolePerms(role)._homeTiles`
  (défaut = tuile visible).
- Overrides `rh.conges` par rôle : cf. §4 Module RH.

⚠️ Côté front, l'utilisateur porte **`roles` (tableau)** — tester
`(user?.roles || []).some(r => […])`, **jamais** `user.role` (singulier).
Côté rules / Cloud Functions, le rôle effectif est le custom claim
`request.auth.token.role`.

---

## 7. Cloud Functions [C] (Node 22, europe-west1)

Pré-existantes : `index.js` (point d'entrée, **préserver `require('./gmailLabels')`
— FIX `312260b`**), `adminUsers.js`, `backups.js`, `gmailLabels.js`,
`gmailPoll.js` (sav@), `gmailSend.js`.

Cluster achat / Esabora (déployées) :
| Fonction | Rôle |
|----------|------|
| `esaboraWebhook` / `esaboraSweep` | bridge Zapier → tri `commandesEsabora` |
| `gmailPollAchat` (onSchedule 5 min) | poller `achat@` → AR + price-watch + `dateLivraisonMin/Max` |
| `forceSyncAchat` (callable Admin/Direction) | résync full, scope large |
| `prepareAchatReclamation` (callable pilotage) | brouillon achat@ **déterministe**, modes `ecart`/`relance`, auto-capture contact `fournisseurs` |
| `clotureEcartAchat` (callable pilotage) | clôt un écart (ACCORDE\|REFUSE\|ABANDONNE) → `RESOLU` |

`lib/gmailCore.js` = cœur réutilisable (buildGmailClient, runGmailSync, parse,
downloadAttachments, callClaudeJson) — module lib, pas exporté.

Cluster Planning (déployées, `planningSms.js`, exportées via `index.js`) :
| Fonction | Rôle |
|----------|------|
| `planningSmsRecap` (onSchedule lun-ven 15h30) | récap SMS aux **monteurs** du prochain jour ouvré → `smsQueue` (idempotent) |
| `planningSmsRappelLundi` (onSchedule lundi 7h) | rappel du planning du jour |

Kill-switch commun : `config/settings.planningSmsEnabled` (OFF par défaut). Lit
`planningCreneaux`/`chantiers`/`utilisateurs`, écrit **uniquement** `smsQueue`.

Cluster RH / Frais (déployées, gate gestionnaire RH, secret `GOOGLE_MAPS_API_KEY`) :
| Fonction | Rôle |
|----------|------|
| `computeDistanceFrais` (callable) | test distance + indemnité FBTP d'un couple salarié×chantier ; wrapper de `lib/distanceCore.js` + cache `fraisDistances` |
| `genererRecapFrais` (callable, timeout 300 s) | récap mensuel : `heures where mois==` → groupe (salarié, jour) → chantier le plus éloigné → indemnité → écrit `fraisRecap/{mois}` + alertes ; lit `fraisOverrides` |

`lib/distanceCore.js` = primitives partagées (`resoudreOrigine`/`resoudreDestination`
cascade `chantiers`→`chantiersEsabora`→throw / `calculerDistanceCache` / `loadBaremeCourant`) ;
`lib/fraisZones.js` = copie serveur de `fraisModel.js` (garder en phase). **`chantiers`
lecture seule** ; écrivent `fraisDistances`/`fraisRecap` (Admin SDK — rules `write:false`).

**Secrets (Secret Manager)** : `BREVO_API_KEY`, `GMAIL_CLIENT_ID`,
`GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` (sav), `GMAIL_ACHAT_REFRESH_TOKEN`
(achat, scope `gmail.modify` v3), `ANTHROPIC_API_KEY`, `ESABORA_WEBHOOK_TOKEN`,
`GOOGLE_MAPS_API_KEY`.

Logique fine non documentée ici : lecture du code `functions/` requise.

---

## 8. Firestore — collections réelles (audit 2026-06-07 = 30) + ajouts M5/Planning/Parc/RH [C]

```
achatEcartsPrix · avancementValidations · catalogue · chantiers · commandes ·
commandesEsabora · conges · config · esabora_import · fournisseurs · fournisseursContacts ·
gmailAchatExtractions · gmailConfig · gmailConfigAchat ·
outillageCategories · outillageInterventions · outillagePannes · outillageSorties · outils · pieuvres ·
planningCreneaux · reserveMails · reserveMailsAClasser · reserves · reservesCategories ·
reservesEmetteurs · rolesConfig · smsQueue · smsTemplates · utilisateurs ·
mcpAccessTokens · mcpAuthCodes · mcpClients · mcpRefreshTokens
```
Ajouts RH (2026) : `rhSoldes` · `referentielFraisBTP` · `heures` · `fraisMappingSalaries` ·
`chantiersEsabora` · `fraisDistances` · `fraisRecap` · `fraisOverrides` (cf. §4 Module RH).

`pieuvres/{chantierId_batiment_niveau}` (M5 onglet Pieuvres) : `chantierId`, `batiment`
(lettre), `niveau`, `posteAvancementKey` (jointure M3), `jourDemande`/`dateReceptionPlansCotes`/
`dateLivraison` (Timestamp|null), `lieuLivraison` (CHANTIER|BUREAU), `statut`
(A_DEMANDER|DEMANDEE|PLANS_RECUS|LIVREE), `commandeId`, `remarques`, `createdAt`/`updatedAt`.
Généré idempotemment depuis `buildings[].config` ; aucune écriture dans `chantiers`.

`planningCreneaux/{ressourceId}_{date}_{AM|PM}` (Planning L8) — **multi-tâches** :
`taches[]` (chaque tâche = `chantierId`, `batiment`, `posteAvancementKey`, `posteLabel`,
`tempsEstimeH`) + **miroir « tâche primaire »** au niveau du doc (chantierId de tête =
clé requête vue mois). Aussi : `ressourceId`/`ressourceNom`/`ressourceType`, `date` (ISO),
`periode` (AM|PM), validation L9 **par tâche** (`validationMonteur{tacheId}` /
`validationConducteur{tacheId}` + flag `aValiderConducteur`), champs legacy L9
(`etatValidationMonteur`/`etatValidationConducteur`, lus en UNION), `smsEnvoye`,
`creePar`/`modifiePar`/`createdAt`/`updatedAt`. **Compat legacy** : créneau mono-tâche plat
= 1 tâche `t0`. **POOL** « à affecter » = id auto (`ressourceId:null`). Vendredi 4 h + 3 h.
**Écrit uniquement par le module Planning ; jamais d'écriture `chantiers`.**

`conges/{autoId}` (Module RH) : `ressourceId` (= id user), `ressourceNom`/`ressourceType`,
`type` (**CP|RECUP|MALADIE|SANS_SOLDE|AUTRE** — `RECUP` remplace `RTT`), `du`/`au` (ISO, inclus),
`demiJourneeDebut`/`demiJourneeFin` (AM|PM), `motif` (nullable), **`statut`
(DEMANDE|VALIDEE_N1|VALIDEE|REFUSEE|ANNULEE)**, `sauteN1`, champs de validation par niveau,
`creePar`/`creeParNom`, `createdAt`/`updatedAt`. Workflow N1 (conducteur) → N2 (gestionnaire).
Lu par l'onglet Congés + `PlanningGrid` (overlay, lecture seule). **Pas de delete** (rule durcie,
transitions bornées par rôle).

`rhSoldes/{ressourceId}` (Module RH) : `congesSoldeInitial`, `congesAjustement` (jours),
`rcrSoldeMinutes`. Saisie gestionnaire. **« Pris » jamais stocké** (recalculé depuis `conges` VALIDEE).

`outillageInterventions/{id}` (M2 Parc SAV, 2026-07) : `outilId`, `outilRef`, `outilNom`,
`panneIds[]`, `descriptionLibre`, `statut` (signalee|en_reparation|reparee|reformee),
`dateSignalement`, `dateReparation`, `notes`, `declareePar`/`declareeParNom`,
`createdAt`/`updatedAt`. Effets miroir sur `outils` (`setDoc merge:true`). Rules :
`match /outillageInterventions/{id}` (read/create/update **employee**, delete **admin|achat**) ;
`outils.update` + catalogues parc (`outillageCategories`/`outillagePannes`) acceptent
désormais **`isAchat()`**.

### Cluster achat / Esabora
- `commandesEsabora/{numero}` — id = n° Esabora 6 chiffres. Champs : `codeFournisseur`,
  `arStatut` (EN_ATTENTE/RECU/MANQUANT/SANS_AR), `arAcquitte/arAcquitLe/arAcquitPar`,
  `lignesCommande[]`, `lignesAR[]` (avec `dateLivraisonPrevue`), `dateLivraisonMin/Max`,
  `ecartTotal`, `nbLignesEnEcart`, `arRef`/`copieRef`, `arRelanceLe/arRelancePar/arRelanceDraftUrl`,
  `appCommandeId`/`appCommandeNum` (lien vers `commandes`, multiple si commande scindée par fournisseur).
- `achatEcartsPrix/{numero__refNorm}` — écarts de prix ligne à ligne
  (statut OUVERT|RECLAME|RESOLU + champs reclame*/cloture*).
- `fournisseurs/{code}` — référentiel partagé. **6 fiches** : COT, FRAN, KRA, PUM,
  REXEL, SONE. `{ code, nom, actif, telephone, contacts[]{id,nom,email,telephone,usages[],source} }`.
  SONE porte le contact migré `jean-michel.calvo@sonepar.fr` (usages `relance`, source `auto`).
- `fournisseursContacts/{code}` — ancienne mémoire de contacts (**orpheline** depuis
  la migration vers `fournisseurs`, non supprimée, non lue/écrite).
- `gmailAchatExtractions` (cache terminal par gmailId) · `gmailConfigAchat/main`
  (sync incrémentale par historyId, poller `actif`, sain) · `esabora_import` (staging brut webhook).

### Cluster RH / Frais
- `referentielFraisBTP/{annee}` — barème FBTP versionné : `annee`, `repas`, `transport{1a..5}`,
  `trajet{1a..5}`, seuils km (5/10/20/30/40/50). Read employé / write gestionnaire (pas de delete).
- `heures/{mois__salarieId|NC-trigramme__chantierNum|NA__jour}` — heures Esabora **transverses**
  (RH frais + Suivi financier M5) : `mois`, `date`, `jour`, `salarieId|null`, `trigramme`,
  `chantierNum|null`, `chantierLibelle`, `heures`, `rubrique`, `importLot`/`importAt`. Idempotent.
- `chantiersEsabora/{num}` — référentiel affaires léger : `num`, `titre`, `adresse`, `codePostal`,
  `ville`, `etat`, `nomClient`… Fallback d'adresse frais. **Séparé du trio `chantiers`.**
- `fraisMappingSalaries/{nomNormalise}` — rapprochement nom fichier → `salarieId` (mémoire d'import).
- `fraisDistances/{salarieId__chantierNum__origineType}` — cache distance routière : `distanceKm`,
  `dureeMin`, `origineHash`, adresses + méta. **write:false** (Cloud Function only).
- `fraisRecap/{mois}` — récap mensuel : `mois`, `genereAt`/`generePar`, `bareme` (année),
  `salaries[]{salarieId, nom, origineDefaut, jours[]{date, chantierNum, chantierLibelle, origineType,
  base, distanceKm, deplacement, repas, total, alerte?, jourBureau?}, totalMois, nbJours}`,
  `alertes[]{type, salarieId?, chantierNum?, message}`. **write:false** (Cloud Function only).
- `fraisOverrides/{mois__salarieId__chantierNum}` — surcharges récap : `origineType?`, `base?`,
  `exclu?`, `majPar`/`majAt`. Lues par le moteur (édition RH-Frais-3b2). Read employé / write gestionnaire.

### Rappels schémas
- `chantiers/{id}` — id = n° Esabora 6 chiffres ; `buildings[]`, `avancementProgress{}`.
  **Collection sensible (§11).**
- `commandes/{id}` — id auto Firebase ; `num` = CMD-2026-XXXX ; `items[]` (sans dates) ;
  scission `splitInto[]`/`createdBySplit`/`parentOrderId`. **Lecture seule côté Module Commande.**
- `utilisateurs/{id}` — id = nom de famille ; `roles[]`, `permissionsOverride{}`, `uid`.
- `config/settings` — config globale (`esaboraWebhookUrl`, `esaboraEnabled`, `emailAchats`,
  `arAlerteDelaiJours` défaut 2 = délai avant AR « MANQUANT »).
- `tasksConfig/default` : toujours absente.

Write-safety : `esaboraWebhook` et `gmailPollAchat` écrivent en **merge** sur
`commandesEsabora` ; `commandes/` et `chantiers/` uniquement **lues**.

---

## 9. Versioning & workflow Git

- `main` = prod (chaque push → Vercel + GitHub Actions functions). Branches
  features/patchs : `feature/...`, `fix/...`, `vX.Y.Z-stabilisation`.
- Convention commits : préfixe métier explicite (`fix(functions):`, `feat(reserves):`,
  `security(rules):`, `docs:`…). **Commits atomiques par domaine** (config, rules,
  functions, core, assets, docs) ; un commit = un sujet relisable, pas de monolithe.
- **PJ édite parfois directement sur GitHub** → `origin/main` peut être en avance
  sur le HEAD local. **Toujours `git fetch origin` + `git diff origin/main -- <fichier>`
  AVANT tout commit/merge.**
- Lecture d'un diff `git diff origin/main` : `-` = source = `origin/main` ;
  `+` = cible = local. **Écrire explicitement** « `-` = origin/main, `+` = local »
  avant de conclure « avance/retard ». Grep une clé attendue sur les fichiers
  stratégiques avant conclusion.
- **Audit du vrai code sur GitHub** (raw, par SHA) avant tout GO de merge — ne pas
  se fier au seul résumé de Claude Code.

---

## 10. Spec non déployée & roadmap [S]

Décidé, ZÉRO code en prod : **Chiffrage** (pièces admin RC, mémoire technique,
tarifs fournisseurs, démarches post-devis) · **Cockpits par rôle** + IA personnelle ·
**Archi Niveau 2** (`pwa/` + `desktop/` + `core/`) · **Mode admin central** ·
**Migration sécurité v11**.

### En cours / prochain
- **Point 1 en attente (TRIO SENSIBLE)** : afficher les dates de livraison AR
  **par ligne dans le Module Commande** (`CommandesInner.jsx`) — cross-ref
  `commandes` → `commandesEsabora` par `appCommandeId`, match par référence
  normalisée, agrégation des commandes scindées, lecture seule. **GO écrit requis.**
  (`CommandesInner` est désormais repeint DS-2/responsive — cf. §13 lot trio.)
- **Chantier desktop** : arbre responsive unique (desktop + PWA même base, PAS
  d'archi « deux arbres »). Avancement, Réserves, Home, AdminOutillage et
  **Commandes (lot trio)** livrés ; la suite au fil des chantiers métier.
- **Design-system : CHANTIER FERMÉ** (2026-06-12, cf. §13). Prochain chantier :
  **Cockpit Direction v1** (spec courte à venir — maquette validée par PJ,
  `ChatPanel` déjà livré).
- **RH-Frais-3b2** (prochain lot RH) : écran récap **éditable** (surcharges Dépôt/Domicile
  & Trajet/Transport par salarié×chantier via `fraisOverrides`, exclusion de lignes, inclusion
  des jours bureau) + **export .xlsx comptable**. Puis onglet **Analyse** RH + lien **Suivi
  financier M5** (lira `heures` par `chantierNum`).

Les modules 1 à 4 sont en **stabilisation / finitions**, pas de redéveloppement.
Toute refonte d'un module existant doit être justifiée et validée par PJ.

---

## 11. Garde-fous & principes de travail avec PJ

### 🔴 Trio sensible — confirmation ÉCRITE obligatoire avant modif
1. `src/core/permissions.js` (factory layer).
2. Collection Firestore `chantiers` + tout code qui la manipule.
3. `src/modules/commandes/CommandesInner.jsx` (repeint lot trio 2026-06, PR #11 —
   reste sensible : module de prod le plus utilisé, logique intacte à l'octet).

Un GO oral ou implicite ne suffit pas.

### Write safety
- `setDoc(..., { merge: true })` obligatoire sur les docs `chantiers`.
- Écritures client `commandesEsabora` : **rules bornées aux 4 champs**
  `arAcquitte/arAcquitPar/arAcquitLe/arStatut`, réservées à `isAssistante()`
  (Admin/Direction/Conducteur/Assistante). Aucune création/suppression client.
- `fournisseurs/{code}` : lecture employés, écriture `isDirection()`.
- `planningCreneaux/{id}` : read tout employé ; create/update/delete uniformes
  **Admin/Assistante/Conducteur/Chef chantier** ; update **Monteur** borné à
  `hasOnly(["validationMonteur","aValiderConducteur"])` (validation L9 par tâche). Le gating
  fin `own_chantiers`/`own_items` est côté client. Écrit par le Planning ressources (L8) ;
  l'overlay congés et l'agenda mobile sont en **lecture seule** de `conges`.
- `conges/{id}` : rule **durcie** — transitions bornées par rôle (→VALIDEE_N1 = conducteur,
  →VALIDEE = gestionnaire, création non-gestionnaire **forcée `DEMANDE`**), **PAS de delete**
  (annulation = update `statut:"ANNULE"`). Le gating fin `rh.conges` par rôle est assuré côté
  client par `can()` + overrides `rolesConfig` (cf. §4).
- `rhSoldes/{id}` : read employé / write gestionnaire RH.
- RH frais : `referentielFraisBTP`/`heures`/`fraisMappingSalaries`/`chantiersEsabora`/
  `fraisOverrides` = read employé / **write gestionnaire RH** ; `fraisDistances`/`fraisRecap`
  = read employé / **write:false** (Cloud Function only). Helper rule `isGestionnaireRH()`
  = role ∈ [Admin, Direction, Assistante]. **`chantiers` lecture seule** dans tout le module Frais.
- L'app tourne avec des **données réelles** (40 commandes, 21 chantiers d'avancement,
  réserves) : perte de commandes/réserves **inacceptable**, perte d'avancement
  rattrapable mais à éviter. Toute modif `firestore.rules`/`storage.rules`/`DataContext.jsx`
  doit préserver la compatibilité des données existantes.

### Git & déploiement
- Preprod (branche → preview Vercel) → **GO écrit** → merge `main` (auto Vercel prod +
  GitHub Actions functions **+ firestore:rules,firestore:indexes**).
- **Jamais** `firebase deploy` / `vercel --prod` / merge `main` / push `main` sans GO écrit.
- **Rules ET indexes Firestore passent désormais par le CI** (`main.yml` déploie
  `firebase deploy --only firestore:rules,firestore:indexes` — correction 2026 : les indexes
  étaient auparavant oubliés). Un push `main` touchant `firestore.rules`/`firestore.indexes.json`
  les déploie automatiquement. Déploiement manuel `firebase deploy --only firestore:rules,firestore:indexes
  --project ap-epj` = filet de secours avec GO. Sans déploiement, la feature dépendante reste
  en `permission-denied` (rule) ou requête en échec (index composite manquant).
- ⚠️ **Modif d'un fichier `.github/workflows/*`** : le token Claude Code n'a pas le scope
  GitHub `workflow` → push refusé. Toute retouche du workflow passe par PJ (terminal/GitHub web).

### Rythme & format
- PJ veut l'app **rapidement opérationnelle en prod**. Plans **concis**, exécution
  sans tergiverser une fois validés. Ne pas multiplier les questions quand le brief
  est clair (une seule question groupée si nécessaire).
- **100 % de complétion par feature** avant la suivante ; pas de code mort / fichiers orphelins.
- Réponses en **français**, denses, structurées, sans verbiage. **Toujours signaler
  les écarts brief ↔ réalité observée** (« tu m'as dit X, je vois Y »).
- **Optim crédit** : PJ fait les diagnostics triviaux (git status, ls, cat, diff
  visuels) en Terminal natif. Claude intervient pour comprendre/écrire du code ;
  proposer la commande plutôt que l'exécuter si trivialement faisable côté PJ.
- Pas de séparateurs `===` dans `echo` (zsh) : `---` ou rien.

### Erreurs à NE PAS reproduire
Committer sans diff `origin/main` · inverser la lecture d'un diff · déployer / merger
sans GO · toucher au trio sensible sans confirmation écrite · proposer Make · écrire
un doc `chantiers` sans `merge:true` · croire qu'un sujet « spec » est déployé ·
tester `user.role` (singulier) au lieu de `user.roles` (tableau) · committer
`functions/index.js` sans préserver l'export `gmailLabels` (FIX `312260b`).

---

## 12. Où chercher quoi

| Besoin | Source |
|--------|--------|
| État applicatif courant | **ce fichier** + `README.md` |
| Schémas Firestore Parc Machines | `ARCHITECTURE.md` |
| Schéma collection mails | `firestore/SCHEMA_MAILS.js` |
| Permissions par rôle (factory) | `src/core/permissions.js` |
| Design tokens (couleurs/typo/radius/space/shadow) | `src/core/theme.js` (objet `EPJ` + `font`/`radius`/`space`/`fontSize`/`fontWeight`/`shadow`/`globalCss`) |
| Primitives UI (DS-1) | `src/core/components/` (Banner, Badge, Button, Field, StatCard, DataTable, ListRow, ChatPanel + `useInteractive`) |
| Loi du design (charte) | `docs/DIRECTION_ARTISTIQUE.md` · audit reliquat : `npm run audit:tokens` |
| Auth + refresh JWT | `src/core/AuthContext.jsx` |
| Cache Firestore | `src/core/DataContext.jsx` |
| Règles sécurité prod | `firestore.rules`, `storage.rules` |
| Config CI/CD | `.github/workflows/` |
| Ingestion commandes Esabora | `functions/esaboraImport.js` |
| Cœur Gmail réutilisable | `functions/lib/gmailCore.js` |
| AR achat@ + price-watch + dates livraison | `functions/gmailPollAchat.js` |
| Réclamation/relance fournisseur | `functions/prepareAchatReclamation.js` |
| Référentiel fournisseurs (helper partagé) | `src/core/fournisseurs.js` |
| Dashboard achat (front) | `src/modules/commandes/AchatDashboard.jsx` |
| Historique commandes Esabora (front) | `src/modules/commandes/EsaboraHistory.jsx` |
| Admin contacts fournisseurs | `src/pages/admin/AdminFournisseurs.jsx` |
| Planning — logique pure (semaine, ID créneau, postes) | `src/modules/planning/planningModel.js` |
| Planning — payloads créneau (source unique) | `src/modules/planning/planningWrites.js` |
| Planning — surface d'écriture (affecter/pool/libérer) | `src/modules/planning/AffectationModal.jsx` |
| Planning — validation L9 (monteur/conducteur) | `src/modules/planning/ValidationAvancement.jsx` |
| Planning — crons SMS récap | `functions/planningSms.js` |
| M5 fiche chantier (onglets) | `src/modules/gestion-chantier/ChantierFiche.jsx` |
| Non-lu messages commandes (helper) | `src/modules/commandes/orderMessages.js` (`hasUnreadMessages`) |
| Parc — panne & suivi SAV | `ParcDeclarerPanne.jsx` · `ParcInterventionsTab.jsx` · `outillageInterventions.js` |
| Parc — droits (Achat inclus) | `src/modules/parc-machines/parcUtils.js` |
| Avancement — unité Étude/TMA + taxonomie | `getCategoriesForEtude` / `getCategoriesForConfig` (`avancement/avancementTasks.js`) |
| Planning — exposition unité Étude/TMA | `getPosteOptions` (`planning/planningModel.js`) |
| RH — shell / onglets | `src/modules/rh/RHModule.jsx` |
| RH — congés/récup (soldes, décomptes BTP) | `src/modules/rh/congesModel.js` · `CongesPage.jsx` · `CongeModal.jsx` |
| RH — frais : zones/indemnité (front) | `src/modules/rh/fraisModel.js` · écran `FraisPage.jsx` |
| RH — heures salariés (import Esabora + récap) | `src/modules/rh/HeuresSalariesPage.jsx` · `heuresModel.js` |
| RH — frais : distance partagée (serveur) | `functions/lib/distanceCore.js` (+ copie zones `functions/lib/fraisZones.js`) |
| RH — frais : test distance/indemnité | `functions/computeDistanceFrais.js` |
| RH — frais : moteur récap mensuel | `functions/genererRecapFrais.js` → `fraisRecap/{mois}` |
| RH — injection affaires Esabora (admin) | `src/pages/admin/AdminAffairesEsabora.jsx` · `src/modules/rh/affairesModel.js` |
| Admin — visibilité tuiles/dashboards par rôle | `src/pages/admin/AdminHomeVisibility.jsx` (`rolesConfig[role]._homeTiles/._dashboards`) |

---

## 13. Design System — briques actives & chantier DS-2

### Briques actives & fixes critiques

- **Lot 0 desktop** (mergé) · `useViewport` (`src/core/useViewport.js`), `Layout`
  pilote `fullWidth` (seuil 760 → cadre 1320). Source unique des bascules de largeur.
- **Socle DS-0** (mergé, `657b6fd`) · tokens charte complets dans `src/core/theme.js`
  (`gray600`/`gray400`, fonds doux `*Bg`, textes `*Text`, `fontSize`, `fontWeight`,
  `shadow`, accents `urgent`/`catEtude`) + audit `scripts/audit-tokens.mjs`
  (`npm run audit:tokens`). `docs/DIRECTION_ARTISTIQUE.md` = loi du design.
- **2026-06 · DS-1 primitives** (Banner, Badge, Button, Field, StatCard, DataTable,
  ListRow, ChatPanel) · `src/core/components/`, conformes `docs/DIRECTION_ARTISTIQUE.md`.
  Mergé en prod (PR #3). Écrans témoins : `HomePage` (bannières → `<Banner>`),
  `ReserveDetail` (statuts → `<Badge>`). Bascule densité PWA/desktop **dans** les
  primitives (via `useViewport`).
- **2026-06 · DS-2 pilote `AdminOutillage`** (mergé prod, PR #4, `64ee571`) ·
  **étalon DS-2 figé**. `ModuleSubHeader` + rangée `<StatCard>` + barre outils
  (`<Field>` recherche/catégorie + chips statut `<Button ghost/secondary>`) +
  `<DataTable>` dense (cartes auto PWA) + formulaire full `<Field>`/`<Button>`.
  Affichage only (logique/Firestore/schémas inchangés) ; sorti du top 10 audit
  (était #2). **Calibre tous les écrans DS-2 suivants** — s'en inspirer.
- **2026-06 · DS-2 module Avancement** (mergé prod, PR #5) · 4 écrans repeints :
  `AvancementModule` (liste → `<DataTable>` + `<StatCard>` + `<Banner>`),
  `AvancementChantier` (cœur saisie terrain — tokens only, gestes inchangés,
  CTA validation → `<Button primary>`), `AvancementHistory` (snapshots →
  `<DataTable>`), `AvancementEvolution` (matrice pivot bespoke tokenisée).
  **Zone sensible `chantiers`** : 9 écritures Firestore vérifiées identiques à
  main à l'octet près. `exportUtils.js`/`avancementTasks.js` intouchés.
- **2026-06 · DS-2 module Réserves** (mergé prod, PR #7, `703a085`) · 12 fichiers
  repeints (affichage only, **+906/−1031**) : `ReservesInner` (KPI → `<StatCard>`,
  liste → `<DataTable>` + cartes PWA, `<Banner>`/`<Field>`/chips `<Button>`),
  `ReserveDetail` (au-delà des `<Badge>` déjà DS-1 : `<Button>`/`<Field>` + cartes
  `panel()` tokenisées), `ReserveCreate` & `ReserveLevee` (formulaires `<Field>`,
  **canvas `SignaturePad` intact**), Brique Mail (`MailTimeline`/`MailItem`/
  `MailsAClasser`/`MailReplyComposer` — tokens + fonds doux `*Bg`, **logique de
  rattachement/fusion inchangée**), `ChantierEditModal`/`PhotoDropZone`/
  `AttachmentsManager`. **17 écritures Firestore vérifiées identiques à main par
  fichier** ; `reservesUtils.js`/`quitusPdfGenerator.js`/`QuitusActions.jsx`/
  `gmail/useReserveMails.js` intouchés. `fontWeight` en dur du module **64 → 0** ;
  `ReserveDetail` sorti du top 10 audit (était #3). Total reliquat global
  2438 → 2027.
- **2026-06 · DS-2 HomePage** (mergé prod, PR #9, `cff981c`) · **dernier écran
  DS-2 hors trio**. Repeinte durable mais non définitive (réceptacle futur des
  cockpits — on a monté l'existant au niveau étalon, sans préjuger du layout
  cockpit). `Tile` tokenisé (`fontWeight` en dur **6 → 0**), pill « Bientôt » →
  `<Badge tone="neutral">`, compteur notif tokenisé. Grille responsive : PWA
  2 colonnes **inchangée** ; desktop → `auto-fill minmax(240px,1fr)` aéré dans
  le cadre 1320. DA §5 : focus clavier tuiles (`tabIndex`/`role`/Enter-Espace +
  `:focus-visible` `shadow.focus` sur `.epj-tile`, `theme.js` scopé à cette
  seule règle). DA §8 : retrait animation d'entrée `stagger`. `<Banner>` non
  régressés ; **aucune écriture Firestore** (HomePage n'en fait pas). Total
  reliquat global 2027 → 2011. **DS-2 terminé hors trio.**
- **2026-06 · Primitives v1.1** (mergé prod, PR #10, `2140190`) · consolidation du
  socle **avant le lot trio**, évolutions **strictement additives** (défauts =
  rendu historique, zéro régression call sites existants ; +147/−93, 10 fichiers).
  Nouvelle primitive **`<IconButton>`** (`src/core/components/IconButton.jsx` —
  icône-seule ghost 34/44, `label`/aria-label obligatoire + warn, variantes
  `neutral`/`danger`, focus clavier). **`<Button size="sm">`** (dense ; `md` défaut
  inchangé). **`<Field>` v1.1** : fix `onBlur`/`onFocus` composés (reset interne PUIS
  handler appelant — anneau persistant corrigé), `inputStyle`/`mono` **merge en
  dernier (l'appelant gagne)**, `dense` + `width` (inline). Tokens **`EPJ.scrim`
  /`EPJ.scrimDark`** (theme.js). **Retrofits** (1 commit/module, 0 écriture Firestore
  modifiée) : `AdminOutillage` + `AvancementHistory` `IconBtn` locaux → `<IconButton>`
  (**2 dups supprimées**) ; rename inline tâches Avancement → `<Field dense>` ;
  ✏️ `ReserveDetail` → `<IconButton>` ; 3 scrims (`ChantierEditModal`, SmsPicker,
  overlay photo) → tokens. **Laissés bespoke à dessein** : overlay × photo (contraste
  sur image, `scrimDark`), chips pleins 🗑, `HoursPanel` (rangée inline largeurs
  custom + Enter-submit). Total reliquat global 2011 → 2009.
- **2026-06 · LOT TRIO `CommandesInner.jsx`** (mergé prod, PR #11, `6646d0a`) ·
  **DERNIER lot du chantier design.** 8 commits (`0a272b1` → `d746888`), GO écrit
  PJ + audit Claude.ai par SHA + retour test PJ. Affichage only, **audité à
  l'octet** : 33 écritures Firestore, scission (`performPartialPass`/`passLog`),
  push Esabora, canvas signature et génération num CMD **identiques à main**
  (md5 de 28 blocs de logique + compteurs de refs sensibles, tous égaux).
  Livré : 15 vues repeintes tokens/primitives (statuts → `<Badge>` table
  centralisée, formulaires → `<Field>`, CTA gradients → flat `<Button>`,
  ✏️/🗑 → `<IconButton>`) ; **responsive étalon** (PWA colonne 520 inchangée,
  desktop `<DataTable>` Historique/À commander, formulaires 720, cadre 1320) ;
  **signature** : la souris était DÉJÀ câblée (hypothèse du ticket infirmée),
  canvas intact à l'octet, testée doigt + souris par PJ ; **perf** : `@import`
  fonts supprimé + xlsx en `import()` dynamique (vendor-xlsx 143 Ko gz sorti du
  chunk commandes). Fix au passage : bouton Esabora « Re-synchroniser »
  (`EPJ.gray500` undefined sur l'objet local). **Couleurs workflow actées PJ**
  (commit 8) : Envoyée = bleu info · Commandée/Réceptionnée **partiellement =
  violet** (`EPJ.violetBg` + `catEtude`) · Commandée = vert clair (`success`) ·
  Réceptionnée = **vert foncé PLEIN** (`successStrong`, fond `greenText`/texte
  blanc — seule exception assumée au pattern fond doux, état terminal). Tones
  `violet`/`successStrong` ajoutés à `<Badge>`, entrées des autres modules
  intactes. Tests : 9 suites / 350 OK.

### Chantier design : FERMÉ (2026-06-12)

- **DS-0 → DS-2 + Primitives v1.1 + lot trio : tout est mergé en prod.** Plus
  aucun écran en file. Dashboard Direction volontairement hors DS-2 (refondé
  en « cockpit Direction », cf. §10 — décision PJ 2026-06-11).
- **Audit `npm run audit:tokens`** : exception trio retirée du script —
  `CommandesInner` compté normalement. Total reliquat **2277** (= 2009 + 268
  CommandesInner, dont ~195 dans les générateurs **print INLINE**
  `PdfView`/`generateAndOpenPdf`, légitimes au même titre que
  `quitusPdfGenerator.js` qui est exclu par fichier). Hors zones print :
  13 couleurs justifiées (canvas signature à l'octet, verre dépoli header,
  bandeau sombre), **0 `fontWeight` numérique**.
- **Épilogue optionnel (non bloquant, hors chantier)** : mini-lot DS-2
  `AchatDashboard.jsx` (80 occurrences — `ArStatusBadge`, `KpisAchat`,
  `FiltresBarreAchat`…) + micro-lot extraction du print inline de
  `CommandesInner` vers un fichier exclu de l'audit (ferait tomber le fichier
  à ~73 occurrences).
- **Référence design** : `docs/DIRECTION_ARTISTIQUE.md` (loi du design,
  inchangée — toujours citée dans tout futur ticket UI).

### Primitives v1.1 — LIVRÉ (PR #10) + reliquat ouvert

**Résolu dans v1.1** (cf. brique active) :
- ✅ **`<IconButton>`** créé — remplace les `IconBtn` locaux (AdminOutillage,
  AvancementHistory dups supprimées ; ✏️ ReserveDetail).
- ✅ **`<Button size="sm">`** — variante dense.
- ✅ **`<Field>` `onBlur` composé** — anneau persistant corrigé (rename Avancement).
- ✅ **`<Field>` `inputStyle`/`mono`** — merge en dernier, l'appelant gagne.
- ✅ **`<Field>` `dense`/`width`** — variante inline.
- ✅ **Tokens `EPJ.scrim`/`scrimDark`** — 3 scrims Réserves tokenisés.

**Encore ouvert (hors v1.1, à traiter quand un 2e écran le justifie)** :
- **`<DataTable>` — matrices pivot** : colonnes dynamiques par période, 1re colonne
  sticky, lignes hiérarchiques dépliables, cellules double contenu (valeur + delta).
  `AvancementEvolution` reste une table bespoke tokenisée. → variante `PivotTable`
  **seulement si** un 2e écran en a besoin (sinon laisser bespoke). *(relevé sur Avancement)*
- **Adoption résiduelle de `<Field dense>`** : `HoursPanel` (Avancement) et le composer
  mail `MailReplyComposer` (Réserves) restent bespoke/empilés — retrofit optionnel,
  non bloquant (la variante existe désormais).

---

## 14. Performance — boot & chargement

### PERF-1 (mergé prod, PR #6) — boot iPhone
- **Code-splitting** : `React.lazy` + `<Suspense>` dans `App.jsx` pour les
  modules (commandes/avancement/parc/réserves), `AdminPage` et les pages
  secondaires (dashboards, change-password). Restent statiques au boot :
  `LoginPage`, `HomePage`, `Layout`, watchers. Fallback = `Spinner` existant.
- **`vendor-xlsx` sorti du boot** : tiré uniquement par les chunks lazy
  commandes/admin. `CommandesInner.jsx` non touché (xlsx sort mécaniquement).
- **Quitus PDF en import dynamique** : `quitusPdfGenerator` n'est plus importé
  statiquement (warning Vite éteint). `QuitusActions` **précharge** le module à
  la montée et appelle `openQuitusWindow` en **synchrone** au clic → `window.open`
  reste dans le geste utilisateur (bloqueur pop-up iOS évité).
- **Fonts** : `@import` Google Fonts retiré de `globalCss` (render-blocking) →
  `<link rel=preconnect/stylesheet>` dans `index.html` (parallèle au JS).
  Familles/graisses inchangées.
- **`vite.config.js`** : forme fonction `defineConfig(({ mode }) => …)` pour le
  drop des `console.log` (robustesse vs `process.env.NODE_ENV`).
- **Gain** : bundle JS gzippé au boot **≈396 → ≈189 Ko** (chunk `index`
  233 → **25 Ko gz**).

### PERF à faire
- **PERF-2** : la donnée chargée au boot (`DataContext` ouvre tous les listeners
  Firestore dès l'auth). **À investiguer** : `tasksConfig/default` documenté
  comme « toujours absent » (cf. §8) — vérifier l'impact / le lazy-load des
  collections non critiques au premier écran.
- **PERF-3** : service worker / precache PWA (offline + cache des chunks lazy).
- **Reliquat @import CommandesInner : RÉSOLU** (lot trio, PR #11) — `@import`
  supprimé (le `<link>` PERF-1 couvre toutes les familles) + xlsx du module en
  `import()` dynamique : vendor-xlsx (143 Ko gz) ne charge plus avec le chunk
  commandes, seulement à l'export/import Excel admin ou au push Esabora.

---

*Dernier audit live : 2026-06-07 (MCP Firestore `ap-epj` + GitHub + Vercel).
Mise à jour doc 2026-07-03 [C] : Planning ressources (L8) + M5 (8 onglets, 4 livrés) +
`planningCreneaux` + crons `planningSms` documentés depuis le code — **pas** de nouvel
audit live Firestore (volumes `planningCreneaux`/usage réel à re-vérifier au prochain audit).
Mise à jour 2026-07-03 : parc panne/SAV, Achat gère le parc, taxonomie M3, Étude/TMA
chantier, CORS quitus, adresse Esabora, messages commandes, bannière monteur — documentés
depuis le code [C].
Mise à jour 2026-07-05 [C] : Module RH (tuile `rh` + onglet Congés RH-2a, collection
`conges` ACTIF|ANNULE) + overlay congés sur le Planning L8 (RH-2b/bis, grisé + cause) +
vue agenda mobile (RH-2d, `PlanningAgendaMobile`) documentés depuis le code — **pas** de
nouvel audit live Firestore (volumes `conges` à vérifier au prochain audit).
Mise à jour 2026-07-13 [C] : sync majeure Planning (multi-tâches par créneau `taches[]` +
validation L9 PAR TÂCHE + multi-ressources, index `(chantierId, aValiderConducteur)`) ;
M5 (onglet Suivi de chantier placeholder clé `gantt`, SuiviCommandesTab + Esabora-directes) ;
Module RH refondu (congés workflow **N1→N2** + `rhSoldes`, RCR/récup, barème FBTP + moteur
récap serveur `genererRecapFrais`/`fraisRecap` + `distanceCore` partagé, heures `heures`,
affaires `chantiersEsabora`, `fraisDistances`/`fraisMappingSalaries`/`fraisOverrides`) ;
overrides data `rolesConfig` (Chef chantier ≈ Conducteur) + `AdminHomeVisibility` ; CI déploie
rules **ET** indexes. Documenté depuis le code + notes PJ — **pas** de nouvel audit live Firestore.
Maintenir à jour quand l'archi évolue.*

# CLAUDE.md — Contexte projet EPJ App Globale

> Ce fichier est lu en premier par tout assistant Claude qui ouvre le repo.
> Il décrit l'application, son architecture, ses règles de travail et les pièges
> documentés. À jour au **2026-06-03**.

---

## 1. Identité du projet

- **Nom interne** : `epj-commandes` (package.json), aussi appelé **EPJ App Globale**.
- **Repo GitHub** : `EPJ38400/EPJ-Commandes-v1.2`, branche prod = `main`.
- **Cible métier** : **EPJ Électricité Générale**, PME du bâtiment.
- **Usage** : application interne unique pour piloter chantiers, commandes,
  parc machines, réserves & quitus, et suivi Esabora.
- **Utilisateurs** : équipes terrain (monteurs, chefs chantier, artisans),
  conducteurs travaux, assistantes, direction, admin.
- **PWA / mobile-first** : usage iPhone majoritaire (safe-area gérée
  explicitement, cf. patch v10.1).

---

## 2. Stack technique

| Couche        | Techno                                                       |
|---------------|--------------------------------------------------------------|
| Frontend      | React 18.2 + Vite 5 (`vite.config.js`)                       |
| Hosting front | Vercel (auto-deploy sur push `main`, `vercel.json`)          |
| Backend       | Firebase Cloud Functions, Node.js 22 (`firebase.json`)       |
| Auth          | Firebase Auth (JWT custom claims via `AuthContext.jsx`)      |
| Base          | Firestore (rules dans `firestore.rules`, indexes idem)       |
| Storage       | Firebase Storage (rules dans `storage.rules`)                |
| Mail          | Gmail API (Workspace, boîtes `sav@` et `achat@epj-electricite.com`) |
| Imports       | `xlsx` (catalogues outils, articles)                         |
| Extraction PDF| `pdf-parse` (détection n° hors-IA, import sous-chemin `pdf-parse/lib/pdf-parse.js`) + Claude Sonnet (extraction AR) |
| CI/CD         | GitHub Actions (déploiement functions sur push)              |

**Versions clés** (`package.json`) : `firebase ^10.12.0`, `react ^18.2.0`,
`xlsx ^0.18.5`, `vite ^5.0.0`. Backend (`functions/package.json`) :
`googleapis`, `firebase-admin`, `pdf-parse ^1.1.4`.

### Automatisations & services externes

| Service / Outil       | Usage actuel                                            | Statut       |
|-----------------------|---------------------------------------------------------|--------------|
| **Zapier**            | Bridge Esabora : envoi commandes → Esabora (sortant) **+** push entête « New Order Placed » → Cloud Function `esaboraWebhook` (onRequest, token header `x-epj-token`) | ✅ Actif |
| **Brevo**             | Envoi de SMS (Cloud Functions → API Brevo)              | ✅ Actif      |
| **Gmail API**         | Aspiration `sav@` (réserves, inchangée) **+** `achat@` en **LECTURE SEULE** (`gmail.readonly`, sans libellé, lecture directe) via `gmailPollAchat` + envoi mails depuis l'app | ✅ Actif |
| **Claude API**        | Sonnet (`claude-sonnet-4-6`) pour extraction copie commande + AR ; classement mails sav (`ANTHROPIC_API_KEY`) | ✅ Actif |
| **Make (Integromat)** | —                                                       | ❌ **ABANDONNÉ** |

> **Make est définitivement abandonné chez EPJ.** Ne jamais le proposer
> comme solution (ni pour OCR, ni pour SMS, ni pour quoi que ce soit).
> Pour toute automatisation nouvelle, raisonner Zapier / Cloud Function
> Firebase / Brevo.

---

## 3. Structure du repo

```
.
├── CLAUDE.md                       ← ce fichier
├── README.md                       ← release notes courantes (v10 actuellement)
├── ARCHITECTURE.md                 ← schémas Firestore Parc Machines v8
├── LISEZ_MOI_PREMIER.md            ← Brique Mail v1.13.0 (procédure d'install)
├── NOTICE_UTILISATEUR.md           ← doc utilisateur final (long)
├── PATCH_ReserveDetail.txt         ← patch manuel d'un fichier précis
├── package.json                    ← deps front + scripts npm
├── vite.config.js
├── vercel.json
├── firebase.json                   ← config Cloud Functions (Node 22)
├── firestore.rules                 ← règles sécurité Firestore
├── firestore.indexes.json
├── storage.rules
├── index.html
│
├── public/                         ← assets statiques (icônes, manifest PWA)
│
├── firestore/
│   └── SCHEMA_MAILS.js             ← doc schéma collection mails
│
├── functions/                      ← Cloud Functions (Node 22)
│   ├── index.js                    ← point d'entrée, exporte les functions
│   ├── adminUsers.js               ← gestion utilisateurs (create, role, password)
│   ├── backups.js                  ← backups Firestore automatiques
│   ├── gmailLabels.js              ← gestion labels Gmail (FIX 21/05 — cf §10)
│   ├── gmailPoll.js                ← aspiration mails sav@ (Brique Mail v1.13.0)
│   ├── gmailSend.js                ← envoi mails depuis l'app
│   ├── esaboraImport.js            ← Module Commande étape 1 : webhook Zapier → tri commandesEsabora
│   ├── gmailPollAchat.js           ← Module Commande étape 3 : achat@ → AR + price-watch
│   ├── lib/
│   │   └── gmailCore.js            ← cœur Gmail réutilisable (étape 2, boîte-agnostique, factorisé SANS toucher gmailPoll.js)
│   └── package.json                ← deps backend (googleapis, firebase-admin, pdf-parse…)
│
└── src/
    ├── main.jsx                    ← entrée React
    ├── App.jsx                     ← router racine
    ├── firebase.js                 ← init SDK Firebase (front)
    ├── initFirestore.js            ← seed initial (rôles, config)
    │
    ├── core/                       ← SOCLE transversal
    │   ├── AuthContext.jsx         ← auth + claims + refresh JWT (v1.13.6)
    │   ├── DataContext.jsx         ← cache Firestore global
    │   ├── Layout.jsx              ← layout app (header + nav + safe-area)
    │   ├── permissions.js          ← ROLES, MODULES, DEFAULT_PERMISSIONS (3 couches)
    │   ├── theme.js                ← tokens UI + safe-area utils
    │   ├── logo.js
    │   ├── emojiLibrary.js
    │   ├── notificationsUtils.js
    │   ├── smsService.js           ← deeplink sms: + presse-papier
    │   ├── gmail/
    │   │   └── useReserveMails.js  ← hook timeline mails d'une réserve
    │   └── components/
    │       ├── EmojiPicker.jsx
    │       ├── ErrorBoundary.jsx   ← (à ajouter par patch v2.0.0)
    │       ├── ModuleSubHeader.jsx
    │       ├── SignaturePad.jsx    ← source de vérité signature
    │       ├── Spinner.jsx
    │       └── Toast.jsx
    │
    ├── pages/
    │   ├── HomePage.jsx            ← accueil + bannières (retards outils, etc.)
    │   ├── LoginPage.jsx
    │   ├── ForgotPasswordPage.jsx
    │   ├── ChangePasswordPage.jsx
    │   ├── DashboardDirection.jsx  ← dashboard "direction"
    │   └── admin/                  ← écrans Admin (catalogues, utilisateurs…)
    │
    └── modules/                    ← MODULES MÉTIER (cf §4)
        ├── commandes/              ← M1 — commandes + suivi Esabora
        ├── parc-machines/          ← M2 — outils, sorties, packs, SMS rappel
        ├── avancement/             ← M3 — avancement chantier
        └── reserves/               ← M4 — réserves & quitus + Brique Mail
```

---

## 4. Les 5 modules métier — état réel

Liste officielle (cf. `src/core/permissions.js` → `MODULES`) :

| # | Nom officiel              | Dossier                          | État réel                                                  |
|---|---------------------------|----------------------------------|------------------------------------------------------------|
| 1 | Commandes                 | `src/modules/commandes/`         | ✅ **EN PROD** — envoi Esabora via Zapier OK ; extension Esabora/AR back en prod (cf. Module Commande) |
| 2 | Parc machines             | `src/modules/parc-machines/`     | ✅ **DÉVELOPPÉ** — en attente photos Excel avant usage      |
| 3 | Avancement chantier       | `src/modules/avancement/`        | ✅ **EN TEST PROD** avec 3 utilisateurs                     |
| 4 | Réserves + quitus         | `src/modules/reserves/`          | ✅ **DÉVELOPPÉ** — Brique Mail fonctionnelle                |
| 5 | Suivi chantier + Esabora  | *(à créer)*                      | 🟠 **BACK PARTIEL EN PROD** — ingestion Esabora + AR achat livrée (Module Commande étapes 1-3) ; front Module 5 complet restant |

### Module Commande — extension Esabora / AR achat (en cours)

Brique transverse qui alimente M1 et préfigure M5. Suit toutes les commandes
(app + Esabora) par chantier, extrait les AR fournisseurs depuis `achat@`,
contrôle les écarts de prix, alimente un dashboard achat. Construite en 4 étapes :

| Étape | Contenu                                                        | État |
|-------|---------------------------------------------------------------|------|
| 1 | **Pull Esabora** — webhook Zapier `esaboraWebhook` → tri 3 cas → `commandesEsabora/{numero}` | ✅ **EN PROD** |
| 2 | **`gmailCore`** — cœur Gmail réutilisable factorisé (`functions/lib/gmailCore.js`) | ✅ **EN PROD** |
| 3 | **`gmailPollAchat`** — `achat@` → extraction copie/AR (Claude Sonnet) + matching `numero` + price-watch ligne à ligne + AR manquant | ✅ **EN PROD** |
| 4 | **Front** — historique commandes par chantier + dashboard achat (AR manquant / écart prix + acquittement « Sans AR ») | ⏳ **À FAIRE** |

Invariants : ingestion lecture seule de `chantiers`/`commandes` (jamais
d'écriture) ; collections **neuves** (`commandes`/`chantiers` intactes) ;
`codeFournisseur` Esabora == `codeEsabora` catalogue ; commande **toujours**
créée (webhook) avant l'AR fournisseur ; préfixe réf 3 lettres = **fabricant**
(tolérance au matching, jamais déduction du fournisseur).

> **Module Commande = première brique concrète du suivi Esabora (territoire
> M5).** Le **backend est EN PROD depuis le 2026-06-03** (étapes 1-2-3, merge
> `54a452c`). Le **front (étape 4) n'est PAS développé** — ne jamais le marquer
> comme déployé.

### Roadmap restante

**Socle (finitions transverses) → Module Commande étape 4 (front Esabora/AR)
→ Module 5 (Suivi chantier + Esabora, reste à développer).**

Les modules 1 à 4 sont en phase **stabilisation / finitions**, pas
de redéveloppement. Toute proposition de refonte d'un module existant
doit être justifiée par un besoin métier explicite et validée par PJ.

### Spec non déployée & décisions d'archi (2026-06-03)

- **Front Module Commande (étape 4)** — historique commandes par chantier +
  dashboard achat (alertes AR manquant / écart prix) + acquittement « Sans AR ».
  **PAS déployé.**
- **Décision archi (2026-06-03)** : ce front se fait en **arbre responsive
  unique** (desktop + PWA dans la même base), **PAS** en archi N2 « deux arbres ».
- **Migration desktop de toute l'app** = chantier **séparé et progressif**, qui
  **touchera le trio sensible** → **GO écrit requis** (cf. §11).
- Toujours au stade **spec** (non développés) : Chiffrage, cockpits, mode admin
  étendu, migration v11.

---

## 5. Les 3 dashboards

(`src/core/permissions.js` → `DASHBOARDS`)

| Code           | Accès par défaut                                    |
|----------------|-----------------------------------------------------|
| `direction`    | Admin + Direction                                   |
| `conducteur`   | Admin + Direction + Conducteur travaux              |
| `public`       | Tous sauf Artisan                                   |

Dashboard direction : `src/pages/DashboardDirection.jsx`.
Dashboard conducteur : à confirmer (probablement injecté dans
`HomePage.jsx` selon le rôle).

---

## 6. Les 7 rôles et le modèle de permissions

Rôles officiels (`ROLES` dans `permissions.js`) :
1. **Admin** — accès total + accès aux écrans admin
2. **Direction** — accès total sauf delete
3. **Conducteur travaux** — scoped à `own_chantiers`
4. **Assistante** — accès large mais pas validate/delete
5. **Chef chantier** — scoped à `own_chantiers`, peut créer/éditer
6. **Monteur** — accès restreint à ses items
7. **Artisan** — accès très restreint (login + visu minimale)

### Modèle 3 couches (cf. en-tête `permissions.js`)

1. **FACTORY** — `DEFAULT_PERMISSIONS` dans le code, jamais perdu, garantit
   un retour aux valeurs usine.
2. **OVERRIDE DE RÔLE** — Firestore `rolesConfig/{role}`, modifiable
   depuis Admin.
3. **OVERRIDE UTILISATEUR** — `user.permissionsOverride` sur la fiche
   d'un user spécifique.

Toute permission est de la forme `{ _access, view, create, edit, delete, validate, export }` avec
des **scopes** : `all`, `own_chantiers`, `own_items`, ou `false`.

---

## 7. Cloud Functions (Node 22)

Toutes exportées via `functions/index.js`.

| Fichier              | Rôle                                                          |
|----------------------|---------------------------------------------------------------|
| `index.js`           | Point d'entrée — `require()` tous les autres modules          |
| `adminUsers.js`      | CRUD utilisateurs + setRole + reset password                  |
| `backups.js`         | Backup Firestore programmé                                    |
| `gmailLabels.js`     | Gestion labels Gmail — **FIX 21/05** : import admin réparé    |
| `gmailPoll.js`       | Aspiration mails entrants `sav@epj-electricite.com`           |
| `gmailSend.js`       | Envoi de mails depuis l'app (réponse à une réserve)           |
| `esaboraImport.js`   | `esaboraWebhook` (onRequest, token header) + `esaboraSweep` (10 min) → tri `commandesEsabora` |
| `lib/gmailCore.js`   | Cœur Gmail réutilisable (buildGmailClient, runGmailSync, parse, downloadAttachments, callClaudeJson) — **module lib, pas exporté** |
| `gmailPollAchat.js`  | `gmailPollAchat` (onSchedule 5 min) + `forceSyncAchat` (callable Admin/Direction) → AR `achat@` + price-watch |

**Fonctions exportées** (`index.js`) : `onSmsQueueCreate`, `purgeSmsQueue`,
`admin*`, `weekly*Backup` / `adminTriggerBackup` / `adminListBackups`,
`gmailPoll` / `forceSyncGmail`, `gmailSend`, `onMailAClasserUpdate`,
`esaboraWebhook` / `esaboraSweep`, `gmailPollAchat` / `forceSyncAchat`.

**Secrets (Google Secret Manager)** : `BREVO_API_KEY`, `GMAIL_CLIENT_ID`,
`GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` (sav), `GMAIL_ACHAT_REFRESH_TOKEN`
(achat), `ANTHROPIC_API_KEY`, `ESABORA_WEBHOOK_TOKEN` (token webhook Zapier).

> **Déploiement** : automatique via GitHub Actions sur push `main`
> (cf. `.github/workflows/`). Ne JAMAIS faire `firebase deploy` manuel
> sans accord explicite (cf. §11). `gmailPoll.js` et `lib/gmailCore.js`
> sont **distincts** : le rebranchement de `gmailPoll` sur `gmailCore` est
> une étape ultérieure non encore faite.

---

## 8. Firestore — collections principales

(cf. `ARCHITECTURE.md` pour le détail Parc Machines, `firestore/SCHEMA_MAILS.js`
pour les mails)

```
utilisateurs/{id}            — fiches users (rôle, téléphone pour SMS, permissionsOverride)
chantiers/{id}               — chantiers + affectations  ⚠️ collection sensible (cf §11)
config/settings              — config globale (+ arAlerteDelaiJours, défaut 2 : délai avant AR « MANQUANT »)
rolesConfig/{role}           — couche 2 du modèle permissions
tasksConfig/default          — config tâches avancement

commandes/{id}               — bons de commande app (suivi Esabora inclus, envoi Zapier)  ⚠️ lecture seule côté Module Commande

# ── Module Commande (collections NEUVES — commandes/chantiers intactes) ──
esabora_import/{numero}      — staging brut webhook Zapier (importStatus pending/processed)
esabora_deadletter/{autoId}  — entêtes Esabora sans numero exploitable
commandesEsabora/{numero}    — historique unifié (origine APP|ESABORA, lignesCommande, lignesAR,
                               totalAR, ecartTotal, nbLignesEnEcart, arStatut EN_ATTENTE|RECU|MANQUANT|SANS_AR,
                               arAcquitte, copieRef, arRef, chantierActif)
achatEcartsPrix/{numero__ref}— écarts de prix ligne à ligne (price-watch), id déterministe
gmailConfigAchat/main        — config aspiration achat@ (auto-bootstrap, séparée de gmailConfig sav)
gmailAchatExtractions/{gmailId} — cache terminal par mail (done|no_numero|no_match) + extraction mémorisée
# Write-safety : esaboraWebhook ET gmailPollAchat écrivent en merge sur commandesEsabora
#                (jamais d'écrasement) ; commandes/ et chantiers/ uniquement LUES.

outils/{id}                  — parc outils (+ isPack, packContent v10)
outillageCategories/{id}     — catalogue catégories
outillagePannes/{id}         — pannes récurrentes
outillageSorties/{id}        — historique sorties (+ packSortieId v10)

reserves/{id}                — réserves chantier
reserves/{id}/mails/{mailId} — mails aspirés (Brique Mail v1.13.0)

smsTemplates/{id}            — modèles SMS globaux (multi-modules)
avancementValidations/{chantier_mois} — gel mensuel d'avancement
```

> **État live (relevé PJ 2026-06-03, à re-vérifier avant de figer)** :
> `gmailConfigAchat/main` présent ; `commandesEsabora` et `esabora_import`
> **vides (0 doc)** ; `achatEcartsPrix`, `gmailAchatExtractions`,
> `esabora_deadletter` apparaîtront au 1er usage réel. (Lecture Firestore non
> faisable depuis Claude Code — état fourni par PJ, ne pas figer sans recontrôle.)

---

## 9. Versioning & workflow Git

### Branches
- `main` — branche prod, **chaque push déclenche Vercel + GitHub Actions**.
- Branches features / patchs : `vX.Y.Z-stabilisation`, `fix/...`, `feat/...`.
- **PR souhaitée** pour les patchs > 3 fichiers, sinon commit direct possible
  par PJ depuis l'UI GitHub.

### Convention de commits
Préfixe métier explicite, en français/anglais :
- `fix(functions): ...`
- `feat(reserves): brique timeline mail v1.13.0 ...`
- `chore: ...`
- `docs: ...`
- `security: ...`

### Versionning sémantique
- Version applicative tracée dans `package.json` (actuellement `1.10.21`).
- Versions de briques internes (Brique Mail v1.13.0, Labels Gmail v1.18.0,
  Parc Machines v10, etc.) tracées dans README + CHANGELOG.

### Pièges connus PJ (à respecter absolument)
- **PJ édite parfois directement sur GitHub** (commits typés
  *"Add files via upload"*) → `origin/main` peut être en avance sur le HEAD
  local sans qu'on s'en aperçoive.
- **Toujours faire `git fetch origin` + `git diff origin/main -- <fichier>`
  AVANT tout `git commit`**, sur chaque fichier touché.
- Le 21 mai 2026 : un quasi-commit régressif sur `functions/index.js` +
  `src/core/AuthContext.jsx` (versions locales en retard) a été stoppé in
  extremis. → Voir mémoire `feedback-verify-origin-before-commit`.

### Lecture d'un diff `git diff origin/main -- <file>`
- Lignes `-` = source = `origin/main` (l'arg de gauche)
- Lignes `+` = cible = working tree local
- **Toujours écrire explicitement** « `-` = origin/main, `+` = local »
  AVANT de conclure « le local est en avance / en retard ».
- Pour les fichiers stratégiques (dépendances, permissions, schémas),
  grep une clé attendue (ex. `grep googleapis package.json`) **AVANT** toute
  conclusion. → Voir mémoire `feedback-diff-direction-origin`.

---

## 10. Briques actives et historique des fixes critiques

| Date       | Brique                                  | Fichiers touchés                                  |
|------------|-----------------------------------------|---------------------------------------------------|
| 2026-06-03 | **Module Commande étapes 1-3** (Pull Esabora + gmailCore + AR achat@ + price-watch) | `functions/esaboraImport.js`, `functions/lib/gmailCore.js`, `functions/gmailPollAchat.js`, `index.js`, `package.json` (merge `54a452c`) |
| 2026-05-21 | **Fix gmailLabels admin import**        | `functions/gmailLabels.js` (commit `312260b`)     |
| 2026-04-21 | Patch v10.2 — alerte structure Safari   | docs seulement                                    |
| 2026-04-21 | Patch v10.1 — safe-area iPhone          | `index.html`, `theme.js`, `Layout.jsx`, panier    |
| —          | Parc Machines v10 — SMS + packs         | `src/modules/parc-machines/*`, `HomePage.jsx`     |
| —          | Brique Mail v1.13.0                     | `src/modules/reserves/Mail*.jsx`, `gmail*.js`     |
| —          | Labels Gmail v1.18.0                    | `functions/gmailLabels.js`                        |
| —          | Refresh JWT v1.13.6                     | `src/core/AuthContext.jsx`                        |

> Le fix **312260b** débloque 24h de déploiements échoués sur GitHub
> Actions. Tout patch qui touche `functions/index.js` doit le préserver
> (vérifier que `export … from "./gmailLabels.js"` reste en place).

> **Module Commande — garde-fous** : `commandesEsabora` (et les autres
> collections Esabora/achat) sont **neuves**, **hors trio sensible** (trio
> inchangé : `permissions.js`, `chantiers`, `CommandesInner.jsx`).
> `esaboraWebhook` et `gmailPollAchat` écrivent en **merge** sur
> `commandesEsabora` ; `commandes/` et `chantiers/` sont uniquement **lues**.

---

## 11. Principes de travail avec PJ (Pierre-Julien)

### Rythme attendu
- PJ a besoin que **l'app soit rapidement opérationnelle en production
  complète**. Aller vite, proposer des plans **concis**, exécuter sans
  tergiverser une fois validés.
- **Ne pas multiplier les questions de clarification quand le brief est
  clair.** Une seule question groupée si vraiment nécessaire ; sinon,
  proposer et exécuter.
- Les réponses doivent être **denses, structurées, sans verbiage**.

### Cadrage avant exécution
- **Toujours proposer un plan** avant d'exécuter des changements non
  triviaux (création de branche, séries de commits, déploiement).
- PJ valide, puis on exécute. Une validation vaut **pour la scope
  demandée**, pas au-delà.

### 🔴 Trio sensible — confirmation écrite obligatoire

**Avant toute modification** des éléments suivants, **confirmation
explicite écrite de PJ obligatoire** (un GO oral ou implicite ne suffit
pas) :

1. **`src/core/permissions.js`** — modèle de permissions (factory layer).
   Un mauvais cran sur ce fichier peut casser l'accès de tous les rôles.
2. **Collection Firestore `chantiers`** ET tout code qui la manipule
   (création, édition, affectation, suppression). C'est la donnée
   pivot de l'app : tous les modules en dépendent.
3. **`src/modules/commandes/CommandesInner.jsx`** (3873 lignes) —
   refactoring déjà programmé séparément. Pas de modif opportuniste.

### Données réelles en prod (3 users en test)

L'app tourne actuellement avec **3 utilisateurs réels en mode test prod**.
Toute modification touchant :

- `firestore.rules`
- `storage.rules`
- `src/core/DataContext.jsx`

… doit **préserver la compatibilité des données existantes** :
commandes envoyées, réserves créées, données d'avancement saisies.
Une perte d'avancement chantier est **rattrapable** (à ressaisir) mais
**à éviter**. Une perte de commandes ou de réserves est **inacceptable**.

### Découpage des changements
- Privilégier **des commits atomiques par domaine** (config root,
  security rules, functions, composants core, assets, docs).
- **Pas de commit monolithique**. Un commit = un sujet relisable.

### Complétion par feature
- **100 % de complétion par feature avant de passer à la suivante**.
  On ne laisse pas une fonctionnalité à moitié branchée pour démarrer la
  suivante. Le code mort ou les fichiers orphelins sont à éviter.

### Déploiements
- **Vercel** : auto sur push `main`, donc tout push prod est observable.
- **Firebase Functions** : auto via GitHub Actions sur push `main`.
- **JAMAIS** lancer `firebase deploy` manuellement sans confirmation
  explicite et écrite de PJ.
- **JAMAIS** merger une branche de stabilisation sur `main` sans
  validation explicite et écrite.

### Optimisation crédit Claude
- PJ fait souvent les diagnostics simples (git status, ls, cat, unzip,
  diff visuels) en **Terminal natif macOS hors Claude Code**, pour
  économiser le crédit API.
- Claude intervient pour **comprendre, modifier, écrire du code** —
  pas pour exécuter des commandes purement diagnostiques quand PJ peut
  les faire lui-même.
- Si une commande est utile mais trivialement faisable en Terminal,
  proposer la commande à PJ plutôt que de l'exécuter.

### Tone & format
- Réponses en **français**, concises, structurées.
- Pas de résumé final inutile si le diff parle de lui-même.
- Toujours signaler explicitement les **écarts entre le brief et la
  réalité observée** (ex. : « tu m'as dit X, je vois Y »).

---

## 12. Où chercher quoi

| Besoin                                              | Source                              |
|-----------------------------------------------------|-------------------------------------|
| État applicatif courant + features récentes         | `README.md`                         |
| Schémas Firestore Parc Machines                     | `ARCHITECTURE.md`                   |
| Procédure d'install Brique Mail                     | `LISEZ_MOI_PREMIER.md`              |
| Doc utilisateur final (longue)                      | `NOTICE_UTILISATEUR.md`             |
| Schéma collection mails                             | `firestore/SCHEMA_MAILS.js`         |
| Permissions par rôle (factory)                      | `src/core/permissions.js`           |
| Auth + refresh JWT                                  | `src/core/AuthContext.jsx`          |
| Cache Firestore                                     | `src/core/DataContext.jsx`          |
| Règles sécurité prod                                | `firestore.rules`, `storage.rules`  |
| Config CI/CD                                        | `.github/workflows/`                |
| Ingestion commandes Esabora (webhook + tri)         | `functions/esaboraImport.js`        |
| Cœur Gmail réutilisable                             | `functions/lib/gmailCore.js`        |
| AR achat@ + price-watch                             | `functions/gmailPollAchat.js`       |

---

## 13. Erreurs à ne pas reproduire (mémoire historique)

- ❌ Committer `functions/index.js` ou `src/core/AuthContext.jsx`
  sans diff `origin/main` au préalable.
- ❌ Inverser la lecture d'un diff `origin/main` (cf. §9, incident
  `functions/package.json` du 21/05).
- ❌ Pop un stash ancien sans avoir audité son contenu fichier par
  fichier.
- ❌ Faire `firebase deploy` ou merger sur `main` sans GO explicite.
- ❌ Toucher au trio sensible (§11) sans confirmation écrite.
- ❌ Proposer Make comme solution (abandonné chez EPJ, cf §2).
- ❌ Ajouter des commentaires de code qui répètent ce que le code dit
  déjà ; n'ajouter que les commentaires expliquant un *pourquoi*
  non-évident.

---

*Fin du fichier. Maintenir à jour quand l'archi évolue.*

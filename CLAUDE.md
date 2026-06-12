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
fournisseurs, acquit réversible) — + **Avancement (M3, 21 chantiers)** + serveur
MCP. Développé mais peu adopté = Réserves (M4, 1 réserve) + Parc machines (M2).
Spec seulement = Chiffrage, cockpits, archi N2, mode admin, migration v11.

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
- **Déploiement Functions : auto via GitHub Actions sur push `main` (`--only functions`).
  Jamais `firebase deploy` manuel sans GO.**
- **⚠️ Les règles Firestore NE SONT PAS déployées par le CI** →
  `firebase deploy --only firestore:rules --project ap-epj` MANUEL requis
  (exception légitime, avec GO).

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
        ├── avancement/             ← M3
        └── reserves/               ← M4 (Brique Mail)
```

---

## 4. Modules — état réel vérifié

| # | Module | Code [C] | Usage réel [V] |
|---|---|---|---|
| M1 | Commandes | EN PROD + **dashboard achat complet** | 40 commandes — usage réel |
| M2 | Parc machines | Développé (schémas v8) | attente photos, peu de données |
| M3 | Avancement | EN PROD, dev récent intense | 21 chantiers — usage réel |
| M4 | Réserves + quitus | Développé (Brique Mail très active) | 1 seule réserve — quasi pas adopté |
| M5 | Suivi + Esabora | NON DÉVELOPPÉ | — |

Liste officielle des modules : `src/core/permissions.js` → `MODULES`.

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

## 6. Les 7 rôles & le modèle de permissions [C]

Rôles (`ROLES` dans `permissions.js`) : **Admin** (total + écrans admin) ·
**Direction** (total sauf delete) · **Conducteur travaux** (scoped `own_chantiers`) ·
**Assistante** (large, pas validate/delete) · **Chef chantier** (`own_chantiers`,
crée/édite) · **Monteur** (ses items) · **Artisan** (très restreint).

**Modèle 3 couches** : (1) **FACTORY** `DEFAULT_PERMISSIONS` (code, jamais perdu) ;
(2) **OVERRIDE DE RÔLE** Firestore `rolesConfig/{role}` ; (3) **OVERRIDE
UTILISATEUR** `user.permissionsOverride`. Permission =
`{ _access, view, create, edit, delete, validate, export }` avec scopes
`all | own_chantiers | own_items | false`.

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

**Secrets (Secret Manager)** : `BREVO_API_KEY`, `GMAIL_CLIENT_ID`,
`GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN` (sav), `GMAIL_ACHAT_REFRESH_TOKEN`
(achat, scope `gmail.modify` v3), `ANTHROPIC_API_KEY`, `ESABORA_WEBHOOK_TOKEN`.

Logique fine non documentée ici : lecture du code `functions/` requise.

---

## 8. Firestore — 30 collections réelles [V] (2026-06-07)

```
achatEcartsPrix · avancementValidations · catalogue · chantiers · commandes ·
commandesEsabora · config · esabora_import · fournisseurs · fournisseursContacts ·
gmailAchatExtractions · gmailConfig · gmailConfigAchat ·
outillageCategories · outillagePannes · outillageSorties · outils ·
reserveMails · reserveMailsAClasser · reserves · reservesCategories ·
reservesEmetteurs · rolesConfig · smsQueue · smsTemplates · utilisateurs ·
mcpAccessTokens · mcpAuthCodes · mcpClients · mcpRefreshTokens
```

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
- L'app tourne avec des **données réelles** (40 commandes, 21 chantiers d'avancement,
  réserves) : perte de commandes/réserves **inacceptable**, perte d'avancement
  rattrapable mais à éviter. Toute modif `firestore.rules`/`storage.rules`/`DataContext.jsx`
  doit préserver la compatibilité des données existantes.

### Git & déploiement
- Preprod (branche → preview Vercel) → **GO écrit** → merge `main` (auto Vercel prod +
  GitHub Actions functions).
- **Jamais** `firebase deploy` / `vercel --prod` / merge `main` / push `main` sans GO écrit.
- **Les rules Firestore ne passent PAS par le CI** → déploiement manuel
  `firebase deploy --only firestore:rules --project ap-epj` (avec GO), sinon la
  feature dépendante reste en `permission-denied`.

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
Maintenir à jour quand l'archi évolue.*

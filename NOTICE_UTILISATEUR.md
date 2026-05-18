# 📘 NOTICE UTILISATEUR — EPJ App Globale

**Application interne EPJ Électricité Générale**
**Version de la notice : 1.1** — état du code v10.G (mai 2026)

---

## 📑 Sommaire

1. [Changelog notice](#changelog-notice)
2. [Présentation générale](#présentation-générale)
3. [Connexion & navigation](#connexion--navigation)
4. [Module Commandes](#module-commandes)
5. [Module Avancement chantier](#module-avancement-chantier)
6. [Module Parc machines (outillage)](#module-parc-machines-outillage)
7. [Module Réserves & quitus](#module-réserves--quitus)
8. [Module Suivi Esabora](#module-suivi-esabora)
9. [Administration](#administration)
10. [Intégration Esabora (Phase 1A)](#intégration-esabora-phase-1a)
11. [Fiches résumé par rôle](#fiches-résumé-par-rôle)
12. [Glossaire & FAQ](#glossaire--faq)

---

## Changelog notice

| Version | Date | État du code | Évolutions |
|---|---|---|---|
| 1.0 | 04/05/2026 | v10.F | Première version complète. Notice initiale couvrant les 5 modules + admin + intégration Esabora Phase 1A. |
| 1.1 | 07/05/2026 | v10.G | **Sections mises à jour** : Connexion & navigation (refonte des 3 boutons retour), Module Commandes (nouveau workflow d'import Excel du catalogue), Administration (sécurisation Réinitialiser Firebase). **Bug fix** : le panier se vide automatiquement après envoi d'une commande. |

---

## Présentation générale

L'EPJ App Globale est une PWA (Progressive Web App) installable sur iPhone,
iPad, Android et Mac/PC. Elle remplace progressivement les processus papier et
les saisies manuelles sur Excel/Esabora pour digitaliser la gestion d'EPJ
Électricité Générale.

### Modules disponibles

| Module | État | Rôle |
|---|---|---|
| 📦 Commandes | ✅ Production | Gestion des commandes matériel et outillage |
| 📊 Avancement chantier | ✅ Production | Suivi de la progression par tâche et bâtiment |
| 🔧 Parc machines | ✅ Production | Outillage et véhicules |
| 📝 Réserves & quitus | ✅ Production | SAV / garantie / quitus signés |
| 🏗 Suivi Esabora | 🟡 À venir | Suivi chantier croisé avec ERP |

### Compatibilité

- **Mobile** : iOS Safari (iPhone), Android Chrome
- **Desktop** : tous navigateurs récents (Chrome, Safari, Firefox, Edge)
- **Installation** : depuis le navigateur, "Ajouter à l'écran d'accueil"

### Architecture technique (résumé pour Direction)

- Code stocké sur GitHub (repo `EPJ38400/EPJ-Commandes-v1.2`)
- Hébergement automatique sur Vercel
- Base de données : Firebase Firestore
- Notifications : SMS via Brevo, push (à venir)
- Automatisations : Make + Zapier
- ERP : Esabora Business

---

## Connexion & navigation

### Se connecter

| Étape | Action |
|---|---|
| 1 | Ouvrir l'app sur le téléphone (icône EPJ) |
| 2 | Saisir son identifiant (ex: `Bilardo`) |
| 3 | Saisir son mot de passe |
| 4 | Cliquer "Se connecter" |

### Le bandeau supérieur (mis à jour v10.G)

Une fois connecté, un bandeau blanc fixé en haut affiche en permanence :

| Élément | Position | Rôle |
|---|---|---|
| **🏠 Accueil** | Gauche, fond gris foncé | Revenir à l'**accueil de l'application** (les 5 tuiles modules). N'apparaît PAS sur l'accueil. **Nouveauté v10.G** : avant c'était une simple flèche ←, maintenant c'est explicitement "🏠 Accueil" pour bien le distinguer des autres boutons retour. |
| **Logo EPJ + nom de section** | Centre-gauche, cliquable | Cliquer sur le logo = retour à l'accueil. Le nom du module en cours est affiché en petit. |
| **Nom de l'utilisateur** | Centre, sous le logo | Prénom + Nom de l'utilisateur connecté. |
| **⚙ Roue crantée grise** | Droite (Admin uniquement) | Ouvre l'écran Administration. |
| **Bouton ⏻ Déconnexion ROUGE** | Extrême droite | Se déconnecter (avec confirmation). |

> ⚠️ **Important** : 🏠 Accueil et le bouton Déconnexion sont volontairement
> séparés et de couleurs très différentes pour qu'on ne les confonde pas.

### Navigation à 3 niveaux dans les modules (v10.G)

Quand tu navigues dans un module (par exemple le catalogue de commandes), tu disposes
de **3 boutons retour distincts**, chacun avec une portée différente :

| Bouton | Position | Va vers |
|---|---|---|
| **🏠 Accueil** | Tout en haut (header global) | L'accueil de l'application (5 tuiles modules) |
| **← {Nom du module}** (ex: "← Commandes") | Sub-header, à côté du titre de la section | L'accueil du module (par ex. les 4 tuiles : Commande Chantier / Équipement Salarié / Historique / Admin) |
| **← (flèche contrastée)** | Sub-header également, à droite de "← {Module}" | L'écran précédent dans le module (par ex. la liste des catégories quand tu es dans "Fils / Câbles") |
| **← Retour** | Footer du catalogue, à côté du bouton Panier | L'écran précédent (équivalent à la flèche du sub-header, plus accessible au pouce) |

**Exemple concret** : tu es sur l'écran "Fils / Câbles" (en train de choisir un câble) :
- **🏠 Accueil** → tu sors du module Commandes et reviens à l'accueil de l'app
- **← Commandes** → tu retournes à l'accueil du module Commandes
- **←** ou **← Retour** → tu retournes à la liste des catégories (Béton / Plexo / Fils / Câbles…)

> 💡 Cette logique est cohérente partout : elle s'applique au module Commandes,
> mais aussi au Parc machines, Réserves et Avancement (où elle existe sous forme
> simplifiée car ces modules ont moins de niveaux d'écrans).

### Page d'accueil

L'accueil affiche :

1. **Bannières de notification** (si applicable) :
   - 🔴 Commandes à valider (pour conducteurs)
   - 🟡 Commandes en retard de réception
   - 📤 Commandes validées en attente d'envoi
   - 🚀 Commandes à envoyer dans Esabora (Direction uniquement)
   - 📊 Rappel avancement (le 20+ du mois)
   - 🔧 Outils en retard de retour

2. **5 tuiles modules** : Commandes / Avancement / Parc / Réserves / Suivi
   Esabora (à venir).

3. **Tuile "Tableau de bord"** (Direction et conducteurs).

### Persistance des saisies

Depuis la v10.E, **les saisies sont sauvegardées en continu**. Si l'iPhone se
met en veille ou si l'app passe en arrière-plan, le panier de commande, les
formulaires et l'écran courant sont restaurés à la prochaine ouverture.

---

## Module Commandes

> 🎯 **Objectif** : remplacer les bons de commande papier qu'il fallait
> retaper dans Esabora. À terme (Phase 1A → Phase 2), génération automatique
> des drafts dans Esabora.

### Procédure : passer une commande Chantier

| Étape | Action | Détails |
|---|---|---|
| 1 | Cliquer sur **📦 Commandes** | Tuile bleue de la home |
| 2 | Cliquer sur **🏗 Commande Chantier** | Tuile bleue |
| 3 | Sélectionner le chantier dans la liste | Si absent : "+ Créer un nouveau chantier" |
| 4 | Sélectionner les articles | Soit par catégorie, soit par recherche |
| 5 | Ajuster les quantités | Boutons + / − ou saisie directe |
| 6 | Optionnel : article divers | Bouton "Article divers" en bas si introuvable |
| 7 | Cliquer **🛒 Panier** | Récap de la commande |
| 8 | Renseigner : livraison, date réception souhaitée, urgent ?, remarques | Champs facultatifs sauf livraison |
| 9 | Optionnel : email supplémentaire | Pour copier un autre destinataire |
| 10 | Cliquer **Envoyer la commande** | Confirmation, statut initial selon le rôle |

### Procédure : passer une commande Équipement Salarié

Identique à ci-dessus mais étape 2 : **👷 Équipement Salarié** au lieu de
Chantier. À l'étape 3 on choisit un salarié destinataire au lieu d'un
chantier. Catalogue limité aux Outillage / EPI / Vêtements de travail.

### Workflow des statuts

```
                ┌─────────────────────────────┐
                │  Créer commande              │
                └──────────────┬──────────────┘
                               ▼
                  ┌────────────────────────┐
                  │  Demandeur a            │
   ┌── Non ───────│  directAchat = true ?  │── Oui ──┐
   ▼              └────────────────────────┘         ▼
┌──────────────────────┐                  ┌──────────────────────┐
│ En attente de        │                  │  À envoyer           │
│ validation           │                  │  (= "Envoyée aux     │
│                      │  Conducteur      │   achats" stocké en  │
│  Visible dans        │  affilié au      │   Firestore)         │
│  "Commandes à        │  chantier valide │                      │
│  valider"            │  manuellement    │                      │
└──────────┬───────────┘                  └──────────┬───────────┘
           │                                          │
           │  Refus → "Refusée"                       │
           │  + motif                                 │
           ▼                                          ▼
   ┌──────────────────┐                  ┌──────────────────────┐
   │ Refusée          │                  │  Direction clique :  │
   │ (réouvrable      │                  │  📧 Email aux achats │
   │  par admin)      │                  │  + 🚀 Envoyer        │
   └──────────────────┘                  │     dans Esabora     │
                                          │  + 🛒 Marquer        │
                                          │     comme commandée │
                                          └──────────┬───────────┘
                                                     ▼
                                          ┌──────────────────────┐
                                          │  Commandée           │
                                          │  (envoyée fournisseur)│
                                          └──────────┬───────────┘
                                                     ▼
                                          ┌──────────────────────┐
                                          │  Réceptionnée        │
                                          │  (signature + date)  │
                                          └──────────────────────┘
```

### Tableau de référence — tous les statuts

| Statut | Couleur | Icône | Qui voit | Action possible |
|---|---|---|---|---|
| **En attente de validation** | Orange | ⏳ | Conducteur affilié au chantier + Admin | Valider / Modifier / Refuser |
| **Validée** | Vert | ✅ | Demandeur + admin | Cliquer "Envoyer aux achats" |
| **À envoyer** *(stocké : "Envoyée aux achats")* | Bleu | 📨 | Demandeur + admin | 📧 Email achats / 🚀 Envoyer Esabora / 🛒 Marquer commandée |
| **Commandée** | Violet | 🛒 | Demandeur + admin | Marquer réceptionnée |
| **Réceptionnée** | Vert foncé | 📦 | Demandeur + admin | (terminal) |
| **Refusée** | Rouge | ❌ | Admin | Réouvrir |

### Tableau de référence — qui peut quoi (commandes)

| Action | Admin / Direction | Conducteur | Chef chantier | Monteur | Ouvrier |
|---|---|---|---|---|---|
| Voir toutes les commandes | ✅ | ❌ (ses chantiers) | ❌ (ses chantiers) | ❌ (ses commandes) | ❌ (ses commandes) |
| Créer commande Chantier | ✅ direct | ✅ → validation | ✅ → validation | ✅ → validation | ❌ |
| Créer commande Équipement | ✅ direct | ✅ direct | ✅ direct | ✅ direct | ✅ direct |
| Valider une commande | ✅ | ✅ (ses chantiers) | ❌ | ❌ | ❌ |
| Refuser une commande | ✅ | ✅ (ses chantiers) | ❌ | ❌ | ❌ |
| Envoyer email achats | ✅ | ✅ | ❌ | ❌ | ❌ |
| 🚀 Envoyer dans Esabora | ✅ | ❌ | ❌ | ❌ | ❌ |
| Marquer comme commandée | ✅ | ❌ | ❌ | ❌ | ❌ |
| Réouvrir une refusée | ✅ | ❌ | ❌ | ❌ | ❌ |

### Procédure : valider une commande (rôle Conducteur)

| Étape | Action |
|---|---|
| 1 | Sur la home, voir la bannière "🔴 X commandes à valider" |
| 2 | Cliquer dessus → ouvre Commandes → onglet "Commandes à valider" |
| 3 | Cliquer sur une commande de la liste |
| 4 | Vérifier les articles, quantités, chantier, urgence |
| 5 | Cliquer "✅ Valider" OU "❌ Refuser" + motif |
| 6 | Si validée : statut passe à "Validée" |

> 💡 Une commande validée passe automatiquement à "À envoyer" quand elle a
> directAchat=true OU quand quelqu'un clique "Envoyer aux achats par email".

### Article divers (création à la volée)

Quand un article n'est pas dans le catalogue :

| Étape | Action |
|---|---|
| 1 | Dans le catalogue, cliquer "+ Article divers" en bas |
| 2 | Saisir : Désignation, Référence (optionnelle), Quantité |
| 3 | Cliquer "Ajouter au panier" |

L'article est immédiatement disponible dans le panier (correctif v10.E).

### PDF de commande

Chaque commande dispose d'un bouton "📥 Télécharger PDF" (format A4 strict
depuis v10.E). Le PDF contient :
- Logo EPJ et numéro de commande
- Demandeur + chantier + livraison + date réception
- Articles regroupés par fournisseur (3 lettres préfixe)
- Total quantité / nombre de références
- Signature de réception (si réceptionnée)

### Catégories et fournisseurs

Le catalogue contient ~580 articles organisés en catégories :

| Catégorie | Préfixes principaux |
|---|---|
| Béton + Descente | CAP, SIB, BLI |
| Conduit + Manchon | EFI, IBO, GEW |
| Équipement Logement | SCH (Schneider), LEG (Legrand) |
| Audace + Ovalis *(v10.E)* | SCH (gammes Audace/Ovalis) |
| Fils / Câbles | FIL |
| Outillage | (divers) |
| EPI | (divers) |

> Les préfixes 3 lettres en début de référence sont utilisés pour le
> regroupement par fournisseur dans le PDF et pour la sync Esabora.

### Compteurs et bannières (corrigés v10.E)

Les compteurs sont **filtrés par utilisateur connecté** :
- Admin / Direction voient leurs propres commandes (pas tout le monde)
- Conducteur voit les commandes de SES chantiers + ses propres
- Autres rôles ne voient que leurs propres commandes

Avant v10.E un Admin pouvait voir "5 commandes en attente" alors qu'aucune ne
le concernait.

---

## Module Avancement chantier

> 🎯 **Objectif** : remplacer le suivi Excel mensuel par un outil mobile,
> taper directement les pourcentages d'avancement et les heures par tâche,
> figer les snapshots mensuels pour la facturation.

### Vue d'ensemble

Le module fonctionne en 3 niveaux :
- **Chantier** : conteneur global
- **Bâtiment** : un chantier peut avoir 1 à N bâtiments (A, B, C…)
- **Catégorie + Tâche** : 7 catégories standards × N tâches chacune

### Les 7 catégories standards

| # | Catégorie | Couleur | Type | Tâches |
|---|---|---|---|---|
| 1 | ÉTUDE / TMA | Violet | Fixe | Études, plans, BAR… |
| 2 | INCORPORATION BÉTON | Gris | **Générée** selon typologie | Radier, Murs sous-sol, Dalles, Murs RDC, Murs R+1, … Combles |
| 3 | AVANCEMENT DIVERS | Orange | Fixe | Tâches diverses |
| 4 | AVANCEMENT PLACO | Rouge | **Générée** selon typologie | Sous-sol, RDC, R+1, R+2, … |
| 5 | ÉQUIPEMENT DES LOGEMENTS | Bleu | Fixe | Appareillage, DCL, Tableau, Interphone, **Pose DB+Platine** *(v10.E)*, Contrôle qualité |
| 6 | ÉQUIPEMENT DES COMMUNS | Bleu | Fixe | Selon override chantier |
| 7 | CONTRÔLE & MISE EN SERVICE | Vert | Fixe | Essais, mise en service |

### Procédure : configurer un chantier multi-bâtiments

| Étape | Action |
|---|---|
| 1 | Admin → Chantiers → ouvrir un chantier |
| 2 | Section "Bâtiments" : "+ Ajouter un bâtiment" pour A, B, C… |
| 3 | Pour chaque bâtiment, renseigner : `nbSousSols`, `nbEtages`, ☐ `combles` |
| 4 | Si plusieurs bâtiments + sous-sols : option **"Sous-sol commun à tous les bâtiments"** *(v10.E)* |
| 5 | Cocher "Sous-sol commun" sur UN bâtiment : il garde ses sous-sols, les autres les perdent |
| 6 | Enregistrer |

> 💡 L'option Sous-sol commun évite de saisir 4 fois "Murs sous-sol" sur 4
> bâtiments quand le parking est en réalité unique et enterré.

### Procédure : saisir l'avancement mensuel

| Étape | Action |
|---|---|
| 1 | Cliquer sur **📊 Avancement chantier** |
| 2 | Choisir le chantier dans la liste (montre l'avancement global %) |
| 3 | Si plusieurs bâtiments : sélectionner le bâtiment (onglets A, B, C…) |
| 4 | Pour chaque catégorie, déplier et saisir le % par tâche |
| 5 | Optionnel : ajouter des heures (boutons "+ Ajouter session") |
| 6 | Optionnel : affecter un artisan (filtre par artisan en haut) |
| 7 | Enregistrer (auto-save) |

### Procédure : figer le mois (snapshot)

| Étape | Action |
|---|---|
| 1 | Sur la fiche du chantier, cliquer "Figer la situation de [mois en cours]" |
| 2 | Confirmer |
| 3 | Le snapshot est créé en base, immuable |
| 4 | Bouton "📥 Exporter PDF" disponible pour le mois figé |

### PDF Avancement (améliorations v10.E)

| Bloc | Détail |
|---|---|
| **🟢 Bandeau "AVANCEMENT TOTAL DU CHANTIER"** | En haut du PDF si multi-bâtiments. Pourcentage global pondéré + heures cumulées. |
| **Par bâtiment** | Pourcentage du bâtiment + heures cumulées |
| **Par catégorie** | Pourcentage de la catégorie complète (référence stable) |
| **Tâches à 0% MASQUÉES** | *(v10.E)* Les tâches non avancées ne sont plus listées dans le PDF. Une catégorie 100% non commencée est masquée également. |

### Tableau de référence — qui peut quoi (avancement)

| Action | Admin / Direction | Conducteur | Chef chantier | Monteur | Artisan |
|---|---|---|---|---|---|
| Voir tous les chantiers | ✅ | ❌ (ses chantiers) | ❌ (ses chantiers) | ❌ (ses chantiers) | ❌ (ses chantiers) |
| Saisir avancement | ✅ | ✅ | ✅ | ✅ ses tâches | ❌ |
| Figer un mois | ✅ | ✅ ses chantiers | ❌ | ❌ | ❌ |
| Exporter PDF | ✅ | ✅ ses chantiers | ❌ | ❌ | ❌ |
| Configurer bâtiments | ✅ (Admin) | ❌ | ❌ | ❌ | ❌ |

---

## Module Parc machines (outillage)

> 🎯 **Objectif** : tracer la sortie et le retour de chaque outil. Remplacer
> le système précédent "Tools+".

### Procédure : sortir un outil

| Étape | Action |
|---|---|
| 1 | **🔧 Parc machines** → "Sortir un outil" |
| 2 | Scanner le QR code ou chercher l'outil dans le catalogue |
| 3 | Sélectionner le chantier de destination |
| 4 | Optionnel : photo, remarques |
| 5 | Signer (signature tactile) |
| 6 | Confirmer la sortie |

### Procédure : rendre un outil

| Étape | Action |
|---|---|
| 1 | **🔧 Parc machines** → "Rendre un outil" |
| 2 | Scanner ou chercher l'outil |
| 3 | État du retour : ☐ Comme neuf / ☐ Usure normale / ☐ **Abîmé** |
| 4 | Si abîmé : sélectionner le type de panne (panneur récurrent géré dans Admin) + photo |
| 5 | Signer |
| 6 | Confirmer le retour |

### Tableau de référence — qui peut quoi (parc)

| Action | Admin / Direction | Conducteur | Chef chantier | Monteur | Ouvrier |
|---|---|---|---|---|---|
| Voir tout le parc | ✅ | ✅ | ❌ (ses chantiers) | ❌ | ❌ |
| Sortir un outil | ✅ | ✅ | ✅ | si `canSortirOutil` | si `canSortirOutil` |
| Rendre un outil | ✅ | ✅ | ✅ | ✅ | ✅ |
| Voir l'historique d'un outil | ✅ | ✅ | ✅ | ✅ | ✅ |
| Modifier le catalogue | ✅ (Admin) | ❌ | ❌ | ❌ | ❌ |

> 💡 Le flag `canSortirOutil` est éditable par utilisateur dans Admin → Users.

---

## Module Réserves & quitus

> 🎯 **Objectif** : suivre les réserves SAV et garanties biennale/GPA, signer
> les quitus électroniquement (double signature + horodatage + GPS + PDF
> verrouillé).

### Concepts clés

| Concept | Définition |
|---|---|
| **Réserve** | Défaut signalé sur un chantier (locataire, syndic, MOE, etc.) à corriger sous délai |
| **Quitus** | Document signé par les 2 parties attestant la levée d'une réserve |
| **GPA** | Garantie de Parfait Achèvement — 1 an après la réception |
| **Biennale** | Garantie biennale — 2 ans après la réception |
| **Quitus rapide sur place** | Workflow ~30 sec pour livraison sans formalisme |

### Procédure : créer une réserve

| Étape | Action |
|---|---|
| 1 | **📝 Réserves & quitus** → "+ Nouvelle réserve" |
| 2 | Chantier + bâtiment + appartement/zone |
| 3 | Catégorie de réserve (ex: prise défectueuse, interrupteur HS…) |
| 4 | Photo(s) du défaut |
| 5 | Émetteur (qui signale ?) — locataire, syndic, MOE… |
| 6 | Date de signalement, délai de levée |
| 7 | Enregistrer |

### Procédure : lever une réserve avec quitus complet

| Étape | Action |
|---|---|
| 1 | Ouvrir la réserve depuis la liste |
| 2 | Section "Levée" : photo "Avant/Après" |
| 3 | Description de l'intervention |
| 4 | Signature 1 : technicien EPJ (tactile) |
| 5 | Signature 2 : émetteur ou témoin (tactile) |
| 6 | GPS automatique + horodatage |
| 7 | Génération du PDF verrouillé (NON modifiable) |
| 8 | Réserve archivée *(à venir : v10.G — historique des réserves levées)* |

### Procédure : Quitus rapide sur place (livraison)

Workflow ~30 sec pensé pour les techniciens en livraison :

| Étape | Action |
|---|---|
| 1 | **📝 Réserves & quitus** → "Quitus rapide" |
| 2 | Chantier + appartement |
| 3 | Photos rapides (3 max) |
| 4 | Signature client (tactile) |
| 5 | "Valider" → PDF généré |

### Tableau de référence — qui peut quoi (réserves)

| Action | Admin / Direction | Conducteur | Chef chantier | Monteur | Artisan |
|---|---|---|---|---|---|
| Créer une réserve | ✅ | ✅ ses chantiers | ✅ ses chantiers | ✅ ses chantiers | ✅ ses chantiers |
| Modifier réserve | ✅ | ✅ ses chantiers | ✅ ses chantiers | ❌ (ses créations) | ❌ (ses créations) |
| Lever réserve avec quitus | ✅ | ✅ | ✅ | ✅ | ✅ |
| Quitus rapide sur place | ✅ | ✅ | ✅ | ✅ | ✅ |
| Voir toutes les réserves | ✅ | ✅ ses chantiers | ✅ ses chantiers | ✅ ses chantiers | ✅ ses chantiers |

---

## Module Suivi Esabora

> 🟡 **À venir (v10.X)** — Module de pilotage croisé EPJ/Esabora pour
> analyser les chantiers de bout en bout (devis → factures → marges).
> Détails à venir une fois le module développé.

---

## Administration

> ⚠️ Section accessible uniquement aux comptes Admin (icône ⚙ en haut à
> droite du bandeau).

### Sections disponibles

| Groupe | Section | Rôle |
|---|---|---|
| **Équipe & accès** | 👥 Utilisateurs | Créer/modifier/supprimer comptes, rôles, mot de passe, flags spéciaux |
| | 🔒 Droits des utilisateurs | Surcharger les permissions par utilisateur |
| | 🎭 Rôles types | Modifier les droits par défaut d'un rôle (impact tous les utilisateurs) |
| **Chantiers & tâches** | 🏗 Chantiers | Créer chantiers, configurer bâtiments, affecter conducteurs |
| | 📋 Modèle d'avancement | Personnaliser les tâches par défaut |
| **Parc machines** | 🔧 Catalogue outillage | Ajouter outils, photos, références |
| | 📁 Catégories d'outillage | Familles d'outils |
| | ⚠️ Pannes récurrentes | Types de pannes au retour |
| **Réserves & garanties** | 📝 Config réserves | Catégories, émetteurs, délais |
| | 📅 Réceptions & garanties | Dates PV de réception par chantier |
| **Identité EPJ & quitus** | 🏢 Config société | SIRET, adresse, papier en-tête |
| | ✍ Signatures techniciens | Signature type imprimée sur quitus |
| **Communication** | 📱 Modèles SMS | Textes des rappels |
| **Intégrations** *(v10.F)* | 🔗 Intégration Esabora | URL Make, kill switch, secret callback |

### Procédure : créer un nouvel utilisateur

| Étape | Action |
|---|---|
| 1 | Admin → 👥 Utilisateurs → "+ Nouveau" |
| 2 | Identifiant unique (ex: `Bilardo`) |
| 3 | Prénom, nom, email, téléphone |
| 4 | Mot de passe |
| 5 | Cocher 1+ rôle(s) parmi : Admin, Direction, Conducteur travaux, Assistante, Chef chantier, Monteur, Artisan |
| 6 | ☐ Autorisé à sortir un outil du parc *(par défaut OFF)* |
| 7 | ☐ Achats directs (sans validation) — *à réserver à la Direction* |
| 8 | Enregistrer |

### Procédure : configurer un chantier

| Étape | Action |
|---|---|
| 1 | Admin → 🏗 Chantiers → "+ Nouveau" |
| 2 | N° d'affaire (ex: `002179`), Nom, Adresse |
| 3 | Conducteur affilié (sélection dans la liste des users) |
| 4 | Statut (Actif / Pause / Archivé) |
| 5 | Section "Bâtiments" : configurer A, B, C… avec sous-sols/étages/combles |
| 6 | Optionnel : sous-sol commun (multi-bâtiments) |
| 7 | Optionnel : override des tâches d'avancement |
| 8 | Enregistrer |

### Import / Export Excel du catalogue (NOUVEAU v10.G)

L'écran d'admin du catalogue d'articles est désormais accessible depuis :
**Module Commandes → Administration → Admin Catalogue**.

Trois nouvelles fonctionnalités y sont disponibles :

#### 📤 Exporter en Excel

| Étape | Action |
|---|---|
| 1 | Bouton **"📤 Exporter en Excel"** |
| 2 | Téléchargement automatique : `Catalogue_EPJ_AAAA-MM-JJ.xlsx` |
| 3 | Le fichier contient les 9 colonnes : Catégorie / Sous-catégorie / Référence / Désignation / Unité / Stock / Fournisseur principal / Code Esabora / Photo URL |

Tu peux ouvrir ce fichier dans Excel ou Numbers, le modifier, et le ré-importer.

#### 📥 Importer (fusionner) — RECOMMANDÉ

C'est le mode "sans risque". Il **ne supprime jamais d'articles**.

| Étape | Action |
|---|---|
| 1 | Bouton **"📥 Importer (fusionner)"** |
| 2 | Sélectionner ton fichier Excel |
| 3 | Lire le **rapport de pré-import** qui s'affiche : combien d'articles ajoutés, mis à jour, nouvelles catégories, doublons éventuels |
| 4 | Confirmer pour lancer l'import |
| 5 | Attendre le toast de succès "✅ X articles importés" |

**Effet** :
- Article déjà présent dans Firestore (même référence) → mis à jour
- Article nouveau (référence inconnue) → ajouté
- Article présent dans Firestore mais absent du fichier → **conservé**

#### 🗑️ Importer (remplacer) — DESTRUCTIF

Mode dur, à utiliser pour repartir totalement propre.

| Étape | Action |
|---|---|
| 1 | Bouton **"🗑️ Importer (remplacer)"** |
| 2 | Sélectionner ton fichier Excel |
| 3 | Lire le rapport de pré-import |
| 4 | Confirmation par saisie de **`EFFACER`** |
| 5 | Le catalogue Firestore est **entièrement supprimé** puis recréé depuis le fichier |

> ⚠️ **Action irréversible**. À utiliser uniquement quand tu es absolument certain
> de ton fichier Excel.

#### Format Excel attendu

| Colonne | Contenu | Exemple | Obligatoire |
|---|---|---|---|
| A — Catégorie | Niveau 1 | Béton + Descente | ✅ |
| B — Sous-catégorie | Niveau 2 | Capri | ✅ |
| C — Référence | Clé unique | CAP 959922 | ✅ |
| D — Désignation | Nom lisible | BOITE MAXIBANCHE | ✅ |
| E — Unité | Pièce, ML, Lot… | Pièce | Recommandé |
| F — Stock | Oui ou Non | Non | Recommandé |
| G — Fournisseur principal | Nom lisible | SONEPAR | Optionnel |
| H — Code Esabora | Code court 3-4 lettres | SONE | Optionnel |
| I — Photo URL | URL d'image | (vide) | Optionnel |

Première ligne = en-têtes (l'app vérifie qu'elles correspondent).

#### 🔄 Réinitialiser Firebase (sécurisé v10.G)

Le bouton "🔄 Réinitialiser Firebase" du même écran est maintenant **doublement
sécurisé** :

| Étape | Action |
|---|---|
| 1 | Cliquer le bouton |
| 2 | Saisir exactement **`RÉINITIALISER`** dans le prompt |
| 3 | Confirmer une seconde fois |
| 4 | La base est repeuplée avec les utilisateurs, chantiers et catalogue par défaut |

> ⚠️ Cette action **efface** les utilisateurs et chantiers ajoutés depuis
> le déploiement, ainsi que les modifications du catalogue. Les commandes
> existantes sont **préservées**.
> À n'utiliser qu'en cas de corruption ou de base totalement vide.

---

## Intégration Esabora (Phase 1A)

> *Disponible depuis v10.F — Mai 2026*
> 🎯 **Objectif** : à terme, tu n'auras plus jamais à retaper une commande EPJ
> dans Esabora. Cette première phase pose les fondations côté EPJ App. La
> Phase 2 (récupération des prix réels et dates de livraison fournisseur)
> viendra plus tard.

### Schéma du flux

```
EPJ App                 Make                    Zapier              Esabora
   │                     │                         │                    │
   │  POST webhook       │                         │                    │
   ├────────────────────▶│                         │                    │
   │  (commande complète │  Iterator               │                    │
   │   groupée par       │  (1 fournisseur         │                    │
   │   préfixe)          │   à la fois)            │                    │
   │                     │                         │                    │
   │                     │  Lookup Data Store      │                    │
   │                     │  préfixe → fournisseur  │                    │
   │                     │                         │                    │
   │                     │  POST Zapier ──────────▶│  Connecteur ──────▶│  Draft
   │                     │  (1 par fournisseur)    │  Esabora           │  créé
   │                     │                         │                    │
   │                     │  ◀──────── (Phase 1B : retour Make → Firestore)
   │  Badge ✅ MAJ       │                         │                    │
   │  esaboraStatus      │                         │                    │
   │  = "synced"         │                         │                    │
```

### Procédure : configurer le pont (à faire UNE FOIS)

| Étape | Action |
|---|---|
| 1 | Créer un compte Make (https://www.make.com) — plan Core ~10€/mois |
| 2 | Créer un scénario Make (suivre `PROCEDURE_MAKE.md` livré avec v10.F) |
| 3 | Copier l'URL du webhook Make généré |
| 4 | EPJ App → Admin → 🔗 Intégration Esabora |
| 5 | Coller l'URL dans "URL du webhook Make" |
| 6 | Cocher "Synchronisation activée" |
| 7 | Cliquer "🧪 Tester l'URL" pour valider que Make reçoit |
| 8 | Enregistrer |

### Procédure : envoyer une commande dans Esabora

| Étape | Action |
|---|---|
| 1 | Sur la home, voir bannière "🚀 X commandes à envoyer dans Esabora" |
| 2 | Cliquer dessus OU aller dans Commandes → Historique → filtrer "À envoyer" |
| 3 | Ouvrir une commande |
| 4 | Section "🔗 INTÉGRATION ESABORA" → cliquer "🚀 Envoyer dans Esabora" |
| 5 | Confirmation : "X drafts seront créés (1 par fournisseur)" |
| 6 | Statut → 🔄 "Envoi en cours" |
| 7 | Vérifier dans Make que le scénario s'est bien exécuté |
| 8 | Vérifier dans Esabora que les drafts apparaissent avec le numéro EPJ dans le commentaire |

### Tableau de référence — états du badge Esabora

| Badge | Signification | Action possible |
|---|---|---|
| (rien) | Pas encore envoyé | 🚀 Envoyer dans Esabora |
| 🔄 Envoi en cours | POST envoyé à Make, attente confirmation | Aucune (attendre) |
| ✅ Dans Esabora (N drafts) | Sync réussie, N drafts créés | Aucune (verrouillé) |
| 🟡 Sync partielle (N/M) | Certains fournisseurs OK, d'autres KO | 🔁 Resynchroniser |
| ⚠️ Erreur sync | Échec complet | 🔁 Resynchroniser |

### Tableau de référence — qui peut envoyer dans Esabora

| Rôle | Permission `_canSyncEsabora` |
|---|---|
| Admin | ✅ par défaut |
| Direction | ✅ par défaut |
| Conducteur travaux | ❌ (modifiable via override) |
| Assistante | ❌ (modifiable via override) — destiné à être activé plus tard |
| Chef chantier | ❌ |
| Monteur | ❌ |
| Artisan | ❌ |

### Le marqueur de jointure : numéro de commande EPJ

Dans le payload envoyé à Make, le champ `marqueurEsabora` contient le numéro
de commande EPJ (ex: `CMD-2026-0025`). Ce marqueur est inséré par Make dans
le **champ commentaire** du draft Esabora.

**Pourquoi c'est important** : quand Esabora créera son propre numéro de
commande et l'enverra au fournisseur (Phase 2), c'est ce marqueur qui
permettra de retrouver la commande EPJ source pour mettre à jour les prix
réels et la date de livraison.

---

## Fiches résumé par rôle

### Fiche Direction (Pierre-Julien YVER)

> **Tu es l'Admin et la Direction. Tu vois tout.**

**Tes outils principaux :**
- Toutes les bannières home, en particulier 🚀 "À envoyer dans Esabora"
- Tableau de bord Direction (vision globale)
- Administration complète

**Tes actions exclusives :**
- 🚀 Envoyer dans Esabora (sur les commandes "À envoyer")
- 🛒 Marquer comme commandée
- Réouvrir une commande refusée
- Modifier les permissions des utilisateurs
- Configurer chantiers, modèles, identité EPJ, etc.

**Workflow Esabora ton flux quotidien :**
1. Le matin : vérifier la bannière "🚀 X commandes à envoyer dans Esabora"
2. Cliquer sur chaque commande → vérifier le contenu → cliquer "🚀 Envoyer"
3. Aller dans Esabora pour valider/ajuster les drafts
4. Envoyer définitivement aux fournisseurs depuis Esabora
5. Quand un fournisseur a confirmé : revenir dans EPJ App → "🛒 Marquer
   comme commandée"

---

### Fiche Conducteur de travaux (Bilardo, Frasca, Rey)

> **Tu gères tes chantiers et tu valides les commandes des chefs/monteurs
> qui te sont affiliés.**

**Tes outils principaux :**
- Tableau de bord Conducteur (filtré sur tes chantiers)
- Bannière "🔴 Commandes à valider" en home
- Module Avancement chantier
- Module Réserves

**Tes actions principales :**
- Passer une commande Chantier → elle passe en "En attente de validation"
  *si tu n'es pas directAchat*. Sinon elle part directement en "À envoyer".
- Valider/refuser les commandes des chefs/monteurs sur tes chantiers
- Saisir l'avancement mensuel de tes chantiers
- Figer la situation mensuelle pour facturation
- Sortir un outil
- Créer/lever des réserves

**Tu ne peux PAS :**
- Envoyer dans Esabora (réservé Direction)
- Marquer comme commandée
- Configurer les chantiers (Admin uniquement)

---

### Fiche Assistante

> **À venir : tu auras prochainement la permission `_canSyncEsabora` activée
> pour décharger Pierre-Julien sur la gestion Esabora.**

**Tes outils principaux :**
- Vue commandes globale (toutes commandes EPJ)
- Vue parc machines globale
- Module Réserves complet

**Tes actions principales :**
- Suivi commandes
- Création de réserves
- Sortie d'outils
- (à venir) Envoi dans Esabora

**Tu ne peux PAS :**
- Valider une commande (réservé conducteurs et Direction)
- Modifier les configurations (réservé Admin)

---

### Fiche Chef de chantier (Mickaël Courteau, Sylvain Mollin)

> **Tu passes les commandes pour ton chantier, ton conducteur valide.**

**Tes outils principaux :**
- Module Commandes (tes commandes)
- Module Parc machines (sortie d'outils)
- Module Réserves
- Module Avancement (si tu as les droits)

**Tes actions principales :**
- Créer commande Chantier → "En attente de validation"
- Sortir un outil pour ton chantier
- Créer une réserve
- Lever une réserve avec quitus

**Tu ne peux PAS :**
- Valider une commande (ton conducteur le fait)
- Voir les commandes d'autres chantiers
- Configurer quoi que ce soit

---

### Fiche Monteur (Bartoli)

> **Tu passes des commandes pour ton chantier, ton conducteur valide.**

**Tes outils principaux :**
- Module Commandes (tes propres commandes)
- Module Parc machines (sortie d'outils si autorisé)
- Module Avancement (saisie de tes propres tâches)
- Module Réserves

**Tes actions principales :**
- Créer commande Chantier → "En attente de validation"
- Créer commande Équipement Salarié → directe
- Saisir les % de tes propres tâches d'avancement
- Lever une réserve avec quitus

**Tu ne peux PAS :**
- Voir les commandes des autres
- Valider une commande
- Sortir un outil sauf si l'admin a coché "canSortirOutil"

---

### Fiche Artisan

> **Accès limité, tu interviens ponctuellement.**

**Tes outils :**
- Module Avancement (visualisation tes chantiers)
- Module Réserves (lever des réserves)

**Tu ne peux PAS :**
- Passer de commandes
- Sortir un outil
- Voir les autres chantiers

---

## Glossaire & FAQ

### Glossaire

| Terme | Définition |
|---|---|
| **N° d'affaire** | Numéro unique d'un chantier dans Esabora (ex: 001983 pour LE 17) |
| **Préfixe fournisseur** | 3 premières lettres de la référence article (SCH, LEG, IBO…) — utilisé pour le regroupement et le routage Esabora |
| **directAchat** | Flag utilisateur : si vrai, ses commandes partent direct en "À envoyer" sans validation |
| **canSortirOutil** | Flag utilisateur : si vrai, peut sortir un outil du parc |
| **\_canSyncEsabora** | Permission : si vraie, peut envoyer une commande dans Esabora |
| **Snapshot** | Photo figée de l'avancement d'un chantier à un instant T (utilisée pour la facturation) |
| **Override** | Modification spécifique des droits par défaut (par rôle ou par utilisateur) |
| **PWA** | Progressive Web App — appli installable depuis le navigateur sans passer par les stores |
| **Marqueur Esabora** | Numéro de commande EPJ inséré dans le commentaire Esabora pour faire la jointure |

### FAQ

**Q : J'ai cliqué Déconnexion par erreur, je perds tout ?**
R : Non. Tes brouillons (panier, formulaires) sont sauvegardés en localStorage
et restaurés à ta prochaine connexion (correctif v10.E).

**Q : J'ai validé une commande mais la sync Esabora a échoué, quoi faire ?**
R : Va dans la commande et clique "🔁 Resynchroniser". Si ça échoue encore,
vérifie dans Admin → Intégration Esabora que la sync est activée et l'URL
Make correcte.

**Q : Une commande peut-elle être envoyée 2 fois dans Esabora ?**
R : Non. Une fois synchronisée, le bouton est verrouillé. Pour forcer un
renvoi (ex: après suppression manuelle dans Esabora), passe par
Admin → Firestore (ou demande à un dev de remettre `esaboraStatus = null`).

**Q : Pourquoi le statut affiché est "À envoyer" mais la valeur stockée est
"Envoyée aux achats" ?**
R : C'est volontaire. Le code stocke encore l'ancien libellé pour ne pas
casser l'historique des commandes existantes. Seule la traduction d'affichage
est nouvelle (v10.F).

**Q : Pourquoi mon panier disparaît parfois ?**
R : Depuis la v10.E, ce bug est résolu. Si ça arrive encore : vérifie que la
console du navigateur (F12) ne montre pas d'erreur localStorage. En mode
navigation privée iOS, le localStorage peut être effacé entre sessions.

**Q : J'ai 50 commandes en historique, ça rame.**
R : Pour l'instant l'historique charge toutes les commandes. Une pagination
est prévue dans une future livraison. En attendant, utilise les filtres
(statut + chantier).

**Q : Mon panier ne s'est pas vidé après que j'ai envoyé ma commande (v10.G).**
R : Bug corrigé en v10.G. Désormais, le panier se vide automatiquement dès
que la commande est enregistrée dans Firestore — plus besoin de cliquer
"🏠 Nouvelle commande" pour réinitialiser. Si ça t'arrive encore, c'est
peut-être parce que tu n'as pas encore reçu la mise à jour : vérifie le
numéro de version dans Admin → À propos (ou contacte Pierre-Julien).

**Q : Les boutons retour ont changé, je ne m'y retrouve plus (v10.G).**
R : Effectivement. Maintenant tu as 3 boutons distincts :
- **🏠 Accueil** (en haut, fond noir) → page de garde de l'app
- **← Commandes** (sub-header) → accueil du module Commandes
- **← Retour** (en bas du catalogue) → page précédente
Voir la section "Connexion & navigation" pour le détail.

**Q : Comment je mets à jour le catalogue d'articles ? (v10.G)**
R : Tu as 3 façons : édition à l'unité (Admin → Articles → cliquer un article),
ou import en masse via Excel (Admin → Catalogue → "📥 Importer"). Tu peux
aussi exporter le catalogue actuel (📤 Exporter) pour le modifier puis le
réimporter.

---

**Fin de la notice — version 1.1 (état v10.G).**

*Pour toute évolution de l'app, cette notice est mise à jour automatiquement
à chaque livraison par Claude. Le changelog en tête liste les versions et
leurs apports.*

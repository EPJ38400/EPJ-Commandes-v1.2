# EPJ App Globale — v9

**Livraison v9 : Réalisme terrain & Notifications**

Suite à des retours d'usage concrets sur la v8, cette version corrige plusieurs frictions métier et introduit des fonctionnalités clés.

---

## 🎯 Ce qu'apporte la v9

### 🔧 Corrections sur le module Parc Machines

**1. Menu emprunteur = toute l'équipe**
Avant : le menu déroulant de l'emprunteur ne listait que les personnes ayant `canSortirOutil=true`.
Après : **tous les utilisateurs** apparaissent dans le menu. Le droit `canSortirOutil` concerne uniquement qui peut **déclencher** une sortie (toi, ton assistante), pas qui peut **être emprunteur** (n'importe quel monteur).

**2. Le retour peut être fait par n'importe qui**
Avant : seul le détenteur actuel ou un gestionnaire pouvait enregistrer le retour.
Après : si Joseph a sorti une perceuse et que Thibaut la rapporte à l'atelier, **Thibaut peut enregistrer le retour**. Le système garde la trace de qui a physiquement rendu l'outil (`retourParUserId`, `retourParNom`).

**3. Affichage "Rendu par X" systématique**
Dans l'Historique, sur la fiche outil, et dans l'historique récent d'une fiche outil : ligne **✅ Rendu par [Nom]** visible quand la personne qui rend ≠ la personne qui a sorti.

**4. Destinataire d'un transfert = toute l'équipe**
Le menu déroulant "Vers" lors d'un transfert liste désormais tous les utilisateurs (pas juste ceux autorisés).

### 🛒 Nouveau : Sortie multiple (panier)

Quand Joseph part sur un chantier et prend perceuse + marteau + échelle + laser, il n'a plus à faire 4 sorties individuelles. **Panier de sélection multiple :**

1. Dans l'onglet **Matériels**, bouton "🛒 Commencer une sortie de plusieurs outils"
2. Cases à cocher apparaissent sur chaque carte outil (disponibles uniquement)
3. Navigation libre entre catégories — le panier conserve la sélection
4. **Barre flottante noire en bas d'écran** qui suit partout : "3 outils → Continuer"
5. Clic "Continuer" → formulaire unique (emprunteur, chantier, date retour, signature optionnelle) pour tous les outils
6. Validation → **batch Firestore** qui crée une sortie par outil avec un `groupeSortieId` commun

**Sécurité** : si un outil devient indisponible entre la sélection et la validation (quelqu'un l'a sorti entre temps), il est automatiquement ignoré avec alerte.

### 🔔 Nouveau : Notifications sur la page d'accueil

Badges rouges sur les tuiles quand il y a quelque chose à traiter :

- **🔧 Parc machines** : N outils en retard de retour
- **📊 Avancement chantier** : N chantiers non validés (à partir du 20 du mois)

Chaque tuile affiche aussi un sous-titre rouge avec détail (`⚠ 2 outils en retard`).

### 📅 Nouveau : Rappel validation avancement du 20 du mois

Mécanisme complet pour s'assurer que les conducteurs renseignent leur avancement avant la fin du mois :

1. **À partir du 20 de chaque mois** :
   - Badge rouge sur la tuile Avancement de la HomePage
   - Bannière cliquable en haut de la HomePage : "⏰ Avancement de [mois] à remplir — 2 chantiers restants"
   - Bannière rouge dans la liste des chantiers du module Avancement

2. **Dans chaque chantier**, en bas de la page détail :
   - Bouton vert **"✓ J'ai terminé mon avancement de [mois]"**
   - Au clic : création d'une validation Firestore pour ce chantier/ce mois
   - Le chantier apparaît comme "✓ [mois] validé" dans la liste et disparaît des rappels
   - Bouton "Annuler la validation" reste disponible si besoin

3. **Collection Firestore `avancementValidations`** :
   - Document ID : `{chantierNum}_{YYYY-MM}` (ex: `001374_2026-04`)
   - Contenu : `{ chantierNum, mois, validePar, validePourNom, valideLe }`

### 🎯 Logique des notifications (résumé)

| Qui voit quoi | Règle |
|---|---|
| **Admin, Direction, Assistante** | Voient les rappels pour **tous** les chantiers actifs |
| **Conducteur de travaux** | Voit uniquement les rappels pour **ses chantiers** (affectation) |
| **Chef de chantier** | Idem : uniquement ses chantiers |
| **Monteurs, Artisans** | Pas de badge avancement (ils saisissent mais ne valident pas le mois) |

Le champ `chantier.affectations` (déjà existant) détermine ces restrictions.

---

## 📁 Nouveaux fichiers (v9)

```
src/
├── core/
│   └── notificationsUtils.js                 ← Helpers dates, détection retards/validations
│
└── modules/parc-machines/
    ├── PanierSortieContext.jsx               ← Context React du panier
    ├── PanierFloatingBar.jsx                 ← Barre flottante en bas d'écran
    └── ParcSortieMultiple.jsx                ← Formulaire validation groupée
```

## 📝 Fichiers modifiés (v9)

```
src/
├── pages/
│   └── HomePage.jsx                          ← Badges notifications + bannière rappel
│
├── core/
│   └── DataContext.jsx                       ← + collection avancementValidations
│
└── modules/
    ├── parc-machines/
    │   ├── ParcMachinesModule.jsx            ← Provider panier + barre flottante + route validation
    │   ├── ParcMateriels.jsx                 ← Mode panier (cases à cocher, bannière active)
    │   ├── ParcOutilSortie.jsx               ← Menu emprunteur = tous les users
    │   ├── ParcOutilRetour.jsx               ← Enregistre retourParUserId/retourParNom
    │   ├── ParcOutilTransfert.jsx            ← Destinataire = tous (sauf soi-même)
    │   ├── ParcOutilDetail.jsx               ← canRetour = toujours true si sortie
    │   └── ParcHistorique.jsx                ← Affiche "Rendu par X" si ≠ emprunteur
    │
    └── avancement/
        ├── AvancementModule.jsx              ← Bloc rappel + badge "✓ validé"
        └── AvancementChantier.jsx            ← Bouton "J'ai terminé mon avancement"
```

---

## 🧪 Tests recommandés

### Test 1 — Sortie multiple (panier)
1. Onglet Matériels → bouton "🛒 Commencer une sortie de plusieurs outils"
2. Vérifier la bannière orange "Mode sélection multiple actif"
3. Taper sur 3-4 outils disponibles dans différentes catégories
4. Vérifier que la barre flottante noire en bas affiche le bon compteur
5. Clic "Continuer →" → formulaire unique, choisir emprunteur + chantier + date retour
6. Valider → vérifier que les 3-4 outils apparaissent comme "Sortis" sur le dashboard
7. Dans Firestore, vérifier que toutes les sorties partagent le même `groupeSortieId`

### Test 2 — Retour par une autre personne
1. Se connecter en Admin, sortir une perceuse pour Joseph
2. Se connecter en **Thibaut** (n'importe quel user)
3. Aller sur la fiche de la perceuse → bouton "✓ Enregistrer le retour" doit être visible
4. Faire le retour
5. Aller dans Historique → vérifier la ligne verte **"✅ Rendu par Thibaut"**

### Test 3 — Menu emprunteur complet
1. Connexion Admin → commencer une sortie d'outil
2. Ouvrir le menu déroulant "Emprunteur"
3. Vérifier que **tous les utilisateurs** de l'équipe sont listés (pas juste Admin + Direction)

### Test 4 — Badge notification en retard
1. Créer une sortie avec date de retour = avant-hier (passe en "En retard")
2. Retour à la HomePage
3. Vérifier que la tuile Parc Machines affiche un **badge rouge** avec le nombre + sous-texte rouge "⚠ 1 outil en retard"

### Test 5 — Validation avancement mensuelle
1. Ouvrir le module Avancement
2. Si on est avant le 20 : pas de bannière, pas de bouton validation (normal)
3. Si on est le 20 ou après : bannière rouge "Rappel de fin de mois" visible
4. Ouvrir un chantier → scroll tout en bas → bouton vert **"✓ J'ai terminé mon avancement de [mois]"**
5. Cliquer → confirmer → le bouton devient un bloc vert "✓ [mois] validé par [Toi] — [date]"
6. Retour à la liste des chantiers → badge vert "✓ [mois] validé" sur la carte
7. HomePage → le badge rouge sur Avancement diminue de 1, ou disparaît si c'était le dernier
8. Tester "Annuler la validation" → le bouton vert revient

---

## 🚀 Procédure de déploiement

### 1. Remplacer `src/` sur GitHub

Télécharger le ZIP v9, décompresser, et remplacer tout le dossier `src/` de ton repo `EPJ-Commandes-v1.2` par le nouveau.

### 2. Commit + push

```bash
git add .
git commit -m "v9 - Fixes terrain + panier sortie multiple + notifications avancement"
git push origin main
```

### 3. Attendre le déploiement Vercel (~2 min)

Vérifier sur https://vercel.com que le deploy est **✓ Ready**.

### 4. Vider le cache navigateur

Important sur Safari/iOS :
- **Cmd + Shift + R** sur desktop
- Ou Réglages → Safari → Effacer historique et données de sites

### 5. Tests sur l'app

Suivre la section "Tests recommandés" ci-dessus.

---

## 📊 Structure Firestore actuelle (après v9)

```
📁 utilisateurs/{id}                     — équipe EPJ
📁 chantiers/{id}                        — chantiers actifs/archivés
📁 config/settings                       — config globale
📁 rolesConfig/{role}                    — overrides de droits par rôle
📁 tasksConfig/default                   — modèle d'avancement standard

📁 outils/{id}                           — catalogue parc machines (223 outils)
📁 outillageSorties/{id}                 — sorties (en cours + historique)
📁 outillageCategories/{id}              — 18 catégories EPJ
📁 outillagePannes/{id}                  — 8 pannes récurrentes
📁 smsTemplates/{id}                     — modèles SMS globaux multi-modules

📁 avancementValidations/{chantier_mois} ← NOUVEAU v9
```

---

## 🔮 Pour plus tard (post-v9)

- **v9b — Brevo SMS** : envoi automatique des rappels de retour d'outils (nécessite clé API)
- **v9c — Push notifications** : alerter activement (notification navigateur) quand un chantier dépasse le 25 du mois sans validation
- **Module 4 Réserves & quitus** : réutilisera `smsTemplates` (déjà prêt) + pattern `validationsMensuelles` adapté
- **Environnement dev** : créer `ap-epj-dev` Firebase avant mise en service terrain
- **Scan code-barres** : 59 outils EPJ ont leurs codes-barres dans la base, prêts pour lecture par caméra

---

## 🐛 Troubleshooting

**"Le badge rouge n'apparaît pas sur ma tuile Parc Machines alors qu'un outil est en retard"**
→ Rafraîchir la page (Cmd+Shift+R). Les abonnements Firestore se synchronisent en temps réel, mais la page doit être ouverte.

**"Le bouton validation avancement ne s'affiche pas"**
→ Il est **tout en bas** de l'écran détail chantier, après toutes les catégories et tâches. Scroll jusqu'en bas.

**"La barre flottante du panier disparaît quand je change d'onglet"**
→ Comportement normal : le panier est scopé au module Parc Machines. Si tu quittes vers l'accueil, le panier reste mais la barre n'est visible que dans le module.

**"J'ai cliqué sur 'J'ai terminé mon avancement' par erreur"**
→ Pas grave : un bouton "Annuler la validation" apparaît dans le bloc vert. Clic → annulation immédiate.

---

Bonne utilisation !
— Claude, pour EPJ Électricité Générale

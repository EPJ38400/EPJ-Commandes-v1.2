# ☑️ TESTS.md — v10.G

Liste de tests à dérouler en preprod après déploiement.
Imprime cette page ou ouvre-la sur un 2e écran.

**Légende** :
- ☐ À faire
- ✓ OK
- ✗ Bug → noter le détail dans Google Form

---

## 🐛 Bug fix panier (Frasca)

```
☐ TEST 1 — Vidage panier après envoi (1 min)
  - Action : Connecte-toi en Admin (compte directAchat=true).
  - Crée une commande Chantier avec 1-2 articles.
  - Envoie la commande → écran "Commande enregistrée".
  - Sans cliquer "🏠 Nouvelle commande", reviens à l'accueil du module
    via 🏠 Accueil ou ← Commandes.
  - Re-clique "Commande Chantier" → choisis le même chantier.
  - Attendu : panier vide (0 article)
  - Si tu vois encore les articles précédents → BUG

☐ TEST 2 — Vidage panier si app fermée
  - Action : Crée une commande, envoie-la.
  - FERME l'app (swipe iOS / fermer onglet).
  - Rouvre l'app, reconnecte-toi.
  - Va dans Commandes → Commande Chantier.
  - Attendu : panier vide
  - Si panier plein → BUG
```

---

## 🧹 Suppression USERS et CHANTIERS du code

```
☐ TEST 3 — Liste utilisateurs (Admin)
  - Action : Admin → Utilisateurs
  - Attendu : voir tes 7 utilisateurs habituels (admin, Bilardo, Frasca, Courteau, Rey, Bartoli, Mollin)
  - Si liste vide → Firestore non peuplé, problème

☐ TEST 4 — Liste chantiers (Admin)
  - Action : Admin → Chantiers
  - Attendu : voir les 19 chantiers actifs
  - Si liste vide → Firestore non peuplé

☐ TEST 5 — Sélection chantier dans une commande
  - Action : Crée une nouvelle commande Chantier.
  - Attendu : la liste déroulante des chantiers contient les 19 chantiers actifs
  - Au tout 1er chargement (refresh page F5) : peut être vide pendant ~200ms,
    puis se peuple. Normal.
```

---

## 📦 Migration catalogue (583 articles + colonnes fournisseur)

```
☐ TEST 6 — Catalogue chargé depuis Firestore
  - Action : Module Commandes → Commande Chantier → Choisir n'importe quel chantier
  - Attendu : 16 catégories visibles (sans "Audace + Ovalis" ni "Divers" ; tu les avais retirés)
  - Cliquer une catégorie → articles s'affichent

☐ TEST 7 — Article divers fonctionne (régression possible)
  - Action : Dans le catalogue, "+ Article divers"
  - Désignation : "TEST DIVERS"
  - Référence : (laisser vide)
  - Quantité : 1
  - Cliquer "Ajouter au panier"
  - Attendu : article au panier avec ref auto type "DIV-1234567890"
  - Si erreur "CATALOG.push is not a function" → BUG (régression v10.G)
```

---

## 📥 Import Excel du catalogue

```
☐ TEST 8 — Export du catalogue actuel
  - Action : Connecté en Admin → Module Commandes → Administration → Admin Catalogue
  - Bouton "📤 Exporter en Excel"
  - Attendu : téléchargement d'un fichier Catalogue_EPJ_2026-XX-XX.xlsx
  - Ouvre-le : 9 colonnes, en-tête "Catégorie / Sous-catégorie / Référence / Désignation / Unité / Stock / Fournisseur principal / Code Esabora / Photo URL"
  - Vérifie que les 583 articles sont là

☐ TEST 9 — Import "Fusionner" (cas nominal)
  - Action : Bouton "📥 Importer (fusionner)"
  - Sélectionne ton fichier BASE_Catalogue_APP_EPJ.xlsx
  - Lis le rapport de pré-import qui s'affiche
  - Attendu : "583 articles, ~580 mis à jour, ~3 nouveaux ou 0"
  - Cliquer OK
  - Attendu : "✅ X articles importés"

☐ TEST 10 — Vérification après import
  - Refresh la page (F5 si Mac/PC, fermer/rouvrir si iPhone)
  - Va dans la catégorie "Béton + Descente" → Capri
  - Article "CAP 959922" → vérifier qu'il est bien là avec son fournisseur SONEPAR
  - (Pour l'instant, on n'affiche pas le fournisseur dans l'UI — ça viendra en v10.H)

☐ TEST 11 — Détection doublons dans un fichier
  - Action : Crée un Excel test avec 2 lignes ayant la même référence
  - Importe-le
  - Attendu : popup "⚠️ X référence(s) en doublon dans le fichier", confirmation demandée

☐ TEST 12 — Fichier vide ou cassé
  - Action : Importe un fichier .xlsx vide ou corrompu
  - Attendu : erreur claire, pas de plantage

☐ TEST 13 — Mode Remplacer (DESTRUCTEUR — fais-le seulement en preprod !)
  - Action : Bouton "🗑️ Importer (remplacer)" en PREPROD
  - Sélectionne ton fichier Excel
  - Lis le rapport
  - Tape "EFFACER"
  - Attendu : tout l'ancien catalogue est supprimé, le nouveau prend sa place

☐ TEST 14 — Confirmation Mode Remplacer (sécurité)
  - Action : "🗑️ Importer (remplacer)" puis ANNULER (Cancel)
  - Attendu : rien ne se passe, catalogue intact
  - Re-essayer : taper "abc" au lieu de "EFFACER"
  - Attendu : "❌ Mot de confirmation incorrect — annulé"
```

---

## 🔒 Sécurisation "Réinitialiser Firebase"

```
☐ TEST 15 — Bouton ne s'active pas sans confirmation
  - Action : "🔄 Réinitialiser Firebase" → Annuler le prompt (Cancel)
  - Attendu : rien ne se passe

☐ TEST 16 — Saisie incorrecte
  - Action : "🔄 Réinitialiser Firebase" → Tape "abc" → OK
  - Attendu : "❌ Mot de confirmation incorrect — annulé"

☐ TEST 17 — Saisie correcte (DESTRUCTEUR — preprod uniquement)
  - Action : "🔄 Réinitialiser Firebase" → Tape "RÉINITIALISER" → OK
  - 2e confirmation → OK
  - Attendu : "✅ X articles chargés", base réinitialisée aux 583 articles du seed
```

---

## 🧭 Navigation à 3 niveaux (la grosse refonte)

### Header global (🏠 Accueil)

```
☐ TEST 18 — 🏠 Accueil ramène à la page de garde
  - Va dans Module Commandes → Commande Chantier → Catalogue → Une catégorie
  - Clique le bouton 🏠 Accueil (en haut à gauche, fond noir)
  - Attendu : retour à la page de garde de l'app (5 tuiles modules)

☐ TEST 19 — 🏠 Accueil masqué sur l'accueil
  - Va à la page de garde de l'app
  - Attendu : le bouton 🏠 Accueil n'apparaît pas (rien à fuir)
```

### Sub-header (← Commandes)

```
☐ TEST 20 — ← Commandes ramène à l'accueil du module
  - Module Commandes → Commande Chantier → Sélectionne un chantier
  - Vois le sub-header avec "← Commandes" + flèche ← + nom de la section
  - Clique "← Commandes"
  - Attendu : retour à l'accueil DU MODULE Commandes (4 tuiles : Chantier / Équipement / Historique / Admin)
  - PAS retour à l'accueil de l'app
```

### Footer du catalogue (← Retour)

```
☐ TEST 21 — ← Retour fait UN cran en arrière
  - Module Commandes → Commande Chantier → Catalogue → "Fils / Câbles"
  - Vois le bouton "← Retour" en bas (fond noir)
  - Clique "← Retour"
  - Attendu : retour à la liste des catégories (PAS au home du module)
  - Re-clique "← Retour" depuis la liste des catégories
  - Attendu : retour à l'accueil du module Commandes
```

### Modules harmonisés

```
☐ TEST 22 — Header Parc machines
  - Page de garde → Module Parc machines
  - Attendu : titre "Parc machines / Outillage et matériel" SANS bouton "← Accueil" (c'est l'accueil du module)
  - 🏠 Accueil global toujours visible en haut

☐ TEST 23 — Header Réserves
  - Page de garde → Module Réserves
  - Attendu : titre "Réserves & quitus / Suivi SAV & garantie", pas de bouton "← Accueil" en bas

☐ TEST 24 — Header Avancement
  - Page de garde → Module Avancement
  - Attendu : titre "Avancement chantier / Module", pas de bouton "← Accueil" en bas
```

---

## 🔍 Vérification manuelle Frasca directAchat

```
☐ TEST 25 — directAchat de Frasca
  - Admin → Utilisateurs → Frasca
  - Vérifier la case "🟢 Achats directs (sans validation)"
  - Attendu : DÉCOCHÉE
  - Si elle est cochée : décocher + Enregistrer
```

---

## 📊 Tests de régression non couverts (à valider)

- ☐ Validation d'une commande par un conducteur (workflow inchangé)
- ☐ Génération PDF d'une commande (inchangée)
- ☐ Module Avancement : saisie d'un % pour un bâtiment
- ☐ Module Parc : sortie d'un outil + retour
- ☐ Module Réserves : création d'une réserve + levée avec quitus

---

**Si un test échoue → noter le numéro + détail dans le Google Form de retours.**

**Charte qualité Option D** : ces tests couvrent les modifications v10.G. Les tests de régression complets de l'app entière restent à charge de Pierre-Julien (Claude ne peut pas tester sur l'app déployée).

# EPJ App Globale — v8

Livraison complète du **Module 2 : Parc Machines** avec catalogue, sorties, retours, transferts avec signature double, SMS globaux réutilisables, et infrastructure Firebase Storage.

---

## 🎯 Ce qu'apporte la v8

### Module Parc Machines (nouveau)
- Catalogue de 223 outils EPJ importables en un clic
- 18 catégories métier EPJ (modifiables depuis Admin)
- 8 pannes récurrentes pré-remplies (modifiables)
- Photos d'outils avec upload Firebase Storage (compression auto 1024 px)
- Affectation permanente d'un outil à un employé
- Flux sortie / retour / transfert complets

### Signatures (logique métier repensée)
- **Sortie & retour** : signature OPTIONNELLE (pas de friction inutile)
- **Transfert entre personnes** : **DOUBLE signature OBLIGATOIRE** (preuve contradictoire entre celui qui transfère et celui qui reçoit)

### SMS globaux (nouvelle infrastructure)
- Collection `smsTemplates` globale utilisable par tous les modules
- Modèles par défaut EPJ : rappel retour + relance retard
- Variables auto : `{prenom}`, `{nom}`, `{ref}`, `{dateRetour}`, `{chantier}`
- Bouton "Copier SMS & ouvrir Messages" depuis la fiche outil en retard

### Administration (menu restructuré)
Menu groupé en 4 sections logiques :
- 📂 Équipe & accès (Utilisateurs / Droits / Rôles)
- 📂 Chantiers & tâches (Chantiers / Modèle d'avancement)
- 📂 Parc machines (Catalogue / Catégories / Pannes) — **NOUVEAU**
- 📂 Communication (Modèles SMS) — **NOUVEAU**

---

## 📁 Nouveaux fichiers (v8)

```
src/
├── core/
│   └── components/
│       └── SignaturePad.jsx              ← Canvas signature tactile réutilisable
│
├── modules/parc-machines/
│   ├── ParcMachinesModule.jsx            ← Router 3 onglets (Dashboard / Matériels / Historique)
│   ├── ParcDashboard.jsx                 ← Stats + alertes retard + sorties en cours
│   ├── ParcMateriels.jsx                 ← Catalogue avec recherche/filtres
│   ├── ParcHistorique.jsx                ← Sorties rendues
│   ├── ParcOutilDetail.jsx               ← Fiche outil + boutons d'action
│   ├── ParcOutilSortie.jsx               ← Formulaire sortie (signature optionnelle)
│   ├── ParcOutilRetour.jsx               ← Formulaire retour (pannes + signature optionnelle)
│   ├── ParcOutilTransfert.jsx            ← Transfert avec DOUBLE signature obligatoire
│   ├── parcUtils.js                      ← Helpers (statuts, dates, upload photo, SMS)
│   └── initialOutils.js                  ← Seed 223 outils + 18 cat. + 8 pannes (35 Ko)
│
└── pages/admin/
    ├── AdminOutillage.jsx                ← CRUD catalogue + bouton import initial
    ├── AdminCategoriesOutillage.jsx      ← CRUD catégories
    ├── AdminPannes.jsx                   ← CRUD pannes récurrentes
    └── AdminSmsTemplates.jsx             ← CRUD modèles SMS globaux
```

## 📝 Fichiers modifiés (v8)

```
src/
├── firebase.js                           ← + export storage
├── App.jsx                               ← + route module:parc-machines
├── core/
│   └── DataContext.jsx                   ← + outils, outillageSorties,
│                                             outillageCategories, outillagePannes,
│                                             smsTemplates
└── pages/
    ├── HomePage.jsx                      ← tuile parc-machines: enabled = true
    └── admin/
        ├── AdminPage.jsx                 ← menu regroupé en 4 sections
        └── AdminUsers.jsx                ← + checkbox "Autorisé à sortir un outil"
```

---

## 🚀 Déploiement

### 1. Copier les fichiers

Recopie le dossier `src/` du ZIP dans ton repo GitHub `EPJ38400/EPJ-Commandes-v1.2`, en remplaçant tout le contenu existant de `src/`.

### 2. Vérifier `package.json`

Firebase Storage est inclus dans le SDK `firebase` standard — **aucune nouvelle dépendance à installer**. Vérifie juste que tu as bien :
```json
"firebase": "^10.0.0"   (ou supérieur)
```

### 3. Activer Firebase Storage dans la console

⚠ **ÉTAPE OBLIGATOIRE** avant d'utiliser le module :

1. Console Firebase : https://console.firebase.google.com/project/ap-epj
2. Menu gauche → **Storage**
3. Clic sur **Get started**
4. Choisir une région (recommandé : `europe-west3` — Francfort, plus proche de Grenoble)
5. Accepter les règles par défaut

### 4. Règles de sécurité Firebase Storage

Dans Storage → Rules, remplace les règles par :
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /outils/{allPaths=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

⚠ Ces règles autorisent tout utilisateur authentifié à lire/écrire. Pour serrer plus tard, on pourra filtrer par rôle.

### 5. Commit + push + déploiement Vercel

```bash
git add .
git commit -m "v8 - Module Parc Machines complet + SMS globaux"
git push origin main
```

Vercel déploie automatiquement.

---

## ✅ Procédure de premier lancement (ordre important)

Une fois l'app déployée, connecte-toi en Admin puis :

### Étape 1 — Importer les catégories et pannes
1. Admin → **Catalogue outillage**
2. Tu verras un bandeau orange "🚀 Première utilisation du module"
3. Clique **"1. Importer les 18 catégories"**
4. Clique **"2. Importer les 8 pannes récurrentes"**

### Étape 2 — Importer les 223 outils
5. Clique **"3. Importer les 223 outils EPJ"**
6. Confirme dans la boîte de dialogue
7. Attendre quelques secondes (batch Firestore)
8. Toast "✓ 223 outils importés"

### Étape 3 — Importer les modèles SMS
9. Admin → **Modèles SMS**
10. Clique **"🚀 Importer modèles EPJ"**

### Étape 4 — Autoriser les personnes qui sortent des outils
11. Admin → **Utilisateurs**
12. Pour chaque personne autorisée à sortir un outil : clic pour éditer, coche **"🔧 Autorisé à sortir un outil du parc"**, sauvegarde
13. Admin et Direction l'ont par défaut

### Étape 5 — Photos et affectations (progressif)
Au fil du temps, dans Admin → Catalogue outillage :
- Ajouter une photo à chaque outil (clic sur l'outil → Modifier → Photo)
- Attribuer les outils permanents à leur détenteur (champ "Affectation permanente")

---

## 🔒 Sécurités en place

| Action | Protection |
|---|---|
| Import 223 outils | Bloqué si `outils.length > 0` |
| Import 18 catégories | Bloqué si `outillageCategories.length > 0` |
| Import 8 pannes | Bloqué si `outillagePannes.length > 0` |
| Supprimer catégorie | Bloqué si utilisée par ≥1 outil |
| Sortir un outil | Requiert `canSortirOutil: true` sur le user |
| Transférer un outil | Requiert d'être le détenteur actuel OU Admin/Direction/Assistante |
| Valider le transfert | Les **2 signatures obligatoires** doivent être présentes |
| Gérer le catalogue | Admin / Direction / Assistante uniquement |
| Panne bloquante au retour | Outil passe automatiquement en "Hors service" |

---

## 🧪 Tests recommandés avant mise en service

### Test 1 — Cycle complet sortie/retour
1. Connecte-toi en Admin
2. Catalogue outillage → trouve un outil "Disponible"
3. Clique dessus → **📤 Sortir cet outil**
4. Remplis (emprunteur, chantier, date), valide sans signature
5. L'outil apparaît comme "Sorti" dans le Dashboard
6. Retourne sur la fiche → **✓ Enregistrer le retour**, en "Bon état"
7. Vérifie qu'il apparaît dans Historique

### Test 2 — Retour avec panne bloquante
1. Sors un outil
2. Retourne-le en "Abîmé" → coche PANCORD (Cordon HS, bloquante)
3. Vérifie que l'outil passe en "Hors service"

### Test 3 — Transfert avec double signature
1. Sors un outil pour Joseph
2. Connecte-toi en Joseph → fiche outil → **🔄 Transférer**
3. Choisis Thibaut comme destinataire
4. Essaie de valider sans signer → bouton grisé "Signature 1/2 manquante"
5. Signe → bouton grisé "Signature 2/2 manquante"
6. Fais signer Thibaut → bouton devient bleu "🔄 Valider le transfert"
7. Valide → vérifie que l'outil est maintenant chez Thibaut
8. Vérifie l'historique dans la fiche outil (miniatures des 2 signatures visibles)

### Test 4 — SMS rappel
1. Crée une sortie avec date de retour prévue = **hier**
2. Vérifie le statut "En retard" dans le Dashboard
3. Ouvre la fiche outil → bouton **"📱 Copier SMS rappel & ouvrir Messages"**
4. Clic → toast "SMS copié"
5. Sur iOS : pop-up propose d'ouvrir Messages, le SMS est dans le presse-papier

### Test 5 — Affectation permanente
1. Admin → Catalogue outillage → édite un outil
2. Dans "Affectation permanente", choisis un employé
3. Sauvegarde
4. L'outil affiche maintenant "👤 Attribué" et ne peut plus être sorti par d'autres

---

## 🔮 Pour plus tard (hors v8)

- **v8b — Brevo SMS API** : envoi automatique des rappels depuis l'app (nécessite clé API Brevo)
- **Scan code-barres** : 59 outils EPJ ont déjà leur code-barres renseigné, on pourrait intégrer un lecteur via l'appareil photo
- **Module 4 Réserves & quitus** : réutilisera la collection `smsTemplates` (d'où l'intérêt d'avoir mis les SMS au niveau global)
- **Passage à un environnement `ap-epj-dev`** : à faire avant la mise en service terrain pour isoler les tests

---

## 🐛 Troubleshooting

**"Firebase: Error (storage/unauthorized)"**
→ Storage n'est pas activé ou les règles bloquent l'accès. Voir étapes 3 et 4 du déploiement.

**"Le bouton Valider le transfert reste grisé"**
→ L'une des 2 signatures n'est pas faite. Le texte du bouton précise laquelle manque. Une signature est "faite" si au moins 5 points sont tracés (évite les signatures vides par erreur).

**"L'outil reste affiché comme 'Sorti' après retour"**
→ Rafraîchis la page. Les abonnements onSnapshot de Firestore doivent se mettre à jour en temps réel, mais si le réseau est lent, un rafraîchissement manuel force la resync.

**"Les 223 outils ont été importés 2 fois (doublons)"**
→ Normalement impossible grâce à la sécurité anti-doublon. Si ça arrive, supprimer la collection `outils` dans la console Firestore et relancer l'import.

---

Bonne utilisation du module Parc Machines !
— Claude, pour EPJ Électricité Générale

---

## 🔧 Patch v8.1 (20/04/2026 soir)

**Bug corrigé** : "Accès restreint" affiché sur les écrans Admin Parc Machines même pour un Admin.

**Cause** : les fonctions `canSortirOutil` et `canGererCatalogue` lisaient directement `user.roles` (tableau) au lieu d'utiliser `getRoles(user)` qui gère aussi les formats legacy (`user.role` ou `user.fonction`).

**Fichiers modifiés** :
- `src/modules/parc-machines/parcUtils.js` — utilise `getRoles()` + comparaison insensible à la casse
- `src/modules/parc-machines/ParcOutilSortie.jsx` — utilise `canGererCatalogue()`
- `src/pages/admin/AdminSmsTemplates.jsx` — utilise `canGererCatalogue()`

---

## 🔧 Patch v8.2 (20/04/2026 tard)

**Bug corrigé** : après import des catégories + pannes, le bouton "Importer les 223 outils" devenait invisible — impossible d'importer le catalogue.

**Cause** : le bloc "Imports initiaux" avait une condition d'affichage trop stricte qui le masquait dès qu'au moins une chose était importée.

**Correction** : le bloc reste visible tant qu'il reste au moins un import à faire (outils, catégories ou pannes). Les boutons déjà effectués s'affichent avec une coche ✓ et un état grisé.

**Fichier modifié** : `src/pages/admin/AdminOutillage.jsx`

# EPJ App Globale — v10

**Livraison v10 : SMS rappel, sélection multi permanente, Packs d'outils**

Suite aux retours terrain de la v9 :
1. Les push notifications natives ne fonctionnent pas en PWA sans infra → remplacées par un **système SMS direct**
2. "Rendu par" devient **"Rentré par"** (plus fidèle au vocabulaire atelier)
3. La sélection multiple est maintenant **permanente** (plus besoin de bouton "Commencer")
4. **Nouveau système de Packs** : un marteau-piqueur peut être associé à ses trépans et mèches, et sort en un seul geste

---

## 🎯 Nouveautés de la v10

### 📱 SMS de rappel terrain-ready

Pas de backend requis (pas de cron, pas de Cloud Function) : l'app propose un flux fluide pour envoyer les SMS depuis ton iPhone/Android.

**Sur la HomePage** :
- Bannière rouge **bien visible au chargement** si au moins 1 outil est en retard : _"2 outils en retard — Tape ici pour voir la liste et envoyer les SMS de rappel."_
- Le clic ouvre directement le dashboard Parc Machines

**Dans le Dashboard Parc Machines** :
- Bloc "Outils en retard" **groupé par emprunteur** (si Joseph a 3 outils en retard, il apparaît une seule fois avec ses 3 outils listés en dessous)
- **Bouton "📱 SMS rappel"** sur chaque personne
- Au clic : le SMS est **copié dans le presse-papier** avec toutes les variables remplies (prénom, outils, date), puis l'app **propose d'ouvrir l'app Messages** avec le numéro pré-rempli (`sms:` deeplink)
- Tu n'as plus qu'à **coller** et envoyer
- Si la personne n'a pas de téléphone renseigné dans sa fiche → bouton grisé + avertissement

**Modèle SMS utilisé** (configurable dans Admin → Modèles SMS) :
> _Bonjour {prenom}, rappel EPJ : retour prévu aujourd'hui pour {ref} ({nom}). Merci de le ramener nettoyé et soufflé à l'atelier. — EPJ Electricité_

Si la personne a plusieurs outils en retard, le message adapte automatiquement la liste.

### ✏ "Rendu par" → "Rentré par"

Renommage métier : "Rentré par" reflète mieux le vocabulaire atelier (la personne qui remet l'outil dans le stock). Les clés Firestore internes (`retourParUserId`, `retourParNom`) ne changent pas, la compatibilité avec les données v9 est préservée.

### 🛒 Sélection multiple permanente

Le bouton "🛒 Commencer une sortie de plusieurs outils" a été **supprimé**. Les **cases à cocher sont visibles en permanence** sur chaque outil disponible (pour les utilisateurs autorisés).

**Nouveau comportement** :
- **Clic sur la case à cocher** → ajoute / retire l'outil du panier
- **Clic sur le reste de la carte** → ouvre la fiche détail (comme avant)
- **La barre flottante en bas apparaît dès qu'au moins 1 outil est coché**
- Bouton dynamique : "Sortir 1 outil →" ou "Sortir 5 outils →" selon le nombre

C'est homogène : **même flow pour sortir 1 outil ou 10 outils**. Plus besoin de se poser la question.

### 📦 Packs d'outils — nouvelle fonctionnalité métier

**Le besoin** : un marteau-piqueur part rarement seul sur chantier. Il est accompagné de ses trépans, mèches, etc. Il faut pouvoir les **associer** une fois pour toutes, et que toute sortie du marteau-piqueur propose de sortir le pack complet.

#### Configuration d'un pack (Admin → Catalogue outillage)

Dans le formulaire de création/édition d'un outil :
- Case à cocher **"📦 Cet outil est un pack"**
- Si cochée, zone d'édition apparaît :
  - Recherche d'outils à ajouter
  - Pour chaque outil ajouté : case à cocher **"Obligatoire"** (sinon "Optionnel")
  - Bouton ✕ pour retirer

**Règles** :
- Un pack peut contenir autant d'outils que nécessaire
- Un outil **obligatoire** sera toujours sorti avec le pack
- Un outil **optionnel** peut être décoché au moment de la sortie

#### Sortie d'un pack

**Dans le catalogue**, les packs sont repérables par un badge orange : **"📦 PACK (3)"** (le chiffre = nombre d'outils associés).

**Au clic sur la case à cocher d'un pack** :
1. Un modal full-screen s'ouvre depuis le bas de l'écran
2. Il affiche :
   - Le pack maître en tête
   - La liste des outils associés avec leur disponibilité
   - Les **obligatoires** marqués d'un badge rouge "OBLIGATOIRE" (impossible à décocher)
   - Les **optionnels** cochés par défaut, décochables
   - Les **indisponibles** grisés automatiquement
3. Bouton _"Ajouter X outils au panier"_ ou Annuler
4. Au clic → tous les outils sélectionnés (pack maître + enfants) sont ajoutés au panier en **un seul geste**

#### Au moment de la validation de sortie (ParcSortieMultiple)

Le batch Firestore ajoute automatiquement :
- `groupeSortieId` : même ID pour tous les outils d'une sortie groupée (existant v9)
- `packSortieId` : **nouveau** — même ID pour tous les outils d'un même pack
- `packMaitreOutilId` : **nouveau** — ID de l'outil qui est le pack maître

Ça permet de retracer les packs dans l'historique.

#### Indicateurs visuels dans la fiche outil

**Sur la fiche d'un outil enfant d'un pack actuellement sorti** :
Bannière orange _"🔗 Fait partie du pack 📦 Marteau-piqueur Spit 353"_ avec précision : _"Tu peux rendre chaque outil individuellement, ou rendre le pack complet depuis la fiche du pack maître."_

**Sur la fiche du pack maître sorti** :
- Bannière _"📦 Pack en cours de sortie — Ce pack contient 3 outils actuellement sortis"_
- Liste des outils du pack sortis (ref + nom)

**Bouton "📦 Retour du pack complet (3 outils)"** : orange, apparaît au-dessus du bouton retour normal si le pack a des enfants encore sortis. Pour l'instant, ce bouton **guide** (affiche un message d'explication) mais **le retour de chaque outil reste à faire individuellement** (par design : chaque outil peut avoir un état différent bon/abîmé/panne, ce qui nécessite une inspection individuelle).

---

## 📁 Nouveaux fichiers (v10)

```
src/modules/parc-machines/
└── PackExpandModal.jsx                ← Modal d'expansion d'un pack (bottom sheet)
```

## 📝 Fichiers modifiés (v10)

```
src/
├── pages/
│   ├── HomePage.jsx                   ← + bannière retards outils cliquable
│   └── admin/
│       └── AdminOutillage.jsx         ← + champs isPack, packContent + PackContentEditor
│
└── modules/parc-machines/
    ├── PanierSortieContext.jsx        ← Simplifié : actif = items>0, + addMany()
    ├── PanierFloatingBar.jsx          ← Texte dynamique "Sortir N outil(s)"
    ├── ParcMateriels.jsx              ← Cases à cocher permanentes, gestion pack
    ├── ParcDashboard.jsx              ← RetardsBlock groupé + bouton SMS par personne
    ├── ParcOutilDetail.jsx            ← Bannières pack parent/enfant, "Rentré par"
    ├── ParcHistorique.jsx             ← "Rentré par"
    └── ParcSortieMultiple.jsx         ← + packSortieId/packMaitreOutilId dans batch
```

---

## 🧪 Tests recommandés

### Test 1 — SMS rappel depuis le dashboard
1. Sortir un outil avec date de retour **hier** (passe en "En retard")
2. Retour HomePage → vérifier la **bannière rouge** en haut : "1 outil en retard"
3. Taper dessus → ouvre le dashboard Parc Machines
4. Vérifier le bloc "Outils en retard" avec l'emprunteur + bouton "📱 SMS rappel"
5. Vérifier que le téléphone de l'emprunteur est bien affiché (sinon, aller compléter sa fiche Admin → Utilisateurs)
6. Clic bouton → toast "SMS copié" + confirmation "Ouvrir Messages ?"
7. Confirmer → l'app Messages s'ouvre avec le numéro pré-rempli
8. Coller (le SMS est dans le presse-papier) → envoyer

### Test 2 — Sélection multiple permanente
1. Aller dans Matériels → vérifier le petit rappel _"💡 Coche les outils à sortir…"_
2. Ouvrir une catégorie → vérifier les **cases à cocher sur chaque outil disponible**
3. Cocher 1 outil → barre flottante apparaît en bas : _"Sortir 1 outil →"_
4. Cocher 3 outils → barre passe à _"Sortir 3 outils →"_
5. Cliquer sur le **reste d'une carte** (pas la case) → ouvre la fiche détail (comme avant)
6. Retour en arrière → les outils sont toujours cochés
7. Bouton "Vider" dans la barre → les cases se décochent toutes

### Test 3 — Création d'un pack (Admin)
1. Admin → Catalogue outillage → cliquer sur un marteau-piqueur existant
2. Dans la fiche d'édition, scroll → trouver **"📦 Pack d'outils"**
3. Cocher **"Cet outil est un pack"**
4. Zone de contenu apparaît
5. Chercher un trépan → clic sur la ligne → ajouté au pack
6. Cocher "Obligatoire" sur le trépan
7. Ajouter une mèche → la laisser optionnelle
8. Enregistrer

### Test 4 — Sortie d'un pack
1. Matériels → catégorie Marteaux-piqueurs → vérifier le **badge orange "📦 PACK (2)"** sur la carte du marteau
2. Cocher la case à cocher du marteau
3. **Modal bottom sheet s'ouvre** avec :
   - Pack maître en tête (cerclé orange)
   - Trépan avec badge rouge "OBLIGATOIRE" (impossible à décocher)
   - Mèche cochée par défaut (décochable)
4. Décocher la mèche → bouton passe de "Ajouter 3 outils" à "Ajouter 2 outils"
5. Valider → les 2 outils (marteau + trépan) sont ajoutés au panier
6. Barre flottante : "Sortir 2 outils"
7. Continuer → formulaire de sortie groupée → remplir emprunteur + chantier → valider
8. Dans Firestore, vérifier que les 2 sorties ont le **même `packSortieId`** et le **même `packMaitreOutilId`** (= ID du marteau)

### Test 5 — Indicateurs pack dans les fiches
1. Sur la fiche du **marteau** (pack maître) → vérifier la bannière orange "📦 Pack en cours de sortie" avec la liste du trépan
2. Sur la fiche du **trépan** (enfant) → vérifier la bannière orange "🔗 Fait partie du pack 📦 [Marteau]"
3. Sur le marteau, vérifier le bouton orange "📦 Retour du pack complet (2 outils)" au-dessus du bouton vert retour normal

### Test 6 — "Rentré par"
1. Sortir un outil en tant qu'Admin pour Joseph
2. Se reconnecter en un autre user (ex: Thibaut)
3. Enregistrer le retour de l'outil
4. Historique → vérifier que la ligne affiche bien **"✅ Rentré par Thibaut"** en vert

---

## 🚀 Procédure de déploiement

1. **Télécharger** le ZIP v10
2. **Remplacer** `src/` dans ton repo `EPJ-Commandes-v1.2`
3. **Commit + push** :
   ```bash
   git add .
   git commit -m "v10 - SMS rappel + sélection multi permanente + Packs d'outils"
   git push origin main
   ```
4. **Attendre Vercel** (~2 min) — vérifier ✓ Ready
5. **Vider le cache** : Cmd+Shift+R sur desktop ou Réglages Safari iOS → Effacer

---

## 📊 Structure Firestore après v10

```
📁 utilisateurs/{id}                     — + telephone (important pour SMS)
📁 chantiers/{id}                        — + affectations
📁 config/settings
📁 rolesConfig/{role}
📁 tasksConfig/default

📁 outils/{id}                           — + isPack, packContent (v10)
📁 outillageSorties/{id}                 — + packSortieId, packMaitreOutilId (v10)
                                           + retourParUserId, retourParNom (v9)
                                           + groupeSortieId (v9)
📁 outillageCategories/{id}
📁 outillagePannes/{id}
📁 smsTemplates/{id}
📁 avancementValidations/{chantier_mois}
```

---

## 🔮 Pour plus tard

**v11 — Backend SMS automatique**
Quand tu auras un compte Brevo/Twilio :
- Cloud Function Firebase qui tourne chaque matin à 8h
- Lit `outillageSorties` avec `dateRetourPrevue = aujourd'hui` et pas de `dateRetourReelle`
- Envoie le SMS automatiquement
- Nécessite : clé API Brevo (~0,05€/SMS FR)

**v11 — Retour groupé batch des packs**
Aujourd'hui le bouton "Retour du pack complet" guide mais chaque outil est validé individuellement. Si on veut un vrai retour groupé :
- Écran dédié "Retour groupé du pack"
- Pour chaque outil : état (bon/abîmé) + pannes éventuelles
- 1 seul batch Firestore pour tous les retours

**v11 — Historique des packs**
Dans l'onglet Historique, regrouper visuellement les sorties d'un même pack (comme une carte avec une liste d'outils).

**v12 — Push notifications native**
Si ton équipe installe l'app en PWA ("Ajouter à l'écran d'accueil") :
- Firebase Cloud Messaging + VAPID
- Permission demandée à la connexion
- Notifications push matinales pour les retards

---

## 🐛 Troubleshooting

**"Je coche un pack mais le modal ne s'ouvre pas"**
→ Vérifier que l'outil a bien `isPack: true` ET `packContent: [...]` non vide dans Firestore (onglet Admin → Catalogue outillage → éditer).

**"Je ne vois pas le badge 📦 PACK sur mon pack"**
→ Le badge n'apparaît que si `isPack === true` ET `packContent` est un tableau avec au moins 1 élément. Sinon c'est un outil normal.

**"Le bouton SMS rappel ne fait rien sur mon iPhone"**
→ Vérifier que l'utilisateur a bien un numéro de téléphone au format `+33612345678` ou `0612345678` dans sa fiche Admin → Utilisateurs.

**"Le SMS est copié mais l'app Messages ne s'ouvre pas"**
→ C'est normal sur desktop (pas d'app SMS). Sur iPhone, après la confirmation "Ouvrir Messages ?", Safari doit basculer automatiquement.

**"Je n'arrive plus à sortir qu'un seul outil"**
→ Coche simplement 1 seul outil, puis clique sur "Sortir 1 outil" dans la barre flottante du bas. C'est le même flow que pour sortir 10 outils.

---

Bonne utilisation !
— Claude, pour EPJ Électricité Générale

---

## 🔧 Patch v10.1 (21/04/2026) — Safe-area iPhone

**Problème** : sur iPhone, le header de l'app passait derrière la barre de statut (heure / réseau / batterie). La barre flottante du panier pouvait aussi être masquée par le home indicator.

**Correction** : adaptation complète à la **safe-area iOS** :
- `index.html` : ajout de `viewport-fit=cover` + `theme-color` (**À MODIFIER MANUELLEMENT** — voir `v10.1-instructions-index-html.md`)
- `src/core/theme.js` : règles globales `env(safe-area-inset-*)` + classes utilitaires
- `src/core/Layout.jsx` : Header avec `padding-top: env(safe-area-inset-top)` + padding latéraux pour iPhone paysage
- `src/modules/parc-machines/PanierFloatingBar.jsx` : padding-bottom dynamique pour home indicator
- `src/modules/parc-machines/ParcMachinesModule.jsx` : réserve d'espace bas qui tient compte de la safe-area

**À refaire côté iPhone** après déploiement :
- Cmd+Shift+R dans Safari, OU
- Effacer historique + données de sites dans Réglages → Safari
- Si l'app est déjà installée en PWA sur l'écran d'accueil : la supprimer et la réinstaller (les metas viewport sont cachées par iOS sinon)

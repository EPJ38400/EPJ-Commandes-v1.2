# EPJ App Globale — src/ complet v5

**Version :** Socle + Admin + Commandes + Avancement chantier (avec tâches modifiables + téléphones)
**Date :** 19 avril 2026

## Nouveautés v5

### 📋 Tâches d'avancement modifiables à 2 niveaux

Système à **3 couches** (comme les droits) :

1. **FACTORY** — valeurs usine dans le code (jamais perdues, basées sur ton Excel)
2. **MODÈLE GLOBAL** — stocké dans Firestore `tasksConfig/default`, modifiable par Admin dans `Admin → Modèle d'avancement`
3. **OVERRIDE PAR CHANTIER** — stocké sur chaque chantier, modifiable via le bouton `✏ Tâches` dans l'écran d'avancement

**La couche la plus spécifique gagne.** Tu peux :
- Modifier le modèle global → tous les futurs chantiers (et ceux qui n'ont pas d'override) en héritent
- Modifier par chantier → cette modif ne touche que ce chantier précis

### 🎯 Actions possibles sur les tâches

- ✅ Ajouter une tâche
- ✅ Modifier le libellé d'une tâche existante
- ✅ Supprimer une tâche
- ✅ Réorganiser l'ordre (flèches ↑↓)

**Les catégories Béton et Placo** sont toujours générées automatiquement selon la typologie bâtiment (sous-sols + étages + combles), car elles dépendent de la structure physique du bâtiment. Pour les modifier, change la config dans `Admin → Chantiers → Bâtiments`.

### 👥 Qui peut éditer les tâches ?

**Modèle global** (Admin → Modèle d'avancement) : Admin + Direction

**Par chantier** (bouton `✏ Tâches` dans l'écran d'avancement) :
- Admin et Direction : sur tous les chantiers
- Conducteur de travaux : uniquement sur SES chantiers (où il est `conducteurId`)

### 📱 Numéro de téléphone des utilisateurs

Nouveau champ dans `Admin → Utilisateurs` :
- Champ optionnel pour tous les rôles
- Format français auto-normalisé (ex: `0612345678` → `06 12 34 56 78`)
- Accepte aussi le format international (`+33 6 12 34 56 78`)
- Affiché dans la liste des users à côté de l'email
- **Préparé pour les futures notifications SMS** (via Brevo ou autre)

## Contenu du src/

```
src/
├── App.jsx
├── main.jsx, firebase.js, initFirestore.js
├── core/
│   ├── theme.js, logo.js, permissions.js
│   ├── AuthContext.jsx, DataContext.jsx       ← charge tasksConfig
│   ├── Layout.jsx
│   └── components/ (Spinner, Toast)
├── pages/
│   ├── LoginPage.jsx, HomePage.jsx
│   └── admin/
│       ├── AdminPage.jsx                       ← 5 sections maintenant
│       ├── AdminUsers.jsx                      ← + champ téléphone
│       ├── AdminChantiers.jsx
│       ├── AdminRights.jsx
│       ├── AdminRolesTypes.jsx
│       └── AdminTasksModel.jsx                 ← NOUVEAU
└── modules/
    ├── commandes/
    └── avancement/
        ├── avancementTasks.js                  ← refondu 3 couches
        ├── AvancementModule.jsx
        └── AvancementChantier.jsx              ← + édition inline des tâches
```

## Procédure de déploiement

1. **Décompresse** ce ZIP
2. Dans ton repo GitHub, **supprime le dossier `src/` actuel**
3. **Uploade le dossier `src/` de ce ZIP**
4. Commit : *"v5 : Tâches modifiables + téléphone utilisateurs"*
5. Vercel redéploie automatiquement

## Tests

### 1. Modifier le modèle global
- Connecte-toi en `admin` / `admin2010`
- Clique ⚙ → **Modèle d'avancement**
- Badge "• Personnalisé" ou "• Valeurs usine" visible en haut
- Déplie une catégorie (ex: ÉTUDE / TMA)
- Modifie un libellé (clic sur le champ, édite, clic ailleurs pour valider)
- Ajoute une tâche (tape dans "Nouvelle tâche…" + Entrée ou bouton +)
- Réorganise (flèches ↑↓)
- Supprime avec 🗑
- Bouton "Enregistrer le modèle" en bas devient actif → clique
- Bouton "♻ Valeurs usine" pour remettre tout à zéro

### 2. Modifier les tâches d'UN chantier précis
- Accueil → **📊 Avancement chantier**
- Clique sur un chantier
- Bouton **✏ Tâches** visible en haut à droite (pour Admin, Direction, ou Conducteur de ce chantier uniquement)
- Clique → bandeau orange "Mode édition" apparaît
- Déplie une catégorie
- Même interface que le modèle global (ajouter/modifier/supprimer/réorganiser)
- Chaque modif est sauvegardée instantanément dans le chantier
- Les catégories Béton et Placo sont visibles mais en lecture seule (étiquette "généré, non modifiable")
- Bouton **✓ Terminé** pour sortir du mode édition

### 3. Ajouter un téléphone à un utilisateur
- Admin → **Utilisateurs** → Modifie un utilisateur
- Nouveau champ "Téléphone mobile" sous Email
- Tape `0612345678` puis clique ailleurs → auto-formaté en `06 12 34 56 78`
- Enregistre
- Dans la liste des users, le téléphone apparaît après l'email

### 4. Tester les droits
- Un Conducteur connecté voit le bouton ✏ Tâches **uniquement** sur les chantiers où il est conducteurId
- Un Chef ou Monteur ne voit pas le bouton ✏ Tâches (peut juste saisir les %)
- Un utilisateur non-Admin ne voit pas la section "Modèle d'avancement" dans l'Admin (car il n'y a pas accès à l'Admin)

## Migration des données

**Aucune migration nécessaire.** 
- Tes 7 users existants n'ont pas de champ `telephone` → le champ est vide jusqu'à ce que tu l'ajoutes
- Tes 19 chantiers existants n'ont pas de `avancementTasksOverride` → ils utilisent le modèle global (ou FACTORY si aucun modèle global)
- La collection `tasksConfig` n'existe pas encore → sera créée au premier "Enregistrer le modèle"

Le système reste **100% rétrocompatible**.

## Prochaines étapes

- **Livraison 6** : Module 2 — Parc machines ou Module 4 — Réserves & quitus
- **Livraison 7** : Dashboards (Direction, Conducteur, Public/Kiosque)
- **Livraison 8** : Module 5 — Suivi chantier / Esabora
- **Intégration SMS** : branchement Brevo / autre fournisseur sur le champ téléphone

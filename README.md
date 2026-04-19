# EPJ App Globale — src/ complet v3

**Version :** Socle + Admin avec Rôles types modifiables
**Date :** 19 avril 2026

## Nouveautés par rapport à la version précédente

### 🎭 Rôles types modifiables (nouveau)

Une **4ᵉ section** dans Admin : "Rôles types". Permet de modifier les droits par défaut de chaque rôle, stockés dans Firestore (collection `rolesConfig`). Impacte **tous les utilisateurs** ayant ce rôle.

Système à **3 couches** :
1. **Valeurs usine** (dans le code) — jamais perdues
2. **Override de rôle** (Firestore) — modifiable via l'écran Rôles types
3. **Override utilisateur** (Firestore) — modifiable via Droits des utilisateurs

La couche la plus spécifique gagne. Bouton "Remettre aux valeurs usine" en 1 clic pour tout reset.

Le rôle **Admin est verrouillé** (impossible de se couper l'accès par erreur).

### 🧹 Ajustements demandés

- ✅ **Affectations d'équipe optionnelles** : bandeau explicite + libellé sur chaque champ
- ✅ **Bloc "Assistantes" retiré** des affectations chantier (elles ne sont pas affectées par chantier)
- ✅ **Dropdowns multi-select** (liste déroulante avec cases à cocher) pour chefs, monteurs, artisans — plus adapté mobile que les pastilles

## Contenu

```
src/
├── App.jsx
├── main.jsx
├── firebase.js
├── initFirestore.js
├── core/
│   ├── theme.js
│   ├── logo.js
│   ├── permissions.js                ← 3 couches + getEffectiveRolePerms()
│   ├── AuthContext.jsx
│   ├── DataContext.jsx                ← charge rolesConfig en plus
│   ├── Layout.jsx
│   └── components/
│       ├── Spinner.jsx
│       └── Toast.jsx
├── pages/
│   ├── LoginPage.jsx
│   ├── HomePage.jsx
│   └── admin/
│       ├── AdminPage.jsx              ← 4 sections
│       ├── AdminUsers.jsx
│       ├── AdminChantiers.jsx         ← dropdown multi-select + sans assistantes
│       ├── AdminRights.jsx            ← utilise rolesConfig
│       └── AdminRolesTypes.jsx        ← NOUVEAU : édition droits par rôle
└── modules/
    └── commandes/
        ├── CommandesModule.jsx
        └── CommandesInner.jsx
```

## Procédure de déploiement

1. **Décompresse** ce ZIP
2. Dans ton repo GitHub, **supprime le dossier `src/` actuel**
3. **Uploade le dossier `src/` de ce ZIP** (drag & drop via "Ajouter un fichier → Télécharger des fichiers")
4. Commit : *"src/ v3 : Rôles types + dropdowns + optionnel"*
5. Vercel redéploie automatiquement

## Comment tester la nouvelle section "Rôles types"

1. Admin → **Rôles types**
2. Tu vois la liste des 7 rôles + nombre d'utilisateurs de chaque
3. Clique sur **"Monteur"** (par exemple)
4. Change une case, par exemple "Commandes" → "Validate" → "Mes chantiers"
5. Enregistre → **tous les Monteurs** hériteront de ce nouveau droit
6. Re-rentrer dans "Monteur" → bouton "♻ Valeurs usine" disponible pour tout reset

## Comment tester les dropdowns multi-select chantier

1. Admin → **Chantiers** → édite un chantier
2. Section "Équipe du chantier" :
   - Le bloc commence par un bandeau "💡 Tous les champs sont optionnels"
   - Conducteur travaux reste un dropdown simple (1 seul)
   - Chefs de chantier : clique sur le champ, liste déroulante s'ouvre avec cases à cocher
   - Idem pour Monteurs et Artisans
   - Les sélectionnés apparaissent aussi sous forme de tags sous le dropdown, clic dessus pour retirer
3. Plus de bloc "Assistantes"

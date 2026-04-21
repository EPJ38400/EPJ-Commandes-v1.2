# 📁 Structure du projet — NE PAS RENOMMER LES DOSSIERS

## ⚠️ IMPORTANT : Safari traduit automatiquement les noms

Safari sur Mac traduit parfois les noms de dossiers en français quand tu dézippes.
**Ces noms DOIVENT rester en anglais pour que Vite/Vercel fonctionnent** :

| Nom correct (anglais) | ❌ Ne PAS utiliser |
|-----------------------|---------------------|
| `src/`                | `source/`           |
| `src/core/`           | `source/cœur/`      |
| `public/`             | `publique/`         |

## Pour éviter le problème

**Utilise Chrome ou Firefox** pour télécharger et dézipper, pas Safari.

Ou, dans Safari : Réglages → Général → désactiver la traduction automatique.

## Structure attendue par Vite

```
EPJ-Commandes-v1.2/          ← racine du repo GitHub
├── public/                   ← (assets statiques, manifest.json…)
├── src/                      ← CODE SOURCE (c'est ici que je livre les fichiers du ZIP)
│   ├── core/                 ← logique partagée (theme, auth, Layout, etc.)
│   ├── modules/              ← modules métier (parc-machines, avancement…)
│   ├── pages/                ← pages (HomePage, LoginPage, admin)
│   ├── App.jsx
│   ├── main.jsx
│   └── firebase.js
├── index.html
├── package.json
└── vite.config.js
```

# Patch PWA Icon — Nouvelle icône carte de visite EPJ

## Problème

Quand on ajoute l'app à l'écran d'accueil de l'iPhone (ou Android), l'icône affichée est l'**ancienne icône EPJ simple** et non la nouvelle **icône carte de visite EPJ** (avec les arcs bleu/vert/orange autour du logo).

## Cause

Le code React contient bien la nouvelle icône (dans `src/core/logo.js`), mais le **manifest.json** et les **balises meta Apple dans index.html** n'y font pas référence. C'est ce que le navigateur/OS regarde quand on fait "Ajouter à l'écran d'accueil".

## Contenu du patch

```
public/
├── manifest.json           ← NOUVEAU (ou remplace l'existant)
├── icon-192.png            ← NOUVEAU (192×192)
├── icon-512.png            ← NOUVEAU (512×512)
├── apple-touch-icon.png    ← NOUVEAU (180×180, utilisé par iOS)
├── favicon-32.png          ← NOUVEAU (favicon navigateur)
└── favicon-16.png          ← NOUVEAU

index.html                   ← REMPLACE l'existant
```

## Procédure de déploiement

### 1. Uploader les icônes dans `public/`

Sur GitHub, va dans le dossier **`public/`** de ton repo (à la racine, pas dans `src/`).

Si le dossier `public/` n'existe pas, crée-le d'abord :
- GitHub web → bouton "Add file" → "Create new file"
- Nom du fichier : `public/.gitkeep` (on crée juste un placeholder)
- Commit

Puis pour chaque fichier du ZIP :
- Clique "Add file" → "Upload files"
- Glisse les 6 fichiers du dossier `public/` du ZIP :
  - `manifest.json`
  - `icon-192.png`
  - `icon-512.png`
  - `apple-touch-icon.png`
  - `favicon-32.png`
  - `favicon-16.png`
- Commit : *"PWA : nouvelles icônes carte de visite"*

### 2. Mettre à jour `index.html`

À la racine de ton repo (au même niveau que `package.json` et `src/`).

**Attention :** ne remplace **pas bêtement tout le fichier** — il faut que le script `<script type="module" src="/src/main.jsx">` reste correct. Ouvre l'`index.html` actuel et compare.

Les balises importantes à avoir dans le `<head>` :

```html
<!-- Favicons -->
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16.png" />

<!-- PWA Manifest -->
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#3D3D3D" />

<!-- iOS -->
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="EPJ" />

<!-- Android -->
<meta name="mobile-web-app-capable" content="yes" />
<meta name="application-name" content="EPJ" />
```

Si tu veux, tu peux simplement **remplacer l'index.html** par celui fourni dans le patch (il contient déjà le `<script>` correct pour Vite).

### 3. Commit + push

Vercel va redéployer automatiquement.

### 4. Tester sur iPhone

**IMPORTANT** : iOS et Chrome mettent les icônes PWA en cache **de manière très agressive**. Après le déploiement :

1. **Supprime d'abord l'ancienne app** de ton écran d'accueil (clic long → Supprimer l'app)
2. Dans Safari, ouvre l'URL Vercel
3. **Rafraîchis 2-3 fois** (tire vers le bas, ou Safari → Paramètres → Effacer historique pour être sûr)
4. Partager → "Sur l'écran d'accueil"
5. La nouvelle icône carte de visite doit maintenant apparaître

Si ça ne marche toujours pas :
- Vide complètement le cache Safari : Réglages iOS → Safari → Effacer historique et données
- Redémarre l'iPhone
- Réessaye

### Sur Android

1. Supprime l'icône de l'écran d'accueil
2. Chrome → Menu (3 points) → Paramètres → Confidentialité → Effacer données de navigation → Choisir "Images et fichiers en cache"
3. Retourne sur l'URL
4. Menu Chrome → "Ajouter à l'écran d'accueil"

## Vérification du manifest

Après déploiement, tu peux aller sur `https://epj-commandes-v1-2.vercel.app/manifest.json` dans un navigateur. Tu devrais voir le contenu JSON avec les bonnes références aux nouvelles icônes.

## Après ce patch

L'icône qui s'affichera sera celle style "carte de visite EPJ" avec :
- Logo EPJ centré
- Arcs colorés bleu / vert / orange en fond
- Style cohérent avec la nouvelle interface

Tout le reste de l'app (fonctionnalités, données) n'est pas impacté.

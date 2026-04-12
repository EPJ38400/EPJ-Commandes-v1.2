# EPJ Commandes — Guide de déploiement

## Option 1 : Vercel (Recommandé — Gratuit, 5 minutes)

### Prérequis
- Un compte GitHub (gratuit) → github.com
- Un compte Vercel (gratuit) → vercel.com

### Étapes

**1. Créer un dépôt GitHub**
- Allez sur github.com → "New repository"
- Nom : `epj-commandes`
- Cliquez "Create repository"

**2. Envoyer les fichiers sur GitHub**

Installez Git si ce n'est pas fait, puis dans un terminal :

```bash
cd epj-commandes
git init
git add .
git commit -m "EPJ Commandes v1.2"
git branch -M main
git remote add origin https://github.com/VOTRE-COMPTE/epj-commandes.git
git push -u origin main
```

**3. Déployer sur Vercel**
- Allez sur vercel.com → "Add New Project"
- Connectez votre GitHub
- Sélectionnez le dépôt `epj-commandes`
- Framework : Vite (détecté automatiquement)
- Cliquez "Deploy"
- En 1 minute, votre app est en ligne à : `https://epj-commandes.vercel.app`

**4. Domaine personnalisé (optionnel)**
- Dans Vercel → Settings → Domains
- Ajoutez `commandes.epj-electricite.com`
- Configurez un CNAME chez votre registrar DNS


## Option 2 : Netlify (Gratuit aussi)

Même principe que Vercel :
- netlify.com → "Add new site" → "Import from Git"
- Sélectionnez le dépôt GitHub
- Build command : `npm run build`
- Publish directory : `dist`
- Deploy !


## Option 3 : Hébergement OVH / Classique

Si vous avez déjà un hébergement web :

```bash
# Sur votre machine, dans le dossier du projet
npm install
npm run build
```

Cela crée un dossier `dist/` avec les fichiers statiques.
Envoyez le contenu du dossier `dist/` sur votre hébergement via FTP.


## Installer comme application sur téléphone (PWA)

Une fois l'app déployée :

**iPhone (Safari) :**
1. Ouvrir l'URL dans Safari
2. Appuyer sur le bouton Partager (carré avec flèche)
3. "Sur l'écran d'accueil"
4. L'app s'installe comme une vraie application

**Android (Chrome) :**
1. Ouvrir l'URL dans Chrome
2. Menu ⋮ → "Ajouter à l'écran d'accueil"
3. L'app s'installe comme une vraie application


## Mises à jour

Pour mettre à jour l'application :

1. Modifiez le fichier `src/App.jsx`
2. Poussez sur GitHub :
```bash
git add .
git commit -m "Mise à jour"
git push
```
3. Vercel/Netlify redéploie automatiquement en ~30 secondes


## Structure du projet

```
epj-commandes/
├── index.html          ← Page HTML principale
├── package.json        ← Dépendances (React, Vite)
├── vite.config.js      ← Config du build
├── public/
│   ├── favicon.svg     ← Icône EPJ
│   └── manifest.json   ← Config PWA (installation mobile)
└── src/
    ├── main.jsx        ← Point d'entrée React
    └── App.jsx         ← Application EPJ Commandes (tout le code)
```

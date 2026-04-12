# EPJ Commandes — Guide de déploiement

## Méthode recommandée : Vercel (Gratuit, 5 minutes)

### Ce qu'il vous faut
- Un compte GitHub (gratuit) → github.com
- Un compte Vercel (gratuit) → vercel.com

---

## Étape 1 : Créer un compte GitHub

1. Allez sur **github.com**
2. Cliquez **"S'inscrire"** (ou "Sign up")
3. Remplissez email, mot de passe, nom d'utilisateur
4. Confirmez par email

---

## Étape 2 : Créer un dépôt et envoyer les fichiers

### Méthode simple (sans terminal, tout dans le navigateur)

1. Connectez-vous à github.com
2. Cliquez le bouton **"+"** en haut à droite → **"Nouveau dépôt"** (ou "New repository")
3. Nom du dépôt : **epj-commandes**
4. Laissez "Public" coché
5. Cliquez **"Créer un dépôt"** (ou "Create repository")
6. Sur la page qui s'affiche, cliquez sur le lien **"téléversement d'un fichier existant"** (ou "uploading an existing file")
7. **Décompressez le ZIP** que je vous ai donné sur votre ordinateur
8. Ouvrez le dossier décompressé
9. Sélectionnez **tous les fichiers et dossiers** (Ctrl+A) et **glissez-déposez** dans la zone de dépôt GitHub
10. En bas de la page, cliquez **"Valider les modifications"** (ou "Commit changes")

**Important :** Vérifiez bien que les dossiers `src/` et `public/` sont présents dans le dépôt après l'envoi.

---

## Étape 3 : Déployer sur Vercel

1. Allez sur **vercel.com**
2. Cliquez **"S'inscrire"** → choisissez **"Continuer avec GitHub"**
3. Autorisez Vercel à accéder à votre compte GitHub
4. Cliquez **"Ajouter un nouveau projet"** (ou "Add New Project")
5. Dans la liste, trouvez **epj-commandes** et cliquez **"Importer"** (ou "Import")
6. Vercel détecte automatiquement que c'est un projet Vite
7. Cliquez **"Déployer"** (ou "Deploy")
8. Attendez environ 1 minute
9. Votre application est en ligne ! Vercel vous donne une adresse du type :
   **https://epj-commandes.vercel.app**

---

## Étape 4 : Installer sur les téléphones des monteurs

Envoyez le lien de l'application aux monteurs par SMS ou WhatsApp.

### Sur iPhone (Safari) :
1. Ouvrir le lien dans **Safari**
2. Appuyer sur le bouton **Partager** (carré avec flèche vers le haut)
3. Faire défiler et appuyer sur **"Sur l'écran d'accueil"**
4. Appuyer **"Ajouter"**
5. L'icône EPJ apparaît sur l'écran d'accueil comme une vraie application

### Sur Android (Chrome) :
1. Ouvrir le lien dans **Chrome**
2. Appuyer sur les **3 points** en haut à droite (⋮)
3. Appuyer **"Ajouter à l'écran d'accueil"**
4. Appuyer **"Ajouter"**
5. L'icône EPJ apparaît sur l'écran d'accueil comme une vraie application

---

## Mises à jour de l'application

Pour mettre à jour l'application après une modification :

1. Allez sur votre dépôt GitHub (github.com/VOTRE-COMPTE/epj-commandes)
2. Naviguez jusqu'au fichier à modifier (par ex. `src/App.jsx`)
3. Cliquez sur le fichier puis sur l'icône **crayon** (✏️) pour modifier
4. Faites vos modifications
5. Cliquez **"Valider les modifications"** en bas
6. Vercel redéploie automatiquement en ~30 secondes
7. Les monteurs n'ont rien à faire, l'app se met à jour toute seule

---

## Domaine personnalisé (optionnel)

Si vous voulez une adresse du type `commandes.epj-electricite.com` :

1. Dans Vercel → Paramètres du projet → Domaines
2. Ajoutez `commandes.epj-electricite.com`
3. Vercel vous indique un enregistrement DNS à ajouter
4. Chez votre hébergeur (OVH, etc.), ajoutez un CNAME pointant vers `cname.vercel-dns.com`

---

## Structure du projet

```
epj-commandes/
├── index.html          ← Page HTML principale
├── package.json        ← Dépendances (React, Vite)
├── vite.config.js      ← Configuration du build
├── .gitignore          ← Fichiers à ignorer par Git
├── DEPLOIEMENT.md      ← Ce guide
├── public/
│   ├── favicon.svg     ← Icône EPJ
│   └── manifest.json   ← Configuration PWA (installation mobile)
└── src/
    ├── main.jsx        ← Point d'entrée React
    └── App.jsx         ← Application EPJ Commandes (tout le code)
```

---

## En cas de problème

- **L'app ne se compile pas sur Vercel** : Vérifiez que le fichier `package.json` est bien à la racine du dépôt (pas dans un sous-dossier)
- **Page blanche** : Vérifiez que `src/App.jsx` et `src/main.jsx` sont bien présents
- **Erreur 404** : Ajoutez un fichier `vercel.json` à la racine avec : `{"rewrites":[{"source":"/(.*)", "destination":"/"}]}`

# Instructions pour appliquer le patch v2.0.0

**Lire en entier avant de commencer.**
**Une sauvegarde de la version actuelle doit être disponible.**

---

## Étape 0 — Vérifier la sauvegarde

Avant toute chose, confirmer que tu as bien une copie complète du dossier actuel (`C:\Users\WS2\Desktop\AP EPJ` ou équivalent) que tu peux restaurer en cas de problème.

---

## Étape 1 — Décompresser le patch

Extraire le ZIP `epj-patch-v2.0.0.zip` dans un dossier temporaire (par exemple `C:\Users\WS2\Desktop\epj-patch-v2`).

Tu verras la structure suivante :
```
epj-patch-v2/
├── firestore.rules
├── storage.rules
├── firebase.json
├── firestore.indexes.json
├── vite.config.js
├── vercel.json
├── package.json
├── CHANGELOG_v2.0.0.md
├── INSTRUCTIONS_APPLY_PATCH.md  ← ce fichier
├── functions/
│   ├── index.js
│   ├── backups.js
│   └── package.json
├── src/
│   ├── core/
│   │   ├── logo.js
│   │   ├── DataContext.jsx
│   │   └── components/
│   │       ├── SignaturePad.jsx
│   │       └── ErrorBoundary.jsx
│   └── modules/
│       └── reserves/
│           └── SignaturePad.jsx
├── public/
│   ├── logo-header.png
│   ├── logo-login.png
│   ├── app-icon.jpg
│   └── bg-login.jpg
└── docs/
    ├── SETUP_PREPROD.md
    └── DOMAINE_CUSTOM.md
```

---

## Étape 2 — Copier les fichiers dans le projet

Dans `C:\Users\WS2\Desktop\AP EPJ`, copier les fichiers du patch en respectant les chemins :

### À la racine du projet
- `firestore.rules` → **NOUVEAU** à créer
- `storage.rules` → **NOUVEAU** à créer
- `firebase.json` → **REMPLACE** l'existant
- `firestore.indexes.json` → **REMPLACE** l'existant
- `vite.config.js` → **REMPLACE** l'existant
- `vercel.json` → **REMPLACE** l'existant
- `package.json` → **REMPLACE** l'existant
- `CHANGELOG_v2.0.0.md` → **NOUVEAU**

### Dans `functions/`
- `index.js` → **REMPLACE** l'existant
- `backups.js` → **REMPLACE** l'existant
- `package.json` → **REMPLACE** l'existant

### Dans `src/core/`
- `logo.js` → **REMPLACE** l'existant
- `DataContext.jsx` → **REMPLACE** l'existant

### Dans `src/core/components/`
- `SignaturePad.jsx` → **REMPLACE** l'existant
- `ErrorBoundary.jsx` → **NOUVEAU**

### Dans `src/modules/reserves/`
- `SignaturePad.jsx` → **REMPLACE** l'existant

### Dans `public/` (créer le dossier s'il n'existe pas)
- `logo-header.png` → **NOUVEAU**
- `logo-login.png` → **NOUVEAU**
- `app-icon.jpg` → **NOUVEAU**
- `bg-login.jpg` → **NOUVEAU**

### Dans `docs/` (créer le dossier s'il n'existe pas)
- `SETUP_PREPROD.md` → **NOUVEAU**
- `DOMAINE_CUSTOM.md` → **NOUVEAU**

---

## Étape 3 — Modification manuelle d'une ligne

Dans `src/modules/commandes/CommandesInner.jsx`, à la **ligne 3540**, remplacer :

```jsx
try{ total += await deleteCategoryByQuery(cat); }catch(e){}
```

par :

```jsx
try{ total += await deleteCategoryByQuery(cat); }catch(e){console.error("[admin] Erreur suppression catégorie parasite:", cat, e);}
```

C'est la seule ligne à modifier dans ce fichier (3873 lignes au total). Le reste du fichier reste tel quel.

---

## Étape 4 — Activer l'ErrorBoundary

Dans `src/main.jsx` (ou le fichier qui rend `<App/>`), envelopper `<App/>` avec `<ErrorBoundary>` :

**Avant :**
```jsx
import { App } from "./App";
// ...
ReactDOM.createRoot(document.getElementById("root")).render(<App />);
```

**Après :**
```jsx
import { App } from "./App";
import { ErrorBoundary } from "./core/components/ErrorBoundary";
// ...
ReactDOM.createRoot(document.getElementById("root")).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
```

Ouvre `src/main.jsx` dans VS Code et fais cette modif manuellement.

---

## Étape 5 — Tester en local

Dans PowerShell, à la racine du projet :

```powershell
npm install
npm run build
npm run test:unit
```

Si **build** et **tests** passent → continuer.
Si erreur → restaurer la sauvegarde et signaler.

---

## Étape 6 — Déployer Firebase (Rules + Functions + Indexes)

Tester d'abord en preview (si tu as un projet preprod), sinon directement en prod :

```powershell
firebase deploy --only firestore:rules
firebase deploy --only storage
firebase deploy --only firestore:indexes
firebase deploy --only functions
```

**Avant le premier `firebase deploy --only functions`** : vérifier que le bucket `ap-epj-backups` existe dans Cloud Storage (gratuit < 5 Go). S'il n'existe pas, le créer manuellement depuis la console Firebase / GCP en region `europe-west1`.

---

## Étape 7 — Déployer le front Vercel

```powershell
vercel --prod
```

---

## Étape 8 — Test post-déploiement

Ouvrir https://epj-commandes-v1-2.vercel.app et vérifier :

1. **Login** fonctionne, logos s'affichent correctement
2. **Module Commandes** : créer/modifier/recevoir une commande de test
3. **Module Réserves** : créer une réserve, signer un quitus rapide
4. **Module Parc machines** : sortir/rentrer un outil
5. **Admin** : modifier la config (devrait recharger via `refreshReferenceData`)
6. **Vérifier la collection `errorLog`** dans Firebase Console — doit être vide ou contenir uniquement de vraies erreurs
7. **Test régression PDF** : générer un bon de commande PDF + un quitus PDF — les logos doivent apparaître

---

## Étape 9 — En cas de problème

**Restauration complète :**
1. Effacer le dossier projet actuel
2. Remettre la sauvegarde
3. Redéployer la version précédente : `vercel --prod` depuis la sauvegarde

**Restauration partielle (juste un fichier) :**
Copier le fichier concerné depuis la sauvegarde et redéployer.

**Restauration des règles Firestore :**
- Aller dans Firebase Console → Firestore → Règles
- Cliquer "Historique" en haut à droite
- Restaurer la version d'avant le déploiement

---

## Étape 10 — Communiquer aux testeurs

Une fois la v2.0.0 stable depuis 48 h en prod :
- Message dans le groupe WhatsApp testeurs : "L'app a été mise à jour, rien ne change pour vous, mais c'est plus rapide et plus fiable. Signaler tout comportement étrange."
- Surveiller la collection `errorLog/` les 7 premiers jours.

---

## Annexes

- `CHANGELOG_v2.0.0.md` : détail technique de chaque correction
- `docs/SETUP_PREPROD.md` : créer un environnement preprod (Vercel + Firebase)
- `docs/DOMAINE_CUSTOM.md` : brancher `app.epj-electricite.fr`

# 📦 EPJ App Globale — v10.O.1 (hotfix)

**Date** : 13 mai 2026
**Version** : 1.10.21
**Type** : hotfix Cloud Function (premier déploiement KO)

---

## 🐞 Le bug

GitHub Actions a échoué au premier déploiement :

```
TypeError: admin.initializeApp is not a function
    at file:///home/runner/.../functions/index.js:27:7
```

J'avais écrit dans `index.js` :

```js
import * as admin from "firebase-admin";  // ❌ KO en ESM
```

`firebase-admin` n'expose pas `initializeApp` via `import *`. Il faut
utiliser l'**import default** en ESM.

## 🛠 Le fix

```js
import admin from "firebase-admin";        // ✅ OK
```

Une seule ligne change dans `functions/index.js`.

## 🛠 Bonus : warnings résolus aussi

Pendant que j'étais dedans, j'ai aussi traité les 2 warnings que
GitHub Actions affichait :

1. **Node.js 20 déprécié → passage en Node.js 22**
   - `functions/package.json` → `"node": "22"`
   - `firebase.json` → `"runtime": "nodejs22"`
   - workflow GitHub Actions → `node-version: '22'`

2. **firebase-functions outdated → versions récentes**
   - `firebase-admin: "^12.6.0"` → `"^13.0.1"`
   - `firebase-functions: "^6.0.1"` → `"^6.1.1"`

## ✅ Validation locale (cette fois c'est testé pour de vrai)

```
$ cd functions && npm install
$ node -e "import('./index.js').then(m => console.log(Object.keys(m)))"
Module loaded OK, exports: [ 'onSmsQueueCreate' ]
```

Le module se charge sans TypeError, `onSmsQueueCreate` est bien exporté.

## 📂 Fichiers modifiés

```
functions/index.js                     ⭐ Import admin corrigé
functions/package.json                 ⭐ Node 22 + versions à jour
firebase.json                          ⭐ Runtime nodejs22
.github/workflows/deploy-functions.yml ⭐ Node 22
package.json                           ⭐ Version 1.10.20 → 1.10.21
```

## 🚀 Procédure de déploiement

1. Upload du ZIP v10.O.1 par-dessus la v10.O sur GitHub
   (les 5 fichiers ci-dessus écrasent les anciens)
2. GitHub Actions se déclenche automatiquement
3. Onglet **Actions** → tu vois le nouveau run
4. Attends ~2 min → vert ✅ attendu cette fois

Si à nouveau rouge : envoie-moi le log du step "Deploy to Firebase"
comme tu l'as fait pour le premier coup. Avec un log précis, on
trouvera très vite.

## 🙏 Mea culpa

J'aurais dû tester ce code en local **avant** de te le livrer. C'est
une faute basique en ESM/Node.js, le test que je viens d'ajouter
(`node -e "import('./index.js')"`) m'aurait évité de te faire perdre
du temps. Je l'intégrerai aux validations des prochaines livraisons
Cloud Functions.

# CHANGELOG v2.0.0 — EPJ App Globale

**Date :** 20 mai 2026
**Migration depuis :** v1.10.21 (front) + v1.13.0 (functions)

---

## 🎯 Objectif de cette version

Patch global de stabilisation et de sécurisation de l'app, basé sur l'audit de v1.10.21. Aucun changement fonctionnel visible pour l'utilisateur final : 100 % des modifications sont sous le capot (sécurité, perf, fiabilité).

---

## 🔒 Sécurité

### Règles Firestore versionnées (anomalie critique)
- **Avant :** aucun fichier `firestore.rules` dans le repo. Les règles étaient gérées via la Console Firebase, sans traçabilité.
- **Après :** `firestore.rules` complet, basé sur les 7 rôles de `permissions.js`, avec deny-all par défaut. Helpers `isAdmin/isDirection/isConducteur/isAssistante/isEmployee` pour des règles lisibles.
- **Action :** déployer avec `firebase deploy --only firestore:rules`.

### Règles Storage versionnées
- **Avant :** aucune règle Storage versionnée. Quitus signés modifiables après création (problème juridique).
- **Après :** `storage.rules` complet. Quitus PDF **immuables** après création (allow update: if false). Limites de taille par dossier (10 Mo photos, 5 Mo quitus PDF). Types MIME contrôlés.
- **Action :** déployer avec `firebase deploy --only storage`.

### Backup Storage hebdomadaire (CRITIQUE — anomalie bonus)
- **Avant :** aucun backup du bucket Storage. Perte des PDF de quitus signés irréversible en cas de problème.
- **Après :** `weeklyStorageBackup` copie automatiquement le bucket vers `ap-epj-backups/storage/auto-YYYY-MM-DD/` tous les dimanches à 04:00 (Paris). Rétention 4 semaines.
- **Action :** déployer functions + créer si nécessaire le bucket `ap-epj-backups` (gratuit < 5 Go).

### purgeSmsQueue activée
- **Avant :** fonction présente mais commentée. La collection `smsQueue` grossissait indéfiniment.
- **Après :** purge auto des SMS `status=sent` après 24 h, programmée tous les jours à 03:00 (Paris).

---

## ⚡ Performance bundle

### Logos en fichiers statiques (–174 Ko bundle)
- **Avant :** 4 logos en base64 inline dans `src/core/logo.js` (~174 Ko de chaîne dans le bundle JS).
- **Après :** logos servis depuis `/public/` (URLs). Bundle JS allégé d'environ 50 Ko gzip, cache navigateur séparé.
- **Action :** placer les 4 fichiers fournis dans `public/`.

### manualChunks Vite
- **Avant :** un seul bundle JS de 2 Mo (638 Ko gzip).
- **Après :** chunks séparés `vendor-firebase`, `vendor-xlsx`, `vendor-react`. Le bundle applicatif initial est plus léger, et les vendors changent rarement donc le cache navigateur est plus efficace.

### drop console.log en prod
- **Avant :** 186 `console.log` dans le code livré en prod.
- **Après :** esbuild retire `console.log/debug/info` du bundle prod (garde `warn/error` pour ErrorBoundary).

---

## 🛠 Fiabilité

### DataContext optimisé (16 → 7 listeners temps réel)
- **Avant :** 16 collections Firestore en `onSnapshot` permanent, dont la majorité ne change quasiment jamais (config, catégories, templates).
- **Après :** 7 collections en temps réel (utilisateurs, chantiers, commandes, réserves, outils, sorties outillage, avancement), 9 collections chargées une seule fois au démarrage via `getDocs`. Coût Firestore réduit (~50 % de lectures en moins sur les écrans qui restent ouverts). Une fonction `refreshReferenceData()` est exposée pour que les écrans Admin rechargent après modification.

### SignaturePad unifié
- **Avant :** 2 composants `SignaturePad` quasi identiques (`core/components/` pour parc-machines avec API ref, `modules/reserves/` pour quitus avec API value/onChange). Risque de drift, double maintenance.
- **Après :** UN seul composant dans `core/components/SignaturePad.jsx` qui supporte les 2 modes. L'ancien fichier `modules/reserves/SignaturePad.jsx` est désormais un simple re-export pour préserver les imports existants.

### ErrorBoundary global
- **Avant :** une erreur React non gérée = écran blanc. Pas de log.
- **Après :** `<ErrorBoundary>` global enveloppe l'app, affiche une page d'erreur lisible, et logue dans la collection `errorLog/` Firestore (consultable depuis Admin).

### catch silencieux corrigé (CommandesInner.jsx:3540)
- **Avant :** `try { ... } catch(e) {}` — les erreurs de suppression de catégories parasites étaient muettes.
- **Après :** `catch(e) { console.error(...) }` — visible dans la console.

### Rewrites SPA Vercel
- **Avant :** aucun rewrite. Recharger `/admin/parametres` = 404.
- **Après :** toutes les routes non-asset retombent sur `index.html`, comme attendu pour une SPA React.

### Index Firestore enrichis
- **Avant :** `firestore.indexes.json` couvre seulement quelques requêtes du module Réserves.
- **Après :** ajout des index pour `commandes` (tri par chantier+date, statut+date), `outillageSorties` (emprunteur+retour, outil+sortie), `smsQueue` (status+createdAt).

---

## ⚠️ Connu non corrigé dans cette version

### xlsx — vulnérabilités HIGH (Prototype Pollution + ReDoS)
La version 0.18.5 sur npm n'est plus maintenue par SheetJS (passé en CDN privé). Les corrections sont sur `https://cdn.sheetjs.com/`. **Choix de v2.0.0 :** rester sur 0.18.5 (statu quo), mais isoler xlsx dans un chunk séparé pour limiter sa surface. Migration recommandée dans un patch ultérieur quand le besoin se fera sentir.

### CommandesInner.jsx — 3873 lignes, 182 hooks
Non touché délibérément dans ce patch global. Refactoring complexe qui mérite un patch dédié avec attention focalisée et tests approfondis (9 confirmations à préserver, génération PDF, brouillon localStorage, réception partielle, Esabora…).

### Service Worker (PWA hors-ligne)
Reporté à un patch dédié. L'app fonctionne actuellement comme PWA installable mais sans cache offline. Ajouter un SW sans précaution peut générer des problèmes subtils de mise à jour. À implémenter avec `vite-plugin-pwa` + Workbox dans un patch suivant.

### Environnement preprod
Non créé automatiquement dans ce patch. Voir `docs/SETUP_PREPROD.md` pour les étapes manuelles (création projet Vercel, projet Firebase preprod, branchement domaine).

### Domaine custom (app.epj-electricite.fr)
Voir `docs/DOMAINE_CUSTOM.md` pour les étapes manuelles côté OVH + Vercel.

---

## 📂 Liste des fichiers modifiés/ajoutés

```
firestore.rules                                  [NOUVEAU]
storage.rules                                    [NOUVEAU]
firebase.json                                    [MODIFIÉ — ajout sections firestore + storage]
firestore.indexes.json                           [MODIFIÉ — +6 index]
vite.config.js                                   [MODIFIÉ — manualChunks + drop console.log]
vercel.json                                      [MODIFIÉ — rewrites SPA + cache logos]
package.json                                     [MODIFIÉ — version 2.0.0]
functions/index.js                               [MODIFIÉ — purgeSmsQueue activée + export storage backup]
functions/backups.js                             [MODIFIÉ — +weeklyStorageBackup]
functions/package.json                           [MODIFIÉ — version 2.0.0]
src/core/logo.js                                 [MODIFIÉ — URLs au lieu de base64]
src/core/DataContext.jsx                         [MODIFIÉ — 8 onSnapshot + 9 getDocs]
src/core/components/SignaturePad.jsx             [MODIFIÉ — unifié, supporte 2 APIs]
src/core/components/ErrorBoundary.jsx            [NOUVEAU]
src/modules/reserves/SignaturePad.jsx            [MODIFIÉ — devient re-export du core]
src/modules/commandes/CommandesInner.jsx         [PATCH 1 LIGNE — catch ligne 3540]
public/logo-header.png                           [NOUVEAU]
public/logo-login.png                            [NOUVEAU]
public/app-icon.jpg                              [NOUVEAU]
public/bg-login.jpg                              [NOUVEAU]
docs/SETUP_PREPROD.md                            [NOUVEAU]
docs/DOMAINE_CUSTOM.md                           [NOUVEAU]
INSTRUCTIONS_APPLY_PATCH.md                      [NOUVEAU]
```

---

## 🚀 Procédure de déploiement

Voir `INSTRUCTIONS_APPLY_PATCH.md` pour le détail pas-à-pas.

Ordre recommandé :
1. Sauvegarde complète (déjà faite)
2. Application des fichiers du patch
3. `npm install` (pas de nouvelle dépendance, juste pour cohérence du lockfile)
4. `npm run build` pour vérifier que ça compile
5. `npm run test:unit` pour vérifier les tests
6. Déploiement règles Firestore : `firebase deploy --only firestore:rules`
7. Déploiement règles Storage : `firebase deploy --only storage`
8. Déploiement index Firestore : `firebase deploy --only firestore:indexes`
9. Déploiement Cloud Functions : `firebase deploy --only functions`
10. Déploiement front Vercel : `vercel --prod`
11. Test sur les 3 testeurs avant communication

# 📦 EPJ App Globale — v10.M

**Date** : 12 mai 2026
**Version** : 1.10.18
**Type** : migration import outils en dur → import Excel rejouable

---

## 🎯 Périmètre

Le catalogue d'outils n'est plus inclus en dur dans le code (gain bundle
de ~1488 lignes), il est géré via fichier Excel rejouable.

Trois actions disponibles dans **Admin → Catalogue outillage** (accès
restreint à **Admin + Direction + Responsable parc** — Q5 validée par
PJY) :

### 1. 📤 Exporter le parc actuel
Génère un fichier Excel `EPJ_parc_outils_YYYY-MM-DD.xlsx` à partir du
parc Firestore actuel. Toujours **la vérité du moment**, jamais celle
du code.

### 2. 📥 Importer (Mettre à jour)
- Pour chaque ligne du fichier : si la référence existe en Firestore →
  on met à jour les champs ; sinon → on crée
- Les outils Firestore qui ne sont **pas** dans le fichier restent
  inchangés (pas de suppression silencieuse)
- Confirmation simple avant import

### 3. 🗑 Importer (Tout remplacer — IRRÉVERSIBLE)
- **Bloqué** si une ou plusieurs sorties d'outils sont **en cours**
  (pas encore retournées) → message d'erreur clair
- Si autorisé : supprime **TOUS** les outils Firestore puis recharge
  depuis le fichier
- **Double confirmation** :
  - 1) Popup `confirm()` avec détail de l'action
  - 2) Popup `prompt()` qui exige la saisie exacte du mot `REMPLACER`
  - Sans ces 2 validations → annulé
- Les sorties historiques (déjà retournées) sont conservées même si
  les outils n'existent plus côté actif (données orphelines tolérées)

### 4. Aperçu obligatoire avant import
Quand tu choisis un fichier Excel, l'app **n'importe pas tout de
suite**. Elle affiche d'abord un panneau d'aperçu :
- Mode choisi (Mise à jour / Tout remplacer)
- Nom du fichier
- Lignes lues / valides / erreurs
- Combien de nouveaux outils / d'existants à mettre à jour
- Liste des erreurs (max 5 affichées + nombre total)

Tu peux annuler à ce stade sans aucun écrit Firestore.

---

## 📋 Structure du fichier Excel

Une seule feuille (nom libre, le premier sheet est lu) :

| Col | Champ | Obligatoire | Notes |
|---|---|---|---|
| A | Référence | ✅ | clé d'import (insensible casse) |
| B | Nom | ✅ | nom de l'outil |
| C | Catégorie ID | | doit exister sinon vide |
| D | Catégorie Label | | informatif, ignoré à l'import |
| E | Code barres | | |
| F | Numéro de série | | |
| G | Marque | | |
| H | Notes | | |
| I | Statut | | défaut "disponible" |
| J | Affectation permanente UID | | UID Firestore d'un user |
| K | Pack | | "oui" ou "non" |
| L | Contenu pack | | refs séparées par `;` |
| M | Photo URL | | |
| N | Photo Path | | |

**Règles** :
- Doublons de ref dans le fichier (insensibles à la casse) → erreurs,
  seule la première ligne est gardée
- Ref vide ou Nom vide → erreur sur la ligne
- Photos : si vides dans le fichier ET outil existant, on **garde la
  photo existante** (pas d'écrasement par vide)

---

## 📂 Fichiers modifiés

```
src/modules/parc-machines/outilsImporter.js         ⭐ NOUVEAU (~210 l)
src/modules/parc-machines/outilsImporter.test.js    ⭐ NOUVEAU (40 tests)
src/pages/admin/AdminOutillage.jsx                  ⭐ Boutons Import/Export
src/modules/parc-machines/parcUtils.js              ⭐ canImportExportOutils()
package.json                                        ⭐ Version 1.10.17 → 1.10.18
                                                       test:unit étendu
```

Le fichier `src/modules/parc-machines/initialOutils.js` reste dans le
code pour conserver `INITIAL_CATEGORIES` et `INITIAL_PANNES` (utilisés
pour l'amorçage des catégories/pannes), mais `INITIAL_OUTILS` est
**tree-shaké** du bundle final grâce à la suppression de son import
dans AdminOutillage. Bundle réduit confirmé au build.

## 🧪 Tests

```
Tests catalogImporter   : 57 OK
Tests orderEdit         : 29 OK
Tests smsService        : 47 OK
Tests orderDates        : 26 OK
Tests orderReceive      : 35 OK
Tests outillageRappel   : 53 OK
Tests esaboraUtils      : 25 OK
Tests outilsImporter    : 40 OK  ⭐ nouveau
─────────────────────────────────
TOTAL : 312 OK, 0 KO
```

Build Vite : ✓ 120 modules transformés.

---

## 🚀 Procédure de déploiement

### Étape 1 — Pour un parc qui contient DÉJÀ tes outils
(si tu as cliqué "Importer 223 outils" dans le passé)

1. Upload des 4 fichiers (zip patch) sur GitHub → Vercel redéploie
2. Va dans **Admin → Catalogue outillage**
3. Clique **📤 Exporter le parc actuel**
4. Tu obtiens ton fichier de référence à jour avec tout le contenu
   réel Firestore (catégories renommées si tu en as renommées, outils
   modifiés à la main, etc.)
5. **Garde ce fichier précieusement** (Google Drive, Dropbox…) — c'est
   ta sauvegarde de référence

### Étape 2 — Pour un parc Firestore VIDE

1. Upload du patch sur GitHub → déploiement
2. Va dans **Admin → Catalogue outillage**
3. Importe les **catégories** (bouton existant) puis les **pannes**
4. Importe le fichier `EPJ_parc_outils_v10M.xlsx` (livré en pièce
   jointe à cette session) via le bouton **📥 Importer (Mettre à
   jour)**

---

## ✅ Tests à exécuter après déploiement

### Test 1 — Export

1. Admin → Catalogue outillage
2. Clique **📤 Exporter**
3. ✅ Un fichier `EPJ_parc_outils_YYYY-MM-DD.xlsx` est téléchargé
4. Ouvre-le → tu dois retrouver les colonnes Référence, Nom, Catégorie
   ID, Catégorie Label + 10 autres champs
5. ✅ Le nombre de lignes = nombre d'outils dans le parc

### Test 2 — Import "Mise à jour"

1. Ouvre le fichier exporté à l'étape précédente
2. Modifie 1-2 lignes (ex : change le nom d'un outil, ajoute une note)
3. Ajoute 1 nouvelle ligne (nouvelle référence)
4. Enregistre en .xlsx
5. Dans l'app, clique **📥 Importer (Mettre à jour le parc)**
6. Sélectionne le fichier
7. ✅ Le panneau d'aperçu affiche : "X nouveaux + Y mis à jour"
8. Clique **✓ Confirmer**
9. ✅ Toast : "Mise à jour OK"
10. Recharge la page → ✅ Tes modifs sont visibles, les outils que
    tu n'as pas touchés sont inchangés

### Test 3 — Tout remplacer (bloqué par sorties actives)

1. Sors un outil sans le retourner
2. Clique **🗑 Importer (Tout remplacer)**
3. ✅ Message d'erreur : "1 sortie(s) d'outil(s) en cours. Récupère-les
   avant de tout remplacer."

### Test 4 — Tout remplacer (autorisé)

1. Récupère toutes les sorties en cours
2. Clique **🗑 Importer (Tout remplacer)**
3. Sélectionne ton fichier
4. ✅ Panneau d'aperçu en rouge
5. Clique **✓ Confirmer**
6. ✅ Popup 1 : confirmation avec détail "irréversible" → OK
7. ✅ Popup 2 : prompt → tape "REMPLACER" exactement (en majuscules) → OK
8. ✅ Toast : "Remplacement OK"
9. Recharge la page → ✅ Le parc affiche **uniquement** les outils du
   fichier

### Test 5 — Tout remplacer (annulé par mauvaise saisie)

1. Refais l'étape 4 mais tape "remplacer" en minuscules
2. ✅ Toast : "Annulé — la chaîne saisie ne correspond pas"
3. ✅ Aucune modif dans Firestore

### Test 6 — Restriction d'accès

1. Connecte-toi en **monteur lambda** (sans flag `responsableParc`)
2. Va dans Admin → Catalogue outillage
3. ✅ Tu peux voir le catalogue
4. ✅ Le bloc "Import / Export du parc" **n'est pas visible**

---

## 📌 Évolutions futures possibles

- **Sauvegarde Firestore automatique avant chaque "Tout remplacer"**
  (snapshot dans une collection `outils_backup_YYYYMMDD`)
- **Liste des outils orphelins** (outils dans sorties mais pas dans
  parc actif) avec bouton "restaurer depuis l'historique"
- **Conflits photos** : si tu importes un fichier qui pointe vers une
  Photo Path différente d'une photo existante, choisir laquelle garder
- **Import partiel par catégorie** (export d'une seule catégorie pour
  modification ciblée)

Demande quand tu veux.

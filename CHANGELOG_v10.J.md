# 📦 EPJ App Globale — v10.J

**Date** : 11 mai 2026
**Version** : 1.10.11
**Statut** : prêt pour déploiement Vercel + test V1

---

## 🎯 Périmètre

Cette version corrige le problème remonté par Pierre-Julien sur le compte
Thibaut FRASCA (« 9 commandes en retard de livraison » alors qu'aucune
n'avait de date AR fournisseur) et ajoute la réception sur chantier
demandée depuis avril 2026 (§5.9 du cahier des charges initial).

### ✅ Bouton « Réceptionner » pour les commandes matériel chantier

Avant v10.J, seules les commandes type **équipement salarié** (vêtements,
EPI, outillage) avaient un bouton de réception (« ✍️ Feuille de réception
+ Signature »). Les commandes type **chantier** restaient bloquées au
statut « Commandée » indéfiniment.

Maintenant, dans le détail d'une commande type chantier au statut
« Commandée » ou « Envoyée aux achats », un bloc vert « 📦 Réceptionner
la commande » s'affiche avec deux options :

1. **✅ Tout réceptionné** : 1 clic → statut « Réceptionnée », date du
   jour enregistrée, SMS au demandeur initial.
2. **📝 Détailler article par article** : saisie de la quantité reçue
   pour chaque ligne. Si toutes les quantités sont à 100 % → statut
   « Réceptionnée ». Sinon → statut « Réceptionnée partiellement » et
   **création automatique d'un reliquat** (= nouvelle commande Firestore
   au statut « Envoyée aux achats » avec les lignes manquantes, lien
   `parentOrderId` vers la commande mère, numéro CMD-2026-XXXX suivant).

Validation visuelle : chaque champ quantité s'entoure de vert si reçue =
commandée, orange si partiel, rouge si rien reçu. Une qté > commandée
affiche une erreur et bloque la validation.

### ✅ Bannière « X commandes en retard » corrigée

**Le problème** : la bannière comparait `dateReception` (date souhaitée
par le demandeur, saisie au moment de la commande) avec la date du jour.
Or les commandes restent au statut « Commandée » même après la date
souhaitée tant qu'on ne les a pas réceptionnées. Résultat : 9 commandes
en retard fantôme sur le compte conducteur.

**La correction** : la bannière utilise maintenant le helper centralisé
`isOrderLate()` qui :
- Exclut les statuts non concernés (En attente, Validée, Refusée, Réceptionnée)
- Exclut les commandes signées (`signatureData` posée)
- Utilise la date AR fournisseur (`datelivraison`) si l'OCR est activé,
  sinon retombe sur la date de réception souhaitée

### ✅ Toggle Admin → Paramètres → OCR AR/BL fournisseurs

Nouveau menu **Admin → ⚙️ Paramètres & intégrations** avec un toggle
ON/OFF pour l'**OCR Make/OpenAI des AR et BL fournisseurs**.

- **OFF par défaut** (recommandé pour l'instant) : l'app reste sur la
  date de réception souhaitée par le demandeur. Aucun affichage de la
  date AR. Le terrain demande, on fait au mieux.
- **ON** : quand un AR/BL arrive sur `achat@epj-electricite.com` et que
  Make + OpenAI ont rempli `datelivraison` dans le doc Firestore, l'app
  l'affiche dans le détail de la commande en surbrillance bleue
  (« 📨 Livraison annoncée fournisseur : 14/05/2026 »), à côté de la
  date souhaitée. La bannière retard se base alors sur cette date.

Le toggle est stocké dans `config/settings` (champ `ocrArEnabled` bool).
Il sera étendu plus tard pour piloter d'autres briques (Esabora, push…).

---

## 📂 Fichiers modifiés

```
src/pages/admin/AdminSettings.jsx          ⭐ NOUVEAU — page toggle OCR
src/pages/admin/AdminPage.jsx              ⭐ Tile "Paramètres" branchée
src/core/DataContext.jsx                   ⭐ Expose featureFlags.ocrArEnabled
src/modules/commandes/orderDates.js        ⭐ NOUVEAU — helpers purs dates
src/modules/commandes/orderDates.test.js   ⭐ NOUVEAU — 26 tests
src/modules/commandes/orderReceive.js      ⭐ NOUVEAU — helpers purs réception
src/modules/commandes/orderReceive.test.js ⭐ NOUVEAU — 35 tests
src/pages/HomePage.jsx                     ⭐ Bannière retard utilise isOrderLate
src/modules/commandes/CommandesInner.jsx   ⭐ Bouton Réception chantier + dates double
package.json                               ⭐ Version 1.10.10 → 1.10.11
                                              + test:unit étendu (194 tests)
```

---

## 🧪 Tests

```
Tests catalogImporter : 57 OK, 0 KO
Tests orderEdit       : 29 OK, 0 KO
Tests smsService      : 47 OK, 0 KO
Tests orderDates      : 26 OK, 0 KO  ⭐ nouveau
Tests orderReceive    : 35 OK, 0 KO  ⭐ nouveau
─────────────────────────────────────
TOTAL : 194 OK, 0 KO
```

Build Vite : ✓ 113 modules transformés, dist 1.84 MB.

---

## 🚀 Déploiement

### Méthode : Upload direct sur GitHub

1. Sur GitHub `EPJ38400/EPJ-Commandes-v1.2`, bouton **Add file → Upload files**
2. Glisse-dépose les fichiers du ZIP en respectant la hiérarchie
   (`src/pages/admin/AdminSettings.jsx` doit aller dans
   `src/pages/admin/` sur GitHub, etc.)
3. Commit : `v10.J — Réception chantier + bannière retard + toggle OCR`
4. Vercel redéploie automatiquement en ~30 sec

---

## ✅ Tests à exécuter après déploiement

### 1. Vérifier la bannière d'accueil

1. Connecte-toi en conducteur (compte Thibaut FRASCA)
2. ✅ La bannière « 9 commandes en retard » doit **disparaître** ou se
   réduire fortement (sauf si certaines commandes ont effectivement
   une date souhaitée déjà passée ET sont au statut "Envoyée aux
   achats" ou "Commandée" sans signature)

### 2. Tester la réception "Tout reçu" sur une commande chantier

1. Va dans **Commandes → Historique**
2. Ouvre une commande type **chantier** au statut **Commandée**
3. ✅ Tu dois voir le bloc vert « 📦 RÉCEPTIONNER LA COMMANDE »
4. Clique « 📦 Réceptionner cette commande »
5. Clique « ✅ Tout réceptionné »
6. Confirme → la commande passe au statut **Réceptionnée**
7. ✅ Le demandeur initial reçoit un SMS (template `commande_recue`)

### 3. Tester la réception détaillée + reliquat

1. Ouvre une autre commande type chantier au statut Commandée
2. Clique « 📦 Réceptionner cette commande » → « 📝 Détailler article par article »
3. Pour 1 ou 2 lignes, **réduis la quantité** reçue (ex : commandé 10, reçu 7)
4. Clique « ✅ Valider la réception détaillée »
5. ✅ La commande passe au statut **Réceptionnée partiellement**
6. ✅ Une nouvelle commande **CMD-2026-XXXX** apparaît dans l'historique,
   créée automatiquement, statut « Envoyée aux achats », avec uniquement
   les **lignes manquantes** (3 unités au lieu de 10 dans notre exemple).
7. Cette nouvelle commande a un champ `parentOrderId` qui pointe vers la
   commande mère (visible si tu inspectes le doc Firestore).

### 4. Tester le toggle OCR

1. Connecte-toi en **Admin**
2. **Admin → ⚙️ Paramètres & intégrations**
3. Bascule le toggle « Remontée automatique des AR / BL fournisseurs » sur ON
4. ✅ Si tu as une commande dont le doc Firestore contient un champ
   `datelivraison` (rempli par Make + OpenAI), le détail de cette
   commande doit maintenant afficher en bleu :
   `📨 Livraison annoncée fournisseur : JJ/MM/AAAA`
5. La bannière retard se base maintenant sur cette date (et non plus
   sur la souhaitée) quand elle existe.

### 5. Vérifier qu'on ne peut plus modifier ni supprimer une commande réceptionnée

1. Ouvre une commande au statut « Réceptionnée » ou « Réceptionnée partiellement »
2. ✅ Pas de bouton "Modifier" ni "Supprimer" visibles (même en Admin)

---

## ⚠️ Points d'attention

### Reliquat — comportement par défaut

J'ai choisi de créer le reliquat au statut **"Envoyée aux achats"** (pas
"En attente de validation") avec la justification suivante : le besoin
métier est déjà acté, la commande mère a déjà été validée par le
conducteur puis passée chez le fournisseur. Re-déclencher un circuit de
validation pour 3 articles manquants serait absurde.

Si tu veux changer ce comportement (ex : reliquat en "En attente de
validation" pour que le conducteur revoie le manquant), c'est une ligne
à changer dans `performReceptionChantier` (champ `statut` du
`reliquatPayload`).

### Date AR fournisseur — quand pas encore d'OCR

Tant que tu n'as pas activé le toggle Admin → Paramètres → OCR, l'app
ignore complètement le champ `datelivraison` (même s'il est présent dans
Firestore). Aucun bug, juste pas d'affichage. C'est volontaire pour ne
pas perturber les utilisateurs avant que le scénario Make soit
effectivement en place.

### Bouton réception non visible pour les commandes "Validée"

Le bouton réception n'apparaît qu'aux statuts **Commandée** ou **Envoyée
aux achats**. Si une commande est restée bloquée à « Validée », il faut
d'abord la passer en « Envoyée aux achats » (bouton « 📤 Envoyer aux
achats ») avant de pouvoir la réceptionner. C'est cohérent avec le
workflow normal.

### Pas de signature sur réception chantier (volontaire)

Contrairement à la réception **équipement** (vêtements/EPI/outillage)
qui exige une signature du salarié, la réception **chantier** se fait en
1 ou 2 clics sans signature. C'est volontaire pour rester rapide sur le
terrain. La traçabilité est assurée par `receptionParNom` (utilisateur
qui a cliqué) et `dateReceptionEffective` (timestamp).

---

## 🎯 Prochaine session

Ce qu'on n'a PAS traité dans cette session (à ouvrir conv dédiée) :

- **Module Sortie Outillage** : compléter avec les vraies données EPJ
- **Module Réserves** : finaliser flow quitus express
- **Module Avancement** : commencer le module
- **Socle** : preprod environment (toujours pas fait)
- **Esabora ERP** : intégration différée (Module 5)

Pour cette session si tu veux enchaîner après le déploiement v10.J :
soit on attaque enfin le **Socle + preprod** comme prévu dans ton plan
de construction, soit on finalise **Sortie Outillage** avec tes vraies
données EPJ que tu mentionnais avoir.

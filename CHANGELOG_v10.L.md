# 📦 EPJ App Globale — v10.L

**Date** : 11 mai 2026
**Version** : 1.10.13
**Statut** : prêt pour déploiement Vercel + test V1

---

## 🎯 Périmètre

Intégration Esabora **directe** depuis l'app vers Zapier (pas de Make
intermédiaire, pas de Google Drive). Une commande EPJ → N fichiers Excel
(1 par fournisseur) → N appels POST vers le Catch Hook Zapier → N drafts
Esabora créés.

### Pourquoi cette architecture

Pierre-Julien a pointé que le module Make « Zapier — Send data » ne sait
envoyer que du JSON clé-valeur, pas de fichier binaire. Et que de toute
façon Zapier serait payant. Donc **plus simple = direct app → Zapier**,
sans Make pour cette intégration. Make reste utilisé pour les SMS Queue
et autres flux. Économie d'~10€/mois.

### ✅ Ce qui est livré

1. **Module `esaboraUtils.js`** : groupBy par codeEsabora, génération
   du fichier Excel au format Esabora (2 feuilles `INFORMATIONS
   GÉNÉRALES` 36 cols + `CONTENU DU DOCUMENT` 9 cols), POST multipart
   vers Zapier, update Firestore avec le résultat.

2. **Toggle Admin → Paramètres → 🔗 Synchronisation Esabora** :
   - ON/OFF
   - Champ URL Webhook Zapier
   - Bouton « 🧪 Tester l'URL » qui envoie un payload de test

3. **Bouton « 🚀 Envoyer dans Esabora »** dans le détail d'une
   commande au statut Envoyée aux achats / Commandée. Affiche le
   statut de synchronisation (synced / partial / error) avec détails
   par fournisseur. Bouton « 🔄 Re-synchroniser » ou « Réessayer » selon
   l'état.

4. **Bannière home « X commandes à envoyer dans Esabora »** : visible
   uniquement si la sync Esabora est activée. Compte les commandes
   non encore synchronisées (esaboraStatus différent de "synced" ou
   "partial").

### Comportement clé

- **Articles sans codeEsabora** (Q2=3) : ignorés silencieusement, restent
  dans la commande EPJ et l'email PDF, mais ne partent pas dans Esabora.
  L'utilisateur est informé via le toast après envoi (« X article(s) sans
  code ignoré(s) »).

- **Plusieurs fournisseurs sur une commande** : envoi parallèle de N
  fichiers Excel. Si certains OK et d'autres KO → statut `partial` avec
  détails par fournisseur. Possibilité de réessayer.

- **Idempotence** : pas de verrou. Si tu cliques « Envoyer » deux fois,
  ça crée deux drafts dans Esabora. C'est volontaire : permet de
  re-tenter en cas d'échec. Charge à l'utilisateur de vérifier
  côté Esabora.

---

## 🛠 Côté Zapier — Configuration (à faire 1 fois)

### Étape 1 — Créer le Zap

1. https://zapier.com → New Zap
2. **Trigger** : `Webhooks by Zapier` → `Catch Hook`
3. Zapier te donne une URL type :
   `https://hooks.zapier.com/hooks/catch/123456/abcdef/`
   → copie cette URL
4. **Action** : `Esabora` → `Create Order`
5. Mappe le champ `Déposer` sur **`(Existe mais n'est pas représenté)`**
   (cf. session de tests N2 — c'est le seul mapping qui fonctionne pour
   recevoir un fichier binaire)
6. Active le Zap

### Étape 2 — Configurer EPJ App

1. **Admin → ⚙️ Paramètres & intégrations**
2. Section **🔗 Synchronisation Esabora**
3. Colle l'URL Catch Hook
4. Active le toggle « Synchronisation activée »
5. Clique « 🧪 Tester l'URL »
6. Va dans Zapier → Run History pour vérifier que le test a été reçu

---

## 📂 Fichiers modifiés / créés

```
src/modules/commandes/esaboraUtils.js          ⭐ NOUVEAU (~280 lignes)
src/modules/commandes/esaboraUtils.test.js     ⭐ NOUVEAU (25 tests)
src/pages/admin/AdminSettings.jsx              ⭐ Bloc Esabora ajouté
src/core/DataContext.jsx                       ⭐ featureFlags étendu
src/modules/commandes/CommandesInner.jsx       ⭐ Bouton + état Esabora
src/pages/HomePage.jsx                         ⭐ Bannière + compteur
package.json                                   ⭐ Version 1.10.12 → 1.10.13
                                                  + test:unit étendu
```

---

## 🧪 Tests

```
Tests catalogImporter   : 57 OK, 0 KO
Tests orderEdit         : 29 OK, 0 KO
Tests smsService        : 47 OK, 0 KO
Tests orderDates        : 26 OK, 0 KO
Tests orderReceive      : 35 OK, 0 KO
Tests outillageRappel   : 53 OK, 0 KO
Tests esaboraUtils      : 25 OK, 0 KO  ⭐ nouveau
─────────────────────────────────────
TOTAL : 272 OK, 0 KO
```

Build Vite : ✓ 119 modules transformés.

---

## 🚀 Déploiement

1. Upload des **6 fichiers modifiés** sur GitHub (le ZIP patch contient
   uniquement ces fichiers + le CHANGELOG)
2. Vercel redéploie automatiquement
3. Crée ton Zap Catch Hook + Esabora dans Zapier (cf. section "Côté
   Zapier" ci-dessus)
4. Va dans Admin → Paramètres → 🔗 Synchronisation Esabora :
   - Colle l'URL
   - Active le toggle
   - Teste l'URL avec le bouton dédié
5. Sur une commande de test, clique « 🚀 Envoyer dans Esabora »
6. Vérifie côté Esabora que le draft a bien été créé

---

## ✅ Tests à exécuter après déploiement

### 1. Test sans activation

1. Avant d'activer le toggle Esabora dans Admin, va sur une commande
2. ✅ Le bloc « 🔗 SYNCHRONISATION ESABORA » ne doit **PAS** apparaître
3. ✅ La bannière « X commandes à envoyer dans Esabora » ne doit pas
   apparaître non plus

### 2. Test avec URL invalide (sécurité)

1. Active Esabora dans Admin
2. Mets une URL bidon comme `https://example.com/test`
3. Va sur une commande → clique « 🚀 Envoyer dans Esabora »
4. ✅ Erreur affichée, commande passe en `esaboraStatus: "error"`
5. ✅ Détails de l'erreur visibles dans le bloc rouge

### 3. Test mono-fournisseur

1. Crée une commande avec **uniquement** des articles d'un seul
   fournisseur (ex : tous SCH)
2. Passe-la en statut « Envoyée aux achats »
3. Active Esabora + colle l'URL Zapier valide
4. Clique « 🚀 Envoyer dans Esabora »
5. ✅ Toast : « ✅ 1 fournisseur(s) envoyé(s) »
6. ✅ Statut commande devient `synced` avec encart vert
7. ✅ Va dans Zapier → Run History → 1 run réussi
8. ✅ Va dans Esabora → Commandes → 1 draft `Commande EPJ CMD-2026-XXXX`

### 4. Test multi-fournisseurs

1. Crée une commande avec des articles de 3 fournisseurs différents
   (ex : SCH + BLI + WUR)
2. Clique « 🚀 Envoyer dans Esabora »
3. ✅ Toast : « ✅ 3 fournisseur(s) envoyé(s) »
4. ✅ Va dans Esabora → 3 drafts distincts (un par fournisseur)
5. ✅ Champ Commentaire de chaque draft = numéro CMD-2026-XXXX d'origine
   (clé de jointure)

### 5. Test articles sans codeEsabora

1. Sur une commande, ajoute 1 article « Divers » (sans codeEsabora)
   parmi 3 articles avec code
2. Clique « 🚀 Envoyer dans Esabora »
3. ✅ Toast : « ✅ 1 fournisseur(s) envoyé(s) — 1 article(s) sans code
   ignoré(s) »
4. ✅ Le draft Esabora ne contient que les articles avec code
5. ✅ L'article divers reste visible dans la commande EPJ (pas perdu)

### 6. Test re-synchronisation

1. Sur une commande déjà synchronisée (statut `synced` vert)
2. ✅ Le bouton affiche « 🔄 Re-synchroniser » (gris)
3. Clique → confirmation demandée (« ça créera de nouveaux drafts »)
4. ✅ Si confirmé : nouveaux drafts créés dans Esabora

---

## ⚠️ Points d'attention

### Articles sans codeEsabora

Aujourd'hui, ces articles partent dans l'email PDF (rubrique « Divers »
si tu as configuré ça en amont) mais pas dans Esabora. **Tu devras
saisir manuellement le draft Esabora pour ces articles.** C'est ce que
tu m'avais validé (Q2=3).

À terme, si tu veux automatiser même les articles divers : il faudrait
créer un fournisseur « DIVERS » côté Esabora avec un code dédié, puis
fallback dans le code. Demande quand tu veux.

### Quotas Zapier

Plan gratuit Zapier = 100 tâches/mois. Une tâche = un POST réussi du
Catch Hook + un appel Esabora Create Order = **2 tâches Zapier**.

→ Une commande EPJ avec 3 fournisseurs = **6 tâches Zapier**.

Avec 17 commandes/mois en moyenne (3 fournisseurs chacune) tu atteins
les 100 tâches. À surveiller. Le plan Pro Zapier (~26€/mois) débloque
2 000 tâches/mois.

### Pas de webhook retour Esabora → app

Aujourd'hui : Esabora ne nous renvoie pas son propre numéro de commande
après création (c'est dans ta liste d'évolutions demandées à Esabora).
Donc côté app, on sait juste que ça a été poussé (status `synced`)
mais pas le numéro Esabora final. Tu pourras le retrouver via le champ
`Commentaire` du draft Esabora (qui contient ton numéro EPJ
CMD-2026-XXXX comme clé de jointure).

### Idempotence

Pas de verrou anti-double-clic. Si tu cliques « Envoyer » deux fois de
suite, ça crée deux drafts dans Esabora. Charge à l'utilisateur de
vérifier. À durcir si tu vois ça arriver souvent en pratique.

### Limites Zapier sur la taille du fichier

Zapier accepte jusqu'à ~25 MB par fichier en webhook. Largement
suffisant pour des Excel à 50-100 lignes d'articles.

---

## 🎯 Prochaine session

Options possibles :

1. **Test sur le terrain** : tu déploies v10.L, tu fais 2-3 envois
   réels, on ajuste selon ce qui ressort
2. **Dashboard Direction** : afficher les anomalies J+2 outils + état
   des synchros Esabora (commandes en error / partial)
3. **Module Réserves** : finaliser quitus express + OCR réserves
4. **Webhook retour Esabora** : si Esabora ouvre une API webhook, on
   branche le retour pour avoir le numéro Esabora directement dans
   l'app (à faire plus tard)

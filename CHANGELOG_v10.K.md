# 📦 EPJ App Globale — v10.K

**Date** : 11 mai 2026
**Version** : 1.10.12
**Statut** : prêt pour déploiement Vercel + test V1

---

## 🎯 Périmètre

Cette version finalise la **gestion des retards d'outillage** côté app
(pas de Make pour cette partie, comme demandé par Pierre-Julien).

### ✅ Règles métier câblées

1. **SMS rappel automatique à J** : quand la date de retour prévue
   d'une sortie d'outil est dépassée et que le SMS n'a pas encore été
   envoyé, l'app envoie automatiquement un SMS au monteur emprunteur
   (template `outillage_rappel_retour`).
   - **Idempotent** : le flag `smsRappelJSent` est posé sur la sortie
     dès le premier envoi → pas de doublon possible même si 10
     personnes ouvrent l'app le même matin.
   - **Pas de relance quotidienne** : un seul SMS à J, c'est tout
     (décision Q1=1).

2. **Anomalie Dashboard à J+2** : si la sortie est toujours active 2
   jours après la date prévue, l'app pose le flag `anomalieJ2: true`
   sur la sortie (utilisable plus tard dans un Dashboard Direction —
   pas encore branché dans une UI Dashboard).

3. **Prolongation +7 jours** : bouton orange « 📅 Prolonger le retour
   de 7 jours » visible dans la fiche outil sur sortie active.
   - **Monteur lambda** : autorisé **1 seule fois** par sortie.
   - **Admin / Direction / Responsable parc** : peuvent re-prolonger
     autant de fois que nécessaire (pour les cas exceptionnels).
   - La prolongation **réinitialise** les flags `smsRappelJSent` et
     `anomalieJ2` : si la nouvelle date est à son tour dépassée, le
     cycle SMS redémarre proprement.
   - La **date originale** est conservée dans
     `dateRetourPrevueOriginale` pour traçabilité, et affichée dans la
     fiche outil avec le nom de la personne qui a prolongé.

4. **Demande manuelle de retour** : bouton bleu « 📱 Demander le retour
   (SMS) » dans la fiche outil — visible uniquement pour Admin,
   Direction et utilisateurs avec flag `responsableParc: true`. Envoie
   immédiatement un SMS au monteur (template
   `outillage_demande_retour`).

### ✅ Nouveau flag utilisateur : « Responsable parc machines »

Dans **Admin → Utilisateurs → modifier un user**, nouvelle case à
cocher **🛠 Responsable parc machines** (zone "Droits spéciaux", sous
les cases existantes).

Quand cochée, l'utilisateur :
- Reçoit les SMS d'alerte de **panne** signalée au retour d'un outil
  (priorité sur la Direction → cf. `findResponsableParc()`)
- Peut envoyer manuellement une **demande de retour** d'outil
- Peut **re-prolonger** une sortie déjà prolongée

### ✅ Mécanique technique

Un composant invisible **`OutillageRappelWatcher`** est monté dans le
Router dès qu'un utilisateur est connecté. Il :
1. Parcourt toutes les sorties au montage
2. Pour chacune : si `shouldSendRappelJ` → pose un doc dans `smsQueue`
   + flag la sortie comme `smsRappelJSent: true`
3. Pour chacune : si `shouldFlagAnomalieJ2` → flag `anomalieJ2: true`
4. Re-vérifie toutes les **30 minutes** tant que l'app reste ouverte

**Conséquence importante** : les SMS partent dès qu'**au moins une
personne** ouvre l'app le matin (toi, l'assistante, un conducteur, peu
importe qui). Pas besoin que ce soit le monteur lui-même. Si personne
n'ouvre l'app pendant 3 jours, les SMS partent en lot au prochain
ouverture (mais l'idempotence garantit qu'on n'envoie qu'une fois par
sortie).

**À noter** : si tu veux une fiabilité absolue indépendante de
l'ouverture de l'app, il faudra activer Cloud Functions (Firebase plan
Blaze payant) ou un scénario Make planifié. Mais en pratique chez EPJ
quelqu'un ouvre l'app tous les matins, donc ce système suffit largement.

---

## 📂 Fichiers modifiés

```
src/modules/parc-machines/outillageRappel.js          ⭐ NOUVEAU — helpers purs
src/modules/parc-machines/outillageRappel.test.js     ⭐ NOUVEAU — 53 tests
src/modules/parc-machines/OutillageRappelWatcher.jsx  ⭐ NOUVEAU — listener invisible
src/modules/parc-machines/ParcOutilDetail.jsx         ⭐ Boutons Prolonger + Demander retour
src/core/smsService.js                                ⭐ 2 nouveaux helpers SMS
src/pages/admin/AdminSmsTemplates.jsx                 ⭐ 2 nouveaux templates par défaut
src/pages/admin/AdminUsers.jsx                        ⭐ Case "Responsable parc machines"
src/App.jsx                                           ⭐ Monte le watcher
package.json                                          ⭐ Version 1.10.11 → 1.10.12
                                                       + test:unit étendu (247 tests)
```

---

## 🧪 Tests

```
Tests catalogImporter   : 57 OK, 0 KO
Tests orderEdit         : 29 OK, 0 KO
Tests smsService        : 47 OK, 0 KO
Tests orderDates        : 26 OK, 0 KO
Tests orderReceive      : 35 OK, 0 KO
Tests outillageRappel   : 53 OK, 0 KO  ⭐ nouveau
─────────────────────────────────────
TOTAL : 247 OK, 0 KO
```

Build Vite : ✓ 118 modules transformés.

---

## 🚀 Déploiement

1. Upload des **8 fichiers modifiés** sur GitHub `EPJ38400/EPJ-Commandes-v1.2`
2. Vercel redéploie automatiquement
3. **Étape obligatoire après déploiement** : connecte-toi en Admin →
   **Modèles SMS** → **🚀 Importer modèles EPJ** pour récupérer les 2
   nouveaux templates :
   - `outillage_rappel_retour` (envoyé auto à J)
   - `outillage_demande_retour` (envoyé manuellement)

   ⚠️ Si tu avais déjà importé les templates en v10.I/J, le bouton
   ajoutera les 2 nouveaux sans toucher aux anciens (déduplication par
   `id`).

4. Désigne au moins **un Responsable parc machines** : Admin →
   Utilisateurs → édite la fiche d'une personne → coche la case
   **🛠 Responsable parc machines** → enregistre. Si personne n'est
   coché, les alertes pannes et demandes de retour fonctionnent quand
   même mais visent la Direction par défaut (fallback).

---

## ✅ Tests à exécuter après déploiement

### 1. Test SMS rappel automatique à J

1. Va sur **Parc machines → Sortir un outil**
2. Sors un outil avec **date de retour prévue = aujourd'hui** (ex :
   11/05/2026 si on est le 11/05)
3. Recharge l'app (F5)
4. Dans les ~10 secondes après le rechargement, le SMS doit être posé
   dans Firestore `smsQueue` (vérifie dans la console Firebase)
5. Ton scénario Make existant envoie le SMS via Brevo dans les 15 min
6. ✅ L'emprunteur reçoit le SMS
7. ✅ Le doc de la sortie a maintenant `smsRappelJSent: true`
8. Recharge l'app → **aucun nouveau SMS** ne doit être renvoyé
   (idempotence)

### 2. Test prolongation +7 jours

1. Sur la même sortie active, ouvre le détail de l'outil
2. ✅ Tu vois le bouton orange « 📅 Prolonger le retour de 7 jours »
3. Clique → confirmation → date prévue = aujourd'hui + 7 jours
4. ✅ Apparition d'un encart orange « 📅 Sortie prolongée — date
   initiale : ... »
5. ✅ Le bouton de prolongation **disparaît** pour un monteur lambda
   (il a déjà prolongé), mais reste visible pour Admin/Direction/Resp parc
6. ✅ Les flags `smsRappelJSent` et `anomalieJ2` ont été reset (cycle
   redémarre quand la nouvelle date sera atteinte)

### 3. Test demande manuelle de retour

1. Connecte-toi en **Admin** ou **Direction** (ou user avec
   `responsableParc:true`)
2. Va sur la fiche d'un outil **en cours de sortie**
3. ✅ Tu vois le bouton bleu « 📱 Demander le retour (SMS) »
4. Clique → confirmation → SMS posé dans `smsQueue`
5. ✅ Le monteur reçoit un SMS « Bonjour X, [Toi] te demande de
   ramener l'outil... »
6. Connecte-toi en **monteur lambda** → ce bouton ne doit **PAS**
   apparaître

### 4. Test anomalie J+2

Cas plus difficile à tester en live (il faut attendre 2 jours). Pour
tester immédiatement :

1. Sors un outil avec date de retour **il y a 3 jours** (modifie
   manuellement le doc dans Firebase Console : `dateRetourPrevue:
   "2026-05-08"` si on est le 11/05)
2. Recharge l'app
3. ✅ Le doc de la sortie a maintenant `anomalieJ2: true`
4. ✅ Sur la fiche outil, encart rouge « ⚠️ ANOMALIE — outil en retard
   de plus de 2 jours » visible

(L'utilisation visible de ce flag dans un Dashboard Direction viendra
dans une session ultérieure.)

### 5. Test flag « Responsable parc machines »

1. Admin → Utilisateurs → édite un user (ex : Joseph BILARDO)
2. Coche **🛠 Responsable parc machines** → enregistre
3. Reconnecte-toi en ce user
4. ✅ Les boutons « 📅 Prolonger » (re-prolongation autorisée) et
   « 📱 Demander le retour » sont maintenant visibles pour lui même
   s'il n'est ni Admin ni Direction

---

## ⚠️ Points d'attention

### Fenêtre de tir : 30 minutes

Le watcher re-vérifie toutes les 30 min. Si tu sors un outil à 8h00
avec date de retour aujourd'hui, le SMS de rappel ne peut partir qu'à
8h30 au plus tôt (et toujours dépendant de Make qui poll toutes les
15 min). C'est largement suffisant pour le cas d'usage. Si tu veux
forcer un check immédiat, recharge l'app.

### Vraie cron-grade reliability ?

Le watcher est **app-driven**, donc dépend qu'au moins une personne
ouvre l'app dans la journée. En pratique tu as 5+ utilisateurs actifs,
donc ce sera toujours le cas avant 9h le matin. Si jamais tu vois un
SMS qui aurait dû partir et n'est pas parti (jour férié où personne ne
se connecte par exemple), tu auras toujours le bouton « 📱 Demander le
retour » manuel pour rattraper.

### Re-prolongation multiple

Admin / Direction / Responsable parc peuvent re-prolonger **autant de
fois que nécessaire** (pas de blocage). Le bouton continue d'afficher
« (re-prolongation) » entre parenthèses pour signaler que la sortie a
déjà été prolongée au moins une fois. Une trace complète de toutes les
prolongations n'est pas conservée (juste la dernière) — si tu veux un
historique complet, c'est une évolution simple à demander plus tard
(ajouter un tableau `prolongations[]` au doc).

### Désactivation des templates en V1

Si tu veux **désactiver** temporairement le SMS rappel auto pour tester
le système sans envoyer de SMS réels : **Admin → Modèles SMS** →
décoche « Modèle actif » sur `outillage_rappel_retour`. Le watcher
continue de tourner mais les SMS partent silencieusement à la poubelle
(warning console). Tu peux réactiver à tout moment.

---

## 🎯 Prochaine session

Options possibles :

1. **Dashboard Direction** — utiliser le flag `anomalieJ2` pour
   afficher les sorties à risque en vue centralisée
2. **Module Réserves** — finaliser le quitus express et l'OCR email
3. **Socle preprod** — créer l'environnement de pré-production séparé
4. **Module Avancement** — démarrer le module
5. **Liaison Esabora** — différée mais possible si tu veux préparer

À toi de voir selon tes priorités.

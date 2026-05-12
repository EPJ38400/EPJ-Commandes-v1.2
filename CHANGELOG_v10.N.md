# 📦 EPJ App Globale — v10.N

**Date** : 12 mai 2026
**Version** : 1.10.19
**Type** : module SMS Réserves chantier (côté app)

---

## 🎯 Périmètre

Module SMS pour les réserves chantier, suivant les décisions de PJY :

| Événement | Action SMS | Destinataire |
|---|---|---|
| **Création** | ❌ Aucun SMS (Point 1 = A) | — |
| **Attribution** | ✅ SMS automatique | Destinataire de l'attribution |
| **Transfert** (ré-attribution) | ✅ SMS automatique au nouveau | Nouveau destinataire |
| **Levée** | ❌ Aucun SMS (Point 2 PJY) | Email + dashboard suffisent |
| **Retard auto** | ✅ Watcher 5 min | Destinataire COURANT |
| **Rappel manuel** | ✅ Bouton "📱 Demander la levée" | Destinataire courant |

### 1. SMS d'attribution

À la création d'une réserve avec attribution dans la foulée, **ou** lors
d'un transfert (ré-attribution), le destinataire reçoit un SMS :

> Bonjour {prenom}, la réserve {refReserve} sur {chantier} t'a été
> attribuée : {titre}. À lever avant le {dateLevee}. — EPJ

### 2. Rappel automatique de retard (watcher 5 min)

Un composant invisible `ReservesRappelWatcher` est monté quand l'app
est ouverte. Toutes les **5 minutes**, il parcourt les réserves :
- Actives (pas encore levées + au moins un destinataire)
- Date de levée prévue dépassée (au moins 0 jour = J)
- Flag `smsRappelRetardSent` non posé (idempotence)

→ SMS au destinataire courant + flag posé.

**Comportement sur transfert** : lors d'un transfert (réattribution), le
flag `smsRappelRetardSent` est **reset**. Donc si la nouvelle date est
à son tour dépassée, le **nouveau destinataire** reçoit un nouveau
rappel. Cohérent avec ta demande : "le SMS de relance change de
destinataire".

> Bonjour {prenom}, rappel EPJ : la réserve {refReserve} sur
> {chantier} ({titre}) devait être levée le {dateLevee}. Merci de
> t'en occuper. — EPJ

### 3. Bouton "📱 Demander la levée" (rappel manuel)

Nouveau bouton bleu dans le détail d'une réserve active. Visible
**uniquement** pour :
- **Admin** + **Direction**
- **Conducteur travaux** (pilote naturel du chantier)
- Utilisateur avec flag `responsableParc: true`

Les monteurs ne le voient pas (cohérent avec parc machines v10.K).

> Bonjour {prenom}, {demandeurNom} te demande de lever la réserve
> {refReserve} sur {chantier} ({titre}) dès que possible. — EPJ

---

## 🔧 Modifications techniques

### Suppressions silencieuses

- `smsReserveCreee` côté ReserveCreate : remplacé par `smsReserveAttribuee`
- `smsReserveLevee` côté ReserveLevee : retiré complètement (pas de SMS à la levée)
- Ancien `doRelanceSMS` (mailto/clipboard) : remplacé par `doDemanderLevee` (queue Firestore + role-restricted)

Les helpers `smsReserveCreee` et `smsReserveLevee` restent dans
`smsService.js` (utilisés par le code historique, mais plus appelés
sur ces 2 événements). Pourront être supprimés plus tard si vraiment
inutilisés.

### Champs Firestore ajoutés (créés à la 1ère écriture, pas de migration nécessaire)

Sur le doc `reserves` :
- `smsRappelRetardSent` (bool) : idempotence du rappel auto
- `smsRappelRetardSentAt` (ISO date) : horodatage
- `transfereParId` / `transfereParNom` / `dateTransfert` : trace des transferts

### Nouveaux templates SMS (à importer depuis Admin → Modèles SMS)

- `reserve_attribuee`
- `reserve_rappel_levee`
- `reserve_demande_levee`

---

## 📂 Fichiers modifiés

```
src/modules/reserves/reservesRappel.js          ⭐ NOUVEAU (helpers purs)
src/modules/reserves/reservesRappel.test.js     ⭐ NOUVEAU (38 tests)
src/modules/reserves/ReservesRappelWatcher.jsx  ⭐ NOUVEAU (watcher invisible 5 min)
src/modules/reserves/ReserveCreate.jsx          ⭐ SMS attribution si affectation à création
src/modules/reserves/ReserveDetail.jsx          ⭐ SMS attribution sur (ré-)attrib + bouton "Demander la levée"
src/modules/reserves/ReserveLevee.jsx           ⭐ Suppression SMS à la levée
src/core/smsService.js                          ⭐ +3 helpers SMS Réserves
src/pages/admin/AdminSmsTemplates.jsx           ⭐ +3 templates par défaut
src/App.jsx                                     ⭐ Monte ReservesRappelWatcher
package.json                                    ⭐ Version 1.10.18 → 1.10.19
                                                   test:unit étendu
```

## 🧪 Tests

```
Tests catalogImporter   : 57 OK
Tests orderEdit         : 29 OK
Tests smsService        : 47 OK
Tests orderDates        : 26 OK
Tests orderReceive      : 35 OK
Tests outillageRappel   : 53 OK
Tests esaboraUtils      : 25 OK
Tests outilsImporter    : 40 OK
Tests reservesRappel    : 38 OK  ⭐ nouveau
─────────────────────────────────
TOTAL : 350 OK, 0 KO
```

Build Vite : ✓ 122 modules transformés.

---

## 🚀 Procédure de déploiement

1. **Upload du patch** sur GitHub `EPJ38400/EPJ-Commandes-v1.2` →
   Vercel redéploie
2. **Importer les nouveaux templates SMS** :
   - Admin → Modèles SMS → 🚀 Importer modèles EPJ
   - Les 3 nouveaux templates `reserve_attribuee`, `reserve_rappel_levee`,
     `reserve_demande_levee` s'ajoutent (déduplication par ID)
3. Tester (voir section ci-dessous)

---

## ✅ Tests à exécuter après déploiement

### Test 1 — SMS d'attribution à la création

1. Connecte-toi en Admin
2. Crée une nouvelle réserve avec attribution directe à un monteur
   (champ "Affecté à")
3. ✅ Le monteur doit recevoir un SMS dans la queue Firestore
4. ✅ Aucun SMS au conducteur (suppression v10.N)

### Test 2 — SMS de réattribution (transfert)

1. Sur une réserve déjà attribuée à un monteur A
2. Clique "🔄 Réattribuer" → choisis monteur B
3. ✅ Monteur B reçoit un SMS d'attribution
4. ✅ Le doc Firestore a maintenant `transfereParId` et `dateTransfert`
5. ✅ Le flag `smsRappelRetardSent` est reset à false (pour le cycle
   rappel auto)

### Test 3 — Watcher rappel automatique

1. Crée une réserve avec attribution + `dateSouhaiteLevee = aujourd'hui`
2. Recharge l'app (F5)
3. ⏱ Patiente quelques secondes ou clique sur un autre module + reviens
4. ✅ Dans Firestore `smsQueue`, un doc apparaît avec
   `templateCode: "reserve_rappel_levee"` et le destinataire courant
5. ✅ Le doc reserve a maintenant `smsRappelRetardSent: true`
6. Recharge → **aucun nouveau SMS** ne doit être enqueué (idempotence)

### Test 4 — Bouton "📱 Demander la levée" (manuel)

1. Connecte-toi en **Admin** ou **Direction** ou **Conducteur travaux**
2. Ouvre une réserve attribuée à un monteur, statut "attribuee"
3. ✅ Tu vois le bouton **📱 Demander la levée (SMS)**
4. Clique → confirmation → SMS posé dans `smsQueue`
5. Reconnecte-toi en **Monteur** → ce bouton ne doit **PAS** apparaître

### Test 5 — Aucun SMS à la levée

1. Sur une réserve, clique "✓ Déclarer la levée"
2. Suis le workflow normal (photos, description, signatures, etc.)
3. ✅ Aucun SMS n'est généré dans `smsQueue`
4. ✅ L'email mailto:contact@epj-electricite.com fonctionne toujours
   (inchangé)

---

## 📌 Note importante sur les SMS

Cette v10.N **continue à utiliser le buffer Firestore `smsQueue` +
dépileur Make** comme avant. **Le problème OAuth Make n'est pas
résolu par cette version.**

Le passage en mode "dépileur Cloud Function Firebase" sera fait dans
**la session suivante** (Cloud Function + GitHub Actions). Tout le code
de la v10.N reste compatible — il n'y aura qu'à remplacer Make par
la Cloud Function pour terminer la bascule.

---

## 🎯 Prochaine session

- Cloud Function Firebase qui dépile `smsQueue` → Brevo (remplace Make)
- Workflow GitHub Actions pour déploiement auto de la fonction
- Suppression définitive du scénario Make SMS Queue

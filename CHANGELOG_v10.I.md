# 📦 EPJ App Globale — v10.I (Charte Option D)

**Date** : 11 mai 2026
**Version** : 1.10.10
**Auteur** : Pierre-Julien YVER (architecte) + Claude (développement pair)
**Statut** : prêt pour déploiement Vercel + test V1 par Pierre-Julien

---

## 🎯 Périmètre de la livraison

Cette version résout **3 dettes techniques** sur le module Commandes (en production)
et **prépare le terrain SMS** pour les modules Avancement, Parc machines et Réserves
(qui sont en cours de développement).

### ✅ Fixes Commandes (production)

| # | Sujet | Détail |
|---|---|---|
| **Fix 1** | Suppression "Envoyée aux achats" | Conducteur travaux + Chef chantier peuvent maintenant supprimer une commande sur leurs chantiers, même au statut "Envoyée aux achats" (blocage seulement sur "Commandée", "Réceptionnée", "Refusée"). |
| **Fix 2** | "Marquer commandée" restreint | Bouton visible uniquement pour **Admin + Direction + Assistante**. Plus accessible aux chefs de chantier ni aux conducteurs travaux. |
| **Bug recipientUserId** | UID Firestore propre | Le champ `recipientUserId` dans les docs `smsQueue` contient maintenant l'UID Firestore réel (avant : "Yver" — nom de famille). |

### ✅ SMS Commandes étendus (4 nouveaux)

| Événement | Destinataire | Template |
|---|---|---|
| Commande **validée** par conducteur | Assistante achats | `commande_validee` |
| Commande **marquée commandée** chez fournisseur | Demandeur initial | `commande_passee` |
| Commande **réceptionnée** | Demandeur initial | `commande_recue` |
| Commande **supprimée** (après envoi achats) | Conducteur du chantier | `commande_supprimee` |

### ✅ SMS Modules à venir (Avancement / Parc / Réserves — câblage anticipé)

Les helpers sont prêts dans `smsService.js` et **appelés depuis les endroits naturels** :
les modules sont en cours de développement mais le câblage SMS se déclenche
dès qu'un événement se produit (création de réserve, sortie d'outil, etc.).

**Réserves & quitus** (5 SMS) :
- `reserve_creee` → SMS conducteur du chantier (appel : `ReserveCreate.save`)
- `reserve_levee` → SMS demandeur initial (appel : `ReserveLevee.save`)
- `quitus_signe` → SMS conducteur lors génération PDF (appel : `QuitusActions.ensurePdfUploaded`)
- `quitus_express_signe` → helper prêt, à câbler quand le flow express sera codé
- `reserve_retard` (déjà v10.H) → cron Make quotidien, pas de câblage app

**Parc machines / Outillage** (4 SMS) :
- `outillage_sortie` → SMS monteur emprunteur (appel : `ParcOutilSortie.save`)
- `outillage_pannes` → SMS responsable parc (appel : `ParcOutilRetour.save` si panne)
- `outillage_retard_retour` (J+1) → cron Make quotidien
- `outillage_retard_relance` (J+3) → cron Make quotidien (1 appel monteur + 1 appel conducteur)

**Avancement** :
- `avancement_rappel_validation` (déjà v10.H) → cron Make mensuel

### ✅ Nettoyage smsQueue côté app (workaround Make)

Les modules Delete/Update de Make étant en erreur silencieuse côté Pierre-Julien
(problème de path Firestore), les docs `smsQueue` s'accumulaient. Nouveau helper
`deleteSentSmsQueueDocs()` qui purge les docs `status === "sent"`. Appelé
automatiquement au montage de `CommandesInner` + toutes les 5 min en arrière-plan.

**Prérequis Make** : ton scénario Make doit OBLIGATOIREMENT passer
`status: "sent"` sur le doc smsQueue après envoi Brevo réussi. Sinon
ce nettoyage ne fera rien (sécurité voulue).

---

## 📂 Fichiers modifiés

```
src/core/smsService.js          ⭐ RÉCRIT (13 nouveaux helpers + fix UID + purge)
src/core/smsService.test.js     ⭐ Étendu (19 nouveaux tests, total 47/47)
src/core/permissions.js         ⭐ Conducteur travaux + Chef chantier : delete:"own_chantiers" sur commandes
src/modules/commandes/CommandesInner.jsx   ⭐ Fix 1 + Fix 2 + bug recipientUserId + 3 SMS + purge queue
src/modules/reserves/ReserveCreate.jsx     ⭐ SMS reserve_creee
src/modules/reserves/ReserveLevee.jsx      ⭐ SMS reserve_levee
src/modules/reserves/QuitusActions.jsx     ⭐ SMS quitus_signe
src/modules/parc-machines/ParcOutilSortie.jsx   ⭐ SMS outillage_sortie
src/modules/parc-machines/ParcOutilRetour.jsx   ⭐ SMS outillage_pannes
src/pages/admin/AdminSmsTemplates.jsx           ⭐ 13 nouveaux templates par défaut
package.json                    ⭐ Version 1.10.9 → 1.10.10
```

---

## 🚀 Procédure de déploiement

### Méthode 1 — Drag & drop GitHub (recommandée)

1. Sur GitHub `EPJ38400/EPJ-Commandes-v1.2`, **clic crayon** sur chaque fichier de la liste ci-dessus
2. Ouvre le fichier équivalent dans le ZIP local
3. `Ctrl+A` (sélectionne tout) → `Ctrl+C` (copie)
4. Sur GitHub : `Ctrl+A` dans l'éditeur → `Ctrl+V` → commit
5. Vercel redéploie automatiquement en ~30 secondes

### Méthode 2 — Upload direct sur GitHub

1. Sur GitHub `EPJ38400/EPJ-Commandes-v1.2`, bouton **Add file → Upload files**
2. Glisse-dépose les 11 fichiers modifiés (en respectant la hiérarchie de dossiers)
3. Commit message : `v10.I — Fix permissions commandes + SMS étendus tous modules`

---

## ✅ Tests à exécuter après déploiement

### 1. Import des 13 nouveaux templates SMS (1 fois)

1. Connecte-toi en Admin
2. Va dans **Admin → Modèles SMS**
3. Clique sur **🚀 Importer modèles EPJ**
4. ✅ Tu dois voir : `13 modèles importés` (les 5 anciens + 13 nouveaux)

⚠️ **Important** : les templates restent **désactivables individuellement**
depuis cet écran (case "Modèle actif"). Pour la phase de test V1, tu peux ne
laisser actifs que ceux que tu veux tester.

### 2. Test Fix 1 (suppression "Envoyée aux achats")

1. Connecte-toi en **Conducteur travaux** (toi-même)
2. Va dans **Commandes → Historique**
3. Ouvre une commande au statut "Envoyée aux achats" sur un de tes chantiers
4. ✅ Le bouton **🗑️ Supprimer** doit être visible
5. Clique → confirme → la commande est supprimée
6. ✅ Le conducteur du chantier reçoit un SMS `commande_supprimee`

### 3. Test Fix 2 ("Marquer commandée" restreint)

1. Connecte-toi en **Chef chantier** ou **Conducteur travaux** (pas Admin/Direction)
2. Ouvre une commande au statut "Envoyée aux achats"
3. ✅ Le bouton **🛒 Marquer comme commandée** doit être **invisible**
4. Reconnecte-toi en **Admin** → ✅ le bouton réapparaît

### 4. Test SMS étendus Commandes

| Action | SMS attendu | À tester ? |
|---|---|---|
| Conducteur valide une commande | Assistante achats reçoit SMS | ✅ |
| Admin/Assistante marque "Commandée" | Demandeur initial reçoit SMS | ✅ |
| Réception signée | Demandeur initial reçoit SMS | ✅ |
| Suppression "Envoyée aux achats" | Conducteur reçoit SMS | ✅ |

⚠️ **Prérequis** : tu dois avoir au moins **1 utilisateur avec rôle "Assistante"**
dans la base, et son numéro de téléphone renseigné. Sinon le SMS de validation
sera silencieusement ignoré (warning console : *"Aucune assistante achats trouvée"*).

### 5. Test bug recipientUserId

1. Crée une commande de test (en compte non-Admin sur un chantier)
2. Ouvre Firebase Console → **Firestore → smsQueue → doc le plus récent**
3. ✅ Le champ `recipientUserId` doit contenir un UID Firestore type `aBc123XyZ`
4. ❌ Plus jamais un nom de famille type "Yver"

### 6. Test purge smsQueue

1. Ouvre **Firestore → smsQueue**
2. Trouve un doc en `status: "pending"`
3. Modifie son statut manuellement à `status: "sent"`
4. Attends 5 min (ou recharge l'app sur claude.epj-electricite.fr)
5. ✅ Le doc disparaît automatiquement

⚠️ **Make doit obligatoirement passer `status: "sent"`** sur les docs après
envoi Brevo réussi pour que cette purge fonctionne. Si Make ne le fait pas
encore, ouvre le scénario Make et ajoute un module "Update Firestore Doc"
qui force `status: "sent"` après le module Brevo (étape déjà documentée
dans `PROCEDURE_MAKE_SMS.md`).

---

## 🧪 Tests unitaires

```bash
npm install
npm run test:unit
```

**Résultat attendu** :
```
Tests : 57 OK, 0 KO          (catalogImporter)
Tests v10.G.2 : 29 OK, 0 KO  (orderEdit)
Tests smsService : 47 OK, 0 KO  ← +19 nouveaux tests v10.I
```

**Total : 133/133 ✅**

---

## ⚠️ Points d'attention

### Templates SMS désactivables

Tous les nouveaux templates sont **importés actifs par défaut**. Pour la phase
V1 (toi seul testant), tu voudras peut-être désactiver certains pour éviter
le bruit. Va dans **Admin → Modèles SMS → ✏️** sur le template → décoche
"Modèle actif".

### Rôle "Assistante achats" requis

Pour que le SMS `commande_validee` parte vers la bonne personne, il faut
au moins **un user avec rôle "Assistante"** dans `utilisateurs/`. Sans ça,
warning console mais pas de crash (non bloquant).

Si tu veux désigner une assistante **différente** par chantier (cas où
plusieurs sites avec des achats séparés), c'est une évolution future :
aujourd'hui c'est global pour toute l'entreprise.

### Responsable parc machines

Idem pour les SMS de panne outillage : il faut un user avec
`responsableParc: true` (champ booléen à ajouter via Admin Users en mode
édition), sinon fallback automatique sur la première Direction puis Admin.

À configurer côté Admin Users : ajouter un toggle "Responsable parc machines"
dans le formulaire d'édition d'utilisateur. **TODO v10.I+1**.

### Modules en cours de développement

Les modules Réserves et Parc machines sont **en cours de développement**.
Les SMS sont câblés mais les modules eux-mêmes ne sont pas testés en
production. Quand tu finaliseras chaque module (Q3/Q4 2026 selon ton plan
de construction), les SMS seront déjà actifs — pas besoin d'y revenir.

### Dette technique reportée (Q3=3, mix)

Les autres gardes UI dans `CommandesInner.jsx` utilisent encore `user.fonction === "Admin"`
en dur. Sur les 3 boutons touchés ce coup-ci (Supprimer × 2, Marquer commandée),
on est passé proprement au système `can(user, "commandes", "delete", rolesConfig)`.
**Le reste sera migré progressivement** au fil des prochaines sessions, quand
on retombera dessus pour d'autres raisons. Pas de big bang.

---

## 🎯 Prochaine session

D'après ton plan de construction (Socle → M3 → M2 → M4 → Dashboards → M5),
les options pour la prochaine session sont :

1. **Socle** (landing page + chantiers + droits + preprod) — fondations
2. **Module 3 Avancement** (suivi mensuel + heures + PDF + photos GPS)
3. **Module 2 Parc machines** (finalisation : QR codes + planning + cron Make pour SMS retards J+1/J+3)
4. **Module 4 Réserves** (quitus express + email AI + finalisation)

À toi de voir, mais ma reco : **finaliser le Socle d'abord** (preprod
environment !) puis enchaîner Module 3 selon ton plan d'avril.

# TODO — EPJ Commandes v1.2

Fichier de suivi des sujets à venir, dettes techniques, points à investiguer.
Mis à jour à chaque fin de patch. Modifiable manuellement.

## 🔴 À traiter dans un patch dédié (priorité haute)

### Patch v2.0.2 — Automatisation SMS globale
Reporté du patch v2.0.1 (sujet 8 initial). À traiter dans une session dédiée parce que ça touche plusieurs endroits de l'app (réserves, parc machines, commandes, avancement).

Périmètre prévu :
- Nouvelle Cloud Function cron `checkScheduledSms` (toutes les 15 min)
- Adaptation de `onSmsQueueCreate` pour ignorer les docs `status: "scheduled"` non encore prêts
- Nouveau champ `scheduledFor` (timestamp) au schéma `smsQueue`
- UI admin "Paramètres SMS" : délais configurables (J-1 rappel RDV, X jours relance, etc.)
- Stockage config : `config/settings.smsScheduling` ou nouveau doc
- Côté réserves : créer les docs `scheduled` à la création/édition avec RDV
- Côté parc machines : rappels de retour outils (à concevoir)
- Côté commandes : relances Esabora (à concevoir)
- Migration des templates `sms_reserve_rdv_demain` et `sms_reserve_relance_rdv` : champ `texte` → `body` (vérifié en base, ils sont en `texte:`)

En attendant : envois et rappels SMS faits manuellement.

## 🟠 Dettes techniques à investiguer

### Champ `c.archive` — mort code probable
Identifié au sujet 6 de v2.0.1. 5 usages dans le code (notificationsUtils, ParcOutilTransfert, ParcOutilSortie, ParcSortieMultiple, DashboardDirection) mais aucun endroit du code actuel n'écrit ce champ. Probablement legacy d'une version antérieure.

Action :
- Query Firestore pour vérifier si des docs `chantiers` ont effectivement `archive: true`
- Si 0 → supprimer les 5 filtres morts
- Si quelques uns → décider de garder ou nettoyer

### Bug 9 hypothétique — Validation mensuelle d'avancement à vide
Identifié au sujet 4 (faux bug avancement clignote). Mickael COURTEAU a validé l'avancement de mai 2026 sur LE CLOS MARENGO sans avoir saisi aucun pourcentage. Validation enregistrée, mais zéro donnée.

À reconfirmer avec Mickael. Si confirmé, ajouter une protection :
- Soit interdire la validation si tous les avancements sont à 0%
- Soit afficher un avertissement "Attention : aucun avancement saisi" avant validation

### Doublons CMD-2026-0054 (triplon en base)
3 documents avec le même numéro (qc6L1hpcJyCSTcLwrSZR, N8S6wv3Z8XLS2hlsV1zM, X1OA94DJhSdnOWAdk9tb).

Décision PJ : on garde les 3 docs tels quels. Le sujet 5 de v2.0.1 corrige la cause (numérotation atomique via transaction) pour le futur. Les doublons existants restent.

## 🟢 Actions manuelles post-merge v2.0.1

À faire APRÈS le merge de v2.0.0-stabilisation sur main :

1. **Déploiement Firestore rules d'abord, code après** :

   ```
   firebase deploy --only firestore:rules
   firebase deploy --only functions
   ```

   Le push sur main déclenche Vercel automatiquement. Mais les rules/functions ne sont PAS déployées auto → faut les commandes ci-dessus.

   ATTENTION sujet 5 : si les rules ne sont pas déployées AVANT le code, les non-Admin ne pourront plus créer de commandes (rule `match /config/counters` manquante).

2. **Mise à jour du template `reserve_attribuee` en base** (sujet 2 de v2.0.1) :
   - Aller dans Admin → Modèles SMS
   - Éditer le template `reserve_attribuee`
   - Body doit devenir : `Bonjour {prenom}, la réserve {refReserve} sur {chantier} t'a été attribuée : {titre}. {dateRdv}À lever avant le {dateLevee}. — EPJ`
   - Ajouter `{dateRdv}` aux variables
   - Sauvegarder

   Le code seul ne suffit pas car `setDoc` du seed n'écrase pas les docs existants.

3. **Vérifications de bon fonctionnement** (en navigation privée pour confirmer) :
   - Écran login s'affiche bien sans cookie (fix DataContext)
   - Création d'une commande → numéro CMD-2026-XXXX généré atomiquement (vérifier dans config/counters en base)
   - Sélecteur livraison → "Dépôt" en 1er + par défaut
   - Bouton "Demander la levée" sur une réserve → modal s'ouvre si plusieurs templates
   - Toast Esabora liste les fournisseurs OK/KO

## 📋 Idées / améliorations possibles (priorité basse)

À explorer plus tard quand on aura le temps :
- Nettoyage CommandesInner.jsx (3873 lignes — découpage en sous-composants)
- Tests E2E (Playwright/Cypress) pour les flows critiques (création commande, attribution réserve, signature quitus)
- PWA installable avec icône et notifications push (manifest 401 sur Vercel preview à régler)
- Dashboard public Dahua 65" (placeholder actuel)
- Dashboard Conducteur travaux (placeholder actuel)

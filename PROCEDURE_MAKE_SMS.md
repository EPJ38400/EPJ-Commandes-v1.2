# 📋 PROCÉDURE — Configuration Make + Brevo pour le module SMS

**Version** : v10.H (10 mai 2026)
**Auteur** : Claude pour Pierre-Julien YVER

Ce document décrit comment configurer **Brevo** (envoi de SMS) puis **Make** (passerelle entre Firestore et Brevo) pour que les SMS de l'app EPJ partent automatiquement.

---

## 📐 Architecture cible

```
┌──────────────┐       ┌────────────────────┐       ┌─────────┐       ┌────────┐
│   EPJ App    │  →    │  Firestore         │  →    │  Make   │  →    │ Brevo  │
│ (création    │       │  collection        │ poll  │(scénario│       │  API   │
│  commande,   │       │  "smsQueue"        │ 1 min │ Firebase│       │        │
│  ...)        │       │                    │       │  +HTTP) │       │ envoi  │
└──────────────┘       └────────────────────┘       └─────────┘       └────────┘
                                                          │
                                              status:sent → SUPPRIME le doc
                                              status:failed → garde + errorMessage
```

---

## 🪜 Étape 1 — Créer un compte Brevo (5 min)

1. Va sur https://www.brevo.com
2. Crée un compte (email professionnel recommandé)
3. **Plan** : la version gratuite suffit largement pour notre usage
4. Une fois connecté, va dans **Senders, Domains & Dedicated IPs → SMS** dans le menu de gauche
5. Demande l'activation des SMS transactionnels (peut nécessiter une vérification)
6. **Achète des crédits SMS** — recommandation : commence avec 100 crédits France (~6,50€)

### Récupérer la clé API Brevo

1. Clique sur ton avatar en haut à droite → **SMTP & API**
2. Onglet **API Keys**
3. Clique **+ Generate a new API key**
4. Nom : `EPJ-App-Make`
5. **Copie la clé qui s'affiche** (elle commence par `xkeysib-...`)
6. **Garde-la précieusement** (elle ne s'affichera plus jamais après cette page)

### Configurer le sender SMS

1. Va dans **Senders, Domains & Dedicated IPs → SMS Senders**
2. Clique **+ Add a sender**
3. Nom : `EPJ` (max 11 caractères, alphanumériques uniquement)
4. Valide

---

## 🪜 Étape 2 — Créer le scénario Make (15 min)

### 2.1 — Créer un nouveau scénario

1. Va sur https://www.make.com
2. **+ Create a new scenario**
3. Nom : `EPJ — SMS Queue → Brevo`

### 2.2 — Module 1 : Trigger Firestore (Watch Documents)

1. Clique le **+** au centre → cherche **Google Cloud Firestore**
2. Choisis **"Watch Documents"**
3. **Connection** :
   - Si tu n'as pas encore connecté Firebase à Make : clique **Add** → suis la procédure de service account JSON (dispo dans Firebase Console → Project Settings → Service accounts → Generate new private key)
   - Si déjà connecté : sélectionne ta connexion existante
4. **Project ID** : `ap-epj` (ton ID Firebase)
5. **Database** : `(default)`
6. **Collection ID** : `smsQueue`
7. **Document filter** : laisse vide (on filtre dans le module 2)
8. **Order by** : `createdAt` ASC
9. **Limit** : `10` (pour traiter par paquets si plusieurs en attente)

### 2.3 — Module 2 : Filter (status pending)

Entre le module 1 et le module 3, ajoute un **filtre** :

- Condition : `status` (du module 1) **Text operators: Equal to** `pending`

Pourquoi ? Pour que Make ignore les docs qui auraient déjà `status: failed` (qu'on garde pour diagnostic).

### 2.4 — Module 3 : HTTP — Make a Request (appel API Brevo)

1. Clique **+** → cherche **HTTP** → **Make a request**
2. **URL** : `https://api.brevo.com/v3/transactionalSMS/sms`
3. **Method** : `POST`
4. **Headers** : ajoute 2 headers
   - `api-key` : `<ta clé Brevo xkeysib-...>` (la clé que tu as copiée à l'étape 1)
   - `Content-Type` : `application/json`
5. **Body type** : `Raw`
6. **Content type** : `JSON (application/json)`
7. **Request content** :
   ```json
   {
     "sender": "EPJ",
     "recipient": "{{1.recipientPhone}}",
     "content": "{{1.message}}",
     "type": "transactional"
   }
   ```
   (Les `{{1.recipientPhone}}` etc. sont des variables que tu insères en cliquant sur les champs du module Firestore — ne les retape pas à la main.)
8. **Parse response** : `Yes`

### 2.5 — Module 4 : Router (succès / échec)

Ajoute un **Router** après le module HTTP :

- **Route 1** : "Succès"
  - Filter : `Status code` (du module 3) **Numeric: Less than** `300`
- **Route 2** : "Échec"
  - Filter : `Status code` (du module 3) **Numeric: Greater than or equal to** `300`

### 2.6 — Module 5 (Route Succès) : Firestore Delete Document

1. **Google Cloud Firestore → Delete a Document**
2. **Connection** : ta connexion Firebase
3. **Project ID** : `ap-epj`
4. **Collection ID** : `smsQueue`
5. **Document ID** : `{{1.__IMTID__}}` (l'ID du doc venant du module 1)

### 2.7 — Module 6 (Route Échec) : Firestore Update Document

1. **Google Cloud Firestore → Update a Document**
2. **Project ID** : `ap-epj`
3. **Collection ID** : `smsQueue`
4. **Document ID** : `{{1.__IMTID__}}`
5. **Mode** : `Update`
6. **Fields à mettre à jour** :
   - `status` : `failed`
   - `errorMessage` : `{{3.statusCode}} — {{3.data}}` (ce que Brevo a renvoyé)
   - `attemptedAt` : `{{now}}`

### 2.8 — Activer le scénario

1. En bas à gauche, clique **Schedule**
2. **Run scenario** : `On Demand` puis modifie pour `Every 1 minute`
3. Clique le **gros bouton "ON"** en bas à gauche pour activer

---

## 🪜 Étape 3 — Tester (10 min)

### Test 1 — Insertion manuelle dans Firestore

1. Va sur https://console.firebase.google.com → projet `ap-epj` → Firestore
2. Crée une collection `smsQueue` si elle n'existe pas
3. Ajoute un document avec :
   ```
   type: "TEST_MANUAL"
   recipientPhone: "+33TONNUMERO" (ton vrai numéro pour tester)
   message: "Test EPJ depuis Firestore — si tu lis ça, ça marche !"
   status: "pending"
   createdAt: (timestamp now)
   ```
4. Attends 1-2 minutes
5. Tu dois recevoir le SMS sur ton téléphone
6. Le doc Firestore doit être **supprimé** automatiquement (Make a fait son job)

### Test 2 — Via l'app EPJ

1. Connecte-toi sur l'app en tant qu'un monteur (ex: Bartoli)
2. Crée une commande sur un chantier dont tu es **conducteur** (pour que le SMS te revienne)
3. Soumets la commande
4. Le conducteur doit recevoir un SMS dans la minute

---

## 🪜 Étape 4 — Modèles SMS personnalisables

Une fois les tests OK, tu peux personnaliser les textes des SMS depuis l'app :

1. Connecte-toi en Admin
2. **Admin → 💬 Modèles SMS**
3. **Importer les modèles par défaut** (premier setup uniquement)
4. Tu vois alors la liste des templates avec :
   - `commande_creee` — SMS quand commande créée
   - `commande_modifiee` — SMS quand commande modifiée
   - `outillage_rappel_retour` — SMS retour outil prévu
   - `outillage_rappel_retard` — SMS outil en retard
   - `avancement_rappel_validation` — SMS validation avancement
   - `reserve_retard` — SMS réserve en retard
5. Pour chaque template, tu peux :
   - **Modifier le texte** (en utilisant les variables `{prenom}`, `{numCmd}`, etc.)
   - **Activer / désactiver** (kill switch — si désactivé, l'app n'envoie plus de SMS de ce type)

---

## 🪜 Étape 5 — Crons quotidiens (modules Parc / Avancement / Réserves)

Pour les 3 modules **Parc, Avancement et Réserves**, le déclencheur n'est pas un événement utilisateur mais l'écoulement du temps. Ces modules nécessitent un **2e scénario Make** qui s'exécute 1 fois par jour.

⚠️ **Cette étape est optionnelle au déploiement initial v10.H.** Si tu préfères te concentrer d'abord sur les SMS Commandes (qui marchent en évènementiel), tu peux faire ce 2e scénario plus tard.

### Scénario 2 — Cron quotidien

1. Make → Nouveau scénario : `EPJ — Cron SMS quotidien`
2. **Trigger** : Schedule → "Every day at 8:00 AM"
3. **Module 1** : Firestore "List documents" sur `outillageSorties` (filtre date retour < today, dateRetourReelle empty)
4. Pour chaque résultat → écrire dans `smsQueue` un doc avec `type: "TOOL_OVERDUE"`, `templateCode: "outillage_rappel_retard"`, etc.
5. Le scénario 1 (déjà actif) prendra le relais et enverra les SMS

**Pour le détail de ce 2e scénario, je peux te le préparer si besoin une fois le scénario 1 testé et fonctionnel.**

---

## 🛠️ Dépannage

### Le SMS n'arrive pas

1. Vérifier dans Make → "History" du scénario : est-ce que les exécutions ont lieu ?
2. Si "0 operations" → le filtre status=pending ne matche pas → vérifier le doc Firestore
3. Si exécutions OK mais erreur HTTP → vérifier la clé API Brevo dans le module 3
4. Si HTTP 200 mais pas de SMS → vérifier sur Brevo → SMS → "SMS history" : le SMS apparaît-il ?
5. Vérifier le crédit SMS Brevo (acheté à l'étape 1)

### Le numéro de téléphone est rejeté

- Brevo n'accepte que le format E.164 (`+33612345678`)
- L'app EPJ normalise déjà les formats français → si erreur, c'est probablement un téléphone mal saisi côté admin utilisateurs

### Make atteint sa limite mensuelle d'opérations

- Plan Make gratuit : 1000 opérations/mois
- 1 SMS = 4 opérations Make (trigger + filter + HTTP + delete)
- → 250 SMS/mois max sur le plan gratuit
- Si tu dépasses : upgrade vers Core Plan Make (~10€/mois pour 10 000 opérations)

### Le scénario tourne mais ne consomme rien

- Vérifier que le scénario est bien **activé** (toggle ON en bas à gauche)
- Vérifier le **scheduling** (1 minute)
- Vérifier qu'il y a bien des docs avec `status:pending` dans `smsQueue`

---

## 💰 Coûts

| Poste | Coût |
|---|---|
| Brevo SMS France | 0,065 € / SMS |
| Brevo SMS DOM-TOM | 0,30 € / SMS environ |
| Make plan gratuit | 0 € (jusqu'à 1000 ops/mois) |

**Estimation pour EPJ** : ~10 SMS/jour × 22 jours/mois = ~220 SMS/mois → **~14€/mois** côté Brevo + 0€ côté Make (en restant sous les 1000 ops).

---

## 🔐 Sécurité

- La clé API Brevo est dans Make uniquement (jamais dans le code GitHub)
- Le service account Firebase de Make a accès à Firestore uniquement (pas à Authentication ni Storage)
- Aucune donnée sensible (mots de passe, etc.) ne transite par smsQueue

---

## 🎯 Maintenance

- **Mensuel** : surveiller le crédit SMS Brevo (alerte automatique à <20% restant)
- **Mensuel** : surveiller les opérations Make (https://www.make.com/en/dashboard)
- **Hebdomadaire** : vérifier qu'aucun doc dans `smsQueue` n'est resté en `status:failed` depuis longtemps (sinon les diagnostiquer)

---

**Si tout fonctionne, tu n'as plus rien à faire — le système tourne tout seul !**

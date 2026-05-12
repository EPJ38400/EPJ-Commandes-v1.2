# 📦 EPJ App Globale — v10.O

**Date** : 12 mai 2026
**Version** : 1.10.20
**Type** : migration finale Make → Cloud Function Firebase + GitHub Actions

---

## 🎯 Périmètre

Remplacement définitif de Make pour les SMS par une **Cloud Function
Firebase** déployée automatiquement via **GitHub Actions**.

### Avant (architecture v10.N)

```
EPJ App ──pose──► Firestore smsQueue ──poll 15 min──► Make ──► Brevo ──► SMS
                                          (OAuth fragile)
```

Problème : OAuth Make casse tous les 3-6 mois, les SMS s'arrêtent.

### Après (architecture v10.O)

```
EPJ App ──pose──► Firestore smsQueue
                       │
                       └─trigger immédiat──► Cloud Function Firebase ──► Brevo ──► SMS
                                                (clé API en secret)
```

**Bénéfices** :
- ✅ Latence ~3 secondes (au lieu de 15 min)
- ✅ Plus de déconnexion OAuth
- ✅ Clé Brevo en SECRET côté serveur, invisible publiquement
- ✅ Plus de Make pour les SMS (Make Core ~10€/mois économisé)
- ✅ Déploiement automatique via GitHub à chaque push

---

## 📂 Nouveaux fichiers / structure

```
v10O-PATCH.zip contient :

functions/
  ├── index.js              ⭐ Cloud Function principale (161 lignes)
  ├── package.json          ⭐ Dépendances Node.js de la fonction
  └── .gitignore            ⭐ Ignore node_modules dans functions/

.github/workflows/
  └── deploy-functions.yml  ⭐ GitHub Actions : déploiement auto

firebase.json               ⭐ Config Firebase CLI (à la racine)
.firebaserc                 ⭐ Lie le repo au projet ap-epj
package.json                ⭐ Version 1.10.19 → 1.10.20
```

L'app React (`src/`) n'est pas modifiée par cette version : la
v10.N était déjà compatible.

---

## 🚀 Procédure de mise en place (1 fois pour toutes)

### Étape 1 — Créer la clé Service Account pour GitHub Actions

GitHub Actions a besoin d'un "droit de déployer" sur Firebase. On lui
crée un compte de service dédié.

1. Va sur **https://console.cloud.google.com** → projet **ap-epj**
2. Menu de gauche (☰) → **IAM et administration** → **Comptes de service**
3. Bouton **+ Créer un compte de service** en haut
4. **Étape 1 — Détails du compte** :
   - **Nom** : `github-actions-deploy`
   - **ID** : (auto-rempli)
   - **Description** : `Déploiement Cloud Functions depuis GitHub`
   - → **CRÉER ET CONTINUER**
5. **Étape 2 — Rôles** : ajoute les 3 rôles suivants (cliquer
   "Ajouter un autre rôle" entre chaque) :
   - `Firebase Admin SDK Administrator Service Agent`
   - `Cloud Functions Admin`
   - `Service Account User`
   - → **CONTINUER**
6. **Étape 3** : laisse vide → **OK**
7. Sur la liste des comptes de service, **clique sur l'email**
   `github-actions-deploy@ap-epj.iam.gserviceaccount.com`
8. Onglet **CLÉS** en haut
9. **AJOUTER UNE CLÉ** → **Créer une clé**
10. Type : **JSON** → **CRÉER**
11. Un fichier `.json` se télécharge (ex: `ap-epj-xxxxxx.json`)

⚠️ **GARDE CE FICHIER PRÉCIEUSEMENT** : ne le partage nulle part,
ne le commit pas dans Git.

### Étape 2 — Ajouter la clé dans GitHub Secrets

1. Va sur **https://github.com/EPJ38400/EPJ-Commandes-v1.2**
2. **Settings** (en haut à droite)
3. Menu de gauche : **Secrets and variables** → **Actions**
4. Bouton **New repository secret**
5. **Name** : `FIREBASE_SERVICE_ACCOUNT` (exactement, en majuscules)
6. **Secret** : ouvre le fichier `.json` téléchargé, copie **TOUT
   le contenu** (ouvre-le avec un éditeur de texte, sélectionne tout
   avec Cmd+A sur Mac, copie). Colle dans la case Secret.
7. **Add secret**

### Étape 3 — Configurer la clé Brevo comme SECRET Firebase

La clé API Brevo ne va **PAS** dans GitHub. Elle va directement dans
Firebase Functions Secrets — c'est encore plus sécurisé.

Sur ton **Mac**, dans le Terminal (à faire UNE SEULE FOIS) :

```bash
# Si pas encore installé sur le Mac :
npm install -g firebase-tools

# Login :
firebase login

# Récupère le code source du projet (à faire après avoir uploadé v10.O sur GitHub) :
cd ~/Desktop
git clone https://github.com/EPJ38400/EPJ-Commandes-v1.2.git
cd EPJ-Commandes-v1.2

# Définir la clé Brevo comme secret Firebase :
firebase functions:secrets:set BREVO_API_KEY
```

→ Firebase te demande la valeur, **colle ta clé Brevo** (celle qui
commence par `xkeysib-...`) puis Entrée.

Vérifie que le secret est bien stocké :

```bash
firebase functions:secrets:access BREVO_API_KEY
```

Ça doit afficher ta clé. C'est fait, **plus jamais à toucher**.

### Étape 4 — Uploader v10.O sur GitHub

Décompresse le ZIP et upload sur GitHub comme d'habitude.
**Attention** : il y a des **nouveaux dossiers à la racine** :
- `functions/` (à la racine, à côté de `src/`)
- `.github/` (caché par défaut sur Mac → active **Cmd+Shift+.** pour
  le voir dans Finder)

GitHub doit voir ces nouveaux dossiers. Commit `v10.O — Cloud
Function + GitHub Actions`.

### Étape 5 — Vérifier que GitHub Actions déploie

1. Sur GitHub → onglet **Actions** en haut
2. Tu dois voir le workflow `Deploy Cloud Functions` en cours
3. Clique dessus → tu vois les étapes s'exécuter
4. À la fin (~2 minutes) : ✅ vert si tout est OK
5. Si ❌ rouge : clique sur l'étape pour voir le message d'erreur,
   envoie-moi une capture

### Étape 6 — Tester en réel

1. Connecte-toi à l'app
2. Fais une action qui pose un SMS (ex : créer une commande, ou
   attribuer une réserve)
3. Va dans **Firebase Console → Firestore** → collection `smsQueue`
4. Le nouveau doc apparaît avec `status: "pending"`
5. **Dans les 3-5 secondes**, le doc passe à `status: "sent"` (✅)
6. Le SMS arrive sur le téléphone du destinataire

Si erreur : `status: "failed"` avec `failureReason` dans le doc.

### Étape 7 — Désactiver Make SMS Queue (DEFINITIF)

1. Va sur Make.com → ton scénario **EPJ — SMS Queue → Brevo**
2. **Désactive** le scénario (interrupteur en haut à droite)
3. Garde-le quelques jours pour observer (juste au cas où)
4. Si tout marche en Cloud Function après une semaine, tu peux le
   **supprimer**

---

## 🔄 Workflow quotidien après cette mise en place

Tu n'auras **plus jamais** à toucher Firebase CLI. Toutes les modifs
des Cloud Functions (que je te livrerai dans des patches futurs) se
déploieront automatiquement à chaque upload sur GitHub :

```
Mon patch ──► Tu uploades sur GitHub
                    │
                    ├─► Vercel déploie l'app (déjà existant)
                    │
                    └─► GitHub Actions déploie les Cloud Functions
                        (nouveau, automatique)
```

---

## 📋 Spécifications de la Cloud Function

| Paramètre | Valeur |
|---|---|
| Nom | `onSmsQueueCreate` |
| Trigger | Création de doc dans `smsQueue` |
| Région | `europe-west1` (Belgique, proche FR) |
| Runtime | Node.js 20 |
| Timeout | 30 secondes |
| Max instances | 5 (parallélisme) |
| Secrets | `BREVO_API_KEY` |
| Coût estimé | < 1€/mois (gratuit jusqu'à 2M invocations) |

### Logique

1. À la création d'un doc dans `smsQueue` :
2. Lit `recipientPhone` et `message`
3. Vérifie validité (numéro présent, message présent)
4. POST API Brevo `/v3/transactionalSMS/sms` avec sender `EPJ`
5. Si succès → met à jour le doc : `status: "sent"`, `sentAt: now`,
   `brevoMessageId`
6. Si échec → `status: "failed"`, `failureReason: "..."`

### Logs

Pour voir les logs en temps réel :

```bash
firebase functions:log
```

Ou dans Firebase Console → Functions → Logs.

---

## 🔐 Sécurité

- **Clé Brevo** : en SECRET côté Firebase, invisible publiquement
- **Service Account GitHub** : permissions minimales (Cloud Functions
  Admin uniquement, pas accès aux données Firestore)
- **L'app React** ne contient AUCUN secret Brevo
- **Le repo GitHub** ne contient AUCUN secret Brevo
- Si fuite du fichier JSON GitHub : tu peux le révoquer en 1 clic
  dans Google Cloud Console → IAM

---

## 💸 Coût mensuel estimé

| Service | Avant v10.O | Après v10.O |
|---|---|---|
| Make Core | ~10€ | ❌ supprimé |
| Zapier Pro (Esabora) | ~26€ | ~26€ (inchangé) |
| Firebase Blaze | 0€ | < 1€ |
| **Total** | ~36€ | **~27€** |

**Économie : ~9€/mois** (+ stabilité dramatiquement améliorée).

---

## ✅ Validation

```
Tests app          : 350/350 OK
Build Vite         : 122 modules transformés
Cloud Function     : syntax OK, dépendances OK
GitHub Actions     : workflow YAML validé
```

---

## 🆘 Si quelque chose plante

### Le workflow GitHub Actions échoue

→ Onglet Actions → clique le run rouge → regarde quel step a échoué.
Cause probable :
- `FIREBASE_SERVICE_ACCOUNT` mal collé (manque accolades, etc.)
- Rôles manquants sur le compte de service Google Cloud

### Les SMS ne partent pas après upload

→ Firebase Console → Functions → vérifie que `onSmsQueueCreate`
apparaît bien dans la liste, en région `europe-west1`.
→ Si oui : Logs → cherche les erreurs.
→ Si absent : le workflow GitHub Actions a échoué, vérifie l'onglet
Actions GitHub.

### Erreur "BREVO_API_KEY non configurée côté serveur"

→ Tu as oublié l'étape 3 (`firebase functions:secrets:set BREVO_API_KEY`).

### Erreur HTTP 401 ou 403 de Brevo

→ La clé Brevo est invalide ou expirée. Régénère-la dans Brevo
(Settings → SMTP & API → API Keys) et refais l'étape 3.

---

## 🎯 Prochaines étapes possibles

Maintenant que Cloud Functions est en place, tu pourras facilement
ajouter :
- **Cron quotidien** Direction (récap chaque matin par email)
- **Trigger Firestore** pour générer le PDF commande automatiquement
- **OCR AR/BL fournisseurs** côté serveur (clé OpenAI en SECRET)
- **Webhook retour Esabora** (quand ils ouvriront l'API)

Tout sera du code dans `functions/` qui sera déployé automatiquement
via GitHub Actions.

# 📦 Brique Mail v1.13.0 — fichiers prêts pour GitHub

## ⚠️ Correction importante vs livraisons précédentes

Ma version précédente avait un `package.json` et `index.js` **incomplets** :
- Manquait `@google-cloud/storage` et `google-auth-library` (utilisés par `backups.js`)
- Manquait les exports de `backups.js` dans `index.js`

→ Cette livraison **conserve TOUT ce qui existait déjà** (Brevo, Admin Users, Backups) **+ ajoute la brique mail**.

---

## 🎯 5 fichiers à déposer sur GitHub

Chacun va à un emplacement précis dans ton repo `EPJ-Commandes-v1.2`.

| Fichier dans ce ZIP | Emplacement dans le repo GitHub | Action |
|---|---|---|
| `index.js` | `functions/index.js` | 🔄 REMPLACER |
| `package.json` | `functions/package.json` | 🔄 REMPLACER |
| `main.yml` | `.github/workflows/main.yml` | 🔄 REMPLACER |
| `gmailPoll.js` | `functions/gmailPoll.js` | 🆕 NOUVEAU |
| `gmailSend.js` | `functions/gmailSend.js` | 🆕 NOUVEAU |

---

## ✅ Procédure pas à pas sur GitHub

### Pour chaque fichier à REMPLACER

1. Va sur ton repo `EPJ-Commandes-v1.2`
2. Navigue vers le fichier (par exemple `functions/index.js`)
3. Clic sur le fichier pour l'ouvrir
4. Clic crayon ✏️ en haut à droite (Edit this file)
5. Cmd+A pour tout sélectionner, supprime
6. Ouvre le fichier correspondant du ZIP avec TextEdit
7. Cmd+A → copie tout
8. Colle dans GitHub
9. Tout en bas : **"Commit changes..."** → bouton vert **"Commit changes"**

### Pour chaque fichier NOUVEAU

1. Dans le repo, navigue vers `functions/`
2. Clic **"Add file"** → **"Create new file"**
3. Nom du fichier (exactement) : `gmailPoll.js` (puis pareil pour `gmailSend.js`)
4. Colle le contenu du fichier du ZIP
5. **"Commit changes..."** → **"Commit changes"**

---

## 🚀 Déploiement automatique

Une fois les 5 fichiers en place sur GitHub :
- Soit tu attends le **prochain push** sur `main` qui modifie `functions/`
- Soit tu déclenches manuellement : onglet **Actions** → **Deploy Cloud Functions** → **Run workflow** → branche `main`

Le workflow va :
1. ✅ Stocker les 4 secrets Gmail/Anthropic dans Google Secret Manager
2. ✅ Installer toutes les dépendances (firebase + google-cloud + googleapis)
3. ✅ Déployer **toutes** les fonctions : Brevo SMS, Admin Users, Backups, gmailPoll, gmailSend

---

## 🧪 Tests après déploiement

| Test | Action | Attendu |
|---|---|---|
| Brevo SMS toujours OK | Déclencher un SMS depuis l'app | ✅ envoyé via Brevo (rien cassé) |
| Backup hebdo toujours OK | Vérifier dans Functions logs après dimanche 3h du matin | ✅ Backup créé |
| Aspiration mail | Envoyer un mail vers `sav@epj-electricite.com` avec sujet `[RES-XXX] test` | ✅ Mail visible dans la fiche réserve XXX en 2 min |
| Mail à classer | Envoyer un mail générique vers `sav@` | ✅ Apparaît dans `reserveMailsAClasser` avec proposition Claude |
| Envoi sortant | Bouton "Répondre par mail" depuis une fiche réserve | ✅ Mail reçu par destinataire, expéditeur = sav@ |

---

## 📊 Suivi

- Logs Cloud Functions : **Firebase Console → Functions → Logs**
- Stats globales : **Firestore → `gmailConfig/main`** → champs `statsAspires`, `statsRattachesAuto`, `statsAClasser`

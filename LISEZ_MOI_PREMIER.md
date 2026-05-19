# 📦 Fichiers à mettre dans GitHub — Brique Timeline Mail v1.13.0

> Ces 8 fichiers + 1 patch vont dans ton dépôt **EPJ-Commandes-v1.2**.
> **AUCUN fichier existant n'est supprimé** — on ajoute uniquement.

---

## 🎯 Mapping exact des fichiers vers ton repo

Voici **où copier chaque fichier** dans ton repo GitHub :

```
EPJ-Commandes-v1.2/                                  ← ton dépôt actuel
│
├─ src/
│  │
│  ├─ core/
│  │  └─ gmail/                                      ← 🆕 NOUVEAU DOSSIER À CRÉER
│  │     └─ useReserveMails.js                       ← 🆕 NOUVEAU FICHIER
│  │
│  └─ modules/
│     └─ reserves/
│        ├─ ReserveDetail.jsx                        ← ⚠️ FICHIER EXISTANT À MODIFIER (cf. patch)
│        ├─ MailTimeline.jsx                         ← 🆕 NOUVEAU FICHIER
│        ├─ MailItem.jsx                             ← 🆕 NOUVEAU FICHIER
│        ├─ MailReplyComposer.jsx                    ← 🆕 NOUVEAU FICHIER
│        └─ MailsAClasser.jsx                        ← 🆕 NOUVEAU FICHIER
│
└─ functions/
   ├─ gmailPoll.js                                   ← 🆕 NOUVEAU FICHIER
   └─ gmailSend.js                                   ← 🆕 NOUVEAU FICHIER
```

---

## ✅ Étape par étape

### 1. Copier les 5 fichiers frontend

| Depuis ce dossier | Vers ton repo GitHub |
|---|---|
| `src/core/gmail/useReserveMails.js` | `src/core/gmail/useReserveMails.js` |
| `src/modules/reserves/MailTimeline.jsx` | `src/modules/reserves/MailTimeline.jsx` |
| `src/modules/reserves/MailItem.jsx` | `src/modules/reserves/MailItem.jsx` |
| `src/modules/reserves/MailReplyComposer.jsx` | `src/modules/reserves/MailReplyComposer.jsx` |
| `src/modules/reserves/MailsAClasser.jsx` | `src/modules/reserves/MailsAClasser.jsx` |

⚠️ Note : le dossier `src/core/gmail/` n'existe pas encore dans ton repo, il faut le créer.

### 2. Copier les 2 fichiers Cloud Functions

| Depuis ce dossier | Vers ton repo GitHub |
|---|---|
| `functions/gmailPoll.js` | `functions/gmailPoll.js` |
| `functions/gmailSend.js` | `functions/gmailSend.js` |

### 3. Modifier `src/modules/reserves/ReserveDetail.jsx`

C'est le **SEUL** fichier existant à toucher.

Suivre les instructions exactes dans **`PATCH_ReserveDetail.txt`**. Il y a 3 ajouts à faire :
- **Patch 1** : 2 lignes d'import en haut
- **Patch 2** : 2 lignes dans le composant (récupération mails + events)
- **Patch 3** : insertion du bloc `<MailTimeline>` dans le JSX

### 4. Mettre à jour `functions/package.json`

Ajouter la dépendance `googleapis` :

```bash
cd functions
npm install googleapis@^140 --save
```

### 5. Commit + déployer

```bash
git add src/core/gmail/ \
        src/modules/reserves/MailTimeline.jsx \
        src/modules/reserves/MailItem.jsx \
        src/modules/reserves/MailReplyComposer.jsx \
        src/modules/reserves/MailsAClasser.jsx \
        src/modules/reserves/ReserveDetail.jsx \
        functions/gmailPoll.js \
        functions/gmailSend.js \
        functions/package.json \
        functions/package-lock.json

git commit -m "feat(reserves): brique timeline mail v1.13.0 - aspiration sav@ + IA Claude"

git push

# Frontend (Vercel)
vercel --prod

# Cloud Functions (Firebase) — UNIQUEMENT après création boîte sav@ + OAuth
firebase deploy --only functions:gmailPoll,functions:gmailSend
```

---

## ⚠️ Ordre important

Tu peux faire les étapes 1-3 **dès maintenant** et déployer côté frontend (Vercel).

**MAIS** : ne déploie pas les Cloud Functions (`gmailPoll`, `gmailSend`) tant que tu n'as pas :
1. Créé la boîte `sav@epj-electricite.com` dans Google Workspace
2. Configuré l'OAuth Gmail (voir `A_GARDER_LOCAL/docs/NOTICE_ADMIN_WORKSPACE.md`)
3. Renseigné les credentials dans Firebase Functions config

Sinon les Cloud Functions vont logger des erreurs en boucle dès leur déploiement.

**→ Tant que ça n'est pas fait, le frontend marche très bien tout seul :**
- Le composant `<MailTimeline>` apparaît dans la fiche réserve
- Il affiche l'état vide "Aucun mail rattaché — les mails déplacés dans la boîte sav@ seront aspirés automatiquement"
- Les notes internes fonctionnent
- La timeline des événements internes (création, attribution, RDV, levée, quitus) fonctionne
- Le bouton "Répondre par mail" sera juste inactif jusqu'à l'activation

---

## 🔍 Récapitulatif rapide

| Action | Effort | Risque |
|---|---|---|
| Copier 5 fichiers frontend | 1 min | Nul |
| Copier 2 fichiers backend | 1 min | Nul |
| Patcher ReserveDetail.jsx | 5 min | Faible (3 ajouts simples) |
| `npm install googleapis` dans functions | 30 sec | Nul |
| `git push` + `vercel --prod` | 2 min | Nul (déploiement frontend) |
| `firebase deploy` des Cloud Functions | À FAIRE PLUS TARD | Après config OAuth |

**Total Phase A : ~10 minutes.**

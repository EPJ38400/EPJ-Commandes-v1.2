# PLAN L2b — Notifier le bureau d'études à la saisie de `jourDemande` (Pieuvres)

> **Statut : PLAN, aucun code écrit.** Branche `feature/l2b-notif-be`. J'attends **« GO L2b »**.
> Pas de modif `permissions.js`, **aucune écriture `chantiers`**, `CommandesInner` intouché.

---

## 1) Mécanisme mail réel + schéma `mailOutbox` (vérifié dans le code)

**Le tuyau `mailOutbox → gmailSend` est LIVE et confirmé.** `functions/gmailSend.js` :
- Trigger **`onDocumentCreated` sur `mailOutbox/{docId}`** (l.37-44), région europe-west1,
  exporté dans `index.js:173` (`export { gmailSend } from "./gmailSend.js"`). **Seul trigger
  sur `mailOutbox`** (pas de concurrent).
- **Skip si `statut !== "pending"`** (l.52) → le doc doit naître `statut:"pending"`.
- **Schéma lu** par la fonction (champs effectivement consommés) :
  - `statut: "pending"` (obligatoire)
  - `to: string[]` → `(draft.to||[]).join(", ")` (l.86)
  - `cc: string[]` (l.87, optionnel)
  - `sujet: string` (l.77) — préfixe `[RES-xxx]` ajouté **seulement si** `reserveNum` présent (l.78)
  - `corps: string` (texte brut → HTML via `textToHtml`, l.89/175)
  - `reserveId` / `reserveNum` (optionnels) → si `reserveId`, archive une copie dans `reserveMails` (l.102-132). **Absents ici → pas d'archivage, juste l'envoi.**
  - `gmailThreadId` (optionnel) ; `senderUserId` (tracé dans l'archive)
- Après envoi : `statut:"sent"` puis **delete auto au bout de 60 s** (l.135-142). Sur erreur : `statut:"failed"` + `erreur`.
- **Règle Firestore `mailOutbox`** (l.140) : `create: if isEmployee()` → **l'app peut créer le doc côté client** (update/delete = `false`, réservé aux functions). ✅ aucune modif de règle pour `mailOutbox`.

```js
// MIME construit (l.158-173) : From / To / Cc / Subject / MIME 1.0 / text-html base64
buildMime({ from, to, cc, subject, body })   // ⚠️ PAS de Reply-To géré aujourd'hui
```

## 1bis) Expéditeur du mail — mécanisme retenu : **Reply-To** (pas de From usurpé)

**Vérif `gmailSend.js`** : le `From` est **hardcodé** `EPJ Électricité — SAV <sav@…>`
(`SENDER_NAME` l.33 + `config.boiteEmail || sav@` l.64). Le refresh token OAuth est **celui
de la boîte `sav@` uniquement** ; `gmail.users.messages.send({userId:"me"})` envoie depuis le
compte authentifié. **Aucun mécanisme send-as / délégation domaine Workspace** n'est câblé,
et la seule boîte capable d'**envoyer** est `sav@` (`achat@` est en scope `gmail.modify` =
brouillons, pas d'envoi).

→ **Réponse : NON, on ne peut pas envoyer « as » l'adresse de l'utilisateur.** Forcer un
`From` à `@epj-electricite.com` ≠ compte authentifié ferait échouer SPF/DKIM (ou serait
réécrit par Gmail). **Mécanisme retenu** :

- **From** = boîte système `sav@` (inchangé, From légitime).
- **Reply-To** = `"{Prénom NOM}" <{email de l'utilisateur connecté}>` → le BE répond
  **directement au conducteur/chef** qui a saisi la date.
- Adresse émetteur : `user.email` (fiche `utilisateurs` du user courant, exposée par
  `useAuth()`), **fallback `chantier.emailConducteur`** (champ réel, cf. `initFirestore.js`),
  fallback final = pas de Reply-To.

⚠️ **`buildMime` ne gère pas Reply-To aujourd'hui** → L2b nécessite **une modif additive
minimale de `functions/gmailSend.js`** (change Cloud Function → **GO requis + déploiement CI
functions** au merge). Wiring proposé, **non implémenté avant GO** :

```diff
 function buildMime({ from, to, cc, subject, body }) {
   const lines = [];
   lines.push(`From: ${from}`);
   lines.push(`To: ${to}`);
   if (cc) lines.push(`Cc: ${cc}`);
+  if (replyTo) lines.push(`Reply-To: ${replyTo}`);   // depuis draft.replyTo
   ...
 }
```
(+ passer `replyTo: draft.replyTo` à l'appel `buildMime` l.83, en composant le display name).
**Strictement additif** : sans `replyTo`, comportement historique identique (réserves intactes).

> Alternative si tu refuses toute modif functions : envoi depuis `sav@` **sans** Reply-To
> (le BE répondrait à `sav@`). Je déconseille — ça casse l'objectif « le BE répond au
> conducteur ». Le diff ci-dessus est minimal et non régressif.

---

## 2) Fichiers à créer / modifier

### Modifier
- **`src/modules/gestion-chantier/PieuvresTab.jsx`** — dans la sauvegarde de `jourDemande` :
  détecter la **transition** (cf. §4), et si transition → écrire **(a)** un doc `notifications`
  (enregistrement durable) **(b)** un doc `mailOutbox` (`statut:"pending"`, `to:[emailEtudes]`,
  `sujet`/`corps`, `replyTo`), **(c)** mettre à jour les flags anti-renvoi sur la pieuvre.
  Lit `emailEtudes` via `useData().config?.emailEtudes || "etude@epj-electricite.com"`.
  Émetteur via `useAuth().user` (email/prénom/nom) + fallback `chantier.emailConducteur`.
- **`src/modules/gestion-chantier/pieuvresModel.js`** — helpers **purs** : `buildBeMail({chantier,
  batiment, niveau, dateFr, emetteur})` → `{sujet, corps}` ; `buildBeNotification(...)` → objet
  doc `notifications` ; clé de dédup `dateKey` (= `"YYYY-MM-DD"`). Ajouter les champs de flag
  au doc pieuvre (cf. §4).
- **`functions/gmailSend.js`** — Reply-To additif (cf. §1bis). **GO + déploiement functions.**
- **`firestore.rules`** — collection `notifications` (diff §3).
- **`src/pages/admin/AdminSettings.jsx`** — champ éditable **« E-mail bureau d'études »**
  (`emailEtudes`) dans le formulaire `config/settings` (lecture/écriture déjà en merge l.48-50),
  défaut `etude@epj-electricite.com`. Permet à PJ de changer l'adresse sans code.

### Créer
- **(aucun fichier)** — `notifications` est une collection Firestore neuve (pas de fichier).

### NE PAS toucher
`permissions.js`, `chantiers` (zéro écriture), `CommandesInner.jsx`, la règle `mailOutbox`
(création client déjà permise), le rendu cockpit BE (hors scope L2b).

---

## 3) Diff proposé `firestore.rules` — collection `notifications`

Additif, calqué sur `reserves`/`commandes`. `update` permis (futur cockpit BE marquera `lu`),
`delete` admin. Inséré après le bloc `pieuvres` :

```diff
     match /pieuvres/{id} {
       allow read: if isEmployee();
       allow create, update: if isEmployee();
       allow delete: if isConducteur();
     }
+
+    // ─── notifications/{id} — journal durable d'événements (ex. demande BE) ──
+    // Lu par les futurs cockpits (BE…). Créé par l'app, lu/maj par tout employé
+    // (marquage "lu"), suppression admin. Calque reserves/commandes.
+    match /notifications/{id} {
+      allow read: if isEmployee();
+      allow create, update: if isEmployee();
+      allow delete: if isAdmin();
+    }
```
> ⚠️ Règle déployée par le CI au merge `main` (étape « Deploy Firestore rules » de `main.yml`,
> `firestore.rules` dans `paths`). Sinon `permission-denied`.

**Schéma `notifications/{auto}`** (doc neuf) :
```
type: "PIEUVRE_DEMANDE_BE"
chantierId, chantierNum, chantierNom
batiment, niveau, posteAvancementKey, pieuvreId
dateDemandee: Timestamp            // valeur de jourDemande
destinataire: string               // emailEtudes au moment de l'envoi
emetteurUserId, emetteurNom, emetteurEmail
mailOutboxId: string | null        // ref du doc mailOutbox créé (traçabilité)
lu: false                          // pour le futur cockpit BE
createdAt: serverTimestamp()
```

---

## 4) Logique exacte de déclenchement + debounce

**Flags ajoutés sur le doc pieuvre** (en plus du schéma L2) :
- `demandeBeNotifieeLe: Timestamp | null` — horodatage du dernier envoi (audit).
- `demandeBeNotifieePourDate: "YYYY-MM-DD" | null` — la date `jourDemande` déjà notifiée.

**Règle de transition** (dans le `onChange` de `jourDemande`, AVANT/PENDANT le save) :
```
saveJourDemande(row, newInputDate):           // newInputDate = "YYYY-MM-DD" ou ""
  newKey      = newInputDate || null
  lastNotified = row.demandeBeNotifieePourDate || null
  patch = { jourDemande: inputToTs(newInputDate), updatedAt: serverTimestamp() }

  // transition = nouvelle date NON nulle ET différente de la dernière notifiée
  if (canEdit && newKey && newKey !== lastNotified):
     emetteur = { email: user.email || chantier.emailConducteur || null,
                  nom: `${user.prenom} ${user.nom}`.trim(), userId: user.id }
     emailEtudes = config.emailEtudes || "etude@epj-electricite.com"
     // (a) journal durable
     notifId = await addDoc("notifications", buildBeNotification(...))
     // (b) mail sortant (envoi sav@, Reply-To = émetteur)
     await addDoc("mailOutbox", { statut:"pending", to:[emailEtudes],
                  ...buildBeMail(...), replyTo: emetteur.email ? `"${emetteur.nom}" <${emetteur.email}>` : null,
                  senderUserId: user.id, notifId, createdAt: serverTimestamp() })
     // (c) flags anti-renvoi
     patch.demandeBeNotifieeLe = serverTimestamp()
     patch.demandeBeNotifieePourDate = newKey

  await setDoc(pieuvre, patch, { merge:true })
```

**Couverture des cas (brief)** :
- `null → date` : `lastNotified=null`, `newKey=date` → diffèrent → **notifie**. ✅
- `date → autre date` : `newKey ≠ lastNotified` → **notifie**. ✅
- **re-save même date** (ou édition d'un AUTRE champ) : `newKey === lastNotified` (ou `jourDemande`
  pas touché) → **pas de renvoi**. ✅ (anti-spam à chaque save)
- `date → null` (effacement) : `newKey=null` → **pas d'envoi**, flags conservés (si on re-saisit la
  même date plus tard, elle ≠ `null`… elle = `lastNotified` → toujours pas de renvoi ; re-notifie
  seulement si NOUVELLE date). Comportement voulu : on ne spamme pas le BE pour une date déjà demandée.
- **Robustesse** : la notification (`notifications` + `mailOutbox`) est écrite **avant** le patch
  des flags ; si l'écriture mail échoue, on attrape l'erreur (état « réessayer » existant, fix L2)
  et on **ne pose pas** les flags → re-tentable. Le doc `notifications` est le journal de vérité ;
  l'envoi mail est best-effort (gmailSend gère ses propres `failed`).

---

## 5) Après GO — exécution
1. Modifs sur `feature/l2b-notif-be` (PieuvresTab + pieuvresModel + AdminSettings + firestore.rules
   + gmailSend.js Reply-To).
2. `npm run build` + tests + `git fetch origin` + `git diff origin/main`.
3. Commits atomiques : `feat(gestion-chantier): notif BE à la saisie jourDemande` ·
   `feat(functions): Reply-To sur gmailSend (additif)` · `security(rules): collection notifications` ·
   `feat(admin): champ emailEtudes`.
4. Push branche → preview + checklist. **Pas de merge `main`** (ton geste).
   ⚠️ Le mail BE ne partira **réellement** qu'après déploiement des **functions** (Reply-To) ET
   des **rules** (notifications) — les deux passent par le CI au merge `main`.

---

**STOP — j'attends ton « GO L2b ».** Confirme notamment l'OK pour la **modif `gmailSend.js`
(Reply-To additif)** — c'est la seule retouche Cloud Function du lot.

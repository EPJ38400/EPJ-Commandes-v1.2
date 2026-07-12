// ═══════════════════════════════════════════════════════════════
//  functions/index.js — v2.0.0
//
//  Cloud Function Firebase qui REMPLACE le scénario Make "SMS Queue → Brevo".
//
//  v2.0.0 changes :
//   • purgeSmsQueue ACTIVÉE (Cloud Scheduler quotidien 03:00 Paris)
//   • Backup Storage hebdo ajouté (cf. backups.js)
//
//  Déclenchement : à la création d'un document dans Firestore collection
//  "smsQueue" (mêmes docs que ceux que l'app pose aujourd'hui).
//
//  Action :
//    1. Lit le doc (recipient, message, etc.)
//    2. POST API Brevo /v3/transactionalSMS/sms
//    3. Met à jour le doc : status=sent + sentAt, ou status=failed + erreur
//
//  La clé Brevo est stockée comme SECRET Firebase (jamais visible publiquement).
//
//  Pour déployer :
//    - localement : `firebase deploy --only functions`
//    - automatiquement : GitHub Actions à chaque push (voir .github/workflows/)
// ═══════════════════════════════════════════════════════════════

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import admin from "firebase-admin";

// Initialise Firebase Admin SDK (auto-config avec les credentials du compte de service)
admin.initializeApp();
const db = admin.firestore();

// Région la plus proche de la France : Belgium (europe-west1).
// Toutes les fonctions de ce projet tourneront ici.
setGlobalOptions({ region: "europe-west1", maxInstances: 5 });

// La clé API Brevo est un SECRET (jamais visible dans le code, jamais committée).
// Sera renseignée via `firebase functions:secrets:set BREVO_API_KEY`.
const BREVO_API_KEY = defineSecret("BREVO_API_KEY");

// ─── Numéro émetteur Brevo (Sender) ─────────────────────────
// "EPJ" est le sender alphanumérique configuré côté Brevo.
// Doit être validé dans le compte Brevo avant de pouvoir l'utiliser.
const SMS_SENDER = "EPJ";

// ─── Fonction principale ────────────────────────────────────

export const onSmsQueueCreate = onDocumentCreated(
  {
    document: "smsQueue/{docId}",
    secrets: [BREVO_API_KEY],
    timeoutSeconds: 30,
  },
  async (event) => {
    const snap = event.data;
    if (!snap) {
      console.warn("[v10.O] Event sans snapshot, on ignore");
      return;
    }

    const docId = event.params.docId;
    const data = snap.data() || {};
    console.log(`[v10.O] SMS à envoyer pour doc ${docId}`, {
      type: data.type,
      templateCode: data.templateCode,
      recipientName: data.recipientName,
    });

    // ─── Validations ───
    if (data.status === "sent") {
      console.log(`[v10.O] ${docId} déjà sent, skip`);
      return;
    }
    const phone = data.recipientPhone;
    const message = data.message;
    if (!phone) {
      await markFailed(docId, "Pas de numéro de téléphone");
      return;
    }
    if (!message) {
      await markFailed(docId, "Pas de message rendu");
      return;
    }

    // ─── Envoi Brevo ───
    try {
      const apiKey = BREVO_API_KEY.value();
      if (!apiKey) {
        await markFailed(docId, "BREVO_API_KEY non configurée côté serveur");
        return;
      }

      const response = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
        method: "POST",
        headers: {
          "accept": "application/json",
          "api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          sender: SMS_SENDER,
          recipient: phone,
          content: message,
          type: "transactional",
        }),
      });

      let body = null;
      try { body = await response.json(); } catch { body = await response.text(); }

      if (!response.ok) {
        const err = `HTTP ${response.status} — ${JSON.stringify(body)}`;
        await markFailed(docId, err);
        console.error(`[v10.O] Brevo refuse : ${err}`);
        return;
      }

      // Succès : marque sent
      await db.collection("smsQueue").doc(docId).update({
        status: "sent",
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        brevoMessageId: body?.messageId || body?.reference || null,
        brevoResponse: body || null,
      });
      console.log(`[v10.O] ✓ SMS envoyé ${docId} → ${data.recipientName} (${phone})`);
    } catch (err) {
      const msg = err?.message || String(err);
      await markFailed(docId, msg);
      console.error(`[v10.O] Erreur envoi ${docId} : ${msg}`);
    }
  }
);

async function markFailed(docId, reason) {
  try {
    await db.collection("smsQueue").doc(docId).update({
      status: "failed",
      failedAt: admin.firestore.FieldValue.serverTimestamp(),
      failureReason: reason || "raison inconnue",
    });
  } catch (e) {
    console.error(`[v10.O] Impossible de marquer ${docId} failed : ${e.message}`);
  }
}

// ─── Fonctions admin (gestion utilisateurs) ──────────────────
// Cf. functions/adminUsers.js — v1.14.0 / v1.16.0
export {
  adminCreateUser,
  adminUpdateUser,
  adminResetPassword,
  adminDeleteUser,
  adminToggleDisabled,
  clearMustResetPassword,
} from "./adminUsers.js";

// ─── Module RH / Frais — adresses salariés (RH-Frais-2a-bis) ──
// La saisie a migré : adresseDomicile/pointDepartFrais sont désormais écrits
// par adminUpdateUser (fiche utilisateur, AdminUsers). L'ancienne callable
// setAdresseSalarie a été retirée (doublon).

// ─── Fonctions backup Firestore + Storage ───────────────────
// Cf. functions/backups.js — v2.0.0
export {
  weeklyFirestoreBackup,
  weeklyStorageBackup,
  adminTriggerBackup,
  adminListBackups,
} from "./backups.js";

// ─── Brique Mail — v1.13.0 ────────────────────────────────────
// Cf. functions/gmailPoll.js et functions/gmailSend.js
// Aspire la boîte sav@epj-electricite.com toutes les 2 minutes,
// rattache automatiquement les mails aux réserves, et envoie les
// mails sortants depuis l'app via Gmail API.
export { gmailPoll, forceSyncGmail } from "./gmailPoll.js";
export { gmailSend } from "./gmailSend.js";

// ─── Module Commande — étape 1 : Pull Esabora ─────────────────
// Cf. functions/esaboraImport.js
// Webhook HTTP Zapier (entête commande Esabora) → tri 3 cas →
// commandesEsabora/{numero}. Sweep planifié reprend les pending.
export { esaboraWebhook, esaboraSweep } from "./esaboraImport.js";

// ─── Module Commande — étape 3 : AR achat@ + price-watch ──────
// Cf. functions/gmailPollAchat.js (via functions/lib/gmailCore.js)
// Aspire achat@, matche le numero Esabora sur commandesEsabora/{numero},
// extrait copie de commande (@esabora.solutions) + AR fournisseur via Claude,
// contrôle les écarts de prix ligne à ligne, marque les AR manquants.
export { gmailPollAchat, forceSyncAchat } from "./gmailPollAchat.js";

// ─── Module Commande — Dashboard achat V2 : réclamations / clôtures ──
// Cf. functions/prepareAchatReclamation.js + functions/clotureEcartAchat.js
// prepareAchatReclamation : gabarit déterministe (pas d'IA) — mode "ecart"
// (prix + quantités) ou "relance" (AR manquant) → brouillon créé dans achat@
// → écarts de prix passent "RECLAME". Contacts résolus/capturés dans la
// collection fournisseurs (source unique).
// clotureEcartAchat : clôt un écart (ACCORDE | REFUSE | ABANDONNE) → "RESOLU".
// Écritures service account (achatEcartsPrix en lecture seule côté rules client).
export { prepareAchatReclamation } from "./prepareAchatReclamation.js";
export { clotureEcartAchat } from "./clotureEcartAchat.js";

// ─── Labels Gmail automatiques — v1.18.0 ──────────────────────
// Cf. functions/gmailLabels.js
// Quand un mail dans reserveMailsAClasser passe au statut "classe"
// (depuis l'app, après création ou rattachement à une réserve), on
// applique le label Gmail correspondant au chantier (format
// "EPJ/<num> — <nom>"), on retire INBOX, et on retire le label
// "EPJ/A-classer". Les labels Gmail sont créés avec
// messageListVisibility=hide donc invisibles dans les clients IMAP
// (eM Client, Outlook, etc.) : le classement reste côté serveur
// Gmail uniquement pour ne pas alourdir les boîtes locales.
export { onMailAClasserUpdate } from "./gmailLabels.js";

// ─── Fonction de purge ───────────────────────────────────────
// v2.0.0 — ACTIVÉE : supprime les docs smsQueue avec status="sent"
// après 24h pour éviter que la collection grossisse indéfiniment.
// Trigger Cloud Scheduler programmé tous les jours à 03:00 (Paris).

import { onSchedule } from "firebase-functions/v2/scheduler";

export const purgeSmsQueue = onSchedule(
  {
    schedule: "0 3 * * *",
    timeZone: "Europe/Paris",
    region: "europe-west1",
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async () => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const snap = await db.collection("smsQueue")
      .where("status", "==", "sent")
      .where("sentAt", "<", cutoff)
      .get();
    if (snap.empty) {
      console.log("[purgeSmsQueue] Aucun SMS à purger");
      return;
    }
    // Batch limité à 500 ops Firestore — si plus, on chunke
    const docs = snap.docs;
    let total = 0;
    for (let i = 0; i < docs.length; i += 500) {
      const batch = db.batch();
      docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
      await batch.commit();
      total += Math.min(500, docs.length - i);
    }
    console.log(`[purgeSmsQueue] ✓ ${total} docs supprimés`);
  }
);

// ─── Module Planning — récap SMS monteurs (cron) ──────────────
// Cf. functions/planningSms.js
// Enfile des SMS dans smsQueue (consommés par onSmsQueueCreate → Brevo).
// planningSmsRecap : lun-ven 15h30 → planning du prochain jour ouvré.
// planningSmsRappelLundi : lundi 7h00 → rappel du planning du jour.
// MONTEURS UNIQUEMENT. Écrit smsQueue ; lit planningCreneaux/chantiers/utilisateurs.
export { planningSmsRecap, planningSmsRappelLundi } from "./planningSms.js";

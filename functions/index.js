// ═══════════════════════════════════════════════════════════════
//  functions/index.js — v10.O
//
//  Cloud Function Firebase qui REMPLACE le scénario Make "SMS Queue → Brevo".
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
import * as admin from "firebase-admin";

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

// ─── Fonction de purge ───────────────────────────────────────
// Supprime les docs smsQueue avec status="sent" après 24h
// pour éviter que la collection grossisse indéfiniment.
// Trigger : programmable via Cloud Scheduler (à activer plus tard si besoin).
// Pour l'instant non exporté → on garde une trace des envois sur quelques jours.
// Si la collection grossit trop, exporter cette fonction comme onSchedule.

// import { onSchedule } from "firebase-functions/v2/scheduler";
// export const purgeSmsQueue = onSchedule("every day 03:00", async () => {
//   const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
//   const snap = await db.collection("smsQueue")
//     .where("status", "==", "sent")
//     .where("sentAt", "<", cutoff)
//     .get();
//   const batch = db.batch();
//   snap.docs.forEach(d => batch.delete(d.ref));
//   await batch.commit();
//   console.log(`[v10.O] Purge : ${snap.size} docs supprimés`);
// });

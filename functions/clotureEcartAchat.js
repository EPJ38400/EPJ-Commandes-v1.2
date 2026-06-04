// ═══════════════════════════════════════════════════════════════
//  functions/clotureEcartAchat.js — Module Commande, Dashboard achat V2
//
//  Callable HTTPS : clôture un écart de prix (achatEcartsPrix/{ecartId}).
//  L'utilisateur (Assistante+) tranche le sort d'un écart :
//    • ACCORDE   — le fournisseur a régularisé / accepte l'avoir.
//    • REFUSE    — le fournisseur refuse.
//    • ABANDONNE — on laisse tomber.
//  → statut = "RESOLU" + traçabilité (qui / quand / raison / commentaire).
//
//  Écriture en service account (merge) : les rules client gardent
//  achatEcartsPrix en lecture seule. Aucune autre collection touchée.
// ═══════════════════════════════════════════════════════════════

import { onCall, HttpsError } from "firebase-functions/v2/https";
import admin from "firebase-admin";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const COL_ECARTS = "achatEcartsPrix";
const RAISONS = ["ACCORDE", "REFUSE", "ABANDONNE"];
const PILOTAGE = ["Admin", "Direction", "Conducteur travaux", "Assistante"];

export const clotureEcartAchat = onCall(
  { region: "europe-west1", timeoutSeconds: 30, memory: "256MiB" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Vous devez être connecté.");
    }
    const role = request.auth.token?.role;
    if (!PILOTAGE.includes(role)) {
      throw new HttpsError("permission-denied", "Réservé aux rôles de pilotage.");
    }

    const ecartId = String(request.data?.ecartId || "").trim();
    const raison = String(request.data?.raison || "").trim();
    const commentaire = request.data?.commentaire != null
      ? String(request.data.commentaire).slice(0, 2000)
      : null;

    if (!ecartId) {
      throw new HttpsError("invalid-argument", "ecartId manquant.");
    }
    if (!RAISONS.includes(raison)) {
      throw new HttpsError("invalid-argument", `raison invalide (attendu : ${RAISONS.join(" | ")}).`);
    }

    const ref = db.collection(COL_ECARTS).doc(ecartId);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", `Écart ${ecartId} introuvable.`);
    }

    await ref.set({
      statut: "RESOLU",
      clotureRaison: raison,
      clotureCommentaire: commentaire,
      clotureLe: admin.firestore.FieldValue.serverTimestamp(),
      cloturePar: request.auth.uid,
    }, { merge: true });

    return { success: true };
  },
);

// ═══════════════════════════════════════════════════════════════
//  functions/clotureEcartAchat.js — Module Commande, Dashboard achat V2
//
//  Callable HTTPS : clôture TOUS les écarts de prix d'une commande
//  (achatEcartsPrix where numero == numero) en une seule fois.
//  L'utilisateur (Assistante+) tranche le sort de la commande :
//    • ACCORDE   — le fournisseur a régularisé / accepte l'avoir.
//    • REFUSE    — le fournisseur refuse.
//    • ABANDONNE — on laisse tomber.
//  → statut = "RESOLU" + traçabilité (qui / quand / raison / commentaire).
//
//  V2 : une commande = un destin (clôture groupée). La clôture ligne par
//  ligne est une évolution V3 si besoin.
//
//  Écriture en service account (batch merge) : les rules client gardent
//  achatEcartsPrix en lecture seule.
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

    const numero = String(request.data?.numero || "").trim();
    const raison = String(request.data?.raison || "").trim();
    const commentaire = request.data?.commentaire != null
      ? String(request.data.commentaire).slice(0, 2000)
      : null;

    if (!numero) {
      throw new HttpsError("invalid-argument", "numero manquant.");
    }
    if (!RAISONS.includes(raison)) {
      throw new HttpsError("invalid-argument", `raison invalide (attendu : ${RAISONS.join(" | ")}).`);
    }

    const ecartsSnap = await db.collection(COL_ECARTS).where("numero", "==", numero).get();
    if (ecartsSnap.empty) {
      throw new HttpsError("not-found", `Aucun écart pour la commande ${numero}.`);
    }

    const batch = db.batch();
    const now = admin.firestore.FieldValue.serverTimestamp();
    for (const d of ecartsSnap.docs) {
      batch.set(d.ref, {
        statut: "RESOLU",
        clotureRaison: raison,
        clotureCommentaire: commentaire,
        clotureLe: now,
        cloturePar: request.auth.uid,
      }, { merge: true });
    }
    await batch.commit();

    return { success: true, nbEcarts: ecartsSnap.size };
  },
);

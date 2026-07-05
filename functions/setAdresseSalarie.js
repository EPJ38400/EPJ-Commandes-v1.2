// ═══════════════════════════════════════════════════════════════
//  functions/setAdresseSalarie.js — Module RH / Frais (RH-Frais-2a)
//
//  Cloud Function callable qui écrit les 2 champs « frais » sur une fiche
//  utilisateurs :
//    - adresseDomicile   : string
//    - pointDepartFrais  : "DOMICILE" | "DEPOT"  (défaut "DEPOT")
//
//  Pourquoi une Cloud Function (voie b) et PAS un setDoc merge client :
//    La rule `utilisateurs` n'autorise l'update qu'à l'Admin (ou l'utilisateur
//    sur sa propre fiche). Le gestionnaire RH = Direction/Assistante (non-Admin)
//    ne peut donc PAS écrire utilisateurs côté client. On passe par un callable
//    réservé au gestionnaire RH, borné aux 2 seuls champs, via un merge (les
//    autres champs de la fiche ne sont jamais réécrits). Le service account
//    bypasse les rules.
// ═══════════════════════════════════════════════════════════════

import { onCall, HttpsError } from "firebase-functions/v2/https";
import admin from "firebase-admin";

// Lazy (admin.initializeApp() n'est peut-être pas encore appelé au top-level).
const getDb = () => admin.firestore();

// Gestionnaire RH = mêmes rôles que la rule config/fraisDepot & referentielFraisBTP.
const RH_ROLES = ["Admin", "Direction", "Assistante"];

function assertGestionnaireRH(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vous devez être connecté.");
  }
  const role = request.auth.token?.role;
  if (!RH_ROLES.includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "Seul un gestionnaire RH peut modifier les adresses des salariés."
    );
  }
}

export const setAdresseSalarie = onCall(
  { region: "europe-west1", timeoutSeconds: 30 },
  async (request) => {
    assertGestionnaireRH(request);
    const data = request.data || {};

    const id = typeof data.id === "string" ? data.id.trim() : "";
    if (!id) {
      throw new HttpsError("invalid-argument", "Identifiant salarié manquant.");
    }

    const adresseDomicile = typeof data.adresseDomicile === "string" ? data.adresseDomicile.trim() : "";
    // Toute valeur ≠ "DOMICILE" retombe sur le défaut "DEPOT".
    const pointDepartFrais = data.pointDepartFrais === "DOMICILE" ? "DOMICILE" : "DEPOT";

    const ref = getDb().collection("utilisateurs").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", `Utilisateur "${id}" introuvable.`);
    }

    try {
      // Merge STRICT : uniquement les 2 champs frais, jamais le reste de la fiche.
      await ref.set({ adresseDomicile, pointDepartFrais }, { merge: true });
    } catch (err) {
      console.error("[setAdresseSalarie] set:", err);
      throw new HttpsError("internal", `Échec enregistrement de l'adresse : ${err.message}`);
    }

    return { ok: true, id, adresseDomicile, pointDepartFrais };
  }
);

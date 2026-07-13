// ═══════════════════════════════════════════════════════════════
//  computeDistanceFrais — moteur distance routière + composition de
//  l'indemnité « petits déplacements » FBTP (RH-Frais-2b).
//
//  Callable onCall (europe-west1), RÉSERVÉE au gestionnaire RH
//  (claim role ∈ Admin / Direction / Assistante).
//
//  Depuis RH-Frais-3b1, la logique métier (origine / destination / distance
//  + cache + barème) vit dans functions/lib/distanceCore.js (partagée avec
//  genererRecapFrais). Ce fichier n'est plus qu'un WRAPPER callable :
//   1. auth + gate gestionnaire RH,
//   2. resoudreOrigine → resoudreDestination → calculerDistanceCache,
//   3. barème année courante + composerIndemnite (recomposée à chaque appel),
//   4. re-mappe les erreurs `.code` de distanceCore en HttpsError (comportement
//      IDENTIQUE à l'implémentation historique).
//
//  ⚠️ chantiers = LECTURE SEULE. Écrit uniquement fraisDistances (Admin SDK).
// ═══════════════════════════════════════════════════════════════
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";
import { composerIndemnite } from "./lib/fraisZones.js";
import {
  resoudreOrigine, resoudreDestination, calculerDistanceCache, loadBaremeCourant,
} from "./lib/distanceCore.js";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const GOOGLE_MAPS_API_KEY = defineSecret("GOOGLE_MAPS_API_KEY");

const GESTIONNAIRE_RH = ["Admin", "Direction", "Assistante"];

export const computeDistanceFrais = onCall(
  { region: "europe-west1", timeoutSeconds: 60, memory: "256MiB", secrets: [GOOGLE_MAPS_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Vous devez être connecté.");
    }
    const role = request.auth.token?.role;
    if (!GESTIONNAIRE_RH.includes(role)) {
      throw new HttpsError("permission-denied", "Réservé au gestionnaire RH.");
    }

    const salarieId = String(request.data?.salarieId || "").trim();
    const chantierId = String(request.data?.chantierId || "").trim();
    const origineType = request.data?.origineType === "DOMICILE" ? "DOMICILE" : "DEPOT";
    const base = request.data?.base === "transport" ? "transport" : "trajet";
    const force = request.data?.force === true;
    if (!salarieId) throw new HttpsError("invalid-argument", "salarieId manquant.");
    if (!chantierId) throw new HttpsError("invalid-argument", "chantierId manquant.");

    try {
      // ─── a. Origine ─── b. Destination (cascade) ─── c. Distance + cache ───
      const { origineAdresse } = await resoudreOrigine(db, salarieId, origineType);
      const { destinationAdresse } = await resoudreDestination(db, chantierId);
      const { distanceKm, dureeMin, fromCache } = await calculerDistanceCache(db, {
        salarieId,
        chantierNum: chantierId,
        origineType,
        origineAdresse,
        destinationAdresse,
        force,
        mapsKey: GOOGLE_MAPS_API_KEY.value(),
        calculePar: request.auth.uid || "",
        calculeParNom: request.auth.token?.name || request.auth.token?.email || "",
      });

      // ─── d. Barème année courante + composition indemnité ───
      const bareme = await loadBaremeCourant(db);
      if (!bareme) {
        throw new HttpsError("failed-precondition", "Aucun barème FBTP saisi.");
      }
      const indemnite = composerIndemnite(distanceKm, bareme, { repas: true, base });
      if (!indemnite) {
        throw new HttpsError("internal", "Composition de l'indemnité impossible.");
      }

      // ─── e. Réponse ───
      return {
        distanceKm,
        dureeMin,
        origineType,
        origineAdresse,
        destinationAdresse,
        base: indemnite.base,
        nb50: indemnite.nb50,
        reliquat: indemnite.reliquat,
        zoneReliquat: indemnite.zoneReliquat,
        indemnite: {
          deplacement: indemnite.deplacement,
          repas: indemnite.repas,
          total: indemnite.total,
        },
        fromCache,
      };
    } catch (e) {
      if (e instanceof HttpsError) throw e;
      // Erreur métier de distanceCore → re-map sur son code HttpsError.
      throw new HttpsError(e?.code || "internal", e?.message || "Erreur interne.");
    }
  },
);

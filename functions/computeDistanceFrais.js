// ═══════════════════════════════════════════════════════════════
//  computeDistanceFrais — moteur distance routière + composition de
//  l'indemnité « petits déplacements » FBTP (RH-Frais-2b).
//
//  Callable onCall (europe-west1), RÉSERVÉE au gestionnaire RH
//  (claim role ∈ Admin / Direction / Assistante).
//
//  Flux :
//   1. Résout l'origine (DOMICILE = utilisateurs/{id}.adresseDomicile ;
//      DEPOT = config/company `${adresse}, ${codePostal} ${ville}`).
//   2. Résout la destination (chantiers/{id}.adresse — LECTURE SEULE).
//   3. Cache fraisDistances/{salarieId__chantierId__origineType} : si présent,
//      non forcé et origineHash inchangé → réutilise distanceKm (AUCUN appel
//      Google). Sinon → Google Distance Matrix, puis écrit le cache (distance
//      seulement + méta, JAMAIS l'indemnité).
//   4. Recompose l'indemnité à CHAQUE appel depuis le barème de l'année
//      courante (referentielFraisBTP) → jamais figée dans le cache.
//
//  ⚠️ chantiers = LECTURE SEULE. Écrit uniquement fraisDistances (Admin SDK).
// ═══════════════════════════════════════════════════════════════
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import admin from "firebase-admin";
import crypto from "node:crypto";
import { composerIndemnite } from "./lib/fraisZones.js";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const GOOGLE_MAPS_API_KEY = defineSecret("GOOGLE_MAPS_API_KEY");

const GESTIONNAIRE_RH = ["Admin", "Direction", "Assistante"];
const COL_USERS = "utilisateurs";
const COL_CHANTIERS = "chantiers";
const COL_CHANTIERS_ESABORA = "chantiersEsabora";
const COL_CONFIG = "config";

// Compose "Adresse, CP Ville" (miroir de src/modules/rh/affairesModel.js).
function adresseCompleteEsabora(a) {
  const adresse = String(a?.adresse || "").trim();
  const cp = String(a?.codePostal || "").trim();
  const ville = String(a?.ville || "").trim();
  const ligne2 = `${cp} ${ville}`.trim();
  return [adresse, ligne2].filter(Boolean).join(", ");
}
const COL_CACHE = "fraisDistances";
const COL_BAREME = "referentielFraisBTP";

const hash = (s) => crypto.createHash("sha1").update(String(s)).digest("hex");
const round1 = (x) => Math.round(x * 10) / 10;

// Barème de l'année courante : doc de l'année en cours, sinon le plus récent
// dont l'année ≤ année en cours, sinon le plus récent tout court.
async function loadBaremeCourant() {
  const snap = await db.collection(COL_BAREME).get();
  if (snap.empty) return null;
  const list = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (Number(b.annee) || 0) - (Number(a.annee) || 0));
  const y = new Date().getFullYear();
  return (
    list.find((b) => Number(b.annee) === y) ||
    list.find((b) => Number(b.annee) <= y) ||
    list[0]
  );
}

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

    // ─── a. Origine ───
    let origineAdresse = "";
    if (origineType === "DOMICILE") {
      const uSnap = await db.collection(COL_USERS).doc(salarieId).get();
      if (!uSnap.exists) throw new HttpsError("failed-precondition", "Salarié introuvable.");
      origineAdresse = String(uSnap.data()?.adresseDomicile || "").trim();
      if (!origineAdresse) {
        throw new HttpsError("failed-precondition", "Adresse domicile manquante pour ce salarié.");
      }
    } else {
      const cSnap = await db.collection(COL_CONFIG).doc("company").get();
      const c = cSnap.exists ? cSnap.data() : null;
      const parts = [
        String(c?.adresse || "").trim(),
        `${String(c?.codePostal || "").trim()} ${String(c?.ville || "").trim()}`.trim(),
      ].filter(Boolean);
      origineAdresse = parts.join(", ");
      if (!origineAdresse) {
        throw new HttpsError("failed-precondition", "Adresse du dépôt (société) manquante.");
      }
    }

    // ─── b. Destination (cascade adresse — chantiers TOUJOURS lecture seule) ───
    //   1) chantiers/{num}.adresse (app d'abord : plus à jour)
    //   2) sinon chantiersEsabora/{num} → adresseComplete (fallback référentiel)
    //   3) sinon erreur explicite.
    let destinationAdresse = "";
    const chSnap = await db.collection(COL_CHANTIERS).doc(chantierId).get();
    if (chSnap.exists) {
      destinationAdresse = String(chSnap.data()?.adresse || "").trim();
    }
    if (!destinationAdresse) {
      const ceSnap = await db.collection(COL_CHANTIERS_ESABORA).doc(chantierId).get();
      if (ceSnap.exists) destinationAdresse = adresseCompleteEsabora(ceSnap.data());
    }
    if (!destinationAdresse) {
      throw new HttpsError("failed-precondition", `Adresse chantier introuvable (num ${chantierId}).`);
    }

    // ─── c. Cache distance ───
    const docId = `${salarieId}__${chantierId}__${origineType}`;
    const origineHash = hash(`${origineAdresse}|${destinationAdresse}`);
    const cacheRef = db.collection(COL_CACHE).doc(docId);
    const cacheSnap = await cacheRef.get();
    const cached = cacheSnap.exists ? cacheSnap.data() : null;

    let distanceKm;
    let dureeMin;
    let fromCache = false;

    if (cached && !force && cached.origineHash === origineHash && cached.distanceKm != null) {
      distanceKm = cached.distanceKm;
      dureeMin = cached.dureeMin;
      fromCache = true;
    } else {
      // Appel Google Distance Matrix
      const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
      url.searchParams.set("origins", origineAdresse);
      url.searchParams.set("destinations", destinationAdresse);
      url.searchParams.set("mode", "driving");
      url.searchParams.set("units", "metric");
      url.searchParams.set("language", "fr");
      url.searchParams.set("key", GOOGLE_MAPS_API_KEY.value());

      let payload;
      try {
        const resp = await fetch(url.toString());
        payload = await resp.json();
      } catch (e) {
        throw new HttpsError("unavailable", `Appel Google Maps impossible : ${e.message}`);
      }
      if (payload.status !== "OK") {
        throw new HttpsError(
          "failed-precondition",
          `Google Distance Matrix : ${payload.status}${payload.error_message ? ` — ${payload.error_message}` : ""}`,
        );
      }
      const element = payload.rows?.[0]?.elements?.[0];
      if (!element || element.status !== "OK") {
        throw new HttpsError(
          "failed-precondition",
          `Trajet introuvable (statut ${element?.status || "inconnu"}). Vérifiez les adresses.`,
        );
      }
      distanceKm = round1((element.distance?.value || 0) / 1000);
      dureeMin = Math.round((element.duration?.value || 0) / 60);

      // Écrit le cache : distance SEULEMENT + méta (jamais l'indemnité).
      await cacheRef.set({
        salarieId,
        chantierId,
        origineType,
        origineAdresse,
        destinationAdresse,
        origineHash,
        distanceKm,
        dureeMin,
        calculePar: request.auth.uid || "",
        calculeParNom: request.auth.token?.name || request.auth.token?.email || "",
        calculeAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }

    // ─── d. Barème année courante + composition indemnité ───
    const bareme = await loadBaremeCourant();
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
  },
);

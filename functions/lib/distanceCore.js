// ═══════════════════════════════════════════════════════════════
//  distanceCore — cœur RÉUTILISABLE du moteur de distance frais
//  (RH-Frais-3b1). Extrait de computeDistanceFrais.js pour être partagé
//  entre la callable de test (computeDistanceFrais) et le moteur de récap
//  mensuel (genererRecapFrais).
//
//  Trois primitives + le chargement du barème courant :
//   • resoudreOrigine(db, salarieId, origineType) → { origineAdresse }
//   • resoudreDestination(db, chantierNum)        → { destinationAdresse }
//   • calculerDistanceCache(db, {...})            → { distanceKm, dureeMin, fromCache }
//   • loadBaremeCourant(db)                       → barème FBTP de l'année courante
//
//  Les erreurs sont des Error PORTANT UNE PROPRIÉTÉ `.code` (codes HttpsError :
//  "failed-precondition", "unavailable"…) → l'appelant callable les re-mappe en
//  HttpsError à l'identique ; le moteur de récap les capture en ALERTES.
//
//  ⚠️ chantiers = LECTURE SEULE. Écrit uniquement fraisDistances (Admin SDK).
// ═══════════════════════════════════════════════════════════════
import admin from "firebase-admin";
import crypto from "node:crypto";

if (!admin.apps.length) admin.initializeApp();

const COL_USERS = "utilisateurs";
const COL_CHANTIERS = "chantiers";
const COL_CHANTIERS_ESABORA = "chantiersEsabora";
const COL_CONFIG = "config";
const COL_CACHE = "fraisDistances";
const COL_BAREME = "referentielFraisBTP";

const hash = (s) => crypto.createHash("sha1").update(String(s)).digest("hex");
const round1 = (x) => Math.round(x * 10) / 10;

// Erreur métier portant un code HttpsError (re-mappable par l'appelant).
function fraisError(code, message) {
  const e = new Error(message);
  e.code = code;
  return e;
}

// Compose "Adresse, CP Ville" (miroir de src/modules/rh/affairesModel.js).
function adresseCompleteEsabora(a) {
  const adresse = String(a?.adresse || "").trim();
  const cp = String(a?.codePostal || "").trim();
  const ville = String(a?.ville || "").trim();
  const ligne2 = `${cp} ${ville}`.trim();
  return [adresse, ligne2].filter(Boolean).join(", ");
}

// Barème de l'année courante : doc de l'année en cours, sinon le plus récent
// dont l'année ≤ année en cours, sinon le plus récent tout court.
export async function loadBaremeCourant(db) {
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

// ─── Origine : DOMICILE = utilisateurs/{id}.adresseDomicile ;
//              DEPOT = config/company `${adresse}, ${cp} ${ville}` ───
export async function resoudreOrigine(db, salarieId, origineType) {
  const type = origineType === "DOMICILE" ? "DOMICILE" : "DEPOT";
  let origineAdresse = "";
  if (type === "DOMICILE") {
    const uSnap = await db.collection(COL_USERS).doc(salarieId).get();
    if (!uSnap.exists) throw fraisError("failed-precondition", "Salarié introuvable.");
    origineAdresse = String(uSnap.data()?.adresseDomicile || "").trim();
    if (!origineAdresse) {
      throw fraisError("failed-precondition", "Adresse domicile manquante pour ce salarié.");
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
      throw fraisError("failed-precondition", "Adresse du dépôt (société) manquante.");
    }
  }
  return { origineAdresse };
}

// ─── Destination : cascade chantiers/{num}.adresse (app, plus à jour)
//                  → chantiersEsabora/{num} (référentiel) → erreur ───
//  ⚠️ chantiers TOUJOURS lecture seule.
export async function resoudreDestination(db, chantierNum) {
  let destinationAdresse = "";
  const chSnap = await db.collection(COL_CHANTIERS).doc(chantierNum).get();
  if (chSnap.exists) {
    destinationAdresse = String(chSnap.data()?.adresse || "").trim();
  }
  if (!destinationAdresse) {
    const ceSnap = await db.collection(COL_CHANTIERS_ESABORA).doc(chantierNum).get();
    if (ceSnap.exists) destinationAdresse = adresseCompleteEsabora(ceSnap.data());
  }
  if (!destinationAdresse) {
    throw fraisError("failed-precondition", `Adresse chantier introuvable (num ${chantierNum}).`);
  }
  return { destinationAdresse };
}

// ─── Distance routière avec cache fraisDistances (Admin SDK) ───
//  Cache HIT si présent, non forcé et origineHash inchangé → aucun appel Google.
//  Sinon appel Google Distance Matrix + écriture du cache (distance SEULEMENT,
//  JAMAIS l'indemnité).
export async function calculerDistanceCache(db, {
  salarieId, chantierNum, origineType, origineAdresse, destinationAdresse,
  force = false, mapsKey, calculePar = "", calculeParNom = "",
}) {
  const type = origineType === "DOMICILE" ? "DOMICILE" : "DEPOT";
  const docId = `${salarieId}__${chantierNum}__${type}`;
  const origineHash = hash(`${origineAdresse}|${destinationAdresse}`);
  const cacheRef = db.collection(COL_CACHE).doc(docId);
  const cacheSnap = await cacheRef.get();
  const cached = cacheSnap.exists ? cacheSnap.data() : null;

  if (cached && !force && cached.origineHash === origineHash && cached.distanceKm != null) {
    return { distanceKm: cached.distanceKm, dureeMin: cached.dureeMin, fromCache: true };
  }

  const url = new URL("https://maps.googleapis.com/maps/api/distancematrix/json");
  url.searchParams.set("origins", origineAdresse);
  url.searchParams.set("destinations", destinationAdresse);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("units", "metric");
  url.searchParams.set("language", "fr");
  url.searchParams.set("key", mapsKey);

  let payload;
  try {
    const resp = await fetch(url.toString());
    payload = await resp.json();
  } catch (e) {
    throw fraisError("unavailable", `Appel Google Maps impossible : ${e.message}`);
  }
  if (payload.status !== "OK") {
    throw fraisError(
      "failed-precondition",
      `Google Distance Matrix : ${payload.status}${payload.error_message ? ` — ${payload.error_message}` : ""}`,
    );
  }
  const element = payload.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    throw fraisError(
      "failed-precondition",
      `Trajet introuvable (statut ${element?.status || "inconnu"}). Vérifiez les adresses.`,
    );
  }
  const distanceKm = round1((element.distance?.value || 0) / 1000);
  const dureeMin = Math.round((element.duration?.value || 0) / 60);

  await cacheRef.set({
    salarieId,
    chantierId: chantierNum,
    origineType: type,
    origineAdresse,
    destinationAdresse,
    origineHash,
    distanceKm,
    dureeMin,
    calculePar,
    calculeParNom,
    calculeAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { distanceKm, dureeMin, fromCache: false };
}

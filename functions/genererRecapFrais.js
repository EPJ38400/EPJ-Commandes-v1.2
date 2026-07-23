// ═══════════════════════════════════════════════════════════════
//  genererRecapFrais — moteur de récap mensuel des frais de déplacement
//  (RH-Frais-3b1). Callable onCall (europe-west1), RÉSERVÉE au gestionnaire
//  RH (claim role ∈ Admin / Direction / Assistante).
//
//  Input  : { mois: "2026-06", force?: bool }.
//  Sortie : { nbSalaries, totalGlobal, nbAlertes } (le détail complet est écrit
//            dans fraisRecap/{mois}).
//
//  Flux :
//   a. Lit heures where mois==mois. Lignes sans salarieId → ALERTES (non mappé).
//   b. Groupe par (salarieId, date). Par jour, sélection DÉTERMINISTE via
//      config/fraisChantiersSpeciaux (spec[num] = {type:"bureau"|"absence"}) :
//        - on retire les chantiers "absence" ; s'il ne reste RIEN → JOUR ABSENCE
//          (aucune indemnité, aucun appel distance, jour marqué { absence:true }).
//        - sinon, parmi les chantiers restants ouvrant un trajet (type != "bureau") :
//          origineType (override sinon pointDepartFrais, défaut DEPOT), base
//          (override sinon "trajet"), resoudreDestination + calculerDistanceCache
//          (erreur adresse → ALERTE), on RETIENT le plus éloigné → 1 ligne/jour,
//          indemniteJour = composerIndemnite(distanceMax, barème, {repas, base}).
//        - si SEULEMENT du bureau → { bureauSeul:true } : repas SEUL (deplacement 0).
//      (L'ancien heuristique regex /BUREAU|DEPOT|ATELIER/ est SUPPRIMÉ.)
//   c. Agrège par salarié (totalMois, nbJours).
//   d. Écrit fraisRecap/{mois}.
//
//  SURCHARGES À LA MAILLE JOUR (RH-Frais-3b2b) :
//  fraisOverrides/{mois__salarieId__date} = { origineType?, base?, exclu? }.
//  Appliquées PAR JOUR : origineType (défaut = pointDepartFrais) pilote le calcul
//  de distance de tous les chantiers du jour ; base (défaut "trajet") pilote la
//  composante d'indemnité ; exclu === true sort le jour (déplacement/repas/total
//  = 0, flag exclu:true). Les jours absence/bureauSeul ne sont PAS surchargeables
//  en origine/base (pas de trajet) — seul "exclu" s'y applique (retire le repas).
//  Chaque jour du récap porte { origineType, base, exclu, absence, bureauSeul }.
//  chantiers = LECTURE SEULE (via distanceCore).
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
const COL_HEURES = "heures";
const COL_USERS = "utilisateurs";
const COL_OVERRIDES = "fraisOverrides";
const COL_RECAP = "fraisRecap";
const COL_CONFIG = "config";
const DOC_CHANTIERS_SPECIAUX = "fraisChantiersSpeciaux";

// Liste blanche des rôles ouvrant droit aux frais de déplacement (terrain).
// Logique OU : un multi-rôles est inclus dès qu'un rôle terrain y figure.
const ROLES_FRAIS = ["Monteur", "Chef chantier", "Conducteur travaux"];

const r2 = (x) => Math.round((Number(x) || 0) * 100) / 100;

// ─── Ventilation par zone/rubrique (RH-Frais-3b2-ventilation) ───
const VENT_ZONES = ["1a", "1b", "2", "3", "4", "5"];

// Table de zones initialisée aux taux du barème (`bareme.trajet` | `bareme.transport`).
function ventZoneTable(baseTable) {
  const t = {};
  for (const z of VENT_ZONES) t[z] = { qte: 0, taux: Number(baseTable?.[z]) || 0, montant: 0 };
  return t;
}

// Ne garde que les zones à qté > 0 et calcule le montant = qté × taux.
function ventFinalize(table) {
  const out = {};
  for (const z of VENT_ZONES) {
    if (table[z].qte > 0) out[z] = { qte: table[z].qte, taux: table[z].taux, montant: r2(table[z].qte * table[z].taux) };
  }
  return out;
}

// Somme des montants d'une table de zones.
const ventTableSum = (table) =>
  Object.values(table || {}).reduce((a, z) => a + (Number(z.montant) || 0), 0);

// Construit la ventilation d'UN salarié depuis ses jours retenus.
//   repas = 1×/jour dès qu'une indemnité repas est due (jour normal OU bureauSeul).
//   par jour normal : z5.qte += nb50 ; reliquat → zoneReliquat.qte += 1.
//   jour absence → n'ajoute RIEN ; jour bureauSeul → repas seul, 0 unité de zone.
//   transport présent uniquement si ≥1 jour en base "transport".
function buildVentilation(jours, bareme) {
  const repasTaux = Number(bareme.repas) || 0;
  const trajetTable = ventZoneTable(bareme.trajet);
  const transportTable = ventZoneTable(bareme.transport);
  let anyTransport = false;
  let nbRepas = 0;

  for (const j of jours) {
    if (j.absence) continue;               // jour absence → aucune ventilation
    if (Number(j.repas) > 0) nbRepas += 1; // repas dû (jour normal OU bureauSeul)
    if (j.bureauSeul) continue;            // bureau seul → pas d'unité de zone
    const isTransport = j.base === "transport";
    if (isTransport) anyTransport = true;
    const table = isTransport ? transportTable : trajetTable;
    const nb50 = Number(j.nb50) || 0;
    if (nb50 > 0) table["5"].qte += nb50;            // tranches pleines de 50 km
    if (j.zoneReliquat && table[j.zoneReliquat]) table[j.zoneReliquat].qte += 1; // reliquat < 50 km
  }

  const vent = {
    repas: { nbJours: nbRepas, taux: repasTaux, montant: r2(nbRepas * repasTaux) },
    trajet: ventFinalize(trajetTable),
  };
  if (anyTransport) vent.transport = ventFinalize(transportTable);
  return vent;
}

// Montant total d'une ventilation (repas + trajet + transport).
const ventTotal = (v) =>
  r2((Number(v?.repas?.montant) || 0) + ventTableSum(v?.trajet) + ventTableSum(v?.transport));

// Agrège les ventilations de tous les salariés en une ventilation globale.
function mergeVentilationGlobale(salaries, bareme) {
  const global = { repas: { nbJours: 0, taux: Number(bareme.repas) || 0, montant: 0 }, trajet: {} };
  const acc = { trajet: {}, transport: {} };
  for (const s of salaries) {
    const v = s.ventilation;
    if (!v) continue;
    global.repas.nbJours += Number(v.repas?.nbJours) || 0;
    for (const kind of ["trajet", "transport"]) {
      const table = v[kind];
      if (!table) continue;
      for (const [z, cell] of Object.entries(table)) {
        const cur = acc[kind][z] || { qte: 0, taux: cell.taux, montant: 0 };
        cur.qte += Number(cell.qte) || 0;
        cur.montant = r2(cur.montant + (Number(cell.montant) || 0));
        acc[kind][z] = cur;
      }
    }
  }
  global.repas.montant = r2(global.repas.nbJours * global.repas.taux);
  global.trajet = acc.trajet;
  if (Object.keys(acc.transport).length) global.transport = acc.transport;
  return global;
}

export const genererRecapFrais = onCall(
  { region: "europe-west1", timeoutSeconds: 300, memory: "512MiB", secrets: [GOOGLE_MAPS_API_KEY] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Vous devez être connecté.");
    }
    const role = request.auth.token?.role;
    if (!GESTIONNAIRE_RH.includes(role)) {
      throw new HttpsError("permission-denied", "Réservé au gestionnaire RH.");
    }

    const mois = String(request.data?.mois || "").trim();
    if (!/^\d{4}-\d{2}$/.test(mois)) {
      throw new HttpsError("invalid-argument", "Mois attendu au format YYYY-MM.");
    }
    const force = request.data?.force === true;
    const mapsKey = GOOGLE_MAPS_API_KEY.value();

    // ─── Barème année courante (une fois) ───
    const bareme = await loadBaremeCourant(db);
    if (!bareme) {
      throw new HttpsError("failed-precondition", "Aucun barème FBTP saisi.");
    }

    // ─── Chantiers spéciaux (config/fraisChantiersSpeciaux, lu une seule fois) ───
    //  spec[num] = { type:"bureau"|"absence", ... }. Remplace l'ancien regex BUREAU.
    //  Doc absent / champ vide = {} → aucun chantier spécial (comportement normal).
    let spec = {};
    try {
      const cfgSnap = await db.collection(COL_CONFIG).doc(DOC_CHANTIERS_SPECIAUX).get();
      const cfg = cfgSnap.exists ? cfgSnap.data() : null;
      if (cfg && cfg.chantiers && typeof cfg.chantiers === "object") spec = cfg.chantiers;
    } catch (e) {
      console.error("[recapFrais] lecture config chantiers spéciaux échouée :", e?.message);
    }
    const specType = (num) => (num && spec[num] && typeof spec[num] === "object" ? spec[num].type : undefined);

    // ─── a. Lecture des heures du mois ───
    const snap = await db.collection(COL_HEURES).where("mois", "==", mois).get();
    if (snap.empty) {
      throw new HttpsError("failed-precondition", `Aucune heure importée pour ${mois}.`);
    }
    const lignes = snap.docs.map((d) => d.data() || {});

    const alertes = [];
    const pushAlerte = (a) => alertes.push(a);

    // Salariés non mappés (salarieId null) → alerte unique par nom.
    const nonMappesVus = new Set();
    for (const l of lignes) {
      if (!l.salarieId) {
        const nomAff = l.salarieNomFichier || l.trigramme || "?";
        const cle = `${l.trigramme || ""}__${nomAff}`;
        if (!nonMappesVus.has(cle)) {
          nonMappesVus.add(cle);
          pushAlerte({
            type: "salarie_non_mappe",
            message: `Salarié non mappé : ${nomAff}${l.trigramme ? ` (${l.trigramme})` : ""} — heures ignorées.`,
          });
        }
      }
    }

    // ─── b. Groupe (salarieId, date) → { lignes, chantiers } ───
    // On ne traite QUE les lignes avec salarieId (les autres sont en alertes).
    const groupes = new Map(); // `${salarieId}__${date}` → { salarieId, date, chantiers:Map }
    const nomsSalaries = new Map(); // salarieId → nom affichable
    for (const l of lignes) {
      if (!l.salarieId) continue;
      if (!nomsSalaries.has(l.salarieId)) {
        nomsSalaries.set(l.salarieId, l.salarieNomFichier || l.trigramme || l.salarieId);
      }
      const gkey = `${l.salarieId}__${l.date}`;
      let g = groupes.get(gkey);
      if (!g) { g = { salarieId: l.salarieId, date: l.date, chantiers: new Map() }; groupes.set(gkey, g); }
      const chn = l.chantierNum || null;
      const cle = chn || "NA";
      if (!g.chantiers.has(cle)) {
        g.chantiers.set(cle, { chantierNum: chn, chantierLibelle: l.chantierLibelle || "" });
      } else if (!g.chantiers.get(cle).chantierLibelle && l.chantierLibelle) {
        g.chantiers.get(cle).chantierLibelle = l.chantierLibelle;
      }
    }

    // ─── Mémos (évitent lectures/appels répétés) ───
    const origineCache = new Map();   // `${salarieId}__${type}` → {origineAdresse} | Error
    const userDataCache = new Map();  // salarieId → data user | null (1 lecture / salarié)
    const overrideCache = new Map();  // docId → data | null

    const getUserData = async (salarieId) => {
      if (userDataCache.has(salarieId)) return userDataCache.get(salarieId);
      let data = null;
      try {
        const uSnap = await db.collection(COL_USERS).doc(salarieId).get();
        data = uSnap.exists ? uSnap.data() : null;
      } catch (e) {
        console.error("[recapFrais] lecture user échouée :", salarieId, e?.message);
      }
      userDataCache.set(salarieId, data);
      return data;
    };

    const getPointDepart = async (salarieId) => {
      const data = await getUserData(salarieId);
      return data?.pointDepartFrais === "DOMICILE" ? "DOMICILE" : "DEPOT";
    };

    // Éligibilité frais : au moins un rôle terrain (ROLES_FRAIS) sur la fiche user.
    const estEligibleFrais = async (salarieId) => {
      const data = await getUserData(salarieId);
      const roles = Array.isArray(data?.roles) ? data.roles : [];
      return roles.some((r) => ROLES_FRAIS.includes(r));
    };

    // Surcharge à la maille JOUR : clé mois__salarieId__date.
    const getOverride = async (salarieId, date) => {
      if (!date) return null;
      const id = `${mois}__${salarieId}__${date}`;
      if (overrideCache.has(id)) return overrideCache.get(id);
      let data = null;
      try {
        const oSnap = await db.collection(COL_OVERRIDES).doc(id).get();
        data = oSnap.exists ? oSnap.data() : null;
      } catch (e) {
        console.error("[recapFrais] lecture override échouée :", id, e?.message);
      }
      overrideCache.set(id, data);
      return data;
    };

    const getOrigine = async (salarieId, type) => {
      const key = `${salarieId}__${type}`;
      if (origineCache.has(key)) return origineCache.get(key);
      let res;
      try {
        res = await resoudreOrigine(db, salarieId, type);
      } catch (e) {
        res = { error: e };
      }
      origineCache.set(key, res);
      return res;
    };

    // ─── Traitement des groupes → jours par salarié ───
    const parSalarie = new Map(); // salarieId → { salarieId, nom, origineDefaut, jours:[] }
    const exclusHorsPerimetre = new Set(); // salariés sans rôle terrain (pas de frais)
    const groupesTries = [...groupes.values()].sort(
      (a, b) => a.salarieId.localeCompare(b.salarieId) || String(a.date).localeCompare(String(b.date)),
    );

    for (const g of groupesTries) {
      const { salarieId, date } = g;
      // Liste blanche frais : hors périmètre terrain → exclu du récap (aucun
      // calcul de distance). Ses heures restent intactes dans `heures`.
      if (!(await estEligibleFrais(salarieId))) { exclusHorsPerimetre.add(salarieId); continue; }
      const pointDepart = await getPointDepart(salarieId);
      if (!parSalarie.has(salarieId)) {
        parSalarie.set(salarieId, {
          salarieId,
          nom: nomsSalaries.get(salarieId) || salarieId,
          origineDefaut: pointDepart,
          jours: [],
        });
      }

      // ─── Surcharge du JOUR (mois__salarieId__date) ───
      //  origineType pilote le calcul de distance de tous les chantiers du jour ;
      //  base pilote la composante d'indemnité ; exclu sort le jour (montants 0).
      const ov = await getOverride(salarieId, date);
      const origineType = ov?.origineType === "DOMICILE" || ov?.origineType === "DEPOT"
        ? ov.origineType : pointDepart;
      const base = ov?.base === "transport" ? "transport" : "trajet";
      const exclu = ov?.exclu === true;

      // ─── Sélection déterministe du chantier retenu ce jour-là ───
      //  a. tous les chantiers du jour ; b. retrait des "absence" ;
      //  c. plus aucun → JOUR ABSENCE (aucune indemnité, aucun appel distance) ;
      //  d. sinon trajet parmi les non-bureau, sinon bureauSeul (repas seul).
      const chantiersJour = [...g.chantiers.values()];
      const chantiersAbsence = [];   // n° des chantiers d'absence rencontrés ce jour
      let absenceLibelle = "";
      const candidatsBureau = [];    // spec[num].type === "bureau" (n'ouvre pas de trajet)
      const candidatsTrajet = [];    // tout le reste (type !== "bureau", y c. hors config)
      for (const c of chantiersJour) {
        const t = specType(c.chantierNum);
        if (t === "absence") {
          if (c.chantierNum) chantiersAbsence.push(c.chantierNum);
          if (!absenceLibelle) absenceLibelle = c.chantierLibelle || "";
          continue;
        }
        if (t === "bureau") candidatsBureau.push(c);
        else candidatsTrajet.push(c);
      }

      // c. Aucun chantier non-absence → jour d'absence (pour l'UI + rapprochement conges).
      //    Non surchargeable (origine/base sans objet) ; montants toujours à 0.
      if (!candidatsBureau.length && !candidatsTrajet.length) {
        if (chantiersAbsence.length) {
          parSalarie.get(salarieId).jours.push({
            date,
            absence: true,
            chantiersAbsence,
            chantierNum: chantiersAbsence[0] || null,
            chantierLibelle: absenceLibelle,
            origineType, base, exclu,
            deplacement: 0, repas: 0, total: 0,
          });
        }
        continue;
      }

      // d. Calcule la distance des seuls chantiers ouvrant un trajet (origine du jour).
      const candidats = [];
      for (const c of candidatsTrajet) {
        const chantierNum = c.chantierNum;
        if (!chantierNum) {
          pushAlerte({
            type: "chantier_manquant", salarieId, message:
              `${nomsSalaries.get(salarieId) || salarieId} — ${date} : ligne sans n° de chantier (indemnité à valider).`,
          });
          continue;
        }
        const orig = await getOrigine(salarieId, origineType);
        if (orig.error) {
          pushAlerte({
            type: "adresse", sousType: "origine", salarieId, chantierNum,
            message: `${nomsSalaries.get(salarieId) || salarieId} — origine ${origineType} : ${orig.error.message}`,
          });
          continue;
        }
        let dest;
        try {
          dest = await resoudreDestination(db, chantierNum);
        } catch (e) {
          pushAlerte({
            type: "adresse", sousType: "chantier", salarieId, chantierNum,
            chantierLibelle: c.chantierLibelle || "",
            message: `Chantier ${chantierNum} : ${e.message}`,
          });
          continue;
        }
        let dist;
        try {
          dist = await calculerDistanceCache(db, {
            salarieId, chantierNum, origineType,
            origineAdresse: orig.origineAdresse,
            destinationAdresse: dest.destinationAdresse,
            force, mapsKey,
            calculePar: request.auth.uid || "",
            calculeParNom: request.auth.token?.name || request.auth.token?.email || "",
          });
        } catch (e) {
          pushAlerte({
            type: "distance", salarieId, chantierNum,
            message: `Chantier ${chantierNum} : ${e.message}`,
          });
          continue;
        }
        candidats.push({
          chantierNum,
          chantierLibelle: c.chantierLibelle || "",
          distanceKm: dist.distanceKm,
        });
      }

      if (candidats.length) {
        // Jour normal : chantier le plus éloigné = base de l'indemnité (trajet + repas).
        //  exclu === true → jour sorti : montants à 0, chantier conservé pour l'UI.
        const retenu = candidats.reduce((a, b) => (b.distanceKm > a.distanceKm ? b : a));
        let deplacement = 0, repas = 0, total = 0, nb50 = 0, zoneReliquat = null;
        if (!exclu) {
          const ind = composerIndemnite(retenu.distanceKm, bareme, { repas: true, base });
          if (ind) {
            deplacement = ind.deplacement; repas = ind.repas; total = ind.total;
            nb50 = ind.nb50; zoneReliquat = ind.zoneReliquat;
          }
        }
        parSalarie.get(salarieId).jours.push({
          date,
          chantierNum: retenu.chantierNum,
          chantierLibelle: retenu.chantierLibelle,
          origineType, base, exclu,
          distanceKm: retenu.distanceKm,
          deplacement, repas, total, nb50, zoneReliquat,
        });
      } else if (candidatsBureau.length) {
        // Bureau seul (aucun trajet exploitable) : repas SEUL, aucune distance.
        //  exclu === true → retire aussi le repas (montants 0).
        const bureauC = candidatsBureau[0];
        const repasDefaut = spec[bureauC.chantierNum]?.repas === false ? 0 : (Number(bareme.repas) || 0);
        const repasDu = exclu ? 0 : repasDefaut;
        parSalarie.get(salarieId).jours.push({
          date,
          bureauSeul: true,
          chantierNum: bureauC.chantierNum || null,
          chantierLibelle: bureauC.chantierLibelle || "",
          origineType, base, exclu,
          deplacement: 0,
          repas: repasDu,
          total: r2(repasDu),
        });
      }
      // sinon : que du trajet mais tout en alerte → rien (déjà tracé en alertes).
    }

    // ─── c. Agrégation par salarié (+ ventilation par zone/rubrique) ───
    const salaries = [...parSalarie.values()]
      .map((s) => {
        const jours = s.jours.sort((a, b) => String(a.date).localeCompare(String(b.date)));
        const totalMois = r2(jours.reduce((acc, j) => acc + (Number(j.total) || 0), 0));
        const ventilation = buildVentilation(jours, bareme);
        // Vérif interne : la ventilation doit retomber sur le total mensuel.
        if (Math.abs(ventTotal(ventilation) - totalMois) > 0.01) {
          pushAlerte({
            type: "ventilation", salarieId: s.salarieId,
            message: `${s.nom || s.salarieId} : ventilation ${ventTotal(ventilation)} € ≠ total ${totalMois} € (à vérifier).`,
          });
        }
        return { ...s, jours, totalMois, nbJours: jours.length, ventilation };
      })
      .sort((a, b) => String(a.nom).localeCompare(String(b.nom), "fr", { sensitivity: "base" }));

    const totalGlobal = r2(salaries.reduce((acc, s) => acc + s.totalMois, 0));
    const ventilationGlobale = mergeVentilationGlobale(salaries, bareme);

    // ─── d. Écriture fraisRecap/{mois} ───
    await db.collection(COL_RECAP).doc(mois).set({
      mois,
      genereAt: admin.firestore.FieldValue.serverTimestamp(),
      generePar: request.auth.uid || "",
      genereParNom: request.auth.token?.name || request.auth.token?.email || "",
      bareme: Number(bareme.annee) || null,
      salaries,
      ventilationGlobale,
      alertes,
      meta: { nbExclusHorsPerimetre: exclusHorsPerimetre.size },
    });

    // ─── e. Résumé (alertes renvoyées pour affichage immédiat) ───
    return {
      mois,
      nbSalaries: salaries.length,
      totalGlobal,
      nbAlertes: alertes.length,
      nbExclusHorsPerimetre: exclusHorsPerimetre.size,
      alertes,
    };
  },
);

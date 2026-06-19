// ═══════════════════════════════════════════════════════════════
//  functions/planningSms.js — récap SMS planning (MONTEURS UNIQUEMENT)
//
//  2 fonctions planifiées qui ENFILENT des SMS dans smsQueue (le même
//  envoyeur Brevo `onSmsQueueCreate` les consomme — aucun appel Brevo ici) :
//   • planningSmsRecap        : lun-ven 15h30 → planning du PROCHAIN jour ouvré.
//   • planningSmsRappelLundi  : lundi 7h00   → rappel du planning du jour.
//
//  Écrit UNIQUEMENT smsQueue (set id déterministe = idempotent : pas de
//  double envoi si la fonction rejoue). Lit planningCreneaux / chantiers /
//  utilisateurs. Aucune écriture chantiers / permissions / rules.
//
//  Forme du doc smsQueue COPIÉE de src/core/smsService.js (queueSms) :
//  status initial = "pending"  ·  champs recipientUserId / recipientName /
//  recipientPhone / templateCode / message / variables / context / createdAt.
//  Région = europe-west1 (cf. esaboraImport.js / index.js).
// ═══════════════════════════════════════════════════════════════
import { onSchedule } from "firebase-functions/v2/scheduler";
import admin from "firebase-admin";

// Firebase Admin déjà initialisé dans index.js ; ici on sécurise le cas
// d'un chargement isolé (tests). Même pattern qu'esaboraImport.js.
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const REGION = "europe-west1";
const PERIODE_LABEL = { AM: "Matin", PM: "Aprem" };

// ─── Dates (Europe/Paris) ─────────────────────────────────────
// ISO "YYYY-MM-DD" du jour courant en heure de Paris.
function todayParisISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}
// Midi UTC : weekday et décalage stables (insensibles au DST).
function weekdayOfISO(iso) {
  return new Date(iso + "T12:00:00Z").getUTCDay(); // 0=dim … 5=ven … 6=sam
}
function addDaysISO(iso, n) {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function jjmm(iso) {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// ─── Cœur : construit le récap d'un jour et enfile 1 SMS par monteur ──
async function buildAndQueue(targetDateISO, kind /* "recap" | "rappel" */) {
  const snap = await db.collection("planningCreneaux")
    .where("date", "==", targetDateISO).get();

  // Créneaux affectés (ressourceId truthy) groupés par ressource.
  const parRessource = new Map();
  snap.forEach((doc) => {
    const c = doc.data() || {};
    if (!c.ressourceId) return;
    if (!parRessource.has(c.ressourceId)) parRessource.set(c.ressourceId, []);
    parRessource.get(c.ressourceId).push(c);
  });

  const chantierNomCache = new Map();
  const chantierNom = async (chantierId) => {
    if (!chantierId) return "";
    if (chantierNomCache.has(chantierId)) return chantierNomCache.get(chantierId);
    let nom = chantierId;
    try {
      const cs = await db.collection("chantiers").doc(String(chantierId)).get();
      if (cs.exists) nom = cs.data().nom || chantierId;
    } catch (e) {
      console.warn(`[planningSms] lecture chantier ${chantierId} échouée : ${e.message}`);
    }
    chantierNomCache.set(chantierId, nom);
    return nom;
  };

  const prefix = kind === "rappel" ? "Rappel — " : "";
  const dateLabel = jjmm(targetDateISO);
  let enfiles = 0, skippes = 0;

  for (const [ressourceId, creneaux] of parRessource.entries()) {
    // Garder uniquement les MONTEURS avec un téléphone.
    let u = null;
    try {
      const us = await db.collection("utilisateurs").doc(String(ressourceId)).get();
      if (us.exists) u = us.data();
    } catch (e) {
      console.warn(`[planningSms] lecture utilisateur ${ressourceId} échouée : ${e.message}`);
    }
    const roles = Array.isArray(u?.roles) ? u.roles : (u?.role ? [u.role] : []);
    if (!u || !roles.includes("Monteur")) { skippes++; continue; }
    const telephone = u.telephone || u.tel || "";
    if (!telephone) { skippes++; continue; }

    // Une ligne par demi-journée présente (Matin puis Aprem).
    const lignes = [];
    for (const periode of ["AM", "PM"]) {
      const c = creneaux.find((x) => x.periode === periode);
      if (!c) continue;
      const nom = await chantierNom(c.chantierId);
      // posteAvancementKey = libellé court du planning (clé tâche M3).
      const poste = c.posteAvancementKey ? ` (${c.posteAvancementKey})` : "";
      lignes.push(`- ${PERIODE_LABEL[periode]} : ${nom}${poste}`);
    }
    if (lignes.length === 0) { skippes++; continue; }

    const prenom = u.prenom || "";
    const message =
      `${prefix}Bonjour ${prenom}, ton planning EPJ de ${dateLabel} :\n` +
      `${lignes.join("\n")}\n— EPJ`;

    const docId = `planning_${ressourceId}_${targetDateISO}_${kind}`;
    await db.collection("smsQueue").doc(docId).set({
      type: "PLANNING_" + kind.toUpperCase(),
      recipientUserId: ressourceId,
      recipientName: `${u.prenom || ""} ${u.nom || ""}`.trim(),
      recipientPhone: telephone,
      templateCode: "planning_jour",
      message,
      variables: { prenom, date: dateLabel },
      context: { module: "planning", date: targetDateISO, kind },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: "pending",
    });
    enfiles++;
  }

  console.log(`[planningSms] ${kind} ${targetDateISO} : ${enfiles} enfilé(s), ${skippes} skippé(s)`);
  return { enfiles, skippes };
}

// ─── Récap J-1 : lun-ven 15h30 → prochain jour ouvré ──────────
export const planningSmsRecap = onSchedule(
  {
    schedule: "30 15 * * 1-5",
    timeZone: "Europe/Paris",
    region: REGION,
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async () => {
    const today = todayParisISO();
    // Vendredi (5) → lundi (+3) ; sinon lendemain (+1). Le cron ne tourne pas
    // le week-end, donc pas d'autre cas à gérer.
    const targetDate = weekdayOfISO(today) === 5 ? addDaysISO(today, 3) : addDaysISO(today, 1);
    await buildAndQueue(targetDate, "recap");
  }
);

// ─── Rappel lundi : 7h00 → planning du jour même ──────────────
export const planningSmsRappelLundi = onSchedule(
  {
    schedule: "0 7 * * 1",
    timeZone: "Europe/Paris",
    region: REGION,
    timeoutSeconds: 120,
    memory: "256MiB",
  },
  async () => {
    const today = todayParisISO(); // lundi
    await buildAndQueue(today, "rappel");
  }
);

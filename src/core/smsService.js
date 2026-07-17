// ═══════════════════════════════════════════════════════════════
//  smsService.js — v10.I (Module SMS automatique via Brevo + Make)
//
//  Service centralisé pour envoyer des SMS depuis n'importe où dans l'app.
//  Architecture :
//    EPJ App  →  Firestore (collection "smsQueue")  →  Make (poll 15 min)
//             →  Brevo  →  SMS
//
//  v10.I — Nouveautés par rapport à v10.H :
//    1. FIX bug recipientUserId : on stocke maintenant l'UID Firestore réel.
//    2. 4 nouveaux helpers Commandes : validée / passée / réceptionnée / supprimée
//    3. 4 nouveaux helpers Réserves : créée / levée / quitus signé / quitus express
//    4. 4 nouveaux helpers Outillage : sortie / retard J+1 / relance J+3 / panne
//    5. Nouveau : deleteSentSmsQueueDocs() — purge des docs envoyés
//       (puisque les modules Delete/Update de Make sont en erreur silencieuse).
// ═══════════════════════════════════════════════════════════════

import {
  collection, addDoc, serverTimestamp,
  query, where, getDocs, deleteDoc, doc,
} from "firebase/firestore";
import { db } from "../firebase";
import { renderSmsTemplate } from "../modules/parc-machines/parcUtils";
import { formatDateRdvPhrase } from "../modules/reserves/reservesUtils";

// ─── Validation / utilitaires ─────────────────────────────────

export function normalizePhone(raw) {
  if (!raw || typeof raw !== "string") return null;
  let cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+33")) {
    return cleaned.length >= 11 ? cleaned : null;
  }
  if (cleaned.startsWith("33") && cleaned.length === 11) {
    return "+" + cleaned;
  }
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return "+33" + cleaned.slice(1);
  }
  return null;
}

export function findActiveTemplate(smsTemplates, code) {
  if (!Array.isArray(smsTemplates) || !code) return null;
  const tpl = smsTemplates.find(t => (t.id === code || t.code === code));
  if (!tpl) return null;
  if (tpl.actif === false) return null;
  return tpl;
}

/**
 * v10.I — Extrait proprement l'UID Firestore d'un objet utilisateur.
 * Gère les variantes de structure (_id, id, uid). Retourne "" si rien.
 */
function extractUid(u) {
  if (!u || typeof u !== "object") return "";
  return u._id || u.id || u.uid || "";
}

// ─── Fonction principale : queueSms ──────────────────────────

export async function queueSms({
  type,
  templateCode,
  smsTemplates,
  recipient,
  variables = {},
  context = {},
  // ── Gestion SMS (fenêtre horaire) ──────────────────────────────
  // origine : 'auto' = généré par un watcher/cron (soumis à la fenêtre
  // horaire côté dispatcher) ; 'manuel' = déclenché par un bouton
  // d'envoi humain (part immédiatement, hors fenêtre).
  // Par défaut on considère un envoi 'manuel' (comportement historique :
  // départ immédiat). SEULS les rappels/récaps automatiques passent 'auto'.
  // NB : côté dispatcher, une valeur ABSENTE (docs legacy) est traitée
  // comme 'auto' par prudence.
  origine = "manuel",
  // sourceType/sourceId : permettent au dispatcher de re-vérifier l'état
  // de la source juste avant l'envoi Brevo (ex. 'outillageSortie' clôturée).
  sourceType = null,
  sourceId = null,
}) {
  if (!type) return { queued: false, reason: "type manquant" };
  if (!templateCode) return { queued: false, reason: "templateCode manquant" };
  if (!recipient || !recipient.phone) {
    return { queued: false, reason: "destinataire sans téléphone" };
  }

  const tpl = findActiveTemplate(smsTemplates, templateCode);
  if (!tpl) {
    console.warn(`[smsService] Template "${templateCode}" introuvable ou désactivé — SMS non envoyé`);
    return { queued: false, reason: "template introuvable ou désactivé" };
  }

  const phone = normalizePhone(recipient.phone);
  if (!phone) {
    console.warn(`[smsService] Téléphone "${recipient.phone}" invalide — SMS non envoyé`);
    return { queued: false, reason: "téléphone invalide" };
  }

  const message = renderSmsTemplate(tpl.body || "", variables);
  if (!message || message.trim().length === 0) {
    return { queued: false, reason: "message vide après rendu" };
  }

  try {
    const ref = await addDoc(collection(db, "smsQueue"), {
      type,
      createdAt: serverTimestamp(),
      recipientUserId: recipient.userId || "", // v10.I — UID propre garanti
      recipientName: recipient.name || "",
      recipientPhone: phone,
      templateCode,
      message,
      variables,
      context,
      origine,
      sourceType: sourceType || null,
      sourceId: sourceId || null,
      status: "pending",
    });
    return { queued: true, docId: ref.id };
  } catch (err) {
    console.error("[smsService] Échec addDoc smsQueue:", err);
    return { queued: false, reason: "erreur Firestore: " + (err.message || "inconnue") };
  }
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS — MODULE COMMANDES
// ═══════════════════════════════════════════════════════════════

export async function smsCommandeCreee({
  smsTemplates, conducteur, demandeurNom, numCmd, chantier, orderId,
}) {
  if (!conducteur) return { queued: false, reason: "conducteur introuvable" };
  return queueSms({
    type: "ORDER_CREATED",
    templateCode: "commande_creee",
    smsTemplates,
    recipient: {
      userId: extractUid(conducteur),
      name: `${conducteur.prenom||""} ${conducteur.nom||""}`.trim(),
      phone: conducteur.telephone || conducteur.tel || "",
    },
    variables: {
      prenom: conducteur.prenom || "",
      numCmd: numCmd || "",
      demandeur: demandeurNom || "",
      chantier: chantier || "",
    },
    context: { module: "commandes", orderId: orderId || "", orderNum: numCmd || "" },
  });
}

export async function smsCommandeModifiee({
  smsTemplates, conducteur, modifieParNom, numCmd, chantier, orderId,
}) {
  if (!conducteur) return { queued: false, reason: "conducteur introuvable" };
  return queueSms({
    type: "ORDER_EDITED",
    templateCode: "commande_modifiee",
    smsTemplates,
    recipient: {
      userId: extractUid(conducteur),
      name: `${conducteur.prenom||""} ${conducteur.nom||""}`.trim(),
      phone: conducteur.telephone || conducteur.tel || "",
    },
    variables: {
      prenom: conducteur.prenom || "",
      numCmd: numCmd || "",
      modifiePar: modifieParNom || "",
      chantier: chantier || "",
    },
    context: { module: "commandes", orderId: orderId || "", orderNum: numCmd || "" },
  });
}

/** v10.I — Commande validée par le conducteur → SMS à l'assistante achats. */
export async function smsCommandeValidee({
  smsTemplates, assistante, validateurNom, numCmd, chantier, orderId,
}) {
  if (!assistante) return { queued: false, reason: "assistante achats introuvable" };
  return queueSms({
    type: "ORDER_VALIDATED",
    templateCode: "commande_validee",
    smsTemplates,
    recipient: {
      userId: extractUid(assistante),
      name: `${assistante.prenom||""} ${assistante.nom||""}`.trim(),
      phone: assistante.telephone || assistante.tel || "",
    },
    variables: {
      prenom: assistante.prenom || "",
      numCmd: numCmd || "",
      validateur: validateurNom || "",
      chantier: chantier || "",
    },
    context: { module: "commandes", orderId: orderId || "", orderNum: numCmd || "" },
  });
}

/** v10.I — Commande marquée "Commandée" → SMS au demandeur initial. */
export async function smsCommandePassee({
  smsTemplates, demandeur, numCmd, chantier, orderId,
}) {
  if (!demandeur) return { queued: false, reason: "demandeur introuvable" };
  return queueSms({
    type: "ORDER_PASSED",
    templateCode: "commande_passee",
    smsTemplates,
    recipient: {
      userId: extractUid(demandeur),
      name: `${demandeur.prenom||""} ${demandeur.nom||""}`.trim(),
      phone: demandeur.telephone || demandeur.tel || "",
    },
    variables: {
      prenom: demandeur.prenom || "",
      numCmd: numCmd || "",
      chantier: chantier || "",
    },
    context: { module: "commandes", orderId: orderId || "", orderNum: numCmd || "" },
  });
}

/** v10.I — Commande réceptionnée → SMS au demandeur initial. */
export async function smsCommandeRecue({
  smsTemplates, demandeur, numCmd, chantier, orderId,
}) {
  if (!demandeur) return { queued: false, reason: "demandeur introuvable" };
  return queueSms({
    type: "ORDER_RECEIVED",
    templateCode: "commande_recue",
    smsTemplates,
    recipient: {
      userId: extractUid(demandeur),
      name: `${demandeur.prenom||""} ${demandeur.nom||""}`.trim(),
      phone: demandeur.telephone || demandeur.tel || "",
    },
    variables: {
      prenom: demandeur.prenom || "",
      numCmd: numCmd || "",
      chantier: chantier || "",
    },
    context: { module: "commandes", orderId: orderId || "", orderNum: numCmd || "" },
  });
}

/** v10.I — Commande supprimée → SMS au conducteur du chantier (Fix 1). */
export async function smsCommandeSupprimee({
  smsTemplates, conducteur, supprimeParNom, numCmd, chantier, orderId,
}) {
  if (!conducteur) return { queued: false, reason: "conducteur introuvable" };
  return queueSms({
    type: "ORDER_DELETED",
    templateCode: "commande_supprimee",
    smsTemplates,
    recipient: {
      userId: extractUid(conducteur),
      name: `${conducteur.prenom||""} ${conducteur.nom||""}`.trim(),
      phone: conducteur.telephone || conducteur.tel || "",
    },
    variables: {
      prenom: conducteur.prenom || "",
      numCmd: numCmd || "",
      supprimePar: supprimeParNom || "",
      chantier: chantier || "",
    },
    context: { module: "commandes", orderId: orderId || "", orderNum: numCmd || "" },
  });
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS — MODULE RÉSERVES & QUITUS
// ═══════════════════════════════════════════════════════════════

/** v10.I — Réserve créée → SMS au conducteur du chantier. */
export async function smsReserveCreee({
  smsTemplates, conducteur, creeParNom, refReserve, chantier, reserveId,
}) {
  if (!conducteur) return { queued: false, reason: "conducteur introuvable" };
  return queueSms({
    type: "RESERVE_CREATED",
    templateCode: "reserve_creee",
    smsTemplates,
    recipient: {
      userId: extractUid(conducteur),
      name: `${conducteur.prenom||""} ${conducteur.nom||""}`.trim(),
      phone: conducteur.telephone || conducteur.tel || "",
    },
    variables: {
      prenom: conducteur.prenom || "",
      refReserve: refReserve || "",
      creePar: creeParNom || "",
      chantier: chantier || "",
    },
    context: { module: "reserves-quitus", reserveId: reserveId || "" },
  });
}

/** v10.I — Réserve levée → SMS au demandeur d'origine. */
export async function smsReserveLevee({
  smsTemplates, demandeur, leveeParNom, refReserve, chantier, reserveId,
}) {
  if (!demandeur) return { queued: false, reason: "demandeur introuvable" };
  return queueSms({
    type: "RESERVE_LIFTED",
    templateCode: "reserve_levee",
    smsTemplates,
    recipient: {
      userId: extractUid(demandeur),
      name: `${demandeur.prenom||""} ${demandeur.nom||""}`.trim(),
      phone: demandeur.telephone || demandeur.tel || "",
    },
    variables: {
      prenom: demandeur.prenom || "",
      refReserve: refReserve || "",
      leveePar: leveeParNom || "",
      chantier: chantier || "",
    },
    context: { module: "reserves-quitus", reserveId: reserveId || "" },
  });
}

/**
 * v10.N — Réserve attribuée à un destinataire → SMS au destinataire.
 * Déclenché à la création AVEC attribution OU lors d'un transfert.
 */
export async function smsReserveAttribuee({
  smsTemplates, destinataire, refReserve, titreReserve, chantier, dateLevee, rdvDate, rdvHeure, reserveId,
}) {
  if (!destinataire) return { queued: false, reason: "destinataire introuvable" };
  return queueSms({
    type: "RESERVE_ATTRIBUEE",
    templateCode: "reserve_attribuee",
    smsTemplates,
    recipient: {
      userId: extractUid(destinataire),
      name: `${destinataire.prenom||""} ${destinataire.nom||""}`.trim(),
      phone: destinataire.telephone || destinataire.tel || "",
    },
    variables: {
      prenom: destinataire.prenom || "",
      refReserve: refReserve || "",
      titre: titreReserve || "",
      chantier: chantier || "",
      dateLevee: dateLevee || "",
      dateRdv: formatDateRdvPhrase(rdvDate, rdvHeure),
    },
    context: { module: "reserves-quitus", reserveId: reserveId || "" },
  });
}

/**
 * v10.N — Rappel automatique de levée (J : date prévue dépassée).
 * Envoyé une seule fois par cycle via watcher (idempotence flag smsRappelRetardSent).
 * Cible le destinataire COURANT de la réserve (qui peut avoir changé via transfert).
 */
export async function smsReserveRappelLevee({
  smsTemplates, destinataire, refReserve, titreReserve, chantier, dateLevee, reserveId,
}) {
  if (!destinataire) return { queued: false, reason: "destinataire introuvable" };
  return queueSms({
    type: "RESERVE_RAPPEL_LEVEE",
    templateCode: "reserve_rappel_levee",
    smsTemplates,
    recipient: {
      userId: extractUid(destinataire),
      name: `${destinataire.prenom||""} ${destinataire.nom||""}`.trim(),
      phone: destinataire.telephone || destinataire.tel || "",
    },
    variables: {
      prenom: destinataire.prenom || "",
      refReserve: refReserve || "",
      titre: titreReserve || "",
      chantier: chantier || "",
      dateLevee: dateLevee || "",
    },
    context: { module: "reserves-quitus", reserveId: reserveId || "" },
  });
}

/**
 * v10.N — Demande manuelle de levée par Admin/Direction/responsableParc.
 * Bouton "📱 Demander la levée" dans le détail réserve.
 * v2.0.1 — Accepte templateCode optionnel (menu de choix modèle SMS).
 */
export async function smsReserveDemandeLevee({
  smsTemplates, destinataire, demandeur, refReserve, titreReserve, chantier, reserveId,
  templateCode,
}) {
  if (!destinataire) return { queued: false, reason: "destinataire introuvable" };
  return queueSms({
    type: "RESERVE_DEMANDE_LEVEE",
    templateCode: templateCode || "reserve_demande_levee",
    smsTemplates,
    recipient: {
      userId: extractUid(destinataire),
      name: `${destinataire.prenom||""} ${destinataire.nom||""}`.trim(),
      phone: destinataire.telephone || destinataire.tel || "",
    },
    variables: {
      prenom: destinataire.prenom || "",
      refReserve: refReserve || "",
      titre: titreReserve || "",
      chantier: chantier || "",
      demandeurNom: demandeur ? `${demandeur.prenom||""} ${demandeur.nom||""}`.trim() : "",
    },
    context: { module: "reserves-quitus", reserveId: reserveId || "" },
  });
}

/** v10.I — Quitus signé (circuit complet) → SMS au conducteur. */
export async function smsQuitusSigne({
  smsTemplates, conducteur, refReserve, chantier, reserveId, quitusUrl,
}) {
  if (!conducteur) return { queued: false, reason: "conducteur introuvable" };
  return queueSms({
    type: "QUITUS_SIGNED",
    templateCode: "quitus_signe",
    smsTemplates,
    recipient: {
      userId: extractUid(conducteur),
      name: `${conducteur.prenom||""} ${conducteur.nom||""}`.trim(),
      phone: conducteur.telephone || conducteur.tel || "",
    },
    variables: {
      prenom: conducteur.prenom || "",
      refReserve: refReserve || "",
      chantier: chantier || "",
      quitusUrl: quitusUrl || "",
    },
    context: { module: "reserves-quitus", reserveId: reserveId || "" },
  });
}

/** v10.I — Quitus express (signé sur place) → SMS au conducteur. */
export async function smsQuitusExpressSigne({
  smsTemplates, conducteur, technicienNom, refReserve, chantier, reserveId, quitusUrl,
}) {
  if (!conducteur) return { queued: false, reason: "conducteur introuvable" };
  return queueSms({
    type: "QUITUS_EXPRESS_SIGNED",
    templateCode: "quitus_express_signe",
    smsTemplates,
    recipient: {
      userId: extractUid(conducteur),
      name: `${conducteur.prenom||""} ${conducteur.nom||""}`.trim(),
      phone: conducteur.telephone || conducteur.tel || "",
    },
    variables: {
      prenom: conducteur.prenom || "",
      refReserve: refReserve || "",
      chantier: chantier || "",
      technicien: technicienNom || "",
      quitusUrl: quitusUrl || "",
    },
    context: { module: "reserves-quitus", reserveId: reserveId || "" },
  });
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS — MODULE PARC MACHINES (OUTILLAGE)
// ═══════════════════════════════════════════════════════════════

/** v10.I — Sortie d'outil effectuée → SMS au monteur (récap). */
export async function smsOutillageSortie({
  smsTemplates, emprunteur, refOutil, nomOutil, dateRetour, chantier, sortieId,
}) {
  if (!emprunteur) return { queued: false, reason: "emprunteur introuvable" };
  return queueSms({
    type: "TOOL_CHECKOUT",
    templateCode: "outillage_sortie",
    smsTemplates,
    recipient: {
      userId: extractUid(emprunteur),
      name: `${emprunteur.prenom||""} ${emprunteur.nom||""}`.trim(),
      phone: emprunteur.telephone || emprunteur.tel || "",
    },
    variables: {
      prenom: emprunteur.prenom || "",
      ref: refOutil || "",
      nom: nomOutil || "",
      dateRetour: dateRetour || "",
      chantier: chantier || "",
    },
    context: { module: "parc-machines", sortieId: sortieId || "", ref: refOutil || "" },
  });
}

/** v10.I — Retard retour J+1 → SMS au monteur. (Cron Make quotidien.) */
export async function smsOutillageRetardRetour({
  smsTemplates, emprunteur, refOutil, nomOutil, dateRetour, sortieId,
}) {
  if (!emprunteur) return { queued: false, reason: "emprunteur introuvable" };
  return queueSms({
    type: "TOOL_OVERDUE_J1",
    templateCode: "outillage_retard_retour",
    smsTemplates,
    recipient: {
      userId: extractUid(emprunteur),
      name: `${emprunteur.prenom||""} ${emprunteur.nom||""}`.trim(),
      phone: emprunteur.telephone || emprunteur.tel || "",
    },
    variables: {
      prenom: emprunteur.prenom || "",
      ref: refOutil || "",
      nom: nomOutil || "",
      dateRetour: dateRetour || "",
    },
    context: { module: "parc-machines", sortieId: sortieId || "", ref: refOutil || "" },
  });
}

/** v10.I — Relance retard J+3 → SMS au monteur ET au conducteur (2 appels). */
export async function smsOutillageRetardRelance({
  smsTemplates, destinataire, refOutil, nomOutil, dateRetour, emprunteurNom, sortieId,
}) {
  if (!destinataire) return { queued: false, reason: "destinataire introuvable" };
  return queueSms({
    type: "TOOL_OVERDUE_J3",
    templateCode: "outillage_retard_relance",
    smsTemplates,
    recipient: {
      userId: extractUid(destinataire),
      name: `${destinataire.prenom||""} ${destinataire.nom||""}`.trim(),
      phone: destinataire.telephone || destinataire.tel || "",
    },
    variables: {
      prenom: destinataire.prenom || "",
      ref: refOutil || "",
      nom: nomOutil || "",
      dateRetour: dateRetour || "",
      emprunteur: emprunteurNom || "",
    },
    context: { module: "parc-machines", sortieId: sortieId || "", ref: refOutil || "" },
  });
}

/** v10.I — Panne signalée au retour → SMS au responsable parc. */
export async function smsOutillagePanne({
  smsTemplates, responsable, refOutil, nomOutil, pannesLabel, signaleeParNom, bloquante, sortieId,
}) {
  if (!responsable) return { queued: false, reason: "responsable parc introuvable" };
  return queueSms({
    type: "TOOL_DAMAGE_REPORTED",
    templateCode: "outillage_pannes",
    smsTemplates,
    recipient: {
      userId: extractUid(responsable),
      name: `${responsable.prenom||""} ${responsable.nom||""}`.trim(),
      phone: responsable.telephone || responsable.tel || "",
    },
    variables: {
      prenom: responsable.prenom || "",
      ref: refOutil || "",
      nom: nomOutil || "",
      pannes: pannesLabel || "",
      signaleePar: signaleeParNom || "",
      bloquante: bloquante ? "BLOQUANTE" : "non bloquante",
    },
    context: { module: "parc-machines", sortieId: sortieId || "", ref: refOutil || "" },
  });
}

/**
 * v10.K — Rappel automatique de retour outil (à J : date prévue dépassée).
 * Envoyé une seule fois par sortie (idempotence garantie côté code app).
 * Si le monteur prolonge la date, le flag est réinitialisé et le cycle redémarre.
 */
export async function smsOutillageRappelRetour({
  smsTemplates, emprunteur, refOutil, nomOutil, dateRetour, sortieId,
}) {
  if (!emprunteur) return { queued: false, reason: "emprunteur introuvable" };
  return queueSms({
    type: "TOOL_RAPPEL_J",
    templateCode: "outillage_rappel_retour",
    smsTemplates,
    recipient: {
      userId: extractUid(emprunteur),
      name: `${emprunteur.prenom||""} ${emprunteur.nom||""}`.trim(),
      phone: emprunteur.telephone || emprunteur.tel || "",
    },
    variables: {
      prenom: emprunteur.prenom || "",
      ref: refOutil || "",
      nom: nomOutil || "",
      dateRetour: dateRetour || "",
    },
    context: { module: "parc-machines", sortieId: sortieId || "", ref: refOutil || "" },
    // Rappel AUTOMATIQUE (watcher) → soumis à la fenêtre horaire.
    // Source tracée : le dispatcher re-vérifie la clôture avant l'envoi Brevo.
    origine: "auto",
    sourceType: "outillageSortie",
    sourceId: sortieId || null,
  });
}

/**
 * v10.K — Demande manuelle de retour outil par Admin/Direction/Responsable parc.
 * Le demandeur clique "Demander le retour" sur la fiche outil → SMS au monteur.
 */
export async function smsOutillageDemandeRetour({
  smsTemplates, emprunteur, demandeur, refOutil, nomOutil, sortieId,
}) {
  if (!emprunteur) return { queued: false, reason: "emprunteur introuvable" };
  return queueSms({
    type: "TOOL_DEMANDE_RETOUR",
    templateCode: "outillage_demande_retour",
    smsTemplates,
    recipient: {
      userId: extractUid(emprunteur),
      name: `${emprunteur.prenom||""} ${emprunteur.nom||""}`.trim(),
      phone: emprunteur.telephone || emprunteur.tel || "",
    },
    variables: {
      prenom: emprunteur.prenom || "",
      ref: refOutil || "",
      nom: nomOutil || "",
      demandeurPrenom: demandeur?.prenom || "",
      demandeurNom: demandeur ? `${demandeur.prenom||""} ${demandeur.nom||""}`.trim() : "",
    },
    context: { module: "parc-machines", sortieId: sortieId || "", ref: refOutil || "" },
    // Demande MANUELLE (bouton) → départ immédiat, mais on trace la source
    // pour que le dispatcher n'envoie pas un rappel sur une sortie déjà rentrée.
    origine: "manuel",
    sourceType: "outillageSortie",
    sourceId: sortieId || null,
  });
}

// ═══════════════════════════════════════════════════════════════
//  RECHERCHE DE DESTINATAIRES
// ═══════════════════════════════════════════════════════════════

/** Trouve le conducteur d'un chantier dans la liste des utilisateurs. */
export function findConducteur(chObj, users) {
  if (!chObj || !Array.isArray(users)) return null;
  const conducteurNom = (chObj.conducteur || "").trim();
  if (!conducteurNom) return null;
  return users.find(u =>
    `${u.prenom||""} ${u.nom||""}`.trim().toUpperCase() === conducteurNom.toUpperCase()
  ) || null;
}

/**
 * v10.I — Trouve l'assistante achats.
 * Heuristique : 1er user avec rôle "Assistante" (nouveau système),
 * sinon fallback sur fonction contenant "assist" (ancien système).
 */
export function findAssistanteAchats(users) {
  if (!Array.isArray(users)) return null;
  const byRole = users.find(u => {
    const roles = Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []);
    return roles.some(r => (r || "").toLowerCase().includes("assist"));
  });
  if (byRole) return byRole;
  return users.find(u => (u.fonction || "").toLowerCase().includes("assist")) || null;
}

/**
 * v10.I — Trouve le responsable du parc machines.
 * Heuristique : flag `responsableParc === true`, sinon Direction, sinon Admin.
 */
export function findResponsableParc(users) {
  if (!Array.isArray(users)) return null;
  const flagged = users.find(u => u.responsableParc === true);
  if (flagged) return flagged;
  const direction = users.find(u => {
    const roles = Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []);
    return roles.includes("Direction");
  });
  if (direction) return direction;
  return users.find(u => {
    const roles = Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []);
    return roles.includes("Admin");
  }) || null;
}

/** v10.I — Trouve un utilisateur par son UID (gère _id, id, uid). */
export function findUserByUid(uid, users) {
  if (!uid || !Array.isArray(users)) return null;
  return users.find(u =>
    u._id === uid || u.id === uid || u.uid === uid
  ) || null;
}

// ═══════════════════════════════════════════════════════════════
//  NETTOYAGE DE LA QUEUE — v10.I
// ═══════════════════════════════════════════════════════════════

/**
 * v10.I — Supprime les documents smsQueue déjà envoyés par Make.
 *
 * Contexte : les modules Delete/Update de Make sont en erreur silencieuse
 * (problème path Firestore). Les docs envoyés s'accumulent. On nettoie côté app.
 *
 * Make doit OBLIGATOIREMENT passer `status: "sent"` après envoi réussi
 * (sinon ce helper ne supprime rien — c'est volontaire pour sécurité).
 *
 * @returns {Promise<{deleted: number, errors: number}>}
 */
export async function deleteSentSmsQueueDocs() {
  try {
    const q = query(collection(db, "smsQueue"), where("status", "==", "sent"));
    const snap = await getDocs(q);
    if (snap.empty) return { deleted: 0, errors: 0 };

    let deleted = 0;
    let errors = 0;
    for (const d of snap.docs) {
      try {
        await deleteDoc(doc(db, "smsQueue", d.id));
        deleted++;
      } catch (e) {
        errors++;
        console.warn(`[smsService] Échec suppression smsQueue/${d.id}:`, e.message);
      }
    }
    if (deleted > 0) {
      console.log(`[smsService] ${deleted} doc(s) smsQueue purgé(s) (status=sent)`);
    }
    return { deleted, errors };
  } catch (e) {
    console.error("[smsService] Échec query smsQueue purge:", e);
    return { deleted: 0, errors: 1 };
  }
}

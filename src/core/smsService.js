// ═══════════════════════════════════════════════════════════════
//  smsService.js — v10.H (Module SMS automatique via Brevo + Make)
//
//  Service centralisé pour envoyer des SMS depuis n'importe où dans l'app.
//  Architecture :
//    EPJ App  →  Firestore (collection "smsQueue")  →  Make (poll 1 min)  →  Brevo  →  SMS
//
//  L'app ne fait JAMAIS d'appel direct à Brevo. Elle se contente d'écrire un
//  document dans la collection "smsQueue", qui sera traité par Make.
//
//  Avantages :
//    - Découplage : si Make est down, les SMS attendent dans la queue
//    - Sécurité : pas de clé API Brevo dans le code source GitHub (public)
//    - Audit : possibilité de voir les SMS en attente / échec dans Firestore
//
//  Format d'un document smsQueue (créé par cette fonction) :
//    {
//      type: "ORDER_CREATED" | "ORDER_EDITED" | "TOOL_OVERDUE" | ...
//      createdAt: Timestamp,
//      recipientUserId: "Bilardo",
//      recipientName: "Joseph BILARDO",
//      recipientPhone: "+33612345678",
//      templateCode: "commande_creee",
//      message: "Bonjour Joseph, ...",
//      variables: { numCmd: "CMD-2026-0042", ... },
//      context: { module: "commandes", orderId: "abc123", orderNum: "..." },
//      status: "pending",
//    }
//
//  Make va consommer le doc, envoyer le SMS via Brevo, puis :
//    - Si succès : SUPPRIMER le doc (économise Firestore — choix Pierre-Julien v10.H)
//    - Si échec : passer status="failed" avec errorMessage et garder le doc
//                 pour qu'on puisse diagnostiquer
// ═══════════════════════════════════════════════════════════════

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { renderSmsTemplate } from "../modules/parc-machines/parcUtils";

// ─── Validation / utilitaires ─────────────────────────────────

/**
 * Normalise un numéro de téléphone au format E.164 (+33...).
 * Accepte les formats : "06 12 34 56 78", "+33612345678", "0612345678".
 * Retourne null si le numéro est invalide.
 */
export function normalizePhone(raw) {
  if (!raw || typeof raw !== "string") return null;
  // Retire tout sauf chiffres et +
  let cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  // Si déjà au format +33...
  if (cleaned.startsWith("+33")) {
    return cleaned.length >= 11 ? cleaned : null; // +33 + 9 chiffres = 12
  }
  // Si commence par 33 sans +
  if (cleaned.startsWith("33") && cleaned.length === 11) {
    return "+" + cleaned;
  }
  // Si format français 0X XX XX XX XX
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return "+33" + cleaned.slice(1);
  }
  // Sinon on rejette
  return null;
}

/**
 * Trouve le template SMS correspondant à un code, et vérifie qu'il est actif.
 * @param {Array} smsTemplates - le tableau venant de DataContext
 * @param {string} code - le code du template (ex: "commande_creee")
 * @returns {object|null} le template, ou null si introuvable / désactivé
 */
export function findActiveTemplate(smsTemplates, code) {
  if (!Array.isArray(smsTemplates) || !code) return null;
  const tpl = smsTemplates.find(t => (t.id === code || t.code === code));
  if (!tpl) return null;
  if (tpl.actif === false) return null; // kill switch admin
  return tpl;
}

// ─── Fonction principale : queueSms ──────────────────────────

/**
 * Met un SMS en file d'attente pour envoi par Make → Brevo.
 * Si le template est introuvable OU désactivé, ne fait rien (silencieux côté UI,
 * loggé console). C'est volontaire : Pierre-Julien doit pouvoir désactiver un
 * type de SMS depuis Admin → Modèles SMS sans crash.
 *
 * @param {object} options
 * @param {string} options.type - identifiant de l'événement (ORDER_CREATED, ...)
 * @param {string} options.templateCode - code du template à utiliser
 * @param {Array}  options.smsTemplates - liste des templates depuis useData()
 * @param {object} options.recipient - { userId, name, phone }
 * @param {object} options.variables - variables à injecter dans le template
 * @param {object} options.context - contexte (module, orderId, orderNum...)
 * @returns {Promise<{queued: boolean, reason?: string, docId?: string}>}
 */
export async function queueSms({
  type,
  templateCode,
  smsTemplates,
  recipient,
  variables = {},
  context = {},
}) {
  // 1. Validation des paramètres
  if (!type) return { queued: false, reason: "type manquant" };
  if (!templateCode) return { queued: false, reason: "templateCode manquant" };
  if (!recipient || !recipient.phone) {
    return { queued: false, reason: "destinataire sans téléphone" };
  }

  // 2. Vérification du template (existence + flag actif)
  const tpl = findActiveTemplate(smsTemplates, templateCode);
  if (!tpl) {
    console.warn(`[smsService] Template "${templateCode}" introuvable ou désactivé — SMS non envoyé`);
    return { queued: false, reason: "template introuvable ou désactivé" };
  }

  // 3. Normalisation du téléphone
  const phone = normalizePhone(recipient.phone);
  if (!phone) {
    console.warn(`[smsService] Téléphone "${recipient.phone}" invalide — SMS non envoyé`);
    return { queued: false, reason: "téléphone invalide" };
  }

  // 4. Rendu du message final
  const message = renderSmsTemplate(tpl.body || "", variables);
  if (!message || message.trim().length === 0) {
    return { queued: false, reason: "message vide après rendu" };
  }

  // 5. Écriture du document dans la queue
  try {
    const ref = await addDoc(collection(db, "smsQueue"), {
      type,
      createdAt: serverTimestamp(),
      recipientUserId: recipient.userId || "",
      recipientName: recipient.name || "",
      recipientPhone: phone,
      templateCode,
      message,
      variables,
      context,
      status: "pending",
    });
    return { queued: true, docId: ref.id };
  } catch (err) {
    console.error("[smsService] Échec addDoc smsQueue:", err);
    return { queued: false, reason: "erreur Firestore: " + (err.message || "inconnue") };
  }
}

// ─── Helpers spécifiques par type d'événement ────────────────
// Ces helpers encapsulent les variables et le templateCode pour qu'on n'ait
// pas à les retaper à chaque appel.

/**
 * Notification au conducteur quand une commande est créée.
 * Cas d'usage : monteur/chef crée une commande → conducteur du chantier reçoit un SMS.
 * Pas appelée si le créateur est directAchat=true (admin/direction).
 */
export async function smsCommandeCreee({
  smsTemplates, conducteur, demandeurNom, numCmd, chantier, orderId,
}) {
  if (!conducteur) {
    return { queued: false, reason: "conducteur introuvable" };
  }
  return queueSms({
    type: "ORDER_CREATED",
    templateCode: "commande_creee",
    smsTemplates,
    recipient: {
      userId: conducteur.id || conducteur._id,
      name: `${conducteur.prenom||""} ${conducteur.nom||""}`.trim(),
      phone: conducteur.telephone || conducteur.tel || "",
    },
    variables: {
      prenom: conducteur.prenom || "",
      numCmd: numCmd || "",
      demandeur: demandeurNom || "",
      chantier: chantier || "",
    },
    context: {
      module: "commandes",
      orderId: orderId || "",
      orderNum: numCmd || "",
    },
  });
}

/**
 * Notification au conducteur quand une commande est modifiée.
 * Appelée depuis saveEditedOrder() si le statut résultant nécessite revalidation.
 */
export async function smsCommandeModifiee({
  smsTemplates, conducteur, modifieParNom, numCmd, chantier, orderId,
}) {
  if (!conducteur) {
    return { queued: false, reason: "conducteur introuvable" };
  }
  return queueSms({
    type: "ORDER_EDITED",
    templateCode: "commande_modifiee",
    smsTemplates,
    recipient: {
      userId: conducteur.id || conducteur._id,
      name: `${conducteur.prenom||""} ${conducteur.nom||""}`.trim(),
      phone: conducteur.telephone || conducteur.tel || "",
    },
    variables: {
      prenom: conducteur.prenom || "",
      numCmd: numCmd || "",
      modifiePar: modifieParNom || "",
      chantier: chantier || "",
    },
    context: {
      module: "commandes",
      orderId: orderId || "",
      orderNum: numCmd || "",
    },
  });
}

// ─── Helper pour trouver le conducteur d'un chantier ─────────
/**
 * Trouve le conducteur d'un chantier dans la liste des utilisateurs.
 * @param {object} chObj - l'objet chantier (avec champ `conducteur` = "Prénom NOM")
 * @param {Array}  users - liste des utilisateurs
 * @returns {object|null}
 */
export function findConducteur(chObj, users) {
  if (!chObj || !Array.isArray(users)) return null;
  const conducteurNom = (chObj.conducteur || "").trim();
  if (!conducteurNom) return null;
  return users.find(u =>
    `${u.prenom||""} ${u.nom||""}`.trim().toUpperCase() === conducteurNom.toUpperCase()
  ) || null;
}

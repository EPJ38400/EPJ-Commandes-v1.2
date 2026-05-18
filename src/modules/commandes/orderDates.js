// ═══════════════════════════════════════════════════════════════
//  orderDates.js — v10.J
//  Helpers PURS pour la logique de dates de livraison d'une commande.
//
//  Centralise les règles métier suivantes :
//    1. Date de référence "attendue" = date fournisseur si OCR AR activé
//       ET datelivraison renseignée, sinon date de réception souhaitée.
//    2. "En retard" = date de référence dépassée ET commande pas réceptionnée.
//
//  Fonctions PURES (zero side-effect). Testées dans orderDates.test.js.
// ═══════════════════════════════════════════════════════════════

/**
 * Parse une date au format ISO (YYYY-MM-DD) ou FR (DD/MM/YYYY).
 * Retourne un objet Date ou null si invalide.
 */
export function parseOrderDate(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  // Format ISO YYYY-MM-DD
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  // Format FR DD/MM/YYYY
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Retourne la date à laquelle la commande est attendue.
 *
 * @param {object} order - le doc commande (champs `dateReception` et `datelivraison`)
 * @param {object} opts.featureFlags - { ocrArEnabled: bool }
 * @returns {{ date: Date | null, source: "fournisseur" | "souhaitee" | null }}
 */
export function getExpectedDeliveryDate(order, { featureFlags } = {}) {
  if (!order) return { date: null, source: null };
  // Si OCR AR activé ET datelivraison fournie → priorité fournisseur
  if (featureFlags?.ocrArEnabled) {
    const dFournisseur = parseOrderDate(order.datelivraison);
    if (dFournisseur) return { date: dFournisseur, source: "fournisseur" };
  }
  // Fallback : date de réception souhaitée par le demandeur
  const dSouhaitee = parseOrderDate(order.dateReception);
  if (dSouhaitee) return { date: dSouhaitee, source: "souhaitee" };
  return { date: null, source: null };
}

/**
 * Une commande est "en retard" si :
 *   - elle n'est pas déjà réceptionnée (signatureData absente ET statut !== "Réceptionnée")
 *   - sa date de référence (cf. getExpectedDeliveryDate) est strictement dépassée
 *   - elle n'est pas refusée ni en simple "En attente de validation"
 *
 * Le statut "Réceptionnée" est exclu car déjà livré. Les statuts non encore
 * envoyés ("En attente de validation", "Validée") sont exclus car la commande
 * n'a même pas encore quitté l'entreprise.
 *
 * @param {object} order
 * @param {object} opts.featureFlags
 * @param {Date}   opts.today - injectable pour tests (sinon = new Date())
 * @returns {boolean}
 */
export function isOrderLate(order, { featureFlags, today } = {}) {
  if (!order) return false;
  // Filtre par statut
  const st = order.statut;
  if (st === "Réceptionnée" || st === "Refusée") return false;
  if (st === "En attente de validation" || st === "Validée") return false;
  // Si signature de réception déjà posée → pas en retard
  if (order.signatureData) return false;
  const { date } = getExpectedDeliveryDate(order, { featureFlags });
  if (!date) return false;
  const ref = today || new Date();
  // Comparaison au niveau jour (pas heure)
  const todayUTC = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return date.getTime() < todayUTC;
}

/**
 * Formate une Date en JJ/MM/AAAA (français).
 * Retourne "" si invalide.
 */
export function formatDateFR(d) {
  if (!(d instanceof Date) || isNaN(d.getTime())) return "";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yy = d.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}

/**
 * Calcule les compteurs de l'historique pour la bannière d'accueil.
 *
 * @param {Array}  orders - liste des commandes
 * @param {object} opts.featureFlags
 * @param {Date}   opts.today
 * @returns {{ late: number, lateOrders: Array }}
 */
export function computeLateOrders(orders, { featureFlags, today } = {}) {
  if (!Array.isArray(orders)) return { late: 0, lateOrders: [] };
  const lateOrders = orders.filter(o => isOrderLate(o, { featureFlags, today }));
  return { late: lateOrders.length, lateOrders };
}

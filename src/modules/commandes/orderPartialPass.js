// ═══════════════════════════════════════════════════════════════
//  orderPartialPass — Calcul du passage partiel chez le fournisseur
//  v1.13.0 (nouveau)
//
//  Symétrique de orderReceive.buildReceptionPayload mais pour le
//  passage de commande (Envoyée aux achats → Commandée).
//
//  Entrée :
//   - order : la commande mère
//   - orderedByIndex : { 0: qty, 1: qty, ... } qtés effectivement
//     commandées chez le fournisseur, par index d'item.
//     Si une clé n'est pas présente : ligne non commandée (qté 0).
//     Si la valeur === order.items[i].qty : ligne entièrement commandée.
//     Si 0 < valeur < order.items[i].qty : ligne partiellement commandée.
//
//  Sortie :
//   { payload, reliquatItems }
//    - payload : à utiliser dans updateDoc(commande mère).
//      Contient statut ("Commandée" si tout, "Commandée partiellement"
//      sinon), dateCommande, orderedByIndex (trace).
//    - reliquatItems : items à mettre dans la commande reliquat.
//      Vide si tout a été commandé.
//
//  Note : la commande mère garde ses items d'origine inchangés
//  (pour conserver l'historique de la demande initiale). Le
//  champ orderedByIndex enregistre ce qui a été effectivement
//  passé sur quelle ligne.
// ═══════════════════════════════════════════════════════════════

import { normalizeQty } from "./orderReceive";

/**
 * Calcule le payload de passage partiel + la liste des items reliquat.
 */
export function buildPartialPassPayload(order, orderedByIndex, { user, todayISO } = {}) {
  if (!order || !Array.isArray(order.items)) {
    return { payload: null, reliquatItems: [] };
  }

  const items = order.items;
  const ordered = orderedByIndex || {};

  // Pour chaque ligne, on calcule la qté restante (non commandée)
  const reliquatItems = [];
  let allFullyOrdered = true;
  let nothingOrdered = true;
  const normalizedOrdered = {};

  items.forEach((it, idx) => {
    const requested = normalizeQty(it.qty);
    const rawValue = ordered[idx];
    const orderedQty = normalizeQty(rawValue);
    const clampedOrdered = Math.min(Math.max(0, orderedQty), requested);
    normalizedOrdered[idx] = clampedOrdered;

    const remaining = requested - clampedOrdered;

    if (remaining > 0) {
      // Au moins une partie n'a pas été commandée → on ajoute au reliquat
      reliquatItems.push({
        ...it,
        qty: remaining,
      });
      allFullyOrdered = false;
    }
    if (clampedOrdered > 0) {
      nothingOrdered = false;
    }
  });

  if (nothingOrdered) {
    // Rien n'a été commandé : on annule, pas de changement de statut
    return { payload: null, reliquatItems: [] };
  }

  const newStatus = allFullyOrdered ? "Commandée" : "Commandée partiellement";

  const payload = {
    statut: newStatus,
    dateCommande: new Date().toISOString(),
    // Trace : qui a passé, quand, qtés par ligne
    passLog: {
      passedBy: user ? `${user.prenom || ""} ${user.nom || ""}`.trim() : "—",
      passedById: user?.id || user?._id || "",
      passedAt: new Date().toISOString(),
      orderedByIndex: normalizedOrdered,
    },
  };

  return { payload, reliquatItems };
}

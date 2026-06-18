// ═══════════════════════════════════════════════════════════════
//  orderMessages.js — Helper partagé "message non lu" sur une commande
//
//  Les messages d'une commande vivent dans order.messages[] (chaque
//  message porte userId + createdAt ISO). Le "lu" par utilisateur vit
//  dans order.messagesSeen[myId] (timestamp ISO de dernière lecture).
//  myId = user.id || user._id.
//
//  Sémantique ALIGNÉE sur le calcul historique de HomePage
//  (commandesNouveauxMessages) : non lu = il existe AU MOINS UN message
//  d'un autre que moi dont la date est postérieure à ma dernière lecture.
//  Source unique pour HomePage (bannière) et CommandesInner (enveloppe).
// ═══════════════════════════════════════════════════════════════

export function hasUnreadMessages(order, myId) {
  const msgs = Array.isArray(order?.messages) ? order.messages : [];
  if (!myId || msgs.length === 0) return false;
  const seen = Date.parse(order?.messagesSeen?.[myId] || 0) || 0;
  return msgs.some(m => m.userId !== myId && (Date.parse(m.createdAt) || 0) > seen);
}

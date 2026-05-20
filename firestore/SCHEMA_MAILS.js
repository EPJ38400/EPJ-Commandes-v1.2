// ═══════════════════════════════════════════════════════════════
//  SCHEMA_MAILS — Noms des collections Firestore liées aux mails
//
//  v1.17.5 — Fichier recréé suite à un push GitHub qui avait cassé
//  la résolution de cet import dans src/core/gmail/useReserveMails.js
//  (le fichier avait été supprimé par mégarde, empêchant tout build
//  Vercel de réussir). Contenu minimal pour rétablir la compilation.
//
//  Si le schéma évolue (ajout de collections, sous-collections, etc.),
//  c'est ici qu'on centralise les noms pour ne plus avoir de strings
//  magiques dans le code applicatif.
// ═══════════════════════════════════════════════════════════════

/** Mails rattachés à une réserve (envoyés/reçus). */
export const COLLECTION_RESERVE_MAILS = "reserveMails";

/** Mails reçus côté boîte EPJ qui n'ont pas encore été rattachés à une réserve. */
export const COLLECTION_MAILS_A_CLASSER = "mailsAClasser";

// ═══════════════════════════════════════════════════════════════
//  emojiLibrary.js — Bibliothèque d'emojis centralisée
//
//  Emojis classés par thème métier BTP. Utilisable pour :
//  - Icônes de catégories du catalogue
//  - Icônes de sous-catégories
//  - (plus tard) Templates SMS, Réserves, etc.
//
//  Convention : chaque groupe a un label et une liste d'emojis.
//  Le picker affiche des onglets par groupe + permet saisie libre.
// ═══════════════════════════════════════════════════════════════

export const EMOJI_GROUPS = [
  {
    id: "btp",
    label: "BTP & Construction",
    emojis: [
      "🏗️", "🏢", "🏠", "🧱", "🪨", "🚧", "🏭", "🏚️",
      "🪵", "🪛", "🔩", "⛓️", "🔗", "🪜", "🧰", "📐",
      "📏", "🗜️", "🚪", "🪟", "🚽", "🛁", "🧯",
    ],
  },
  {
    id: "outils",
    label: "Outillage",
    emojis: [
      "🔧", "🔨", "🪚", "🪓", "⚒️", "🛠️", "⛏️", "🪠",
      "🧲", "🔦", "🔋", "🔌", "⚡", "💡", "🪫", "🔭",
      "🎛️", "📡", "📟", "☎️", "🖨️",
    ],
  },
  {
    id: "materiaux",
    label: "Matériaux",
    emojis: [
      "🪣", "🧴", "🧽", "🧹", "🪥", "🪒", "🧰", "📦",
      "🗃️", "📫", "💧", "🌡️", "🔥", "❄️", "☔", "💨",
      "🧊", "🧪", "🧫", "⚗️", "🛢️",
    ],
  },
  {
    id: "securite",
    label: "Sécurité & EPI",
    emojis: [
      "🦺", "⛑️", "🥽", "🧤", "👞", "👔", "🧥", "🥾",
      "👓", "😷", "🩹", "🩺", "⚕️", "🚨", "🛑", "⚠️",
      "🚫", "⛔", "📛", "🔴", "🟢", "🟡",
    ],
  },
  {
    id: "logistique",
    label: "Logistique & Transport",
    emojis: [
      "🚚", "🚛", "🚐", "🏎️", "🚗", "🏍️", "🚲", "⛽",
      "🛞", "🪝", "🏷️", "🔖", "📋", "📝", "📄", "🗂️",
      "📅", "🗓️", "⏰", "⌛", "🔔", "📲",
    ],
  },
  {
    id: "divers",
    label: "Divers",
    emojis: [
      "📦", "🔑", "🗝️", "🔒", "🔓", "🔐", "🔏", "💼",
      "🎯", "✅", "❌", "➕", "➖", "⭐", "💯", "📊",
      "📈", "📉", "🧾", "💰", "💶", "🛒",
    ],
  },
];

// Version "à plat" pour recherche ou autres usages
export const ALL_EMOJIS = EMOJI_GROUPS.flatMap(g => g.emojis);

// Retourne le groupe contenant un emoji donné (pour retrouver l'onglet)
export function findEmojiGroup(emoji) {
  return EMOJI_GROUPS.find(g => g.emojis.includes(emoji));
}

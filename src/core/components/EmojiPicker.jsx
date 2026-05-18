// ═══════════════════════════════════════════════════════════════
//  EmojiPicker.jsx — Picker d'emoji réutilisable
//
//  Props :
//  - value         : l'emoji (ou URL d'image) actuellement sélectionné
//  - onChange(val) : callback appelé avec le nouvel emoji / URL
//  - compact       : si true, affiche un picker compact (sans titres)
// ═══════════════════════════════════════════════════════════════

import { useState, useMemo } from "react";
import { EMOJI_GROUPS, findEmojiGroup } from "../emojiLibrary";

export function EmojiPicker({ value, onChange, compact = false }) {
  // Onglet sélectionné : soit celui contenant l'emoji courant, soit le premier
  const initialTabId = useMemo(() => {
    const g = findEmojiGroup(value);
    return g ? g.id : EMOJI_GROUPS[0].id;
  }, []);
  const [tabId, setTabId] = useState(initialTabId);
  const activeGroup = EMOJI_GROUPS.find(g => g.id === tabId) || EMOJI_GROUPS[0];

  const BLUE = "#00A3E0";
  const GRAY = "#6B6B6B";
  const GRAY_LIGHT = "#EEEEEE";

  const isImageValue = value && (value.startsWith("http") || value.startsWith("data:"));

  return (
    <div style={{ background: "#fafafa", borderRadius: 10, padding: 10, border: "1px solid #eee" }}>
      {!compact && (
        <div style={{ fontSize: 11, fontWeight: 700, color: GRAY, marginBottom: 6 }}>
          CHOISIR UNE ICÔNE
        </div>
      )}

      {/* Onglets par groupe */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8, borderBottom: "1px solid #e0e0e0", paddingBottom: 6 }}>
        {EMOJI_GROUPS.map(g => {
          const active = g.id === tabId;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => setTabId(g.id)}
              style={{
                padding: "4px 9px",
                borderRadius: 6,
                border: "none",
                background: active ? BLUE : "#fff",
                color: active ? "#fff" : GRAY,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {g.label}
            </button>
          );
        })}
      </div>

      {/* Grille d'emojis du groupe actif */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, maxHeight: 180, overflowY: "auto" }}>
        {activeGroup.emojis.map(em => {
          const selected = em === value;
          return (
            <button
              key={em}
              type="button"
              onClick={() => onChange(em)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: selected ? `2px solid ${BLUE}` : "2px solid transparent",
                background: selected ? "#E3F2FD" : "#fff",
                fontSize: 20,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {em}
            </button>
          );
        })}
      </div>

      {/* Saisie libre (emoji spécifique ou URL d'image) */}
      <div style={{ marginTop: 10, borderTop: "1px solid #e0e0e0", paddingTop: 10 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: GRAY, marginBottom: 4 }}>
          OU COLLER UN ÉMOJI / URL D'IMAGE
        </div>
        <input
          className="epj-input"
          placeholder="Émoji ou https://..."
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          style={{ width: "100%", padding: "6px 8px", fontSize: 13, boxSizing: "border-box" }}
        />
        {isImageValue && (
          <div style={{ marginTop: 6, fontSize: 10, color: GRAY }}>
            🖼 URL d'image détectée — sera affichée comme miniature.
          </div>
        )}
      </div>
    </div>
  );
}

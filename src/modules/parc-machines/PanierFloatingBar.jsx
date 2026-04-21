// ═══════════════════════════════════════════════════════════════
//  PanierFloatingBar v10 — Barre flottante en bas quand panier non vide
//  Texte dynamique : "Sortir 1 outil" ou "Sortir N outils"
// ═══════════════════════════════════════════════════════════════
import { EPJ, font } from "../../core/theme";
import { usePanierSortie } from "./PanierSortieContext";

export function PanierFloatingBar({ onContinue }) {
  const panier = usePanierSortie();

  if (!panier.active) return null; // panier vide → pas de barre

  const label = panier.count === 1
    ? "Sortir 1 outil →"
    : `Sortir ${panier.count} outils →`;

  return (
    <div style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      background: EPJ.gray900,
      color: "#fff",
      // Safe-area : le padding du bas s'adapte (home indicator iPhone)
      padding: "12px max(14px, env(safe-area-inset-right)) calc(12px + env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left))",
      boxShadow: "0 -4px 20px rgba(0,0,0,.15)",
      zIndex: 50,
      display: "flex",
      alignItems: "center",
      gap: 10,
      borderTop: `3px solid ${EPJ.orange}`,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: EPJ.orange, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20, fontWeight: 800, flexShrink: 0,
        fontVariantNumeric: "tabular-nums",
      }}>
        {panier.count}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>
          Panier de sortie
        </div>
        <div style={{ fontSize: 11, color: "#E0E0E0", marginTop: 1 }}>
          {panier.count} outil{panier.count > 1 ? "s" : ""} sélectionné{panier.count > 1 ? "s" : ""}
        </div>
      </div>
      <button
        onClick={panier.clear}
        style={{
          background: "rgba(255,255,255,.12)",
          color: "#fff", border: "none", borderRadius: 8,
          padding: "8px 10px", fontSize: 11, fontWeight: 600,
          cursor: "pointer", fontFamily: font.body,
          flexShrink: 0,
        }}
      >✕ Vider</button>
      <button
        onClick={onContinue}
        style={{
          background: EPJ.orange,
          color: "#fff", border: "none", borderRadius: 8,
          padding: "10px 14px", fontSize: 12, fontWeight: 700,
          cursor: "pointer",
          fontFamily: font.body,
          flexShrink: 0,
        }}
      >{label}</button>
    </div>
  );
}

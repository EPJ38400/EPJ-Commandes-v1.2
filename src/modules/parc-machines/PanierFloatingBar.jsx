// ═══════════════════════════════════════════════════════════════
//  PanierFloatingBar — Barre flottante en bas quand panier actif
//  Affiche le nombre d'outils sélectionnés + boutons Annuler/Continuer
// ═══════════════════════════════════════════════════════════════
import { EPJ, font } from "../../core/theme";
import { usePanierSortie } from "./PanierSortieContext";

export function PanierFloatingBar({ onContinue }) {
  const panier = usePanierSortie();

  if (!panier.active) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 0, left: 0, right: 0,
      background: EPJ.gray900,
      color: "#fff",
      padding: "12px 14px",
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
          Sortie en cours
        </div>
        <div style={{ fontSize: 11, color: "#E0E0E0", marginTop: 1 }}>
          {panier.count === 0
            ? "Sélectionne des outils à ajouter"
            : `${panier.count} outil${panier.count > 1 ? "s" : ""} dans le panier`}
        </div>
      </div>
      <button
        onClick={panier.cancelPanier}
        style={{
          background: "rgba(255,255,255,.12)",
          color: "#fff", border: "none", borderRadius: 8,
          padding: "8px 10px", fontSize: 11, fontWeight: 600,
          cursor: "pointer", fontFamily: font.body,
          flexShrink: 0,
        }}
      >✕ Annuler</button>
      <button
        onClick={onContinue}
        disabled={panier.count === 0}
        style={{
          background: panier.count === 0 ? EPJ.gray500 : EPJ.orange,
          color: "#fff", border: "none", borderRadius: 8,
          padding: "10px 14px", fontSize: 12, fontWeight: 700,
          cursor: panier.count === 0 ? "not-allowed" : "pointer",
          fontFamily: font.body,
          flexShrink: 0,
          opacity: panier.count === 0 ? 0.5 : 1,
        }}
      >Continuer →</button>
    </div>
  );
}

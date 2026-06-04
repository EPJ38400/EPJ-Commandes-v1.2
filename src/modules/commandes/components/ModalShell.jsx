// ═══════════════════════════════════════════════════════════════
//  ModalShell — overlay + carte centrée réutilisable pour les modales
//  du Dashboard achat (clôture, réclamation). Ferme au clic backdrop /
//  Échap. Bornée en hauteur, scrollable, safe-area-aware.
// ═══════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { EPJ, font } from "../../../core/theme";

export function ModalShell({ title, subtitle, onClose, children, footer, maxWidth = 460 }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,.42)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "max(16px, env(safe-area-inset-top)) 16px max(16px, env(safe-area-inset-bottom))",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth,
          maxHeight: "88vh", display: "flex", flexDirection: "column",
          background: EPJ.white, borderRadius: 16,
          border: `1px solid ${EPJ.gray200}`,
          boxShadow: "0 18px 48px rgba(0,0,0,.18)", overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 18px 12px", borderBottom: `1px solid ${EPJ.gray200}` }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: font.display, fontSize: 18, color: EPJ.gray900 }}>{title}</div>
              {subtitle && <div style={{ fontSize: 12, color: EPJ.gray500, marginTop: 2 }}>{subtitle}</div>}
            </div>
            <button
              onClick={onClose}
              aria-label="Fermer"
              style={{
                border: "none", background: "transparent", cursor: "pointer",
                fontSize: 22, lineHeight: 1, color: EPJ.gray500, padding: 2,
              }}
            >
              ×
            </button>
          </div>
        </div>
        <div style={{ padding: 18, overflowY: "auto" }}>{children}</div>
        {footer && (
          <div style={{ padding: "12px 18px", borderTop: `1px solid ${EPJ.gray200}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

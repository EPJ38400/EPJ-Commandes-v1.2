// ═══════════════════════════════════════════════════════════════
//  <StatCard> — primitive DS-1 (KPI)
//
//  Anatomie (DIRECTION_ARTISTIQUE §5) : label 13px gris secondaire,
//  valeur 24px graisse 500 tabular-nums, delta optionnel 12px coloré
//  sémantique. Fond blanc bordé (style unique retenu).
//  États : repos / chargement (squelette) / vide (valeur « — »).
// ═══════════════════════════════════════════════════════════════
import { EPJ, font, radius, space, fontSize, fontWeight, shadow } from "../theme";

// delta : 'up' / 'down' / 'neutral' — couleur sémantique de tendance.
const DELTA_COLORS = {
  up:      EPJ.greenText,
  down:    EPJ.redText,
  neutral: EPJ.gray500,
};

export function StatCard({ label, value, delta, deltaTone = "neutral", icon, loading = false }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: space.sm,
      background: EPJ.white,
      border: `1px solid ${EPJ.gray200}`,
      borderRadius: radius.lg,
      boxShadow: shadow.sm,
      padding: space.lg,
      minWidth: 0,
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: space.sm,
        fontSize: fontSize.sm, color: EPJ.gray500, fontFamily: font.body,
        fontWeight: fontWeight.medium,
      }}>
        {icon != null && <span style={{ lineHeight: 1 }}>{icon}</span>}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {label}
        </span>
      </div>

      {loading ? (
        <div style={{
          height: fontSize.xl + 4, width: "60%",
          borderRadius: radius.sm, background: EPJ.gray100,
          animation: "fadeIn .3s ease",
        }} aria-label="Chargement" />
      ) : (
        <div style={{
          fontSize: fontSize.xl,
          fontWeight: fontWeight.medium,
          color: EPJ.gray900,
          fontFamily: font.body,
          fontVariantNumeric: "tabular-nums",
          lineHeight: 1.1,
        }}>
          {value != null && value !== "" ? value : "—"}
        </div>
      )}

      {!loading && delta != null && delta !== "" && (
        <div style={{
          fontSize: fontSize.xs,
          fontWeight: fontWeight.medium,
          color: DELTA_COLORS[deltaTone] || EPJ.gray500,
          fontFamily: font.body,
          fontVariantNumeric: "tabular-nums",
        }}>
          {deltaTone === "up" ? "▲ " : deltaTone === "down" ? "▼ " : ""}{delta}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  <Button> — primitive DS-1
//
//  Variantes (DIRECTION_ARTISTIQUE §5) : primary (fond bleu/texte blanc),
//  secondary (bordé), ghost (texte seul), danger (rouge). Hauteur 36
//  desktop / 44 PWA. Graisse 500, radius md, icône 16px à gauche.
//  États : repos / hover / focus visible / actif / désactivé / chargement.
// ═══════════════════════════════════════════════════════════════
import { EPJ, font, radius, space, fontSize, fontWeight, shadow } from "../theme";
import { useViewport } from "../useViewport";
import { useInteractive } from "./useInteractive";

const VARIANTS = {
  primary: {
    bg: EPJ.blue, color: EPJ.white, border: "transparent",
    hoverBg: EPJ.blueText, activeBg: EPJ.blueText, spinner: EPJ.white,
  },
  danger: {
    bg: EPJ.red, color: EPJ.white, border: "transparent",
    hoverBg: EPJ.redText, activeBg: EPJ.redText, spinner: EPJ.white,
  },
  secondary: {
    bg: EPJ.white, color: EPJ.gray900, border: EPJ.gray200,
    hoverBg: EPJ.gray50, activeBg: EPJ.gray100, spinner: EPJ.blue,
  },
  ghost: {
    bg: "transparent", color: EPJ.gray700, border: "transparent",
    hoverBg: EPJ.gray100, activeBg: EPJ.gray200, spinner: EPJ.blue,
  },
};

export function Button({
  variant = "primary",
  onClick,
  disabled = false,
  loading = false,
  icon,
  type = "button",
  full = false,
  children,
  ...rest
}) {
  const v = VARIANTS[variant] || VARIANTS.primary;
  const isPwa = useViewport() === "mobile";
  const isDisabled = disabled || loading;
  const { hover, focus, active, handlers } = useInteractive(isDisabled);

  let bg = v.bg;
  if (!isDisabled) {
    if (active) bg = v.activeBg;
    else if (hover && !isPwa) bg = v.hoverBg;
  }

  return (
    <button
      type={type}
      onClick={isDisabled ? undefined : onClick}
      disabled={isDisabled}
      {...handlers}
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: space.sm,
        width: full ? "100%" : undefined,
        height: isPwa ? 44 : 36,
        padding: `0 ${space.lg}px`,
        background: bg,
        color: v.color,
        border: `1px solid ${v.border}`,
        borderRadius: radius.md,
        fontSize: isPwa ? fontSize.base : fontSize.md,
        fontWeight: fontWeight.medium,
        fontFamily: font.body,
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled && !loading ? 0.5 : 1,
        transition: "background .15s ease, box-shadow .15s ease",
        whiteSpace: "nowrap",
        ...(focus && !isDisabled ? { outline: "none", boxShadow: shadow.focus } : null),
      }}
    >
      {loading ? (
        <span
          aria-label="Chargement"
          style={{
            width: 16, height: 16, borderRadius: "50%",
            border: `2px solid ${v.color}55`,
            borderTopColor: v.color,
            animation: "spin .7s linear infinite",
            display: "inline-block",
          }}
        />
      ) : (
        <>
          {icon != null && (
            <span style={{ display: "inline-flex", fontSize: 16, lineHeight: 1 }}>{icon}</span>
          )}
          {children}
        </>
      )}
    </button>
  );
}

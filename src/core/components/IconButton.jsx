// ═══════════════════════════════════════════════════════════════
//  <IconButton> — primitive DS-1.1 (bouton icône-seule, dense)
//
//  Remplace les `IconBtn` locaux dupliqués par écran (actions de
//  tableau/carte, ✏️/🗑). Anatomie ghost (DIRECTION_ARTISTIQUE §5) :
//  transparent au repos, fond doux au hover desktop, sans bordure.
//  Taille 34 desktop / 44 PWA (cible tactile). Focus clavier visible.
//
//  `label` est OBLIGATOIRE (aria-label + title) : un bouton icône sans
//  libellé accessible est incomplet → warning console si absent.
//
//  Variantes : `neutral` (gris) | `danger` (rouge, toujours ghost — la
//  rareté du rouge DA interdit un plein ligne par ligne). Les cas qui ne
//  sont PAS du ghost (overlay sur photo, chips pleins) restent bespoke :
//  ne pas déformer cette primitive pour les y faire entrer.
// ═══════════════════════════════════════════════════════════════
import { EPJ, font, radius, shadow } from "../theme";
import { useViewport } from "../useViewport";
import { useInteractive } from "./useInteractive";

const VARIANTS = {
  neutral: { color: EPJ.gray600, hoverBg: EPJ.gray100 },
  danger:  { color: EPJ.redText, hoverBg: EPJ.dangerBg },
};

export function IconButton({
  label,
  variant = "neutral",
  onClick,
  disabled = false,
  type = "button",
  children,
  ...rest
}) {
  if (!label) {
    console.warn("<IconButton> : prop `label` manquante — aria-label obligatoire pour l'accessibilité.");
  }
  const v = VARIANTS[variant] || VARIANTS.neutral;
  const isPwa = useViewport() === "mobile";
  const { hover, focus, handlers } = useInteractive(disabled);
  const size = isPwa ? 44 : 34;

  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      {...handlers}
      {...rest}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: radius.md,
        border: "none",
        background: !disabled && hover && !isPwa ? v.hoverBg : "transparent",
        color: v.color,
        fontSize: 16,
        fontFamily: font.body,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background .12s ease, box-shadow .15s ease",
        ...(focus && !disabled ? { outline: "none", boxShadow: shadow.focus } : null),
      }}
    >
      {children}
    </button>
  );
}

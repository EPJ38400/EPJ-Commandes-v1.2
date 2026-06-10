// ═══════════════════════════════════════════════════════════════
//  <Banner> — primitive DS-1 (alertes / rappels)
//
//  Anatomie (DIRECTION_ARTISTIQUE §5) : bordure gauche 3 px couleur
//  sémantique (radius 0 sur ce côté), fond doux *Bg, icône + titre 500
//  + texte, action optionnelle à droite. Cliquable → chevron + clavier.
//
//  Remplace les ~53 bannières inline de l'app (9 dans HomePage).
// ═══════════════════════════════════════════════════════════════
import { EPJ, font, radius, space, fontSize, fontWeight } from "../theme";
import { useViewport } from "../useViewport";
import { useInteractive } from "./useInteractive";

// Table de correspondance tone → couleurs sémantiques (centralisée).
const TONES = {
  info:    { accent: EPJ.blue,    bg: EPJ.infoBg,    text: EPJ.blueText   },
  success: { accent: EPJ.green,   bg: EPJ.successBg, text: EPJ.greenText  },
  warning: { accent: EPJ.orange,  bg: EPJ.warningBg, text: EPJ.orangeText },
  danger:  { accent: EPJ.red,     bg: EPJ.dangerBg,  text: EPJ.redText    },
  neutral: { accent: EPJ.gray400, bg: EPJ.gray100,   text: EPJ.gray600    },
};

export function Banner({ tone = "info", icon, title, text, onClick, action }) {
  const t = TONES[tone] || TONES.info;
  const clickable = typeof onClick === "function";
  const isPwa = useViewport() === "mobile";
  const { hover, focus, handlers } = useInteractive(false);
  const showHover = clickable && hover && !isPwa;

  const onKeyDown = (e) => {
    if (!clickable) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(e);
    }
  };

  return (
    <div
      onClick={clickable ? onClick : undefined}
      onKeyDown={onKeyDown}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      {...(clickable ? handlers : {})}
      style={{
        display: "flex",
        alignItems: "center",
        gap: space.md,
        marginBottom: space.sm + 2,
        padding: `${space.md}px ${space.lg - 2}px`,
        background: t.bg,
        border: `1px solid ${t.accent}40`,
        borderLeft: `3px solid ${t.accent}`,
        borderRadius: radius.md,
        borderTopLeftRadius: 0,
        borderBottomLeftRadius: 0,
        cursor: clickable ? "pointer" : "default",
        transition: "border-color .15s ease, background .15s ease",
        ...(showHover ? { borderColor: `${t.accent}80` } : null),
        ...(clickable && focus
          ? { outline: "none", boxShadow: `0 0 0 3px ${t.accent}33` }
          : null),
      }}
    >
      {icon != null && (
        <div style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{icon}</div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {title && (
          <div style={{
            fontSize: fontSize.sm,
            fontWeight: fontWeight.medium,
            color: t.text,
            fontFamily: font.body,
          }}>
            {title}
          </div>
        )}
        {text && (
          <div style={{
            fontSize: fontSize.xs,
            color: t.text,
            opacity: 0.85,
            marginTop: 2,
            lineHeight: 1.4,
            fontFamily: font.body,
          }}>
            {text}
          </div>
        )}
      </div>

      {action && <div style={{ flexShrink: 0 }}>{action}</div>}

      {clickable && !action && (
        <span style={{
          color: t.accent,
          fontSize: fontSize.lg,
          fontWeight: fontWeight.medium,
          flexShrink: 0,
          lineHeight: 1,
        }} aria-hidden="true">→</span>
      )}
    </div>
  );
}

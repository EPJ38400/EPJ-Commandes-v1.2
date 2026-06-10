// ═══════════════════════════════════════════════════════════════
//  <ListRow> — primitive DS-1 (ligne tactile, PWA surtout)
//
//  Anatomie (DIRECTION_ARTISTIQUE §5) : zone tactile pleine largeur,
//  padding vertical 12-16, chevron droit si navigable, séparateur
//  gray100. États : repos / hover desktop / actif / focus visible.
// ═══════════════════════════════════════════════════════════════
import { EPJ, font, space, fontSize, fontWeight, shadow } from "../theme";
import { useViewport } from "../useViewport";
import { useInteractive } from "./useInteractive";

export function ListRow({ icon, title, subtitle, meta, right, onClick, navigable }) {
  const isPwa = useViewport() === "mobile";
  const clickable = typeof onClick === "function";
  const showChevron = navigable ?? clickable;
  const { hover, focus, active, handlers } = useInteractive(!clickable);

  let bg = EPJ.white;
  if (clickable) {
    if (active) bg = EPJ.gray100;
    else if (hover && !isPwa) bg = EPJ.gray50;
  }

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
        padding: `${isPwa ? space.lg : space.md}px ${space.md}px`,
        background: bg,
        borderBottom: `1px solid ${EPJ.gray100}`,
        cursor: clickable ? "pointer" : "default",
        transition: "background .12s ease, box-shadow .12s ease",
        fontFamily: font.body,
        ...(clickable && focus ? { outline: "none", boxShadow: shadow.focus } : null),
      }}
    >
      {icon != null && (
        <div style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{icon}</div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: fontSize.base,
          fontWeight: fontWeight.medium,
          color: EPJ.gray900,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {title}
        </div>
        {subtitle && (
          <div style={{
            fontSize: fontSize.sm, color: EPJ.gray500, marginTop: 2,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {subtitle}
          </div>
        )}
      </div>

      {meta != null && (
        <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
          {meta}
        </div>
      )}

      {right != null && <div style={{ flexShrink: 0 }}>{right}</div>}

      {showChevron && (
        <span style={{ color: EPJ.gray300, fontSize: fontSize.lg, flexShrink: 0, lineHeight: 1 }} aria-hidden="true">
          ›
        </span>
      )}
    </div>
  );
}

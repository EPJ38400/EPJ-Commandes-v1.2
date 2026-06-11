// ═══════════════════════════════════════════════════════════════
//  <Field> — primitive DS-1 (input / select / textarea — ~198 contrôles)
//
//  Anatomie (DIRECTION_ARTISTIQUE §5) : label au-dessus 13px medium,
//  message d'erreur 12px redText sous le champ. Hauteur 36 desktop /
//  44 PWA, radius md, bordure gray200, focus anneau bleu. Select et
//  textarea alignés sur le même style.
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight, shadow } from "../theme";
import { useViewport } from "../useViewport";

export function Field({
  as = "input",
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  placeholder,
  options = [],
  disabled = false,
  required = false,
  id,
  rows = 4,
  // v1.1 — ajouts strictement additifs (défauts = rendu historique)
  dense = false,         // hauteur/padding compacts (inline, cellules)
  width,                 // largeur du wrapper (défaut : auto/100% selon parent)
  mono = false,          // contrôle en font.mono (réf, n° série, SHA)
  inputStyle,            // override du style du contrôle — APPLIQUÉ EN DERNIER
  ...rest
}) {
  const isPwa = useViewport() === "mobile";
  const [focus, setFocus] = useState(false);
  const controlHeight = dense ? (isPwa ? 36 : 30) : (isPwa ? 44 : 36);
  const hPad = dense ? space.sm : space.md;
  const hasError = !!error;

  // onFocus/onBlur/style externes : on les COMPOSE (le reset focus interne
  // d'abord, puis le handler appelant) au lieu de les laisser écraser le
  // comportement interne via {...rest}. Fix backlog v1.1 (anneau persistant).
  const { onFocus: extFocus, onBlur: extBlur, style: extStyle, ...restClean } = rest;

  const baseStyle = {
    width: "100%",
    padding: as === "textarea" ? `${space.sm + 2}px ${space.md}px` : `0 ${hPad}px`,
    height: as === "textarea" ? undefined : controlHeight,
    minHeight: as === "textarea" ? controlHeight * 2 : undefined,
    background: disabled ? EPJ.gray50 : EPJ.white,
    color: EPJ.gray900,
    border: `1px solid ${hasError ? EPJ.red : (focus ? EPJ.blue : EPJ.gray200)}`,
    borderRadius: radius.md,
    fontSize: isPwa ? fontSize.base : fontSize.md,
    fontFamily: font.body,
    outline: "none",
    boxShadow: focus ? (hasError ? `0 0 0 3px ${EPJ.red}1A` : shadow.focus) : "none",
    transition: "border-color .15s ease, box-shadow .15s ease",
    cursor: disabled ? "not-allowed" : "text",
    opacity: disabled ? 0.6 : 1,
    appearance: as === "select" ? "none" : undefined,
    resize: as === "textarea" ? "vertical" : undefined,
    lineHeight: as === "textarea" ? 1.5 : undefined,
  };

  // Ordre de merge : base → extra interne → mono → style appelant → inputStyle.
  // L'APPELANT GAGNE (mono survit au base ; inputStyle prime sur tout).
  const mergeStyle = (extra) => ({
    ...baseStyle,
    ...extra,
    ...(mono ? { fontFamily: font.mono } : null),
    ...extStyle,
    ...inputStyle,
  });

  const focusProps = {
    onFocus: (e) => { setFocus(true); extFocus?.(e); },
    onBlur:  (e) => { setFocus(false); extBlur?.(e); },
  };

  let control;
  if (as === "select") {
    control = (
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={mergeStyle({ cursor: disabled ? "not-allowed" : "pointer" })}
        {...focusProps}
        {...restClean}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    );
  } else if (as === "textarea") {
    control = (
      <textarea
        id={id}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        style={mergeStyle()}
        {...focusProps}
        {...restClean}
      />
    );
  } else {
    control = (
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        style={mergeStyle()}
        {...focusProps}
        {...restClean}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space.xs + 2, width }}>
      {label && (
        <label htmlFor={id} style={{
          fontSize: fontSize.sm,
          fontWeight: fontWeight.medium,
          color: EPJ.gray700,
          fontFamily: font.body,
        }}>
          {label}
          {required && <span style={{ color: EPJ.red, marginLeft: 3 }}>*</span>}
        </label>
      )}
      {control}
      {hasError ? (
        <div style={{ fontSize: fontSize.xs, color: EPJ.redText, fontFamily: font.body }}>
          {error}
        </div>
      ) : hint ? (
        <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, fontFamily: font.body }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

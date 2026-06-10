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
  ...rest
}) {
  const isPwa = useViewport() === "mobile";
  const [focus, setFocus] = useState(false);
  const controlHeight = isPwa ? 44 : 36;
  const hasError = !!error;

  const baseStyle = {
    width: "100%",
    padding: as === "textarea" ? `${space.sm + 2}px ${space.md}px` : `0 ${space.md}px`,
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

  const focusProps = {
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
  };

  let control;
  if (as === "select") {
    control = (
      <select
        id={id}
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={{ ...baseStyle, cursor: disabled ? "not-allowed" : "pointer" }}
        {...focusProps}
        {...rest}
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
        style={baseStyle}
        {...focusProps}
        {...rest}
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
        style={baseStyle}
        {...focusProps}
        {...rest}
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space.xs + 2 }}>
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

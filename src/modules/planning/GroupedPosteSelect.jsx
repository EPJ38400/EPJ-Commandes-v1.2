// ═══════════════════════════════════════════════════════════════
//  GroupedPosteSelect — <select> natif à OPTGROUPS pour le picker « Poste »
//
//  <Field> (DS-1) ne sait pas rendre d'<optgroup> : on rend ici un <select>
//  natif stylé À L'IDENTIQUE de Field, RÉSERVÉ au champ Poste des plannings
//  (le composant Field partagé n'est PAS modifié). Pur rendu : value = key
//  du poste (t.id), onChange standard. Les catégories portent l'en-tête,
//  donc les libellés d'option sont NON préfixés (cat.postes[].label).
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight, shadow } from "../../core/theme";
import { useViewport } from "../../core/useViewport";

export function GroupedPosteSelect({
  label, value, onChange, categories = [], disabled = false, hint,
  emptyLabel = "— Aucun poste précis —",
}) {
  const isPwa = useViewport() === "mobile";
  const [focus, setFocus] = useState(false);
  const controlHeight = isPwa ? 44 : 36;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space.xs + 2 }}>
      {label && (
        <label style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray700, fontFamily: font.body }}>
          {label}
        </label>
      )}
      <div style={{ position: "relative" }}>
        <select
          value={value}
          onChange={onChange}
          disabled={disabled}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          style={{
            width: "100%",
            padding: `0 ${space.xl}px 0 ${space.md}px`,
            height: controlHeight,
            background: disabled ? EPJ.gray50 : EPJ.white,
            color: EPJ.gray900,
            border: `1px solid ${focus ? EPJ.blue : EPJ.gray200}`,
            borderRadius: radius.md,
            fontSize: isPwa ? fontSize.base : fontSize.md,
            fontFamily: font.body,
            outline: "none",
            boxShadow: focus ? shadow.focus : "none",
            transition: "border-color .15s ease, box-shadow .15s ease",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
            appearance: "none",
          }}
        >
          <option value="">{emptyLabel}</option>
          {categories.map((cat) => (
            <optgroup key={cat.catId} label={cat.catLabel}>
              {cat.postes.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
        {/* Flèche du select (appearance:none la supprime) — purement décorative. */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute", right: space.md, top: "50%", transform: "translateY(-50%)",
            pointerEvents: "none", color: EPJ.gray500, fontSize: fontSize.xs, lineHeight: 1,
          }}
        >
          ▾
        </span>
      </div>
      {hint && (
        <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, fontFamily: font.body }}>{hint}</div>
      )}
    </div>
  );
}

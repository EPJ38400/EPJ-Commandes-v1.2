// ═══════════════════════════════════════════════════════════════
//  ArStatusBadge — pastille colorée du statut AR d'une commande Esabora.
//  Affiche éventuellement un marqueur « acquitté » (arAcquitte=true).
// ═══════════════════════════════════════════════════════════════
import { EPJ } from "../../../core/theme";
import { arStatutMeta } from "./esaboraFormat";

export function ArStatusBadge({ statut, acquitte = false, size = "md" }) {
  const meta = arStatutMeta(statut);
  const small = size === "sm";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        title={meta.label}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          fontSize: small ? 10 : 11,
          fontWeight: 700,
          padding: small ? "3px 7px" : "4px 9px",
          borderRadius: 999,
          background: `${meta.color}1A`,
          color: meta.color,
          whiteSpace: "nowrap",
        }}
      >
        <span>{meta.icon}</span>
        {meta.label}
      </span>
      {acquitte && (
        <span
          title="Manquant acquitté (sorti des relances)"
          style={{
            fontSize: small ? 9 : 10,
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 999,
            background: `${EPJ.gray500}14`,
            color: EPJ.gray500,
            whiteSpace: "nowrap",
          }}
        >
          acquitté
        </span>
      )}
    </span>
  );
}

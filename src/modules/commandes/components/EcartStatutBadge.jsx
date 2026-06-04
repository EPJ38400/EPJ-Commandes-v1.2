// ═══════════════════════════════════════════════════════════════
//  EcartStatutBadge — pastille du cycle de vie d'un écart de prix.
//  Ouvert (orange) → Réclamé (bleu) → Résolu (vert).
//  Les écarts créés par le price-watch n'ont pas de champ `statut` :
//  on retombe sur OUVERT par défaut.
// ═══════════════════════════════════════════════════════════════
import { EPJ } from "../../../core/theme";

export const ECART_STATUT_META = {
  OUVERT:  { label: "Ouvert",  color: EPJ.orange, icon: "●" },
  RECLAME: { label: "Réclamé", color: EPJ.blue,   icon: "✉" },
  RESOLU:  { label: "Résolu",  color: EPJ.green,  icon: "✓" },
};

export function ecartStatutMeta(statut) {
  return ECART_STATUT_META[statut] || ECART_STATUT_META.OUVERT;
}

export function EcartStatutBadge({ statut, size = "md" }) {
  const meta = ecartStatutMeta(statut);
  const small = size === "sm";
  return (
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
  );
}

// ═══════════════════════════════════════════════════════════════
//  KpisAchat — 4 cartes KPI en tête du Dashboard achat.
//    1. Écarts ouverts (sur la période)
//    2. Montant total à récupérer (cumul écarts ouverts)
//    3. Fournisseur le plus écarté
//    4. Récupéré ce mois (écarts clôturés ACCORDE du mois)
//  Calculs faits par le parent (sur le jeu filtré pertinent) et passés
//  via `kpis`. Composant purement présentational.
// ═══════════════════════════════════════════════════════════════
import { EPJ, font } from "../../../core/theme";
import { fmtMoney } from "./esaboraFormat";

export function KpisAchat({ kpis, isNarrow = false }) {
  const k = kpis || {};
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isNarrow ? "1fr 1fr" : "repeat(4, 1fr)",
        gap: 10, marginBottom: 18,
      }}
    >
      <Card
        accent={EPJ.orange} icon="●"
        label="Écarts ouverts"
        value={k.ouvertsCount ?? 0}
        sub={k.periodeLabel || "sur la période"}
      />
      <Card
        accent={EPJ.red} icon="€"
        label="À récupérer"
        value={fmtMoney(k.ouvertsMontant ?? 0)}
        sub="cumul écarts ouverts"
        isText
      />
      <Card
        accent={EPJ.blue} icon="≠"
        label="Fournisseur le + écarté"
        value={k.topFournisseur?.nom || "—"}
        sub={k.topFournisseur ? `${k.topFournisseur.count} écart${k.topFournisseur.count > 1 ? "s" : ""} · ${fmtMoney(k.topFournisseur.montant)}` : "aucun écart"}
        isText
      />
      <Card
        accent={EPJ.green} icon="✓"
        label="Récupéré ce mois"
        value={fmtMoney(k.recupereMoisMontant ?? 0)}
        sub={`${k.recupereMoisCount ?? 0} écart${(k.recupereMoisCount ?? 0) > 1 ? "s" : ""} soldé${(k.recupereMoisCount ?? 0) > 1 ? "s" : ""}`}
        isText
      />
    </div>
  );
}

function Card({ label, value, sub, accent, icon, isText = false }) {
  return (
    <div
      style={{
        background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
        borderLeft: `3px solid ${accent}`, borderRadius: 12,
        padding: "13px 15px", display: "flex", flexDirection: "column", gap: 3, minWidth: 0,
      }}
    >
      <div style={{ fontSize: 10.5, color: EPJ.gray500, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {icon} {label}
      </div>
      <div
        style={{
          fontFamily: font.display, fontSize: isText ? 19 : 30, color: accent, lineHeight: 1.1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}
        title={typeof value === "string" ? value : undefined}
      >
        {value}
      </div>
      <div style={{ fontSize: 11, color: EPJ.gray500 }}>{sub}</div>
    </div>
  );
}

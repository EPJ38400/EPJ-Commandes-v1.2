// ═══════════════════════════════════════════════════════════════
//  FiltresBarreAchat — barre des 6 filtres du Dashboard achat.
//  Contrôlé : `value` (objet filtres) + onChange(patch). Filtrage 100 %
//  client (aucun index composite). Les options Fournisseur / Chantier
//  sont auto-alimentées par le parent depuis les écarts présents.
// ═══════════════════════════════════════════════════════════════
import { EPJ } from "../../../core/theme";

export const FILTRES_DEFAUT = {
  statut: "OUVERT",
  periode: "30",
  fournisseur: "ALL",
  typeEcart: "ALL",
  chantier: "ALL",
  montantMin: "0",
};

const STATUTS = [
  { v: "OUVERT", l: "Ouverts" },
  { v: "RECLAME", l: "Réclamés" },
  { v: "RESOLU", l: "Résolus" },
  { v: "ALL", l: "Tous" },
];
const PERIODES = [
  { v: "30", l: "30 jours" },
  { v: "90", l: "90 jours" },
  { v: "365", l: "12 mois" },
  { v: "ALL", l: "Tout" },
];
const TYPES = [
  { v: "CMD_AR", l: "Cmd ↔ AR" },
  { v: "AR_FACT", l: "AR ↔ Fact" },
  { v: "CMD_FACT", l: "Cmd ↔ Fact" },
  { v: "ALL", l: "Tous" },
];
const MONTANTS = [
  { v: "0", l: "Tous" },
  { v: "10", l: "> 10 €" },
  { v: "50", l: "> 50 €" },
  { v: "100", l: "> 100 €" },
];

export function FiltresBarreAchat({ value, onChange, fournisseurOptions = [], chantierOptions = [] }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });

  return (
    <div
      style={{
        display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16,
        padding: 12, background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: 12,
      }}
    >
      <Field label="Statut">
        <Select value={value.statut} onChange={set("statut")} items={STATUTS.map((s) => ({ value: s.v, label: s.l }))} />
      </Field>
      <Field label="Période">
        <Select value={value.periode} onChange={set("periode")} items={PERIODES.map((s) => ({ value: s.v, label: s.l }))} />
      </Field>
      <Field label="Fournisseur">
        <Select
          value={value.fournisseur}
          onChange={set("fournisseur")}
          items={[{ value: "ALL", label: "Tous" }, ...fournisseurOptions.map((f) => ({ value: f, label: f }))]}
        />
      </Field>
      <Field label="Type d'écart">
        <Select value={value.typeEcart} onChange={set("typeEcart")} items={TYPES.map((s) => ({ value: s.v, label: s.l }))} />
      </Field>
      <Field label="Chantier">
        <Select
          value={value.chantier}
          onChange={set("chantier")}
          items={[{ value: "ALL", label: "Tous" }, ...chantierOptions.map((c) => ({ value: c, label: c }))]}
        />
      </Field>
      <Field label="Montant min">
        <Select value={value.montantMin} onChange={set("montantMin")} items={MONTANTS.map((s) => ({ value: s.v, label: s.l }))} />
      </Field>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, flex: "1 1 140px", minWidth: 120 }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: EPJ.gray500, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Select({ value, onChange, items }) {
  return (
    <select
      value={value}
      onChange={onChange}
      style={{
        width: "100%", padding: "8px 10px", borderRadius: 9,
        border: `1px solid ${EPJ.gray200}`, fontSize: 13, color: EPJ.gray900, background: EPJ.white,
      }}
    >
      {items.map((it) => (
        <option key={it.value} value={it.value}>{it.label}</option>
      ))}
    </select>
  );
}

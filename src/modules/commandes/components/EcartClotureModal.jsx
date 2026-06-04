// ═══════════════════════════════════════════════════════════════
//  EcartClotureModal — clôture d'un écart de prix.
//  3 issues : Accordé (vert) / Refusé (rouge) / Abandonné (gris) +
//  commentaire optionnel. Appelle onConfirm(raison, commentaire).
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ } from "../../../core/theme";
import { fmtMoney, fmtPct } from "./esaboraFormat";
import { ModalShell } from "./ModalShell";

const RAISONS = [
  { code: "ACCORDE",   label: "Accordé",   hint: "Le fournisseur régularise / accepte", color: EPJ.green },
  { code: "REFUSE",    label: "Refusé",    hint: "Le fournisseur refuse",               color: EPJ.red },
  { code: "ABANDONNE", label: "Abandonné", hint: "On laisse tomber cet écart",          color: EPJ.gray500 },
];

export function EcartClotureModal({ ecart, onClose, onConfirm, busy = false }) {
  const [raison, setRaison] = useState(null);
  const [commentaire, setCommentaire] = useState("");

  const e = ecart || {};
  const up = (Number(e.ecart) || 0) > 0;

  return (
    <ModalShell
      title="Clôturer l'écart"
      subtitle={`Commande ${e.numero || "—"} · ${e.reference || "—"}`}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button onClick={onClose} disabled={busy} style={ghostBtn}>Annuler</button>
          <button
            onClick={() => raison && onConfirm(raison, commentaire.trim() || null)}
            disabled={!raison || busy}
            style={{ ...solidBtn(EPJ.gray900), opacity: !raison || busy ? 0.5 : 1 }}
          >
            {busy ? "Clôture…" : "Confirmer la clôture"}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 13, color: EPJ.gray700, marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span>{fmtMoney(e.prixUnitaireCommande)}</span>
        <span style={{ color: EPJ.gray300 }}>→</span>
        <span style={{ fontWeight: 700 }}>{fmtMoney(e.prixUnitaireAR)}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: up ? EPJ.red : EPJ.green, background: `${up ? EPJ.red : EPJ.green}14`, padding: "2px 8px", borderRadius: 999 }}>
          {up ? "+" : ""}{fmtMoney(e.ecart)} ({fmtPct(e.ecartPct)})
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
        {RAISONS.map((r) => {
          const active = raison === r.code;
          return (
            <button
              key={r.code}
              onClick={() => setRaison(r.code)}
              disabled={busy}
              style={{
                textAlign: "left", cursor: "pointer",
                border: `1.5px solid ${active ? r.color : EPJ.gray200}`,
                background: active ? `${r.color}10` : EPJ.white,
                borderRadius: 12, padding: "11px 13px",
                display: "flex", flexDirection: "column", gap: 2,
              }}
            >
              <span style={{ fontWeight: 700, fontSize: 14, color: active ? r.color : EPJ.gray900 }}>{r.label}</span>
              <span style={{ fontSize: 12, color: EPJ.gray500 }}>{r.hint}</span>
            </button>
          );
        })}
      </div>

      <label style={{ fontSize: 12, fontWeight: 600, color: EPJ.gray700, display: "block", marginBottom: 6 }}>
        Commentaire (optionnel)
      </label>
      <textarea
        value={commentaire}
        onChange={(ev) => setCommentaire(ev.target.value)}
        disabled={busy}
        rows={3}
        maxLength={2000}
        placeholder="Précision interne sur la clôture…"
        style={{
          width: "100%", resize: "vertical", padding: "9px 11px",
          borderRadius: 10, border: `1px solid ${EPJ.gray200}`,
          fontSize: 13, color: EPJ.gray900, fontFamily: "inherit", boxSizing: "border-box",
        }}
      />
    </ModalShell>
  );
}

const ghostBtn = {
  border: `1px solid ${EPJ.gray200}`, background: EPJ.white, color: EPJ.gray700,
  borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
function solidBtn(color) {
  return {
    border: `1px solid ${color}`, background: color, color: "#fff",
    borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
  };
}

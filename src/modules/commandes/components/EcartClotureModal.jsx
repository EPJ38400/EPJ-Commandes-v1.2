// ═══════════════════════════════════════════════════════════════
//  EcartClotureModal — clôture groupée des écarts d'UNE commande.
//  3 issues : Accordé (vert) / Refusé (rouge) / Abandonné (gris) +
//  commentaire optionnel. Tous les écarts de la commande partagent le
//  même destin (V2). Appelle onConfirm(raison, commentaire).
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ } from "../../../core/theme";
import { fmtMoney, fmtPct } from "./esaboraFormat";
import { ModalShell } from "./ModalShell";

const RAISONS = [
  { code: "ACCORDE",   label: "Accordé",   hint: "Le fournisseur régularise / accepte", color: EPJ.green },
  { code: "REFUSE",    label: "Refusé",    hint: "Le fournisseur refuse",               color: EPJ.red },
  { code: "ABANDONNE", label: "Abandonné", hint: "On laisse tomber ces écarts",         color: EPJ.gray500 },
  { code: "AUTRE",     label: "Autre",     hint: "Préciser la raison dans le commentaire", color: EPJ.blue },
];

export function EcartClotureModal({ commande, onClose, onConfirm, busy = false }) {
  const [raison, setRaison] = useState(null);
  const [commentaire, setCommentaire] = useState("");

  const c = commande || {};
  const lignes = c.lignes || [];
  const commentRequired = raison === "AUTRE";
  const commentMissing = commentRequired && !commentaire.trim();

  return (
    <ModalShell
      title="Clôturer la commande"
      subtitle={`Commande ${c.numero || "—"}${c.fournisseur ? ` · ${c.fournisseur}` : ""}`}
      onClose={busy ? undefined : onClose}
      footer={
        <>
          <button onClick={onClose} disabled={busy} style={ghostBtn}>Annuler</button>
          <button
            onClick={() => raison && !commentMissing && onConfirm(raison, commentaire.trim() || null)}
            disabled={!raison || busy || commentMissing}
            style={{ ...solidBtn(EPJ.gray900), opacity: !raison || busy || commentMissing ? 0.5 : 1 }}
          >
            {busy ? "Clôture…" : "Confirmer la clôture"}
          </button>
        </>
      }
    >
      <div style={{ fontSize: 12.5, color: EPJ.gray700, marginBottom: 12 }}>
        <b>{lignes.length} écart{lignes.length > 1 ? "s" : ""}</b> de cette commande {lignes.length > 1 ? "seront clôturés ensemble" : "sera clôturé"}.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
        {lignes.map((l, i) => {
          const up = (Number(l.ecart) || 0) > 0;
          return (
            <div key={l._id || i} style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12, color: EPJ.gray700 }}>
              <span style={{ fontWeight: 700, color: EPJ.gray900 }}>{l.reference || "—"}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: up ? EPJ.red : EPJ.green }}>
                {up ? "+" : ""}{fmtMoney(l.ecart)} ({fmtPct(l.ecartPct)})
              </span>
            </div>
          );
        })}
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
        Commentaire {commentRequired
          ? <span style={{ color: EPJ.blue }}>(obligatoire)</span>
          : "(optionnel)"}
      </label>
      <textarea
        value={commentaire}
        onChange={(ev) => setCommentaire(ev.target.value)}
        disabled={busy}
        rows={3}
        maxLength={2000}
        placeholder={commentRequired ? "Indiquez la raison de la clôture…" : "Précision interne sur la clôture…"}
        style={{
          width: "100%", resize: "vertical", padding: "9px 11px",
          borderRadius: 10, border: `1px solid ${commentMissing ? EPJ.red : EPJ.gray200}`,
          fontSize: 13, color: EPJ.gray900, fontFamily: "inherit", boxSizing: "border-box",
        }}
      />
      {commentMissing && (
        <div style={{ fontSize: 12, color: EPJ.red, marginTop: 6 }}>
          Un commentaire est requis pour la raison « Autre ».
        </div>
      )}
    </ModalShell>
  );
}

const ghostBtn = {
  border: `1px solid ${EPJ.gray200}`, background: EPJ.white, color: EPJ.gray700,
  borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
};
function solidBtn(color) {
  return {
    border: `1px solid ${color}`, background: color, color: EPJ.white,
    borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
  };
}

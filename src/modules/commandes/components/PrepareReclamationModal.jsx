// ═══════════════════════════════════════════════════════════════
//  PrepareReclamationModal — prépare un brouillon de réclamation IA.
//  • Affiche le contexte de l'écart.
//  • Laisse valider/corriger l'adresse destinataire (pré-remplie).
//  • Lance la génération (Claude Haiku) → brouillon dans achat@.
//  • Affiche le lien direct vers le brouillon Gmail une fois prêt.
//
//  Appelle onConfirm(customEmail|null). Le parent gère l'appel à la
//  Cloud Function et passe `result` ({ draftWebUrl, destinataire }).
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ } from "../../../core/theme";
import { fmtMoney, fmtPct } from "./esaboraFormat";
import { ModalShell } from "./ModalShell";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PrepareReclamationModal({ ecart, defaultEmail = "", onClose, onConfirm, busy = false, result = null, error = null }) {
  const [email, setEmail] = useState(defaultEmail || "");
  const e = ecart || {};
  const up = (Number(e.ecart) || 0) > 0;
  const emailValide = !email || EMAIL_RE.test(email.trim());

  return (
    <ModalShell
      title="Préparer un brouillon IA"
      subtitle={`Réclamation · commande ${e.numero || "—"}`}
      onClose={busy ? undefined : onClose}
      maxWidth={500}
      footer={
        result ? (
          <button onClick={onClose} style={solidBtn(EPJ.green)}>Terminé</button>
        ) : (
          <>
            <button onClick={onClose} disabled={busy} style={ghostBtn}>Annuler</button>
            <button
              onClick={() => onConfirm(email.trim() || null)}
              disabled={busy || !emailValide}
              style={{ ...solidBtn(EPJ.blue), opacity: busy || !emailValide ? 0.5 : 1 }}
            >
              {busy ? "Génération…" : "Générer le brouillon"}
            </button>
          </>
        )
      }
    >
      <div style={{ fontSize: 13, color: EPJ.gray700, marginBottom: 14, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontWeight: 600 }}>{e.reference || "—"}</span>
        {e.fournisseur && <span style={{ fontSize: 12, color: EPJ.gray500 }}>· {e.fournisseur}</span>}
        <span style={{ width: "100%", height: 0 }} />
        <span>{fmtMoney(e.prixUnitaireCommande)}</span>
        <span style={{ color: EPJ.gray300 }}>→</span>
        <span style={{ fontWeight: 700 }}>{fmtMoney(e.prixUnitaireAR)}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: up ? EPJ.red : EPJ.green, background: `${up ? EPJ.red : EPJ.green}14`, padding: "2px 8px", borderRadius: 999 }}>
          {up ? "+" : ""}{fmtMoney(e.ecart)} ({fmtPct(e.ecartPct)})
        </span>
      </div>

      {result ? (
        <div
          style={{
            border: `1px solid ${EPJ.green}40`, background: `${EPJ.green}10`,
            borderRadius: 12, padding: 14, fontSize: 13, color: EPJ.gray700,
          }}
        >
          <div style={{ fontWeight: 700, color: EPJ.green, marginBottom: 6 }}>✓ Brouillon prêt dans Gmail</div>
          <div style={{ marginBottom: 10 }}>
            Destinataire : <b>{result.destinataire}</b><br />
            Le brouillon est dans la boîte <b>achat@epj-electricite.com</b>. Ouvre-le, relis et envoie.
          </div>
          <a
            href={result.draftWebUrl}
            target="_blank"
            rel="noreferrer"
            style={{ ...solidBtn(EPJ.green), display: "inline-block", textDecoration: "none" }}
          >
            Ouvrir le brouillon Gmail ↗
          </a>
        </div>
      ) : (
        <>
          <label style={{ fontSize: 12, fontWeight: 600, color: EPJ.gray700, display: "block", marginBottom: 6 }}>
            Adresse du fournisseur
          </label>
          <input
            type="email"
            value={email}
            onChange={(ev) => setEmail(ev.target.value)}
            disabled={busy}
            placeholder="contact@fournisseur.fr"
            style={{
              width: "100%", padding: "9px 11px", borderRadius: 10,
              border: `1px solid ${emailValide ? EPJ.gray200 : EPJ.red}`,
              fontSize: 13, color: EPJ.gray900, boxSizing: "border-box",
            }}
          />
          <div style={{ fontSize: 11.5, color: EPJ.gray500, marginTop: 6 }}>
            {defaultEmail
              ? "Pré-rempli depuis l'AR / la mémoire fournisseur. Corrige si besoin — l'adresse sera mémorisée."
              : "Aucune adresse connue : saisis celle du fournisseur. Elle sera mémorisée."}
          </div>
          {!emailValide && (
            <div style={{ fontSize: 12, color: EPJ.red, marginTop: 6 }}>Adresse e-mail invalide.</div>
          )}
          {error && (
            <div style={{ fontSize: 12.5, color: EPJ.red, marginTop: 12, padding: "8px 10px", background: `${EPJ.red}10`, borderRadius: 8 }}>
              {error}
            </div>
          )}
        </>
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
    border: `1px solid ${color}`, background: color, color: "#fff",
    borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer",
  };
}

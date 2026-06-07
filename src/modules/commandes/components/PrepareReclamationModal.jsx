// ═══════════════════════════════════════════════════════════════
//  PrepareReclamationModal — prépare UN brouillon fournisseur (texte brut,
//  gabarit déterministe côté Cloud Function — plus d'IA).
//
//  Deux modes :
//   • "ecart"   : réclamation d'écarts (prix + quantité) — liste les lignes.
//   • "relance" : relance d'un AR non reçu — pas de lignes.
//
//  Laisse valider/corriger l'adresse destinataire (résolue côté serveur :
//  expéditeur AR → contact fournisseur "relance" → vide). Appelle
//  onConfirm(customEmail|null). Le parent passe `result`
//  ({ draftWebUrl, destinataire, nbEcarts, mode }).
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ } from "../../../core/theme";
import { fmtMoney, fmtPct, fmtDate } from "./esaboraFormat";
import { ModalShell } from "./ModalShell";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function PrepareReclamationModal({ commande, mode = "ecart", defaultEmail = "", onClose, onConfirm, busy = false, result = null, error = null }) {
  const [email, setEmail] = useState(defaultEmail || "");
  const c = commande || {};
  const isRelance = mode === "relance";
  const lignes = (c.lignes || []).filter((l) => (l.statut || "OUVERT") !== "RESOLU");
  const emailValide = !email || EMAIL_RE.test(email.trim());
  const canSubmit = !busy && emailValide && (isRelance || lignes.length > 0);

  return (
    <ModalShell
      title={isRelance ? "Préparer une relance" : "Préparer la réclamation"}
      subtitle={`${isRelance ? "Relance AR" : "Réclamation"} · commande ${c.numero || "—"}${c.fournisseur ? ` · ${c.fournisseur}` : ""}`}
      onClose={busy ? undefined : onClose}
      maxWidth={540}
      footer={
        result ? (
          <button onClick={onClose} style={solidBtn(EPJ.green)}>Terminé</button>
        ) : (
          <>
            <button onClick={onClose} disabled={busy} style={ghostBtn}>Annuler</button>
            <button
              onClick={() => onConfirm(email.trim() || null)}
              disabled={!canSubmit}
              style={{ ...solidBtn(EPJ.blue), opacity: canSubmit ? 1 : 0.5 }}
            >
              {busy ? "Génération…" : (isRelance ? "Préparer le brouillon" : `Générer le brouillon (${lignes.length})`)}
            </button>
          </>
        )
      }
    >
      {result ? (
        <ResultBlock result={result} isRelance={isRelance} />
      ) : (
        <>
          {isRelance ? (
            <div style={{ fontSize: 13, color: EPJ.gray700, lineHeight: 1.5, marginBottom: 16 }}>
              Aucun accusé de réception reçu pour cette commande
              {c.dateCommande ? <> passée le <b>{fmtDate(c.dateCommande)}</b></> : null}.
              Un mail de relance sera préparé en brouillon dans <b>achat@</b>.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 12, fontWeight: 700, color: EPJ.gray500, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
                {lignes.length} ligne{lignes.length > 1 ? "s" : ""} d'écart de prix dans le mail
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                {lignes.map((l, i) => <LigneRow key={l._id || i} l={l} />)}
              </div>
              <div style={{ fontSize: 11.5, color: EPJ.gray500, marginBottom: 16 }}>
                Les écarts de quantité éventuels (commande vs AR) seront ajoutés automatiquement.
              </div>
            </>
          )}

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
            Laisse vide pour utiliser l'expéditeur de l'AR ou le contact « relance » du fournisseur. Si rien n'est connu, le brouillon est créé sans destinataire (à compléter dans Gmail).
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

function ResultBlock({ result, isRelance }) {
  return (
    <div style={{ border: `1px solid ${EPJ.green}40`, background: `${EPJ.green}10`, borderRadius: 12, padding: 14, fontSize: 13, color: EPJ.gray700 }}>
      <div style={{ fontWeight: 700, color: EPJ.green, marginBottom: 6 }}>✓ Brouillon prêt dans Gmail</div>
      <div style={{ marginBottom: 10 }}>
        {!isRelance && result.nbEcarts != null && (
          <>Couvre <b>{result.nbEcarts} écart{result.nbEcarts > 1 ? "s" : ""}</b> de prix (+ quantités).<br /></>
        )}
        {result.destinataire
          ? <>Destinataire : <b>{result.destinataire}</b><br /></>
          : <>Aucun destinataire connu : <b>complète l'adresse directement dans Gmail</b>.<br /></>}
        Le brouillon est dans la boîte <b>achat@epj-electricite.com</b>. Ouvre-le, relis et envoie.
      </div>
      <a href={result.draftWebUrl} target="_blank" rel="noreferrer"
        style={{ ...solidBtn(EPJ.green), display: "inline-block", textDecoration: "none" }}>
        Ouvrir le brouillon Gmail ↗
      </a>
    </div>
  );
}

function LigneRow({ l }) {
  const up = (Number(l.ecart) || 0) > 0;
  return (
    <div style={{ border: `1px solid ${EPJ.gray200}`, borderRadius: 9, padding: "8px 10px", fontSize: 12.5, color: EPJ.gray700 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontWeight: 700, color: EPJ.gray900 }}>{l.reference || "—"}</span>
        <span>{fmtMoney(l.prixUnitaireCommande)}</span>
        <span style={{ color: EPJ.gray300 }}>→</span>
        <span style={{ fontWeight: 700 }}>{fmtMoney(l.prixUnitaireAR)}</span>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: up ? EPJ.red : EPJ.green, background: `${up ? EPJ.red : EPJ.green}14`, padding: "1px 7px", borderRadius: 999 }}>
          {up ? "+" : ""}{fmtMoney(l.ecart)} ({fmtPct(l.ecartPct)})
        </span>
      </div>
      {l.designation && (
        <div style={{ fontSize: 11.5, color: EPJ.gray500, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.designation}>
          {l.designation}
        </div>
      )}
    </div>
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

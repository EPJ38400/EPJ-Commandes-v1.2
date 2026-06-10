// ═══════════════════════════════════════════════════════════════
//  MailReplyComposer — Composer un mail depuis la fiche réserve
//  v1.13.0 — Brique mail
//  Permet de répondre à un fil existant ou de démarrer un nouveau mail.
//  L'envoi passe par la Cloud Function Gmail API (au nom de l'utilisateur).
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ, font, radius } from "../../core/theme";

export function MailReplyComposer({ reserve, mails = [], onSend, onCancel }) {
  // ─── Pré-remplissage à partir des mails existants ───────────
  // Si on a déjà des mails entrants, on cible le dernier expéditeur
  // et on garde le thread (reply-all).
  const dernierMailEntrant = useMemo(() => {
    const ins = mails.filter(m => m.direction === "in");
    if (ins.length === 0) return null;
    return ins.sort((a, b) => new Date(b.dateEnvoi) - new Date(a.dateEnvoi))[0];
  }, [mails]);

  const sujetInitial = useMemo(() => {
    if (dernierMailEntrant?.sujet) {
      const s = dernierMailEntrant.sujet;
      return /^re\s*:/i.test(s) ? s : `Re: ${s}`;
    }
    return `[RES-${reserve?.numReserve || ""}] ${reserve?.chantierNom || "Réserve"}`;
  }, [dernierMailEntrant, reserve]);

  const destinatairesInitiaux = useMemo(() => {
    if (dernierMailEntrant?.expediteurEmail) return dernierMailEntrant.expediteurEmail;
    if (reserve?.clientFinal?.email) return reserve.clientFinal.email;
    return "";
  }, [dernierMailEntrant, reserve]);

  const [destinataires, setDestinataires] = useState(destinatairesInitiaux);
  const [cc, setCc] = useState("");
  const [sujet, setSujet] = useState(sujetInitial);
  const [corps, setCorps] = useState(buildSignature(reserve));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const handleSend = async () => {
    setError("");
    if (!destinataires.trim()) {
      setError("Au moins un destinataire requis");
      return;
    }
    if (!sujet.trim()) {
      setError("Sujet requis");
      return;
    }
    setSending(true);
    try {
      const draft = {
        to: splitEmails(destinataires),
        cc: splitEmails(cc),
        sujet: sujet.trim(),
        corps: corps,
        // Si on répond à un thread, on inclut l'ID pour que Gmail le rattache
        gmailThreadId: dernierMailEntrant?.gmailThreadId || null,
        // Référence interne pour rattachement automatique des réponses
        reserveId: reserve?._id,
        reserveNum: reserve?.numReserve,
      };
      await onSend?.(draft);
    } catch (e) {
      setError(e.message || "Erreur d'envoi");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={{
      padding: 14,
      borderTop: `1px solid ${EPJ.gray200}`,
      background: EPJ.white,
    }}>
      <div style={{
        fontSize: 12, fontWeight: 700, color: EPJ.blue, marginBottom: 10,
        textTransform: "uppercase", letterSpacing: 0.5,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        ✉ Nouveau mail
      </div>

      {/* Destinataires */}
      <Field label="À">
        <input
          type="text"
          value={destinataires}
          onChange={e => setDestinataires(e.target.value)}
          placeholder="email1@..., email2@..."
          className="epj-input"
          style={{ padding: "8px 10px", fontSize: 12 }}
        />
      </Field>

      {/* CC */}
      <Field label="CC">
        <input
          type="text"
          value={cc}
          onChange={e => setCc(e.target.value)}
          placeholder="(optionnel)"
          className="epj-input"
          style={{ padding: "8px 10px", fontSize: 12 }}
        />
      </Field>

      {/* Sujet */}
      <Field label="Sujet">
        <input
          type="text"
          value={sujet}
          onChange={e => setSujet(e.target.value)}
          className="epj-input"
          style={{ padding: "8px 10px", fontSize: 12 }}
        />
      </Field>

      {/* Corps */}
      <div style={{ marginTop: 6 }}>
        <textarea
          value={corps}
          onChange={e => setCorps(e.target.value)}
          rows={10}
          className="epj-input"
          style={{
            resize: "vertical", fontSize: 13,
            fontFamily: font.body, lineHeight: 1.5,
          }}
          placeholder="Tape ton message…"
        />
      </div>

      {/* Tag de référence (info, non éditable) */}
      <div style={{
        marginTop: 8, padding: "6px 10px",
        background: EPJ.gray50, borderRadius: 6,
        fontSize: 10, color: EPJ.gray500,
        display: "flex", alignItems: "center", gap: 6,
      }}>
        🔗 La référence <code style={{
          background: EPJ.white, padding: "1px 5px", borderRadius: 3,
          color: EPJ.gray700, fontSize: 10,
        }}>[RES-{reserve?.numReserve}]</code> sera ajoutée automatiquement au sujet
        pour rattacher les réponses futures à cette réserve.
      </div>

      {error && (
        <div style={{
          marginTop: 8, padding: "6px 10px",
          background: `${EPJ.red}15`, color: EPJ.red,
          borderRadius: 6, fontSize: 11,
        }}>
          ⚠ {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
        <button
          onClick={onCancel}
          className="epj-btn"
          disabled={sending}
          style={{
            flex: 1, background: EPJ.gray100, color: EPJ.gray700,
            fontSize: 12, padding: "10px",
          }}
        >
          Annuler
        </button>
        <button
          onClick={handleSend}
          disabled={sending}
          className="epj-btn"
          style={{
            flex: 2, background: EPJ.blue, color: EPJ.white,
            fontSize: 12, padding: "10px",
          }}
        >
          {sending ? "Envoi…" : "✉ Envoyer"}
        </button>
      </div>
    </div>
  );
}

// ─── Sous-composants ───────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
      <div style={{
        fontSize: 11, color: EPJ.gray500, fontWeight: 600,
        width: 50, flexShrink: 0,
      }}>{label}</div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────
function splitEmails(s) {
  return String(s || "")
    .split(/[,;]+/)
    .map(x => x.trim())
    .filter(Boolean);
}

function buildSignature(reserve) {
  return `Bonjour,



—
EPJ Électricité Générale
Réserve ${reserve?.numReserve || ""}${reserve?.chantierNom ? ` · ${reserve.chantierNom}` : ""}
`;
}

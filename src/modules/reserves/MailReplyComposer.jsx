// ═══════════════════════════════════════════════════════════════
//  MailReplyComposer — Composer un mail depuis la fiche réserve
//  v1.13.0 — Brique mail
//  Permet de répondre à un fil existant ou de démarrer un nouveau mail.
//  L'envoi passe par la Cloud Function Gmail API (au nom de l'utilisateur).
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import { Banner } from "../../core/components/Banner";

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
      padding: space.md + 2,
      borderTop: `1px solid ${EPJ.gray200}`,
      background: EPJ.white,
    }}>
      <div style={{
        fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: EPJ.blueText, marginBottom: space.sm + 2,
        textTransform: "uppercase", letterSpacing: "0.03em",
        display: "flex", alignItems: "center", gap: space.xs + 2,
      }}>
        ✉ Nouveau mail
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
        {/* Destinataires */}
        <Field label="À" value={destinataires}
          onChange={e => setDestinataires(e.target.value)}
          placeholder="email1@..., email2@..."/>

        {/* CC */}
        <Field label="CC" value={cc}
          onChange={e => setCc(e.target.value)}
          placeholder="(optionnel)"/>

        {/* Sujet */}
        <Field label="Sujet" value={sujet}
          onChange={e => setSujet(e.target.value)}/>

        {/* Corps */}
        <Field as="textarea" label="Message" value={corps}
          onChange={e => setCorps(e.target.value)}
          rows={10}
          placeholder="Tape ton message…"/>
      </div>

      {/* Tag de référence (info, non éditable) */}
      <div style={{
        marginTop: space.sm, padding: `${space.xs + 2}px ${space.sm + 2}px`,
        background: EPJ.gray50, borderRadius: radius.sm,
        fontSize: fontSize.xs, color: EPJ.gray500,
        display: "flex", alignItems: "center", gap: space.xs + 2,
      }}>
        🔗 La référence <code style={{
          background: EPJ.white, padding: "1px 5px", borderRadius: radius.sm,
          color: EPJ.gray700, fontSize: fontSize.xs, fontFamily: font.mono,
        }}>[RES-{reserve?.numReserve}]</code> sera ajoutée automatiquement au sujet
        pour rattacher les réponses futures à cette réserve.
      </div>

      {error && (
        <div style={{ marginTop: space.sm }}>
          <Banner tone="danger" text={error} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: space.sm, marginTop: space.sm + 2 }}>
        <div style={{ flex: 1 }}>
          <Button variant="ghost" full onClick={onCancel} disabled={sending}>
            Annuler
          </Button>
        </div>
        <div style={{ flex: 2 }}>
          <Button variant="primary" full onClick={handleSend} loading={sending}>
            ✉ Envoyer
          </Button>
        </div>
      </div>
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

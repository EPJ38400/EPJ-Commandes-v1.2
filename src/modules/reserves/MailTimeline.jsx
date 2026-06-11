// ═══════════════════════════════════════════════════════════════
//  MailTimeline — Timeline des mails d'une réserve
//  v1.13.0 — Brique mail
//  Affiche la conversation complète d'une réserve (mails + événements
//  internes) dans l'ordre chronologique.
//  Réutilisable plus tard pour Chiffrage / TMA.
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight, shadow } from "../../core/theme";
import { Button } from "../../core/components/Button";
import { Field } from "../../core/components/Field";
import { MailItem } from "./MailItem";
import { MailReplyComposer } from "./MailReplyComposer";

/**
 * @param {Object} props
 * @param {Array} props.mails - Liste des mails (objets reserveMails)
 * @param {Array} props.events - Événements internes (note, photo, signature, statut)
 * @param {Object} props.reserve - La réserve courante
 * @param {boolean} props.canReply - Si l'utilisateur peut répondre par mail
 * @param {Function} props.onReply - Callback envoi mail (mail) => Promise
 * @param {Function} props.onAddNote - Callback ajout note (texte) => Promise
 * @param {Function} props.onJoindreMail - Callback bouton "joindre un mail"
 */
export function MailTimeline({
  mails = [],
  events = [],
  reserve,
  canReply = true,
  onReply,
  onAddNote,
  onJoindreMail,
}) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // ─── Fusion mails + événements dans l'ordre chronologique ──
  const timeline = useMemo(() => {
    const mailItems = (mails || []).map(m => ({
      _type: "mail",
      _date: m.dateEnvoi,
      _id: m._id,
      data: m,
    }));
    const eventItems = (events || []).map(e => ({
      _type: "event",
      _date: e.date,
      _id: e._id || `evt_${e.date}_${e.kind}`,
      data: e,
    }));
    return [...mailItems, ...eventItems].sort((a, b) => {
      const da = new Date(a._date).getTime();
      const db = new Date(b._date).getTime();
      return da - db; // chronologique croissant
    });
  }, [mails, events]);

  const handleSendNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await onAddNote?.(noteText.trim());
      setNoteText("");
      setNoteOpen(false);
    } finally {
      setSavingNote(false);
    }
  };

  const nbMails = mails.length;
  const nbPiecesJointes = mails.reduce(
    (acc, m) => acc + (m.piecesJointes?.length || 0), 0
  );

  return (
    <div style={{
      background: EPJ.white,
      border: `1px solid ${EPJ.gray200}`,
      borderRadius: radius.lg,
      boxShadow: shadow.sm,
      marginBottom: space.md - 2,
      overflow: "hidden",
    }}>

      {/* Header de la timeline */}
      <div style={{
        padding: `${space.md}px ${space.md + 2}px`,
        borderBottom: `1px solid ${EPJ.gray200}`,
        display: "flex", alignItems: "center", gap: space.sm,
      }}>
        <div style={{
          fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: EPJ.gray500,
          textTransform: "uppercase", letterSpacing: "0.03em",
          flex: 1,
        }}>
          ✉ Conversation
          {nbMails > 0 && (
            <span style={{
              marginLeft: space.sm, fontSize: fontSize.xs, padding: "2px 6px",
              background: EPJ.gray100, color: EPJ.gray700,
              borderRadius: radius.sm, letterSpacing: 0,
            }}>
              {nbMails} mail{nbMails > 1 ? "s" : ""}
              {nbPiecesJointes > 0 && ` · ${nbPiecesJointes} pj`}
            </span>
          )}
        </div>
      </div>

      {/* Corps de la timeline */}
      <div style={{ padding: `${space.md}px ${space.md + 2}px`, display: "flex", flexDirection: "column", gap: space.sm - 2 }}>
        {timeline.length === 0 && (
          <EmptyState onJoindreMail={onJoindreMail} />
        )}

        {timeline.map(item => (
          item._type === "mail"
            ? <MailItem key={item._id} mail={item.data} />
            : <EventItem key={item._id} event={item.data} />
        ))}
      </div>

      {/* Actions */}
      <div style={{
        padding: `${space.sm + 2}px ${space.md}px`,
        borderTop: `1px solid ${EPJ.gray200}`,
        background: EPJ.gray50,
        display: "flex", gap: space.sm, flexWrap: "wrap",
      }}>
        {canReply && (
          <div style={{ flex: 1, minWidth: 120 }}>
            <Button variant="primary" full onClick={() => setComposerOpen(true)}>
              ✉ Répondre par mail
            </Button>
          </div>
        )}
        <div style={{ flex: 1, minWidth: 110 }}>
          <Button variant="secondary" full onClick={() => setNoteOpen(true)}>
            📝 Note interne
          </Button>
        </div>
        {onJoindreMail && (
          <div style={{ flex: 1, minWidth: 110 }}>
            <Button variant="secondary" full onClick={onJoindreMail}>
              📎 Joindre un mail
            </Button>
          </div>
        )}
      </div>

      {/* Modale composer mail */}
      {composerOpen && (
        <MailReplyComposer
          reserve={reserve}
          mails={mails}
          onSend={async (draft) => {
            await onReply?.(draft);
            setComposerOpen(false);
          }}
          onCancel={() => setComposerOpen(false)}
        />
      )}

      {/* Modale note interne */}
      {noteOpen && (
        <div style={{
          padding: space.md + 2,
          borderTop: `1px solid ${EPJ.gray200}`,
          background: EPJ.warningBg,
        }}>
          <div style={{
            fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: EPJ.orangeText,
            marginBottom: space.sm, textTransform: "uppercase", letterSpacing: "0.03em",
          }}>
            📝 Nouvelle note interne (visible uniquement par l'équipe EPJ)
          </div>
          <div style={{ marginBottom: space.sm }}>
            <Field
              as="textarea"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Saisis ta note…"
              rows={3}
              autoFocus
            />
          </div>
          <div style={{ display: "flex", gap: space.sm }}>
            <div style={{ flex: 1 }}>
              <Button variant="ghost" full onClick={() => { setNoteOpen(false); setNoteText(""); }}>
                Annuler
              </Button>
            </div>
            <div style={{ flex: 2 }}>
              <Button variant="primary" full onClick={handleSendNote}
                loading={savingNote} disabled={!noteText.trim()}>
                ✓ Enregistrer la note
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Empty state quand aucune conversation ───────────────────
function EmptyState({ onJoindreMail }) {
  return (
    <div style={{
      padding: `${space.xl}px ${space.md}px`, textAlign: "center",
      color: EPJ.gray500, fontSize: fontSize.xs, fontFamily: font.body,
    }}>
      <div style={{ fontSize: 32, marginBottom: space.sm, opacity: 0.5 }}>✉</div>
      <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.medium, color: EPJ.gray600 }}>
        Aucun mail rattaché à cette réserve
      </div>
      <div style={{ fontSize: fontSize.xs, marginTop: space.xs + 2, color: EPJ.gray500, lineHeight: 1.4 }}>
        Les mails déplacés dans la boîte <strong>sav@</strong> seront aspirés et
        rattachés automatiquement.
      </div>
      {onJoindreMail && (
        <div style={{ marginTop: space.md, display: "inline-flex" }}>
          <Button variant="secondary" onClick={onJoindreMail}>
            📎 Joindre un mail manuellement
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Événement interne (note, photo, signature, statut) ─────
function EventItem({ event }) {
  const ICONS = {
    note:       { icon: "📝", label: "Note interne", color: EPJ.orangeText, bg: EPJ.warningBg },
    photo:      { icon: "📷", label: "Photo",        color: EPJ.gray700,    bg: EPJ.gray50 },
    signature:  { icon: "✍",  label: "Signature",    color: EPJ.greenText,  bg: EPJ.successBg },
    statut:     { icon: "🔄", label: "Changement",   color: EPJ.gray700,    bg: EPJ.gray50 },
    creation:   { icon: "📝", label: "Création",     color: EPJ.gray500,    bg: EPJ.gray50 },
    quitus:     { icon: "✅", label: "Quitus",       color: EPJ.greenText,  bg: EPJ.successBg },
    attribution:{ icon: "👤", label: "Attribution",  color: EPJ.blueText,   bg: EPJ.infoBg },
    rdv:        { icon: "📅", label: "RDV",          color: EPJ.orangeText, bg: EPJ.warningBg },
  };
  const cfg = ICONS[event.kind] || ICONS.note;
  const date = formatDateShort(event.date);

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: space.sm,
      padding: `${space.sm}px ${space.sm + 2}px`,
      background: cfg.bg,
      border: `1px solid ${EPJ.gray200}`,
      borderRadius: radius.md,
      fontSize: fontSize.xs,
    }}>
      <div style={{
        flexShrink: 0, fontSize: 14,
        width: 22, height: 22, borderRadius: radius.sm,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{cfg.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: cfg.color,
          textTransform: "uppercase", letterSpacing: "0.03em",
        }}>
          {cfg.label}
          {event.auteur && (
            <span style={{ marginLeft: space.xs + 2, color: EPJ.gray500, textTransform: "none", fontWeight: fontWeight.medium }}>
              · {event.auteur}
            </span>
          )}
        </div>
        {event.texte && (
          <div style={{
            fontSize: fontSize.xs, color: EPJ.gray900, marginTop: 2,
            whiteSpace: "pre-wrap", lineHeight: 1.4,
          }}>
            {event.texte}
          </div>
        )}
      </div>
      <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, flexShrink: 0, whiteSpace: "nowrap" }}>
        {date}
      </div>
    </div>
  );
}

// ─── Helper date ────────────────────────────────────────────
function formatDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dDay = new Date(d);
  dDay.setHours(0, 0, 0, 0);
  const diffJours = Math.round((today - dDay) / (1000 * 60 * 60 * 24));

  const heure = d.toLocaleTimeString("fr-FR", {
    hour: "2-digit", minute: "2-digit",
  });

  if (diffJours === 0) return `Aujourd'hui ${heure}`;
  if (diffJours === 1) return `Hier ${heure}`;
  if (diffJours < 7) return `${d.toLocaleDateString("fr-FR", { weekday: "short" })} ${heure}`;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });
}

// ═══════════════════════════════════════════════════════════════
//  MailTimeline — Timeline des mails d'une réserve
//  v1.13.0 — Brique mail
//  Affiche la conversation complète d'une réserve (mails + événements
//  internes) dans l'ordre chronologique.
//  Réutilisable plus tard pour Chiffrage / TMA.
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ, font, radius } from "../../core/theme";
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
    <div className="epj-card" style={{ padding: 0, marginBottom: 10, overflow: "hidden" }}>

      {/* Header de la timeline */}
      <div style={{
        padding: "12px 14px",
        borderBottom: `1px solid ${EPJ.gray200}`,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: EPJ.gray500,
          textTransform: "uppercase", letterSpacing: 0.5,
          flex: 1,
        }}>
          ✉ Conversation
          {nbMails > 0 && (
            <span style={{
              marginLeft: 8, fontSize: 10, padding: "2px 6px",
              background: EPJ.gray100, color: EPJ.gray700,
              borderRadius: 4, letterSpacing: 0,
            }}>
              {nbMails} mail{nbMails > 1 ? "s" : ""}
              {nbPiecesJointes > 0 && ` · ${nbPiecesJointes} pj`}
            </span>
          )}
        </div>
      </div>

      {/* Corps de la timeline */}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
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
        padding: "10px 12px",
        borderTop: `1px solid ${EPJ.gray200}`,
        background: EPJ.gray50,
        display: "flex", gap: 6, flexWrap: "wrap",
      }}>
        {canReply && (
          <button
            onClick={() => setComposerOpen(true)}
            className="epj-btn"
            style={{
              flex: 1, minWidth: 120,
              background: EPJ.blue, color: EPJ.white,
              fontSize: 12, padding: "10px 12px",
            }}
          >
            ✉ Répondre par mail
          </button>
        )}
        <button
          onClick={() => setNoteOpen(true)}
          className="epj-btn"
          style={{
            flex: 1, minWidth: 110,
            background: EPJ.gray100, color: EPJ.gray700,
            fontSize: 12, padding: "10px 12px",
          }}
        >
          📝 Note interne
        </button>
        {onJoindreMail && (
          <button
            onClick={onJoindreMail}
            className="epj-btn"
            style={{
              flex: 1, minWidth: 110,
              background: EPJ.gray100, color: EPJ.gray700,
              fontSize: 12, padding: "10px 12px",
            }}
          >
            📎 Joindre un mail
          </button>
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
          padding: 14,
          borderTop: `1px solid ${EPJ.gray200}`,
          background: "#fffdf5",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: EPJ.orange,
            marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5,
          }}>
            📝 Nouvelle note interne (visible uniquement par l'équipe EPJ)
          </div>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Saisis ta note…"
            className="epj-input"
            rows={3}
            style={{ resize: "vertical", marginBottom: 8 }}
            autoFocus
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => { setNoteOpen(false); setNoteText(""); }}
              className="epj-btn"
              style={{ flex: 1, background: EPJ.gray100, color: EPJ.gray700, fontSize: 12 }}
            >
              Annuler
            </button>
            <button
              onClick={handleSendNote}
              disabled={!noteText.trim() || savingNote}
              className="epj-btn"
              style={{ flex: 2, background: EPJ.orange, color: EPJ.white, fontSize: 12 }}
            >
              {savingNote ? "Enregistrement…" : "✓ Enregistrer la note"}
            </button>
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
      padding: "24px 12px", textAlign: "center",
      color: EPJ.gray500, fontSize: 12, fontFamily: font.body,
    }}>
      <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.5 }}>✉</div>
      <div>Aucun mail rattaché à cette réserve pour le moment.</div>
      <div style={{ fontSize: 11, marginTop: 6, color: EPJ.gray500 }}>
        Les mails déplacés dans la boîte <strong>sav@</strong> seront aspirés et
        rattachés automatiquement.
      </div>
      {onJoindreMail && (
        <button
          onClick={onJoindreMail}
          className="epj-btn"
          style={{
            marginTop: 12, background: EPJ.blue, color: EPJ.white,
            fontSize: 11, padding: "8px 14px",
          }}
        >
          📎 Joindre un mail manuellement
        </button>
      )}
    </div>
  );
}

// ─── Événement interne (note, photo, signature, statut) ─────
function EventItem({ event }) {
  const ICONS = {
    note:       { icon: "📝", label: "Note interne", color: EPJ.orange, bg: "#fff8e6" },
    photo:      { icon: "📷", label: "Photo",        color: EPJ.gray700, bg: EPJ.gray50 },
    signature:  { icon: "✍",  label: "Signature",    color: EPJ.green,  bg: "#f1f8e6" },
    statut:     { icon: "🔄", label: "Changement",   color: EPJ.gray700, bg: EPJ.gray50 },
    creation:   { icon: "📝", label: "Création",     color: EPJ.gray500, bg: EPJ.gray50 },
    quitus:     { icon: "✅", label: "Quitus",       color: EPJ.green,  bg: "#f1f8e6" },
    attribution:{ icon: "👤", label: "Attribution",  color: EPJ.blue,   bg: "#e6f7fc" },
    rdv:        { icon: "📅", label: "RDV",          color: EPJ.orange, bg: "#fff4e6" },
  };
  const cfg = ICONS[event.kind] || ICONS.note;
  const date = formatDateShort(event.date);

  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "8px 10px",
      background: cfg.bg,
      border: `1px solid ${EPJ.gray200}`,
      borderRadius: radius.md,
      fontSize: 12,
    }}>
      <div style={{
        flexShrink: 0, fontSize: 14,
        width: 22, height: 22, borderRadius: 4,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>{cfg.icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: cfg.color,
          textTransform: "uppercase", letterSpacing: 0.3,
        }}>
          {cfg.label}
          {event.auteur && (
            <span style={{ marginLeft: 6, color: EPJ.gray500, textTransform: "none", fontWeight: 500 }}>
              · {event.auteur}
            </span>
          )}
        </div>
        {event.texte && (
          <div style={{
            fontSize: 12, color: EPJ.gray900, marginTop: 2,
            whiteSpace: "pre-wrap", lineHeight: 1.4,
          }}>
            {event.texte}
          </div>
        )}
      </div>
      <div style={{ fontSize: 10, color: EPJ.gray500, flexShrink: 0, whiteSpace: "nowrap" }}>
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

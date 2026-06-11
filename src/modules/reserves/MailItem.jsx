// ═══════════════════════════════════════════════════════════════
//  MailItem — Un mail dans la timeline (pliable / dépliable)
//  v1.13.0 — Brique mail
//  Affichage fidèle du mail d'origine : HTML, pièces jointes, métadonnées.
// ═══════════════════════════════════════════════════════════════
import { useState, useRef, useEffect } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";

export function MailItem({ mail }) {
  const [expanded, setExpanded] = useState(false);
  const iframeRef = useRef(null);

  if (!mail) return null;

  const isOut = mail.direction === "out";
  const initials = getInitials(isOut ? "EPJ" : (mail.expediteurNom || "?"));
  const avatarColor = isOut ? EPJ.blue : EPJ.gray700;
  const avatarBg = isOut ? `${EPJ.blue}22` : `${EPJ.gray500}22`;

  const dateLabel = formatMailDate(mail.dateEnvoi);
  const sujet = mail.sujet || "(sans objet)";
  const apercu = mail.apercu || mail.corpsTexte?.slice(0, 140) || "";
  const nbPj = mail.piecesJointes?.length || 0;

  // ─── Injecter le HTML dans iframe sandboxée à l'ouverture ─
  useEffect(() => {
    if (!expanded || !iframeRef.current) return;
    const html = mail.corpsHtml || `<pre style="font-family:inherit;white-space:pre-wrap">${escapeHtml(mail.corpsTexte || "")}</pre>`;
    // Document HTML complet sandboxé : pas d'accès au parent
    const fullHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <base target="_blank">
        <style>
          body { margin: 0; padding: ${space.md}px; font-family: ${font.body}; font-size: ${fontSize.sm}px; color: ${EPJ.gray900}; line-height: 1.5; }
          img { max-width: 100%; height: auto; }
          blockquote { border-left: 3px solid ${EPJ.gray300}; margin: ${space.sm}px 0; padding-left: ${space.sm + 2}px; color: ${EPJ.gray500}; }
          a { color: ${EPJ.blue}; }
          table { max-width: 100%; }
        </style>
      </head>
      <body>${html}</body>
      </html>
    `;
    const doc = iframeRef.current.contentDocument;
    if (doc) {
      doc.open();
      doc.write(fullHtml);
      doc.close();
      // Ajuste la hauteur de l'iframe au contenu
      setTimeout(() => {
        try {
          const h = doc.body.scrollHeight + 20;
          iframeRef.current.style.height = `${Math.min(h, 800)}px`;
        } catch {}
      }, 100);
    }
  }, [expanded, mail.corpsHtml, mail.corpsTexte]);

  return (
    <div style={{
      border: `1px solid ${EPJ.gray200}`,
      borderRadius: radius.md,
      background: EPJ.white,
      overflow: "hidden",
    }}>

      {/* Header pliable */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        style={{
          width: "100%", padding: `${space.sm + 2}px ${space.md}px`,
          display: "flex", alignItems: "center", gap: space.sm,
          background: expanded ? EPJ.gray50 : EPJ.white,
          border: "none", cursor: "pointer", textAlign: "left",
          borderBottom: expanded ? `1px solid ${EPJ.gray200}` : "none",
          transition: "background .15s",
        }}
      >
        {/* Avatar */}
        <div style={{
          width: 28, height: 28, borderRadius: radius.pill,
          background: avatarBg, color: avatarColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: fontSize.xs, fontWeight: fontWeight.medium, flexShrink: 0,
          fontFamily: font.body,
        }}>{initials}</div>

        {/* Méta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: EPJ.gray900,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            fontFamily: font.body,
          }}>
            {isOut
              ? <>→ {(mail.destinataires || []).join(", ") || "—"}</>
              : <>{mail.expediteurNom || mail.expediteurEmail}</>
            }
          </div>
          {!expanded && apercu && (
            <div style={{
              fontSize: fontSize.xs, color: EPJ.gray500, marginTop: 1,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {apercu}
            </div>
          )}
          {expanded && (
            <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginTop: 1 }}>
              {isOut ? "Envoyé depuis l'app EPJ" : `<${mail.expediteurEmail}>`}
            </div>
          )}
        </div>

        {/* Pièces jointes */}
        {nbPj > 0 && (
          <div style={{
            fontSize: fontSize.xs, color: EPJ.gray500, display: "flex",
            alignItems: "center", gap: 3, flexShrink: 0,
          }}>
            📎 {nbPj}
          </div>
        )}

        {/* Date */}
        <div style={{
          fontSize: fontSize.xs, color: EPJ.gray500, flexShrink: 0,
          whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums",
        }}>{dateLabel}</div>

        {/* Chevron */}
        <div style={{
          fontSize: fontSize.xs, color: EPJ.gray500, flexShrink: 0,
          transition: "transform .2s", transform: expanded ? "rotate(180deg)" : "none",
        }}>▾</div>
      </button>

      {/* Corps déplié */}
      {expanded && (
        <div>
          {/* Sujet en gras */}
          <div style={{
            padding: `${space.sm + 2}px ${space.md}px ${space.xs + 2}px`,
            fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900,
            background: EPJ.white,
          }}>
            {sujet}
          </div>

          {/* Corps HTML (iframe sandboxée) */}
          <iframe
            ref={iframeRef}
            title={`Mail ${mail._id}`}
            sandbox="allow-same-origin"
            style={{
              width: "100%", border: "none", display: "block",
              minHeight: 80, background: EPJ.white,
            }}
          />

          {/* Pièces jointes */}
          {nbPj > 0 && (
            <div style={{
              padding: `${space.sm}px ${space.md}px`,
              borderTop: `1px solid ${EPJ.gray200}`,
              background: EPJ.gray50,
              display: "flex", flexWrap: "wrap", gap: space.sm - 2,
            }}>
              {mail.piecesJointes.map(pj => (
                <a
                  key={pj.id}
                  href={pj.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: space.sm - 2,
                    fontSize: fontSize.xs, padding: `${space.xs + 2}px ${space.sm + 2}px`,
                    background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
                    borderRadius: radius.sm, color: EPJ.gray700, textDecoration: "none",
                    fontFamily: font.body,
                  }}
                  title={`${pj.nom} (${formatKo(pj.tailleKo)})`}
                >
                  {pj.kind === "image" ? "🖼" : pj.kind === "pdf" ? "📄" : "📎"}
                  <span style={{
                    maxWidth: 180, whiteSpace: "nowrap",
                    overflow: "hidden", textOverflow: "ellipsis",
                  }}>{pj.nom}</span>
                  <span style={{ color: EPJ.gray500 }}>({formatKo(pj.tailleKo)})</span>
                </a>
              ))}
            </div>
          )}

          {/* Footer technique (méta rattachement) */}
          {(mail.rattachementMethode || mail.gmailThreadId) && (
            <div style={{
              padding: `${space.xs + 2}px ${space.md}px`,
              borderTop: `1px solid ${EPJ.gray200}`,
              fontSize: fontSize.xs, color: EPJ.gray500,
              display: "flex", justifyContent: "space-between",
              flexWrap: "wrap", gap: space.sm - 2,
            }}>
              <span>
                {mail.rattachementMethode && (
                  <>Rattachement : {labelMethode(mail.rattachementMethode)}</>
                )}
              </span>
              {mail.rattachementScore != null && mail.rattachementMethode === "ia" && (
                <span>confiance {Math.round(mail.rattachementScore * 100)}%</span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ────────────────────────────────────────────────
function getInitials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatMailDate(iso) {
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

  if (diffJours === 0) return heure;
  if (diffJours === 1) return `Hier ${heure}`;
  if (diffJours < 7) return d.toLocaleDateString("fr-FR", { weekday: "short" });
  if (d.getFullYear() === today.getFullYear()) {
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

function formatKo(ko) {
  if (!ko || ko < 0) return "—";
  if (ko < 1024) return `${ko} Ko`;
  return `${(ko / 1024).toFixed(1)} Mo`;
}

function labelMethode(m) {
  switch (m) {
    case "tag_sujet": return "tag dans sujet";
    case "thread":    return "fil Gmail";
    case "contact":   return "contact connu";
    case "ia":        return "IA";
    case "manuel":    return "manuel";
    default: return m;
  }
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

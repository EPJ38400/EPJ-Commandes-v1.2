// ═══════════════════════════════════════════════════════════════
//  <ChatPanel> — primitive DS-1 (panneau conversationnel IA)
//
//  Préparation des cockpits par rôle (DIRECTION_ARTISTIQUE / roadmap
//  cockpits). PRÉSENTATION PURE : aucun branchement API ici.
//   • messages : [{ id, role:'user'|'assistant', content }]
//   • onSend(text) : remonté au parent (qui appellera l'IA)
//   • loading : indicateur de frappe (réponse en cours)
//  Desktop (>760) : panneau latéral dockable ; PWA : plein écran.
//  États : repos / chargement (streaming) / vide (emptyState soigné).
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../theme";
import { useViewport } from "../useViewport";
import { Button } from "./Button";

function Bubble({ role, content }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start" }}>
      <div style={{
        maxWidth: "82%",
        padding: `${space.sm + 2}px ${space.md}px`,
        borderRadius: radius.lg,
        background: isUser ? EPJ.blue : EPJ.gray100,
        color: isUser ? EPJ.white : EPJ.gray900,
        fontSize: fontSize.md,
        lineHeight: 1.5,
        fontFamily: font.body,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
        borderBottomRightRadius: isUser ? radius.sm : radius.lg,
        borderBottomLeftRadius: isUser ? radius.lg : radius.sm,
      }}>
        {content}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 4,
        padding: `${space.md}px ${space.md}px`,
        borderRadius: radius.lg, borderBottomLeftRadius: radius.sm,
        background: EPJ.gray100,
      }} aria-label="Réponse en cours">
        {[0, 1, 2].map((i) => (
          <span key={i} style={{
            width: 6, height: 6, borderRadius: "50%", background: EPJ.gray400,
            animation: "fadeIn .9s ease infinite alternate",
            animationDelay: `${i * 0.18}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

export function ChatPanel({
  messages = [],
  onSend,
  loading = false,
  placeholder = "Écrire un message…",
  emptyState,
  title,
  dockable = true,
}) {
  const isPwa = useViewport() === "mobile";
  const [draft, setDraft] = useState("");

  const send = () => {
    const text = draft.trim();
    if (!text || loading || typeof onSend !== "function") return;
    onSend(text);
    setDraft("");
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: isPwa ? "100%" : "100%",
      width: isPwa ? "100%" : (dockable ? 380 : "100%"),
      maxWidth: "100%",
      background: EPJ.white,
      border: isPwa ? "none" : `1px solid ${EPJ.gray200}`,
      borderRadius: isPwa ? 0 : radius.lg,
      overflow: "hidden",
      fontFamily: font.body,
    }}>
      {title && (
        <div style={{
          padding: `${space.md}px ${space.lg}px`,
          borderBottom: `1px solid ${EPJ.gray100}`,
          fontSize: fontSize.md,
          fontWeight: fontWeight.medium,
          color: EPJ.gray900,
          flexShrink: 0,
        }}>
          {title}
        </div>
      )}

      {/* Fil de conversation */}
      <div style={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        padding: space.lg,
        display: "flex",
        flexDirection: "column",
        gap: space.md,
      }}>
        {isEmpty ? (
          <div style={{
            flex: 1, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", textAlign: "center",
            color: EPJ.gray500, gap: space.sm, padding: space.lg,
          }}>
            {emptyState || (
              <>
                <div style={{ fontSize: 28, opacity: 0.6 }}>💬</div>
                <div style={{ fontSize: fontSize.sm, lineHeight: 1.5 }}>
                  Posez votre première question.
                </div>
              </>
            )}
          </div>
        ) : (
          <>
            {messages.map((m) => (
              <Bubble key={m.id} role={m.role} content={m.content} />
            ))}
            {loading && <TypingDots />}
          </>
        )}
      </div>

      {/* Zone de saisie */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        gap: space.sm,
        padding: space.md,
        borderTop: `1px solid ${EPJ.gray100}`,
        flexShrink: 0,
      }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          rows={1}
          style={{
            flex: 1,
            resize: "none",
            border: `1px solid ${EPJ.gray200}`,
            borderRadius: radius.md,
            padding: `${space.sm + 2}px ${space.md}px`,
            fontSize: isPwa ? fontSize.base : fontSize.md,
            fontFamily: font.body,
            color: EPJ.gray900,
            outline: "none",
            maxHeight: 120,
            lineHeight: 1.4,
          }}
        />
        <Button variant="primary" onClick={send} disabled={!draft.trim() || loading}>
          Envoyer
        </Button>
      </div>
    </div>
  );
}

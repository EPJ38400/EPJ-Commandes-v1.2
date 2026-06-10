// ═══════════════════════════════════════════════════════════════
//  OrderMessageThread — Fil de discussion sur une commande
//  v1.13.0 (nouveau)
//
//  Stocke les messages dans un tableau `messages[]` directement
//  sur le doc commande. Pas de sous-collection : une commande a
//  rarement plus de 10-20 messages dans la vraie vie.
//
//  Qui peut poster :
//   - Le demandeur initial de la commande (auteur de la remarque)
//   - Le conducteur du chantier (matché par nom complet)
//   - Admin et Direction (sinon ils ne peuvent pas intervenir)
//
//  Pas de SMS pour cette V1 — juste l'historique dans la commande.
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ } from "../../core/theme";
import { can } from "../../core/permissions";

// Format de date relative simple en français
function formatDateRelative(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffSec = Math.floor((now - d) / 1000);
  if (diffSec < 60) return "à l'instant";
  if (diffSec < 3600) return `il y a ${Math.floor(diffSec/60)} min`;
  if (diffSec < 86400) return `il y a ${Math.floor(diffSec/3600)} h`;
  if (diffSec < 604800) return `il y a ${Math.floor(diffSec/86400)} j`;
  // Au-delà, date complète
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// Détermine si un utilisateur a le droit de poster sur cette commande
function canPostInThread(user, order, dynChantiers, rolesConfig) {
  if (!user || !order) return false;

  // Admin et Direction peuvent toujours poster (scope "all" sur commandes)
  const viewScope = can(user, "commandes", "view", rolesConfig);
  if (viewScope === "all") return true;

  const fullName = `${user.prenom} ${user.nom}`;

  // Demandeur initial
  if (order.userId && user.id && order.userId === user.id) return true;
  if (order.user && order.user === fullName) return true;

  // Conducteur du chantier
  if (order.chantier && dynChantiers) {
    const chantier = dynChantiers.find(c => c.nom === order.chantier);
    if (chantier && chantier.conducteur === fullName) return true;
  }

  return false;
}

export function OrderMessageThread({ order, user, dynChantiers, rolesConfig, onUpdated }) {
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const messages = Array.isArray(order?.messages) ? order.messages : [];

  const canPost = useMemo(
    () => canPostInThread(user, order, dynChantiers, rolesConfig),
    [user, order, dynChantiers, rolesConfig]
  );

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    if (!order?._id) {
      setError("Commande non identifiée.");
      return;
    }
    setError("");
    setPending(true);
    try {
      const newMessage = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        userId: user.id || user._id || "",
        userName: `${user.prenom || ""} ${user.nom || ""}`.trim() || (user._id || "—"),
        text,
        createdAt: new Date().toISOString(),
      };
      await updateDoc(doc(db, "commandes", order._id), {
        messages: arrayUnion(newMessage),
      });
      setDraft("");
      // Notifie le parent pour qu'il rafraîchisse selectedOrder localement
      if (onUpdated) onUpdated({ ...order, messages: [...messages, newMessage] });
    } catch (err) {
      console.error("OrderMessageThread send:", err);
      setError("Impossible d'envoyer le message. Réessayez.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="epj-card" style={{ marginBottom: 10 }}>
      <div style={{
        fontSize: 14, fontWeight: 700, color: EPJ.dark,
        marginBottom: 12, display: "flex", alignItems: "center", gap: 6,
      }}>
        💬 Échanges
        {messages.length > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600, color: EPJ.gray,
            background: EPJ.grayLight, padding: "2px 8px", borderRadius: 10,
          }}>
            {messages.length}
          </span>
        )}
      </div>

      {messages.length === 0 ? (
        <div style={{
          fontSize: 12, color: EPJ.gray, fontStyle: "italic",
          textAlign: "center", padding: "10px 0",
        }}>
          Aucun message pour l'instant.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: canPost ? 12 : 0 }}>
          {messages.map(m => {
            const isMine = (m.userId && user.id && m.userId === user.id) ||
                           (m.userName && m.userName === `${user.prenom} ${user.nom}`);
            return (
              <div key={m.id} style={{
                background: isMine ? `${EPJ.blue}11` : EPJ.grayLight,
                borderLeft: `3px solid ${isMine ? EPJ.blue : EPJ.gray}55`,
                borderRadius: 8, padding: "8px 12px",
              }}>
                <div style={{
                  display: "flex", justifyContent: "space-between", alignItems: "baseline",
                  marginBottom: 4, gap: 8,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: EPJ.dark }}>
                    {m.userName || "—"}
                  </span>
                  <span style={{ fontSize: 10, color: EPJ.gray, whiteSpace: "nowrap" }}>
                    {formatDateRelative(m.createdAt)}
                  </span>
                </div>
                <div style={{
                  fontSize: 13, color: EPJ.dark, lineHeight: 1.4,
                  whiteSpace: "pre-wrap", wordBreak: "break-word",
                }}>
                  {m.text}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {canPost ? (
        <>
          <textarea
            className="epj-input"
            rows={2}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Écrire un message…"
            style={{ resize: "vertical", marginBottom: 8 }}
          />
          {error && (
            <div style={{
              background: `${EPJ.red}0D`, color: EPJ.red,
              borderRadius: 8, padding: "8px 10px",
              fontSize: 11, fontWeight: 500, marginBottom: 8,
              border: `1px solid ${EPJ.red}33`,
            }}>
              {error}
            </div>
          )}
          <button
            className="epj-btn"
            disabled={pending || !draft.trim()}
            onClick={send}
            style={{
              width: "100%", background: EPJ.dark, color: EPJ.white,
              padding: "10px", fontSize: 13, fontWeight: 700,
            }}
          >
            {pending ? "Envoi…" : "Envoyer"}
          </button>
        </>
      ) : (
        <div style={{
          fontSize: 11, color: EPJ.gray, fontStyle: "italic",
          textAlign: "center", padding: "6px 0",
        }}>
          Seuls le demandeur, le conducteur du chantier et la direction peuvent répondre.
        </div>
      )}
    </div>
  );
}

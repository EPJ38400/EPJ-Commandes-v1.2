// ═══════════════════════════════════════════════════════════════
//  MailsAClasser — File des mails non rattachés
//  v1.13.0 — Brique mail
//  Liste les mails aspirés qui n'ont pas pu être rattachés automatiquement.
//  L'IA propose :
//   • Soit de rattacher à une réserve existante (1 clic)
//   • Soit de créer une nouvelle réserve à partir du mail (brouillon pré-rempli)
//  L'utilisateur peut aussi ignorer le mail.
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font, radius } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useMailsAClasser } from "../../core/gmail/useReserveMails";
import { db } from "../../firebase";
import {
  doc, updateDoc, addDoc, collection, serverTimestamp,
} from "firebase/firestore";
import { MailItem } from "./MailItem";

export function MailsAClasser({ onOpenReserve, onCreateReserveFromDraft, onBack }) {
  const { user } = useAuth();
  const data = useData();
  const { items, loading } = useMailsAClasser();
  const [busyId, setBusyId] = useState(null);

  const handleRattach = async (mailDoc, proposition) => {
    setBusyId(mailDoc._id);
    try {
      // 1. Créer le mail dans reserveMails
      const reserveSnap = data.reserves.find(r => r._id === proposition.reserveId);
      if (!reserveSnap) {
        alert("Réserve introuvable.");
        return;
      }
      await addDoc(collection(db, "reserveMails"), {
        gmailId: mailDoc.gmailId,
        gmailThreadId: mailDoc.gmailThreadId,
        reserveId: proposition.reserveId,
        reserveNum: reserveSnap.numReserve,
        chantierNum: reserveSnap.chantierNum,
        direction: "in",
        expediteurNom: mailDoc.expediteurNom,
        expediteurEmail: mailDoc.expediteurEmail,
        destinataires: mailDoc.destinataires || [],
        cc: mailDoc.cc || [],
        bcc: [],
        sujet: mailDoc.sujet,
        dateEnvoi: mailDoc.dateEnvoi,
        dateAspiration: serverTimestamp(),
        corpsHtml: mailDoc.corpsHtml,
        corpsTexte: mailDoc.corpsTexte,
        apercu: mailDoc.apercu,
        piecesJointes: mailDoc.piecesJointes || [],
        rattachementMethode: "manuel",
        rattachementScore: proposition.score || 1.0,
        rattachementParUserId: user._id,
        rattachementDate: serverTimestamp(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Marquer le mailAClasser comme traité
      await updateDoc(doc(db, "reserveMailsAClasser", mailDoc._id), {
        statut: "rattache",
        traiteParUserId: user._id,
        traiteLe: serverTimestamp(),
      });

      // 3. Optionnel : ouvrir la réserve
      onOpenReserve?.(proposition.reserveId);
    } catch (e) {
      console.error(e);
      alert("Erreur rattachement : " + e.message);
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = (mailDoc, proposition) => {
    // Délégué au parent : ouvrir ReserveCreate avec données pré-remplies
    onCreateReserveFromDraft?.({
      brouillon: proposition.brouillon,
      mailDoc, // pour rattacher le mail après création
    });
  };

  const handleIgnore = async (mailDoc) => {
    if (!confirm("Ignorer ce mail ? Il n'apparaîtra plus dans la file.")) return;
    setBusyId(mailDoc._id);
    try {
      await updateDoc(doc(db, "reserveMailsAClasser", mailDoc._id), {
        statut: "ignore",
        traiteParUserId: user._id,
        traiteLe: serverTimestamp(),
      });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return <div style={{ padding: 20, textAlign: "center", color: EPJ.gray500 }}>Chargement…</div>;
  }

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "12px" }}>
      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        {onBack && (
          <button
            onClick={onBack}
            className="epj-btn"
            style={{
              background: "transparent",
              color: EPJ.gray700,
              padding: "4px 0",
              fontSize: 13,
              marginBottom: 8,
              fontFamily: font.body,
            }}
          >
            ← Retour aux réserves
          </button>
        )}
        <div style={{
          fontFamily: font.display, fontSize: 22, color: EPJ.gray900,
          marginBottom: 4,
        }}>
          📥 Mails à classer
        </div>
        <div style={{ fontSize: 12, color: EPJ.gray500 }}>
          Mails aspirés depuis <strong>sav@</strong> qui n'ont pas pu être rattachés automatiquement.
          L'IA propose un rattachement à valider en 1 clic.
        </div>
      </div>

      {items.length === 0 && (
        <div className="epj-card" style={{ padding: 30, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.3 }}>✨</div>
          <div style={{ fontSize: 14, color: EPJ.gray700, fontWeight: 600 }}>
            Aucun mail en attente
          </div>
          <div style={{ fontSize: 12, color: EPJ.gray500, marginTop: 4 }}>
            Tous les mails ont été rattachés automatiquement ou traités.
          </div>
        </div>
      )}

      {items.map(mail => (
        <MailAClasserCard
          key={mail._id}
          mail={mail}
          reserves={data.reserves || []}
          chantiers={data.chantiers || []}
          busy={busyId === mail._id}
          onRattach={(p) => handleRattach(mail, p)}
          onCreate={(p) => handleCreate(mail, p)}
          onIgnore={() => handleIgnore(mail)}
        />
      ))}
    </div>
  );
}

// ─── Carte d'un mail à classer ─────────────────────────────
function MailAClasserCard({ mail, reserves, chantiers, busy, onRattach, onCreate, onIgnore }) {
  return (
    <div className="epj-card" style={{ padding: 0, marginBottom: 10, overflow: "hidden" }}>
      {/* Mail lui-même (réutilise MailItem en mode déplié) */}
      <div style={{ padding: 8, borderBottom: `1px solid ${EPJ.gray200}` }}>
        <MailItem mail={mail} />
      </div>

      {/* Propositions IA */}
      <div style={{ padding: 12, background: EPJ.gray50 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: EPJ.gray500,
          textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8,
        }}>
          🤖 Propositions de l'IA
        </div>

        {(!mail.iaPropositions || mail.iaPropositions.length === 0) && (
          <div style={{ fontSize: 12, color: EPJ.gray500, padding: 8 }}>
            L'IA n'a pas trouvé de proposition. À classer manuellement.
          </div>
        )}

        {mail.iaPropositions?.map((p, i) => (
          <PropositionRow
            key={i}
            proposition={p}
            reserves={reserves}
            chantiers={chantiers}
            busy={busy}
            onRattach={() => onRattach(p)}
            onCreate={() => onCreate(p)}
          />
        ))}

        {/* Ignorer */}
        <div style={{ marginTop: 8, textAlign: "right" }}>
          <button
            onClick={onIgnore}
            disabled={busy}
            style={{
              background: "transparent", border: "none",
              fontSize: 11, color: EPJ.gray500,
              textDecoration: "underline", cursor: "pointer",
              padding: "4px 8px",
            }}
          >
            Ignorer ce mail
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Une proposition (rattacher ou créer) ──────────────────
function PropositionRow({ proposition, reserves, chantiers, busy, onRattach, onCreate }) {
  if (proposition.type === "rattach") {
    const reserve = reserves.find(r => r._id === proposition.reserveId);
    if (!reserve) {
      return (
        <div style={{ fontSize: 11, color: EPJ.gray500, padding: 6 }}>
          ⚠ Réserve {proposition.reserveId} introuvable (supprimée ?).
        </div>
      );
    }
    return (
      <div style={{
        padding: 10, background: "#fff",
        border: `1px solid ${EPJ.gray200}`, borderRadius: radius.md,
        marginBottom: 6, display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: EPJ.blue, fontWeight: 600 }}>
            🔗 Rattacher à une réserve existante
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: EPJ.gray900, marginTop: 2 }}>
            {reserve.numReserve} — {reserve.chantierNom || reserve.chantierNum}
          </div>
          <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 2 }}>
            {proposition.raison || `confiance ${Math.round((proposition.score || 0) * 100)}%`}
          </div>
        </div>
        <button
          onClick={onRattach}
          disabled={busy}
          className="epj-btn"
          style={{ background: EPJ.blue, color: "#fff", fontSize: 11, padding: "8px 12px" }}
        >
          ✓ Rattacher
        </button>
      </div>
    );
  }

  if (proposition.type === "create") {
    const b = proposition.brouillon || {};
    const chantier = chantiers.find(c =>
      String(c.numAffaire || c.num) === String(b.chantierNum)
    );
    return (
      <div style={{
        padding: 10, background: "#fff",
        border: `1px solid ${EPJ.gray200}`, borderRadius: radius.md,
        marginBottom: 6, display: "flex", alignItems: "center", gap: 8,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: EPJ.orange, fontWeight: 600 }}>
            ✨ Créer une nouvelle réserve
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: EPJ.gray900, marginTop: 2 }}>
            Chantier {b.chantierNum} {chantier ? `— ${chantier.nom}` : ""}
          </div>
          <div style={{ fontSize: 11, color: EPJ.gray700, marginTop: 2 }}>
            {b.description || "(pas de description)"}
          </div>
          <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 2 }}>
            confiance {Math.round((proposition.score || 0) * 100)}%
            {b.emisParLabel && ` · émis par ${b.emisParLabel}`}
          </div>
        </div>
        <button
          onClick={onCreate}
          disabled={busy}
          className="epj-btn"
          style={{ background: EPJ.orange, color: "#fff", fontSize: 11, padding: "8px 12px" }}
        >
          ✨ Créer
        </button>
      </div>
    );
  }

  return null;
}

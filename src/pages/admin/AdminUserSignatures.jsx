// ═══════════════════════════════════════════════════════════════
//  AdminUserSignatures — Gestion des signatures types par user
//  L'admin sélectionne un user et upload sa signature (utilisée
//  dans les quitus pour signer côté technicien EPJ).
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { db } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";
import { SignaturePad } from "../../modules/reserves/SignaturePad";
import {
  uploadUserSignature, deleteUserSignature,
} from "../../modules/reserves/reservesUtils";

export function AdminUserSignatures({ onBack }) {
  const { users } = useData();
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [drawnPng, setDrawnPng] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedUser = users.find(u => u._id === selectedUserId);

  // Trie : users avec signature d'abord, puis alpha
  const sortedUsers = [...users].sort((a, b) => {
    const hasA = a.signatureUrl ? 1 : 0;
    const hasB = b.signatureUrl ? 1 : 0;
    if (hasA !== hasB) return hasB - hasA;
    const na = `${a.prenom || ""} ${a.nom || ""}`.trim();
    const nb = `${b.prenom || ""} ${b.nom || ""}`.trim();
    return na.localeCompare(nb);
  });

  const saveSignature = async () => {
    if (!selectedUser) return;
    if (!drawnPng) { alert("Signature vide."); return; }
    setSaving(true);
    try {
      // Supprime l'ancienne signature si présente
      if (selectedUser.signaturePath) {
        await deleteUserSignature(selectedUser.signaturePath);
      }
      const { url, path } = await uploadUserSignature(selectedUser._id, drawnPng);
      await updateDoc(doc(db, "utilisateurs", selectedUser._id), {
        signatureUrl: url,
        signaturePath: path,
      });
      alert("✓ Signature enregistrée");
      setSelectedUserId(null);
      setDrawnPng("");
    } catch (e) {
      console.error(e);
      alert("❌ " + e.message);
    }
    setSaving(false);
  };

  const deleteSignature = async (user) => {
    if (!confirm(`Supprimer la signature de ${user.prenom} ${user.nom} ?`)) return;
    try {
      if (user.signaturePath) await deleteUserSignature(user.signaturePath);
      await updateDoc(doc(db, "utilisateurs", user._id), {
        signatureUrl: "",
        signaturePath: "",
      });
    } catch (e) { alert("❌ " + e.message); }
  };

  // ═══ Écran édition ═══
  if (selectedUser) {
    return (
      <div style={{ paddingTop: 12, paddingBottom: 40 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button onClick={() => { setSelectedUserId(null); setDrawnPng(""); }}
                  style={backBtnStyle}>← Retour</button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: font.display, fontSize: 20, color: EPJ.gray900, letterSpacing: "-0.02em" }}>
              Signature de {selectedUser.prenom} {selectedUser.nom}
            </div>
          </div>
        </div>

        {selectedUser.signatureUrl && !drawnPng && (
          <div className="epj-card" style={{ padding: 14, marginBottom: 12 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: EPJ.gray500,
              textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
            }}>Signature actuelle</div>
            <img src={selectedUser.signatureUrl} alt="signature actuelle" style={{
              width: "100%", maxHeight: 150, objectFit: "contain",
              background: "#fff", borderRadius: 6,
              border: `1px solid ${EPJ.gray200}`,
            }}/>
            <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 6, textAlign: "center" }}>
              Sign à nouveau ci-dessous pour la remplacer.
            </div>
          </div>
        )}

        <div className="epj-card" style={{ padding: 14, marginBottom: 12 }}>
          <SignaturePad
            label={selectedUser.signatureUrl ? "Nouvelle signature" : "Dessiner la signature"}
            hint="Cette signature sera automatiquement utilisée sur tous les quitus que tu (ou cet utilisateur) génère."
            height={200}
            onChange={setDrawnPng}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { setSelectedUserId(null); setDrawnPng(""); }}
                  className="epj-btn" style={{
            flex: 1, background: EPJ.gray100, color: EPJ.gray700,
          }}>Annuler</button>
          <button onClick={saveSignature} disabled={saving || !drawnPng}
                  className="epj-btn" style={{
            flex: 2, background: EPJ.blue, color: "#fff",
            opacity: (saving || !drawnPng) ? 0.5 : 1,
          }}>
            {saving ? "⏳ Enregistrement…" : "💾 Enregistrer"}
          </button>
        </div>
      </div>
    );
  }

  // ═══ Liste des users ═══
  return (
    <div style={{ paddingTop: 12, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div style={{ fontFamily: font.display, fontSize: 22, color: EPJ.gray900, letterSpacing: "-0.02em" }}>
          Signatures techniciens
        </div>
      </div>

      <div style={{
        background: `${EPJ.blue}08`, border: `1px solid ${EPJ.blue}55`,
        borderRadius: 8, padding: "10px 12px", marginBottom: 14,
        fontSize: 11, color: EPJ.gray700,
      }}>
        💡 Les signatures enregistrées ici sont automatiquement imprimées
        sur les quitus générés. Chaque utilisateur peut avoir sa propre signature.
      </div>

      {sortedUsers.map(u => (
        <div key={u._id} className="epj-card" style={{
          padding: 12, marginBottom: 6,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 22,
            background: u.signatureUrl ? EPJ.green : EPJ.gray100,
            color: u.signatureUrl ? "#fff" : EPJ.gray500,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, flexShrink: 0,
          }}>
            {u.signatureUrl ? "✓" : "○"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: EPJ.gray900 }}>
              {u.prenom} {u.nom}
            </div>
            <div style={{ fontSize: 10, color: EPJ.gray500 }}>
              {u.signatureUrl ? "Signature enregistrée" : "Pas de signature"}
            </div>
          </div>
          {u.signatureUrl && (
            <img src={u.signatureUrl} alt="" style={{
              height: 32, objectFit: "contain",
              background: "#fff", borderRadius: 4,
              border: `1px solid ${EPJ.gray200}`,
              padding: 2,
            }}/>
          )}
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => setSelectedUserId(u._id)} style={{
              background: EPJ.blue, color: "#fff", border: "none",
              borderRadius: 6, padding: "6px 10px", fontSize: 12,
              cursor: "pointer", fontFamily: font.body,
            }}>{u.signatureUrl ? "✏ Modifier" : "+ Ajouter"}</button>
            {u.signatureUrl && (
              <button onClick={() => deleteSignature(u)} style={{
                background: `${EPJ.red}15`, color: EPJ.red, border: "none",
                borderRadius: 6, padding: "6px 8px", fontSize: 12,
                cursor: "pointer",
              }}>🗑</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const backBtnStyle = {
  background: "transparent", border: "none", color: EPJ.gray700,
  fontSize: 14, cursor: "pointer", fontFamily: font.body, padding: "6px 10px",
};

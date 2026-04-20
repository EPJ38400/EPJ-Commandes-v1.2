// ═══════════════════════════════════════════════════════════════
//  ParcOutilSortie — Formulaire de sortie d'un outil
//  Signature OPTIONNELLE (décision métier)
// ═══════════════════════════════════════════════════════════════
import { useState, useRef, useMemo } from "react";
import { db } from "../../firebase";
import { doc, setDoc, updateDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import { SignaturePad } from "../../core/components/SignaturePad";
import {
  generateId, todayISO, canSortirOutil, getCategorieIcon,
} from "./parcUtils";

export function ParcOutilSortie({ outil, onBack, onDone }) {
  const { user } = useAuth();
  const { users, chantiers, outillageCategories } = useData();
  const toast = useToast();

  // Si l'utilisateur n'est pas autorisé, il ne sort QUE pour lui-même
  // S'il est Admin/Direction/Assistante, il peut sortir pour n'importe qui
  const isGestionnaire = ["Admin", "Direction", "Assistante"].some(
    r => (user.roles || []).includes(r)
  );

  const [emprunteurId, setEmprunteurId] = useState(
    isGestionnaire ? "" : user.id
  );
  const [chantierNum, setChantierNum] = useState("");
  const [dateRetourPrevue, setDateRetourPrevue] = useState(() => {
    // Par défaut : +7 jours
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [commentaire, setCommentaire] = useState("");
  const [showSignature, setShowSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const sigRef = useRef(null);

  // Users autorisés à être emprunteur (canSortirOutil = true)
  const eligibleUsers = useMemo(() => {
    return [...users]
      .filter(u => canSortirOutil(u))
      .sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));
  }, [users]);

  const activeChantiers = useMemo(() => {
    return [...chantiers]
      .filter(c => !c.archive)
      .sort((a, b) => (a.num || "").localeCompare(b.num || ""));
  }, [chantiers]);

  const catIcon = getCategorieIcon(outillageCategories, outil.categorieId);

  const save = async () => {
    if (!emprunteurId) { toast("❌ Sélectionne l'emprunteur"); return; }
    if (!dateRetourPrevue) { toast("❌ Date de retour requise"); return; }

    setSaving(true);
    try {
      const emprunteur = users.find(u => u.id === emprunteurId);
      if (!emprunteur) { toast("❌ Emprunteur introuvable"); setSaving(false); return; }

      const id = generateId("sortie_");
      const signatureSortie = showSignature && sigRef.current && !sigRef.current.isEmpty()
        ? sigRef.current.getDataURL()
        : null;

      const payload = {
        id,
        outilId: outil._id,
        ref: outil.ref,
        nom: outil.nom,
        emprunteurId,
        emprunteurNom: `${emprunteur.prenom} ${emprunteur.nom}`,
        chantierNum: chantierNum || "",
        dateSortie: todayISO(),
        dateRetourPrevue,
        dateRetourReelle: null,
        signatureSortie,
        signatureRetour: null,
        commentaireSortie: commentaire.trim() || "",
        commentaireRetour: "",
        etatRetour: null,
        panneIds: [],
        transferts: [],
        createdBy: user.id,
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "outillageSorties", id), payload);
      toast(`✓ ${outil.ref} sorti pour ${emprunteur.prenom} ${emprunteur.nom}`);
      onDone?.();
    } catch (e) {
      console.error(e);
      toast("❌ " + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={backBtnStyle}>← Annuler</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: font.display, fontSize: 20, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.15,
          }}>Sortie d'outil</div>
          <div style={{
            fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3,
            textTransform: "uppercase", fontWeight: 600, marginTop: 1,
          }}>Remplir les informations</div>
        </div>
      </div>

      {/* Rappel outil */}
      <div className="epj-card" style={{
        padding: "12px 14px", marginBottom: 12,
        display: "flex", gap: 12, alignItems: "center",
        borderLeft: `3px solid ${EPJ.orange}`,
      }}>
        {outil.photoURL ? (
          <img src={outil.photoURL} alt="" style={{
            width: 50, height: 50, borderRadius: 8, objectFit: "cover",
            flexShrink: 0, border: `1px solid ${EPJ.gray200}`,
          }}/>
        ) : (
          <div style={{
            width: 50, height: 50, borderRadius: 8,
            background: EPJ.gray100, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 24, flexShrink: 0,
          }}>{catIcon}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: EPJ.gray900, fontFamily: "monospace" }}>
            {outil.ref}
          </div>
          <div style={{
            fontSize: 12, color: EPJ.gray700, marginTop: 1,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{outil.nom}</div>
        </div>
      </div>

      <div className="epj-card" style={{ padding: 14, marginBottom: 14 }}>
        {/* Emprunteur */}
        <FormRow>
          <label style={labelStyle}>Emprunteur <span style={{ color: EPJ.red }}>*</span></label>
          {isGestionnaire ? (
            <select className="epj-input" value={emprunteurId}
              onChange={e => setEmprunteurId(e.target.value)}
              style={{ width: "100%" }}>
              <option value="">— Sélectionner une personne —</option>
              {eligibleUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.prenom} {u.nom}
                </option>
              ))}
            </select>
          ) : (
            <div style={{
              padding: "8px 12px", background: EPJ.gray50,
              borderRadius: 6, fontSize: 13, color: EPJ.gray900,
            }}>
              👤 {user.prenom} {user.nom}
              <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 2 }}>
                Tu ne peux sortir un outil que pour toi-même
              </div>
            </div>
          )}
        </FormRow>

        {/* Chantier */}
        <FormRow>
          <label style={labelStyle}>Chantier (optionnel)</label>
          <select className="epj-input" value={chantierNum}
            onChange={e => setChantierNum(e.target.value)}
            style={{ width: "100%" }}>
            <option value="">— Aucun chantier associé —</option>
            {activeChantiers.map(c => (
              <option key={c.num || c._id} value={c.num || ""}>
                {c.num} — {c.nom}
              </option>
            ))}
          </select>
        </FormRow>

        {/* Date de retour */}
        <FormRow>
          <label style={labelStyle}>Date de retour prévue <span style={{ color: EPJ.red }}>*</span></label>
          <input type="date" className="epj-input" value={dateRetourPrevue}
            min={todayISO()}
            onChange={e => setDateRetourPrevue(e.target.value)}
            style={{ width: "100%" }}/>
          <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 4 }}>
            Un rappel SMS sera proposé si l'outil n'est pas rendu à cette date.
          </div>
        </FormRow>

        {/* Commentaire */}
        <FormRow>
          <label style={labelStyle}>Commentaire (optionnel)</label>
          <textarea className="epj-input" value={commentaire}
            onChange={e => setCommentaire(e.target.value)}
            placeholder="État initial, consignes particulières…"
            rows={2} style={{ resize: "vertical", minHeight: 50 }}/>
        </FormRow>

        {/* Signature optionnelle */}
        <div style={{
          padding: "10px 12px", background: EPJ.gray50,
          borderRadius: 8, marginTop: 8,
        }}>
          {!showSignature ? (
            <button type="button" onClick={() => setShowSignature(true)}
              style={{
                width: "100%", padding: "10px 12px",
                background: "transparent", border: `1px dashed ${EPJ.gray300}`,
                borderRadius: 8, color: EPJ.gray600,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                fontFamily: font.body,
              }}>
              ✍ Ajouter une signature (optionnelle)
            </button>
          ) : (
            <>
              <SignaturePad ref={sigRef} label="Signature de l'emprunteur" height={160}/>
              <button type="button" onClick={() => setShowSignature(false)}
                style={{
                  marginTop: 4, fontSize: 10, color: EPJ.gray500,
                  background: "transparent", border: "none",
                  cursor: "pointer", fontFamily: font.body,
                }}>
                ✕ Retirer la signature
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} className="epj-btn" style={{
          flex: 1, background: EPJ.gray100, color: EPJ.gray700,
        }}>Annuler</button>
        <button onClick={save} disabled={saving} className="epj-btn" style={{
          flex: 2, background: EPJ.orange, color: "#fff",
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? "Enregistrement…" : "📤 Valider la sortie"}
        </button>
      </div>
    </div>
  );
}

const backBtnStyle = {
  background: EPJ.gray100, border: "none", borderRadius: 10,
  padding: "9px 14px", fontSize: 13, fontWeight: 600,
  color: EPJ.gray700, cursor: "pointer", fontFamily: "Inter, sans-serif",
  whiteSpace: "nowrap", flexShrink: 0,
};
const labelStyle = {
  display: "block", fontSize: 10, fontWeight: 600,
  color: EPJ.gray500, letterSpacing: 0.4, textTransform: "uppercase",
  marginBottom: 4,
};
function FormRow({ children }) { return <div style={{ marginBottom: 12 }}>{children}</div>; }

// ═══════════════════════════════════════════════════════════════
//  ParcOutilTransfert — Transfert d'un outil entre 2 personnes
//  2 SIGNATURES OBLIGATOIRES (celui qui transfère + celui qui reçoit)
//  Mise à jour de emprunteurId + historique dans transferts[]
// ═══════════════════════════════════════════════════════════════
import { useState, useRef, useMemo } from "react";
import { db } from "../../firebase";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import { SignaturePad } from "../../core/components/SignaturePad";
import {
  generateId, canSortirOutil, getCategorieIcon,
} from "./parcUtils";

export function ParcOutilTransfert({ outil, sortie, onBack, onDone }) {
  const { user } = useAuth();
  const { users, chantiers, outillageCategories } = useData();
  const toast = useToast();

  const currentHolder = users.find(u => u.id === sortie.emprunteurId);
  const currentHolderName = currentHolder
    ? `${currentHolder.prenom} ${currentHolder.nom}`
    : sortie.emprunteurNom || "—";

  const [toUserId, setToUserId] = useState("");
  const [chantierNum, setChantierNum] = useState(sortie.chantierNum || "");
  const [motif, setMotif] = useState("");
  const [sigFromEmpty, setSigFromEmpty] = useState(true);
  const [sigToEmpty, setSigToEmpty] = useState(true);
  const [saving, setSaving] = useState(false);
  const sigFromRef = useRef(null);
  const sigToRef = useRef(null);

  // Users autorisés à sortir un outil (= futurs détenteurs possibles)
  // On exclut le détenteur actuel (pas de sens de se transférer à soi-même)
  const eligibleUsers = useMemo(() => {
    return [...users]
      .filter(u => canSortirOutil(u) && u.id !== sortie.emprunteurId)
      .sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));
  }, [users, sortie.emprunteurId]);

  const activeChantiers = useMemo(() => {
    return [...chantiers]
      .filter(c => !c.archive)
      .sort((a, b) => (a.num || "").localeCompare(b.num || ""));
  }, [chantiers]);

  const catIcon = getCategorieIcon(outillageCategories, outil.categorieId);

  const canSubmit = toUserId && !sigFromEmpty && !sigToEmpty;

  const save = async () => {
    if (!toUserId) { toast("❌ Sélectionne le nouveau détenteur"); return; }
    if (sigFromEmpty) { toast("❌ Signature du donneur obligatoire"); return; }
    if (sigToEmpty) { toast("❌ Signature du receveur obligatoire"); return; }

    setSaving(true);
    try {
      const toUser = users.find(u => u.id === toUserId);
      if (!toUser) { toast("❌ Destinataire introuvable"); setSaving(false); return; }

      const signatureFrom = sigFromRef.current?.getDataURL();
      const signatureTo = sigToRef.current?.getDataURL();
      if (!signatureFrom || !signatureTo) {
        toast("❌ Signatures invalides"); setSaving(false); return;
      }

      const transfert = {
        id: generateId("tr_"),
        date: new Date().toISOString(),
        fromUserId: sortie.emprunteurId,
        fromUserNom: currentHolderName,
        toUserId,
        toUserNom: `${toUser.prenom} ${toUser.nom}`,
        chantierNum: chantierNum || "",
        motif: motif.trim() || "",
        signatureFrom,
        signatureTo,
        createdBy: user.id,
      };

      // Ajoute au tableau transferts[] et met à jour emprunteur courant
      await updateDoc(doc(db, "outillageSorties", sortie._id), {
        transferts: arrayUnion(transfert),
        emprunteurId: toUserId,
        emprunteurNom: `${toUser.prenom} ${toUser.nom}`,
        chantierNum: chantierNum || sortie.chantierNum || "",
        updatedAt: new Date().toISOString(),
      });

      toast(`✓ Outil transféré à ${toUser.prenom} ${toUser.nom}`);
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
          }}>Transfert d'outil</div>
          <div style={{
            fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3,
            textTransform: "uppercase", fontWeight: 600, marginTop: 1,
          }}>Double signature obligatoire</div>
        </div>
      </div>

      {/* Récap outil */}
      <div className="epj-card" style={{
        padding: "12px 14px", marginBottom: 12,
        display: "flex", gap: 12, alignItems: "center",
        borderLeft: `3px solid ${EPJ.blue}`,
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

      {/* Info importante */}
      <div style={{
        padding: "10px 12px", background: `${EPJ.blue}08`,
        borderLeft: `3px solid ${EPJ.blue}`, borderRadius: 6,
        fontSize: 11, color: EPJ.gray700, lineHeight: 1.5, marginBottom: 12,
      }}>
        🔄 Le transfert change le détenteur de l'outil. <b>Les deux personnes doivent signer</b> — c'est la preuve contradictoire que l'outil a bien changé de mains.
      </div>

      <div className="epj-card" style={{ padding: 14, marginBottom: 14 }}>
        {/* De (lecture seule) */}
        <FormRow>
          <label style={labelStyle}>De (détenteur actuel)</label>
          <div style={{
            padding: "10px 12px", background: EPJ.gray50,
            borderRadius: 6, fontSize: 13, color: EPJ.gray900, fontWeight: 600,
          }}>
            👤 {currentHolderName}
          </div>
        </FormRow>

        {/* Vers */}
        <FormRow>
          <label style={labelStyle}>Vers <span style={{ color: EPJ.red }}>*</span></label>
          <select className="epj-input" value={toUserId}
            onChange={e => setToUserId(e.target.value)}
            style={{ width: "100%" }}>
            <option value="">— Sélectionner la personne qui reçoit —</option>
            {eligibleUsers.map(u => (
              <option key={u.id} value={u.id}>
                {u.prenom} {u.nom}
              </option>
            ))}
          </select>
        </FormRow>

        {/* Chantier */}
        <FormRow>
          <label style={labelStyle}>Chantier (optionnel)</label>
          <select className="epj-input" value={chantierNum}
            onChange={e => setChantierNum(e.target.value)}
            style={{ width: "100%" }}>
            <option value="">— Pas de chantier associé —</option>
            {activeChantiers.map(c => (
              <option key={c.num || c._id} value={c.num || ""}>
                {c.num} — {c.nom}
              </option>
            ))}
          </select>
        </FormRow>

        {/* Motif */}
        <FormRow>
          <label style={labelStyle}>Motif (optionnel)</label>
          <input className="epj-input" value={motif}
            onChange={e => setMotif(e.target.value)}
            placeholder="ex: monteur en congés, changement d'équipe…"/>
        </FormRow>
      </div>

      {/* Signature DE (obligatoire) */}
      <div className="epj-card" style={{
        padding: 14, marginBottom: 10,
        borderLeft: `3px solid ${EPJ.orange}`,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: EPJ.orange,
          textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8,
        }}>
          Signature 1/2 — Personne qui transfère
        </div>
        <SignaturePad
          ref={sigFromRef}
          label={currentHolderName}
          sublabel="Je confirme que je remets cet outil"
          height={160}
          required
          onChange={(isEmpty) => setSigFromEmpty(isEmpty)}
        />
      </div>

      {/* Signature TO (obligatoire) */}
      <div className="epj-card" style={{
        padding: 14, marginBottom: 14,
        borderLeft: `3px solid ${EPJ.green}`,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: EPJ.green,
          textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8,
        }}>
          Signature 2/2 — Personne qui reçoit
        </div>
        {toUserId ? (
          <SignaturePad
            ref={sigToRef}
            label={(() => {
              const u = users.find(x => x.id === toUserId);
              return u ? `${u.prenom} ${u.nom}` : "Destinataire";
            })()}
            sublabel="Je confirme que je prends l'outil en charge"
            height={160}
            required
            onChange={(isEmpty) => setSigToEmpty(isEmpty)}
          />
        ) : (
          <div style={{
            padding: 20, textAlign: "center",
            background: EPJ.gray50, borderRadius: 8,
            fontSize: 12, color: EPJ.gray500,
          }}>
            Sélectionne d'abord la personne qui reçoit ci-dessus.
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} className="epj-btn" style={{
          flex: 1, background: EPJ.gray100, color: EPJ.gray700,
        }}>Annuler</button>
        <button
          onClick={save}
          disabled={saving || !canSubmit}
          className="epj-btn"
          style={{
            flex: 2, background: canSubmit ? EPJ.blue : EPJ.gray300, color: "#fff",
            opacity: saving ? 0.6 : 1,
            cursor: canSubmit && !saving ? "pointer" : "not-allowed",
          }}
        >
          {saving ? "Enregistrement…"
            : canSubmit ? "🔄 Valider le transfert"
            : !toUserId ? "Choisir un destinataire"
            : sigFromEmpty ? "Signature 1/2 manquante"
            : "Signature 2/2 manquante"}
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

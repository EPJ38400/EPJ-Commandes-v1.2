// ═══════════════════════════════════════════════════════════════
//  ReserveLevee — Écran de levée de réserve (v10.B.2)
//  Photo après + commentaire + signature CLIENT + signature TECHNICIEN
//  (si tech n'a pas encore sa signature en profil, on la capture
//   ici et on l'enregistre automatiquement dans son profil)
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { db } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";
import {
  uploadReservePhoto, deleteReservePhoto, todayISO,
  uploadUserSignature, deleteUserSignature,
} from "./reservesUtils";
import { PhotoDropZone } from "./PhotoDropZone";
import { SignaturePad } from "./SignaturePad";

const QUALITES = [
  "Client final",
  "Représentant MOE",
  "Gardien / Syndic",
  "Représentant promoteur",
  "Autre",
];

export function ReserveLevee({ reserveId, onDone, onCancel }) {
  const { user } = useAuth();
  const data = useData();
  const users = data.users || [];
  const reserves = data.reserves || [];
  const company = data.company || {};
  const reserve = reserves.find(r => r._id === reserveId);

  // Cherche la signature actuelle de l'utilisateur connecté
  const currentUserFull = users.find(u => u._id === user?._id);
  const techSignatureUrl = currentUserFull?.signatureUrl || "";
  const techSignaturePath = currentUserFull?.signaturePath || "";
  const needsTechSignature = !techSignatureUrl;

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(null);
  const [photoApres, setPhotoApres] = useState(reserve?.photoApres || "");
  const [photoApresPath, setPhotoApresPath] = useState(reserve?.photoApresPath || "");
  const [commentaire, setCommentaire] = useState(reserve?.commentaireLevee || "");

  // Signature client (v10.B.1)
  const [clientSig, setClientSig] = useState(reserve?.clientSignaturePng || "");
  const [clientNom, setClientNom] = useState(
    reserve?.clientSignataireNom ||
    reserve?.clientFinal?.nom ||
    ""
  );
  const [clientQualite, setClientQualite] = useState(
    reserve?.clientSignataireQualite || "Client final"
  );

  // Signature technicien (v10.B.2)
  // Si le user n'en a pas en profil, on la capture ici et on la sauvera.
  const [techSigDrawn, setTechSigDrawn] = useState("");

  if (!reserve) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 14, color: EPJ.gray500 }}>Réserve introuvable.</div>
        <button onClick={onCancel} className="epj-btn" style={{
          marginTop: 16, background: EPJ.gray100, color: EPJ.gray700,
        }}>← Retour</button>
      </div>
    );
  }

  const handlePhotoFile = async (file) => {
    if (!file) return;
    try {
      setUploadingPhoto("upload");
      const oldPath = photoApresPath;
      const { url, path } = await uploadReservePhoto(reserve._id, "apres", file, setUploadingPhoto);
      setPhotoApres(url);
      setPhotoApresPath(path);
      if (oldPath) await deleteReservePhoto(oldPath);
    } catch (err) {
      console.error(err);
      alert("❌ Échec upload : " + (err.message || "inconnu"));
    } finally {
      setUploadingPhoto(null);
    }
  };

  const removePhoto = async () => {
    if (photoApresPath) await deleteReservePhoto(photoApresPath);
    setPhotoApres(""); setPhotoApresPath("");
  };

  const save = async () => {
    if (!commentaire.trim()) {
      if (!confirm("Continuer sans commentaire de levée ?")) return;
    }
    if (!clientSig) {
      if (!confirm("Aucune signature client capturée. Continuer quand même ?\n(Tu pourras générer le quitus depuis la fiche réserve, mais sans signature client.)")) {
        return;
      }
    }
    setSaving(true);
    try {
      // Si le technicien n'avait pas de signature en profil et qu'il en a dessiné une,
      // on l'upload et on met à jour son profil utilisateur
      if (needsTechSignature && techSigDrawn) {
        try {
          // Supprime l'ancienne (si existe, au cas où)
          if (techSignaturePath) {
            await deleteUserSignature(techSignaturePath);
          }
          const { url, path } = await uploadUserSignature(user._id, techSigDrawn);
          await updateDoc(doc(db, "utilisateurs", user._id), {
            signatureUrl: url,
            signaturePath: path,
          });
        } catch (sigErr) {
          console.warn("Échec upload signature tech (non bloquant) :", sigErr.message);
        }
      }

      await updateDoc(doc(db, "reserves", reserve._id), {
        statut: "levee",
        leveePar: user._id,
        leveeParNom: `${user.prenom || ""} ${user.nom || ""}`.trim(),
        dateLevee: todayISO(),
        commentaireLevee: commentaire.trim(),
        photoApres: photoApres || "",
        photoApresPath: photoApresPath || "",
        clientSignaturePng: clientSig || "",
        clientSignataireNom: (clientNom || "").trim(),
        clientSignataireQualite: clientQualite || "",
      });
      onDone();
    } catch (err) {
      console.error(err);
      alert("❌ Erreur : " + (err.message || "inconnu"));
      setSaving(false);
    }
  };

  return (
    <div style={{ paddingTop: 12, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onCancel} style={{
          background: "transparent", border: "none", color: EPJ.gray700,
          fontSize: 14, cursor: "pointer", fontFamily: font.body, padding: "6px 10px",
        }}>← Annuler</button>
        <div style={{ fontFamily: font.display, fontSize: 22, color: EPJ.gray900, letterSpacing: "-0.02em" }}>
          Lever la réserve
        </div>
      </div>

      <div style={{
        background: `${EPJ.green}12`, border: `1px solid ${EPJ.green}55`,
        borderRadius: 8, padding: "10px 12px", marginBottom: 12,
        fontSize: 12, color: EPJ.gray700,
      }}>
        Réserve <strong>{reserve.numReserve}</strong> — {reserve.titre}<br/>
        Chantier {reserve.chantierNum}
      </div>

      {/* ─── Photo après + commentaire ─── */}
      <div className="epj-card" style={{ padding: 14, marginBottom: 12 }}>
        <label style={{
          display: "block", fontSize: 11, fontWeight: 700, color: EPJ.gray500,
          textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4,
        }}>Photo après reprise</label>
        <div style={{ fontSize: 10, color: EPJ.gray500, marginBottom: 8 }}>
          Recommandée pour tracer la réalisation du travail
        </div>

        <PhotoDropZone
          photoUrl={photoApres}
          uploadingLabel={uploadingPhoto}
          onFileSelected={handlePhotoFile}
          onRemove={removePhoto}
          helperText="Glisser-déposer, ou utiliser la caméra sur mobile"
        />

        <label style={{
          display: "block", fontSize: 11, fontWeight: 700, color: EPJ.gray500,
          textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4, marginTop: 10,
        }}>Travaux réalisés</label>
        <textarea className="epj-input" value={commentaire}
                  onChange={e => setCommentaire(e.target.value)}
                  placeholder="Décrire brièvement l'intervention effectuée..."
                  style={{ minHeight: 90, resize: "vertical" }}/>
      </div>

      {/* ─── Signature technicien (inline si pas en profil) ─── */}
      {needsTechSignature ? (
        <div className="epj-card" style={{
          padding: 14, marginBottom: 12,
          border: `2px solid ${EPJ.orange}`,
          background: `${EPJ.orange}08`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: EPJ.orange, marginBottom: 6 }}>
            ✍ TA SIGNATURE (à enregistrer une fois)
          </div>
          <div style={{ fontSize: 11, color: EPJ.gray700, marginBottom: 10 }}>
            Tu n'as pas encore enregistré ta signature. Signe ci-dessous,
            elle sera <strong>sauvegardée automatiquement</strong> dans ton profil
            pour être réutilisée sur tous tes futurs quitus.
          </div>
          <SignaturePad
            label="Ta signature"
            hint="Utilise un stylet ou ton doigt, comme d'habitude sur un papier"
            height={150}
            onChange={setTechSigDrawn}
          />
        </div>
      ) : (
        <div className="epj-card" style={{
          padding: 12, marginBottom: 12,
          background: `${EPJ.green}08`,
          border: `1px solid ${EPJ.green}55`,
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 17,
            background: EPJ.green, color: "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, flexShrink: 0,
          }}>✓</div>
          <div style={{ flex: 1, fontSize: 12, color: EPJ.gray700 }}>
            <strong>Ta signature est enregistrée</strong> — elle sera automatiquement
            ajoutée au quitus.
          </div>
          {techSignatureUrl && (
            <img src={techSignatureUrl} alt="" style={{
              height: 30, objectFit: "contain",
              background: "#fff", borderRadius: 4, padding: 2,
              border: `1px solid ${EPJ.gray200}`,
            }}/>
          )}
        </div>
      )}

      {/* ─── Signature client ─── */}
      <div className="epj-card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: EPJ.blue, marginBottom: 10 }}>
          SIGNATURE CLIENT (pour le quitus)
        </div>

        <label style={{
          display: "block", fontSize: 11, fontWeight: 700, color: EPJ.gray500,
          textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4,
        }}>Nom du signataire</label>
        <input className="epj-input" value={clientNom}
               onChange={e => setClientNom(e.target.value)}
               placeholder="Nom et prénom"
               style={{ marginBottom: 10 }}/>

        <label style={{
          display: "block", fontSize: 11, fontWeight: 700, color: EPJ.gray500,
          textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4,
        }}>Qualité</label>
        <select className="epj-input" value={clientQualite}
                onChange={e => setClientQualite(e.target.value)}
                style={{ marginBottom: 10 }}>
          {QUALITES.map(q => <option key={q} value={q}>{q}</option>)}
        </select>

        {/* Mention RGPD — à afficher au client avant qu'il signe */}
        {company.mentionRgpd && (
          <div style={{
            fontSize: 10, lineHeight: 1.4,
            color: EPJ.gray700,
            background: EPJ.gray50,
            border: `1px solid ${EPJ.gray200}`,
            borderRadius: 6,
            padding: "8px 10px",
            marginBottom: 10,
            fontStyle: "italic",
          }}>
            ℹ <strong>Information :</strong> {company.mentionRgpd}
          </div>
        )}

        <SignaturePad
          label="Signature du client"
          hint="Fais signer le client directement sur l'écran avec son doigt ou un stylet"
          height={160}
          value={clientSig}
          onChange={setClientSig}
        />
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} className="epj-btn" style={{
          flex: 1, background: EPJ.gray100, color: EPJ.gray700,
        }}>Annuler</button>
        <button onClick={save} disabled={saving || !!uploadingPhoto} className="epj-btn" style={{
          flex: 2, background: EPJ.green, color: "#fff",
          opacity: saving || uploadingPhoto ? 0.5 : 1,
        }}>{saving ? "⏳ Enregistrement…" : "✓ Valider la levée"}</button>
      </div>
    </div>
  );
}

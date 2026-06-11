// ═══════════════════════════════════════════════════════════════
//  ReserveLevee — Écran de levée de réserve (v10.B.2)
//  Photo après + commentaire + signature CLIENT + signature TECHNICIEN
//  (si tech n'a pas encore sa signature en profil, on la capture
//   ici et on l'enregistre automatiquement dans son profil)
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight, shadow } from "../../core/theme";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import { Banner } from "../../core/components/Banner";
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
// v10.I — SMS au demandeur initial après levée
// v10.N — smsReserveLevee retiré (Point 2 PJY : pas de SMS à la levée)

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
  const smsTemplates = data.smsTemplates || []; // v10.I
  const chantiers = data.chantiers || []; // v10.I (pour info chantier dans SMS)
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
      <div style={{ padding: space.xl, textAlign: "center" }}>
        <div style={{ fontSize: fontSize.md, color: EPJ.gray500, marginBottom: space.lg }}>Réserve introuvable.</div>
        <Button variant="secondary" onClick={onCancel}>← Retour</Button>
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
      // v10.N — Plus de SMS à la levée (Point 2 PJY).
      // L'info passe par : dashboard + email automatique (déjà câblé via mailto: dans QuitusActions).
      onDone();
    } catch (err) {
      console.error(err);
      alert("❌ Erreur : " + (err.message || "inconnu"));
      setSaving(false);
    }
  };

  return (
    <div style={{ paddingTop: space.md, paddingBottom: space.xxl }}>
      <div style={{ display: "flex", alignItems: "center", gap: space.sm, marginBottom: space.md + 2 }}>
        <Button variant="ghost" onClick={onCancel}>← Annuler</Button>
        <div style={{ fontFamily: font.display, fontSize: 22, color: EPJ.gray900, letterSpacing: "-0.02em" }}>
          Lever la réserve
        </div>
      </div>

      <Banner
        tone="success"
        title={`Réserve ${reserve.numReserve} — ${reserve.titre}`}
        text={`Chantier ${reserve.chantierNum}`}
      />

      {/* ─── Photo après + commentaire ─── */}
      <div style={panel()}>
        <label style={secLabel}>Photo après reprise</label>
        <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginBottom: space.sm }}>
          Recommandée pour tracer la réalisation du travail
        </div>

        <PhotoDropZone
          photoUrl={photoApres}
          uploadingLabel={uploadingPhoto}
          onFileSelected={handlePhotoFile}
          onRemove={removePhoto}
          helperText="Glisser-déposer, ou utiliser la caméra sur mobile"
        />

        <div style={{ marginTop: space.sm + 2 }}>
          <Field as="textarea" label="Travaux réalisés" value={commentaire} rows={4}
            onChange={e => setCommentaire(e.target.value)}
            placeholder="Décrire brièvement l'intervention effectuée..."/>
        </div>
      </div>

      {/* ─── Signature technicien (inline si pas en profil) ─── */}
      {needsTechSignature ? (
        <div style={panel(EPJ.orange)}>
          <div style={{ fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: EPJ.orangeText, marginBottom: space.xs + 2 }}>
            ✍ TA SIGNATURE (à enregistrer une fois)
          </div>
          <div style={{ fontSize: fontSize.xs, color: EPJ.gray700, marginBottom: space.sm + 2 }}>
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
        <div style={{
          ...panel(EPJ.green),
          display: "flex", alignItems: "center", gap: space.sm,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: radius.pill,
            background: EPJ.green, color: EPJ.white,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, flexShrink: 0,
          }}>✓</div>
          <div style={{ flex: 1, fontSize: fontSize.xs, color: EPJ.gray700 }}>
            <strong>Ta signature est enregistrée</strong> — elle sera automatiquement
            ajoutée au quitus.
          </div>
          {techSignatureUrl && (
            <img src={techSignatureUrl} alt="" style={{
              height: 30, objectFit: "contain",
              background: EPJ.white, borderRadius: radius.sm, padding: 2,
              border: `1px solid ${EPJ.gray200}`,
            }}/>
          )}
        </div>
      )}

      {/* ─── Signature client ─── */}
      <div style={panel()}>
        <div style={{ fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: EPJ.blueText, marginBottom: space.sm, textTransform: "uppercase", letterSpacing: "0.03em" }}>
          Signature client (pour le quitus)
        </div>

        <div style={{ marginBottom: space.sm + 2 }}>
          <Field label="Nom du signataire" value={clientNom}
            onChange={e => setClientNom(e.target.value)}
            placeholder="Nom et prénom"/>
        </div>

        <div style={{ marginBottom: space.sm + 2 }}>
          <Field as="select" label="Qualité" value={clientQualite}
            onChange={e => setClientQualite(e.target.value)}
            options={QUALITES.map(q => ({ value: q, label: q }))}/>
        </div>

        {/* Mention RGPD — à afficher au client avant qu'il signe */}
        {company.mentionRgpd && (
          <div style={{
            fontSize: fontSize.xs, lineHeight: 1.4,
            color: EPJ.gray700,
            background: EPJ.gray50,
            border: `1px solid ${EPJ.gray200}`,
            borderRadius: radius.sm,
            padding: `${space.sm}px ${space.sm + 2}px`,
            marginBottom: space.sm + 2,
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

      <div style={{ display: "flex", gap: space.sm }}>
        <div style={{ flex: 1 }}>
          <Button variant="ghost" full onClick={onCancel}>Annuler</Button>
        </div>
        <div style={{ flex: 2 }}>
          <Button variant="primary" full onClick={save} loading={saving} disabled={!!uploadingPhoto}>
            ✓ Valider la levée
          </Button>
        </div>
      </div>
    </div>
  );
}

// Panneau blanc tokenisé (DA §4). accent → bordure gauche sémantique 3px.
function panel(accent) {
  return {
    background: EPJ.white,
    border: `1px solid ${EPJ.gray200}`,
    borderRadius: radius.lg,
    boxShadow: shadow.sm,
    padding: space.lg,
    marginBottom: space.md,
    ...(accent ? {
      borderLeft: `3px solid ${accent}`,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    } : null),
  };
}

const secLabel = {
  display: "block",
  fontSize: fontSize.xs,
  fontWeight: fontWeight.medium,
  color: EPJ.gray500,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  marginBottom: space.xs,
};

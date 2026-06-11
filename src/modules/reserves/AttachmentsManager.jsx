// ═══════════════════════════════════════════════════════════════
//  AttachmentsManager — Pièces jointes d'une réserve
//  Photos multiples + PDFs, avec drag & drop unifié
// ═══════════════════════════════════════════════════════════════
import { useState, useRef } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import {
  uploadReserveAttachment, deleteReservePhoto,
  formatFileSize, MAX_ATTACHMENT_SIZE_MB, ACCEPTED_ATTACHMENT_TYPES,
} from "./reservesUtils";

export function AttachmentsManager({
  reserveId,
  attachments = [],   // array des pièces jointes déjà enregistrées
  onAdd,              // (newAttachment) => Promise  ← persistance Firestore
  onRemove,           // (attachmentId, path) => Promise
  readOnly = false,
  compact = false,    // Mode compact : juste la liste sans drop zone
}) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(null); // {nom, status}
  const fileInputRef = useRef(null);

  const handleFiles = async (files) => {
    if (!files || files.length === 0) return;
    // Traitement séquentiel pour ne pas saturer Firebase
    for (const file of Array.from(files)) {
      try {
        setUploading({ nom: file.name, status: "Préparation…" });
        const att = await uploadReserveAttachment(
          reserveId, file,
          (stat) => setUploading({ nom: file.name, status: stat })
        );
        await onAdd(att);
      } catch (err) {
        console.error(err);
        alert(`❌ ${file.name} : ${err.message || "Échec"}`);
      }
    }
    setUploading(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onInputChange = (e) => handleFiles(e.target.files);
  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  const handleRemove = async (att) => {
    if (!confirm(`Retirer "${att.nom}" ?`)) return;
    try {
      await onRemove(att.id, att.path);
    } catch (err) {
      alert("❌ " + (err.message || "Échec"));
    }
  };

  const photos = attachments.filter(a => a.kind === "image");
  const pdfs = attachments.filter(a => a.kind === "pdf");

  return (
    <div>
      {/* Zone de dépôt */}
      {!readOnly && !compact && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !uploading && fileInputRef.current?.click()}
          style={{
            padding: `${space.lg + 2}px ${space.md}px`,
            border: `2px dashed ${dragging ? EPJ.blue : EPJ.gray300}`,
            borderRadius: radius.md,
            background: dragging ? EPJ.infoBg : EPJ.gray50,
            textAlign: "center",
            cursor: uploading ? "wait" : "pointer",
            transition: "all 0.15s",
            marginBottom: space.md - 2,
          }}
        >
          {uploading ? (
            <>
              <div style={{ fontSize: 22, marginBottom: space.xs + 2 }}>📤</div>
              <div style={{ fontSize: fontSize.xs, color: EPJ.orangeText, fontWeight: fontWeight.medium, fontFamily: font.body }}>
                {uploading.nom}
              </div>
              <div style={{ fontSize: fontSize.xs, color: EPJ.orangeText, marginTop: 2 }}>
                {uploading.status}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 24, marginBottom: space.xs }}>📎</div>
              <div style={{ fontSize: fontSize.xs, color: EPJ.gray700, fontWeight: fontWeight.medium, fontFamily: font.body, marginBottom: 2 }}>
                Glisser-déposer ou toucher pour ajouter
              </div>
              <div style={{ fontSize: fontSize.xs, color: EPJ.gray500 }}>
                Images ou PDF · {MAX_ATTACHMENT_SIZE_MB} Mo max par fichier
              </div>
            </>
          )}
        </div>
      )}

      {/* Liste des photos */}
      {photos.length > 0 && (
        <div style={{ marginBottom: space.md - 2 }}>
          <div style={attLabel}>
            Photos ({photos.length})
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: space.sm - 2,
          }}>
            {photos.map(att => (
              <div key={att.id} style={{ position: "relative" }}>
                <a href={att.url} target="_blank" rel="noopener noreferrer">
                  <img src={att.url} alt={att.nom} style={{
                    width: "100%", aspectRatio: "1/1", objectFit: "cover",
                    borderRadius: radius.sm, border: `1px solid ${EPJ.gray200}`,
                    display: "block",
                  }}/>
                </a>
                {!readOnly && (
                  <button onClick={() => handleRemove(att)} style={{
                    position: "absolute", top: 3, right: 3,
                    width: 22, height: 22, borderRadius: radius.pill,
                    background: EPJ.scrimDark, color: EPJ.white,
                    border: "none", cursor: "pointer", fontSize: fontSize.xs,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>×</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Liste des PDFs */}
      {pdfs.length > 0 && (
        <div style={{ marginBottom: space.md - 2 }}>
          <div style={attLabel}>
            Documents PDF ({pdfs.length})
          </div>
          {pdfs.map(att => (
            <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" style={{
              textDecoration: "none",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: space.sm,
                padding: `${space.sm + 2}px ${space.md}px`, marginBottom: space.xs + 1,
                background: EPJ.white,
                border: `1px solid ${EPJ.gray200}`, borderRadius: radius.md,
                cursor: "pointer",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: radius.sm,
                  background: EPJ.dangerBg, color: EPJ.redText,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0,
                }}>📄</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: EPJ.gray900,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{att.nom}</div>
                  <div style={{ fontSize: fontSize.xs, color: EPJ.gray500 }}>
                    PDF · {formatFileSize(att.tailleKo)}
                  </div>
                </div>
                {!readOnly && (
                  <button onClick={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    handleRemove(att);
                  }} style={{
                    background: EPJ.dangerBg, color: EPJ.redText,
                    border: "none", borderRadius: radius.sm,
                    padding: `${space.xs + 2}px ${space.sm}px`, fontSize: fontSize.xs, cursor: "pointer",
                    flexShrink: 0,
                  }}>🗑</button>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Vide ? */}
      {attachments.length === 0 && readOnly && (
        <div style={{
          fontSize: fontSize.xs, color: EPJ.gray500, fontStyle: "italic",
          textAlign: "center", padding: space.sm + 2,
        }}>
          Aucune pièce jointe
        </div>
      )}

      <input
        ref={fileInputRef} type="file"
        accept={ACCEPTED_ATTACHMENT_TYPES}
        multiple
        onChange={onInputChange}
        style={{ display: "none" }}
      />
    </div>
  );
}

// Micro-label de section (DA §2.3).
const attLabel = {
  fontSize: fontSize.xs,
  color: EPJ.gray500,
  fontWeight: fontWeight.medium,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  marginBottom: space.xs + 2,
};

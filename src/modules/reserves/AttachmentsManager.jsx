// ═══════════════════════════════════════════════════════════════
//  AttachmentsManager — Pièces jointes d'une réserve
//  Photos multiples + PDFs, avec drag & drop unifié
// ═══════════════════════════════════════════════════════════════
import { useState, useRef } from "react";
import { EPJ, font } from "../../core/theme";
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
            padding: "18px 12px",
            border: `2px dashed ${dragging ? EPJ.blue : EPJ.gray300}`,
            borderRadius: 10,
            background: dragging ? `${EPJ.blue}10` : EPJ.gray50,
            textAlign: "center",
            cursor: uploading ? "wait" : "pointer",
            transition: "all 0.15s",
            marginBottom: 10,
          }}
        >
          {uploading ? (
            <>
              <div style={{ fontSize: 22, marginBottom: 6 }}>📤</div>
              <div style={{ fontSize: 12, color: EPJ.orange, fontWeight: 700, fontFamily: font.body }}>
                {uploading.nom}
              </div>
              <div style={{ fontSize: 11, color: EPJ.orange, marginTop: 2 }}>
                {uploading.status}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 24, marginBottom: 4 }}>📎</div>
              <div style={{ fontSize: 12, color: EPJ.gray700, fontWeight: 600, fontFamily: font.body, marginBottom: 2 }}>
                Glisser-déposer ou toucher pour ajouter
              </div>
              <div style={{ fontSize: 10, color: EPJ.gray500 }}>
                Images ou PDF · {MAX_ATTACHMENT_SIZE_MB} Mo max par fichier
              </div>
            </>
          )}
        </div>
      )}

      {/* Liste des photos */}
      {photos.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 10, color: EPJ.gray500, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
          }}>
            Photos ({photos.length})
          </div>
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6,
          }}>
            {photos.map(att => (
              <div key={att.id} style={{ position: "relative" }}>
                <a href={att.url} target="_blank" rel="noopener noreferrer">
                  <img src={att.url} alt={att.nom} style={{
                    width: "100%", aspectRatio: "1/1", objectFit: "cover",
                    borderRadius: 6, border: `1px solid ${EPJ.gray200}`,
                    display: "block",
                  }}/>
                </a>
                {!readOnly && (
                  <button onClick={() => handleRemove(att)} style={{
                    position: "absolute", top: 3, right: 3,
                    width: 22, height: 22, borderRadius: "50%",
                    background: "rgba(0,0,0,0.6)", color: "#fff",
                    border: "none", cursor: "pointer", fontSize: 11,
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
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 10, color: EPJ.gray500, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6,
          }}>
            Documents PDF ({pdfs.length})
          </div>
          {pdfs.map(att => (
            <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer" style={{
              textDecoration: "none",
            }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "10px 12px", marginBottom: 5,
                background: "#fff",
                border: `1px solid ${EPJ.gray200}`, borderRadius: 8,
                cursor: "pointer",
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 6,
                  background: `${EPJ.red}15`, color: EPJ.red,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0,
                }}>📄</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 600, color: EPJ.gray900,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{att.nom}</div>
                  <div style={{ fontSize: 10, color: EPJ.gray500 }}>
                    PDF · {formatFileSize(att.tailleKo)}
                  </div>
                </div>
                {!readOnly && (
                  <button onClick={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    handleRemove(att);
                  }} style={{
                    background: `${EPJ.red}15`, color: EPJ.red,
                    border: "none", borderRadius: 6,
                    padding: "6px 8px", fontSize: 12, cursor: "pointer",
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
          fontSize: 11, color: EPJ.gray500, fontStyle: "italic",
          textAlign: "center", padding: 10,
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

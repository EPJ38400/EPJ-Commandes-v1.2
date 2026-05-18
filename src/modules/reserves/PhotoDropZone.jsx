// ═══════════════════════════════════════════════════════════════
//  PhotoDropZone — Zone d'upload photo unique avec drag & drop
//  Utilisé pour la photo "avant" (constat) et "après" (levée)
// ═══════════════════════════════════════════════════════════════
import { useState, useRef } from "react";
import { EPJ, font } from "../../core/theme";

export function PhotoDropZone({
  photoUrl,           // URL de la photo actuelle
  uploadingLabel,     // "upload"/"Compression…"/etc. ou null si pas en upload
  onFileSelected,     // (file) => void
  onRemove,           // () => void
  label = "Photo",
  helperText,
}) {
  const [dragging, setDragging] = useState(false);
  const fileLibRef = useRef(null);
  const fileCamRef = useRef(null);

  const handleFiles = (files) => {
    const file = files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("❌ Merci de choisir une image (jpg, png, webp...)");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("❌ Image trop lourde (max 10 Mo)");
      return;
    }
    onFileSelected(file);
  };

  const onInputChange = (e) => {
    handleFiles(e.target.files);
    if (fileLibRef.current) fileLibRef.current.value = "";
    if (fileCamRef.current) fileCamRef.current.value = "";
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  // ─── Photo déjà présente ───
  if (photoUrl) {
    return (
      <div style={{ marginBottom: 10 }}>
        <img src={photoUrl} alt="" style={{
          width: "100%", maxHeight: 250, objectFit: "cover",
          borderRadius: 8, border: `1px solid ${EPJ.gray200}`, marginBottom: 6,
          display: "block",
        }}/>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => fileLibRef.current?.click()}
                  disabled={!!uploadingLabel} style={photoBtnStyle()}>
            🖼 Remplacer
          </button>
          <button type="button" onClick={onRemove} style={photoBtnStyle(true)}>
            🗑 Retirer
          </button>
        </div>
        <input ref={fileLibRef} type="file" accept="image/*" onChange={onInputChange} style={{ display: "none" }}/>
      </div>
    );
  }

  // ─── Upload en cours ───
  if (uploadingLabel) {
    return (
      <div style={{
        padding: "14px 10px", border: `2px dashed ${EPJ.orange}`, borderRadius: 8,
        background: `${EPJ.orange}14`, color: EPJ.orange, fontSize: 13,
        fontWeight: 600, textAlign: "center", marginBottom: 10,
      }}>📤 Téléversement en cours… ({uploadingLabel})</div>
    );
  }

  // ─── Zone drop vide ───
  return (
    <div style={{ marginBottom: 10 }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          width: "100%",
          padding: "22px 12px",
          border: `2px dashed ${dragging ? EPJ.blue : EPJ.gray300}`,
          borderRadius: 10,
          background: dragging ? `${EPJ.blue}10` : EPJ.gray50,
          textAlign: "center",
          transition: "all 0.15s",
          marginBottom: 6,
        }}
      >
        <div style={{ fontSize: 28, marginBottom: 6 }}>🖼</div>
        <div style={{ fontSize: 12, color: EPJ.gray700, fontWeight: 600, fontFamily: font.body, marginBottom: 3 }}>
          Glisser-déposer une image ici
        </div>
        <div style={{ fontSize: 10, color: EPJ.gray500 }}>
          {helperText || "JPG, PNG, WEBP · 10 Mo max"}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <button type="button" onClick={() => fileLibRef.current?.click()} style={photoBtnAction()}>
          🖼 Choisir depuis la bibliothèque
        </button>
        <button type="button" onClick={() => fileCamRef.current?.click()} style={photoBtnAction()}>
          📷 Prendre une photo
        </button>
      </div>
      <input ref={fileLibRef} type="file" accept="image/*" onChange={onInputChange} style={{ display: "none" }}/>
      <input ref={fileCamRef} type="file" accept="image/*" capture="environment" onChange={onInputChange} style={{ display: "none" }}/>
    </div>
  );
}

function photoBtnStyle(danger = false) {
  return {
    flex: 1, padding: "8px 10px", fontSize: 12, fontWeight: 600,
    border: "none", borderRadius: 6, cursor: "pointer",
    background: danger ? `${EPJ.red}15` : EPJ.gray100,
    color: danger ? EPJ.red : EPJ.gray700,
    fontFamily: font.body,
  };
}
function photoBtnAction() {
  return {
    width: "100%", padding: "10px", fontSize: 12, fontWeight: 600,
    border: `1px solid ${EPJ.gray200}`, borderRadius: 6, cursor: "pointer",
    background: "#fff", color: EPJ.gray700, fontFamily: font.body,
  };
}

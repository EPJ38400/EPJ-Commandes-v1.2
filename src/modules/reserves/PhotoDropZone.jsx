// ═══════════════════════════════════════════════════════════════
//  PhotoDropZone — Zone d'upload photo unique avec drag & drop
//  Utilisé pour la photo "avant" (constat) et "après" (levée)
// ═══════════════════════════════════════════════════════════════
import { useState, useRef } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { Button } from "../../core/components/Button";

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
      <div style={{ marginBottom: space.md - 2 }}>
        <img src={photoUrl} alt="" style={{
          width: "100%", maxHeight: 250, objectFit: "cover",
          borderRadius: radius.md, border: `1px solid ${EPJ.gray200}`, marginBottom: space.sm - 2,
          display: "block",
        }}/>
        <div style={{ display: "flex", gap: space.sm - 2 }}>
          <div style={{ flex: 1 }}>
            <Button variant="secondary" full onClick={() => fileLibRef.current?.click()} disabled={!!uploadingLabel}>
              🖼 Remplacer
            </Button>
          </div>
          <div style={{ flex: 1 }}>
            <Button variant="danger" full onClick={onRemove}>
              🗑 Retirer
            </Button>
          </div>
        </div>
        <input ref={fileLibRef} type="file" accept="image/*" onChange={onInputChange} style={{ display: "none" }}/>
      </div>
    );
  }

  // ─── Upload en cours ───
  if (uploadingLabel) {
    return (
      <div style={{
        padding: `${space.md + 2}px ${space.sm + 2}px`, border: `2px dashed ${EPJ.orange}`, borderRadius: radius.md,
        background: EPJ.warningBg, color: EPJ.orangeText, fontSize: fontSize.sm,
        fontWeight: fontWeight.medium, textAlign: "center", marginBottom: space.md - 2,
      }}>📤 Téléversement en cours… ({uploadingLabel})</div>
    );
  }

  // ─── Zone drop vide ───
  return (
    <div style={{ marginBottom: space.md - 2 }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          width: "100%",
          padding: `${space.xl - 2}px ${space.md}px`,
          border: `2px dashed ${dragging ? EPJ.blue : EPJ.gray300}`,
          borderRadius: radius.md,
          background: dragging ? EPJ.infoBg : EPJ.gray50,
          textAlign: "center",
          transition: "all 0.15s",
          marginBottom: space.sm - 2,
        }}
      >
        <div style={{ fontSize: 28, marginBottom: space.xs + 2 }}>🖼</div>
        <div style={{ fontSize: fontSize.xs, color: EPJ.gray700, fontWeight: fontWeight.medium, fontFamily: font.body, marginBottom: 3 }}>
          Glisser-déposer une image ici
        </div>
        <div style={{ fontSize: fontSize.xs, color: EPJ.gray500 }}>
          {helperText || "JPG, PNG, WEBP · 10 Mo max"}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: space.xs + 1 }}>
        <Button variant="secondary" full onClick={() => fileLibRef.current?.click()}>
          🖼 Choisir depuis la bibliothèque
        </Button>
        <Button variant="secondary" full onClick={() => fileCamRef.current?.click()}>
          📷 Prendre une photo
        </Button>
      </div>
      <input ref={fileLibRef} type="file" accept="image/*" onChange={onInputChange} style={{ display: "none" }}/>
      <input ref={fileCamRef} type="file" accept="image/*" capture="environment" onChange={onInputChange} style={{ display: "none" }}/>
    </div>
  );
}

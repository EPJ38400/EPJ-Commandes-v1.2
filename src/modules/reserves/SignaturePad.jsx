// ═══════════════════════════════════════════════════════════════
//  SignaturePad — Canvas tactile pour capturer une signature
//  Utilisable sur iPhone/iPad (touch events) et PC (mouse events)
//  Produit une image PNG base64 transparente, prête pour le PDF
// ═══════════════════════════════════════════════════════════════
import { useRef, useState, useEffect } from "react";
import { EPJ, font } from "../../core/theme";

export function SignaturePad({
  value,            // PNG base64 initial (si on veut afficher une signature existante)
  onChange,         // (pngBase64) => void  — appelé à chaque fin de trait
  height = 180,     // hauteur du canvas en px
  disabled = false,
  label,            // libellé au-dessus du canvas
  hint,             // texte d'aide
}) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(!!value);

  // Taille effective du canvas (responsive) — internal size = display size * dpi
  const dpi = typeof window !== "undefined" ? (window.devicePixelRatio || 1) : 1;

  // Init canvas au montage
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpi;
    canvas.height = rect.height * dpi;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpi, dpi);
    ctx.strokeStyle = "#1E3A8A"; // bleu foncé type stylo
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Si valeur initiale, l'afficher
    if (value) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = value;
    }
  }, []); // eslint-disable-line

  // Coordonnées relatives au canvas (pointer events unifiés)
  const getCoords = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    // Pointer events (unifie souris + touch + stylet)
    if (e.clientX !== undefined) {
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
    // Fallback touch events
    if (e.touches && e.touches[0]) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDraw = (e) => {
    if (disabled) return;
    e.preventDefault();
    const { x, y } = getCoords(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const { x, y } = getCoords(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = (e) => {
    if (!isDrawing) return;
    if (e) e.preventDefault();
    setIsDrawing(false);
    setHasDrawn(true);
    // Notifie le parent avec le PNG base64
    const png = canvasRef.current.toDataURL("image/png");
    if (onChange) onChange(png);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width / dpi, canvas.height / dpi);
    setHasDrawn(false);
    if (onChange) onChange("");
  };

  return (
    <div style={{ marginBottom: 10 }}>
      {label && (
        <label style={{
          display: "block", fontSize: 11, fontWeight: 700, color: EPJ.gray500,
          textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4,
        }}>{label}</label>
      )}
      {hint && (
        <div style={{ fontSize: 10, color: EPJ.gray500, marginBottom: 6 }}>
          {hint}
        </div>
      )}
      <div style={{
        position: "relative",
        border: `2px dashed ${hasDrawn ? EPJ.blue : EPJ.gray300}`,
        borderRadius: 8,
        background: hasDrawn ? "#fff" : "#FAFBFC",
        overflow: "hidden",
        touchAction: "none", // crucial pour iOS : empêche le scroll pendant le dessin
      }}>
        <canvas
          ref={canvasRef}
          style={{
            display: "block",
            width: "100%",
            height: `${height}px`,
            touchAction: "none",
            cursor: disabled ? "not-allowed" : "crosshair",
          }}
          // Pointer events (couvre souris, touch, stylet)
          onPointerDown={startDraw}
          onPointerMove={draw}
          onPointerUp={endDraw}
          onPointerLeave={endDraw}
          onPointerCancel={endDraw}
        />
        {!hasDrawn && !disabled && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            pointerEvents: "none",
            color: EPJ.gray500, fontSize: 13, fontStyle: "italic",
            fontFamily: font.body,
          }}>
            ✍ Signer ici avec le doigt ou le stylet
          </div>
        )}
      </div>
      {!disabled && (
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button
            type="button"
            onClick={clear}
            style={{
              flex: 1,
              background: `${EPJ.red}15`,
              color: EPJ.red,
              border: "none",
              borderRadius: 6,
              padding: "8px 10px",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: font.body,
            }}
          >🗑 Effacer</button>
        </div>
      )}
    </div>
  );
}

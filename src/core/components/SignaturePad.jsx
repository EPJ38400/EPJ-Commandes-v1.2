// ═══════════════════════════════════════════════════════════════
//  SignaturePad — Canvas tactile pour signature numérique
//  Réutilisable : sortie / retour / transfert d'outil, etc.
//  - Multi-touch-friendly (pointer events)
//  - Export base64 JPEG compressé
//  - Validation : signature considérée "faite" si au moins 5 points tracés
// ═══════════════════════════════════════════════════════════════
import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
import { EPJ, font } from "../theme";

export const SignaturePad = forwardRef(function SignaturePad({
  label = "Signature",
  sublabel = null,
  height = 180,
  required = false,
  onChange = null,      // callback (isEmpty: boolean) à chaque changement
}, ref) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const lastPoint = useRef(null);

  // Redimensionne le canvas en fonction du container (responsive)
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      // Sauvegarde du contenu avant resize
      const prevDataUrl = (pointCount > 0) ? canvas.toDataURL("image/png") : null;

      canvas.width = rect.width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = height + "px";

      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = EPJ.gray900;
      ctx.lineWidth = 2.2;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, rect.width, height);

      // Restaurer le contenu
      if (prevDataUrl) {
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, rect.width, height);
        img.src = prevDataUrl;
      }
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas.setPointerCapture) {
      try { canvas.setPointerCapture(e.pointerId); } catch {}
    }
    setIsDrawing(true);
    const p = getPoint(e);
    lastPoint.current = p;
    const ctx = canvas.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const handlePointerMove = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const p = getPoint(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
    setPointCount(c => {
      const newCount = c + 1;
      if (onChange) onChange(newCount < 5);
      return newCount;
    });
  };

  const handlePointerUp = (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    setIsDrawing(false);
    lastPoint.current = null;
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setPointCount(0);
    if (onChange) onChange(true); // empty
  };

  // Expose API au parent via ref
  useImperativeHandle(ref, () => ({
    isEmpty: () => pointCount < 5,
    clear,
    getDataURL: () => {
      if (pointCount < 5) return null;
      const canvas = canvasRef.current;
      // Crée un canvas temporaire sans DPR pour avoir une taille standard
      const tmp = document.createElement("canvas");
      const rect = canvas.getBoundingClientRect();
      tmp.width = rect.width;
      tmp.height = height;
      const tmpCtx = tmp.getContext("2d");
      tmpCtx.drawImage(canvas, 0, 0, rect.width, height);
      return tmp.toDataURL("image/jpeg", 0.85);
    },
  }), [pointCount, height]);

  const isEmpty = pointCount < 5;

  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 6,
      }}>
        <div>
          <label style={{
            fontSize: 11, fontWeight: 700,
            color: EPJ.gray700, letterSpacing: 0.4, textTransform: "uppercase",
          }}>
            {label} {required && <span style={{ color: EPJ.red }}>*</span>}
          </label>
          {sublabel && (
            <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 1 }}>{sublabel}</div>
          )}
        </div>
        {!isEmpty && (
          <button
            type="button"
            onClick={clear}
            style={{
              fontSize: 10, fontWeight: 600, color: EPJ.gray600,
              background: EPJ.gray100, border: "none",
              padding: "4px 8px", borderRadius: 5,
              cursor: "pointer", fontFamily: font.body,
            }}
          >🗑 Effacer</button>
        )}
      </div>
      <div
        ref={containerRef}
        style={{
          position: "relative",
          borderRadius: 10,
          border: `2px ${isEmpty && required ? "dashed" : "solid"} ${
            isEmpty && required ? EPJ.red + "60" : EPJ.gray300
          }`,
          background: "#fff",
          overflow: "hidden",
          touchAction: "none",
        }}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          style={{
            display: "block",
            width: "100%",
            height: height + "px",
            cursor: "crosshair",
            touchAction: "none",
          }}
        />
        {isEmpty && (
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            color: EPJ.gray300, fontSize: 13, fontWeight: 500,
            pointerEvents: "none", fontFamily: font.body,
            fontStyle: "italic",
          }}>
            ✍ Signez ici avec le doigt
          </div>
        )}
      </div>
    </div>
  );
});

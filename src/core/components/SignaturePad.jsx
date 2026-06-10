// ═══════════════════════════════════════════════════════════════
//  SignaturePad — Canvas tactile pour signature numérique
//  v2.0.0 : composant UNIFIÉ — supporte les 2 modes d'utilisation
//
//  MODE 1 : Imperative via ref (legacy parc-machines)
//    const sigRef = useRef();
//    <SignaturePad ref={sigRef} label="Signature" required />
//    sigRef.current.isEmpty()      → boolean
//    sigRef.current.clear()        → vide la signature
//    sigRef.current.getDataURL()   → string base64 JPEG (ou null si vide)
//
//  MODE 2 : Controlled via value/onChange (legacy reserves)
//    <SignaturePad
//       value={sig}
//       onChange={png => setSig(png)}
//       label="Signature client"
//       hint="Avec le doigt ou le stylet"
//    />
//
//  Les deux modes peuvent cohabiter (utiles si l'appelant passe ref + onChange).
//  L'image exportée est :
//    - JPEG 85% via getDataURL() (mode 1, compatible legacy parc-machines)
//    - PNG via onChange (mode 2, compatible legacy réserves quitus)
//
//  - Pointer events (souris + touch + stylet)
//  - Responsive (resize observer du conteneur)
//  - DPR-aware (rendu net sur écrans Retina)
//  - Validation : signature considérée "faite" si au moins 5 points tracés
// ═══════════════════════════════════════════════════════════════
import { useRef, useEffect, useState, useImperativeHandle, forwardRef } from "react";
import { EPJ, font } from "../theme";

export const SignaturePad = forwardRef(function SignaturePad({
  // Mode 1 (parc-machines)
  label = "Signature",
  sublabel = null,
  hint = null,                 // alias de sublabel (mode 2)
  height = 180,
  required = false,
  disabled = false,
  // Mode 2 (réserves)
  value = null,                // PNG base64 initial à afficher
  onChange = null,             // (png|empty) => void — signature au format PNG
  // Style strok configurable (utile pour rendu sombre/clair)
  strokeColor = null,          // par défaut : EPJ.gray900 (mode 1) ou bleu foncé (mode 2)
}, ref) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [pointCount, setPointCount] = useState(value ? 999 : 0); // valeur initiale = déjà signé
  const lastPoint = useRef(null);
  const initialValueDrawn = useRef(false);

  const effectiveStroke = strokeColor || EPJ.gray900;
  const effectiveHint = hint || sublabel;

  // ─── Resize + init canvas (responsive) ──────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      // Sauvegarde du contenu avant resize (sauf si pas encore signé)
      const prevDataUrl = pointCount > 0 ? canvas.toDataURL("image/png") : null;

      canvas.width = rect.width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = rect.width + "px";
      canvas.style.height = height + "px";

      const ctx = canvas.getContext("2d");
      ctx.scale(dpr, dpr);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = effectiveStroke;
      ctx.lineWidth = 2.2;
      ctx.fillStyle = EPJ.white;
      ctx.fillRect(0, 0, rect.width, height);

      // Restaurer le contenu précédent OU la valeur initiale (mode 2)
      const toRestore = prevDataUrl || (value && !initialValueDrawn.current ? value : null);
      if (toRestore) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, height);
          if (value && !initialValueDrawn.current) {
            initialValueDrawn.current = true;
          }
        };
        img.src = toRestore;
      }
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height, effectiveStroke]);

  const getPoint = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e) => {
    if (disabled) return;
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
    if (!isDrawing || disabled) return;
    e.preventDefault();
    const p = getPoint(e);
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPoint.current = p;
    setPointCount(c => c + 1);
  };

  const handlePointerUp = (e) => {
    if (!isDrawing) return;
    if (e) e.preventDefault();
    setIsDrawing(false);
    lastPoint.current = null;
    // ─ Notification du parent (mode 2 : value/onChange) ─
    if (onChange) {
      const canvas = canvasRef.current;
      // PNG (mode 2 — pour quitus, transparence pas critique mais PNG c'est l'historique)
      onChange(canvas.toDataURL("image/png"));
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    ctx.fillStyle = EPJ.white;
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    setPointCount(0);
    initialValueDrawn.current = false;
    if (onChange) onChange(""); // notify empty
  };

  // ─── API impérative exposée au parent via ref (mode 1) ──────────
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
      // JPEG 85% (mode 1 — compatible legacy parc-machines)
      return tmp.toDataURL("image/jpeg", 0.85);
    },
    // v2.0.0 — Permet aussi de récupérer en PNG (utile si appelant veut PNG)
    getDataURLPng: () => {
      if (pointCount < 5) return null;
      return canvasRef.current.toDataURL("image/png");
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
          {label && (
            <label style={{
              fontSize: 11, fontWeight: 700,
              color: EPJ.gray700, letterSpacing: 0.4, textTransform: "uppercase",
            }}>
              {label} {required && <span style={{ color: EPJ.red }}>*</span>}
            </label>
          )}
          {effectiveHint && (
            <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 1 }}>{effectiveHint}</div>
          )}
        </div>
        {!isEmpty && !disabled && (
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
          background: EPJ.white,
          overflow: "hidden",
          touchAction: "none",
          opacity: disabled ? 0.6 : 1,
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
            cursor: disabled ? "not-allowed" : "crosshair",
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

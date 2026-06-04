// ═══════════════════════════════════════════════════════════════
//  ArPdfLink — ouvre la/les pièce(s) PDF d'un AR ou d'une copie de
//  commande (objet arRef / copieRef de commandesEsabora).
//
//  Chaque pièce porte déjà une URL signée 30 j (générée par gmailCore) :
//  on l'ouvre directement (bypass des Storage rules, donc fonctionne même
//  avant le deploy manuel des rules). Fallback SDK getDownloadURL(path)
//  si l'URL signée manque ou a expiré.
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { getDownloadURL, ref as storageRef } from "firebase/storage";
import { storage } from "../../../firebase";
import { EPJ } from "../../../core/theme";

export function ArPdfLink({ refObj, pieces: piecesProp, label = "Voir AR", onError }) {
  const [busy, setBusy] = useState(false);
  // `pieces` explicite prioritaire (déjà résolu/filtré par l'appelant, ex.
  // resolveArPieces) ; fallback legacy sur refObj.pieces.
  const source = piecesProp !== undefined ? piecesProp : (refObj?.pieces || []);
  const pieces = (source || []).filter((p) => p?.kind === "pdf" || /\.pdf$/i.test(p?.nom || ""));

  if (!pieces.length) {
    return <span style={{ color: EPJ.gray300, fontSize: 12 }}>—</span>;
  }

  const open = async (piece) => {
    setBusy(true);
    try {
      if (piece.url) {
        window.open(piece.url, "_blank", "noopener");
        return;
      }
      if (piece.path) {
        const url = await getDownloadURL(storageRef(storage, piece.path));
        window.open(url, "_blank", "noopener");
        return;
      }
      throw new Error("Pièce sans url ni path");
    } catch (e) {
      // Dernier recours : si l'URL signée a expiré mais qu'on a le path.
      if (piece.path) {
        try {
          const url = await getDownloadURL(storageRef(storage, piece.path));
          window.open(url, "_blank", "noopener");
          return;
        } catch (e2) {
          onError?.(e2);
          return;
        }
      }
      onError?.(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 6 }}>
      {pieces.map((piece, i) => (
        <button
          key={piece.id || piece.path || i}
          onClick={() => open(piece)}
          disabled={busy}
          title={piece.nom || "PDF"}
          style={{
            border: `1px solid ${EPJ.blue}55`,
            background: `${EPJ.blue}10`,
            color: EPJ.blue,
            borderRadius: 8,
            padding: "5px 10px",
            fontSize: 12,
            fontWeight: 600,
            cursor: busy ? "wait" : "pointer",
            whiteSpace: "nowrap",
          }}
        >
          📄 {pieces.length > 1 ? piece.nom || `PDF ${i + 1}` : label}
        </button>
      ))}
    </span>
  );
}

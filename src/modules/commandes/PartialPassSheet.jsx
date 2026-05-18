// ═══════════════════════════════════════════════════════════════
//  PartialPassSheet — Modale pour passer une commande partiellement
//  v1.13.0 (nouveau)
//
//  Affiche chaque ligne de la commande avec :
//   - Nom + qté demandée
//   - Champ "qté commandée" pré-rempli à la qté demandée
//   - Bouton "−" pour ne pas commander cette ligne (qté → 0)
//   - Bouton "Tout" pour remettre la qté demandée
//  Plus deux raccourcis globaux : "Tout commandé" / "Tout en attente"
//
//  À la validation, appelle onConfirm({ orderedByIndex }) où
//  orderedByIndex = { 0: qty, 1: qty, ... }
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ } from "../../core/theme";

export function PartialPassSheet({ order, onClose, onConfirm }) {
  const items = Array.isArray(order?.items) ? order.items : [];

  // État local : { idx: qty } — pré-rempli avec la qté demandée pour chaque ligne
  const [orderedByIndex, setOrderedByIndex] = useState(() => {
    const init = {};
    items.forEach((it, idx) => { init[idx] = Number(it.qty) || 0; });
    return init;
  });

  const [pending, setPending] = useState(false);

  // Compteurs résumé
  const summary = useMemo(() => {
    let fullyOrdered = 0;
    let partial = 0;
    let pending = 0;
    items.forEach((it, idx) => {
      const requested = Number(it.qty) || 0;
      const ordered = Number(orderedByIndex[idx]) || 0;
      if (ordered === 0) pending++;
      else if (ordered >= requested) fullyOrdered++;
      else partial++;
    });
    return { fullyOrdered, partial, pending, total: items.length };
  }, [items, orderedByIndex]);

  const allFullyOrdered = summary.fullyOrdered === summary.total;
  const allPending = summary.pending === summary.total;

  const setQty = (idx, value) => {
    const requested = Number(items[idx]?.qty) || 0;
    const v = Math.max(0, Math.min(requested, parseInt(value, 10) || 0));
    setOrderedByIndex(prev => ({ ...prev, [idx]: v }));
  };

  const setAll = (mode) => {
    const next = {};
    items.forEach((it, idx) => {
      next[idx] = mode === "all" ? (Number(it.qty) || 0) : 0;
    });
    setOrderedByIndex(next);
  };

  const submit = async () => {
    if (allPending) return; // garde-fou
    setPending(true);
    try {
      await onConfirm({ orderedByIndex });
    } finally {
      setPending(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 10000,
      background: "rgba(0,0,0,.55)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
      animation: "fadeIn .2s ease",
    }}>
      <div style={{
        background: "#fff", width: "100%", maxWidth: 560,
        maxHeight: "92vh", overflow: "auto",
        borderRadius: "16px 16px 0 0",
        padding: 0,
        display: "flex", flexDirection: "column",
        animation: "slideUp .25s ease",
      }}>
        {/* Header sticky */}
        <div style={{
          position: "sticky", top: 0, background: "#fff",
          padding: "16px 16px 12px",
          borderBottom: `1px solid ${EPJ.gray}22`,
          zIndex: 2,
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "baseline",
            marginBottom: 4,
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: EPJ.dark }}>
              🛒 Passer la commande {order?.num || ""}
            </div>
            <button
              onClick={onClose}
              style={{
                background: "transparent", border: "none",
                fontSize: 22, color: EPJ.gray, cursor: "pointer",
                padding: 0, lineHeight: 1,
              }}
              aria-label="Fermer"
            >×</button>
          </div>
          <div style={{ fontSize: 12, color: EPJ.gray, lineHeight: 1.4 }}>
            Coche ce que tu as effectivement passé chez le fournisseur. Les lignes restantes seront automatiquement reportées dans une nouvelle commande "reliquat" prête à être passée plus tard.
          </div>

          {/* Raccourcis */}
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={() => setAll("all")}
              style={{
                flex: 1, background: allFullyOrdered ? EPJ.green : EPJ.grayLight,
                color: allFullyOrdered ? "#fff" : EPJ.dark,
                border: "none", borderRadius: 8, padding: "8px 10px",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              ✓ Tout commandé
            </button>
            <button
              onClick={() => setAll("none")}
              style={{
                flex: 1, background: allPending ? EPJ.gray : EPJ.grayLight,
                color: allPending ? "#fff" : EPJ.dark,
                border: "none", borderRadius: 8, padding: "8px 10px",
                fontSize: 12, fontWeight: 700, cursor: "pointer",
              }}
            >
              ⊘ Tout en attente
            </button>
          </div>

          {/* Résumé en chips */}
          <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
            <span style={chipStyle(EPJ.green)}>
              ✓ {summary.fullyOrdered} commandée{summary.fullyOrdered > 1 ? "s" : ""}
            </span>
            {summary.partial > 0 && (
              <span style={chipStyle(EPJ.orange)}>
                ◐ {summary.partial} partielle{summary.partial > 1 ? "s" : ""}
              </span>
            )}
            {summary.pending > 0 && (
              <span style={chipStyle(EPJ.gray)}>
                ⊘ {summary.pending} en attente
              </span>
            )}
          </div>
        </div>

        {/* Liste des lignes */}
        <div style={{ padding: "8px 16px 16px" }}>
          {items.map((it, idx) => {
            const requested = Number(it.qty) || 0;
            const ordered = Number(orderedByIndex[idx]) || 0;
            const state =
              ordered === 0 ? "pending" :
              ordered >= requested ? "ordered" : "partial";
            const accentColor =
              state === "ordered" ? EPJ.green :
              state === "partial" ? EPJ.orange : EPJ.gray;

            return (
              <div key={`${it.r}-${idx}`} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "10px 0",
                borderBottom: `1px solid ${EPJ.gray}11`,
              }}>
                <div style={{
                  width: 6, alignSelf: "stretch",
                  background: accentColor, borderRadius: 3,
                }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 600, color: EPJ.dark,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{it.n}</div>
                  <div style={{ fontSize: 10, color: EPJ.gray, fontFamily: "monospace" }}>
                    {it.r} · demandé : {requested} {it.u || "Pièce"}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    onClick={() => setQty(idx, ordered - 1)}
                    style={miniBtn}
                    disabled={ordered === 0}
                    aria-label="Diminuer"
                  >−</button>
                  <input
                    type="number"
                    min={0}
                    max={requested}
                    value={ordered}
                    onChange={e => setQty(idx, e.target.value)}
                    style={{
                      width: 50, textAlign: "center",
                      border: `1.5px solid ${accentColor}55`,
                      borderRadius: 6, padding: "6px 4px",
                      fontSize: 14, fontWeight: 700, color: EPJ.dark,
                      background: state === "pending" ? "#fff" : `${accentColor}11`,
                    }}
                  />
                  <button
                    onClick={() => setQty(idx, ordered + 1)}
                    style={miniBtn}
                    disabled={ordered >= requested}
                    aria-label="Augmenter"
                  >+</button>
                  <button
                    onClick={() => setQty(idx, requested)}
                    style={{
                      ...miniBtn,
                      fontSize: 10, fontWeight: 700,
                      width: "auto", padding: "0 8px",
                    }}
                    title="Tout commander pour cette ligne"
                  >MAX</button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer sticky */}
        <div style={{
          position: "sticky", bottom: 0, background: "#fff",
          borderTop: `1px solid ${EPJ.gray}22`,
          padding: 16,
          display: "flex", gap: 8,
        }}>
          <button
            onClick={onClose}
            disabled={pending}
            style={{
              flex: 1, background: EPJ.grayLight, color: EPJ.dark,
              border: "none", borderRadius: 10, padding: "12px",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={pending || allPending}
            style={{
              flex: 2,
              background: allPending ? EPJ.grayLight : EPJ.dark,
              color: allPending ? EPJ.gray : "#fff",
              border: "none", borderRadius: 10, padding: "12px",
              fontSize: 13, fontWeight: 700,
              cursor: allPending ? "not-allowed" : "pointer",
            }}
          >
            {pending ? "Validation…" :
             allFullyOrdered ? "✓ Valider (tout commandé)" :
             "✓ Valider passage partiel"}
          </button>
        </div>
      </div>
    </div>
  );
}

const miniBtn = {
  width: 30, height: 30,
  background: "#f0f0f0", border: "none", borderRadius: 6,
  fontSize: 16, fontWeight: 700, color: "#333",
  cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
};

function chipStyle(color) {
  return {
    background: `${color}15`,
    color: color,
    border: `1px solid ${color}33`,
    padding: "3px 8px",
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 700,
  };
}

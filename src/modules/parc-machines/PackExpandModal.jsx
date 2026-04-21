// ═══════════════════════════════════════════════════════════════
//  PackExpandModal — Modal d'expansion d'un pack
//  Affichée quand on coche la case d'un pack dans le catalogue.
//  Propose d'ajouter au panier le pack maître + son contenu
//  (outils obligatoires cochés, outils optionnels décochables).
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ, font } from "../../core/theme";
import { computeOutilStatut, getCategorieIcon } from "./parcUtils";

export function PackExpandModal({ pack, outils, outillageSorties, outillageCategories, onCancel, onConfirm }) {
  const packContent = Array.isArray(pack.packContent) ? pack.packContent : [];

  // Construit la liste des outils du pack avec leur statut
  const items = useMemo(() => {
    return packContent.map(p => {
      const o = outils.find(x => x._id === p.outilId);
      if (!o) {
        return { missing: true, outilId: p.outilId, obligatoire: p.obligatoire };
      }
      return {
        ...o,
        obligatoire: p.obligatoire,
        effectiveStatus: computeOutilStatut(o, outillageSorties),
      };
    });
  }, [packContent, outils, outillageSorties]);

  // État cochage : par défaut tous cochés (les obligatoires resteront cochés dans tous les cas)
  const [selected, setSelected] = useState(() => {
    const s = {};
    items.forEach(it => {
      if (it.missing) return;
      s[it._id] = it.effectiveStatus === "disponible";
    });
    return s;
  });

  const toggle = (id, obligatoire) => {
    if (obligatoire) return; // Impossible de décocher un obligatoire
    setSelected(s => ({ ...s, [id]: !s[id] }));
  };

  const packMaitreStatut = computeOutilStatut(pack, outillageSorties);
  const packMaitreDispo = packMaitreStatut === "disponible";

  // Liste finale à ajouter au panier
  const confirmSelection = () => {
    const toAdd = [];
    if (packMaitreDispo) toAdd.push(pack._id);
    items.forEach(it => {
      if (it.missing) return;
      if (selected[it._id]) toAdd.push(it._id);
    });
    onConfirm(toAdd);
  };

  const packIcon = getCategorieIcon(outillageCategories, pack.categorieId);

  // Compteurs pour le bouton
  const selectedCount = (packMaitreDispo ? 1 : 0) +
    items.filter(it => !it.missing && selected[it._id]).length;
  const unavailableCount = items.filter(it => !it.missing && it.effectiveStatus !== "disponible").length;

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,.45)",
        display: "flex", alignItems: "flex-end",
        justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: EPJ.white, width: "100%", maxWidth: 600,
          borderTopLeftRadius: 18, borderTopRightRadius: 18,
          maxHeight: "85vh", display: "flex", flexDirection: "column",
          boxShadow: "0 -10px 40px rgba(0,0,0,.2)",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "16px 18px 12px", borderBottom: `1px solid ${EPJ.gray100}`,
        }}>
          <div style={{
            width: 36, height: 4, borderRadius: 2,
            background: EPJ.gray300, margin: "0 auto 10px",
          }}/>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: `${EPJ.orange}15`, color: EPJ.orange,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 22, flexShrink: 0,
            }}>📦</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: EPJ.orange,
                textTransform: "uppercase", letterSpacing: 0.5,
              }}>Pack d'outils</div>
              <div style={{
                fontSize: 15, fontWeight: 700, color: EPJ.gray900,
                lineHeight: 1.2, marginTop: 1,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{pack.nom}</div>
              <div style={{
                fontSize: 10, color: EPJ.gray500, fontFamily: "monospace",
                marginTop: 1,
              }}>{pack.ref}</div>
            </div>
          </div>
        </div>

        {/* Description */}
        <div style={{
          padding: "10px 18px",
          fontSize: 11, color: EPJ.gray600, lineHeight: 1.5,
          background: `${EPJ.orange}06`,
          borderBottom: `1px solid ${EPJ.gray100}`,
        }}>
          Ce pack contient {items.length} outil{items.length > 1 ? "s" : ""} associé{items.length > 1 ? "s" : ""}. Les obligatoires seront sortis ensemble, tu peux décocher les optionnels.
          {unavailableCount > 0 && (
            <div style={{ color: EPJ.red, marginTop: 4, fontWeight: 600 }}>
              ⚠ {unavailableCount} outil{unavailableCount > 1 ? "s" : ""} du pack {unavailableCount > 1 ? "sont" : "est"} indisponible{unavailableCount > 1 ? "s" : ""}.
            </div>
          )}
        </div>

        {/* Liste */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 14px" }}>
          {/* Pack maître */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 12px", marginBottom: 6,
            borderRadius: 8,
            background: packMaitreDispo ? `${EPJ.orange}08` : `${EPJ.red}08`,
            border: packMaitreDispo ? `1px solid ${EPJ.orange}40` : `1px solid ${EPJ.red}30`,
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: 5,
              background: packMaitreDispo ? EPJ.orange : EPJ.gray300,
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 14, fontWeight: 800, flexShrink: 0,
            }}>{packMaitreDispo ? "✓" : "✕"}</div>
            <div style={{
              width: 36, height: 36, borderRadius: 6,
              background: EPJ.gray100, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 18, flexShrink: 0,
            }}>{packIcon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: EPJ.gray900, fontFamily: "monospace",
              }}>{pack.ref}</div>
              <div style={{
                fontSize: 11, color: EPJ.gray700,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{pack.nom}</div>
            </div>
            <span style={{
              fontSize: 9, fontWeight: 700,
              background: packMaitreDispo ? `${EPJ.orange}15` : `${EPJ.red}15`,
              color: packMaitreDispo ? EPJ.orange : EPJ.red,
              padding: "2px 6px", borderRadius: 4,
            }}>Pack maître</span>
          </div>

          {items.length === 0 ? (
            <div style={{
              padding: 20, textAlign: "center", fontSize: 12, color: EPJ.gray500,
            }}>Ce pack n'a pas encore d'outils associés.</div>
          ) : (
            items.map(it => {
              if (it.missing) {
                return (
                  <div key={it.outilId} style={{
                    padding: "8px 12px", marginBottom: 4, borderRadius: 6,
                    background: `${EPJ.red}08`, fontSize: 11, color: EPJ.red,
                  }}>⚠ Outil introuvable ({it.outilId})</div>
                );
              }
              const dispo = it.effectiveStatus === "disponible";
              const checked = dispo && selected[it._id];
              const icon = getCategorieIcon(outillageCategories, it.categorieId);
              return (
                <div
                  key={it._id}
                  onClick={() => dispo && toggle(it._id, it.obligatoire)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 12px", marginBottom: 4,
                    borderRadius: 8,
                    background: checked ? `${EPJ.orange}06` : EPJ.white,
                    border: `1px solid ${checked ? `${EPJ.orange}40` : EPJ.gray200}`,
                    cursor: dispo && !it.obligatoire ? "pointer" : "default",
                    opacity: dispo ? 1 : 0.55,
                  }}
                >
                  <div style={{
                    width: 24, height: 24, borderRadius: 5,
                    border: `2px solid ${checked ? EPJ.orange : EPJ.gray300}`,
                    background: checked ? EPJ.orange : EPJ.white,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#fff", fontSize: 14, fontWeight: 800, flexShrink: 0,
                  }}>{checked ? "✓" : ""}</div>
                  <div style={{
                    width: 34, height: 34, borderRadius: 6,
                    background: EPJ.gray100, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 16, flexShrink: 0,
                  }}>{icon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: EPJ.gray900, fontFamily: "monospace",
                    }}>{it.ref}</div>
                    <div style={{
                      fontSize: 11, color: EPJ.gray700,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{it.nom}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, alignItems: "flex-end", flexShrink: 0 }}>
                    {it.obligatoire && (
                      <span style={{
                        fontSize: 8, fontWeight: 700, color: EPJ.red,
                        padding: "2px 5px", borderRadius: 3,
                        background: `${EPJ.red}12`, letterSpacing: 0.3,
                      }}>OBLIGATOIRE</span>
                    )}
                    {!dispo && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, color: EPJ.orange,
                      }}>Indispo</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 16px", borderTop: `1px solid ${EPJ.gray100}`,
          display: "flex", gap: 8, background: EPJ.white,
        }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 10,
              background: EPJ.gray100, color: EPJ.gray700,
              border: "none", fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: font.body,
            }}
          >Annuler</button>
          <button
            onClick={confirmSelection}
            disabled={selectedCount === 0}
            style={{
              flex: 2, padding: "12px 16px", borderRadius: 10,
              background: EPJ.orange, color: "#fff",
              border: "none", fontSize: 12, fontWeight: 700,
              cursor: selectedCount === 0 ? "not-allowed" : "pointer",
              fontFamily: font.body,
              opacity: selectedCount === 0 ? 0.4 : 1,
            }}
          >
            Ajouter {selectedCount} outil{selectedCount > 1 ? "s" : ""} au panier
          </button>
        </div>
      </div>
    </div>
  );
}

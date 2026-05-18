// ═══════════════════════════════════════════════════════════════
//  AvancementEvolution — Vue comparative des mois figés
//  Tableau : colonnes = mois figés, lignes = catégories/tâches
//  Delta coloré entre chaque mois + vue globale
// ═══════════════════════════════════════════════════════════════
import React, { useState, useMemo } from "react";
import { EPJ, font } from "../../core/theme";
import { totalHoursForBuilding } from "./avancementTasks";

const FACTORY_META = {
  etude:     { num: 1, label: "ÉTUDE / TMA",                 color: "#8E44AD" },
  beton:     { num: 2, label: "INCORPORATION BÉTON",         color: "#6B6B6B" },
  divers:    { num: 3, label: "AVANCEMENT DIVERS",           color: "#F5841F" },
  placo:     { num: 4, label: "AVANCEMENT PLACO",            color: "#E53935" },
  logements: { num: 5, label: "ÉQUIPEMENT DES LOGEMENTS",    color: "#00A3E0" },
  communs:   { num: 6, label: "ÉQUIPEMENT DES COMMUNS",      color: "#00A3E0" },
  controle:  { num: 7, label: "CONTRÔLE ET MISE EN SERVICE", color: "#A8C536" },
};
const CAT_ORDER = ["etude", "beton", "divers", "placo", "logements", "communs", "controle"];

export function AvancementEvolution({ chantier }) {
  const snapshots = chantier.avancementSnapshots || {};
  const months = useMemo(
    () => Object.keys(snapshots).sort(), // ordre chronologique croissant
    [snapshots]
  );

  // Identifier tous les bâtiments présents dans au moins 1 snapshot
  const allBuildingIds = useMemo(() => {
    const ids = new Set();
    months.forEach(m => {
      Object.keys(snapshots[m] || {}).forEach(b => ids.add(b));
    });
    return Array.from(ids).sort();
  }, [months, snapshots]);

  const [activeBuildingId, setActiveBuildingId] = useState(allBuildingIds[0] || "A");
  const [expandedCats, setExpandedCats] = useState(new Set());

  const toggleCat = (catId) => {
    const next = new Set(expandedCats);
    if (next.has(catId)) next.delete(catId); else next.add(catId);
    setExpandedCats(next);
  };

  if (months.length === 0) {
    return (
      <div className="epj-card" style={{ padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📈</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: EPJ.gray900, marginBottom: 6 }}>
          Aucune donnée d'évolution
        </div>
        <div style={{ fontSize: 12, color: EPJ.gray500, lineHeight: 1.5 }}>
          La vue d'évolution apparaît quand au moins un mois a été figé.
        </div>
      </div>
    );
  }

  if (months.length === 1) {
    return (
      <div className="epj-card" style={{ padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 10 }}>📈</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: EPJ.gray900, marginBottom: 6 }}>
          Un seul mois figé pour l'instant
        </div>
        <div style={{ fontSize: 12, color: EPJ.gray500, lineHeight: 1.5 }}>
          La vue d'évolution comparera les progressions<br/>une fois que tu auras figé au moins 2 mois.
        </div>
      </div>
    );
  }

  // Pour le bâtiment actif, construit la structure de données pour le tableau
  // On prend l'union des catégories/tâches de tous les mois pour ce bâtiment
  const unifiedCategories = useMemo(
    () => buildUnifiedCategories(months, snapshots, activeBuildingId),
    [months, snapshots, activeBuildingId]
  );

  // Calcule le % global et les heures pour chaque mois
  const globalRows = useMemo(() => {
    return months.map(m => {
      const sb = snapshots[m]?.[activeBuildingId];
      if (!sb) return { month: m, pct: null, hours: 0 };
      const pct = computeBuildingPct(unifiedCategories, sb.progress);
      const hours = totalHoursForBuilding(sb.hoursSessions, sb.hours);
      return { month: m, pct, hours };
    });
  }, [months, snapshots, activeBuildingId, unifiedCategories]);

  return (
    <div>
      {/* Onglets bâtiments */}
      {allBuildingIds.length > 1 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 10, overflowX: "auto", paddingBottom: 4 }}>
          {allBuildingIds.map(bId => (
            <button key={bId} onClick={() => setActiveBuildingId(bId)} style={{
              padding: "8px 14px", borderRadius: 8,
              border: `1px solid ${activeBuildingId === bId ? EPJ.gray900 : EPJ.gray200}`,
              background: activeBuildingId === bId ? EPJ.gray900 : EPJ.white,
              color: activeBuildingId === bId ? "#fff" : EPJ.gray700,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: font.body, whiteSpace: "nowrap", flexShrink: 0,
            }}>Bâtiment {bId}</button>
          ))}
        </div>
      )}

      {/* Légende codes couleur */}
      <div className="epj-card" style={{
        padding: "10px 12px", marginBottom: 10,
        display: "flex", gap: 14, flexWrap: "wrap", alignItems: "center",
        fontSize: 10, color: EPJ.gray700,
      }}>
        <LegendItem color={EPJ.green} label="≥+10%" arrow="↑" />
        <LegendItem color={EPJ.blue} label="+1 à +9%" arrow="↗" />
        <LegendItem color={EPJ.gray400} label="0%" arrow="=" />
        <LegendItem color={EPJ.red} label="Régression" arrow="↓" />
      </div>

      {/* Tableau évolution */}
      <div className="epj-card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{
            width: "100%", borderCollapse: "collapse",
            fontFamily: font.body, fontVariantNumeric: "tabular-nums",
          }}>
            <thead>
              <tr style={{ background: EPJ.gray50 }}>
                <th style={thStyleLeft}>Catégorie / Tâche</th>
                {months.map((m, i) => (
                  <th key={m} style={{
                    ...thStyle,
                    ...(i === months.length - 1 ? { background: `${EPJ.orange}10` } : {}),
                  }}>
                    {formatMonthShort(m)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Ligne AVANCEMENT GLOBAL */}
              <tr style={{ background: EPJ.gray900 }}>
                <td style={{
                  ...tdStyleLeft,
                  color: "#fff", fontWeight: 700, fontSize: 11,
                  textTransform: "uppercase", letterSpacing: 0.4,
                }}>
                  Avancement global
                </td>
                {globalRows.map((row, i) => (
                  <PctCell
                    key={row.month}
                    pct={row.pct}
                    prev={i > 0 ? globalRows[i - 1].pct : null}
                    dark
                  />
                ))}
              </tr>

              {/* Lignes par catégorie */}
              {unifiedCategories.map(cat => {
                const expanded = expandedCats.has(cat.id);
                const catRows = months.map(m => {
                  const sb = snapshots[m]?.[activeBuildingId];
                  if (!sb) return null;
                  return computeCategoryPct(cat.tasks, sb.progress);
                });

                return (
                  <React.Fragment key={cat.id}>
                    <tr
                      onClick={() => toggleCat(cat.id)}
                      style={{
                        cursor: "pointer",
                        borderTop: `1px solid ${EPJ.gray200}`,
                      }}
                    >
                      <td style={{
                        ...tdStyleLeft,
                        borderLeft: `3px solid ${cat.color}`,
                        paddingLeft: 9,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{
                            color: EPJ.gray500,
                            transform: expanded ? "rotate(90deg)" : "none",
                            transition: "transform .2s",
                            fontSize: 11,
                          }}>▸</span>
                          <span style={{
                            fontSize: 9, fontWeight: 700,
                            background: `${cat.color}22`, color: cat.color,
                            padding: "2px 5px", borderRadius: 3,
                            fontFamily: "monospace",
                          }}>{cat.num}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: EPJ.gray900 }}>
                            {cat.label}
                          </span>
                        </div>
                      </td>
                      {catRows.map((pct, i) => (
                        <PctCell
                          key={months[i]}
                          pct={pct}
                          prev={i > 0 ? catRows[i - 1] : null}
                          bold
                        />
                      ))}
                    </tr>

                    {expanded && cat.tasks.map(task => {
                      const taskRows = months.map(m => {
                        const sb = snapshots[m]?.[activeBuildingId];
                        if (!sb || !sb.progress) return null;
                        const val = sb.progress[task.id];
                        return val !== undefined ? Number(val) : null;
                      });

                      return (
                        <tr key={task.id} style={{ background: `${EPJ.gray50}66` }}>
                          <td style={{
                            ...tdStyleLeft,
                            paddingLeft: 30,
                            fontSize: 11, color: EPJ.gray700,
                            borderLeft: `3px solid transparent`,
                          }}>
                            {task.label}
                          </td>
                          {taskRows.map((pct, i) => (
                            <PctCell
                              key={months[i]}
                              pct={pct}
                              prev={i > 0 ? taskRows[i - 1] : null}
                            />
                          ))}
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })}

              {/* Ligne heures */}
              <tr style={{ borderTop: `2px solid ${EPJ.gray300}`, background: `${EPJ.blue}08` }}>
                <td style={{
                  ...tdStyleLeft,
                  fontSize: 11, fontWeight: 700, color: EPJ.gray700,
                  textTransform: "uppercase", letterSpacing: 0.3,
                }}>
                  ⏱ Heures cumulées
                </td>
                {globalRows.map((row, i) => {
                  const prevHours = i > 0 ? globalRows[i - 1].hours : null;
                  const delta = prevHours !== null ? row.hours - prevHours : null;
                  return (
                    <td key={row.month} style={{
                      ...tdStyle,
                      fontSize: 11, fontWeight: 700, color: EPJ.blue,
                      background: i === months.length - 1 ? `${EPJ.orange}08` : "transparent",
                    }}>
                      {row.hours > 0 ? `${row.hours.toFixed(0)}h` : "—"}
                      {delta !== null && delta > 0 && (
                        <div style={{
                          fontSize: 9, fontWeight: 500, color: EPJ.gray500,
                          marginTop: 2,
                        }}>+{delta.toFixed(0)}h</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{
        marginTop: 10, fontSize: 10, color: EPJ.gray500,
        lineHeight: 1.5, padding: "0 4px",
      }}>
        💡 Clique sur une catégorie pour voir le détail tâche par tâche.
        {months.length > 3 && " Fais défiler horizontalement pour voir tous les mois."}
      </div>
    </div>
  );
}

// ─── Cellule % avec delta ────────────────────────────────────
function PctCell({ pct, prev, bold, dark }) {
  if (pct === null || pct === undefined) {
    return (
      <td style={{ ...tdStyle, color: EPJ.gray300, fontSize: 11, background: dark ? EPJ.gray900 : "transparent" }}>—</td>
    );
  }

  const delta = prev !== null && prev !== undefined ? pct - prev : null;
  let deltaColor = EPJ.gray400;
  let deltaArrow = "=";
  if (delta !== null) {
    if (delta >= 10) { deltaColor = EPJ.green; deltaArrow = "↑"; }
    else if (delta > 0) { deltaColor = EPJ.blue; deltaArrow = "↗"; }
    else if (delta < 0) { deltaColor = EPJ.red; deltaArrow = "↓"; }
  }

  const pctColor = dark
    ? "#fff"
    : pct === 100 ? EPJ.green : pct >= 60 ? EPJ.blue : pct >= 30 ? EPJ.orange : EPJ.gray700;

  return (
    <td style={{
      ...tdStyle,
      fontSize: bold ? 12 : 11,
      fontWeight: bold ? 700 : 600,
      color: pctColor,
      background: dark ? EPJ.gray900 : "transparent",
    }}>
      <div>{pct}%</div>
      {delta !== null && (
        <div style={{
          fontSize: 9, fontWeight: 600,
          color: dark && deltaColor === EPJ.gray400 ? "#ffffff99" : deltaColor,
          marginTop: 2,
        }}>
          {deltaArrow}{delta > 0 ? "+" : ""}{delta !== 0 ? `${delta}%` : ""}
        </div>
      )}
    </td>
  );
}

function LegendItem({ color, label, arrow }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ color, fontWeight: 700, fontSize: 13 }}>{arrow}</span>
      <span>{label}</span>
    </div>
  );
}

// ─── Construit l'union des catégories/tâches vues dans tous les mois ──
function buildUnifiedCategories(months, snapshots, buildingId) {
  // Pour chaque catégorie, collecte toutes les tâches vues (par id)
  const catMap = {}; // { catId: { tasks: Map<taskId, label> } }

  months.forEach(m => {
    const sb = snapshots[m]?.[buildingId];
    if (!sb || !sb.categories) return;
    Object.entries(sb.categories).forEach(([catId, data]) => {
      if (!catMap[catId]) catMap[catId] = { tasks: new Map() };
      (data.tasks || []).forEach(t => {
        if (!catMap[catId].tasks.has(t.id)) {
          catMap[catId].tasks.set(t.id, t.label);
        }
      });
    });
  });

  // Transforme en liste ordonnée
  return CAT_ORDER
    .filter(id => catMap[id])
    .map(id => {
      const meta = FACTORY_META[id] || { num: 0, label: id.toUpperCase(), color: "#3D3D3D" };
      const tasks = Array.from(catMap[id].tasks.entries())
        .map(([tid, label]) => ({ id: tid, label }));
      return {
        id, num: meta.num, label: meta.label, color: meta.color,
        tasks,
      };
    });
}

function computeCategoryPct(tasks, progress) {
  if (!tasks || tasks.length === 0) return null;
  let sum = 0, n = 0;
  tasks.forEach(t => {
    if (progress && progress[t.id] !== undefined) {
      sum += Number(progress[t.id]);
      n++;
    }
  });
  return n > 0 ? Math.round(sum / n) : null;
}

function computeBuildingPct(categories, progress) {
  let sum = 0, count = 0;
  (categories || []).forEach(cat => {
    (cat.tasks || []).forEach(t => {
      if (progress && progress[t.id] !== undefined) {
        sum += Number(progress[t.id]);
        count++;
      }
    });
  });
  return count > 0 ? Math.round(sum / count) : null;
}

function formatMonthShort(ym) {
  const [y, m] = ym.split("-");
  const months = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
  return `${months[parseInt(m) - 1]} ${y.slice(2)}`;
}

// ─── Styles ──────────────────────────────────────────────────
const thStyle = {
  padding: "10px 8px", textAlign: "center",
  fontSize: 10, fontWeight: 700, color: EPJ.gray700,
  textTransform: "uppercase", letterSpacing: 0.4,
  borderBottom: `2px solid ${EPJ.gray200}`,
  minWidth: 70, whiteSpace: "nowrap",
};
const thStyleLeft = {
  ...thStyle,
  textAlign: "left",
  minWidth: 170, paddingLeft: 12,
  position: "sticky", left: 0,
  background: EPJ.gray50,
  zIndex: 2,
};
const tdStyle = {
  padding: "9px 8px", textAlign: "center",
  borderBottom: `1px solid ${EPJ.gray100}`,
  whiteSpace: "nowrap",
};
const tdStyleLeft = {
  ...tdStyle,
  textAlign: "left",
  paddingLeft: 12,
  position: "sticky", left: 0,
  background: EPJ.white,
  zIndex: 1,
};

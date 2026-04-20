// ═══════════════════════════════════════════════════════════════
//  AvancementHistory — Historique figé d'un chantier
//  - Liste de tous les mois figés avec résumé
//  - Consultation détaillée d'un mois figé
//  - Export PDF + Excel
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { db } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import { getRoles } from "../../core/permissions";
import {
  DEFAULT_BUILDING_CONFIG, totalHoursForTask, totalHoursForBuilding,
} from "./avancementTasks";
import { exportSnapshotToPdf, exportSnapshotToExcel } from "./exportUtils";

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

export function AvancementHistory({ chantier, onBack }) {
  const { user } = useAuth();
  const { users } = useData();
  const toast = useToast();
  const [selectedMonth, setSelectedMonth] = useState(null);

  const canDelete = useMemo(() => {
    if (!user) return false;
    const roles = getRoles(user);
    return roles.includes("Admin") || roles.includes("Direction") || roles.includes("Assistante");
  }, [user]);

  const snapshots = chantier.avancementSnapshots || {};
  const months = useMemo(() => Object.keys(snapshots).sort().reverse(), [snapshots]);

  const deleteSnapshot = async (month) => {
    if (!confirm(`Supprimer définitivement le snapshot de ${formatMonth(month)} ?`)) return;
    try {
      const next = { ...snapshots };
      delete next[month];
      await updateDoc(doc(db, "chantiers", chantier.num), { avancementSnapshots: next });
      toast("🗑 Snapshot supprimé");
      if (selectedMonth === month) setSelectedMonth(null);
    } catch (e) { toast("❌ " + e.message); }
  };

  // Vue détail d'un mois
  if (selectedMonth) {
    return (
      <SnapshotDetail
        chantier={chantier}
        month={selectedMonth}
        snapshot={snapshots[selectedMonth]}
        users={users}
        onBack={() => setSelectedMonth(null)}
        onBackToChantier={onBack}
      />
    );
  }

  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{
          background: EPJ.gray100, border: "none", borderRadius: 10,
          padding: "9px 14px", fontSize: 13, fontWeight: 600,
          color: EPJ.gray700, cursor: "pointer", fontFamily: font.body,
          whiteSpace: "nowrap", flexShrink: 0,
        }}>← Retour</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: font.display, fontSize: 20, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.15,
          }}>Historique figé</div>
          <div style={{
            fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3,
            textTransform: "uppercase", fontWeight: 600, marginTop: 1,
          }}>
            {chantier.num} • {chantier.nom}
          </div>
        </div>
      </div>

      {months.length === 0 ? (
        <div className="epj-card" style={{ padding: 24, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>📜</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: EPJ.gray900, marginBottom: 6 }}>
            Aucun mois figé pour l'instant
          </div>
          <div style={{ fontSize: 12, color: EPJ.gray500, lineHeight: 1.5 }}>
            Une fois une situation figée depuis l'écran d'avancement du chantier,
            elle apparaîtra ici pour consultation et export.
          </div>
        </div>
      ) : (
        months.map(month => (
          <SnapshotCard
            key={month}
            month={month}
            snapshot={snapshots[month]}
            chantier={chantier}
            users={users}
            canDelete={canDelete}
            onOpen={() => setSelectedMonth(month)}
            onDelete={() => deleteSnapshot(month)}
          />
        ))
      )}
    </div>
  );
}

// ─── Carte résumé d'un mois figé ────────────────────────────
function SnapshotCard({ month, snapshot, chantier, users, canDelete, onOpen, onDelete }) {
  const { pct, totalHours } = useMemo(() => summarizeSnapshot(snapshot), [snapshot]);

  const firstBuildingId = Object.keys(snapshot || {})[0];
  const sb = snapshot?.[firstBuildingId];
  const frozenAt = sb?.frozenAt ? new Date(sb.frozenAt) : null;
  const frozenBy = sb?.frozenBy ? users.find(u => u.id === sb.frozenBy) : null;
  const buildingsCount = Object.keys(snapshot || {}).length;

  const barColor = pct === 100 ? EPJ.green : pct >= 60 ? EPJ.blue : pct >= 30 ? EPJ.orange : EPJ.gray500;

  return (
    <div className="epj-card clickable" onClick={onOpen} style={{ padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{ fontSize: 18 }}>🔒</span>
            <div style={{
              fontFamily: font.display, fontSize: 18, fontWeight: 400,
              color: EPJ.gray900, letterSpacing: "-0.01em",
            }}>{formatMonth(month)}</div>
          </div>
          <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 4, lineHeight: 1.5 }}>
            {frozenAt && `Figé le ${frozenAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`}
            {frozenBy && ` par ${frozenBy.prenom} ${frozenBy.nom}`}
            {buildingsCount > 1 && ` • ${buildingsCount} bâtiments`}
            {totalHours > 0 && ` • ⏱ ${totalHours.toFixed(1)}h`}
          </div>
        </div>
        <div style={{
          fontSize: 22, fontWeight: 700, color: barColor,
          fontVariantNumeric: "tabular-nums",
        }}>{pct}%</div>
      </div>

      <div style={{ height: 6, borderRadius: 3, background: EPJ.gray100, overflow: "hidden", marginBottom: 10 }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: barColor, transition: "width .4s ease",
        }}/>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          style={actionBtnStyle(EPJ.gray900, "#fff")}
        >👁 Consulter</button>
        <button
          onClick={(e) => { e.stopPropagation(); exportSnapshotToPdf(chantier, month, snapshot); }}
          style={actionBtnStyle(EPJ.orange, "#fff")}
        >📄 PDF</button>
        <button
          onClick={async (e) => {
            e.stopPropagation();
            try { await exportSnapshotToExcel(chantier, month, snapshot); }
            catch (err) { alert("Erreur export Excel : " + err.message); }
          }}
          style={actionBtnStyle(EPJ.green, "#fff")}
        >📊 Excel</button>
        {canDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            style={actionBtnStyle(`${EPJ.red}10`, EPJ.red, `1px solid ${EPJ.red}44`)}
          >🗑</button>
        )}
      </div>
    </div>
  );
}

// ─── Détail d'un mois figé ───────────────────────────────────
function SnapshotDetail({ chantier, month, snapshot, users, onBack, onBackToChantier }) {
  const { pct, totalHours } = useMemo(() => summarizeSnapshot(snapshot), [snapshot]);
  const buildingIds = Object.keys(snapshot || {});
  const [activeBuildingId, setActiveBuildingId] = useState(buildingIds[0]);
  const sb = snapshot[activeBuildingId];

  const firstSb = snapshot[buildingIds[0]];
  const frozenAt = firstSb?.frozenAt ? new Date(firstSb.frozenAt) : null;
  const frozenBy = firstSb?.frozenBy ? users.find(u => u.id === firstSb.frozenBy) : null;

  const categories = useMemo(() => categoriesFromSnapshot(sb), [sb]);

  const barColor = pct === 100 ? EPJ.green : pct >= 60 ? EPJ.blue : pct >= 30 ? EPJ.orange : EPJ.gray500;

  const { buildingPct, buildingHours } = useMemo(() => {
    return {
      buildingPct: computeBuildingPct(categories, sb?.progress),
      buildingHours: totalHoursForBuilding(sb?.hoursSessions, sb?.hours),
    };
  }, [categories, sb]);
  const buildingColor = buildingPct === 100 ? EPJ.green : buildingPct >= 60 ? EPJ.blue : buildingPct >= 30 ? EPJ.orange : EPJ.gray500;

  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{
          background: EPJ.gray100, border: "none", borderRadius: 10,
          padding: "9px 14px", fontSize: 13, fontWeight: 600,
          color: EPJ.gray700, cursor: "pointer", fontFamily: font.body,
          whiteSpace: "nowrap", flexShrink: 0,
        }}>← Retour</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: EPJ.orange, letterSpacing: 0.4, textTransform: "uppercase" }}>
            🔒 Situation figée
          </div>
          <div style={{
            fontFamily: font.display, fontSize: 22, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.15,
          }}>{formatMonth(month)}</div>
          <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 2, lineHeight: 1.4 }}>
            {chantier.num} • {chantier.nom}
            {frozenAt && ` — Figé le ${frozenAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`}
            {frozenBy && ` par ${frozenBy.prenom} ${frozenBy.nom}`}
          </div>
        </div>
      </div>

      {/* Boutons export */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button
          onClick={() => exportSnapshotToPdf(chantier, month, snapshot)}
          style={{
            flex: 1, background: EPJ.orange, color: "#fff", border: "none",
            borderRadius: 10, padding: "11px 14px", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: font.body,
          }}
        >📄 Exporter PDF</button>
        <button
          onClick={async () => {
            try { await exportSnapshotToExcel(chantier, month, snapshot); }
            catch (err) { alert("Erreur export Excel : " + err.message); }
          }}
          style={{
            flex: 1, background: EPJ.green, color: "#fff", border: "none",
            borderRadius: 10, padding: "11px 14px", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: font.body,
          }}
        >📊 Exporter Excel</button>
      </div>

      {/* Onglets bâtiments */}
      {buildingIds.length > 1 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 10, overflowX: "auto", paddingBottom: 4 }}>
          {buildingIds.map(bId => (
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

      {/* Avancement global du bâtiment */}
      <div className="epj-card" style={{ padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: EPJ.gray500, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Avancement{buildingIds.length > 1 ? ` — Bâtiment ${activeBuildingId}` : ""}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: buildingColor, fontVariantNumeric: "tabular-nums" }}>
            {buildingPct}%
          </div>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: EPJ.gray100, overflow: "hidden" }}>
          <div style={{
            width: `${buildingPct}%`, height: "100%",
            background: `linear-gradient(90deg, ${buildingColor}, ${buildingColor}DD)`,
            transition: "width .4s ease",
          }}/>
        </div>
        {buildingHours > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: EPJ.gray500 }}>
            ⏱ <b style={{ color: EPJ.gray700, fontVariantNumeric: "tabular-nums" }}>{buildingHours.toFixed(1)} h</b> cumulées
          </div>
        )}
      </div>

      {/* Catégories en lecture seule */}
      {categories.map(cat => (
        <ReadOnlyCategoryBlock
          key={cat.id}
          category={cat}
          progress={sb?.progress || {}}
          hoursSessions={sb?.hoursSessions || {}}
          legacyHours={sb?.hours || {}}
        />
      ))}
    </div>
  );
}

// ─── Bloc catégorie en lecture seule ─────────────────────────
function ReadOnlyCategoryBlock({ category, progress, hoursSessions, legacyHours }) {
  const [expanded, setExpanded] = useState(false);
  const pct = computeCategoryPct(category.tasks, progress);
  const accent = category.color;

  return (
    <div className="epj-card" style={{ padding: 0, marginBottom: 8, overflow: "hidden" }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "12px 14px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 10,
          borderLeft: `3px solid ${accent}`,
        }}
      >
        <div style={{
          fontSize: 10, fontWeight: 700, background: `${accent}22`, color: accent,
          padding: "3px 7px", borderRadius: 4, fontFamily: "monospace",
        }}>{category.num}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900 }}>{category.label}</div>
          <div style={{ height: 4, marginTop: 5, borderRadius: 2, background: EPJ.gray100, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: accent, transition: "width .3s ease" }}/>
          </div>
        </div>
        <div style={{
          fontSize: 13, fontWeight: 700, color: accent,
          fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "right",
        }}>{pct}%</div>
        <span style={{ color: EPJ.gray500, fontSize: 12, transform: expanded ? "rotate(90deg)" : "none", transition: "transform .2s" }}>▸</span>
      </div>

      {expanded && (
        <div style={{ padding: "4px 14px 14px", borderTop: `1px solid ${EPJ.gray100}` }}>
          {category.tasks.map(task => {
            const p = Number(progress?.[task.id] || 0);
            const h = totalHoursForTask(hoursSessions[task.id], legacyHours[task.id]);
            const pctColor = p === 100 ? EPJ.green : p > 0 ? EPJ.blue : EPJ.gray300;
            return (
              <div key={task.id} style={{
                padding: "10px 0", borderTop: `1px solid ${EPJ.gray100}`,
                display: "flex", alignItems: "center", gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: EPJ.gray900, fontWeight: 500 }}>{task.label}</div>
                  {h > 0 && (
                    <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 2 }}>
                      ⏱ <b style={{ color: EPJ.gray700, fontVariantNumeric: "tabular-nums" }}>{h.toFixed(1)}h</b>
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: 13, fontWeight: 700, color: pctColor,
                  fontVariantNumeric: "tabular-nums", minWidth: 44, textAlign: "right",
                }}>{p}%</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function categoriesFromSnapshot(sb) {
  if (!sb || !sb.categories) return [];
  return CAT_ORDER.map(id => {
    const data = sb.categories[id];
    if (!data) return null;
    const meta = FACTORY_META[id] || { num: 0, label: id.toUpperCase(), color: "#3D3D3D" };
    return {
      id, num: meta.num, label: meta.label, color: meta.color,
      tasks: data.tasks || [],
    };
  }).filter(Boolean);
}

function computeCategoryPct(tasks, progress) {
  if (!tasks || tasks.length === 0) return 0;
  let sum = 0;
  tasks.forEach(t => { sum += Number(progress?.[t.id] || 0); });
  return Math.round(sum / tasks.length);
}

function computeBuildingPct(categories, progress) {
  let sum = 0, count = 0;
  (categories || []).forEach(cat => {
    (cat.tasks || []).forEach(t => {
      sum += Number(progress?.[t.id] || 0);
      count++;
    });
  });
  return count > 0 ? Math.round(sum / count) : 0;
}

function summarizeSnapshot(snapshot) {
  // Moyenne des % sur tous les bâtiments + total heures
  const buildingIds = Object.keys(snapshot || {});
  if (buildingIds.length === 0) return { pct: 0, totalHours: 0 };
  let totalPct = 0, totalHours = 0;
  buildingIds.forEach(bId => {
    const sb = snapshot[bId];
    const cats = categoriesFromSnapshot(sb);
    totalPct += computeBuildingPct(cats, sb?.progress);
    totalHours += totalHoursForBuilding(sb?.hoursSessions, sb?.hours);
  });
  return {
    pct: Math.round(totalPct / buildingIds.length),
    totalHours,
  };
}

function actionBtnStyle(bg, color, border = "none") {
  return {
    flex: 1, background: bg, color, border,
    borderRadius: 8, padding: "8px 10px",
    fontSize: 12, fontWeight: 600,
    cursor: "pointer", fontFamily: font.body,
    minWidth: 60,
  };
}

function formatMonth(ym) {
  const [y, m] = ym.split("-");
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

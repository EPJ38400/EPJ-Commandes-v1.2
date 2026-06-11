// ═══════════════════════════════════════════════════════════════
//  AvancementHistory — Historique figé d'un chantier
//  - Liste de tous les mois figés avec résumé
//  - Consultation détaillée d'un mois figé
//  - Export PDF + Excel
//
//  DS-2 : repeinte design-system + desktop (conforme
//  docs/DIRECTION_ARTISTIQUE.md). Affichage uniquement — snapshots,
//  exports et l'unique écriture Firestore (deleteSnapshot) INCHANGÉS.
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { db } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useViewport } from "../../core/useViewport";
import { useToast } from "../../core/components/Toast";
import { getRoles } from "../../core/permissions";
import { ModuleSubHeader } from "../../core/components/ModuleSubHeader";
import { Button } from "../../core/components/Button";
import { DataTable } from "../../core/components/DataTable";
import { IconButton } from "../../core/components/IconButton";
import {
  DEFAULT_BUILDING_CONFIG, totalHoursForTask, totalHoursForBuilding,
} from "./avancementTasks";
import { exportSnapshotToPdf, exportSnapshotToExcel } from "./exportUtils";
import { AvancementEvolution } from "./AvancementEvolution";

const FACTORY_META = {
  etude:     { num: 1, label: "ÉTUDE / TMA",                 color: EPJ.catEtude },
  beton:     { num: 2, label: "INCORPORATION BÉTON",         color: EPJ.gray500 },
  divers:    { num: 3, label: "AVANCEMENT DIVERS",           color: EPJ.orange },
  placo:     { num: 4, label: "AVANCEMENT PLACO",            color: EPJ.red },
  logements: { num: 5, label: "ÉQUIPEMENT DES LOGEMENTS",    color: EPJ.blue },
  communs:   { num: 6, label: "ÉQUIPEMENT DES COMMUNS",      color: EPJ.blue },
  ssequip:   { num: 6, label: "ÉQUIPEMENT SOUS-SOL",         color: EPJ.blue },
  controle:  { num: 7, label: "CONTRÔLE ET MISE EN SERVICE", color: EPJ.green },
};
const CAT_ORDER = ["etude", "beton", "divers", "placo", "ssequip", "logements", "communs", "controle"];

// Libellé d'une unité figée (bâtiment ou sous-sol commun), autonome et fidèle au figeage
function snapshotUnitLabel(sb, key) {
  return sb?.unitLabel || `Bâtiment ${key}`;
}

export function AvancementHistory({ chantier, onBack }) {
  const { user } = useAuth();
  const { users } = useData();
  const isPwa = useViewport() === "mobile";
  const toast = useToast();
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [activeTab, setActiveTab] = useState("list"); // "list" | "evolution"

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

  // Lignes augmentées pour la table (résumés via les helpers existants)
  const rows = useMemo(() => months.map(month => {
    const snapshot = snapshots[month];
    const { pct, totalHours } = summarizeSnapshot(snapshot);
    const firstBuildingId = Object.keys(snapshot || {})[0];
    const sb = snapshot?.[firstBuildingId];
    const frozenAt = sb?.frozenAt ? new Date(sb.frozenAt) : null;
    const frozenBy = sb?.frozenBy ? users.find(u => u.id === sb.frozenBy) : null;
    return {
      month,
      _label: formatMonth(month),
      _pct: pct,
      _hours: totalHours,
      _unites: Object.keys(snapshot || {}).length,
      _frozenAt: frozenAt,
      _frozenBy: frozenBy ? `${frozenBy.prenom} ${frozenBy.nom}` : "",
    };
  }), [months, snapshots, users]);

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

  const columns = [
    {
      key: "month", header: "Mois", width: 160,
      render: (_v, row) => (
        <span style={{ fontWeight: fontWeight.medium, color: EPJ.gray900 }}>
          🔒 {row._label}
        </span>
      ),
    },
    {
      key: "_frozenAt", header: "Figé le", width: 200, sortable: false,
      render: (v, row) => (
        <span style={{ fontSize: fontSize.sm, color: EPJ.gray500 }}>
          {v ? v.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
          {row._frozenBy ? ` · ${row._frozenBy}` : ""}
        </span>
      ),
    },
    { key: "_unites", header: "Unités", numeric: true, width: 80 },
    {
      key: "_hours", header: "Heures", numeric: true, width: 90,
      render: (v) => v > 0 ? `${v.toFixed(1)}h` : <span style={{ color: EPJ.gray400 }}>—</span>,
    },
    {
      key: "_pct", header: "Avancement", numeric: true, width: 200,
      render: (v) => <ProgressBarCell pct={v} />,
    },
    {
      key: "_actions", header: "", sortable: false, align: "right", width: 130,
      render: (_v, row) => (
        <div style={{ display: "inline-flex", gap: space.xs, justifyContent: "flex-end" }}
          onClick={(e) => e.stopPropagation()}>
          <IconButton label="Exporter PDF" onClick={() => exportSnapshotToPdf(chantier, row.month, snapshots[row.month])}>📄</IconButton>
          <IconButton label="Exporter Excel" onClick={async () => {
            try { await exportSnapshotToExcel(chantier, row.month, snapshots[row.month]); }
            catch (err) { alert("Erreur export Excel : " + err.message); }
          }}>📊</IconButton>
          {canDelete && (
            <IconButton label="Supprimer" variant="danger" onClick={() => deleteSnapshot(row.month)}>🗑</IconButton>
          )}
        </div>
      ),
    },
  ];

  const renderCard = (row) => (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: space.md, marginBottom: space.sm + 2 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: space.sm, marginBottom: 3 }}>
            <span style={{ fontSize: fontSize.lg - 2 }}>🔒</span>
            <div style={{
              fontFamily: font.display, fontSize: fontSize.lg - 2, fontWeight: fontWeight.regular,
              color: EPJ.gray900, letterSpacing: "-0.01em",
            }}>{row._label}</div>
          </div>
          <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginTop: space.xs, lineHeight: 1.5 }}>
            {row._frozenAt && `Figé le ${row._frozenAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`}
            {row._frozenBy && ` par ${row._frozenBy}`}
            {row._unites > 1 && ` • ${row._unites} unités`}
            {row._hours > 0 && ` • ⏱ ${row._hours.toFixed(1)}h`}
          </div>
        </div>
        <div style={{
          fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: pctColor(row._pct),
          fontVariantNumeric: "tabular-nums",
        }}>{row._pct}%</div>
      </div>

      <div style={{ height: 6, borderRadius: radius.pill, background: EPJ.gray100, overflow: "hidden", marginBottom: space.sm + 2 }}>
        <div style={{
          width: `${row._pct}%`, height: "100%",
          background: pctColor(row._pct), transition: "width .4s ease",
        }}/>
      </div>

      <div style={{ display: "flex", gap: space.xs + 2, flexWrap: "wrap" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ flex: 1, minWidth: 100 }}>
          <Button variant="secondary" full onClick={() => setSelectedMonth(row.month)}>👁 Consulter</Button>
        </div>
        <Button variant="ghost" onClick={() => exportSnapshotToPdf(chantier, row.month, snapshots[row.month])}>📄 PDF</Button>
        <Button variant="ghost" onClick={async () => {
          try { await exportSnapshotToExcel(chantier, row.month, snapshots[row.month]); }
          catch (err) { alert("Erreur export Excel : " + err.message); }
        }}>📊 Excel</Button>
        {canDelete && (
          <IconButton label="Supprimer" variant="danger" onClick={() => deleteSnapshot(row.month)}>🗑</IconButton>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ paddingTop: space.md, paddingBottom: space.xl }}>
      <ModuleSubHeader
        moduleName="Chantier"
        title="Historique figé"
        subtitle={`${chantier.num} • ${chantier.nom}`}
        onBackToModuleHome={onBack}
      />

      {/* Onglets Liste / Évolution */}
      {months.length > 0 && (
        <div style={{ display: "flex", gap: space.xs, marginBottom: space.md }}>
          <TabChip active={activeTab === "list"} onClick={() => setActiveTab("list")} isPwa={isPwa}>
            📜 Liste ({months.length})
          </TabChip>
          <TabChip active={activeTab === "evolution"} onClick={() => setActiveTab("evolution")} isPwa={isPwa}>
            📈 Évolution
          </TabChip>
        </div>
      )}

      {months.length === 0 ? (
        <div style={{ ...panelStyle, padding: space.xl, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: space.sm + 2 }}>📜</div>
          <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.medium, color: EPJ.gray900, marginBottom: space.xs + 2 }}>
            Aucun mois figé pour l'instant
          </div>
          <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, lineHeight: 1.5 }}>
            Une fois une situation figée depuis l'écran d'avancement du chantier,
            elle apparaîtra ici pour consultation et export.
          </div>
        </div>
      ) : activeTab === "evolution" ? (
        <AvancementEvolution chantier={chantier} />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          keyField="month"
          onRowClick={(row) => setSelectedMonth(row.month)}
          renderCard={renderCard}
        />
      )}
    </div>
  );
}

// ─── Détail d'un mois figé ───────────────────────────────────
function SnapshotDetail({ chantier, month, snapshot, users, onBack, onBackToChantier }) {
  const { pct, totalHours } = useMemo(() => summarizeSnapshot(snapshot), [snapshot]);
  const isPwa = useViewport() === "mobile";
  const buildingIds = Object.keys(snapshot || {});
  const [activeBuildingId, setActiveBuildingId] = useState(buildingIds[0]);
  const sb = snapshot[activeBuildingId];

  const firstSb = snapshot[buildingIds[0]];
  const frozenAt = firstSb?.frozenAt ? new Date(firstSb.frozenAt) : null;
  const frozenBy = firstSb?.frozenBy ? users.find(u => u.id === firstSb.frozenBy) : null;

  const categories = useMemo(() => categoriesFromSnapshot(sb), [sb]);

  const { buildingPct, buildingHours } = useMemo(() => {
    return {
      buildingPct: computeBuildingPct(categories, sb?.progress),
      buildingHours: totalHoursForBuilding(sb?.hoursSessions, sb?.hours),
    };
  }, [categories, sb]);
  const buildingColor = buildingPct === 100 ? EPJ.green : buildingPct >= 60 ? EPJ.blue : buildingPct >= 30 ? EPJ.orange : EPJ.gray500;

  return (
    <div style={{ paddingTop: space.md, paddingBottom: space.xl }}>
      <ModuleSubHeader
        moduleName="Historique"
        title={formatMonth(month)}
        subtitle="🔒 Situation figée"
        onBackToModuleHome={onBack}
      />
      <div style={{
        fontSize: fontSize.xs, color: EPJ.gray500, lineHeight: 1.4,
        marginTop: -space.sm, marginBottom: space.md,
      }}>
        {chantier.num} • {chantier.nom}
        {frozenAt && ` — Figé le ${frozenAt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}`}
        {frozenBy && ` par ${frozenBy.prenom} ${frozenBy.nom}`}
      </div>

      {/* Boutons export */}
      <div style={{ display: "flex", gap: space.xs + 2, marginBottom: space.md }}>
        <div style={{ flex: 1 }}>
          <Button variant="secondary" full
            onClick={() => exportSnapshotToPdf(chantier, month, snapshot)}
          >📄 Exporter PDF</Button>
        </div>
        <div style={{ flex: 1 }}>
          <Button variant="secondary" full
            onClick={async () => {
              try { await exportSnapshotToExcel(chantier, month, snapshot); }
              catch (err) { alert("Erreur export Excel : " + err.message); }
            }}
          >📊 Exporter Excel</Button>
        </div>
      </div>

      {/* Onglets bâtiments */}
      {buildingIds.length > 1 && (
        <div style={{ display: "flex", gap: space.xs, marginBottom: space.sm + 2, overflowX: "auto", paddingBottom: space.xs }}>
          {buildingIds.map(bId => (
            <TabChip key={bId} active={activeBuildingId === bId} onClick={() => setActiveBuildingId(bId)} isPwa={isPwa} flexNone>
              {snapshotUnitLabel(snapshot[bId], bId)}
            </TabChip>
          ))}
        </div>
      )}

      {/* Avancement global du bâtiment */}
      <div style={{ ...panelStyle, padding: space.lg, marginBottom: space.md }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: space.sm }}>
          <div style={microLabel}>
            Avancement{buildingIds.length > 1 ? ` — ${snapshotUnitLabel(snapshot[activeBuildingId], activeBuildingId)}` : ""}
          </div>
          <div style={{ fontSize: fontSize.xl, fontWeight: fontWeight.semibold, color: buildingColor, fontVariantNumeric: "tabular-nums" }}>
            {buildingPct}%
          </div>
        </div>
        <div style={{ height: 8, borderRadius: radius.pill, background: EPJ.gray100, overflow: "hidden" }}>
          <div style={{
            width: `${buildingPct}%`, height: "100%",
            background: buildingColor,
            transition: "width .4s ease",
          }}/>
        </div>
        {buildingHours > 0 && (
          <div style={{ marginTop: space.sm, fontSize: fontSize.xs, color: EPJ.gray500 }}>
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
    <div style={{ ...panelStyle, padding: 0, marginBottom: space.sm, overflow: "hidden" }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: `${space.md}px ${space.lg - 2}px`, cursor: "pointer",
          display: "flex", alignItems: "center", gap: space.sm + 2,
          borderLeft: `3px solid ${accent}`,
        }}
      >
        <div style={{
          fontSize: fontSize.xs, fontWeight: fontWeight.medium,
          background: `${accent}22`, color: accent,
          padding: `2px ${space.xs + 3}px`, borderRadius: radius.sm, fontFamily: font.mono,
        }}>{category.num}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900 }}>{category.label}</div>
          <div style={{ height: 4, marginTop: space.xs + 1, borderRadius: radius.pill, background: EPJ.gray100, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: accent, transition: "width .3s ease" }}/>
          </div>
        </div>
        <div style={{
          fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: accent,
          fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "right",
        }}>{pct}%</div>
        <span style={{ color: EPJ.gray500, fontSize: fontSize.xs, transform: expanded ? "rotate(90deg)" : "none", transition: "transform .2s" }}>▸</span>
      </div>

      {expanded && (
        <div style={{ padding: `${space.xs}px ${space.lg - 2}px ${space.lg - 2}px`, borderTop: `1px solid ${EPJ.gray100}` }}>
          {category.tasks.map(task => {
            const p = Number(progress?.[task.id] || 0);
            const h = totalHoursForTask(hoursSessions[task.id], legacyHours[task.id]);
            const taskColor = p === 100 ? EPJ.green : p > 0 ? EPJ.blue : EPJ.gray300;
            return (
              <div key={task.id} style={{
                padding: `${space.sm + 2}px 0`, borderTop: `1px solid ${EPJ.gray100}`,
                display: "flex", alignItems: "center", gap: space.sm + 2,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: fontSize.sm, color: EPJ.gray900, fontWeight: fontWeight.medium }}>{task.label}</div>
                  {h > 0 && (
                    <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginTop: 2 }}>
                      ⏱ <b style={{ color: EPJ.gray700, fontVariantNumeric: "tabular-nums" }}>{h.toFixed(1)}h</b>
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: taskColor,
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
  // Ordre connu en premier, puis toute catégorie inconnue (robustesse)
  const known = CAT_ORDER.filter(id => sb.categories[id]);
  const extra = Object.keys(sb.categories).filter(id => !CAT_ORDER.includes(id));
  return [...known, ...extra].map(id => {
    const data = sb.categories[id];
    if (!data) return null;
    const meta = FACTORY_META[id] || { num: 0, label: id.toUpperCase(), color: EPJ.dark };
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

// ─── Styles & helpers DS-2 ───────────────────────────────────
const panelStyle = {
  background: EPJ.white,
  border: `1px solid ${EPJ.gray200}`,
  borderRadius: radius.lg,
};
const microLabel = {
  fontSize: fontSize.xs, color: EPJ.gray500, fontWeight: fontWeight.medium,
  textTransform: "uppercase", letterSpacing: "0.03em",
};

function pctColor(pct) {
  return pct === 100 ? EPJ.green : pct >= 60 ? EPJ.blue : pct >= 30 ? EPJ.orange : EPJ.gray500;
}

function ProgressBarCell({ pct }) {
  const color = pctColor(pct);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: space.sm }}>
      <div style={{
        flex: 1, height: 6, borderRadius: radius.pill,
        background: EPJ.gray100, overflow: "hidden",
      }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, transition: "width .4s ease" }}/>
      </div>
      <span style={{
        fontSize: fontSize.sm, fontWeight: fontWeight.medium, color,
        fontVariantNumeric: "tabular-nums", minWidth: 38, textAlign: "right",
      }}>{pct}%</span>
    </div>
  );
}

// Onglet (Liste/Évolution, bâtiments) — actif = bleu EPJ (nav active DA)
function TabChip({ active, onClick, children, isPwa, flexNone }) {
  return (
    <button onClick={onClick} style={{
      flex: flexNone ? "0 0 auto" : 1,
      padding: `${space.sm}px ${space.lg - 2}px`,
      minHeight: isPwa ? 44 : 36,
      borderRadius: radius.md,
      border: `1px solid ${active ? EPJ.blue : EPJ.gray200}`,
      background: active ? EPJ.blue : EPJ.white,
      color: active ? EPJ.white : EPJ.gray700,
      fontSize: fontSize.sm, fontWeight: fontWeight.medium, cursor: "pointer",
      fontFamily: font.body, whiteSpace: "nowrap",
      transition: "background .15s ease, border-color .15s ease",
    }}>{children}</button>
  );
}

function formatMonth(ym) {
  const [y, m] = ym.split("-");
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

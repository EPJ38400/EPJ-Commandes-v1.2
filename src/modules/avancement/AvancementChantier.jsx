// ═══════════════════════════════════════════════════════════════
//  AvancementChantier v7
//  - Sessions d'heures cumulatives (avec historique visible)
//  - Bouton "📜 Historique" pour ouvrir la page AvancementHistory
//  - Gel mensuel + consultation lecture seule (inchangé)
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect, useRef } from "react";
import { db } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import { getRoles } from "../../core/permissions";
import {
  getCategoriesForConfig, categoryProgress, overallProgress,
  DEFAULT_BUILDING_CONFIG, generateTaskId, generateSessionId,
  totalHoursForTask, totalHoursForBuilding,
} from "./avancementTasks";
import { AvancementHistory } from "./AvancementHistory";

export function AvancementChantier({ chantier, onBack, canEdit, allUsers }) {
  const { user } = useAuth();
  const { tasksConfig } = useData();
  const toast = useToast();

  // Mode "historique figé" (ouvre AvancementHistory en plein écran)
  const [showHistory, setShowHistory] = useState(false);

  // Qui peut éditer les tâches ?
  const canEditTasks = useMemo(() => {
    if (!user) return false;
    const roles = getRoles(user);
    if (roles.includes("Admin") || roles.includes("Direction")) return true;
    if (roles.includes("Conducteur travaux") && chantier.conducteurId === user.id) return true;
    return false;
  }, [user, chantier.conducteurId]);

  const canFreezeMonth = useMemo(() => {
    if (!user) return false;
    const roles = getRoles(user);
    return roles.includes("Admin") || roles.includes("Direction") || roles.includes("Assistante");
  }, [user]);

  const [editTasksMode, setEditTasksMode] = useState(false);

  const currentMonth = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  // Bâtiments
  const buildings = useMemo(() => {
    if (chantier.buildings && chantier.buildings.length > 0) return chantier.buildings;
    return [{ id: "A", label: "", config: DEFAULT_BUILDING_CONFIG }];
  }, [chantier.buildings]);

  const [activeBuildingId, setActiveBuildingId] = useState(buildings[0].id);
  const [filterArtisanId, setFilterArtisanId] = useState("");
  const activeBuilding = buildings.find(b => b.id === activeBuildingId) || buildings[0];

  const categories = useMemo(
    () => getCategoriesForConfig(
      activeBuilding.config || DEFAULT_BUILDING_CONFIG,
      tasksConfig,
      chantier.avancementTasksOverride,
      activeBuilding.id
    ),
    [activeBuilding, tasksConfig, chantier.avancementTasksOverride]
  );

  // ─── Progression & sessions d'heures (toujours éditable, le mois courant) ───
  const [localProgress, setLocalProgress] = useState(
    () => chantier.avancementProgress?.[activeBuilding.id] || {}
  );
  const localSessions = chantier.avancementHoursSessions?.[activeBuilding.id] || {};
  const legacyHours = chantier.avancementHours?.[activeBuilding.id] || {};

  useEffect(() => {
    setLocalProgress(chantier.avancementProgress?.[activeBuilding.id] || {});
  }, [activeBuilding.id, chantier.avancementProgress]);

  // Sauvegarde différée pour progress
  const pendingSaveRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const saveProgress = (newProgress) => {
    setLocalProgress(newProgress);
    pendingSaveRef.current = newProgress;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const allProgress = {
          ...(chantier.avancementProgress || {}),
          [activeBuildingId]: pendingSaveRef.current,
        };
        await updateDoc(doc(db, "chantiers", chantier.num), { avancementProgress: allProgress });
      } catch (e) { toast("❌ " + e.message); }
    }, 600);
  };
  useEffect(() => () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
  }, []);

  // ─── Sessions d'heures : ajout / suppression ───────────────
  const addSession = async (taskId, hours, date) => {
    const hoursNum = parseFloat(String(hours).replace(",", "."));
    if (isNaN(hoursNum) || hoursNum <= 0) return;
    const session = {
      id: generateSessionId(),
      hours: hoursNum,
      date: date || new Date().toISOString().slice(0, 10),
      userId: user?.id || null,
    };
    try {
      const allSessions = { ...(chantier.avancementHoursSessions || {}) };
      const buildingSessions = { ...(allSessions[activeBuildingId] || {}) };
      const taskSessions = [...(buildingSessions[taskId] || []), session];
      buildingSessions[taskId] = taskSessions;
      allSessions[activeBuildingId] = buildingSessions;
      await updateDoc(doc(db, "chantiers", chantier.num), { avancementHoursSessions: allSessions });
      toast(`✓ +${hoursNum}h ajoutées`);
    } catch (e) { toast("❌ " + e.message); }
  };

  const deleteSession = async (taskId, sessionId) => {
    if (!confirm("Supprimer cette session d'heures ?")) return;
    try {
      const allSessions = { ...(chantier.avancementHoursSessions || {}) };
      const buildingSessions = { ...(allSessions[activeBuildingId] || {}) };
      const taskSessions = (buildingSessions[taskId] || []).filter(s => s.id !== sessionId);
      if (taskSessions.length === 0) delete buildingSessions[taskId];
      else buildingSessions[taskId] = taskSessions;
      allSessions[activeBuildingId] = buildingSessions;
      await updateDoc(doc(db, "chantiers", chantier.num), { avancementHoursSessions: allSessions });
      toast("🗑 Session supprimée");
    } catch (e) { toast("❌ " + e.message); }
  };

  // ─── Figer le mois courant (inclut désormais les sessions) ──
  const freezeMonth = async () => {
    const monthLabel = formatMonth(currentMonth);
    if (!confirm(`Figer la situation de ${monthLabel} pour ce chantier ?\n\nUn snapshot sera créé pour l'historique et la facturation.`)) return;
    try {
      const snapshot = {};
      for (const b of buildings) {
        const cats = getCategoriesForConfig(
          b.config || DEFAULT_BUILDING_CONFIG,
          tasksConfig, chantier.avancementTasksOverride, b.id
        );
        const catsMap = {};
        cats.forEach(c => { catsMap[c.id] = { tasks: c.tasks }; });

        snapshot[b.id] = {
          progress:       chantier.avancementProgress?.[b.id] || {},
          hoursSessions:  chantier.avancementHoursSessions?.[b.id] || {},
          hours:          chantier.avancementHours?.[b.id] || {}, // rétrocompat v6
          categories:     catsMap,
          config:         b.config || DEFAULT_BUILDING_CONFIG,
          frozenAt:       new Date().toISOString(),
          frozenBy:       user?.id || null,
        };
      }
      const newSnapshots = {
        ...(chantier.avancementSnapshots || {}),
        [currentMonth]: snapshot,
      };
      await updateDoc(doc(db, "chantiers", chantier.num), { avancementSnapshots: newSnapshots });
      toast(`🔒 Situation de ${monthLabel} figée`);
    } catch (e) { toast("❌ " + e.message); }
  };

  // ─── Édition des tâches (inchangé) ─────────────────────────
  const saveTasksOverride = async (newCategories) => {
    const override = { ...(chantier.avancementTasksOverride || {}) };
    const byBuilding = { ...(override[activeBuildingId] || {}) };
    const catsMap = { ...(byBuilding.categories || {}) };
    newCategories.forEach(cat => {
      if (cat.generated) return;
      catsMap[cat.id] = { tasks: cat.tasks };
    });
    byBuilding.categories = catsMap;
    override[activeBuildingId] = byBuilding;
    try {
      await updateDoc(doc(db, "chantiers", chantier.num), { avancementTasksOverride: override });
    } catch (e) { toast("❌ " + e.message); }
  };
  const addTask = async (categoryId, label) => {
    if (!label.trim()) return;
    const newCats = categories.map(cat =>
      cat.id !== categoryId ? cat :
      { ...cat, tasks: [...cat.tasks, { id: generateTaskId(categoryId), label: label.trim() }] }
    );
    await saveTasksOverride(newCats);
    toast("✓ Tâche ajoutée");
  };
  const updateTaskLabel = async (categoryId, taskId, newLabel) => {
    if (!newLabel.trim()) return;
    const newCats = categories.map(cat =>
      cat.id !== categoryId ? cat :
      { ...cat, tasks: cat.tasks.map(t => t.id === taskId ? { ...t, label: newLabel.trim() } : t) }
    );
    await saveTasksOverride(newCats);
  };
  const deleteTask = async (categoryId, taskId) => {
    if (!confirm("Supprimer cette tâche ? Son avancement et ses heures seront perdus.")) return;
    const newCats = categories.map(cat =>
      cat.id !== categoryId ? cat :
      { ...cat, tasks: cat.tasks.filter(t => t.id !== taskId) }
    );
    await saveTasksOverride(newCats);
    const nextProgress = { ...localProgress };
    delete nextProgress[taskId];
    saveProgress(nextProgress);
    toast("🗑 Tâche supprimée");
  };
  const moveTask = async (categoryId, taskId, direction) => {
    const newCats = categories.map(cat => {
      if (cat.id !== categoryId) return cat;
      const tasks = [...cat.tasks];
      const idx = tasks.findIndex(t => t.id === taskId);
      if (idx === -1) return cat;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= tasks.length) return cat;
      [tasks[idx], tasks[newIdx]] = [tasks[newIdx], tasks[idx]];
      return { ...cat, tasks };
    });
    await saveTasksOverride(newCats);
  };

  // Artisans
  const artisanAssignments = chantier.avancementArtisans || {};
  const affectedArtisans = useMemo(() => {
    const ids = chantier.artisanIds || [];
    return ids.map(id => allUsers.find(u => u.id === id)).filter(Boolean);
  }, [chantier.artisanIds, allUsers]);
  const visibleTaskIds = useMemo(() => {
    if (!filterArtisanId) return null;
    const keys = Object.keys(artisanAssignments);
    return new Set(keys.filter(k => artisanAssignments[k] === filterArtisanId));
  }, [filterArtisanId, artisanAssignments]);
  const setArtisanForTask = async (taskId, artisanId) => {
    try {
      const next = { ...(chantier.avancementArtisans || {}) };
      if (artisanId) next[taskId] = artisanId;
      else delete next[taskId];
      await updateDoc(doc(db, "chantiers", chantier.num), { avancementArtisans: next });
    } catch (e) { toast("❌ " + e.message); }
  };

  const globalPct = overallProgress(
    activeBuilding.config || DEFAULT_BUILDING_CONFIG, localProgress,
    tasksConfig, chantier.avancementTasksOverride, activeBuilding.id,
  );
  const barColor = globalPct === 100 ? EPJ.green : globalPct >= 60 ? EPJ.blue : globalPct >= 30 ? EPJ.orange : EPJ.gray500;

  const totalHours = useMemo(
    () => totalHoursForBuilding(localSessions, legacyHours),
    [localSessions, legacyHours]
  );

  const snapshotsCount = Object.keys(chantier.avancementSnapshots || {}).length;
  const currentMonthFrozen = !!chantier.avancementSnapshots?.[currentMonth];

  // Ouvre AvancementHistory
  if (showHistory) {
    return (
      <AvancementHistory
        chantier={chantier}
        onBack={() => setShowHistory(false)}
      />
    );
  }

  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      {/* En-tête */}
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
          }}>{chantier.nom}</div>
          <div style={{
            fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3,
            textTransform: "uppercase", fontWeight: 600, marginTop: 1,
          }}>
            {chantier.num}{chantier.adresse ? ` • ${chantier.adresse}` : ""}
          </div>
        </div>
        {canEditTasks && (
          <button
            onClick={() => setEditTasksMode(!editTasksMode)}
            style={{
              background: editTasksMode ? EPJ.orange : EPJ.gray100,
              border: "none", borderRadius: 8, padding: "8px 12px",
              fontSize: 12, fontWeight: 600,
              color: editTasksMode ? "#fff" : EPJ.gray700,
              cursor: "pointer", fontFamily: font.body, whiteSpace: "nowrap",
            }}
          >{editTasksMode ? "✓ Terminé" : "✏ Tâches"}</button>
        )}
      </div>

      {/* Actions : Historique + Figer */}
      <div className="epj-card" style={{ padding: "10px 12px", marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 10, color: EPJ.gray500, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
          {formatMonth(currentMonth)} <span style={{ color: EPJ.gray400, textTransform: "none" }}>(en cours)</span>
        </div>
        <div style={{ flex: 1 }}/>
        <button
          onClick={() => setShowHistory(true)}
          style={{
            background: EPJ.gray100, color: EPJ.gray700, border: "none",
            borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600,
            cursor: "pointer", fontFamily: font.body, whiteSpace: "nowrap",
            display: "flex", alignItems: "center", gap: 4,
          }}
          title="Historique figé du chantier"
        >
          📜 Historique
          {snapshotsCount > 0 && (
            <span style={{
              background: EPJ.orange, color: "#fff",
              fontSize: 10, fontWeight: 700, padding: "1px 5px",
              borderRadius: 10, marginLeft: 2,
            }}>{snapshotsCount}</span>
          )}
        </button>
        {canFreezeMonth && !currentMonthFrozen && (
          <button
            onClick={freezeMonth}
            style={{
              background: EPJ.gray900, color: "#fff", border: "none",
              borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 600,
              cursor: "pointer", fontFamily: font.body, whiteSpace: "nowrap",
            }}
          >🔒 Figer</button>
        )}
        {canFreezeMonth && currentMonthFrozen && (
          <div style={{
            padding: "7px 10px", fontSize: 11, fontWeight: 600,
            color: EPJ.green, background: `${EPJ.green}12`,
            border: `1px solid ${EPJ.green}44`, borderRadius: 8, whiteSpace: "nowrap",
          }}>🔒 Mois figé</div>
        )}
      </div>

      {/* Bandeau mode édition */}
      {editTasksMode && (
        <div className="epj-card" style={{
          padding: "10px 12px", marginBottom: 10,
          fontSize: 11, color: EPJ.gray700, lineHeight: 1.5,
          background: `${EPJ.orange}10`, borderColor: `${EPJ.orange}44`,
        }}>
          <strong style={{ color: EPJ.orange }}>Mode édition</strong> — ajouter, modifier, supprimer ou réordonner les tâches. Béton et Placo sont générés automatiquement.
        </div>
      )}

      {/* Avancement global */}
      <div className="epj-card" style={{ padding: "14px 16px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: EPJ.gray500, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
            Avancement global{buildings.length > 1 ? ` — ${activeBuildingLabel(activeBuilding)}` : ""}
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: barColor, fontVariantNumeric: "tabular-nums" }}>{globalPct}%</div>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: EPJ.gray100, overflow: "hidden" }}>
          <div style={{
            width: `${globalPct}%`, height: "100%",
            background: `linear-gradient(90deg, ${barColor}, ${barColor}DD)`,
            transition: "width .4s ease",
          }}/>
        </div>
        {totalHours > 0 && (
          <div style={{
            marginTop: 8, fontSize: 11, color: EPJ.gray500,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            ⏱ <b style={{ color: EPJ.gray700, fontVariantNumeric: "tabular-nums" }}>{totalHours.toFixed(1)} h</b> cumulées sur ce bâtiment
          </div>
        )}
      </div>

      {/* Onglets bâtiments */}
      {buildings.length > 1 && (
        <div style={{ display: "flex", gap: 4, marginBottom: 10, overflowX: "auto", paddingBottom: 4 }}>
          {buildings.map(b => (
            <button key={b.id} onClick={() => setActiveBuildingId(b.id)} style={{
              padding: "8px 14px", borderRadius: 8,
              border: `1px solid ${activeBuildingId === b.id ? EPJ.gray900 : EPJ.gray200}`,
              background: activeBuildingId === b.id ? EPJ.gray900 : EPJ.white,
              color: activeBuildingId === b.id ? "#fff" : EPJ.gray700,
              fontSize: 12, fontWeight: 600, cursor: "pointer",
              fontFamily: font.body, whiteSpace: "nowrap", flexShrink: 0,
            }}>
              {activeBuildingLabel(b)}
            </button>
          ))}
        </div>
      )}

      {/* Filtre artisan */}
      {!editTasksMode && affectedArtisans.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <label style={{
            display: "block", fontSize: 10, fontWeight: 600, color: EPJ.gray500,
            letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4,
          }}>Affichage</label>
          <select className="epj-input" value={filterArtisanId} onChange={e => setFilterArtisanId(e.target.value)} style={{ fontSize: 13 }}>
            <option value="">Toutes les tâches</option>
            {affectedArtisans.map(a => (
              <option key={a.id} value={a.id}>Tâches de {a.prenom} {a.nom}</option>
            ))}
          </select>
        </div>
      )}

      {/* Catégories */}
      {categories.map(cat => (
        <CategoryBlock
          key={cat.id}
          category={cat}
          progress={localProgress}
          sessionsMap={localSessions}
          legacyHoursMap={legacyHours}
          onProgressChange={(taskId, val) => saveProgress({ ...localProgress, [taskId]: val })}
          onAddSession={addSession}
          onDeleteSession={deleteSession}
          canEdit={canEdit}
          currentUserId={user?.id}
          isUserAdmin={getRoles(user).includes("Admin") || getRoles(user).includes("Direction")}
          allUsers={allUsers}
          editTasksMode={editTasksMode}
          onAddTask={(label) => addTask(cat.id, label)}
          onUpdateTaskLabel={(taskId, label) => updateTaskLabel(cat.id, taskId, label)}
          onDeleteTask={(taskId) => deleteTask(cat.id, taskId)}
          onMoveTask={(taskId, dir) => moveTask(cat.id, taskId, dir)}
          affectedArtisans={affectedArtisans}
          artisanAssignments={artisanAssignments}
          onAssignArtisan={setArtisanForTask}
          visibleTaskIds={visibleTaskIds}
        />
      ))}

      {visibleTaskIds && visibleTaskIds.size === 0 && (
        <div className="epj-card" style={{ padding: 16, textAlign: "center", fontSize: 12, color: EPJ.gray500 }}>
          Aucune tâche n'est assignée à cet artisan pour ce bâtiment.
        </div>
      )}
    </div>
  );
}

// ─── Bloc d'une catégorie ────────────────────────────────────────
function CategoryBlock({
  category, progress, sessionsMap, legacyHoursMap,
  onProgressChange, onAddSession, onDeleteSession,
  canEdit, currentUserId, isUserAdmin, allUsers,
  editTasksMode, onAddTask, onUpdateTaskLabel, onDeleteTask, onMoveTask,
  affectedArtisans, artisanAssignments, onAssignArtisan, visibleTaskIds,
}) {
  const [expanded, setExpanded] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  const filteredTasks = visibleTaskIds
    ? category.tasks.filter(t => visibleTaskIds.has(t.id))
    : category.tasks;

  if (!editTasksMode && visibleTaskIds && filteredTasks.length === 0) return null;

  const pct = categoryProgress(category, progress);
  const accent = category.color;
  const isGenerated = !!category.generated;

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
          <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900 }}>
            {category.label}
            {editTasksMode && isGenerated && (
              <span style={{ fontSize: 9, fontWeight: 500, color: EPJ.gray500, marginLeft: 6, fontStyle: "italic" }}>
                (généré)
              </span>
            )}
          </div>
          <div style={{ height: 4, marginTop: 5, borderRadius: 2, background: EPJ.gray100, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: accent, transition: "width .3s ease" }}/>
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: accent, fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "right" }}>{pct}%</div>
        <span style={{ color: EPJ.gray500, fontSize: 12, transform: expanded ? "rotate(90deg)" : "none", transition: "transform .2s", marginLeft: 2 }}>▸</span>
      </div>

      {expanded && (
        <div style={{ padding: "4px 14px 14px", borderTop: `1px solid ${EPJ.gray100}` }}>
          {filteredTasks.map((task, idx) => editTasksMode && !isGenerated ? (
            <EditableTaskRow
              key={task.id} task={task}
              isFirst={idx === 0} isLast={idx === filteredTasks.length - 1}
              onUpdateLabel={(lbl) => onUpdateTaskLabel(task.id, lbl)}
              onDelete={() => onDeleteTask(task.id)}
              onMove={(dir) => onMoveTask(task.id, dir)}
            />
          ) : (
            <TaskRow
              key={task.id} task={task}
              value={Number(progress?.[task.id] || 0)}
              sessions={sessionsMap?.[task.id]}
              legacyHoursValue={legacyHoursMap?.[task.id]}
              onChange={(v) => onProgressChange(task.id, v)}
              onAddSession={(hours, date) => onAddSession(task.id, hours, date)}
              onDeleteSession={(sid) => onDeleteSession(task.id, sid)}
              canEdit={canEdit}
              currentUserId={currentUserId}
              isUserAdmin={isUserAdmin}
              allUsers={allUsers}
              affectedArtisans={affectedArtisans}
              assignedArtisanId={artisanAssignments[task.id]}
              onAssignArtisan={(aid) => onAssignArtisan(task.id, aid)}
            />
          ))}

          {editTasksMode && !isGenerated && (
            <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
              <input
                className="epj-input"
                value={newLabel}
                onChange={e => setNewLabel(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && newLabel.trim()) {
                    onAddTask(newLabel); setNewLabel("");
                  }
                }}
                placeholder="Nouvelle tâche…"
                style={{ fontSize: 13 }}
              />
              <button
                onClick={() => { if (newLabel.trim()) { onAddTask(newLabel); setNewLabel(""); } }}
                disabled={!newLabel.trim()}
                style={{
                  background: EPJ.gray900, color: "#fff", border: "none",
                  borderRadius: 8, padding: "0 14px", fontSize: 13, fontWeight: 600,
                  cursor: newLabel.trim() ? "pointer" : "not-allowed",
                  opacity: newLabel.trim() ? 1 : 0.45, fontFamily: font.body,
                }}
              >+</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ligne de tâche avec sessions d'heures ──────────────────
function TaskRow({
  task, value, sessions, legacyHoursValue, onChange,
  onAddSession, onDeleteSession,
  canEdit, currentUserId, isUserAdmin, allUsers,
  affectedArtisans, assignedArtisanId, onAssignArtisan,
}) {
  const [showArtisanPicker, setShowArtisanPicker] = useState(false);
  const [showHours, setShowHours] = useState(false);

  const assignedArtisan = affectedArtisans.find(a => a.id === assignedArtisanId);
  const pctColor = value === 100 ? EPJ.green : value > 0 ? EPJ.blue : EPJ.gray300;
  const totalHours = totalHoursForTask(sessions, legacyHoursValue);

  return (
    <div style={{ padding: "10px 0", borderTop: `1px solid ${EPJ.gray100}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: EPJ.gray900, fontWeight: 500 }}>{task.label}</div>
          {assignedArtisan && (
            <div style={{ fontSize: 10, color: EPJ.orange, marginTop: 2, fontWeight: 600 }}>
              👤 {assignedArtisan.prenom} {assignedArtisan.nom}
            </div>
          )}
          {totalHours > 0 && !showHours && (
            <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 2 }}>
              ⏱ <b style={{ color: EPJ.gray700, fontVariantNumeric: "tabular-nums" }}>{totalHours.toFixed(1)}h</b>
              {sessions && sessions.length > 1 && (
                <span style={{ marginLeft: 4, color: EPJ.gray400 }}>
                  ({sessions.length} sessions)
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: pctColor, fontVariantNumeric: "tabular-nums", minWidth: 40, textAlign: "right" }}>{value}%</div>
        {canEdit && (
          <button
            onClick={() => setShowHours(!showHours)}
            style={{
              background: totalHours > 0 ? `${EPJ.blue}15` : EPJ.gray100,
              border: "none", borderRadius: 6, padding: "4px 7px", fontSize: 11,
              cursor: "pointer", fontFamily: font.body,
              color: totalHours > 0 ? EPJ.blue : EPJ.gray500,
            }}
            title="Heures travaillées"
          >⏱</button>
        )}
        {canEdit && affectedArtisans.length > 0 && (
          <button onClick={() => setShowArtisanPicker(!showArtisanPicker)} style={{
            background: assignedArtisanId ? `${EPJ.orange}15` : EPJ.gray100,
            border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11,
            cursor: "pointer", fontFamily: font.body,
            color: assignedArtisanId ? EPJ.orange : EPJ.gray500,
          }} title="Assigner à un artisan">👤</button>
        )}
      </div>

      {/* Curseur % */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="range" min="0" max="100" step="5" value={value}
          onChange={e => onChange(Number(e.target.value))} disabled={!canEdit}
          style={{ flex: 1, accentColor: pctColor, cursor: canEdit ? "pointer" : "not-allowed" }}/>
        <div style={{ display: "flex", gap: 3 }}>
          {[0, 50, 100].map(v => (
            <button key={v} onClick={() => canEdit && onChange(v)} disabled={!canEdit} style={{
              minWidth: 30, padding: "3px 6px", fontSize: 10, fontWeight: 600,
              border: `1px solid ${value === v ? pctColor : EPJ.gray200}`,
              background: value === v ? `${pctColor}15` : EPJ.white,
              color: value === v ? pctColor : EPJ.gray500,
              borderRadius: 4, cursor: canEdit ? "pointer" : "not-allowed", fontFamily: font.body,
            }}>{v}</button>
          ))}
        </div>
      </div>

      {/* Panel heures (sessions) */}
      {showHours && canEdit && (
        <HoursPanel
          sessions={sessions}
          legacyHoursValue={legacyHoursValue}
          onAddSession={onAddSession}
          onDeleteSession={onDeleteSession}
          currentUserId={currentUserId}
          isUserAdmin={isUserAdmin}
          allUsers={allUsers}
        />
      )}

      {/* Picker artisan */}
      {showArtisanPicker && (
        <div style={{
          marginTop: 8, padding: "8px 10px",
          background: EPJ.gray50, borderRadius: 8,
          border: `1px solid ${EPJ.gray200}`,
        }}>
          <div style={{ fontSize: 10, color: EPJ.gray500, marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3 }}>Assigner à :</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <button onClick={() => { onAssignArtisan(null); setShowArtisanPicker(false); }} style={pillStyle(!assignedArtisanId, EPJ.gray700)}>— Aucun —</button>
            {affectedArtisans.map(a => (
              <button key={a.id} onClick={() => { onAssignArtisan(a.id); setShowArtisanPicker(false); }} style={pillStyle(assignedArtisanId === a.id, EPJ.orange)}>
                {a.prenom} {a.nom}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Panel des sessions d'heures ─────────────────────────────
function HoursPanel({ sessions, legacyHoursValue, onAddSession, onDeleteSession, currentUserId, isUserAdmin, allUsers }) {
  const [hoursInput, setHoursInput] = useState("");
  const [dateInput, setDateInput] = useState(new Date().toISOString().slice(0, 10));

  const sessionsList = Array.isArray(sessions) ? sessions : [];
  const hasLegacy = !sessionsList.length && Number(legacyHoursValue) > 0;

  // Tri : plus récent en premier
  const sortedSessions = useMemo(
    () => [...sessionsList].sort((a, b) => (b.date || "").localeCompare(a.date || "")),
    [sessionsList]
  );
  const total = sessionsList.reduce((s, e) => s + (Number(e.hours) || 0), 0);

  const submitAdd = () => {
    const h = parseFloat(hoursInput.replace(",", "."));
    if (isNaN(h) || h <= 0) return;
    onAddSession(hoursInput, dateInput);
    setHoursInput("");
    setDateInput(new Date().toISOString().slice(0, 10));
  };

  return (
    <div style={{
      marginTop: 8, padding: "10px 12px",
      background: EPJ.gray50, borderRadius: 8,
      border: `1px solid ${EPJ.gray200}`,
    }}>
      <div style={{
        fontSize: 10, color: EPJ.gray500, marginBottom: 8,
        fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.3,
        display: "flex", justifyContent: "space-between",
      }}>
        <span>Heures travaillées</span>
        {(total > 0 || hasLegacy) && (
          <span style={{ color: EPJ.gray700, fontVariantNumeric: "tabular-nums" }}>
            Total : {hasLegacy ? Number(legacyHoursValue).toFixed(1) : total.toFixed(1)}h
          </span>
        )}
      </div>

      {/* Liste des sessions */}
      {sortedSessions.length > 0 && (
        <div style={{ marginBottom: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          {sortedSessions.map(s => {
            const author = s.userId ? allUsers.find(u => u.id === s.userId) : null;
            const canDelete = isUserAdmin || s.userId === currentUserId;
            return (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "6px 8px", background: EPJ.white, borderRadius: 6,
                border: `1px solid ${EPJ.gray200}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                    <span style={{
                      fontSize: 13, fontWeight: 700, color: EPJ.blue,
                      fontVariantNumeric: "tabular-nums",
                    }}>+{Number(s.hours).toFixed(1)}h</span>
                    <span style={{ fontSize: 10, color: EPJ.gray500 }}>
                      {formatShortDate(s.date)}
                    </span>
                  </div>
                  {author && (
                    <div style={{ fontSize: 9, color: EPJ.gray500, marginTop: 1 }}>
                      {author.prenom} {author.nom}
                    </div>
                  )}
                </div>
                {canDelete && (
                  <button
                    onClick={() => onDeleteSession(s.id)}
                    style={{
                      background: `${EPJ.red}10`, color: EPJ.red,
                      border: `1px solid ${EPJ.red}33`, borderRadius: 4,
                      padding: "2px 6px", fontSize: 10, fontWeight: 600,
                      cursor: "pointer", fontFamily: font.body,
                    }}
                    title="Supprimer cette session"
                  >✕</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {hasLegacy && sortedSessions.length === 0 && (
        <div style={{
          fontSize: 10, color: EPJ.gray500, fontStyle: "italic",
          padding: "6px 0", marginBottom: 6,
        }}>
          {Number(legacyHoursValue).toFixed(1)}h héritées de l'ancienne version (pas de détail par session)
        </div>
      )}

      {/* Formulaire d'ajout */}
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <input
          type="number" step="0.5" min="0"
          value={hoursInput}
          onChange={e => setHoursInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submitAdd()}
          placeholder="Heures"
          style={{
            width: 72, padding: "8px 10px",
            border: `1px solid ${EPJ.gray200}`, borderRadius: 6,
            fontSize: 13, fontWeight: 600,
            fontFamily: font.body, fontVariantNumeric: "tabular-nums",
            background: EPJ.white, color: EPJ.gray900,
          }}
        />
        <input
          type="date"
          value={dateInput}
          onChange={e => setDateInput(e.target.value)}
          style={{
            flex: 1, minWidth: 0, padding: "8px 10px",
            border: `1px solid ${EPJ.gray200}`, borderRadius: 6,
            fontSize: 12, fontWeight: 500,
            fontFamily: font.body,
            background: EPJ.white, color: EPJ.gray900,
          }}
        />
        <button
          onClick={submitAdd}
          disabled={!hoursInput}
          style={{
            background: EPJ.blue, color: "#fff", border: "none",
            borderRadius: 6, padding: "8px 12px", fontSize: 12, fontWeight: 700,
            cursor: hoursInput ? "pointer" : "not-allowed",
            opacity: hoursInput ? 1 : 0.45, fontFamily: font.body,
            whiteSpace: "nowrap",
          }}
        >+ Ajouter</button>
      </div>
    </div>
  );
}

function EditableTaskRow({ task, isFirst, isLast, onUpdateLabel, onDelete, onMove }) {
  const [label, setLabel] = useState(task.label);
  useEffect(() => { setLabel(task.label); }, [task.label]);
  return (
    <div style={{ padding: "8px 0", borderTop: `1px solid ${EPJ.gray100}`, display: "flex", alignItems: "center", gap: 6 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button onClick={() => onMove("up")} disabled={isFirst} style={arrowStyle(isFirst)}>▲</button>
        <button onClick={() => onMove("down")} disabled={isLast} style={arrowStyle(isLast)}>▼</button>
      </div>
      <input
        className="epj-input"
        value={label}
        onChange={e => setLabel(e.target.value)}
        onBlur={() => { if (label.trim() && label !== task.label) onUpdateLabel(label); else setLabel(task.label); }}
        style={{ flex: 1, fontSize: 12 }}
      />
      <button onClick={onDelete} style={{
        background: `${EPJ.red}10`, color: EPJ.red,
        border: `1px solid ${EPJ.red}33`, borderRadius: 6,
        padding: "6px 10px", fontSize: 11, fontWeight: 600,
        cursor: "pointer", fontFamily: font.body,
      }}>🗑</button>
    </div>
  );
}

function arrowStyle(disabled) {
  return {
    width: 24, height: 18, padding: 0, border: "none",
    background: EPJ.gray100, color: disabled ? EPJ.gray300 : EPJ.gray700,
    borderRadius: 3, fontSize: 8, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "monospace",
  };
}
function pillStyle(active, color) {
  return {
    padding: "4px 10px", borderRadius: 999,
    border: `1px solid ${active ? color : EPJ.gray200}`,
    background: active ? `${color}15` : EPJ.white,
    color: active ? color : EPJ.gray700,
    fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font.body,
  };
}

function activeBuildingLabel(building) {
  if (building.label) return `Bât. ${building.id} — ${building.label}`;
  return `Bâtiment ${building.id}`;
}
function formatMonth(ym) {
  const [y, m] = ym.split("-");
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  return `${months[parseInt(m) - 1]} ${y}`;
}
function formatShortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

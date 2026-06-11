// ═══════════════════════════════════════════════════════════════
//  AvancementChantier
//  - Sessions d'heures cumulatives (avec historique visible)
//  - Bouton "📜 Historique" pour ouvrir la page AvancementHistory
//  - Gel mensuel + consultation lecture seule (inchangé)
//
//  DS-2 : repeinte design-system + desktop (conforme
//  docs/DIRECTION_ARTISTIQUE.md). Affichage uniquement — saisie terrain
//  (slider + 0/50/100 + heures), écritures Firestore et calculs INCHANGÉS.
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect, useRef } from "react";
import { db } from "../../firebase";
import { doc, updateDoc, setDoc, deleteDoc } from "firebase/firestore";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useViewport } from "../../core/useViewport";
import { useToast } from "../../core/components/Toast";
import { getRoles } from "../../core/permissions";
import { ModuleSubHeader } from "../../core/components/ModuleSubHeader";
import { Banner } from "../../core/components/Banner";
import { Badge } from "../../core/components/Badge";
import { Button } from "../../core/components/Button";
import { Field } from "../../core/components/Field";
import {
  getCategoriesForConfig, getCategoriesForSousSol, categoryProgress,
  overallProgress, overallProgressSousSol,
  DEFAULT_BUILDING_CONFIG, generateTaskId, generateSessionId,
  totalHoursForTask, totalHoursForBuilding,
  resolveBuildings, getChantierSousSols, getBuildingLetter, getBuildingSousSolId,
} from "./avancementTasks";
import {
  currentMonthKey, currentMonthLabel, getValidation,
} from "../../core/notificationsUtils";
import { AvancementHistory } from "./AvancementHistory";

export function AvancementChantier({ chantier, onBack, canEdit, allUsers }) {
  const { user } = useAuth();
  const { tasksConfig, avancementValidations } = useData();
  const isPwa = useViewport() === "mobile";
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

  // Bâtiments + sous-sols communs = "unités" de suivi
  const buildings = useMemo(() => resolveBuildings(chantier), [chantier.buildings]);
  const sousSols = useMemo(() => getChantierSousSols(chantier), [chantier.sousSolsCommuns]);

  const units = useMemo(() => ([
    ...buildings.map(b => ({
      kind: "batiment",
      id: b.id,
      tabLabel: `Bât. ${getBuildingLetter(b)}`,
      headerLabel: `Bât. ${getBuildingLetter(b)}${b.label ? ` — ${b.label}` : ""}`,
      config: b.config || DEFAULT_BUILDING_CONFIG,
      building: b,
    })),
    ...sousSols.map(ss => ({
      kind: "soussol",
      id: ss.id,
      tabLabel: `🅿 ${ss.nom || "Sous-sol"}`,
      headerLabel: `Sous-sol commun — ${ss.nom || "Sous-sol"}`,
      config: { nbNiveaux: ss.nbNiveaux ?? 1 },
      ss,
    })),
  ]), [buildings, sousSols]);

  const [activeUnitId, setActiveUnitId] = useState(units[0]?.id);
  const [filterArtisanId, setFilterArtisanId] = useState("");
  const activeUnit = units.find(u => u.id === activeUnitId) || units[0];

  // Si l'unité active disparaît (ex. sous-sol supprimé), retombe sur la première
  useEffect(() => {
    if (!units.some(u => u.id === activeUnitId)) setActiveUnitId(units[0]?.id);
  }, [units, activeUnitId]);

  const categories = useMemo(
    () => activeUnit.kind === "soussol"
      ? getCategoriesForSousSol(activeUnit.config, tasksConfig, chantier.avancementTasksOverride, activeUnit.id)
      : getCategoriesForConfig(activeUnit.config || DEFAULT_BUILDING_CONFIG, tasksConfig, chantier.avancementTasksOverride, activeUnit.id),
    [activeUnit, tasksConfig, chantier.avancementTasksOverride]
  );

  // ─── Progression & sessions d'heures (toujours éditable, le mois courant) ───
  const [localProgress, setLocalProgress] = useState(
    () => chantier.avancementProgress?.[activeUnit.id] || {}
  );
  const localSessions = chantier.avancementHoursSessions?.[activeUnit.id] || {};
  const legacyHours = chantier.avancementHours?.[activeUnit.id] || {};

  useEffect(() => {
    setLocalProgress(chantier.avancementProgress?.[activeUnit.id] || {});
  }, [activeUnit.id, chantier.avancementProgress]);

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
          [activeUnit.id]: pendingSaveRef.current,
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
      const buildingSessions = { ...(allSessions[activeUnit.id] || {}) };
      const taskSessions = [...(buildingSessions[taskId] || []), session];
      buildingSessions[taskId] = taskSessions;
      allSessions[activeUnit.id] = buildingSessions;
      await updateDoc(doc(db, "chantiers", chantier.num), { avancementHoursSessions: allSessions });
      toast(`✓ +${hoursNum}h ajoutées`);
    } catch (e) { toast("❌ " + e.message); }
  };

  const deleteSession = async (taskId, sessionId) => {
    if (!confirm("Supprimer cette session d'heures ?")) return;
    try {
      const allSessions = { ...(chantier.avancementHoursSessions || {}) };
      const buildingSessions = { ...(allSessions[activeUnit.id] || {}) };
      const taskSessions = (buildingSessions[taskId] || []).filter(s => s.id !== sessionId);
      if (taskSessions.length === 0) delete buildingSessions[taskId];
      else buildingSessions[taskId] = taskSessions;
      allSessions[activeUnit.id] = buildingSessions;
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
      // Fige chaque unité : bâtiments + sous-sols communs
      for (const u of units) {
        const cats = u.kind === "soussol"
          ? getCategoriesForSousSol(u.config, tasksConfig, chantier.avancementTasksOverride, u.id)
          : getCategoriesForConfig(u.config || DEFAULT_BUILDING_CONFIG, tasksConfig, chantier.avancementTasksOverride, u.id);
        const catsMap = {};
        cats.forEach(c => { catsMap[c.id] = { tasks: c.tasks }; });

        snapshot[u.id] = {
          progress:       chantier.avancementProgress?.[u.id] || {},
          hoursSessions:  chantier.avancementHoursSessions?.[u.id] || {},
          hours:          chantier.avancementHours?.[u.id] || {}, // rétrocompat v6
          categories:     catsMap,
          config:         u.config || DEFAULT_BUILDING_CONFIG,
          // Étiquetage autonome (résiste au renommage / suppression ultérieurs)
          kind:           u.kind,
          unitLabel:      u.headerLabel,
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
    const byBuilding = { ...(override[activeUnit.id] || {}) };
    const catsMap = { ...(byBuilding.categories || {}) };
    newCategories.forEach(cat => {
      if (cat.generated) return;
      catsMap[cat.id] = { tasks: cat.tasks };
    });
    byBuilding.categories = catsMap;
    override[activeUnit.id] = byBuilding;
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

  const globalPct = activeUnit.kind === "soussol"
    ? overallProgressSousSol(activeUnit.config, localProgress, tasksConfig, chantier.avancementTasksOverride, activeUnit.id)
    : overallProgress(activeUnit.config || DEFAULT_BUILDING_CONFIG, localProgress, tasksConfig, chantier.avancementTasksOverride, activeUnit.id);
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
    <div style={{ paddingTop: space.md, paddingBottom: space.xl }}>
      {/* En-tête */}
      <ModuleSubHeader
        moduleName="Avancement"
        title={chantier.nom}
        subtitle={`${chantier.num}${chantier.adresse ? ` • ${chantier.adresse}` : ""}`}
        onBackToModuleHome={onBack}
        rightSlot={canEditTasks ? (
          <Button
            variant={editTasksMode ? "primary" : "secondary"}
            onClick={() => setEditTasksMode(!editTasksMode)}
          >{editTasksMode ? "✓ Terminé" : "✏ Tâches"}</Button>
        ) : null}
      />

      {/* Actions : Historique + Figer */}
      <div style={{
        ...panelStyle,
        padding: `${space.sm + 2}px ${space.md}px`,
        marginBottom: space.sm + 2,
        display: "flex", alignItems: "center", gap: space.sm, flexWrap: "wrap",
      }}>
        <div style={microLabel}>
          {formatMonth(currentMonth)} <span style={{ color: EPJ.gray400, textTransform: "none" }}>(en cours)</span>
        </div>
        <div style={{ flex: 1 }}/>
        <Button variant="secondary" onClick={() => setShowHistory(true)} title="Historique figé du chantier">
          📜 Historique
          {snapshotsCount > 0 && (
            <span style={{
              background: EPJ.blue, color: EPJ.white,
              fontSize: fontSize.xs, fontWeight: fontWeight.medium,
              padding: `0 ${space.xs + 2}px`, borderRadius: radius.pill,
              fontVariantNumeric: "tabular-nums", lineHeight: 1.5,
            }}>{snapshotsCount}</span>
          )}
        </Button>
        {canFreezeMonth && !currentMonthFrozen && (
          <Button variant="secondary" onClick={freezeMonth}>🔒 Figer</Button>
        )}
        {canFreezeMonth && currentMonthFrozen && (
          <Badge tone="success" icon="🔒" label="Mois figé" />
        )}
      </div>

      {/* Bandeau mode édition */}
      {editTasksMode && (
        <Banner
          tone="warning"
          icon="✏"
          title="Mode édition"
          text="Ajouter, modifier, supprimer ou réordonner les tâches. Béton et Placo sont générés automatiquement."
        />
      )}

      {/* Avancement global */}
      <div style={{ ...panelStyle, padding: space.lg, marginBottom: space.md }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: space.sm }}>
          <div style={microLabel}>
            Avancement global{units.length > 1 ? ` — ${activeUnit.headerLabel}` : ""}
          </div>
          <div style={{
            fontSize: fontSize.xl, fontWeight: fontWeight.semibold,
            color: barColor, fontVariantNumeric: "tabular-nums",
          }}>{globalPct}%</div>
        </div>
        <div style={{ height: 8, borderRadius: radius.pill, background: EPJ.gray100, overflow: "hidden" }}>
          <div style={{
            width: `${globalPct}%`, height: "100%",
            background: barColor,
            transition: "width .4s ease",
          }}/>
        </div>
        {totalHours > 0 && (
          <div style={{
            marginTop: space.sm, fontSize: fontSize.xs, color: EPJ.gray500,
            display: "flex", alignItems: "center", gap: space.xs + 2,
          }}>
            ⏱ <b style={{ color: EPJ.gray700, fontVariantNumeric: "tabular-nums" }}>{totalHours.toFixed(1)} h</b> cumulées sur {activeUnit.kind === "soussol" ? "ce sous-sol" : "ce bâtiment"}
          </div>
        )}
      </div>

      {/* Onglets unités (bâtiments + sous-sols communs) */}
      {units.length > 1 && (
        <div style={{ display: "flex", gap: space.xs, marginBottom: space.sm + 2, overflowX: "auto", paddingBottom: space.xs }}>
          {units.map(u => {
            const active = activeUnit.id === u.id;
            return (
              <button key={u.id} onClick={() => setActiveUnitId(u.id)} style={{
                padding: `${space.sm}px ${space.lg - 2}px`,
                minHeight: isPwa ? 44 : 36,
                borderRadius: radius.md,
                border: `1px solid ${active ? EPJ.blue : (u.kind === "soussol" ? `${EPJ.blue}55` : EPJ.gray200)}`,
                background: active ? EPJ.blue : EPJ.white,
                color: active ? EPJ.white : (u.kind === "soussol" ? EPJ.blueText : EPJ.gray700),
                fontSize: fontSize.sm, fontWeight: fontWeight.medium, cursor: "pointer",
                fontFamily: font.body, whiteSpace: "nowrap", flexShrink: 0,
                transition: "background .15s ease, border-color .15s ease",
              }}>
                {u.tabLabel}
              </button>
            );
          })}
        </div>
      )}

      {/* Bandeau : bâtiment rattaché à un sous-sol commun */}
      {activeUnit.kind === "batiment" && getBuildingSousSolId(activeUnit.building) && (() => {
        const ss = sousSols.find(s => s.id === getBuildingSousSolId(activeUnit.building));
        return (
          <Banner
            tone="info"
            icon="🅿"
            title={`Sous-sol mutualisé ${ss?.nom || "(supprimé)"}`}
            text={`L'avancement du sous-sol est saisi une seule fois.${ss ? " Cliquez ici pour ouvrir l'onglet du sous-sol commun." : ""}`}
            onClick={ss ? () => setActiveUnitId(ss.id) : undefined}
          />
        );
      })()}

      {/* Filtre artisan */}
      {!editTasksMode && affectedArtisans.length > 0 && (
        <div style={{ marginBottom: space.sm + 2 }}>
          <Field
            as="select"
            label="Affichage"
            value={filterArtisanId}
            onChange={e => setFilterArtisanId(e.target.value)}
            options={[
              { value: "", label: "Toutes les tâches" },
              ...affectedArtisans.map(a => ({ value: a.id, label: `Tâches de ${a.prenom} ${a.nom}` })),
            ]}
          />
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
          isPwa={isPwa}
        />
      ))}

      {visibleTaskIds && visibleTaskIds.size === 0 && (
        <div style={{ ...panelStyle, padding: space.lg, textAlign: "center", fontSize: fontSize.sm, color: EPJ.gray500 }}>
          Aucune tâche n'est assignée à cet artisan pour ce bâtiment.
        </div>
      )}

      {/* Bouton validation avancement du mois */}
      <ValidationAvancementBloc
        chantier={chantier}
        avancementValidations={avancementValidations}
      />
    </div>
  );
}

// ─── Bloc de validation de l'avancement mensuel ─────────────
function ValidationAvancementBloc({ chantier, avancementValidations }) {
  const { user } = useAuth();
  const { users } = useData();
  const isPwa = useViewport() === "mobile";
  const toast = useToast();
  const [saving, setSaving] = useState(false);

  const monthKey = currentMonthKey();
  const chantierNum = chantier.num || chantier._id;
  const validation = getValidation(chantierNum, monthKey, avancementValidations);
  const isValide = !!validation;

  const validerMoisMethod = async () => {
    if (!confirm(`Confirmer la validation de l'avancement de ${currentMonthLabel()} pour le chantier ${chantier.num} ?\n\nCela signifie que tu as renseigné toutes les tâches avancées ce mois-ci.`)) return;
    setSaving(true);
    try {
      const docId = `${chantierNum}_${monthKey}`;
      await setDoc(doc(db, "avancementValidations", docId), {
        id: docId,
        chantierNum,
        mois: monthKey,
        validePar: user.id,
        validePourNom: `${user.prenom} ${user.nom}`,
        valideLe: new Date().toISOString(),
      });
      toast(`✓ Avancement de ${currentMonthLabel()} validé`);
    } catch (e) {
      console.error(e);
      toast("❌ " + e.message);
    } finally { setSaving(false); }
  };

  const annulerValidation = async () => {
    if (!confirm("Annuler la validation de ce mois ? Il apparaîtra à nouveau dans les rappels.")) return;
    setSaving(true);
    try {
      const docId = `${chantierNum}_${monthKey}`;
      await deleteDoc(doc(db, "avancementValidations", docId));
      toast("Validation annulée");
    } catch (e) {
      console.error(e);
      toast("❌ " + e.message);
    } finally { setSaving(false); }
  };

  if (isValide) {
    const validePar = users.find(u => u.id === validation.validePar);
    const dateValidation = new Date(validation.valideLe).toLocaleString("fr-FR", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
    });
    return (
      <div style={{ marginTop: space.xl }}>
        <Banner
          tone="success"
          icon="✓"
          title={`Avancement de ${currentMonthLabel()} validé`}
          text={`Par ${validePar ? `${validePar.prenom} ${validePar.nom}` : validation.validePourNom || "—"} — ${dateValidation}`}
          action={(
            <Button variant="secondary" onClick={annulerValidation} disabled={saving}>
              Annuler
            </Button>
          )}
        />
      </div>
    );
  }

  return (
    <div style={{ ...panelStyle, padding: space.lg, marginTop: space.xl }}>
      <div style={{
        fontSize: fontSize.sm, fontWeight: fontWeight.medium,
        color: EPJ.gray900, marginBottom: space.xs,
      }}>
        Avancement de {currentMonthLabel()}
      </div>
      <div style={{ fontSize: fontSize.xs, color: EPJ.gray600, lineHeight: 1.5, marginBottom: space.sm + 2 }}>
        Une fois que tu as renseigné toutes les tâches avancées ce mois-ci, clique sur le bouton ci-dessous pour confirmer.
      </div>
      <div style={{ display: "flex", justifyContent: isPwa ? "stretch" : "flex-end" }}>
        <Button
          variant="primary"
          full={isPwa}
          onClick={validerMoisMethod}
          loading={saving}
        >
          ✓ J'ai terminé mon avancement de {currentMonthLabel()}
        </Button>
      </div>
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
  isPwa,
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
          padding: `2px ${space.xs + 3}px`, borderRadius: radius.sm,
          fontFamily: font.mono,
        }}>{category.num}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900 }}>
            {category.label}
            {editTasksMode && isGenerated && (
              <span style={{ fontSize: fontSize.xs, fontWeight: fontWeight.regular, color: EPJ.gray500, marginLeft: space.xs + 2, fontStyle: "italic" }}>
                (généré)
              </span>
            )}
          </div>
          <div style={{ height: 4, marginTop: space.xs + 1, borderRadius: radius.pill, background: EPJ.gray100, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: accent, transition: "width .3s ease" }}/>
          </div>
        </div>
        <div style={{
          fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: accent,
          fontVariantNumeric: "tabular-nums", minWidth: 36, textAlign: "right",
        }}>{pct}%</div>
        <span style={{ color: EPJ.gray500, fontSize: fontSize.xs, transform: expanded ? "rotate(90deg)" : "none", transition: "transform .2s", marginLeft: 2 }}>▸</span>
      </div>

      {expanded && (
        <div style={{ padding: `${space.xs}px ${space.lg - 2}px ${space.lg - 2}px`, borderTop: `1px solid ${EPJ.gray100}` }}>
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
              isPwa={isPwa}
            />
          ))}

          {editTasksMode && !isGenerated && (
            <div style={{ marginTop: space.sm + 2, display: "flex", gap: space.sm, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <Field
                  value={newLabel}
                  onChange={e => setNewLabel(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && newLabel.trim()) {
                      onAddTask(newLabel); setNewLabel("");
                    }
                  }}
                  placeholder="Nouvelle tâche…"
                />
              </div>
              <Button
                variant="secondary"
                onClick={() => { if (newLabel.trim()) { onAddTask(newLabel); setNewLabel(""); } }}
                disabled={!newLabel.trim()}
              >+ Ajouter</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ligne de tâche avec sessions d'heures ──────────────────
// Saisie terrain : slider + raccourcis 0/50/100 + heures + artisan.
// Structure et gestes STRICTEMENT identiques — repeinte tokens only.
function TaskRow({
  task, value, sessions, legacyHoursValue, onChange,
  onAddSession, onDeleteSession,
  canEdit, currentUserId, isUserAdmin, allUsers,
  affectedArtisans, assignedArtisanId, onAssignArtisan,
  isPwa,
}) {
  const [showArtisanPicker, setShowArtisanPicker] = useState(false);
  const [showHours, setShowHours] = useState(false);

  const assignedArtisan = affectedArtisans.find(a => a.id === assignedArtisanId);
  const pctColor = value === 100 ? EPJ.green : value > 0 ? EPJ.blue : EPJ.gray300;
  const totalHours = totalHoursForTask(sessions, legacyHoursValue);
  const iconBtnSize = isPwa ? 44 : 32;

  return (
    <div style={{ padding: `${space.sm + 2}px 0`, borderTop: `1px solid ${EPJ.gray100}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: space.sm + 2, marginBottom: space.xs + 2 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: fontSize.sm, color: EPJ.gray900, fontWeight: fontWeight.medium }}>{task.label}</div>
          {assignedArtisan && (
            <div style={{ fontSize: fontSize.xs, color: EPJ.orangeText, marginTop: 2, fontWeight: fontWeight.medium }}>
              👤 {assignedArtisan.prenom} {assignedArtisan.nom}
            </div>
          )}
          {totalHours > 0 && !showHours && (
            <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginTop: 2 }}>
              ⏱ <b style={{ color: EPJ.gray700, fontVariantNumeric: "tabular-nums" }}>{totalHours.toFixed(1)}h</b>
              {sessions && sessions.length > 1 && (
                <span style={{ marginLeft: space.xs, color: EPJ.gray400 }}>
                  ({sessions.length} sessions)
                </span>
              )}
            </div>
          )}
        </div>
        <div style={{
          fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: pctColor,
          fontVariantNumeric: "tabular-nums", minWidth: 40, textAlign: "right",
        }}>{value}%</div>
        {canEdit && (
          <button
            onClick={() => setShowHours(!showHours)}
            style={{
              width: iconBtnSize, height: iconBtnSize,
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              background: totalHours > 0 ? EPJ.infoBg : EPJ.gray100,
              border: "none", borderRadius: radius.md, fontSize: fontSize.sm,
              cursor: "pointer", fontFamily: font.body, flexShrink: 0,
              color: totalHours > 0 ? EPJ.blueText : EPJ.gray500,
            }}
            title="Heures travaillées"
          >⏱</button>
        )}
        {canEdit && affectedArtisans.length > 0 && (
          <button onClick={() => setShowArtisanPicker(!showArtisanPicker)} style={{
            width: iconBtnSize, height: iconBtnSize,
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            background: assignedArtisanId ? EPJ.warningBg : EPJ.gray100,
            border: "none", borderRadius: radius.md, fontSize: fontSize.sm,
            cursor: "pointer", fontFamily: font.body, flexShrink: 0,
            color: assignedArtisanId ? EPJ.orangeText : EPJ.gray500,
          }} title="Assigner à un artisan">👤</button>
        )}
      </div>

      {/* Curseur % */}
      <div style={{ display: "flex", alignItems: "center", gap: space.sm + 2 }}>
        <input type="range" min="0" max="100" step="5" value={value}
          onChange={e => onChange(Number(e.target.value))} disabled={!canEdit}
          style={{ flex: 1, accentColor: pctColor, cursor: canEdit ? "pointer" : "not-allowed" }}/>
        <div style={{ display: "flex", gap: 3 }}>
          {[0, 50, 100].map(v => (
            <button key={v} onClick={() => canEdit && onChange(v)} disabled={!canEdit} style={{
              minWidth: isPwa ? 38 : 32,
              minHeight: isPwa ? 36 : 26,
              padding: `2px ${space.xs + 2}px`,
              fontSize: fontSize.xs, fontWeight: fontWeight.medium,
              border: `1px solid ${value === v ? pctColor : EPJ.gray200}`,
              background: value === v ? `${pctColor}15` : EPJ.white,
              color: value === v ? pctColor : EPJ.gray500,
              borderRadius: radius.sm, cursor: canEdit ? "pointer" : "not-allowed", fontFamily: font.body,
              fontVariantNumeric: "tabular-nums",
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
          isPwa={isPwa}
        />
      )}

      {/* Picker artisan */}
      {showArtisanPicker && (
        <div style={{
          marginTop: space.sm, padding: `${space.sm}px ${space.sm + 2}px`,
          background: EPJ.gray50, borderRadius: radius.md,
          border: `1px solid ${EPJ.gray200}`,
        }}>
          <div style={{ ...microLabel, marginBottom: space.xs + 2 }}>Assigner à :</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: space.xs }}>
            <button onClick={() => { onAssignArtisan(null); setShowArtisanPicker(false); }} style={pillStyle(!assignedArtisanId, EPJ.gray700, isPwa)}>— Aucun —</button>
            {affectedArtisans.map(a => (
              <button key={a.id} onClick={() => { onAssignArtisan(a.id); setShowArtisanPicker(false); }} style={pillStyle(assignedArtisanId === a.id, EPJ.orangeText, isPwa)}>
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
// Formulaire compact heures + date + ajout : structure inchangée (les
// inputs restent inline, alignement compact non couvert par <Field>).
function HoursPanel({ sessions, legacyHoursValue, onAddSession, onDeleteSession, currentUserId, isUserAdmin, allUsers, isPwa }) {
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

  const inputHeight = isPwa ? 44 : 36;
  const inputStyle = {
    height: inputHeight, padding: `0 ${space.sm + 2}px`,
    border: `1px solid ${EPJ.gray200}`, borderRadius: radius.md,
    fontSize: fontSize.sm, fontWeight: fontWeight.medium,
    fontFamily: font.body,
    background: EPJ.white, color: EPJ.gray900,
  };

  return (
    <div style={{
      marginTop: space.sm, padding: `${space.sm + 2}px ${space.md}px`,
      background: EPJ.gray50, borderRadius: radius.md,
      border: `1px solid ${EPJ.gray200}`,
    }}>
      <div style={{
        ...microLabel, marginBottom: space.sm,
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
        <div style={{ marginBottom: space.sm + 2, display: "flex", flexDirection: "column", gap: space.xs }}>
          {sortedSessions.map(s => {
            const author = s.userId ? allUsers.find(u => u.id === s.userId) : null;
            const canDelete = isUserAdmin || s.userId === currentUserId;
            return (
              <div key={s.id} style={{
                display: "flex", alignItems: "center", gap: space.sm,
                padding: `${space.xs + 2}px ${space.sm}px`, background: EPJ.white, borderRadius: radius.sm,
                border: `1px solid ${EPJ.gray200}`,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: space.xs + 2 }}>
                    <span style={{
                      fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.blueText,
                      fontVariantNumeric: "tabular-nums",
                    }}>+{Number(s.hours).toFixed(1)}h</span>
                    <span style={{ fontSize: fontSize.xs, color: EPJ.gray500 }}>
                      {formatShortDate(s.date)}
                    </span>
                  </div>
                  {author && (
                    <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginTop: 1 }}>
                      {author.prenom} {author.nom}
                    </div>
                  )}
                </div>
                {canDelete && (
                  <button
                    onClick={() => onDeleteSession(s.id)}
                    style={{
                      background: EPJ.dangerBg, color: EPJ.redText,
                      border: "none", borderRadius: radius.sm,
                      width: isPwa ? 36 : 26, height: isPwa ? 36 : 26,
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontSize: fontSize.xs, fontWeight: fontWeight.medium,
                      cursor: "pointer", fontFamily: font.body, flexShrink: 0,
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
          fontSize: fontSize.xs, color: EPJ.gray500, fontStyle: "italic",
          padding: `${space.xs + 2}px 0`, marginBottom: space.xs + 2,
        }}>
          {Number(legacyHoursValue).toFixed(1)}h héritées de l'ancienne version (pas de détail par session)
        </div>
      )}

      {/* Formulaire d'ajout */}
      <div style={{ display: "flex", gap: space.xs + 2, alignItems: "center" }}>
        <input
          type="number" step="0.5" min="0"
          value={hoursInput}
          onChange={e => setHoursInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submitAdd()}
          placeholder="Heures"
          style={{ ...inputStyle, width: 76, fontVariantNumeric: "tabular-nums" }}
        />
        <input
          type="date"
          value={dateInput}
          onChange={e => setDateInput(e.target.value)}
          style={{ ...inputStyle, flex: 1, minWidth: 0, fontWeight: fontWeight.regular, fontSize: fontSize.xs }}
        />
        <button
          onClick={submitAdd}
          disabled={!hoursInput}
          style={{
            background: EPJ.blue, color: EPJ.white, border: "none",
            borderRadius: radius.md, height: inputHeight, padding: `0 ${space.md}px`,
            fontSize: fontSize.xs, fontWeight: fontWeight.medium,
            cursor: hoursInput ? "pointer" : "not-allowed",
            opacity: hoursInput ? 1 : 0.5, fontFamily: font.body,
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
    <div style={{ padding: `${space.sm}px 0`, borderTop: `1px solid ${EPJ.gray100}`, display: "flex", alignItems: "center", gap: space.xs + 2 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <button onClick={() => onMove("up")} disabled={isFirst} style={arrowStyle(isFirst)}>▲</button>
        <button onClick={() => onMove("down")} disabled={isLast} style={arrowStyle(isLast)}>▼</button>
      </div>
      <div style={{ flex: 1 }}>
        <Field
          dense
          value={label}
          onChange={e => setLabel(e.target.value)}
          onBlur={() => { if (label.trim() && label !== task.label) onUpdateLabel(label); else setLabel(task.label); }}
          inputStyle={{ fontSize: fontSize.sm }}
        />
      </div>
      <button onClick={onDelete} style={{
        background: EPJ.dangerBg, color: EPJ.redText,
        border: "none", borderRadius: radius.sm,
        padding: `${space.xs + 2}px ${space.sm + 2}px`, fontSize: fontSize.xs, fontWeight: fontWeight.medium,
        cursor: "pointer", fontFamily: font.body,
      }}>🗑</button>
    </div>
  );
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

function arrowStyle(disabled) {
  return {
    width: 24, height: 18, padding: 0, border: "none",
    background: EPJ.gray100, color: disabled ? EPJ.gray300 : EPJ.gray700,
    borderRadius: radius.sm - 3, fontSize: 8, cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: font.mono,
  };
}
function pillStyle(active, color, isPwa) {
  return {
    padding: `${space.xs}px ${space.sm + 2}px`,
    minHeight: isPwa ? 36 : 28,
    borderRadius: radius.pill,
    border: `1px solid ${active ? color : EPJ.gray200}`,
    background: active ? `${color}15` : EPJ.white,
    color: active ? color : EPJ.gray700,
    fontSize: fontSize.xs, fontWeight: fontWeight.medium, cursor: "pointer", fontFamily: font.body,
  };
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

// ═══════════════════════════════════════════════════════════════
//  AdminTasksModel — édition du modèle global d'avancement
//  Stocké dans Firestore tasksConfig/default
//  Impacte tous les chantiers qui n'ont pas d'override spécifique
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import {
  FACTORY_CATEGORIES, EDITABLE_CATEGORY_IDS,
  getEditableCategoriesForModel, generateTaskId,
} from "../../modules/avancement/avancementTasks";

export function AdminTasksModel({ onBack }) {
  const { tasksConfig } = useData();
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Charge les catégories éditables (avec merge du modèle global actuel)
  useEffect(() => {
    setCategories(getEditableCategoriesForModel(tasksConfig));
    setDirty(false);
  }, [tasksConfig]);

  const addTask = (categoryId, label) => {
    if (!label.trim()) return;
    setCategories(cats => cats.map(cat =>
      cat.id !== categoryId ? cat :
      { ...cat, tasks: [...cat.tasks, { id: generateTaskId(categoryId), label: label.trim() }] }
    ));
    setDirty(true);
  };

  const updateTaskLabel = (categoryId, taskId, newLabel) => {
    if (!newLabel.trim()) return;
    setCategories(cats => cats.map(cat =>
      cat.id !== categoryId ? cat :
      { ...cat, tasks: cat.tasks.map(t => t.id === taskId ? { ...t, label: newLabel.trim() } : t) }
    ));
    setDirty(true);
  };

  const deleteTask = (categoryId, taskId) => {
    if (!confirm("Supprimer cette tâche du modèle ? Cela ne touche pas les chantiers existants.")) return;
    setCategories(cats => cats.map(cat =>
      cat.id !== categoryId ? cat :
      { ...cat, tasks: cat.tasks.filter(t => t.id !== taskId) }
    ));
    setDirty(true);
  };

  const moveTask = (categoryId, taskId, direction) => {
    setCategories(cats => cats.map(cat => {
      if (cat.id !== categoryId) return cat;
      const tasks = [...cat.tasks];
      const idx = tasks.findIndex(t => t.id === taskId);
      if (idx === -1) return cat;
      const newIdx = direction === "up" ? idx - 1 : idx + 1;
      if (newIdx < 0 || newIdx >= tasks.length) return cat;
      [tasks[idx], tasks[newIdx]] = [tasks[newIdx], tasks[idx]];
      return { ...cat, tasks };
    }));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      // Construit le modèle à stocker
      const payload = { categories: {} };
      categories.forEach(cat => {
        payload.categories[cat.id] = { tasks: cat.tasks };
      });
      await setDoc(doc(db, "tasksConfig", "default"), payload);
      toast("✓ Modèle enregistré");
      setDirty(false);
    } catch (e) {
      toast("❌ " + e.message);
    }
    setSaving(false);
  };

  const resetToFactory = async () => {
    if (!confirm("Remettre le modèle aux valeurs d'usine ?\nLes chantiers existants ne sont pas impactés.")) return;
    try {
      await deleteDoc(doc(db, "tasksConfig", "default"));
      toast("♻ Modèle remis aux valeurs usine");
    } catch (e) {
      toast("❌ " + e.message);
    }
  };

  const hasOverride = !!tasksConfig;

  return (
    <div style={{ paddingTop: 12, paddingBottom: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{
          background: EPJ.gray100, border: "none", borderRadius: 8,
          padding: "8px 12px", fontSize: 13, fontWeight: 600,
          color: EPJ.gray700, cursor: "pointer", fontFamily: font.body,
        }}>←</button>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: font.display, fontSize: 22, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em",
          }}>
            Modèle d'avancement
          </div>
          <div style={{ fontSize: 10, color: EPJ.gray500, fontWeight: 500, letterSpacing: 0.3, textTransform: "uppercase", marginTop: 1 }}>
            {hasOverride ? "• Personnalisé" : "• Valeurs usine"}
          </div>
        </div>
      </div>

      <div className="epj-card" style={{ padding: "12px 14px", marginBottom: 12, fontSize: 12, color: EPJ.gray700, lineHeight: 1.5, background: `${EPJ.blue}08`, borderColor: `${EPJ.blue}33` }}>
        <strong style={{ color: EPJ.blue }}>ℹ️ Le modèle est utilisé pour tout nouveau chantier</strong>, et pour les chantiers existants qui n'ont pas personnalisé leurs tâches. Les catégories <b>Béton</b> et <b>Placo</b> sont générées selon la typologie bâtiment et ne sont pas modifiables ici.
      </div>

      {categories.map(cat => (
        <CategoryEditor
          key={cat.id}
          category={cat}
          onAddTask={(lbl) => addTask(cat.id, lbl)}
          onUpdateTaskLabel={(tid, lbl) => updateTaskLabel(cat.id, tid, lbl)}
          onDeleteTask={(tid) => deleteTask(cat.id, tid)}
          onMoveTask={(tid, dir) => moveTask(cat.id, tid, dir)}
        />
      ))}

      {/* Barre sticky */}
      <div style={{
        display: "flex", gap: 8, marginTop: 16,
        position: "sticky", bottom: 0, padding: "12px 0",
        background: "linear-gradient(180deg, transparent, rgba(250,250,250,.9) 30%, rgba(250,250,250,1))",
      }}>
        {hasOverride && (
          <button className="epj-btn" onClick={resetToFactory} style={{ flex: 1, background: EPJ.gray100, color: EPJ.red }}>
            ♻ Valeurs usine
          </button>
        )}
        <button className="epj-btn" onClick={save} disabled={saving || !dirty}
          style={{
            flex: 2, background: EPJ.gray900, color: "#fff",
            opacity: (saving || !dirty) ? 0.55 : 1,
          }}>
          {saving ? "Enregistrement…" : dirty ? "Enregistrer le modèle" : "✓ À jour"}
        </button>
      </div>
    </div>
  );
}

function CategoryEditor({ category, onAddTask, onUpdateTaskLabel, onDeleteTask, onMoveTask }) {
  const [expanded, setExpanded] = useState(false);
  const [newLabel, setNewLabel] = useState("");

  return (
    <div className="epj-card" style={{ padding: 0, marginBottom: 8, overflow: "hidden" }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          padding: "12px 14px", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 10,
          borderLeft: `3px solid ${category.color}`,
        }}
      >
        <div style={{
          fontSize: 10, fontWeight: 700,
          background: `${category.color}22`, color: category.color,
          padding: "3px 7px", borderRadius: 4, fontFamily: "monospace",
        }}>{category.num}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900 }}>
            {category.label}
          </div>
          <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 2 }}>
            {category.tasks.length} tâche{category.tasks.length > 1 ? "s" : ""}
          </div>
        </div>
        <span style={{ color: EPJ.gray500, fontSize: 12, transform: expanded ? "rotate(90deg)" : "none", transition: "transform .2s" }}>▸</span>
      </div>

      {expanded && (
        <div style={{ padding: "4px 14px 14px", borderTop: `1px solid ${EPJ.gray100}` }}>
          {category.tasks.map((task, idx) => (
            <EditableTaskRow
              key={task.id} task={task}
              isFirst={idx === 0} isLast={idx === category.tasks.length - 1}
              onUpdateLabel={(lbl) => onUpdateTaskLabel(task.id, lbl)}
              onDelete={() => onDeleteTask(task.id)}
              onMove={(dir) => onMoveTask(task.id, dir)}
            />
          ))}

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
        </div>
      )}
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

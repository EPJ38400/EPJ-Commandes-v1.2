// ═══════════════════════════════════════════════════════════════
//  AdminCategoriesOutillage — CRUD catégories du parc machines
//  Accessible à : Admin + Direction + Assistante
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { db } from "../../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import { canGererCatalogue } from "../../modules/parc-machines/parcUtils";

// Bibliothèque d'icônes suggérées (l'admin peut taper n'importe quel emoji sinon)
const SUGGESTED_ICONS = [
  "🔧", "🔩", "⚙️", "🪛", "🪚", "🔨", "⚒️", "🛠️",
  "📏", "📐", "🎯", "🚧", "🪜", "🏗️",
  "🔌", "🔋", "💨", "🔥", "🕳️", "🧰", "📦",
];

export function AdminCategoriesOutillage({ onBack }) {
  const { user } = useAuth();
  const { outillageCategories, outils } = useData();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | "new" | catId
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  if (!canGererCatalogue(user)) {
    return (
      <div style={{ paddingTop: 20 }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
          <div style={{ fontSize: 13, color: EPJ.gray500 }}>Accès restreint</div>
        </div>
      </div>
    );
  }

  const startNew = () => {
    const maxOrdre = outillageCategories.reduce((m, c) => Math.max(m, c.ordre || 0), 0);
    setForm({
      id: "",
      label: "",
      icon: "🔧",
      ordre: maxOrdre + 10,
      actif: true,
      _isNew: true,
    });
    setEditing("new");
  };

  const startEdit = (c) => {
    setForm({
      id: c.id,
      label: c.label || "",
      icon: c.icon || "🔧",
      ordre: c.ordre || 10,
      actif: c.actif !== false,
      _isNew: false,
    });
    setEditing(c._id);
  };

  const cancel = () => { setEditing(null); setForm({}); };

  const slugify = (s) => s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  const save = async () => {
    if (!form.label?.trim()) { toast("❌ Libellé requis"); return; }
    setSaving(true);
    try {
      const id = form._isNew ? slugify(form.label.trim()) : form.id;
      if (!id) { toast("❌ ID invalide"); return; }
      if (form._isNew && outillageCategories.find(c => c.id === id)) {
        toast("❌ Une catégorie avec cet ID existe déjà");
        return;
      }
      await setDoc(doc(db, "outillageCategories", id), {
        id,
        label: form.label.trim(),
        icon: form.icon || "🔧",
        ordre: Number(form.ordre) || 10,
        actif: form.actif !== false,
      });
      toast(form._isNew ? "✓ Catégorie créée" : "✓ Catégorie mise à jour");
      cancel();
    } catch (e) {
      console.error(e);
      toast("❌ " + e.message);
    } finally { setSaving(false); }
  };

  const remove = async (cat) => {
    // Vérifie combien d'outils utilisent cette catégorie
    const used = outils.filter(o => o.categorieId === cat.id).length;
    if (used > 0) {
      toast(`❌ Impossible : ${used} outil(s) utilisent cette catégorie. Reclasse-les d'abord.`);
      return;
    }
    if (!confirm(`Supprimer la catégorie "${cat.label}" ?`)) return;
    try {
      await deleteDoc(doc(db, "outillageCategories", cat._id));
      toast("🗑 Catégorie supprimée");
    } catch (e) { toast("❌ " + e.message); }
  };

  const toggleActif = async (cat) => {
    try {
      await setDoc(doc(db, "outillageCategories", cat._id), {
        ...cat, actif: cat.actif === false,
      });
      toast(cat.actif === false ? "✓ Catégorie activée" : "Catégorie désactivée");
    } catch (e) { toast("❌ " + e.message); }
  };

  // ── Form ──
  if (editing) {
    const isNew = editing === "new";
    return (
      <div style={{ paddingTop: 12, paddingBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button onClick={cancel} style={backBtnStyle}>← Retour</button>
          <div style={{
            fontFamily: font.display, fontSize: 20, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em",
          }}>{isNew ? "Nouvelle catégorie" : "Modifier la catégorie"}</div>
        </div>

        <div className="epj-card" style={{ padding: 14, marginBottom: 14 }}>
          <FormRow>
            <label style={labelStyle}>Libellé <span style={{ color: EPJ.red }}>*</span></label>
            <input className="epj-input" value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="ex: Perceuses & Perforateurs"/>
          </FormRow>

          <FormRow>
            <label style={labelStyle}>Icône (emoji)</label>
            <input className="epj-input" value={form.icon}
              onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
              placeholder="🔧" style={{ fontSize: 20, textAlign: "center", width: 70 }}/>
            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {SUGGESTED_ICONS.map(ic => (
                <button key={ic} type="button"
                  onClick={() => setForm(f => ({ ...f, icon: ic }))}
                  style={{
                    width: 36, height: 36, borderRadius: 6,
                    border: `1px solid ${form.icon === ic ? EPJ.gray900 : EPJ.gray200}`,
                    background: form.icon === ic ? `${EPJ.gray900}08` : EPJ.white,
                    fontSize: 18, cursor: "pointer",
                  }}>{ic}</button>
              ))}
            </div>
          </FormRow>

          <FormRow>
            <label style={labelStyle}>Ordre d'affichage</label>
            <input className="epj-input" type="number" value={form.ordre}
              onChange={e => setForm(f => ({ ...f, ordre: e.target.value }))}
              style={{ width: 100 }}/>
            <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 4 }}>
              Plus petit = apparaît en premier
            </div>
          </FormRow>

          <FormRow>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={form.actif !== false}
                onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))}
                style={{ width: 18, height: 18, accentColor: EPJ.green }}/>
              <span style={{ fontSize: 13, color: EPJ.gray900 }}>Catégorie active</span>
            </label>
          </FormRow>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={cancel} className="epj-btn" style={{ flex: 1, background: EPJ.gray100, color: EPJ.gray700 }}>Annuler</button>
          <button onClick={save} disabled={saving} className="epj-btn" style={{
            flex: 2, background: EPJ.gray900, color: "#fff", opacity: saving ? 0.6 : 1,
          }}>{saving ? "Enregistrement…" : (isNew ? "Créer" : "Enregistrer")}</button>
        </div>
      </div>
    );
  }

  // ── Liste ──
  const sorted = [...outillageCategories].sort((a, b) => (a.ordre || 0) - (b.ordre || 0));

  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: font.display, fontSize: 20, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.15,
          }}>Catégories d'outillage</div>
          <div style={{
            fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3,
            textTransform: "uppercase", fontWeight: 600, marginTop: 1,
          }}>{outillageCategories.length} catégorie{outillageCategories.length > 1 ? "s" : ""}</div>
        </div>
      </div>

      <button onClick={startNew} className="epj-btn" style={{
        width: "100%", background: EPJ.gray900, color: "#fff", marginBottom: 12,
      }}>+ Nouvelle catégorie</button>

      {sorted.length === 0 ? (
        <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
          <div style={{ fontSize: 13, color: EPJ.gray500 }}>
            Aucune catégorie. Depuis Admin → Catalogue outillage, tu peux importer les 18 catégories EPJ initiales.
          </div>
        </div>
      ) : (
        sorted.map(c => {
          const usageCount = outils.filter(o => o.categorieId === c.id).length;
          const inactif = c.actif === false;
          return (
            <div key={c._id} className="epj-card" style={{
              padding: "10px 12px", marginBottom: 6,
              opacity: inactif ? 0.55 : 1,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 8,
                background: EPJ.gray100, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 22, flexShrink: 0,
              }}>{c.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: EPJ.gray900 }}>
                  {c.label}{inactif && <span style={{ color: EPJ.gray400, fontWeight: 400, marginLeft: 6, fontSize: 10 }}>(désactivée)</span>}
                </div>
                <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 1 }}>
                  Ordre {c.ordre} • {usageCount} outil{usageCount > 1 ? "s" : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => toggleActif(c)} style={actionBtnStyle(EPJ.gray100, EPJ.gray700)}
                  title={inactif ? "Activer" : "Désactiver"}>
                  {inactif ? "🔕" : "🔔"}
                </button>
                <button onClick={() => startEdit(c)} style={actionBtnStyle(EPJ.gray100, EPJ.gray700)}>✏</button>
                <button onClick={() => remove(c)} style={actionBtnStyle(`${EPJ.red}12`, EPJ.red)}>🗑</button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

const backBtnStyle = {
  background: EPJ.gray100, border: "none", borderRadius: 10,
  padding: "9px 14px", fontSize: 13, fontWeight: 600,
  color: EPJ.gray700, cursor: "pointer", fontFamily: "Inter, sans-serif",
  whiteSpace: "nowrap", flexShrink: 0,
};
const labelStyle = {
  display: "block", fontSize: 10, fontWeight: 600,
  color: EPJ.gray500, letterSpacing: 0.4, textTransform: "uppercase",
  marginBottom: 4,
};
function FormRow({ children }) { return <div style={{ marginBottom: 12 }}>{children}</div>; }
function actionBtnStyle(bg, color) {
  return {
    background: bg, color, border: "none", borderRadius: 6,
    padding: "6px 9px", fontSize: 12, fontWeight: 600,
    cursor: "pointer", fontFamily: "Inter, sans-serif",
  };
}

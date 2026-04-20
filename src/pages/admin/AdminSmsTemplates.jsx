// ═══════════════════════════════════════════════════════════════
//  AdminSmsTemplates — Gestion globale des modèles SMS
//  Utilisable par : parc-machines, reserves-quitus, etc.
//  Accessible à : Admin + Direction + Assistante
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { db } from "../../firebase";
import { doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import { getRoles } from "../../core/permissions";
import { renderSmsTemplate } from "../../modules/parc-machines/parcUtils";

// Les modules où un SMS peut être utilisé
const MODULE_OPTIONS = [
  { id: "parc-machines", label: "Parc machines", color: EPJ.orange },
  { id: "reserves-quitus", label: "Réserves & quitus", color: "#8E44AD" },
  { id: "commandes", label: "Commandes", color: EPJ.blue },
  { id: "avancement", label: "Avancement", color: EPJ.green },
  { id: "autre", label: "Autre", color: EPJ.gray500 },
];

// Modèles pré-définis proposés au premier import
const DEFAULT_TEMPLATES = [
  {
    id: "outillage_rappel_retour",
    module: "parc-machines",
    label: "Rappel retour d'outil",
    body: "Bonjour {prenom}, rappel EPJ : retour prévu aujourd'hui pour {ref} ({nom}). Merci de le ramener nettoyé et soufflé à l'atelier. — EPJ Electricité",
    variables: ["{prenom}", "{ref}", "{nom}", "{dateRetour}", "{chantier}"],
    actif: true,
  },
  {
    id: "outillage_rappel_retard",
    module: "parc-machines",
    label: "Relance outil en retard",
    body: "Bonjour {prenom}, l'outil {ref} ({nom}) devait être rendu le {dateRetour}. Merci de le ramener au plus vite nettoyé et soufflé à l'atelier. — EPJ Electricité",
    variables: ["{prenom}", "{ref}", "{nom}", "{dateRetour}"],
    actif: true,
  },
];

export function AdminSmsTemplates({ onBack }) {
  const { user } = useAuth();
  const { smsTemplates } = useData();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [moduleFilter, setModuleFilter] = useState("");

  const roles = getRoles(user);
  const authorized = roles.includes("Admin") || roles.includes("Direction") || roles.includes("Assistante");

  if (!authorized) {
    return (
      <div style={{ paddingTop: 20 }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: EPJ.gray500 }}>Accès restreint</div>
        </div>
      </div>
    );
  }

  const importDefaults = async () => {
    const toImport = DEFAULT_TEMPLATES.filter(t => !smsTemplates.find(x => x.id === t.id));
    if (toImport.length === 0) { toast("Tous les modèles par défaut sont déjà présents"); return; }
    if (!confirm(`Importer ${toImport.length} modèle(s) par défaut ?`)) return;
    try {
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      toImport.forEach(t => {
        batch.set(doc(db, "smsTemplates", t.id), {
          ...t, createdAt: now, updatedAt: now,
        });
      });
      await batch.commit();
      toast(`✓ ${toImport.length} modèle(s) importé(s)`);
    } catch (e) { toast("❌ " + e.message); }
  };

  const startNew = () => {
    setForm({
      id: "",
      module: "parc-machines",
      label: "",
      body: "",
      variables: [],
      actif: true,
      _isNew: true,
    });
    setEditing("new");
  };

  const startEdit = (t) => {
    setForm({
      id: t.id,
      module: t.module || "autre",
      label: t.label || "",
      body: t.body || "",
      variables: t.variables || [],
      actif: t.actif !== false,
      _isNew: false,
    });
    setEditing(t._id);
  };

  const cancel = () => { setEditing(null); setForm({}); };

  // Extrait automatiquement les variables {xxx} du body
  const extractVars = (body) => {
    const re = /\{([a-zA-Z0-9_]+)\}/g;
    const found = new Set();
    let m;
    while ((m = re.exec(body)) !== null) found.add(`{${m[1]}}`);
    return Array.from(found);
  };

  const slugify = (s) => s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

  const save = async () => {
    if (!form.label?.trim() || !form.body?.trim()) {
      toast("❌ Libellé et texte requis");
      return;
    }
    setSaving(true);
    try {
      const id = form._isNew
        ? `${form.module}_${slugify(form.label.trim())}`
        : form.id;
      if (form._isNew && smsTemplates.find(t => t.id === id)) {
        toast("❌ Un modèle avec cet ID existe déjà"); setSaving(false); return;
      }
      const now = new Date().toISOString();
      const existing = smsTemplates.find(t => t._id === form.id);
      await setDoc(doc(db, "smsTemplates", id), {
        id,
        module: form.module,
        label: form.label.trim(),
        body: form.body,
        variables: extractVars(form.body),
        actif: form.actif !== false,
        createdAt: form._isNew ? now : (existing?.createdAt || now),
        updatedAt: now,
      });
      toast(form._isNew ? "✓ Modèle créé" : "✓ Modèle mis à jour");
      cancel();
    } catch (e) {
      console.error(e);
      toast("❌ " + e.message);
    } finally { setSaving(false); }
  };

  const remove = async (t) => {
    if (!confirm(`Supprimer le modèle "${t.label}" ?`)) return;
    try {
      await deleteDoc(doc(db, "smsTemplates", t._id));
      toast("🗑 Modèle supprimé");
    } catch (e) { toast("❌ " + e.message); }
  };

  // ── Form ──
  if (editing) {
    const isNew = editing === "new";
    const detectedVars = extractVars(form.body || "");
    const previewVars = {
      prenom: "Joseph", nom: "Perceuse Makita HP457",
      ref: "PERCEUSE/001", dateRetour: "21/04/2026",
      chantier: "001374 - LES JARDINS",
    };
    const preview = renderSmsTemplate(form.body || "", previewVars);
    const charCount = (form.body || "").length;

    return (
      <div style={{ paddingTop: 12, paddingBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button onClick={cancel} style={backBtnStyle}>← Retour</button>
          <div style={{
            fontFamily: font.display, fontSize: 20, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em",
          }}>{isNew ? "Nouveau modèle SMS" : "Modifier le modèle"}</div>
        </div>

        <div className="epj-card" style={{ padding: 14, marginBottom: 12 }}>
          <FormRow>
            <label style={labelStyle}>Module concerné</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {MODULE_OPTIONS.map(m => (
                <button key={m.id} type="button"
                  onClick={() => setForm(f => ({ ...f, module: m.id }))}
                  style={{
                    padding: "6px 10px", borderRadius: 999,
                    border: `1px solid ${form.module === m.id ? m.color : EPJ.gray200}`,
                    background: form.module === m.id ? `${m.color}15` : EPJ.white,
                    color: form.module === m.id ? m.color : EPJ.gray600,
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>{m.label}</button>
              ))}
            </div>
          </FormRow>

          <FormRow>
            <label style={labelStyle}>Libellé interne <span style={{ color: EPJ.red }}>*</span></label>
            <input className="epj-input" value={form.label}
              onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
              placeholder="ex: Rappel retour d'outil" disabled={!isNew}/>
          </FormRow>

          <FormRow>
            <label style={labelStyle}>Texte du SMS <span style={{ color: EPJ.red }}>*</span></label>
            <textarea className="epj-input" value={form.body}
              onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
              rows={5} style={{ resize: "vertical", lineHeight: 1.5 }}
              placeholder="Bonjour {prenom}, rappel EPJ : …"/>
            <div style={{
              display: "flex", justifyContent: "space-between",
              fontSize: 10, color: charCount > 160 ? EPJ.orange : EPJ.gray500,
              marginTop: 4,
            }}>
              <span>
                Variables disponibles : <code>{"{prenom}"}</code>, <code>{"{nom}"}</code>, <code>{"{ref}"}</code>, <code>{"{dateRetour}"}</code>, <code>{"{chantier}"}</code>
              </span>
              <span>{charCount}/160 {charCount > 160 && "(SMS long)"}</span>
            </div>
          </FormRow>

          {detectedVars.length > 0 && (
            <div style={{
              padding: "8px 10px", background: `${EPJ.green}0A`,
              borderRadius: 6, marginBottom: 10,
              fontSize: 11, color: EPJ.gray700,
            }}>
              ✓ Variables détectées : {detectedVars.map(v => <code key={v} style={{ marginRight: 6 }}>{v}</code>)}
            </div>
          )}

          <FormRow>
            <label style={labelStyle}>Aperçu (valeurs factices)</label>
            <div style={{
              padding: 10, background: EPJ.gray50, borderRadius: 6,
              fontSize: 12, color: EPJ.gray900, lineHeight: 1.5,
              fontFamily: "Inter, sans-serif", whiteSpace: "pre-wrap",
            }}>{preview || "…"}</div>
          </FormRow>

          <FormRow>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={form.actif !== false}
                onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))}
                style={{ width: 18, height: 18, accentColor: EPJ.green }}/>
              <span style={{ fontSize: 13, color: EPJ.gray900 }}>Modèle actif</span>
            </label>
          </FormRow>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={cancel} className="epj-btn" style={{ flex: 1, background: EPJ.gray100, color: EPJ.gray700 }}>Annuler</button>
          <button onClick={save} disabled={saving} className="epj-btn" style={{
            flex: 2, background: EPJ.gray900, color: "#fff", opacity: saving ? 0.6 : 1,
          }}>{saving ? "…" : (isNew ? "Créer" : "Enregistrer")}</button>
        </div>
      </div>
    );
  }

  // ── Liste regroupée par module ──
  const filtered = moduleFilter
    ? smsTemplates.filter(t => t.module === moduleFilter)
    : smsTemplates;
  const grouped = MODULE_OPTIONS.map(m => ({
    ...m,
    templates: filtered.filter(t => t.module === m.id).sort((a, b) => (a.label || "").localeCompare(b.label || "")),
  })).filter(g => g.templates.length > 0);

  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: font.display, fontSize: 20, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.15,
          }}>Modèles SMS</div>
          <div style={{
            fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3,
            textTransform: "uppercase", fontWeight: 600, marginTop: 1,
          }}>{smsTemplates.length} modèle{smsTemplates.length > 1 ? "s" : ""} — utilisés dans tous les modules</div>
        </div>
      </div>

      <div style={{
        padding: "10px 12px", background: `${EPJ.blue}08`,
        borderRadius: 8, marginBottom: 12,
        fontSize: 11, color: EPJ.gray700, lineHeight: 1.5,
      }}>
        💡 Les modèles SMS sont <b>globaux</b> et réutilisables dans plusieurs modules (Parc machines, Réserves, etc.). Chaque modèle utilise des variables <code>{"{prenom}"}</code> qui seront remplacées automatiquement.
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={startNew} className="epj-btn" style={{
          flex: 1, background: EPJ.gray900, color: "#fff",
        }}>+ Nouveau modèle</button>
        {DEFAULT_TEMPLATES.some(t => !smsTemplates.find(x => x.id === t.id)) && (
          <button onClick={importDefaults} className="epj-btn" style={{
            flex: 1, background: `${EPJ.orange}12`, color: EPJ.orange,
            border: `1px solid ${EPJ.orange}`,
          }}>🚀 Importer modèles EPJ</button>
        )}
      </div>

      {/* Filtre module */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
        <button onClick={() => setModuleFilter("")}
          style={filterChipStyle(moduleFilter === "")}>Tous modules</button>
        {MODULE_OPTIONS.map(m => (
          <button key={m.id} onClick={() => setModuleFilter(m.id)}
            style={filterChipStyle(moduleFilter === m.id, m.color)}>
            {m.label}
          </button>
        ))}
      </div>

      {smsTemplates.length === 0 ? (
        <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📱</div>
          <div style={{ fontSize: 13, color: EPJ.gray500, lineHeight: 1.5 }}>
            Aucun modèle SMS. Clique sur "Importer modèles EPJ" pour démarrer avec les modèles par défaut.
          </div>
        </div>
      ) : (
        grouped.map(g => (
          <div key={g.id} style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: g.color,
              textTransform: "uppercase", letterSpacing: 0.5,
              marginBottom: 6, paddingLeft: 2,
            }}>{g.label} ({g.templates.length})</div>
            {g.templates.map(t => (
              <div key={t._id} className="epj-card" style={{
                padding: "10px 12px", marginBottom: 6,
                opacity: t.actif === false ? 0.55 : 1,
                borderLeft: `3px solid ${g.color}`,
              }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: EPJ.gray900 }}>
                      {t.label}{t.actif === false && <span style={{ color: EPJ.gray400, fontSize: 10, fontWeight: 400, marginLeft: 6 }}>(désactivé)</span>}
                    </div>
                    <div style={{
                      fontSize: 11, color: EPJ.gray600, marginTop: 4,
                      lineHeight: 1.4, whiteSpace: "pre-wrap",
                    }}>{t.body}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                    <button onClick={() => startEdit(t)} style={actionBtnStyle(EPJ.gray100, EPJ.gray700)}>✏</button>
                    <button onClick={() => remove(t)} style={actionBtnStyle(`${EPJ.red}12`, EPJ.red)}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))
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
function filterChipStyle(active, color) {
  const c = color || EPJ.gray900;
  return {
    padding: "5px 9px", borderRadius: 999,
    border: `1px solid ${active ? c : EPJ.gray200}`,
    background: active ? (color ? `${color}15` : c) : EPJ.white,
    color: active ? (color || "#fff") : EPJ.gray700,
    fontSize: 10, fontWeight: 600, cursor: "pointer",
    fontFamily: "Inter, sans-serif",
  };
}
function actionBtnStyle(bg, color) {
  return {
    background: bg, color, border: "none", borderRadius: 6,
    padding: "6px 9px", fontSize: 12, fontWeight: 600,
    cursor: "pointer", fontFamily: "Inter, sans-serif",
  };
}

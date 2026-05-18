// ═══════════════════════════════════════════════════════════════
//  AdminPannes — Gestion des pannes récurrentes (outillage)
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

export function AdminPannes({ onBack }) {
  const { user } = useAuth();
  const { outillagePannes } = useData();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  if (!canGererCatalogue(user)) {
    return (
      <div style={{ paddingTop: 20 }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: EPJ.gray500 }}>Accès restreint</div>
        </div>
      </div>
    );
  }

  const startNew = () => {
    setForm({ code: "", libelle: "", bloquante: false, actif: true, _isNew: true });
    setEditing("new");
  };

  const startEdit = (p) => {
    setForm({
      code: p.code || p._id,
      libelle: p.libelle || "",
      bloquante: p.bloquante === true,
      actif: p.actif !== false,
      _isNew: false,
    });
    setEditing(p._id);
  };

  const cancel = () => { setEditing(null); setForm({}); };

  const save = async () => {
    if (!form.code?.trim() || !form.libelle?.trim()) {
      toast("❌ Code et libellé requis");
      return;
    }
    const code = form.code.trim().toUpperCase();
    setSaving(true);
    try {
      if (form._isNew && outillagePannes.find(p => p.code === code)) {
        toast("❌ Code déjà utilisé");
        setSaving(false);
        return;
      }
      await setDoc(doc(db, "outillagePannes", code), {
        id: code,
        code,
        libelle: form.libelle.trim().toUpperCase(),
        bloquante: form.bloquante === true,
        actif: form.actif !== false,
      });
      toast(form._isNew ? "✓ Panne créée" : "✓ Panne mise à jour");
      cancel();
    } catch (e) {
      console.error(e);
      toast("❌ " + e.message);
    } finally { setSaving(false); }
  };

  const remove = async (p) => {
    if (!confirm(`Supprimer la panne "${p.code} — ${p.libelle}" ?`)) return;
    try {
      await deleteDoc(doc(db, "outillagePannes", p._id));
      toast("🗑 Panne supprimée");
    } catch (e) { toast("❌ " + e.message); }
  };

  if (editing) {
    const isNew = editing === "new";
    return (
      <div style={{ paddingTop: 12, paddingBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button onClick={cancel} style={backBtnStyle}>← Retour</button>
          <div style={{
            fontFamily: font.display, fontSize: 20, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em",
          }}>{isNew ? "Nouvelle panne" : "Modifier la panne"}</div>
        </div>

        <div className="epj-card" style={{ padding: 14, marginBottom: 14 }}>
          <FormRow>
            <label style={labelStyle}>Code <span style={{ color: EPJ.red }}>*</span></label>
            <input className="epj-input" value={form.code}
              onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="ex: PANBAT" disabled={!isNew}
              style={{ fontFamily: "monospace", textTransform: "uppercase" }}/>
            <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 4 }}>
              Court, en majuscules. Ne pourra pas être modifié après création.
            </div>
          </FormRow>

          <FormRow>
            <label style={labelStyle}>Libellé <span style={{ color: EPJ.red }}>*</span></label>
            <input className="epj-input" value={form.libelle}
              onChange={e => setForm(f => ({ ...f, libelle: e.target.value }))}
              placeholder="ex: PANNE BATTERIE" style={{ textTransform: "uppercase" }}/>
          </FormRow>

          <FormRow>
            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={form.bloquante === true}
                onChange={e => setForm(f => ({ ...f, bloquante: e.target.checked }))}
                style={{ width: 18, height: 18, accentColor: EPJ.red, marginTop: 2 }}/>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: EPJ.gray900 }}>
                  Panne bloquante
                </div>
                <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 2, lineHeight: 1.4 }}>
                  Si cochée, l'outil passera automatiquement en statut "Hors service" lorsque cette panne sera enregistrée au retour.
                </div>
              </div>
            </label>
          </FormRow>

          <FormRow>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={form.actif !== false}
                onChange={e => setForm(f => ({ ...f, actif: e.target.checked }))}
                style={{ width: 18, height: 18, accentColor: EPJ.green }}/>
              <span style={{ fontSize: 13, color: EPJ.gray900 }}>Panne active (sélectionnable au retour)</span>
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

  const sorted = [...outillagePannes].sort((a, b) => (a.code || "").localeCompare(b.code || ""));

  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: font.display, fontSize: 20, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.15,
          }}>Pannes récurrentes</div>
          <div style={{
            fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3,
            textTransform: "uppercase", fontWeight: 600, marginTop: 1,
          }}>{outillagePannes.length} panne{outillagePannes.length > 1 ? "s" : ""}</div>
        </div>
      </div>

      <div style={{
        fontSize: 11, color: EPJ.gray600, marginBottom: 10, lineHeight: 1.5,
        padding: "8px 10px", background: `${EPJ.blue}08`, borderRadius: 6,
      }}>
        💡 Ces pannes seront proposées en menu déroulant lorsqu'un outil est retourné "Abîmé". Les pannes marquées bloquantes passent l'outil en "Hors service".
      </div>

      <button onClick={startNew} className="epj-btn" style={{
        width: "100%", background: EPJ.gray900, color: "#fff", marginBottom: 12,
      }}>+ Nouvelle panne</button>

      {sorted.length === 0 ? (
        <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔧</div>
          <div style={{ fontSize: 13, color: EPJ.gray500 }}>
            Aucune panne. Depuis Admin → Catalogue outillage, tu peux importer les 8 pannes EPJ initiales.
          </div>
        </div>
      ) : (
        sorted.map(p => {
          const inactif = p.actif === false;
          return (
            <div key={p._id} className="epj-card" style={{
              padding: "10px 12px", marginBottom: 6,
              opacity: inactif ? 0.55 : 1,
              borderLeft: p.bloquante ? `3px solid ${EPJ.red}` : undefined,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: EPJ.gray900,
                  fontFamily: "monospace", letterSpacing: 0.3,
                }}>{p.code}</div>
                <div style={{ fontSize: 13, color: EPJ.gray700, marginTop: 1 }}>{p.libelle}</div>
                <div style={{ display: "flex", gap: 6, marginTop: 3 }}>
                  {p.bloquante && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: EPJ.red,
                      background: `${EPJ.red}12`, padding: "2px 5px", borderRadius: 3,
                    }}>⛔ BLOQUANTE</span>
                  )}
                  {inactif && (
                    <span style={{
                      fontSize: 9, fontWeight: 600, color: EPJ.gray500,
                      background: EPJ.gray100, padding: "2px 5px", borderRadius: 3,
                    }}>désactivée</span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                <button onClick={() => startEdit(p)} style={actionBtnStyle(EPJ.gray100, EPJ.gray700)}>✏</button>
                <button onClick={() => remove(p)} style={actionBtnStyle(`${EPJ.red}12`, EPJ.red)}>🗑</button>
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

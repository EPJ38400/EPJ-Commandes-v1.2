// ═══════════════════════════════════════════════════════════════
//  AdminChantiers — gestion des chantiers (CRUD + affectations)
//  Chaque chantier a : conducteur + chefs[] + monteurs[] + artisans[]
//                     + assistantes[] (optionnel)
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { db } from "../../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import { getRoles } from "../../core/permissions";

export function AdminChantiers({ onBack }) {
  const { chantiers, users } = useData();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("actifs"); // 'actifs' | 'archives' | 'tous'

  // Trie les users par rôle pour les sélecteurs d'affectation
  const usersByRole = useMemo(() => {
    const by = { conducteur: [], chef: [], monteur: [], artisan: [], assistante: [] };
    for (const u of users) {
      const roles = getRoles(u);
      if (roles.includes("Conducteur travaux")) by.conducteur.push(u);
      if (roles.includes("Chef chantier"))      by.chef.push(u);
      if (roles.includes("Monteur"))            by.monteur.push(u);
      if (roles.includes("Artisan"))            by.artisan.push(u);
      if (roles.includes("Assistante"))         by.assistante.push(u);
    }
    return by;
  }, [users]);

  const startNew = () => {
    setForm({
      num: "",
      nom: "",
      adresse: "",
      statut: "Actif",
      conducteurId: "",
      chefChantierIds: [],
      monteurIds: [],
      artisanIds: [],
      assistanteIds: [],
      dateDebut: "",
      dateFinPrevue: "",
    });
    setEditing("new");
  };

  const startEdit = (ch) => {
    setForm({
      num: ch.num,
      nom: ch.nom || "",
      adresse: ch.adresse || "",
      statut: ch.statut || "Actif",
      conducteurId: ch.conducteurId || legacyFindUserByName(ch.conducteur, users)?.id || "",
      chefChantierIds: ch.chefChantierIds || [],
      monteurIds: ch.monteurIds || [],
      artisanIds: ch.artisanIds || [],
      assistanteIds: ch.assistanteIds || [],
      dateDebut: ch.dateDebut || "",
      dateFinPrevue: ch.dateFinPrevue || "",
    });
    setEditing(ch.num);
  };

  const cancel = () => { setEditing(null); setForm({}); };

  const toggleMember = (field, userId) => {
    setForm(f => {
      const list = f[field] || [];
      return {
        ...f,
        [field]: list.includes(userId)
          ? list.filter(id => id !== userId)
          : [...list, userId],
      };
    });
  };

  const save = async () => {
    if (!form.num || !form.nom) {
      toast("❌ N° affaire et nom requis");
      return;
    }
    setSaving(true);
    try {
      // Conducteur en doublon legacy : on stocke aussi son nom complet
      const conducteur = users.find(u => u.id === form.conducteurId);
      const payload = {
        num: form.num,
        nom: form.nom,
        adresse: form.adresse || "",
        statut: form.statut || "Actif",
        conducteurId: form.conducteurId || "",
        conducteur: conducteur ? `${conducteur.prenom} ${conducteur.nom}` : "",
        emailConducteur: conducteur?.email || "",
        chefChantierIds: form.chefChantierIds || [],
        monteurIds: form.monteurIds || [],
        artisanIds: form.artisanIds || [],
        assistanteIds: form.assistanteIds || [],
        dateDebut: form.dateDebut || "",
        dateFinPrevue: form.dateFinPrevue || "",
      };
      await setDoc(doc(db, "chantiers", form.num), payload);
      toast(editing === "new" ? "✓ Chantier créé" : "✓ Chantier mis à jour");
      cancel();
    } catch (e) {
      toast("❌ " + e.message);
    }
    setSaving(false);
  };

  const archive = async (ch) => {
    try {
      await setDoc(doc(db, "chantiers", ch.num), { ...ch, statut: "Archivé" });
      toast("📦 Chantier archivé");
    } catch (e) { toast("❌ " + e.message); }
  };

  const unarchive = async (ch) => {
    try {
      await setDoc(doc(db, "chantiers", ch.num), { ...ch, statut: "Actif" });
      toast("✓ Chantier réactivé");
    } catch (e) { toast("❌ " + e.message); }
  };

  const remove = async (ch) => {
    if (!confirm(`Supprimer définitivement le chantier "${ch.nom}" ?\n⚠️ Toutes les données associées (commandes, réserves, avancements) resteront mais ne seront plus rattachées.`)) return;
    try {
      await deleteDoc(doc(db, "chantiers", ch.num));
      toast("🗑️ Chantier supprimé");
    } catch (e) { toast("❌ " + e.message); }
  };

  // ─── Vue formulaire (création/édition) ─────────────────────
  if (editing) {
    const isNew = editing === "new";
    return (
      <div style={{ paddingTop: 12, paddingBottom: 24 }}>
        <SectionHeader title={isNew ? "Nouveau chantier" : `Chantier ${form.num}`} onBack={cancel}/>

        <div className="epj-card" style={{ padding: 18, marginBottom: 12 }}>
          <Row>
            <Field label="N° affaire" required>
              <input
                className="epj-input" value={form.num || ""}
                onChange={e => setForm(f => ({ ...f, num: e.target.value.trim() }))}
                disabled={!isNew} placeholder="ex: 002290"
              />
            </Field>
            <Field label="Statut">
              <select className="epj-input" value={form.statut || "Actif"} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))}>
                <option value="Actif">Actif</option>
                <option value="Terminé">Terminé</option>
                <option value="Archivé">Archivé</option>
              </select>
            </Field>
          </Row>

          <Field label="Nom du chantier" required>
            <input className="epj-input" value={form.nom || ""} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} placeholder="ex: RÉSIDENCE LES ORÉADES"/>
          </Field>

          <Field label="Adresse">
            <input className="epj-input" value={form.adresse || ""} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} placeholder="ex: Rue Gavanière - 38120 SAINT-ÉGRÈVE"/>
          </Field>

          <Row>
            <Field label="Date de début">
              <input className="epj-input" type="date" value={form.dateDebut || ""} onChange={e => setForm(f => ({ ...f, dateDebut: e.target.value }))}/>
            </Field>
            <Field label="Fin prévue">
              <input className="epj-input" type="date" value={form.dateFinPrevue || ""} onChange={e => setForm(f => ({ ...f, dateFinPrevue: e.target.value }))}/>
            </Field>
          </Row>
        </div>

        {/* Affectations */}
        <div className="epj-card" style={{ padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900, marginBottom: 12 }}>
            Équipe du chantier
          </div>

          <Field label="Conducteur travaux">
            <select className="epj-input" value={form.conducteurId || ""} onChange={e => setForm(f => ({ ...f, conducteurId: e.target.value }))}>
              <option value="">— Aucun —</option>
              {usersByRole.conducteur.map(u => (
                <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
              ))}
            </select>
          </Field>

          <MemberPicker
            label="Chefs de chantier"
            candidates={usersByRole.chef}
            selected={form.chefChantierIds || []}
            onToggle={(id) => toggleMember("chefChantierIds", id)}
          />
          <MemberPicker
            label="Monteurs"
            candidates={usersByRole.monteur}
            selected={form.monteurIds || []}
            onToggle={(id) => toggleMember("monteurIds", id)}
          />
          <MemberPicker
            label="Artisans"
            candidates={usersByRole.artisan}
            selected={form.artisanIds || []}
            onToggle={(id) => toggleMember("artisanIds", id)}
          />
          <MemberPicker
            label="Assistantes"
            candidates={usersByRole.assistante}
            selected={form.assistanteIds || []}
            onToggle={(id) => toggleMember("assistanteIds", id)}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="epj-btn" onClick={cancel} style={{ flex: 1, background: EPJ.gray100, color: EPJ.gray700 }}>
            Annuler
          </button>
          <button className="epj-btn" onClick={save} disabled={saving} style={{ flex: 2, background: EPJ.gray900, color: "#fff" }}>
            {saving ? "Enregistrement…" : (isNew ? "Créer le chantier" : "Enregistrer")}
          </button>
        </div>
      </div>
    );
  }

  // ─── Vue liste ─────────────────────────────────────────────
  const filtered = chantiers
    .filter(ch => {
      if (filter === "actifs")   return ch.statut !== "Archivé";
      if (filter === "archives") return ch.statut === "Archivé";
      return true;
    })
    .sort((a, b) => (a.num || "").localeCompare(b.num || ""));

  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      <SectionHeader title="Chantiers" onBack={onBack}/>

      <button onClick={startNew} className="epj-btn" style={{ width: "100%", background: EPJ.gray900, color: "#fff", marginBottom: 14 }}>
        + Nouveau chantier
      </button>

      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <FilterTab active={filter === "actifs"} onClick={() => setFilter("actifs")}>Actifs</FilterTab>
        <FilterTab active={filter === "archives"} onClick={() => setFilter("archives")}>Archivés</FilterTab>
        <FilterTab active={filter === "tous"} onClick={() => setFilter("tous")}>Tous</FilterTab>
      </div>

      <div style={{ fontSize: 11, color: EPJ.gray500, marginBottom: 8, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
        {filtered.length} chantier{filtered.length > 1 ? "s" : ""}
      </div>

      {filtered.map(ch => {
        const cond = users.find(u => u.id === ch.conducteurId);
        const teamCount = (ch.chefChantierIds?.length || 0) + (ch.monteurIds?.length || 0) + (ch.artisanIds?.length || 0);

        return (
          <div key={ch.num} className="epj-card" style={{ padding: "14px 16px", marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{
                    fontFamily: "monospace", fontSize: 10, fontWeight: 700,
                    padding: "2px 7px", borderRadius: 4,
                    background: EPJ.gray100, color: EPJ.gray700,
                  }}>{ch.num}</span>
                  {ch.statut === "Archivé" && (
                    <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: `${EPJ.gray500}22`, color: EPJ.gray500, fontWeight: 600, textTransform: "uppercase" }}>Archivé</span>
                  )}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, color: EPJ.gray900, lineHeight: 1.2 }}>
                  {ch.nom}
                </div>
                {ch.adresse && <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 2 }}>{ch.adresse}</div>}
                <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 4 }}>
                  {cond ? `👷 ${cond.prenom} ${cond.nom}` : ch.conducteur ? `👷 ${ch.conducteur}` : "Aucun conducteur"}
                  {teamCount > 0 && ` • 👥 ${teamCount} équipiers`}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <ActionBtn onClick={() => startEdit(ch)}>✎ Modifier</ActionBtn>
              {ch.statut === "Archivé"
                ? <ActionBtn onClick={() => unarchive(ch)}>♻ Réactiver</ActionBtn>
                : <ActionBtn onClick={() => archive(ch)}>📦 Archiver</ActionBtn>
              }
              <ActionBtn onClick={() => remove(ch)} danger>🗑</ActionBtn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Sous-composant : picker d'équipiers ────────────────────────
function MemberPicker({ label, candidates, selected, onToggle }) {
  if (!candidates || candidates.length === 0) {
    return (
      <Field label={label}>
        <div style={{ fontSize: 11, color: EPJ.gray500, padding: 8, background: EPJ.gray50, borderRadius: 8 }}>
          Aucun utilisateur avec ce rôle.
        </div>
      </Field>
    );
  }
  return (
    <Field label={`${label} (${selected.length}/${candidates.length})`}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {candidates.map(u => {
          const checked = selected.includes(u.id);
          return (
            <button
              key={u.id} type="button"
              onClick={() => onToggle(u.id)}
              style={{
                padding: "6px 10px", borderRadius: 999,
                border: `1px solid ${checked ? EPJ.blue : EPJ.gray200}`,
                background: checked ? `${EPJ.blue}15` : EPJ.white,
                color: checked ? EPJ.blue : EPJ.gray700,
                fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: font.body,
              }}
            >
              {checked ? "✓ " : ""}{u.prenom} {u.nom}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

// ─── Helpers partagés ───────────────────────────────────────────
function SectionHeader({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <button onClick={onBack} style={{
        background: EPJ.gray100, border: "none", borderRadius: 8,
        padding: "8px 12px", fontSize: 13, fontWeight: 600,
        color: EPJ.gray700, cursor: "pointer", fontFamily: font.body,
      }}>←</button>
      <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 400, color: EPJ.gray900, letterSpacing: "-0.02em" }}>
        {title}
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: "block", fontSize: 11, fontWeight: 600, color: EPJ.gray500,
        letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6,
      }}>
        {label}{required && <span style={{ color: EPJ.red, marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ children }) { return <div style={{ display: "flex", gap: 10 }}>{children}</div>; }

function ActionBtn({ children, onClick, danger }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "8px 10px", borderRadius: 8,
      border: `1px solid ${danger ? `${EPJ.red}44` : EPJ.gray200}`,
      background: danger ? `${EPJ.red}0D` : EPJ.white,
      color: danger ? EPJ.red : EPJ.gray700,
      fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font.body,
      whiteSpace: "nowrap",
    }}>
      {children}
    </button>
  );
}

function FilterTab({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "8px 12px", borderRadius: 8,
      border: `1px solid ${active ? EPJ.gray900 : EPJ.gray200}`,
      background: active ? EPJ.gray900 : EPJ.white,
      color: active ? "#fff" : EPJ.gray700,
      fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: font.body,
    }}>
      {children}
    </button>
  );
}

// ─── Fallback : retrouve un user par son nom complet (legacy V1.3) ──
function legacyFindUserByName(fullName, users) {
  if (!fullName) return null;
  return users.find(u => `${u.prenom} ${u.nom}`.toLowerCase() === fullName.toLowerCase()) || null;
}

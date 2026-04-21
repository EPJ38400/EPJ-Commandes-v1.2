// ═══════════════════════════════════════════════════════════════
//  AdminChantiers — gestion des chantiers (CRUD + affectations)
//  - Tous les champs d'affectation sont OPTIONNELS
//  - Dropdowns multi-select (liste avec cases à cocher) pour chefs/monteurs/artisans
//  - Bloc "Assistantes" retiré (elles ne sont pas affectées par chantier)
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo, useRef, useEffect } from "react";
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
  const [filter, setFilter] = useState("actifs");

  const usersByRole = useMemo(() => {
    const by = { conducteur: [], chef: [], monteur: [], artisan: [] };
    for (const u of users) {
      const roles = getRoles(u);
      if (roles.includes("Conducteur travaux")) by.conducteur.push(u);
      if (roles.includes("Chef chantier"))      by.chef.push(u);
      if (roles.includes("Monteur"))            by.monteur.push(u);
      if (roles.includes("Artisan"))            by.artisan.push(u);
    }
    const byName = (a, b) => `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`);
    by.conducteur.sort(byName); by.chef.sort(byName);
    by.monteur.sort(byName);    by.artisan.sort(byName);
    return by;
  }, [users]);

  const startNew = () => {
    setForm({
      num: "", nom: "", adresse: "", statut: "Actif",
      conducteurId: "", chefChantierIds: [], monteurIds: [], artisanIds: [],
      dateDebut: "", dateFinPrevue: "",
      buildings: [{ id: "A", label: "", config: { nbSousSols: 1, nbEtages: 3, combles: false } }],
    });
    setEditing("new");
  };

  const startEdit = (ch) => {
    setForm({
      num: ch.num, nom: ch.nom || "", adresse: ch.adresse || "",
      statut: ch.statut || "Actif",
      conducteurId: ch.conducteurId || legacyFindUserByName(ch.conducteur, users)?.id || "",
      chefChantierIds: ch.chefChantierIds || [],
      monteurIds: ch.monteurIds || [],
      artisanIds: ch.artisanIds || [],
      dateDebut: ch.dateDebut || "", dateFinPrevue: ch.dateFinPrevue || "",
      buildings: ch.buildings && ch.buildings.length > 0
        ? ch.buildings
        : [{ id: "A", label: "", config: { nbSousSols: 1, nbEtages: 3, combles: false } }],
    });
    setEditing(ch.num);
  };

  const cancel = () => { setEditing(null); setForm({}); };

  const toggleMember = (field, userId) => {
    setForm(f => {
      const list = f[field] || [];
      return {
        ...f,
        [field]: list.includes(userId) ? list.filter(id => id !== userId) : [...list, userId],
      };
    });
  };

  const save = async () => {
    if (!form.num || !form.nom) {
      toast("❌ N° affaire et nom du chantier requis");
      return;
    }
    setSaving(true);
    try {
      const conducteur = users.find(u => u.id === form.conducteurId);
      const payload = {
        num: form.num, nom: form.nom, adresse: form.adresse || "",
        statut: form.statut || "Actif",
        conducteurId: form.conducteurId || "",
        conducteur: conducteur ? `${conducteur.prenom} ${conducteur.nom}` : "",
        emailConducteur: conducteur?.email || "",
        chefChantierIds: form.chefChantierIds || [],
        monteurIds: form.monteurIds || [],
        artisanIds: form.artisanIds || [],
        dateDebut: form.dateDebut || "", dateFinPrevue: form.dateFinPrevue || "",
        buildings: form.buildings || [{ id: "A", label: "", config: { nbSousSols: 1, nbEtages: 3, combles: false } }],
      };
      await setDoc(doc(db, "chantiers", form.num), payload);
      toast(editing === "new" ? "✓ Chantier créé" : "✓ Chantier mis à jour");
      cancel();
    } catch (e) { toast("❌ " + e.message); }
    setSaving(false);
  };

  const archive = async (ch) => {
    try { await setDoc(doc(db, "chantiers", ch.num), { ...ch, statut: "Archivé" }); toast("📦 Chantier archivé"); }
    catch (e) { toast("❌ " + e.message); }
  };
  const unarchive = async (ch) => {
    try { await setDoc(doc(db, "chantiers", ch.num), { ...ch, statut: "Actif" }); toast("✓ Chantier réactivé"); }
    catch (e) { toast("❌ " + e.message); }
  };
  const remove = async (ch) => {
    if (!confirm(`Supprimer définitivement le chantier "${ch.nom}" ?\n⚠️ Les données associées (commandes, réserves, etc.) resteront mais ne seront plus rattachées.`)) return;
    try { await deleteDoc(doc(db, "chantiers", ch.num)); toast("🗑️ Chantier supprimé"); }
    catch (e) { toast("❌ " + e.message); }
  };

  // ─── Formulaire ───
  if (editing) {
    const isNew = editing === "new";
    return (
      <div style={{ paddingTop: 12, paddingBottom: 24 }}>
        <SectionHeader title={isNew ? "Nouveau chantier" : `Chantier ${form.num}`} onBack={cancel}/>

        <div className="epj-card" style={{ padding: 18, marginBottom: 12 }}>
          <Row>
            <Field label="N° affaire" required>
              <input className="epj-input" value={form.num || ""} onChange={e => setForm(f => ({ ...f, num: e.target.value.trim() }))} disabled={!isNew} placeholder="ex: 002290"/>
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

        {/* Bâtiments */}
        <BuildingsEditor
          buildings={form.buildings || []}
          onChange={(buildings) => setForm(f => ({ ...f, buildings }))}
        />

        {/* Affectations */}
        <div className="epj-card" style={{ padding: 18, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900, marginBottom: 4 }}>
            Équipe du chantier
          </div>
          <div style={{ fontSize: 11, color: EPJ.gray500, marginBottom: 14, lineHeight: 1.5 }}>
            💡 Tous les champs sont <b>optionnels</b>. Vous pouvez créer un chantier sans équipe et l'affecter plus tard.
          </div>

          <Field label="Conducteur travaux">
            <select className="epj-input" value={form.conducteurId || ""} onChange={e => setForm(f => ({ ...f, conducteurId: e.target.value }))}>
              <option value="">— Aucun —</option>
              {usersByRole.conducteur.map(u => (
                <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>
              ))}
            </select>
          </Field>

          <MultiSelectDropdown
            label="Chefs de chantier"
            candidates={usersByRole.chef}
            selected={form.chefChantierIds || []}
            onToggle={(id) => toggleMember("chefChantierIds", id)}
          />
          <MultiSelectDropdown
            label="Monteurs"
            candidates={usersByRole.monteur}
            selected={form.monteurIds || []}
            onToggle={(id) => toggleMember("monteurIds", id)}
          />
          <MultiSelectDropdown
            label="Artisans"
            candidates={usersByRole.artisan}
            selected={form.artisanIds || []}
            onToggle={(id) => toggleMember("artisanIds", id)}
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

  // ─── Liste ───
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
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: EPJ.gray100, color: EPJ.gray700 }}>{ch.num}</span>
                {ch.statut === "Archivé" && (
                  <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 4, background: `${EPJ.gray500}22`, color: EPJ.gray500, fontWeight: 600, textTransform: "uppercase" }}>Archivé</span>
                )}
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, color: EPJ.gray900, lineHeight: 1.2 }}>{ch.nom}</div>
              {ch.adresse && <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 2 }}>{ch.adresse}</div>}
              <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 4 }}>
                {cond ? `👷 ${cond.prenom} ${cond.nom}` : ch.conducteur ? `👷 ${ch.conducteur}` : "Aucun conducteur"}
                {teamCount > 0 && ` • 👥 ${teamCount} équipier${teamCount > 1 ? "s" : ""}`}
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
              <ActionBtn onClick={() => startEdit(ch)}>✎ Modifier</ActionBtn>
              {ch.statut === "Archivé"
                ? <ActionBtn onClick={() => unarchive(ch)}>♻ Réactiver</ActionBtn>
                : <ActionBtn onClick={() => archive(ch)}>📦 Archiver</ActionBtn>}
              <ActionBtn onClick={() => remove(ch)} danger>🗑</ActionBtn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Composant dropdown multi-select ────────────────────────────
function MultiSelectDropdown({ label, candidates, selected, onToggle }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Ferme le dropdown si on clique en dehors
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedUsers = candidates.filter(u => selected.includes(u.id));
  const labelText = selectedUsers.length === 0
    ? "— Aucun —"
    : selectedUsers.length === 1
      ? `${selectedUsers[0].prenom} ${selectedUsers[0].nom}`
      : `${selectedUsers.length} personnes sélectionnées`;

  if (candidates.length === 0) {
    return (
      <Field label={label}>
        <div style={{ fontSize: 11, color: EPJ.gray500, padding: 10, background: EPJ.gray50, borderRadius: 8, border: `1px solid ${EPJ.gray200}` }}>
          Aucun utilisateur avec ce rôle. Ajoutez-en dans "Utilisateurs" puis cochez le rôle correspondant.
        </div>
      </Field>
    );
  }

  return (
    <Field label={`${label} (${selectedUsers.length}/${candidates.length})`}>
      <div ref={wrapRef} style={{ position: "relative" }}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="epj-input"
          style={{
            width: "100%", textAlign: "left", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            color: selectedUsers.length === 0 ? EPJ.gray300 : EPJ.gray900,
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {labelText}
          </span>
          <span style={{ color: EPJ.gray500, fontSize: 11, marginLeft: 8, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s" }}>▼</span>
        </button>

        {open && (
          <div style={{
            position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
            background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
            borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.1)",
            maxHeight: 240, overflowY: "auto", zIndex: 50,
          }}>
            {candidates.map(u => {
              const checked = selected.includes(u.id);
              return (
                <div
                  key={u.id}
                  onClick={() => onToggle(u.id)}
                  style={{
                    padding: "10px 12px", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 10,
                    borderBottom: `1px solid ${EPJ.gray100}`,
                    background: checked ? `${EPJ.blue}08` : "transparent",
                  }}
                  onMouseEnter={e => { if (!checked) e.currentTarget.style.background = EPJ.gray50; }}
                  onMouseLeave={e => { if (!checked) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: 4,
                    border: `1.5px solid ${checked ? EPJ.blue : EPJ.gray300}`,
                    background: checked ? EPJ.blue : EPJ.white,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0, transition: "all .15s",
                  }}>
                    {checked && <span style={{ color: "#fff", fontSize: 12, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                  </div>
                  <div style={{ fontSize: 13, color: EPJ.gray900, flex: 1 }}>
                    {u.prenom} {u.nom}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tags des sélectionnés en dessous pour retrait rapide */}
      {selectedUsers.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {selectedUsers.map(u => (
            <button
              key={u.id} type="button"
              onClick={() => onToggle(u.id)}
              style={{
                padding: "4px 10px", borderRadius: 999,
                border: `1px solid ${EPJ.blue}44`,
                background: `${EPJ.blue}12`, color: EPJ.blue,
                fontSize: 11, fontWeight: 600,
                cursor: "pointer", fontFamily: font.body,
                display: "inline-flex", alignItems: "center", gap: 5,
              }}
              title="Retirer"
            >
              {u.prenom} {u.nom} <span style={{ opacity: 0.6 }}>×</span>
            </button>
          ))}
        </div>
      )}
    </Field>
  );
}

// ─── Helpers ────────────────────────────────────────────────────
function SectionHeader({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <button onClick={onBack} style={{ background: EPJ.gray100, border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: EPJ.gray700, cursor: "pointer", fontFamily: font.body , whiteSpace: "nowrap", flexShrink: 0 }}>← Retour</button>
      <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 400, color: EPJ.gray900, letterSpacing: "-0.02em" }}>{title}</div>
    </div>
  );
}
function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: EPJ.gray500, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6 }}>
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
    }}>{children}</button>
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
    }}>{children}</button>
  );
}
function legacyFindUserByName(fullName, users) {
  if (!fullName) return null;
  return users.find(u => `${u.prenom} ${u.nom}`.toLowerCase() === fullName.toLowerCase()) || null;
}

// ─── Éditeur de bâtiments (avec config sous-sols/étages/combles) ──
function BuildingsEditor({ buildings, onChange }) {
  const addBuilding = () => {
    // Trouve la prochaine lettre dispo
    const usedIds = new Set(buildings.map(b => b.id));
    let nextId = "A";
    for (const c of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      if (!usedIds.has(c)) { nextId = c; break; }
    }
    onChange([
      ...buildings,
      { id: nextId, label: "", config: { nbSousSols: 1, nbEtages: 3, combles: false } },
    ]);
  };

  const removeBuilding = (idx) => {
    if (!confirm(`Retirer le bâtiment ${buildings[idx].id} ?\n⚠️ Les données d'avancement de ce bâtiment seront perdues.`)) return;
    onChange(buildings.filter((_, i) => i !== idx));
  };

  const updateBuilding = (idx, changes) => {
    const next = [...buildings];
    next[idx] = { ...next[idx], ...changes };
    onChange(next);
  };

  const updateConfig = (idx, changes) => {
    const next = [...buildings];
    next[idx] = { ...next[idx], config: { ...next[idx].config, ...changes } };
    onChange(next);
  };

  return (
    <div className="epj-card" style={{ padding: 18, marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900, marginBottom: 4 }}>
        Bâtiments
      </div>
      <div style={{ fontSize: 11, color: EPJ.gray500, marginBottom: 14, lineHeight: 1.5 }}>
        🏢 Définissez la typologie pour générer automatiquement les tâches d'avancement
        (incorporation béton, placo).
      </div>

      {buildings.map((b, idx) => (
        <div key={b.id} style={{
          padding: 12, marginBottom: 10,
          background: EPJ.gray50, borderRadius: 10,
          border: `1px solid ${EPJ.gray200}`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: EPJ.orange, color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, flexShrink: 0,
            }}>{b.id}</div>
            <input
              className="epj-input"
              value={b.label || ""}
              onChange={e => updateBuilding(idx, { label: e.target.value })}
              placeholder="Nom du bâtiment (optionnel, ex: Entrée A)"
              style={{ flex: 1 }}
            />
            {buildings.length > 1 && (
              <button
                type="button"
                onClick={() => removeBuilding(idx)}
                style={{
                  background: `${EPJ.red}0D`, color: EPJ.red,
                  border: `1px solid ${EPJ.red}44`,
                  borderRadius: 8, padding: "6px 10px",
                  fontSize: 11, fontWeight: 600,
                  cursor: "pointer", fontFamily: font.body,
                }}
              >🗑</button>
            )}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <label style={{
                display: "block", fontSize: 10, fontWeight: 600, color: EPJ.gray500,
                letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 4,
              }}>Sous-sols</label>
              <select
                className="epj-input"
                value={b.config?.nbSousSols ?? 1}
                onChange={e => updateConfig(idx, { nbSousSols: Number(e.target.value) })}
              >
                {[0, 1, 2, 3].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div style={{ flex: 1 }}>
              <label style={{
                display: "block", fontSize: 10, fontWeight: 600, color: EPJ.gray500,
                letterSpacing: 0.3, textTransform: "uppercase", marginBottom: 4,
              }}>Étages (R+)</label>
              <select
                className="epj-input"
                value={b.config?.nbEtages ?? 3}
                onChange={e => updateConfig(idx, { nbEtages: Number(e.target.value) })}
              >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <label style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "10px 12px",
              background: b.config?.combles ? `${EPJ.orange}15` : EPJ.white,
              border: `1px solid ${b.config?.combles ? EPJ.orange : EPJ.gray200}`,
              borderRadius: 8, cursor: "pointer",
              fontSize: 12, fontWeight: 600,
              color: b.config?.combles ? EPJ.orange : EPJ.gray700,
              whiteSpace: "nowrap",
            }}>
              <input
                type="checkbox"
                checked={!!b.config?.combles}
                onChange={e => updateConfig(idx, { combles: e.target.checked })}
                style={{ margin: 0 }}
              />
              Combles
            </label>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addBuilding}
        style={{
          width: "100%", padding: "10px",
          background: EPJ.white, border: `1px dashed ${EPJ.gray300}`,
          borderRadius: 10, cursor: "pointer", fontFamily: font.body,
          fontSize: 13, fontWeight: 600, color: EPJ.gray700,
        }}
      >
        + Ajouter un bâtiment
      </button>
    </div>
  );
}

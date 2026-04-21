// ═══════════════════════════════════════════════════════════════
//  AdminRolesTypes — édition des droits types par rôle
//  Stocké dans Firestore rolesConfig/{roleName}
//  Impacte tous les utilisateurs de ce rôle (sauf overrides user)
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect } from "react";
import { db } from "../../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import {
  ROLES, MODULES, MODULE_LABELS, ACTIONS, ACTION_LABELS,
  DEFAULT_PERMISSIONS, SCOPE_LABELS, getRoles, hasRoleOverride,
  getEffectiveRolePerms,
} from "../../core/permissions";

const SCOPE_OPTIONS = [
  { value: "all", label: "Tout", color: EPJ.green },
  { value: "own_chantiers", label: "Mes chantiers", color: EPJ.blue },
  { value: "own_items", label: "Mes éléments", color: EPJ.orange },
  { value: false, label: "Interdit", color: EPJ.red },
];

export function AdminRolesTypes({ onBack }) {
  const { users, rolesConfig } = useData();
  const toast = useToast();
  const [selectedRole, setSelectedRole] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);

  // Nombre d'utilisateurs par rôle
  const countByRole = useMemo(() => {
    const c = {};
    ROLES.forEach(r => { c[r] = 0; });
    users.forEach(u => getRoles(u).forEach(r => { if (c[r] !== undefined) c[r]++; }));
    return c;
  }, [users]);

  // Charge les droits effectifs du rôle dans le draft quand on le sélectionne
  useEffect(() => {
    if (selectedRole) {
      setDraft(getEffectiveRolePerms(selectedRole, rolesConfig));
    }
  }, [selectedRole, rolesConfig]);

  // Écriture d'une cellule dans le draft
  const setCell = (module, action, val) => {
    setDraft(d => {
      const next = JSON.parse(JSON.stringify(d));
      if (!next[module] || typeof next[module] !== "object") next[module] = {};
      next[module][action] = val;
      return next;
    });
  };

  const setDashboard = (dash, val) => {
    setDraft(d => ({ ...d, _dashboards: { ...(d._dashboards || {}), [dash]: val } }));
  };

  const setAdmin = (val) => {
    setDraft(d => ({ ...d, _admin: val }));
  };

  const save = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      // Calcule le diff avec le FACTORY pour ne stocker que ce qui diffère
      const factory = DEFAULT_PERMISSIONS[selectedRole] || {};
      const diff = computeDiff(factory, draft);
      if (Object.keys(diff).length === 0) {
        // Pas de différence → on supprime l'override si existant
        await deleteDoc(doc(db, "rolesConfig", selectedRole));
        toast("✓ Rôle remis aux valeurs usine");
      } else {
        await setDoc(doc(db, "rolesConfig", selectedRole), diff);
        toast("✓ Rôle mis à jour");
      }
    } catch (e) {
      console.error(e);
      toast("❌ " + e.message);
    }
    setSaving(false);
  };

  const resetToFactory = async () => {
    if (!selectedRole) return;
    if (!confirm(`Remettre le rôle "${selectedRole}" aux valeurs d'usine ?\n\nTous les utilisateurs ayant ce rôle récupéreront les droits par défaut (sauf leurs overrides personnels).`)) return;
    try {
      await deleteDoc(doc(db, "rolesConfig", selectedRole));
      toast("♻ Rôle remis aux valeurs usine");
      setSelectedRole(null);
    } catch (e) {
      toast("❌ " + e.message);
    }
  };

  // ──── Vue 1 : liste des rôles ────
  if (!selectedRole) {
    return (
      <div style={{ paddingTop: 12, paddingBottom: 24 }}>
        <SectionHeader title="Rôles types" onBack={onBack}/>

        <div className="epj-card" style={{ padding: "12px 14px", marginBottom: 14, fontSize: 12, color: EPJ.gray700, lineHeight: 1.5, background: `${EPJ.orange}08`, borderColor: `${EPJ.orange}33` }}>
          <strong style={{ color: EPJ.orange }}>⚠ Modification à fort impact.</strong>
          {" "}Modifier un rôle type change les droits de <b>tous les utilisateurs</b> ayant ce rôle. Pour un cas isolé, passez plutôt par "Droits des utilisateurs".
        </div>

        {ROLES.map(r => {
          const isOverride = hasRoleOverride(r, rolesConfig);
          const nbUsers = countByRole[r] || 0;
          const isLocked = r === "Admin";
          return (
            <div
              key={r}
              className={isLocked ? "epj-card" : "epj-card clickable"}
              onClick={isLocked ? undefined : () => setSelectedRole(r)}
              style={{
                padding: "14px 16px", marginBottom: 8,
                display: "flex", alignItems: "center", gap: 12,
                opacity: isLocked ? 0.65 : 1,
                cursor: isLocked ? "not-allowed" : "pointer",
              }}
            >
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: `${EPJ.orange}15`, color: EPJ.orange,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18, flexShrink: 0,
              }}>
                {isLocked ? "🔒" : "🎭"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: EPJ.gray900 }}>{r}</div>
                <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 2 }}>
                  {nbUsers} utilisateur{nbUsers > 1 ? "s" : ""}
                  {isOverride && <span style={{ color: EPJ.orange, marginLeft: 8, fontWeight: 600 }}>• Personnalisé</span>}
                  {!isOverride && <span style={{ color: EPJ.gray500, marginLeft: 8 }}>• Valeurs usine</span>}
                  {isLocked && <span style={{ color: EPJ.gray500, marginLeft: 8, fontStyle: "italic" }}>• Verrouillé</span>}
                </div>
              </div>
              {!isLocked && <span style={{ color: EPJ.gray300, fontSize: 16 }}>→</span>}
            </div>
          );
        })}
      </div>
    );
  }

  // ──── Vue 2 : édition d'un rôle ────
  const factory = DEFAULT_PERMISSIONS[selectedRole] || {};
  const nbUsers = countByRole[selectedRole] || 0;
  const isOverride = hasRoleOverride(selectedRole, rolesConfig);

  return (
    <div style={{ paddingTop: 12, paddingBottom: 100 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={() => setSelectedRole(null)} style={{
          background: EPJ.gray100, border: "none", borderRadius: 8,
          padding: "8px 12px", fontSize: 13, fontWeight: 600,
          color: EPJ.gray700, cursor: "pointer", fontFamily: font.body, whiteSpace: "nowrap", flexShrink: 0,
      }}>← Retour</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 400, color: EPJ.gray900, letterSpacing: "-0.02em" }}>
            {selectedRole}
          </div>
          <div style={{ fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3, textTransform: "uppercase", fontWeight: 500 }}>
            Rôle type • {nbUsers} utilisateur{nbUsers > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div className="epj-card" style={{ padding: "12px 14px", marginBottom: 12, fontSize: 12, color: EPJ.gray700, lineHeight: 1.5, background: `${EPJ.orange}08`, borderColor: `${EPJ.orange}33` }}>
        <strong style={{ color: EPJ.orange }}>⚠ Cette modification s'applique à tous les utilisateurs ayant ce rôle.</strong>
        {" "}Les overrides individuels restent prioritaires. Bouton "Remettre aux valeurs usine" disponible à tout moment.
      </div>

      {/* Accès admin */}
      <div className="epj-card" style={{ padding: "14px 16px", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900 }}>Accès à l'Administration</div>
            <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 2 }}>
              Usine : {factory._admin ? "Oui" : "Non"}
            </div>
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            {[true, false].map(v => (
              <button key={String(v)} onClick={() => setAdmin(v)} style={{
                padding: "6px 12px", borderRadius: 8,
                border: `1px solid ${draft._admin === v ? EPJ.gray900 : EPJ.gray200}`,
                background: draft._admin === v ? EPJ.gray900 : EPJ.white,
                color: draft._admin === v ? "#fff" : EPJ.gray700,
                fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font.body,
              }}>{v ? "Oui" : "Non"}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Dashboards */}
      <div className="epj-card" style={{ padding: "14px 16px", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900, marginBottom: 10 }}>
          Accès aux Dashboards
        </div>
        {["direction", "conducteur", "public"].map(dash => {
          const factoryVal = factory._dashboards?.[dash];
          const currentVal = draft._dashboards?.[dash];
          return (
            <div key={dash} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${EPJ.gray100}` }}>
              <div style={{ fontSize: 12, color: EPJ.gray700, textTransform: "capitalize" }}>
                {dash}
                <span style={{ fontSize: 9, color: EPJ.gray500, fontWeight: 500, marginLeft: 6 }}>
                  (usine : {factoryVal ? "oui" : "non"})
                </span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                {[true, false].map(v => (
                  <button key={String(v)} onClick={() => setDashboard(dash, v)} style={{
                    padding: "4px 10px", borderRadius: 6,
                    border: `1px solid ${currentVal === v ? EPJ.gray900 : EPJ.gray200}`,
                    background: currentVal === v ? EPJ.gray900 : EPJ.white,
                    color: currentVal === v ? "#fff" : EPJ.gray700,
                    fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: font.body,
                  }}>{v ? "Oui" : "Non"}</button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modules */}
      {MODULES.map(mod => (
        <ModuleBlock
          key={mod} module={mod} draft={draft} factory={factory} setCell={setCell}
        />
      ))}

      {/* Barre sticky d'actions */}
      <div style={{
        display: "flex", gap: 8, marginTop: 16,
        position: "sticky", bottom: 0, padding: "12px 0",
        background: "linear-gradient(180deg, transparent, rgba(250,250,250,.9) 30%, rgba(250,250,250,1))",
      }}>
        {isOverride && (
          <button className="epj-btn" onClick={resetToFactory} style={{ flex: 1, background: EPJ.gray100, color: EPJ.red }}>
            ♻ Valeurs usine
          </button>
        )}
        <button className="epj-btn" onClick={save} disabled={saving} style={{ flex: 2, background: EPJ.gray900, color: "#fff" }}>
          {saving ? "Enregistrement…" : "Enregistrer les droits"}
        </button>
      </div>
    </div>
  );
}

function ModuleBlock({ module, draft, factory, setCell }) {
  const [expanded, setExpanded] = useState(false);
  const draftAccess = draft[module]?._access;
  const factAccess = factory[module]?._access;

  return (
    <div className="epj-card" style={{ padding: "14px 16px", marginBottom: 10 }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900 }}>
            {MODULE_LABELS[module]}
          </div>
          <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 2 }}>
            Accès : {draftAccess === "all" ? "✓ Autorisé" : draftAccess === false || draftAccess === undefined ? "✗ Interdit" : SCOPE_LABELS[draftAccess] || String(draftAccess)}
          </div>
        </div>
        <span style={{ color: EPJ.gray500, fontSize: 14, transform: expanded ? "rotate(90deg)" : "none", transition: "transform .2s" }}>▸</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${EPJ.gray100}` }}>
          <CellLine label="Accès au module" current={draftAccess} factory={factAccess} onChange={(v) => setCell(module, "_access", v)} simple/>
          {ACTIONS.map(act => (
            <CellLine
              key={act} label={ACTION_LABELS[act]}
              current={draft[module]?.[act]} factory={factory[module]?.[act]}
              onChange={(v) => setCell(module, act, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CellLine({ label, current, factory, onChange, simple }) {
  // Mode "simple" = juste Oui/Non (pour _access)
  const options = simple
    ? [{ value: "all", label: "Autorisé", color: EPJ.green }, { value: false, label: "Interdit", color: EPJ.red }]
    : SCOPE_OPTIONS;

  return (
    <div style={{ padding: "8px 0", borderTop: `1px solid ${EPJ.gray100}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: EPJ.gray700, fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ fontSize: 10, color: EPJ.gray500 }}>
          Usine : {factory === "all" ? "Tout" : factory === false || factory === undefined ? "Interdit" : SCOPE_LABELS[factory] || String(factory)}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {options.map(opt => {
          const active = current === opt.value;
          return (
            <button key={String(opt.value)} onClick={() => onChange(opt.value)} style={{
              padding: "5px 9px", borderRadius: 6,
              border: `1px solid ${active ? opt.color : EPJ.gray200}`,
              background: active ? `${opt.color}15` : EPJ.white,
              color: active ? opt.color : EPJ.gray700,
              fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: font.body,
            }}>
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SectionHeader({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <button onClick={onBack} style={{ background: EPJ.gray100, border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: EPJ.gray700, cursor: "pointer", fontFamily: font.body , whiteSpace: "nowrap", flexShrink: 0 }}>← Retour</button>
      <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 400, color: EPJ.gray900, letterSpacing: "-0.02em" }}>{title}</div>
    </div>
  );
}

// ─── Calcule le diff entre factory et draft (pour ne stocker que ce qui change) ──
function computeDiff(factory, draft) {
  const diff = {};
  const allKeys = new Set([...Object.keys(factory), ...Object.keys(draft)]);
  for (const key of allKeys) {
    const f = factory[key];
    const d = draft[key];
    if (JSON.stringify(f) === JSON.stringify(d)) continue;

    if (typeof f === "object" && typeof d === "object" && f !== null && d !== null && !Array.isArray(f)) {
      const subDiff = {};
      const subKeys = new Set([...Object.keys(f), ...Object.keys(d)]);
      for (const sk of subKeys) {
        if (JSON.stringify(f[sk]) !== JSON.stringify(d[sk])) {
          subDiff[sk] = d[sk];
        }
      }
      if (Object.keys(subDiff).length > 0) diff[key] = subDiff;
    } else {
      diff[key] = d;
    }
  }
  return diff;
}

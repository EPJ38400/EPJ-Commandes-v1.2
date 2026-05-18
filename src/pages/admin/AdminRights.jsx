// ═══════════════════════════════════════════════════════════════
//  AdminRights — gestion fine des droits par utilisateur
//  Page dédiée avec :
//   - Sélection de l'utilisateur
//   - Vue détaillée module × action, avec droits par défaut des rôles
//   - Surcharge utilisateur (permissionsOverride) en écrasement
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect } from "react";
import { db } from "../../firebase";
import { doc, setDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import {
  MODULES, MODULE_LABELS, ACTIONS, ACTION_LABELS,
  DEFAULT_PERMISSIONS, getRoles, SCOPE_LABELS, getEffectiveRolePerms,
} from "../../core/permissions";

const SCOPE_OPTIONS = [
  { value: "default", label: "Défaut (rôle)", color: EPJ.gray500 },
  { value: "all", label: "Tout", color: EPJ.green },
  { value: "own_chantiers", label: "Mes chantiers", color: EPJ.blue },
  { value: "own_items", label: "Mes éléments", color: EPJ.orange },
  { value: false, label: "Interdit", color: EPJ.red },
];

export function AdminRights({ onBack, focusedUserId, onClearFocus }) {
  const { users, rolesConfig } = useData();
  const toast = useToast();
  const [selectedUserId, setSelectedUserId] = useState(focusedUserId || "");
  const [override, setOverride] = useState({});
  const [saving, setSaving] = useState(false);

  const user = useMemo(
    () => users.find(u => u.id === selectedUserId),
    [users, selectedUserId]
  );

  // À chaque changement d'utilisateur, on recharge sa surcharge
  useEffect(() => {
    if (user) setOverride(user.permissionsOverride || {});
  }, [user]);

  // Scope par défaut calculé à partir des rôles de l'user + overrides de rôle
  const getDefaultScope = (module, action) => {
    const roles = getRoles(user);
    let best = false;
    const rank = { "all":3, "own_chantiers":2, "own_items":1, false:0 };
    for (const r of roles) {
      const perms = getEffectiveRolePerms(r, rolesConfig);
      const s = perms?.[module]?.[action];
      if ((rank[s] || 0) > (rank[best] || 0)) best = s;
    }
    return best;
  };

  const getEffectiveScope = (module, action) => {
    const mod = override[module];
    if (mod === "all") return "all";
    if (mod === false) return false;
    if (mod && typeof mod === "object" && action in mod) return mod[action];
    return getDefaultScope(module, action);
  };

  const setScope = (module, action, newScope) => {
    setOverride(o => {
      const next = { ...o };
      if (newScope === "default") {
        // retire la surcharge pour cette cellule
        if (next[module] && typeof next[module] === "object") {
          const m = { ...next[module] };
          delete m[action];
          if (Object.keys(m).length === 0) delete next[module];
          else next[module] = m;
        }
      } else {
        if (!next[module] || typeof next[module] !== "object") next[module] = {};
        next[module] = { ...next[module], [action]: newScope };
      }
      return next;
    });
  };

  const save = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "utilisateurs", user.id), { ...user, permissionsOverride: override });
      toast("✓ Droits enregistrés");
    } catch (e) {
      toast("❌ " + e.message);
    }
    setSaving(false);
  };

  const reset = () => {
    if (!confirm("Réinitialiser tous les droits personnalisés de cet utilisateur ?")) return;
    setOverride({});
  };

  // ─── Vue : pas d'utilisateur sélectionné ───
  if (!user) {
    const sorted = [...users].sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));
    return (
      <div style={{ paddingTop: 12, paddingBottom: 24 }}>
        <SectionHeader title="Droits d'accès" onBack={onBack}/>
        <div style={{ fontSize: 13, color: EPJ.gray500, marginBottom: 14 }}>
          Choisissez l'utilisateur dont vous voulez ajuster les droits.
        </div>
        {sorted.map(u => {
          const hasOverride = u.permissionsOverride && Object.keys(u.permissionsOverride).length > 0;
          return (
            <div key={u.id} className="epj-card clickable" onClick={() => setSelectedUserId(u.id)} style={{ padding: "12px 14px", marginBottom: 6, display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: `${EPJ.blue}15`, color: EPJ.blue, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 12 }}>
                {(u.prenom?.[0] || "") + (u.nom?.[0] || "")}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: EPJ.gray900 }}>{u.prenom} {u.nom}</div>
                <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 1 }}>
                  {getRoles(u).join(" + ")}
                  {hasOverride && <span style={{ marginLeft: 6, color: EPJ.orange, fontWeight: 600 }}>• Personnalisé</span>}
                </div>
              </div>
              <span style={{ color: EPJ.gray300, fontSize: 16 }}>→</span>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Vue : utilisateur sélectionné (matrice détaillée) ───
  const hasOverride = Object.keys(override).length > 0;

  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button
          onClick={() => { setSelectedUserId(""); if (onClearFocus) onClearFocus(); }}
          style={{ background: EPJ.gray100, border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: EPJ.gray700, cursor: "pointer", fontFamily: font.body, whiteSpace: "nowrap", flexShrink: 0 }}
        >← Retour</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: font.display, fontSize: 20, fontWeight: 400, color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            {user.prenom} {user.nom}
          </div>
          <div style={{ fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3, textTransform: "uppercase", fontWeight: 500 }}>
            {getRoles(user).join(" + ")}
          </div>
        </div>
      </div>

      <div className="epj-card" style={{ padding: "12px 14px", marginBottom: 12, fontSize: 12, color: EPJ.gray700, lineHeight: 1.5, background: `${EPJ.blue}08`, borderColor: `${EPJ.blue}33` }}>
        <strong style={{ color: EPJ.blue }}>ℹ️ Les droits par défaut viennent des rôles de l'utilisateur.</strong>
        {" "}Vous pouvez les surcharger action par action ci-dessous. "Défaut (rôle)" revient au comportement standard.
      </div>

      {/* Accès admin */}
      <AdminToggle
        label="Accès à l'Administration"
        value={override._admin !== undefined ? override._admin : (getEffectiveRolePerms(getRoles(user)[0], rolesConfig)?._admin === true)}
        isOverride={override._admin !== undefined}
        onChange={(v) => {
          if (v === "default") {
            setOverride(o => { const n = { ...o }; delete n._admin; return n; });
          } else {
            setOverride(o => ({ ...o, _admin: v }));
          }
        }}
      />

      {/* Dashboards */}
      <DashboardsEditor override={override} setOverride={setOverride} user={user} rolesConfig={rolesConfig}/>

      {/* Modules */}
      {MODULES.map(mod => (
        <ModuleEditor
          key={mod}
          module={mod}
          user={user}
          override={override}
          getEffectiveScope={getEffectiveScope}
          getDefaultScope={getDefaultScope}
          setScope={setScope}
        />
      ))}

      {/* Barre d'actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 16, position: "sticky", bottom: 0, padding: "10px 0", background: "linear-gradient(180deg, transparent, rgba(250,250,250,.9) 30%, rgba(250,250,250,1))" }}>
        {hasOverride && (
          <button className="epj-btn" onClick={reset} style={{ flex: 1, background: EPJ.gray100, color: EPJ.red }}>
            ♻ Réinitialiser
          </button>
        )}
        <button className="epj-btn" onClick={save} disabled={saving} style={{ flex: 2, background: EPJ.gray900, color: "#fff" }}>
          {saving ? "Enregistrement…" : "Enregistrer les droits"}
        </button>
      </div>
    </div>
  );
}

// ─── Sous-composants ────────────────────────────────────────────

function AdminToggle({ label, value, isOverride, onChange }) {
  return (
    <div className="epj-card" style={{ padding: "14px 16px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: EPJ.gray900 }}>{label}</div>
        {isOverride && <div style={{ fontSize: 10, color: EPJ.orange, marginTop: 2, fontWeight: 600 }}>• Personnalisé</div>}
      </div>
      <div style={{ display: "flex", gap: 4 }}>
        {["default", true, false].map(opt => {
          const label = opt === "default" ? "Défaut" : opt === true ? "Oui" : "Non";
          const active = (opt === "default" && !isOverride) || (opt !== "default" && isOverride && value === opt);
          return (
            <button
              key={String(opt)}
              onClick={() => onChange(opt)}
              style={{
                padding: "6px 12px", borderRadius: 8,
                border: `1px solid ${active ? EPJ.gray900 : EPJ.gray200}`,
                background: active ? EPJ.gray900 : EPJ.white,
                color: active ? "#fff" : EPJ.gray700,
                fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font.body,
              }}
            >{label}</button>
          );
        })}
      </div>
    </div>
  );
}

function DashboardsEditor({ override, setOverride, user, rolesConfig }) {
  const roles = getRoles(user);
  const getDefault = (dash) => roles.some(r => getEffectiveRolePerms(r, rolesConfig)?._dashboards?.[dash] === true);
  const ov = override._dashboards || {};

  const setVal = (dash, val) => {
    setOverride(o => {
      const next = { ...o };
      const d = { ...(next._dashboards || {}) };
      if (val === "default") delete d[dash];
      else d[dash] = val;
      if (Object.keys(d).length === 0) delete next._dashboards;
      else next._dashboards = d;
      return next;
    });
  };

  return (
    <div className="epj-card" style={{ padding: "14px 16px", marginBottom: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900, marginBottom: 10 }}>
        Accès aux Dashboards
      </div>
      {["direction", "conducteur", "public"].map(dash => {
        const def = getDefault(dash);
        const isOverride = dash in ov;
        const effective = isOverride ? ov[dash] : def;
        return (
          <div key={dash} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${EPJ.gray100}` }}>
            <div style={{ fontSize: 12, color: EPJ.gray700, textTransform: "capitalize", display: "flex", alignItems: "center", gap: 6 }}>
              {dash}
              {isOverride && <span style={{ fontSize: 9, color: EPJ.orange, fontWeight: 600 }}>• Perso</span>}
              {!isOverride && <span style={{ fontSize: 9, color: EPJ.gray500, fontWeight: 500 }}>(défaut : {def ? "oui" : "non"})</span>}
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              {["default", true, false].map(opt => {
                const label = opt === "default" ? "Défaut" : opt === true ? "Oui" : "Non";
                const active = (opt === "default" && !isOverride) || (opt !== "default" && isOverride && ov[dash] === opt);
                return (
                  <button
                    key={String(opt)}
                    onClick={() => setVal(dash, opt)}
                    style={{
                      padding: "4px 10px", borderRadius: 6,
                      border: `1px solid ${active ? EPJ.gray900 : EPJ.gray200}`,
                      background: active ? EPJ.gray900 : EPJ.white,
                      color: active ? "#fff" : EPJ.gray700,
                      fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: font.body,
                    }}
                  >{label}</button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ModuleEditor({ module, user, override, getEffectiveScope, getDefaultScope, setScope }) {
  const [expanded, setExpanded] = useState(false);
  const hasOverride = override[module] !== undefined;

  // Accès global au module
  const accessEff = getEffectiveScope(module, "_access");
  const accessDef = getDefaultScope(module, "_access");
  const accessOverride = override[module] !== undefined && (override[module] === "all" || override[module] === false || (typeof override[module] === "object" && "_access" in override[module]));

  return (
    <div className="epj-card" style={{ padding: "14px 16px", marginBottom: 10 }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900 }}>
            {MODULE_LABELS[module]}
            {hasOverride && <span style={{ fontSize: 9, color: EPJ.orange, marginLeft: 8, fontWeight: 600 }}>• Personnalisé</span>}
          </div>
          <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 2 }}>
            Accès : {accessEff === "all" ? "✓ Autorisé" : accessEff === false || accessEff === undefined ? "✗ Interdit" : SCOPE_LABELS[accessEff]}
          </div>
        </div>
        <span style={{ color: EPJ.gray500, fontSize: 14, transform: expanded ? "rotate(90deg)" : "none", transition: "transform .2s" }}>▸</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${EPJ.gray100}` }}>
          {/* Ligne d'accès + chaque action */}
          <ScopeLine label="Accès au module" module={module} action="_access" effective={accessEff} defaultVal={accessDef} setScope={setScope} override={override}/>
          {ACTIONS.map(act => (
            <ScopeLine key={act} label={ACTION_LABELS[act]} module={module} action={act} effective={getEffectiveScope(module, act)} defaultVal={getDefaultScope(module, act)} setScope={setScope} override={override}/>
          ))}
        </div>
      )}
    </div>
  );
}

function ScopeLine({ label, module, action, effective, defaultVal, setScope, override }) {
  const mod = override[module];
  const isOverride =
    mod === "all" || mod === false
      ? true
      : typeof mod === "object" && mod !== null && action in mod;

  const current = isOverride
    ? (mod === "all" ? "all" : mod === false ? false : mod[action])
    : "default";

  return (
    <div style={{ padding: "8px 0", borderTop: `1px solid ${EPJ.gray100}` }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ fontSize: 12, color: EPJ.gray700, fontWeight: 600 }}>
          {label}
          {isOverride && <span style={{ fontSize: 9, color: EPJ.orange, marginLeft: 6, fontWeight: 600 }}>• Perso</span>}
        </div>
        <div style={{ fontSize: 10, color: EPJ.gray500 }}>
          Défaut : {defaultVal === "all" ? "Tout" : defaultVal === false || defaultVal === undefined ? "Interdit" : SCOPE_LABELS[defaultVal] || String(defaultVal)}
        </div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {SCOPE_OPTIONS.map(opt => {
          const active = current === opt.value;
          return (
            <button
              key={String(opt.value)}
              onClick={() => setScope(module, action, opt.value)}
              style={{
                padding: "5px 9px", borderRadius: 6,
                border: `1px solid ${active ? opt.color : EPJ.gray200}`,
                background: active ? `${opt.color}15` : EPJ.white,
                color: active ? opt.color : EPJ.gray700,
                fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: font.body,
              }}
            >
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
      <button onClick={onBack} style={{ background: EPJ.gray100, border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: EPJ.gray700, cursor: "pointer", fontFamily: font.body }}>
        ←
      </button>
      <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 400, color: EPJ.gray900, letterSpacing: "-0.02em" }}>
        {title}
      </div>
    </div>
  );
}

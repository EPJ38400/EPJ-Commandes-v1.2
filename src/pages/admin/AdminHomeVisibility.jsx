// ═══════════════════════════════════════════════════════════════
//  AdminHomeVisibility — « Visibilité accueil par rôle »
//  Curation des tuiles de la page d'accueil + accès dashboards, par rôle.
//  Donnée pure stockée dans Firestore rolesConfig/{role} :
//    _homeTiles : { [tileId]: true|false }  (masquage tuiles accueil)
//    _dashboards : { direction, conducteur, public }  (même clé que Rôles types)
//  N'écrit QUE ces 2 clés (merge) → ne touche pas aux permissions du rôle.
//  Masquer une tuile ne retire PAS l'accès au module : ça épure l'accueil.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import { db } from "../../firebase";
import { doc, setDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import { Button } from "../../core/components/Button";
import { ROLES, getEffectiveRolePerms } from "../../core/permissions";

// Les 8 tuiles de la page d'accueil — id/label alignés sur HomePage.jsx
// (MODULES_META + PLANNING_TILE + DASHBOARD_TILE + COLLECTION_DASHBOARDS_TILE).
const HOME_TILES = [
  { id: "commandes",             icon: "📦",  label: "Commandes" },
  { id: "avancement",            icon: "📊",  label: "Avancement chantier" },
  { id: "parc-machines",         icon: "🔧",  label: "Parc machines" },
  { id: "reserves",              icon: "📝",  label: "Réserves & quitus" },
  { id: "gestionChantier",       icon: "🏗️", label: "Gestion de chantier" },
  { id: "planning",              icon: "📆",  label: "Planning" },
  { id: "dashboard",             icon: "📊",  label: "Dashboard" },
  { id: "collection-dashboards", icon: "🧾",  label: "Collection Dashboards" },
];

const DASHBOARDS = [
  { key: "direction",  label: "Direction" },
  { key: "conducteur", label: "Conducteur" },
  { key: "public",     label: "Public" },
];

export function AdminHomeVisibility({ onBack }) {
  const { rolesConfig } = useData();
  const toast = useToast();
  const [selectedRole, setSelectedRole] = useState(null);
  const [tiles, setTiles] = useState({});        // { [tileId]: bool }
  const [dashboards, setDashboards] = useState({});
  const [saving, setSaving] = useState(false);

  // Charge les valeurs effectives du rôle (factory + override) dans le draft
  useEffect(() => {
    if (!selectedRole) return;
    const eff = getEffectiveRolePerms(selectedRole, rolesConfig);
    const homeTiles = eff?._homeTiles || {};
    const t = {};
    HOME_TILES.forEach(({ id }) => { t[id] = homeTiles[id] !== false; }); // défaut ON
    setTiles(t);
    const d = eff?._dashboards || {};
    setDashboards({
      direction: !!d.direction, conducteur: !!d.conducteur, public: !!d.public,
    });
  }, [selectedRole, rolesConfig]);

  const save = async () => {
    if (!selectedRole) return;
    setSaving(true);
    try {
      const _homeTiles = {};
      HOME_TILES.forEach(({ id }) => { _homeTiles[id] = tiles[id] !== false; });
      const _dashboards = {
        direction: !!dashboards.direction,
        conducteur: !!dashboards.conducteur,
        public: !!dashboards.public,
      };
      await setDoc(
        doc(db, "rolesConfig", selectedRole),
        { _homeTiles, _dashboards },
        { merge: true },
      );
      toast("✓ Visibilité accueil mise à jour");
    } catch (e) {
      console.error(e);
      toast("❌ " + e.message);
    }
    setSaving(false);
  };

  // ──── Vue 1 : liste des rôles ────
  if (!selectedRole) {
    return (
      <div style={{ paddingTop: 12, paddingBottom: 24 }}>
        <SectionHeader title="Visibilité accueil" onBack={onBack} />

        <div className="epj-card" style={{ padding: "12px 14px", marginBottom: 14, fontSize: 12, color: EPJ.gray700, lineHeight: 1.5, background: `${EPJ.blue}08`, borderColor: `${EPJ.blue}33` }}>
          <strong style={{ color: EPJ.blue }}>ℹ Épure l'accueil sans retirer d'accès.</strong>
          {" "}Masquer une tuile retire seulement son raccourci de la page d'accueil du rôle ; l'accès au module reste géré dans « Rôles types » / « Droits des utilisateurs ».
        </div>

        {ROLES.map(r => (
          <div
            key={r}
            className="epj-card clickable"
            onClick={() => setSelectedRole(r)}
            style={{ padding: "14px 16px", marginBottom: 8, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}
          >
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: `${EPJ.blue}15`, color: EPJ.blue,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}>🏠</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: EPJ.gray900 }}>{r}</div>
              <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 2 }}>
                Tuiles d'accueil & dashboards visibles
              </div>
            </div>
            <span style={{ color: EPJ.gray300, fontSize: 16 }}>→</span>
          </div>
        ))}
      </div>
    );
  }

  // ──── Vue 2 : édition d'un rôle ────
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
            Visibilité accueil
          </div>
        </div>
      </div>

      <div className="epj-card" style={{ padding: "12px 14px", marginBottom: 12, fontSize: 12, color: EPJ.gray700, lineHeight: 1.5, background: `${EPJ.blue}08`, borderColor: `${EPJ.blue}33` }}>
        Masquer une tuile ne retire pas l'accès au module ; ça épure l'accueil. Une tuile reste affichée tant que le rôle a le droit d'accès au module correspondant.
      </div>

      {/* Section TUILES */}
      <div className="epj-card" style={{ padding: "14px 16px", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900, marginBottom: 4 }}>
          Tuiles d'accueil
        </div>
        {HOME_TILES.map(({ id, icon, label }) => (
          <ToggleRow
            key={id}
            label={<span>{icon} {label}</span>}
            value={tiles[id] !== false}
            onChange={(v) => setTiles(t => ({ ...t, [id]: v }))}
          />
        ))}
      </div>

      {/* Section DASHBOARDS */}
      <div className="epj-card" style={{ padding: "14px 16px", marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900, marginBottom: 4 }}>
          Accès aux dashboards
        </div>
        {DASHBOARDS.map(({ key, label }) => (
          <ToggleRow
            key={key}
            label={label}
            value={!!dashboards[key]}
            onChange={(v) => setDashboards(d => ({ ...d, [key]: v }))}
          />
        ))}
      </div>

      {/* Barre sticky d'actions */}
      <div style={{
        display: "flex", gap: 8, marginTop: 16,
        position: "sticky", bottom: 0, padding: "12px 0",
        background: "linear-gradient(180deg, transparent, rgba(250,250,250,.9) 30%, rgba(250,250,250,1))",
      }}>
        <Button variant="primary" full loading={saving} onClick={save}>
          {saving ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderTop: `1px solid ${EPJ.gray100}` }}>
      <div style={{ fontSize: 13, color: EPJ.gray700 }}>{label}</div>
      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
        {[true, false].map(v => (
          <button key={String(v)} onClick={() => onChange(v)} style={{
            padding: "5px 12px", borderRadius: 6,
            border: `1px solid ${value === v ? (v ? EPJ.green : EPJ.gray400) : EPJ.gray200}`,
            background: value === v ? (v ? `${EPJ.green}15` : EPJ.gray100) : EPJ.white,
            color: value === v ? (v ? EPJ.green : EPJ.gray700) : EPJ.gray500,
            fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font.body,
          }}>{v ? "Visible" : "Masqué"}</button>
        ))}
      </div>
    </div>
  );
}

function SectionHeader({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <button onClick={onBack} style={{ background: EPJ.gray100, border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 13, fontWeight: 600, color: EPJ.gray700, cursor: "pointer", fontFamily: font.body, whiteSpace: "nowrap", flexShrink: 0 }}>← Retour</button>
      <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 400, color: EPJ.gray900, letterSpacing: "-0.02em" }}>{title}</div>
    </div>
  );
}

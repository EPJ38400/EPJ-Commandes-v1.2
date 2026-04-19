// ═══════════════════════════════════════════════════════════════
//  HomePage — page de garde de l'EPJ App Globale
//  Grille de 5 tuiles modules + accès aux dashboards et à l'admin
//  Règle UX : tuile masquée si l'utilisateur n'a pas le droit d'accès.
// ═══════════════════════════════════════════════════════════════
import { EPJ, font } from "../core/theme";
import { useAuth } from "../core/AuthContext";
import { can } from "../core/permissions";

// Définition des 5 modules métier (ordre logique métier EPJ)
const MODULES_META = [
  {
    id: "commandes",
    title: "Commandes",
    subtitle: "Matériel et équipement",
    icon: "📦",
    accent: EPJ.blue,
    enabled: true,      // seul module implémenté à ce stade
  },
  {
    id: "avancement",
    title: "Avancement chantier",
    subtitle: "Suivi photo et progression",
    icon: "📸",
    accent: EPJ.green,
    enabled: false,
  },
  {
    id: "parc-machines",
    title: "Parc machines",
    subtitle: "Outillage et véhicules",
    icon: "🔧",
    accent: EPJ.orange,
    enabled: false,
  },
  {
    id: "reserves-quitus",
    title: "Réserves & quitus",
    subtitle: "Contrôles et livraisons",
    icon: "✍️",
    accent: "#8E44AD",
    enabled: false,
  },
  {
    id: "suivi-esabora",
    title: "Suivi chantier",
    subtitle: "Liaison Esabora",
    icon: "📋",
    accent: EPJ.gray700,
    enabled: false,
  },
];

const DASHBOARDS_META = [
  { id: "direction",  title: "Dashboard Direction",  icon: "📊" },
  { id: "conducteur", title: "Dashboard Conducteur", icon: "📈" },
];

export function HomePage({ onOpenModule, onOpenDashboard, onOpenAdmin }) {
  const { user } = useAuth();
  if (!user) return null;

  const visibleModules = MODULES_META.filter(m => can(user, m.id, "_access"));
  const visibleDashboards = DASHBOARDS_META.filter(d => can(user, "_dashboards", d.id));
  const showAdmin = can(user, "_admin");

  return (
    <div style={{ paddingTop: 24, paddingBottom: 24 }}>
      {/* Accroche : petite phrase éditoriale pour humaniser */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontFamily: font.display, fontSize: 28, fontWeight: 400,
          color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.1,
        }}>
          Bonjour, <span style={{ fontStyle: "italic" }}>{user.prenom}</span>.
        </div>
        <div style={{
          fontSize: 13, color: EPJ.gray500, marginTop: 4, fontWeight: 400,
        }}>
          Que souhaitez-vous faire aujourd'hui ?
        </div>
      </div>

      {/* Grille 5 tuiles modules (2 colonnes, la 5ᵉ prend toute la largeur) */}
      {visibleModules.length > 0 ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}>
          {visibleModules.map((mod, i) => (
            <Tile
              key={mod.id}
              meta={mod}
              onClick={() => mod.enabled && onOpenModule(mod.id)}
              isFullWidth={visibleModules.length % 2 === 1 && i === visibleModules.length - 1}
              index={i}
            />
          ))}
        </div>
      ) : (
        <div style={{
          background: EPJ.gray50, border: `1px solid ${EPJ.gray200}`,
          borderRadius: 14, padding: 20, textAlign: "center",
          fontSize: 13, color: EPJ.gray500,
        }}>
          Aucun module ne vous est accessible pour l'instant. Contactez votre administrateur.
        </div>
      )}

      {/* Dashboards (si droit) */}
      {visibleDashboards.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <SectionTitle>Pilotage</SectionTitle>
          {visibleDashboards.map(d => (
            <DashboardRow
              key={d.id}
              meta={d}
              onClick={() => onOpenDashboard(d.id)}
            />
          ))}
        </div>
      )}

      {/* Administration (si droit) */}
      {showAdmin && (
        <div style={{ marginTop: 28 }}>
          <SectionTitle>Système</SectionTitle>
          <div
            className="epj-card clickable"
            onClick={onOpenAdmin}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "14px 16px",
            }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 8, background: EPJ.gray900,
              color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16,
            }}>⚙</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: EPJ.gray900 }}>Administration</div>
              <div style={{ fontSize: 12, color: EPJ.gray500 }}>
                Utilisateurs, chantiers, droits, catalogue
              </div>
            </div>
            <span style={{ color: EPJ.gray300, fontSize: 18 }}>→</span>
          </div>
        </div>
      )}

      {/* Note d'information si un seul module dispo (stade actuel de dev) */}
      {visibleModules.length === 1 && visibleModules[0].id === "commandes" && (
        <div style={{
          marginTop: 24, padding: "12px 14px",
          background: `${EPJ.blue}08`, border: `1px solid ${EPJ.blue}22`,
          borderRadius: 12, fontSize: 12, color: EPJ.gray700, lineHeight: 1.5,
        }}>
          <strong style={{ color: EPJ.blue }}>Environnement de développement</strong> — les 4 autres
          modules seront ajoutés au fur et à mesure. Vous pouvez dès à présent tester
          le module Commandes comme avant.
        </div>
      )}
    </div>
  );
}

// ─── Tuile d'un module ─────────────────────────────────────────
function Tile({ meta, onClick, isFullWidth, index }) {
  const accent = meta.accent;
  return (
    <div
      className="epj-tile"
      onClick={onClick}
      style={{
        "--accent": accent,
        "--accent-soft": `${accent}1A`,
        gridColumn: isFullWidth ? "1 / -1" : undefined,
        opacity: meta.enabled ? 1 : 0.55,
        cursor: meta.enabled ? "pointer" : "not-allowed",
        animation: `stagger .35s ease both`,
        animationDelay: `${index * 60}ms`,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div className="epj-tile-icon">{meta.icon}</div>
        {!meta.enabled && (
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: "uppercase",
            padding: "3px 8px", borderRadius: 999,
            background: EPJ.gray100, color: EPJ.gray500,
          }}>
            Bientôt
          </span>
        )}
      </div>
      <div>
        <div style={{
          fontWeight: 600, fontSize: 15, color: EPJ.gray900, letterSpacing: "-0.01em",
          lineHeight: 1.2,
        }}>
          {meta.title}
        </div>
        <div style={{ fontSize: 12, color: EPJ.gray500, marginTop: 2 }}>
          {meta.subtitle}
        </div>
      </div>
    </div>
  );
}

function DashboardRow({ meta, onClick }) {
  return (
    <div
      className="epj-card clickable"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 16px", marginBottom: 8,
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 8, background: `${EPJ.blue}1A`,
        color: EPJ.blue, display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 16,
      }}>{meta.icon}</div>
      <div style={{ flex: 1, fontWeight: 600, fontSize: 14, color: EPJ.gray900 }}>
        {meta.title}
      </div>
      <span style={{ color: EPJ.gray300, fontSize: 18 }}>→</span>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{
      fontSize: 11, fontWeight: 600, color: EPJ.gray500,
      letterSpacing: 1.2, textTransform: "uppercase",
      marginBottom: 10, paddingLeft: 4,
    }}>
      {children}
    </div>
  );
}

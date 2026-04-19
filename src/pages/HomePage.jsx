// ═══════════════════════════════════════════════════════════════
//  HomePage — page de garde de l'EPJ App Globale
//  6 tuiles (5 modules + 1 Dashboard) en 3 lignes de 2
//  Pas de section Pilotage ni Administration séparée (dans le header)
// ═══════════════════════════════════════════════════════════════
import { EPJ, font } from "../core/theme";
import { useAuth } from "../core/AuthContext";
import { useData } from "../core/DataContext";
import { can } from "../core/permissions";

// 5 modules métier
const MODULES_META = [
  {
    id: "commandes",
    title: "Commandes",
    subtitle: "Matériel et équipement",
    icon: "📦",
    accent: EPJ.blue,
    enabled: true,
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

// Tuile Dashboard (6ᵉ tuile, accent cyan EPJ)
const DASHBOARD_TILE = {
  id: "dashboard",
  title: "Dashboard",
  subtitle: "Vue de pilotage",
  icon: "📊",
  accent: EPJ.blue,
  enabled: true,
};

export function HomePage({ onOpenModule, onOpenDashboard }) {
  const { user } = useAuth();
  const { rolesConfig } = useData();
  if (!user) return null;

  // Filtre des modules selon les droits (tuile masquée si pas d'accès)
  const visibleModules = MODULES_META.filter(m => can(user, m.id, "_access", rolesConfig));

  // Dashboard visible si l'utilisateur a accès à au moins un dashboard
  const showDashboard =
    can(user, "_dashboards", "direction", rolesConfig) ||
    can(user, "_dashboards", "conducteur", rolesConfig) ||
    can(user, "_dashboards", "public", rolesConfig);

  // Liste finale (modules + éventuellement la tuile Dashboard à la fin)
  const allTiles = showDashboard
    ? [...visibleModules, DASHBOARD_TILE]
    : visibleModules;

  return (
    <div style={{ paddingTop: 16, paddingBottom: 20 }}>
      {/* Accroche éditoriale */}
      <div style={{ marginBottom: 18 }}>
        <div style={{
          fontFamily: font.display, fontSize: 26, fontWeight: 400,
          color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.1,
        }}>
          Bonjour, <span style={{ fontStyle: "italic" }}>{user.prenom}</span>.
        </div>
        <div style={{
          fontSize: 13, color: EPJ.gray500, marginTop: 4, fontWeight: 400,
        }}>
          Que souhaitez-vous faire aujourd'hui&nbsp;?
        </div>
      </div>

      {/* Grille de tuiles (2 colonnes) — 5 modules + 1 dashboard si droit */}
      {allTiles.length > 0 ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 10,
        }}>
          {allTiles.map((tile, i) => (
            <Tile
              key={tile.id}
              meta={tile}
              onClick={() => {
                if (!tile.enabled) return;
                if (tile.id === "dashboard") onOpenDashboard(user);
                else onOpenModule(tile.id);
              }}
              isFullWidth={allTiles.length % 2 === 1 && i === allTiles.length - 1}
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
    </div>
  );
}

// ─── Tuile d'un module ou du dashboard ────────────────────────
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

// ═══════════════════════════════════════════════════════════════
//  HomePage v9 — page de garde de l'EPJ App Globale
//  - Tuiles avec badges de notification (retards outils, avancement)
//  - Bannière rappel avancement le 20+ du mois
// ═══════════════════════════════════════════════════════════════
import { useMemo } from "react";
import { EPJ, font } from "../core/theme";
import { useAuth } from "../core/AuthContext";
import { useData } from "../core/DataContext";
import { can } from "../core/permissions";
import {
  computeParcNotifications, computeAvancementNotifications,
  isRappelAvancementActif, currentMonthLabel,
} from "../core/notificationsUtils";

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
    subtitle: "Progression par tâche et bâtiment",
    icon: "📊",
    accent: EPJ.green,
    enabled: true,
  },
  {
    id: "parc-machines",
    title: "Parc machines",
    subtitle: "Outillage et véhicules",
    icon: "🔧",
    accent: EPJ.orange,
    enabled: true,
  },
  {
    id: "reserves",
    title: "Réserves & quitus",
    subtitle: "Suivi SAV & garantie",
    icon: "📝",
    accent: "#8E44AD",
    enabled: true,
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
  const { rolesConfig, outillageSorties, avancementValidations, chantiers, reserves } = useData();
  if (!user) return null;

  const visibleModules = MODULES_META.filter(m => {
    // Le module Réserves utilise la clé permissions "reserves-quitus"
    const permKey = m.id === "reserves" ? "reserves-quitus" : m.id;
    return can(user, permKey, "_access", rolesConfig);
  });
  const showDashboard =
    can(user, "_dashboards", "direction", rolesConfig) ||
    can(user, "_dashboards", "conducteur", rolesConfig) ||
    can(user, "_dashboards", "public", rolesConfig);

  const allTiles = showDashboard
    ? [...visibleModules, DASHBOARD_TILE]
    : visibleModules;

  // ─── Calcul des notifications ───
  const notifications = useMemo(() => {
    // Retards réserves : non levées + en retard (RDV non pris J+2 OU date limite dépassée)
    // On ne compte que celles attribuées à l'utilisateur courant ou (si admin/vue "all") toutes
    const canSeeAll = can(user, "reserves-quitus", "view", rolesConfig) === "all";
    const myReserves = reserves.filter(r => {
      if (["levee","quitus_signe","cloturee"].includes(r.statut)) return false;
      if (canSeeAll) return true;
      return r.affecteAUserId === user._id;
    });
    const retards = myReserves.filter(r => {
      // Soit RDV non pris depuis 2+ jours
      if (r.statut === "attribuee" && !r.rdvPris && r.dateAffectation) {
        const days = Math.round((new Date() - new Date(r.dateAffectation)) / (1000*60*60*24));
        if (days >= 2) return true;
      }
      // Soit date limite dépassée
      if (r.dateLimite && new Date(r.dateLimite) < new Date()) return true;
      return false;
    });
    return {
      "parc-machines": computeParcNotifications(outillageSorties),
      "avancement": computeAvancementNotifications({
        avancementValidations, chantiers, user,
      }),
      "reserves": retards.length > 0
        ? { count: retards.length, label: `${retards.length} en retard` }
        : null,
    };
  }, [outillageSorties, avancementValidations, chantiers, user, reserves, rolesConfig]);

  const showRappelAvancement = isRappelAvancementActif()
    && (notifications.avancement?.count || 0) > 0;

  return (
    <div style={{ paddingTop: 16, paddingBottom: 20 }}>
      {/* Accroche éditoriale */}
      <div style={{ marginBottom: 14 }}>
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

      {/* Bannière rappel outils en retard */}
      {(notifications["parc-machines"]?.count || 0) > 0 && (
        <div
          onClick={() => onOpenModule("parc-machines")}
          style={{
            marginBottom: 10, padding: "12px 14px",
            background: `${EPJ.red}10`,
            border: `1px solid ${EPJ.red}40`,
            borderLeft: `3px solid ${EPJ.red}`,
            borderRadius: 10,
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 12,
          }}
        >
          <div style={{ fontSize: 22 }}>⏰</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900 }}>
              {notifications["parc-machines"].count} outil{notifications["parc-machines"].count > 1 ? "s" : ""} en retard
            </div>
            <div style={{ fontSize: 11, color: EPJ.gray600, marginTop: 2, lineHeight: 1.4 }}>
              Tape ici pour voir la liste et envoyer les SMS de rappel.
            </div>
          </div>
          <span style={{ color: EPJ.red, fontSize: 18, fontWeight: 700 }}>→</span>
        </div>
      )}

      {/* Bannière rappel réserves en retard */}
      {(notifications.reserves?.count || 0) > 0 && (
        <div
          onClick={() => onOpenModule("reserves")}
          style={{
            marginBottom: 10, padding: "12px 14px",
            background: `${EPJ.red}10`,
            border: `1px solid ${EPJ.red}40`,
            borderLeft: `3px solid ${EPJ.red}`,
            borderRadius: 10,
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 12,
          }}
        >
          <div style={{ fontSize: 22 }}>📝</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900 }}>
              {notifications.reserves.count} réserve{notifications.reserves.count > 1 ? "s" : ""} en retard
            </div>
            <div style={{ fontSize: 11, color: EPJ.gray600, marginTop: 2, lineHeight: 1.4 }}>
              Tape ici pour voir les réserves non traitées dans les délais.
            </div>
          </div>
          <span style={{ color: EPJ.red, fontSize: 18, fontWeight: 700 }}>→</span>
        </div>
      )}

      {/* Bannière rappel avancement du mois */}
      {showRappelAvancement && (
        <div
          onClick={() => onOpenModule("avancement")}
          style={{
            marginBottom: 14, padding: "12px 14px",
            background: `${EPJ.red}0A`,
            border: `1px solid ${EPJ.red}30`,
            borderLeft: `3px solid ${EPJ.red}`,
            borderRadius: 10,
            cursor: "pointer",
            display: "flex", alignItems: "center", gap: 12,
          }}
        >
          <div style={{ fontSize: 22 }}>⏰</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900 }}>
              Avancement de {currentMonthLabel()} à remplir
            </div>
            <div style={{ fontSize: 11, color: EPJ.gray600, marginTop: 2, lineHeight: 1.4 }}>
              {notifications.avancement.label} — tape ici pour accéder au module.
            </div>
          </div>
          <span style={{ color: EPJ.red, fontSize: 18, fontWeight: 700 }}>→</span>
        </div>
      )}

      {/* Grille de tuiles */}
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
              notif={notifications[tile.id]}
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

// ─── Tuile avec badge ─────────────────────────────────────────
function Tile({ meta, notif, onClick, isFullWidth, index }) {
  const accent = meta.accent;
  const hasNotif = notif && notif.count > 0;
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
        position: "relative",
      }}
    >
      {/* Badge notification (coin haut droit) */}
      {hasNotif && (
        <div style={{
          position: "absolute", top: 10, right: 10,
          background: EPJ.red, color: "#fff",
          minWidth: 22, height: 22, borderRadius: 999,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 800,
          fontVariantNumeric: "tabular-nums",
          padding: "0 6px",
          boxShadow: `0 0 0 3px ${EPJ.red}30`,
          zIndex: 2,
        }}>{notif.count}</div>
      )}

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
        {hasNotif && notif.label && (
          <div style={{
            fontSize: 10, color: EPJ.red, fontWeight: 700, marginTop: 4,
            lineHeight: 1.3,
          }}>
            ⚠ {notif.label}
          </div>
        )}
      </div>
    </div>
  );
}

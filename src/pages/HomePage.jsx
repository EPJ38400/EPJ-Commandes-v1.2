// ═══════════════════════════════════════════════════════════════
//  HomePage v9 — page de garde de l'EPJ App Globale
//  - Tuiles avec badges de notification (retards outils, avancement)
//  - Bannière rappel avancement le 20+ du mois
// ═══════════════════════════════════════════════════════════════
import { useMemo } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../core/theme";
import { Banner } from "../core/components/Banner";
import { Badge } from "../core/components/Badge";
import { useViewport } from "../core/useViewport";
import { useAuth } from "../core/AuthContext";
import { useData } from "../core/DataContext";
import { can } from "../core/permissions";
import { canSeeDashboards } from "../core/dashboardsAccess";
import {
  computeParcNotifications, computeAvancementNotifications,
  isRappelAvancementActif, currentMonthLabel,
} from "../core/notificationsUtils";
// v10.J — bannière "commandes en retard" basée sur la date pertinente
import { isOrderLate } from "../modules/commandes/orderDates";

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
    accent: EPJ.catEtude,
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

// Collection Dashboards (Module Commande étape 4) — page indépendante,
// distincte de la tuile "Dashboard" ci-dessus (dashboards direction/public).
const COLLECTION_DASHBOARDS_TILE = {
  id: "collection-dashboards",
  title: "Collection Dashboards",
  subtitle: "Dashboard achat & pilotage",
  icon: "🧾",
  accent: EPJ.blue,
  enabled: true,
};

export function HomePage({ onOpenModule, onOpenDashboard, onOpenCollectionDashboards }) {
  const { user } = useAuth();
  const isMobile = useViewport() === "mobile";
  const { rolesConfig, outillageSorties, avancementValidations, chantiers, reserves, commandes, featureFlags = {} } = useData();
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

  const allTiles = [
    ...visibleModules,
    ...(showDashboard ? [DASHBOARD_TILE] : []),
    ...(canSeeDashboards(user) ? [COLLECTION_DASHBOARDS_TILE] : []),
  ];

  // ─── Calcul des notifications ───
  const notifications = useMemo(() => {
    // Retards réserves : non levées + en retard (RDV non pris J+2 OU date limite dépassée)
    // On ne compte que celles attribuées à l'utilisateur courant ou (si admin/vue "all") toutes
    const canSeeAll = can(user, "reserves-quitus", "view", rolesConfig) === "all";
    const safeReserves = reserves || [];
    const myReserves = safeReserves.filter(r => {
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

    // v10.C — Réserves à TRAITER (attribuées à l'user mais pas encore levées,
    //         et pas déjà dans "retards" pour éviter le doublon)
    const retardIds = new Set(retards.map(r => r._id));
    const mesReservesATraiter = safeReserves.filter(r => {
      if (["levee","quitus_signe","cloturee"].includes(r.statut)) return false;
      if (r.affecteAUserId !== user._id) return false;
      if (retardIds.has(r._id)) return false;
      return true;
    });

    // v10.C — RDV dans les prochaines 48h (assignés à l'user)
    const now = new Date();
    const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
    const mesRdvImminents = safeReserves.filter(r => {
      if (["levee","quitus_signe","cloturee"].includes(r.statut)) return false;
      if (r.affecteAUserId !== user._id) return false;
      if (!r.rdvPris || !r.dateRdv) return false;
      const rdvDate = new Date(r.dateRdv);
      return rdvDate >= now && rdvDate <= in48h;
    });

    // v10.E — Notifications COMMANDES filtrées par utilisateur
    //   Avant (v10.D) : un user pilotage (Admin/Direction/Assistante) voyait
    //   TOUTES les commandes de la boîte → bannière "5 commandes à valider"
    //   alors qu'aucune ne le concernait personnellement. Très perturbant.
    //
    //   Maintenant : on filtre TOUJOURS par les chantiers dont la personne
    //   est conducteur (via affectations.conducteurId OU via le legacy
    //   chantier.conducteur == "Prénom Nom"). Les rôles pilotage qui ne sont
    //   pas conducteurs n'ont donc plus de bannières commandes intempestives ;
    //   ils retrouvent la vue d'ensemble dans le Dashboard Direction.
    const safeCommandes = commandes || [];
    const uid = user?._id || user?.id;
    const fullName = `${user?.prenom || ""} ${user?.nom || ""}`.trim();

    // Mes chantiers en tant que conducteur (deux conventions de stockage)
    const isMyChantier = (ch) => {
      if (!ch) return false;
      if (ch.affectations?.conducteurId === uid) return true;
      if (ch.conducteur && ch.conducteur === fullName) return true;
      return false;
    };

    const isMyCommande = (cmd) => {
      if (!cmd?.chantier) return false;
      const monChantier = chantiers.find(c => c.nom === cmd.chantier && isMyChantier(c));
      return !!monChantier;
    };

    // Commandes À VALIDER (statut = "En attente de validation")
    const commandesAValider = safeCommandes.filter(cmd =>
      cmd.statut === "En attente de validation" && isMyCommande(cmd)
    );

    // Commandes VALIDÉES MAIS NON ENVOYÉES (nouveau statut v10.D)
    const commandesAEnvoyer = safeCommandes.filter(cmd =>
      cmd.statut === "Validée" && isMyCommande(cmd)
    );

    // v10.J — Commandes EN RETARD de réception
    // On utilise isOrderLate centralisé :
    //   - exclut En attente / Validée / Refusée / Réceptionnée
    //   - exclut les commandes déjà signées (signatureData posée)
    //   - utilise la date AR fournisseur si OCR activé + datelivraison présente,
    //     sinon retombe sur la date de réception souhaitée
    const commandesEnRetard = safeCommandes.filter(cmd =>
      isMyCommande(cmd) && isOrderLate(cmd, { featureFlags })
    );

    // v10.L — Commandes À ENVOYER DANS ESABORA
    // Affiché uniquement si esaboraEnabled === true
    // Compte les commandes "Envoyée aux achats" pas encore syncées (esaboraStatus !== "synced")
    // v10.L.4 — Bannière restreinte aux rôles "achats" (Admin/Direction/Assistante).
    //           Les autres rôles (conducteur travaux, monteur, etc.) ne la voient pas :
    //           ils ne peuvent pas agir, donc inutile de leur afficher.
    const canSendEsabora = (() => {
      if (!user) return false;
      const roles = Array.isArray(user.roles) ? user.roles
                  : (user.role ? [user.role] : []);
      const fonction = user.fonction || "";
      if (roles.includes("Admin") || fonction === "Admin") return true;
      if (roles.includes("Direction") || fonction === "Direction") return true;
      if (roles.some(r => (r||"").toLowerCase().includes("assist"))) return true;
      if ((fonction||"").toLowerCase().includes("assist")) return true;
      return false;
    })();
    const commandesAEsabora = (featureFlags.esaboraEnabled && canSendEsabora)
      ? safeCommandes.filter(cmd =>
          (cmd.statut === "Envoyée aux achats" || cmd.statut === "Commandée")
          && cmd.esaboraStatus !== "synced"
          && cmd.esaboraStatus !== "partial"
          && isMyCommande(cmd)
        )
      : [];

    return {
      "parc-machines": computeParcNotifications(outillageSorties),
      "avancement": computeAvancementNotifications({
        avancementValidations, chantiers, user,
      }),
      "reserves": retards.length > 0
        ? { count: retards.length, label: `${retards.length} en retard` }
        : null,
      "reservesATraiter": mesReservesATraiter.length > 0
        ? { count: mesReservesATraiter.length }
        : null,
      "rdvImminents": mesRdvImminents.length > 0
        ? { count: mesRdvImminents.length, items: mesRdvImminents }
        : null,
      "commandesAValider": commandesAValider.length > 0
        ? { count: commandesAValider.length }
        : null,
      "commandesAEnvoyer": commandesAEnvoyer.length > 0
        ? { count: commandesAEnvoyer.length }
        : null,
      "commandesEnRetard": commandesEnRetard.length > 0
        ? { count: commandesEnRetard.length }
        : null,
      "commandesAEsabora": commandesAEsabora.length > 0
        ? { count: commandesAEsabora.length }
        : null,
    };
  }, [outillageSorties, avancementValidations, chantiers, user, reserves, commandes, rolesConfig, featureFlags]);

  const showRappelAvancement = isRappelAvancementActif()
    && (notifications.avancement?.count || 0) > 0;

  return (
    <div style={{ paddingTop: 16, paddingBottom: 20 }}>
      {/* Accroche éditoriale */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          fontFamily: font.display, fontSize: 26, fontWeight: fontWeight.regular,
          color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.1,
        }}>
          Bonjour, <span style={{ fontStyle: "italic" }}>{user.prenom}</span>.
        </div>
        <div style={{
          fontSize: fontSize.sm, color: EPJ.gray500, marginTop: space.xs, fontWeight: fontWeight.regular,
        }}>
          Que souhaitez-vous faire aujourd'hui&nbsp;?
        </div>
      </div>

      {/* Bannière rappel outils en retard */}
      {(notifications["parc-machines"]?.count || 0) > 0 && (
        <Banner
          tone="danger"
          icon="⏰"
          title={`${notifications["parc-machines"].count} outil${notifications["parc-machines"].count > 1 ? "s" : ""} en retard`}
          text="Tape ici pour voir la liste et envoyer les SMS de rappel."
          onClick={() => onOpenModule("parc-machines")}
        />
      )}

      {/* v10.D — Bannière COMMANDES À VALIDER (conducteur / admin) */}
      {(notifications.commandesAValider?.count || 0) > 0 && (
        <Banner
          tone="warning"
          icon="⏳"
          title={`${notifications.commandesAValider.count} commande${notifications.commandesAValider.count > 1 ? "s" : ""} à valider`}
          text="Un monteur attend ta validation — tape ici."
          onClick={() => onOpenModule("commandes")}
        />
      )}

      {/* v10.D — Bannière COMMANDES VALIDÉES EN ATTENTE D'ENVOI */}
      {(notifications.commandesAEnvoyer?.count || 0) > 0 && (
        <Banner
          tone="info"
          icon="📤"
          title={`${notifications.commandesAEnvoyer.count} commande${notifications.commandesAEnvoyer.count > 1 ? "s" : ""} à envoyer`}
          text="Commandes validées mais pas encore envoyées aux achats."
          onClick={() => onOpenModule("commandes")}
        />
      )}

      {/* v10.D — Bannière COMMANDES EN RETARD de réception */}
      {(notifications.commandesEnRetard?.count || 0) > 0 && (
        <Banner
          tone="danger"
          icon="⏰"
          title={`${notifications.commandesEnRetard.count} commande${notifications.commandesEnRetard.count > 1 ? "s" : ""} en retard de livraison`}
          text="La date de réception prévue est dépassée."
          onClick={() => onOpenModule("commandes")}
        />
      )}

      {/* v10.L — Bannière COMMANDES À ENVOYER DANS ESABORA */}
      {(notifications.commandesAEsabora?.count || 0) > 0 && (
        <Banner
          tone="info"
          icon="🔗"
          title={`${notifications.commandesAEsabora.count} commande${notifications.commandesAEsabora.count > 1 ? "s" : ""} à envoyer dans Esabora`}
          text="Pas encore synchronisée avec l'ERP."
          onClick={() => onOpenModule("commandes")}
        />
      )}

      {/* v10.C — Bannière rappel RDV imminents (priorité haute) */}
      {(notifications.rdvImminents?.count || 0) > 0 && (
        <Banner
          tone="warning"
          icon="📅"
          title={`${notifications.rdvImminents.count} RDV prévu${notifications.rdvImminents.count > 1 ? "s" : ""} dans les 48 h`}
          text="Tape ici pour voir tes prochains rendez-vous d'intervention."
          onClick={() => onOpenModule("reserves")}
        />
      )}

      {/* v10.C — Bannière "réserves à traiter" (attribuées, pas en retard) */}
      {(notifications.reservesATraiter?.count || 0) > 0 && (
        <Banner
          tone="info"
          icon="📝"
          title={`${notifications.reservesATraiter.count} réserve${notifications.reservesATraiter.count > 1 ? "s" : ""} à traiter`}
          text="Tape ici pour voir tes réserves attribuées à planifier ou à lever."
          onClick={() => onOpenModule("reserves")}
        />
      )}

      {/* Bannière rappel réserves en retard */}
      {(notifications.reserves?.count || 0) > 0 && (
        <Banner
          tone="danger"
          icon="📝"
          title={`${notifications.reserves.count} réserve${notifications.reserves.count > 1 ? "s" : ""} en retard`}
          text="Tape ici pour voir les réserves non traitées dans les délais."
          onClick={() => onOpenModule("reserves")}
        />
      )}

      {/* Bannière rappel avancement du mois */}
      {showRappelAvancement && (
        <Banner
          tone="danger"
          icon="⏰"
          title={`Avancement de ${currentMonthLabel()} à remplir`}
          text={`${notifications.avancement.label} — tape ici pour accéder au module.`}
          onClick={() => onOpenModule("avancement")}
        />
      )}

      {/* Grille de tuiles — PWA : 2 colonnes (inchangé) ; desktop : grille
          aérée auto-fill dans le cadre 1320 */}
      {allTiles.length > 0 ? (
        <div style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill, minmax(240px, 1fr))",
          gap: space.md,
        }}>
          {allTiles.map((tile, i) => (
            <Tile
              key={tile.id}
              meta={tile}
              notif={notifications[tile.id]}
              onClick={() => {
                if (!tile.enabled) return;
                if (tile.id === "dashboard") onOpenDashboard(user);
                else if (tile.id === "collection-dashboards") onOpenCollectionDashboards();
                else onOpenModule(tile.id);
              }}
              isFullWidth={isMobile && allTiles.length % 2 === 1 && i === allTiles.length - 1}
            />
          ))}
        </div>
      ) : (
        <div style={{
          background: EPJ.gray50, border: `1px solid ${EPJ.gray200}`,
          borderRadius: radius.lg, padding: space.lg, textAlign: "center",
          fontSize: fontSize.sm, color: EPJ.gray500,
        }}>
          Aucun module ne vous est accessible pour l'instant. Contactez votre administrateur.
        </div>
      )}
    </div>
  );
}

// ─── Tuile avec badge ─────────────────────────────────────────
function Tile({ meta, notif, onClick, isFullWidth }) {
  const accent = meta.accent;
  const hasNotif = notif && notif.count > 0;
  return (
    <div
      className="epj-tile"
      onClick={onClick}
      role="button"
      tabIndex={meta.enabled ? 0 : undefined}
      onKeyDown={(e) => {
        if (!meta.enabled) return;
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); }
      }}
      style={{
        "--accent": accent,
        "--accent-soft": `${accent}1A`,
        gridColumn: isFullWidth ? "1 / -1" : undefined,
        opacity: meta.enabled ? 1 : 0.55,
        cursor: meta.enabled ? "pointer" : "not-allowed",
        position: "relative",
      }}
    >
      {/* Badge notification (coin haut droit) */}
      {hasNotif && (
        <div style={{
          position: "absolute", top: space.md, right: space.md,
          background: EPJ.red, color: EPJ.white,
          minWidth: 22, height: 22, borderRadius: radius.pill,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: fontSize.xs, fontWeight: fontWeight.semibold,
          fontVariantNumeric: "tabular-nums",
          padding: `0 ${space.xs}px`,
          boxShadow: `0 0 0 3px ${EPJ.red}30`,
          zIndex: 2,
        }}>{notif.count}</div>
      )}

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div className="epj-tile-icon">{meta.icon}</div>
        {!meta.enabled && <Badge tone="neutral" label="Bientôt" />}
      </div>
      <div>
        <div style={{
          fontWeight: fontWeight.semibold, fontSize: fontSize.base, color: EPJ.gray900,
          letterSpacing: "-0.01em", lineHeight: 1.2,
        }}>
          {meta.title}
        </div>
        <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginTop: space.xs / 2 }}>
          {meta.subtitle}
        </div>
        {hasNotif && notif.label && (
          <div style={{
            fontSize: fontSize.xs, color: EPJ.red, fontWeight: fontWeight.medium,
            marginTop: space.xs, lineHeight: 1.3,
          }}>
            ⚠ {notif.label}
          </div>
        )}
      </div>
    </div>
  );
}

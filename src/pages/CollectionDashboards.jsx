// ═══════════════════════════════════════════════════════════════
//  CollectionDashboards — page indépendante regroupant les dashboards
//  transverses (hors DashboardDirection, qui reste séparé et inchangé).
//
//  Accessible aux rôles ayant au moins un dashboard à voir
//  (canSeeDashboards). 1er dashboard de la collection : Dashboard achat
//  (Module Commande). Navigation interne list ↔ dashboard (le routeur
//  racine est state-based, pas de React Router).
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font } from "../core/theme";
import { useAuth } from "../core/AuthContext";
import { canSeeDashboards } from "../core/dashboardsAccess";
import { AchatDashboard } from "../modules/commandes/AchatDashboard";

const DASHBOARDS = [
  {
    id: "achat",
    title: "Dashboard achat",
    subtitle: "Suivi Esabora · AR fournisseurs · écarts de prix",
    icon: "🧾",
    accent: EPJ.blue,
  },
];

export function CollectionDashboards({ onBack }) {
  const { user } = useAuth();
  const [view, setView] = useState("list");

  if (!canSeeDashboards(user)) {
    return (
      <div style={{ padding: "32px 8px", textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: EPJ.gray900 }}>
          Accès non autorisé
        </div>
        <div style={{ fontSize: 13, color: EPJ.gray500, marginTop: 6 }}>
          Cette collection de dashboards ne vous est pas accessible.
        </div>
      </div>
    );
  }

  if (view === "achat") {
    return <AchatDashboard onBack={() => setView("list")} />;
  }

  return (
    <div style={{ paddingTop: 8, paddingBottom: 20 }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 10, color: EPJ.gray500, textTransform: "uppercase", letterSpacing: 0.6 }}>
          Pilotage
        </div>
        <div style={{ fontFamily: font.display, fontSize: 24, color: EPJ.gray900, lineHeight: 1.1 }}>
          Collection Dashboards
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {DASHBOARDS.map((d) => (
          <div
            key={d.id}
            onClick={() => setView(d.id)}
            style={{
              gridColumn: DASHBOARDS.length === 1 ? "1 / -1" : undefined,
              border: `1px solid ${EPJ.gray200}`,
              borderLeft: `3px solid ${d.accent}`,
              borderRadius: 14,
              padding: "16px 18px",
              background: EPJ.white,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            <div style={{ fontSize: 30 }}>{d.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 16, color: EPJ.gray900 }}>{d.title}</div>
              <div style={{ fontSize: 12, color: EPJ.gray500, marginTop: 2 }}>{d.subtitle}</div>
            </div>
            <span style={{ color: d.accent, fontSize: 20, fontWeight: 700 }}>→</span>
          </div>
        ))}
      </div>
    </div>
  );
}

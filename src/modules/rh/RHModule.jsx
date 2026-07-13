// ═══════════════════════════════════════════════════════════════
//  RHModule — Module « Ressources humaines » (RH-1 shell)
//
//  Shell à onglets (calque ChantierFiche + GestionChantierModule) :
//   • Congés / absences (rh.conges) → CongesPage (LIVRÉ, RH-2a) ;
//   • Notes de frais (rh.frais)     → FraisPage (LIVRÉ, RH-Frais-1) ;
//   • Analyse (rh.analyse)          → « Bientôt ».
//
//  ⚠️ AUCUN onglet Planning : le Planning ressources (L8) reste la tuile
//  standalone (route module:planning). Chaque onglet est gaté par le
//  droit d'accès de sa sous-clé rh.<clé>. Accent module = catCourantFaible.
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useViewport } from "../../core/useViewport";
import { can } from "../../core/permissions";
import { ModuleSubHeader } from "../../core/components/ModuleSubHeader";
import { Badge } from "../../core/components/Badge";
import { Button } from "../../core/components/Button";
import { CongesPage } from "./CongesPage";
import { FraisPage } from "./FraisPage";
import { HeuresSalariesPage } from "./HeuresSalariesPage";
import { RecapFraisPage } from "./RecapFraisPage";

const ACCENT = EPJ.catCourantFaible;

// Onglets — `key` = identité/routage ; `permKey` (défaut = key) = sous-clé de
// permission rh.<clé>. « Heures salariés » partage la gate rh.frais (gestionnaire).
const TABS = [
  { key: "rh.conges",  label: "Congés / absences", icon: "🌴", live: true },
  { key: "rh.frais",   label: "Notes de frais",    icon: "🧾", live: true },
  { key: "rh.heures",  label: "Heures salariés",   icon: "⏱️", live: true, permKey: "rh.frais" },
  { key: "rh.recap",   label: "Récap frais",       icon: "🧮", live: true, permKey: "rh.frais" },
  { key: "rh.analyse", label: "Analyse",           icon: "📈", live: false },
];

export function RHModule({ onExitModule }) {
  const { user } = useAuth();
  const { rolesConfig } = useData();
  const isPwa = useViewport() === "mobile";

  const visibleTabs = useMemo(
    () => TABS.filter((t) => can(user, t.permKey || t.key, "_access", rolesConfig)),
    [user, rolesConfig],
  );

  const [activeKey, setActiveKey] = useState(null);
  const active = visibleTabs.find((t) => t.key === activeKey) || visibleTabs[0] || null;

  return (
    <div style={{ paddingTop: space.md, paddingBottom: space.xl }}>
      <ModuleSubHeader
        moduleName="Ressources humaines"
        title="Ressources humaines"
        subtitle="Congés & absences"
        onBackToModuleHome={null}
      />

      {visibleTabs.length === 0 ? (
        <div style={{
          background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
          borderRadius: radius.lg, padding: space.xl, textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: space.sm }}>🔒</div>
          <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, marginBottom: space.lg }}>
            Aucun onglet RH ne vous est accessible. Contactez votre administrateur.
          </div>
          <Button variant="secondary" size="sm" onClick={onExitModule}>← Retour à l'accueil</Button>
        </div>
      ) : (
        <>
          {/* Barre d'onglets — scrollable horizontalement en PWA */}
          <div
            role="tablist"
            style={{
              display: "flex", gap: space.xs,
              overflowX: "auto", WebkitOverflowScrolling: "touch",
              borderBottom: `1px solid ${EPJ.gray200}`,
              marginBottom: space.lg,
            }}
          >
            {visibleTabs.map((t) => {
              const isActive = active && active.key === t.key;
              return (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveKey(t.key)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: space.xs,
                    background: "transparent", border: "none",
                    borderBottom: `2px solid ${isActive ? ACCENT : "transparent"}`,
                    padding: `${space.sm}px ${space.md}px`,
                    fontSize: isPwa ? fontSize.base : fontSize.sm,
                    fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                    fontFamily: font.body,
                    color: isActive ? ACCENT : EPJ.gray700,
                    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                    marginBottom: -1,
                  }}
                >
                  <span aria-hidden style={{ fontSize: 15, lineHeight: 1 }}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>

          {/* Contenu de l'onglet actif */}
          {active && active.key === "rh.conges" && (
            <div role="tabpanel"><CongesPage /></div>
          )}
          {active && active.key === "rh.frais" && (
            <div role="tabpanel"><FraisPage /></div>
          )}
          {active && active.key === "rh.heures" && (
            <div role="tabpanel"><HeuresSalariesPage /></div>
          )}
          {active && active.key === "rh.recap" && (
            <div role="tabpanel"><RecapFraisPage /></div>
          )}
          {active && active.key !== "rh.conges" && active.key !== "rh.frais" && active.key !== "rh.heures" && active.key !== "rh.recap" && (
            <div role="tabpanel" style={{
              background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
              borderRadius: radius.lg, padding: space.xl, textAlign: "center",
            }}>
              <div style={{ fontSize: 40, marginBottom: space.sm }}>{active.icon}</div>
              <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: EPJ.gray900, marginBottom: space.xs }}>
                {active.label}
              </div>
              <Badge tone="neutral" label="Bientôt" />
              <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, marginTop: space.sm }}>
                Cet onglet sera développé dans un prochain lot.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ChantierFiche — fiche chantier à onglets (Module 5, L1)
//
//  L1 = COQUILLE : on pose la barre d'onglets + le gating par droit.
//  Chaque onglet n'apparaît que si can(user, "gestionChantier.<clé>",
//  "_access"). Le contenu est un placeholder « à venir » (lots L2+).
//
//  LECTURE SEULE : la fiche ne lit que la prop `chantier`. AUCUNE
//  écriture Firestore, aucun listener.
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useViewport } from "../../core/useViewport";
import { can } from "../../core/permissions";
import { ModuleSubHeader } from "../../core/components/ModuleSubHeader";
import { PieuvresTab } from "./PieuvresTab";
import { SuiviCommandesTab } from "./SuiviCommandesTab";
import { PlanningTab } from "../planning/PlanningTab";
import { ValidationAvancement } from "../planning/ValidationAvancement";

// Onglets de la fiche — la clé = sous-clé de permission gestionChantier.<clé>
const TABS = [
  { key: "pieuvres",  label: "Pieuvres",          icon: "🕸️" },
  { key: "commandes", label: "Suivi commandes",   icon: "📦" },
  { key: "planning",  label: "Planning",            icon: "📆" },
  { key: "financier", label: "Suivi financier",   icon: "💶" },
  { key: "suivi",     label: "Suivi de chantier", icon: "📋" },
  { key: "tma",       label: "TMA",               icon: "🔧" },
  { key: "demarches", label: "Démarches admin",   icon: "🗂️" },
];

export function ChantierFiche({ chantier, onBack }) {
  const { user } = useAuth();
  const { rolesConfig } = useData();
  const isPwa = useViewport() === "mobile";

  // Onglets visibles = gatés par le droit d'accès de la sous-clé.
  const visibleTabs = useMemo(
    () => TABS.filter(t => can(user, `gestionChantier.${t.key}`, "_access", rolesConfig)),
    [user, rolesConfig]
  );

  const [activeKey, setActiveKey] = useState(null);
  const active = visibleTabs.find(t => t.key === activeKey) || visibleTabs[0] || null;

  return (
    <div style={{ paddingTop: space.md, paddingBottom: space.xl }}>
      <ModuleSubHeader
        moduleName="Gestion de chantier"
        title={chantier.nom || chantier.num}
        subtitle={`Chantier ${chantier.num}${chantier.adresse ? " · " + chantier.adresse : ""}`}
        onBackToModuleHome={onBack}
      />

      {visibleTabs.length === 0 ? (
        <div style={{
          background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
          borderRadius: radius.lg, padding: space.xl, textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: space.sm }}>🔒</div>
          <div style={{ fontSize: fontSize.sm, color: EPJ.gray500 }}>
            Aucun onglet ne vous est accessible sur ce chantier.
          </div>
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
              marginBottom: space.lg, paddingBottom: 0,
            }}
          >
            {visibleTabs.map(t => {
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
                    borderBottom: `2px solid ${isActive ? EPJ.blue : "transparent"}`,
                    padding: `${space.sm}px ${space.md}px`,
                    fontSize: isPwa ? fontSize.base : fontSize.sm,
                    fontWeight: isActive ? fontWeight.semibold : fontWeight.medium,
                    fontFamily: font.body,
                    color: isActive ? EPJ.blue : EPJ.gray700,
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

          {/* Contenu de l'onglet actif — Pieuvres livré (L2), autres = placeholder */}
          {active && active.key === "pieuvres" && (
            <div role="tabpanel">
              <PieuvresTab chantier={chantier} />
            </div>
          )}
          {active && active.key === "commandes" && (
            <div role="tabpanel">
              <SuiviCommandesTab chantier={chantier} />
            </div>
          )}
          {active && active.key === "planning" && (
            <div role="tabpanel">
              <PlanningTab chantier={chantier} />
            </div>
          )}
          {active && active.key === "suivi" && (
            <div role="tabpanel">
              <ValidationAvancement chantier={chantier} />
            </div>
          )}
          {active && active.key !== "pieuvres" && active.key !== "commandes" && active.key !== "planning" && active.key !== "suivi" && (
            <div role="tabpanel" style={{
              background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
              borderRadius: radius.lg, padding: space.xl, textAlign: "center",
            }}>
              <div style={{ fontSize: 40, marginBottom: space.sm }}>{active.icon}</div>
              <div style={{
                fontSize: fontSize.lg, fontWeight: fontWeight.semibold,
                color: EPJ.gray900, marginBottom: space.xs,
              }}>
                {active.label}
              </div>
              <div style={{ fontSize: fontSize.sm, color: EPJ.gray500 }}>
                À venir — cet onglet sera développé dans un prochain lot.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

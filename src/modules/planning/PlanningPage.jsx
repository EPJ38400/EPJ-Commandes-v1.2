// ═══════════════════════════════════════════════════════════════
//  PlanningPage — entrée GLOBALE du Planning ressources (tuile accueil)
//
//  Droit de visibilité : rh.planning. Rend le composant cœur partagé
//  PlanningGrid sans chantier (= tous chantiers). Filtre conducteur +
//  toggle « Tout voir » sont DANS PlanningGrid.
// ═══════════════════════════════════════════════════════════════
import { space } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { can } from "../../core/permissions";
import { ModuleSubHeader } from "../../core/components/ModuleSubHeader";
import { PlanningGrid } from "./PlanningGrid";
import { EmptyAccess } from "./PlanningTab";

export function PlanningPage({ onExitModule }) {
  const { user } = useAuth();
  const { rolesConfig } = useData();
  const viewScope = can(user, "rh.planning", "view", rolesConfig);

  return (
    <div style={{ paddingTop: space.md, paddingBottom: space.xl }}>
      <ModuleSubHeader
        moduleName="Planning"
        title="Planning ressources"
        subtitle="Affectation hebdomadaire des équipes"
        onBackToModuleHome={null}
      />
      {viewScope ? <PlanningGrid /> : <EmptyAccess />}
    </div>
  );
}

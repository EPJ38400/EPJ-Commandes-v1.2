// ═══════════════════════════════════════════════════════════════
//  PlanningTab — entrée ONGLET du Planning (fiche Gestion de chantier)
//
//  Droit de visibilité : gestionChantier.planning (gaté en amont par
//  ChantierFiche). Rend la vue MENSUELLE chantier-centric (Lot 2),
//  filtrée sur le chantier courant. L'accueil (rh.planning) conserve la
//  grille hebdo par ressources via PlanningGrid — NON modifié.
// ═══════════════════════════════════════════════════════════════
import { EPJ, font, radius, space, fontSize } from "../../core/theme";
import { ChantierPlanningMonth } from "./ChantierPlanningMonth";

export function PlanningTab({ chantier }) {
  return <ChantierPlanningMonth chantier={chantier} />;
}

// Encart « pas d'accès » partagé (réutilisé par PlanningPage).
export function EmptyAccess() {
  return (
    <div style={{ background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.lg, padding: space.xl, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: space.sm }}>🔒</div>
      <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, fontFamily: font.body }}>
        Le planning ne vous est pas accessible.
      </div>
    </div>
  );
}

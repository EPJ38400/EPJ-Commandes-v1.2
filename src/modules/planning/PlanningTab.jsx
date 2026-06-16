// ═══════════════════════════════════════════════════════════════
//  PlanningTab — entrée ONGLET du Planning (fiche Gestion de chantier)
//
//  Droit de visibilité : gestionChantier.planning (gaté en amont par
//  ChantierFiche). Rend le MÊME composant cœur PlanningGrid, filtré sur
//  le chantier courant. Le grounding (poste/bâtiment) vient du chantier.
// ═══════════════════════════════════════════════════════════════
import { EPJ, font, radius, space, fontSize } from "../../core/theme";
import { PlanningGrid } from "./PlanningGrid";

export function PlanningTab({ chantier }) {
  return <PlanningGrid chantier={chantier} />;
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

// ═══════════════════════════════════════════════════════════════
//  GestionChantierModule — Module 5 « Gestion de chantier » (L1)
//
//  Landing = liste des chantiers. Navigation chantier-first :
//  on ouvre un chantier → fiche à onglets (ChantierFiche).
//
//  L1 = STRUCTURE UNIQUEMENT : scope de lecture + gating, pas de
//  contenu d'onglet. LECTURE SEULE de `chantiers` (cache DataContext),
//  AUCUNE écriture Firestore, aucune nouvelle collection/listener.
//
//  Structure module classique (calibre src/modules/avancement/),
//  responsive PWA/desktop via useViewport. PAS de split N2.
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
import { DataTable } from "../../core/components/DataTable";
import { ChantierFiche } from "./ChantierFiche";

export function GestionChantierModule({ onExitModule }) {
  const { user } = useAuth();
  const { chantiers, rolesConfig, loaded } = useData();
  const isPwa = useViewport() === "mobile";

  const [selectedChantierNum, setSelectedChantierNum] = useState(null);
  // Toggle « Tout voir » — pertinent uniquement pour un scope own_chantiers.
  const [showAll, setShowAll] = useState(false);

  const viewScope = can(user, "gestionChantier", "view", rolesConfig);

  // Le toggle « Tout voir » n'a de sens que si l'utilisateur est borné à ses
  // chantiers (scope own_chantiers). Les scopes "all" voient déjà tout.
  const canToggleAll = viewScope === "own_chantiers";
  const effectiveAll = viewScope === "all" || (canToggleAll && showAll);

  // Filtre des chantiers selon le scope (+ toggle). Mêmes statuts masqués que
  // le module Avancement (Archivé / Terminé).
  const visibleChantiers = useMemo(() => {
    if (!viewScope) return [];
    const actifs = (chantiers || []).filter(
      c => c.statut !== "Archivé" && c.statut !== "Terminé"
    );
    if (effectiveAll) return actifs;
    return actifs.filter(c => isMyChantier(user, c));
  }, [chantiers, user, viewScope, effectiveAll]);

  const rows = useMemo(() => visibleChantiers.map(ch => ({
    num: ch.num,
    nom: ch.nom || "",
    adresse: ch.adresse || "",
    statut: ch.statut || "",
  })), [visibleChantiers]);

  // ─── Vue détail : fiche chantier à onglets ───
  if (selectedChantierNum) {
    const ch = (chantiers || []).find(c => c.num === selectedChantierNum);
    if (!ch) {
      setSelectedChantierNum(null);
      return null;
    }
    return (
      <ChantierFiche
        chantier={ch}
        onBack={() => setSelectedChantierNum(null)}
      />
    );
  }

  const columns = [
    {
      key: "nom", header: "Chantier",
      render: (v, row) => (
        <div style={{ minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: space.sm }}>
            <span style={{
              fontFamily: font.mono, fontSize: fontSize.xs,
              padding: `1px ${space.xs + 2}px`, borderRadius: radius.sm,
              background: EPJ.gray100, color: EPJ.gray700,
            }}>{row.num}</span>
            <span style={{
              fontWeight: fontWeight.medium, color: EPJ.gray900,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{v}</span>
          </div>
          {row.adresse && (
            <div style={{
              fontSize: fontSize.sm, color: EPJ.gray500, marginTop: 1,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>{row.adresse}</div>
          )}
        </div>
      ),
    },
    {
      key: "statut", header: "Statut", sortable: false, width: 160,
      render: (v) => v
        ? <Badge tone="neutral" label={v} />
        : <span style={{ color: EPJ.gray400 }}>—</span>,
    },
  ];

  const renderCard = (row) => (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: space.sm, marginBottom: 3, flexWrap: "wrap" }}>
        <span style={{
          fontFamily: font.mono, fontSize: fontSize.xs,
          padding: `1px ${space.xs + 2}px`, borderRadius: radius.sm,
          background: EPJ.gray100, color: EPJ.gray700,
        }}>{row.num}</span>
        {row.statut && <Badge tone="neutral" label={row.statut} />}
      </div>
      <div style={{
        fontWeight: fontWeight.medium, fontSize: fontSize.base,
        color: EPJ.gray900, lineHeight: 1.2,
      }}>
        {row.nom}
      </div>
      {row.adresse && (
        <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, marginTop: 2 }}>
          {row.adresse}
        </div>
      )}
    </div>
  );

  // ─── Pas d'accès au module ───
  if (!viewScope) {
    return (
      <div style={{ paddingTop: space.md, paddingBottom: space.xl }}>
        <ModuleSubHeader
          moduleName="Gestion de chantier"
          title="Gestion de chantier"
          subtitle="Accès"
          onBackToModuleHome={null}
        />
        <div style={{
          background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
          borderRadius: radius.lg, padding: space.xl, textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: space.sm }}>🔒</div>
          <div style={{ fontSize: fontSize.sm, color: EPJ.gray500 }}>
            Ce module ne vous est pas accessible. Contactez votre administrateur.
          </div>
        </div>
      </div>
    );
  }

  // ─── Vue liste ───
  return (
    <div style={{ paddingTop: space.md, paddingBottom: space.xl }}>
      <ModuleSubHeader
        moduleName="Gestion de chantier"
        title="Gestion de chantier"
        subtitle={`${visibleChantiers.length} chantier${visibleChantiers.length > 1 ? "s" : ""}${effectiveAll ? "" : " · mes chantiers"}`}
        onBackToModuleHome={null}
        rightSlot={canToggleAll ? (
          <Button
            variant={showAll ? "primary" : "secondary"}
            size="sm"
            onClick={() => setShowAll(s => !s)}
          >
            {showAll ? "Mes chantiers" : "Tout voir"}
          </Button>
        ) : null}
      />

      {visibleChantiers.length === 0 ? (
        <div style={{
          background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
          borderRadius: radius.lg, padding: space.xl, textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: space.sm }}>🏗</div>
          <div style={{ fontSize: fontSize.sm, color: EPJ.gray500 }}>
            Aucun chantier à afficher.{" "}
            {!effectiveAll && "Vous n'êtes affecté à aucun chantier actif."}
          </div>
        </div>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          keyField="num"
          onRowClick={(row) => setSelectedChantierNum(row.num)}
          renderCard={renderCard}
          loading={!loaded?.chantiers}
          empty={{ icon: "🏗", title: "Aucun chantier à afficher" }}
        />
      )}
    </div>
  );
}

// ─── Helper : ce chantier est-il « à moi » ? (scope own_chantiers) ───
// Deux conventions de stockage du conducteur coexistent dans le repo
// (cf. PLAN_L1.md §1) → on teste les deux + les tableaux d'affectation
// (chef/monteur/artisan) pour rester cohérent avec l'existant et couvrir
// un chef ouvert via permissionsOverride. Lecture seule.
function isMyChantier(user, c) {
  if (!user || !c) return false;
  const ids = [user._id, user.id].filter(Boolean);
  const match = (v) => v != null && ids.includes(v);
  if (match(c.conducteurId)) return true;                 // convention Avancement
  if (match(c.affectations?.conducteurId)) return true;   // convention HomePage/Réserves
  if ((c.chefChantierIds || []).some(match)) return true;
  if ((c.monteurIds || []).some(match)) return true;
  if ((c.artisanIds || []).some(match)) return true;
  return false;
}

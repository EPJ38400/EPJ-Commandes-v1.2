// ═══════════════════════════════════════════════════════════════
//  AvancementModule — Module 3 Avancement chantier
//  Liste des chantiers accessibles → écran détail par chantier
//
//  DS-2 : repeinte design-system + desktop (conforme
//  docs/DIRECTION_ARTISTIQUE.md). Affichage uniquement — scope de
//  lecture, calculs d'avancement et navigation INCHANGÉS.
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useViewport } from "../../core/useViewport";
import { can } from "../../core/permissions";
import { ModuleSubHeader } from "../../core/components/ModuleSubHeader";
import { Banner } from "../../core/components/Banner";
import { Badge } from "../../core/components/Badge";
import { StatCard } from "../../core/components/StatCard";
import { DataTable } from "../../core/components/DataTable";
import { AvancementChantier } from "./AvancementChantier";
import {
  overallProgress, overallProgressSousSol, DEFAULT_BUILDING_CONFIG,
  resolveBuildings, getChantierSousSols,
} from "./avancementTasks";
import {
  isRappelAvancementActif, currentMonthKey, currentMonthLabel,
  isAvancementValide,
} from "../../core/notificationsUtils";

export function AvancementModule({ onExitModule }) {
  const { user } = useAuth();
  const { chantiers, rolesConfig, users, tasksConfig, avancementValidations, loaded } = useData();
  const isPwa = useViewport() === "mobile";
  const [selectedChantierNum, setSelectedChantierNum] = useState(null);

  const viewScope = can(user, "avancement", "view", rolesConfig);
  const canEdit   = !!can(user, "avancement", "edit", rolesConfig);

  // Filtre les chantiers selon le scope de lecture
  const visibleChantiers = useMemo(() => {
    if (!viewScope) return [];
    const actifs = chantiers.filter(c => c.statut !== "Archivé" && c.statut !== "Terminé");
    if (viewScope === "all") return actifs;
    if (viewScope === "own_chantiers") {
      return actifs.filter(c => isUserAffectedToChantier(user, c));
    }
    if (viewScope === "own_items") {
      // Pour ce module, "own_items" = mes chantiers (comme own_chantiers)
      return actifs.filter(c => isUserAffectedToChantier(user, c));
    }
    return [];
  }, [chantiers, user, viewScope]);

  // Lignes augmentées pour la table : avancement global par chantier
  // (mêmes calculs que l'ancienne ChantierCard — moyenne sur toutes les
  // unités bâtiments + sous-sols communs), validation du mois courant.
  const rows = useMemo(() => visibleChantiers.map(ch => {
    const buildings = resolveBuildings(ch);
    const sousSols = getChantierSousSols(ch);
    const hasSousSolCommun = sousSols.length > 0;
    let totalProgress = 0;
    let count = 0;
    buildings.forEach(b => {
      const prog = ch.avancementProgress?.[b.id] || {};
      totalProgress += overallProgress(
        b.config || DEFAULT_BUILDING_CONFIG, prog,
        tasksConfig, ch.avancementTasksOverride, b.id, hasSousSolCommun,
      );
      count++;
    });
    sousSols.forEach(ss => {
      const prog = ch.avancementProgress?.[ss.id] || {};
      totalProgress += overallProgressSousSol(
        { nbNiveaux: ss.nbNiveaux ?? 1 }, prog,
        tasksConfig, ch.avancementTasksOverride, ss.id,
      );
      count++;
    });
    const pct = count > 0 ? Math.round(totalProgress / count) : 0;
    return {
      num: ch.num,
      nom: ch.nom,
      adresse: ch.adresse || "",
      _unites: buildings.length + sousSols.length,
      _nbBatiments: buildings.length,
      _pct: pct,
      _valide: isAvancementValide(ch.num, currentMonthKey(), avancementValidations),
    };
  }), [visibleChantiers, tasksConfig, avancementValidations]);

  const nbValides = rows.filter(r => r._valide).length;
  const avgPct = rows.length > 0
    ? Math.round(rows.reduce((s, r) => s + r._pct, 0) / rows.length)
    : 0;

  // Vue détail d'un chantier
  if (selectedChantierNum) {
    const ch = chantiers.find(c => c.num === selectedChantierNum);
    if (!ch) {
      setSelectedChantierNum(null);
      return null;
    }
    return (
      <AvancementChantier
        chantier={ch}
        onBack={() => setSelectedChantierNum(null)}
        canEdit={canEdit}
        allUsers={users}
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
      key: "_unites", header: "Unités", numeric: true, width: 80,
      render: (v) => v > 1 ? v : <span style={{ color: EPJ.gray400 }}>1</span>,
    },
    {
      key: "_pct", header: "Avancement", numeric: true, width: 220,
      render: (v) => <ProgressBarCell pct={v} />,
    },
    {
      key: "_valide", header: "Mois en cours", sortable: false, width: 160,
      render: (v) => v
        ? <Badge tone="success" dot label={`${currentMonthLabel()} validé`} />
        : <Badge tone="neutral" label="À valider" />,
    },
  ];

  const renderCard = (row) => (
    <div>
      <div style={{ display: "flex", alignItems: "flex-start", gap: space.md }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: space.sm, marginBottom: 3, flexWrap: "wrap" }}>
            <span style={{
              fontFamily: font.mono, fontSize: fontSize.xs,
              padding: `1px ${space.xs + 2}px`, borderRadius: radius.sm,
              background: EPJ.gray100, color: EPJ.gray700,
            }}>{row.num}</span>
            {row._nbBatiments > 1 && (
              <span style={{ fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: EPJ.orangeText }}>
                {row._nbBatiments} bâtiments
              </span>
            )}
            {row._valide && (
              <Badge tone="success" dot label={`${currentMonthLabel()} validé`} />
            )}
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
        <div style={{
          fontSize: fontSize.xl, fontWeight: fontWeight.semibold,
          color: pctColor(row._pct), fontVariantNumeric: "tabular-nums",
        }}>
          {row._pct}%
        </div>
      </div>

      {/* Barre de progression — l'élément central de la carte terrain */}
      <div style={{
        marginTop: space.sm + 2, height: 6, borderRadius: radius.pill,
        background: EPJ.gray100, overflow: "hidden",
      }}>
        <div style={{
          width: `${row._pct}%`, height: "100%",
          background: pctColor(row._pct),
          transition: "width .4s ease",
        }}/>
      </div>
    </div>
  );

  // Vue liste
  return (
    <div style={{ paddingTop: space.md, paddingBottom: space.xl }}>
      {/* En-tête module — v10.G */}
      <ModuleSubHeader
        moduleName="Avancement"
        title="Avancement chantier"
        subtitle={`${visibleChantiers.length} chantier${visibleChantiers.length > 1 ? "s" : ""} actif${visibleChantiers.length > 1 ? "s" : ""}`}
        onBackToModuleHome={null}
      />

      {visibleChantiers.length === 0 ? (
        <div style={{
          background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
          borderRadius: radius.lg, padding: space.xl, textAlign: "center",
        }}>
          <div style={{ fontSize: 32, marginBottom: space.sm }}>🏗</div>
          <div style={{ fontSize: fontSize.sm, color: EPJ.gray500 }}>
            Aucun chantier à afficher.{" "}
            {viewScope !== "all" && "Demandez à l'administrateur de vous affecter à un chantier."}
          </div>
        </div>
      ) : (
        <>
          {/* Rappel validation du mois (à partir du 20) */}
          {isRappelAvancementActif() && (() => {
            const monthKey = currentMonthKey();
            const nonValides = visibleChantiers.filter(c => !isAvancementValide(c.num, monthKey, avancementValidations));
            if (nonValides.length === 0) {
              return (
                <Banner
                  tone="success"
                  icon="✓"
                  title={`Avancement de ${currentMonthLabel()} validé`}
                  text="Tous tes chantiers sont validés. Merci !"
                />
              );
            }
            return (
              <Banner
                tone="danger"
                icon="⏰"
                title="Rappel de fin de mois"
                text={`${nonValides.length} chantier${nonValides.length > 1 ? "s" : ""} restant${nonValides.length > 1 ? "s" : ""} à valider pour ${currentMonthLabel()}. Renseigne l'avancement puis clique sur « J'ai terminé mon avancement » dans chaque chantier.`}
              />
            );
          })()}

          {/* Rangée KPI — dérivés des lignes déjà calculées */}
          <div style={{
            display: "grid",
            gridTemplateColumns: isPwa ? "1fr 1fr" : "repeat(4, 1fr)",
            gap: space.md, marginBottom: space.lg,
          }}>
            <StatCard label="Chantiers actifs" value={rows.length} loading={!loaded?.chantiers} />
            <StatCard label="Avancement moyen" value={`${avgPct}%`} loading={!loaded?.chantiers} />
            <StatCard label={`Validés · ${currentMonthLabel()}`} value={nbValides} loading={!loaded?.chantiers} />
            <StatCard label="Restants à valider" value={rows.length - nbValides} loading={!loaded?.chantiers} />
          </div>

          <DataTable
            columns={columns}
            rows={rows}
            keyField="num"
            onRowClick={(row) => setSelectedChantierNum(row.num)}
            renderCard={renderCard}
            loading={!loaded?.chantiers}
            empty={{
              icon: "🏗",
              title: "Aucun chantier à afficher",
            }}
          />
        </>
      )}
    </div>
  );
}

// Couleur de progression par seuils (logique d'affichage existante, inchangée)
function pctColor(pct) {
  return pct === 100 ? EPJ.green : pct >= 60 ? EPJ.blue : pct >= 30 ? EPJ.orange : EPJ.gray500;
}

// Cellule barre + % (tabular-nums aligné à droite)
function ProgressBarCell({ pct }) {
  const color = pctColor(pct);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: space.sm }}>
      <div style={{
        flex: 1, height: 6, borderRadius: radius.pill,
        background: EPJ.gray100, overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%", background: color,
          transition: "width .4s ease",
        }}/>
      </div>
      <span style={{
        fontSize: fontSize.sm, fontWeight: fontWeight.medium, color,
        fontVariantNumeric: "tabular-nums", minWidth: 38, textAlign: "right",
      }}>{pct}%</span>
    </div>
  );
}

// ─── Helper : l'user est-il affecté à ce chantier ? ─────────────
function isUserAffectedToChantier(user, chantier) {
  if (!user || !chantier) return false;
  if (chantier.conducteurId === user.id) return true;
  if ((chantier.chefChantierIds || []).includes(user.id)) return true;
  if ((chantier.monteurIds || []).includes(user.id)) return true;
  if ((chantier.artisanIds || []).includes(user.id)) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════
//  AvancementModule — Module 3 Avancement chantier
//  Liste des chantiers accessibles → écran détail par chantier
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { can } from "../../core/permissions";
import { AvancementChantier } from "./AvancementChantier";
import { overallProgress, DEFAULT_BUILDING_CONFIG } from "./avancementTasks";

export function AvancementModule({ onExitModule }) {
  const { user } = useAuth();
  const { chantiers, rolesConfig, users, tasksConfig } = useData();
  const [selectedChantierNum, setSelectedChantierNum] = useState(null);

  const viewScope = can(user, "avancement", "view", rolesConfig);
  const canEdit   = !!can(user, "avancement", "edit", rolesConfig);

  // Filtre les chantiers selon le scope de lecture
  const visibleChantiers = useMemo(() => {
    if (!viewScope) return [];
    const actifs = chantiers.filter(c => c.statut !== "Archivé");
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

  // Vue liste
  return (
    <div style={{ paddingTop: 16, paddingBottom: 24 }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{
          fontFamily: font.display, fontSize: 24, fontWeight: 400,
          color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.15,
        }}>
          Avancement chantier
        </div>
        <div style={{ fontSize: 12, color: EPJ.gray500, marginTop: 4 }}>
          {viewScope === "all"
            ? "Tous les chantiers actifs."
            : "Chantiers sur lesquels vous êtes affecté."}
        </div>
      </div>

      {visibleChantiers.length === 0 ? (
        <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏗</div>
          <div style={{ fontSize: 13, color: EPJ.gray500 }}>
            Aucun chantier à afficher.{" "}
            {viewScope !== "all" && "Demandez à l'administrateur de vous affecter à un chantier."}
          </div>
        </div>
      ) : (
        visibleChantiers.map(ch => (
          <ChantierCard
            key={ch.num} chantier={ch}
            tasksConfig={tasksConfig}
            onClick={() => setSelectedChantierNum(ch.num)}
          />
        ))
      )}
    </div>
  );
}

function ChantierCard({ chantier, tasksConfig, onClick }) {
  // Calcule l'avancement global (moyenne sur tous les bâtiments)
  const buildings = chantier.buildings && chantier.buildings.length > 0
    ? chantier.buildings
    : [{ id: "A", label: "", config: DEFAULT_BUILDING_CONFIG }];

  let totalProgress = 0;
  let count = 0;
  buildings.forEach(b => {
    const prog = chantier.avancementProgress?.[b.id] || {};
    totalProgress += overallProgress(
      b.config || DEFAULT_BUILDING_CONFIG, prog,
      tasksConfig, chantier.avancementTasksOverride, b.id,
    );
    count++;
  });
  const pct = count > 0 ? Math.round(totalProgress / count) : 0;

  const barColor = pct === 100 ? EPJ.green : pct >= 60 ? EPJ.blue : pct >= 30 ? EPJ.orange : EPJ.gray500;

  return (
    <div
      className="epj-card clickable"
      onClick={onClick}
      style={{ padding: "14px 16px", marginBottom: 10 }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
            <span style={{
              fontFamily: "monospace", fontSize: 10, fontWeight: 700,
              padding: "2px 7px", borderRadius: 4,
              background: EPJ.gray100, color: EPJ.gray700,
            }}>{chantier.num}</span>
            {buildings.length > 1 && (
              <span style={{ fontSize: 10, fontWeight: 600, color: EPJ.orange }}>
                {buildings.length} bâtiments
              </span>
            )}
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, color: EPJ.gray900, lineHeight: 1.2 }}>
            {chantier.nom}
          </div>
          {chantier.adresse && (
            <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 2 }}>
              {chantier.adresse}
            </div>
          )}
        </div>
        <div style={{
          fontSize: 22, fontWeight: 700, color: barColor,
          fontVariantNumeric: "tabular-nums",
        }}>
          {pct}%
        </div>
      </div>

      {/* Barre de progression */}
      <div style={{
        marginTop: 10, height: 6, borderRadius: 3,
        background: EPJ.gray100, overflow: "hidden",
      }}>
        <div style={{
          width: `${pct}%`, height: "100%",
          background: barColor,
          transition: "width .4s ease",
        }}/>
      </div>
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

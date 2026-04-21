// ═══════════════════════════════════════════════════════════════
//  ParcDashboard — Tableau de bord du parc
//  - Stats : sortis / en retard / disponibles
//  - Alerte pour les outils en retard
//  - Liste des sorties en cours (cliquable → fiche outil)
// ═══════════════════════════════════════════════════════════════
import { useMemo } from "react";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";
import {
  computeOutilStatut, findSortieEnCours, isLate,
  formatDate, formatDateShort, getCategorieIcon, OUTIL_STATUTS,
} from "./parcUtils";

export function ParcDashboard({ onSelectOutil }) {
  const { outils, outillageSorties, users, chantiers, outillageCategories } = useData();

  const { stats, sortiesEnCours, sortiesEnRetard } = useMemo(() => {
    const enCours = outillageSorties.filter(s => !s.dateRetourReelle);
    const enRetard = enCours.filter(s => isLate(s.dateRetourPrevue));

    let disponibles = 0;
    let maintenance = 0;
    let horsService = 0;
    outils.forEach(o => {
      const st = computeOutilStatut(o, outillageSorties);
      if (st === "disponible") disponibles++;
      else if (st === "maintenance") maintenance++;
      else if (st === "hors_service") horsService++;
    });

    return {
      stats: {
        total: outils.length,
        sortis: enCours.length,
        enRetard: enRetard.length,
        disponibles,
        maintenance,
        horsService,
      },
      sortiesEnCours: [...enCours].sort((a, b) => {
        // En retard en premier, puis par date de retour prévue croissante
        const aLate = isLate(a.dateRetourPrevue);
        const bLate = isLate(b.dateRetourPrevue);
        if (aLate !== bLate) return aLate ? -1 : 1;
        return (a.dateRetourPrevue || "").localeCompare(b.dateRetourPrevue || "");
      }),
      sortiesEnRetard: enRetard,
    };
  }, [outils, outillageSorties]);

  return (
    <div>
      {/* 3 tuiles stats */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 12 }}>
        <StatCard label="Sortis" value={stats.sortis} color={EPJ.orange} icon="📤"/>
        <StatCard label="En retard" value={stats.enRetard} color={EPJ.red} icon="⏰"/>
        <StatCard label="Disponibles" value={stats.disponibles} color={EPJ.green} icon="✅"/>
      </div>

      {/* Alerte retard */}
      {sortiesEnRetard.length > 0 && (
        <div className="epj-card" style={{
          padding: "12px 14px", marginBottom: 12,
          background: `${EPJ.red}10`,
          borderLeft: `3px solid ${EPJ.red}`,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: EPJ.red, marginBottom: 6 }}>
            ⚠ {sortiesEnRetard.length} outil{sortiesEnRetard.length > 1 ? "s" : ""} en retard de retour
          </div>
          {sortiesEnRetard.slice(0, 3).map(s => {
            const emp = users.find(u => u.id === s.emprunteurId);
            return (
              <div key={s._id} style={{ fontSize: 11, color: EPJ.gray700, marginTop: 2 }}>
                · <b>{s.ref}</b> — {emp ? `${emp.prenom} ${emp.nom}` : s.emprunteurNom || "—"} — prévu {formatDate(s.dateRetourPrevue)}
              </div>
            );
          })}
          {sortiesEnRetard.length > 3 && (
            <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 4 }}>
              + {sortiesEnRetard.length - 3} autre{sortiesEnRetard.length - 3 > 1 ? "s" : ""}
            </div>
          )}
        </div>
      )}

      {/* Sorties en cours */}
      <div style={{
        fontSize: 11, color: EPJ.gray500, fontWeight: 600,
        letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 6,
      }}>
        Outils en cours de sortie
      </div>

      {sortiesEnCours.length === 0 ? (
        <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📦</div>
          <div style={{ fontSize: 13, color: EPJ.gray500 }}>
            Aucun outil sorti actuellement.
          </div>
        </div>
      ) : (
        sortiesEnCours.map(s => {
          const late = isLate(s.dateRetourPrevue);
          const outil = outils.find(o => o._id === s.outilId);
          const emp = users.find(u => u.id === s.emprunteurId);
          const chantier = s.chantierNum ? chantiers.find(c => c.num === s.chantierNum) : null;

          return (
            <div
              key={s._id}
              className="epj-card clickable"
              onClick={() => outil && onSelectOutil(outil._id)}
              style={{
                padding: "12px 14px", marginBottom: 8,
                borderLeft: `3px solid ${late ? EPJ.red : EPJ.orange}`,
                display: "flex", gap: 12, alignItems: "center",
              }}
            >
              {outil?.photoURL ? (
                <img src={outil.photoURL} alt="" style={{
                  width: 44, height: 44, borderRadius: 8, objectFit: "cover",
                  flexShrink: 0, border: `1px solid ${EPJ.gray200}`,
                }}/>
              ) : (
                <div style={{
                  width: 44, height: 44, borderRadius: 8,
                  background: EPJ.gray100, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 22, flexShrink: 0,
                }}>{getCategorieIcon(outillageCategories, outil?.categorieId)}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: EPJ.gray900, fontFamily: "monospace",
                  }}>{s.ref}</span>
                  <StatusChip status={late ? "en_retard" : "sorti"}/>
                </div>
                <div style={{ fontSize: 11, color: EPJ.gray700 }}>
                  👤 {emp ? `${emp.prenom} ${emp.nom}` : s.emprunteurNom || "—"}
                </div>
                {chantier && (
                  <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 1 }}>
                    📍 {chantier.num} — {chantier.nom}
                  </div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{
                  fontSize: 9, color: EPJ.gray500, textTransform: "uppercase",
                  fontWeight: 600, letterSpacing: 0.3,
                }}>Retour prévu</div>
                <div style={{
                  fontSize: 12, fontWeight: 700,
                  color: late ? EPJ.red : EPJ.gray900,
                }}>{formatDateShort(s.dateRetourPrevue)}</div>
              </div>
            </div>
          );
        })
      )}

      {/* Ligne résumé bas de page */}
      {(stats.maintenance > 0 || stats.horsService > 0) && (
        <div className="epj-card" style={{
          padding: "10px 12px", marginTop: 12,
          fontSize: 11, color: EPJ.gray500, display: "flex", gap: 14, justifyContent: "center",
        }}>
          {stats.maintenance > 0 && <span>🛠 {stats.maintenance} en maintenance</span>}
          {stats.horsService > 0 && <span>✕ {stats.horsService} hors service</span>}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color, icon }) {
  return (
    <div className="epj-card" style={{
      padding: "12px 8px", textAlign: "center",
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 16, marginBottom: 2 }}>{icon}</div>
      <div style={{
        fontSize: 22, fontWeight: 800, color,
        fontVariantNumeric: "tabular-nums", lineHeight: 1,
      }}>{value}</div>
      <div style={{
        fontSize: 9, color: EPJ.gray500, fontWeight: 700,
        textTransform: "uppercase", letterSpacing: 0.4, marginTop: 3,
      }}>{label}</div>
    </div>
  );
}

function StatusChip({ status }) {
  const meta = OUTIL_STATUTS[status] || OUTIL_STATUTS.disponible;
  return (
    <span style={{
      fontSize: 9, fontWeight: 700,
      background: `${meta.color}20`, color: meta.color,
      padding: "2px 6px", borderRadius: 4,
      letterSpacing: 0.3,
    }}>
      {meta.icon} {meta.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PlanningAgendaMobile — vue AGENDA du Planning ressources (RH-2d)
//
//  Rendu MOBILE (isPwa) uniquement : remplace la grille scroll-horizontal
//  par une liste verticale « agenda » (ressource → jours → demi-journées).
//  Aucune largeur mini, aucun scroll horizontal, cibles tactiles ≥ 44 px.
//
//  AFFICHAGE SEUL, aucune écriture propre : réutilise openSlot(resource,
//  slot) de PlanningGrid (même modale, mêmes garde-fous). Les helpers
//  (slotEnConge/congeAtSlot/chantierColor/posteLabel) sont passés en props.
// ═══════════════════════════════════════════════════════════════
import { EPJ, radius, space, fontSize, fontWeight } from "../../core/theme";
import { Button } from "../../core/components/Button";
import { creneauId, slotIndex, PERIODES, PERIODE_LABEL, posteLabel } from "./planningModel";
import { CONGE_TYPE_LABEL, CONGE_TYPE_COLOR } from "../rh/congesModel";

export function PlanningAgendaMobile({
  cols, resources, creneauMap, canWrite, openSlot,
  slotEnConge, congeAtSlot, chantierColor, chantierById, tasksConfig,
}) {
  const handleClick = (r, s, cr) => {
    // Garde-fou congé (identique à la grille desktop) : slot en congé + vide.
    if (slotEnConge(r.id, s) && !cr &&
        !window.confirm(`${r.nom} est absent ce créneau. Affecter quand même ?`)) return;
    openSlot(r, s);
  };

  return (
    <div>
      {resources.map((r) => (
        <section key={r.id} style={{ marginBottom: space.lg }}>
          {resources.length > 1 && (
            <div style={{
              display: "flex", alignItems: "center", gap: space.xs,
              padding: `${space.xs}px 0`, marginBottom: space.xs,
              fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: EPJ.gray900,
            }}>
              {r.nom}
              {r.type === "ARTISAN" && <span style={{ fontSize: 11, color: EPJ.gray400, fontWeight: fontWeight.regular }}>(art.)</span>}
            </div>
          )}

          <div style={{ border: `1px solid ${EPJ.gray200}`, borderRadius: radius.lg, background: EPJ.white, overflow: "hidden" }}>
            {cols.map((c, dayIdx) => (
              <div key={c.iso} style={{ borderTop: dayIdx === 0 ? "none" : `1px solid ${EPJ.gray200}` }}>
                <div style={{
                  padding: `${space.xs}px ${space.md}px`, background: EPJ.gray50,
                  fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray700,
                }}>
                  {c.dayLabel} <span style={{ color: EPJ.gray400 }}>{c.dateLabel}</span>
                </div>

                {PERIODES.map((periode) => {
                  const s = slotIndex(dayIdx, periode);
                  const cr = creneauMap.get(creneauId(r.id, c.iso, periode)) || null;
                  const cg = congeAtSlot(r.id, s);
                  const assigned = !!cr?.chantierId;
                  const ch = assigned ? chantierById.get(cr.chantierId) : null;
                  const chNom = ch?.nom || cr?.chantierId || "";
                  const poste = assigned
                    ? (cr.posteAvancementKey
                        ? posteLabel(ch, cr.batiment, cr.posteAvancementKey, tasksConfig)
                        : (cr.batiment ? `Bât. ${cr.batiment}` : ""))
                    : "";
                  const clickable = canWrite || !!cr;

                  return (
                    <div
                      key={periode}
                      onClick={clickable ? () => handleClick(r, s, cr) : undefined}
                      style={{
                        display: "flex", alignItems: "center", gap: space.sm,
                        minHeight: 44, padding: `${space.xs}px ${space.md}px`,
                        borderTop: `1px solid ${EPJ.gray100}`,
                        cursor: clickable ? "pointer" : "default",
                        background: (!assigned && cg)
                          ? `repeating-linear-gradient(45deg, ${EPJ.gray50}, ${EPJ.gray50} 6px, ${EPJ.gray100} 6px, ${EPJ.gray100} 12px)`
                          : "transparent",
                      }}
                    >
                      <span style={{
                        flexShrink: 0, width: 74, fontSize: fontSize.xs, fontWeight: fontWeight.medium,
                        color: EPJ.gray500,
                      }}>
                        {PERIODE_LABEL[periode]}
                      </span>

                      {assigned ? (
                        <div style={{ display: "flex", alignItems: "center", gap: space.xs, minWidth: 0, flex: 1 }}>
                          <span style={{ width: 10, height: 10, borderRadius: "50%", background: chantierColor(cr.chantierId), flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {chNom}
                            </div>
                            {poste && (
                              <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {poste}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : cg ? (
                        <span style={{
                          flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.medium,
                          color: CONGE_TYPE_COLOR[cg.type] || EPJ.gray600,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          Absent · {CONGE_TYPE_LABEL[cg.type] || "Absent"}
                        </span>
                      ) : (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
                          <span style={{ color: EPJ.gray300, fontSize: fontSize.sm }}>—</span>
                          {canWrite && <Button size="sm" variant="ghost">Affecter</Button>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

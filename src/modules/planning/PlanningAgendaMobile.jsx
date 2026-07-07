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
import { creneauId, slotIndex, PERIODES, PERIODE_LABEL, posteLabel, getCreneauTaches } from "./planningModel";
import { CONGE_TYPE_LABEL, CONGE_TYPE_COLOR, isFerme } from "../rh/congesModel";

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

                {PERIODES.flatMap((periode) => {
                  const s = slotIndex(dayIdx, periode);
                  const cr = creneauMap.get(creneauId(r.id, c.iso, periode)) || null;
                  const cg = congeAtSlot(r.id, s);
                  const taches = getCreneauTaches(cr);
                  const clickable = canWrite || !!cr;

                  const rowStyle = (background) => ({
                    display: "flex", alignItems: "center", gap: space.sm,
                    minHeight: 44, padding: `${space.xs}px ${space.md}px`,
                    borderTop: `1px solid ${EPJ.gray100}`,
                    cursor: clickable ? "pointer" : "default",
                    background,
                  });
                  const periodLabel = (
                    <span style={{
                      flexShrink: 0, width: 74, fontSize: fontSize.xs, fontWeight: fontWeight.medium,
                      color: EPJ.gray500,
                    }}>
                      {PERIODE_LABEL[periode]}
                    </span>
                  );

                  // Une LIGNE par tâche (agenda = liste ; legacy 1 tâche → 1 ligne identique).
                  if (taches.length) {
                    return taches.map((t, ti) => {
                      const ch = t.chantierId ? chantierById.get(t.chantierId) : null;
                      const chNom = t.chantierId ? (ch?.nom || t.chantierId) : "";
                      const poste = t.posteAvancementKey
                        ? posteLabel(ch, t.batiment, t.posteAvancementKey, tasksConfig)
                        : (t.posteLabel || (t.batiment ? `Bât. ${t.batiment}` : ""));
                      // Tâche libre sans chantier : pastille neutre, libellé = poste/label.
                      const main = chNom || poste || "Tâche";
                      const secondary = chNom ? poste : "";
                      const dotColor = t.chantierId ? chantierColor(t.chantierId) : EPJ.gray400;
                      return (
                        <div
                          key={`${periode}-${t.id || ti}`}
                          onClick={clickable ? () => handleClick(r, s, cr) : undefined}
                          style={rowStyle("transparent")}
                        >
                          {periodLabel}
                          <div style={{ display: "flex", alignItems: "center", gap: space.xs, minWidth: 0, flex: 1 }}>
                            <span style={{ width: 10, height: 10, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {main}
                              </div>
                              {secondary && (
                                <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {secondary}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  }

                  // 0 tâche → congé (hachures) ou slot vide (bouton Affecter).
                  const background = cg
                    ? (isFerme(cg)
                        ? `repeating-linear-gradient(45deg, ${EPJ.gray50}, ${EPJ.gray50} 6px, ${EPJ.gray100} 6px, ${EPJ.gray100} 12px)`
                        : `repeating-linear-gradient(45deg, ${EPJ.white}, ${EPJ.white} 6px, ${EPJ.gray50} 6px, ${EPJ.gray50} 12px)`)
                    : "transparent";
                  return [(
                    <div
                      key={periode}
                      onClick={clickable ? () => handleClick(r, s, cr) : undefined}
                      style={rowStyle(background)}
                    >
                      {periodLabel}
                      {cg ? (
                        isFerme(cg) ? (
                          <span style={{
                            flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.medium,
                            color: CONGE_TYPE_COLOR[cg.type] || EPJ.gray600,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            Absent · {CONGE_TYPE_LABEL[cg.type] || "Absent"}
                          </span>
                        ) : (
                          <span title="Demande en attente" style={{
                            flex: 1, fontSize: fontSize.sm, fontWeight: fontWeight.medium,
                            color: EPJ.gray400, fontStyle: "italic",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                          }}>
                            En attente
                          </span>
                        )
                      ) : (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", gap: space.sm }}>
                          <span style={{ color: EPJ.gray300, fontSize: fontSize.sm }}>—</span>
                          {canWrite && <Button size="sm" variant="ghost">Affecter</Button>}
                        </div>
                      )}
                    </div>
                  )];
                })}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

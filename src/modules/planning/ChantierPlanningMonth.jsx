// ═══════════════════════════════════════════════════════════════
//  ChantierPlanningMonth — vue MENSUELLE chantier-centric (Planning V3, Lot 2)
//
//  Rendu À LA PLACE de <PlanningGrid chantier=…> dans l'onglet « Planning »
//  de la fiche Gestion de chantier. PlanningGrid reste l'écran d'accueil
//  (rh.planning) — NON modifié.
//
//  • Grille MOIS : colonnes Lun→Ven (5, pas de week-end), lignes = semaines.
//  • Navigation ‹ mois précédent / suivant ›.
//  • Chaque jour = case listant les tâches du chantier ce jour-là (plusieurs).
//    Chaque tâche = pastille couleur chantier : poste + tag AM/PM + nom de la
//    ressource affectée OU « à affecter ».
//  • Clic sur un jour → créer ; clic sur une pastille → modifier / affecter /
//    libérer / supprimer. TOUTES les écritures passent par AffectationModal
//    (réutilisé tel quel, mono-jour) → EXACTEMENT les 4 opérations du Lot 1.
//
//  REQUÊTE : planningCreneaux where chantierId == chantier.num + date dans
//  [débutMois … finMois]. Index (chantierId, date) déjà déployé.
//  ÉCRIT UNIQUEMENT dans planningCreneaux. Lecture seule chantiers/utilisateurs.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { can } from "../../core/permissions";
import { Button } from "../../core/components/Button";
import { AffectationModal } from "./AffectationModal";
import { PlanningBulkCreate } from "./PlanningBulkCreate";
import {
  PERIODES, WEEK_DAY_LABELS, startOfWeek, addDays, toISODate,
  creneauId, slotIndex, terrainResources, resourcesForConductor,
  chantierColorIndex, posteLabel, isPool,
} from "./planningModel";

// Palette de pastille (alignée PlanningGrid — taille 8 = chantierColorIndex).
const PALETTE = [
  EPJ.blue, EPJ.green, EPJ.orange, EPJ.catEtude,
  EPJ.urgent, EPJ.red, EPJ.blueText, EPJ.greenText,
];

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

// pad2 local (planningModel n'exporte pas son pad2).
function pad2(n) { return String(n).padStart(2, "0"); }

// Matrice du mois : tableau de semaines, chaque semaine = 5 jours (Lun→Ven).
// Les jours hors mois (débordement de la 1re/dernière semaine) portent inMonth:false.
function monthMatrix(year, month) {
  const firstMonday = startOfWeek(new Date(year, month, 1));
  const last = new Date(year, month + 1, 0);          // dernier jour du mois
  const weeks = [];
  let cursor = firstMonday;
  while (cursor <= last) {
    const days = [];
    for (let i = 0; i < WEEK_DAY_LABELS.length; i++) {  // Lun→Ven
      const d = addDays(cursor, i);
      days.push({
        iso: toISODate(d),
        dayNum: d.getDate(),
        weekdayIdx: i,
        inMonth: d.getMonth() === month && d.getFullYear() === year,
      });
    }
    weeks.push(days);
    cursor = addDays(cursor, 7);
  }
  return weeks;
}

export function ChantierPlanningMonth({ chantier }) {
  const { user } = useAuth();
  const { users, chantiers, rolesConfig, tasksConfig, loaded } = useData();

  const chantierId = chantier?.num || null;

  // Permissions — calque PlanningGrid mode onglet (gestionChantier.planning).
  const viewScope = can(user, "gestionChantier.planning", "view", rolesConfig);
  const editScope = can(user, "gestionChantier", "edit", rolesConfig);
  const createScope = can(user, "gestionChantier", "create", rolesConfig);
  const canWrite = [editScope, createScope].some((s) => s === "all" || s === "own_chantiers");

  // Mois courant (1er jour, pour naviguer de mois en mois).
  const [monthAnchor, setMonthAnchor] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const year = monthAnchor.getFullYear();
  const month = monthAnchor.getMonth();

  const [rows, setRows] = useState([]);
  const [loadedSnap, setLoadedSnap] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState(null);
  const [bulk, setBulk] = useState(null);   // création « bulk » sur plage

  const weeks = useMemo(() => monthMatrix(year, month), [year, month]);
  const range = useMemo(() => ({
    start: toISODate(new Date(year, month, 1)),
    end: toISODate(new Date(year, month + 1, 0)),
  }), [year, month]);

  // ─── Lecture live du mois (chantierId + plage de dates) ───
  useEffect(() => {
    if (!chantierId || !viewScope) { setRows([]); setLoadedSnap(true); return; }
    setLoadedSnap(false); setError(null);
    const q = query(
      collection(db, "planningCreneaux"),
      where("chantierId", "==", chantierId),
      where("date", ">=", range.start),
      where("date", "<=", range.end),
    );
    const unsub = onSnapshot(
      q,
      (snap) => { setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setError(null); setLoadedSnap(true); },
      (err) => { console.error("[ChantierPlanningMonth] lecture planningCreneaux échouée :", err); setRows([]); setError(err); setLoadedSnap(true); },
    );
    return unsub;
  }, [chantierId, viewScope, range.start, range.end, reloadKey]);

  const retry = () => { setError(null); setLoadedSnap(false); setReloadKey((k) => k + 1); };

  const creneauMap = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.id, r));
    return m;
  }, [rows]);

  // Tâches par jour ISO (toutes périodes), triées AM avant PM puis par nom.
  const tasksByDate = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => {
      if (!m.has(r.date)) m.set(r.date, []);
      m.get(r.date).push(r);
    });
    for (const list of m.values()) {
      list.sort((a, b) => {
        if (a.periode !== b.periode) return a.periode === "AM" ? -1 : 1;
        return (a.ressourceNom || "").localeCompare(b.ressourceNom || "");
      });
    }
    return m;
  }, [rows]);

  // Ressources sélectionnables — scope conducteur (ses chantiers + son équipe),
  // sinon tout le terrain (Admin/Direction/Assistante).
  const resources = useMemo(
    () => (viewScope === "own_chantiers"
      ? resourcesForConductor(users, chantiers, user)
      : terrainResources(users)),
    [viewScope, users, chantiers, user],
  );

  const chantierColor = PALETTE[chantierColorIndex(chantierId)];

  // ─── Construction du contexte modale pour un jour donné ───
  // weekCols mono-jour → AffectationModal pilote AM/PM via Du/Au (dayIdx=0).
  const dayCols = (iso, weekdayIdx) => {
    const dd = iso.slice(8, 10), mm = iso.slice(5, 7);
    return [{ iso, dayLabel: WEEK_DAY_LABELS[weekdayIdx] || "", dateLabel: `${dd}/${mm}` }];
  };

  // Créer des tâches : clic sur un jour → modale « bulk » (plage Du→Au,
  // période, poste(s)/bâtiment(s) multi, ressource optionnelle), pré-remplie
  // sur le jour cliqué.
  const openCreate = (day) => {
    if (!canWrite || !day.inMonth) return;
    setBulk({ date: day.iso });
  };

  // Éditer une pastille (affectée OU pool) → 4 opérations Lot 1.
  const openTask = (task) => {
    const day = { iso: task.date };
    // weekdayIdx : retrouvé via Lun→Ven (la date du mois est forcément ouvrée si
    // un créneau existe ; sinon fallback 0, sans incidence sur l'écriture).
    let weekdayIdx = 0;
    for (const w of weeks) {
      const f = w.find((d) => d.iso === task.date);
      if (f) { weekdayIdx = f.weekdayIdx; break; }
    }
    const slot = slotIndex(0, task.periode);
    if (isPool(task)) {
      if (!canWrite) return;
      setModal({
        weekCols: dayCols(task.date, weekdayIdx),
        resource: null, fromSlot: slot, toSlot: slot, prefill: null, poolTask: task,
      });
    } else {
      // Affecté : lecture seule autorisée (consultation) si pas de droit d'écriture.
      const res = resources.find((r) => r.id === task.ressourceId)
        || { id: task.ressourceId, nom: task.ressourceNom || task.ressourceId, type: task.ressourceType || "SALARIE", _matchIds: [task.ressourceId] };
      setModal({
        weekCols: dayCols(task.date, weekdayIdx),
        resource: res, fromSlot: slot, toSlot: slot,
        prefill: { chantierId: task.chantierId, batiment: task.batiment, posteAvancementKey: task.posteAvancementKey },
        poolTask: null,
      });
    }
  };

  // ─── États ───
  if (!viewScope) {
    return <EmptyBox icon="🔒" text="Le planning ne vous est pas accessible." />;
  }

  const monthLabel = `${MONTH_NAMES[month]} ${year}`;

  return (
    <div>
      {/* Barre d'outils : navigation mois */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm, alignItems: "center", justifyContent: "space-between", marginBottom: space.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: space.sm }}>
          <Button variant="secondary" size="sm" onClick={() => setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</Button>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900, minWidth: 140, textAlign: "center" }}>
            {monthLabel}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setMonthAnchor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</Button>
          <Button variant="ghost" size="sm" onClick={() => { const n = new Date(); setMonthAnchor(new Date(n.getFullYear(), n.getMonth(), 1)); }}>Ce mois</Button>
        </div>
      </div>

      {error ? (
        <div>
          <EmptyBox icon="⚠️" text="Impossible de charger le planning. Vérifiez votre connexion et réessayez." />
          <div style={{ display: "flex", justifyContent: "center", marginTop: space.md }}>
            <Button variant="secondary" size="sm" onClick={retry}>Réessayer</Button>
          </div>
        </div>
      ) : !loadedSnap || !loaded?.users ? (
        <EmptyBox icon="⏳" text="Chargement du planning…" />
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${EPJ.gray200}`, borderRadius: radius.lg, background: EPJ.white }}>
          <div style={{ minWidth: 720 }}>
            {/* En-tête — jours Lun→Ven */}
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${WEEK_DAY_LABELS.length}, minmax(0, 1fr))`, background: EPJ.gray50, borderBottom: `1px solid ${EPJ.gray200}` }}>
              {WEEK_DAY_LABELS.map((d) => (
                <div key={d} style={{ padding: `${space.sm}px ${space.xs}px`, textAlign: "center", fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray700, borderLeft: `1px solid ${EPJ.gray200}` }}>
                  {d}
                </div>
              ))}
            </div>
            {/* Semaines */}
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: "grid", gridTemplateColumns: `repeat(${WEEK_DAY_LABELS.length}, minmax(0, 1fr))`, borderBottom: `1px solid ${EPJ.gray100}` }}>
                {week.map((day) => {
                  const tasks = day.inMonth ? (tasksByDate.get(day.iso) || []) : [];
                  return (
                    <div
                      key={day.iso}
                      onClick={canWrite && day.inMonth ? () => openCreate(day) : undefined}
                      style={{
                        borderLeft: `1px solid ${EPJ.gray100}`, minHeight: 96, padding: space.xs,
                        background: day.inMonth ? EPJ.white : EPJ.gray50,
                        cursor: canWrite && day.inMonth ? "pointer" : "default",
                        display: "flex", flexDirection: "column", gap: 3, minWidth: 0,
                      }}
                    >
                      <div style={{ fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: day.inMonth ? EPJ.gray600 : EPJ.gray300, textAlign: "right" }}>
                        {day.dayNum}
                      </div>
                      {tasks.map((t) => {
                        const pool = isPool(t);
                        const poste = t.posteAvancementKey
                          ? posteLabel(chantier, t.batiment, t.posteAvancementKey, tasksConfig)
                          : (t.posteLabel || (t.batiment ? `Bât. ${t.batiment}` : "Tâche"));
                        const who = pool ? "à affecter" : (t.ressourceNom || t.ressourceId);
                        return (
                          <div
                            key={t.id}
                            onClick={(e) => { e.stopPropagation(); openTask(t); }}
                            title={`${poste} · ${t.periode} · ${who}`}
                            style={{
                              borderRadius: radius.sm, padding: "3px 6px", lineHeight: 1.2, minWidth: 0,
                              cursor: (canWrite || !pool) ? "pointer" : "default",
                              background: pool ? EPJ.gray100 : chantierColor,
                              color: pool ? EPJ.gray600 : EPJ.white,
                              border: pool ? `1px dashed ${EPJ.gray300}` : "none",
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: fontWeight.semibold, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              <span style={{ opacity: 0.85, fontWeight: fontWeight.regular }}>{t.periode}</span> {poste}
                            </div>
                            <div style={{ fontSize: 10, opacity: pool ? 1 : 0.9, fontStyle: pool ? "italic" : "normal", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {who}
                            </div>
                          </div>
                        );
                      })}
                      {canWrite && day.inMonth && (
                        <div style={{ marginTop: "auto", textAlign: "center", color: EPJ.gray300, fontSize: 14, lineHeight: 1 }}>+</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {modal && (
        <AffectationModal
          user={user}
          initialRessource={modal.resource}
          resources={resources}
          weekCols={modal.weekCols}
          fromSlot={modal.fromSlot}
          toSlot={modal.toSlot}
          prefill={modal.prefill}
          poolTask={modal.poolTask}
          getExisting={(resId, dateIso, periode) =>
            creneauMap.get(creneauId(resId, dateIso, periode)) || null}
          canWrite={canWrite}
          fixedChantier={chantier}
          allChantiers={chantiers || []}
          tasksConfig={tasksConfig}
          users={users}
          onClose={() => setModal(null)}
        />
      )}

      {bulk && (
        <PlanningBulkCreate
          chantier={chantier}
          resources={resources}
          tasksConfig={tasksConfig}
          initialDate={bulk.date}
          canWrite={canWrite}
          user={user}
          onClose={() => setBulk(null)}
        />
      )}
    </div>
  );
}

function EmptyBox({ icon, text }) {
  return (
    <div style={{ background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.lg, padding: space.xl, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: space.sm }}>{icon}</div>
      <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, fontFamily: font.body }}>{text}</div>
    </div>
  );
}

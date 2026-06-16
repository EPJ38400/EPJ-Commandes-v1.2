// ═══════════════════════════════════════════════════════════════
//  PlanningGrid — composant CŒUR partagé du Planning ressources (L8)
//
//  • Prop `chantier` (objet) → mode ONGLET (filtré chantierId) ;
//    `chantier` absent → mode GLOBAL (tous chantiers).
//  • Grille hebdo : lignes = ressources, colonnes = jours × AM/PM,
//    cellule = pastille couleur chantier. Clic → AffectationModal.
//  • Lecture live de planningCreneaux (onSnapshot, callback d'erreur).
//    Filtre conducteur (ses ressources) + toggle « Tout voir ».
//    « Copier S-1 » (getDocs one-shot de la semaine précédente).
//
//  ÉCRIT UNIQUEMENT dans planningCreneaux. Lecture seule chantiers/
//  utilisateurs (cache DataContext). Gating écriture via can().
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useRef } from "react";
import {
  collection, query, where, onSnapshot, getDocs, doc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useViewport } from "../../core/useViewport";
import { can } from "../../core/permissions";
import { Button } from "../../core/components/Button";
import { AffectationModal } from "./AffectationModal";
import {
  PERIODES, NB_WEEK_DAYS, weekColumns, weekRange, weekLabel, startOfWeek, addDays, fromISO, toISODate,
  creneauId, terrainResources, resourcesForConductor, chantierColorIndex, posteLabel,
  isMyChantier,
} from "./planningModel";

// Palette de pastille (tokens EPJ) — taille alignée sur planningModel (8).
const PALETTE = [
  EPJ.blue, EPJ.green, EPJ.orange, EPJ.catEtude,
  EPJ.urgent, EPJ.red, EPJ.blueText, EPJ.greenText,
];
const DAY_TEMPLATE  = `170px repeat(${NB_WEEK_DAYS}, 2fr)`;
const CELL_TEMPLATE = `170px repeat(${NB_WEEK_DAYS * 2}, 1fr)`;
const INNER_MIN_W = 170 + NB_WEEK_DAYS * 2 * 78;

export function PlanningGrid({ chantier = null }) {
  const { user } = useAuth();
  const { users, chantiers, rolesConfig, tasksConfig, loaded } = useData();
  const isPwa = useViewport() === "mobile";

  const isTab = !!chantier;
  const chantierId = chantier?.num || null;
  const moduleKey = isTab ? "gestionChantier" : "rh";
  const subKey = isTab ? "gestionChantier.planning" : "rh.planning";

  const viewScope = can(user, subKey, "view", rolesConfig);
  const editScope = can(user, moduleKey, "edit", rolesConfig);
  const createScope = can(user, moduleKey, "create", rolesConfig);
  const canWrite = [editScope, createScope].some((s) => s === "all" || s === "own_chantiers");

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [showAll, setShowAll] = useState(false);
  const [rows, setRows] = useState([]);          // créneaux de la semaine
  const [loadedSnap, setLoadedSnap] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState(null);
  const [copying, setCopying] = useState(false);
  const genRef = useRef(0);

  const cols = useMemo(() => weekColumns(weekStart), [weekStart]);
  const range = useMemo(() => weekRange(weekStart), [weekStart]);

  // ─── Construction de la requête selon le mode/scope ───
  const buildConstraints = (startISO, endISO) => {
    const c = [where("date", ">=", startISO), where("date", "<=", endISO)];
    if (isTab) return [where("chantierId", "==", chantierId), ...c];
    if (viewScope === "own_items") return [where("ressourceId", "==", user._id), ...c];
    return c; // all / own_chantiers (conducteur) : range date + filtrage client
  };

  // ─── Lecture live de la semaine ───
  useEffect(() => {
    setLoadedSnap(false); setError(null);
    const q = query(collection(db, "planningCreneaux"), ...buildConstraints(range.start, range.end));
    const unsub = onSnapshot(
      q,
      (snap) => { setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setError(null); setLoadedSnap(true); },
      (err) => { console.error("[PlanningGrid] lecture planningCreneaux échouée :", err); setRows([]); setError(err); setLoadedSnap(true); },
    );
    return unsub;
  }, [chantierId, viewScope, user?._id, range.start, range.end, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const retry = () => { setError(null); setLoadedSnap(false); setReloadKey((k) => k + 1); };

  const creneauMap = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.id, r));
    return m;
  }, [rows]);

  // ─── Ressources (lignes) selon le mode/scope ───
  const resources = useMemo(() => {
    if (viewScope === "own_items") {
      return [{ id: user._id, nom: `${user.prenom || ""} ${user.nom || ""}`.trim() || user._id, type: "SALARIE", _matchIds: [user._id, user.id].filter(Boolean) }];
    }
    if (isTab) return terrainResources(users);
    if (viewScope === "own_chantiers" && !showAll) return resourcesForConductor(users, chantiers, user);
    return terrainResources(users);
  }, [viewScope, isTab, showAll, users, chantiers, user]);

  const canToggleAll = !isTab && viewScope === "own_chantiers";

  // Chantiers proposés dans le picker global (actifs, scope respecté).
  const pickerChantiers = useMemo(() => {
    if (isTab) return [];
    const actifs = (chantiers || []).filter((c) => c.statut !== "Archivé" && c.statut !== "Terminé");
    if (viewScope === "own_chantiers") return actifs.filter((c) => isMyChantier(user, c));
    return actifs;
  }, [isTab, chantiers, viewScope, user]);

  const chantierById = useMemo(() => {
    const m = new Map();
    (chantiers || []).forEach((c) => m.set(c.num, c));
    return m;
  }, [chantiers]);

  // ─── Copier S-1 ───
  const copyPreviousWeek = async () => {
    if (!canWrite || copying) return;
    if (!window.confirm("Copier les affectations de la semaine précédente vers les créneaux libres de cette semaine ?")) return;
    setCopying(true);
    const myGen = ++genRef.current;
    try {
      const prevStart = addDays(weekStart, -7);
      const prevRange = weekRange(prevStart);
      const q = query(collection(db, "planningCreneaux"), ...buildConstraints(prevRange.start, prevRange.end));
      const snap = await getDocs(q);
      const visibleIds = new Set(resources.map((r) => r.id));
      const writes = [];
      snap.forEach((d) => {
        const src = d.data();
        if (!src.chantierId) return;                       // on ne copie que l'affecté
        if (!visibleIds.has(src.ressourceId)) return;      // ressources visibles uniquement
        const targetDate = toISODate(addDays(fromISO(src.date), 7));
        const targetId = creneauId(src.ressourceId, targetDate, src.periode);
        if (creneauMap.get(targetId)?.chantierId) return;  // ne pas écraser un créneau déjà affecté
        writes.push(setDoc(doc(db, "planningCreneaux", targetId), {
          ressourceId: src.ressourceId, ressourceNom: src.ressourceNom, ressourceType: src.ressourceType,
          date: targetDate, periode: src.periode,
          chantierId: src.chantierId, batiment: src.batiment ?? null,
          posteAvancementKey: src.posteAvancementKey ?? null, tempsEstimeH: src.tempsEstimeH ?? null,
          tacheId: null, etatValidationMonteur: "NON", smsEnvoye: false,
          creePar: user._id, modifiePar: user._id, updatedAt: serverTimestamp(),
        }, { merge: true }));
      });
      await Promise.all(writes);
    } catch (e) {
      console.error("[PlanningGrid] Copier S-1 échoué :", e);
      if (myGen === genRef.current) setError(e);
    } finally {
      if (myGen === genRef.current) setCopying(false);
    }
  };

  const openCell = (resource, iso, periode) => {
    const existing = creneauMap.get(creneauId(resource.id, iso, periode)) || null;
    if (!canWrite && !existing?.chantierId) return; // lecture seule : rien à montrer sur une case vide
    setModal({ resource, date: iso, periode, existing });
  };

  // ─── États ───
  if (!viewScope) {
    return <EmptyBox icon="🔒" text="Le planning ne vous est pas accessible." />;
  }

  return (
    <div>
      {/* Barre d'outils : navigation semaine + actions */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm, alignItems: "center", justifyContent: "space-between", marginBottom: space.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: space.sm }}>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart((d) => addDays(d, -7))}>←</Button>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900, minWidth: 120, textAlign: "center" }}>
            {weekLabel(weekStart)}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setWeekStart((d) => addDays(d, 7))}>→</Button>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>Cette semaine</Button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
          {canToggleAll && (
            <Button variant={showAll ? "primary" : "secondary"} size="sm" onClick={() => setShowAll((s) => !s)}>
              {showAll ? "Mes ressources" : "Tout voir"}
            </Button>
          )}
          {canWrite && (
            <Button variant="secondary" size="sm" onClick={copyPreviousWeek} loading={copying}>
              ↻ Copier S-1
            </Button>
          )}
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
      ) : resources.length === 0 ? (
        <EmptyBox icon="👷" text="Aucune ressource à afficher." />
      ) : (
        <div style={{ overflowX: "auto", border: `1px solid ${EPJ.gray200}`, borderRadius: radius.lg, background: EPJ.white }}>
          <div style={{ minWidth: INNER_MIN_W }}>
            {/* En-tête — ligne jours */}
            <div style={{ display: "grid", gridTemplateColumns: DAY_TEMPLATE, background: EPJ.gray50, borderBottom: `1px solid ${EPJ.gray200}` }}>
              <div style={{ padding: `${space.sm}px ${space.md}px`, fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray600 }}>
                Ressource
              </div>
              {cols.map((c) => (
                <div key={c.iso} style={{ padding: `${space.sm}px ${space.xs}px`, textAlign: "center", fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray700, borderLeft: `1px solid ${EPJ.gray200}` }}>
                  {c.dayLabel} <span style={{ color: EPJ.gray400 }}>{c.dateLabel}</span>
                </div>
              ))}
            </div>
            {/* En-tête — ligne AM/PM */}
            <div style={{ display: "grid", gridTemplateColumns: CELL_TEMPLATE, background: EPJ.gray50, borderBottom: `1px solid ${EPJ.gray200}` }}>
              <div />
              {cols.map((c) => PERIODES.map((p) => (
                <div key={`${c.iso}_${p}`} style={{ padding: `2px 0`, textAlign: "center", fontSize: fontSize.xs, color: EPJ.gray500, borderLeft: `1px solid ${EPJ.gray100}` }}>
                  {p}
                </div>
              )))}
            </div>
            {/* Lignes ressources */}
            {resources.map((r) => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: CELL_TEMPLATE, borderBottom: `1px solid ${EPJ.gray100}`, minHeight: 44 }}>
                <div style={{ padding: `${space.sm}px ${space.md}px`, display: "flex", alignItems: "center", gap: space.xs, minWidth: 0 }}>
                  <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.nom}
                  </span>
                  {r.type === "ARTISAN" && <span style={{ fontSize: 10, color: EPJ.gray400 }}>(art.)</span>}
                </div>
                {cols.map((c) => PERIODES.map((p) => {
                  const cr = creneauMap.get(creneauId(r.id, c.iso, p));
                  const assigned = cr?.chantierId || null;
                  const color = assigned ? PALETTE[chantierColorIndex(assigned)] : null;
                  const chObj = assigned ? chantierById.get(assigned) : null;
                  const poste = assigned && cr.posteAvancementKey
                    ? posteLabel(chObj, cr.batiment, cr.posteAvancementKey, tasksConfig)
                    : (cr?.batiment ? `Bât. ${cr.batiment}` : "");
                  const clickable = canWrite || !!assigned;
                  return (
                    <div
                      key={`${r.id}_${c.iso}_${p}`}
                      onClick={clickable ? () => openCell(r, c.iso, p) : undefined}
                      style={{
                        borderLeft: `1px solid ${EPJ.gray100}`, padding: 3,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: clickable ? "pointer" : "default",
                      }}
                    >
                      {assigned ? (
                        <div title={`${assigned}${poste ? " · " + poste : ""}${cr.tempsEstimeH != null ? " · " + cr.tempsEstimeH + "h" : ""}`}
                          style={{
                            width: "100%", borderRadius: radius.sm, background: color, color: EPJ.white,
                            padding: "3px 5px", overflow: "hidden", lineHeight: 1.1,
                          }}>
                          <div style={{ fontSize: 10, fontWeight: fontWeight.semibold, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{assigned}</div>
                          {poste && <div style={{ fontSize: 9, opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{poste}</div>}
                        </div>
                      ) : canWrite ? (
                        <span style={{ color: EPJ.gray300, fontSize: 14 }}>+</span>
                      ) : null}
                    </div>
                  );
                }))}
              </div>
            ))}
          </div>
        </div>
      )}

      {modal && (
        <AffectationModal
          user={user}
          ressource={modal.resource}
          date={modal.date}
          periode={modal.periode}
          existing={modal.existing}
          canWrite={canWrite}
          fixedChantier={isTab ? chantier : null}
          allChantiers={pickerChantiers}
          tasksConfig={tasksConfig}
          onClose={() => setModal(null)}
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

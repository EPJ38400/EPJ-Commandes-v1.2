// ═══════════════════════════════════════════════════════════════
//  CongesPage — onglet Congés / absences (RH-2a)
//
//  • Gate : rh.conges._access. Sans droit → EmptyAccess (partagé Planning).
//    Onglet réservé Admin/Direction/Assistante (factory rh.conges view:all) —
//    V1 sans branche conducteur (workflow monteur→N1→N2 = lot RH-2c ultérieur).
//  • Lecture live : onSnapshot(conges where statut == "ACTIF") — pas
//    d'index composite (equality simple). Filtrage mois côté client.
//  • Vue MENSUELLE « qui est absent quand » : lignes = ressources terrain,
//    colonnes = jours du mois, demi-cellule AM/PM colorée si couverte
//    (calque visuel de PlanningGrid). Sous la grille : liste éditable.
//
//  ÉCRIT UNIQUEMENT via CongeModal (collection `conges`). Lecture seule
//  utilisateurs (cache DataContext).
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useViewport } from "../../core/useViewport";
import { can } from "../../core/permissions";
import { Badge } from "../../core/components/Badge";
import { Button } from "../../core/components/Button";
import { EmptyAccess } from "../planning/PlanningTab";
import { toISODate, fromISO, terrainResources } from "../planning/planningModel";
import { CongeModal } from "./CongeModal";
import { CONGE_TYPES, CONGE_TYPE_LABEL, CONGE_TYPE_COLOR, congeCoversSlot } from "./congesModel";

const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const WEEKDAY_LETTER = ["D", "L", "M", "M", "J", "V", "S"];

// Type → tone Badge (aligné sur CONGE_TYPE_COLOR).
const TYPE_TONE = {
  CP: "info", RTT: "success", MALADIE: "danger", SANS_SOLDE: "neutral", AUTRE: "warning",
};

// Jours ISO d'un mois (mois local).
function monthDays(year, monthIdx) {
  const out = [];
  const d = new Date(year, monthIdx, 1);
  while (d.getMonth() === monthIdx) {
    out.push(toISODate(d));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

const fmtDay = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : "");

export function CongesPage() {
  const { user } = useAuth();
  const { users, rolesConfig } = useData();
  const isPwa = useViewport() === "mobile";

  // Onglet réservé Admin/Direction/Assistante (factory rh.conges view:all).
  const accessScope = can(user, "rh.conges", "_access", rolesConfig);

  const [monthRef, setMonthRef] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [conges, setConges] = useState([]);
  const [loadedSnap, setLoadedSnap] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState(null); // { conge } (conge null = création)

  // ─── Lecture live (statut ACTIF) ───
  useEffect(() => {
    if (!accessScope) return;
    setLoadedSnap(false); setError(null);
    const q = query(collection(db, "conges"), where("statut", "==", "ACTIF"));
    const unsub = onSnapshot(
      q,
      (snap) => { setConges(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setError(null); setLoadedSnap(true); },
      (err) => { console.error("[CongesPage] lecture conges échouée :", err); setConges([]); setError(err); setLoadedSnap(true); },
    );
    return unsub;
  }, [accessScope, reloadKey]);

  // ─── Ressources (lignes) = toutes les ressources terrain ───
  const resources = useMemo(() => terrainResources(users), [users]);

  // ─── Mois affiché ───
  const days = useMemo(() => monthDays(monthRef.y, monthRef.m), [monthRef]);
  const monthStart = days[0];
  const monthEnd = days[days.length - 1];

  // Congés chevauchant le mois (tri par date de début).
  const congesDuMois = useMemo(
    () => conges
      .filter((c) => c.du && c.au && c.du <= monthEnd && c.au >= monthStart)
      .sort((a, b) => (a.du < b.du ? -1 : a.du > b.du ? 1 : 0)),
    [conges, monthStart, monthEnd],
  );

  const congesByRes = useMemo(() => {
    const m = new Map();
    congesDuMois.forEach((c) => {
      const arr = m.get(c.ressourceId) || [];
      arr.push(c);
      m.set(c.ressourceId, arr);
    });
    return m;
  }, [congesDuMois]);

  const slotColor = (resId, iso, periode) => {
    const list = congesByRes.get(resId) || [];
    for (const c of list) {
      if (congeCoversSlot(c, iso, periode)) return CONGE_TYPE_COLOR[c.type] || EPJ.gray400;
    }
    return null;
  };

  const resById = useMemo(() => {
    const m = new Map();
    resources.forEach((r) => m.set(r.id, r));
    return m;
  }, [resources]);

  // ─── Gate d'accès (après les hooks) ───
  if (!accessScope) return <EmptyAccess />;

  const prevMonth = () => setMonthRef(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
  const nextMonth = () => setMonthRef(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));
  const thisMonth = () => { const n = new Date(); setMonthRef({ y: n.getFullYear(), m: n.getMonth() }); };
  const retry = () => { setError(null); setLoadedSnap(false); setReloadKey((k) => k + 1); };

  const RES_W = isPwa ? 120 : 160;
  const DAY_W = 30;
  const nbDays = days.length;
  const GRID_TEMPLATE = `${RES_W}px repeat(${nbDays}, minmax(${DAY_W}px, 1fr))`;
  const INNER_MIN_W = RES_W + nbDays * DAY_W;

  return (
    <div>
      {/* Barre d'outils : titre + nav mois + création */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm, alignItems: "center", justifyContent: "space-between", marginBottom: space.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: space.sm }}>
          <Button variant="secondary" size="sm" onClick={prevMonth}>‹</Button>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900, minWidth: 130, textAlign: "center" }}>
            {MONTH_LABELS[monthRef.m]} {monthRef.y}
          </div>
          <Button variant="secondary" size="sm" onClick={nextMonth}>›</Button>
          <Button variant="ghost" size="sm" onClick={thisMonth}>Ce mois</Button>
        </div>
        <Button variant="primary" size="sm" onClick={() => setModal({ conge: null })}>
          + Nouveau congé
        </Button>
      </div>

      {/* Légende des types */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: space.md, marginBottom: space.md }}>
        {CONGE_TYPES.map((t) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fontSize.xs, color: EPJ.gray600 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: CONGE_TYPE_COLOR[t], display: "inline-block" }} />
            {CONGE_TYPE_LABEL[t]}
          </div>
        ))}
      </div>

      {error ? (
        <div>
          <EmptyBox icon="⚠️" text="Impossible de charger les congés. Vérifiez votre connexion et réessayez." />
          <div style={{ display: "flex", justifyContent: "center", marginTop: space.md }}>
            <Button variant="secondary" size="sm" onClick={retry}>Réessayer</Button>
          </div>
        </div>
      ) : !loadedSnap ? (
        <EmptyBox icon="⏳" text="Chargement des congés…" />
      ) : resources.length === 0 ? (
        <EmptyBox icon="👷" text="Aucune ressource à afficher." />
      ) : (
        <>
          {/* Grille mensuelle : lignes = ressources, colonnes = jours (½ AM / ½ PM) */}
          <div style={{ overflowX: "auto", border: `1px solid ${EPJ.gray200}`, borderRadius: radius.lg, background: EPJ.white }}>
            <div style={{ minWidth: INNER_MIN_W }}>
              {/* En-tête : numéros de jour + lettre du jour de semaine */}
              <div style={{ display: "grid", gridTemplateColumns: GRID_TEMPLATE, background: EPJ.gray50, borderBottom: `1px solid ${EPJ.gray200}` }}>
                <div style={{ padding: `${space.sm}px ${space.md}px`, fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray600 }}>
                  Ressource
                </div>
                {days.map((iso) => {
                  const dow = fromISO(iso).getDay();
                  const weekend = dow === 0 || dow === 6;
                  return (
                    <div key={iso} style={{
                      padding: `${space.xs}px 0`, textAlign: "center", borderLeft: `1px solid ${EPJ.gray100}`,
                      background: weekend ? EPJ.gray100 : "transparent",
                    }}>
                      <div style={{ fontSize: 9, color: EPJ.gray400, lineHeight: 1 }}>{WEEKDAY_LETTER[dow]}</div>
                      <div style={{ fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: EPJ.gray700, fontVariantNumeric: "tabular-nums" }}>
                        {iso.slice(8, 10)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Lignes ressources */}
              {resources.map((r) => (
                <div key={r.id} style={{ display: "grid", gridTemplateColumns: GRID_TEMPLATE, borderBottom: `1px solid ${EPJ.gray100}`, minHeight: 34, alignItems: "stretch" }}>
                  <div style={{ padding: `${space.sm}px ${space.md}px`, display: "flex", alignItems: "center", gap: space.xs, minWidth: 0 }}>
                    <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.nom}
                    </span>
                    {r.type === "ARTISAN" && <span style={{ fontSize: 10, color: EPJ.gray400 }}>(art.)</span>}
                  </div>
                  {days.map((iso) => {
                    const dow = fromISO(iso).getDay();
                    const weekend = dow === 0 || dow === 6;
                    const cAm = slotColor(r.id, iso, "AM");
                    const cPm = slotColor(r.id, iso, "PM");
                    return (
                      <div key={iso} style={{
                        borderLeft: `1px solid ${EPJ.gray100}`,
                        background: weekend ? EPJ.gray50 : "transparent",
                        display: "flex",
                      }}>
                        <div style={{ flex: 1, background: cAm || "transparent" }} />
                        <div style={{ flex: 1, background: cPm || "transparent" }} />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Liste des congés du mois */}
          <div style={{ marginTop: space.lg }}>
            <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900, marginBottom: space.sm }}>
              Congés du mois ({congesDuMois.length})
            </div>
            {congesDuMois.length === 0 ? (
              <EmptyBox icon="🌴" text="Aucun congé sur ce mois." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: space.xs }}>
                {congesDuMois.map((c) => {
                  const nom = c.ressourceNom || resById.get(c.ressourceId)?.nom || c.ressourceId;
                  return (
                    <div
                      key={c.id}
                      onClick={() => setModal({ conge: c })}
                      style={{
                        display: "flex", alignItems: "center", gap: space.sm, flexWrap: "wrap",
                        background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.md,
                        padding: `${space.sm}px ${space.md}px`, cursor: "pointer",
                      }}
                    >
                      <Badge tone={TYPE_TONE[c.type] || "neutral"} label={CONGE_TYPE_LABEL[c.type] || c.type} />
                      <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900 }}>
                        {nom}
                      </span>
                      <span style={{ fontSize: fontSize.sm, color: EPJ.gray600, fontVariantNumeric: "tabular-nums" }}>
                        {fmtDay(c.du)}{c.demiJourneeDebut === "PM" ? " (aprem)" : ""} → {fmtDay(c.au)}{c.demiJourneeFin === "AM" ? " (matin)" : ""}
                      </span>
                      {c.motif && (
                        <span style={{ fontSize: fontSize.xs, color: EPJ.gray500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          · {c.motif}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {modal && (
        <CongeModal
          user={user}
          users={users}
          conge={modal.conge}
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

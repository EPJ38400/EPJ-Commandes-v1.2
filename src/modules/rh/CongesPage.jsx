// ═══════════════════════════════════════════════════════════════
//  CongesPage — onglet Congés / absences (RH-2a → workflow RH-2c)
//
//  Trois publics, déduits de can(user,"rh.conges", …) :
//   • view === "own_items"  (salarié) → écran « Mes demandes » :
//     bouton « Demander une absence » + liste de SES congés (statut Badge),
//     annulation tant que ≠ VALIDEE. Pas de grille équipe.
//   • view === "own_chantiers" (conducteur, N1) → file « À valider »
//     (DEMANDE & !sauteN1 de ses ressources) + grille mensuelle scopée.
//   • view === "all" (Direction/Assistante, N2/gestionnaire) → file
//     « À valider » (VALIDEE_N1 ∪ DEMANDE&sauteN1) + grille + « + Nouveau congé ».
//
//  Lecture live : onSnapshot(conges where statut in
//  ["DEMANDE","VALIDEE_N1","VALIDEE"]) — filtre « in » simple champ, PAS
//  d'index composite. Scope + mois filtrés côté client.
//
//  ÉCRIT `conges` : validation N1/N2 (update statut+validation), création via
//  CongeModal, annulation via update statut "ANNULEE". Lecture seule users/chantiers.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from "react";
import {
  collection, query, where, onSnapshot, doc, updateDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useViewport } from "../../core/useViewport";
import { can } from "../../core/permissions";
import { Badge } from "../../core/components/Badge";
import { Banner } from "../../core/components/Banner";
import { Button } from "../../core/components/Button";
import { Field } from "../../core/components/Field";
import { EmptyAccess } from "../planning/PlanningTab";
import { toISODate, fromISO, resourcesForConductor } from "../planning/planningModel";
import { CongeModal } from "./CongeModal";
import {
  CONGE_TYPES, CONGE_TYPE_LABEL, CONGE_TYPE_COLOR, CONGE_STATUT_LABEL,
  congeCoversSlot, isFerme, soldeCongesCP, joursOuvrablesDecomptes,
  soldeRCR, minutesRCRDecomptees, formatMinutes, salariesConges,
} from "./congesModel";

// Format jours FR (décimale virgule) : 7.5 → "7,5".
const fmtJ = (n) => (Number(n) || 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 });
// Adapte un doc rhSoldes vers les args de soldeCongesCP.
const soldeArgs = (s) => ({
  soldeInitial: Number(s?.congesSoldeInitial) || 0,
  ajustement: Number(s?.congesAjustement) || 0,
});
// Args du solde RCR (minutes) depuis un doc rhSoldes.
const rcrArgs = (s) => ({ rcrSoldeMinutes: Number(s?.rcrSoldeMinutes) || 0 });
// Plafond d'alerte RCR : 7 j = 2940 min (art. plafond récup).
const RCR_PLAFOND_MIN = 2940;

const MONTH_LABELS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const WEEKDAY_LETTER = ["D", "L", "M", "M", "J", "V", "S"];

// Type → tone Badge (aligné sur CONGE_TYPE_COLOR).
const TYPE_TONE = {
  CP: "info", RECUP: "success", MALADIE: "danger", SANS_SOLDE: "neutral", AUTRE: "warning",
};
// Statut → tone Badge.
const STATUT_TONE = {
  DEMANDE: "warning", VALIDEE_N1: "info", VALIDEE: "success", REFUSEE: "danger", ANNULEE: "neutral",
};

// Hachures pâles « en attente » (créneau demandé, non encore validé).
const PENDING_HATCH = `repeating-linear-gradient(45deg, ${EPJ.gray50}, ${EPJ.gray50} 4px, ${EPJ.gray100} 4px, ${EPJ.gray100} 8px)`;

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
const fmtRange = (c) =>
  `${fmtDay(c.du)}${c.demiJourneeDebut === "PM" ? " (aprem)" : ""} → ${fmtDay(c.au)}${c.demiJourneeFin === "AM" ? " (matin)" : ""}`;

export function CongesPage() {
  const { user } = useAuth();
  const { users, chantiers, rolesConfig } = useData();
  const isPwa = useViewport() === "mobile";

  const viewScope = can(user, "rh.conges", "view", rolesConfig);
  const validateScope = can(user, "rh.conges", "validate", rolesConfig);
  const gestionnaire = validateScope === "all";       // Direction/Assistante
  const isN1 = validateScope === "own_chantiers";     // Conducteur
  const selfId = user?._id || user?.id || "";

  const [monthRef, setMonthRef] = useState(() => {
    const n = new Date();
    return { y: n.getFullYear(), m: n.getMonth() };
  });
  const [conges, setConges] = useState([]);
  const [loadedSnap, setLoadedSnap] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modal, setModal] = useState(null); // { conge } (conge null = création)
  const [actingId, setActingId] = useState(null);
  const [soldesMap, setSoldesMap] = useState({}); // rhSoldes indexés par ressourceId
  const [showSoldes, setShowSoldes] = useState(false); // panneau « Soldes CP » (gestionnaire)

  // ─── Lecture rhSoldes (RH-3a) — ciblée selon la vue ───
  //   • salarié (own_items) → uniquement SON doc ;
  //   • gestionnaire (all)  → toute la collection (panneau + calculs) ;
  //   • conducteur (own_chantiers) → non requis (pas de compteur CP).
  useEffect(() => {
    if (viewScope === "own_items") {
      if (!selfId) return;
      const unsub = onSnapshot(
        doc(db, "rhSoldes", selfId),
        (d) => setSoldesMap(d.exists() ? { [selfId]: d.data() } : {}),
        () => setSoldesMap({}),
      );
      return unsub;
    }
    if (viewScope === "all") {
      const unsub = onSnapshot(
        collection(db, "rhSoldes"),
        (snap) => { const m = {}; snap.forEach((d) => { m[d.id] = d.data(); }); setSoldesMap(m); },
        () => setSoldesMap({}),
      );
      return unsub;
    }
    setSoldesMap({});
    return undefined;
  }, [viewScope, selfId]);

  // ─── Lecture live (statuts vivants du workflow) ───
  useEffect(() => {
    if (!viewScope) return;
    setLoadedSnap(false); setError(null);
    const q = query(collection(db, "conges"), where("statut", "in", ["DEMANDE", "VALIDEE_N1", "VALIDEE"]));
    const unsub = onSnapshot(
      q,
      (snap) => { setConges(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setError(null); setLoadedSnap(true); },
      (err) => { console.error("[CongesPage] lecture conges échouée :", err); setConges([]); setError(err); setLoadedSnap(true); },
    );
    return unsub;
  }, [viewScope, reloadKey]);

  // ─── Périmètre de ressources (grille + scope conducteur) ───
  const resources = useMemo(() => {
    if (viewScope === "own_chantiers")
      return resourcesForConductor(users, chantiers, user).filter((r) => r.type !== "ARTISAN");
    return salariesConges(users);
  }, [viewScope, users, chantiers, user]);

  // IDs de ressources visibles par le conducteur (filtrage client own_chantiers).
  const scopeResIds = useMemo(
    () => (viewScope === "own_chantiers" ? new Set(resources.map((r) => r.id)) : null),
    [viewScope, resources],
  );

  // ─── Congés filtrés par scope ───
  const scopedConges = useMemo(() => {
    if (viewScope === "own_items") return conges.filter((c) => c.ressourceId === selfId);
    if (viewScope === "own_chantiers") return conges.filter((c) => scopeResIds?.has(c.ressourceId));
    return conges; // all
  }, [conges, viewScope, selfId, scopeResIds]);

  // ─── File « À valider » (selon le niveau) ───
  const aValider = useMemo(() => {
    let list;
    if (isN1) list = scopedConges.filter((c) => c.statut === "DEMANDE" && !c.sauteN1);
    else if (gestionnaire) list = scopedConges.filter((c) => c.statut === "VALIDEE_N1" || (c.statut === "DEMANDE" && c.sauteN1));
    else return [];
    return list.slice().sort((a, b) => (a.du < b.du ? -1 : a.du > b.du ? 1 : 0));
  }, [scopedConges, isN1, gestionnaire]);

  // ─── Mois affiché ───
  const days = useMemo(() => monthDays(monthRef.y, monthRef.m), [monthRef]);
  const monthStart = days[0];
  const monthEnd = days[days.length - 1];

  // Congés chevauchant le mois (tri par date de début).
  const congesDuMois = useMemo(
    () => scopedConges
      .filter((c) => c.du && c.au && c.du <= monthEnd && c.au >= monthStart)
      .sort((a, b) => (a.du < b.du ? -1 : a.du > b.du ? 1 : 0)),
    [scopedConges, monthStart, monthEnd],
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

  // Congé couvrant une demi-journée (VALIDEE prioritaire sur une demande).
  const slotConge = (resId, iso, periode) => {
    const list = congesByRes.get(resId) || [];
    let pending = null;
    for (const c of list) {
      if (!congeCoversSlot(c, iso, periode)) continue;
      if (isFerme(c)) return c;   // ferme = prioritaire
      pending = pending || c;
    }
    return pending;
  };

  const resById = useMemo(() => {
    const m = new Map();
    resources.forEach((r) => m.set(r.id, r));
    return m;
  }, [resources]);

  // ─── Actions de validation ───
  const doUpdate = async (conge, patch) => {
    if (actingId) return;
    setActingId(conge.id);
    try {
      await updateDoc(doc(db, "conges", conge.id), { ...patch, updatedAt: serverTimestamp() });
    } catch (e) {
      console.error("[CongesPage] mise à jour statut échouée :", e);
      window.alert("Échec de l'enregistrement. Vérifiez votre connexion et réessayez.");
    } finally {
      setActingId(null);
    }
  };

  const valider = (conge) => {
    const vBloc = { par: selfId, parNom: `${user?.prenom || ""} ${user?.nom || ""}`.trim() || selfId, decision: "OK", date: serverTimestamp() };
    if (isN1) doUpdate(conge, { statut: "VALIDEE_N1", validationN1: vBloc });
    else doUpdate(conge, { statut: "VALIDEE", validationN2: vBloc });
  };

  const refuser = (conge) => {
    const commentaire = window.prompt("Motif du refus (optionnel) :", "") ?? null;
    const vBloc = { par: selfId, parNom: `${user?.prenom || ""} ${user?.nom || ""}`.trim() || selfId, decision: "REFUS", commentaire: commentaire || null, date: serverTimestamp() };
    if (isN1) doUpdate(conge, { statut: "REFUSEE", validationN1: vBloc });
    else doUpdate(conge, { statut: "REFUSEE", validationN2: vBloc });
  };

  // ─── Gate d'accès (après les hooks) ───
  if (!viewScope) return <EmptyAccess />;

  const prevMonth = () => setMonthRef(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }));
  const nextMonth = () => setMonthRef(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }));
  const thisMonth = () => { const n = new Date(); setMonthRef({ y: n.getFullYear(), m: n.getMonth() }); };
  const retry = () => { setError(null); setLoadedSnap(false); setReloadKey((k) => k + 1); };

  // ─────────────────────────────────────────────────────────────
  //  Écran SALARIÉ — « Mes demandes » (view own_items)
  // ─────────────────────────────────────────────────────────────
  if (viewScope === "own_items") {
    const mesConges = scopedConges.slice().sort((a, b) => (a.du > b.du ? -1 : a.du < b.du ? 1 : 0));
    const mesValidees = scopedConges.filter((c) => c.statut === "VALIDEE");
    const monSolde = soldeCongesCP(soldeArgs(soldesMap[selfId]), mesValidees);
    const monRCR = soldeRCR(rcrArgs(soldesMap[selfId]), mesValidees);
    // Alertes plafonds (non bloquantes) : solde RCR > 7 j, ou prise RECUP > 5 j.
    const rcrDepassePlafond = monRCR.solde > RCR_PLAFOND_MIN;
    const rcrLonguePrise = mesValidees.some(
      (c) => c.type === "RECUP" && joursOuvrablesDecomptes(c.du, c.au, c.demiJourneeDebut, c.demiJourneeFin) > 5,
    );
    return (
      <div>
        {/* Bandeau compteurs Congés payés + Récupération (RH-3a / RH-3b) */}
        <div style={{
          display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: space.md,
          background: EPJ.infoBg, border: `1px solid ${EPJ.blue}33`, borderRadius: radius.lg,
          padding: `${space.sm}px ${space.md}px`, marginBottom: space.md,
        }}>
          <span style={{ display: "flex", alignItems: "baseline", gap: space.xs, flexWrap: "wrap" }}>
            <span style={{ fontSize: 22 }}>🌴</span>
            <span style={{ fontSize: fontSize.xs, color: EPJ.gray600 }}>
              Acquis N-1 : {fmtJ(monSolde.acquisN1)} j · Acquis N (en cours) : {fmtJ(monSolde.acquisN)} j · Pris : {fmtJ(monSolde.pris)} j ·
            </span>
            <span style={{ fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: EPJ.gray900 }}>
              Disponible : {fmtJ(monSolde.disponible)} j
            </span>
          </span>
          <span style={{ display: "flex", alignItems: "baseline", gap: space.xs, flexWrap: "wrap" }}>
            <span style={{ fontSize: 18 }}>⏱️</span>
            <span style={{ fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: EPJ.gray900 }}>
              Récup — {formatMinutes(monRCR.solde)}
            </span>
            <span style={{ fontSize: fontSize.xs, color: EPJ.gray600 }}>
              (crédit {formatMinutes(monRCR.saisi)} · pris {formatMinutes(monRCR.pris)} cette année)
            </span>
          </span>
        </div>

        {rcrDepassePlafond && (
          <Banner
            tone="warning"
            icon="⏱️"
            title={`Récup au-delà du plafond (${formatMinutes(monRCR.solde)})`}
            text="Le solde de récupération dépasse 7 jours (49 h). Pense à le solder."
          />
        )}
        {rcrLonguePrise && (
          <Banner
            tone="info"
            icon="ℹ️"
            title="Récup longue"
            text="Une récupération couvre plus de 5 jours consécutifs."
          />
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm, alignItems: "center", justifyContent: "space-between", marginBottom: space.md }}>
          <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: EPJ.gray900 }}>Mes demandes d'absence</div>
          <Button variant="primary" size="sm" onClick={() => setModal({ conge: null })}>+ Demander une absence</Button>
        </div>

        {error ? (
          <div>
            <EmptyBox icon="⚠️" text="Impossible de charger vos congés. Vérifiez votre connexion et réessayez." />
            <div style={{ display: "flex", justifyContent: "center", marginTop: space.md }}>
              <Button variant="secondary" size="sm" onClick={retry}>Réessayer</Button>
            </div>
          </div>
        ) : !loadedSnap ? (
          <EmptyBox icon="⏳" text="Chargement…" />
        ) : mesConges.length === 0 ? (
          <EmptyBox icon="🌴" text="Aucune demande en cours. Cliquez sur « Demander une absence »." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: space.xs }}>
            {mesConges.map((c) => (
              <div key={c.id} onClick={() => setModal({ conge: c })}
                style={{ display: "flex", alignItems: "center", gap: space.sm, flexWrap: "wrap", background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.md, padding: `${space.sm}px ${space.md}px`, cursor: "pointer" }}>
                <Badge tone={STATUT_TONE[c.statut] || "neutral"} label={CONGE_STATUT_LABEL[c.statut] || c.statut} />
                <Badge tone={TYPE_TONE[c.type] || "neutral"} label={CONGE_TYPE_LABEL[c.type] || c.type} />
                <span style={{ fontSize: fontSize.sm, color: EPJ.gray600, fontVariantNumeric: "tabular-nums" }}>{fmtRange(c)}</span>
                {c.type === "CP" && (
                  <span style={{ fontSize: fontSize.xs, color: EPJ.gray500, fontVariantNumeric: "tabular-nums" }}>
                    · {fmtJ(joursOuvrablesDecomptes(c.du, c.au, c.demiJourneeDebut, c.demiJourneeFin))} j ouvrables
                  </span>
                )}
                {c.type === "RECUP" && (
                  <span style={{ fontSize: fontSize.xs, color: EPJ.gray500, fontVariantNumeric: "tabular-nums" }}>
                    · {formatMinutes(minutesRCRDecomptees(c.du, c.au, c.demiJourneeDebut, c.demiJourneeFin))}
                  </span>
                )}
                {c.motif && (
                  <span style={{ fontSize: fontSize.xs, color: EPJ.gray500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {c.motif}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {modal && (
          <CongeModal user={user} users={users} conge={modal.conge} onClose={() => setModal(null)} />
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  //  Écran VALIDATEUR / GESTIONNAIRE (view own_chantiers | all)
  // ─────────────────────────────────────────────────────────────
  const RES_W = isPwa ? 120 : 160;
  const DAY_W = 30;
  const nbDays = days.length;
  const GRID_TEMPLATE = `${RES_W}px repeat(${nbDays}, minmax(${DAY_W}px, 1fr))`;
  const INNER_MIN_W = RES_W + nbDays * DAY_W;

  return (
    <div>
      {/* Barre d'outils : nav mois + création (gestionnaire) / demande (conducteur) */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm, alignItems: "center", justifyContent: "space-between", marginBottom: space.md }}>
        <div style={{ display: "flex", alignItems: "center", gap: space.sm }}>
          <Button variant="secondary" size="sm" onClick={prevMonth}>‹</Button>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900, minWidth: 130, textAlign: "center" }}>
            {MONTH_LABELS[monthRef.m]} {monthRef.y}
          </div>
          <Button variant="secondary" size="sm" onClick={nextMonth}>›</Button>
          <Button variant="ghost" size="sm" onClick={thisMonth}>Ce mois</Button>
        </div>
        {gestionnaire ? (
          <div style={{ display: "flex", gap: space.sm, flexWrap: "wrap" }}>
            <Button variant="secondary" size="sm" onClick={() => setShowSoldes(true)}>🌴 Soldes CP</Button>
            <Button variant="primary" size="sm" onClick={() => setModal({ conge: null })}>+ Nouveau congé</Button>
          </div>
        ) : (
          <Button variant="primary" size="sm" onClick={() => setModal({ conge: null })}>+ Demander une absence</Button>
        )}
      </div>

      {/* File « À valider » (N1 conducteur / N2 direction) */}
      {(isN1 || gestionnaire) && (
        <div style={{ marginBottom: space.lg }}>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900, marginBottom: space.sm }}>
            À valider ({aValider.length})
          </div>
          {aValider.length === 0 ? (
            <EmptyBox icon="✅" text="Aucune demande en attente de votre validation." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: space.xs }}>
              {aValider.map((c) => {
                const nom = c.ressourceNom || resById.get(c.ressourceId)?.nom || c.ressourceId;
                const busy = actingId === c.id;
                return (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: space.sm, flexWrap: "wrap", background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.md, padding: `${space.sm}px ${space.md}px` }}>
                    <Badge tone={STATUT_TONE[c.statut] || "neutral"} label={CONGE_STATUT_LABEL[c.statut] || c.statut} />
                    <Badge tone={TYPE_TONE[c.type] || "neutral"} label={CONGE_TYPE_LABEL[c.type] || c.type} />
                    <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900 }}>{nom}</span>
                    <span style={{ fontSize: fontSize.sm, color: EPJ.gray600, fontVariantNumeric: "tabular-nums" }}>{fmtRange(c)}</span>
                    {c.motif && (
                      <span style={{ fontSize: fontSize.xs, color: EPJ.gray500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>· {c.motif}</span>
                    )}
                    <div style={{ display: "flex", gap: space.xs, marginLeft: "auto" }}>
                      <Button variant="secondary" size="sm" onClick={() => refuser(c)} disabled={busy}>Refuser</Button>
                      <Button variant="primary" size="sm" onClick={() => valider(c)} loading={busy}>Valider</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Légende des types */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: space.md, marginBottom: space.md, alignItems: "center" }}>
        {CONGE_TYPES.map((t) => (
          <div key={t} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fontSize.xs, color: EPJ.gray600 }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: CONGE_TYPE_COLOR[t], display: "inline-block" }} />
            {CONGE_TYPE_LABEL[t]}
          </div>
        ))}
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: fontSize.xs, color: EPJ.gray600 }}>
          <span style={{ width: 12, height: 12, borderRadius: 3, background: PENDING_HATCH, display: "inline-block", border: `1px solid ${EPJ.gray200}` }} />
          En attente
        </div>
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
                  </div>
                  {days.map((iso) => {
                    const dow = fromISO(iso).getDay();
                    const weekend = dow === 0 || dow === 6;
                    const cAm = slotConge(r.id, iso, "AM");
                    const cPm = slotConge(r.id, iso, "PM");
                    // Ferme (VALIDEE) = plein couleur du type + cause (via légende) ;
                    // en attente (DEMANDE/VALIDEE_N1) = hachures pâles.
                    const bg = (c) => !c ? "transparent" : (isFerme(c) ? (CONGE_TYPE_COLOR[c.type] || EPJ.gray400) : PENDING_HATCH);
                    return (
                      <div key={iso} style={{
                        borderLeft: `1px solid ${EPJ.gray100}`,
                        background: weekend ? EPJ.gray50 : "transparent",
                        display: "flex",
                      }}>
                        <div title={cAm ? `${CONGE_TYPE_LABEL[cAm.type]}${isFerme(cAm) ? "" : " (en attente)"}` : undefined} style={{ flex: 1, background: bg(cAm) }} />
                        <div title={cPm ? `${CONGE_TYPE_LABEL[cPm.type]}${isFerme(cPm) ? "" : " (en attente)"}` : undefined} style={{ flex: 1, background: bg(cPm) }} />
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
                      <Badge tone={STATUT_TONE[c.statut] || "neutral"} label={CONGE_STATUT_LABEL[c.statut] || c.statut} />
                      <Badge tone={TYPE_TONE[c.type] || "neutral"} label={CONGE_TYPE_LABEL[c.type] || c.type} />
                      <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900 }}>
                        {nom}
                      </span>
                      <span style={{ fontSize: fontSize.sm, color: EPJ.gray600, fontVariantNumeric: "tabular-nums" }}>
                        {fmtRange(c)}
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

      {showSoldes && (
        <SoldesPanel
          user={user}
          resources={salariesConges(users)}
          soldesMap={soldesMap}
          congesValidees={conges.filter((c) => c.statut === "VALIDEE")}
          onClose={() => setShowSoldes(false)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  SoldesPanel — saisie des soldes CP par ressource (gestionnaire)
//  Écrit rhSoldes/{ressourceId} (setDoc merge). acquis/pris/solde calculés
//  en lecture (soldeCongesCP), les congés VALIDEE étant regroupés par ressource.
// ─────────────────────────────────────────────────────────────
function SoldesPanel({ user, resources, soldesMap, congesValidees, onClose }) {
  const isPwa = useViewport() === "mobile";
  const selfId = user?._id || user?.id || "";

  // Draft éditable (chaînes) seedé depuis rhSoldes. Le crédit RCR est saisi en
  // h + min (mini-picker) mais stocké en MINUTES dans rhSoldes.rcrSoldeMinutes.
  const [draft, setDraft] = useState(() => {
    const d = {};
    resources.forEach((r) => {
      const s = soldesMap[r.id] || {};
      const rcrMin = Number(s.rcrSoldeMinutes) || 0;
      d[r.id] = {
        initial: s.congesSoldeInitial != null ? String(s.congesSoldeInitial) : "",
        ajust: s.congesAjustement != null ? String(s.congesAjustement) : "",
        rcrH: rcrMin ? String(Math.floor(rcrMin / 60)) : "",
        rcrM: rcrMin ? String(rcrMin % 60) : "",
      };
    });
    return d;
  });
  const [savingId, setSavingId] = useState(null);
  const [savedId, setSavedId] = useState(null);

  // Congés VALIDEE regroupés par ressource (pour le calcul « pris »).
  const congesByRes = useMemo(() => {
    const m = new Map();
    (congesValidees || []).forEach((c) => {
      const a = m.get(c.ressourceId) || [];
      a.push(c);
      m.set(c.ressourceId, a);
    });
    return m;
  }, [congesValidees]);

  const setField = (id, key, val) =>
    setDraft((prev) => ({ ...prev, [id]: { ...prev[id], [key]: val } }));

  const saveRow = async (r) => {
    if (savingId) return;
    setSavingId(r.id); setSavedId(null);
    try {
      const rcrMinutes = (Number(draft[r.id]?.rcrH) || 0) * 60 + (Number(draft[r.id]?.rcrM) || 0);
      await setDoc(doc(db, "rhSoldes", r.id), {
        congesSoldeInitial: Number(draft[r.id]?.initial) || 0,
        congesAjustement: Number(draft[r.id]?.ajust) || 0,
        rcrSoldeMinutes: rcrMinutes,
        updatedBy: selfId,
        updatedByNom: `${user?.prenom || ""} ${user?.nom || ""}`.trim() || selfId,
        updatedAt: serverTimestamp(),
      }, { merge: true });
      setSavedId(r.id);
    } catch (e) {
      console.error("[SoldesPanel] enregistrement solde échoué :", e);
      window.alert("Échec de l'enregistrement du solde. Vérifiez votre connexion et réessayez.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: EPJ.scrim, zIndex: 1000,
        display: "flex", alignItems: isPwa ? "flex-end" : "center", justifyContent: "center",
        padding: isPwa ? 0 : space.lg,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: EPJ.white, borderRadius: isPwa ? `${radius.xl}px ${radius.xl}px 0 0` : radius.xl,
          padding: space.lg, width: "100%", maxWidth: 760, maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: space.md }}>
          <div>
            <div style={{ fontFamily: font.display, fontSize: fontSize.lg, fontWeight: fontWeight.regular, color: EPJ.gray900, letterSpacing: "-0.01em" }}>
              Soldes Congés payés & Récupération
            </div>
            <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, marginTop: 2 }}>
              CP : Acquis N-1 = initial + ajustement · Disponible = Acquis N-1 − pris (l'acquis N en cours n'entre pas dans le disponible). RCR : crédit − pris (année civile).
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>Fermer</Button>
        </div>

        {resources.length === 0 ? (
          <EmptyBox icon="👷" text="Aucune ressource à afficher." />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: space.xs }}>
            {resources.map((r) => {
              const s = soldeCongesCP(
                { soldeInitial: Number(draft[r.id]?.initial) || 0, ajustement: Number(draft[r.id]?.ajust) || 0 },
                congesByRes.get(r.id) || [],
              );
              const rcrMinutes = (Number(draft[r.id]?.rcrH) || 0) * 60 + (Number(draft[r.id]?.rcrM) || 0);
              const rcr = soldeRCR({ rcrSoldeMinutes: rcrMinutes }, congesByRes.get(r.id) || []);
              const busy = savingId === r.id;
              return (
                <div key={r.id} style={{
                  display: "flex", flexWrap: "wrap", alignItems: "flex-end", gap: space.sm,
                  background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.md,
                  padding: `${space.sm}px ${space.md}px`,
                }}>
                  <div style={{ minWidth: 140, flex: "1 1 140px" }}>
                    <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.nom}
                    </div>
                  </div>
                  <Field type="number" label="Initial (j)" dense width={80}
                    value={draft[r.id]?.initial ?? ""} onChange={(e) => setField(r.id, "initial", e.target.value)} />
                  <Field type="number" label="Ajust. (j)" dense width={80}
                    value={draft[r.id]?.ajust ?? ""} onChange={(e) => setField(r.id, "ajust", e.target.value)} />
                  <ReadStat label="Acquis N-1" value={`${fmtJ(s.acquisN1)} j`} />
                  <ReadStat label="Acquis N" value={`${fmtJ(s.acquisN)} j`} />
                  <ReadStat label="Pris" value={`${fmtJ(s.pris)} j`} />
                  <ReadStat label="Disponible" value={`${fmtJ(s.disponible)} j`} strong />
                  {/* Crédit RCR : mini-picker h + min (stocké en minutes). */}
                  <Field type="number" label="RCR (h)" dense width={70}
                    value={draft[r.id]?.rcrH ?? ""} onChange={(e) => setField(r.id, "rcrH", e.target.value)} />
                  <Field type="number" label="min" dense width={64}
                    value={draft[r.id]?.rcrM ?? ""} onChange={(e) => setField(r.id, "rcrM", e.target.value)} />
                  <ReadStat label="Solde RCR" value={formatMinutes(rcr.solde)} strong />
                  <Button variant={savedId === r.id ? "secondary" : "primary"} size="sm" onClick={() => saveRow(r)} loading={busy}>
                    {savedId === r.id ? "✓ Enregistré" : "Enregistrer"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function ReadStat({ label, value, strong }) {
  return (
    <div style={{ minWidth: 62 }}>
      <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray700, marginBottom: space.xs + 2 }}>{label}</div>
      <div style={{
        fontSize: fontSize.sm, fontVariantNumeric: "tabular-nums",
        fontWeight: strong ? fontWeight.semibold : fontWeight.regular,
        color: strong ? EPJ.gray900 : EPJ.gray600, padding: "6px 0",
      }}>
        {value}
      </div>
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

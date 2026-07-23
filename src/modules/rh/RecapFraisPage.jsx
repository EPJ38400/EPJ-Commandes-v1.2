// ═══════════════════════════════════════════════════════════════
//  RecapFraisPage — onglet « Récap frais » du module RH (RH-Frais-3b2b)
//
//  Écran RÉSERVÉ AU GESTIONNAIRE (gate rh.frais._access = Admin/Direction/
//  Assistante, partagée avec « Notes de frais » / « Heures salariés »).
//
//  Affichage + ÉDITION + export du récap mensuel des frais de déplacement :
//   • sélecteur mois (fraisRecap existants ∪ mois des heures importées) +
//     bouton « Générer / Regénérer » → callable genererRecapFrais({mois, force:true}) ;
//   • lecture LIVE fraisRecap/{mois} (onSnapshot) + surcharges LIVE fraisOverrides ;
//   • bandeau résumé <StatCard> + section alertes (adresse éditable / non-mappé) ;
//   • tableau par salarié (accordéon) → 1 ligne/jour, avec contrôles inline
//     (origine Dépôt↔Domicile, base Trajet↔Transport, exclure) → écrit
//     fraisOverrides/{mois__salarieId__date} (debounce léger) ;
//   • bandeau « Modifs non recalculées » + bouton « ↻ Recalculer » ;
//   • export .xlsx (SheetJS, import dynamique) : « Détail » (+ Statut) / « Synthèse »
//     / « Ventilation paie ».
//
//  ⚠️ Écrit fraisOverrides (surcharges/jour) + chantiersEsabora (correction
//  d'adresse). Ne recalcule PAS à chaque toggle : l'utilisateur groupe puis
//  recalcule. `chantiers` (trio) jamais touché.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
  collection, doc, getDocs, onSnapshot, query, where,
  setDoc, deleteDoc, deleteField, serverTimestamp,
} from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { app, db } from "../../firebase";
import { EPJ, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { can } from "../../core/permissions";
import { useToast } from "../../core/components/Toast";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import { Badge } from "../../core/components/Badge";
import { Banner } from "../../core/components/Banner";
import { StatCard } from "../../core/components/StatCard";
import { DataTable } from "../../core/components/DataTable";
import { ListRow } from "../../core/components/ListRow";
import { EmptyAccess } from "../planning/PlanningTab";

const RECAP_COL = "fraisRecap";
const HEURES_COL = "heures";
const OVERRIDES_COL = "fraisOverrides";
const CHANTIERS_ESABORA_COL = "chantiersEsabora";

const fnGenererRecapFrais = httpsCallable(getFunctions(app, "europe-west1"), "genererRecapFrais");

// ─── Helpers de format ───
const euro = (n) =>
  `${(Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const km = (n) => `${(Number(n) || 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
const origineLabel = (t) => (t === "DOMICILE" ? "Domicile" : "Dépôt");
const baseLabel = (b) => (b === "transport" ? "Transport" : "Trajet");
const chantierLabel = (num, libelle) =>
  num ? `${num}${libelle ? ` · ${libelle}` : ""}` : (libelle || "—");

// Statut métier d'un jour → badge (B1) + libellé d'export (D).
function jourStatut(j) {
  if (j.absence) return { tone: "neutral", label: "absence" };
  if (j.exclu) return { tone: "neutral", label: "exclu" };
  if (j.bureauSeul) return { tone: "info", label: "bureau — repas seul" };
  return { tone: "success", label: "ok" };
}
const statutExport = (j) =>
  j.absence ? "absence" : (j.exclu ? "exclu" : (j.bureauSeul ? "bureau" : "normal"));

// Libellés des types d'alerte (regroupement).
const ALERTE_GROUPES = [
  { type: "salarie_non_mappe", label: "Salariés non mappés" },
  { type: "adresse", label: "Adresses introuvables" },
  { type: "distance", label: "Calcul de distance impossible" },
  { type: "chantier_manquant", label: "Lignes sans n° de chantier" },
  { type: "ventilation", label: "Écarts de ventilation" },
];

const VENT_ZONES = ["1a", "1b", "2", "3", "4", "5"];

// Aplatit une ventilation en lignes { rubrique (affichage), rubriqueBase, zone, qte, taux, montant }.
function ventilationRows(v) {
  if (!v) return [];
  const rows = [];
  if (v.repas?.nbJours) {
    rows.push({ id: "repas", rubrique: "Repas", rubriqueBase: "Repas", zone: "",
      qte: v.repas.nbJours, taux: v.repas.taux, montant: v.repas.montant });
  }
  for (const kind of ["trajet", "transport"]) {
    const table = v[kind];
    if (!table) continue;
    const label = kind === "transport" ? "Transport" : "Trajet";
    for (const z of VENT_ZONES) {
      const cell = table[z];
      if (cell) rows.push({ id: `${kind}_${z}`, rubrique: `${label} zone ${z}`, rubriqueBase: label,
        zone: z, qte: cell.qte, taux: cell.taux, montant: cell.montant });
    }
  }
  return rows;
}

export function RecapFraisPage({ onGoTab, onNavigate }) {
  const { user } = useAuth();
  const { rolesConfig } = useData();
  const toast = useToast();

  const accessScope = can(user, "rh.frais", "_access", rolesConfig);
  const isAdmin = (user?.roles || []).includes("Admin");
  const majParNom = useMemo(
    () => `${user?.prenom || ""} ${user?.nom || ""}`.trim() || user?._id || "",
    [user],
  );

  // ─── Liste des mois disponibles (fraisRecap ∪ heures) ───
  const [moisDispo, setMoisDispo] = useState([]);
  const [mois, setMois] = useState("");
  useEffect(() => {
    if (!accessScope) return;
    let alive = true;
    (async () => {
      try {
        const [recapSnap, heuresSnap] = await Promise.all([
          getDocs(collection(db, RECAP_COL)),
          getDocs(collection(db, HEURES_COL)),
        ]);
        if (!alive) return;
        const set = new Set();
        recapSnap.docs.forEach((d) => { if (/^\d{4}-\d{2}$/.test(d.id)) set.add(d.id); });
        heuresSnap.docs.forEach((d) => { const m = d.data()?.mois; if (m) set.add(m); });
        const arr = [...set].sort().reverse();
        setMoisDispo(arr);
        setMois((cur) => cur || arr[0] || "");
      } catch (e) {
        console.error("[RecapFrais] lecture mois disponibles échouée :", e);
      }
    })();
    return () => { alive = false; };
  }, [accessScope]);

  // ─── Lecture live fraisRecap/{mois} ───
  const [recap, setRecap] = useState(null);
  const [recapLoading, setRecapLoading] = useState(false);
  useEffect(() => {
    if (!mois) { setRecap(null); return undefined; }
    setRecapLoading(true);
    const unsub = onSnapshot(
      doc(db, RECAP_COL, mois),
      (snap) => { setRecap(snap.exists() ? snap.data() : null); setRecapLoading(false); },
      (e) => { console.error("[RecapFrais] lecture récap échouée :", e); setRecap(null); setRecapLoading(false); },
    );
    return unsub;
  }, [mois]);

  // ─── Surcharges live fraisOverrides (where mois==) ───
  //  key `${salarieId}__${date}` → { origineType?, base?, exclu?, majAt }.
  const [overrides, setOverrides] = useState({});
  useEffect(() => {
    if (!mois) { setOverrides({}); return undefined; }
    const unsub = onSnapshot(
      query(collection(db, OVERRIDES_COL), where("mois", "==", mois)),
      (snap) => {
        const m = {};
        snap.docs.forEach((d) => {
          const o = d.data() || {};
          if (o.salarieId && o.date) m[`${o.salarieId}__${o.date}`] = o;
        });
        setOverrides(m);
      },
      (e) => console.error("[RecapFrais] lecture surcharges échouée :", e),
    );
    return unsub;
  }, [mois]);

  // ─── État d'édition (draft optimiste + drapeau « à recalculer ») ───
  const [draft, setDraft] = useState({});          // key → { origineType, base, exclu }
  const [manualDirty, setManualDirty] = useState(false);
  const timers = useRef({});
  useEffect(() => {
    setDraft({});
    setManualDirty(false);
    Object.values(timers.current).forEach((t) => clearTimeout(t));
    timers.current = {};
  }, [mois]);

  // État courant d'un jour (draft > override > défaut salarié).
  const dayState = useCallback((s, j) => {
    const key = `${s.salarieId}__${j.date}`;
    if (draft[key]) return draft[key];
    const o = overrides[key] || {};
    return {
      origineType: (o.origineType === "DOMICILE" || o.origineType === "DEPOT")
        ? o.origineType : (s.origineDefaut === "DOMICILE" ? "DOMICILE" : "DEPOT"),
      base: o.base === "transport" ? "transport" : "trajet",
      exclu: o.exclu === true,
    };
  }, [draft, overrides]);

  // Écriture (debouncée) d'une surcharge/jour ; défaut → suppression de la clé.
  const flushWrite = useCallback(async (salarieId, date, origineDefaut, st) => {
    const id = `${mois}__${salarieId}__${date}`;
    const dft = origineDefaut === "DOMICILE" ? "DOMICILE" : "DEPOT";
    const isDefault = st.origineType === dft && st.base === "trajet" && !st.exclu;
    try {
      if (isDefault) {
        await deleteDoc(doc(db, OVERRIDES_COL, id));
      } else {
        await setDoc(doc(db, OVERRIDES_COL, id), {
          mois, salarieId, date,
          origineType: st.origineType !== dft ? st.origineType : deleteField(),
          base: st.base === "transport" ? "transport" : deleteField(),
          exclu: st.exclu ? true : deleteField(),
          majPar: user?._id || "",
          majParNom,
          majAt: serverTimestamp(),
        }, { merge: true });
      }
      setManualDirty(true);
    } catch (e) {
      console.error("[RecapFrais] écriture surcharge échouée :", e);
      toast("Surcharge impossible (droits ?).", 3000);
    }
  }, [mois, user, majParNom, toast]);

  // Toggle inline → maj optimiste + flush debouncé (400 ms) par jour.
  const setDay = useCallback((s, j, patch) => {
    const key = `${s.salarieId}__${j.date}`;
    const next = { ...dayState(s, j), ...patch };
    setDraft((d) => ({ ...d, [key]: next }));
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(() => {
      flushWrite(s.salarieId, j.date, s.origineDefaut, next);
    }, 400);
  }, [dayState, flushWrite]);

  // ─── Correction d'adresse chantier (chantiersEsabora, merge) ───
  const saveAddress = useCallback(async (num, patch) => {
    if (!num) return;
    try {
      await setDoc(doc(db, CHANTIERS_ESABORA_COL, num), {
        num,
        ...(patch.adresse != null ? { adresse: patch.adresse } : {}),
        ...(patch.codePostal != null ? { codePostal: patch.codePostal } : {}),
        ...(patch.ville != null ? { ville: patch.ville } : {}),
        majFraisPar: user?._id || "",
        majFraisAt: serverTimestamp(),
      }, { merge: true });
      setManualDirty(true);
      toast(`Adresse chantier ${num} enregistrée — pensez à recalculer.`, 3000);
    } catch (e) {
      console.error("[RecapFrais] enregistrement adresse échoué :", e);
      toast("Enregistrement adresse impossible (droits ?).", 3000);
    }
  }, [user, toast]);

  // ─── Génération / regénération (force:true = recalcul complet) ───
  const [generating, setGenerating] = useState(false);
  const genererRecap = async () => {
    if (!mois || generating) return;
    setGenerating(true);
    try {
      const { data } = await fnGenererRecapFrais({ mois, force: true });
      setManualDirty(false);
      setDraft({});
      toast(
        `Récap ${mois} : ${data?.nbSalaries ?? 0} salariés · ${euro(data?.totalGlobal)} · ${data?.nbAlertes ?? 0} alerte(s)`,
        4000,
      );
    } catch (e) {
      console.error("[RecapFrais] génération échouée :", e);
      toast(`Échec : ${e?.message || "génération impossible"}`, 4000);
    } finally {
      setGenerating(false);
    }
  };

  // ─── Dérivés d'affichage ───
  const salaries = useMemo(
    () => [...(recap?.salaries || [])].sort(
      (a, b) => String(a.nom).localeCompare(String(b.nom), "fr", { sensitivity: "base" }),
    ),
    [recap],
  );
  const alertes = recap?.alertes || [];
  const totalGlobal = useMemo(
    () => salaries.reduce((s, x) => s + (Number(x.totalMois) || 0), 0),
    [salaries],
  );
  const nbJours = useMemo(
    () => salaries.reduce((s, x) => s + (Number(x.nbJours) || 0), 0),
    [salaries],
  );

  // Modifs non recalculées : surcharge plus récente que le récap OU édition locale.
  const overrideStale = useMemo(() => {
    const gen = recap?.genereAt?.toMillis ? recap.genereAt.toMillis() : 0;
    return Object.values(overrides).some((o) => {
      const t = o.majAt?.toMillis ? o.majAt.toMillis() : 0;
      return t > gen;
    });
  }, [overrides, recap]);
  const dirty = manualDirty || overrideStale;

  // ─── Export .xlsx (3 feuilles) ───
  const [exporting, setExporting] = useState(false);
  const exportXlsx = async () => {
    if (!recap || exporting) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");

      // Feuille « Détail » : 1 ligne par salarié × jour (+ colonne Statut).
      const detailHead = [
        "Salarié", "Date", "Chantier n°", "Chantier", "Origine", "Base",
        "Distance km", "Déplacement €", "Repas €", "Total €", "Statut",
      ];
      const detailRows = [];
      for (const s of salaries) {
        for (const j of s.jours || []) {
          detailRows.push([
            s.nom || s.salarieId,
            j.date || "",
            j.chantierNum || "",
            j.chantierLibelle || "",
            origineLabel(j.origineType),
            baseLabel(j.base),
            Number(j.distanceKm) || 0,
            Number(j.deplacement) || 0,
            Number(j.repas) || 0,
            Number(j.total) || 0,
            statutExport(j),
          ]);
        }
      }
      const wsDetail = XLSX.utils.aoa_to_sheet([detailHead, ...detailRows]);

      // Feuille « Synthèse » : 1 ligne par salarié + TOTAL GÉNÉRAL.
      const synthHead = ["Salarié", "Nb jours", "Total mois €"];
      const synthRows = salaries.map((s) => [
        s.nom || s.salarieId, Number(s.nbJours) || 0, Number(s.totalMois) || 0,
      ]);
      synthRows.push(["TOTAL GÉNÉRAL", nbJours, Math.round(totalGlobal * 100) / 100]);
      const wsSynth = XLSX.utils.aoa_to_sheet([synthHead, ...synthRows]);

      // Feuille « Ventilation paie » : 1 ligne par salarié × rubrique + TOTAL GÉNÉRAL.
      const ventHead = ["Salarié", "Rubrique", "Zone", "Qté", "Taux €", "Montant €"];
      const ventRows = [];
      for (const s of salaries) {
        for (const r of ventilationRows(s.ventilation)) {
          ventRows.push([
            s.nom || s.salarieId, r.rubriqueBase, r.zone || "",
            Number(r.qte) || 0, Number(r.taux) || 0, Number(r.montant) || 0,
          ]);
        }
      }
      for (const r of ventilationRows(recap.ventilationGlobale)) {
        ventRows.push([
          "TOTAL GÉNÉRAL", r.rubriqueBase, r.zone || "",
          Number(r.qte) || 0, Number(r.taux) || 0, Number(r.montant) || 0,
        ]);
      }
      const wsVent = XLSX.utils.aoa_to_sheet([ventHead, ...ventRows]);

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsDetail, "Détail");
      XLSX.utils.book_append_sheet(wb, wsSynth, "Synthèse");
      XLSX.utils.book_append_sheet(wb, wsVent, "Ventilation paie");

      const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([out], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Recap_frais_${mois}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("[RecapFrais] export xlsx échoué :", e);
      toast("Export Excel impossible.", 3000);
    } finally {
      setExporting(false);
    }
  };

  if (!accessScope) return <EmptyAccess />;

  const moisOptions = moisDispo.length
    ? moisDispo.map((m) => ({ value: m, label: m }))
    : [{ value: "", label: "—" }];
  const genereLe = recap?.genereAt?.toDate ? recap.genereAt.toDate() : null;

  return (
    <div>
      {/* ─── Barre d'action ─── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: space.md, alignItems: "flex-end", marginBottom: space.lg }}>
        <Field as="select" label="Mois" dense width={150} options={moisOptions}
          value={mois} onChange={(e) => setMois(e.target.value)} />
        <Button variant="primary" size="sm" onClick={genererRecap} loading={generating} disabled={!mois}>
          ↻ Générer / Regénérer
        </Button>
        <div style={{ flex: 1 }} />
        <Button variant="ghost" size="sm" onClick={exportXlsx} loading={exporting} disabled={!recap || !salaries.length}>
          Exporter Excel
        </Button>
      </div>

      {/* ─── Corps ─── */}
      {!mois ? (
        <EmptyBox icon="🧮" title="Aucun mois disponible"
          text="Importez d'abord des heures salariés, puis générez le récap." />
      ) : recapLoading ? (
        <EmptyBox icon="⏳" title="Chargement…" text={`Récap ${mois}`} />
      ) : !recap ? (
        <EmptyBox icon="🧮" title="Pas encore généré"
          text={`Aucun récap pour ${mois}. Cliquez sur « Générer / Regénérer ».`} />
      ) : (
        <>
          {/* Bandeau « modifs non recalculées » */}
          {dirty && (
            <div style={{ marginBottom: space.md }}>
              <Banner
                tone="warning"
                icon="🔄"
                title="Modifs non recalculées"
                text="Des surcharges ou corrections d'adresse ont été enregistrées. Recalculez pour mettre à jour les montants."
                action={
                  <Button variant="primary" size="sm" onClick={genererRecap} loading={generating}>
                    ↻ Recalculer
                  </Button>
                }
              />
            </div>
          )}

          {/* Résumé */}
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: space.md, marginBottom: space.lg,
          }}>
            <StatCard label="Total frais" value={euro(totalGlobal)} icon="💶" />
            <StatCard label="Salariés" value={salaries.length} icon="👷" />
            <StatCard label="Jours" value={nbJours} icon="📅" />
            <StatCard label="Alertes" value={alertes.length} icon="⚠️"
              deltaTone={alertes.length ? "down" : "neutral"} />
          </div>
          {genereLe && (
            <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginBottom: space.md }}>
              Barème {recap?.bareme || "—"} · généré le {genereLe.toLocaleString("fr-FR")}
              {recap?.genereParNom ? ` par ${recap.genereParNom}` : ""}.
            </div>
          )}

          {/* Ventilation globale (paie) */}
          {recap?.ventilationGlobale && (
            <div style={{ marginBottom: space.lg }}>
              <VentilationTable ventilation={recap.ventilationGlobale} total={totalGlobal}
                title="🧮 Ventilation globale (paie)" />
            </div>
          )}

          {/* Alertes (adresse éditable + liens de résolution) */}
          {alertes.length > 0 && (
            <AlertesSection
              alertes={alertes}
              onSaveAddress={saveAddress}
              onGoHeures={onGoTab ? () => onGoTab("rh.heures") : null}
              onGoAdminEsabora={(isAdmin && onNavigate) ? () => onNavigate("admin") : null}
            />
          )}

          {/* Tableau par salarié (accordéon) + contrôles inline */}
          <SalariesAccordion salaries={salaries} dayState={dayState} setDay={setDay} />
        </>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  Section alertes (repliable), regroupées par type + correction inline
// ═════════════════════════════════════════════════════════════
function AlertesSection({ alertes, onSaveAddress, onGoHeures, onGoAdminEsabora }) {
  const [open, setOpen] = useState(true);
  const groupes = useMemo(() => {
    const known = ALERTE_GROUPES.map((g) => ({
      ...g, items: alertes.filter((a) => a.type === g.type),
    })).filter((g) => g.items.length);
    const autresItems = alertes.filter((a) => !ALERTE_GROUPES.some((g) => g.type === a.type));
    if (autresItems.length) known.push({ type: "autre", label: "Autres", items: autresItems });
    return known;
  }, [alertes]);

  // Chantiers à corriger (adresse manquante côté chantier, hors erreurs d'origine).
  const chantiersACorriger = useMemo(() => {
    const m = new Map();
    for (const a of alertes) {
      if (a.type === "adresse" && a.sousType !== "origine" && a.chantierNum && !m.has(a.chantierNum)) {
        m.set(a.chantierNum, { chantierNum: a.chantierNum, chantierLibelle: a.chantierLibelle || "" });
      }
    }
    return [...m.values()];
  }, [alertes]);

  const hasNonMappe = alertes.some((a) => a.type === "salarie_non_mappe");

  return (
    <div style={{ marginBottom: space.lg }}>
      <Banner
        tone="danger"
        icon="⚠️"
        title={`${alertes.length} alerte(s)`}
        text={open ? "Cliquez pour replier." : "Cliquez pour déplier le détail."}
        onClick={() => setOpen((v) => !v)}
      />
      {open && (
        <div style={{
          border: `1px solid ${EPJ.gray200}`, borderTop: "none",
          borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md,
          background: EPJ.white, padding: space.md,
        }}>
          {/* Correction rapide des adresses chantier manquantes */}
          {chantiersACorriger.length > 0 && (
            <div style={{ marginBottom: space.md }}>
              <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900, marginBottom: space.xs }}>
                Corriger les adresses chantier <span style={{ color: EPJ.gray500, fontWeight: fontWeight.regular }}>({chantiersACorriger.length})</span>
              </div>
              {chantiersACorriger.map((c) => (
                <AddressFixRow key={c.chantierNum} chantier={c} onSave={onSaveAddress}
                  onGoAdminEsabora={onGoAdminEsabora} />
              ))}
            </div>
          )}

          {/* Lien résolution salariés non mappés */}
          {hasNonMappe && onGoHeures && (
            <div style={{ marginBottom: space.md }}>
              <Button variant="secondary" size="sm" onClick={onGoHeures}>
                → Résoudre dans « Heures salariés »
              </Button>
            </div>
          )}

          {/* Détail des alertes par groupe */}
          {groupes.map((g) => (
            <div key={g.type} style={{ marginBottom: space.md }}>
              <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900, marginBottom: space.xs }}>
                {g.label} <span style={{ color: EPJ.gray500, fontWeight: fontWeight.regular }}>({g.items.length})</span>
              </div>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {g.items.map((a, i) => (
                  <li key={i} style={{ fontSize: fontSize.xs, color: EPJ.gray700, marginBottom: 2 }}>
                    {a.message || JSON.stringify(a)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div style={{ fontSize: fontSize.xs, color: EPJ.gray500 }}>
            Après correction, cliquez sur « ↻ Recalculer » pour mettre à jour le récap.
          </div>
        </div>
      )}
    </div>
  );
}

// Ligne de correction d'adresse d'un chantier (écrit chantiersEsabora).
function AddressFixRow({ chantier, onSave, onGoAdminEsabora }) {
  const [adresse, setAdresse] = useState("");
  const [codePostal, setCodePostal] = useState("");
  const [ville, setVille] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving) return;
    if (!adresse.trim() && !codePostal.trim() && !ville.trim()) return;
    setSaving(true);
    try {
      await onSave(chantier.chantierNum, {
        adresse: adresse.trim(), codePostal: codePostal.trim(), ville: ville.trim(),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: space.xs, alignItems: "flex-end",
      padding: `${space.sm}px 0`, borderBottom: `1px solid ${EPJ.gray100}`,
    }}>
      <div style={{ minWidth: 150, flex: "1 1 150px" }}>
        <div style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: EPJ.gray900 }}>
          {chantierLabel(chantier.chantierNum, chantier.chantierLibelle)}
        </div>
      </div>
      <Field label="Adresse" dense width={200} value={adresse}
        onChange={(e) => setAdresse(e.target.value)} placeholder="rue…" />
      <Field label="CP" dense width={80} value={codePostal}
        onChange={(e) => setCodePostal(e.target.value)} placeholder="38000" />
      <Field label="Ville" dense width={140} value={ville}
        onChange={(e) => setVille(e.target.value)} placeholder="Grenoble" />
      <Button variant="primary" size="sm" onClick={save} loading={saving}
        disabled={!adresse.trim() && !codePostal.trim() && !ville.trim()}>
        Enregistrer
      </Button>
      {onGoAdminEsabora && (
        <Button variant="ghost" size="sm" onClick={onGoAdminEsabora}>
          Ouvrir dans Injection affaires Esabora
        </Button>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  Accordéon par salarié → détail 1 ligne/jour (+ contrôles inline)
// ═════════════════════════════════════════════════════════════
function SalariesAccordion({ salaries, dayState, setDay }) {
  const [openIds, setOpenIds] = useState(() => new Set());
  const toggle = (id) => setOpenIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  if (!salaries.length) {
    return <EmptyBox icon="👷" title="Aucun salarié" text="Aucune ligne dans ce récap." />;
  }

  // Colonnes construites PAR salarié (les contrôles inline capturent `s`).
  const makeCols = (s) => [
    { key: "date", header: "Date", width: 104, sortable: true },
    { key: "chantier", header: "Chantier", sortable: true,
      render: (_v, r) => (
        <span style={{ textDecoration: r.exclu ? "line-through" : "none", color: r.exclu ? EPJ.gray500 : undefined }}>
          {chantierLabel(r.chantierNum, r.chantierLibelle)}
        </span>
      ) },
    { key: "origineType", header: "Origine", width: 150,
      render: (_v, r) => (
        r.absence
          ? <span style={{ color: EPJ.gray400 }}>—</span>
          : <Segmented value={dayState(s, r).origineType}
              options={[{ v: "DEPOT", l: "Dépôt" }, { v: "DOMICILE", l: "Domicile" }]}
              onChange={(v) => setDay(s, r, { origineType: v })} />
      ) },
    { key: "base", header: "Base", width: 150,
      render: (_v, r) => (
        r.absence
          ? <span style={{ color: EPJ.gray400 }}>—</span>
          : <Segmented value={dayState(s, r).base}
              options={[{ v: "trajet", l: "Trajet" }, { v: "transport", l: "Transport" }]}
              onChange={(v) => setDay(s, r, { base: v })} />
      ) },
    { key: "distanceKm", header: "Distance", numeric: true, align: "right", sortable: true,
      render: (v, r) => (r.absence || r.bureauSeul ? "—" : km(v)) },
    { key: "deplacement", header: "Déplacement", numeric: true, align: "right", render: (v) => euro(v) },
    { key: "repas", header: "Repas", numeric: true, align: "right", render: (v) => euro(v) },
    { key: "total", header: "Total", numeric: true, align: "right", sortable: true, render: (v) => euro(v) },
    { key: "exclu", header: "Exclure", width: 78, align: "center",
      render: (_v, r) => (
        r.absence
          ? <span style={{ color: EPJ.gray400 }}>—</span>
          : <input type="checkbox" checked={dayState(s, r).exclu}
              onChange={(e) => setDay(s, r, { exclu: e.target.checked })}
              aria-label="Exclure ce jour" style={{ cursor: "pointer" }} />
      ) },
    { key: "statut", header: "Statut", width: 130,
      render: (_v, r) => { const st = jourStatut(r); return <Badge tone={st.tone} label={st.label} />; } },
  ];

  return (
    <div style={{
      border: `1px solid ${EPJ.gray200}`, borderRadius: radius.lg, overflow: "hidden", background: EPJ.white,
    }}>
      {salaries.map((s) => {
        const open = openIds.has(s.salarieId);
        const jours = [...(s.jours || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
        const jourRows = jours.map((j, i) => ({ id: `${s.salarieId}_${j.date}_${i}`, ...j }));
        return (
          <div key={s.salarieId}>
            <ListRow
              icon={open ? "▾" : "▸"}
              title={s.nom || s.salarieId}
              subtitle={`Origine par défaut : ${origineLabel(s.origineDefaut)}`}
              meta={`${s.nbJours || 0} j`}
              right={<span style={{ fontWeight: fontWeight.semibold, color: EPJ.gray900 }}>{euro(s.totalMois)}</span>}
              onClick={() => toggle(s.salarieId)}
              navigable={false}
            />
            {open && (
              <div style={{ padding: `${space.md}px ${space.md}px`, background: EPJ.gray50 }}>
                {s.ventilation && (
                  <div style={{ marginBottom: space.md }}>
                    <VentilationTable ventilation={s.ventilation} total={s.totalMois}
                      title="Ventilation paie" />
                  </div>
                )}
                <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900, marginBottom: space.xs }}>
                  Détail par jour
                </div>
                <DataTable columns={makeCols(s)} rows={jourRows} keyField="id"
                  empty={{ icon: "📅", title: "Aucun jour", text: "Aucune journée indemnisée." }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Bascule segmentée à 2 états (Dépôt/Domicile, Trajet/Transport) ───
function Segmented({ value, options, onChange }) {
  return (
    <div style={{
      display: "inline-flex", border: `1px solid ${EPJ.gray200}`,
      borderRadius: radius.sm, overflow: "hidden",
    }}>
      {options.map((o, i) => {
        const active = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => { if (!active) onChange(o.v); }}
            style={{
              border: "none", cursor: active ? "default" : "pointer",
              padding: `2px ${space.sm}px`, fontSize: fontSize.xs,
              fontWeight: active ? fontWeight.semibold : fontWeight.regular,
              background: active ? EPJ.catCourantFaible : EPJ.white,
              color: active ? EPJ.white : EPJ.gray700,
              borderLeft: i > 0 ? `1px solid ${EPJ.gray200}` : "none",
            }}
          >
            {o.l}
          </button>
        );
      })}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  Tableau de ventilation (Rubrique | Qté | Taux | Montant) + TOTAL
// ═════════════════════════════════════════════════════════════
function VentilationTable({ ventilation, total, title }) {
  const rows = useMemo(() => ventilationRows(ventilation), [ventilation]);
  if (!rows.length) return null;
  const totalVal = total != null ? total : rows.reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const cols = [
    { key: "rubrique", header: "Rubrique" },
    { key: "qte", header: "Qté", numeric: true, align: "right",
      render: (v) => (Number(v) || 0).toLocaleString("fr-FR") },
    { key: "taux", header: "Taux", numeric: true, align: "right", render: (v) => euro(v) },
    { key: "montant", header: "Montant", numeric: true, align: "right", render: (v) => euro(v) },
  ];
  return (
    <div>
      {title && (
        <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900, marginBottom: space.xs }}>
          {title}
        </div>
      )}
      <DataTable columns={cols} rows={rows} keyField="id" />
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: `${space.sm}px ${space.md}px`, marginTop: -1,
        border: `1px solid ${EPJ.gray200}`, borderTop: "none",
        borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md,
        background: EPJ.gray50, fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900,
      }}>
        <span>TOTAL</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{euro(totalVal)}</span>
      </div>
    </div>
  );
}

// ─── Boîte vide générique ───
function EmptyBox({ icon, title, text }) {
  return (
    <div style={{
      background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.lg,
      padding: space.xl, textAlign: "center",
    }}>
      <div style={{ fontSize: 40, marginBottom: space.sm }}>{icon}</div>
      <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color: EPJ.gray900, marginBottom: space.xs }}>
        {title}
      </div>
      <div style={{ fontSize: fontSize.sm, color: EPJ.gray500 }}>{text}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  RecapFraisPage — onglet « Récap frais » du module RH (RH-Frais-3b2a)
//
//  Écran RÉSERVÉ AU GESTIONNAIRE (gate rh.frais._access = Admin/Direction/
//  Assistante, partagée avec « Notes de frais » / « Heures salariés »).
//
//  Affichage + export du récap mensuel des frais de déplacement :
//   • sélecteur mois (fraisRecap existants ∪ mois des heures importées) +
//     bouton « Générer / Regénérer » → callable genererRecapFrais({mois, force:true}) ;
//   • lecture LIVE fraisRecap/{mois} (onSnapshot) ;
//   • bandeau résumé <StatCard> + section alertes repliable <Banner> ;
//   • tableau par salarié (accordéon) → 1 ligne/jour ;
//   • export .xlsx (SheetJS, import dynamique) : feuilles « Détail » + « Synthèse ».
//
//  ⚠️ LECTURE PURE + appel CF. AUCUNE écriture Firestore ici (les surcharges
//  fraisOverrides = lot RH-Frais-3b2b). chantiers jamais touché.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from "react";
import { collection, doc, getDocs, onSnapshot } from "firebase/firestore";
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

const fnGenererRecapFrais = httpsCallable(getFunctions(app, "europe-west1"), "genererRecapFrais");

// ─── Helpers de format ───
const euro = (n) =>
  `${(Number(n) || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const km = (n) => `${(Number(n) || 0).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} km`;
const origineLabel = (t) => (t === "DOMICILE" ? "Domicile" : "Dépôt");
const baseLabel = (b) => (b === "transport" ? "Transport" : "Trajet");
const chantierLabel = (num, libelle) =>
  num ? `${num}${libelle ? ` · ${libelle}` : ""}` : (libelle || "—");

// Libellés des types d'alerte (regroupement).
const ALERTE_GROUPES = [
  { type: "salarie_non_mappe", label: "Salariés non mappés" },
  { type: "adresse", label: "Adresses chantier introuvables" },
  { type: "distance", label: "Calcul de distance impossible" },
  { type: "chantier_manquant", label: "Lignes sans n° de chantier" },
  { type: "jour_bureau", label: "Jours bureau/dépôt à valider" },
];

export function RecapFraisPage() {
  const { user } = useAuth();
  const { rolesConfig } = useData();
  const toast = useToast();

  const accessScope = can(user, "rh.frais", "_access", rolesConfig);

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

  // ─── Génération / regénération (force:true = recalcul complet) ───
  const [generating, setGenerating] = useState(false);
  const genererRecap = async () => {
    if (!mois || generating) return;
    setGenerating(true);
    try {
      const { data } = await fnGenererRecapFrais({ mois, force: true });
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

  // ─── Export .xlsx (2 feuilles) ───
  const [exporting, setExporting] = useState(false);
  const exportXlsx = async () => {
    if (!recap || exporting) return;
    setExporting(true);
    try {
      const XLSX = await import("xlsx");

      // Feuille « Détail » : 1 ligne par salarié × jour.
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
            j.jourBureau ? "à valider" : (j.alerte ? "alerte" : "ok"),
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

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, wsDetail, "Détail");
      XLSX.utils.book_append_sheet(wb, wsSynth, "Synthèse");

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

          {/* Alertes */}
          {alertes.length > 0 && <AlertesSection alertes={alertes} />}

          {/* Tableau par salarié (accordéon) */}
          <SalariesAccordion salaries={salaries} />
        </>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  Section alertes (repliable), regroupées par type
// ═════════════════════════════════════════════════════════════
function AlertesSection({ alertes }) {
  const [open, setOpen] = useState(true);
  const groupes = useMemo(() => {
    const known = ALERTE_GROUPES.map((g) => ({
      ...g, items: alertes.filter((a) => a.type === g.type),
    })).filter((g) => g.items.length);
    const autresItems = alertes.filter((a) => !ALERTE_GROUPES.some((g) => g.type === a.type));
    if (autresItems.length) known.push({ type: "autre", label: "Autres", items: autresItems });
    return known;
  }, [alertes]);

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
            Lecture seule — la résolution des surcharges arrive au prochain lot.
          </div>
        </div>
      )}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  Accordéon par salarié → détail 1 ligne/jour
// ═════════════════════════════════════════════════════════════
function SalariesAccordion({ salaries }) {
  const [openIds, setOpenIds] = useState(() => new Set());
  const toggle = (id) => setOpenIds((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const jourCols = [
    { key: "date", header: "Date", width: 110, sortable: true },
    { key: "chantier", header: "Chantier", sortable: true,
      render: (_v, r) => chantierLabel(r.chantierNum, r.chantierLibelle) },
    { key: "origineType", header: "Origine", width: 90, render: (v) => origineLabel(v) },
    { key: "base", header: "Base", width: 90, render: (v) => baseLabel(v) },
    { key: "distanceKm", header: "Distance", numeric: true, align: "right", sortable: true,
      render: (v) => km(v) },
    { key: "deplacement", header: "Déplacement", numeric: true, align: "right", render: (v) => euro(v) },
    { key: "repas", header: "Repas", numeric: true, align: "right", render: (v) => euro(v) },
    { key: "total", header: "Total", numeric: true, align: "right", sortable: true, render: (v) => euro(v) },
    { key: "statut", header: "Statut", width: 96,
      render: (_v, r) => (
        r.jourBureau
          ? <Badge tone="warning" label="à valider" />
          : (r.alerte ? <Badge tone="danger" label="alerte" /> : <Badge tone="neutral" label="ok" />)
      ) },
  ];

  if (!salaries.length) {
    return <EmptyBox icon="👷" title="Aucun salarié" text="Aucune ligne dans ce récap." />;
  }

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
              <div style={{ padding: `0 ${space.md}px ${space.md}px`, background: EPJ.gray50 }}>
                <DataTable columns={jourCols} rows={jourRows} keyField="id"
                  empty={{ icon: "📅", title: "Aucun jour", text: "Aucune journée indemnisée." }} />
              </div>
            )}
          </div>
        );
      })}
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

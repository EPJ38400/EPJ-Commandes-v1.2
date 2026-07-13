// ═══════════════════════════════════════════════════════════════
//  HeuresSalariesPage — onglet « Heures salariés » du module RH (RH-Frais-3a)
//
//  Import du fichier d'heures Esabora (.xlsx) + récap filtrable. Écran
//  RÉSERVÉ AU GESTIONNAIRE (gate rh.frais._access = Admin/Direction/Assistante).
//
//  IMPORT :
//   • Parse .xlsx (SheetJS, import dynamique) : Date, Heures, Trigramme, Nom,
//     Prénom, Chantier, Rubrique. Mois déduit des dates.
//   • parseChantier → n° 6 chiffres ; n° absent de `chantiers` = signalé (rouge).
//   • Mapping salarié : normaliserNom → utilisateurs, sinon fraisMappingSalaries,
//     sinon NON MAPPÉ → résolution manuelle (écrit fraisMappingSalaries).
//   • « Importer le mois » (confirmation si le mois existe déjà) → writeBatch
//     idempotent sur `heures` (id déterministe → ré-import écrase).
//
//  CONSULTATION : filtres mois + salarié + chantier (query where mois==, filtre
//  client, PAS d'index composite) ; <DataTable> lignes + totaux (aggregeHeures) ;
//  export CSV.
//
//  ⚠️ AUCUN calcul d'indemnité ici (= RH-Frais-3b). chantiers = LECTURE SEULE.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from "react";
import {
  collection, doc, getDocs, onSnapshot, query, where,
  writeBatch, setDoc, serverTimestamp,
} from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { app, db } from "../../firebase";
import { EPJ, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { can } from "../../core/permissions";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import { DataTable } from "../../core/components/DataTable";
import { EmptyAccess } from "../planning/PlanningTab";
import { salariesConges } from "./congesModel";
import { normaliserNom, parseChantier, heureDocId, aggregeHeures } from "./heuresModel";

const HEURES_COL = "heures";
const MAPPING_COL = "fraisMappingSalaries";

const fnGenererRecapFrais = httpsCallable(getFunctions(app, "europe-west1"), "genererRecapFrais");

// ─── Parse d'une cellule date → { date, mois, jour } | null ───
function parseDateCell(v) {
  let d = null;
  if (v instanceof Date && !isNaN(v)) {
    d = v;
  } else if (typeof v === "string") {
    const s = v.trim();
    // dd/mm/yyyy ou dd-mm-yyyy
    const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
    if (m) {
      const yy = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
      d = new Date(yy, Number(m[2]) - 1, Number(m[1]));
    } else if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      d = new Date(s);
    }
  }
  if (!d || isNaN(d)) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const jj = String(d.getDate()).padStart(2, "0");
  return { date: `${yyyy}-${mm}-${jj}`, mois: `${yyyy}-${mm}`, jour: jj };
}

// Nombre FR (virgule décimale) → number.
function parseHeures(v) {
  if (typeof v === "number") return v;
  const n = Number(String(v || "").replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

// Repère l'index d'une colonne par mots-clés sur l'en-tête normalisé.
function findCol(headers, matcher) {
  for (let i = 0; i < headers.length; i++) {
    if (matcher(normaliserNom(headers[i]))) return i;
  }
  return -1;
}

export function HeuresSalariesPage() {
  const { user } = useAuth();
  const { rolesConfig, users, chantiers } = useData();

  const accessScope = can(user, "rh.frais", "_access", rolesConfig);
  const selfId = user?._id || user?.id || "";

  // ─── Référentiels dérivés ───
  const salaries = useMemo(() => salariesConges(users), [users]);
  // Index nom normalisé → salarieId (les deux ordres nom/prénom).
  const userNormIndex = useMemo(() => {
    const m = new Map();
    (users || []).forEach((u) => {
      const id = u._id || u.id;
      const nom = u.nom || "";
      const prenom = u.prenom || "";
      m.set(normaliserNom(`${nom} ${prenom}`), id);
      m.set(normaliserNom(`${prenom} ${nom}`), id);
    });
    return m;
  }, [users]);
  // n° chantiers connus + libellé.
  const chantiersConnus = useMemo(() => {
    const m = new Map();
    (chantiers || []).forEach((c) => {
      const num = String(c.num || c._id || "").trim();
      if (num) m.set(num, c.nom || "");
    });
    return m;
  }, [chantiers]);

  // ─── Mapping salariés (fraisMappingSalaries) — live ───
  const [mapping, setMapping] = useState({}); // { [nomNormalise]: salarieId }
  useEffect(() => {
    if (!accessScope) return undefined;
    const unsub = onSnapshot(
      collection(db, MAPPING_COL),
      (snap) => {
        const m = {};
        snap.docs.forEach((d) => { m[d.id] = d.data()?.salarieId || null; });
        setMapping(m);
      },
      (e) => console.error("[Heures] lecture mapping échouée :", e),
    );
    return unsub;
  }, [accessScope]);

  if (!accessScope) return <EmptyAccess />;

  return (
    <div>
      <ImportSection
        userNormIndex={userNormIndex}
        chantiersConnus={chantiersConnus}
        mapping={mapping}
        salaries={salaries}
        selfId={selfId}
        userNom={`${user?.prenom || ""} ${user?.nom || ""}`.trim() || selfId}
      />
      <ConsultationSection chantiersConnus={chantiersConnus} />
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  IMPORT
// ═════════════════════════════════════════════════════════════
function ImportSection({ userNormIndex, chantiersConnus, mapping, salaries, selfId, userNom }) {
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [lignes, setLignes] = useState(null); // lignes parsées (brutes, avant résolution)
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // Résout salarieId d'une ligne : user normalisé → mapping → null.
  const resolveSalarieId = (nomNormalise) =>
    userNormIndex.get(nomNormalise) || mapping[nomNormalise] || null;

  const onFile = async (file) => {
    if (!file) return;
    setParsing(true); setParseError(null); setLignes(null); setImportResult(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (!aoa.length) throw new Error("Fichier vide.");

      const headers = (aoa[0] || []).map((h) => String(h));
      const iDate = findCol(headers, (h) => h.startsWith("DATE"));
      const iHeures = findCol(headers, (h) => h.includes("HEURE"));
      const iTrig = findCol(headers, (h) => h.includes("TRIGRAMME") || h === "TRIG");
      const iPrenom = findCol(headers, (h) => h.startsWith("PRENOM"));
      const iNom = findCol(headers, (h) => h === "NOM" || (h.includes("NOM") && !h.includes("PRENOM")));
      const iChantier = findCol(headers, (h) => h.includes("CHANTIER") || h.includes("AFFAIRE"));
      const iRubrique = findCol(headers, (h) => h.includes("RUBRIQUE"));

      const missing = [];
      if (iDate < 0) missing.push("Date");
      if (iHeures < 0) missing.push("Heures");
      if (iChantier < 0) missing.push("Chantier");
      if (missing.length) throw new Error(`Colonne(s) introuvable(s) : ${missing.join(", ")}.`);

      const out = [];
      for (let r = 1; r < aoa.length; r++) {
        const row = aoa[r] || [];
        const dc = parseDateCell(row[iDate]);
        const heures = parseHeures(row[iHeures]);
        const nomF = iNom >= 0 ? String(row[iNom] || "").trim() : "";
        const prenomF = iPrenom >= 0 ? String(row[iPrenom] || "").trim() : "";
        const trigramme = iTrig >= 0 ? String(row[iTrig] || "").trim() : "";
        const chantierRaw = String(row[iChantier] || "").trim();
        const rubrique = iRubrique >= 0 ? String(row[iRubrique] || "").trim() : "";
        // Ligne vide / sans date / sans heures → ignorée.
        if (!dc || (!heures && !chantierRaw && !nomF)) continue;
        const nomComplet = `${nomF} ${prenomF}`.trim();
        const nomNormalise = normaliserNom(nomComplet || trigramme);
        const { num: chantierNum, libelle: chantierLibelle } = parseChantier(chantierRaw);
        out.push({
          mois: dc.mois, date: dc.date, jour: dc.jour,
          salarieNomFichier: nomComplet, trigramme, nomNormalise,
          chantierNum, chantierLibelle, chantierRaw,
          heures, rubrique,
        });
      }
      if (!out.length) throw new Error("Aucune ligne exploitable (dates/heures manquantes).");
      setLignes(out);
    } catch (e) {
      console.error("[Heures] parse échoué :", e);
      setParseError(e?.message || "Import impossible.");
    } finally {
      setParsing(false);
    }
  };

  // Dérivés de résolution.
  const derived = useMemo(() => {
    if (!lignes) return null;
    const moisSet = [...new Set(lignes.map((l) => l.mois))].sort();
    // Non mappés : noms distincts sans salarieId résolu.
    const nonMappesMap = new Map(); // nomNormalise → { nomNormalise, exemple, trigramme }
    const chantiersInconnus = new Set();
    for (const l of lignes) {
      const sid = resolveSalarieId(l.nomNormalise);
      if (!sid && l.nomNormalise) {
        if (!nonMappesMap.has(l.nomNormalise)) {
          nonMappesMap.set(l.nomNormalise, {
            nomNormalise: l.nomNormalise,
            exemple: l.salarieNomFichier || l.trigramme || l.nomNormalise,
            trigramme: l.trigramme,
          });
        }
      }
      if (l.chantierNum && !chantiersConnus.has(l.chantierNum)) chantiersInconnus.add(l.chantierNum);
    }
    return {
      moisSet,
      nonMappes: [...nonMappesMap.values()],
      chantiersInconnus: [...chantiersInconnus].sort(),
      nbLignes: lignes.length,
    };
  }, [lignes, mapping, userNormIndex, chantiersConnus]);

  // Résolution manuelle d'un nom → écrit fraisMappingSalaries.
  const resolveName = async (nomNormalise, salarieId) => {
    if (!salarieId) return;
    const sal = salaries.find((s) => s.id === salarieId);
    try {
      await setDoc(doc(db, MAPPING_COL, nomNormalise), {
        nomNormalise,
        salarieId,
        salarieNom: sal?.nom || salarieId,
        creePar: selfId,
        creeAt: serverTimestamp(),
      });
      // Le listener mapping mettra à jour l'état → la ligne devient mappée.
    } catch (e) {
      console.error("[Heures] écriture mapping échouée :", e);
      window.alert("Échec de l'enregistrement du rapprochement. Réessayez.");
    }
  };

  const doImport = async () => {
    if (!lignes || importing || !derived) return;
    const moisLabel = derived.moisSet.join(", ");
    // Confirmation si un des mois existe déjà.
    let dejaPresent = false;
    try {
      for (const m of derived.moisSet) {
        const snap = await getDocs(query(collection(db, HEURES_COL), where("mois", "==", m)));
        if (!snap.empty) { dejaPresent = true; break; }
      }
    } catch (e) {
      console.error("[Heures] vérif mois existant échouée :", e);
    }
    if (dejaPresent && !window.confirm(
      `Des heures existent déjà pour ${moisLabel}. Ré-importer écrasera les lignes de ce mois. Continuer ?`,
    )) return;

    setImporting(true); setImportResult(null);
    const importLot = `${derived.moisSet.join("_")}__${selfId}`;
    try {
      // writeBatch par tranches de 450 (limite 500).
      let batch = writeBatch(db);
      let n = 0;
      const salariesVus = new Set();
      let nonMappes = 0;
      for (const l of lignes) {
        const salarieId = resolveSalarieId(l.nomNormalise);
        if (!salarieId) nonMappes += 1;
        salariesVus.add(salarieId || `NC-${l.nomNormalise}`);
        const id = heureDocId({
          mois: l.mois, salarieId, trigramme: l.trigramme,
          chantierNum: l.chantierNum, jour: l.jour,
        });
        batch.set(doc(db, HEURES_COL, id), {
          mois: l.mois, date: l.date, jour: l.jour,
          salarieId: salarieId || null,
          salarieNomFichier: l.salarieNomFichier || "",
          trigramme: l.trigramme || "",
          chantierNum: l.chantierNum || null,
          chantierLibelle: l.chantierLibelle || "",
          heures: Number(l.heures) || 0,
          rubrique: l.rubrique || "",
          importLot,
          importAt: serverTimestamp(),
        });
        n += 1;
        if (n % 450 === 0) { await batch.commit(); batch = writeBatch(db); }
      }
      await batch.commit();
      setImportResult({
        nbLignes: lignes.length,
        nbSalaries: salariesVus.size,
        nonMappes,
        chantiersInconnus: derived.chantiersInconnus.length,
        moisLabel,
      });
      setLignes(null); // reset : la consultation prend le relais
    } catch (e) {
      console.error("[Heures] import échoué :", e);
      window.alert("Échec de l'import. Vérifiez votre connexion et réessayez.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={{ marginBottom: space.xl }}>
      <SectionTitle icon="📥" title="Importer les heures (fichier Esabora)"
        subtitle="Fichier .xlsx : Date, Heures, Trigramme, Nom, Prénom, Chantier, Rubrique. Le mois est déduit des dates." />

      <div style={{
        background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.lg, padding: space.lg,
      }}>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => onFile(e.target.files?.[0])}
          disabled={parsing || importing}
          style={{ fontSize: fontSize.sm }}
        />
        {parsing && <div style={{ marginTop: space.sm, fontSize: fontSize.sm, color: EPJ.gray500 }}>Lecture du fichier…</div>}
        {parseError && (
          <div style={{
            marginTop: space.md, padding: `${space.sm}px ${space.md}px`, borderRadius: radius.md,
            background: `${EPJ.red}0D`, border: `1px solid ${EPJ.red}44`, color: EPJ.red, fontSize: fontSize.sm,
          }}>
            ⚠️ {parseError}
          </div>
        )}

        {derived && lignes && (
          <div style={{ marginTop: space.lg }}>
            {/* Récap pré-import */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: space.md, marginBottom: space.md }}>
              <Stat label="Lignes" value={derived.nbLignes} />
              <Stat label="Mois" value={derived.moisSet.join(", ") || "—"} />
              <Stat label="Non mappés" value={derived.nonMappes.length} tone={derived.nonMappes.length ? "warn" : "ok"} />
              <Stat label="Chantiers inconnus" value={derived.chantiersInconnus.length} tone={derived.chantiersInconnus.length ? "warn" : "ok"} />
            </div>

            {/* Chantiers inconnus */}
            {derived.chantiersInconnus.length > 0 && (
              <div style={{
                marginBottom: space.md, padding: `${space.sm}px ${space.md}px`, borderRadius: radius.md,
                background: `${EPJ.red}0D`, border: `1px solid ${EPJ.red}44`, fontSize: fontSize.sm, color: EPJ.gray700,
              }}>
                <b style={{ color: EPJ.red }}>N° chantiers absents du référentiel :</b>{" "}
                {derived.chantiersInconnus.join(", ")}. Ces lignes seront importées telles quelles
                (rapprochement chantier à faire côté Suivi financier).
              </div>
            )}

            {/* Résolution des non mappés */}
            {derived.nonMappes.length > 0 && (
              <div style={{ marginBottom: space.lg }}>
                <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900, marginBottom: space.sm }}>
                  Salariés non mappés — associez un salarié (mémorisé pour les prochains imports)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: space.xs }}>
                  {derived.nonMappes.map((nm) => (
                    <div key={nm.nomNormalise} style={{
                      display: "flex", alignItems: "flex-end", gap: space.sm, flexWrap: "wrap",
                      background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.md,
                      padding: `${space.sm}px ${space.md}px`,
                    }}>
                      <div style={{ flex: "1 1 180px", minWidth: 140 }}>
                        <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900 }}>{nm.exemple}</div>
                        {nm.trigramme && <div style={{ fontSize: fontSize.xs, color: EPJ.gray500 }}>Trigramme : {nm.trigramme}</div>}
                      </div>
                      <Field as="select" dense width={220}
                        options={[{ value: "", label: "— Associer un salarié —" }, ...salaries.map((s) => ({ value: s.id, label: s.nom }))]}
                        value=""
                        onChange={(e) => resolveName(nm.nomNormalise, e.target.value)} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button variant="primary" size="sm" onClick={doImport} loading={importing}>
              Importer {derived.moisSet.length === 1 ? `le mois ${derived.moisSet[0]}` : "les mois"}
            </Button>
          </div>
        )}

        {importResult && (
          <div style={{
            marginTop: space.md, padding: `${space.sm}px ${space.md}px`, borderRadius: radius.md,
            background: `${EPJ.green}10`, border: `1px solid ${EPJ.green}40`, fontSize: fontSize.sm, color: EPJ.gray700,
          }}>
            ✓ Import {importResult.moisLabel} : {importResult.nbLignes} lignes · {importResult.nbSalaries} salariés
            {importResult.nonMappes ? ` · ${importResult.nonMappes} lignes non mappées` : ""}
            {importResult.chantiersInconnus ? ` · ${importResult.chantiersInconnus} chantiers inconnus` : ""}.
          </div>
        )}
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════
//  CONSULTATION (récap + filtres)
// ═════════════════════════════════════════════════════════════
function ConsultationSection({ chantiersConnus }) {
  const [mois, setMois] = useState("");
  const [moisDispo, setMoisDispo] = useState([]);
  const [lignes, setLignes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fSalarie, setFSalarie] = useState("");
  const [fChantier, setFChantier] = useState("");
  // Récap frais mensuel (RH-Frais-3b1) — moteur serveur genererRecapFrais.
  const [recapLoading, setRecapLoading] = useState(false);
  const [recapResult, setRecapResult] = useState(null);
  const [recapError, setRecapError] = useState(null);

  const genererRecap = async () => {
    if (!mois || recapLoading) return;
    setRecapLoading(true); setRecapResult(null); setRecapError(null);
    try {
      const { data } = await fnGenererRecapFrais({ mois });
      setRecapResult(data);
    } catch (e) {
      console.error("[Heures] génération récap frais échouée :", e);
      setRecapError(e?.message || "Génération du récap impossible.");
    } finally {
      setRecapLoading(false);
    }
  };

  // Liste des mois disponibles (léger : on lit les ids ne suffisant pas, on
  // interroge une fois toute la collection pour peupler le sélecteur de mois).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const snap = await getDocs(collection(db, HEURES_COL));
        if (!alive) return;
        const set = new Set();
        snap.docs.forEach((d) => { const m = d.data()?.mois; if (m) set.add(m); });
        const arr = [...set].sort().reverse();
        setMoisDispo(arr);
        setMois((cur) => cur || arr[0] || "");
      } catch (e) {
        console.error("[Heures] lecture mois disponibles échouée :", e);
      }
    })();
    return () => { alive = false; };
  }, []);

  // Charge les heures du mois sélectionné (query where mois==).
  useEffect(() => {
    if (!mois) { setLignes([]); return undefined; }
    setLoading(true);
    const unsub = onSnapshot(
      query(collection(db, HEURES_COL), where("mois", "==", mois)),
      (snap) => {
        setLignes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (e) => { console.error("[Heures] lecture mois échouée :", e); setLignes([]); setLoading(false); },
    );
    return unsub;
  }, [mois]);

  // Options de filtres dérivées du mois chargé.
  const salariesDuMois = useMemo(() => {
    const m = new Map();
    lignes.forEach((l) => {
      const cle = l.salarieId || `NC-${l.trigramme}`;
      if (!m.has(cle)) m.set(cle, l.salarieNomFichier || l.trigramme || cle);
    });
    return [...m.entries()].map(([value, label]) => ({ value, label }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), "fr"));
  }, [lignes]);
  const chantiersDuMois = useMemo(() => {
    const m = new Map();
    lignes.forEach((l) => {
      const cle = l.chantierNum || "NA";
      if (!m.has(cle)) m.set(cle, l.chantierLibelle || (l.chantierNum || "Sans chantier"));
    });
    return [...m.entries()].map(([value, label]) => ({ value, label: `${value !== "NA" ? value + " · " : ""}${label}` }))
      .sort((a, b) => String(a.label).localeCompare(String(b.label), "fr"));
  }, [lignes]);

  // Filtrage client.
  const lignesFiltrees = useMemo(() => lignes.filter((l) => {
    if (fSalarie && (l.salarieId || `NC-${l.trigramme}`) !== fSalarie) return false;
    if (fChantier && (l.chantierNum || "NA") !== fChantier) return false;
    return true;
  }), [lignes, fSalarie, fChantier]);

  const totalHeures = useMemo(
    () => Math.round(lignesFiltrees.reduce((s, l) => s + (Number(l.heures) || 0), 0) * 100) / 100,
    [lignesFiltrees],
  );
  const parSalarie = useMemo(() => aggregeHeures(lignesFiltrees, { par: "salarie" }), [lignesFiltrees]);
  const parChantier = useMemo(() => aggregeHeures(lignesFiltrees, { par: "chantier" }), [lignesFiltrees]);

  const exportCsv = () => {
    const head = ["Mois", "Date", "Salarié", "Trigramme", "N° chantier", "Chantier", "Heures", "Rubrique"];
    const rows = lignesFiltrees.map((l) => [
      l.mois, l.date, l.salarieNomFichier || "", l.trigramme || "",
      l.chantierNum || "", l.chantierLibelle || "", String(l.heures ?? "").replace(".", ","), l.rubrique || "",
    ]);
    const csv = [head, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";"))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `heures_${mois || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const detailCols = [
    { key: "date", header: "Date", width: 110, sortable: true },
    { key: "salarieNomFichier", header: "Salarié", sortable: true,
      render: (v, r) => v || r.trigramme || "—" },
    { key: "chantierNum", header: "Chantier", sortable: true,
      render: (v, r) => (v ? `${v}${r.chantierLibelle ? " · " + r.chantierLibelle : ""}` : (r.chantierLibelle || "—")) },
    { key: "heures", header: "Heures", numeric: true, align: "right", sortable: true,
      render: (v) => (Number(v) || 0).toLocaleString("fr-FR") },
    { key: "rubrique", header: "Rubrique", sortable: true, render: (v) => v || "—" },
  ];
  const totalCols = (labelHead) => [
    { key: "libelle", header: labelHead, sortable: true },
    { key: "nbLignes", header: "Lignes", numeric: true, align: "right", sortable: true },
    { key: "heures", header: "Heures", numeric: true, align: "right", sortable: true,
      render: (v) => (Number(v) || 0).toLocaleString("fr-FR") },
  ];

  const moisOptions = moisDispo.length
    ? moisDispo.map((m) => ({ value: m, label: m }))
    : [{ value: "", label: "—" }];

  return (
    <div>
      <SectionTitle icon="📊" title="Récapitulatif des heures"
        subtitle="Filtrez par mois, salarié et chantier. Totaux par salarié et par chantier." />

      <div style={{ display: "flex", flexWrap: "wrap", gap: space.md, alignItems: "flex-end", marginBottom: space.md }}>
        <Field as="select" label="Mois" dense width={140} options={moisOptions}
          value={mois} onChange={(e) => { setMois(e.target.value); setFSalarie(""); setFChantier(""); setRecapResult(null); setRecapError(null); }} />
        <Field as="select" label="Salarié" dense width={220}
          options={[{ value: "", label: "Tous" }, ...salariesDuMois]}
          value={fSalarie} onChange={(e) => setFSalarie(e.target.value)} />
        <Field as="select" label="Chantier" dense width={240}
          options={[{ value: "", label: "Tous" }, ...chantiersDuMois]}
          value={fChantier} onChange={(e) => setFChantier(e.target.value)} />
        <div style={{ flex: 1 }} />
        <Button variant="ghost" size="sm" onClick={exportCsv} disabled={!lignesFiltrees.length}>Exporter CSV</Button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: space.md, marginBottom: space.md }}>
        <Stat label="Total heures" value={totalHeures.toLocaleString("fr-FR")} />
        <Stat label="Salariés" value={parSalarie.length} />
        <Stat label="Chantiers" value={parChantier.length} />
      </div>

      {/* ─── Récap frais mensuel (RH-Frais-3b1) — moteur serveur ─── */}
      <div style={{
        background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.lg,
        padding: space.lg, marginBottom: space.lg,
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: space.md, alignItems: "center" }}>
          <div style={{ flex: "1 1 240px" }}>
            <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900 }}>
              💶 Récap frais de déplacement
            </div>
            <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginTop: 2 }}>
              Calcule les distances (chantier le plus éloigné/jour) et l'indemnité FBTP du mois sélectionné.
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={genererRecap} loading={recapLoading} disabled={!mois}>
            Générer le récap {mois || ""}
          </Button>
        </div>

        {recapError && (
          <div style={{
            marginTop: space.md, padding: `${space.sm}px ${space.md}px`, borderRadius: radius.md,
            background: `${EPJ.red}0D`, border: `1px solid ${EPJ.red}44`, color: EPJ.red, fontSize: fontSize.sm,
          }}>
            ⚠️ {recapError}
          </div>
        )}

        {recapResult && (
          <div style={{ marginTop: space.md }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: space.md, marginBottom: space.md }}>
              <Stat label="Salariés" value={recapResult.nbSalaries ?? 0} />
              <Stat label="Total frais" value={`${(Number(recapResult.totalGlobal) || 0).toLocaleString("fr-FR")} €`} />
              <Stat label="Alertes" value={recapResult.nbAlertes ?? 0} tone={recapResult.nbAlertes ? "warn" : "ok"} />
            </div>
            <div style={{ fontSize: fontSize.xs, color: EPJ.gray500 }}>
              Récap enregistré (fraisRecap/{recapResult.mois || mois}). Édition détaillée à venir (lot 3b2).
            </div>
            {recapResult.nbAlertes > 0 && (
              <div style={{
                marginTop: space.sm, padding: `${space.sm}px ${space.md}px`, borderRadius: radius.md,
                background: `${EPJ.red}0D`, border: `1px solid ${EPJ.red}44`, fontSize: fontSize.xs, color: EPJ.gray700,
              }}>
                <b style={{ color: EPJ.red }}>{recapResult.nbAlertes} alerte(s)</b>
                {" "}(salariés non mappés, adresses chantier introuvables, jours bureau/dépôt à valider) :
                <ul style={{ margin: `${space.xs}px 0 0`, paddingLeft: 18 }}>
                  {(recapResult.alertes || []).map((a, i) => (
                    <li key={i} style={{ marginBottom: 2 }}>{a?.message || JSON.stringify(a)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Totaux par salarié / par chantier */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: space.md, marginBottom: space.lg }}>
        <div>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900, marginBottom: space.xs }}>Par salarié</div>
          <DataTable columns={totalCols("Salarié")} rows={parSalarie} keyField="cle" loading={loading}
            empty={{ icon: "👷", title: "Aucune heure", text: "Aucune ligne pour ce filtre." }} />
        </div>
        <div>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900, marginBottom: space.xs }}>Par chantier</div>
          <DataTable columns={totalCols("Chantier")} rows={parChantier} keyField="cle" loading={loading}
            empty={{ icon: "🏗", title: "Aucune heure", text: "Aucune ligne pour ce filtre." }} />
        </div>
      </div>

      {/* Détail ligne à ligne */}
      <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900, marginBottom: space.xs }}>Détail</div>
      <DataTable columns={detailCols} rows={lignesFiltrees} keyField="id" loading={loading} pageSize={50}
        empty={{ icon: "🧾", title: "Aucune heure", text: "Importez un fichier ou changez de filtre." }} />
    </div>
  );
}

// ─── Helpers visuels ───
function SectionTitle({ icon, title, subtitle }) {
  return (
    <div style={{ marginBottom: space.md }}>
      <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: EPJ.gray900 }}>
        {icon} {title}
      </div>
      {subtitle && <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginTop: 2 }}>{subtitle}</div>}
    </div>
  );
}

function Stat({ label, value, tone }) {
  const color = tone === "warn" ? EPJ.red : tone === "ok" ? EPJ.green : EPJ.gray900;
  return (
    <div style={{
      background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.md,
      padding: `${space.sm}px ${space.md}px`, minWidth: 96,
    }}>
      <div style={{ fontSize: fontSize.xs, color: EPJ.gray500 }}>{label}</div>
      <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color }}>{value}</div>
    </div>
  );
}

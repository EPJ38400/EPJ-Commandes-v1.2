// ═══════════════════════════════════════════════════════════════
//  AdminAffairesEsabora — Injection du référentiel affaires Esabora
//  (RH-Frais-3a2). Écran admin autonome (calque AdminFournisseurs).
//
//  Import d'AFFAIRES.xlsx → collection `chantiersEsabora/{num}` (référentiel
//  LÉGER et SÉPARÉ de `chantiers` du trio). Sert de fallback d'adresse au
//  moteur de distance frais (computeDistanceFrais) quand l'affaire n'est pas
//  (encore) dans `chantiers`.
//
//  Accès : gestionnaire RH (Admin / Direction / Assistante). Import idempotent
//  (writeBatch merge par num) : ré-import = mise à jour, JAMAIS de suppression
//  des affaires absentes du fichier. AUCUNE écriture `chantiers`.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import {
  collection, doc, onSnapshot, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useToast } from "../../core/components/Toast";
import { ModuleSubHeader } from "../../core/components/ModuleSubHeader";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import { DataTable } from "../../core/components/DataTable";
import { parseAffaireRow, adresseComplete } from "../../modules/rh/affairesModel";

const COL = "chantiersEsabora";

export function AdminAffairesEsabora({ onBack }) {
  const { user } = useAuth();
  const toast = useToast();

  const authorized = (user?.roles || []).some((r) => ["Admin", "Direction", "Assistante"].includes(r));
  const selfId = user?._id || user?.id || "";

  const [rows, setRows] = useState([]);       // référentiel existant (live)
  const [denied, setDenied] = useState(false);
  const [search, setSearch] = useState("");

  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [preview, setPreview] = useState(null); // { valides:[], sansAdresse:[], ignorees:number }
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  // ─── Référentiel existant (live) ───
  useEffect(() => {
    if (!authorized) return undefined;
    const unsub = onSnapshot(
      collection(db, COL),
      (snap) => setRows(snap.docs.map((d) => ({ _id: d.id, ...d.data() }))),
      (e) => { console.error("[AffairesEsabora] lecture échouée :", e); setDenied(true); },
    );
    return unsub;
  }, [authorized]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...rows]
      .filter((r) => !q
        || String(r.num || "").toLowerCase().includes(q)
        || String(r.ville || "").toLowerCase().includes(q)
        || String(r.titre || "").toLowerCase().includes(q))
      .sort((a, b) => String(a.num || "").localeCompare(String(b.num || "")));
  }, [rows, search]);

  // ─── Parse fichier ───
  const onFile = async (file) => {
    if (!file) return;
    setParsing(true); setParseError(null); setPreview(null); setImportResult(null);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      if (!aoa.length) throw new Error("Fichier vide.");

      const valides = [];
      const sansAdresse = [];
      let ignorees = 0;
      // On saute la 1re ligne (en-têtes) ; les lignes num non conformes sont ignorées.
      for (let i = 1; i < aoa.length; i++) {
        const aff = parseAffaireRow(aoa[i]);
        if (!aff) { if ((aoa[i] || []).some((c) => String(c).trim())) ignorees += 1; continue; }
        valides.push(aff);
        if (aff.adresseManquante) sansAdresse.push(aff);
      }
      if (!valides.length) throw new Error("Aucune affaire valide (n° à 6 chiffres) trouvée.");
      setPreview({ valides, sansAdresse, ignorees });
    } catch (e) {
      console.error("[AffairesEsabora] parse échoué :", e);
      setParseError(e?.message || "Import impossible.");
    } finally {
      setParsing(false);
    }
  };

  // ─── Import (writeBatch merge idempotent) ───
  const doImport = async () => {
    if (!preview || importing) return;
    setImporting(true); setImportResult(null);
    try {
      let batch = writeBatch(db);
      let n = 0;
      for (const aff of preview.valides) {
        batch.set(doc(db, COL, aff.num), {
          num: aff.num,
          titre: aff.titre || "",
          adresse: aff.adresse || "",
          codePostal: aff.codePostal || "",
          ville: aff.ville || "",
          nomClient: aff.nomClient || "",
          etat: aff.etat || "",
          importAt: serverTimestamp(),
          importePar: selfId,
        }, { merge: true });
        n += 1;
        if (n % 450 === 0) { await batch.commit(); batch = writeBatch(db); }
      }
      await batch.commit();
      setImportResult({ nb: preview.valides.length, sansAdresse: preview.sansAdresse.length, ignorees: preview.ignorees });
      setPreview(null);
      toast("✓ Référentiel affaires mis à jour");
    } catch (e) {
      console.error("[AffairesEsabora] import échoué :", e);
      toast("❌ Échec de l'import");
    } finally {
      setImporting(false);
    }
  };

  const cols = [
    { key: "num", header: "N°", width: 90, sortable: true },
    { key: "titre", header: "Titre", sortable: true, render: (v) => v || "—" },
    { key: "adresse", header: "Adresse", sortable: true,
      render: (v, r) => (v ? adresseComplete(r) : <span style={{ color: EPJ.red }}>— manquante</span>) },
    { key: "ville", header: "Ville", sortable: true, render: (v) => v || "—" },
    { key: "etat", header: "État", width: 120, sortable: true, render: (v) => v || "—" },
  ];

  if (!authorized) {
    return (
      <div style={{ paddingTop: space.lg }}>
        <Button variant="secondary" size="sm" onClick={onBack}>← Retour</Button>
        <div style={{
          marginTop: space.md, background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
          borderRadius: radius.lg, padding: space.xl, textAlign: "center",
        }}>
          <div style={{ fontSize: fontSize.sm, color: EPJ.gray500 }}>
            Accès réservé au gestionnaire RH (Admin / Direction / Assistante).
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: space.sm, paddingBottom: space.xl }}>
      <ModuleSubHeader
        moduleName="Administration"
        title="Injection affaires Esabora"
        subtitle="Référentiel affaires (adresses) pour les frais"
        onBackToModuleHome={onBack}
      />

      {/* IMPORT */}
      <div style={{
        background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.lg,
        padding: space.lg, marginBottom: space.lg,
      }}>
        <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900, marginBottom: space.xs }}>
          Importer / mettre à jour depuis AFFAIRES.xlsx
        </div>
        <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginBottom: space.md }}>
          Colonnes : Etat, Numéro, Titre, Nom client, Date création, Date fin prévue, Date fin réalisée,
          Adresse, Code postal, Ville. Ré-import = mise à jour (aucune suppression).
        </div>

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

        {preview && (
          <div style={{ marginTop: space.lg }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: space.md, marginBottom: space.md }}>
              <Stat label="Affaires valides" value={preview.valides.length} />
              <Stat label="Sans adresse" value={preview.sansAdresse.length} tone={preview.sansAdresse.length ? "warn" : "ok"} />
              <Stat label="Lignes ignorées" value={preview.ignorees} tone={preview.ignorees ? "warn" : "ok"} />
            </div>
            {preview.sansAdresse.length > 0 && (
              <div style={{
                marginBottom: space.md, padding: `${space.sm}px ${space.md}px`, borderRadius: radius.md,
                background: `${EPJ.red}0D`, border: `1px solid ${EPJ.red}44`, fontSize: fontSize.sm, color: EPJ.gray700,
              }}>
                <b style={{ color: EPJ.red }}>{preview.sansAdresse.length} affaire(s) sans adresse :</b>{" "}
                {preview.sansAdresse.slice(0, 20).map((a) => a.num).join(", ")}
                {preview.sansAdresse.length > 20 ? "…" : ""}. Elles seront enregistrées mais sans fallback d'adresse.
              </div>
            )}
            <Button variant="primary" size="sm" onClick={doImport} loading={importing}>
              Mettre à jour le référentiel
            </Button>
          </div>
        )}

        {importResult && (
          <div style={{
            marginTop: space.md, padding: `${space.sm}px ${space.md}px`, borderRadius: radius.md,
            background: `${EPJ.green}10`, border: `1px solid ${EPJ.green}40`, fontSize: fontSize.sm, color: EPJ.gray700,
          }}>
            ✓ {importResult.nb} affaires enregistrées
            {importResult.sansAdresse ? ` · ${importResult.sansAdresse} sans adresse` : ""}
            {importResult.ignorees ? ` · ${importResult.ignorees} ignorées` : ""}.
          </div>
        )}
      </div>

      {/* CONSULTATION */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: space.md, marginBottom: space.md }}>
        <Field label="Rechercher (n° / ville / titre)" dense width={280}
          value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ex : 123456 ou Grenoble" />
        <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, paddingBottom: 8 }}>
          {rows.length} affaire{rows.length > 1 ? "s" : ""} au référentiel
        </div>
      </div>
      {denied ? (
        <div style={{ fontSize: fontSize.sm, color: EPJ.red }}>Lecture refusée (règles non déployées ?).</div>
      ) : (
        <DataTable columns={cols} rows={filtered} keyField="_id" pageSize={50}
          empty={{ icon: "📋", title: "Référentiel vide", text: "Importez un fichier AFFAIRES.xlsx pour commencer." }} />
      )}
    </div>
  );
}

function Stat({ label, value, tone }) {
  const color = tone === "warn" ? EPJ.red : tone === "ok" ? EPJ.green : EPJ.gray900;
  return (
    <div style={{
      background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.md,
      padding: `${space.sm}px ${space.md}px`, minWidth: 110,
    }}>
      <div style={{ fontSize: fontSize.xs, color: EPJ.gray500 }}>{label}</div>
      <div style={{ fontSize: fontSize.lg, fontWeight: fontWeight.semibold, color }}>{value}</div>
    </div>
  );
}

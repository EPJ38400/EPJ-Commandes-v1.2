// ═══════════════════════════════════════════════════════════════
//  PieuvresTab — contenu de l'onglet « Pieuvres » (M5, L2)
//
//  • Lit la collection racine `pieuvres` filtrée par chantierId (query
//    directe + tri client : aucun index composite, pas de listener global).
//  • Génération idempotente à la 1re ouverture (si droit edit + bâtiments
//    présents + aucune pieuvre) ; bouton « Compléter les pieuvres » pour
//    régénérer les lignes manquantes après ajout d'un étage.
//  • 1 tableau par bâtiment (desktop) / cartes (PWA). Édition en ligne,
//    sauvegarde par doc en merge:true.
//
//  LECTURE SEULE de `chantiers`. AUCUNE écriture dans `chantiers`.
//  Écritures `pieuvres` gardées par can(user,"gestionChantier","edit").
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useRef, useMemo } from "react";
import {
  collection, query, where, onSnapshot, doc, setDoc, serverTimestamp, Timestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useViewport } from "../../core/useViewport";
import { can } from "../../core/permissions";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import { Badge } from "../../core/components/Badge";
import { resolveBuildings, getBuildingLetter } from "../avancement/avancementTasks";
import {
  expectedPieuvres, niveauxForConfig, pieuvreId, niveauLabel,
  hasRealBuildings, LIEU_OPTIONS, STATUT_OPTIONS, STATUT_TONE,
} from "./pieuvresModel";

const DATE_FIELDS = ["jourDemande", "dateReceptionPlansCotes", "dateLivraison"];

// ─── Conversions date Timestamp ↔ <input type="date"> ──────────
function tsToInput(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : null);
  if (!d || isNaN(d)) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function inputToTs(str) {
  if (!str) return null;
  return Timestamp.fromDate(new Date(`${str}T00:00:00`));
}

export function PieuvresTab({ chantier }) {
  const { user } = useAuth();
  const { rolesConfig } = useData();
  const isPwa = useViewport() === "mobile";

  const editScope = can(user, "gestionChantier", "edit", rolesConfig);
  const canEdit = editScope === "all" || editScope === "own_chantiers";

  const [rows, setRows] = useState([]);
  const [loadedSnap, setLoadedSnap] = useState(false);
  const [working, setWorking] = useState(false);
  const genTried = useRef(false);

  // ─── Lecture live de pieuvres (1 clause where = pas d'index) ───
  useEffect(() => {
    setLoadedSnap(false);
    genTried.current = false;
    const q = query(collection(db, "pieuvres"), where("chantierId", "==", chantier.num));
    const unsub = onSnapshot(q, (snap) => {
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoadedSnap(true);
    });
    return unsub;
  }, [chantier.num]);

  const rowsById = useMemo(() => {
    const m = new Map();
    rows.forEach((r) => m.set(r.id, r));
    return m;
  }, [rows]);

  // ─── Génération idempotente (crée seulement les lignes manquantes) ───
  const ensurePieuvres = async () => {
    if (!canEdit || working) return;
    const existing = new Set(rows.map((r) => r.id));
    const missing = expectedPieuvres(chantier).filter((e) => !existing.has(e.id));
    if (missing.length === 0) return;
    setWorking(true);
    try {
      await Promise.all(missing.map((e) => setDoc(
        doc(db, "pieuvres", e.id),
        {
          chantierId: e.chantierId, batiment: e.batiment, niveau: e.niveau,
          posteAvancementKey: e.posteAvancementKey,
          jourDemande: null, dateReceptionPlansCotes: null, dateLivraison: null,
          lieuLivraison: "CHANTIER", statut: "A_DEMANDER",
          commandeId: null, remarques: null,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        },
        { merge: true },
      )));
    } finally {
      setWorking(false);
    }
  };

  // Auto-génération à la 1re ouverture (une seule fois).
  useEffect(() => {
    if (!loadedSnap || genTried.current) return;
    if (rows.length === 0 && canEdit && hasRealBuildings(chantier)) {
      genTried.current = true;
      ensurePieuvres();
    }
  }, [loadedSnap, rows.length, canEdit]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Sauvegarde d'un champ (par doc, merge:true) ───
  const saveField = (row, field, rawValue) => {
    if (!canEdit) return;
    const value = DATE_FIELDS.includes(field) ? inputToTs(rawValue) : rawValue;
    setDoc(
      doc(db, "pieuvres", row.id),
      { [field]: value, updatedAt: serverTimestamp() },
      { merge: true },
    );
  };

  // ─── Regroupement par bâtiment, ordre piloté par le modèle ───
  const groups = useMemo(() => {
    return resolveBuildings(chantier).map((b) => {
      const lettre = getBuildingLetter(b);
      const ordered = niveauxForConfig(b.config)
        .map((n) => rowsById.get(pieuvreId(chantier.num, lettre, n.niveau)))
        .filter(Boolean);
      return { lettre, rows: ordered };
    }).filter((g) => g.rows.length > 0);
  }, [chantier, rowsById]);

  // ─── États particuliers ───
  if (!hasRealBuildings(chantier)) {
    return (
      <EmptyBox icon="🏢"
        text="Aucun bâtiment configuré sur ce chantier. Renseignez les bâtiments dans l'administration du chantier pour générer les pieuvres." />
    );
  }
  if (!loadedSnap) {
    return <EmptyBox icon="⏳" text="Chargement des pieuvres…" />;
  }
  if (rows.length === 0) {
    return (
      <div>
        <ToolBar canEdit={canEdit} working={working} onGenerate={ensurePieuvres} hasRows={false} />
        <EmptyBox icon="🕸️"
          text={canEdit
            ? "Aucune pieuvre pour l'instant. Cliquez sur « Générer les pieuvres »."
            : "Aucune pieuvre n'a encore été générée pour ce chantier."} />
      </div>
    );
  }

  return (
    <div>
      <ToolBar canEdit={canEdit} working={working} onGenerate={ensurePieuvres} hasRows />
      {groups.map((g) => (
        <div key={g.lettre} style={{ marginBottom: space.xl }}>
          <div style={{
            fontFamily: font.display, fontSize: fontSize.lg, fontWeight: fontWeight.regular,
            color: EPJ.gray900, letterSpacing: "-0.01em", marginBottom: space.sm,
          }}>
            Bâtiment {g.lettre}
            <span style={{ fontSize: fontSize.sm, color: EPJ.gray500, marginLeft: space.sm }}>
              · {g.rows.length} dalle{g.rows.length > 1 ? "s" : ""}
            </span>
          </div>
          {isPwa
            ? <PieuvreCards rows={g.rows} canEdit={canEdit} onSave={saveField} />
            : <PieuvreTable rows={g.rows} canEdit={canEdit} onSave={saveField} />}
        </div>
      ))}
    </div>
  );
}

// ─── Barre d'outils ───
function ToolBar({ canEdit, working, onGenerate, hasRows }) {
  if (!canEdit) return null;
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: space.md }}>
      <Button variant="secondary" size="sm" onClick={onGenerate} loading={working}>
        {hasRows ? "Compléter les pieuvres" : "Générer les pieuvres"}
      </Button>
    </div>
  );
}

// ─── Tableau (desktop) ───
const COLS = [
  { key: "niveau",   label: "Dalle",          w: "130px" },
  { key: "jourDemande", label: "Jour demande", w: "1fr" },
  { key: "dateReceptionPlansCotes", label: "Réception plans cotés", w: "1fr" },
  { key: "dateLivraison", label: "Livraison", w: "1fr" },
  { key: "lieuLivraison", label: "Lieu",      w: "120px" },
  { key: "statut",   label: "Statut",         w: "150px" },
  { key: "remarques", label: "Remarques",     w: "1.4fr" },
];

function PieuvreTable({ rows, canEdit, onSave }) {
  const template = COLS.map((c) => c.w).join(" ");
  return (
    <div style={{ overflowX: "auto", border: `1px solid ${EPJ.gray200}`, borderRadius: radius.lg, background: EPJ.white }}>
      <div style={{ minWidth: 880 }}>
        {/* En-têtes */}
        <div style={{
          display: "grid", gridTemplateColumns: template, gap: space.sm,
          padding: `${space.sm}px ${space.md}px`, borderBottom: `1px solid ${EPJ.gray200}`,
          background: EPJ.gray50,
        }}>
          {COLS.map((c) => (
            <div key={c.key} style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray600 }}>
              {c.label}
            </div>
          ))}
        </div>
        {/* Lignes */}
        {rows.map((r) => (
          <div key={r.id} style={{
            display: "grid", gridTemplateColumns: template, gap: space.sm, alignItems: "center",
            padding: `${space.sm}px ${space.md}px`, borderBottom: `1px solid ${EPJ.gray100}`,
          }}>
            <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900 }}>
              {niveauLabel(r.niveau)}
            </div>
            <Field dense type="date" value={tsToInput(r.jourDemande)} disabled={!canEdit}
              onChange={(e) => onSave(r, "jourDemande", e.target.value)} />
            <Field dense type="date" value={tsToInput(r.dateReceptionPlansCotes)} disabled={!canEdit}
              onChange={(e) => onSave(r, "dateReceptionPlansCotes", e.target.value)} />
            <Field dense type="date" value={tsToInput(r.dateLivraison)} disabled={!canEdit}
              onChange={(e) => onSave(r, "dateLivraison", e.target.value)} />
            <Field dense as="select" value={r.lieuLivraison || "CHANTIER"} options={LIEU_OPTIONS} disabled={!canEdit}
              onChange={(e) => onSave(r, "lieuLivraison", e.target.value)} />
            <Field dense as="select" value={r.statut || "A_DEMANDER"} options={STATUT_OPTIONS} disabled={!canEdit}
              onChange={(e) => onSave(r, "statut", e.target.value)} />
            <RemarquesCell value={r.remarques} disabled={!canEdit}
              onCommit={(v) => onSave(r, "remarques", v)} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Cartes (PWA) ───
function PieuvreCards({ rows, canEdit, onSave }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
      {rows.map((r) => (
        <div key={r.id} style={{
          background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
          borderRadius: radius.lg, padding: space.md,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: space.sm }}>
            <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: EPJ.gray900 }}>
              {niveauLabel(r.niveau)}
            </div>
            <Badge tone={STATUT_TONE[r.statut] || "neutral"}
              label={(STATUT_OPTIONS.find((o) => o.value === r.statut) || {}).label || r.statut || "—"} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space.sm }}>
            <Field dense label="Jour demande" type="date" value={tsToInput(r.jourDemande)} disabled={!canEdit}
              onChange={(e) => onSave(r, "jourDemande", e.target.value)} />
            <Field dense label="Réception plans" type="date" value={tsToInput(r.dateReceptionPlansCotes)} disabled={!canEdit}
              onChange={(e) => onSave(r, "dateReceptionPlansCotes", e.target.value)} />
            <Field dense label="Livraison" type="date" value={tsToInput(r.dateLivraison)} disabled={!canEdit}
              onChange={(e) => onSave(r, "dateLivraison", e.target.value)} />
            <Field dense label="Lieu" as="select" value={r.lieuLivraison || "CHANTIER"} options={LIEU_OPTIONS} disabled={!canEdit}
              onChange={(e) => onSave(r, "lieuLivraison", e.target.value)} />
            <Field dense label="Statut" as="select" value={r.statut || "A_DEMANDER"} options={STATUT_OPTIONS} disabled={!canEdit}
              onChange={(e) => onSave(r, "statut", e.target.value)} />
          </div>
          <div style={{ marginTop: space.sm }}>
            <RemarquesCell label="Remarques" value={r.remarques} disabled={!canEdit}
              onCommit={(v) => onSave(r, "remarques", v)} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Champ remarques : état local, commit au blur ───
function RemarquesCell({ value, disabled, onCommit, label }) {
  const [txt, setTxt] = useState(value || "");
  useEffect(() => { setTxt(value || ""); }, [value]);
  return (
    <Field
      dense label={label} value={txt} disabled={disabled} placeholder="—"
      onChange={(e) => setTxt(e.target.value)}
      onBlur={() => { if ((value || "") !== txt) onCommit(txt); }}
    />
  );
}

// ─── Boîte d'état ───
function EmptyBox({ icon, text }) {
  return (
    <div style={{
      background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
      borderRadius: radius.lg, padding: space.xl, textAlign: "center",
    }}>
      <div style={{ fontSize: 32, marginBottom: space.sm }}>{icon}</div>
      <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, lineHeight: 1.5 }}>{text}</div>
    </div>
  );
}

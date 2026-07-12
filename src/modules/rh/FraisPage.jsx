// ═══════════════════════════════════════════════════════════════
//  FraisPage — onglet « Notes de frais » du module RH (RH-Frais-1)
//
//  Référentiel du barème « petits déplacements » FBTP, versionné par année
//  (collection referentielFraisBTP/{annee}). Écran RÉSERVÉ AU GESTIONNAIRE :
//  seuls Admin/Direction/Assistante atteignent l'onglet (gate rh.frais._access),
//  donc tous ceux qui l'ouvrent éditent. Sélecteur d'année, saisie éditable
//  (repas, transport/trajet/seuils par zone, dateEffet, source), « Nouvelle
//  année » (pré-remplie depuis l'année précédente ou BAREME_2026), « Injecter
//  le barème 2026 ».
//
//  Adresses salariés & dépôt EPJ (RH-Frais-2a-bis) : la saisie a migré hors de
//  cet écran — adresseDomicile + pointDepartFrais sont sur la fiche utilisateur
//  (AdminUsers → adminUpdateUser) ; l'adresse du dépôt est sur les réglages
//  société (config/company). Ici : UNIQUEMENT le barème FBTP.
//
//  Lecture live onSnapshot(referentielFraisBTP), tri par année desc.
//  ÉCRIT referentielFraisBTP/{annee} (setDoc merge) uniquement.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from "react";
import {
  collection, doc, onSnapshot, setDoc, getDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { can } from "../../core/permissions";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import { EmptyAccess } from "../planning/PlanningTab";
import { FRAIS_ZONES, FRAIS_ZONE_KM, BAREME_2026 } from "./fraisModel";

// Objet zones { "1a":"", … } vide (pour seed de brouillon).
const emptyZones = () => Object.fromEntries(FRAIS_ZONES.map((z) => [z, ""]));

// Convertit un objet zones {z:number|string} en objet de chaînes (édition).
const zonesToStr = (obj) =>
  Object.fromEntries(FRAIS_ZONES.map((z) => [z, obj?.[z] != null && obj[z] !== "" ? String(obj[z]) : ""]));
// Convertit un objet zones (chaînes) en nombres pour l'écriture.
const zonesToNum = (obj) =>
  Object.fromEntries(FRAIS_ZONES.map((z) => [z, Number(obj?.[z]) || 0]));

// Seed d'un brouillon d'édition depuis un doc barème (ou un modèle type BAREME_2026).
const seedDraft = (b) => ({
  dateEffet: b?.dateEffet || "",
  source: b?.source || "",
  repas: b?.repas != null && b.repas !== "" ? String(b.repas) : "",
  transport: b ? zonesToStr(b.transport) : emptyZones(),
  trajet: b ? zonesToStr(b.trajet) : emptyZones(),
  seuilsKm: b?.seuilsKm ? zonesToStr(b.seuilsKm) : zonesToStr(FRAIS_ZONE_KM),
});

export function FraisPage() {
  const { user } = useAuth();
  const { rolesConfig } = useData();

  const accessScope = can(user, "rh.frais", "_access", rolesConfig);
  const selfId = user?._id || user?.id || "";

  const [baremes, setBaremes] = useState([]); // docs triés année desc
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedAnnee, setSelectedAnnee] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  // ─── Lecture live du référentiel ───
  useEffect(() => {
    if (!accessScope) return undefined;
    setLoaded(false); setError(null);
    const unsub = onSnapshot(
      collection(db, "referentielFraisBTP"),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (Number(b.annee) || 0) - (Number(a.annee) || 0));
        setBaremes(list); setError(null); setLoaded(true);
      },
      (err) => { console.error("[FraisPage] lecture référentiel échouée :", err); setBaremes([]); setError(err); setLoaded(true); },
    );
    return unsub;
  }, [accessScope, reloadKey]);

  const anneesDispo = useMemo(() => baremes.map((b) => Number(b.annee)), [baremes]);
  const has2026 = useMemo(() => baremes.some((b) => Number(b.annee) === 2026), [baremes]);

  // Année affichée : la sélection valide, sinon la plus récente.
  const anneeCourante = useMemo(() => {
    if (selectedAnnee != null && anneesDispo.includes(selectedAnnee)) return selectedAnnee;
    return anneesDispo[0] ?? null;
  }, [selectedAnnee, anneesDispo]);

  const baremeCourant = useMemo(
    () => baremes.find((b) => Number(b.annee) === anneeCourante) || null,
    [baremes, anneeCourante],
  );

  // Seed du brouillon d'édition quand l'année courante change.
  useEffect(() => {
    setDraft(baremeCourant ? seedDraft(baremeCourant) : null);
    setSaved(false);
  }, [baremeCourant]);

  // ─── Écriture d'un barème (setDoc merge par année) ───
  const writeBareme = async (annee, payload, { isNew } = {}) => {
    const ref = doc(db, "referentielFraisBTP", String(annee));
    const base = {
      annee: Number(annee),
      dateEffet: payload.dateEffet || `${annee}-01-01`,
      repas: Number(payload.repas) || 0,
      transport: zonesToNum(payload.transport),
      trajet: zonesToNum(payload.trajet),
      seuilsKm: zonesToNum(payload.seuilsKm),
      source: payload.source || "",
      updatedAt: serverTimestamp(),
    };
    if (isNew) {
      base.createdBy = selfId;
      base.createdByNom = `${user?.prenom || ""} ${user?.nom || ""}`.trim() || selfId;
      base.createdAt = serverTimestamp();
    }
    await setDoc(ref, base, { merge: true });
  };

  const saveDraft = async () => {
    if (!draft || saving || anneeCourante == null) return;
    setSaving(true); setSaved(false);
    try {
      await writeBareme(anneeCourante, draft, { isNew: !baremeCourant });
      setSaved(true);
    } catch (e) {
      console.error("[FraisPage] enregistrement barème échoué :", e);
      window.alert("Échec de l'enregistrement du barème. Vérifiez votre connexion et réessayez.");
    } finally {
      setSaving(false);
    }
  };

  // Crée une nouvelle année, pré-remplie depuis l'année précédente (ou BAREME_2026).
  const nouvelleAnnee = async () => {
    if (busy) return;
    const rep = window.prompt("Année du nouveau barème (ex. 2027) :", "");
    const annee = Number((rep || "").trim());
    if (!annee || annee < 2000 || annee > 2100) {
      if (rep != null) window.alert("Année invalide.");
      return;
    }
    if (anneesDispo.includes(annee)) { setSelectedAnnee(annee); return; }
    setBusy(true);
    try {
      // Vérif autoritatif (évite d'écraser une année posée entre-temps).
      const existing = await getDoc(doc(db, "referentielFraisBTP", String(annee)));
      if (existing.exists()) { setSelectedAnnee(annee); return; }
      // Pré-remplissage : année précédente la plus proche, sinon BAREME_2026.
      const prev = baremes
        .filter((b) => Number(b.annee) < annee)
        .sort((a, b) => Number(b.annee) - Number(a.annee))[0] || BAREME_2026;
      await writeBareme(annee, { ...seedDraft(prev), dateEffet: `${annee}-01-01` }, { isNew: true });
      setSelectedAnnee(annee);
    } catch (e) {
      console.error("[FraisPage] création année échouée :", e);
      window.alert("Échec de la création du barème. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  };

  // Injecte le barème 2026 pré-rempli (seulement si aucun doc 2026).
  const injecter2026 = async () => {
    if (busy || has2026) return;
    setBusy(true);
    try {
      const existing = await getDoc(doc(db, "referentielFraisBTP", "2026"));
      if (existing.exists()) { setSelectedAnnee(2026); return; }
      await writeBareme(2026, seedDraft(BAREME_2026), { isNew: true });
      setSelectedAnnee(2026);
    } catch (e) {
      console.error("[FraisPage] injection barème 2026 échouée :", e);
      window.alert("Échec de l'injection du barème 2026. Vérifiez votre connexion et réessayez.");
    } finally {
      setBusy(false);
    }
  };

  // ─── Gate d'accès (après les hooks) ───
  if (!accessScope) return <EmptyAccess />;

  const retry = () => { setError(null); setLoaded(false); setReloadKey((k) => k + 1); };

  // ─── États transverses ───
  if (error) {
    return (
      <div>
        <EmptyBox icon="⚠️" text="Impossible de charger le référentiel. Vérifiez votre connexion et réessayez." />
        <div style={{ display: "flex", justifyContent: "center", marginTop: space.md }}>
          <Button variant="secondary" size="sm" onClick={retry}>Réessayer</Button>
        </div>
      </div>
    );
  }
  if (!loaded) return <EmptyBox icon="⏳" text="Chargement du référentiel…" />;

  // ─────────────────────────────────────────────────────────────
  //  Saisie GESTIONNAIRE — sélecteur d'année + tableau éditable
  // ─────────────────────────────────────────────────────────────
  const anneeOptions = anneesDispo.map((a) => ({ value: String(a), label: String(a) }));

  return (
    <div>
      {/* Barre d'outils : sélecteur d'année + actions de versionnement */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm, alignItems: "flex-end", justifyContent: "space-between", marginBottom: space.md }}>
        <div style={{ display: "flex", alignItems: "flex-end", gap: space.sm, flexWrap: "wrap" }}>
          {anneeOptions.length > 0 && (
            <Field
              as="select" label="Année du barème" dense width={140}
              options={anneeOptions}
              value={anneeCourante != null ? String(anneeCourante) : ""}
              onChange={(e) => setSelectedAnnee(Number(e.target.value))}
            />
          )}
          <Button variant="secondary" size="sm" onClick={nouvelleAnnee} loading={busy} disabled={busy}>
            + Nouvelle année
          </Button>
        </div>
        {!has2026 && (
          <Button variant="ghost" size="sm" onClick={injecter2026} loading={busy} disabled={busy}>
            Injecter le barème 2026
          </Button>
        )}
      </div>

      {!baremeCourant && anneeOptions.length === 0 ? (
        <EmptyBox
          icon="🧾"
          text="Aucun barème saisi. Injectez le barème 2026 ou créez une nouvelle année pour commencer."
        />
      ) : draft ? (
        <EditableBareme
          annee={anneeCourante}
          draft={draft}
          setDraft={setDraft}
          onSave={saveDraft}
          saving={saving}
          saved={saved}
        />
      ) : (
        <EmptyBox icon="⏳" text="Chargement…" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  Tableau ÉDITABLE (gestionnaire) — Field par cellule.
// ─────────────────────────────────────────────────────────────
function EditableBareme({ annee, draft, setDraft, onSave, saving, saved }) {
  const setTop = (key, val) => setDraft((d) => ({ ...d, [key]: val }));
  const setZone = (grp, z, val) => setDraft((d) => ({ ...d, [grp]: { ...d[grp], [z]: val } }));

  return (
    <div style={{ background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.lg, padding: space.lg }}>
      {/* Champs globaux */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: space.md, alignItems: "flex-end", marginBottom: space.lg }}>
        <Field type="number" label="Repas (€)" dense width={110}
          value={draft.repas} onChange={(e) => setTop("repas", e.target.value)} />
        <Field type="text" label="Date d'effet" dense width={150} placeholder="AAAA-MM-JJ"
          value={draft.dateEffet} onChange={(e) => setTop("dateEffet", e.target.value)} />
        <Field type="text" label="Source" dense width={220} placeholder="FBTP Isère…"
          value={draft.source} onChange={(e) => setTop("source", e.target.value)} />
      </div>

      {/* Matrice zones × (seuil / transport / trajet) */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: 460 }}>
          <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr 1fr", gap: space.sm, marginBottom: space.xs }}>
            <HeadCell>Zone</HeadCell>
            <HeadCell>Seuil (km)</HeadCell>
            <HeadCell>Transport (€)</HeadCell>
            <HeadCell>Trajet (€)</HeadCell>
          </div>
          {FRAIS_ZONES.map((z) => (
            <div key={z} style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr 1fr", gap: space.sm, alignItems: "center", marginBottom: space.xs }}>
              <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900 }}>{z}</span>
              <Field type="number" dense value={draft.seuilsKm[z]} onChange={(e) => setZone("seuilsKm", z, e.target.value)} />
              <Field type="number" dense value={draft.transport[z]} onChange={(e) => setZone("transport", z, e.target.value)} />
              <Field type="number" dense value={draft.trajet[z]} onChange={(e) => setZone("trajet", z, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: space.sm, marginTop: space.lg }}>
        <Button variant={saved ? "secondary" : "primary"} size="sm" onClick={onSave} loading={saving}>
          {saved ? "✓ Enregistré" : `Enregistrer le barème ${annee}`}
        </Button>
        <span style={{ fontSize: fontSize.xs, color: EPJ.gray500 }}>
          L'historique des années précédentes reste figé.
        </span>
      </div>
    </div>
  );
}

function HeadCell({ children }) {
  return (
    <div style={{ fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: EPJ.gray500 }}>{children}</div>
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

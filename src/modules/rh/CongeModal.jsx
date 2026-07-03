// ═══════════════════════════════════════════════════════════════
//  CongeModal — surface d'écriture d'un congé / absence (RH-2a)
//
//  Création ou édition d'un congé (collection racine `conges`).
//  Calque visuel de ../planning/AffectationModal (scrim + carte blanche,
//  primitives DS Field/Button). ÉCRIT UNIQUEMENT dans `conges` :
//   • création  → addDoc (statut "ACTIF") ;
//   • édition   → setDoc merge (mise à jour des champs) ;
//   • annulation → update statut "ANNULE" (JAMAIS de delete).
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import {
  doc, collection, addDoc, setDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useViewport } from "../../core/useViewport";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import { terrainResources } from "../planning/planningModel";
import { CONGE_TYPES, CONGE_TYPE_LABEL } from "./congesModel";

const TYPE_OPTIONS = CONGE_TYPES.map((t) => ({ value: t, label: CONGE_TYPE_LABEL[t] || t }));
const DEMI_OPTIONS = [
  { value: "AM", label: "Matin" },
  { value: "PM", label: "Après-midi" },
];

export function CongeModal({ user, users, conge, onClose }) {
  const isPwa = useViewport() === "mobile";
  const isEdit = !!conge;

  const resources = useMemo(() => terrainResources(users), [users]);
  const ressourceOptions = [
    { value: "", label: "— Choisir une ressource —" },
    ...resources.map((r) => ({ value: r.id, label: r.type === "ARTISAN" ? `${r.nom} (art.)` : r.nom })),
  ];

  const [ressourceId, setRessourceId] = useState(conge?.ressourceId || "");
  const [type, setType] = useState(conge?.type || "CP");
  const [du, setDu] = useState(conge?.du || "");
  const [au, setAu] = useState(conge?.au || "");
  const [demiDebut, setDemiDebut] = useState(conge?.demiJourneeDebut || "AM");
  const [demiFin, setDemiFin] = useState(conge?.demiJourneeFin || "PM");
  const [motif, setMotif] = useState(conge?.motif || "");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [err, setErr] = useState(null);

  // Validation : ressource + bornes présentes, au >= du.
  const validationError = (() => {
    if (!ressourceId) return "Choisissez une ressource.";
    if (!du || !au) return "Renseignez les dates de début et de fin.";
    if (au < du) return "La date de fin doit être postérieure ou égale à la date de début.";
    return null;
  })();

  const save = async () => {
    if (saving || cancelling) return;
    if (validationError) { setErr(validationError); return; }
    setSaving(true); setErr(null);
    try {
      const res = resources.find((r) => r.id === ressourceId) || null;
      const payload = {
        ressourceId,
        ressourceNom: res?.nom || ressourceId,
        ressourceType: res?.type || "SALARIE",
        type,
        du,
        au,
        demiJourneeDebut: demiDebut,
        demiJourneeFin: demiFin,
        motif: motif.trim() || null,
        statut: "ACTIF",
        updatedAt: serverTimestamp(),
      };
      if (isEdit) {
        await setDoc(doc(db, "conges", conge.id), payload, { merge: true });
      } else {
        await addDoc(collection(db, "conges"), {
          ...payload,
          creePar: user._id || user.id || null,
          creeParNom: `${user.prenom || ""} ${user.nom || ""}`.trim(),
          createdAt: serverTimestamp(),
        });
      }
      onClose();
    } catch (e) {
      console.error("[CongeModal] enregistrement échoué :", e);
      setErr(e.message || "Échec de l'enregistrement.");
      setSaving(false);
    }
  };

  // Annuler ce congé (jamais de suppression) → statut "ANNULE".
  const annuler = async () => {
    if (saving || cancelling || !isEdit) return;
    if (!window.confirm("Annuler ce congé ? Il ne sera plus affiché dans le planning des absences.")) return;
    setCancelling(true); setErr(null);
    try {
      await updateDoc(doc(db, "conges", conge.id), {
        statut: "ANNULE",
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (e) {
      console.error("[CongeModal] annulation échouée :", e);
      setErr(e.message || "Échec de l'annulation.");
      setCancelling(false);
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
          padding: space.lg, width: "100%", maxWidth: 480,
          maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,.2)",
        }}
      >
        <div style={{ marginBottom: space.md }}>
          <div style={{
            fontFamily: font.display, fontSize: fontSize.lg, fontWeight: fontWeight.regular,
            color: EPJ.gray900, letterSpacing: "-0.01em",
          }}>
            {isEdit ? "Modifier le congé" : "Nouveau congé"}
          </div>
          <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, marginTop: 2 }}>
            Congés & absences des équipes
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: space.md }}>
          <Field as="select" label="Ressource" value={ressourceId} options={ressourceOptions}
            onChange={(e) => setRessourceId(e.target.value)} />

          <Field as="select" label="Type d'absence" value={type} options={TYPE_OPTIONS}
            onChange={(e) => setType(e.target.value)} />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space.sm }}>
            <Field type="date" label="Du" value={du} onChange={(e) => setDu(e.target.value)} />
            <Field as="select" label="Demi-journée" value={demiDebut} options={DEMI_OPTIONS}
              onChange={(e) => setDemiDebut(e.target.value)} />
            <Field type="date" label="Au" value={au} onChange={(e) => setAu(e.target.value)} />
            <Field as="select" label="Demi-journée" value={demiFin} options={DEMI_OPTIONS}
              onChange={(e) => setDemiFin(e.target.value)} />
          </div>

          <Field as="textarea" label="Motif (optionnel)" value={motif} rows={2}
            placeholder="Précision libre…" onChange={(e) => setMotif(e.target.value)} />
        </div>

        {err && (
          <div style={{ marginTop: space.md, fontSize: fontSize.sm, color: EPJ.redText }}>
            {typeof err === "string" ? err : "Échec de l'enregistrement. Vérifiez votre connexion et réessayez."}
          </div>
        )}

        <div style={{ display: "flex", gap: space.sm, marginTop: space.lg, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Button variant="ghost" onClick={onClose}>Annuler</Button>
          {isEdit && (
            <Button variant="danger" onClick={annuler} loading={cancelling} disabled={saving}>
              Annuler ce congé
            </Button>
          )}
          <Button variant="primary" onClick={save} loading={saving} disabled={cancelling}>
            {isEdit ? "Enregistrer" : "Créer le congé"}
          </Button>
        </div>
      </div>
    </div>
  );
}

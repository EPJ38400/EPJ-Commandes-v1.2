// ═══════════════════════════════════════════════════════════════
//  CongeModal — surface d'écriture d'un congé / absence (RH-2a → RH-2c)
//
//  Deux modes, déduits de can(user,"rh.conges","validate") :
//   • GESTIONNAIRE (validate === "all" : Direction/Assistante) → saisie
//     directe : ressource libre, type AVEC maladie, création statut
//     "VALIDEE" (validationN2 auto). Ex. arrêt maladie.
//   • DEMANDEUR (tous les autres) → demande d'absence : ressource
//     VERROUILLÉE sur soi, type SANS maladie, création statut "DEMANDE"
//     (sauteN1 = conducteur → part direct en attente N2).
//
//  Calque visuel de ../planning/AffectationModal (scrim + carte blanche,
//  primitives DS Field/Button). ÉCRIT UNIQUEMENT dans `conges` :
//   • création  → addDoc ;
//   • édition   → setDoc merge (champs éditables, statut/validations intacts) ;
//   • annulation → update statut "ANNULEE" (JAMAIS de delete).
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import {
  doc, collection, addDoc, setDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useViewport } from "../../core/useViewport";
import { useData } from "../../core/DataContext";
import { can } from "../../core/permissions";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import { terrainResources } from "../planning/planningModel";
import { CONGE_TYPES, CONGE_TYPE_LABEL } from "./congesModel";

const DEMI_OPTIONS = [
  { value: "AM", label: "Matin" },
  { value: "PM", label: "Après-midi" },
];

const userLabel = (u) => `${u?.prenom || ""} ${u?.nom || ""}`.trim();

export function CongeModal({ user, users, conge, onClose }) {
  const isPwa = useViewport() === "mobile";
  const isEdit = !!conge;
  const { rolesConfig } = useData();

  // ─── Mode (RH-2c) ───
  const validateScope = can(user, "rh.conges", "validate", rolesConfig);
  const gestionnaire = validateScope === "all";        // Direction/Assistante : saisie directe + maladie
  const isConducteur = validateScope === "own_chantiers"; // N1 → sa demande saute N1

  const resources = useMemo(() => terrainResources(users), [users]);
  const ressourceOptions = [
    { value: "", label: "— Choisir une ressource —" },
    ...resources.map((r) => ({ value: r.id, label: r.type === "ARTISAN" ? `${r.nom} (art.)` : r.nom })),
  ];

  // Types proposés : gestionnaire = tous ; demandeur = sans MALADIE. En édition,
  // on ré-ajoute le type courant s'il sort du jeu (ex. maladie saisie par un tiers).
  const typeOptions = useMemo(() => {
    const base = gestionnaire ? CONGE_TYPES : CONGE_TYPES.filter((t) => t !== "MALADIE");
    const vals = (isEdit && conge?.type && !base.includes(conge.type)) ? [...base, conge.type] : base;
    return vals.map((t) => ({ value: t, label: CONGE_TYPE_LABEL[t] || t }));
  }, [gestionnaire, isEdit, conge]);

  const selfId = user?._id || user?.id || "";

  // Ressource : libre en gestionnaire, verrouillée sur soi en demandeur.
  const [ressourceId, setRessourceId] = useState(
    conge?.ressourceId || (gestionnaire ? "" : selfId),
  );
  const [type, setType] = useState(conge?.type || "CP");
  const [du, setDu] = useState(conge?.du || "");
  const [au, setAu] = useState(conge?.au || "");
  const [demiDebut, setDemiDebut] = useState(conge?.demiJourneeDebut || "AM");
  const [demiFin, setDemiFin] = useState(conge?.demiJourneeFin || "PM");
  const [motif, setMotif] = useState(conge?.motif || "");
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [err, setErr] = useState(null);

  // Nom de la ressource verrouillée (demandeur) : celui du user connecté.
  const selfNom = userLabel(user) || selfId;

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
      const ressourceNom = res?.nom || (ressourceId === selfId ? selfNom : ressourceId);
      const ressourceType = res?.type || "SALARIE";
      // Champs métier communs (jamais statut/validations ici).
      const champs = {
        ressourceId,
        ressourceNom,
        ressourceType,
        type,
        du,
        au,
        demiJourneeDebut: demiDebut,
        demiJourneeFin: demiFin,
        motif: motif.trim() || null,
        updatedAt: serverTimestamp(),
      };
      if (isEdit) {
        // Édition : on ne touche PAS au statut ni au circuit de validation.
        await setDoc(doc(db, "conges", conge.id), champs, { merge: true });
      } else {
        // Création : le statut dépend du mode (RH-2c).
        const workflow = gestionnaire
          ? {
              // Saisie directe (ex. maladie) → validée définitivement.
              statut: "VALIDEE",
              sauteN1: false,
              validationN1: null,
              validationN2: {
                par: selfId, parNom: selfNom, decision: "OK", date: serverTimestamp(),
              },
            }
          : {
              // Demande d'absence → circuit de validation.
              statut: "DEMANDE",
              sauteN1: isConducteur, // conducteur : part direct en attente N2
              validationN1: null,
              validationN2: null,
            };
        await addDoc(collection(db, "conges"), {
          ...champs,
          ...workflow,
          demandeParId: selfId,
          demandeParNom: selfNom,
          creePar: selfId,
          creeParNom: selfNom,
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

  // Annuler ce congé (jamais de suppression) → statut "ANNULEE".
  // Autorisé tant que le congé n'est pas définitivement validé (sauf gestionnaire).
  const peutAnnuler = isEdit && (gestionnaire || conge?.statut !== "VALIDEE");
  const annuler = async () => {
    if (saving || cancelling || !peutAnnuler) return;
    if (!window.confirm("Annuler ce congé ? Il ne sera plus affiché dans le planning des absences.")) return;
    setCancelling(true); setErr(null);
    try {
      await updateDoc(doc(db, "conges", conge.id), {
        statut: "ANNULEE",
        updatedAt: serverTimestamp(),
      });
      onClose();
    } catch (e) {
      console.error("[CongeModal] annulation échouée :", e);
      setErr(e.message || "Échec de l'annulation.");
      setCancelling(false);
    }
  };

  const titre = isEdit
    ? "Modifier le congé"
    : gestionnaire ? "Nouveau congé" : "Demander une absence";

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
            {titre}
          </div>
          <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, marginTop: 2 }}>
            {gestionnaire ? "Congés & absences des équipes" : "Votre demande sera soumise à validation"}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: space.md }}>
          {gestionnaire ? (
            <Field as="select" label="Ressource" value={ressourceId} options={ressourceOptions}
              onChange={(e) => setRessourceId(e.target.value)} />
          ) : (
            <Field label="Ressource" value={selfNom} disabled />
          )}

          <Field as="select" label="Type d'absence" value={type} options={typeOptions}
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
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
          {peutAnnuler && (
            <Button variant="danger" onClick={annuler} loading={cancelling} disabled={saving}>
              Annuler ce congé
            </Button>
          )}
          <Button variant="primary" onClick={save} loading={saving} disabled={cancelling}>
            {isEdit ? "Enregistrer" : gestionnaire ? "Créer le congé" : "Envoyer la demande"}
          </Button>
        </div>
      </div>
    </div>
  );
}

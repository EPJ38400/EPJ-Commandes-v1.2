// ═══════════════════════════════════════════════════════════════
//  AffectationModal — affectation d'un créneau (clic sur une cellule)
//
//  Choix chantier (figé en mode onglet) → bâtiment → POSTE (optionnel,
//  picker taxonomie M3) + temps estimé. Écrit UNIQUEMENT dans
//  planningCreneaux (setDoc merge:true). « Libérer » = remet le créneau
//  à null (update, autorisé Assistante par les rules ; pas de delete).
//  Lecture seule si pas de droit d'écriture (vue Monteur).
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useViewport } from "../../core/useViewport";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import {
  creneauId, chantierPlanningOptions, PERIODE_LABEL,
} from "./planningModel";

export function AffectationModal({
  user, ressource, date, periode, existing,
  canWrite, fixedChantier, allChantiers, tasksConfig, onClose,
}) {
  const isPwa = useViewport() === "mobile";
  const [chantierId, setChantierId] = useState(existing?.chantierId || (fixedChantier?.num || ""));
  const [batiment, setBatiment] = useState(existing?.batiment || "");
  const [poste, setPoste] = useState(existing?.posteAvancementKey || "");
  const [temps, setTemps] = useState(
    existing?.tempsEstimeH != null ? String(existing.tempsEstimeH) : "",
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  // Objet chantier courant (figé en onglet, sinon depuis le picker global).
  const chantierObj = useMemo(() => {
    if (fixedChantier) return fixedChantier;
    return (allChantiers || []).find((c) => c.num === chantierId) || null;
  }, [fixedChantier, allChantiers, chantierId]);

  const buildingGroups = useMemo(
    () => (chantierObj ? chantierPlanningOptions(chantierObj, tasksConfig) : []),
    [chantierObj, tasksConfig],
  );
  const currentGroup = useMemo(
    () => buildingGroups.find((g) => g.lettre === batiment) || null,
    [buildingGroups, batiment],
  );

  const chantierOptions = [
    { value: "", label: "— Disponible (aucun chantier) —" },
    ...(allChantiers || []).map((c) => ({
      value: c.num, label: `${c.num}${c.nom ? " · " + c.nom : ""}`,
    })),
  ];
  const batimentOptions = [
    { value: "", label: "— Aucun —" },
    ...buildingGroups.map((g) => ({ value: g.lettre, label: g.label })),
  ];
  const posteOptions = [
    { value: "", label: "— Aucun poste précis —" },
    ...(currentGroup?.postes || []).map((p) => ({ value: p.key, label: p.label })),
  ];

  const onChantierChange = (v) => { setChantierId(v); setBatiment(""); setPoste(""); };
  const onBatimentChange = (v) => { setBatiment(v); setPoste(""); };

  const buildPayload = (assigned) => ({
    ressourceId: ressource.id,
    ressourceNom: ressource.nom,
    ressourceType: ressource.type,
    date, periode,
    chantierId: assigned ? (chantierId || null) : null,
    batiment: assigned && chantierId ? (batiment || null) : null,
    posteAvancementKey: assigned && chantierId ? (poste || null) : null,
    tempsEstimeH: assigned && temps !== "" && temps != null ? Number(temps) : null,
    tacheId: null,                                          // lien tâche ponctuelle = L7
    etatValidationMonteur: existing?.etatValidationMonteur || "NON", // workflow = L9
    smsEnvoye: existing?.smsEnvoye ?? false,                // cron SMS = lot dédié
    creePar: existing?.creePar || user._id,
    modifiePar: user._id,
    updatedAt: serverTimestamp(),
  });

  const write = async (assigned) => {
    if (!canWrite || saving) return;
    setSaving(true); setErr(null);
    try {
      await setDoc(
        doc(db, "planningCreneaux", creneauId(ressource.id, date, periode)),
        buildPayload(assigned),
        { merge: true },
      );
      onClose();
    } catch (e) {
      console.error("[AffectationModal] écriture créneau échouée :", e);
      setErr(e);
      setSaving(false);
    }
  };

  const hasAssignment = !!existing?.chantierId;

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
          padding: space.lg, width: "100%", maxWidth: 460,
          maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,.2)",
        }}
      >
        <div style={{ marginBottom: space.md }}>
          <div style={{
            fontFamily: font.display, fontSize: fontSize.lg, fontWeight: fontWeight.regular,
            color: EPJ.gray900, letterSpacing: "-0.01em",
          }}>
            {ressource.nom}
          </div>
          <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, marginTop: 2 }}>
            {date} · {PERIODE_LABEL[periode] || periode}
            {fixedChantier && ` · Chantier ${fixedChantier.num}`}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: space.md }}>
          {!fixedChantier && (
            <Field
              as="select" label="Chantier" value={chantierId} options={chantierOptions}
              disabled={!canWrite} onChange={(e) => onChantierChange(e.target.value)}
            />
          )}
          {chantierId && (
            <>
              <Field
                as="select" label="Bâtiment" value={batiment} options={batimentOptions}
                disabled={!canWrite} onChange={(e) => onBatimentChange(e.target.value)}
              />
              <Field
                as="select" label="Poste (optionnel)" value={poste} options={posteOptions}
                disabled={!canWrite || !batiment}
                hint={!batiment ? "Choisissez d'abord un bâtiment." : undefined}
                onChange={(e) => setPoste(e.target.value)}
              />
              <Field
                type="number" label="Temps estimé (h)" value={temps}
                disabled={!canWrite} placeholder="ex: 4"
                onChange={(e) => setTemps(e.target.value)}
              />
            </>
          )}
        </div>

        {err && (
          <div style={{ marginTop: space.md, fontSize: fontSize.sm, color: EPJ.redText }}>
            Échec de l'enregistrement. Vérifiez votre connexion et réessayez.
          </div>
        )}

        <div style={{ display: "flex", gap: space.sm, marginTop: space.lg, justifyContent: "flex-end", flexWrap: "wrap" }}>
          <Button variant="ghost" onClick={onClose}>
            {canWrite ? "Annuler" : "Fermer"}
          </Button>
          {canWrite && hasAssignment && (
            <Button variant="secondary" onClick={() => write(false)} disabled={saving}>
              Libérer
            </Button>
          )}
          {canWrite && (
            <Button variant="primary" onClick={() => write(true)} loading={saving}>
              Enregistrer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

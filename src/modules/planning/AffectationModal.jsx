// ═══════════════════════════════════════════════════════════════
//  AffectationModal — affectation sur PLAGE (L8b)
//
//  Chantier (figé en onglet) → bâtiment/unité → POSTE (optionnel, picker
//  taxonomie M3 complète) + Du{jour,AM/PM} → Au{jour,AM/PM} + temps estimé.
//  Valider = boucle setDoc(merge:true) sur tous les créneaux demi-journée
//  de la plage. Collision avec un AUTRE chantier → confirmation (jamais
//  d'écrasement silencieux). « Libérer sur la plage » = chantierId=null.
//  ÉCRIT UNIQUEMENT dans planningCreneaux. Lecture seule si pas de droit.
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useViewport } from "../../core/useViewport";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import {
  creneauId, getPosteOptions, PERIODES, PERIODE_LABEL,
  slotIndex, slotToCell, expandRange, demiJourneeHeures,
} from "./planningModel";

const PERIODE_OPTIONS = PERIODES.map((p) => ({ value: p, label: PERIODE_LABEL[p] || p }));

export function AffectationModal({
  user, ressource, weekCols, fromSlot, toSlot, prefill, getExisting,
  canWrite, fixedChantier, allChantiers, tasksConfig, onClose,
}) {
  const isPwa = useViewport() === "mobile";

  const initFrom = slotToCell(fromSlot);
  const initTo = slotToCell(toSlot);
  const [fromDay, setFromDay] = useState(String(initFrom.dayIdx));
  const [fromPer, setFromPer] = useState(initFrom.periode);
  const [toDay, setToDay] = useState(String(initTo.dayIdx));
  const [toPer, setToPer] = useState(initTo.periode);

  const [chantierId, setChantierId] = useState(prefill?.chantierId || (fixedChantier?.num || ""));
  const [batiment, setBatiment] = useState(prefill?.batiment || "");
  const [poste, setPoste] = useState(prefill?.posteAvancementKey || "");
  const [temps, setTemps] = useState("");   // vide = défaut demi-journée par slot
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const chantierObj = useMemo(() => {
    if (fixedChantier) return fixedChantier;
    return (allChantiers || []).find((c) => c.num === chantierId) || null;
  }, [fixedChantier, allChantiers, chantierId]);

  const units = useMemo(
    () => (chantierObj ? getPosteOptions(chantierObj, tasksConfig) : []),
    [chantierObj, tasksConfig],
  );
  const currentUnit = useMemo(
    () => units.find((u) => u.unite === batiment) || null,
    [units, batiment],
  );

  const dayOptions = weekCols.map((c, idx) => ({ value: String(idx), label: `${c.dayLabel} ${c.dateLabel}` }));
  const chantierOptions = [
    { value: "", label: "— Disponible (aucun chantier) —" },
    ...(allChantiers || []).map((c) => ({ value: c.num, label: `${c.num}${c.nom ? " · " + c.nom : ""}` })),
  ];
  const batimentOptions = [
    { value: "", label: "— Aucun —" },
    ...units.map((u) => ({ value: u.unite, label: u.label })),
  ];
  const posteOptions = [
    { value: "", label: "— Aucun poste précis —" },
    ...(currentUnit?.postesFlat || []).map((p) => ({ value: p.key, label: p.label })),
  ];

  const onChantierChange = (v) => { setChantierId(v); setBatiment(""); setPoste(""); };
  const onBatimentChange = (v) => { setBatiment(v); setPoste(""); };

  // Liste des slots de la plage (bornes incluses, swap si Au < Du).
  const rangeSlots = useMemo(() => {
    const a = slotIndex(Number(fromDay), fromPer);
    const b = slotIndex(Number(toDay), toPer);
    return expandRange(a, b);
  }, [fromDay, fromPer, toDay, toPer]);

  const slotMeta = (slot) => {
    const { dayIdx, periode } = slotToCell(slot);
    return { dayIdx, periode, dateIso: weekCols[dayIdx].iso };
  };

  // Y a-t-il déjà une affectation sur la plage ? (active « Libérer »)
  const hasAssignmentInRange = useMemo(() => {
    return rangeSlots.some((s) => {
      const { dateIso, periode } = slotMeta(s);
      return !!getExisting(dateIso, periode)?.chantierId;
    });
  }, [rangeSlots]); // eslint-disable-line react-hooks/exhaustive-deps

  const payloadFor = (slot, assigned) => {
    const { dayIdx, periode, dateIso } = slotMeta(slot);
    const existing = getExisting(dateIso, periode);
    return {
      ressourceId: ressource.id,
      ressourceNom: ressource.nom,
      ressourceType: ressource.type,
      date: dateIso, periode,
      chantierId: assigned ? (chantierId || null) : null,
      batiment: assigned && chantierId ? (batiment || null) : null,
      posteAvancementKey: assigned && chantierId ? (poste || null) : null,
      tempsEstimeH: assigned && chantierId
        ? (temps !== "" && temps != null ? Number(temps) : demiJourneeHeures(dayIdx))
        : null,
      tacheId: null,                                                  // lien tâche ponctuelle = L7
      etatValidationMonteur: existing?.etatValidationMonteur || "NON", // workflow = L9
      smsEnvoye: existing?.smsEnvoye ?? false,                        // cron SMS = lot dédié
      creePar: existing?.creePar || user._id,
      modifiePar: user._id,
      updatedAt: serverTimestamp(),
    };
  };

  const write = async (assigned) => {
    if (!canWrite || saving) return;

    // Collision : demi-journées déjà affectées à un AUTRE chantier (uniquement
    // lors d'une affectation, pas d'une libération).
    if (assigned) {
      const conflicts = rangeSlots.filter((s) => {
        const { dateIso, periode } = slotMeta(s);
        const ex = getExisting(dateIso, periode);
        return ex?.chantierId && ex.chantierId !== chantierId;
      });
      if (conflicts.length > 0) {
        const ok = window.confirm(
          `${conflicts.length} demi-journée(s) de la plage sont déjà affectées à un autre chantier. ` +
          `Les écraser ?`,
        );
        if (!ok) return;   // abandon total, aucune écriture
      }
    }

    setSaving(true); setErr(null);
    try {
      await Promise.all(rangeSlots.map((s) => {
        const { dateIso, periode } = slotMeta(s);
        return setDoc(
          doc(db, "planningCreneaux", creneauId(ressource.id, dateIso, periode)),
          payloadFor(s, assigned),
          { merge: true },
        );
      }));
      onClose();
    } catch (e) {
      console.error("[AffectationModal] écriture plage échouée :", e);
      setErr(e);
      setSaving(false);
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
            {ressource.nom}
          </div>
          <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, marginTop: 2 }}>
            {rangeSlots.length} demi-journée{rangeSlots.length > 1 ? "s" : ""}
            {fixedChantier && ` · Chantier ${fixedChantier.num}`}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: space.md }}>
          {/* Plage Du → Au */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space.sm }}>
            <Field as="select" label="Du (jour)" value={fromDay} options={dayOptions}
              disabled={!canWrite} onChange={(e) => setFromDay(e.target.value)} />
            <Field as="select" label="Du" value={fromPer} options={PERIODE_OPTIONS}
              disabled={!canWrite} onChange={(e) => setFromPer(e.target.value)} />
            <Field as="select" label="Au (jour)" value={toDay} options={dayOptions}
              disabled={!canWrite} onChange={(e) => setToDay(e.target.value)} />
            <Field as="select" label="Au" value={toPer} options={PERIODE_OPTIONS}
              disabled={!canWrite} onChange={(e) => setToPer(e.target.value)} />
          </div>

          {!fixedChantier && (
            <Field as="select" label="Chantier" value={chantierId} options={chantierOptions}
              disabled={!canWrite} onChange={(e) => onChantierChange(e.target.value)} />
          )}
          {chantierId && (
            <>
              <Field as="select" label="Bâtiment / unité" value={batiment} options={batimentOptions}
                disabled={!canWrite} onChange={(e) => onBatimentChange(e.target.value)} />
              <Field as="select" label="Poste (optionnel)" value={poste} options={posteOptions}
                disabled={!canWrite || !batiment}
                hint={!batiment ? "Choisissez d'abord un bâtiment." : undefined}
                onChange={(e) => setPoste(e.target.value)} />
              <Field type="number" label="Temps estimé / demi-journée (h)" value={temps}
                disabled={!canWrite} placeholder="défaut : 4 h (3,5 h le vendredi)"
                hint="Laisser vide = durée de la demi-journée pour chaque créneau."
                onChange={(e) => setTemps(e.target.value)} />
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
          {canWrite && hasAssignmentInRange && (
            <Button variant="secondary" onClick={() => write(false)} disabled={saving}>
              Libérer sur la plage
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

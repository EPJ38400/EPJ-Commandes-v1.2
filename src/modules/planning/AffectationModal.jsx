// ═══════════════════════════════════════════════════════════════
//  AffectationModal — surface d'écriture du Planning V3
//
//  Modèle bidirectionnel : un créneau peut être AFFECTÉ (ressourceId non nul,
//  doc id déterministe {ressourceId}_{date}_{periode}) ou « À AFFECTER »
//  (pool, ressourceId null, doc AUTO-ID → plusieurs tâches/slot possibles).
//
//  Le sélecteur « Ressource » pilote les 4 opérations :
//   1. Créer tâche non affectée  : ressource = « À affecter » → addDoc pool.
//   2. Affecter (tâche→ressource) : pool → setDoc(creneauId) + deleteDoc(pool).
//   3. Libérer (affecté→pool)     : bouton « Libérer » → deleteDoc(creneauId)
//      + addDoc(pool). LA TÂCHE RESTE (elle ne disparaît pas).
//   4. Supprimer la tâche         : bouton explicite → deleteDoc (pool/affecté).
//  Anti-collision : affecter sur un slot déjà pris par un AUTRE chantier →
//  window.confirm (jamais d'écrasement silencieux).
//
//  ÉCRIT UNIQUEMENT dans planningCreneaux. Lecture seule si pas de droit.
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { doc, collection, writeBatch, serverTimestamp } from "firebase/firestore";
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
  user, initialRessource, resources, weekCols, fromSlot, toSlot, prefill, poolTask,
  getExisting, canWrite, fixedChantier, allChantiers, tasksConfig, onClose,
}) {
  const isPwa = useViewport() === "mobile";

  const initFrom = slotToCell(fromSlot);
  const initTo = slotToCell(toSlot);
  const [ressourceId, setRessourceId] = useState(initialRessource?.id || "");
  const [fromDay, setFromDay] = useState(String(initFrom.dayIdx));
  const [fromPer, setFromPer] = useState(initFrom.periode);
  const [toDay, setToDay] = useState(String(initTo.dayIdx));
  const [toPer, setToPer] = useState(initTo.periode);

  const [chantierId, setChantierId] = useState(
    prefill?.chantierId || poolTask?.chantierId || (fixedChantier?.num || ""),
  );
  const [batiment, setBatiment] = useState(prefill?.batiment || poolTask?.batiment || "");
  const [poste, setPoste] = useState(prefill?.posteAvancementKey || poolTask?.posteAvancementKey || "");
  const [temps, setTemps] = useState(poolTask?.tempsEstimeH != null ? String(poolTask.tempsEstimeH) : "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  // Contexte : édite-t-on une tâche déjà affectée / déjà au pool ?
  const editingAffected = !!initialRessource && !!prefill;
  const editingPool = !!poolTask;

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
  const ressourceOptions = [
    { value: "", label: "— À affecter (aucune ressource) —" },
    ...(resources || []).map((r) => ({ value: r.id, label: r.type === "ARTISAN" ? `${r.nom} (art.)` : r.nom })),
  ];
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

  // Ressource cible courante (null = pool « à affecter »).
  const targetRes = useMemo(
    () => (resources || []).find((r) => r.id === ressourceId) || null,
    [resources, ressourceId],
  );

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

  // ─── Payloads ──────────────────────────────────────────────────
  const payloadAffected = (res, slot) => {
    const { dayIdx, periode, dateIso } = slotMeta(slot);
    const existing = getExisting(res.id, dateIso, periode);
    return {
      ressourceId: res.id, ressourceNom: res.nom, ressourceType: res.type,
      date: dateIso, periode,
      chantierId: chantierId || null,
      batiment: chantierId ? (batiment || null) : null,
      posteAvancementKey: chantierId ? (poste || null) : null,
      tempsEstimeH: chantierId
        ? (temps !== "" && temps != null ? Number(temps) : demiJourneeHeures(dayIdx))
        : null,
      tacheId: null,
      etatValidationMonteur: existing?.etatValidationMonteur || "NON",
      smsEnvoye: existing?.smsEnvoye ?? false,
      creePar: existing?.creePar || user._id,
      modifiePar: user._id,
      updatedAt: serverTimestamp(),
    };
  };

  const payloadPool = (slot) => {
    const { periode, dateIso } = slotMeta(slot);
    return {
      ressourceId: null,
      date: dateIso, periode,
      chantierId: chantierId || null,
      batiment: chantierId ? (batiment || null) : null,
      posteAvancementKey: chantierId ? (poste || null) : null,
      tempsEstimeH: temps !== "" && temps != null ? Number(temps) : null,
      tacheId: null,
      creePar: poolTask?.creePar || user._id,
      modifiePar: user._id,
      createdAt: poolTask?.createdAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
  };

  // ─── Enregistrer (affecter OU pool, selon la ressource cible) ───
  // forceTarget === null → force le pool (bouton « Libérer »).
  const runSave = async (forceTarget) => {
    if (!canWrite || saving) return;
    const target = forceTarget !== undefined ? forceTarget : targetRes;

    // ── AFFECTER (target défini) ──
    if (target) {
      const conflicts = rangeSlots.filter((s) => {
        const { dateIso, periode } = slotMeta(s);
        const ex = getExisting(target.id, dateIso, periode);
        return ex?.chantierId && ex.chantierId !== chantierId;
      });
      if (conflicts.length > 0) {
        const ok = window.confirm(
          `${conflicts.length} demi-journée(s) sont déjà affectées à un autre chantier pour ${target.nom}. Les écraser ?`,
        );
        if (!ok) return;
      }
      setSaving(true); setErr(null);
      try {
        // writeBatch = atomique : pas d'orphelin si la suppression du pool
        // (ou de l'ancienne ressource) échoue après l'écriture de l'affecté.
        const batch = writeBatch(db);
        rangeSlots.forEach((s) => {
          const { dateIso, periode } = slotMeta(s);
          batch.set(doc(db, "planningCreneaux", creneauId(target.id, dateIso, periode)), payloadAffected(target, s), { merge: true });
        });
        // Source pool → on retire la tâche du pool (elle devient affectée).
        if (poolTask) batch.delete(doc(db, "planningCreneaux", poolTask.id));
        // Réaffectation : on libère les créneaux de l'ancienne ressource.
        if (initialRessource && initialRessource.id !== target.id) {
          rangeSlots.forEach((s) => {
            const { dateIso, periode } = slotMeta(s);
            batch.delete(doc(db, "planningCreneaux", creneauId(initialRessource.id, dateIso, periode)));
          });
        }
        await batch.commit();
        onClose();
      } catch (e) {
        console.error("[AffectationModal] affectation échouée :", e);
        setErr(e); setSaving(false);
      }
      return;
    }

    // ── POOL (target null) : créer/éditer la tâche à affecter ──
    // Si la source était affectée → on libère (delete) puis on dépose au pool.
    setSaving(true); setErr(null);
    try {
      const batch = writeBatch(db);
      rangeSlots.forEach((s) => {
        const { dateIso, periode } = slotMeta(s);
        if (poolTask && poolTask.date === dateIso && poolTask.periode === periode) {
          batch.set(doc(db, "planningCreneaux", poolTask.id), payloadPool(s), { merge: true });
        } else {
          batch.set(doc(collection(db, "planningCreneaux")), payloadPool(s)); // auto-id
        }
        if (initialRessource) {
          batch.delete(doc(db, "planningCreneaux", creneauId(initialRessource.id, dateIso, periode)));
        }
      });
      await batch.commit();
      onClose();
    } catch (e) {
      console.error("[AffectationModal] dépôt au pool échoué :", e);
      setErr(e); setSaving(false);
    }
  };

  // ─── Supprimer définitivement la tâche (pool OU affecté) ───
  const supprimer = async () => {
    if (!canWrite || saving) return;
    if (!window.confirm("Supprimer définitivement cette tâche ? Elle ne sera plus ni affectée, ni à affecter.")) return;
    setSaving(true); setErr(null);
    try {
      const batch = writeBatch(db);
      if (poolTask) batch.delete(doc(db, "planningCreneaux", poolTask.id));
      if (initialRessource) {
        rangeSlots.forEach((s) => {
          const { dateIso, periode } = slotMeta(s);
          batch.delete(doc(db, "planningCreneaux", creneauId(initialRessource.id, dateIso, periode)));
        });
      }
      await batch.commit();
      onClose();
    } catch (e) {
      console.error("[AffectationModal] suppression échouée :", e);
      setErr(e); setSaving(false);
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
            {targetRes ? targetRes.nom : "Tâche à affecter"}
          </div>
          <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, marginTop: 2 }}>
            {rangeSlots.length} demi-journée{rangeSlots.length > 1 ? "s" : ""}
            {fixedChantier && ` · Chantier ${fixedChantier.num}`}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: space.md }}>
          {/* Ressource : « À affecter » ou une personne (pilote affecter/libérer) */}
          <Field as="select" label="Ressource" value={ressourceId} options={ressourceOptions}
            disabled={!canWrite} onChange={(e) => setRessourceId(e.target.value)} />

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
          {canWrite && (editingPool || editingAffected) && (
            <Button variant="ghost" onClick={supprimer} disabled={saving}>
              Supprimer
            </Button>
          )}
          {canWrite && editingAffected && (
            <Button variant="secondary" onClick={() => runSave(null)} disabled={saving}>
              Libérer
            </Button>
          )}
          {canWrite && (
            <Button variant="primary" onClick={() => runSave()} loading={saving}>
              {targetRes ? "Affecter" : "Enregistrer"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

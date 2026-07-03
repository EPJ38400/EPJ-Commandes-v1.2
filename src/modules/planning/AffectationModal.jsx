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
import {
  doc, collection, writeBatch, getDoc, getDocs, addDoc, updateDoc, query, where, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useViewport } from "../../core/useViewport";
import { useToast } from "../../core/components/Toast";
import { normalizePhone } from "../../core/smsService";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import {
  creneauId, getPosteOptions, PERIODES, PERIODE_LABEL,
  slotIndex, slotToCell, expandRange, posteLabel,
} from "./planningModel";
import { affectedCreneauPayload, poolCreneauPayload } from "./planningWrites";
import { prettifyPoste, buildPlanningMessage } from "./planningSmsBody";
import { creneauToICS, triggerAddToCalendar } from "./icsExport";
import { GroupedPosteSelect } from "./GroupedPosteSelect";

const PERIODE_OPTIONS = PERIODES.map((p) => ({ value: p, label: PERIODE_LABEL[p] || p }));

export function AffectationModal({
  user, initialRessource, resources, weekCols, fromSlot, toSlot, prefill, poolTask,
  getExisting, canWrite, fixedChantier, allChantiers, tasksConfig, users, onClose,
}) {
  const isPwa = useViewport() === "mobile";
  const toast = useToast();

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
  const [tacheLibre, setTacheLibre] = useState(
    (!prefill?.posteAvancementKey && prefill?.posteLabel) ? prefill.posteLabel
    : (!poolTask?.posteAvancementKey && poolTask?.posteLabel) ? poolTask.posteLabel : ""
  );
  const [temps, setTemps] = useState(poolTask?.tempsEstimeH != null ? String(poolTask.tempsEstimeH) : "");
  const [saving, setSaving] = useState(false);
  const [smsBusy, setSmsBusy] = useState(false);
  const [doneBusy, setDoneBusy] = useState(false);
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

  // ─── Payloads (builders partagés planningWrites — zéro duplication) ──
  const payloadAffected = (res, slot) => {
    const { dayIdx, periode, dateIso } = slotMeta(slot);
    const lbl = poste
      ? posteLabel(chantierObj, batiment, poste, tasksConfig)
      : (tacheLibre.trim() || null);
    return affectedCreneauPayload({
      res, date: dateIso, periode, dayIdx,
      chantierId, batiment, poste, posteLabel: lbl, tempsEstimeH: temps,
      existing: getExisting(res.id, dateIso, periode), userId: user._id,
    });
  };

  const payloadPool = (slot) => {
    const { periode, dateIso } = slotMeta(slot);
    const lbl = poste
      ? posteLabel(chantierObj, batiment, poste, tasksConfig)
      : (tacheLibre.trim() || null);
    return poolCreneauPayload({
      date: dateIso, periode, chantierId, batiment, poste, posteLabel: lbl,
      tempsEstimeH: temps, source: poolTask, userId: user._id,
    });
  };

  // ─── Enregistrer (affecter OU pool, selon la ressource cible) ───
  // forceTarget === null → force le pool (bouton « Libérer »).
  const runSave = async (forceTarget) => {
    if (!canWrite || saving) return;
    const target = forceTarget !== undefined ? forceTarget : targetRes;

    // ── AFFECTER (target défini) ──
    if (target) {
      setSaving(true); setErr(null);
      try {
        // Anti-collision AUTORITATIVE : 1 getDoc par id déterministe (pas
        // d'index). Le cache (getExisting) est aveugle aux AUTRES chantiers
        // en vue filtrée → on lit la source. Collision inter-chantiers →
        // window.confirm « déplacer ici ? » ; refus = on n'écrit PAS ce slot.
        // Collision MÊME chantier = écrasement silencieux (comportement actuel).
        // writeBatch = atomique : pas d'orphelin si une suppression échoue.
        const batch = writeBatch(db);
        let wrote = 0;
        for (const s of rangeSlots) {
          const { dateIso, periode } = slotMeta(s);
          const ref = doc(db, "planningCreneaux", creneauId(target.id, dateIso, periode));
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const ex = snap.data();
            if (ex.chantierId && ex.chantierId !== chantierId) {
              const autre = (allChantiers || []).find((c) => c.num === ex.chantierId)?.nom || ex.chantierId;
              const ok = window.confirm(
                `${target.nom} est déjà affecté au chantier ${autre} ce créneau (${dateIso} ${periode}). Le déplacer ici ?`,
              );
              if (!ok) continue; // ne pas écrire ce slot
            }
          }
          batch.set(ref, payloadAffected(target, s), { merge: true });
          wrote++;
          // Réaffectation : libérer le créneau de l'ancienne ressource (ce slot).
          if (initialRessource && initialRessource.id !== target.id) {
            batch.delete(doc(db, "planningCreneaux", creneauId(initialRessource.id, dateIso, periode)));
          }
        }
        if (wrote === 0) { setSaving(false); onClose(); return; }
        // Source pool → on retire la tâche du pool (elle devient affectée).
        if (poolTask) batch.delete(doc(db, "planningCreneaux", poolTask.id));
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

  // ─── Export .ics « Ajouter à mon agenda » (PUR CLIENT, lecture seule) ───
  // Visible sur une seule demi-journée (fromSlot === toSlot) avec un chantier.
  // NON gaté par canWrite : un monteur doit pouvoir exporter son créneau.
  const canExportIcs = !!chantierId && fromSlot === toSlot;
  const addToAgenda = () => {
    const { dateIso, periode } = slotMeta(fromSlot);
    const c = (allChantiers || []).find((x) => x.num === chantierId) || null;
    const label = poste
      ? posteLabel(chantierObj, batiment, poste, tasksConfig)
      : (tacheLibre.trim() || null);
    const resNom = (targetRes || initialRessource)?.nom || "";
    const ics = creneauToICS({
      chantierNom: c?.nom || chantierId, chantierAdresse: c?.adresse || "",
      posteLabel: label, batiment, ressourceNom: resNom, dateIso, periode,
    });
    triggerAddToCalendar(ics, `EPJ_${dateIso}_${periode}.ics`);
  };

  // ─── SMS planning du jour (envoi MANUEL, action du planificateur) ───
  // Visible une seule demi-journée (fromSlot === toSlot) + ressource ciblée +
  // droit d'écriture. NON gaté par planningSmsEnabled (geste explicite). Enfile
  // dans smsQueue (consommé par onSmsQueueCreate) le récap des créneaux de CE
  // monteur CE jour. Préfixe « MODIF - » si un récap auto a déjà été envoyé.
  const canSendSms = canWrite && fromSlot === toSlot && !!(targetRes || initialRessource);
  const sendPlanningSms = async () => {
    if (!canSendSms || smsBusy) return;
    const res = targetRes || initialRessource;
    const { dateIso } = slotMeta(fromSlot);
    const u = (users || []).find((x) => (x._id || x.id) === res.id);
    const phone = normalizePhone(u?.telephone || u?.tel || "");
    if (!phone) { toast("Pas de numéro pour " + res.nom); return; }
    setSmsBusy(true);
    try {
      // Tous les créneaux affectés de ce monteur ce jour (index (ressourceId,date)).
      const qs = await getDocs(query(
        collection(db, "planningCreneaux"),
        where("ressourceId", "==", res.id), where("date", "==", dateIso),
      ));
      const slots = qs.docs.map((d) => d.data());
      const lignes = ["AM", "PM"].map((p) => {
        const c = slots.find((s) => s.periode === p);
        if (!c || !c.chantierId) return null;
        const nom = (allChantiers || []).find((x) => x.num === c.chantierId)?.nom || c.chantierId || "";
        const poste = c.posteLabel || prettifyPoste(c.posteAvancementKey);
        return `- ${p === "AM" ? "Matin" : "Aprem"} : ${nom}${poste ? ` (${poste})` : ""}`;
      }).filter(Boolean);
      if (lignes.length === 0) { toast("Aucun créneau ce jour"); setSmsBusy(false); return; }

      // Modif si un récap auto a déjà été enfilé pour (res, jour).
      const recapSnap = await getDoc(doc(db, "smsQueue", `planning_${res.id}_${dateIso}_recap`));
      const isModif = recapSnap.exists();
      if (!window.confirm(`${isModif ? "Prévenir du changement" : "Envoyer le planning"} à ${res.nom} par SMS ?`)) {
        setSmsBusy(false); return;
      }
      const dateLabel = `${dateIso.slice(8, 10)}/${dateIso.slice(5, 7)}`;
      const message = buildPlanningMessage({
        prenom: u?.prenom || "", dateLabel, lignes, prefix: isModif ? "MODIF - " : "",
      });
      await addDoc(collection(db, "smsQueue"), {
        type: "PLANNING_MANUEL", recipientUserId: res.id,
        recipientName: `${u?.prenom || ""} ${u?.nom || ""}`.trim(), recipientPhone: phone,
        templateCode: "planning_jour", message,
        variables: { prenom: u?.prenom || "", date: dateLabel },
        context: { module: "planning", date: dateIso, kind: "manuel" },
        status: "pending", createdAt: serverTimestamp(),
      });
      toast("SMS enfilé pour " + res.nom);
      setSmsBusy(false);
    } catch (e) {
      console.error("[AffectationModal] envoi SMS planning échoué :", e);
      toast("Échec de l'envoi du SMS");
      setSmsBusy(false);
    }
  };

  // ─── « ✅ Tâche faite » (L9) — confirmation MONTEUR de SON créneau ───
  // Visible sur une seule demi-journée, si le créneau est une tâche concrète
  // (chantier + bâtiment + poste), que l'utilisateur courant EST la ressource,
  // et qu'il ne l'a pas déjà marquée. Écrit EXACTEMENT 3 champs (règle Monteur).
  const slotInfo = slotMeta(fromSlot);
  const myCreneau = (fromSlot === toSlot && initialRessource)
    ? getExisting(initialRessource.id, slotInfo.dateIso, slotInfo.periode)
    : null;
  const isMyCreneau = !!initialRessource
    && [user?._id, user?.id].filter(Boolean).includes(initialRessource.id);
  const isTacheConcrete = !!(myCreneau?.chantierId && myCreneau?.batiment && myCreneau?.posteAvancementKey);
  const valMonteur = myCreneau?.etatValidationMonteur;
  const valConducteur = myCreneau?.etatValidationConducteur;
  const canMarkDone = isMyCreneau && isTacheConcrete && valMonteur !== "FAIT";

  const marquerFaite = async () => {
    if (doneBusy || !canMarkDone) return;
    setDoneBusy(true);
    try {
      await updateDoc(
        doc(db, "planningCreneaux", creneauId(initialRessource.id, slotInfo.dateIso, slotInfo.periode)),
        {
          etatValidationMonteur: "FAIT",
          etatValidationMonteurAt: serverTimestamp(),
          etatValidationMonteurPar: user._id || user.id,
        },
      );
      toast("✓ Tâche marquée faite");
      onClose();
    } catch (e) {
      console.error("[AffectationModal] « tâche faite » échoué :", e);
      toast("Action impossible");
      setDoneBusy(false);
    }
  };

  // Badge d'état de validation (affiché sur SON créneau concret).
  const validationStatus = (isMyCreneau && isTacheConcrete)
    ? (valConducteur === "VALIDE" ? { text: "✓ Validé par le conducteur", color: EPJ.green }
      : valConducteur === "REFUSE" ? { text: "↩ Refusé — à reprendre", color: EPJ.redText }
      : valMonteur === "FAIT" ? { text: "✅ Fait, en attente conducteur", color: EPJ.gray600 }
      : null)
    : null;

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
          {validationStatus && (
            <div style={{
              marginTop: space.xs, fontSize: fontSize.xs, fontWeight: fontWeight.medium,
              color: validationStatus.color,
            }}>
              {validationStatus.text}
            </div>
          )}
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
              <GroupedPosteSelect label="Poste (optionnel)" value={poste}
                categories={currentUnit?.categories || []}
                disabled={!canWrite || !batiment}
                hint={!batiment ? "Choisissez d'abord un bâtiment." : undefined}
                onChange={(e) => setPoste(e.target.value)} />
              <Field type="number" label="Temps estimé / demi-journée (h)" value={temps}
                disabled={!canWrite} placeholder="défaut : 4 h (3,5 h le vendredi)"
                hint="Laisser vide = durée de la demi-journée pour chaque créneau."
                onChange={(e) => setTemps(e.target.value)} />
            </>
          )}

          <Field label="Tâche libre (hors avancement)" value={tacheLibre}
            disabled={!canWrite}
            onChange={(e) => setTacheLibre(e.target.value)}
            hint="Sans poste : va au planning avec son temps, hors avancement. Chantier facultatif." />
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
          {canExportIcs && (
            <Button variant="secondary" onClick={addToAgenda}>
              📅 Ajouter à mon agenda
            </Button>
          )}
          {canSendSms && (
            <Button variant="secondary" onClick={sendPlanningSms} loading={smsBusy}>
              📲 Envoyer le planning (SMS)
            </Button>
          )}
          {canMarkDone && (
            <Button variant="primary" onClick={marquerFaite} loading={doneBusy}>
              ✅ Tâche faite
            </Button>
          )}
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

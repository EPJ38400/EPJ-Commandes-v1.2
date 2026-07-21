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
  slotIndex, slotToCell, expandRange, posteLabel, getCreneauTaches,
  makeTacheId, demiJourneeHeures, tacheValMonteur, tacheValConducteur,
  weekColumns, weekLabel, addDays, fromISO, toISODate,
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

  // ─── Navigation semaine DANS le modal (report sur une autre semaine) ───
  // `weekCols` (prop) = semaine SOURCE (celle de la grille) ; ne sert plus qu'à
  // initialiser `weekStart`. `cols` (locales) = semaine AFFICHÉE dans le modal,
  // pilote tous les usages internes (dayOptions, slotMeta → dateIso cible).
  const [weekStart, setWeekStart] = useState(() => fromISO(weekCols[0].iso));
  const cols = useMemo(() => weekColumns(weekStart), [weekStart]);
  const isSourceWeek = toISODate(weekStart) === weekCols[0].iso;

  // Coordonnées SOURCE FIGÉES au montage, INDÉPENDANTES de la navigation (clé du
  // fix doublon). `prefill` (construit dans PlanningGrid) ne porte PAS .date/.periode
  // → on gèle les coords depuis la semaine SOURCE (weekCols) × le slot d'origine
  // (initFrom, dérivé du prop fromSlot, stable). Un créneau affecté = 1 seul slot.
  // Création pure (sans prefill) → aucun slot source à libérer.
  const sourceRessourceId = initialRessource?.id || null;
  const sourceSlots = prefill
    ? [{ date: weekCols[initFrom.dayIdx].iso, periode: initFrom.periode }]
    : [];

  const [ressourceId, setRessourceId] = useState(initialRessource?.id || "");
  const [fromDay, setFromDay] = useState(String(initFrom.dayIdx));
  const [fromPer, setFromPer] = useState(initFrom.periode);
  const [toDay, setToDay] = useState(String(initTo.dayIdx));
  const [toPer, setToPer] = useState(initTo.periode);
  // Co-affectation : ressources SUPPLÉMENTAIRES (ids) recevant les MÊMES tâches.
  const [autresRessources, setAutresRessources] = useState([]);

  // ─── Lignes de tâches (L3 multi-tâches) ───
  // Une ligne de formulaire = { id, chantierId, batiment, poste, tacheLibre, temps }.
  // Init : depuis les tâches du créneau édité (getCreneauTaches, compat legacy /
  // pool), sinon 1 ligne vide (chantier pré-rempli si fixedChantier).
  const emptyLine = () => ({
    id: makeTacheId(), chantierId: fixedChantier?.num || "", batiment: "", poste: "", tacheLibre: "", temps: "",
  });
  const [taches, setTaches] = useState(() => {
    const src = poolTask || prefill;
    const existing = src ? getCreneauTaches(src) : [];
    if (existing.length) {
      return existing.map((t) => ({
        id: t.id || makeTacheId(),
        chantierId: t.chantierId || (fixedChantier?.num || ""),
        batiment: t.batiment || "",
        poste: t.posteAvancementKey || "",
        tacheLibre: (!t.posteAvancementKey && t.posteLabel) ? t.posteLabel : "",
        temps: t.tempsEstimeH != null ? String(t.tempsEstimeH) : "",
      }));
    }
    return [emptyLine()];
  });
  const [saving, setSaving] = useState(false);
  const [smsBusy, setSmsBusy] = useState(false);
  const [doneBusy, setDoneBusy] = useState(false);
  const [err, setErr] = useState(null);

  // Contexte : édite-t-on une tâche déjà affectée / déjà au pool ?
  const editingAffected = !!initialRessource && !!prefill;
  const editingPool = !!poolTask;

  // Objet chantier d'une ligne (fixedChantier prioritaire).
  const chantierObjOf = (line) => {
    if (fixedChantier) return fixedChantier;
    return (allChantiers || []).find((c) => c.num === line.chantierId) || null;
  };
  // Tâche primaire = 1re avec chantier, sinon 1re ligne (miroir/compat).
  const primaryLine = taches.find((l) => l.chantierId) || taches[0] || null;

  const dayOptions = cols.map((c, idx) => ({ value: String(idx), label: `${c.dayLabel} ${c.dateLabel}` }));
  const ressourceOptions = [
    { value: "", label: "— À affecter (aucune ressource) —" },
    ...(resources || []).map((r) => ({ value: r.id, label: r.type === "ARTISAN" ? `${r.nom} (art.)` : r.nom })),
  ];
  const chantierOptions = [
    { value: "", label: "— Disponible (aucun chantier) —" },
    ...(allChantiers || []).map((c) => ({ value: c.num, label: `${c.num}${c.nom ? " · " + c.nom : ""}` })),
  ];

  // ─── Mutations de lignes ───
  const updateLine = (id, patch) => setTaches((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const onLineChantier = (id, v) => updateLine(id, { chantierId: v, batiment: "", poste: "" });
  const onLineBatiment = (id, v) => updateLine(id, { batiment: v, poste: "" });
  const addLine = () => setTaches((ls) => [...ls, emptyLine()]);
  const removeLine = (id) => setTaches((ls) => (ls.length > 1 ? ls.filter((l) => l.id !== id) : ls));

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
    return { dayIdx, periode, dateIso: cols[dayIdx].iso };
  };

  // Lignes de formulaire → tableau `taches` pour les builders (posteLabel calculé
  // comme aujourd'hui : poste → libellé taxonomie, sinon texte libre).
  const linesToTaches = () => taches.map((l) => {
    const lbl = l.poste
      ? posteLabel(chantierObjOf(l), l.batiment, l.poste, tasksConfig)
      : (l.tacheLibre.trim() || null);
    return {
      id: l.id,
      chantierId: l.chantierId || null,
      batiment: l.batiment || null,
      posteAvancementKey: l.poste || null,
      posteLabel: lbl,
      tempsEstimeH: l.temps,
    };
  });

  // ─── Contrôle capacité : somme des temps ≤ demi-journée ───
  // Un temps vide vaut la capacité de la demi-journée (tâche « pleine »).
  const capacite = rangeSlots.length
    ? Math.min(...rangeSlots.map((s) => demiJourneeHeures(slotToCell(s).dayIdx, slotToCell(s).periode)))
    : demiJourneeHeures(0);
  const sommeTemps = taches.reduce((s, l) => {
    const rempli = !!(l.chantierId || l.poste || l.tacheLibre.trim());
    if (!rempli) return s;
    const v = (l.temps !== "" && l.temps != null) ? Number(l.temps) : capacite;
    return s + (Number.isFinite(v) ? v : 0);
  }, 0);
  const overCapacity = sommeTemps > capacite + 1e-9;

  // ─── Payloads (builders partagés planningWrites — zéro duplication) ──
  // `existing` = doc CIBLE autoritatif (snap.data() du getDoc), passé explicitement.
  // Sur une semaine non chargée, getExisting (cache grille) renverrait undefined et
  // n'est pas fiable → l'appelant lit toujours la cible via getDoc. Vierge → validations
  // aux valeurs par défaut (report = travail à refaire) ; rempli → validations préservées.
  const payloadAffected = (res, slot, existing) => {
    const { dayIdx, periode, dateIso } = slotMeta(slot);
    return affectedCreneauPayload({
      res, date: dateIso, periode, dayIdx, taches: linesToTaches(),
      existing, userId: user._id,
    });
  };

  const payloadPool = (slot) => {
    const { dayIdx, periode, dateIso } = slotMeta(slot);
    return poolCreneauPayload({
      date: dateIso, periode, dayIdx, taches: linesToTaches(),
      source: poolTask, userId: user._id,
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
          const ex = snap.exists() ? snap.data() : undefined;
          if (ex && ex.chantierId && ex.chantierId !== (primaryLine?.chantierId || null)) {
            const autre = (allChantiers || []).find((c) => c.num === ex.chantierId)?.nom || ex.chantierId;
            const ok = window.confirm(
              `${target.nom} est déjà affecté au chantier ${autre} ce créneau (${dateIso} ${periode}). Le déplacer ici ?`,
            );
            if (!ok) continue; // ne pas écrire ce slot
          }
          // `existing` = doc CIBLE autoritatif (week-agnostic) → report sur semaine
          // vierge = validations réinitialisées ; cible occupée = validations préservées.
          batch.set(ref, payloadAffected(target, s, ex), { merge: true });
          wrote++;
        }
        // ── Co-affectation : MÊMES tâches sur les ressources supplémentaires ──
        // Slot par slot, ÉCRASE inconditionnellement (pas de test d'occupation,
        // pas de confirmation). Réutilise EXACTEMENT payloadAffected (mêmes
        // taches[]). Seul garde-fou : anti-double-write dans le batch — on exclut
        // la cible principale et l'ancienne ressource libérée (déjà écrites /
        // supprimées par la boucle primaire), sinon Firestore rejette 2 writes
        // du même doc.
        const handled = new Set([target.id]);
        if (sourceRessourceId && sourceRessourceId !== target.id) handled.add(sourceRessourceId);
        const extras = autresRessources.filter((id) => id && !handled.has(id));
        for (const id of extras) {
          const res = (resources || []).find((r) => r.id === id);
          if (!res) continue;
          for (const s of rangeSlots) {
            const { dateIso, periode } = slotMeta(s);
            const ref = doc(db, "planningCreneaux", creneauId(id, dateIso, periode));
            const snap = await getDoc(ref); // autoritatif (cache grille aveugle hors semaine source)
            batch.set(ref, payloadAffected(res, s, snap.exists() ? snap.data() : undefined), { merge: true });
          }
        }
        if (wrote === 0 && extras.length === 0) { setSaving(false); onClose(); return; }
        // Report = DÉPLACEMENT : libérer le(s) slot(s) SOURCE dès que la cible diffère
        // de la source sur N'IMPORTE quelle coordonnée (ressource, semaine, jour, période).
        // Coords SOURCE figées (jamais les coords cible) → pas de doublon en navigation.
        // Uniquement si le write primaire a bien eu lieu (collision refusée → source gardée).
        if (wrote > 0) {
          for (const src of sourceSlots) {
            const rid = sourceRessourceId;
            const targetHitsSource = rid === target.id && rangeSlots.some((s) => {
              const m = slotMeta(s);
              return m.dateIso === src.date && m.periode === src.periode;
            });
            if (rid && !targetHitsSource) {
              batch.delete(doc(db, "planningCreneaux", creneauId(rid, src.date, src.periode)));
            }
          }
        }
        // Source pool → on retire la tâche du pool (elle devient affectée).
        if (poolTask) batch.delete(doc(db, "planningCreneaux", poolTask.id));
        await batch.commit();
        if (!isSourceWeek) {
          toast(`Tâche reportée sur la semaine du ${weekLabel(weekStart)}`);
        } else if (extras.length) {
          const n = 1 + extras.length;
          toast(`Tâche affectée à ${n} ressource${n > 1 ? "s" : ""}`);
        }
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
      });
      // Libérer le slot AFFECTÉ source (coords figées, pas les coords cible) : un pool
      // est en auto-id, jamais l'id déterministe affecté → suppression toujours sûre.
      for (const src of sourceSlots) {
        if (sourceRessourceId) {
          batch.delete(doc(db, "planningCreneaux", creneauId(sourceRessourceId, src.date, src.periode)));
        }
      }
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
      // Supprime le(s) slot(s) SOURCE aux coords figées (pas les coords cible/navigation).
      for (const src of sourceSlots) {
        if (sourceRessourceId) {
          batch.delete(doc(db, "planningCreneaux", creneauId(sourceRessourceId, src.date, src.periode)));
        }
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
  // Basé sur la tâche primaire. NON gaté par canWrite (un monteur exporte son créneau).
  const canExportIcs = !!primaryLine?.chantierId && fromSlot === toSlot;
  const addToAgenda = () => {
    const { dateIso, periode } = slotMeta(fromSlot);
    const pid = primaryLine?.chantierId || null;
    const c = (allChantiers || []).find((x) => x.num === pid) || null;
    const label = primaryLine?.poste
      ? posteLabel(chantierObjOf(primaryLine), primaryLine.batiment, primaryLine.poste, tasksConfig)
      : (primaryLine?.tacheLibre.trim() || null);
    const resNom = (targetRes || initialRessource)?.nom || "";
    const ics = creneauToICS({
      chantierNom: c?.nom || pid, chantierAdresse: c?.adresse || "",
      posteLabel: label, batiment: primaryLine?.batiment || "", ressourceNom: resNom, dateIso, periode,
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
      const lignes = ["AM", "PM"].flatMap((p) => {
        const c = slots.find((s) => s.periode === p);
        return getCreneauTaches(c).map((t) => {
          const nom = t.chantierId ? ((allChantiers || []).find((x) => x.num === t.chantierId)?.nom || t.chantierId) : "";
          const poste = t.posteLabel || prettifyPoste(t.posteAvancementKey);
          const main = nom || poste || "";
          const extra = nom ? poste : "";
          return `- ${p === "AM" ? "Matin" : "Aprem"} : ${main}${extra ? ` (${extra})` : ""}`;
        });
      });
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
        origine: "manuel", // envoi humain → départ immédiat, hors fenêtre horaire
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

  // ─── « ✅ Tâche faite » (L9) — confirmation MONTEUR, PAR TÂCHE (lot 4) ───
  // Visible sur une seule demi-journée, sur chaque tâche concrète (poste) du
  // créneau PERSISTÉ dont l'utilisateur courant EST la ressource. Écrit
  // EXACTEMENT 2 clés (validationMonteur.<id> + aValiderConducteur) → conforme
  // à la règle Monteur élargie à la map. Compat legacy via tacheValMonteur.
  const slotInfo = slotMeta(fromSlot);
  const myCreneau = (fromSlot === toSlot && initialRessource)
    ? getExisting(initialRessource.id, slotInfo.dateIso, slotInfo.periode)
    : null;
  const isMyCreneau = !!initialRessource
    && [user?._id, user?.id].filter(Boolean).includes(initialRessource.id);
  // Ids des tâches réellement persistées (une action L9 ne cible qu'elles).
  const persistedTacheIds = useMemo(
    () => new Set(getCreneauTaches(myCreneau).map((t) => t.id)),
    [myCreneau],
  );
  // Une ligne est « validable faite » : mon créneau + tâche persistée + pas déjà
  // FAIT. Les tâches libres (sans poste) sont AUSSI validables.
  const canMarkLine = (line) =>
    isMyCreneau && !!myCreneau && persistedTacheIds.has(line.id)
    && tacheValMonteur(myCreneau, line.id) !== "FAIT";

  const marquerFaiteLine = async (line) => {
    if (doneBusy || !canMarkLine(line)) return;
    setDoneBusy(true);
    try {
      await updateDoc(
        doc(db, "planningCreneaux", creneauId(initialRessource.id, slotInfo.dateIso, slotInfo.periode)),
        {
          [`validationMonteur.${line.id}`]: { etat: "FAIT", at: serverTimestamp(), par: user._id || user.id },
          aValiderConducteur: true,
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

  // Statut de validation d'une ligne (badge par tâche).
  const lineValidationStatus = (line) => {
    if (!isMyCreneau || !myCreneau || !persistedTacheIds.has(line.id)) return null;
    const vc = tacheValConducteur(myCreneau, line.id);
    const vm = tacheValMonteur(myCreneau, line.id);
    if (vc === "VALIDE") return { text: "✓ Validé par le conducteur", color: EPJ.green };
    if (vc === "REFUSE") return { text: "↩ Refusé — à reprendre", color: EPJ.redText };
    if (vm === "FAIT") return { text: "✅ Fait, en attente conducteur", color: EPJ.gray600 };
    return null;
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
          // Safe-area PWA : respecte l'encoche (haut + bas), latéraux inchangés.
          paddingLeft: space.lg, paddingRight: space.lg,
          paddingTop: isPwa ? `max(${space.lg}px, env(safe-area-inset-top))` : space.lg,
          paddingBottom: isPwa ? `max(${space.lg}px, env(safe-area-inset-bottom))` : space.lg,
          width: "100%", maxWidth: 480,
          // Hauteur capée pour ne jamais passer sous l'encoche (PWA) ; 90vh desktop.
          maxHeight: isPwa ? `calc(100vh - env(safe-area-inset-top) - ${space.md}px)` : "90vh",
          overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,.2)",
        }}
      >
        {/* En-tête STICKY : barre nav semaine + identité monteur. Reste visible et
            atteignable quel que soit le scroll interne (nom jamais rogné). */}
        <div style={{
          position: "sticky", top: 0, zIndex: 2, background: EPJ.white,
          paddingBottom: space.sm, marginBottom: space.md,
        }}>
          {/* Navigation semaine : reporter la tâche sur une AUTRE semaine sans fermer
              le modal. Gatée canWrite (lecture seule = semaine source figée). Teintée
              EPJ.infoBg hors semaine source → signale le report (plus de bandeau séparé). */}
          {canWrite && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: space.sm, marginBottom: space.sm,
              padding: `${space.xs}px ${space.sm}px`, borderRadius: radius.md,
              background: isSourceWeek ? "transparent" : EPJ.infoBg,
              border: `1px solid ${isSourceWeek ? "transparent" : EPJ.gray200}`,
            }}>
              <Button variant="ghost" size="sm" onClick={() => setWeekStart((d) => addDays(d, -7))}>←</Button>
              <div style={{ display: "flex", alignItems: "center", gap: space.sm, minWidth: 0 }}>
                <span style={{
                  fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray700,
                  fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap",
                }}>
                  Semaine du {weekLabel(weekStart)}
                </span>
                {!isSourceWeek && (
                  <Button variant="ghost" size="sm" onClick={() => setWeekStart(fromISO(weekCols[0].iso))}>
                    Semaine source
                  </Button>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setWeekStart((d) => addDays(d, 7))}>→</Button>
            </div>
          )}
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

          {/* Co-affectation : affecter LES MÊMES tâches à d'autres ressources.
              Exclut la ressource principale et « À affecter » (pool). Chips =
              multi-select tactile. Visible dès qu'une ressource est ciblée
              (création ET réédition). */}
          {canWrite && targetRes && (
            <div style={{ display: "flex", flexDirection: "column", gap: space.xs }}>
              <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray700 }}>
                Affecter aussi à (optionnel)
              </span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: space.xs }}>
                {(resources || []).filter((r) => r.id !== ressourceId).map((r) => {
                  const on = autresRessources.includes(r.id);
                  return (
                    <Button key={r.id} variant={on ? "primary" : "secondary"} size="sm"
                      onClick={() => setAutresRessources((xs) => (on ? xs.filter((x) => x !== r.id) : [...xs, r.id]))}>
                      {r.type === "ARTISAN" ? `${r.nom} (art.)` : r.nom}
                    </Button>
                  );
                })}
              </div>
            </div>
          )}

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

          {/* Lignes de tâches (une même liste s'applique à chaque demi-journée de la plage) */}
          {taches.map((line, li) => {
            const objLine = chantierObjOf(line);
            const unitsLine = objLine ? getPosteOptions(objLine, tasksConfig) : [];
            const unitLine = unitsLine.find((u) => u.unite === line.batiment) || null;
            const batOpts = [{ value: "", label: "— Aucun —" }, ...unitsLine.map((u) => ({ value: u.unite, label: u.label }))];
            const lineStatus = lineValidationStatus(line);
            return (
              <div key={line.id} style={{
                border: `1px solid ${EPJ.gray200}`, borderRadius: radius.md, padding: space.md,
                display: "flex", flexDirection: "column", gap: space.sm, background: EPJ.gray50,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: EPJ.gray600 }}>
                    Tâche {li + 1}
                  </span>
                  {canWrite && taches.length > 1 && (
                    <Button variant="ghost" size="sm" onClick={() => removeLine(line.id)}>Retirer</Button>
                  )}
                </div>

                {!fixedChantier && (
                  <Field as="select" label="Chantier" value={line.chantierId} options={chantierOptions}
                    disabled={!canWrite} onChange={(e) => onLineChantier(line.id, e.target.value)} />
                )}
                {line.chantierId && (
                  <>
                    <Field as="select" label="Bâtiment / unité" value={line.batiment} options={batOpts}
                      disabled={!canWrite} onChange={(e) => onLineBatiment(line.id, e.target.value)} />
                    <GroupedPosteSelect label="Poste (optionnel)" value={line.poste}
                      categories={unitLine?.categories || []}
                      disabled={!canWrite || !line.batiment}
                      hint={!line.batiment ? "Choisissez d'abord un bâtiment." : undefined}
                      onChange={(e) => updateLine(line.id, { poste: e.target.value })} />
                  </>
                )}
                <Field type="number" label="Temps estimé / demi-journée (h)" value={line.temps}
                  disabled={!canWrite} placeholder="défaut : 4 h (vendredi : 4 h matin, 3 h aprem)"
                  hint="Laisser vide = durée de la demi-journée pour chaque créneau."
                  onChange={(e) => updateLine(line.id, { temps: e.target.value })} />
                <Field label="Tâche libre (hors avancement)" value={line.tacheLibre}
                  disabled={!canWrite}
                  onChange={(e) => updateLine(line.id, { tacheLibre: e.target.value })}
                  hint="Sans poste : va au planning avec son temps, hors avancement. Chantier facultatif." />

                {/* L9 — validation MONTEUR de CETTE tâche (statut + bouton « Tâche faite ») */}
                {lineStatus && (
                  <div style={{ fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: lineStatus.color }}>
                    {lineStatus.text}
                  </div>
                )}
                {canMarkLine(line) && (
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <Button variant="primary" size="sm" onClick={() => marquerFaiteLine(line)} loading={doneBusy}>
                      ✅ Tâche faite
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          {canWrite && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: space.sm, flexWrap: "wrap" }}>
              <Button variant="secondary" size="sm" onClick={addLine}>+ Ajouter une tâche</Button>
              <span style={{
                fontSize: fontSize.xs, fontWeight: fontWeight.medium,
                color: overCapacity ? EPJ.redText : EPJ.gray500, fontVariantNumeric: "tabular-nums",
              }}>
                Total {sommeTemps} h / {capacite} h par demi-journée
              </span>
            </div>
          )}
          {overCapacity && (
            <div style={{ fontSize: fontSize.sm, color: EPJ.redText }}>
              La somme des temps dépasse la capacité d'une demi-journée ({capacite} h). Réduisez les temps ou retirez une tâche.
            </div>
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
            <Button variant="primary" onClick={() => runSave()} loading={saving} disabled={overCapacity}>
              {targetRes ? "Affecter" : "Enregistrer"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  PlanningBulkCreate — création « bulk » de tâches (vue mensuelle chantier)
//
//  Remplace l'ancien openCreate mono-jour. Plage Du→Au, période
//  (Matin / Après-midi / Journée), poste(s) et bâtiment(s) MULTI-select tant
//  qu'aucune ressource n'est choisie (planifier large = tâches POOL), SINGLE
//  dès qu'une ressource est choisie (1 personne = 1 créneau, id déterministe).
//
//  Au valider : pour chaque jour OUVRÉ (Lun→Ven) de [Du,Au] × période ×
//  poste × bâtiment → 1 tâche.
//    • sans ressource → POOL (addDoc auto-id, poolCreneauPayload).
//    • avec ressource → AFFECTÉE {ressourceId}_{date}_{periode}
//      (setDoc merge, affectedCreneauPayload). Poste/bâtiment SINGLE.
//  Compte affiché + window.confirm si > 20. ÉCRIT UNIQUEMENT planningCreneaux.
//  Réutilise les builders planningWrites (zéro duplication des champs).
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { addDoc, collection, doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useViewport } from "../../core/useViewport";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import { getPosteOptions, creneauId, fromISO, addDays, toISODate, posteLabel } from "./planningModel";
import { affectedCreneauPayload, poolCreneauPayload } from "./planningWrites";
import { GroupedPosteSelect } from "./GroupedPosteSelect";

const PERIODE_MODE_OPTIONS = [
  { value: "AM", label: "Matin" },
  { value: "PM", label: "Après-midi" },
  { value: "JOURNEE", label: "Journée (matin + après-midi)" },
];
const periodesOf = (mode) => (mode === "JOURNEE" ? ["AM", "PM"] : [mode]);

// Jours ouvrés (Lun→Ven) dans [duIso, auIso] inclus.
function workingDaysBetween(duIso, auIso) {
  const out = [];
  if (!duIso || !auIso || duIso > auIso) return out;
  let d = fromISO(duIso);
  const end = fromISO(auIso);
  while (d <= end) {
    const wd = d.getDay();
    if (wd >= 1 && wd <= 5) out.push(d);
    d = addDays(d, 1);
  }
  return out;
}

export function PlanningBulkCreate({ chantier, resources, tasksConfig, initialDate, canWrite, user, onClose }) {
  const isPwa = useViewport() === "mobile";

  const [du, setDu] = useState(initialDate || "");
  const [au, setAu] = useState(initialDate || "");
  const [periodeMode, setPeriodeMode] = useState("AM");
  const [ressourceId, setRessourceId] = useState("");
  // Multi (sans ressource)
  const [selBats, setSelBats] = useState([]);     // lettres / ids d'unité
  const [selPostes, setSelPostes] = useState([]); // keys de poste
  // Single (avec ressource)
  const [batiment, setBatiment] = useState("");
  const [poste, setPoste] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  const units = useMemo(() => getPosteOptions(chantier, tasksConfig), [chantier, tasksConfig]);
  const hasRes = !!ressourceId;

  const ressourceOptions = [
    { value: "", label: "— À affecter (aucune ressource) —" },
    ...(resources || []).map((r) => ({ value: r.id, label: r.type === "ARTISAN" ? `${r.nom} (art.)` : r.nom })),
  ];

  // ── Single (ressource) : bâtiment puis poste ──
  const batimentOptions = [
    { value: "", label: "— Aucun —" },
    ...units.map((u) => ({ value: u.unite, label: u.label })),
  ];
  const currentUnit = useMemo(() => units.find((u) => u.unite === batiment) || null, [units, batiment]);

  // ── Multi (pool) : catégories FUSIONNÉES des bâtiments sélectionnés ──
  // Par catId : { catId, catLabel, color, postes:[{key,label}] }, postes dédup
  // par key, ordre des catégories = 1re apparition. Labels NON préfixés.
  const groupedPostes = useMemo(() => {
    const byCat = new Map();
    units
      .filter((u) => selBats.includes(u.unite))
      .forEach((u) => u.categories.forEach((cat) => {
        if (!byCat.has(cat.catId)) byCat.set(cat.catId, { catId: cat.catId, catLabel: cat.catLabel, color: cat.color, postes: new Map() });
        const entry = byCat.get(cat.catId);
        cat.postes.forEach((p) => { if (!entry.postes.has(p.key)) entry.postes.set(p.key, p.label); });
      }));
    return [...byCat.values()].map((c) => ({ ...c, postes: [...c.postes.entries()].map(([key, label]) => ({ key, label })) }));
  }, [units, selBats]);

  const toggle = (arr, setArr, v) =>
    setArr(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const onBatToggle = (v) => { toggle(selBats, setSelBats, v); };

  // ── Combos (bâtiment × poste) selon le mode ──
  const combos = useMemo(() => {
    if (hasRes) return [{ bat: batiment || null, poste: poste || null }];
    const batList = selBats.length ? selBats : [null];
    const out = [];
    for (const bat of batList) {
      const unit = units.find((u) => u.unite === bat) || null;
      const postesForBat = selPostes.filter((pk) => unit && unit.postesFlat.some((p) => p.key === pk));
      if (selPostes.length && postesForBat.length === 0) continue; // postes choisis mais hors de ce bât → on saute
      const posteList = postesForBat.length ? postesForBat : [null];
      for (const pk of posteList) out.push({ bat, poste: pk });
    }
    return out;
  }, [hasRes, batiment, poste, selBats, selPostes, units]);

  const workingDays = useMemo(() => workingDaysBetween(du, au), [du, au]);
  const periodes = periodesOf(periodeMode);
  const count = workingDays.length * periodes.length * combos.length;

  const onRessourceChange = (v) => {
    setRessourceId(v);
    // bascule multi ⟂ single : on repart propre pour éviter les états mixtes.
    setSelBats([]); setSelPostes([]); setBatiment(""); setPoste("");
  };

  const run = async () => {
    if (!canWrite || saving || count === 0) return;
    if (count > 20 && !window.confirm(`${count} tâches vont être créées. Confirmer ?`)) return;
    setSaving(true); setErr(null);
    try {
      const res = hasRes ? (resources || []).find((r) => r.id === ressourceId) : null;

      if (res) {
        // Pré-scan AUTORITATIF (id déterministe, pas d'index) : préserver
        // validation/SMS/créateur des créneaux existants + détecter les
        // collisions INTER-chantiers (1 confirm agrégée, cohérent avec C).
        const targets = [];
        for (const d of workingDays) {
          const dateIso = toISODate(d);
          const dayIdx = d.getDay() - 1;
          for (const periode of periodes) {
            targets.push({ dateIso, dayIdx, periode, ref: doc(db, "planningCreneaux", creneauId(res.id, dateIso, periode)) });
          }
        }
        const snaps = await Promise.all(targets.map((t) => getDoc(t.ref)));
        const collisions = [];
        snaps.forEach((snap, i) => {
          targets[i].existing = snap.exists() ? snap.data() : null;
          const ex = targets[i].existing;
          if (ex?.chantierId && ex.chantierId !== chantier.num) collisions.push(targets[i]);
        });
        let skip = new Set();
        if (collisions.length) {
          const ok = window.confirm(
            `${res.nom} est déjà affecté à un autre chantier sur ${collisions.length} créneau(x) de cette plage. Le déplacer ici ? (Annuler = ces créneaux restent inchangés.)`,
          );
          if (!ok) skip = new Set(collisions.map((t) => t.ref.path));
        }
        const writes = [];
        for (const t of targets) {
          if (skip.has(t.ref.path)) continue;
          writes.push(setDoc(
            t.ref,
            affectedCreneauPayload({
              res, date: t.dateIso, periode: t.periode, dayIdx: t.dayIdx,
              chantierId: chantier.num, batiment: batiment || null, poste: poste || null,
              posteLabel: posteLabel(chantier, batiment, poste, tasksConfig),
              tempsEstimeH: "", existing: t.existing, userId: user._id,
            }),
            { merge: true },
          ));
        }
        if (writes.length === 0) { onClose(); return; }
        await Promise.all(writes);
        onClose();
        return;
      }

      // Sans ressource → POOL (addDoc, jamais de collision)
      const writes = [];
      for (const d of workingDays) {
        const dateIso = toISODate(d);
        for (const periode of periodes) {
          for (const { bat, poste: pk } of combos) {
            writes.push(addDoc(
              collection(db, "planningCreneaux"),
              poolCreneauPayload({
                date: dateIso, periode, chantierId: chantier.num,
                batiment: bat, poste: pk, posteLabel: posteLabel(chantier, bat, pk, tasksConfig),
                tempsEstimeH: "", source: null, userId: user._id,
              }),
            ));
          }
        }
      }
      await Promise.all(writes);
      onClose();
    } catch (e) {
      console.error("[PlanningBulkCreate] création échouée :", e);
      setErr(e); setSaving(false);
    }
  };

  const chk = (checked) => ({
    display: "inline-flex", alignItems: "center", gap: space.xs, cursor: "pointer",
    padding: "4px 8px", borderRadius: radius.sm, fontSize: fontSize.sm, fontFamily: font.body,
    border: `1px solid ${checked ? EPJ.blue : EPJ.gray200}`,
    background: checked ? EPJ.infoBg : EPJ.white, color: EPJ.gray900,
  });

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
          padding: space.lg, width: "100%", maxWidth: 520, maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 20px 50px rgba(0,0,0,.2)",
        }}
      >
        <div style={{ marginBottom: space.md }}>
          <div style={{ fontFamily: font.display, fontSize: fontSize.lg, fontWeight: fontWeight.regular, color: EPJ.gray900, letterSpacing: "-0.01em" }}>
            Créer des tâches
          </div>
          <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, marginTop: 2 }}>
            Chantier {chantier.num} · jours ouvrés (Lun→Ven)
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: space.md }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space.sm }}>
            <Field type="date" label="Du" value={du} disabled={!canWrite} onChange={(e) => setDu(e.target.value)} />
            <Field type="date" label="Au" value={au} disabled={!canWrite} onChange={(e) => setAu(e.target.value)} />
          </div>

          <Field as="select" label="Période" value={periodeMode} options={PERIODE_MODE_OPTIONS}
            disabled={!canWrite} onChange={(e) => setPeriodeMode(e.target.value)} />

          <Field as="select" label="Ressource (optionnel)" value={ressourceId} options={ressourceOptions}
            disabled={!canWrite} onChange={(e) => onRessourceChange(e.target.value)}
            hint={hasRes ? "Affectée : poste & bâtiment uniques." : "Sans ressource : tâches « à affecter », multi-sélection possible."} />

          {hasRes ? (
            <>
              <Field as="select" label="Bâtiment / unité" value={batiment} options={batimentOptions}
                disabled={!canWrite} onChange={(e) => { setBatiment(e.target.value); setPoste(""); }} />
              <GroupedPosteSelect label="Poste (optionnel)" value={poste}
                categories={currentUnit?.categories || []}
                disabled={!canWrite || !batiment}
                hint={!batiment ? "Choisissez d'abord un bâtiment." : undefined}
                onChange={(e) => setPoste(e.target.value)} />
            </>
          ) : (
            <>
              <div>
                <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray700, marginBottom: space.xs, fontFamily: font.body }}>
                  Bâtiment(s)
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: space.xs }}>
                  {units.length === 0 && <span style={{ fontSize: fontSize.sm, color: EPJ.gray400 }}>Aucun bâtiment.</span>}
                  {units.map((u) => (
                    <label key={u.unite} style={chk(selBats.includes(u.unite))}>
                      <input type="checkbox" checked={selBats.includes(u.unite)} disabled={!canWrite}
                        onChange={() => onBatToggle(u.unite)} />
                      {u.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray700, marginBottom: space.xs, fontFamily: font.body }}>
                  Poste(s) (optionnel)
                </div>
                {selBats.length === 0 ? (
                  <span style={{ fontSize: fontSize.sm, color: EPJ.gray400 }}>Choisissez d'abord un ou plusieurs bâtiments.</span>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
                    {groupedPostes.map((cat) => (
                      <div key={cat.catId}>
                        <div style={{ fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: EPJ.gray500, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: space.xs }}>
                          {cat.catLabel}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: space.xs }}>
                          {cat.postes.map((p) => (
                            <label key={p.key} style={chk(selPostes.includes(p.key))}>
                              <input type="checkbox" checked={selPostes.includes(p.key)} disabled={!canWrite}
                                onChange={() => toggle(selPostes, setSelPostes, p.key)} />
                              {p.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {err && (
          <div style={{ marginTop: space.md, fontSize: fontSize.sm, color: EPJ.redText }}>
            Échec de la création. Vérifiez votre connexion et réessayez.
          </div>
        )}

        <div style={{ display: "flex", gap: space.sm, marginTop: space.lg, justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: fontSize.sm, color: count > 0 ? EPJ.gray700 : EPJ.gray400, fontFamily: font.body }}>
            {count > 0 ? `${count} tâche${count > 1 ? "s" : ""} à créer` : "Aucune tâche (vérifiez la plage)"}
          </div>
          <div style={{ display: "flex", gap: space.sm }}>
            <Button variant="ghost" onClick={onClose}>{canWrite ? "Annuler" : "Fermer"}</Button>
            {canWrite && (
              <Button variant="primary" onClick={run} loading={saving} disabled={count === 0}>
                Créer
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

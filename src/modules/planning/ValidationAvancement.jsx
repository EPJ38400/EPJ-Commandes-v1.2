// ═══════════════════════════════════════════════════════════════
//  ValidationAvancement (L9) — file de validation conducteur / chef
//
//  Liste les créneaux planningCreneaux marqués « FAIT » par le monteur et
//  PAS encore validés par le conducteur, filtrés sur SES chantiers (scope
//  own_chantiers ; Direction/Admin = all). Par ligne : chantier / bât / tâche
//  + % d'avancement ACTUEL. Actions :
//   • Valider → écrit l'avancement (chantiers.avancementProgress[unité][tâche],
//     merge:true, deep-merge ADDITIF, no-regression) + etatValidationConducteur=VALIDE.
//   • Refuser → etatValidationConducteur=REFUSE (n'écrit PAS l'avancement).
//
//  Gating : can(user,'avancement','validate'). Écriture chantiers BORNÉE à
//  avancementProgress (merge). Lecture seule du reste de chantiers.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from "react";
import {
  collection, query, where, onSnapshot, doc, setDoc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { can } from "../../core/permissions";
import { ModuleSubHeader } from "../../core/components/ModuleSubHeader";
import { Button } from "../../core/components/Button";
import { Field } from "../../core/components/Field";
import { useToast } from "../../core/components/Toast";
import { isMyChantier, progressUnitIdForCreneau, posteLabel } from "./planningModel";
import { prettifyPoste } from "./planningSmsBody";

export function ValidationAvancement({ onExitModule }) {
  const { user } = useAuth();
  const { chantiers, tasksConfig, rolesConfig } = useData();
  const toast = useToast();
  const uid = user?._id || user?.id || null;

  const validateScope = can(user, "avancement", "validate", rolesConfig);
  const canValidate = validateScope === "all" || validateScope === "own_chantiers";

  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [pcts, setPcts] = useState({});      // id créneau → % saisi
  const [busyId, setBusyId] = useState(null);

  // Créneaux marqués FAIT par le monteur (égalité simple, pas d'index composite).
  useEffect(() => {
    if (!canValidate) return undefined;
    setLoaded(false); setError(false);
    const q = query(
      collection(db, "planningCreneaux"),
      where("etatValidationMonteur", "==", "FAIT"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => { setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoaded(true); },
      (err) => { console.error("[ValidationAvancement] lecture échouée :", err); setError(true); setLoaded(true); },
    );
    return unsub;
  }, [canValidate]);

  const chantierByNum = useMemo(() => {
    const m = new Map();
    (chantiers || []).forEach((c) => m.set(c.num, c));
    return m;
  }, [chantiers]);

  // File = FAIT + non encore VALIDÉ + chantier complet + dans SON périmètre.
  const file = useMemo(() => {
    return (rows || [])
      .filter((cr) => cr.etatValidationConducteur !== "VALIDE")
      .filter((cr) => cr.chantierId && cr.batiment && cr.posteAvancementKey)
      .filter((cr) => {
        if (validateScope === "all") return true;
        const c = chantierByNum.get(cr.chantierId);
        return c ? isMyChantier(user, c) : false;
      })
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.periode < b.periode ? -1 : 1));
  }, [rows, validateScope, chantierByNum, user]);

  // % ACTUEL d'un créneau (avancementProgress[unité résolue][tâche]).
  const currentPct = (cr) => {
    const c = chantierByNum.get(cr.chantierId);
    if (!c) return 0;
    const unitId = progressUnitIdForCreneau(c, cr.batiment);
    return c.avancementProgress?.[unitId]?.[cr.posteAvancementKey] ?? 0;
  };

  // % pré-rempli : 100 (le monteur a marqué la tâche terminée) ou % actuel.
  const prefillPct = (cr) =>
    cr.etatValidationMonteur === "FAIT" ? 100 : currentPct(cr);

  const inputVal = (cr) =>
    pcts[cr.id] !== undefined ? pcts[cr.id] : String(prefillPct(cr));

  const valider = async (cr) => {
    if (busyId) return;
    const c = chantierByNum.get(cr.chantierId);
    if (!c) { toast("❌ Chantier introuvable"); return; }
    const newPct = Math.max(0, Math.min(100, Math.round(Number(inputVal(cr)))));
    if (isNaN(newPct)) { toast("❌ Pourcentage invalide"); return; }
    const unitId = progressUnitIdForCreneau(c, cr.batiment);
    const cur = c.avancementProgress?.[unitId]?.[cr.posteAvancementKey] ?? 0;
    if (newPct < cur) {
      window.alert("L'avancement ne peut pas régresser ici.");
      return;
    }
    setBusyId(cr.id);
    try {
      // Écriture BORNÉE : deep-merge additif de la seule case [unité][tâche].
      await setDoc(
        doc(db, "chantiers", cr.chantierId),
        { avancementProgress: { [unitId]: { [cr.posteAvancementKey]: newPct } } },
        { merge: true },
      );
      await updateDoc(doc(db, "planningCreneaux", cr.id), {
        etatValidationConducteur: "VALIDE",
        etatValidationConducteurAt: serverTimestamp(),
        etatValidationConducteurPar: uid,
      });
      toast(`✓ Validé à ${newPct} %`);
    } catch (e) {
      console.error("[ValidationAvancement] validation échouée :", e);
      toast("❌ " + (e?.message || "Action impossible"));
    } finally {
      setBusyId(null);
    }
  };

  const refuser = async (cr) => {
    if (busyId) return;
    if (!window.confirm("Refuser cette tâche ? Le monteur devra la reprendre. L'avancement n'est pas modifié.")) return;
    setBusyId(cr.id);
    try {
      await updateDoc(doc(db, "planningCreneaux", cr.id), {
        etatValidationConducteur: "REFUSE",
        etatValidationConducteurAt: serverTimestamp(),
        etatValidationConducteurPar: uid,
      });
      toast("↩ Tâche refusée");
    } catch (e) {
      console.error("[ValidationAvancement] refus échoué :", e);
      toast("❌ " + (e?.message || "Action impossible"));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div style={{ paddingTop: space.md, paddingBottom: space.xl }}>
      <ModuleSubHeader
        moduleName="Validation"
        title="Tâches à valider"
        subtitle="Avancement déclaré par les monteurs"
        onBackToModuleHome={onExitModule || null}
      />

      {!canValidate ? (
        <Box icon="🔒" text="La validation de l'avancement ne vous est pas accessible." />
      ) : error ? (
        <Box icon="⚠️" text="Impossible de charger la file. Réessayez plus tard." />
      ) : !loaded ? (
        <Box icon="⏳" text="Chargement…" />
      ) : file.length === 0 ? (
        <Box icon="✅" text="Aucune tâche en attente de validation." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
          {file.map((cr) => {
            const c = chantierByNum.get(cr.chantierId) || null;
            const nom = c?.nom || cr.chantierId;
            const tache = cr.posteLabel
              || posteLabel(c, cr.batiment, cr.posteAvancementKey, tasksConfig)
              || prettifyPoste(cr.posteAvancementKey);
            const cur = currentPct(cr);
            const refuse = cr.etatValidationConducteur === "REFUSE";
            return (
              <div key={cr.id} style={{
                background: EPJ.white, border: `1px solid ${refuse ? EPJ.dangerBg : EPJ.gray200}`,
                borderRadius: radius.lg, padding: space.md,
                display: "flex", flexWrap: "wrap", alignItems: "center", gap: space.md,
              }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900 }}>
                    {nom} <span style={{ color: EPJ.gray400, fontWeight: fontWeight.regular }}>· Bât. {cr.batiment}</span>
                  </div>
                  <div style={{ fontSize: fontSize.xs, color: EPJ.gray600, marginTop: 1 }}>{tache}</div>
                  <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginTop: 2 }}>
                    {cr.ressourceNom || cr.ressourceId || "—"} · {cr.date} {cr.periode === "AM" ? "matin" : "aprem"}
                    {" · "}avancement actuel <strong style={{ color: EPJ.gray700 }}>{cur} %</strong>
                    {refuse && <span style={{ color: EPJ.redText, fontWeight: fontWeight.medium }}> · refusée</span>}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: space.sm, flexShrink: 0 }}>
                  <Field
                    type="number" label="%" dense width={72}
                    value={inputVal(cr)}
                    onChange={(e) => setPcts((p) => ({ ...p, [cr.id]: e.target.value }))}
                  />
                  <Button variant="ghost" size="sm" onClick={() => refuser(cr)} disabled={busyId === cr.id}>
                    Refuser
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => valider(cr)} loading={busyId === cr.id}>
                    Valider
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Box({ icon, text }) {
  return (
    <div style={{
      background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.lg,
      padding: space.xl, textAlign: "center",
    }}>
      <div style={{ fontSize: 32, marginBottom: space.sm }}>{icon}</div>
      <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, fontFamily: font.body }}>{text}</div>
    </div>
  );
}

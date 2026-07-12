// ═══════════════════════════════════════════════════════════════
//  ValidationAvancement (L9) — onglet « Suivi de chantier » de la fiche
//
//  Rendu DANS ChantierFiche pour la clé "suivi" → ne traite QUE le chantier
//  reçu en prop. Liste les créneaux planningCreneaux de CE chantier marqués
//  « FAIT » par le monteur et PAS encore validés. Par ligne : bât + tâche.
//   • Confirmer (1 clic, 100 %) → chantiers.avancementProgress[unité][tâche]=100
//     (merge:true, deep-merge ADDITIF) + etatValidationConducteur=VALIDE.
//   • Refuser → etatValidationConducteur=REFUSE (n'écrit PAS l'avancement).
//
//  Gating des boutons : can(user,'avancement','validate') (conducteur
//  own_chantiers, chef via rolesConfig, Direction/Admin all). Écriture chantiers
//  BORNÉE à avancementProgress (merge). Lecture seule du reste.
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
import { Button } from "../../core/components/Button";
import { useToast } from "../../core/components/Toast";
import {
  progressUnitIdForCreneau, posteLabel,
  getCreneauTaches, tacheValMonteur, tacheValConducteur,
} from "./planningModel";
import { prettifyPoste } from "./planningSmsBody";

export function ValidationAvancement({ chantier }) {
  const { user } = useAuth();
  const { tasksConfig, rolesConfig } = useData();
  const toast = useToast();
  const uid = user?._id || user?.id || null;
  const chantierId = chantier?.num || null;

  const validateScope = can(user, "avancement", "validate", rolesConfig);
  const canValidate = validateScope === "all" || validateScope === "own_chantiers";

  const [rowsLegacy, setRowsLegacy] = useState([]);
  const [rowsFlag, setRowsFlag] = useState([]);
  const [loadedA, setLoadedA] = useState(false);
  const [loadedB, setLoadedB] = useState(false);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const loaded = loadedA && loadedB;

  // UNION de deux requêtes (pas de migration des anciens créneaux) :
  //  (a) legacy : etatValidationMonteur == "FAIT" (champ plat mono-tâche) ;
  //  (b) multi  : aValiderConducteur == true (map par tâche, lot 4).
  // Déduplication par id côté client.
  useEffect(() => {
    if (!chantierId) return undefined;
    setLoadedA(false); setError(false);
    const qa = query(
      collection(db, "planningCreneaux"),
      where("chantierId", "==", chantierId),
      where("etatValidationMonteur", "==", "FAIT"),
    );
    const unsub = onSnapshot(
      qa,
      (snap) => { setRowsLegacy(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoadedA(true); },
      (err) => { console.error("[ValidationAvancement] lecture (a) échouée :", err); setError(true); setLoadedA(true); },
    );
    return unsub;
  }, [chantierId]);

  useEffect(() => {
    if (!chantierId) return undefined;
    setLoadedB(false);
    const qb = query(
      collection(db, "planningCreneaux"),
      where("chantierId", "==", chantierId),
      where("aValiderConducteur", "==", true),
    );
    const unsub = onSnapshot(
      qb,
      (snap) => { setRowsFlag(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoadedB(true); },
      (err) => { console.error("[ValidationAvancement] lecture (b) échouée :", err); setError(true); setLoadedB(true); },
    );
    return unsub;
  }, [chantierId]);

  // Créneaux dédupliqués par id (union a ∪ b).
  const creneaux = useMemo(() => {
    const m = new Map();
    [...rowsLegacy, ...rowsFlag].forEach((cr) => m.set(cr.id, cr));
    return [...m.values()];
  }, [rowsLegacy, rowsFlag]);

  // File PAR TÂCHE : une ligne par tâche FAIT non VALIDÉE. Les tâches libres
  // (sans poste) sont AUSSI validables (elles ne touchent pas l'avancement).
  const file = useMemo(() => {
    const out = [];
    for (const cr of creneaux) {
      for (const t of getCreneauTaches(cr)) {
        if (tacheValMonteur(cr, t.id) !== "FAIT") continue;
        if (tacheValConducteur(cr, t.id) === "VALIDE") continue;
        out.push({ cr, tache: t });
      }
    }
    return out.sort((x, y) => {
      const a = x.cr, b = y.cr;
      return a.date < b.date ? -1 : a.date > b.date ? 1 : a.periode < b.periode ? -1 : 1;
    });
  }, [creneaux]);

  // Recalcul du flag : reste-t-il une tâche FAIT non VALIDÉE après cette action ?
  // (la tâche `t` prend l'état `newEtat` côté conducteur).
  const recalcFlag = (cr, tId, newEtat) =>
    getCreneauTaches(cr).some((x) => {
      const vm = x.id === tId ? "FAIT" : tacheValMonteur(cr, x.id);
      const vc = x.id === tId ? newEtat : tacheValConducteur(cr, x.id);
      return vm === "FAIT" && vc !== "VALIDE";
    });

  const confirmer = async ({ cr, tache }) => {
    if (busyId || !canValidate) return;
    const unitId = progressUnitIdForCreneau(chantier, tache.batiment);
    setBusyId(cr.id + "__" + tache.id);
    try {
      // Écriture avancement UNIQUEMENT pour une tâche avec poste (une tâche libre
      // n'a pas de case d'avancement → on valide sans toucher chantiers).
      // Écriture BORNÉE : deep-merge additif → la case [unité][tâche] passe à 100.
      // 100 = max → aucune régression possible (pattern trio INCHANGÉ).
      if (tache.posteAvancementKey) {
        await setDoc(
          doc(db, "chantiers", chantier.num),
          { avancementProgress: { [unitId]: { [tache.posteAvancementKey]: 100 } } },
          { merge: true },
        );
      }
      await updateDoc(doc(db, "planningCreneaux", cr.id), {
        [`validationConducteur.${tache.id}`]: { etat: "VALIDE", at: serverTimestamp(), par: uid },
        aValiderConducteur: recalcFlag(cr, tache.id, "VALIDE"),
      });
      toast("✓ Avancement confirmé (100 %)");
    } catch (e) {
      console.error("[ValidationAvancement] confirmation échouée :", e);
      toast("❌ " + (e?.message || "Action impossible"));
    } finally {
      setBusyId(null);
    }
  };

  const refuser = async ({ cr, tache }) => {
    if (busyId || !canValidate) return;
    if (!window.confirm("Refuser cette tâche ? Le monteur devra la reprendre. L'avancement n'est pas modifié.")) return;
    setBusyId(cr.id + "__" + tache.id);
    try {
      await updateDoc(doc(db, "planningCreneaux", cr.id), {
        [`validationConducteur.${tache.id}`]: { etat: "REFUSE", at: serverTimestamp(), par: uid },
        aValiderConducteur: recalcFlag(cr, tache.id, "REFUSE"),
      });
      toast("↩ Tâche refusée");
    } catch (e) {
      console.error("[ValidationAvancement] refus échoué :", e);
      toast("❌ " + (e?.message || "Action impossible"));
    } finally {
      setBusyId(null);
    }
  };

  if (error) return <Box icon="⚠️" text="Impossible de charger les tâches. Réessayez plus tard." />;
  if (!loaded) return <Box icon="⏳" text="Chargement…" />;
  if (file.length === 0) return <Box icon="✅" text="Aucune tâche en attente de validation sur ce chantier." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
      {file.map(({ cr, tache }) => {
        const label = tache.posteAvancementKey
          ? (posteLabel(chantier, tache.batiment, tache.posteAvancementKey, tasksConfig) || prettifyPoste(tache.posteAvancementKey))
          : (tache.posteLabel || "Tâche diverse");
        const refuse = tacheValConducteur(cr, tache.id) === "REFUSE";
        const rowId = cr.id + "__" + tache.id;
        return (
          <div key={rowId} style={{
            background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
            borderRadius: radius.lg, padding: space.md,
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: space.md,
          }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900 }}>
                Bât. {tache.batiment} <span style={{ color: EPJ.gray400, fontWeight: fontWeight.regular }}>· {label}</span>
              </div>
              <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginTop: 2 }}>
                {cr.ressourceNom || cr.ressourceId || "—"} · {cr.date} {cr.periode === "AM" ? "matin" : "aprem"}
                {refuse && <span style={{ color: EPJ.redText, fontWeight: fontWeight.medium }}> · refusée — en attente de reprise</span>}
              </div>
            </div>
            {canValidate && (
              <div style={{ display: "flex", alignItems: "center", gap: space.sm, flexShrink: 0 }}>
                <Button variant="ghost" size="sm" onClick={() => refuser({ cr, tache })} disabled={busyId === rowId}>
                  Refuser
                </Button>
                <Button variant="primary" size="sm" onClick={() => confirmer({ cr, tache })} loading={busyId === rowId}>
                  Confirmer
                </Button>
              </div>
            )}
          </div>
        );
      })}
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

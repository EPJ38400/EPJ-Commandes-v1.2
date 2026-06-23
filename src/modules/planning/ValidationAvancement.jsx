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
import { progressUnitIdForCreneau, posteLabel } from "./planningModel";
import { prettifyPoste } from "./planningSmsBody";

export function ValidationAvancement({ chantier }) {
  const { user } = useAuth();
  const { tasksConfig, rolesConfig } = useData();
  const toast = useToast();
  const uid = user?._id || user?.id || null;
  const chantierId = chantier?.num || null;

  const validateScope = can(user, "avancement", "validate", rolesConfig);
  const canValidate = validateScope === "all" || validateScope === "own_chantiers";

  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // Créneaux FAIT de CE chantier (deux égalités → zig-zag join sur index
  // simples, pas d'index composite — calque sendPlanningSms).
  useEffect(() => {
    if (!chantierId) return undefined;
    setLoaded(false); setError(false);
    const q = query(
      collection(db, "planningCreneaux"),
      where("chantierId", "==", chantierId),
      where("etatValidationMonteur", "==", "FAIT"),
    );
    const unsub = onSnapshot(
      q,
      (snap) => { setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoaded(true); },
      (err) => { console.error("[ValidationAvancement] lecture échouée :", err); setError(true); setLoaded(true); },
    );
    return unsub;
  }, [chantierId]);

  // File = FAIT + pas encore VALIDÉ + tâche concrète (bât + poste).
  const file = useMemo(() => {
    return (rows || [])
      .filter((cr) => cr.etatValidationConducteur !== "VALIDE")
      .filter((cr) => cr.batiment && cr.posteAvancementKey)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.periode < b.periode ? -1 : 1));
  }, [rows]);

  const confirmer = async (cr) => {
    if (busyId || !canValidate) return;
    const unitId = progressUnitIdForCreneau(chantier, cr.batiment);
    setBusyId(cr.id);
    try {
      // Écriture BORNÉE : deep-merge additif → la case [unité][tâche] passe à 100.
      // 100 = max → aucune régression possible (pas de garde nécessaire).
      await setDoc(
        doc(db, "chantiers", chantier.num),
        { avancementProgress: { [unitId]: { [cr.posteAvancementKey]: 100 } } },
        { merge: true },
      );
      await updateDoc(doc(db, "planningCreneaux", cr.id), {
        etatValidationConducteur: "VALIDE",
        etatValidationConducteurAt: serverTimestamp(),
        etatValidationConducteurPar: uid,
      });
      toast("✓ Avancement confirmé (100 %)");
    } catch (e) {
      console.error("[ValidationAvancement] confirmation échouée :", e);
      toast("❌ " + (e?.message || "Action impossible"));
    } finally {
      setBusyId(null);
    }
  };

  const refuser = async (cr) => {
    if (busyId || !canValidate) return;
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

  if (error) return <Box icon="⚠️" text="Impossible de charger les tâches. Réessayez plus tard." />;
  if (!loaded) return <Box icon="⏳" text="Chargement…" />;
  if (file.length === 0) return <Box icon="✅" text="Aucune tâche en attente de validation sur ce chantier." />;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
      {file.map((cr) => {
        const tache = cr.posteLabel
          || posteLabel(chantier, cr.batiment, cr.posteAvancementKey, tasksConfig)
          || prettifyPoste(cr.posteAvancementKey);
        const refuse = cr.etatValidationConducteur === "REFUSE";
        return (
          <div key={cr.id} style={{
            background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
            borderRadius: radius.lg, padding: space.md,
            display: "flex", flexWrap: "wrap", alignItems: "center", gap: space.md,
          }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900 }}>
                Bât. {cr.batiment} <span style={{ color: EPJ.gray400, fontWeight: fontWeight.regular }}>· {tache}</span>
              </div>
              <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginTop: 2 }}>
                {cr.ressourceNom || cr.ressourceId || "—"} · {cr.date} {cr.periode === "AM" ? "matin" : "aprem"}
                {refuse && <span style={{ color: EPJ.redText, fontWeight: fontWeight.medium }}> · refusée — en attente de reprise</span>}
              </div>
            </div>
            {canValidate && (
              <div style={{ display: "flex", alignItems: "center", gap: space.sm, flexShrink: 0 }}>
                <Button variant="ghost" size="sm" onClick={() => refuser(cr)} disabled={busyId === cr.id}>
                  Refuser
                </Button>
                <Button variant="primary" size="sm" onClick={() => confirmer(cr)} loading={busyId === cr.id}>
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

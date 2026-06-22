// ═══════════════════════════════════════════════════════════════
//  MesTachesDuJour (L9) — vue légère « monteur » des tâches du jour
//
//  Liste les créneaux planningCreneaux de l'utilisateur courant POUR
//  AUJOURD'HUI qui portent un chantier + bâtiment + poste. Bouton
//  « Tâche faite » → flippe SA confirmation (etatValidationMonteur=FAIT).
//
//  Écriture BORNÉE aux 3 champs de validation monteur (conforme à la règle
//  Firestore planningCreneaux pour le rôle Monteur). Lecture seule chantiers
//  (cache DataContext). Self-scoped : ressourceId == user._id.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo } from "react";
import {
  collection, query, where, onSnapshot, doc, updateDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { Button } from "../../core/components/Button";
import { useToast } from "../../core/components/Toast";
import { toISODate, posteLabel } from "./planningModel";
import { prettifyPoste } from "./planningSmsBody";

const CONDUCTEUR_LABEL = {
  VALIDE: { text: "Validée par le conducteur", color: EPJ.green },
  REFUSE: { text: "Refusée — à revoir", color: EPJ.red },
};

export function MesTachesDuJour() {
  const { user } = useAuth();
  const { chantiers, tasksConfig } = useData();
  const toast = useToast();
  const uid = user?._id || user?.id || null;

  const todayIso = useMemo(() => toISODate(new Date()), []);
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState(null);

  // Créneaux du jour de CET utilisateur (équalité ressourceId + date :
  // zig-zag join sur index simples, pas d'index composite — calque sendPlanningSms).
  useEffect(() => {
    if (!uid) return undefined;
    setLoaded(false); setError(false);
    const q = query(
      collection(db, "planningCreneaux"),
      where("ressourceId", "==", uid),
      where("date", "==", todayIso),
    );
    const unsub = onSnapshot(
      q,
      (snap) => { setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoaded(true); },
      (err) => { console.error("[MesTachesDuJour] lecture échouée :", err); setError(true); setLoaded(true); },
    );
    return unsub;
  }, [uid, todayIso]);

  const chantierByNum = useMemo(() => {
    const m = new Map();
    (chantiers || []).forEach((c) => m.set(c.num, c));
    return m;
  }, [chantiers]);

  // Tâches « concrètes » du jour (chantier + bâtiment + poste), AM puis PM.
  const taches = useMemo(() => {
    return (rows || [])
      .filter((r) => r.chantierId && r.batiment && r.posteAvancementKey)
      .sort((a, b) => (a.periode === b.periode ? 0 : a.periode === "AM" ? -1 : 1));
  }, [rows]);

  const marquerFaite = async (cr) => {
    if (busyId) return;
    setBusyId(cr.id);
    try {
      // ⚠️ EXACTEMENT 3 champs → conforme à la règle Firestore (hasOnly).
      await updateDoc(doc(db, "planningCreneaux", cr.id), {
        etatValidationMonteur: "FAIT",
        etatValidationMonteurAt: serverTimestamp(),
        etatValidationMonteurPar: uid,
      });
      toast("✓ Tâche marquée faite");
    } catch (e) {
      console.error("[MesTachesDuJour] marquage échoué :", e);
      toast("❌ Action impossible");
    } finally {
      setBusyId(null);
    }
  };

  if (!uid) return null;

  return (
    <div style={{ marginBottom: space.lg }}>
      <div style={{
        fontFamily: font.display, fontSize: fontSize.lg, fontWeight: fontWeight.regular,
        color: EPJ.gray900, letterSpacing: "-0.01em", marginBottom: space.sm,
      }}>
        Mes tâches du jour
      </div>

      {error ? (
        <Box icon="⚠️" text="Impossible de charger vos tâches. Réessayez plus tard." />
      ) : !loaded ? (
        <Box icon="⏳" text="Chargement…" />
      ) : taches.length === 0 ? (
        <Box icon="✅" text="Aucune tâche planifiée pour aujourd'hui." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
          {taches.map((cr) => {
            const chantier = chantierByNum.get(cr.chantierId) || null;
            const nom = chantier?.nom || cr.chantierId;
            const tache = cr.posteLabel
              || posteLabel(chantier, cr.batiment, cr.posteAvancementKey, tasksConfig)
              || prettifyPoste(cr.posteAvancementKey);
            const fait = cr.etatValidationMonteur === "FAIT";
            const cond = CONDUCTEUR_LABEL[cr.etatValidationConducteur];
            return (
              <div key={cr.id} style={{
                display: "flex", alignItems: "center", gap: space.md,
                background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
                borderRadius: radius.lg, padding: `${space.sm}px ${space.md}px`,
              }}>
                <div style={{
                  fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: EPJ.gray500,
                  width: 38, flexShrink: 0,
                }}>
                  {cr.periode === "AM" ? "Matin" : "Aprem"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {nom} <span style={{ color: EPJ.gray400, fontWeight: fontWeight.regular }}>· Bât. {cr.batiment}</span>
                  </div>
                  <div style={{
                    fontSize: fontSize.xs, color: EPJ.gray600, marginTop: 1,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {tache}
                  </div>
                  {cond && (
                    <div style={{ fontSize: fontSize.xs, color: cond.color, fontWeight: fontWeight.medium, marginTop: 2 }}>
                      {cr.etatValidationConducteur === "VALIDE" ? "✓ " : "↩ "}{cond.text}
                    </div>
                  )}
                </div>
                {fait ? (
                  <span style={{
                    fontSize: fontSize.xs, fontWeight: fontWeight.semibold, color: EPJ.green,
                    background: EPJ.successBg, padding: `${space.xs}px ${space.sm}px`,
                    borderRadius: radius.pill, whiteSpace: "nowrap", flexShrink: 0,
                  }}>
                    ✓ Faite
                  </span>
                ) : (
                  <Button variant="primary" size="sm" onClick={() => marquerFaite(cr)} loading={busyId === cr.id}>
                    Tâche faite
                  </Button>
                )}
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
      padding: space.lg, textAlign: "center",
    }}>
      <div style={{ fontSize: 26, marginBottom: space.xs }}>{icon}</div>
      <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, fontFamily: font.body }}>{text}</div>
    </div>
  );
}

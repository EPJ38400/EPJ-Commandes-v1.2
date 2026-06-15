// ═══════════════════════════════════════════════════════════════
//  ParcInterventionsTab — Section "Pannes & SAV"
//  - Liste des interventions tous outils confondus (ouvertes par défaut)
//  - Filtre par statut + tri dateSignalement desc
//  - Suivi par intervention : changement de statut + édition des notes
//
//  Effets sur l'outil (setDoc merge, jamais d'écrasement) :
//    reparee  → outil "disponible" sauf autre intervention ouverte
//    reformee → outil "hors_service"
//  outillageSorties n'est jamais touché (collection complémentaire).
// ═══════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { db } from "../../firebase";
import { doc, setDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import {
  INTERVENTION_STATUTS, isInterventionOuverte, nextInterventionStatuts,
  buildStatusChangePayload, outilStatutAfterStatusChange,
} from "./outillageInterventions";

function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const FILTRES = [
  { key: "ouvertes", label: "Ouvertes" },
  { key: "signalee", label: "Signalées" },
  { key: "en_reparation", label: "En réparation" },
  { key: "reparee", label: "Réparées" },
  { key: "reformee", label: "Réformées" },
  { key: "toutes", label: "Toutes" },
];

export function ParcInterventionsTab({ onSelectOutil }) {
  const { outillageInterventions, outillagePannes } = useData();
  const [filtre, setFiltre] = useState("ouvertes");

  const liste = useMemo(() => {
    let arr = [...(outillageInterventions || [])];
    if (filtre === "ouvertes") arr = arr.filter(isInterventionOuverte);
    else if (filtre !== "toutes") arr = arr.filter(it => it.statut === filtre);
    arr.sort((a, b) => (b.dateSignalement || "").localeCompare(a.dateSignalement || ""));
    return arr;
  }, [outillageInterventions, filtre]);

  return (
    <div>
      {/* Filtres */}
      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 }}>
        {FILTRES.map(f => {
          const active = filtre === f.key;
          return (
            <button key={f.key} onClick={() => setFiltre(f.key)} style={{
              padding: "6px 10px", borderRadius: 7,
              border: `1px solid ${active ? EPJ.gray900 : EPJ.gray200}`,
              background: active ? EPJ.gray900 : EPJ.white,
              color: active ? EPJ.white : EPJ.gray700,
              fontSize: 11, fontWeight: 600, cursor: "pointer",
              fontFamily: font.body, whiteSpace: "nowrap",
            }}>{f.label}</button>
          );
        })}
      </div>

      {liste.length === 0 ? (
        <div className="epj-card" style={{
          padding: "16px 14px", textAlign: "center",
          fontSize: 12, color: EPJ.gray500, lineHeight: 1.5,
        }}>
          {filtre === "ouvertes"
            ? "Aucune intervention en cours. 🎉"
            : "Aucune intervention pour ce filtre."}
        </div>
      ) : (
        liste.map(it => (
          <InterventionCard
            key={it._id}
            intervention={it}
            pannes={outillagePannes}
            onSelectOutil={onSelectOutil}
          />
        ))
      )}
    </div>
  );
}

function InterventionCard({ intervention: it, pannes, onSelectOutil }) {
  const { outillageInterventions } = useData();
  const toast = useToast();
  const [expanded, setExpanded] = useState(false);
  const [notesDraft, setNotesDraft] = useState(it.notes || "");
  const [savingNotes, setSavingNotes] = useState(false);
  const [busyStatut, setBusyStatut] = useState(false);

  const st = INTERVENTION_STATUTS[it.statut] || INTERVENTION_STATUTS.signalee;
  const next = nextInterventionStatuts(it.statut);
  const interventionId = it._id || it.id;

  const changeStatut = async (newStatut) => {
    const stLabel = (INTERVENTION_STATUTS[newStatut] || {}).label || newStatut;
    if (!confirm(`Passer l'intervention sur ${it.outilRef} en « ${stLabel} » ?`)) return;
    setBusyStatut(true);
    try {
      const nowISO = new Date().toISOString();
      // 1) Patch de l'intervention (merge)
      await setDoc(
        doc(db, "outillageInterventions", interventionId),
        buildStatusChangePayload({ newStatut, nowISO }),
        { merge: true }
      );

      // 2) Effet sur l'outil (merge, jamais d'écrasement). Non bloquant.
      const outilStatut = outilStatutAfterStatusChange({
        newStatut,
        outilId: it.outilId,
        interventions: outillageInterventions,
        currentInterventionId: interventionId,
      });
      if (outilStatut && it.outilId) {
        try {
          await setDoc(doc(db, "outils", it.outilId), {
            statut: outilStatut,
            updatedAt: nowISO,
          }, { merge: true });
        } catch (outilErr) {
          console.warn("[intervention] maj statut outil non bloquante:", outilErr.message);
          toast("⚠ Statut intervention mis à jour, mais pas celui de l'outil (droits ?)");
          return;
        }
      }
      toast(`✓ Intervention ${stLabel.toLowerCase()}`);
    } catch (e) {
      console.error(e);
      toast("❌ " + e.message);
    } finally { setBusyStatut(false); }
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await setDoc(
        doc(db, "outillageInterventions", interventionId),
        { notes: notesDraft.trim(), updatedAt: new Date().toISOString() },
        { merge: true }
      );
      toast("✓ Notes enregistrées");
    } catch (e) {
      console.error(e);
      toast("❌ " + e.message);
    } finally { setSavingNotes(false); }
  };

  return (
    <div className="epj-card" style={{
      padding: "12px 14px", marginBottom: 8,
      borderLeft: `3px solid ${st.color}`,
    }}>
      {/* En-tête : outil + statut */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            onClick={() => onSelectOutil?.(it.outilId)}
            style={{
              fontSize: 13, fontWeight: 700, color: EPJ.gray900,
              cursor: onSelectOutil ? "pointer" : "default",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{it.outilNom || "—"}</div>
          <div style={{ fontSize: 10, color: EPJ.gray500, fontFamily: "monospace", marginTop: 1 }}>
            {it.outilRef}
          </div>
        </div>
        <span style={{
          fontSize: 10, fontWeight: 700, color: st.color,
          background: `${st.color}15`, padding: "3px 7px", borderRadius: 4,
          whiteSpace: "nowrap", flexShrink: 0,
        }}>{st.icon} {st.label}</span>
      </div>

      {/* Pannes */}
      {it.panneIds?.length > 0 && (
        <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
          {it.panneIds.map(pid => {
            const p = pannes.find(x => x.code === pid || x._id === pid);
            return (
              <span key={pid} style={{
                fontSize: 9, fontWeight: 600,
                padding: "2px 5px", borderRadius: 3,
                background: p?.bloquante ? `${EPJ.red}15` : `${EPJ.orange}15`,
                color: p?.bloquante ? EPJ.red : EPJ.orange,
                fontFamily: "monospace",
              }}>{p?.code || pid}</span>
            );
          })}
        </div>
      )}

      {/* Description */}
      {it.descriptionLibre && (
        <div style={{
          fontSize: 11, color: EPJ.gray600, marginTop: 6,
          fontStyle: "italic", lineHeight: 1.5,
        }}>💬 {it.descriptionLibre}</div>
      )}

      {/* Méta */}
      <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 6, lineHeight: 1.5 }}>
        Signalée le {formatDateTime(it.dateSignalement)}
        {it.declareeParNom && <> par {it.declareeParNom}</>}
        {it.dateReparation && <> • clôturée le {formatDateTime(it.dateReparation)}</>}
      </div>

      {/* Notes existantes (résumé replié) */}
      {!expanded && it.notes && (
        <div style={{
          fontSize: 11, color: EPJ.gray700, marginTop: 6,
          padding: "6px 8px", background: EPJ.gray50, borderRadius: 6, lineHeight: 1.5,
        }}>📝 {it.notes}</div>
      )}

      {/* Toggle suivi */}
      <button onClick={() => setExpanded(e => !e)} style={{
        marginTop: 8, background: "transparent", border: "none",
        color: EPJ.gray500, fontSize: 11, fontWeight: 600,
        cursor: "pointer", fontFamily: font.body, padding: 0,
      }}>{expanded ? "▾ Masquer le suivi" : "▸ Suivi & notes"}</button>

      {expanded && (
        <div style={{ marginTop: 10 }}>
          {/* Changement de statut */}
          {next.length > 0 ? (
            <>
              <div style={{
                fontSize: 10, fontWeight: 600, color: EPJ.gray500,
                letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6,
              }}>Faire évoluer</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                {next.map(ns => {
                  const nst = INTERVENTION_STATUTS[ns];
                  return (
                    <button key={ns} disabled={busyStatut}
                      onClick={() => changeStatut(ns)}
                      style={{
                        padding: "8px 12px", borderRadius: 8,
                        border: `1px solid ${nst.color}`,
                        background: `${nst.color}10`, color: nst.color,
                        fontSize: 12, fontWeight: 700, cursor: "pointer",
                        fontFamily: font.body, opacity: busyStatut ? 0.6 : 1,
                      }}>{nst.icon} {nst.label}</button>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{
              fontSize: 11, color: EPJ.gray500, marginBottom: 12, lineHeight: 1.5,
            }}>Intervention clôturée.</div>
          )}

          {/* Notes éditables */}
          <div style={{
            fontSize: 10, fontWeight: 600, color: EPJ.gray500,
            letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4,
          }}>Notes de suivi</div>
          <textarea className="epj-input" value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            placeholder="Détails de l'intervention, pièces commandées, suivi SAV…"
            rows={3} style={{ resize: "vertical", minHeight: 60 }}/>
          <button onClick={saveNotes} disabled={savingNotes || notesDraft === (it.notes || "")}
            className="epj-btn" style={{
              marginTop: 6, background: EPJ.blue, color: EPJ.white,
              opacity: (savingNotes || notesDraft === (it.notes || "")) ? 0.5 : 1,
            }}>
            {savingNotes ? "Enregistrement…" : "💾 Enregistrer les notes"}
          </button>
        </div>
      )}
    </div>
  );
}

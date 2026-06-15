// ═══════════════════════════════════════════════════════════════
//  ParcDeclarerPanne — Déclaration de panne autonome (hors retour)
//  - Sélection de panne(s) parmi outillagePannes actifs (multi)
//  - Description libre
//  - Submit → crée outillageInterventions/{id} (statut "signalee")
//    et passe l'outil en "maintenance" (ou "hors_service" si panne
//    bloquante) via setDoc(..., { merge: true }).
//  - Complémentaire au flux retour (outillageSorties NON touché).
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { db } from "../../firebase";
import { collection, doc, setDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import { getCategorieIcon } from "./parcUtils";
import {
  buildInterventionPayload, outilStatutForDeclaration,
} from "./outillageInterventions";

export function ParcDeclarerPanne({ outil, onBack, onDone }) {
  const { user } = useAuth();
  const { outillagePannes, outillageCategories } = useData();
  const toast = useToast();

  const [selectedPanneIds, setSelectedPanneIds] = useState([]);
  const [descriptionLibre, setDescriptionLibre] = useState("");
  const [saving, setSaving] = useState(false);

  const catIcon = getCategorieIcon(outillageCategories, outil.categorieId);

  const activePannes = [...outillagePannes]
    .filter(p => p.actif !== false)
    .sort((a, b) => (a.code || "").localeCompare(b.code || ""));

  const togglePanne = (code) => {
    setSelectedPanneIds(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const hasBloquante = selectedPanneIds.some(code => {
    const p = outillagePannes.find(x => x.code === code || x._id === code);
    return p?.bloquante === true;
  });

  const save = async () => {
    if (selectedPanneIds.length === 0 && !descriptionLibre.trim()) {
      toast("❌ Sélectionne au moins une panne ou décris le problème");
      return;
    }
    setSaving(true);
    try {
      const nowISO = new Date().toISOString();

      // 1) Création de l'intervention (collection complémentaire, neuve)
      const payload = buildInterventionPayload({
        outil, panneIds: selectedPanneIds, descriptionLibre, user, nowISO,
      });
      const ref = doc(collection(db, "outillageInterventions"));
      await setDoc(ref, payload);

      // 2) Mise à jour du statut de l'outil — merge, jamais d'écrasement.
      //    Non bloquant : si l'écriture outil échoue (droits), l'intervention
      //    est déjà enregistrée et reste exploitable depuis "Pannes & SAV".
      const outilStatut = outilStatutForDeclaration(outillagePannes, selectedPanneIds);
      try {
        await setDoc(doc(db, "outils", outil._id), {
          statut: outilStatut,
          updatedAt: nowISO,
        }, { merge: true });
      } catch (outilErr) {
        console.warn("[intervention] maj statut outil non bloquante:", outilErr.message);
        toast("⚠ Panne enregistrée, mais statut outil non mis à jour (droits ?)");
        onDone?.();
        return;
      }

      toast(outilStatut === "hors_service"
        ? `⚠ ${outil.ref} marqué hors service (panne bloquante)`
        : `✓ Panne déclarée — ${outil.ref} en maintenance`);
      onDone?.();
    } catch (e) {
      console.error(e);
      toast("❌ " + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={backBtnStyle}>← Annuler</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: font.display, fontSize: 20, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.15,
          }}>Déclarer une panne</div>
          <div style={{
            fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3,
            textTransform: "uppercase", fontWeight: 600, marginTop: 1,
          }}>Signalement et suivi SAV</div>
        </div>
      </div>

      {/* Récap outil */}
      <div className="epj-card" style={{
        padding: "12px 14px", marginBottom: 12,
        display: "flex", gap: 12, alignItems: "flex-start",
        borderLeft: `3px solid ${EPJ.orange}`,
      }}>
        {outil.photoURL ? (
          <img src={outil.photoURL} alt="" style={{
            width: 50, height: 50, borderRadius: 8, objectFit: "cover",
            flexShrink: 0, border: `1px solid ${EPJ.gray200}`,
          }}/>
        ) : (
          <div style={{
            width: 50, height: 50, borderRadius: 8,
            background: EPJ.gray100, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 24, flexShrink: 0,
          }}>{catIcon}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: EPJ.gray900, fontFamily: "monospace" }}>
            {outil.ref}
          </div>
          <div style={{
            fontSize: 12, color: EPJ.gray700, marginTop: 1,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{outil.nom}</div>
        </div>
      </div>

      <div className="epj-card" style={{ padding: 14, marginBottom: 14 }}>
        {/* Sélection des pannes */}
        <FormRow>
          <label style={labelStyle}>Type(s) de panne</label>
          {activePannes.length === 0 ? (
            <div style={{
              padding: 10, background: `${EPJ.orange}08`, borderRadius: 6,
              fontSize: 11, color: EPJ.gray600, lineHeight: 1.4,
            }}>
              Aucune panne configurée. Décris le problème ci-dessous, ou demande
              à l'admin d'en ajouter via Admin → Pannes récurrentes.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 10, color: EPJ.gray500, marginBottom: 6, lineHeight: 1.4 }}>
                Sélectionne une ou plusieurs pannes (cochable).
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {activePannes.map(p => {
                  const code = p.code || p._id;
                  const selected = selectedPanneIds.includes(code);
                  return (
                    <label key={code} style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "8px 10px", borderRadius: 6,
                      border: `1px solid ${selected ? (p.bloquante ? EPJ.red : EPJ.orange) : EPJ.gray200}`,
                      background: selected
                        ? (p.bloquante ? `${EPJ.red}08` : `${EPJ.orange}08`)
                        : EPJ.white,
                      cursor: "pointer",
                    }}>
                      <input type="checkbox" checked={selected}
                        onChange={() => togglePanne(code)}
                        style={{
                          width: 18, height: 18,
                          accentColor: p.bloquante ? EPJ.red : EPJ.orange,
                        }}/>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 11, fontFamily: "monospace", fontWeight: 700,
                          color: EPJ.gray900,
                        }}>{p.code}</div>
                        <div style={{ fontSize: 12, color: EPJ.gray700 }}>
                          {p.libelle}
                        </div>
                      </div>
                      {p.bloquante && (
                        <span style={{
                          fontSize: 9, fontWeight: 700, color: EPJ.red,
                          background: `${EPJ.red}12`, padding: "2px 5px", borderRadius: 3,
                        }}>⛔ BLOQUANTE</span>
                      )}
                    </label>
                  );
                })}
              </div>
              {hasBloquante && (
                <div style={{
                  marginTop: 8, padding: "8px 10px",
                  background: `${EPJ.red}10`, borderRadius: 6,
                  fontSize: 11, color: EPJ.red, lineHeight: 1.4,
                }}>
                  ⚠ L'outil sera automatiquement marqué <b>hors service</b> car une des pannes est bloquante.
                </div>
              )}
            </>
          )}
        </FormRow>

        {/* Description libre */}
        <FormRow>
          <label style={labelStyle}>Description du problème</label>
          <textarea className="epj-input" value={descriptionLibre}
            onChange={e => setDescriptionLibre(e.target.value)}
            placeholder="Décris le problème constaté…"
            rows={3} style={{ resize: "vertical", minHeight: 60 }}/>
        </FormRow>

        <div style={{
          fontSize: 10, color: EPJ.gray500, lineHeight: 1.4, marginTop: 4,
        }}>
          {hasBloquante
            ? "L'outil passera hors service."
            : "L'outil passera en maintenance et ne pourra plus être sorti tant que l'intervention n'est pas réparée."}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} className="epj-btn" style={{
          flex: 1, background: EPJ.gray100, color: EPJ.gray700,
        }}>Annuler</button>
        <button onClick={save} disabled={saving} className="epj-btn" style={{
          flex: 2, background: hasBloquante ? EPJ.red : EPJ.orange, color: EPJ.white,
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? "Enregistrement…" : "⚠ Déclarer la panne"}
        </button>
      </div>
    </div>
  );
}

const backBtnStyle = {
  background: EPJ.gray100, border: "none", borderRadius: 10,
  padding: "9px 14px", fontSize: 13, fontWeight: 600,
  color: EPJ.gray700, cursor: "pointer", fontFamily: "Inter, sans-serif",
  whiteSpace: "nowrap", flexShrink: 0,
};
const labelStyle = {
  display: "block", fontSize: 10, fontWeight: 600,
  color: EPJ.gray500, letterSpacing: 0.4, textTransform: "uppercase",
  marginBottom: 4,
};
function FormRow({ children }) { return <div style={{ marginBottom: 12 }}>{children}</div>; }

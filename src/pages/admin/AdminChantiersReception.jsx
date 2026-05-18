// ═══════════════════════════════════════════════════════════════
//  AdminChantiersReception — Saisie dates PV de réception
//  Permet de déclencher le suivi des garanties GPA + biennale
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { db } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";
import { getGaranties, formatDate } from "../../modules/reserves/reservesUtils";

export function AdminChantiersReception({ onBack }) {
  const { chantiers } = useData();
  const [editing, setEditing] = useState(null); // chantierId en édition
  const [tempDate, setTempDate] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (c) => {
    setEditing(c._id);
    setTempDate(c.datePVReception || "");
  };

  const saveDate = async (c) => {
    setSaving(true);
    try {
      await updateDoc(doc(db, "chantiers", c._id), {
        datePVReception: tempDate || null,
      });
      setEditing(null); setTempDate("");
    } catch (e) { alert("❌ " + e.message); }
    setSaving(false);
  };

  // Chantiers filtrés : ceux non archivés en premier, puis les autres
  const sorted = [...chantiers].sort((a, b) => {
    if (a.statut === "Archivé" && b.statut !== "Archivé") return 1;
    if (a.statut !== "Archivé" && b.statut === "Archivé") return -1;
    return (a.num || "").localeCompare(b.num || "");
  });

  return (
    <div style={{ paddingTop: 12, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", color: EPJ.gray700,
          fontSize: 14, cursor: "pointer", fontFamily: font.body, padding: "6px 10px",
        }}>← Retour</button>
        <div style={{ fontFamily: font.display, fontSize: 22, color: EPJ.gray900, letterSpacing: "-0.02em" }}>
          Réceptions & garanties
        </div>
      </div>

      <div style={{
        background: `${EPJ.blue}08`, border: `1px solid ${EPJ.blue}55`,
        borderRadius: 8, padding: "10px 12px", marginBottom: 12,
        fontSize: 11, color: EPJ.gray700,
      }}>
        Saisis la date de PV de réception pour chaque chantier livré. Le système calcule automatiquement :
        <br/>• Garantie de parfait achèvement (GPA) : 1 an
        <br/>• Garantie biennale : 2 ans
      </div>

      {sorted.map(c => {
        const g = c.datePVReception ? getGaranties(c.datePVReception) : null;
        const isEditing = editing === c._id;
        const archive = c.statut === "Archivé";

        return (
          <div key={c._id} className="epj-card" style={{
            padding: 12, marginBottom: 8,
            opacity: archive ? 0.6 : 1,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: EPJ.gray900 }}>
                  {c.num} {archive && <span style={{ fontSize: 10, color: EPJ.gray500 }}>(archivé)</span>}
                </div>
                <div style={{ fontSize: 11, color: EPJ.gray500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.nom}
                </div>
              </div>
              {!isEditing && (
                <button onClick={() => startEdit(c)} style={{
                  background: EPJ.gray100, color: EPJ.gray700, border: "none",
                  borderRadius: 6, padding: "6px 10px", fontSize: 12,
                  cursor: "pointer", fontFamily: font.body,
                }}>
                  {c.datePVReception ? "✏ Modifier" : "+ Saisir"}
                </button>
              )}
            </div>

            {isEditing && (
              <div style={{ marginTop: 10, padding: 10, background: EPJ.gray50, borderRadius: 6 }}>
                <label style={{
                  display: "block", fontSize: 11, fontWeight: 700, color: EPJ.gray500,
                  textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4,
                }}>Date PV de réception</label>
                <input type="date" className="epj-input" value={tempDate}
                       onChange={e => setTempDate(e.target.value)} style={{ marginBottom: 8 }}/>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setEditing(null)} className="epj-btn" style={{
                    flex: 1, background: EPJ.gray100, color: EPJ.gray700, fontSize: 12,
                  }}>Annuler</button>
                  <button onClick={() => saveDate(c)} disabled={saving} className="epj-btn" style={{
                    flex: 2, background: EPJ.blue, color: "#fff", fontSize: 12,
                  }}>{saving ? "⏳" : "💾 Enregistrer"}</button>
                </div>
              </div>
            )}

            {!isEditing && g && (
              <>
                <div style={{ fontSize: 11, color: EPJ.gray700, marginTop: 6 }}>
                  PV le {formatDate(c.datePVReception)}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <GarantieBadge label="GPA" date={g.finGPA} active={g.gpaActive} soon={g.gpaExpireSoon}/>
                  <GarantieBadge label="Biennale" date={g.finBiennale} active={g.biennaleActive} soon={g.biennaleExpireSoon}/>
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GarantieBadge({ label, date, active, soon }) {
  const color = !active ? EPJ.red : soon ? EPJ.orange : EPJ.green;
  return (
    <div style={{
      flex: 1, padding: "6px 8px", borderRadius: 6,
      background: `${color}15`, border: `1px solid ${color}55`,
    }}>
      <div style={{ fontSize: 9, color, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 11, color: EPJ.gray900, fontWeight: 600 }}>
        {!active ? "Expirée" : soon ? "Expire bientôt" : "Active"}
      </div>
      <div style={{ fontSize: 9, color: EPJ.gray500 }}>
        jusqu'au {date.toLocaleDateString("fr-FR")}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ParcOutilRetour — Formulaire de retour d'un outil
//  - Signature OPTIONNELLE
//  - Menu déroulant pannes si outil "abîmé"
//  - Panne bloquante → outil passe en "hors_service"
// ═══════════════════════════════════════════════════════════════
import { useState, useRef } from "react";
import { db } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import { SignaturePad } from "../../core/components/SignaturePad";
import { todayISO, formatDate, getCategorieIcon } from "./parcUtils";

export function ParcOutilRetour({ outil, sortie, onBack, onDone }) {
  const { user } = useAuth();
  const { users, outillagePannes, outillageCategories } = useData();
  const toast = useToast();

  const [etatRetour, setEtatRetour] = useState("bon"); // "bon" | "abime"
  const [selectedPanneIds, setSelectedPanneIds] = useState([]);
  const [commentaireRetour, setCommentaireRetour] = useState("");
  const [showSignature, setShowSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const sigRef = useRef(null);

  const emprunteur = users.find(u => u.id === sortie.emprunteurId);
  const catIcon = getCategorieIcon(outillageCategories, outil.categorieId);

  const activePannes = [...outillagePannes]
    .filter(p => p.actif !== false)
    .sort((a, b) => (a.code || "").localeCompare(b.code || ""));

  const togglePanne = (code) => {
    setSelectedPanneIds(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  // Détecte si une des pannes sélectionnées est bloquante
  const hasBloquante = selectedPanneIds.some(code => {
    const p = outillagePannes.find(x => x.code === code || x._id === code);
    return p?.bloquante === true;
  });

  const save = async () => {
    if (etatRetour === "abime" && selectedPanneIds.length === 0) {
      toast("❌ Sélectionne au moins une panne (ou change l'état)");
      return;
    }
    setSaving(true);
    try {
      const signatureRetour = showSignature && sigRef.current && !sigRef.current.isEmpty()
        ? sigRef.current.getDataURL()
        : null;

      // 1) Mise à jour de la sortie — qui rend peut être ≠ qui a sorti
      await updateDoc(doc(db, "outillageSorties", sortie._id), {
        dateRetourReelle: todayISO(),
        signatureRetour,
        commentaireRetour: commentaireRetour.trim() || "",
        etatRetour,
        panneIds: selectedPanneIds,
        retourParUserId: user.id,
        retourParNom: `${user.prenom} ${user.nom}`,
        updatedAt: new Date().toISOString(),
      });

      // 2) Si panne bloquante → outil en hors_service
      if (hasBloquante) {
        await updateDoc(doc(db, "outils", outil._id), {
          statut: "hors_service",
          updatedAt: new Date().toISOString(),
        });
        toast(`⚠ ${outil.ref} marqué hors service (panne bloquante)`);
      } else {
        toast(`✓ ${outil.ref} retourné`);
      }
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
          }}>Retour d'outil</div>
          <div style={{
            fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3,
            textTransform: "uppercase", fontWeight: 600, marginTop: 1,
          }}>Enregistrement du retour</div>
        </div>
      </div>

      {/* Récap outil + sortie */}
      <div className="epj-card" style={{
        padding: "12px 14px", marginBottom: 12,
        display: "flex", gap: 12, alignItems: "flex-start",
        borderLeft: `3px solid ${EPJ.green}`,
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
          <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 4 }}>
            👤 Rendu par {emprunteur ? `${emprunteur.prenom} ${emprunteur.nom}` : sortie.emprunteurNom || "—"}
          </div>
          <div style={{ fontSize: 10, color: EPJ.gray500 }}>
            📅 Sorti le {formatDate(sortie.dateSortie)}
          </div>
        </div>
      </div>

      <div className="epj-card" style={{ padding: 14, marginBottom: 14 }}>
        {/* État du retour */}
        <FormRow>
          <label style={labelStyle}>État du matériel <span style={{ color: EPJ.red }}>*</span></label>
          <div style={{ display: "flex", gap: 6 }}>
            <button type="button"
              onClick={() => { setEtatRetour("bon"); setSelectedPanneIds([]); }}
              style={{
                flex: 1, padding: "14px 10px", borderRadius: 10,
                border: `2px solid ${etatRetour === "bon" ? EPJ.green : EPJ.gray200}`,
                background: etatRetour === "bon" ? `${EPJ.green}10` : EPJ.white,
                color: etatRetour === "bon" ? EPJ.green : EPJ.gray700,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: font.body,
              }}>
              ✓ Bon état
            </button>
            <button type="button"
              onClick={() => setEtatRetour("abime")}
              style={{
                flex: 1, padding: "14px 10px", borderRadius: 10,
                border: `2px solid ${etatRetour === "abime" ? EPJ.orange : EPJ.gray200}`,
                background: etatRetour === "abime" ? `${EPJ.orange}10` : EPJ.white,
                color: etatRetour === "abime" ? EPJ.orange : EPJ.gray700,
                fontSize: 13, fontWeight: 700, cursor: "pointer",
                fontFamily: font.body,
              }}>
              ⚠ Abîmé
            </button>
          </div>
        </FormRow>

        {/* Menu déroulant pannes si abîmé */}
        {etatRetour === "abime" && (
          <FormRow>
            <label style={labelStyle}>Type(s) de panne <span style={{ color: EPJ.red }}>*</span></label>
            {activePannes.length === 0 ? (
              <div style={{
                padding: 10, background: `${EPJ.red}08`, borderRadius: 6,
                fontSize: 11, color: EPJ.red,
              }}>
                Aucune panne configurée. Demande à l'admin d'en ajouter via Admin → Pannes récurrentes.
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
        )}

        {/* Commentaire */}
        <FormRow>
          <label style={labelStyle}>
            Commentaire {etatRetour === "abime" ? "(précisez la panne)" : "(optionnel)"}
          </label>
          <textarea className="epj-input" value={commentaireRetour}
            onChange={e => setCommentaireRetour(e.target.value)}
            placeholder={etatRetour === "abime"
              ? "Décris le problème constaté…"
              : "Observations éventuelles…"}
            rows={3} style={{ resize: "vertical", minHeight: 60 }}/>
        </FormRow>

        {/* Signature optionnelle */}
        <div style={{
          padding: "10px 12px", background: EPJ.gray50,
          borderRadius: 8, marginTop: 8,
        }}>
          {!showSignature ? (
            <button type="button" onClick={() => setShowSignature(true)}
              style={{
                width: "100%", padding: "10px 12px",
                background: "transparent", border: `1px dashed ${EPJ.gray300}`,
                borderRadius: 8, color: EPJ.gray600,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                fontFamily: font.body,
              }}>
              ✍ Ajouter une signature (optionnelle)
            </button>
          ) : (
            <>
              <SignaturePad ref={sigRef} label="Signature du retour" height={160}/>
              <button type="button" onClick={() => setShowSignature(false)}
                style={{
                  marginTop: 4, fontSize: 10, color: EPJ.gray500,
                  background: "transparent", border: "none",
                  cursor: "pointer", fontFamily: font.body,
                }}>
                ✕ Retirer la signature
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} className="epj-btn" style={{
          flex: 1, background: EPJ.gray100, color: EPJ.gray700,
        }}>Annuler</button>
        <button onClick={save} disabled={saving} className="epj-btn" style={{
          flex: 2, background: etatRetour === "abime" ? EPJ.orange : EPJ.green, color: "#fff",
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? "Enregistrement…" : (etatRetour === "abime" ? "⚠ Valider le retour (abîmé)" : "✓ Valider le retour")}
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

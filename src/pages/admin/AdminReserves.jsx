// ═══════════════════════════════════════════════════════════════
//  AdminReserves — Configuration du module Réserves
//  Onglets : Catégories | Émetteurs | Retards & relances | Garanties
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { db } from "../../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";
import {
  DEFAULT_RESERVES_CATEGORIES, DEFAULT_RESERVES_EMETTEURS,
  DEFAULT_RESERVES_SMS_TEMPLATES,
  isRdvEnRetard, isReserveEnRetard, formatDate,
  renderReserveSmsTemplate, buildSmsDeepLink,
  getGaranties,
} from "../../modules/reserves/reservesUtils";

export function AdminReserves({ onBack }) {
  const data = useData();
  const reservesCategories = data.reservesCategories || [];
  const reservesEmetteurs = data.reservesEmetteurs || [];
  const reserves = data.reserves || [];
  const users = data.users || [];
  const chantiers = data.chantiers || [];
  const smsTemplates = data.smsTemplates || [];
  const [tab, setTab] = useState("categories");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  // Seed des valeurs par défaut si tout est vide
  const seedDefaults = async () => {
    if (reservesCategories.length > 0 || reservesEmetteurs.length > 0) {
      if (!confirm("Des catégories/émetteurs existent déjà. Réinitialiser aux valeurs par défaut ?")) return;
    }
    setSeeding(true);
    try {
      for (const c of DEFAULT_RESERVES_CATEGORIES) {
        await setDoc(doc(db, "reservesCategories", c.id), c);
      }
      for (const e of DEFAULT_RESERVES_EMETTEURS) {
        await setDoc(doc(db, "reservesEmetteurs", e.id), e);
      }
      for (const t of DEFAULT_RESERVES_SMS_TEMPLATES) {
        await setDoc(doc(db, "smsTemplates", t.id), t);
      }
      alert("✓ Valeurs par défaut installées");
    } catch (e) { alert("❌ " + e.message); }
    setSeeding(false);
  };

  const saveItem = async (coll, item) => {
    setSaving(true);
    try {
      const id = item.id || `${coll.slice(0, 3)}_${Date.now()}`;
      await setDoc(doc(db, coll, id), { ...item, id });
      setEditing(null); setForm({});
    } catch (e) { alert("❌ " + e.message); }
    setSaving(false);
  };

  const deleteItem = async (coll, id) => {
    if (!confirm("Supprimer ?")) return;
    try { await deleteDoc(doc(db, coll, id)); }
    catch (e) { alert("❌ " + e.message); }
  };

  const enRetard = useMemo(() => {
    return reserves.filter(r => isRdvEnRetard(r) || isReserveEnRetard(r));
  }, [reserves]);

  return (
    <div style={{ paddingTop: 12, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div style={{ fontFamily: font.display, fontSize: 22, color: EPJ.gray900, letterSpacing: "-0.02em" }}>
          Config Réserves
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14, overflowX: "auto" }}>
        {[
          ["categories", "Catégories"],
          ["emetteurs", "Émetteurs"],
          ["retards", `Retards (${enRetard.length})`],
          ["garanties", "Garanties"],
        ].map(([id, lbl]) => (
          <button key={id} onClick={() => { setTab(id); setEditing(null); }} style={{
            padding: "8px 12px", borderRadius: 8, border: "none", cursor: "pointer",
            background: tab === id ? EPJ.gray900 : EPJ.gray100,
            color: tab === id ? "#fff" : EPJ.gray700, fontSize: 12, fontWeight: 600,
            fontFamily: font.body, whiteSpace: "nowrap",
          }}>{lbl}</button>
        ))}
      </div>

      {/* Bouton seed */}
      {(reservesCategories.length === 0 || reservesEmetteurs.length === 0) && (
        <div className="epj-card" style={{ padding: 12, marginBottom: 12, border: `1px dashed ${EPJ.orange}` }}>
          <div style={{ fontSize: 12, color: EPJ.gray700, marginBottom: 8 }}>
            ⚠ Aucune catégorie ou émetteur installé. Initialise avec les valeurs par défaut (modifiables après) :
          </div>
          <button onClick={seedDefaults} disabled={seeding} className="epj-btn" style={{
            width: "100%", background: EPJ.orange, color: "#fff", fontSize: 13,
          }}>{seeding ? "⏳ Installation…" : "⚙ Installer valeurs par défaut"}</button>
        </div>
      )}

      {/* ─── Onglet Catégories ─── */}
      {tab === "categories" && (
        <>
          <button onClick={() => { setEditing("new_cat"); setForm({ label: "", icon: "📦", ordre: 10, actif: true }); }}
                  className="epj-btn" style={{ width: "100%", background: EPJ.green, color: "#fff", marginBottom: 10 }}>
            + Nouvelle catégorie
          </button>
          {editing === "new_cat" && (
            <div className="epj-card" style={{ padding: 12, marginBottom: 10, border: `2px solid ${EPJ.blue}` }}>
              <input className="epj-input" placeholder="Libellé" value={form.label}
                     onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                     style={{ marginBottom: 6 }}/>
              <div style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 6, marginBottom: 8 }}>
                <input className="epj-input" placeholder="Icône" value={form.icon} maxLength={2}
                       style={{ textAlign: "center", fontSize: 18 }}
                       onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}/>
                <input className="epj-input" type="number" placeholder="Ordre"
                       value={form.ordre || 10}
                       onChange={e => setForm(f => ({ ...f, ordre: parseInt(e.target.value, 10) || 10 }))}/>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { setEditing(null); setForm({}); }} className="epj-btn"
                        style={{ flex: 1, background: EPJ.gray100, color: EPJ.gray700 }}>Annuler</button>
                <button onClick={() => saveItem("reservesCategories", form)} disabled={saving || !form.label}
                        className="epj-btn" style={{ flex: 2, background: EPJ.blue, color: "#fff" }}>
                  💾 Créer
                </button>
              </div>
            </div>
          )}
          {reservesCategories.length === 0 ? (
            <div style={{ fontSize: 12, color: EPJ.gray500, textAlign: "center", padding: 20 }}>
              Aucune catégorie.
            </div>
          ) : reservesCategories.map(c => (
            <div key={c._id} className="epj-card" style={{
              padding: "10px 12px", marginBottom: 6,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <span style={{ fontSize: 20 }}>{c.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.label}</div>
                <div style={{ fontSize: 10, color: EPJ.gray500 }}>Ordre {c.ordre}</div>
              </div>
              <button onClick={() => deleteItem("reservesCategories", c._id)} style={rowBtnStyle(EPJ.red)}>🗑</button>
            </div>
          ))}
        </>
      )}

      {/* ─── Onglet Émetteurs ─── */}
      {tab === "emetteurs" && (
        <>
          <button onClick={() => { setEditing("new_em"); setForm({ label: "", ordre: 10, actif: true }); }}
                  className="epj-btn" style={{ width: "100%", background: EPJ.green, color: "#fff", marginBottom: 10 }}>
            + Nouvel émetteur
          </button>
          {editing === "new_em" && (
            <div className="epj-card" style={{ padding: 12, marginBottom: 10, border: `2px solid ${EPJ.blue}` }}>
              <input className="epj-input" placeholder="Libellé (ex : APAVE)"
                     value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                     style={{ marginBottom: 8 }}/>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => { setEditing(null); setForm({}); }} className="epj-btn"
                        style={{ flex: 1, background: EPJ.gray100, color: EPJ.gray700 }}>Annuler</button>
                <button onClick={() => saveItem("reservesEmetteurs", form)} disabled={saving || !form.label}
                        className="epj-btn" style={{ flex: 2, background: EPJ.blue, color: "#fff" }}>
                  💾 Créer
                </button>
              </div>
            </div>
          )}
          {reservesEmetteurs.length === 0 ? (
            <div style={{ fontSize: 12, color: EPJ.gray500, textAlign: "center", padding: 20 }}>
              Aucun émetteur.
            </div>
          ) : reservesEmetteurs.map(e => (
            <div key={e._id} className="epj-card" style={{
              padding: "10px 12px", marginBottom: 6,
              display: "flex", alignItems: "center", gap: 10,
            }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{e.label}</div>
              <button onClick={() => deleteItem("reservesEmetteurs", e._id)} style={rowBtnStyle(EPJ.red)}>🗑</button>
            </div>
          ))}
        </>
      )}

      {/* ─── Onglet Retards ─── */}
      {tab === "retards" && (
        <>
          {enRetard.length === 0 ? (
            <div className="epj-card" style={{ padding: 24, textAlign: "center", color: EPJ.gray500 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✓</div>
              <div style={{ fontSize: 13 }}>Aucune réserve en retard — tout est sous contrôle.</div>
            </div>
          ) : (
            enRetard.map(r => {
              const affecte = users.find(u => u._id === r.affecteAUserId);
              const canSms = affecte?.telephone;
              const tpl = smsTemplates.find(t => t.code === "reserve_relance_rdv");
              const sendSms = () => {
                if (!affecte?.telephone) { alert("Pas de numéro pour cet intervenant."); return; }
                if (!tpl) { alert("Template SMS manquant. Installe les valeurs par défaut."); return; }
                const msg = renderReserveSmsTemplate(tpl.texte, {
                  prenom: affecte.prenom || "",
                  numReserve: r.numReserve,
                  chantier: r.chantierNum,
                  clientNom: r.clientFinal?.nom || "",
                  clientTel: r.clientFinal?.telephone || "",
                });
                window.location.href = buildSmsDeepLink(affecte.telephone, msg);
              };
              return (
                <div key={r._id} className="epj-card" style={{
                  padding: 12, marginBottom: 8, borderLeft: `3px solid ${EPJ.red}`,
                }}>
                  <div style={{ fontSize: 11, color: EPJ.red, fontWeight: 700, marginBottom: 4 }}>
                    ⏰ {isRdvEnRetard(r) ? "RDV non pris" : "Date limite dépassée"}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.numReserve} — {r.titre}</div>
                  <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 2 }}>
                    {r.chantierNum} · 👤 {r.affecteANom || "non attribué"}
                    {r.dateLimite && ` · 🎯 ${formatDate(r.dateLimite)}`}
                  </div>
                  {canSms && (
                    <button onClick={sendSms} className="epj-btn" style={{
                      marginTop: 8, width: "100%", background: EPJ.orange, color: "#fff",
                      fontSize: 12, padding: "8px",
                    }}>📱 Envoyer SMS relance à {affecte.prenom}</button>
                  )}
                </div>
              );
            })
          )}
        </>
      )}

      {/* ─── Onglet Garanties ─── */}
      {tab === "garanties" && (
        <>
          <div style={{ fontSize: 11, color: EPJ.gray500, marginBottom: 10, padding: "8px 10px", background: EPJ.gray50, borderRadius: 6 }}>
            Chantiers avec date de PV de réception : GPA (1 an) + biennale (2 ans) calculées automatiquement.
          </div>
          {chantiers.filter(c => c.datePVReception).length === 0 ? (
            <div className="epj-card" style={{ padding: 24, textAlign: "center", color: EPJ.gray500 }}>
              <div style={{ fontSize: 13 }}>Aucun chantier avec PV de réception saisi.</div>
              <div style={{ fontSize: 11, marginTop: 6 }}>
                Saisis-le dans <strong>Admin → Chantiers → Réceptions</strong>.
              </div>
            </div>
          ) : chantiers.filter(c => c.datePVReception).map(c => {
            const g = getGaranties(c.datePVReception);
            if (!g) return null;
            return (
              <div key={c._id} className="epj-card" style={{ padding: 12, marginBottom: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{c.num} — {c.nom}</div>
                <div style={{ fontSize: 10, color: EPJ.gray500, marginBottom: 6 }}>
                  PV le {formatDate(c.datePVReception)}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <GarantieBadge label="GPA" date={g.finGPA} active={g.gpaActive} soon={g.gpaExpireSoon}/>
                  <GarantieBadge label="Biennale" date={g.finBiennale} active={g.biennaleActive} soon={g.biennaleExpireSoon}/>
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function GarantieBadge({ label, date, active, soon }) {
  const color = !active ? EPJ.red : soon ? EPJ.orange : EPJ.green;
  const bg = `${color}15`;
  return (
    <div style={{
      flex: 1, padding: "6px 8px", borderRadius: 6,
      background: bg, border: `1px solid ${color}55`,
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

const backBtnStyle = {
  background: "transparent", border: "none", color: EPJ.gray700,
  fontSize: 14, cursor: "pointer", fontFamily: font.body, padding: "6px 10px",
};

function rowBtnStyle(color) {
  return {
    background: `${color}15`, color, border: "none", borderRadius: 6,
    padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: font.body,
  };
}

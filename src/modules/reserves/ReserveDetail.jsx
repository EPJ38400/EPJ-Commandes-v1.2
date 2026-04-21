// ═══════════════════════════════════════════════════════════════
//  ReserveDetail — Fiche détaillée + actions
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { can } from "../../core/permissions";
import { db } from "../../firebase";
import { doc, updateDoc, deleteDoc } from "firebase/firestore";
import {
  RESERVE_STATUTS, RESERVE_PRIORITES,
  formatDate, formatDateTime, todayISO,
  isReserveEnRetard, isRdvEnRetard,
  renderReserveSmsTemplate, buildSmsDeepLink,
  deleteReservePhoto,
} from "./reservesUtils";

export function ReserveDetail({ reserveId, onBack, onLevee }) {
  const { user } = useAuth();
  const data = useData();
  const reserves = data.reserves || [];
  const users = data.users || [];
  const reservesCategories = data.reservesCategories || [];
  const smsTemplates = data.smsTemplates || [];
  const rolesConfig = data.rolesConfig;
  const [saving, setSaving] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showPlanify, setShowPlanify] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [rdvDate, setRdvDate] = useState("");
  const [rdvHeure, setRdvHeure] = useState("");

  const reserve = reserves.find(r => r._id === reserveId);
  const canEdit = !!can(user, "reserves-quitus", "edit", rolesConfig);
  const canDelete = !!can(user, "reserves-quitus", "delete", rolesConfig);

  const affectables = useMemo(() => {
    const eligibleRoles = ["Conducteur travaux", "Chef chantier", "Monteur", "Assistante"];
    return users.filter(u => {
      const roles = Array.isArray(u.roles) ? u.roles : [u.role];
      return roles.some(r => eligibleRoles.includes(r));
    });
  }, [users]);

  if (!reserve) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 14, color: EPJ.gray500 }}>Réserve introuvable.</div>
        <button onClick={onBack} className="epj-btn" style={{
          marginTop: 16, background: EPJ.gray100, color: EPJ.gray700,
        }}>← Retour</button>
      </div>
    );
  }

  const st = RESERVE_STATUTS[reserve.statut] || RESERVE_STATUTS.creee;
  const pr = RESERVE_PRIORITES[reserve.priorite] || RESERVE_PRIORITES.normale;
  const cat = reservesCategories.find(c => c._id === reserve.categorieId);
  const retard = isReserveEnRetard(reserve) || isRdvEnRetard(reserve);

  // ─── Actions ─────────────────────────────────────────
  const doAssign = async () => {
    if (!assignUserId) return;
    const affecte = users.find(u => u._id === assignUserId);
    const affecteANom = affecte ? `${affecte.prenom || ""} ${affecte.nom || ""}`.trim() : "";
    setSaving(true);
    try {
      await updateDoc(doc(db, "reserves", reserve._id), {
        affecteAUserId: assignUserId,
        affecteANom,
        dateAffectation: todayISO(),
        statut: reserve.rdvPris ? "planifiee" : "attribuee",
      });
      setShowAssign(false);
      // Proposer SMS d'attribution
      if (affecte?.telephone) {
        const tpl = smsTemplates.find(t => t.code === "reserve_attribution");
        if (tpl && confirm(`Envoyer un SMS d'attribution à ${affecteANom} (${affecte.telephone}) ?`)) {
          const msg = renderReserveSmsTemplate(tpl.texte, {
            prenom: affecte.prenom || "",
            numReserve: reserve.numReserve,
            chantier: reserve.chantierNum,
            clientNom: reserve.clientFinal?.nom || "",
            clientTel: reserve.clientFinal?.telephone || "",
          });
          window.location.href = buildSmsDeepLink(affecte.telephone, msg);
        }
      }
    } catch (e) { alert("❌ " + e.message); }
    setSaving(false);
  };

  const doPlanify = async () => {
    if (!rdvDate) { alert("Date de RDV requise."); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, "reserves", reserve._id), {
        rdvPris: true,
        rdvDate,
        rdvHeure: rdvHeure || "",
        statut: "planifiee",
      });
      setShowPlanify(false);
    } catch (e) { alert("❌ " + e.message); }
    setSaving(false);
  };

  const doRelanceSMS = () => {
    const affecte = users.find(u => u._id === reserve.affecteAUserId);
    if (!affecte?.telephone) {
      alert("Pas de numéro de téléphone pour cet utilisateur.");
      return;
    }
    const tpl = smsTemplates.find(t => t.code === "reserve_relance_rdv");
    if (!tpl) { alert("Template SMS introuvable."); return; }
    const msg = renderReserveSmsTemplate(tpl.texte, {
      prenom: affecte.prenom || "",
      numReserve: reserve.numReserve,
      chantier: reserve.chantierNum,
      clientNom: reserve.clientFinal?.nom || "",
      clientTel: reserve.clientFinal?.telephone || "",
    });
    window.location.href = buildSmsDeepLink(affecte.telephone, msg);
  };

  const doDelete = async () => {
    if (!confirm("Supprimer définitivement cette réserve ?")) return;
    setSaving(true);
    try {
      if (reserve.photoAvantPath) await deleteReservePhoto(reserve.photoAvantPath);
      if (reserve.photoApresPath) await deleteReservePhoto(reserve.photoApresPath);
      await deleteDoc(doc(db, "reserves", reserve._id));
      onBack();
    } catch (e) { alert("❌ " + e.message); setSaving(false); }
  };

  return (
    <div style={{ paddingTop: 12, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={{
          background: "transparent", border: "none", color: EPJ.gray700,
          fontSize: 14, cursor: "pointer", fontFamily: font.body, padding: "6px 10px",
        }}>← Retour</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: font.display, fontSize: 20, color: EPJ.gray900, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {reserve.titre}
          </div>
          <div style={{ fontSize: 10, color: EPJ.gray500, fontFamily: "monospace" }}>
            {reserve.numReserve}
          </div>
        </div>
      </div>

      {/* Badges */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        <Badge color={st.color} icon={st.icon} label={st.label}/>
        <Badge color={pr.color} icon={pr.icon} label={pr.label}/>
        {cat && <Badge color={EPJ.gray700} icon={cat.icon} label={cat.label}/>}
        {retard && <Badge color={EPJ.red} icon="⏰" label="En retard"/>}
      </div>

      {/* Photo */}
      {reserve.photoAvant && (
        <div className="epj-card" style={{ padding: 6, marginBottom: 10 }}>
          <img src={reserve.photoAvant} alt="constat" style={{
            width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 8, display: "block",
          }}/>
          <div style={{ fontSize: 10, color: EPJ.gray500, textAlign: "center", marginTop: 4 }}>
            Photo du constat
          </div>
        </div>
      )}
      {reserve.photoApres && (
        <div className="epj-card" style={{ padding: 6, marginBottom: 10 }}>
          <img src={reserve.photoApres} alt="après reprise" style={{
            width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: 8, display: "block",
          }}/>
          <div style={{ fontSize: 10, color: EPJ.green, textAlign: "center", marginTop: 4, fontWeight: 600 }}>
            ✓ Photo après reprise
          </div>
        </div>
      )}

      {/* Infos */}
      <div className="epj-card" style={{ padding: 14, marginBottom: 10 }}>
        <InfoRow label="Chantier" value={`${reserve.chantierNum} — ${reserve.chantierNom || ""}`}/>
        {reserve.chantierAdresse && <InfoRow label="Adresse" value={reserve.chantierAdresse}/>}
        <EmplacementRow empl={reserve.emplacement}/>
        {reserve.description && <InfoRow label="Description" value={reserve.description} multiline/>}
      </div>

      {/* Client */}
      {reserve.clientFinal?.nom && (
        <div className="epj-card" style={{ padding: 14, marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: EPJ.gray500, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
            Client final
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: EPJ.gray900, marginBottom: 4 }}>
            {reserve.clientFinal.nom}
          </div>
          {reserve.clientFinal.telephone && (
            <div style={{ fontSize: 12, color: EPJ.blue, marginBottom: 2 }}>
              📞 <a href={`tel:${reserve.clientFinal.telephone}`} style={{ color: EPJ.blue, textDecoration: "none" }}>
                {reserve.clientFinal.telephone}
              </a>
            </div>
          )}
          {reserve.clientFinal.email && (
            <div style={{ fontSize: 12, color: EPJ.blue, marginBottom: 2 }}>
              ✉ <a href={`mailto:${reserve.clientFinal.email}`} style={{ color: EPJ.blue, textDecoration: "none" }}>
                {reserve.clientFinal.email}
              </a>
            </div>
          )}
          {reserve.clientFinal.adresseContact && (
            <div style={{ fontSize: 12, color: EPJ.gray700, marginTop: 4 }}>
              📍 {reserve.clientFinal.adresseContact}
            </div>
          )}
        </div>
      )}

      {/* Émetteur + dates */}
      <div className="epj-card" style={{ padding: 14, marginBottom: 10 }}>
        {(reserve.emisParLabel || reserve.emisParNom) && (
          <InfoRow label="Émis par" value={[reserve.emisParLabel, reserve.emisParNom].filter(Boolean).join(" — ")}/>
        )}
        <InfoRow label="Date émission" value={formatDate(reserve.dateEmission)}/>
        {reserve.dateLimite && <InfoRow label="Date limite" value={formatDate(reserve.dateLimite)}/>}
        {reserve.dateCreation && <InfoRow label="Créée le" value={formatDateTime(reserve.dateCreation)}/>}
        {reserve.creeParNom && <InfoRow label="Créée par" value={reserve.creeParNom}/>}
      </div>

      {/* Affectation */}
      <div className="epj-card" style={{ padding: 14, marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: EPJ.gray500, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
          Affectation
        </div>
        {reserve.affecteAUserId ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: EPJ.gray900 }}>
              👤 {reserve.affecteANom}
            </div>
            {reserve.dateAffectation && (
              <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 2 }}>
                Attribuée le {formatDate(reserve.dateAffectation)}
              </div>
            )}
            {reserve.rdvPris ? (
              <div style={{ fontSize: 12, color: EPJ.green, marginTop: 6, fontWeight: 600 }}>
                📅 RDV prévu le {formatDate(reserve.rdvDate)} {reserve.rdvHeure && `à ${reserve.rdvHeure}`}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: EPJ.orange, marginTop: 6, fontWeight: 600 }}>
                ⚠ RDV non encore planifié
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: 13, color: EPJ.gray500, fontStyle: "italic" }}>
            Non attribuée pour l'instant
          </div>
        )}
      </div>

      {/* Levée */}
      {["levee", "partiellement_levee", "quitus_signe"].includes(reserve.statut) && (
        <div className="epj-card" style={{ padding: 14, marginBottom: 10, borderLeft: `3px solid ${EPJ.green}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: EPJ.green, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
            Levée
          </div>
          {reserve.leveeParNom && <InfoRow label="Levée par" value={reserve.leveeParNom}/>}
          {reserve.dateLevee && <InfoRow label="Date" value={formatDate(reserve.dateLevee)}/>}
          {reserve.commentaireLevee && <InfoRow label="Commentaire" value={reserve.commentaireLevee} multiline/>}
        </div>
      )}

      {/* ─── Actions ─── */}
      {canEdit && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {!reserve.affecteAUserId && (
            <button onClick={() => setShowAssign(true)} className="epj-btn" style={actionBtnStyle(EPJ.blue)}>
              👤 Attribuer à un intervenant
            </button>
          )}
          {reserve.affecteAUserId && !reserve.rdvPris && reserve.statut === "attribuee" && (
            <>
              <button onClick={() => setShowPlanify(true)} className="epj-btn" style={actionBtnStyle(EPJ.orange)}>
                📅 Planifier le RDV
              </button>
              <button onClick={doRelanceSMS} className="epj-btn" style={actionBtnStyle(EPJ.gray700)}>
                📱 SMS de relance
              </button>
            </>
          )}
          {["attribuee", "planifiee", "intervention"].includes(reserve.statut) && (
            <button onClick={onLevee} className="epj-btn" style={actionBtnStyle(EPJ.green)}>
              ✓ Déclarer la levée
            </button>
          )}
          {reserve.affecteAUserId && (
            <button onClick={() => { setAssignUserId(""); setShowAssign(true); }} className="epj-btn" style={actionBtnStyle(EPJ.gray100, EPJ.gray700)}>
              🔄 Réattribuer
            </button>
          )}
        </div>
      )}

      {/* Modale attribution */}
      {showAssign && (
        <div className="epj-card" style={{ padding: 14, marginBottom: 12, border: `2px solid ${EPJ.blue}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Attribuer la réserve à…</div>
          <select value={assignUserId} onChange={e => setAssignUserId(e.target.value)} className="epj-input" style={{ marginBottom: 10 }}>
            <option value="">— Choisir un intervenant —</option>
            {affectables.map(u => (
              <option key={u._id} value={u._id}>
                {u.prenom} {u.nom} ({u.role || u.fonction || "—"})
              </option>
            ))}
          </select>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowAssign(false)} className="epj-btn" style={{ flex: 1, background: EPJ.gray100, color: EPJ.gray700 }}>
              Annuler
            </button>
            <button onClick={doAssign} disabled={saving || !assignUserId} className="epj-btn" style={{ flex: 2, background: EPJ.blue, color: "#fff" }}>
              ✓ Attribuer
            </button>
          </div>
        </div>
      )}

      {/* Modale planification */}
      {showPlanify && (
        <div className="epj-card" style={{ padding: 14, marginBottom: 12, border: `2px solid ${EPJ.orange}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Planifier le rendez-vous</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
            <input type="date" className="epj-input" value={rdvDate} onChange={e => setRdvDate(e.target.value)}/>
            <input type="time" className="epj-input" value={rdvHeure} onChange={e => setRdvHeure(e.target.value)}/>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => setShowPlanify(false)} className="epj-btn" style={{ flex: 1, background: EPJ.gray100, color: EPJ.gray700 }}>
              Annuler
            </button>
            <button onClick={doPlanify} disabled={saving || !rdvDate} className="epj-btn" style={{ flex: 2, background: EPJ.orange, color: "#fff" }}>
              ✓ Planifier
            </button>
          </div>
        </div>
      )}

      {/* Suppression */}
      {canDelete && (
        <button onClick={doDelete} disabled={saving} className="epj-btn" style={{
          width: "100%", background: `${EPJ.red}15`, color: EPJ.red,
          fontSize: 12, padding: "10px",
        }}>🗑 Supprimer la réserve</button>
      )}
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────
function Badge({ color, icon, label }) {
  return (
    <span style={{
      fontSize: 11, padding: "4px 8px", borderRadius: 6,
      background: `${color}22`, color, fontWeight: 600,
    }}>{icon} {label}</span>
  );
}

function InfoRow({ label, value, multiline }) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 10, color: EPJ.gray500, textTransform: "uppercase", letterSpacing: 0.3 }}>
        {label}
      </div>
      <div style={{
        fontSize: 13, color: EPJ.gray900, fontFamily: font.body,
        whiteSpace: multiline ? "pre-wrap" : "normal",
      }}>{value || "—"}</div>
    </div>
  );
}

function EmplacementRow({ empl }) {
  if (!empl) return null;
  const parts = [];
  if (empl.partiesCommunes) parts.push("Parties communes");
  if (empl.batiment) parts.push(`Bât. ${empl.batiment}`);
  if (empl.cage) parts.push(`Cage/étage ${empl.cage}`);
  if (empl.apt && !empl.partiesCommunes) parts.push(`Apt ${empl.apt}`);
  if (parts.length === 0) return null;
  return <InfoRow label="Emplacement" value={parts.join(" · ")}/>;
}

function actionBtnStyle(bg, color = "#fff") {
  return {
    width: "100%", padding: "12px", fontSize: 13, fontWeight: 600,
    background: bg, color, border: "none", borderRadius: 8, cursor: "pointer",
    fontFamily: font.body,
  };
}

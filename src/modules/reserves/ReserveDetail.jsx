// ═══════════════════════════════════════════════════════════════
//  ReserveDetail — Fiche détaillée + actions
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight, shadow } from "../../core/theme";
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
import { AttachmentsManager } from "./AttachmentsManager";
import { QuitusActions } from "./QuitusActions";
import { Badge } from "../../core/components/Badge";
import { Button } from "../../core/components/Button";
import { Field } from "../../core/components/Field";
import { IconButton } from "../../core/components/IconButton";
// v10.N — SMS attribution + demande levée
import { smsReserveAttribuee, smsReserveDemandeLevee, findUserByUid } from "../../core/smsService";
import { canDemanderLevee } from "./reservesRappel";
// ─── v1.13.0 — Brique mail ──────────────────────────────────
import { MailTimeline } from "./MailTimeline";
import { useReserveMails, useReserveEvents, addInternalNote, queueOutgoingMail } from "../../core/gmail/useReserveMails";
// ─── v1.18.0 — Édition de chantier ad hoc ───────────────────
import { ChantierEditModal } from "./ChantierEditModal";

export function ReserveDetail({ reserveId, onBack, onLevee }) {
  const { user } = useAuth();
  const data = useData();
  const reserves = data.reserves || [];
  const users = data.users || [];
  const chantiers = data.chantiers || [];
  const company = data.company || {};
  const reservesCategories = data.reservesCategories || [];
  const reservesEmetteurs = data.reservesEmetteurs || [];
  const smsTemplates = data.smsTemplates || [];
  const rolesConfig = data.rolesConfig;
  const [saving, setSaving] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [showPlanify, setShowPlanify] = useState(false);
  const [assignUserId, setAssignUserId] = useState("");
  const [rdvDate, setRdvDate] = useState("");
  const [rdvHeure, setRdvHeure] = useState("");
  // ─── v1.18.0 — Édition de chantier depuis la fiche réserve ───
  const [showChantierEdit, setShowChantierEdit] = useState(false);
  // v2.0.1 — Menu de choix modèle SMS au clic "Demander la levée"
  const [showSmsPicker, setShowSmsPicker] = useState(false);
  const [smsPickerCandidates, setSmsPickerCandidates] = useState([]);

  const reserve = reserves.find(r => r._id === reserveId);
  // ─── v1.13.0 — Brique mail ──────────────────────────────────
  const { mails } = useReserveMails(reserveId);
  const events = useReserveEvents(reserve);
  const canEdit = !!can(user, "reserves-quitus", "edit", rolesConfig);
  const canDelete = !!can(user, "reserves-quitus", "delete", rolesConfig);

  const affectables = useMemo(() => {
    return users.filter(u => {
      if (u.actif === false) return false;
      const roles = [
        ...(Array.isArray(u.roles) ? u.roles : []),
        u.role || "",
        u.fonction || "",
      ].filter(Boolean).map(r => String(r).toLowerCase());
      const isArtisan = roles.some(r => r.includes("artisan"));
      return !isArtisan;
    }).sort((a, b) => {
      const na = `${a.prenom || ""} ${a.nom || ""}`.trim();
      const nb = `${b.prenom || ""} ${b.nom || ""}`.trim();
      return na.localeCompare(nb);
    });
  }, [users]);

  if (!reserve) {
    return (
      <div style={{ padding: space.xl, textAlign: "center" }}>
        <div style={{ fontSize: fontSize.md, color: EPJ.gray500, marginBottom: space.lg }}>Réserve introuvable.</div>
        <Button variant="secondary" onClick={onBack}>← Retour</Button>
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
      // v10.N — Lors d'un transfert (re-attribution), on reset le flag rappel
      // pour que le nouveau destinataire reçoive son rappel à son tour si retard.
      const isTransfert = !!reserve.affecteAUserId && reserve.affecteAUserId !== assignUserId;
      await updateDoc(doc(db, "reserves", reserve._id), {
        affecteAUserId: assignUserId,
        affecteANom,
        dateAffectation: todayISO(),
        statut: reserve.rdvPris ? "planifiee" : "attribuee",
        // Reset du flag rappel à chaque (ré)attribution
        smsRappelRetardSent: false,
        smsRappelRetardSentAt: null,
        // Trace transfert si applicable
        ...(isTransfert ? {
          transfereParId: user?._id || "",
          transfereParNom: `${user?.prenom||""} ${user?.nom||""}`.trim(),
          dateTransfert: new Date().toISOString(),
        } : {}),
      });
      setShowAssign(false);
      // v10.N — SMS automatique au destinataire (plus de mailto/clipboard)
      if (affecte) {
        try {
          await smsReserveAttribuee({
            smsTemplates,
            destinataire: affecte,
            refReserve: reserve.numReserve,
            titreReserve: reserve.titre || "",
            chantier: reserve.chantierNom || reserve.chantierNum,
            dateLevee: reserve.dateSouhaiteLevee || "",
            rdvDate: reserve.rdvDate || "",
            rdvHeure: reserve.rdvHeure || "",
            reserveId: reserve._id,
          });
        } catch (smsErr) {
          console.warn("[v10.N] SMS attribution non bloquant:", smsErr);
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

  // v10.N — Demander la levée (SMS automatique via queue, plus de mailto/clipboard)
  // Visible pour Admin / Direction / Conducteur travaux / responsableParc.
  // Remplace l'ancien doRelanceSMS qui passait par window.location.href = sms:...
  // v2.0.1 — Accepte un templateCode (menu de choix modèle SMS).
  const doDemanderLevee = async (templateCode) => {
    const affecte = users.find(u => u._id === reserve.affecteAUserId);
    if (!affecte) {
      alert("Aucun destinataire affecté à cette réserve.");
      return;
    }
    if (!affecte.telephone && !affecte.tel) {
      alert("Pas de numéro de téléphone pour " + (affecte.prenom||"") + " " + (affecte.nom||""));
      return;
    }
    if (!confirm(`Envoyer un SMS à ${affecte.prenom} ${affecte.nom} pour la réserve ${reserve.numReserve} ?`)) return;
    try {
      const res = await smsReserveDemandeLevee({
        smsTemplates,
        destinataire: affecte,
        demandeur: user,
        refReserve: reserve.numReserve,
        titreReserve: reserve.titre || "",
        chantier: reserve.chantierNom || reserve.chantierNum,
        reserveId: reserve._id,
        templateCode,
      });
      if (res?.queued) {
        alert(`✓ SMS envoyé à ${affecte.prenom}`);
      } else {
        alert(`⚠️ SMS non envoyé : ${res?.reason || "raison inconnue"}`);
      }
    } catch (e) {
      alert("❌ Erreur : " + (e.message || e));
    }
  };

  // v2.0.1 — Templates SMS pertinents pour le clic "Demander la levée".
  // Filtre : id contient "levee" OU commence par "reserve_demande". Exclut
  // les templates désactivés. Les templates de contexte RDV (rdv_demain,
  // relance_rdv) sont volontairement exclus.
  const getLeveeRelevantTemplates = (templates) => {
    return (templates || []).filter(t => {
      if (t?.actif === false) return false;
      const id = String(t?.id || "").toLowerCase();
      return id.includes("levee") || id.startsWith("reserve_demande");
    });
  };

  // v2.0.1 — Trigger du bouton "Demander la levée".
  // 0/1 candidat → envoi auto. Plusieurs → modal de choix.
  const onClickDemanderLevee = () => {
    const candidates = getLeveeRelevantTemplates(smsTemplates);
    if (candidates.length <= 1) {
      doDemanderLevee(candidates[0]?.id);
      return;
    }
    setSmsPickerCandidates(candidates);
    setShowSmsPicker(true);
  };

  const doDelete = async () => {
    if (!confirm("Supprimer définitivement cette réserve ?")) return;
    setSaving(true);
    try {
      if (reserve.photoAvantPath) await deleteReservePhoto(reserve.photoAvantPath);
      if (reserve.photoApresPath) await deleteReservePhoto(reserve.photoApresPath);
      // Supprimer aussi toutes les pièces jointes
      for (const att of (reserve.piecesJointes || [])) {
        if (att.path) await deleteReservePhoto(att.path);
      }
      await deleteDoc(doc(db, "reserves", reserve._id));
      onBack();
    } catch (e) { alert("❌ " + e.message); setSaving(false); }
  };

  // ─── Pièces jointes ───
  const addAttachment = async (att) => {
    const current = reserve.piecesJointes || [];
    const meta = {
      ...att,
      ajoutePar: user._id,
      ajouteParNom: `${user.prenom || ""} ${user.nom || ""}`.trim(),
    };
    await updateDoc(doc(db, "reserves", reserve._id), {
      piecesJointes: [...current, meta],
    });
  };

  const removeAttachment = async (attId, attPath) => {
    const current = reserve.piecesJointes || [];
    const filtered = current.filter(a => a.id !== attId);
    await updateDoc(doc(db, "reserves", reserve._id), {
      piecesJointes: filtered,
    });
    if (attPath) {
      try { await deleteReservePhoto(attPath); } catch {}
    }
  };

  return (
    <div style={{ paddingTop: space.md, paddingBottom: space.xxl }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: space.sm, marginBottom: space.md + 2 }}>
        <Button variant="ghost" onClick={onBack}>← Retour</Button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: font.display, fontSize: fontSize.lg, color: EPJ.gray900, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {reserve.titre}
          </div>
          <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, fontFamily: font.mono }}>
            {reserve.numReserve}
          </div>
        </div>
      </div>

      {/* Badges */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm, marginBottom: space.md }}>
        <Badge status={reserve.statut} icon={st.icon} label={st.label}/>
        <Badge tone={reserve.priorite === "bloquante" ? "danger" : "warning"} icon={pr.icon} label={pr.label}/>
        {cat && <Badge tone="neutral" icon={cat.icon} label={cat.label}/>}
        {retard && <Badge tone="danger" icon="⏰" label="En retard"/>}
      </div>

      {/* Photo */}
      {reserve.photoAvant && (
        <div style={{ ...panel(), padding: space.xs + 2 }}>
          <img src={reserve.photoAvant} alt="constat" style={{
            width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: radius.md, display: "block",
          }}/>
          <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, textAlign: "center", marginTop: space.xs }}>
            Photo du constat
          </div>
        </div>
      )}
      {reserve.photoApres && (
        <div style={{ ...panel(), padding: space.xs + 2 }}>
          <img src={reserve.photoApres} alt="après reprise" style={{
            width: "100%", maxHeight: 300, objectFit: "cover", borderRadius: radius.md, display: "block",
          }}/>
          <div style={{ fontSize: fontSize.xs, color: EPJ.greenText, textAlign: "center", marginTop: space.xs, fontWeight: fontWeight.medium }}>
            ✓ Photo après reprise
          </div>
        </div>
      )}

      {/* Pièces jointes (PDFs, photos supplémentaires) */}
      <div style={panel()}>
        <div style={{ ...sectionLabel, display: "flex", alignItems: "center", gap: space.sm }}>
          📎 Pièces jointes
          {(reserve.piecesJointes || []).length > 0 && (
            <span style={{
              fontSize: fontSize.xs, padding: "2px 6px", borderRadius: radius.sm,
              background: EPJ.gray100, color: EPJ.gray700,
            }}>{reserve.piecesJointes.length}</span>
          )}
        </div>
        <AttachmentsManager
          reserveId={reserve._id}
          attachments={reserve.piecesJointes || []}
          onAdd={addAttachment}
          onRemove={removeAttachment}
          readOnly={!canEdit}
        />
      </div>

      {/* ─── v1.13.0 — Timeline mail (Conversation) ─── */}
      <MailTimeline
        mails={mails}
        events={events}
        reserve={reserve}
        canReply={canEdit}
        onReply={async (draft) => {
          await queueOutgoingMail(
            { ...draft, reserveId: reserve._id, reserveNum: reserve.numReserve },
            user._id,
          );
        }}
        onAddNote={async (texte) => {
          const auteur = `${user.prenom || ""} ${user.nom || ""}`.trim() || user._id;
          await addInternalNote(reserve._id, texte, auteur);
        }}
      />

      {/* Infos */}
      <div style={panel()}>
        {/* v1.18.0 — Chantier avec bouton d'édition ✏️ */}
        <div style={{ display: "flex", alignItems: "center", gap: space.sm, marginBottom: space.xs }}>
          <div style={{ flex: 1 }}>
            <InfoRow
              label="Chantier"
              value={`${reserve.chantierNum || ""}${reserve.chantierNom ? " — " + reserve.chantierNom : ""}`}
            />
          </div>
          <IconButton label="Modifier le chantier" onClick={() => setShowChantierEdit(true)}>
            ✏️
          </IconButton>
        </div>
        {(() => {
          const chantierDoc = chantiers.find(c => c.num === reserve.chantierNum);
          return chantierDoc?.creeAdHoc ? (
            <div style={{
              fontSize: fontSize.xs, color: EPJ.orangeText, fontWeight: fontWeight.medium,
              background: EPJ.warningBg,
              padding: `${space.xs}px ${space.sm}px`, borderRadius: radius.sm, marginBottom: space.sm,
            }}>
              ⚠ Chantier ad hoc — N° d'affaire à compléter
            </div>
          ) : null;
        })()}
        {reserve.chantierAdresse && <InfoRow label="Adresse" value={reserve.chantierAdresse}/>}
        <EmplacementRow empl={reserve.emplacement}/>
        {reserve.description && <InfoRow label="Description" value={reserve.description} multiline/>}
      </div>

      {/* Client */}
      {reserve.clientFinal?.nom && (
        <div style={panel()}>
          <div style={sectionLabel}>
            Client final
          </div>
          <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.medium, color: EPJ.gray900, marginBottom: space.xs }}>
            {reserve.clientFinal.nom}
          </div>
          {reserve.clientFinal.telephone && (
            <div style={{ fontSize: fontSize.xs, color: EPJ.blue, marginBottom: 2 }}>
              📞 <a href={`tel:${reserve.clientFinal.telephone}`} style={{ color: EPJ.blue, textDecoration: "none" }}>
                {reserve.clientFinal.telephone}
              </a>
            </div>
          )}
          {reserve.clientFinal.email && (
            <div style={{ fontSize: fontSize.xs, color: EPJ.blue, marginBottom: 2 }}>
              ✉ <a href={`mailto:${reserve.clientFinal.email}`} style={{ color: EPJ.blue, textDecoration: "none" }}>
                {reserve.clientFinal.email}
              </a>
            </div>
          )}
          {reserve.clientFinal.adresseContact && (
            <div style={{ fontSize: fontSize.xs, color: EPJ.gray700, marginTop: space.xs }}>
              📍 {reserve.clientFinal.adresseContact}
            </div>
          )}
        </div>
      )}

      {/* Émetteur + dates */}
      <div style={panel()}>
        {(reserve.emisParLabel || reserve.emisParNom) && (
          <InfoRow label="Émis par" value={[reserve.emisParLabel, reserve.emisParNom].filter(Boolean).join(" — ")}/>
        )}
        <InfoRow label="Date émission" value={formatDate(reserve.dateEmission)}/>
        {reserve.dateLimite && <InfoRow label="Date limite" value={formatDate(reserve.dateLimite)}/>}
        {reserve.dateCreation && <InfoRow label="Créée le" value={formatDateTime(reserve.dateCreation)}/>}
        {reserve.creeParNom && <InfoRow label="Créée par" value={reserve.creeParNom}/>}
      </div>

      {/* Affectation */}
      <div style={panel()}>
        <div style={sectionLabel}>
          Affectation
        </div>
        {reserve.affecteAUserId ? (
          <>
            <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.medium, color: EPJ.gray900 }}>
              👤 {reserve.affecteANom}
            </div>
            {reserve.dateAffectation && (
              <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginTop: 2 }}>
                Attribuée le {formatDate(reserve.dateAffectation)}
              </div>
            )}
            {reserve.rdvPris ? (
              <div style={{ fontSize: fontSize.xs, color: EPJ.greenText, marginTop: space.sm, fontWeight: fontWeight.medium }}>
                📅 RDV prévu le {formatDate(reserve.rdvDate)} {reserve.rdvHeure && `à ${reserve.rdvHeure}`}
              </div>
            ) : (
              <div style={{ fontSize: fontSize.xs, color: EPJ.orangeText, marginTop: space.sm, fontWeight: fontWeight.medium }}>
                ⚠ RDV non encore planifié
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, fontStyle: "italic" }}>
            Non attribuée pour l'instant
          </div>
        )}
      </div>

      {/* Levée */}
      {["levee", "partiellement_levee", "quitus_signe"].includes(reserve.statut) && (
        <div style={panel(EPJ.green)}>
          <div style={{ ...sectionLabel, color: EPJ.greenText }}>
            Levée
          </div>
          {reserve.leveeParNom && <InfoRow label="Levée par" value={reserve.leveeParNom}/>}
          {reserve.dateLevee && <InfoRow label="Date" value={formatDate(reserve.dateLevee)}/>}
          {reserve.commentaireLevee && <InfoRow label="Commentaire" value={reserve.commentaireLevee} multiline/>}
          {reserve.clientSignataireNom && (
            <InfoRow
              label="Signataire client"
              value={`${reserve.clientSignataireNom}${reserve.clientSignataireQualite ? " (" + reserve.clientSignataireQualite + ")" : ""}`}
            />
          )}

          {/* Actions sur le quitus (v10.B.2) — 3 boutons : voir / email / lien */}
          <QuitusActions
            reserve={reserve}
            chantier={chantiers.find(c => c._id === reserve.chantierId)}
            company={company}
            technicien={users.find(u => u._id === reserve.leveePar)}
            users={users}
            reservesEmetteurs={reservesEmetteurs}
          />
        </div>
      )}

      {/* ─── Actions ─── */}
      {canEdit && (
        <div style={{ display: "flex", flexDirection: "column", gap: space.sm, marginBottom: space.md }}>
          {!reserve.affecteAUserId && (
            <Button variant="primary" full onClick={() => setShowAssign(true)}>
              👤 Attribuer à un intervenant
            </Button>
          )}
          {reserve.affecteAUserId && !reserve.rdvPris && reserve.statut === "attribuee" && (
            <>
              <Button variant="secondary" full onClick={() => setShowPlanify(true)}>
                📅 Planifier le RDV
              </Button>
              {canDemanderLevee(reserve, user) && (
                <Button variant="secondary" full onClick={onClickDemanderLevee}>
                  📱 Demander la levée (SMS)
                </Button>
              )}
            </>
          )}
          {["attribuee", "planifiee", "intervention"].includes(reserve.statut) && (
            <Button variant="primary" full onClick={onLevee}>
              ✓ Déclarer la levée
            </Button>
          )}
          {/* v10.N — "Demander la levée" aussi visible sur statut planifiee/intervention pour privilégiés */}
          {reserve.affecteAUserId
            && ["planifiee", "intervention"].includes(reserve.statut)
            && canDemanderLevee(reserve, user) && (
            <Button variant="secondary" full onClick={onClickDemanderLevee}>
              📱 Demander la levée (SMS)
            </Button>
          )}
          {reserve.affecteAUserId && (
            <Button variant="ghost" full onClick={() => { setAssignUserId(""); setShowAssign(true); }}>
              🔄 Réattribuer
            </Button>
          )}
        </div>
      )}

      {/* Modale attribution */}
      {showAssign && (
        <div style={panel(EPJ.blue)}>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: space.sm }}>Attribuer la réserve à…</div>
          <div style={{ marginBottom: space.sm + 2 }}>
            <Field as="select" value={assignUserId} onChange={e => setAssignUserId(e.target.value)}
              options={[
                { value: "", label: "— Choisir un intervenant —" },
                ...affectables.map(u => {
                  const roleLabel = Array.isArray(u.roles) && u.roles.length > 0
                    ? u.roles.join(" + ")
                    : (u.role || u.fonction || "—");
                  return { value: u._id, label: `${u.prenom} ${u.nom} (${roleLabel})` };
                }),
              ]}
            />
          </div>
          {affectables.length === 0 && (
            <div style={{ fontSize: fontSize.xs, color: EPJ.orangeText, marginBottom: space.sm + 2, padding: `${space.sm - 2}px ${space.sm}px`, background: EPJ.warningBg, borderRadius: radius.sm }}>
              ⚠ Aucun utilisateur affectable. Vérifie Admin → Utilisateurs.
            </div>
          )}
          <div style={{ display: "flex", gap: space.sm }}>
            <div style={{ flex: 1 }}>
              <Button variant="ghost" full onClick={() => setShowAssign(false)}>Annuler</Button>
            </div>
            <div style={{ flex: 2 }}>
              <Button variant="primary" full onClick={doAssign} loading={saving} disabled={!assignUserId}>✓ Attribuer</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modale planification */}
      {showPlanify && (
        <div style={panel(EPJ.orange)}>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, marginBottom: space.sm }}>Planifier le rendez-vous</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space.sm, marginBottom: space.sm + 2 }}>
            <Field type="date" value={rdvDate} onChange={e => setRdvDate(e.target.value)}/>
            <Field type="time" value={rdvHeure} onChange={e => setRdvHeure(e.target.value)}/>
          </div>
          <div style={{ display: "flex", gap: space.sm }}>
            <div style={{ flex: 1 }}>
              <Button variant="ghost" full onClick={() => setShowPlanify(false)}>Annuler</Button>
            </div>
            <div style={{ flex: 2 }}>
              <Button variant="primary" full onClick={doPlanify} loading={saving} disabled={!rdvDate}>✓ Planifier</Button>
            </div>
          </div>
        </div>
      )}

      {/* Suppression */}
      {canDelete && (
        <Button variant="danger" full onClick={doDelete} loading={saving}>
          🗑 Supprimer la réserve
        </Button>
      )}

      {/* v1.18.0 — Modale d'édition du chantier */}
      {showChantierEdit && (() => {
        const chantierDoc = chantiers.find(c => c.num === reserve.chantierNum);
        if (!chantierDoc) return null;
        return (
          <ChantierEditModal
            mode="edit"
            chantier={chantierDoc}
            userId={user?._id}
            onCancel={() => setShowChantierEdit(false)}
            onSaved={async (updatedChantier) => {
              setShowChantierEdit(false);
              // Si le num du chantier a changé (régularisation N° d'affaire),
              // on met à jour les champs dénormalisés sur la réserve.
              try {
                if (updatedChantier.num !== reserve.chantierNum
                    || updatedChantier.nom !== reserve.chantierNom
                    || updatedChantier.adresse !== reserve.chantierAdresse) {
                  await updateDoc(doc(db, "reserves", reserve._id), {
                    chantierNum: updatedChantier.num,
                    chantierNom: updatedChantier.nom,
                    chantierAdresse: updatedChantier.adresse || "",
                    updatedAt: new Date().toISOString(),
                  });
                }
              } catch (err) {
                console.warn("[v1.18.0] Resync chantier sur réserve non bloquant:", err);
              }
            }}
          />
        );
      })()}

      {/* v2.0.1 — Modal de choix du modèle SMS (Demander la levée) */}
      {showSmsPicker && (
        <div onClick={() => setShowSmsPicker(false)}
             style={{position:'fixed',inset:0,background:EPJ.scrim,
                     display:'flex',alignItems:'center',justifyContent:'center',
                     zIndex:1000,padding:space.lg}}>
          <div onClick={e => e.stopPropagation()}
               style={{...panel(),boxShadow:shadow.lg,padding:space.xl,maxWidth:420,width:'100%',marginBottom:0}}>
            <div style={{fontSize:fontSize.lg,fontWeight:fontWeight.regular,marginBottom:space.xs,fontFamily:font.display}}>
              Choisir un modèle SMS
            </div>
            <div style={{fontSize:fontSize.xs,color:EPJ.gray500,marginBottom:space.lg}}>
              Plusieurs modèles sont pertinents pour la levée de cette réserve.
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:space.sm}}>
              {smsPickerCandidates.map(t => (
                <Button key={t.id} variant="secondary" full
                  onClick={() => { setShowSmsPicker(false); doDemanderLevee(t.id); }}>
                  {t.label || t.id}
                </Button>
              ))}
              <Button variant="ghost" full onClick={() => setShowSmsPicker(false)}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Styles & helpers DS-2 ───────────────────────────────
// Panneau blanc tokenisé (DA §4). accent → bordure gauche sémantique 3px.
function panel(accent) {
  return {
    background: EPJ.white,
    border: `1px solid ${EPJ.gray200}`,
    borderRadius: radius.lg,
    boxShadow: shadow.sm,
    padding: space.lg,
    marginBottom: space.md - 2,
    ...(accent ? {
      borderLeft: `3px solid ${accent}`,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    } : null),
  };
}

const sectionLabel = {
  fontSize: fontSize.xs,
  fontWeight: fontWeight.medium,
  color: EPJ.gray500,
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  marginBottom: space.sm,
};

// ─── Sous-composants ─────────────────────────────────────
function InfoRow({ label, value, multiline }) {
  return (
    <div style={{ marginBottom: space.sm - 2 }}>
      <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
      </div>
      <div style={{
        fontSize: fontSize.sm, color: EPJ.gray900, fontFamily: font.body,
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

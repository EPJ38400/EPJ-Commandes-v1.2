// ═══════════════════════════════════════════════════════════════
//  ReserveCreate — Formulaire de création d'une réserve
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect } from "react";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { can } from "../../core/permissions";
import { db } from "../../firebase";
import { doc, setDoc } from "firebase/firestore";
import {
  generateReserveNum, uploadReservePhoto, deleteReservePhoto, todayISO,
  RESERVE_PRIORITES,
} from "./reservesUtils";
import { PhotoDropZone } from "./PhotoDropZone";
import { AttachmentsManager } from "./AttachmentsManager";

export function ReserveCreate({ onDone, onCancel, prefillChantierNum }) {
  const { user } = useAuth();
  const data = useData();
  const chantiers = data.chantiers || [];
  const reserves = data.reserves || [];
  const reservesCategories = data.reservesCategories || [];
  const reservesEmetteurs = data.reservesEmetteurs || [];
  const users = data.users || [];
  const rolesConfig = data.rolesConfig;

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(null);

  // Chantier présélectionné éventuellement
  const [chantierNum, setChantierNum] = useState(prefillChantierNum || "");
  const chantier = chantiers.find(c => c.num === chantierNum);

  const [form, setForm] = useState({
    titre: "",
    description: "",
    emplacement: { batiment: "", cage: "", apt: "", partiesCommunes: false },
    clientFinal: { nom: "", telephone: "", email: "", adresseContact: "" },
    emisParLabel: "",
    emisParNom: "",
    categorieId: "",
    priorite: "normale",
    dateEmission: todayISO(),
    dateLimite: "",
    photoAvant: "",
    photoAvantPath: "",
    piecesJointes: [],
    affecteAUserId: "",
    rdvPris: false,
    rdvDate: "",
    rdvHeure: "",
  });

  // Auto-remplissage quand on sélectionne un chantier qui a déjà un clientFinal
  useEffect(() => {
    if (chantier && chantier.clientFinal && !form.clientFinal.nom) {
      setForm(f => ({ ...f, clientFinal: { ...chantier.clientFinal } }));
    }
  }, [chantier]);

  // Users affectables (tous les membres actifs sauf artisans)
  const affectables = useMemo(() => {
    return users.filter(u => {
      if (u.actif === false) return false;
      // Récupère tous les rôles/fonctions sous forme normalisée (minuscules)
      const roles = [
        ...(Array.isArray(u.roles) ? u.roles : []),
        u.role || "",
        u.fonction || "",
      ].filter(Boolean).map(r => String(r).toLowerCase());
      // On exclut uniquement les artisans
      const isArtisan = roles.some(r => r.includes("artisan"));
      return !isArtisan;
    }).sort((a, b) => {
      const na = `${a.prenom || ""} ${a.nom || ""}`.trim();
      const nb = `${b.prenom || ""} ${b.nom || ""}`.trim();
      return na.localeCompare(nb);
    });
  }, [users]);

  const chantiersVisibles = useMemo(() => {
    const viewScope = can(user, "reserves-quitus", "view", rolesConfig);
    if (viewScope === "all") return chantiers.filter(c => c.statut !== "Archivé");
    return chantiers.filter(c => {
      const aff = c.affectations || {};
      return aff.conducteurId === user._id
          || aff.chefChantierId === user._id
          || (aff.monteurIds || []).includes(user._id);
    });
  }, [chantiers, user, rolesConfig]);

  const handlePhotoFile = async (file) => {
    if (!file) return;
    const idForUpload = `tmp_${Date.now()}`;
    try {
      setUploadingPhoto("upload");
      const { url, path } = await uploadReservePhoto(idForUpload, "avant", file, setUploadingPhoto);
      setForm(f => ({ ...f, photoAvant: url, photoAvantPath: path }));
    } catch (err) {
      console.error(err);
      alert("❌ Échec upload : " + (err.message || "inconnu"));
    } finally {
      setUploadingPhoto(null);
    }
  };

  const removePhotoAvant = () => {
    setForm(f => ({ ...f, photoAvant: "", photoAvantPath: "" }));
  };

  const addAttachment = async (att) => {
    setForm(f => ({ ...f, piecesJointes: [...(f.piecesJointes || []), att] }));
  };

  const removeAttachment = async (attId, attPath) => {
    try {
      await deleteReservePhoto(attPath);
    } catch {}
    setForm(f => ({
      ...f,
      piecesJointes: (f.piecesJointes || []).filter(a => a.id !== attId),
    }));
  };

  const save = async () => {
    if (!chantierNum) { alert("Sélectionnez un chantier."); return; }
    if (!form.titre.trim()) { alert("Le titre est requis."); return; }

    setSaving(true);
    try {
      const numReserve = generateReserveNum(chantierNum, reserves);
      const id = `reserve_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

      const affecte = form.affecteAUserId ? users.find(u => u._id === form.affecteAUserId) : null;
      const affecteANom = affecte ? `${affecte.prenom || ""} ${affecte.nom || ""}`.trim() : "";

      // Déterminer le statut initial
      let statut = "creee";
      if (form.affecteAUserId) {
        statut = form.rdvPris ? "planifiee" : "attribuee";
      }

      const data = {
        id,
        numReserve,
        chantierNum,
        chantierId: chantier?._id || "",
        chantierNom: chantier?.nom || "",
        chantierAdresse: chantier?.adresse || "",
        titre: form.titre.trim(),
        description: form.description.trim(),
        emplacement: form.emplacement,
        clientFinal: form.clientFinal,
        emisParLabel: form.emisParLabel,
        emisParNom: form.emisParNom.trim(),
        categorieId: form.categorieId,
        priorite: form.priorite,
        dateEmission: form.dateEmission,
        dateLimite: form.dateLimite || "",
        photoAvant: form.photoAvant || "",
        photoAvantPath: form.photoAvantPath || "",
        piecesJointes: form.piecesJointes || [],
        affecteAUserId: form.affecteAUserId || "",
        affecteANom,
        dateAffectation: form.affecteAUserId ? todayISO() : "",
        rdvPris: form.rdvPris,
        rdvDate: form.rdvPris ? form.rdvDate : "",
        rdvHeure: form.rdvPris ? form.rdvHeure : "",
        statut,
        creePar: user._id,
        creeParNom: `${user.prenom || ""} ${user.nom || ""}`.trim(),
        dateCreation: new Date().toISOString(),
        relances: [],
      };

      await setDoc(doc(db, "reserves", id), data);
      onDone(id);
    } catch (err) {
      console.error(err);
      alert("❌ Erreur sauvegarde : " + (err.message || "inconnu"));
      setSaving(false);
    }
  };

  return (
    <div style={{ paddingTop: 12, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onCancel} style={{
          background: "transparent", border: "none", color: EPJ.gray700,
          fontSize: 14, cursor: "pointer", fontFamily: font.body, padding: "6px 10px",
        }}>← Annuler</button>
        <div style={{ fontFamily: font.display, fontSize: 22, color: EPJ.gray900, letterSpacing: "-0.02em" }}>
          Nouvelle réserve
        </div>
      </div>

      <div className="epj-card" style={{ padding: 14, marginBottom: 12 }}>
        {/* Chantier */}
        <FieldLabel>Chantier *</FieldLabel>
        <select value={chantierNum} onChange={e => setChantierNum(e.target.value)}
                className="epj-input" style={{ marginBottom: 12 }}>
          <option value="">— Sélectionner un chantier —</option>
          {chantiersVisibles.map(c => (
            <option key={c.num} value={c.num}>
              {c.num} — {c.nom}
            </option>
          ))}
        </select>

        {chantier && (
          <div style={{
            fontSize: 11, color: EPJ.gray500, background: EPJ.gray50,
            padding: "6px 10px", borderRadius: 6, marginBottom: 12,
          }}>
            📍 {chantier.adresse || "(adresse non renseignée)"}
          </div>
        )}

        {/* Titre + description */}
        <FieldLabel>Titre *</FieldLabel>
        <input className="epj-input" value={form.titre} style={{ marginBottom: 10 }}
               onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
               placeholder="Ex : Prise de courant manquante salle de bain"/>

        <FieldLabel>Description détaillée</FieldLabel>
        <textarea className="epj-input" value={form.description} style={{ marginBottom: 10, minHeight: 70, resize: "vertical" }}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Détails du problème observé..."/>

        {/* Emplacement */}
        <FieldLabel>Emplacement</FieldLabel>
        <div style={{
          display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
          padding: "8px 10px", borderRadius: 6,
          background: form.emplacement.partiesCommunes ? `${EPJ.orange}15` : EPJ.gray50,
          border: `1px solid ${form.emplacement.partiesCommunes ? EPJ.orange : EPJ.gray200}`,
        }}>
          <input type="checkbox" checked={form.emplacement.partiesCommunes}
                 onChange={e => setForm(f => ({
                   ...f, emplacement: { ...f.emplacement, partiesCommunes: e.target.checked },
                 }))}/>
          <span style={{ fontSize: 13 }}>Parties communes (couloir, cage, hall, etc.)</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
          <input className="epj-input" placeholder="Bâtiment (ex : A)"
                 value={form.emplacement.batiment}
                 onChange={e => setForm(f => ({ ...f, emplacement: { ...f.emplacement, batiment: e.target.value } }))}/>
          <input className="epj-input" placeholder="Cage / Étage"
                 value={form.emplacement.cage}
                 onChange={e => setForm(f => ({ ...f, emplacement: { ...f.emplacement, cage: e.target.value } }))}/>
        </div>
        {!form.emplacement.partiesCommunes && (
          <input className="epj-input" placeholder="N° d'appartement (ex : 3.2)"
                 value={form.emplacement.apt} style={{ marginBottom: 10 }}
                 onChange={e => setForm(f => ({ ...f, emplacement: { ...f.emplacement, apt: e.target.value } }))}/>
        )}

        {/* Client final */}
        <FieldLabel>Client final (occupant)</FieldLabel>
        <input className="epj-input" placeholder="Nom du client"
               value={form.clientFinal.nom} style={{ marginBottom: 6 }}
               onChange={e => setForm(f => ({ ...f, clientFinal: { ...f.clientFinal, nom: e.target.value } }))}/>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 6 }}>
          <input className="epj-input" placeholder="Téléphone" type="tel"
                 value={form.clientFinal.telephone}
                 onChange={e => setForm(f => ({ ...f, clientFinal: { ...f.clientFinal, telephone: e.target.value } }))}/>
          <input className="epj-input" placeholder="Email" type="email"
                 value={form.clientFinal.email}
                 onChange={e => setForm(f => ({ ...f, clientFinal: { ...f.clientFinal, email: e.target.value } }))}/>
        </div>
        <input className="epj-input" placeholder="Adresse de contact (si différente du chantier)"
               value={form.clientFinal.adresseContact} style={{ marginBottom: 12 }}
               onChange={e => setForm(f => ({ ...f, clientFinal: { ...f.clientFinal, adresseContact: e.target.value } }))}/>

        {/* Émetteur */}
        <FieldLabel>Émetteur de la réserve</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
          <select value={form.emisParLabel} onChange={e => setForm(f => ({ ...f, emisParLabel: e.target.value }))}
                  className="epj-input">
            <option value="">— Type —</option>
            {(reservesEmetteurs || []).filter(x => x.actif !== false).map(em => (
              <option key={em._id} value={em.label}>{em.label}</option>
            ))}
          </select>
          <input className="epj-input" placeholder="Nom précis (ex : Cabinet Dubois)"
                 value={form.emisParNom}
                 onChange={e => setForm(f => ({ ...f, emisParNom: e.target.value }))}/>
        </div>

        {/* Catégorie + priorité */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
          <div>
            <FieldLabel>Catégorie</FieldLabel>
            <select value={form.categorieId} onChange={e => setForm(f => ({ ...f, categorieId: e.target.value }))}
                    className="epj-input">
              <option value="">— Choisir —</option>
              {(reservesCategories || []).filter(c => c.actif !== false).map(c =>
                <option key={c._id} value={c._id}>{c.icon} {c.label}</option>
              )}
            </select>
          </div>
          <div>
            <FieldLabel>Priorité</FieldLabel>
            <select value={form.priorite} onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}
                    className="epj-input">
              {Object.entries(RESERVE_PRIORITES).map(([k, v]) =>
                <option key={k} value={k}>{v.icon} {v.label}</option>
              )}
            </select>
          </div>
        </div>

        {/* Dates */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
          <div>
            <FieldLabel>Date d'émission</FieldLabel>
            <input type="date" className="epj-input" value={form.dateEmission}
                   onChange={e => setForm(f => ({ ...f, dateEmission: e.target.value }))}/>
          </div>
          <div>
            <FieldLabel>Date limite</FieldLabel>
            <input type="date" className="epj-input" value={form.dateLimite}
                   onChange={e => setForm(f => ({ ...f, dateLimite: e.target.value }))}/>
          </div>
        </div>

        {/* Photo constat (mise en avant) */}
        <FieldLabel>Photo (constat du problème)</FieldLabel>
        <PhotoDropZone
          photoUrl={form.photoAvant}
          uploadingLabel={uploadingPhoto}
          onFileSelected={handlePhotoFile}
          onRemove={removePhotoAvant}
        />

        {/* Pièces jointes : images + PDFs (ex : PDF de la MOE, photos complémentaires) */}
        <FieldLabel>Pièces jointes (PDF maître d'œuvre, photos complémentaires…)</FieldLabel>
        <AttachmentsManager
          reserveId={`tmp_${Date.now()}`}
          attachments={form.piecesJointes || []}
          onAdd={addAttachment}
          onRemove={removeAttachment}
        />

        {/* Affectation */}
        <FieldLabel>Attribuer à</FieldLabel>
        <select value={form.affecteAUserId} onChange={e => setForm(f => ({ ...f, affecteAUserId: e.target.value }))}
                className="epj-input" style={{ marginBottom: 10 }}>
          <option value="">— Aucun (à attribuer plus tard) —</option>
          {affectables.map(u => {
            const roleLabel = Array.isArray(u.roles) && u.roles.length > 0
              ? u.roles.join(" + ")
              : (u.role || u.fonction || "—");
            return (
              <option key={u._id} value={u._id}>
                {u.prenom} {u.nom} ({roleLabel})
              </option>
            );
          })}
        </select>
        {affectables.length === 0 && (
          <div style={{ fontSize: 11, color: EPJ.orange, marginBottom: 10, padding: "6px 10px", background: `${EPJ.orange}15`, borderRadius: 6 }}>
            ⚠ Aucun utilisateur affectable trouvé. Vérifie que tes utilisateurs ont un rôle actif dans Admin → Utilisateurs.
          </div>
        )}

        {/* RDV */}
        {form.affecteAUserId && (
          <>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "8px 10px", borderRadius: 6,
              background: form.rdvPris ? `${EPJ.green}15` : EPJ.gray50,
              border: `1px solid ${form.rdvPris ? EPJ.green : EPJ.gray200}`,
              marginBottom: 8,
            }}>
              <input type="checkbox" checked={form.rdvPris}
                     onChange={e => setForm(f => ({ ...f, rdvPris: e.target.checked }))}/>
              <span style={{ fontSize: 13 }}>RDV déjà pris avec le client</span>
            </div>
            {form.rdvPris && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 10 }}>
                <input type="date" className="epj-input" value={form.rdvDate}
                       onChange={e => setForm(f => ({ ...f, rdvDate: e.target.value }))}/>
                <input type="time" className="epj-input" value={form.rdvHeure}
                       onChange={e => setForm(f => ({ ...f, rdvHeure: e.target.value }))}/>
              </div>
            )}
            {!form.rdvPris && (
              <div style={{ fontSize: 11, color: EPJ.gray500, marginBottom: 10, padding: "6px 10px", background: EPJ.gray50, borderRadius: 6 }}>
                ⏰ L'intervenant devra prendre RDV. Relances automatiques si RDV non pris après 2 jours.
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onCancel} className="epj-btn" style={{
          flex: 1, background: EPJ.gray100, color: EPJ.gray700,
        }}>Annuler</button>
        <button onClick={save} disabled={saving || !!uploadingPhoto} className="epj-btn" style={{
          flex: 2, background: EPJ.blue, color: "#fff",
          opacity: saving || uploadingPhoto ? 0.5 : 1,
        }}>{saving ? "⏳ Enregistrement…" : "💾 Créer la réserve"}</button>
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <label style={{
      display: "block", fontSize: 11, fontWeight: 700, color: EPJ.gray500,
      textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3,
    }}>{children}</label>
  );
}

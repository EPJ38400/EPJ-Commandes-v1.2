// ═══════════════════════════════════════════════════════════════
//  ReserveCreate — Formulaire de création d'une réserve
//  v1.18.0 — Brique chantier ad hoc + auto-remplissage depuis mail
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight, shadow } from "../../core/theme";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { can } from "../../core/permissions";
import { db } from "../../firebase";
import { doc, setDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import {
  generateReserveNum, uploadReservePhoto, deleteReservePhoto, todayISO,
  RESERVE_PRIORITES,
} from "./reservesUtils";
import { PhotoDropZone } from "./PhotoDropZone";
import { AttachmentsManager } from "./AttachmentsManager";
// v10.I — SMS au conducteur du chantier à la création d'une réserve
import { smsReserveAttribuee, findUserByUid } from "../../core/smsService";
// v1.18.0 — Création/édition de chantier ad hoc
import { ChantierEditModal } from "./ChantierEditModal";

const CHANTIER_NEW_SENTINEL = "__NEW_CHANTIER__";

export function ReserveCreate({ onDone, onCancel, prefillChantierNum, prefillFromMail }) {
  const { user } = useAuth();
  const data = useData();
  const chantiers = data.chantiers || [];
  const reserves = data.reserves || [];
  const reservesCategories = data.reservesCategories || [];
  const reservesEmetteurs = data.reservesEmetteurs || [];
  const users = data.users || [];
  const rolesConfig = data.rolesConfig;
  const smsTemplates = data.smsTemplates || []; // v10.I — pour SMS conducteur

  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(null);

  // v1.18.0 — Modale de création de chantier ad hoc
  const [showChantierModal, setShowChantierModal] = useState(false);

  // Chantier présélectionné éventuellement
  const [chantierNum, setChantierNum] = useState(prefillChantierNum || "");
  const chantier = chantiers.find(c => c.num === chantierNum);

  // v1.18.0 — Match d'une catégorie depuis la "categorieGuess" de l'IA
  const matchCategorieIdFromGuess = (guess) => {
    if (!guess) return "";
    const g = String(guess).toLowerCase().trim();
    const found = reservesCategories.find(c => {
      const id = String(c._id || "").toLowerCase();
      const lbl = String(c.label || "").toLowerCase();
      return id === g || lbl === g || id.includes(g) || lbl.includes(g);
    });
    return found?._id || "";
  };

  // v1.18.0 — Match d'un émetteur depuis le "emisParLabel" de l'IA
  const matchEmetteurFromLabel = (label) => {
    if (!label) return "";
    const l = String(label).toLowerCase().trim();
    const found = reservesEmetteurs.find(e => {
      const id = String(e._id || "").toLowerCase();
      const lbl = String(e.label || "").toLowerCase();
      return id === l || lbl === l || id.includes(l) || lbl.includes(l);
    });
    return found?.label || label;
  };

  const [form, setForm] = useState(() => {
    // ─── v1.18.0 — Pré-remplissage depuis brouillon IA si on vient d'un mail ───
    const brouillon = prefillFromMail?.brouillon || null;
    if (brouillon) {
      return {
        titre: brouillon.titre || (brouillon.description ? brouillon.description.slice(0, 80) : ""),
        description: brouillon.description || "",
        emplacement: {
          batiment: brouillon.emplacement || "",
          cage: "",
          apt: "",
          partiesCommunes: false,
        },
        clientFinal: {
          nom: brouillon.clientFinal?.nom || "",
          telephone: brouillon.clientFinal?.telephone || "",
          email: brouillon.clientFinal?.email || "",
          adresseContact: "",
        },
        emisParLabel: matchEmetteurFromLabel(brouillon.emisParLabel),
        emisParNom: brouillon.emisParNom || "",
        categorieId: matchCategorieIdFromGuess(brouillon.categorieGuess),
        priorite: brouillon.priorite || "normale",
        dateEmission: todayISO(),
        dateLimite: "",
        photoAvant: "",
        photoAvantPath: "",
        // v1.18.0 — Copie des pièces jointes du mail dans la réserve
        piecesJointes: (prefillFromMail?.mailDoc?.piecesJointes || []).map(pj => ({
          id: pj.id || `pj_mail_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          nom: pj.nom,
          url: pj.url,
          path: pj.path || "",
          contentType: pj.contentType || "",
          tailleKo: pj.tailleKo || 0,
          kind: pj.kind || "image",
          origineMail: true,
        })),
        affecteAUserId: "",
        rdvPris: false,
        rdvDate: "",
        rdvHeure: "",
      };
    }
    // Pas de mail → valeurs par défaut classiques
    return {
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
    };
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
      // v10.N — SMS UNIQUEMENT à l'attribution (Point 1 = A : pas de SMS à la création).
      // Si la réserve est créée AVEC attribution dans la foulée, SMS au destinataire.
      try {
        if (form.affecteAUserId) {
          const destinataire = findUserByUid(form.affecteAUserId, users);
          if (destinataire) {
            await smsReserveAttribuee({
              smsTemplates,
              destinataire,
              refReserve: numReserve,
              titreReserve: form.titre || "",
              chantier: chantier?.nom || chantierNum,
              dateLevee: form.dateSouhaiteLevee || "",
              rdvDate: form.rdvPris ? form.rdvDate : "",
              rdvHeure: form.rdvPris ? form.rdvHeure : "",
              reserveId: id,
            });
          }
        }
      } catch(smsErr) {
        console.warn("[v10.N] SMS attribution non bloquant:", smsErr);
      }

      // ─── v1.18.0 — Rattacher le mail à la réserve nouvellement créée ───
      // Si on vient de l'écran "Mails à classer", on doit :
      //   1. Créer le doc dans reserveMails (avec direction "in", reserveId, etc.)
      //   2. Marquer le doc dans reserveMailsAClasser comme "classe"
      // NB : MailsAClasser passe le mail dans prefillFromMail.mailDoc
      //      (pas directement à la racine de prefillFromMail).
      const mail = prefillFromMail?.mailDoc;
      if (mail?._id) {
        try {
          const mailRef = doc(db, "reserveMails", `mail_${mail.gmailId}_${Date.now()}`);
          await setDoc(mailRef, {
            gmailId: mail.gmailId,
            gmailThreadId: mail.gmailThreadId,
            reserveId: id,
            reserveNum: numReserve,
            chantierNum,
            direction: "in",
            expediteurNom: mail.expediteurNom || "",
            expediteurEmail: mail.expediteurEmail || "",
            destinataires: mail.destinataires || [],
            cc: mail.cc || [],
            bcc: mail.bcc || [],
            sujet: mail.sujet || "",
            dateEnvoi: mail.dateEnvoi || null,
            dateAspiration: mail.dateAspiration || serverTimestamp(),
            corpsHtml: mail.corpsHtml || "",
            corpsTexte: mail.corpsTexte || "",
            apercu: mail.apercu || "",
            piecesJointes: mail.piecesJointes || [],
            rattachementMethode: "manuel_creation_reserve",
            rattachementScore: 1.0,
            rattachementParUserId: user._id,
            rattachementDate: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Marquer le mail dans reserveMailsAClasser comme classé
          await updateDoc(doc(db, "reserveMailsAClasser", mail._id), {
            statut: "classe",
            classeVersReserveId: id,
            classeVersReserveNum: numReserve,
            classeParUserId: user._id,
            classeAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (mailErr) {
          console.warn("[v1.18.0] Rattachement mail non bloquant:", mailErr);
        }
      }

      onDone(id);
    } catch (err) {
      console.error(err);
      alert("❌ Erreur sauvegarde : " + (err.message || "inconnu"));
      setSaving(false);
    }
  };

  // Options des selects (Field as="select")
  const chantierOptions = [
    { value: "", label: "— Sélectionner un chantier —" },
    { value: CHANTIER_NEW_SENTINEL, label: "➕ Créer un nouveau chantier" },
    ...chantiersVisibles.map(c => ({ value: c.num, label: `${c.num} — ${c.nom}` })),
  ];
  const emetteurOptions = [
    { value: "", label: "— Type —" },
    ...(reservesEmetteurs || []).filter(x => x.actif !== false).map(em => ({ value: em.label, label: em.label })),
  ];
  const categorieOptions = [
    { value: "", label: "— Choisir —" },
    ...(reservesCategories || []).filter(c => c.actif !== false).map(c => ({ value: c._id, label: `${c.icon} ${c.label}` })),
  ];
  const prioriteOptions = Object.entries(RESERVE_PRIORITES).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` }));
  const affecteOptions = [
    { value: "", label: "— Aucun (à attribuer plus tard) —" },
    ...affectables.map(u => {
      const roleLabel = Array.isArray(u.roles) && u.roles.length > 0
        ? u.roles.join(" + ")
        : (u.role || u.fonction || "—");
      return { value: u._id, label: `${u.prenom} ${u.nom} (${roleLabel})` };
    }),
  ];

  return (
    <div style={{ paddingTop: space.md, paddingBottom: space.xxl }}>
      <div style={{ display: "flex", alignItems: "center", gap: space.sm, marginBottom: space.md + 2 }}>
        <Button variant="ghost" onClick={onCancel}>← Annuler</Button>
        <div style={{ fontFamily: font.display, fontSize: 22, color: EPJ.gray900, letterSpacing: "-0.02em" }}>
          Nouvelle réserve
        </div>
      </div>

      <div style={panel}>
        {/* Chantier */}
        <div style={{ marginBottom: space.md }}>
          <Field as="select" label="Chantier" required
            value={chantierNum}
            options={chantierOptions}
            onChange={e => {
              const v = e.target.value;
              if (v === CHANTIER_NEW_SENTINEL) {
                // v1.18.0 — Ouvre la modale de création de chantier ad hoc
                setShowChantierModal(true);
                // ne change PAS le state chantierNum pour l'instant
                // (la modale appellera onSaved qui le mettra à jour)
              } else {
                setChantierNum(v);
              }
            }}
          />
        </div>

        {chantier && (
          <div style={{
            fontSize: fontSize.xs, color: EPJ.gray500, background: EPJ.gray50,
            padding: `${space.sm - 2}px ${space.sm}px`, borderRadius: radius.sm, marginBottom: space.md,
          }}>
            📍 {chantier.adresse || "(adresse non renseignée)"}
            {chantier.creeAdHoc && (
              <span style={{ marginLeft: space.sm, color: EPJ.orangeText, fontWeight: fontWeight.medium }}>
                · Ad hoc (N° d'affaire à compléter)
              </span>
            )}
          </div>
        )}

        {/* Titre + description */}
        <div style={{ marginBottom: space.sm + 2 }}>
          <Field label="Titre" required value={form.titre}
            onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
            placeholder="Ex : Prise de courant manquante salle de bain"/>
        </div>
        <div style={{ marginBottom: space.sm + 2 }}>
          <Field as="textarea" label="Description détaillée" value={form.description} rows={3}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Détails du problème observé..."/>
        </div>

        {/* Emplacement */}
        <FieldLabel>Emplacement</FieldLabel>
        <label style={{
          display: "flex", alignItems: "center", gap: space.sm, marginBottom: space.sm,
          padding: `${space.sm}px ${space.sm + 2}px`, borderRadius: radius.sm, cursor: "pointer",
          background: form.emplacement.partiesCommunes ? EPJ.warningBg : EPJ.gray50,
          border: `1px solid ${form.emplacement.partiesCommunes ? EPJ.orange : EPJ.gray200}`,
        }}>
          <input type="checkbox" checked={form.emplacement.partiesCommunes}
                 onChange={e => setForm(f => ({
                   ...f, emplacement: { ...f.emplacement, partiesCommunes: e.target.checked },
                 }))}/>
          <span style={{ fontSize: fontSize.sm }}>Parties communes (couloir, cage, hall, etc.)</span>
        </label>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space.sm, marginBottom: space.sm + 2 }}>
          <Field placeholder="Bâtiment (ex : A)"
            value={form.emplacement.batiment}
            onChange={e => setForm(f => ({ ...f, emplacement: { ...f.emplacement, batiment: e.target.value } }))}/>
          <Field placeholder="Cage / Étage"
            value={form.emplacement.cage}
            onChange={e => setForm(f => ({ ...f, emplacement: { ...f.emplacement, cage: e.target.value } }))}/>
        </div>
        {!form.emplacement.partiesCommunes && (
          <div style={{ marginBottom: space.sm + 2 }}>
            <Field placeholder="N° d'appartement (ex : 3.2)"
              value={form.emplacement.apt}
              onChange={e => setForm(f => ({ ...f, emplacement: { ...f.emplacement, apt: e.target.value } }))}/>
          </div>
        )}

        {/* Client final */}
        <FieldLabel>Client final (occupant)</FieldLabel>
        <div style={{ marginBottom: space.sm }}>
          <Field placeholder="Nom du client"
            value={form.clientFinal.nom}
            onChange={e => setForm(f => ({ ...f, clientFinal: { ...f.clientFinal, nom: e.target.value } }))}/>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space.sm, marginBottom: space.sm }}>
          <Field placeholder="Téléphone" type="tel"
            value={form.clientFinal.telephone}
            onChange={e => setForm(f => ({ ...f, clientFinal: { ...f.clientFinal, telephone: e.target.value } }))}/>
          <Field placeholder="Email" type="email"
            value={form.clientFinal.email}
            onChange={e => setForm(f => ({ ...f, clientFinal: { ...f.clientFinal, email: e.target.value } }))}/>
        </div>
        <div style={{ marginBottom: space.md }}>
          <Field placeholder="Adresse de contact (si différente du chantier)"
            value={form.clientFinal.adresseContact}
            onChange={e => setForm(f => ({ ...f, clientFinal: { ...f.clientFinal, adresseContact: e.target.value } }))}/>
        </div>

        {/* Émetteur */}
        <FieldLabel>Émetteur de la réserve</FieldLabel>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space.sm, marginBottom: space.sm + 2 }}>
          <Field as="select" value={form.emisParLabel} options={emetteurOptions}
            onChange={e => setForm(f => ({ ...f, emisParLabel: e.target.value }))}/>
          <Field placeholder="Nom précis (ex : Cabinet Dubois)"
            value={form.emisParNom}
            onChange={e => setForm(f => ({ ...f, emisParNom: e.target.value }))}/>
        </div>

        {/* Catégorie + priorité */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space.sm, marginBottom: space.sm + 2 }}>
          <Field as="select" label="Catégorie" value={form.categorieId} options={categorieOptions}
            onChange={e => setForm(f => ({ ...f, categorieId: e.target.value }))}/>
          <Field as="select" label="Priorité" value={form.priorite} options={prioriteOptions}
            onChange={e => setForm(f => ({ ...f, priorite: e.target.value }))}/>
        </div>

        {/* Dates */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space.sm, marginBottom: space.sm + 2 }}>
          <Field type="date" label="Date d'émission" value={form.dateEmission}
            onChange={e => setForm(f => ({ ...f, dateEmission: e.target.value }))}/>
          <Field type="date" label="Date limite" value={form.dateLimite}
            onChange={e => setForm(f => ({ ...f, dateLimite: e.target.value }))}/>
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
        <div style={{ marginTop: space.sm + 2, marginBottom: space.sm + 2 }}>
          <Field as="select" label="Attribuer à" value={form.affecteAUserId} options={affecteOptions}
            onChange={e => setForm(f => ({ ...f, affecteAUserId: e.target.value }))}/>
        </div>
        {affectables.length === 0 && (
          <div style={{ fontSize: fontSize.xs, color: EPJ.orangeText, marginBottom: space.sm + 2, padding: `${space.sm - 2}px ${space.sm}px`, background: EPJ.warningBg, borderRadius: radius.sm }}>
            ⚠ Aucun utilisateur affectable trouvé. Vérifie que tes utilisateurs ont un rôle actif dans Admin → Utilisateurs.
          </div>
        )}

        {/* RDV */}
        {form.affecteAUserId && (
          <>
            <label style={{
              display: "flex", alignItems: "center", gap: space.sm, cursor: "pointer",
              padding: `${space.sm}px ${space.sm + 2}px`, borderRadius: radius.sm,
              background: form.rdvPris ? EPJ.successBg : EPJ.gray50,
              border: `1px solid ${form.rdvPris ? EPJ.green : EPJ.gray200}`,
              marginBottom: space.sm,
            }}>
              <input type="checkbox" checked={form.rdvPris}
                     onChange={e => setForm(f => ({ ...f, rdvPris: e.target.checked }))}/>
              <span style={{ fontSize: fontSize.sm }}>RDV déjà pris avec le client</span>
            </label>
            {form.rdvPris && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: space.sm, marginBottom: space.sm + 2 }}>
                <Field type="date" value={form.rdvDate}
                  onChange={e => setForm(f => ({ ...f, rdvDate: e.target.value }))}/>
                <Field type="time" value={form.rdvHeure}
                  onChange={e => setForm(f => ({ ...f, rdvHeure: e.target.value }))}/>
              </div>
            )}
            {!form.rdvPris && (
              <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginBottom: space.sm + 2, padding: `${space.sm - 2}px ${space.sm}px`, background: EPJ.gray50, borderRadius: radius.sm }}>
                ⏰ L'intervenant devra prendre RDV. Relances automatiques si RDV non pris après 2 jours.
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: space.sm }}>
        <div style={{ flex: 1 }}>
          <Button variant="ghost" full onClick={onCancel}>Annuler</Button>
        </div>
        <div style={{ flex: 2 }}>
          <Button variant="primary" full onClick={save} loading={saving} disabled={!!uploadingPhoto}>
            💾 Créer la réserve
          </Button>
        </div>
      </div>

      {/* v1.18.0 — Modale de création de chantier ad hoc */}
      {showChantierModal && (
        <ChantierEditModal
          mode="create"
          prefillNom={prefillFromMail?.brouillon?.chantierGuess || ""}
          prefillAdresse={prefillFromMail?.brouillon?.emplacement || ""}
          userId={user?._id}
          onCancel={() => setShowChantierModal(false)}
          onSaved={(newChantier) => {
            setShowChantierModal(false);
            // Sélectionne automatiquement le chantier qu'on vient de créer
            setChantierNum(newChantier.num);
          }}
        />
      )}
    </div>
  );
}

// Panneau blanc tokenisé (DA §4).
const panel = {
  background: EPJ.white,
  border: `1px solid ${EPJ.gray200}`,
  borderRadius: radius.lg,
  boxShadow: shadow.sm,
  padding: space.lg,
  marginBottom: space.md,
};

// Label de section (groupes de champs partageant une étiquette).
function FieldLabel({ children }) {
  return (
    <label style={{
      display: "block", fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: EPJ.gray500,
      textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: space.xs,
    }}>{children}</label>
  );
}

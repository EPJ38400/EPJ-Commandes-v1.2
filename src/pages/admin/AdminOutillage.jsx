// ═══════════════════════════════════════════════════════════════
//  AdminOutillage v8 — Gestion du catalogue du parc machines
//  + Bouton d'import initial (223 outils, 18 catégories, 8 pannes)
//  Accessible à : Admin + Direction + Assistante
// ═══════════════════════════════════════════════════════════════
import { useState, useRef } from "react";
import { db } from "../../firebase";
import { doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import { getRoles } from "../../core/permissions";
import {
  OUTIL_STATUTS, canGererCatalogue,
  uploadOutilPhoto, deleteOutilPhoto, generateId,
  getCategorieIcon, getCategorieLabel,
} from "../../modules/parc-machines/parcUtils";
import { INITIAL_OUTILS, INITIAL_CATEGORIES, INITIAL_PANNES } from "../../modules/parc-machines/initialOutils";

export function AdminOutillage({ onBack }) {
  const { user } = useAuth();
  const { outils, outillageCategories, outillagePannes, users } = useData();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | "new" | outilId
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(null);
  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [importing, setImporting] = useState(null); // null | "outils" | "categories" | "pannes"
  const fileInputRef = useRef(null);

  if (!canGererCatalogue(user)) {
    return (
      <div style={{ paddingTop: 20 }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: EPJ.gray900 }}>Accès restreint</div>
          <div style={{ fontSize: 12, color: EPJ.gray500, marginTop: 6 }}>
            Seuls Admin / Direction / Assistante peuvent gérer le catalogue d'outils.
          </div>
        </div>
      </div>
    );
  }

  // ─── Imports initiaux ───────────────────────────────────────
  const importOutilsInitiaux = async () => {
    if (outils.length > 0) {
      toast("❌ Le catalogue contient déjà " + outils.length + " outil(s). Supprimez-les d'abord si vous voulez réimporter.");
      return;
    }
    if (!confirm(`⚠ Importer le catalogue initial ?\n\n${INITIAL_OUTILS.length} outils seront ajoutés en base Firestore.\nCette action créera un document par outil.\n\nContinuer ?`)) return;

    setImporting("outils");
    try {
      // Firebase batch limit = 500 writes, on est safe avec 223
      const batch = writeBatch(db);
      const now = new Date().toISOString();
      INITIAL_OUTILS.forEach((o, i) => {
        const id = generateId("outil_");
        batch.set(doc(db, "outils", id), {
          id,
          ref: o.ref,
          nom: o.nom,
          categorieId: o.categorieId,
          codeBarres: o.codeBarres || "",
          marque: "",
          numSerie: "",
          notes: "",
          statut: "disponible",
          photoURL: "",
          photoPath: "",
          affectationPermanenteUserId: null,
          createdAt: now,
          updatedAt: now,
        });
      });
      await batch.commit();
      toast(`✓ ${INITIAL_OUTILS.length} outils importés avec succès`);
    } catch (e) {
      console.error(e);
      toast("❌ Erreur import : " + e.message);
    } finally {
      setImporting(null);
    }
  };

  const importCategoriesInitiales = async () => {
    if (outillageCategories.length > 0) {
      toast(`❌ ${outillageCategories.length} catégorie(s) déjà présente(s). Supprimez-les d'abord.`);
      return;
    }
    if (!confirm(`Importer les 18 catégories métier EPJ ?`)) return;
    setImporting("categories");
    try {
      const batch = writeBatch(db);
      INITIAL_CATEGORIES.forEach(c => {
        batch.set(doc(db, "outillageCategories", c.id), c);
      });
      await batch.commit();
      toast(`✓ ${INITIAL_CATEGORIES.length} catégories importées`);
    } catch (e) {
      console.error(e);
      toast("❌ " + e.message);
    } finally {
      setImporting(null);
    }
  };

  const importPannesInitiales = async () => {
    if (outillagePannes.length > 0) {
      toast(`❌ ${outillagePannes.length} panne(s) déjà présente(s). Supprimez-les d'abord.`);
      return;
    }
    if (!confirm(`Importer les 8 pannes récurrentes ?`)) return;
    setImporting("pannes");
    try {
      const batch = writeBatch(db);
      INITIAL_PANNES.forEach(p => {
        batch.set(doc(db, "outillagePannes", p.code), { id: p.code, ...p });
      });
      await batch.commit();
      toast(`✓ ${INITIAL_PANNES.length} pannes importées`);
    } catch (e) {
      console.error(e);
      toast("❌ " + e.message);
    } finally {
      setImporting(null);
    }
  };

  // ─── CRUD outil ─────────────────────────────────────────────
  const startNew = () => {
    const firstCat = outillageCategories.find(c => c.actif !== false);
    setForm({
      _id: "",
      ref: "",
      nom: "",
      categorieId: firstCat?.id || "",
      codeBarres: "",
      numSerie: "",
      marque: "",
      notes: "",
      statut: "disponible",
      photoURL: "",
      photoPath: "",
      affectationPermanenteUserId: null,
    });
    setEditing("new");
  };

  const startEdit = (o) => {
    setForm({
      _id: o._id,
      ref: o.ref || "",
      nom: o.nom || "",
      categorieId: o.categorieId || "",
      codeBarres: o.codeBarres || "",
      numSerie: o.numSerie || "",
      marque: o.marque || "",
      notes: o.notes || "",
      statut: o.statut || "disponible",
      photoURL: o.photoURL || "",
      photoPath: o.photoPath || "",
      affectationPermanenteUserId: o.affectationPermanenteUserId || null,
    });
    setEditing(o._id);
  };

  const cancel = () => { setEditing(null); setForm({}); };

  const save = async () => {
    if (!form.ref || !form.nom) {
      toast("❌ Référence et désignation requises");
      return;
    }
    setSaving(true);
    try {
      const id = editing === "new" ? generateId("outil_") : form._id;
      const existing = outils.find(o => o._id === form._id);
      const payload = {
        id,
        ref: form.ref.trim(),
        nom: form.nom.trim(),
        categorieId: form.categorieId,
        codeBarres: form.codeBarres?.trim() || "",
        numSerie: form.numSerie?.trim() || "",
        marque: form.marque?.trim() || "",
        notes: form.notes?.trim() || "",
        statut: form.statut,
        photoURL: form.photoURL || "",
        photoPath: form.photoPath || "",
        affectationPermanenteUserId: form.affectationPermanenteUserId || null,
        createdAt: editing === "new" ? new Date().toISOString() : (existing?.createdAt || new Date().toISOString()),
        updatedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, "outils", id), payload);
      toast(editing === "new" ? "✓ Outil ajouté" : "✓ Outil mis à jour");
      cancel();
    } catch (e) {
      console.error(e);
      toast("❌ " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast("❌ Choisissez une image"); return; }
    if (file.size > 10 * 1024 * 1024) { toast("❌ Image trop lourde (max 10 Mo)"); return; }

    const idForUpload = form._id || `tmp_${Date.now()}`;
    try {
      const oldPath = form.photoPath;
      setUploadingPhoto("upload");
      const { url, path } = await uploadOutilPhoto(idForUpload, file, (step) => setUploadingPhoto(step));
      setForm(f => ({ ...f, photoURL: url, photoPath: path }));
      if (oldPath) await deleteOutilPhoto(oldPath);
      toast("✓ Photo téléversée");
    } catch (err) {
      console.error(err);
      toast("❌ Échec : " + (err.message || "upload"));
    } finally {
      setUploadingPhoto(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemovePhoto = async () => {
    if (!confirm("Supprimer la photo ?")) return;
    const oldPath = form.photoPath;
    setForm(f => ({ ...f, photoURL: "", photoPath: "" }));
    if (oldPath) await deleteOutilPhoto(oldPath);
    toast("Photo supprimée");
  };

  const remove = async (outil) => {
    if (!confirm(`Supprimer définitivement "${outil.ref} — ${outil.nom}" ?\n\nCette action est irréversible.`)) return;
    try {
      if (outil.photoPath) await deleteOutilPhoto(outil.photoPath);
      await deleteDoc(doc(db, "outils", outil._id));
      toast("🗑 Outil supprimé");
    } catch (e) { toast("❌ " + e.message); }
  };

  // ─── Formulaire création/édition ────────────────────────────
  if (editing) {
    const isNew = editing === "new";
    const userAffecte = form.affectationPermanenteUserId
      ? users.find(u => u.id === form.affectationPermanenteUserId)
      : null;

    return (
      <div style={{ paddingTop: 12, paddingBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button onClick={cancel} style={backBtnStyle}>← Retour</button>
          <div style={{
            fontFamily: font.display, fontSize: 20, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em",
          }}>{isNew ? "Nouvel outil" : "Modifier l'outil"}</div>
        </div>

        <div className="epj-card" style={{ padding: 14, marginBottom: 14 }}>
          {/* Photo */}
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Photo</label>
            {form.photoURL ? (
              <div style={{ position: "relative", marginTop: 4 }}>
                <img src={form.photoURL} alt="outil" style={{
                  width: "100%", maxHeight: 240, objectFit: "cover",
                  borderRadius: 10, border: `1px solid ${EPJ.gray200}`,
                }}/>
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  <button onClick={() => fileInputRef.current?.click()} disabled={!!uploadingPhoto} style={photoBtnStyle(EPJ.gray100, EPJ.gray700)}>📷 Remplacer</button>
                  <button onClick={handleRemovePhoto} style={photoBtnStyle(`${EPJ.red}15`, EPJ.red)}>🗑 Supprimer</button>
                </div>
              </div>
            ) : (
              <button onClick={() => fileInputRef.current?.click()} disabled={!!uploadingPhoto} style={{
                width: "100%", padding: "24px 12px", border: `2px dashed ${EPJ.gray300}`,
                borderRadius: 10, background: EPJ.gray50,
                color: EPJ.gray500, fontSize: 13, fontWeight: 600,
                cursor: uploadingPhoto ? "wait" : "pointer", fontFamily: font.body,
              }}>{uploadingPhoto ? `📤 ${uploadingPhoto}` : "📷 Ajouter une photo"}</button>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelect} style={{ display: "none" }}/>
            <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 4, lineHeight: 1.4 }}>
              L'image sera compressée (max 1024 px). Sur mobile, prise de photo directe possible.
            </div>
          </div>

          <FormRow>
            <label style={labelStyle}>Référence <span style={{ color: EPJ.red }}>*</span></label>
            <input className="epj-input" value={form.ref}
              onChange={e => setForm(f => ({ ...f, ref: e.target.value }))}
              placeholder="ex: PERCEUSE/001"
              style={{ fontFamily: "monospace" }}/>
          </FormRow>

          <FormRow>
            <label style={labelStyle}>Désignation <span style={{ color: EPJ.red }}>*</span></label>
            <input className="epj-input" value={form.nom}
              onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
              placeholder="ex: Perceuse à percussion Makita"/>
          </FormRow>

          <FormRow>
            <label style={labelStyle}>Catégorie</label>
            {outillageCategories.length === 0 ? (
              <div style={{ fontSize: 12, color: EPJ.red, padding: "6px 0" }}>
                ⚠ Aucune catégorie. Importe d'abord les catégories initiales ou crée-les dans Admin → Catégories outillage.
              </div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {outillageCategories.filter(c => c.actif !== false).map(cat => (
                  <button key={cat.id} type="button"
                    onClick={() => setForm(f => ({ ...f, categorieId: cat.id }))}
                    style={{
                      padding: "6px 10px", borderRadius: 999,
                      border: `1px solid ${form.categorieId === cat.id ? EPJ.gray900 : EPJ.gray200}`,
                      background: form.categorieId === cat.id ? `${EPJ.gray900}08` : EPJ.white,
                      color: form.categorieId === cat.id ? EPJ.gray900 : EPJ.gray600,
                      fontSize: 11, fontWeight: 600, cursor: "pointer",
                      fontFamily: font.body,
                    }}>
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            )}
          </FormRow>

          <FormRow>
            <label style={labelStyle}>Marque</label>
            <input className="epj-input" value={form.marque}
              onChange={e => setForm(f => ({ ...f, marque: e.target.value }))}
              placeholder="ex: Makita, Bosch, Hilti…"/>
          </FormRow>

          <FormRow>
            <label style={labelStyle}>Numéro de série</label>
            <input className="epj-input" value={form.numSerie}
              onChange={e => setForm(f => ({ ...f, numSerie: e.target.value }))}
              placeholder="optionnel" style={{ fontFamily: "monospace" }}/>
          </FormRow>

          <FormRow>
            <label style={labelStyle}>Code-barres</label>
            <input className="epj-input" value={form.codeBarres}
              onChange={e => setForm(f => ({ ...f, codeBarres: e.target.value }))}
              placeholder="optionnel" style={{ fontFamily: "monospace" }}/>
          </FormRow>

          {/* AFFECTATION PERMANENTE */}
          <FormRow>
            <label style={labelStyle}>Affectation permanente</label>
            <div style={{
              fontSize: 11, color: EPJ.gray500, marginBottom: 8, lineHeight: 1.5,
            }}>
              Attribue cet outil de façon permanente à un employé (ex: visseuse personnelle d'un monteur).
              L'outil ne pourra plus être sorti par d'autres jusqu'à retrait de l'affectation.
            </div>
            <select className="epj-input"
              value={form.affectationPermanenteUserId || ""}
              onChange={e => setForm(f => ({ ...f, affectationPermanenteUserId: e.target.value || null }))}
              style={{ width: "100%" }}>
              <option value="">— Aucune affectation (outil partagé) —</option>
              {[...users].sort((a, b) => (a.nom || "").localeCompare(b.nom || "")).map(u => (
                <option key={u.id} value={u.id}>
                  {u.prenom} {u.nom}
                </option>
              ))}
            </select>
            {userAffecte && (
              <div style={{
                marginTop: 6, padding: "6px 10px",
                background: `${EPJ.blue}12`, borderRadius: 6,
                fontSize: 11, color: EPJ.blue, fontWeight: 600,
              }}>👤 Attribué à : {userAffecte.prenom} {userAffecte.nom}</div>
            )}
          </FormRow>

          <FormRow>
            <label style={labelStyle}>Statut</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["disponible", "maintenance", "hors_service"].map(k => {
                const meta = OUTIL_STATUTS[k];
                return (
                  <button key={k} type="button"
                    onClick={() => setForm(f => ({ ...f, statut: k }))}
                    style={{
                      padding: "6px 10px", borderRadius: 999,
                      border: `1px solid ${form.statut === k ? meta.color : EPJ.gray200}`,
                      background: form.statut === k ? `${meta.color}15` : EPJ.white,
                      color: form.statut === k ? meta.color : EPJ.gray600,
                      fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font.body,
                    }}>
                    {meta.icon} {meta.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 4, lineHeight: 1.4 }}>
              "Sorti", "En retard" et "Attribué" sont calculés automatiquement.
            </div>
          </FormRow>

          <FormRow>
            <label style={labelStyle}>Notes</label>
            <textarea className="epj-input" value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Remarques, consignes particulières…"
              rows={3} style={{ resize: "vertical", minHeight: 60 }}/>
          </FormRow>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={cancel} className="epj-btn" style={{ flex: 1, background: EPJ.gray100, color: EPJ.gray700 }}>Annuler</button>
          <button onClick={save} disabled={saving || !!uploadingPhoto} className="epj-btn" style={{
            flex: 2, background: EPJ.gray900, color: "#fff",
            opacity: saving || uploadingPhoto ? 0.6 : 1,
          }}>
            {saving ? "Enregistrement…" : (isNew ? "Créer l'outil" : "Enregistrer")}
          </button>
        </div>
      </div>
    );
  }

  // ─── Liste ─────────────────────────────────────────────────
  const sortedOutils = [...outils].sort((a, b) => (a.ref || "").localeCompare(b.ref || ""));
  const filtered = sortedOutils.filter(o => {
    if (catFilter && o.categorieId !== catFilter) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      (o.ref || "").toLowerCase().includes(q) ||
      (o.nom || "").toLowerCase().includes(q) ||
      (o.marque || "").toLowerCase().includes(q) ||
      (o.numSerie || "").toLowerCase().includes(q) ||
      (o.codeBarres || "").toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: font.display, fontSize: 20, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.15,
          }}>Catalogue outillage</div>
          <div style={{
            fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3,
            textTransform: "uppercase", fontWeight: 600, marginTop: 1,
          }}>{outils.length} outil{outils.length > 1 ? "s" : ""} — {outillageCategories.length} catégorie{outillageCategories.length > 1 ? "s" : ""}</div>
        </div>
      </div>

      {/* Bloc imports initiaux — visible tant que tout n'est pas importé */}
      {(outils.length === 0 || outillageCategories.length === 0 || outillagePannes.length === 0) && (
        <div className="epj-card" style={{
          padding: 16, marginBottom: 14,
          background: `${EPJ.orange}0A`,
          borderLeft: `3px solid ${EPJ.orange}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900, marginBottom: 6 }}>
            🚀 Imports initiaux
          </div>
          <div style={{ fontSize: 11, color: EPJ.gray700, lineHeight: 1.5, marginBottom: 10 }}>
            Importe les données EPJ (18 catégories, 8 pannes récurrentes, 223 outils) pour démarrer rapidement.
            Les étapes 1 et 2 doivent être faites avant l'étape 3.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button onClick={importCategoriesInitiales}
              disabled={!!importing || outillageCategories.length > 0}
              style={{
                ...seedBtnStyle,
                opacity: outillageCategories.length > 0 ? 0.5 : 1,
              }}>
              {importing === "categories"
                ? "⏳ Import…"
                : outillageCategories.length > 0
                  ? `✓ 1. Catégories importées (${outillageCategories.length})`
                  : "1. Importer les 18 catégories EPJ"}
            </button>
            <button onClick={importPannesInitiales}
              disabled={!!importing || outillagePannes.length > 0}
              style={{
                ...seedBtnStyle,
                opacity: outillagePannes.length > 0 ? 0.5 : 1,
              }}>
              {importing === "pannes"
                ? "⏳ Import…"
                : outillagePannes.length > 0
                  ? `✓ 2. Pannes importées (${outillagePannes.length})`
                  : "2. Importer les 8 pannes récurrentes"}
            </button>
            <button onClick={importOutilsInitiaux}
              disabled={!!importing || outils.length > 0 || outillageCategories.length === 0}
              style={{
                ...seedBtnStyle,
                opacity: (outils.length > 0 || outillageCategories.length === 0) ? 0.5 : 1,
              }}>
              {importing === "outils"
                ? "⏳ Import 223 outils en cours…"
                : outils.length > 0
                  ? `✓ 3. Outils importés (${outils.length})`
                  : outillageCategories.length === 0
                    ? "3. Importer les 223 outils (importe d'abord les catégories)"
                    : "3. Importer les 223 outils EPJ"}
            </button>
          </div>
        </div>
      )}

      <button onClick={startNew} disabled={outillageCategories.length === 0} className="epj-btn" style={{
        width: "100%", background: EPJ.gray900, color: "#fff", marginBottom: 12,
        opacity: outillageCategories.length === 0 ? 0.5 : 1,
      }}>+ Ajouter un outil</button>

      {outils.length > 0 && (
        <>
          <input className="epj-input" value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="🔍 Rechercher (référence, nom, marque, code-barres…)"
            style={{ marginBottom: 8 }}/>

          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
            <button onClick={() => setCatFilter("")} style={filterChipStyle(catFilter === "")}>Toutes</button>
            {outillageCategories.filter(c => c.actif !== false).map(cat => (
              <button key={cat.id} onClick={() => setCatFilter(cat.id)} style={filterChipStyle(catFilter === cat.id)}>
                {cat.icon} {cat.label}
              </button>
            ))}
          </div>
        </>
      )}

      {filtered.length === 0 ? (
        outils.length > 0 ? (
          <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 13, color: EPJ.gray500 }}>Aucun résultat pour cette recherche.</div>
          </div>
        ) : null
      ) : (
        filtered.map(o => {
          const catIcon = getCategorieIcon(outillageCategories, o.categorieId);
          const catLabel = getCategorieLabel(outillageCategories, o.categorieId);
          return (
            <div key={o._id} className="epj-card" style={{ padding: "12px 14px", marginBottom: 8 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                {o.photoURL ? (
                  <img src={o.photoURL} alt="" style={{
                    width: 54, height: 54, borderRadius: 8, objectFit: "cover",
                    flexShrink: 0, border: `1px solid ${EPJ.gray200}`,
                  }}/>
                ) : (
                  <div style={{
                    width: 54, height: 54, borderRadius: 8,
                    background: EPJ.gray100, display: "flex", alignItems: "center",
                    justifyContent: "center", fontSize: 24, flexShrink: 0,
                  }}>{catIcon}</div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: EPJ.gray900, fontFamily: "monospace" }}>
                    {o.ref}
                  </div>
                  <div style={{ fontSize: 12, color: EPJ.gray700, marginTop: 1 }}>{o.nom}</div>
                  <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 3 }}>
                    {catIcon} {catLabel}
                    {o.marque ? ` • ${o.marque}` : ""}
                    {o.numSerie ? ` • N° ${o.numSerie}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => startEdit(o)} style={actionBtnStyle(EPJ.gray100, EPJ.gray700)}>✏</button>
                  <button onClick={() => remove(o)} style={actionBtnStyle(`${EPJ.red}12`, EPJ.red)}>🗑</button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

// ─── Styles ──────────────────────────────────────────────────
const backBtnStyle = {
  background: EPJ.gray100, border: "none", borderRadius: 10,
  padding: "9px 14px", fontSize: 13, fontWeight: 600,
  color: EPJ.gray700, cursor: "pointer", fontFamily: font.body,
  whiteSpace: "nowrap", flexShrink: 0,
};
const labelStyle = {
  display: "block", fontSize: 10, fontWeight: 600,
  color: EPJ.gray500, letterSpacing: 0.4, textTransform: "uppercase",
  marginBottom: 4,
};
const seedBtnStyle = {
  width: "100%", padding: "9px 12px", borderRadius: 8,
  border: `1px solid ${EPJ.orange}`, background: `${EPJ.orange}12`,
  color: EPJ.orange, fontSize: 12, fontWeight: 600,
  cursor: "pointer", fontFamily: "Inter, sans-serif",
  textAlign: "left",
};
function FormRow({ children }) { return <div style={{ marginBottom: 12 }}>{children}</div>; }
function filterChipStyle(active) {
  return {
    padding: "6px 10px", borderRadius: 999,
    border: `1px solid ${active ? EPJ.gray900 : EPJ.gray200}`,
    background: active ? EPJ.gray900 : EPJ.white,
    color: active ? "#fff" : EPJ.gray700,
    fontSize: 11, fontWeight: 600, cursor: "pointer",
    fontFamily: "Inter, sans-serif",
  };
}
function actionBtnStyle(bg, color) {
  return {
    background: bg, color, border: "none", borderRadius: 6,
    padding: "6px 9px", fontSize: 12, fontWeight: 600,
    cursor: "pointer", fontFamily: "Inter, sans-serif",
  };
}
function photoBtnStyle(bg, color) {
  return {
    flex: 1, background: bg, color, border: "none", borderRadius: 8,
    padding: "8px 10px", fontSize: 12, fontWeight: 600,
    cursor: "pointer", fontFamily: "Inter, sans-serif",
  };
}

// ═══════════════════════════════════════════════════════════════
//  AdminOutillage — Gestion du catalogue du parc machines
//  + Bouton d'import initial (catégories, pannes) + import/export Excel
//  Accessible à : Admin + Direction + Assistante
//
//  DS-2 (pilote) : repeinte design-system + adaptation desktop.
//  Conforme à docs/DIRECTION_ARTISTIQUE.md. Affichage uniquement —
//  logique métier, requêtes Firestore et schémas INCHANGÉS.
// ═══════════════════════════════════════════════════════════════
import { useState, useRef } from "react";
import { db } from "../../firebase";
import { doc, setDoc, deleteDoc, writeBatch } from "firebase/firestore";
import { EPJ, font, radius, space, fontSize, fontWeight, shadow } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useViewport } from "../../core/useViewport";
import { useToast } from "../../core/components/Toast";
import { ModuleSubHeader } from "../../core/components/ModuleSubHeader";
import { Button } from "../../core/components/Button";
import { Field } from "../../core/components/Field";
import { Badge } from "../../core/components/Badge";
import { StatCard } from "../../core/components/StatCard";
import { DataTable } from "../../core/components/DataTable";
import {
  OUTIL_STATUTS, canGererCatalogue, canImportExportOutils,
  uploadOutilPhoto, deleteOutilPhoto, generateId,
  getCategorieIcon, getCategorieLabel,
  computeOutilStatut, findSortieEnCours,
} from "../../modules/parc-machines/parcUtils";
import { INITIAL_CATEGORIES, INITIAL_PANNES } from "../../modules/parc-machines/initialOutils";
// v10.M — Import/Export Excel du parc d'outils
import {
  exportOutilsToExcel, parseOutilsFromExcel, validateImportRows,
  buildOutilDocFromRow, countActiveSorties,
} from "../../modules/parc-machines/outilsImporter";

// ─── Statut effectif → props <Badge> (table de correspondance locale,
//     adossée à la table centrale du composant Badge quand elle existe) ──
const STATUT_BADGE = {
  disponible:   { status: "Disponible" },
  maintenance:  { status: "Maintenance" },
  hors_service: { status: "Hors service" },
  sorti:        { tone: "info",   label: "Sorti" },
  en_retard:    { tone: "danger", label: "En retard" },
  affecte:      { tone: "info",   label: "Attribué" },
};
function badgePropsFor(statutEff) {
  return STATUT_BADGE[statutEff] || { tone: "neutral", label: OUTIL_STATUTS[statutEff]?.label || statutEff };
}

// Chips de filtre statut (vue liste)
const STATUT_CHIPS = [
  { key: "",             label: "Tous" },
  { key: "disponible",   label: "Disponibles" },
  { key: "sorti",        label: "Sortis" },
  { key: "maintenance",  label: "Maintenance" },
  { key: "hors_service", label: "Hors service" },
];

export function AdminOutillage({ onBack }) {
  const { user } = useAuth();
  const { outils, outillageCategories, outillagePannes, users, outillageSorties = [], loaded } = useData();
  const isPwa = useViewport() === "mobile";
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | "new" | outilId
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(null);
  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [statutFilter, setStatutFilter] = useState(""); // filtre client (affichage only)
  const [importing, setImporting] = useState(null); // null | "outils" | "categories" | "pannes"
  const fileInputLibraryRef = useRef(null);
  const fileInputCameraRef = useRef(null);
  // v10.M — Import/Export Excel
  const [importPreview, setImportPreview] = useState(null); // null | { rows, errors, newCount, existingCount, mode, file }
  const fileInputExcelRef = useRef(null);
  const userCanImportExport = canImportExportOutils(user);

  if (!canGererCatalogue(user)) {
    return (
      <div style={{ paddingTop: space.xl }}>
        <div style={{ marginBottom: space.md }}>
          <Button variant="secondary" icon="←" onClick={onBack}>Retour</Button>
        </div>
        <div style={cardPanel()}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: space.sm }}>🔒</div>
            <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.medium, color: EPJ.gray900 }}>Accès restreint</div>
            <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginTop: space.xs + 2 }}>
              Seuls Admin / Direction / Assistante peuvent gérer le catalogue d'outils.
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Imports initiaux ───────────────────────────────────────
  // v10.M — L'import initial des 223 outils a été retiré : il est remplacé
  // par le bloc « Import / Export du parc » plus bas (fichier Excel).
  // On garde les imports initiaux de catégories et de pannes (juste pour
  // amorcer un parc vide rapidement, ils ne grossissent pas le bundle).

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
      isPack: false,
      packContent: [],
    });
    setEditing("new");
  };

  // ─── v10.M — Export Excel du parc actuel ─────────────────────
  const handleExportExcel = () => {
    if (!userCanImportExport) {
      toast("❌ Réservé Admin / Direction / Responsable parc");
      return;
    }
    try {
      const blob = exportOutilsToExcel(outils, outillageCategories);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
      a.href = url;
      a.download = `EPJ_parc_outils_${today}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`✓ Export généré : ${outils.length} outils`);
    } catch (e) {
      console.error(e);
      toast("❌ Erreur export : " + (e.message || e));
    }
  };

  // ─── v10.M — Sélection du fichier Excel à importer ──────────
  // Le bouton "Importer (Mettre à jour)" pré-positionne mode='update',
  // le bouton "Tout remplacer" pré-positionne mode='replace'.
  const handlePickExcel = (mode) => {
    if (!userCanImportExport) {
      toast("❌ Réservé Admin / Direction / Responsable parc");
      return;
    }
    // Gate "tout remplacer" : on bloque si sorties actives en cours.
    if (mode === "replace") {
      const nbActive = countActiveSorties(outillageSorties);
      if (nbActive > 0) {
        toast(`❌ Impossible : ${nbActive} sortie(s) d'outil(s) en cours. Récupère-les avant de tout remplacer.`);
        return;
      }
    }
    // Stocke le mode pour qu'on s'en souvienne après que l'utilisateur ait choisi le fichier
    fileInputExcelRef.current._mode = mode;
    fileInputExcelRef.current.value = ""; // reset pour re-déclencher onChange si même fichier
    fileInputExcelRef.current.click();
  };

  // ─── v10.M — Quand le fichier Excel est choisi → parse + preview ──
  const handleExcelFileChosen = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mode = e.target._mode || "update";
    try {
      const parsed = await parseOutilsFromExcel(file);
      if (parsed.errors && parsed.errors.length > 0) {
        toast("❌ " + parsed.errors[0]);
        return;
      }
      const v = validateImportRows(parsed.rows, outils);
      setImportPreview({
        mode,
        file: file.name,
        valid: v.valid,
        errors: v.errors,
        duplicatesInFile: v.duplicatesInFile,
        newCount: v.newCount,
        existingCount: v.existingCount,
        totalInFile: parsed.rows.length,
      });
    } catch (err) {
      toast("❌ Lecture impossible : " + (err.message || err));
    }
  };

  // ─── v10.M — Exécution de l'import après confirmation ────────
  const handleImportConfirm = async () => {
    if (!importPreview || !userCanImportExport) return;
    const { mode, valid } = importPreview;
    if (valid.length === 0) {
      toast("❌ Aucune ligne valide à importer");
      return;
    }

    // Double confirmation pour le mode "tout remplacer"
    if (mode === "replace") {
      const okFirst = confirm(
        `⚠️ ATTENTION : action IRRÉVERSIBLE.\n\n` +
        `Cette action va SUPPRIMER tous les ${outils.length} outils existants\n` +
        `et les remplacer par les ${valid.length} outils du fichier.\n\n` +
        `Les sorties d'outils historiques (déjà retournées) seront conservées,\n` +
        `mais les liens vers des outils supprimés deviendront orphelins.\n\n` +
        `Continuer ?`
      );
      if (!okFirst) return;
      const typed = prompt(`Tape exactement "REMPLACER" (en MAJUSCULES) pour confirmer la suppression de tous les outils existants :`);
      if (typed !== "REMPLACER") {
        toast("❌ Annulé — la chaîne saisie ne correspond pas");
        return;
      }
    } else {
      // Mode "Mettre à jour" : confirmation simple
      const ok = confirm(
        `Confirmer la mise à jour ?\n\n` +
        `• ${importPreview.newCount} nouveau(x) outil(s) seront ajouté(s)\n` +
        `• ${importPreview.existingCount} outil(s) existant(s) seront mis à jour\n` +
        `• Les outils non présents dans le fichier resteront inchangés`
      );
      if (!ok) return;
    }

    setImporting("excel");
    try {
      // Index des outils existants par référence (lowercase)
      const byRef = new Map();
      outils.forEach(o => {
        if (o.ref) byRef.set(o.ref.toLowerCase(), o);
      });

      // Mode replace : supprime TOUS les outils existants d'abord
      if (mode === "replace") {
        // Batch suppression (max 500 writes par batch Firestore)
        for (let i = 0; i < outils.length; i += 400) {
          const batch = writeBatch(db);
          outils.slice(i, i + 400).forEach(o => {
            batch.delete(doc(db, "outils", o._id || o.id));
          });
          await batch.commit();
        }
      }

      // Upsert toutes les lignes valides
      for (let i = 0; i < valid.length; i += 400) {
        const batch = writeBatch(db);
        valid.slice(i, i + 400).forEach(row => {
          // En mode replace, pas d'existing (tout est supprimé)
          const existing = mode === "replace" ? null : byRef.get(row.ref.toLowerCase());
          const newId = generateId("outil_");
          const docData = buildOutilDocFromRow(row, existing, newId);
          batch.set(doc(db, "outils", docData.id), docData);
        });
        await batch.commit();
      }

      const msg = mode === "replace"
        ? `✓ Remplacement OK — ${valid.length} outil(s) importé(s)`
        : `✓ Mise à jour OK — ${importPreview.newCount} ajout(s), ${importPreview.existingCount} mise(s) à jour`;
      toast(msg);
      setImportPreview(null);
    } catch (err) {
      console.error("[v10.M] import error:", err);
      toast("❌ Erreur import : " + (err.message || err));
    } finally {
      setImporting(null);
    }
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
      isPack: o.isPack === true,
      packContent: Array.isArray(o.packContent) ? o.packContent : [],
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
        isPack: form.isPack === true,
        packContent: form.isPack && Array.isArray(form.packContent) ? form.packContent : [],
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
      if (fileInputLibraryRef.current) fileInputLibraryRef.current.value = "";
      if (fileInputCameraRef.current) fileInputCameraRef.current.value = "";
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

    const catOptions = [
      { value: "", label: "— Sélectionner une catégorie —" },
      ...outillageCategories
        .filter(c => c.actif !== false)
        .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
        .map(cat => ({ value: cat.id, label: `${cat.icon} ${cat.label}` })),
    ];
    const userOptions = [
      { value: "", label: "— Aucune affectation (outil partagé) —" },
      ...[...users]
        .sort((a, b) => (a.nom || "").localeCompare(b.nom || ""))
        .map(u => ({ value: u.id, label: `${u.prenom} ${u.nom}` })),
    ];

    return (
      <div style={{ paddingTop: space.md, paddingBottom: space.xl }}>
        <ModuleSubHeader
          moduleName="Catalogue"
          title={isNew ? "Nouvel outil" : "Modifier l'outil"}
          subtitle="Parc machines"
          onBackToModuleHome={cancel}
        />

        <div style={{ ...cardPanel(), display: "flex", flexDirection: "column", gap: space.lg }}>
          {/* Photo */}
          <div>
            <FieldLabel>Photo</FieldLabel>
            {form.photoURL ? (
              <div style={{ position: "relative", marginTop: space.xs }}>
                <img src={form.photoURL} alt="outil" style={{
                  width: "100%", maxHeight: 240, objectFit: "cover",
                  borderRadius: radius.md, border: `1px solid ${EPJ.gray200}`,
                }}/>
                <div style={{ display: "flex", gap: space.sm, marginTop: space.sm, flexWrap: "wrap" }}>
                  <Button variant="secondary" disabled={!!uploadingPhoto}
                    onClick={() => fileInputLibraryRef.current?.click()}>🖼 Bibliothèque</Button>
                  <Button variant="secondary" disabled={!!uploadingPhoto}
                    onClick={() => fileInputCameraRef.current?.click()}>📷 Caméra</Button>
                  <Button variant="ghost" disabled={!!uploadingPhoto}
                    onClick={handleRemovePhoto}>🗑 Supprimer</Button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: space.sm, marginTop: space.xs }}>
                {uploadingPhoto ? (
                  <div style={{
                    width: "100%", padding: `${space.xl}px ${space.md}px`,
                    border: `2px dashed ${EPJ.orange}`,
                    borderRadius: radius.md, background: EPJ.warningBg,
                    color: EPJ.orangeText, fontSize: fontSize.sm, fontWeight: fontWeight.medium,
                    textAlign: "center",
                  }}>📤 Téléversement en cours… ({uploadingPhoto})</div>
                ) : (
                  <>
                    <button type="button" disabled={!!uploadingPhoto} style={dropZoneStyle}
                      onClick={() => fileInputLibraryRef.current?.click()}>🖼 Choisir depuis la bibliothèque</button>
                    <button type="button" disabled={!!uploadingPhoto} style={dropZoneStyle}
                      onClick={() => fileInputCameraRef.current?.click()}>📷 Prendre une photo (mobile)</button>
                  </>
                )}
              </div>
            )}
            {/* Input pour bibliothèque (pas de capture → laisse iOS proposer le choix) */}
            <input ref={fileInputLibraryRef} type="file" accept="image/*"
              onChange={handlePhotoSelect} style={{ display: "none" }} />
            {/* Input pour caméra forcée */}
            <input ref={fileInputCameraRef} type="file" accept="image/*" capture="environment"
              onChange={handlePhotoSelect} style={{ display: "none" }} />
            <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginTop: space.xs + 2, lineHeight: 1.4 }}>
              L'image sera compressée (max 1024 px) avant envoi.
            </div>
          </div>

          <Field label="Référence" required value={form.ref}
            onChange={e => setForm(f => ({ ...f, ref: e.target.value }))}
            placeholder="ex: PERCEUSE/001" />

          <Field label="Désignation" required value={form.nom}
            onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
            placeholder="ex: Perceuse à percussion Makita" />

          {outillageCategories.length === 0 ? (
            <div>
              <FieldLabel required>Catégorie</FieldLabel>
              <div style={{ fontSize: fontSize.xs, color: EPJ.redText, padding: `${space.xs}px 0` }}>
                ⚠ Aucune catégorie. Importe d'abord les catégories initiales ou crée-les dans Admin → Catégories outillage.
              </div>
            </div>
          ) : (
            <Field as="select" label="Catégorie" required value={form.categorieId || ""}
              onChange={e => setForm(f => ({ ...f, categorieId: e.target.value }))}
              options={catOptions} />
          )}

          <Field label="Marque" value={form.marque}
            onChange={e => setForm(f => ({ ...f, marque: e.target.value }))}
            placeholder="ex: Makita, Bosch, Hilti…" />

          <Field label="Numéro de série" value={form.numSerie}
            onChange={e => setForm(f => ({ ...f, numSerie: e.target.value }))}
            placeholder="optionnel" />

          <Field label="Code-barres" value={form.codeBarres}
            onChange={e => setForm(f => ({ ...f, codeBarres: e.target.value }))}
            placeholder="optionnel" />

          {/* AFFECTATION PERMANENTE */}
          <div>
            <Field as="select" label="Affectation permanente"
              hint="Attribue cet outil de façon permanente à un employé (ex: visseuse personnelle d'un monteur). L'outil ne pourra plus être sorti par d'autres jusqu'à retrait de l'affectation."
              value={form.affectationPermanenteUserId || ""}
              onChange={e => setForm(f => ({ ...f, affectationPermanenteUserId: e.target.value || null }))}
              options={userOptions} />
            {userAffecte && (
              <div style={{
                marginTop: space.sm, padding: `${space.xs + 2}px ${space.md - 2}px`,
                background: EPJ.infoBg, borderRadius: radius.sm,
                fontSize: fontSize.xs, color: EPJ.blueText, fontWeight: fontWeight.medium,
              }}>👤 Attribué à : {userAffecte.prenom} {userAffecte.nom}</div>
            )}
          </div>

          {/* PACK D'OUTILS */}
          <div>
            <FieldLabel>📦 Pack d'outils</FieldLabel>
            <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginBottom: space.sm, lineHeight: 1.5 }}>
              Un pack permet de sortir plusieurs outils d'un seul geste. Ex : marteau-piqueur avec ses trépans et mèches.
            </div>
            <label style={{
              display: "flex", alignItems: "center", gap: space.sm,
              padding: `${space.sm}px ${space.md - 2}px`, borderRadius: radius.md,
              background: form.isPack ? EPJ.warningBg : EPJ.gray50,
              border: `1px solid ${form.isPack ? EPJ.orange : EPJ.gray200}`,
              cursor: "pointer",
            }}>
              <input type="checkbox" checked={form.isPack === true}
                onChange={e => setForm(f => ({ ...f, isPack: e.target.checked }))}
                style={{ width: 16, height: 16, cursor: "pointer" }} />
              <span style={{
                fontSize: fontSize.sm, fontWeight: fontWeight.medium,
                color: form.isPack ? EPJ.orangeText : EPJ.gray700,
              }}>
                Cet outil est un pack (contient d'autres outils)
              </span>
            </label>

            {form.isPack && (
              <PackContentEditor form={form} setForm={setForm}
                outils={outils} outillageCategories={outillageCategories} />
            )}
          </div>

          {/* STATUT */}
          <div>
            <FieldLabel>Statut</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm }}>
              {["disponible", "maintenance", "hors_service"].map(k => {
                const meta = OUTIL_STATUTS[k];
                const active = form.statut === k;
                return (
                  <button key={k} type="button"
                    onClick={() => setForm(f => ({ ...f, statut: k }))}
                    style={statutChipStyle(active, meta.color)}>
                    {meta.icon} {meta.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginTop: space.xs, lineHeight: 1.4 }}>
              « Sorti », « En retard » et « Attribué » sont calculés automatiquement.
            </div>
          </div>

          <Field as="textarea" label="Notes" value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Remarques, consignes particulières…" rows={3} />
        </div>

        <div style={{ display: "flex", gap: space.sm, marginTop: space.lg }}>
          <div style={{ flex: 1 }}>
            <Button variant="secondary" full onClick={cancel}>Annuler</Button>
          </div>
          <div style={{ flex: 2 }}>
            <Button variant="primary" full onClick={save}
              loading={saving} disabled={!!uploadingPhoto}>
              {isNew ? "Créer l'outil" : "Enregistrer"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Liste ─────────────────────────────────────────────────
  // Augmentation des lignes (statut effectif, libellés, affectation) pour
  // un tri + un rendu propres. computeOutilStatut / findSortieEnCours
  // dérivent des données déjà chargées (aucune requête nouvelle).
  const affecteNom = (o) => {
    if (o.affectationPermanenteUserId) {
      const u = users.find(x => x.id === o.affectationPermanenteUserId);
      return u ? `${u.prenom || ""} ${u.nom || ""}`.trim() : "—";
    }
    const s = findSortieEnCours(o._id, outillageSorties);
    if (s) {
      const u = users.find(x => x.id === s.emprunteurId);
      return u ? `${u.prenom || ""} ${u.nom || ""}`.trim() : (s.emprunteurNom || "—");
    }
    return "—";
  };

  const augmented = [...outils]
    .sort((a, b) => (a.ref || "").localeCompare(b.ref || ""))
    .map(o => {
      const eff = computeOutilStatut(o, outillageSorties);
      return {
        ...o,
        _statutEff: eff,
        _statutLabel: badgePropsFor(eff).label || badgePropsFor(eff).status || eff,
        _catLabel: getCategorieLabel(outillageCategories, o.categorieId),
        _catIcon: getCategorieIcon(outillageCategories, o.categorieId),
        _affecteNom: affecteNom(o),
      };
    });

  const filtered = augmented.filter(o => {
    if (catFilter && o.categorieId !== catFilter) return false;
    if (statutFilter && o._statutEff !== statutFilter) return false;
    if (!filter) return true;
    const q = filter.toLowerCase();
    return (
      (o.ref || "").toLowerCase().includes(q) ||
      (o.nom || "").toLowerCase().includes(q) ||
      (o.marque || "").toLowerCase().includes(q) ||
      (o.numSerie || "").toLowerCase().includes(q) ||
      (o.codeBarres || "").toLowerCase().includes(q) ||
      (o._catLabel || "").toLowerCase().includes(q)
    );
  });

  // Comptages KPI (statut effectif)
  const nbDispo = augmented.filter(o => o._statutEff === "disponible").length;
  const nbSorti = augmented.filter(o => o._statutEff === "sorti").length;
  const nbMaint = augmented.filter(o => o._statutEff === "maintenance").length;
  const nbHS    = augmented.filter(o => o._statutEff === "hors_service").length;
  const statutCount = { "": outils.length, disponible: nbDispo, sorti: nbSorti, maintenance: nbMaint, hors_service: nbHS };

  const catOptions = [
    { value: "", label: "📁 Toutes les catégories" },
    ...outillageCategories
      .filter(c => c.actif !== false)
      .sort((a, b) => (a.ordre || 0) - (b.ordre || 0))
      .map(cat => ({ value: cat.id, label: `${cat.icon} ${cat.label}` })),
  ];

  const addBtn = (
    <Button variant="primary" icon="+" onClick={startNew}
      disabled={outillageCategories.length === 0} full={isPwa}>
      Ajouter un outil
    </Button>
  );

  const columns = [
    {
      key: "ref", header: "Réf", width: 160,
      render: (v) => <span style={{ fontFamily: font.mono, fontSize: fontSize.sm }}>{v}</span>,
    },
    {
      key: "nom", header: "Outil",
      render: (v, row) => (
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontWeight: fontWeight.medium, color: EPJ.gray900,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{v}</div>
          <div style={{
            fontSize: fontSize.sm, color: EPJ.gray500, marginTop: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {row._catIcon} {row._catLabel}{row.marque ? ` · ${row.marque}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "_statutLabel", header: "Statut", width: 150,
      render: (_v, row) => <Badge dot {...badgePropsFor(row._statutEff)} />,
    },
    {
      key: "_affecteNom", header: "Affecté à", width: 180,
      render: (v) => v && v !== "—"
        ? v
        : <span style={{ color: EPJ.gray400 }}>—</span>,
    },
    {
      key: "_actions", header: "", sortable: false, align: "right", width: 110,
      render: (_v, row) => (
        <div style={{ display: "inline-flex", gap: space.xs, justifyContent: "flex-end" }}
          onClick={(e) => e.stopPropagation()}>
          <IconBtn title="Modifier" onClick={() => startEdit(row)} pwa={isPwa}>✏</IconBtn>
          <IconBtn title="Supprimer" danger onClick={() => remove(row)} pwa={isPwa}>🗑</IconBtn>
        </div>
      ),
    },
  ];

  const renderCard = (row) => (
    <div style={{ display: "flex", gap: space.md, alignItems: "flex-start" }}>
      {row.photoURL ? (
        <img src={row.photoURL} alt="" style={{
          width: 54, height: 54, borderRadius: radius.sm, objectFit: "cover",
          flexShrink: 0, border: `1px solid ${EPJ.gray200}`,
        }}/>
      ) : (
        <div style={{
          width: 54, height: 54, borderRadius: radius.sm, background: EPJ.gray100,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 24, flexShrink: 0,
        }}>{row._catIcon}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: EPJ.gray900 }}>{row.ref}</div>
        <div style={{
          fontSize: fontSize.base, fontWeight: fontWeight.medium, color: EPJ.gray900, marginTop: 1,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>{row.nom}</div>
        <div style={{
          fontSize: fontSize.sm, color: EPJ.gray500, marginTop: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {row._catIcon} {row._catLabel}{row.marque ? ` · ${row.marque}` : ""}
        </div>
        <div style={{ marginTop: space.sm, display: "flex", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
          <Badge dot {...badgePropsFor(row._statutEff)} />
          {row._affecteNom && row._affecteNom !== "—" && (
            <span style={{ fontSize: fontSize.xs, color: EPJ.gray500 }}>👤 {row._affecteNom}</span>
          )}
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: space.xs, flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}>
        <IconBtn title="Modifier" onClick={() => startEdit(row)} pwa />
        <IconBtn title="Supprimer" danger onClick={() => remove(row)} pwa>🗑</IconBtn>
      </div>
    </div>
  );

  return (
    <div style={{ paddingTop: space.md, paddingBottom: space.xl }}>
      <ModuleSubHeader
        moduleName="Admin"
        title="Catalogue outillage"
        subtitle={`${outils.length} outil${outils.length > 1 ? "s" : ""} · ${outillageCategories.length} catégorie${outillageCategories.length > 1 ? "s" : ""}`}
        onBackToModuleHome={onBack}
        rightSlot={!isPwa ? addBtn : null}
      />
      {isPwa && <div style={{ marginBottom: space.lg }}>{addBtn}</div>}

      {/* Bloc imports initiaux — visible tant que tout n'est pas importé */}
      {(outils.length === 0 || outillageCategories.length === 0 || outillagePannes.length === 0) && (
        <div style={cardPanel(EPJ.orange)}>
          <div style={panelTitle}>🚀 Imports initiaux</div>
          <div style={panelText}>
            Importe les données EPJ (18 catégories, 8 pannes récurrentes, 223 outils) pour démarrer rapidement.
            Les étapes 1 et 2 doivent être faites avant l'étape 3.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
            <Button variant="secondary" full onClick={importCategoriesInitiales}
              loading={importing === "categories"}
              disabled={!!importing || outillageCategories.length > 0}>
              {outillageCategories.length > 0
                ? `✓ 1. Catégories importées (${outillageCategories.length})`
                : "1. Importer les 18 catégories EPJ"}
            </Button>
            <Button variant="secondary" full onClick={importPannesInitiales}
              loading={importing === "pannes"}
              disabled={!!importing || outillagePannes.length > 0}>
              {outillagePannes.length > 0
                ? `✓ 2. Pannes importées (${outillagePannes.length})`
                : "2. Importer les 8 pannes récurrentes"}
            </Button>
            {/* v10.M — L'import initial des 223 outils est remplacé par
                l'import via fichier Excel (bloc dédié ci-dessous). */}
            <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, lineHeight: 1.5, marginTop: space.xs }}>
              {outils.length === 0
                ? "💡 Étape 3 : utilise le bloc « Import / Export du parc » ci-dessous pour charger les outils."
                : `✓ 3. ${outils.length} outils en base`}
            </div>
          </div>
        </div>
      )}

      {/* ─── v10.M — Import / Export Excel du parc ─── */}
      {userCanImportExport && (
        <div style={cardPanel(EPJ.blue)}>
          <div style={panelTitle}>📥 Import / Export du parc</div>
          <div style={panelText}>
            Exporte le parc actuel pour le sauvegarder ou le modifier dans Excel.
            Puis réimporte-le en mode <b>mise à jour</b> (ajoute/modifie, conserve l'existant)
            ou <b>tout remplacer</b> (supprime tout et recharge — irréversible).
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
            <Button variant="secondary" full onClick={handleExportExcel} disabled={!!importing}>
              📤 Exporter le parc actuel ({outils.length} outils)
            </Button>
            <Button variant="secondary" full onClick={() => handlePickExcel("update")} disabled={!!importing}>
              📥 Importer (mettre à jour le parc)
            </Button>
            <Button variant="danger" full onClick={() => handlePickExcel("replace")} disabled={!!importing}>
              🗑 Importer (tout remplacer — irréversible)
            </Button>
          </div>

          {/* Input file caché */}
          <input ref={fileInputExcelRef} type="file" accept=".xlsx,.xls"
            onChange={handleExcelFileChosen} style={{ display: "none" }} />

          {/* Preview avant import */}
          {importPreview && (
            <div style={{
              marginTop: space.md, padding: space.md, borderRadius: radius.md,
              background: importPreview.mode === "replace" ? EPJ.dangerBg : EPJ.infoBg,
              border: `1px solid ${importPreview.mode === "replace" ? EPJ.red : EPJ.blue}40`,
            }}>
              <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.gray900, marginBottom: space.xs + 2 }}>
                📋 Aperçu de l'import — {importPreview.file}
              </div>
              <div style={{ fontSize: fontSize.xs, color: EPJ.gray700, lineHeight: 1.6 }}>
                <b>Mode :</b> {importPreview.mode === "replace" ? "🗑 Tout remplacer" : "📥 Mise à jour"}<br/>
                <b>Lignes lues :</b> {importPreview.totalInFile}<br/>
                <b>Lignes valides :</b> {importPreview.valid.length}<br/>
                <b>Nouveaux outils :</b> {importPreview.newCount}<br/>
                <b>Outils existants mis à jour :</b> {importPreview.existingCount}<br/>
                {importPreview.errors.length > 0 && (
                  <span style={{ color: EPJ.redText }}>
                    <b>Erreurs :</b> {importPreview.errors.length}
                  </span>
                )}
              </div>

              {/* Liste des erreurs (max 5) */}
              {importPreview.errors.length > 0 && (
                <div style={{
                  marginTop: space.sm, padding: space.sm, borderRadius: radius.sm,
                  background: EPJ.dangerBg, fontSize: fontSize.xs, color: EPJ.redText, lineHeight: 1.5,
                  maxHeight: 100, overflowY: "auto",
                }}>
                  {importPreview.errors.slice(0, 5).map((err, i) => <div key={i}>• {err}</div>)}
                  {importPreview.errors.length > 5 && (
                    <div style={{ fontWeight: fontWeight.medium, marginTop: space.xs }}>
                      … et {importPreview.errors.length - 5} autre(s) erreur(s)
                    </div>
                  )}
                </div>
              )}

              {/* Boutons confirmer / annuler */}
              <div style={{ display: "flex", gap: space.sm, marginTop: space.md }}>
                <div style={{ flex: 1 }}>
                  <Button variant={importPreview.mode === "replace" ? "danger" : "primary"} full
                    onClick={handleImportConfirm}
                    loading={importing === "excel"}
                    disabled={!!importing || importPreview.valid.length === 0}>
                    ✓ Confirmer ({importPreview.valid.length} outils)
                  </Button>
                </div>
                <Button variant="ghost" onClick={() => setImportPreview(null)} disabled={!!importing}>
                  Annuler
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Rangée KPI + barre d'outils + tableau (dès qu'il y a des outils) */}
      {outils.length > 0 && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: isPwa ? "1fr 1fr" : "repeat(4, 1fr)",
            gap: space.md, marginBottom: space.lg,
          }}>
            <StatCard label="Total" value={outils.length} loading={!loaded?.outils} />
            <StatCard label="Disponibles" value={nbDispo} loading={!loaded?.outils} />
            <StatCard label="En maintenance" value={nbMaint} loading={!loaded?.outils} />
            <StatCard label="Hors service" value={nbHS} loading={!loaded?.outils} />
          </div>

          <div style={{
            display: "flex", flexDirection: isPwa ? "column" : "row",
            gap: space.md, marginBottom: space.md, alignItems: isPwa ? "stretch" : "center",
          }}>
            <div style={{ flex: isPwa ? undefined : 2 }}>
              <Field value={filter} onChange={e => setFilter(e.target.value)}
                placeholder="🔍 Rechercher (référence, nom, marque, catégorie…)" />
            </div>
            <div style={{ flex: isPwa ? undefined : 1 }}>
              <Field as="select" value={catFilter}
                onChange={e => setCatFilter(e.target.value)} options={catOptions} />
            </div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: space.sm, marginBottom: space.lg }}>
            {STATUT_CHIPS.map(c => (
              <Button key={c.key || "all"}
                variant={statutFilter === c.key ? "secondary" : "ghost"}
                onClick={() => setStatutFilter(c.key)}>
                {c.label} ({statutCount[c.key] ?? 0})
              </Button>
            ))}
          </div>

          <DataTable
            columns={columns}
            rows={filtered}
            keyField="_id"
            onRowClick={(row) => startEdit(row)}
            renderCard={renderCard}
            loading={!loaded?.outils}
            empty={{
              icon: "🔍",
              title: "Aucun outil ne correspond",
              text: "Modifie la recherche ou les filtres de statut / catégorie.",
            }}
          />
        </>
      )}
    </div>
  );
}

// ─── Styles & helpers DS-2 ───────────────────────────────────
// Panneau blanc tokenisé (DA §4). accent → bordure gauche sémantique 3px.
function cardPanel(accent) {
  return {
    background: EPJ.white,
    border: `1px solid ${EPJ.gray200}`,
    borderRadius: radius.lg,
    boxShadow: shadow.sm,
    padding: space.lg,
    marginBottom: space.lg,
    ...(accent ? {
      borderLeft: `3px solid ${accent}`,
      borderTopLeftRadius: 0,
      borderBottomLeftRadius: 0,
    } : null),
  };
}
const panelTitle = {
  fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
  color: EPJ.gray900, marginBottom: space.xs + 2,
};
const panelText = {
  fontSize: fontSize.xs, color: EPJ.gray700, lineHeight: 1.5, marginBottom: space.md,
};
const dropZoneStyle = {
  width: "100%", padding: `${space.lg}px ${space.md}px`, border: `2px dashed ${EPJ.gray300}`,
  borderRadius: radius.md, background: EPJ.gray50, color: EPJ.gray700,
  fontSize: fontSize.sm, fontWeight: fontWeight.medium, cursor: "pointer", fontFamily: font.body,
};

// Label autonome (même rendu que le label interne de <Field>).
function FieldLabel({ children, required }) {
  return (
    <label style={{
      display: "block", fontSize: fontSize.sm, fontWeight: fontWeight.medium,
      color: EPJ.gray700, fontFamily: font.body, marginBottom: space.xs + 2,
    }}>
      {children}
      {required && <span style={{ color: EPJ.red, marginLeft: 3 }}>*</span>}
    </label>
  );
}

// Chip de sélection de statut (formulaire) — couleur sémantique quand actif.
function statutChipStyle(active, color) {
  return {
    padding: `${space.xs + 2}px ${space.md - 2}px`, borderRadius: radius.pill,
    border: `1px solid ${active ? color : EPJ.gray200}`,
    background: active ? `${color}15` : EPJ.white,
    color: active ? color : EPJ.gray600,
    fontSize: fontSize.xs, fontWeight: fontWeight.medium, cursor: "pointer", fontFamily: font.body,
  };
}

// Bouton d'action dense (cellule tableau / carte). Voir rapport : la
// primitive <Button> ne couvre pas l'icon-only dense (pas de size sm ni
// d'override couleur pour ghost) — IconBtn local en attendant.
function IconBtn({ children = "✏", onClick, danger, title, pwa }) {
  const [hover, setHover] = useState(false);
  const size = pwa ? 44 : 34;
  return (
    <button type="button" title={title} aria-label={title} onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: size, height: size, borderRadius: radius.md, border: "none",
        background: hover ? (danger ? EPJ.dangerBg : EPJ.gray100) : "transparent",
        color: danger ? EPJ.redText : EPJ.gray600,
        fontSize: 15, cursor: "pointer", fontFamily: font.body,
        transition: "background .12s ease",
      }}>
      {children}
    </button>
  );
}

// ─── Éditeur de contenu d'un pack ────────────────────────────
function PackContentEditor({ form, setForm, outils, outillageCategories }) {
  const [searchAdd, setSearchAdd] = useState("");

  // Outils déjà dans le pack
  const packContent = Array.isArray(form.packContent) ? form.packContent : [];

  // Outils ajoutables (tous sauf soi-même et sauf déjà dans le pack)
  const availableOutils = outils
    .filter(o => o._id !== form._id)
    .filter(o => !packContent.some(p => p.outilId === o._id))
    .filter(o => {
      if (!searchAdd.trim()) return true;
      const q = searchAdd.toLowerCase();
      return (
        (o.ref || "").toLowerCase().includes(q) ||
        (o.nom || "").toLowerCase().includes(q) ||
        (o.marque || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (a.ref || "").localeCompare(b.ref || ""))
    .slice(0, 20);

  const addToPack = (outilId) => {
    setForm(f => ({
      ...f,
      packContent: [...(f.packContent || []), { outilId, obligatoire: true }],
    }));
    setSearchAdd("");
  };

  const removeFromPack = (outilId) => {
    setForm(f => ({
      ...f,
      packContent: (f.packContent || []).filter(p => p.outilId !== outilId),
    }));
  };

  const toggleObligatoire = (outilId) => {
    setForm(f => ({
      ...f,
      packContent: (f.packContent || []).map(p =>
        p.outilId === outilId ? { ...p, obligatoire: !p.obligatoire } : p
      ),
    }));
  };

  return (
    <div style={{
      marginTop: space.sm + 2, padding: space.md, borderRadius: radius.md,
      background: EPJ.gray50, border: `1px solid ${EPJ.gray200}`,
    }}>
      <div style={{
        fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: EPJ.gray500,
        textTransform: "uppercase", letterSpacing: 0.4, marginBottom: space.sm,
      }}>Contenu du pack ({packContent.length} outil{packContent.length > 1 ? "s" : ""})</div>

      {packContent.length === 0 ? (
        <div style={{
          fontSize: fontSize.xs, color: EPJ.gray500, fontStyle: "italic",
          padding: `${space.sm}px 0`, textAlign: "center",
        }}>Aucun outil dans le pack. Ajoute-en ci-dessous.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: space.xs, marginBottom: space.sm + 2 }}>
          {packContent.map(p => {
            const o = outils.find(x => x._id === p.outilId);
            if (!o) {
              // outil supprimé entre temps, on le marque en rouge
              return (
                <div key={p.outilId} style={{
                  padding: `${space.sm}px ${space.md - 2}px`, borderRadius: radius.sm,
                  background: EPJ.dangerBg, border: `1px solid ${EPJ.red}30`,
                  fontSize: fontSize.xs, color: EPJ.redText,
                }}>
                  ⚠ Outil introuvable ({p.outilId})
                  <button type="button" onClick={() => removeFromPack(p.outilId)}
                    style={{
                      marginLeft: space.sm, padding: "2px 6px",
                      background: EPJ.red, color: EPJ.white, border: "none",
                      borderRadius: radius.sm, fontSize: fontSize.xs, fontWeight: fontWeight.medium, cursor: "pointer",
                    }}>✕</button>
                </div>
              );
            }
            const catIcon = outillageCategories.find(c => c.id === o.categorieId)?.icon || "🔧";
            return (
              <div key={p.outilId} style={{
                padding: `${space.sm}px ${space.md - 2}px`, borderRadius: radius.sm,
                background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
                display: "flex", alignItems: "center", gap: space.sm,
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: radius.sm,
                  background: EPJ.gray100, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 14, flexShrink: 0,
                }}>{catIcon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: EPJ.gray900, fontFamily: font.mono,
                  }}>{o.ref}</div>
                  <div style={{
                    fontSize: fontSize.xs, color: EPJ.gray700,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>{o.nom}</div>
                </div>
                <label style={{
                  display: "flex", alignItems: "center", gap: space.xs,
                  fontSize: fontSize.xs, fontWeight: fontWeight.medium,
                  color: p.obligatoire ? EPJ.redText : EPJ.gray500,
                  cursor: "pointer", flexShrink: 0,
                }}>
                  <input type="checkbox" checked={p.obligatoire}
                    onChange={() => toggleObligatoire(p.outilId)} style={{ cursor: "pointer" }} />
                  Obligatoire
                </label>
                <button type="button" onClick={() => removeFromPack(p.outilId)}
                  style={{
                    background: EPJ.dangerBg, color: EPJ.redText, border: "none",
                    borderRadius: radius.sm, padding: "4px 7px", fontSize: fontSize.xs, fontWeight: fontWeight.medium,
                    cursor: "pointer", flexShrink: 0,
                  }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ borderTop: `1px solid ${EPJ.gray200}`, paddingTop: space.sm + 2 }}>
        <Field value={searchAdd} onChange={e => setSearchAdd(e.target.value)}
          placeholder="🔍 Rechercher un outil à ajouter au pack…" />
        {searchAdd.trim() && availableOutils.length === 0 && (
          <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, padding: space.sm }}>
            Aucun outil trouvé.
          </div>
        )}
        {searchAdd.trim() && availableOutils.length > 0 && (
          <div style={{
            marginTop: space.sm, maxHeight: 240, overflowY: "auto",
            border: `1px solid ${EPJ.gray200}`, borderRadius: radius.sm, background: EPJ.white,
          }}>
            {availableOutils.map(o => {
              const catIcon = outillageCategories.find(c => c.id === o.categorieId)?.icon || "🔧";
              return (
                <div key={o._id} onClick={() => addToPack(o._id)}
                  style={{
                    padding: `${space.sm}px ${space.md - 2}px`, cursor: "pointer",
                    display: "flex", alignItems: "center", gap: space.sm,
                    borderBottom: `1px solid ${EPJ.gray100}`,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = EPJ.gray50}
                  onMouseLeave={e => e.currentTarget.style.background = EPJ.white}>
                  <div style={{ fontSize: 14 }}>{catIcon}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: EPJ.gray900, fontFamily: font.mono,
                    }}>{o.ref}</div>
                    <div style={{
                      fontSize: fontSize.xs, color: EPJ.gray600,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{o.nom}</div>
                  </div>
                  <span style={{ color: EPJ.blue, fontSize: 16, fontWeight: fontWeight.medium }}>+</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

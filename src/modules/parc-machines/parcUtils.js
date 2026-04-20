// ═══════════════════════════════════════════════════════════════
//  parcUtils.js — Helpers du module Parc Machines (v8)
// ═══════════════════════════════════════════════════════════════
import { storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// ─── Statut d'un outil ──────────────────────────────────────
export const OUTIL_STATUTS = {
  disponible:    { label: "Disponible",    color: "#A8C536", icon: "✓" },
  sorti:         { label: "Sorti",         color: "#F5841F", icon: "→" },
  en_retard:     { label: "En retard",     color: "#E53935", icon: "⏰" },
  maintenance:   { label: "Maintenance",   color: "#8E44AD", icon: "🛠" },
  hors_service:  { label: "Hors service",  color: "#6B6B6B", icon: "✕" },
  affecte:       { label: "Attribué",      color: "#00A3E0", icon: "👤" },
};

// ─── Date utils ─────────────────────────────────────────────
export const todayISO = () => new Date().toISOString().split("T")[0];

export function isLate(dateRetour, dateRetourReelle) {
  if (dateRetourReelle) return false;
  if (!dateRetour) return false;
  const d = new Date(dateRetour + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d < today;
}

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR");
}

export function formatDateShort(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ─── Statut effectif d'un outil ──────────────────────────────
export function computeOutilStatut(outil, sorties) {
  if (outil.statut === "hors_service") return "hors_service";
  if (outil.statut === "maintenance") return "maintenance";
  if (outil.affectationPermanenteUserId) return "affecte";
  const sortieEnCours = sorties.find(
    s => s.outilId === outil._id && !s.dateRetourReelle
  );
  if (!sortieEnCours) return "disponible";
  if (isLate(sortieEnCours.dateRetourPrevue)) return "en_retard";
  return "sorti";
}

export function findSortieEnCours(outilId, sorties) {
  return sorties.find(s => s.outilId === outilId && !s.dateRetourReelle) || null;
}

// ─── Catégories (dynamiques depuis Firestore) ───────────────
export function getCategorieById(categoriesArr, catId) {
  return categoriesArr.find(c => c.id === catId || c._id === catId) || null;
}

export function getCategorieLabel(categoriesArr, catId) {
  const c = getCategorieById(categoriesArr, catId);
  return c?.label || catId || "—";
}

export function getCategorieIcon(categoriesArr, catId) {
  const c = getCategorieById(categoriesArr, catId);
  return c?.icon || "🔧";
}

// ─── Droit "autorisé à sortir un outil" ─────────────────────
// Admin et Direction : toujours true par défaut
// Autres rôles : false par défaut, doit être activé via `canSortirOutil: true` sur le user
export function canSortirOutil(user) {
  if (!user) return false;
  if (user.canSortirOutil === true) return true;
  if (user.canSortirOutil === false) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (roles.includes("Admin") || roles.includes("Direction")) return true;
  return false;
}

// Droit de gérer le catalogue (outils + catégories + pannes)
export function canGererCatalogue(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return roles.includes("Admin") || roles.includes("Direction") || roles.includes("Assistante");
}

// ─── Compression + upload photo Firebase Storage ────────────
export async function compressImage(file, maxWidth = 1024, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = () => reject(new Error("Lecture fichier échouée"));
    reader.readAsDataURL(file);

    img.onload = () => {
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error("Compression échouée")),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => reject(new Error("Image invalide"));
  });
}

export async function uploadOutilPhoto(outilId, file, onProgress) {
  if (onProgress) onProgress("Compression…");
  const blob = await compressImage(file, 1024, 0.85);
  if (onProgress) onProgress("Téléversement…");
  const path = `outils/${outilId}_${Date.now()}.jpg`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, blob, { contentType: "image/jpeg" });
  if (onProgress) onProgress("Finalisation…");
  const url = await getDownloadURL(fileRef);
  return { url, path };
}

export async function deleteOutilPhoto(path) {
  if (!path) return;
  try {
    const fileRef = ref(storage, path);
    await deleteObject(fileRef);
  } catch (e) {
    console.warn("deleteOutilPhoto (non bloquant):", e.message);
  }
}

// ─── Génération d'ID simple (timestamp + random) ────────────
export function generateId(prefix = "o") {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

// ─── Rendu d'un template SMS avec variables ─────────────────
// Remplace {prenom}, {ref}, {nom}, {dateRetour}, {chantier} par les valeurs
export function renderSmsTemplate(template, vars) {
  if (!template) return "";
  let out = template;
  Object.entries(vars || {}).forEach(([k, v]) => {
    const re = new RegExp(`\\{${k}\\}`, "g");
    out = out.replace(re, v ?? "");
  });
  return out;
}

// Copie dans le presse-papier (avec fallback pour iOS ancien)
export async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return true;
  } catch (e) {
    console.error("copyToClipboard:", e);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════
//  reservesUtils.js — Helpers du module Réserves & Quitus (v10.A)
// ═══════════════════════════════════════════════════════════════
import { storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

// ─── Statuts d'une réserve ──────────────────────────────────
export const RESERVE_STATUTS = {
  creee:              { label: "Créée",              color: "#6B6B6B", icon: "📝" },
  attribuee:          { label: "Attribuée",          color: "#00A3E0", icon: "👤" },
  planifiee:          { label: "Planifiée",          color: "#F5841F", icon: "📅" },
  intervention:       { label: "En intervention",    color: "#F5B700", icon: "🔧" },
  levee:              { label: "Levée",              color: "#A8C536", icon: "✓" },
  partiellement_levee:{ label: "Partiellement levée",color: "#E67E22", icon: "◐" },
  quitus_signe:       { label: "Quitus signé",       color: "#4CAF50", icon: "✅" },
  cloturee:           { label: "Clôturée",           color: "#8E8E8E", icon: "🔒" },
};

// ─── Priorités ──────────────────────────────────────────────
export const RESERVE_PRIORITES = {
  bloquante: { label: "Bloquante", color: "#E53935", icon: "🔴" },
  normale:   { label: "Normale",   color: "#F5841F", icon: "🟡" },
};

// ─── Numérotation automatique par chantier ─────────────────
// Format : {chantierNum}-R-{séquence 3 chiffres}
// Ex : 2026-042-R-001
export function generateReserveNum(chantierNum, existingReserves) {
  const prefix = `${chantierNum}-R-`;
  const sameChantier = (existingReserves || []).filter(r =>
    r.chantierNum === chantierNum && r.numReserve?.startsWith(prefix)
  );
  let maxSeq = 0;
  sameChantier.forEach(r => {
    const m = /-R-(\d+)$/.exec(r.numReserve || "");
    if (m) maxSeq = Math.max(maxSeq, parseInt(m[1], 10));
  });
  const nextSeq = String(maxSeq + 1).padStart(3, "0");
  return `${prefix}${nextSeq}`;
}

// ─── Calcul des dates de garantie ─────────────────────────
export function getGaranties(datePVReception) {
  if (!datePVReception) return null;
  const base = new Date(datePVReception);
  if (isNaN(base.getTime())) return null;
  const finGPA = new Date(base); finGPA.setFullYear(finGPA.getFullYear() + 1);
  const finBiennale = new Date(base); finBiennale.setFullYear(finBiennale.getFullYear() + 2);
  const today = new Date(); today.setHours(0,0,0,0);
  return {
    datePV: base,
    finGPA,
    finBiennale,
    gpaActive: finGPA >= today,
    gpaExpireSoon: finGPA >= today && (finGPA - today) / (1000*60*60*24) <= 30,
    biennaleActive: finBiennale >= today,
    biennaleExpireSoon: finBiennale >= today && (finBiennale - today) / (1000*60*60*24) <= 30,
  };
}

// ─── Dates utils ───────────────────────────────────────────
export const todayISO = () => new Date().toISOString().split("T")[0];

export function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function daysBetween(iso1, iso2) {
  if (!iso1 || !iso2) return null;
  const d1 = new Date(iso1); const d2 = new Date(iso2);
  if (isNaN(d1) || isNaN(d2)) return null;
  return Math.round((d2 - d1) / (1000*60*60*24));
}

// ─── Détermination du statut ─────────────────────────────
export function isRdvEnRetard(reserve) {
  // Une réserve "attribuee" sans RDV pris depuis +2 jours est en retard
  if (reserve.statut !== "attribuee") return false;
  if (reserve.rdvPris) return false;
  if (!reserve.dateAffectation) return false;
  const days = daysBetween(reserve.dateAffectation, todayISO());
  return days !== null && days >= 2;
}

export function isReserveEnRetard(reserve) {
  // Réserve non levée dont la date limite est dépassée
  if (["levee", "quitus_signe", "cloturee"].includes(reserve.statut)) return false;
  if (!reserve.dateLimite) return false;
  const days = daysBetween(todayISO(), reserve.dateLimite);
  return days !== null && days < 0;
}

// ─── Upload photo réserve vers Firebase Storage ───────────
export async function compressReservePhoto(file, maxWidth = 1024, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const ratio = img.width > maxWidth ? maxWidth / img.width : 1;
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error("Compression échouée")),
        "image/jpeg", quality
      );
    };
    img.onerror = () => reject(new Error("Image invalide"));
    img.src = URL.createObjectURL(file);
  });
}

export async function uploadReservePhoto(reserveId, kind, file, onProgress) {
  // kind : "avant" ou "apres"
  if (onProgress) onProgress("Compression…");
  const blob = await compressReservePhoto(file, 1024, 0.85);
  if (onProgress) onProgress("Téléversement…");
  const safeId = String(reserveId || "res").replace(/[\/\s]/g, "_");
  const path = `reserves/${safeId}_${kind}_${Date.now()}.jpg`;
  const fileRef = ref(storage, path);
  await uploadBytes(fileRef, blob, { contentType: "image/jpeg" });
  if (onProgress) onProgress("Finalisation…");
  const url = await getDownloadURL(fileRef);
  return { url, path };
}

export async function deleteReservePhoto(path) {
  if (!path) return;
  try {
    const fileRef = ref(storage, path);
    await deleteObject(fileRef);
  } catch (e) {
    console.warn("deleteReservePhoto (non bloquant):", e.message);
  }
}

// ─── Pièces jointes (images + PDFs) ──────────────────────
export const MAX_ATTACHMENT_SIZE_MB = 20;
export const ACCEPTED_ATTACHMENT_TYPES = "image/*,application/pdf";

export function getFileKind(file) {
  if (!file) return "unknown";
  if (file.type?.startsWith("image/")) return "image";
  if (file.type === "application/pdf") return "pdf";
  // fallback sur l'extension
  const name = (file.name || "").toLowerCase();
  if (/\.(jpe?g|png|gif|webp|heic|heif)$/.test(name)) return "image";
  if (/\.pdf$/.test(name)) return "pdf";
  return "unknown";
}

export async function uploadReserveAttachment(reserveId, file, onProgress) {
  const kind = getFileKind(file);
  if (kind === "unknown") {
    throw new Error("Type de fichier non pris en charge (images et PDF uniquement)");
  }
  if (file.size > MAX_ATTACHMENT_SIZE_MB * 1024 * 1024) {
    throw new Error(`Fichier trop lourd (max ${MAX_ATTACHMENT_SIZE_MB} Mo)`);
  }

  const safeId = String(reserveId || "res").replace(/[\/\s]/g, "_");
  const ts = Date.now();
  let blob = file;
  let ext = "bin";

  if (kind === "image") {
    if (onProgress) onProgress("Compression…");
    try {
      blob = await compressReservePhoto(file, 1600, 0.85);
    } catch {
      blob = file; // fallback si la compression échoue
    }
    ext = "jpg";
  } else if (kind === "pdf") {
    ext = "pdf";
  }

  if (onProgress) onProgress("Téléversement…");
  const safeName = (file.name || `file_${ts}`).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  const path = `reserves/${safeId}_att_${ts}_${safeName}`;
  const fileRef = ref(storage, path);
  const contentType = kind === "pdf" ? "application/pdf" : "image/jpeg";
  await uploadBytes(fileRef, blob, { contentType });
  if (onProgress) onProgress("Finalisation…");
  const url = await getDownloadURL(fileRef);

  return {
    id: `att_${ts}_${Math.random().toString(36).slice(2, 6)}`,
    kind,
    nom: file.name || `fichier.${ext}`,
    url,
    path,
    tailleKo: Math.round((blob.size || file.size || 0) / 1024),
    contentType,
    dateAjout: new Date().toISOString(),
  };
}

export function formatFileSize(ko) {
  if (!ko || ko < 0) return "—";
  if (ko < 1024) return `${ko} Ko`;
  return `${(ko / 1024).toFixed(1)} Mo`;
}

// ─── SMS : rendering et deeplink ──────────────────────────
export function renderReserveSmsTemplate(template, vars) {
  if (!template) return "";
  let out = template;
  Object.entries(vars || {}).forEach(([k, v]) => {
    const re = new RegExp(`\\{${k}\\}`, "g");
    out = out.replace(re, v ?? "");
  });
  return out;
}

export function buildSmsDeepLink(phone, message) {
  const cleanPhone = String(phone || "").replace(/\s|\./g, "");
  const encoded = encodeURIComponent(message);
  // iOS/Android : sms:+33XXX?body=...
  return `sms:${cleanPhone}?body=${encoded}`;
}

// ─── Catégories et émetteurs par défaut (seed si vide) ────
export const DEFAULT_RESERVES_CATEGORIES = [
  { id: "cat_app",  label: "Appareillage",      icon: "🔌", ordre: 1, actif: true },
  { id: "cat_tab",  label: "Tableau électrique", icon: "⚡", ordre: 2, actif: true },
  { id: "cat_ecl",  label: "Éclairage",          icon: "💡", ordre: 3, actif: true },
  { id: "cat_int",  label: "Interphone",         icon: "📞", ordre: 4, actif: true },
  { id: "cat_vmc",  label: "VMC",                icon: "💨", ordre: 5, actif: true },
  { id: "cat_cha",  label: "Chauffage",          icon: "🌡️", ordre: 6, actif: true },
  { id: "cat_aut",  label: "Autre",              icon: "📦", ordre: 99, actif: true },
];

export const DEFAULT_RESERVES_EMETTEURS = [
  { id: "em_moe",  label: "Maître d'œuvre (MOE)", ordre: 1, actif: true },
  { id: "em_arc",  label: "Architecte",            ordre: 2, actif: true },
  { id: "em_bc",   label: "Bureau de contrôle",    ordre: 3, actif: true },
  { id: "em_cli",  label: "Client final",          ordre: 4, actif: true },
  { id: "em_syn",  label: "Syndic",                ordre: 5, actif: true },
  { id: "em_pro",  label: "Promoteur",             ordre: 6, actif: true },
  { id: "em_apa",  label: "APAVE",                 ordre: 7, actif: true },
  { id: "em_soc",  label: "SOCOTEC",               ordre: 8, actif: true },
  { id: "em_ver",  label: "VERITAS",               ordre: 9, actif: true },
  { id: "em_aut",  label: "Autre",                 ordre: 99, actif: true },
];

// ─── Templates SMS par défaut pour le module ──────────────
export const DEFAULT_RESERVES_SMS_TEMPLATES = [
  {
    id: "sms_reserve_attribution",
    module: "reserves",
    code: "reserve_attribution",
    label: "Attribution d'une réserve",
    texte: "Bonjour {prenom}, une nouvelle réserve {numReserve} t'a été attribuée pour le chantier {chantier}. Merci de prendre RDV avec le client : {clientNom} {clientTel}.",
  },
  {
    id: "sms_reserve_relance_rdv",
    module: "reserves",
    code: "reserve_relance_rdv",
    label: "Relance : RDV non pris",
    texte: "Bonjour {prenom}, la réserve {numReserve} ({chantier}) n'a pas encore de RDV planifié. Merci de contacter le client rapidement : {clientNom} {clientTel}.",
  },
  {
    id: "sms_reserve_rdv_demain",
    module: "reserves",
    code: "reserve_rdv_demain",
    label: "Rappel RDV demain",
    texte: "Rappel : demain {dateRdv} à {heureRdv}, intervention réserve {numReserve} — {chantier}. Client : {clientNom} {clientTel}.",
  },
];

// ═══════════════════════════════════════════════════════════════
//  core/fournisseurs.js — Référentiel fournisseurs PARTAGÉ
//
//  Source UNIQUE des fiches fournisseurs et de leurs contacts, réutilisable
//  par le Module Commande (relance/réclamation AR) ET les futures
//  consultations Chiffrage (demande de prix).
//
//  Collection : fournisseurs/{code}  (code == codeFournisseur Esabora)
//    {
//      code, nom, actif: true, telephone,
//      contacts: [ { id, nom, email, telephone, usages: string[], source } ]
//    }
//    source ∈ { "manuel" (saisi en admin), "auto" (capturé d'un expéditeur AR) }
//
//  ⚠ La collection legacy `fournisseursContacts` est migrée puis abandonnée
//  (plus lue ni écrite après le Lot 3). Ne plus l'utiliser ici.
// ═══════════════════════════════════════════════════════════════
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

// Valeurs par défaut de l'enum `usages` (éditable côté admin).
//   relance       = relance / réclamation AR achat
//   consultation  = demande de prix / chiffrage
export const USAGES_DEFAUT = [
  "relance",
  "consultation",
  "adv",
  "sav",
  "commercial",
  "comptabilite",
];

export const USAGE_LABEL = {
  relance: "Relance / réclamation",
  consultation: "Consultation / prix",
  adv: "ADV",
  sav: "SAV",
  commercial: "Commercial",
  comptabilite: "Comptabilité",
};

// Sélection PURE (sans I/O) : 1er contact dont `usages` inclut `usage`,
// sinon 1er contact disposant d'un email, sinon null. Partagée front/back
// (la Cloud Function Lot 3 applique la MÊME règle).
export function pickFournisseurEmail(fournisseur, usage) {
  if (!fournisseur) return null;
  const contacts = Array.isArray(fournisseur.contacts) ? fournisseur.contacts : [];
  const withEmail = contacts.filter((c) => c && c.email);
  const byUsage = withEmail.find(
    (c) => Array.isArray(c.usages) && c.usages.includes(usage),
  );
  return (byUsage || withEmail[0])?.email || null;
}

// Résolution async par code (front). Retourne l'email ou null.
export async function getFournisseurEmail(code, usage) {
  if (!code) return null;
  try {
    const snap = await getDoc(doc(db, "fournisseurs", String(code)));
    if (!snap.exists()) return null;
    return pickFournisseurEmail(snap.data(), usage);
  } catch {
    return null;
  }
}

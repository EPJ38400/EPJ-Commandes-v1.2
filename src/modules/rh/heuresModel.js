// ═══════════════════════════════════════════════════════════════
//  heuresModel — logique PURE de l'import « Heures salariés » (RH-Frais-3a).
//  Aucune dépendance Firestore.
//
//  La collection `heures` est TRANSVERSE (RH frais ET Suivi financier M5) :
//   id = `${mois}__${salarieId||'NC-'+trigramme}__${chantierNum||'NA'}__${jour}`.
//  Ré-import d'un même mois = mêmes ids écrasés (idempotent).
//
//  ⚠️ AUCUN calcul d'indemnité ici (= RH-Frais-3b).
// ═══════════════════════════════════════════════════════════════

// Normalise un nom : MAJUSCULES, sans accents, trim, espaces simples.
// Sert de clé de rapprochement salarié (fichier ↔ utilisateurs / mapping).
export function normaliserNom(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")   // retire les diacritiques
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Parse un libellé chantier "123456 - Nom du chantier" → { num, libelle }.
// Pas de n° à 6 chiffres en tête → num=null, libelle = chaîne d'origine trim.
export function parseChantier(libelle) {
  const s = String(libelle || "").trim();
  const m = s.match(/^(\d{6})\s*-\s*(.*)$/);
  if (m) return { num: m[1], libelle: m[2].trim() };
  return { num: null, libelle: s };
}

// Construit l'id déterministe d'une ligne d'heures.
export function heureDocId({ mois, salarieId, trigramme, chantierNum, jour }) {
  const sal = salarieId || `NC-${normaliserNom(trigramme).replace(/\s+/g, "")}`;
  const chn = chantierNum || "NA";
  return `${mois}__${sal}__${chn}__${jour}`;
}

// Agrège des lignes d'heures par salarié ou par chantier.
//   par:"salarie"  → clé = salarieId||('NC-'+trigramme) ; libellé = nom fichier.
//   par:"chantier" → clé = chantierNum||'NA'            ; libellé = libellé chantier.
// Renvoie [{ cle, libelle, heures, nbLignes }] trié par libellé.
export function aggregeHeures(lignes, { par = "salarie" } = {}) {
  const map = new Map();
  for (const l of lignes || []) {
    let cle;
    let libelle;
    if (par === "chantier") {
      cle = l.chantierNum || "NA";
      libelle = l.chantierLibelle || (l.chantierNum ? l.chantierNum : "Sans chantier");
    } else {
      cle = l.salarieId || `NC-${normaliserNom(l.trigramme).replace(/\s+/g, "")}`;
      libelle = l.salarieNomFichier || l.trigramme || cle;
    }
    const prev = map.get(cle) || { cle, libelle, heures: 0, nbLignes: 0 };
    prev.heures += Number(l.heures) || 0;
    prev.nbLignes += 1;
    // Conserve le premier libellé non vide rencontré.
    if (!prev.libelle && libelle) prev.libelle = libelle;
    map.set(cle, prev);
  }
  return [...map.values()]
    .map((r) => ({ ...r, heures: Math.round(r.heures * 100) / 100 }))
    .sort((a, b) => String(a.libelle).localeCompare(String(b.libelle), "fr", { sensitivity: "base" }));
}

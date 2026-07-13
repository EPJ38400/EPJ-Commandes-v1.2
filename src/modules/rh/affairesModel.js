// ═══════════════════════════════════════════════════════════════
//  affairesModel — logique PURE de l'import « affaires Esabora »
//  (RH-Frais-3a2). Aucune dépendance Firestore.
//
//  Le référentiel `chantiersEsabora/{num}` est LÉGER et SÉPARÉ de la
//  collection `chantiers` (trio sensible) : il sert de fallback d'adresse
//  pour le moteur de distance frais quand l'affaire n'existe pas (encore)
//  dans `chantiers`.
//
//  Fichier AFFAIRES.xlsx — colonnes attendues (ordre fixe) :
//   [0] Etat, [1] Numéro, [2] Titre, [3] Nom client, [4] Date création,
//   [5] Date fin prévue, [6] Date fin réalisée, [7] Adresse,
//   [8] Code postal, [9] Ville.
// ═══════════════════════════════════════════════════════════════

// Parse une ligne (array of cells) → objet affaire | null (num non conforme).
//   num doit être exactement 6 chiffres, sinon la ligne est ignorée.
//   adresseManquante = true si la colonne Adresse est vide.
export function parseAffaireRow(row) {
  const g = (i) => String(row?.[i] ?? "").trim();
  const num = g(1);
  if (!/^\d{6}$/.test(num)) return null;
  const adresse = g(7);
  return {
    num,
    etat: g(0),
    titre: g(2),
    nomClient: g(3),
    adresse,
    codePostal: g(8),
    ville: g(9),
    adresseManquante: !adresse,
  };
}

// Compose une adresse postale complète : "Adresse, CP Ville" (trim propre,
// aucune virgule/espace orphelin si un champ manque).
export function adresseComplete(a) {
  const adresse = String(a?.adresse || "").trim();
  const cp = String(a?.codePostal || "").trim();
  const ville = String(a?.ville || "").trim();
  const ligne2 = `${cp} ${ville}`.trim();
  return [adresse, ligne2].filter(Boolean).join(", ");
}

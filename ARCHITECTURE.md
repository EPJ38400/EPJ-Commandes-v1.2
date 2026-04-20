# Architecture v8 — Parc Machines + SMS globaux

## Nouvelles collections Firestore

### outils/{id}
Chaque outil du parc.
```
{
  id,
  ref,                          // ex: "PERCEUSE/001"
  nom,                          // ex: "Perceuse à percussion Makita"
  categorieId,                  // ex: "visseuses" (ref vers outillageCategories)
  codeBarres,                   // optionnel, depuis Excel
  marque,                       // optionnel
  numSerie,                     // optionnel
  notes,                        // optionnel
  photoURL,                     // Firebase Storage
  photoPath,                    // pour suppression
  statut,                       // "disponible" | "maintenance" | "hors_service" (sorti/en_retard calculés)
  affectationPermanenteUserId,  // optionnel : si renseigné, outil attribué définitivement
  createdAt,
  updatedAt,
}
```

### outillageCategories/{id}
Catégories du catalogue (18 par défaut, modifiables).
```
{
  id,             // ex: "visseuses"
  label,          // ex: "Visseuses"
  icon,           // ex: "🔩"
  ordre,          // entier, tri croissant
  actif,          // boolean
}
```

### outillagePannes/{id}
Pannes récurrentes pour sélection au retour d'un outil abîmé (8 par défaut).
```
{
  id,             // ex: "PANVIS" (= code)
  code,           // ex: "PANVIS"
  libelle,        // ex: "PANNE VISSEUSE"
  bloquante,      // boolean : si oui, l'outil passe en "hors_service" automatiquement
  actif,          // boolean
}
```

### outillageSorties/{id}
Sorties d'outils (en cours ou terminées).
```
{
  id,
  outilId,              // ref vers outils
  ref,                  // snapshot
  nom,                  // snapshot
  emprunteurId,         // ref vers utilisateurs
  emprunteurNom,        // snapshot "Prénom NOM"
  chantierNum,          // optionnel
  dateSortie,           // ISO "YYYY-MM-DD"
  dateRetourPrevue,     // ISO
  dateRetourReelle,     // ISO, null si pas encore rendu
  signatureSortie,      // data URL base64
  signatureRetour,      // data URL base64, null si pas encore rendu
  commentaireSortie,
  commentaireRetour,
  etatRetour,           // "bon" | "abime" | null
  panneIds,             // array d'IDs de pannes (si etatRetour=abime)
  createdBy,
  updatedAt,
}
```

### smsTemplates/{id}
Modèles SMS **globaux** (utilisables par tous les modules).
```
{
  id,             // ex: "outillage_rappel_retour"
  module,         // ex: "parc-machines" | "reserves-quitus" | ...
  label,          // ex: "Rappel retour d'outil"
  body,           // avec variables {prenom}, {ref}, etc.
  variables,      // array des variables disponibles
  actif,          // boolean
  createdAt,
  updatedAt,
}
```

## Nouveaux flags utilisateur

Dans `utilisateurs/{id}` :
- `canSortirOutil: boolean` — autorisé à sortir un outil du parc

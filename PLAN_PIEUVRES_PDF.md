# PLAN — Export PDF du planning pieuvre (onglet Pieuvres)

> **Statut : PLAN, aucun code écrit.** Branche `feature/pieuvres-export-pdf`. J'attends **« GO »**.
> **100 % lecture seule** : aucune écriture Firestore, pas de Cloud Function, pas de règle,
> pas de modif `permissions.js`, pas de nouvelle dépendance npm.

---

## 1) Mécanisme PDF existant réutilisé + logo + comment on évite le bug du quitus

### Mécanisme (vérifié `quitusPdfGenerator.js` + `QuitusActions.jsx`)
- **Aucune lib PDF en npm.** Le quitus ouvre une **popup** (`window.open("")` + `document.write(html)`),
  charge **html2canvas 1.4.1 + jsPDF 2.5.1 depuis le CDN** (`<script src>` dans la popup), puis
  `html2canvas(page)` → `canvas.toDataURL` → `jsPDF.addImage` → `pdf.save()`. Bouton « Imprimer » = `window.print()`.
- La popup `window.open` **doit être appelée en synchrone dans le geste utilisateur** (sinon bloquée
  sur iOS). Pattern `QuitusActions` : on **précharge** ce qui est async **au montage** (`useEffect`),
  et au clic on appelle en **synchrone** (`pdfModRef.current`).
- **On réutilise exactement ce mécanisme** (cohérence de marque + zéro nouvelle dépendance).

### Logo : emplacement + bug à NE PAS reproduire
- `src/core/logo.js` → `LOGO_HEADER = "/logo-header.png"` (fichier statique servi depuis `public/`).
- **Bug du quitus (BUG 3, commit `5580abb`)** : `html2canvas` ne peut pas lire une image
  **cross-origin** sans en-têtes CORS (l'ancien fond venait de Firebase Storage) → **zone blanche**.
  Fix appliqué au quitus : asset **embarqué depuis le repo** (même origine) / **data URI**
  (`import papierEnteteAsset` + `company.papierEnteteDataUri`).
- **Piège supplémentaire ici** : dans une popup `about:blank` (créée par `window.open("")`), un
  `<img src="/logo-header.png">` (chemin relatif) **n'a aucune origine de base → ne charge pas**.
- **➡️ Solution retenue (bug-proof)** : on charge le logo **en data URI côté application**
  (`fetch("/logo-header.png")` → `blob` → `FileReader.readAsDataURL`, **même origine, sans CORS**),
  on le **précharge au montage** de l'onglet (state/ref), et on **injecte la chaîne data URI**
  directement dans le HTML de la popup (`<img src="data:image/png;base64,…">`). Aucun chemin
  relatif, aucune ressource réseau dans la popup, aucun CORS. Dans `generatePdf`, on **attend le
  chargement des images** (déjà fait dans le quitus, l.418-426) avant `html2canvas` — le data URI
  est immédiat. La preview montrera le logo rendu.
- Repli si le fetch logo échoue : on génère quand même le PDF **sans** logo (bandeau texte « EPJ
  Électricité Générale » en secours) plutôt que de bloquer.

### Format & pagination (priorité « PDF propre »)
- **A4 PAYSAGE confirmé** (8 colonnes → paysage nettement plus lisible que portrait ; recommandé).
- **Une page par bâtiment** : pour un contrôle exact du **pied de page (n° de page)** et des sauts
  de page, on génère **un `<div>` page A4-paysage par bâtiment** (≈ 1123 × 794 px à 96 dpi, marges
  internes), on `html2canvas` **chaque page** puis `jsPDF.addPage()` → 1 image par page. Le n° de
  page et le pied sont **écrits dans le HTML de chaque page** avant capture (donc rendus à coup sûr).
  *(Alternative `window.print()` + `@media print` écartée : les n° de page custom en pied ne sont
  pas fiables cross-navigateur via CSS `@page`. Le multi-canvas jsPDF donne le rendu maîtrisé exigé.)*

---

## 2) Fichiers à créer / modifier

### Créer
- **`src/modules/gestion-chantier/pieuvresPdf.js`** — générateur, calibre `quitusPdfGenerator.js` :
  - `loadLogoDataUri()` → `Promise<string>` : fetch même-origine de `LOGO_HEADER` → data URI.
  - `openPieuvresPdfWindow({ chantier, rows, logoDataUri, selection })` : construit le HTML
    (pages A4-paysage par bâtiment) + popup + scripts CDN html2canvas/jsPDF + bouclage
    `addPage` + pied de page. `selection` = booléen pour le sous-titre « (sélection — N lignes) ».
  - Helpers purs : `fmtFr(ts)` (Timestamp/Date → `JJ/MM/AAAA` ou « — »), regroupement par bâtiment
    via `resolveBuildings` + ordre `niveauxForConfig` (réutilise `pieuvresModel.js`), `niveauLabel`
    et libellés `LIEU_OPTIONS`/`STATUT_OPTIONS` (réutilisés de `pieuvresModel.js`).
- *(optionnel)* mini-fonction de tri/groupage exposée depuis `pieuvresModel.js` si réutile.

### Modifier
- **`src/modules/gestion-chantier/PieuvresTab.jsx`** (lecture seule, **aucune écriture ajoutée**) :
  - **Préchargement logo** : `useEffect` au montage → `loadLogoDataUri()` → `logoRef`/state
    (geste utilisateur préservé au clic, comme `QuitusActions`).
  - **Cases à cocher** par ligne pieuvre + « tout cocher / décocher » (state `selectedIds`, local).
  - **2 boutons** (gated `can(user,"gestionChantier.pieuvres","view")`) :
    « 📄 Exporter le planning (PDF) » (toutes les lignes du chantier) et « 📄 Exporter la
    sélection (PDF) » (désactivé si 0 coché). Au clic → appel **synchrone** de
    `openPieuvresPdfWindow({ chantier, rows: <toutes|sélection>, logoDataUri, selection })`.
  - Les cases et boutons s'affichent en desktop **et** PWA (cohérent responsive ; le PDF est A4
    paysage quel que soit l'appareil).

### NE PAS toucher
`permissions.js`, `firestore.rules`, `chantiers`, `CommandesInner.jsx`, le quitus
(`quitusPdfGenerator.js`/`QuitusActions.jsx` restent intacts — on s'en **inspire**, on ne les modifie pas).

---

## 3) Maquette texte des 2 PDF

### PDF complet — « Exporter le planning » (A4 paysage, 1 page / bâtiment)
```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│ [LOGO EPJ]                                  LES ORÉADES            Planning pieuvres   │  ← en-tête
│                                             N° 001374              Édité le 14/06/2026 │
│                                             Rue Gavanière, 38120 Saint-Égrève          │
│  ───────────────────────────────────────────────────────────────────────────────────│  ← filet bleu #00A3E0
│  Bâtiment A                                                                            │  ← titre bâtiment
│  ┌────────┬───────────────┬────────────┬───────────────┬───────────┬───────┬────────┬───────────┐
│  │ Niveau │ Dalle / poste │ Jour       │ Réception     │ Livraison │ Lieu  │ Statut │ Remarques │  ← thead (fond bleu, texte blanc)
│  │        │               │ demande    │ plans cotés   │ prévue    │       │        │           │
│  ├────────┼───────────────┼────────────┼───────────────┼───────────┼───────┼────────┼───────────┤
│  │ SS1    │ beton-dalle-ss1│ 12/06/2026 │ —             │ 20/06/2026│Chantier│Demandée│ …wrap…   │  ← ligne (blanc)
│  │ RDC    │ beton-dalle-rdc│ —          │ —             │ —         │Chantier│À demander│        │  ← ligne (gris très léger #F7F7F7)
│  │ R+1    │ beton-dalle-r1 │ …          │ …             │ …         │Bureau │Plans reçus│ …      │
│  │ Combles│ beton-combles  │ …          │ …             │ …         │Chantier│Livrée  │ …        │
│  └────────┴───────────────┴────────────┴───────────────┴───────────┴───────┴────────┴───────────┘
│                                                                                        │
│  EPJ Électricité Générale                          Page 1/2          Édité le 14/06/2026│  ← pied
└─────────────────────────────────────────────────────────────────────────────────────┘
   (Bâtiment B → page 2, même gabarit ; ordre niveaux : SS→RDC→R→Combles)
```
- **Colonnes à largeur fixe** (`table-layout: fixed`, somme = 100 %) : Niveau ~8 %, Dalle/poste ~12 %,
  Jour demande ~12 %, Réception ~13 %, Livraison ~12 %, Lieu ~8 %, Statut ~11 %, **Remarques ~24 %**
  (`white-space: normal; word-break: break-word` → passe à la ligne, **aucun débordement**).
- **Charte sobre** : thead fond **bleu #00A3E0** texte blanc ; filets/titre bâtiment en bleu ;
  **lignes alternées** gris très léger ; accents **orange #F8A018 / vert #98D038** réservés à de
  fins détails (filet de titre, puce statut éventuelle). Typo Arial/Helvetica lisible.
- **Marges** confortables (≈ 12 mm) ; rien ne touche les bords.

### PDF sélection — « Exporter la sélection »
- **Gabarit identique**, mais uniquement les **lignes cochées** ; un bâtiment n'apparaît que s'il a
  au moins une ligne cochée. Sous-titre d'en-tête : **« Planning pieuvres — sélection (N lignes) »**
  pour signaler que c'est partiel (cas « envoyer les modifications »).

---

## 4) Confirmation read-only

- Le générateur **ne lit que** `chantier` (prop) + les `rows` pieuvre (déjà chargées par le
  snapshot de `PieuvresTab`) + le logo (fetch d'un asset statique). **Zéro `setDoc`/`updateDoc`/
  `addDoc`/`delete`.** Les cases à cocher et le PDF sont 100 % côté client.
- Aucune nouvelle collection, aucune règle, aucune Cloud Function, `permissions.js` intact.
- Réutilise les helpers purs de `pieuvresModel.js` (`niveauxForConfig`, `niveauLabel`,
  `LIEU_OPTIONS`, `STATUT_OPTIONS`) + `resolveBuildings`/`getBuildingLetter` (`avancementTasks.js`).

---

## 5) Après GO — exécution
1. Créer `pieuvresPdf.js`, modifier `PieuvresTab.jsx` (sélection + 2 boutons + préchargement logo).
2. `npm run build` + `git fetch origin` + `git diff origin/main`.
3. Commit `feat(gestion-chantier): export PDF planning pieuvres (complet + sélection)`, push branche.
4. URL preview + checklist (logo affiché ✅, A4 paysage, 1 page/bâtiment, pied + n° page, remarques
   qui wrappent, lignes alternées, sélection partielle, aucune écriture). **Pas de merge `main`.**

---

**STOP — j'attends ton « GO ».** Confirme au passage : **A4 paysage** (recommandé) ✅, et le rendu
« 1 page par bâtiment » via html2canvas multi-pages (pour un pied de page + n° de page maîtrisés).

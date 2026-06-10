# DIRECTION ARTISTIQUE — EPJ App Globale

> **Note charte (2026-06-10)** : valeurs de couleur et de police ci-dessous
> **vérifiées sur `logo.png` et les supports print officiels EPJ**. Le §1.1 et le
> §2 reflètent les tokens réellement déployés dans `src/core/theme.js` (commit
> charte `feat(ds): charte — orange/green alignés logo`). En cas de doute, le code
> `theme.js` fait foi.

**Statut** : loi du design. Référencée par tous les tickets DS (DS-1 et suivants).
**Principe directeur** : le haut de gamme vient de la discipline, pas de la décoration. Zéro gradient, zéro effet, zéro ombre lourde. Hiérarchie typographique stricte, grille d'espacement, couleurs qui signifient.
**Portée** : PWA (mobile terrain) ET desktop (bureau). Un seul système, deux densités.
**Implémentation** : 100 % dans l'idiome existant — inline styles + tokens `src/core/theme.js` + primitives `src/core/components/`. Aucun framework CSS.

---

## 1. Identité EPJ — couleurs et logo

### 1.1 Palette de marque (tokens theme.js)

| Token | Valeur | Rôle |
|---|---|---|
| `blue` | `#00A3E0` | **Couleur de travail.** Actions principales, navigation active, liens, focus, accents. Conforme au dégradé du logo. C'est elle qui porte l'identité au quotidien. |
| `orange` | `#F8A018` | **Sémantique uniquement** : avertissement, attention, en attente, retard. Orange doré charte. Jamais décoratif. |
| `green` | `#98D038` | **Sémantique uniquement** : succès, validé, disponible, terminé. Vert pomme charte. Jamais décoratif. |
| `red` | `#E53935` | Erreur, hors service, bloqué, suppression. |
| `dark` | `#3D3D3D` | Texte principal, éléments structurels foncés (sidebar desktop possible). |

**Texte sémantique foncé** (lisible sur fonds clairs/doux — teinte foncée de chaque famille) :

| Token | Valeur | Rôle |
|---|---|---|
| `greenText` | `#4C7A14` | Texte succès sur fond clair/`successBg`. |
| `orangeText` | `#9A6200` | Texte warning sur fond clair/`warningBg`. |
| `redText` | `#B71C1C` | Texte danger sur fond clair/`dangerBg`. |
| `blueText` | `#006B94` | Texte info sur fond clair/`infoBg`. |

**Règle d'or couleur** : sur un écran donné, le bleu EPJ travaille (boutons, nav, liens) ; orange/vert/rouge n'apparaissent QUE quand ils portent un statut. Un écran sans alerte ni statut est bleu + gris, point. C'est ce contraste de rareté qui rend les statuts lisibles d'un coup d'œil.

**Interdits** :
- Couleur de marque en grand aplat décoratif (bandeau orange pleine largeur "pour faire joli").
- Plus de 2 couleurs sémantiques simultanées dans un même composant.
- Hex en dur : toute couleur passe par un token `EPJ.*`. (Exception : générateurs PDF/print.)

### 1.2 Fonds sémantiques doux (tokens DS-0)

`successBg` (`#E8F5E9`), `warningBg` (`#FFF3E0`), `dangerBg` (`#FFEBEE`), `infoBg`
(`#E3F2FD`) — réservés aux badges, bannières et lignes de mise en évidence. Texte
sur fond doux = toujours la teinte foncée de la même famille (`greenText`,
`orangeText`, `redText`, `blueText` ; jamais de noir pur sur fond coloré).

### 1.3 Logo EPJ

| Contexte | Usage |
|---|---|
| **Desktop — sidebar/header** | Logo complet en tête de navigation, hauteur 28–32 px, zone de protection = hauteur du logo /2 de chaque côté. Cliquable → Accueil/Cockpit. |
| **PWA — header mobile** | Version compacte (monogramme ou logo réduit), hauteur 24 px max. Le header mobile est précieux : le logo ne doit pas voler la place du titre d'écran. |
| **Écran de login** | Logo complet centré, c'est SON moment. Fond blanc ou gris très clair, jamais de fond coloré derrière le logo. |
| **PDF / quitus / exports** | Logo complet en en-tête de document (déjà le cas — ne pas régresser). |
| **Favicon / icône PWA** | Monogramme sur fond bleu EPJ (existant — conserver). |

Interdits logo : étirement, recoloration, pose sur fond orange/vert, opacité réduite en filigrane décoratif.

---

## 2. Typographie

**Familles (tokens `font` — déployés dans theme.js)** :
- `font.body` = **Inter** (`'Inter', 'Segoe UI', -apple-system, sans-serif`) — tout le texte courant et l'UI.
- `font.display` = **Instrument Serif** (`'Instrument Serif', 'Georgia', serif`) — titres éditoriaux / moments forts.
- `font.mono` = **JetBrains Mono** (`'JetBrains Mono', 'SF Mono', 'Menlo', monospace`) — références techniques (n° commande, réf produit, SHA).

### 2.1 Échelle (tokens fontSize — créés en DS-0)

| Token | Taille | Usage |
|---|---|---|
| `xs` | 12 | Micro-labels, légendes, horodatages |
| `sm` | 13 | Texte secondaire, cellules de tableau denses, sous-titres de ligne |
| `md` | 14 | **Corps par défaut desktop** (tableaux, formulaires, nav) |
| `base` | 16 | **Corps par défaut PWA** (lisibilité terrain) + paragraphes desktop |
| `lg` | 20 | Titres de section, titres de carte importants |
| `xl` | 24 | Chiffres KPI, titre de page |

### 2.2 Graisses (tokens fontWeight — créés en DS-0)

**Deux graisses en usage courant : 400 (regular) et 500 (medium).** C'est le changement le plus structurant vs l'existant (369 graisses 700/800 en dur).

- 400 : tout le texte courant.
- 500 : titres, labels, valeurs importantes, boutons.
- 600 : exceptionnel — chiffres KPI uniquement si 500 manque de présence.
- 700/800 : **interdits** dans l'UI écran (tolérés uniquement dans les PDF print).

### 2.3 Règles typo

- **`fontVariantNumeric: 'tabular-nums'` sur TOUT chiffre aligné** : tableaux, KPI, montants, pourcentages, compteurs. Les colonnes de chiffres s'alignent au pixel — marqueur de gamme n°1.
- Micro-labels de section : 12 px, graisse 500, `letterSpacing: '0.03em'`, majuscules, couleur grise secondaire. (Ex. « AVANCEMENT CHANTIERS », « À TRAITER »).
- `lineHeight` : 1.4 pour l'UI dense, 1.6 pour les paragraphes.
- Jamais de texte sous 12 px.
- Troncature : `ellipsis` sur les noms longs (chantiers, désignations produits) plutôt que retour à la ligne dans les tableaux.

---

## 3. Espacement et grille

**Grille de 4.** Tout espacement est un multiple de 4 px, mappé sur les tokens `space` existants (xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32) — tokens déjà définis dans theme.js, à activer.

| Contexte | Valeur |
|---|---|
| Padding interne carte/panneau | 16 (desktop dense : 14–16 ; PWA : 16) |
| Gap entre cartes KPI | 12 |
| Gap entre sections d'une page | 24 |
| Padding cellule tableau desktop | 10–12 vertical, 8–12 horizontal |
| Padding ligne de liste PWA | 12–16 vertical (cible tactile, cf. §6) |
| Marges latérales page PWA | 16 |
| Marges latérales contenu desktop | gérées par le cadre 1320 (Lot 0) |

**Règle** : si une valeur d'espacement n'est pas un multiple de 4, c'est une erreur. Migration des 1175 littéraux existants : opportuniste, à chaque passage dans un fichier (pas de big-bang).

---

## 4. Surfaces, bordures, profondeur

- **Fond de page** : gris très clair (gray50/100) en desktop ; blanc en PWA.
- **Cartes/panneaux** : fond blanc, bordure 1 px `gray200` (ou 0.5 px si rendu propre), `radius.lg` (12) pour les cartes, `radius.md` (10) pour les contrôles. Tokens radius existants — à activer.
- **Ombres** : tokens shadow DS-0 uniquement. `sm` pour les cartes (quasi imperceptible), `md` pour les éléments flottants (menus, popovers), `lg` pour les modales. **Jamais d'ombre portée colorée ni de blur décoratif.**
- **Séparateurs** : bordure 1 px `gray100/200`, jamais de double trait, jamais de séparateur + ombre cumulés.
- **Profondeur par le fond, pas par l'ombre** : une zone secondaire = fond `gray50`, pas une ombre inversée.

---

## 5. Primitives — anatomie et états obligatoires

Chaque primitive (DS-1) implémente **tous** ces états. Un composant sans état vide ou sans focus visible est incomplet.

### États transverses obligatoires

1. **Repos** — l'état par défaut.
2. **Hover** (desktop uniquement) — changement subtil : fond `gray50`/`blue` à 8–10 % d'opacité, ou bordure renforcée. Transition 120–150 ms. Jamais de transform/scale agressif.
3. **Focus visible** (clavier) — anneau 2 px bleu EPJ (`outline` ou `boxShadow: focus`), jamais supprimé sans remplacement.
4. **Actif/pressé** — assombrissement léger du fond.
5. **Désactivé** — opacité 0.5 + `cursor: not-allowed`. Pas de gris custom par écran.
6. **Chargement** — squelettes (blocs gris animés discrets) pour les zones de données ; spinner existant pour les actions. Jamais d'écran blanc qui « pop ».
7. **Vide** — chaque liste/tableau a un état vide soigné : icône grise + phrase courte + action si pertinente (« Aucun outil en maintenance — tout le parc est opérationnel »). **L'état vide est un écran à part entière, pas un oubli.**

### `<Button>`
- Variantes : `primary` (fond bleu EPJ, texte blanc), `secondary` (bordure, fond blanc), `ghost` (texte seul, pour actions tertiaires), `danger` (rouge, destructif).
- Hauteurs : 36 desktop / 44 PWA. Radius md. Graisse 500. Icône optionnelle à gauche (16 px).
- **Un seul bouton primary par zone d'écran.** Deux actions principales côte à côte = une erreur de hiérarchie.

### `<Badge>` (statuts — ~119 sites)
- Anatomie : fond doux sémantique + texte teinte foncée même famille (`greenText`/`orangeText`/`redText`/`blueText`) + point ou icône 12–13 px optionnel.
- Taille : 11.5–12 px, graisse 500, padding 3×9, radius pill.
- **Table de correspondance statut→couleur centralisée dans le composant** (Disponible→vert, Maintenance→orange, Hors service→rouge, Commandée→bleu, etc.). Aucun écran ne décide de ses propres couleurs de statut.

### `<Banner>` (alertes — 53 sites)
- Anatomie : bordure gauche 3 px couleur sémantique (radius 0 sur ce côté), fond doux, icône + titre 500 + texte, action optionnelle à droite.
- Paramètres : `{ tone, icon, title, text, onClick }` — remplace les 53 copies inline.

### `<StatCard>` (KPI)
- Label 12–13 px gris secondaire, valeur 24 px graisse 500 tabular-nums, delta optionnel 12 px coloré sémantique avec icône tendance.
- Fond `gray50` OU blanc bordé — un seul style retenu pour toute l'app, pas les deux.

### `<DataTable>` (desktop)
- En-têtes : 13 px graisse 500 gris secondaire, bordure basse renforcée.
- Lignes : hover `gray50`, bordure basse `gray100`, hauteur ~44–48 px.
- Colonnes chiffres alignées à droite, tabular-nums. Colonne actions à droite (menu ⋯).
- Tri au clic sur en-tête (chevron). Pagination sobre en pied.
- **En PWA (< 760), le même composant rend des cartes** (pattern table↔carte via useViewport) — c'est la primitive qui gère la bascule, plus les écrans.

### `<Field>` (input/select/textarea — 198 contrôles)
- Hauteur 36 desktop / 44 PWA, radius md, bordure `gray200`, focus anneau bleu.
- Label au-dessus 13 px graisse 500 ; message d'erreur 12 px rouge sous le champ.
- Select et textarea alignés sur le même style (aujourd'hui disparates).

### `<ListRow>` (PWA surtout)
- Zone tactile pleine largeur, padding vertical 12–16, chevron droit si navigable, séparateur `gray100`.

### `ModuleSubHeader` (existant — enrichir, ne pas refaire)
- Ajouter : emplacement action principale à droite, fil d'ariane optionnel desktop, compteur (« 142 outils · 18 catégories »).

---

## 6. Densités PWA vs desktop

| | PWA (≤ 760) | Desktop (> 760) |
|---|---|---|
| Corps de texte | 16 | 14 |
| Hauteur contrôles | 44 (cible tactile min Apple) | 36 |
| Données | Cartes empilées | Tableaux denses |
| Navigation | Header compact + accueil par tuiles (existant) | Cadre 1320, sidebar possible à terme |
| Hover | Aucun (tactile) | Systématique |
| Espacement | Confortable | Compact |

La bascule est portée par `useViewport` (Lot 0) **à l'intérieur des primitives** — les écrans consomment `<DataTable>` sans se soucier du device.

---

## 7. Iconographie

- Un seul set d'icônes, style outline, épaisseur constante (Lucide en référence — à confirmer selon ce qui est faisable sans dépendance lourde ; sinon set SVG inline maison cohérent).
- Tailles : 16 px inline (boutons, cellules), 20 px navigation, 24 px max décoratif.
- Les emojis existants (catIcons, tuiles) : tolérés transitoirement, à remplacer écran par écran par des icônes du set. Pas d'emoji dans les nouveaux développements UI.
- Couleur d'icône = couleur du texte adjacent (héritée), sauf icône de statut = couleur sémantique.

---

## 8. Mouvement

- Transitions : 120–180 ms, `ease-out`, sur fond/bordure/opacité uniquement.
- Pas d'animation d'entrée de page, pas de slide décoratif, pas de bounce.
- Le keyframe pulse existant (badge-dot) : conservé, c'est un signal fonctionnel.

---

## 9. Ton rédactionnel UI

- Français, direct, métier. « Aucun écart de prix ouvert » plutôt que « Vous n'avez actuellement aucun écart ».
- Dates relatives courtes quand récent (« hier », « il y a 4 j »), date complète au-delà de 7 jours.
- Montants : format français, espace insécable, « 1 240 € ».
- Jamais de point d'exclamation dans les messages système.

---

## 10. Application — rappel du séquencement

1. **DS-0** (terminé) : tokens + quick wins hex + réalignement charte couleurs. Ce document n'y change rien.
2. **DS-1** : primitives ci-dessus (§5), conformes aux états obligatoires + 2-3 écrans témoins.
3. **DS-2+** : repeinte écran par écran, fusionnée avec les lots desktop (un passage par fichier).
4. **Trio sensible** (`CommandesInner.jsx`) : dernier, GO écrit dédié, absorbe DS + responsive + signature souris.
5. **Hors périmètre écran** : générateurs PDF/export (mais le logo et la palette y restent la référence print).

**Critère de réussite global** : ouvrir n'importe quel écran de l'app et ne pas pouvoir deviner quel module a été repeint en premier — tout est du même monde.

---

*Document de référence — cité dans chaque ticket DS : « conforme à DIRECTION_ARTISTIQUE.md ».*

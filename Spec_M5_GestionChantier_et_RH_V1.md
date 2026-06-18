# Spec — Module GESTION DE CHANTIER (M5) + Module RESSOURCES HUMAINES

**Date** : 13 juin 2026
**Statut** : spec à valider avant démarrage dev. Aucun code déployé.
**À déposer** : à côté de `Livraison_Spec_Module_Chiffrage_V1/`
**Estimations** : exprimées en **lots Claude Code** (un lot = un ticket dense, un checkpoint avant code), pas en jours-homme.

> ⚠️ **Garde-fous projet rappelés en tête.**
> - **Trio sensible** (GO écrit obligatoire avant toute modif) : `src/core/permissions.js`, collection `chantiers`, `src/modules/commandes/CommandesInner.jsx`. Plusieurs features ci-dessous écrivent dans `chantiers` → strictement **additif** + `setDoc(..., { merge: true })`.
> - Déploiement : preprod → GO écrit → merge `main` (auto Vercel + GitHub Actions). Jamais `firebase deploy` / `vercel --prod` manuel.
> - Make abandonné. Automatisations = Cloud Functions + Gmail API + Brevo + Claude API + Zapier (Esabora seul).
> - Esabora **n'a pas d'API** : toute donnée d'heures réelles entre par **import Excel mensuel** (une seule porte, deux consommateurs : Financier + Frais RH).

---

## 1. Décisions structurantes de cette livraison

1. **Renommage** : le Module 5 « Suivi chantier + Esabora » devient **« Gestion de chantier »**.
2. **Navigation chantier-first** : la page d'accueil du module = **liste des chantiers** (filtrée `own_chantiers` pour les conducteurs). On ouvre un chantier → fiche chantier à **onglets**. Les anciens « sous-modules » deviennent des onglets de la fiche chantier.
3. **Droits d'accès par onglet** : chaque onglet est une clé de permission. Un chef de chantier autorisé voit certains onglets et pas d'autres.
4. **Le Module RH est séparé** (accessible à tous selon droits), mais **partage le socle tâches + planning** avec Gestion de chantier.
5. **Trois vues sur la même unité métier (le poste d'avancement)** :
   - **Gantt prévisionnel** (dates planifiées) — dans Gestion de chantier
   - **Planning ressources** (qui / quand, demi-journées) — dans RH
   - **Avancement réel** (% validés) — M3 existant

---

## 2. Architecture de navigation

```
MODULE GESTION DE CHANTIER
 └─ Accueil = liste chantiers (filtre own_chantiers conducteur ; "tout voir" si droit)
     └─ FICHE CHANTIER (onglets, chacun gated par permission) :
         • Pieuvres              gestionChantier.pieuvres
         • Suivi commandes       gestionChantier.commandes
         • Suivi financier       gestionChantier.financier
         • Suivi de chantier      gestionChantier.suivi      (CR + CR SPS + tâches)
         • Planning / Gantt       gestionChantier.gantt
         • TMA                    gestionChantier.tma
         • Démarches admin        gestionChantier.demarches  (cf. spec Chiffrage)

MODULE RESSOURCES HUMAINES (accès large, selon droits)
 • Congés / absences            rh.conges
 • Planning ressources          rh.planning
 • Frais de déplacement         rh.frais
 • Récap & analyse (admin)      rh.analyse        (Direction / Assistante / Admin)
```

### Permissions — extension de `permissions.js` (TRIO SENSIBLE → GO écrit)
Ajout des modules `gestionChantier` et `rh` dans `MODULES`, avec sous-clés ci-dessus. `DEFAULT_PERMISSIONS` :
- **Conducteur travaux** : `gestionChantier.*` en scope `own_chantiers` ; `rh.planning` + `rh.conges` (validation N1) ; pas `rh.analyse`.
- **Chef de chantier** : fermé par défaut, ouvert par `permissionsOverride` sur sa fiche (onglets choisis).
- **Assistante** : `rh.*` (dont `rh.analyse`, validation congés N2) ; `gestionChantier.financier`, `.demarches`.
- **Direction / Admin** : `all`.
- **Monteur** : lecture seule de **sa** vue planning + saisie de validation de tâche (cf. §7).

---

## 3. Onglet PIEUVRES

### Règle d'auto-génération (à la création du chantier)
Lue depuis `buildings[].config` (champs réels prod : `nbSousSols`, `nbEtages`, `combles`). Par bâtiment, **une ligne pieuvre = une dalle** :
- une ligne par sous-sol (`ss1`, `ss2`, …) — commun ou non
- une ligne RDC
- une ligne par étage (`r1`, `r2`, …, `rN`)
- une ligne combles si `combles === true`
- **radier exclu** (pas de pieuvre)

→ alignement 1:1 sur les postes `beton-dalle-*` existants de `avancementProgress`. Exemple BAT A de `001374` (1 SS, 3 étages) = 5 pieuvres (ss1, rdc, r1, r2, r3).

> **Lien fort** : la date de dalle = deadline livraison pieuvre **et** deadline pose EPJ. C'est le pivot de l'analyse de couverture RH (§9).

### Données saisies à la main (chef ou conducteur)
Par ligne : `jourDemande`, `dateReceptionPlansCotes`, `dateLivraison`, `lieuLivraison ∈ {CHANTIER, BUREAU}`, `statut`, `remarques`.

### Modèle Firestore — collection racine `pieuvres`
```
pieuvres/{pieuvreId}            // id auto
  chantierId: string            // n° Esabora 6 chiffres
  batiment: string              // "A"
  niveau: string                // "ss1" | "rdc" | "r1"...
  posteAvancementKey: string    // "beton-dalle-r1"  (jointure M3)
  jourDemande: Timestamp | null
  dateReceptionPlansCotes: Timestamp | null
  dateLivraison: Timestamp | null
  lieuLivraison: enum           // CHANTIER | BUREAU
  statut: enum                  // A_DEMANDER | DEMANDEE | PLANS_RECUS | LIVREE
  commandeId: string | null     // lien vers commandes/ si commande passée
  remarques: string | null
  createdAt / updatedAt
```
Collection racine séparée → **pas d'écriture dans `chantiers`** pour les pieuvres. Auto-génération via Cloud Function `onChantierCreate` (ou bouton « (Re)générer les pieuvres » idempotent côté UI).

### UI
Tableau par bâtiment, colonnes = dates + lieu + statut. Vue calendrier optionnelle (les `dateLivraison` alimentent aussi le Gantt §6).

**Lot dev** : modèle + auto-gen + page tableau = **1 lot** (M).

---

## 4. Onglet SUIVI COMMANDES

### Détection auto de l'AR dans `achat@`
La boîte `achat@` est déjà référencée (`config/settings.emailAchats`). Un **seul polling `achat@`** avec **routage par type** :
- AR de commande fournisseur → rattachement à `commandes/` + écriture `dateReception`
- offre de prix (libellé `EPJ-Module/Offre de prix`) → référentiel tarifs (spec Chiffrage)
- autre → à classer

Clé de jointure AR ↔ commande : numéro `CMD-2026-XXXX` dans l'objet/corps, ou n° Esabora. Le PDF d'AR est stocké (Drive) et lié à la commande.

> ⚠️ **Ne pas créer un 2e polling concurrent** : étendre le mécanisme Gmail existant (cf. Chiffrage chantier 14). Brouillon uniquement, jamais d'auto-send. MIME `\r\n\r\n` entre headers et body.

### Historique visuel des commandes du chantier
Lecture filtrée de `commandes` (champ `chantier` / `chantierNum`). Timeline : date commande → AR reçu → réception. Aucune nouvelle collection (réutilise `commandes`).

**Lot dev** : routage achat@ + détection AR + écriture dateReception = **1 lot** (M) ; historique visuel = **0,5 lot** (S).

---

## 5. Onglet SUIVI FINANCIER

### Champs prévus — admin chantier (TRIO SENSIBLE → GO écrit, additif, merge:true)
Ajout sur `chantiers/{id}` :
```
totalMaterielPrevu: number | null     // € HT, saisi dans l'admin chantier
nbHeuresPrevues: number | null        // h, saisi dans l'admin chantier
```

### Compteurs de comparaison (prévu vs réel)
| Indicateur | Prévu | Réel |
|---|---|---|
| Matériel | `totalMaterielPrevu` | Σ des commandes du chantier (`commandes`) |
| Heures | `nbHeuresPrevues` | Σ heures import Excel (mois cumulés) |

Affichage : 2 jauges + delta + % consommé. Alerte visuelle si réel > prévu (pas de SMS).

### Import Excel des heures (mensuel) — source unique
Esabora ne sort pas d'API → case d'upload Excel par mois. Parsing (lib `xlsx` déjà au stack), mapping colonnes → `{ salariéId, chantierId, mois, heures }`. Stocké :
```
heuresMensuelles/{salarieId}_{mois}        // ex. "Frasca_2026-06"
  salarieId, salarieNom, mois ("2026-06")
  lignes: [ { chantierId, chantierNum, heures } ]
  sourceFichier: DriveRef
  importePar, importeLe
```
Consommé par **Financier** (heures réelles) **et** **Frais RH** (jours travaillés / chantier). Verrou de clôture mensuel = collection existante `avancementValidations` (`{chantierNum}_{mois}`).

**Lot dev** : champs admin + compteurs = **1 lot** (M, GO trio) ; import Excel + parsing + stockage = **1 lot** (M).

---

## 6. Onglet PLANNING / GANTT PRÉVISIONNEL

Gantt par poste d'avancement, **dates précises** début/fin, join sur `avancementProgress` pour afficher **prévu vs réel** sur la même barre. Pieuvres (§3) injectées comme jalons.

### Modèle — collection `ganttAvancement` (parallèle, n'alourdit PAS `chantiers`)
```
ganttAvancement/{chantierId}_{batiment}_{posteKey}
  chantierId, batiment, posteKey
  libelle: string
  datePrevueDebut: Timestamp | null
  datePrevueFin: Timestamp | null
  ganttOnly: boolean            // true = tâche Gantt sans poste M3 officiel
  createdAt / updatedAt
```
Jointure avec `chantiers.avancementProgress[batiment][posteKey]` (le %) au runtime. M3 reste la vérité du réalisé.

### Création d'une tâche dans le Gantt
Popup **« Ajouter à l'avancement chantier ? »** :
- **Oui** → écrit une nouvelle clé poste dans `chantiers.avancementProgress[batiment]` (**TRIO SENSIBLE, GO écrit**, additif, merge:true) + crée l'entrée Gantt.
- **Non** → entrée `ganttAvancement` avec `ganttOnly: true`.

Miroir de la règle inverse : nouveau poste M3 → apparaît automatiquement dans le picker du planning ressources (§7).

**Lot dev** : modèle + Gantt + lien bidirectionnel avancement = **1,5 lot** (L, dont 1 GO trio).

---

## 7. SOCLE COMMUN — tâches + planning ressources

### 7.1 Collection `taches`
Tâches ponctuelles (≠ postes d'avancement M3, qu'on nomme **« postes »** dans l'UI pour éviter toute confusion).
```
taches/{tacheId}
  chantierId: string
  titre, description
  source: enum            // CR_CHANTIER | CR_SPS | MANUELLE | GANTT
  priorite: enum          // NORMALE | IMPORTANTE | SECURITE
  statut: enum            // A_FAIRE | EN_COURS | FAIT | ANNULEE
  assigneA: string | null
  dateEcheance: Timestamp | null
  creePar: string         // "IA" | uid
  mailRef: { messageId, threadId } | null
  resumeIA: string | null
  confianceIA: number | null
  valideePar: string | null   // tâche IA confirmée par un humain (1 tap)
  createdAt / updatedAt
```
Tâche créée par l'IA → naît `valideePar: null` (« à valider »), le conducteur confirme/rejette en un tap (anti-faux-positifs SPS).

### 7.2 Planning ressources — demi-journées + poste + temps
**Granularité demi-journée.** Un créneau = (ressource × date × période). Un doc par créneau (clé lisible, drag-drop propre, SMS-on-change sans conflit de merge).
```
planningCreneaux/{ressourceId}_{date}_{periode}     // "Bartoli_2026-06-15_AM"
  ressourceId, ressourceNom
  ressourceType: enum     // SALARIE | INTERIM | ARTISAN
  date: "2026-06-15"
  periode: enum           // AM | PM
  chantierId: string | null
  posteAvancementKey: string | null   // picker = postes M3 du chantier (live)
  tempsEstimeH: number | null
  tacheId: string | null               // lien éventuel vers une tâche ponctuelle
  etatValidationMonteur: enum          // NON | SAISIE_MONTEUR  (cf. workflow)
  smsEnvoye: boolean
  creePar / modifiePar / updatedAt
```

> Le picker de poste lit **en direct** les postes M3 du chantier (`avancementProgress` + Gantt). Nouveau poste M3 = dispo immédiatement, **sans duplication**.

### 7.3 Workflow de validation monteur (PAS d'avancement auto)
```
1. Conducteur/chef affecte un monteur → créneau (AM/PM) + poste + temps estimé
2. Le monteur voit ça dans SON module RH (vue planning monteur)
3. Le monteur valide « fait »   → etatValidationMonteur = SAISIE_MONTEUR
                                   (AUCUNE écriture dans chantiers à ce stade)
4. File d'attente côté conducteur/chef (badge « à valider »)
5. Conducteur/chef valide         → écriture ADDITIVE de avancementProgress
                                     (TRIO SENSIBLE, merge:true, % additif)
6. Affiché dans Gestion de chantier (réel) ET RH (vue monteur : « validé »)
```
La validation monteur est un **statut sur le créneau**, pas une nouvelle collection lourde. La validation conducteur est la **seule** opération qui touche `chantiers`. **`avancementValidations` n'est PAS réutilisé ici** : c'est un verrou mensuel (`{chantierNum}_{mois}`), distinct.

### 7.4 Vue planning (simple / intuitive)
Grille hebdo : **lignes = ressources, colonnes = jours (×2 demi-journées)**, cellule = pastille couleur chantier. Drag & drop ; bouton **« Copier S-1 »** (90 % du temps rien ne bouge). Overlay disponibilité (§9.1). Filtre conducteur (ses ressources/chantiers ; toggle « tout voir »).

### 7.5 SMS Brevo — uniquement sur changement
- **Pas de SMS** à la création/duplication initiale.
- **SMS** si modification d'un créneau **déjà publié** touchant **demain ou après-demain** (changement de chantier). Template `smsTemplates` module `planning`.

**Lots dev** : `taches` + intégration tâches IA = **1 lot** (M) ; planning créneaux + grille drag-drop + copier S-1 = **1,5 lot** (L) ; workflow validation monteur (+ écriture trio) = **1 lot** (M, GO trio) ; SMS changement = **0,5 lot** (S).

---

## 8. Onglet SUIVI DE CHANTIER — CR hebdo + CR SPS → IA → tâches

### Flux
1. Polling de la boîte mail conducteur (ou boîte dédiée) : **compte rendu de chantier hebdo** + **compte rendu de visite SPS**.
2. PDF/corps → **Claude API (Haiku)** : classification + extraction.
   - CR chantier → **résumé court** affiché dans la fiche + création de `taches` (source `CR_CHANTIER`) sur points importants.
   - CR SPS → si **anomalie sécurité** détectée → `taches` (source `CR_SPS`, priorité `SECURITE`).
3. Tâches créées `valideePar: null` → file « à valider » du conducteur.

> Brouillons / lecture seule côté mail. Traçabilité : `mailRef` sur chaque tâche. Pas de SMS (remontée cockpit + tâche).

**Lots dev** : polling + classification IA CR/SPS = **1,5 lot** (L) ; résumé + génération tâches + affichage = **1 lot** (M).

---

## 9. MODULE RH

### 9.1 Congés & absences
**Validation à 2 niveaux : conducteur (N1) puis assistante (N2).** Une fois validé, l'absence s'injecte dans le planning (overlay disponibilité) → le conducteur voit qui est dispo / en congé / absent.
```
conges/{id}
  ressourceId, ressourceNom
  type: enum              // CONGE | RTT | MALADIE | ABSENCE | GRAND_DEPLACEMENT
  dateDebut, dateFin      // + demiJournees optionnel
  statut: enum            // DEMANDE | VALIDE_N1 | VALIDE | REFUSE
  validations: [ { par, role, le } ]
  motif
  createdAt / updatedAt
```
**Disponibilité = dérivée** (pas de champ stocké sur le créneau) : une ressource est indispo sur (date, période) si un congé `VALIDE` la couvre → cellule grisée/non-affectable dans le planning.

### 9.2 Récap & analyse (Direction / Assistante / Admin — `rh.analyse`)
- Calendrier d'équipe + tableau des congés/absences.
- **Analyse intelligente de couverture** — croisement de 3 sources **déjà disponibles** :
  ```
  dates de dalle (pieuvres / Gantt)  ×  congés validés EPJ  ×  affectations de la semaine
     =  semaines à risque
        « dalle BAT A r2 coulée S31, aucun monteur dispo (2 en congé) → trouver remplaçant »
  ```
  > ⚠️ **Écart signalé** : EPJ ne peut pas importer les congés des maçons (donnée externe). Le **signal de gros œuvre actif = les dates de dalle que tu saisis** (pieuvres/Gantt) — donnée que tu maîtrises, et meilleure. C'est le cas « été/rentrée : le gros œuvre tourne, mes gars sont en congé ».
- Remontée : alerte visuelle cockpit conducteur + récap admin + relance mail. **Pas de SMS.**

**Lots dev** : congés + validation 2 niveaux + overlay dispo = **1,5 lot** (L) ; récap + analyse couverture = **1 lot** (M).

### 9.3 Frais de déplacement (grille FBTP Isère)
**Calcul par salarié / jour travaillé** (jours issus de l'import Excel §5) :
```
kmTrajet    = Σ legs routiers du mode de trajet configuré pour l'utilisateur   (km route, aller)
zone        = mapZone( kmTrajet )
transport   = grille.zones[zone].transport   (= 0 si vehiculeServiceFourni)
trajet      = grille.zones[zone].trajet       (toujours dû sauf logé sur place)
repas       = grille.repas                    (1 par midi travaillé, si eligibleRepas)
total_jour  = transport + trajet + repas
```

**Distance = kilométrage routier réel** (pas vol d'oiseau), calculé par une **Cloud Function** appelant un service d'itinéraire (Mappy / Google Maps Distance Matrix / équivalent). ⚠️ Nouvelle dépendance externe (clé API) — direct depuis Cloud Function, pas Make. **Cache** par paire de points (recalcul uniquement si une adresse change) pour éviter les appels répétés et le coût. Champ **override manuel** (km) si une adresse résout mal.

**Mode de trajet configurable et évolutif** — référentiel éditable en admin (pas d'enum figé) :
```
referentielModesTrajet/{modeId}
  libelle: string         // "Domicile → Chantier", "Bureau → Chantier", "Domicile → Bureau → Chantier"
  legs: string[]          // points ordonnés, ex. ["DOMICILE","BUREAU","CHANTIER"]
  actif: boolean
```
Points résolus au calcul : `DOMICILE` = adresse du salarié, `BUREAU` = `3 rue Georges Perec, 38400 Saint-Martin-d'Hères` (config), `CHANTIER` = adresse chantier. `kmTrajet` = somme des legs routiers consécutifs. Ajouter une combinaison = ajouter un doc, zéro code.

> Note métier : conventionnellement la zone « petit déplacement » se mesure siège → chantier. Autoriser un calcul domicile ou multi-legs est un **choix de politique entreprise** ; l'app calcule le mode configuré et produit une **proposition** que l'assistante valide (elle ne déclenche aucun versement).

**Champs à ajouter sur `utilisateurs/{id}` (admin user)** :
```
adresseDomicile: string
domicileLat / domicileLng: number | null     // géocodés (résolution adresse)
modeTrajetFraisId: string                     // → referentielModesTrajet (évolutif)
kmOverride: number | null                     // force le km si résolution routière mauvaise
vehiculeServiceFourni: boolean                // true => transport = 0
eligibleRepas: boolean                        // défaut true
```

**Référentiel grille VERSIONNÉ (mise à jour annuelle en admin)** — collection `referentielGrilleDeplacementBTP` :
```
referentielGrilleDeplacementBTP/{id}
  source: string          // "FBTP Isère QS 11/2026"
  dateEffet: "2026-01-01"
  repas: 12.06
  zones: [
    { zone:"1a", kmMin:0,  kmMax:5,  transport:1.12,  trajet:0.69 },
    { zone:"1b", kmMin:5,  kmMax:10, transport:3.40,  trajet:2.02 },
    { zone:"2",  kmMin:10, kmMax:20, transport:6.66,  trajet:3.72 },
    { zone:"3",  kmMin:20, kmMax:30, transport:10.89, trajet:5.75 },
    { zone:"4",  kmMin:30, kmMax:40, transport:15.11, trajet:7.78 },
    { zone:"5",  kmMin:40, kmMax:50, transport:19.04, trajet:9.71 }
  ]
  pdfRef: DriveRef | null
  actif: boolean
  createdAt
```
Le calcul d'un mois M choisit la grille dont `dateEffet ≤ M` la plus récente. **Aucune valeur en dur** : chaque janvier, l'assistante saisit la nouvelle grille + joint le PDF, l'historique reste figé. Grand déplacement = cas rare, hors barème zone, saisie manuelle.

> Note juridique (PDF FBTP) : *transport* et *trajet* sont deux indemnités distinctes ; le véhicule de service supprime le transport mais **pas** le trajet ; l'app produit une **proposition** que l'assistante valide (elle ne déclenche aucun versement).

**Lots dev** : référentiel grille + édition admin + PDF = **1 lot** (M) ; champs user + référentiel modes de trajet + Cloud Function itinéraire routier + cache + override = **1 lot** (M) ; moteur de calcul + écran récap mensuel exportable = **1,5 lot** (L).

### 9.4 Planning ressources & attribution de poste
= socle §7. Côté RH : vue monteur (mon planning, mes tâches, ma validation). Attribution de poste d'avancement = `posteAvancementKey` sur le créneau.

---

## 10. Mode admin élargi (référentiels de cette livraison)
À intégrer au mode admin central (spec Chiffrage) : droits par onglet `gestionChantier.*` / `rh.*` ; **grille FBTP versionnée** ; **référentiel `referentielModesTrajet`** (combinaisons domicile/bureau/chantier, évolutives) ; mapping colonnes import Excel heures ; templates SMS `planning` ; paramètres BUREAU (adresse point zéro + clé API itinéraire) ; statuts personnalisables (pieuvres, tâches, congés).

---

## 11. Récap collections Firestore (nouvelles)
| Collection | Écrit dans `chantiers` ? | Note |
|---|---|---|
| `pieuvres` | non | auto-gen à la création chantier |
| `ganttAvancement` | non (sauf « ajouter au M3 » → GO) | jointure par poste |
| `taches` | non | tâches ponctuelles, ≠ postes M3 |
| `planningCreneaux` | non (validation conducteur → oui, GO) | 1 doc / ressource·date·période |
| `conges` | non | validation 2 niveaux |
| `heuresMensuelles` | non | import Excel, source unique heures |
| `referentielGrilleDeplacementBTP` | non | versionné `dateEffet` |

**Écritures dans `chantiers` (TRIO SENSIBLE, GO écrit, additif + merge:true)** : `totalMaterielPrevu`, `nbHeuresPrevues` (§5) ; validation conducteur d'un poste (§7.3) ; « ajouter une tâche Gantt à l'avancement » (§6).

---

## 12. Découpage dev — synthèse (lots Claude Code)
| # | Lot | Taille | GO trio |
|---|---|---|---|
| L1 | Renommage M5 + nav chantier-first + permissions onglets | M | oui (permissions) |
| L2 | Pieuvres (modèle + auto-gen + tableau) | M | — |
| L3 | Suivi commandes (routage achat@ + AR) + historique | M + S | — |
| L4 | Financier : champs admin + compteurs | M | oui |
| L5 | Import Excel heures + parsing + stockage | M | — |
| L6 | Gantt + lien bidirectionnel avancement | L | oui |
| L7 | Socle `taches` + tâches IA | M | — |
| L8 | Planning créneaux + grille drag-drop + copier S-1 | L | — |
| L9 | Workflow validation monteur (+ écriture avancement) | M | oui |
| L10 | SMS changement planning | S | — |
| L11 | Suivi de chantier : polling + IA CR/SPS → tâches | L | — |
| L12 | RH congés + validation 2 niveaux + overlay dispo | L | — |
| L13 | RH récap + analyse couverture | M | — |
| L14 | RH frais : grille versionnée + admin + PDF | M | — |
| L15 | RH frais : champs user + géocodage + calcul + récap | L | — |

**Ordre conseillé** : L1 → L2 → L4/L5 (financier, valeur immédiate) → L7/L8/L9 (socle planning+validation) → L12 (congés, débloque l'overlay et l'analyse) → L6 (Gantt) → L11 (IA CR/SPS) → L13 → L14/L15 (frais) → L3 → L10. Preprod + GO à chaque lot touchant le trio.

---

## 13. Hypothèses à confirmer (non bloquantes)
1. ~~Distance à vol d'oiseau~~ → **tranché : kilométrage routier réel** (Mappy / Google Maps Distance Matrix), modes de trajet configurables en admin. Reste à choisir le **fournisseur d'itinéraire** + clé API.
2. Boîte mail des CR chantier/SPS : boîte conducteur perso vs boîte dédiée à créer.
3. Mapping exact des colonnes du fichier Excel heures (à caler sur un export réel).
4. Régimes contractuels particuliers (salariés dont le trajet est payé en temps de travail) : gérés par flag user, à recenser.
5. Nommage définitif du sous-module « Suivi financier ».

*Fin de spec. À déposer dans `Livraison_Spec_Module_Chiffrage_V1/`.*

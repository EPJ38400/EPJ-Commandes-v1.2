# EPJ App Globale — src/ complet v6

**Version :** Socle + Admin + Commandes refondu + Avancement avec historique mensuel & heures
**Date :** 19 avril 2026

## Nouveautés v6

### 🎨 1. Refonte visuelle du Module Commandes

Le module Commandes utilisait encore une charte graphique datée (dégradés bleu/vert, fond gris, Outfit). Il est maintenant **parfaitement aligné** avec le reste de l'app :

- Typographie **Inter** (plus Outfit)
- **Glassmorphism** sur toutes les cards (fond blanc à 92% + blur 6px)
- **Header interne allégé** : fond blanc transparent avec blur (plus la barre noire épaisse)
- **Fond transparent** : les arcs EPJ passent maintenant derrière le module
- **Bouton retour** sobre et cohérent avec les autres écrans
- Le badge panier reste en orange EPJ, bien visible

Toute la logique métier du module est **intacte** : PDF, signature, validation, catalogue, commandes directes, historique, etc.

### 📅 2. Historique mensuel (point 3)

**Sélecteur de mois** en haut de l'écran d'avancement de chaque chantier :
- Le mois courant est modifiable librement (comme avant)
- Tu peux **naviguer sur les mois précédents** qui ont été figés
- Badge 🔒 à côté des mois figés

**Bouton "🔒 Figer ce mois"** (visible pour Admin, Direction, Assistante) :
- Crée un **snapshot complet** du chantier pour le mois en cours
- Stocke les % d'avancement, les heures, la structure des tâches à cet instant
- Le mois en cours reste **modifiable** (on peut figer plusieurs fois si besoin, ça écrase le snapshot du même mois)
- Tu peux ensuite consulter le snapshot plus tard pour vérifier ce qui a été facturé

**Consultation d'un mois figé** :
- Mode lecture seule (tous les curseurs sont bloqués)
- Bandeau bleu "🔒 Situation figée de [mois]"
- Bouton 🗑 disponible pour supprimer le snapshot si besoin

**Usage métier** :
```
Fin janvier → Assistante clique "🔒 Figer" → Situation de janvier verrouillée
Février → le chantier continue d'évoluer librement
Fin février → "🔒 Figer" pour février
...
Besoin de ressortir la situation de janvier ? → Sélecteur → janvier 2026
```

### ⏱ 3. Heures optionnelles par tâche (point 4)

**Bouton `⏱` à droite de chaque tâche** (visible en mode édition) :
- Clic → déplie un champ de saisie d'heures
- Accepte les décimales : `4.5` ou `4,5` (= 4h30)
- Sauvegarde automatique
- S'affiche discrètement sous le libellé de tâche : `⏱ 4.5h`

**Affichage global** :
- En dessous de la barre d'avancement globale, total cumulé : `⏱ 127.5 h cumulées sur ce bâtiment`
- Uniquement affiché si au moins une saisie existe

**Objectif** : analyser la rentabilité par tâche une fois le chantier avancé ou terminé.

### Qui fige les mois ?

- **Admin + Direction + Assistante** : peuvent figer/défiger n'importe quel chantier
- **Autres** : peuvent juste consulter les snapshots existants

## Contenu du src/

```
src/
├── App.jsx, main.jsx, firebase.js, initFirestore.js
├── core/                         (Socle — inchangé)
├── pages/
│   ├── LoginPage.jsx, HomePage.jsx
│   └── admin/                    (5 sections — inchangé)
└── modules/
    ├── commandes/
    │   ├── CommandesModule.jsx
    │   └── CommandesInner.jsx    ← CSS refondu + header allégé
    └── avancement/
        ├── avancementTasks.js    (inchangé)
        ├── AvancementModule.jsx  (inchangé)
        └── AvancementChantier.jsx  ← + historique + heures
```

## Déploiement

1. **Décompresse** ce ZIP
2. Dans GitHub, **supprime le dossier `src/` actuel**
3. **Uploade le dossier `src/` de ce ZIP**
4. Commit : *"v6 : Commandes refondu + historique mensuel + heures"*
5. Vercel redéploie automatiquement

## Tests

### 1. Commandes — vérifier l'harmonisation visuelle
- Accueil → tuile Commandes
- Le header doit être blanc transparent (plus noir)
- Les cards doivent avoir l'effet glassmorphism léger
- Les arcs EPJ doivent passer en arrière-plan
- Tester le parcours complet (sélection catégorie → panier → validation → PDF) : tout doit marcher comme avant

### 2. Historique mensuel
- Accueil → Avancement chantier → choisis un chantier
- En haut : sélecteur "Période" avec le mois courant affiché
- Bouge un curseur → l'info se sauve
- Bouton "🔒 Figer" → confirme → snapshot créé
- Change de mois dans le sélecteur → plus rien n'est modifiable, bandeau bleu visible
- Reviens sur le mois courant → les curseurs sont actifs

### 3. Heures par tâche
- Dans l'écran d'avancement, déplie une catégorie
- Clique sur l'icône ⏱ à droite d'une tâche → panel "Heures travaillées" apparaît
- Saisis `3.5` → tab out → sauvegardé
- L'info `⏱ 3.5h` s'affiche en petit sous le libellé
- Le total cumulé apparaît en haut

### 4. Tester avec différents rôles
- Admin : voit tout, peut figer, peut éditer les tâches
- Direction : voit tout, peut figer, peut éditer les tâches
- Assistante : voit tout, peut figer, ne peut pas éditer les tâches (pas le droit)
- Conducteur travaux (sur SES chantiers) : ne peut pas figer, peut éditer les tâches
- Chef chantier / Monteur : consultation + saisie des %, ne peut ni figer ni éditer les tâches

## Stockage Firestore (pour info)

Ajouts sur chaque chantier :
```
chantier.avancementProgress[buildingId]   = { taskId: %, ... }     // état courant
chantier.avancementHours[buildingId]      = { taskId: hours, ... } // heures cumulées (NEW v6)
chantier.avancementSnapshots["2026-04"]   = {                       // snapshots mensuels (NEW v6)
  [buildingId]: {
    progress: { ... },
    hours: { ... },
    categories: { ... },  // structure figée au moment du snapshot
    config: { ... },
    frozenAt: "2026-04-30T...",
    frozenBy: "userId"
  }
}
```

## Prochaines étapes

- **Prochaine livraison** : point 2 (import de devis → génération de trame d'avancement)
- OU Module 2 (Parc machines)
- OU Module 4 (Réserves & quitus)
- OU Dashboards (Direction, Conducteur, Public)

# EPJ App Globale — src/ complet v7b

**Version :** v7b — Vue d'évolution comparative des mois figés
**Date :** 20 avril 2026
**Base :** Continue depuis v7a (sessions d'heures + historique figé PDF/Excel)

## Nouveauté v7b : Vue Évolution

Dans la page **📜 Historique figé** d'un chantier, un nouvel onglet **📈 Évolution** apparaît dès qu'au moins 2 mois sont figés.

### Ce que tu vois

Un **tableau comparatif** qui montre la progression mois par mois :

```
                    Janv. 26    Févr. 26    Mars 26    Avr. 26
AVANCEMENT GLOBAL    25%         48%         72%        85%
                               ↑+23%       ↑+24%      ↗+13%

▸ 1 ÉTUDE/TMA        60%         100%       100%       100%
                               ↑+40%         =          =

▾ 2 BÉTON            30%         70%        85%        100%
                               ↑+40%       ↗+15%      ↑+15%
  • Dalle RDC        50%         100%       100%       100%
  • Mur ssol         20%         50%         80%       100%
  • Dalle combles     0%          0%          0%       100%

▾ 3 DIVERS           ...

⏱ Heures cumulées    12h         45h         89h       145h
                               +33h        +44h       +56h
```

### Fonctionnalités

**Onglets bâtiments** — si le chantier a plusieurs bâtiments (A/B/C), switch entre eux
**Catégories pliables** — clic sur une ligne catégorie pour voir le détail tâche par tâche
**Deltas colorés** entre chaque mois :
- 🟢 **Vert** (↑) : forte progression (≥+10%)
- 🔵 **Bleu** (↗) : progression normale (+1% à +9%)
- ⚪ **Gris** (=) : aucun mouvement (0%)
- 🔴 **Rouge** (↓) : régression — signale une erreur de saisie à corriger

**Ligne globale foncée** en haut = avancement global du bâtiment
**Colonne orange en surbrillance** = mois figé le plus récent
**Ligne heures en bas** = heures cumulées avec delta mensuel

### Scroll horizontal

Si beaucoup de mois sont figés (6+), la colonne "Catégorie/Tâche" reste fixée à gauche (sticky) et les mois défilent horizontalement. Idéal sur mobile.

### Cas particuliers gérés

**Tâche ajoutée en cours d'année** : elle apparaît dans le tableau, avec des cellules "—" pour les mois où elle n'existait pas encore.

**Un seul mois figé** : la vue affiche un message explicatif plutôt qu'un tableau vide.

**Aucun mois figé** : message incitant à figer un mois depuis l'écran chantier.

## Fichiers modifiés / ajoutés

```
src/modules/avancement/
├── AvancementChantier.jsx         (inchangé depuis v7a)
├── AvancementHistory.jsx          ← MODIFIÉ : 2 onglets Liste/Évolution
├── AvancementEvolution.jsx        ← NOUVEAU : vue comparative
├── AvancementModule.jsx           (inchangé)
├── avancementTasks.js             (inchangé)
└── exportUtils.js                 (inchangé)
```

28 fichiers au total.

## Déploiement

1. **Décompresse** le ZIP
2. Dans GitHub, ouvre ton repo `EPJ-Commandes-v1.2`
3. **Supprime le dossier `src/` actuel**
4. **Uploade le dossier `src/` de ce ZIP**
5. Commit : *"v7b : vue d'évolution comparative des mois figés"*
6. Vercel redéploie automatiquement (~10 secondes)

## Tests à faire

### Préparation
Fige au moins **2 mois** d'un chantier pour pouvoir comparer :
1. Ouvre un chantier → mets quelques % à jour → clique **🔒 Figer**
2. Modifie encore quelques % → clique **🔒 Figer** à nouveau

Astuce pour tester rapidement sans attendre un vrai changement de mois : dans Firestore, tu peux dupliquer la clé `avancementSnapshots` avec une autre date (ex: `2026-03`) et modifier quelques % pour simuler un mois antérieur.

### Test de la vue
1. Ouvre le chantier
2. Clique **📜 Historique**
3. Tu vois les 2 onglets en haut : **📜 Liste (2)** | **📈 Évolution**
4. Clique **📈 Évolution**
5. Le tableau apparaît avec les 2 mois côte à côte
6. Clique sur une catégorie pour la déplier et voir les tâches individuelles
7. Observe les deltas et leurs couleurs

### Points d'attention

- Sur un chantier multi-bâtiments, les onglets A/B/C apparaissent sous la légende
- Les catégories sans aucune donnée n'apparaissent pas
- Les tâches ajoutées plus tard montrent "—" pour les mois antérieurs
- La ligne heures montre le cumul absolu par mois (pas le delta — le delta est affiché en plus petit en dessous)

## Prochaines étapes roadmap

- **Module 2 : Parc machines** (inventaire outillage, affectation chantier, maintenance)
- **Module 4 : Réserves & quitus** (suivi des réserves de livraison)
- **Dashboards** (vue Direction, vue Conducteur, vue Kiosque Dahua 65")
- **Module 5 : Suivi chantier Esabora**

Dis-moi ce qui est prioritaire dès que tu as testé la v7b.

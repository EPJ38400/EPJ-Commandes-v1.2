# 📦 EPJ App Globale — v10.L.4

**Date** : 11 mai 2026
**Version** : 1.10.17
**Type** : 3 correctifs groupés sur l'intégration Esabora

---

## 🎯 Les 3 corrections

### 1. Restriction d'accès au bouton "🚀 Envoyer dans Esabora"

Désormais réservé aux rôles **Admin + Direction + Assistante achats**
(mêmes rôles que pour "Marquer commandée"). Les **conducteurs travaux**,
**chefs de chantier**, **monteurs** et autres ne voient plus :
- Le bouton "🚀 Envoyer dans Esabora" dans le détail d'une commande
- La bannière "X commandes à envoyer dans Esabora" sur la home

Logique réutilisée : la fonction `canMarkAsCommandee()` qui existait
déjà depuis v10.I — donc zéro risque de divergence si tu fais évoluer
les rôles autorisés plus tard.

### 2. Troncature silencieuse des champs Esabora

Esabora limite plusieurs champs à 40 caractères. L'erreur du dernier
test :
```
[Le champ Adresse livraison - adresse 1 doit être une chaîne dont
la longueur maximale est de 40. (N/A - ligne n°1)]
```

L'app tronque maintenant automatiquement tous les champs critiques
**avant l'envoi** :

| Champ | Limite | Source |
|---|---|---|
| Titre commande | 40 | `Cmd EPJ NUM — Chantier` (v10.L.4) |
| Titre livraison | 40 | Nom du chantier |
| Code fournisseur | 20 | `codeEsabora` du catalogue |
| Adresse 1 EPJ | 40 | "3 rue Georges Pérec" |
| CP EPJ | 10 | "38400" |
| Ville EPJ | 40 | "Saint-Martin-d'Hères" |
| Adresse livraison 1 | 40 | Adresse du chantier |
| CP livraison | 10 | CP du chantier |
| Ville livraison | 40 | Ville du chantier |
| Numéro affaire | 20 | numAffaire ou chantierNum |
| Commentaire | 200 | Numéro commande EPJ (clé jointure) |
| Référence article | 50 | item.r |
| Désignation article | 200 | item.n |
| Unité | 20 | item.u |

Si l'utilisateur a saisi une adresse de chantier > 40 caractères,
elle sera coupée silencieusement dans le draft Esabora. L'utilisateur
peut la compléter directement dans Esabora après import.

### 3. Nom du chantier dans le titre de la commande Esabora

Demande explicite. Le titre passe de :
```
Commande EPJ CMD-2026-0042
```
à :
```
Cmd EPJ CMD-2026-0042 — Résidence Les Hauts
```

Le format `Cmd EPJ` (au lieu de `Commande EPJ`) gagne 3 caractères pour
laisser plus de place au nom du chantier dans la limite 40 caractères.
Le nom du chantier est lui-même tronqué si nécessaire.

Si la commande n'a pas de chantier associé (cas commande type
équipement, sans chantier), fallback sur l'ancien format
`Commande EPJ NUM`.

---

## 📂 Fichiers modifiés

```
src/modules/commandes/esaboraUtils.js    ⭐ Troncature + nom chantier dans titre
src/modules/commandes/CommandesInner.jsx ⭐ Bouton conditionné canMarkAsCommandee()
src/pages/HomePage.jsx                   ⭐ Bannière conditionnée même règle
package.json                             ⭐ Version 1.10.16 → 1.10.17
```

## 🧪 Tests

272/272 OK, build Vite OK (119 modules).

## 🚀 Procédure de test après déploiement

### Test 1 — Restriction d'accès

1. Connecte-toi en tant que **Conducteur travaux** (Thibaut FRASCA
   par exemple)
2. Va dans Commandes → ouvre une commande au statut "Envoyée aux
   achats"
3. ✅ Le bloc "🔗 SYNCHRONISATION ESABORA" **ne doit PAS apparaître**
4. ✅ La bannière home "X commandes à envoyer dans Esabora" **ne doit
   PAS apparaître** non plus
5. Déconnecte-toi → reconnecte-toi en **Admin** ou **Direction**
6. ✅ Le bouton et la bannière réapparaissent normalement

### Test 2 — Troncature

1. Sur une commande de test avec une adresse chantier longue
   (> 40 caractères)
2. Re-synchronise dans Esabora
3. ✅ Plus d'erreur "longueur maximale" dans Zapier
4. ✅ Draft Esabora créé, adresse coupée à 40 caractères

### Test 3 — Titre avec nom chantier

1. Synchronise une commande avec un chantier associé
2. Va dans Esabora → ouvre le draft
3. ✅ Le titre doit afficher `Cmd EPJ CMD-2026-XXXX — <nom chantier>`
   (avec le nom du chantier tronqué si très long)

---

## 📌 À garder en tête

Esabora applique d'autres limites de longueur que nous n'avons pas
encore documentées (interlocuteur nom/prénom, adresse 2/3, etc.). Si
de nouvelles erreurs `longueur maximale` apparaissent, dis-moi le
champ exact et je le rajoute à la liste tronquée — c'est 1 ligne à
ajouter à chaque fois.

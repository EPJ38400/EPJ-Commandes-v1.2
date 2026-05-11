# 📦 EPJ App Globale — v10.L.2 (correctif ultra-léger)

**Date** : 11 mai 2026
**Version** : 1.10.15
**Type** : correctif 1 ligne sur l'intégration Esabora

---

## 🎯 Le bug

Après v10.L.1, la TVA d'entête (colonne G de "INFORMATIONS GÉNÉRALES")
était bien à 20 %, mais Esabora ne calculait toujours pas les montants
des drafts. Raison : Esabora exige aussi la TVA sur **chaque ligne
d'article** dans la feuille "CONTENU DU DOCUMENT" (colonne F), pas
seulement dans l'entête.

## 🛠 Le fix

Une ligne de code dans `esaboraUtils.js` : la colonne TVA de chaque
ligne d'article est maintenant remplie automatiquement avec la valeur
`esaboraTvaDefault` (20 % par défaut).

**Volontairement, on ne touche pas au catalogue d'articles**. La TVA
n'est pas associée à un article (rester simple). C'est l'app qui
injecte 20 % en dur sur chaque ligne au moment de générer le fichier
Excel. Si plus tard tu as besoin de multi-TVA, on étoffera.

## 📂 Fichier modifié

```
src/modules/commandes/esaboraUtils.js    ⭐ 1 ligne changée
package.json                             ⭐ Version 1.10.14 → 1.10.15
```

## 🧪 Tests

272/272 OK, build Vite OK.

## 🚀 Procédure de test après déploiement

1. Upload `esaboraUtils.js` + `package.json` sur GitHub → Vercel redéploie
2. Sur une commande, clique **🔄 Re-synchroniser** dans le bloc Esabora
3. Va dans Esabora → ouvre le nouveau draft → ✅ La TVA doit
   maintenant apparaître à 20 % sur **chaque ligne d'article** ET les
   montants doivent se calculer correctement

⚠️ Comme la fois précédente, la re-synchronisation crée un nouveau
draft. L'ancien (sans TVA sur les lignes) reste là, à supprimer
manuellement dans Esabora si besoin.

# 📦 EPJ App Globale — v10.L.3 (correctif)

**Date** : 11 mai 2026
**Version** : 1.10.16
**Type** : correctif 1 ligne — fix critique sur la TVA Esabora

---

## 🎯 Le bug

Message d'erreur Zapier après v10.L.2 :

```
Error with the file EPJ_test.xlsx
[La valeur TVA doit être entre 0 et 4. (N/A - ligne n°1)]
[La valeur TVA doit être entre 0 et 4. (N/A - ligne n°2)]
```

J'avais mal interprété le mécanisme TVA d'Esabora.

## 🛠 Comment ça marche vraiment côté Esabora

L'entête « INFORMATIONS GÉNÉRALES » a **4 colonnes TVA** (TVA 1, TVA 2,
TVA 3, TVA 4) qui définissent les taux applicables.

Sur les lignes d'articles, la colonne F n'est **pas** le pourcentage,
c'est un **index** (0, 1, 2, 3 ou 4) qui pointe vers la TVA d'entête
à utiliser :
- `0` = pas de TVA
- `1` = TVA 1 de l'entête
- `2` = TVA 2 de l'entête
- etc.

## 🛠 Le fix

Une ligne change dans `esaboraUtils.js` :

```diff
-    tvaDefault,                 // v10.L.2 — TVA injectée (KO : pourcentage)
+    1,                          // v10.L.3 — INDEX vers TVA 1 d'entête (OK)
```

- **Entête TVA 1 = `tvaDefault`** (20 par défaut, modifiable Admin) ✅
- **Lignes articles colonne F = `1`** (pointe vers TVA 1) ✅

## 📂 Fichier modifié

```
src/modules/commandes/esaboraUtils.js    ⭐ 1 ligne changée + commentaire
package.json                             ⭐ Version 1.10.15 → 1.10.16
```

## 🧪 Tests

272/272 OK, build Vite OK.

## 🚀 Procédure de test après déploiement

1. Upload `esaboraUtils.js` + `package.json` sur GitHub → Vercel redéploie
2. Sur une commande, clique **🔄 Re-synchroniser**
3. Va dans Esabora → ouvre le nouveau draft :
   - ✅ Plus d'erreur "TVA doit être entre 0 et 4"
   - ✅ Sur chaque ligne d'article, la TVA est appliquée (via index 1 → 20%)
   - ✅ Les montants HT / TVA / TTC se calculent correctement

## 📌 Évolution future possible

Si plus tard tu veux gérer du multi-taux (ex: certaines lignes en 20%,
d'autres en 10%), c'est facile à étendre :
1. On remplit TVA 1 = 20, TVA 2 = 10 dans l'entête
2. Sur chaque article, on calcule l'index en fonction d'un critère
   (ex: catégorie d'article, ou champ dédié sur la ligne)

Pour l'instant, **toutes les lignes pointent sur TVA 1**, ce qui revient
au comportement que tu m'as demandé : "20% par défaut partout".

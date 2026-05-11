# 📦 EPJ App Globale — v10.L.1 (correctif)

**Date** : 11 mai 2026
**Version** : 1.10.14
**Type** : correctif léger sur l'intégration Esabora

---

## 🎯 Le bug en 1 phrase

Esabora ne calculait pas les montants des drafts importés car la TVA
d'entête (colonne G de la feuille « INFORMATIONS GÉNÉRALES ») était
laissée vide.

## 🛠 Le fix

L'app injecte désormais la TVA dans la colonne G de l'entête. Valeur
par défaut : **20 %**. Configurable depuis Admin → Paramètres →
🔗 Synchronisation Esabora → champ « TVA par défaut ».

Les colonnes TVA des lignes d'articles (feuille « CONTENU DU
DOCUMENT ») restent volontairement vides : Esabora applique
automatiquement la TVA d'entête à toutes les lignes du draft. C'est ce
que tu as toi-même demandé : « il faut mettre le tout TVA par défaut »
(pas de TVA par ligne d'article).

## 🔧 Nouveau champ Admin

**Admin → ⚙️ Paramètres & intégrations → 🔗 Synchronisation Esabora**

- Champ « TVA par défaut » (numérique, %)
- Valeur par défaut : 20
- Aide affichée : « 20 % pour neuf, 10 % pour rénovation, 5,5 % pour
  rénovation énergétique / logement social »

Si tu as plus tard besoin de gérer du multi-TVA par commande (ex :
20 % sur chantier neuf vs 10 % sur rénovation), dis-le et je ferai
évoluer pour mettre le taux par chantier au lieu du global.

## 📂 Fichiers modifiés

```
src/modules/commandes/esaboraUtils.js    ⭐ TVA injectée + accepte opts.tvaDefault
src/modules/commandes/CommandesInner.jsx ⭐ Propage tvaDefault depuis featureFlags
src/core/DataContext.jsx                 ⭐ Expose esaboraTvaDefault
src/pages/admin/AdminSettings.jsx        ⭐ Champ TVA % dans le bloc Esabora
package.json                             ⭐ Version 1.10.13 → 1.10.14
```

## 🧪 Tests

272/272 OK, build Vite OK.

## 🚀 Procédure de test après déploiement

1. Upload des 4 fichiers + package.json sur GitHub → Vercel redéploie
2. Va dans **Admin → ⚙️ Paramètres → 🔗 Synchronisation Esabora** :
   - ✅ Le champ « TVA par défaut » doit s'afficher à 20 %
3. Sur une commande déjà synchronisée hier sans TVA, clique
   **🔄 Re-synchroniser** → un nouveau draft est créé dans Esabora
4. Va dans Esabora → ouvre le draft → ✅ La TVA d'entête doit être à
   20 % et les montants doivent maintenant se calculer correctement

⚠️ **Attention** : la re-synchronisation va créer un **nouveau** draft
Esabora (l'ancien draft sans TVA est toujours là). Tu peux supprimer
l'ancien dans Esabora si besoin.

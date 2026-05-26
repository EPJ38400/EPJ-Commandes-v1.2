# Guide — Créer un environnement preprod

Cette procédure crée un environnement de pré-production séparé pour tester les déploiements avant la prod. Compte : 30 à 60 minutes.

## Architecture cible

```
PROD                                   PREPROD
─────────────────────────────────      ─────────────────────────────────
Projet Vercel : epj-commandes-v1-2     Projet Vercel : epj-preprod
Projet Firebase : ap-epj               Projet Firebase : ap-epj-preprod
Domaine : app.epj-electricite.fr       Domaine : preprod.epj-electricite.fr
Branche Git : main                     Branche Git : preprod
```

---

## Étape 1 — Créer le projet Firebase preprod

1. Aller sur https://console.firebase.google.com/
2. Cliquer "Ajouter un projet"
3. Nom : `ap-epj-preprod`
4. Désactiver Google Analytics (pas utile en preprod)
5. Une fois créé :
   - **Authentication** : activer Email/Password et Google
   - **Firestore** : créer la base, mode "production", region `europe-west1`
   - **Storage** : créer le bucket, region `europe-west1`
   - **Functions** : passer en plan **Blaze** (obligatoire pour les Cloud Functions, mais le quota gratuit couvre largement la preprod)

## Étape 2 — Configurer les variables d'env Firebase preprod

Dans `src/firebase.js` actuel, les configs Firebase sont hardcodées. Pour gérer 2 environnements, créer un fichier `.env.preprod` à la racine :

```
VITE_FIREBASE_API_KEY=AIza...preprod
VITE_FIREBASE_AUTH_DOMAIN=ap-epj-preprod.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ap-epj-preprod
VITE_FIREBASE_STORAGE_BUCKET=ap-epj-preprod.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Et un `.env.production` avec les valeurs de prod (`ap-epj`).

Puis modifier `src/firebase.js` pour lire depuis `import.meta.env` plutôt que les valeurs hardcodées. **Cette étape est manuelle et hors patch v2.0.0** pour ne pas casser la prod.

## Étape 3 — Créer le projet Vercel preprod

1. https://vercel.com/dashboard → Add New → Project
2. Importer le même repo Git
3. Nom : `epj-preprod`
4. Branche de déploiement prod : `preprod` (pas `main`)
5. Variables d'environnement : copier les valeurs de `.env.preprod`

## Étape 4 — Déployer les règles + functions sur preprod

Dans le terminal, depuis le projet :

```powershell
# Lier le projet Firebase preprod
firebase use --add ap-epj-preprod --alias preprod
firebase use preprod

# Déployer
firebase deploy --only firestore:rules,storage,firestore:indexes,functions

# Revenir sur prod
firebase use default
```

## Étape 5 — Workflow recommandé

1. Développer une feature sur une branche `feature/xxx`
2. Merger dans `preprod` → Vercel preprod auto-déploie
3. Test sur `preprod.epj-electricite.fr` avec les 3 testeurs
4. Si OK → merger `preprod` dans `main` → Vercel prod auto-déploie

---

## Données dans preprod

- Ne **JAMAIS** copier les données réelles de prod vers preprod (RGPD)
- Créer des comptes utilisateurs de test (1 par rôle)
- Importer un catalogue de test (sous-ensemble du vrai)
- Créer 2-3 chantiers de test

## Coûts mensuels estimés

- Vercel preprod : gratuit (plan Hobby)
- Firebase preprod : ~0 € (quotas gratuits couvrent largement un usage testeurs)
- Cloud Functions preprod : ~0 € (idem)

**Total : 0 €/mois**

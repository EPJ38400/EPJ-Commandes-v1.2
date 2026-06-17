# PLAN — Refonte taxonomie avancement v2 + migration (M3, PROD)
Statut : PLAN. Aucun code applicatif ni écriture prod tant que non audité + GO écrit.
Branche : feature/taxo-v2 (depuis main).
Sensibilité : avancementTasks.js (génération) + collection `chantiers` (avancementProgress) = TRIO. GO écrit obligatoire avant migration.

## 1. Nouvelle taxonomie factory (avancementTasks.js v2) — 8 catégories
1. ÉTUDE / TMA — fixe, INCHANGÉ : etude-1 Préparation du dossier chantier ; etude-2 Demande de renseignement autre lot ; etude-3 Réservation ; etude-4 TMA.
2. INCORPORATION BÉTON — généré "beton", INCHANGÉ (radier ; mur/dalle ss{i} ; mur/dalle rdc ; mur/dalle r{i} ; combles).
3. AVANCEMENT DIVERS — fixe : divers-1 Installation de chantier ; divers-2 Équipement sous-sol (Lustrerie / bloc secours) ; divers-3 Equipement box ECL + PC ; divers-4 Chemin de câble ; divers-5 Préparation des gaines techniques ; divers-6 Préparation avant doublage ; divers-7 Amorce colonne ; divers-8 Cheminement colonne IRVE ; divers-9 Tronçon colonne IRVE ; divers-10 Colonne IRVE (SPCM) ; divers-11 Equipement box IRVE ; divers-12 Amorce colonne IRVE ; divers-13 Pose coffret de Façade.
4. AVANCEMENT PLACO — généré "placo", SANS sous-sol : placo-rdc "Placo RDC" ; placo-r{i} "Placo R+{i}". (placo-ss supprimé ; pla-1 supprimé.)
5. ÉQUIPEMENT DES LOGEMENTS — mixte :
   - généré par étage : appareillage-rdc "Appareillage RDC" ; appareillage-r{i} "Appareillage R+{i}".
   - fixe : log-1 Pose DCL ; log-2 Pose DB + Platine ; log-3 ECL balcon ; log-4 Prise balcon ; log-5 Tableau ; log-6 Porte + trappe de tableau ; log-7 Plaque de finition ; log-8 Essai + Ampoule ; log-9 Contrôle qualité.
6. ÉQUIPEMENT DES COMMUNS — fixe : com-1 Colonne Montante Enedis ; com-2 Colonne de terre ; com-3 Colonne service généraux ; com-4 Appareillage ; com-5 Pose DB + Platine ; com-6 Armoire des services généraux ; com-7 Interphone ; com-8 Lustrerie coursive ; com-9 Lustrerie escalier ; com-10 Lustrerie extérieur ; com-11 Contrôle qualité.
7. COURANT FAIBLE — NOUVELLE catégorie, mixte :
   - généré par étage : cf-rj45-rdc "Appareillage RJ45 RDC" ; cf-rj45-r{i} "Appareillage RJ45 R+{i}".
   - fixe : cf-1 Étier interphone ; cf-2 Câblage tableau de communication ; cf-3 Colonne interphone ; cf-4 Colonne TV ; cf-5 Colonne Fibre ; cf-6 Tirage des fibres lgt + DTIO ; cf-7 Pose Mâts + antennes ; cf-8 Combiné Interphone ; cf-9 Programmation + essai interphone.
8. CONTRÔLE ET MISE EN SERVICE — fixe, INCHANGÉ : ctrl-1..6.

Sous-sol commun : béton ss INCHANGÉ ; ÉQUIPEMENT SOUS-SOL ssequip-1..6 INCHANGÉ ; placo ss SUPPRIMÉ.
Génération par étage (appareillage / rj45) : RDC + r1..r{nbEtages}, comme placo. Pas de niveau sous-sol. Combles : NON (sauf avis PJ).
Slugs propres : minuscules + tirets, jamais d'espace/majuscule (appareillage-rdc, cf-rj45-r1, …).

## 2. Mapping migration OLD→NEW (par LIBELLÉ, reconstruction par SNAPSHOT)
DIVERS : divers-1→divers-1 ; divers-2→divers-2 ; divers-3(Chemin de câble)→divers-4 ; divers-4→divers-5 ; divers-5→divers-6 ; divers-6(Amorce colonne)→divers-7 ; divers-7(Pose coffret Façade)→divers-13.
LOGEMENTS : log-1(Appareillage)→PAR ÉTAGE appareillage-rdc + appareillage-r{i} (ancien % recopié sur chaque niveau) ; log-2(Appareillage courant faible)→PAR ÉTAGE cf-rj45-rdc + cf-rj45-r{i} (recopié) ; log-3(DCL)→log-1 ; log-4(ECL balcon)→log-3 ; log-5(Étier interphone)→cf-1 ; log-6(Tableau)→log-5 ; log-7(Tableau de communication)→cf-2 ; log-8(Interphone)→cf-8 ; log-9(Porte de tableau + Plaque de finition)→SPLIT log-6 + log-7 (% aux deux) ; log-10(Essai + Ampoule)→log-8 ; log-11(Contrôle qualité)→log-9 ; log-12(Pose DB + Platine)→log-2.
COMMUNS : com-1(Colonne Montante + colonne de terre)→SPLIT com-1(Colonne Montante Enedis) + com-2(Colonne de terre) (% aux deux) ; com-2→com-3 ; com-3(Colonne interphone)→cf-3 ; com-4(Colonne Fibre)→cf-5 ; com-5(Colonne TV + pose antennes)→SPLIT cf-4(Colonne TV) + cf-7(Pose Mâts + antennes) (% aux deux) ; com-6(Appareillage)→com-4 ; com-7→com-6 ; com-8(Interphone)→com-7 ; com-9→com-8 ; com-10→com-9 ; com-11(Lustrerie extérieur)→com-10 ; com-12(Essai)→ARCHIVE (sans données) ; com-13(Contrôle qualité)→com-11.
PLACO : placo-ss{i}→ARCHIVE ; placo-rdc→placo-rdc (relibellé) ; placo-r{i}→placo-r{i} (relibellé).
BÉTON / ÉTUDE / CONTRÔLE / SSEQUIP : inchangés (pas de re-key).

## 3. Script migration (one-shot, HORS Cloud Functions)
Fichier : scripts/migrate_taxo_v2.mjs (Node, firebase-admin, SA local). PAS de Cloud Function, PAS de déploiement, PAS dans .github/workflows.
- BACKUP (toujours) : dump des 23 docs chantiers (avancementProgress complet) → backups/chantiers_pre_taxo_v2_<ts>.json.
- DRY-RUN (défaut, sans --apply) : pour chaque chantier/bâtiment, lire avancementProgress (SNAPSHOT figé), construire le NOUVEAU dict de zéro via le mapping §2, écrire report_taxo_v2.md (old→new + valeurs par chantier, + liste ARCHIVE). AUCUNE écriture Firestore.
- APPLY (--apply, gaté par GO écrit) : pour chaque chantier, updateDoc(chantiers/{id}, { avancementProgress: NEW, avancementArchive: ARCHIVED, _taxoV2At: serverTimestamp() }).
  NB write-safety : on utilise updateDoc sur le SEUL champ avancementProgress (le remplace en entier → supprime les anciens id, ce que setDoc merge:true ne ferait pas) ; aucun autre champ du doc chantier n'est touché.
- Reconstruction par SNAPSHOT obligatoire (lire tout l'ancien d'abord, bâtir le nouveau ensuite) — jamais de mutation in-place (collisions d'id, ex. log-3→log-1 vs log-1→appareillage).
- PAR ÉTAGE : pour log-1 et log-2, recopier l'ancienne valeur sur tous les niveaux générés selon la config du bâtiment (RDC + nbEtages). SPLIT : valeur copiée sur les deux cibles. ARCHIVE : placo-ss*, com-12 → dans avancementArchive.

## 4. Ordonnancement & sécurité
TRIO (chantiers) → GO écrit avant --apply.
Ordre : (a) backup, (b) dry-run validé par PJ (vérifier OREADES / LE 17 / OISEAU BLANC), (c) GO écrit, (d) --apply sur les 23 chantiers, (e) PUIS merge du code v2 sur main (Vercel auto). Fenêtre courte (3 utilisateurs actifs). Le script est lancé à la main par PJ, hors CI.
Aucun firebase deploy / vercel --prod / merge main manuel sans GO. build + audit:tokens verts.

## 5. Lien picker planning (L8b)
Le fix picker L8b-A0 (taxonomie complète + libellés groupés par catégorie) reste nécessaire et indépendant. Avec la v2, le picker affichera automatiquement Courant Faible, Appareillage par étage, etc.

## 6. STOP
Plan écrit. Commit + push feature/taxo-v2. STOP pour audit Claude.ai. Aucun code applicatif, aucune écriture prod.

// ═══════════════════════════════════════════════════════════════
//  functions/backups.js — v1.15.0
//
//  Backup Firestore automatique hebdomadaire.
//
//  Déclenchement : tous les dimanches à 03:00 (heure de Paris) via
//  Cloud Scheduler.
//
//  Action :
//   1. Exporte TOUT Firestore vers gs://ap-epj-backups/firestore/<date>/
//   2. Garde les 8 dernières sauvegardes (~2 mois)
//   3. Supprime les plus anciennes au-delà
//
//  Restauration :
//   - Via console Firebase > Firestore > Importer
//   - Ou via gcloud :
//     gcloud firestore import gs://ap-epj-backups/firestore/<date>/
//
//  Coût estimé : ~0,02-0,05 €/mois (stockage Cloud Storage + exécution function)
//
//  Pré-requis avant le 1er déploiement :
//   - Créer le bucket "ap-epj-backups" dans Cloud Storage (gratuit pour <5GB)
//   - Donner au compte de service compute le rôle "Cloud Datastore Import Export Admin"
//     (déjà fait implicitement si on lui a donné Firebase Auth Admin)
//   - Activer l'API Cloud Scheduler dans la console
//
//  Restauration manuelle aussi possible à tout moment via :
//   gcloud firestore export gs://ap-epj-backups/firestore/manuel-<date>/
// ═══════════════════════════════════════════════════════════════

import { onSchedule } from "firebase-functions/v2/scheduler";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import admin from "firebase-admin";
import { Storage } from "@google-cloud/storage";

const BUCKET_NAME = "ap-epj-backups";
const BACKUP_PREFIX = "firestore/";
const RETENTION_COUNT = 8; // 8 semaines = ~2 mois
const PROJECT_ID = "ap-epj";

// ─── 1. BACKUP AUTOMATIQUE HEBDOMADAIRE ──────────────────────────

export const weeklyFirestoreBackup = onSchedule(
  {
    schedule: "0 3 * * 0", // Tous les dimanches à 03:00 (cron)
    timeZone: "Europe/Paris",
    region: "europe-west1",
    timeoutSeconds: 540, // 9 minutes (export peut prendre du temps)
    memory: "256MiB",
  },
  async () => {
    const date = new Date().toISOString().split("T")[0]; // ex: 2026-05-18
    const outputUri = `gs://${BUCKET_NAME}/${BACKUP_PREFIX}auto-${date}`;
    console.log(`[backup] Démarrage export Firestore → ${outputUri}`);

    try {
      // Lance l'export via l'API Firestore Admin
      const result = await exportFirestore(outputUri);
      console.log(`[backup] ✓ Export lancé : ${result.name}`);

      // Nettoie les vieux backups
      await cleanOldBackups();

      console.log("[backup] ✓ Terminé avec succès");
    } catch (err) {
      console.error("[backup] ❌ Échec :", err);
      throw err; // Cloud Scheduler retentera + visible dans les logs
    }
  }
);

// ─── 2. BACKUP MANUEL À LA DEMANDE (déclenchable par admin) ──────

export const adminTriggerBackup = onCall(
  {
    region: "europe-west1",
    timeoutSeconds: 540,
    memory: "256MiB",
  },
  async (request) => {
    // Vérification admin
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Vous devez être connecté.");
    }
    if (request.auth.token?.role !== "Admin") {
      throw new HttpsError(
        "permission-denied",
        "Seul un administrateur peut déclencher un backup."
      );
    }

    const date = new Date().toISOString().replace(/[:.]/g, "-"); // ex: 2026-05-18T20-30-00-000Z
    const outputUri = `gs://${BUCKET_NAME}/${BACKUP_PREFIX}manuel-${date}`;

    try {
      const result = await exportFirestore(outputUri);
      return {
        ok: true,
        operationName: result.name,
        outputUri,
        message: `Backup lancé. Disponible dans gs://${BUCKET_NAME}/${BACKUP_PREFIX}manuel-${date} dans quelques minutes.`,
      };
    } catch (err) {
      console.error("[adminTriggerBackup] ❌", err);
      throw new HttpsError("internal", `Échec backup : ${err.message}`);
    }
  }
);

// ─── 3. LISTER LES BACKUPS DISPONIBLES (pour affichage admin) ────

export const adminListBackups = onCall(
  { region: "europe-west1", timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Vous devez être connecté.");
    }
    if (request.auth.token?.role !== "Admin") {
      throw new HttpsError(
        "permission-denied",
        "Seul un administrateur peut lister les backups."
      );
    }

    try {
      const storage = new Storage();
      const [files] = await storage
        .bucket(BUCKET_NAME)
        .getFiles({ prefix: BACKUP_PREFIX });

      // On regroupe par dossier de backup (auto-2026-05-18 / manuel-...)
      const folders = new Map();
      for (const file of files) {
        const parts = file.name.replace(BACKUP_PREFIX, "").split("/");
        const folderName = parts[0];
        if (!folderName) continue;
        if (!folders.has(folderName)) {
          folders.set(folderName, {
            name: folderName,
            createdAt: file.metadata.timeCreated,
            size: 0,
            fileCount: 0,
          });
        }
        const entry = folders.get(folderName);
        entry.fileCount += 1;
        entry.size += Number(file.metadata.size || 0);
      }

      const list = Array.from(folders.values())
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

      return { ok: true, backups: list };
    } catch (err) {
      console.error("[adminListBackups] ❌", err);
      throw new HttpsError("internal", `Échec listing : ${err.message}`);
    }
  }
);

// ─── HELPERS ─────────────────────────────────────────────────────

/**
 * Lance un export Firestore via l'API Admin.
 * Retourne le nom de l'opération (long-running).
 */
async function exportFirestore(outputUriPrefix) {
  // L'export Firestore se fait via l'API REST projects.databases.exportDocuments
  // Voir : https://firebase.google.com/docs/firestore/manage-data/export-import
  //
  // On utilise l'access token automatiquement fourni par le compte de service
  // de la Cloud Function.

  const auth = admin.app().options.credential ||
               (await import("google-auth-library")).GoogleAuth;
  const { GoogleAuth } = await import("google-auth-library");
  const googleAuth = new GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/datastore"],
  });
  const client = await googleAuth.getClient();
  const accessToken = (await client.getAccessToken()).token;

  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default):exportDocuments`;
  const body = {
    outputUriPrefix,
    // collectionIds: [] vide = toutes les collections
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`HTTP ${response.status} : ${text}`);
  }

  return await response.json();
}

/**
 * Supprime les backups automatiques au-delà des RETENTION_COUNT plus récents.
 * Ne touche jamais aux backups "manuel-*".
 */
async function cleanOldBackups() {
  try {
    const storage = new Storage();
    const [files] = await storage
      .bucket(BUCKET_NAME)
      .getFiles({ prefix: `${BACKUP_PREFIX}auto-` });

    // Regroupe par dossier
    const folders = new Map();
    for (const file of files) {
      const parts = file.name.replace(BACKUP_PREFIX, "").split("/");
      const folderName = parts[0];
      if (!folderName.startsWith("auto-")) continue;
      if (!folders.has(folderName)) {
        folders.set(folderName, []);
      }
      folders.get(folderName).push(file);
    }

    // Trie les dossiers par nom (= date, donc chronologique)
    const sortedFolders = Array.from(folders.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1)); // plus récent en premier

    // Garde les RETENTION_COUNT premiers, supprime le reste
    const toDelete = sortedFolders.slice(RETENTION_COUNT);
    if (toDelete.length === 0) {
      console.log("[backup] Aucun ancien backup à nettoyer");
      return;
    }

    console.log(`[backup] Nettoyage de ${toDelete.length} ancien(s) backup(s)`);
    for (const [folderName, folderFiles] of toDelete) {
      console.log(`[backup] - Suppression de ${folderName} (${folderFiles.length} fichiers)`);
      await Promise.all(folderFiles.map(f => f.delete().catch(e => {
        console.warn(`[backup] Erreur delete ${f.name}: ${e.message}`);
      })));
    }
  } catch (err) {
    // Pas critique : le nettoyage peut échouer sans bloquer l'export
    console.warn("[backup] cleanOldBackups a échoué (non bloquant) :", err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
//  v2.0.0 — BACKUP STORAGE HEBDOMADAIRE
//
//  En plus du backup Firestore, on duplique le contenu du bucket
//  principal (ap-epj.firebasestorage.app) vers ap-epj-backups/
//  storage/<date>/ tous les dimanches à 04:00.
//
//  C'est CRITIQUE car le bucket contient les PDF de quitus signés
//  (valeur juridique) et les photos de réserves. Une suppression
//  accidentelle, un compromis du compte ou un bug d'app pourrait
//  faire perdre ces données irrémédiablement.
//
//  Coût : copie intra-région, ~0,02 €/Go/mois en cold storage.
//  Si le bucket pèse 2 Go → ~5 cts/mois pour 1 mois de backups.
//
//  Restauration : copier le dossier depuis le bucket backup vers
//  le bucket principal via gsutil :
//   gsutil -m cp -r gs://ap-epj-backups/storage/2026-05-18/* \
//                   gs://ap-epj.firebasestorage.app/
// ═══════════════════════════════════════════════════════════════

const SOURCE_STORAGE_BUCKET = "ap-epj.firebasestorage.app";
const STORAGE_BACKUP_PREFIX = "storage/";
const STORAGE_RETENTION_COUNT = 4; // 4 semaines (~1 mois)

export const weeklyStorageBackup = onSchedule(
  {
    schedule: "0 4 * * 0", // dimanches 04:00
    timeZone: "Europe/Paris",
    region: "europe-west1",
    timeoutSeconds: 540,
    memory: "512MiB",
  },
  async () => {
    const date = new Date().toISOString().split("T")[0];
    const targetPrefix = `${STORAGE_BACKUP_PREFIX}auto-${date}/`;
    console.log(`[storage-backup] Démarrage copie ${SOURCE_STORAGE_BUCKET} → ${BUCKET_NAME}/${targetPrefix}`);

    const storage = new Storage();
    const sourceBucket = storage.bucket(SOURCE_STORAGE_BUCKET);
    const targetBucket = storage.bucket(BUCKET_NAME);

    try {
      const [files] = await sourceBucket.getFiles();
      console.log(`[storage-backup] ${files.length} fichiers à copier`);

      let copied = 0, failed = 0;
      // Copie par batch de 20 pour ne pas saturer
      for (let i = 0; i < files.length; i += 20) {
        const batch = files.slice(i, i + 20);
        await Promise.all(batch.map(async (file) => {
          try {
            const destPath = targetPrefix + file.name;
            await file.copy(targetBucket.file(destPath));
            copied++;
          } catch (e) {
            failed++;
            console.warn(`[storage-backup] échec copie ${file.name}: ${e.message}`);
          }
        }));
      }

      console.log(`[storage-backup] ✓ ${copied} copiés, ${failed} échoués`);
      await cleanOldStorageBackups();
    } catch (err) {
      console.error("[storage-backup] ÉCHEC:", err);
      throw err;
    }
  }
);

async function cleanOldStorageBackups() {
  try {
    const storage = new Storage();
    const [files] = await storage.bucket(BUCKET_NAME).getFiles({ prefix: STORAGE_BACKUP_PREFIX });

    const folders = new Map();
    for (const f of files) {
      const match = f.name.match(/^storage\/auto-(\d{4}-\d{2}-\d{2})\//);
      if (!match) continue;
      const folder = `auto-${match[1]}`;
      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder).push(f);
    }

    const sorted = Array.from(folders.entries()).sort((a, b) => b[0].localeCompare(a[0]));
    const toDelete = sorted.slice(STORAGE_RETENTION_COUNT);
    if (toDelete.length === 0) return;

    console.log(`[storage-backup] Nettoyage de ${toDelete.length} ancien(s) backup(s) storage`);
    for (const [folderName, folderFiles] of toDelete) {
      console.log(`[storage-backup] - Suppression ${folderName} (${folderFiles.length} fichiers)`);
      // Suppression par chunks de 50
      for (let i = 0; i < folderFiles.length; i += 50) {
        await Promise.all(folderFiles.slice(i, i + 50).map(f => f.delete().catch(e => {
          console.warn(`[storage-backup] échec delete ${f.name}: ${e.message}`);
        })));
      }
    }
  } catch (err) {
    console.warn("[storage-backup] cleanOldStorageBackups a échoué (non bloquant):", err.message);
  }
}

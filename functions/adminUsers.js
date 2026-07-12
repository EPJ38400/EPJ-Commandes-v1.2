// ═══════════════════════════════════════════════════════════════
//  functions/adminUsers.js — v1.14.0
//
//  Cloud Functions de gestion utilisateurs côté admin.
//  Toutes ces functions sont des `onCall` (HTTPS callable) :
//    - Elles requièrent un user connecté avec custom claim `role: "Admin"`.
//    - Le client les appelle via httpsCallable(getFunctions(), "<name>").
//
//  Sécurité :
//    - Aucune de ces functions n'est accessible publiquement.
//    - Vérification du claim Admin à chaque appel.
//    - Validations strictes des inputs.
//
//  Liste :
//    - adminCreateUser     → crée un compte Auth + doc Firestore + claim
//    - adminUpdateUser     → met à jour le doc Firestore + claim si rôle change
//    - adminResetPassword  → réinitialise le mdp Auth
//    - adminDeleteUser     → supprime le compte Auth + doc Firestore
//    - adminToggleDisabled → active/désactive le compte Auth
//    - adminListAuthUsers  → debug : liste les comptes Auth et leurs claims
// ═══════════════════════════════════════════════════════════════

import { onCall, HttpsError } from "firebase-functions/v2/https";
import admin from "firebase-admin";

// ⚠️ Ne PAS appeler admin.firestore() au top-level : à ce moment-là,
// admin.initializeApp() n'a peut-être pas encore été appelé depuis index.js.
// On utilise un helper lazy qui retourne la référence Firestore à la demande.
const getDb = () => admin.firestore();

// ─── Helpers ────────────────────────────────────────────────────

/**
 * Vérifie que l'appelant est un Admin authentifié.
 * Lève HttpsError sinon.
 */
function assertAdmin(request) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Vous devez être connecté.");
  }
  const role = request.auth.token?.role;
  if (role !== "Admin") {
    throw new HttpsError(
      "permission-denied",
      "Seul un administrateur peut effectuer cette opération."
    );
  }
}

/**
 * Génère un mdp temporaire fort : 12 caractères, lettres+chiffres+1 symbole.
 * Exemples : "Epj-A4f9k2qZ", "Epj-7gH3p9wM"
 */
function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let out = "Epj-";
  for (let i = 0; i < 8; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

/**
 * Valide une adresse email basique.
 */
function isValidEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

/**
 * Construit un payload Firestore propre depuis les inputs admin.
 * NE JAMAIS inclure de champ pwd (mort depuis v1.13.4).
 */
function buildUserPayload(input, existing = {}) {
  const roles = Array.isArray(input.roles) && input.roles.length > 0
    ? input.roles
    : ["Monteur"];
  return {
    id: input.id,
    prenom: (input.prenom || "").trim(),
    nom: (input.nom || "").trim(),
    email: (input.email || "").trim(),
    telephone: (input.telephone || "").trim(),
    roles,
    fonction: input.fonction || roles[0],
    permissionsOverride: existing.permissionsOverride || {},
    directAchat: input.directAchat === true,
    canSortirOutil: input.canSortirOutil === true,
    responsableParc: input.responsableParc === true,
    signatureUrl: existing.signatureUrl || "",
    signaturePath: existing.signaturePath || "",
    // Champs frais (RH-Frais-2a-bis) — saisis sur la fiche user (AdminUsers).
    // adminUpdateUser fait un set() COMPLET : on prend l'input en priorité, et
    // on retombe sur `existing` s'il n'est pas fourni (pour ne pas les effacer).
    adresseDomicile: input.adresseDomicile != null ? input.adresseDomicile : (existing.adresseDomicile || ""),
    pointDepartFrais: input.pointDepartFrais || existing.pointDepartFrais || "DEPOT",
    // uid posé après création du compte Auth
    uid: existing.uid || input.uid || null,
  };
}

// ─── 1. CRÉER UN UTILISATEUR ────────────────────────────────────

export const adminCreateUser = onCall(
  { region: "europe-west1", timeoutSeconds: 30 },
  async (request) => {
    assertAdmin(request);
    const data = request.data || {};

    // Validations
    if (!data.id || typeof data.id !== "string" || data.id.trim().length < 2) {
      throw new HttpsError("invalid-argument", "Identifiant manquant ou invalide (min 2 caractères).");
    }
    const id = data.id.trim();
    if (!isValidEmail(data.email)) {
      throw new HttpsError("invalid-argument", "Email invalide.");
    }
    const email = data.email.trim().toLowerCase();
    if (!data.prenom || !data.nom) {
      throw new HttpsError("invalid-argument", "Prénom et nom requis.");
    }

    // 1. Vérifie que l'ID Firestore n'existe pas déjà
    const docRef = getDb().collection("utilisateurs").doc(id);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      throw new HttpsError("already-exists", `Un utilisateur avec l'identifiant "${id}" existe déjà.`);
    }

    // 2. Vérifie que l'email n'est pas déjà utilisé côté Auth
    try {
      await admin.auth().getUserByEmail(email);
      // Si on arrive ici, c'est qu'un compte existe déjà
      throw new HttpsError("already-exists", `Un compte avec l'email "${email}" existe déjà.`);
    } catch (err) {
      // OK : aucun compte trouvé → on peut continuer
      if (err.code !== "auth/user-not-found") {
        if (err instanceof HttpsError) throw err;
        console.error("[adminCreateUser] getUserByEmail:", err);
      }
    }

    // 3. Génère un mdp temporaire
    const tempPassword = generateTempPassword();

    // 4. Crée le compte Firebase Auth
    let userRecord;
    try {
      userRecord = await admin.auth().createUser({
        email,
        password: tempPassword,
        displayName: `${data.prenom} ${data.nom}`.trim(),
        emailVerified: false,
        disabled: false,
      });
    } catch (err) {
      console.error("[adminCreateUser] createUser Auth:", err);
      throw new HttpsError("internal", `Échec création compte Auth : ${err.message}`);
    }

    // 5. Pose le claim `role` (= rôle principal du tableau roles)
    const roles = Array.isArray(data.roles) && data.roles.length > 0
      ? data.roles : ["Monteur"];
    const mainRole = roles[0];
    try {
      await admin.auth().setCustomUserClaims(userRecord.uid, {
        role: mainRole,
        mustResetPassword: true,
      });
    } catch (err) {
      // Rollback : supprime le compte Auth créé pour ne pas laisser de fantôme
      await admin.auth().deleteUser(userRecord.uid).catch(() => {});
      console.error("[adminCreateUser] setCustomUserClaims:", err);
      throw new HttpsError("internal", `Échec pose du claim role : ${err.message}`);
    }

    // 6. Crée le doc Firestore
    const payload = buildUserPayload({ ...data, id, email, uid: userRecord.uid });
    try {
      await docRef.set(payload);
    } catch (err) {
      // Rollback : supprime le compte Auth créé
      await admin.auth().deleteUser(userRecord.uid).catch(() => {});
      console.error("[adminCreateUser] setDoc Firestore:", err);
      throw new HttpsError("internal", `Échec création doc Firestore : ${err.message}`);
    }

    console.log(`[adminCreateUser] ✓ Utilisateur ${id} créé (uid ${userRecord.uid}, rôle ${mainRole})`);

    return {
      ok: true,
      id,
      uid: userRecord.uid,
      email,
      tempPassword,
      message: `Compte créé. Communiquez ce mot de passe à l'utilisateur : ${tempPassword}`,
    };
  }
);

// ─── 2. METTRE À JOUR UN UTILISATEUR ────────────────────────────

export const adminUpdateUser = onCall(
  { region: "europe-west1", timeoutSeconds: 30 },
  async (request) => {
    assertAdmin(request);
    const data = request.data || {};

    if (!data.id) {
      throw new HttpsError("invalid-argument", "Identifiant manquant.");
    }
    const id = data.id;
    const docRef = getDb().collection("utilisateurs").doc(id);
    const docSnap = await docRef.get();
    if (!docSnap.exists) {
      throw new HttpsError("not-found", `Utilisateur "${id}" introuvable.`);
    }
    const existing = docSnap.data() || {};

    // Construit le nouveau payload (conserve uid, permissionsOverride, signatures existantes)
    const payload = buildUserPayload({ ...data, id }, existing);

    // Si le rôle principal change, met à jour le custom claim
    const newMainRole = (payload.roles && payload.roles[0]) || "Monteur";
    const existingMainRole = (existing.roles && existing.roles[0]) || null;
    if (existing.uid && newMainRole !== existingMainRole) {
      try {
        // Récupère les claims actuels pour ne pas écraser mustResetPassword si présent
        const userRecord = await admin.auth().getUser(existing.uid);
        const currentClaims = userRecord.customClaims || {};
        await admin.auth().setCustomUserClaims(existing.uid, {
          ...currentClaims,
          role: newMainRole,
        });
        console.log(`[adminUpdateUser] Claim role mis à jour pour ${id} : ${existingMainRole} → ${newMainRole}`);
      } catch (err) {
        console.error("[adminUpdateUser] setCustomUserClaims:", err);
        throw new HttpsError("internal", `Échec mise à jour claim role : ${err.message}`);
      }
    }

    // Met à jour le doc Firestore
    try {
      await docRef.set(payload);
    } catch (err) {
      console.error("[adminUpdateUser] setDoc:", err);
      throw new HttpsError("internal", `Échec mise à jour Firestore : ${err.message}`);
    }

    return { ok: true, id };
  }
);

// ─── 3. RÉINITIALISER LE MOT DE PASSE ───────────────────────────

export const adminResetPassword = onCall(
  { region: "europe-west1", timeoutSeconds: 30 },
  async (request) => {
    assertAdmin(request);
    const data = request.data || {};
    if (!data.id) {
      throw new HttpsError("invalid-argument", "Identifiant manquant.");
    }
    const id = data.id;

    const docSnap = await getDb().collection("utilisateurs").doc(id).get();
    if (!docSnap.exists) {
      throw new HttpsError("not-found", `Utilisateur "${id}" introuvable.`);
    }
    const user = docSnap.data() || {};
    if (!user.uid) {
      throw new HttpsError("failed-precondition", `Cet utilisateur n'a pas de compte Auth lié (uid manquant).`);
    }

    const newPassword = generateTempPassword();
    try {
      await admin.auth().updateUser(user.uid, { password: newPassword });

      // Pose / re-pose le claim mustResetPassword = true
      const userRecord = await admin.auth().getUser(user.uid);
      const currentClaims = userRecord.customClaims || {};
      await admin.auth().setCustomUserClaims(user.uid, {
        ...currentClaims,
        mustResetPassword: true,
      });
    } catch (err) {
      console.error("[adminResetPassword]:", err);
      throw new HttpsError("internal", `Échec reset mdp : ${err.message}`);
    }

    return {
      ok: true,
      id,
      tempPassword: newPassword,
      message: `Mot de passe réinitialisé. Communiquez-le à l'utilisateur : ${newPassword}`,
    };
  }
);

// ─── 4. SUPPRIMER UN UTILISATEUR ────────────────────────────────

export const adminDeleteUser = onCall(
  { region: "europe-west1", timeoutSeconds: 30 },
  async (request) => {
    assertAdmin(request);
    const data = request.data || {};
    if (!data.id) {
      throw new HttpsError("invalid-argument", "Identifiant manquant.");
    }
    const id = data.id;

    // Garde-fou : on ne se supprime pas soi-même
    const callerUid = request.auth.uid;
    const docSnap = await getDb().collection("utilisateurs").doc(id).get();
    if (docSnap.exists) {
      const user = docSnap.data() || {};
      if (user.uid === callerUid) {
        throw new HttpsError("failed-precondition", "Vous ne pouvez pas supprimer votre propre compte.");
      }

      // Supprime le compte Auth si présent
      if (user.uid) {
        try {
          await admin.auth().deleteUser(user.uid);
        } catch (err) {
          if (err.code !== "auth/user-not-found") {
            console.error("[adminDeleteUser] deleteUser Auth:", err);
            throw new HttpsError("internal", `Échec suppression compte Auth : ${err.message}`);
          }
        }
      }

      // Supprime le doc Firestore
      try {
        await getDb().collection("utilisateurs").doc(id).delete();
      } catch (err) {
        console.error("[adminDeleteUser] deleteDoc:", err);
        throw new HttpsError("internal", `Échec suppression doc Firestore : ${err.message}`);
      }
    }

    return { ok: true, id };
  }
);

// ─── 5. ACTIVER / DÉSACTIVER UN UTILISATEUR ─────────────────────

export const adminToggleDisabled = onCall(
  { region: "europe-west1", timeoutSeconds: 30 },
  async (request) => {
    assertAdmin(request);
    const data = request.data || {};
    if (!data.id) {
      throw new HttpsError("invalid-argument", "Identifiant manquant.");
    }
    const disabled = data.disabled === true;
    const id = data.id;

    const docSnap = await getDb().collection("utilisateurs").doc(id).get();
    if (!docSnap.exists) {
      throw new HttpsError("not-found", `Utilisateur "${id}" introuvable.`);
    }
    const user = docSnap.data() || {};
    if (!user.uid) {
      throw new HttpsError("failed-precondition", "Pas de compte Auth lié.");
    }

    // Garde-fou : on ne se désactive pas soi-même
    if (disabled && user.uid === request.auth.uid) {
      throw new HttpsError("failed-precondition", "Vous ne pouvez pas désactiver votre propre compte.");
    }

    try {
      await admin.auth().updateUser(user.uid, { disabled });

      // Reflet du flag côté Firestore pour affichage
      await getDb().collection("utilisateurs").doc(id).update({
        disabled,
      });
    } catch (err) {
      console.error("[adminToggleDisabled]:", err);
      throw new HttpsError("internal", `Échec toggle disabled : ${err.message}`);
    }

    return { ok: true, id, disabled };
  }
);

// ─── 6. RETIRER LE FLAG mustResetPassword (appelée par l'utilisateur lui-même) ──

/**
 * Function appelée par l'utilisateur (pas l'admin) après qu'il vient de
 * changer son mot de passe avec succès depuis l'app.
 *
 * Retire :
 *  - Le claim Auth mustResetPassword
 *  - Si présent, le champ Firestore mustResetPassword (rétro-compat)
 *
 * Sécurité : un user authentifié ne peut retirer SON PROPRE flag (pas
 * celui de quelqu'un d'autre). Pas besoin d'être Admin.
 */
export const clearMustResetPassword = onCall(
  { region: "europe-west1", timeoutSeconds: 30 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Vous devez être connecté.");
    }
    const uid = request.auth.uid;

    try {
      // 1. Retire le claim mustResetPassword côté Auth
      const userRecord = await admin.auth().getUser(uid);
      const currentClaims = userRecord.customClaims || {};
      const { mustResetPassword: _, ...remainingClaims } = currentClaims;
      await admin.auth().setCustomUserClaims(uid, remainingClaims);

      // 2. Retire le champ Firestore mustResetPassword si présent (rétro-compat)
      // On cherche le doc Firestore via le champ uid
      const querySnap = await getDb()
        .collection("utilisateurs")
        .where("uid", "==", uid)
        .limit(1)
        .get();
      if (!querySnap.empty) {
        const docRef = querySnap.docs[0].ref;
        try {
          await docRef.update({
            mustResetPassword: admin.firestore.FieldValue.delete(),
          });
        } catch (fsErr) {
          // Pas critique si le champ n'existe pas
          console.warn("[clearMustResetPassword] Firestore update:", fsErr.message);
        }
      }

      console.log(`[clearMustResetPassword] ✓ Flag retiré pour uid ${uid}`);
      return { ok: true };
    } catch (err) {
      console.error("[clearMustResetPassword]:", err);
      throw new HttpsError("internal", `Échec retrait flag : ${err.message}`);
    }
  }
);

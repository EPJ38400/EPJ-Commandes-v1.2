// ═══════════════════════════════════════════════════════════════
//  AuthContext — session utilisateur, login, logout, mdp
//  v1.12.0 : Migration Firebase Auth complète (changement mdp,
//            mdp oublié, forcing première connexion)
//  v1.16.0 : Forcing première connexion via claim Firebase Auth
//            (anciennement Firestore uniquement). Ajout appel
//            Cloud Function clearMustResetPassword après reset
//            réussi pour retirer le claim côté serveur.
//  v1.13.6 : Force le refresh du token JWT au démarrage de l'app
//            (onAuthStateChanged). Évite les permission-denied
//            quand le SDK Firebase restaure une session existante
//            avec un ancien token sans Custom Claims (role).
//
//  Stratégie login :
//   • Email + mdp → Firebase Auth (seule voie depuis v1.13.4)
//   • Fallback Firestore retiré
//
//  Flag mustResetPassword :
//   • Posé par les Cloud Functions adminCreateUser/adminResetPassword
//     dans le claim Auth.
//   • Lu côté client via getIdTokenResult().claims.mustResetPassword
//   • Compatibilité : si un user a encore l'ancien champ Firestore
//     mustResetPassword: true, on le respecte aussi.
//   • Après changement de mdp réussi : la Cloud Function
//     clearMustResetPassword retire le claim ET le champ Firestore.
// ═══════════════════════════════════════════════════════════════
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, updateDoc, collection, query, where, getDocs } from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { auth, db, app } from "../firebase";
import { useData } from "./DataContext";

// Cloud Function pour retirer le claim mustResetPassword après changement de mdp
const _functions = getFunctions(app, "europe-west1");
const fnClearMustReset = httpsCallable(_functions, "clearMustResetPassword");

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const STORAGE_KEY = "epj_user";

const looksLikeEmail = (s) => typeof s === "string" && s.includes("@");

export function AuthProvider({ children }) {
  const { users } = useData();

  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  // État pour le flag mustResetPassword lu depuis le claim Auth.
  // Source de vérité prioritaire (le champ Firestore est gardé pour rétro-compat).
  const [mustResetClaim, setMustResetClaim] = useState(false);

  // Sync onAuthStateChanged → profil métier + claim mustResetPassword
  useEffect(() => {
    if (users.length === 0) return;
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setMustResetClaim(false);
        return;
      }
      // v1.13.6 — Force le refresh du token au démarrage de l'app.
      // Indispensable car onAuthStateChanged peut restaurer une session
      // déjà existante (cookie/storage Firebase) avec un ancien token JWT
      // qui ne contient pas encore les Custom Claims (notamment role).
      // Sans ce refresh, les règles Firestore qui vérifient
      // `request.auth.token.role != null` échouent et toutes les
      // requêtes plantent en boucle avec permission-denied.
      try {
        await fbUser.getIdToken(true);
      } catch (refreshErr) {
        console.warn("Force refresh token au démarrage a échoué (non bloquant):", refreshErr);
      }

      const profil = users.find(u => u.uid === fbUser.uid);
      if (profil) {
        const oldJson = JSON.stringify(user || {});
        const newJson = JSON.stringify(profil);
        if (oldJson !== newJson) {
          setUser(profil);
          try { localStorage.setItem(STORAGE_KEY, newJson); } catch {}
        }
      } else {
        console.warn("AuthContext: compte Auth sans doc Firestore (uid=" + fbUser.uid + ")");
      }
      // Lit le claim mustResetPassword (force refresh pour avoir l'état serveur)
      try {
        const tokenResult = await fbUser.getIdTokenResult();
        const claim = tokenResult.claims?.mustResetPassword === true;
        setMustResetClaim(claim);
      } catch (err) {
        console.warn("Lecture claim mustResetPassword échouée:", err);
        setMustResetClaim(false);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  // Resync profil Firestore frais
  useEffect(() => {
    if (!user || users.length === 0) return;
    const fresh = users.find(u => u._id === user._id) ||
                  (user.uid ? users.find(u => u.uid === user.uid) : null);
    if (fresh) {
      const oldJson = JSON.stringify(user);
      const newJson = JSON.stringify(fresh);
      if (oldJson !== newJson) {
        setUser(fresh);
        try { localStorage.setItem(STORAGE_KEY, newJson); } catch {}
      }
    }
  }, [users, user]);

  // ─── Login (inchangé v1.11) ────────────────────────────────────
  const login = useCallback(async (idOrEmail, pwd) => {
    const trimmed = (idOrEmail || "").trim();

    if (looksLikeEmail(trimmed)) {
      try {
        const cred = await signInWithEmailAndPassword(auth, trimmed, pwd);
        // v1.13.3 — IMPORTANT : on force le refresh du token pour que les
        // custom claims (role, etc.) soient bien présents dans le token JWT
        // utilisé par Firestore pour évaluer les règles de sécurité.
        // Sans ça, si le claim a été posé après la dernière connexion via
        // Admin SDK, le client peut avoir un ancien token sans le claim.
        try {
          await cred.user.getIdToken(true);
          // Lit aussi le claim mustResetPassword au passage
          const tokenResult = await cred.user.getIdTokenResult();
          setMustResetClaim(tokenResult.claims?.mustResetPassword === true);
        } catch (refreshErr) {
          console.warn("Force refresh token a échoué (non bloquant):", refreshErr);
        }
        // v1.13.2 — On cherche le profil directement dans Firestore
        // au lieu de chercher dans `users` (qui est vide tant que DataContext
        // n'a pas pu charger la collection, ce qui n'arrive qu'après auth).
        let profil = users.find(u => u.uid === cred.user.uid);
        if (!profil) {
          try {
            const q = query(
              collection(db, "utilisateurs"),
              where("uid", "==", cred.user.uid)
            );
            const snap = await getDocs(q);
            if (!snap.empty) {
              const docSnap = snap.docs[0];
              profil = { ...docSnap.data(), _id: docSnap.id };
            }
          } catch (lookupErr) {
            console.error("Erreur lookup profil après login:", lookupErr);
          }
        }
        if (!profil) {
          await fbSignOut(auth);
          return { ok: false, error: "Profil utilisateur introuvable. Contactez l'administrateur." };
        }
        setUser(profil);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profil)); } catch {}
        return { ok: true };
      } catch (err) {
        const code = err?.code || "";
        const isCredError =
          code === "auth/invalid-credential" ||
          code === "auth/user-not-found" ||
          code === "auth/wrong-password" ||
          code === "auth/invalid-email";
        if (isCredError) {
          return { ok: false, error: "Identifiant ou mot de passe incorrect" };
        }
        console.error("Firebase Auth:", err);
        return { ok: false, error: "Erreur de connexion. Réessayez dans un instant." };
      }
    }

    // v1.13.4 — Fallback ancien système RETIRÉ (étape D de la sécurisation).
    // Désormais Firebase Auth est la seule voie de login. Si l'identifiant
    // ne ressemble pas à un email, on refuse directement.
    return { ok: false, error: "Veuillez saisir votre adresse email." };
  }, [users]);

  // ─── Logout ────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    try { await fbSignOut(auth); } catch {}
    setUser(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  // ─── Changement de mot de passe ────────────────────────────────
  // Réauthentifie d'abord (sécurité Firebase exigée) puis met à jour
  // le mdp. Lève aussi le flag mustResetPassword sur le doc Firestore.
  const changePassword = useCallback(async (currentPwd, newPwd) => {
    if (!auth.currentUser) {
      return { ok: false, error: "Vous devez vous être connecté(e) via email/mot de passe pour changer votre mot de passe. Reconnectez-vous d'abord." };
    }
    // v1.13.5 — On utilise auth.currentUser.email (l'email Firebase Auth réel)
    // et non user.email (l'email Firestore), qui peuvent différer (cas admin).
    const authEmail = auth.currentUser.email;
    if (!authEmail) {
      return { ok: false, error: "Aucun email associé à votre compte Auth." };
    }
    try {
      // Réauthentifie avec l'ancien mdp
      const credential = EmailAuthProvider.credential(authEmail, currentPwd);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Met à jour le mdp Auth
      await updatePassword(auth.currentUser, newPwd);

      // Retire le flag mustResetPassword côté Auth (claim) via Cloud Function
      // et côté Firestore (rétro-compat) en une seule opération serveur.
      try {
        await fnClearMustReset();
        setMustResetClaim(false);
      } catch (clearErr) {
        // Non bloquant : le mdp a été changé, c'est l'essentiel.
        // L'admin pourra retirer le claim manuellement si nécessaire.
        console.warn("Impossible de retirer le claim mustResetPassword:", clearErr);
      }

      // Rétro-compat : si l'ancien champ Firestore mustResetPassword est encore
      // présent sur le profil, le retire aussi (au cas où la Cloud Function
      // n'aurait pas trouvé le doc).
      if (user?.mustResetPassword === true && user?._id) {
        try {
          await updateDoc(doc(db, "utilisateurs", user._id), {
            mustResetPassword: false,
          });
        } catch (fsErr) {
          console.warn("Impossible de retirer mustResetPassword Firestore:", fsErr);
        }
      }

      // Force un refresh du token pour que la prochaine requête utilise le claim mis à jour
      try {
        await auth.currentUser.getIdToken(true);
      } catch {}

      return { ok: true };
    } catch (err) {
      const code = err?.code || "";
      if (code === "auth/wrong-password" || code === "auth/invalid-credential") {
        return { ok: false, error: "Le mot de passe actuel est incorrect." };
      }
      if (code === "auth/weak-password") {
        return { ok: false, error: "Le nouveau mot de passe est trop faible (6 caractères minimum)." };
      }
      if (code === "auth/requires-recent-login") {
        return { ok: false, error: "Pour sécurité, veuillez vous déconnecter et reconnecter avant de changer votre mot de passe." };
      }
      console.error("changePassword:", err);
      return { ok: false, error: "Erreur lors du changement de mot de passe. Réessayez." };
    }
  }, [user]);

  // ─── Mot de passe oublié ───────────────────────────────────────
  // Envoie un email Firebase officiel avec un lien de reset.
  const sendResetEmail = useCallback(async (email) => {
    const trimmed = (email || "").trim();
    if (!looksLikeEmail(trimmed)) {
      return { ok: false, error: "Veuillez saisir une adresse email valide." };
    }
    try {
      await sendPasswordResetEmail(auth, trimmed);
      // Note : Firebase renvoie ok même si l'email n'existe pas (sécurité).
      // C'est volontaire pour ne pas révéler qui a un compte.
      return { ok: true };
    } catch (err) {
      const code = err?.code || "";
      if (code === "auth/invalid-email") {
        return { ok: false, error: "Adresse email invalide." };
      }
      if (code === "auth/too-many-requests") {
        return { ok: false, error: "Trop de tentatives. Réessayez dans quelques minutes." };
      }
      console.error("sendResetEmail:", err);
      return { ok: false, error: "Erreur lors de l'envoi de l'email. Réessayez." };
    }
  }, []);

  // Combine les 2 sources :
  //  - mustResetClaim : claim Firebase Auth (source de vérité prioritaire,
  //    posée par adminCreateUser et adminResetPassword)
  //  - user.mustResetPassword : ancien champ Firestore (rétro-compat avec
  //    les utilisateurs créés avant la v1.14 ou via l'ancien système)
  // Si l'un OU l'autre est vrai → on force le reset.
  const mustResetPassword = mustResetClaim || (user?.mustResetPassword === true);

  return (
    <AuthContext.Provider value={{
      user, login, logout,
      changePassword, sendResetEmail, mustResetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

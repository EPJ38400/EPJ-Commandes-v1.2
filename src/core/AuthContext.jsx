// ═══════════════════════════════════════════════════════════════
//  AuthContext — session utilisateur, login, logout, mdp
//  v1.12.0 : Migration Firebase Auth complète (changement mdp,
//            mdp oublié, forcing première connexion)
//
//  Stratégie login (inchangée v1.11) :
//   • Email + mdp → Firebase Auth en priorité
//   • Identifiant + mdp → fallback Firestore (ancien système)
//   • Profil métier lu depuis /utilisateurs/<id> dans tous les cas
//
//  Nouveautés v1.12 :
//   • changePassword(currentPwd, newPwd) : réauthentifie puis met
//     à jour le mdp Auth. Met aussi mustResetPassword=false côté
//     Firestore pour lever le forcing première connexion.
//   • sendResetEmail(email) : email Firebase officiel de reset.
//   • mustResetPassword : booléen exposé pour que Router fasse
//     le forcing si vrai.
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
import { auth, db } from "../firebase";
import { useData } from "./DataContext";

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

  // Sync onAuthStateChanged → profil métier
  useEffect(() => {
    if (users.length === 0) return;
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (!fbUser) return;
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
        // v1.13.2 — FIX : on cherche le profil directement dans Firestore
        // au lieu de chercher dans `users` (qui est vide tant que DataContext
        // n'a pas pu charger la collection, ce qui n'arrive qu'après auth).
        // Une fois authentifié, les règles Firestore acceptent la lecture.
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
        if (!isCredError) {
          console.error("Firebase Auth:", err);
          return { ok: false, error: "Erreur de connexion. Réessayez dans un instant." };
        }
      }
    }

    // Fallback ancien système
    const found = users.find(u =>
      (u._id === trimmed || u.id === trimmed) && u.pwd === pwd
    );
    if (!found) {
      return { ok: false, error: "Identifiant ou mot de passe incorrect" };
    }
    setUser(found);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(found)); } catch {}
    return { ok: true };
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
    if (!user?.email) {
      return { ok: false, error: "Aucun email associé à votre compte." };
    }
    try {
      // Réauthentifie avec l'ancien mdp
      const credential = EmailAuthProvider.credential(user.email, currentPwd);
      await reauthenticateWithCredential(auth.currentUser, credential);

      // Met à jour le mdp Auth
      await updatePassword(auth.currentUser, newPwd);

      // Lève le flag mustResetPassword côté Firestore si présent
      if (user.mustResetPassword === true && user._id) {
        try {
          await updateDoc(doc(db, "utilisateurs", user._id), {
            mustResetPassword: false,
          });
        } catch (fsErr) {
          // Pas bloquant : le mdp est changé, le flag sera nettoyé à la prochaine sync.
          console.warn("Impossible de retirer mustResetPassword:", fsErr);
        }
      }

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

  // Le flag est lu depuis le doc Firestore (pas le claim Auth, car claim
  // immuable côté client sans Cloud Function).
  const mustResetPassword = user?.mustResetPassword === true;

  return (
    <AuthContext.Provider value={{
      user, login, logout,
      changePassword, sendResetEmail, mustResetPassword,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

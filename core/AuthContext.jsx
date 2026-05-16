// ═══════════════════════════════════════════════════════════════
//  AuthContext — session utilisateur, login, logout
//  v1.11.0 : Migration vers Firebase Auth (avec fallback ancien système)
//
//  Stratégie :
//   • Si l'identifiant saisi ressemble à un email → on tente
//     signInWithEmailAndPassword (Firebase Auth) en priorité.
//   • Si Auth échoue OU si l'identifiant n'est pas un email →
//     fallback sur l'ancien système (lecture du champ pwd Firestore).
//   • Le profil métier (rôles, permissions, signature, etc.) est
//     toujours lu depuis le doc Firestore /utilisateurs/<id>,
//     qu'on passe par Auth ou par fallback.
//
//  Cela garantit qu'AUCUN utilisateur n'est bloqué pendant la
//  transition : anciens identifiants + ancien mdp continuent à
//  fonctionner. À retirer en étape D (suppression des pwd).
// ═══════════════════════════════════════════════════════════════
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { auth } from "../firebase";
import { useData } from "./DataContext";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const STORAGE_KEY = "epj_user";

// Détection grossière : si la chaîne contient un @, on traite comme email
const looksLikeEmail = (s) => typeof s === "string" && s.includes("@");

export function AuthProvider({ children }) {
  const { users } = useData();

  // Chargement initial depuis localStorage (compatibilité ascendante)
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  // ─── Sync Firebase Auth → user métier ─────────────────────────
  // Si une session Auth existe au démarrage (refresh, retour app),
  // on retrouve le doc utilisateur correspondant via le champ uid
  // et on le met en session.
  useEffect(() => {
    if (users.length === 0) return; // attend que la collection soit chargée
    const unsub = onAuthStateChanged(auth, (fbUser) => {
      if (!fbUser) return; // pas connecté Auth → on ne touche pas (peut être en fallback)
      const profil = users.find(u => u.uid === fbUser.uid);
      if (profil) {
        const oldJson = JSON.stringify(user || {});
        const newJson = JSON.stringify(profil);
        if (oldJson !== newJson) {
          setUser(profil);
          try { localStorage.setItem(STORAGE_KEY, newJson); } catch {}
        }
      } else {
        // Compte Auth existe mais pas de doc Firestore correspondant : anomalie.
        console.warn("AuthContext: compte Auth sans doc Firestore (uid=" + fbUser.uid + ")");
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users]);

  // Resynchronise le user stocké avec la version la plus fraîche de Firestore
  // (utile si l'admin change son rôle ou ses droits pendant la session).
  // Logique inchangée par rapport à v1.10.
  useEffect(() => {
    if (!user || users.length === 0) return;
    // Cherche par _id (Firestore doc id) ou par uid si disponible
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

  // ─── Login ────────────────────────────────────────────────────
  // Renvoie une Promise pour permettre l'attente côté UI.
  const login = useCallback(async (idOrEmail, pwd) => {
    const trimmed = (idOrEmail || "").trim();

    // ─── Voie 1 : Firebase Auth si l'identifiant ressemble à un email ───
    if (looksLikeEmail(trimmed)) {
      try {
        const cred = await signInWithEmailAndPassword(auth, trimmed, pwd);
        // Trouve le doc Firestore correspondant
        const profil = users.find(u => u.uid === cred.user.uid);
        if (!profil) {
          // Compte Auth OK mais aucun doc Firestore : sécurité, on déconnecte.
          await fbSignOut(auth);
          return { ok: false, error: "Profil utilisateur introuvable. Contactez l'administrateur." };
        }
        setUser(profil);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(profil)); } catch {}
        return { ok: true };
      } catch (err) {
        // Erreurs Firebase Auth — on tente le fallback uniquement pour
        // les erreurs "identifiant pas trouvé / mdp faux". Pour les
        // autres (réseau, etc.) on remonte l'erreur directement.
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
        // sinon : on passe en fallback ancien système ci-dessous
      }
    }

    // ─── Voie 2 (fallback) : ancien système Firestore pwd ───
    // Permet aux utilisateurs qui n'ont pas encore migré (ou qui tapent
    // leur ancien identifiant non-email) de continuer à se connecter.
    // Le matching se fait par _id (doc id Firestore) OU par champ id
    // (ancien comportement, pour compat totale).
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

  // ─── Logout ───────────────────────────────────────────────────
  const logout = useCallback(async () => {
    // Déconnexion Auth si une session existe (no-op sinon).
    try { await fbSignOut(auth); } catch {}
    setUser(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

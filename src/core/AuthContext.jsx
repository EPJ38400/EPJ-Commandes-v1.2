// ═══════════════════════════════════════════════════════════════
//  AuthContext — session utilisateur, login, logout
// ═══════════════════════════════════════════════════════════════
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useData } from "./DataContext";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const STORAGE_KEY = "epj_user";

export function AuthProvider({ children }) {
  const { users } = useData();

  // Chargement initial depuis localStorage
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  });

  // Resynchronise le user stocké avec la version la plus fraîche de Firestore
  // (utile si l'admin change son rôle ou ses droits pendant la session)
  useEffect(() => {
    if (!user || users.length === 0) return;
    const fresh = users.find(u => u.id === user.id);
    if (fresh) {
      // Ne mets à jour que si quelque chose a vraiment changé
      const oldJson = JSON.stringify(user);
      const newJson = JSON.stringify(fresh);
      if (oldJson !== newJson) {
        setUser(fresh);
        try { localStorage.setItem(STORAGE_KEY, newJson); } catch {}
      }
    }
  }, [users, user]);

  const login = useCallback((id, pwd) => {
    const found = users.find(u => u.id === id && u.pwd === pwd);
    if (!found) return { ok: false, error: "Identifiant ou mot de passe incorrect" };
    setUser(found);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(found)); } catch {}
    return { ok: true };
  }, [users]);

  const logout = useCallback(() => {
    setUser(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

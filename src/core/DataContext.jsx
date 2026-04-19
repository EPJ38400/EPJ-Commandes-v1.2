// ═══════════════════════════════════════════════════════════════
//  DataContext — abonnements Firestore partagés (chantiers, users, config)
//  Consommé par tous les modules : single source of truth.
// ═══════════════════════════════════════════════════════════════
import { createContext, useContext, useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

export function DataProvider({ children }) {
  const [users, setUsers] = useState([]);
  const [chantiers, setChantiers] = useState([]);
  const [config, setConfig] = useState({});
  const [loaded, setLoaded] = useState({ users: false, chantiers: false, config: false });

  // ── Utilisateurs ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "utilisateurs"),
      snap => {
        setUsers(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
        setLoaded(l => ({ ...l, users: true }));
      },
      err => { console.error("Firestore utilisateurs:", err); setLoaded(l => ({ ...l, users: true })); }
    );
    return () => unsub();
  }, []);

  // ── Chantiers ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "chantiers"),
      snap => {
        setChantiers(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
        setLoaded(l => ({ ...l, chantiers: true }));
      },
      err => { console.error("Firestore chantiers:", err); setLoaded(l => ({ ...l, chantiers: true })); }
    );
    return () => unsub();
  }, []);

  // ── Config globale ──
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "config", "settings"),
      snap => {
        setConfig(snap.exists() ? snap.data() : {});
        setLoaded(l => ({ ...l, config: true }));
      },
      err => { console.error("Firestore config:", err); setLoaded(l => ({ ...l, config: true })); }
    );
    return () => unsub();
  }, []);

  const allLoaded = loaded.users && loaded.chantiers && loaded.config;

  return (
    <DataContext.Provider value={{ users, chantiers, config, loaded, allLoaded }}>
      {children}
    </DataContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════
//  DataContext — abonnements Firestore partagés
//  Collections : utilisateurs, chantiers, config/settings, rolesConfig/*
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
  const [rolesConfig, setRolesConfig] = useState({}); // { "Admin": {...}, "Direction": {...}, ... }
  const [tasksConfig, setTasksConfig] = useState(null); // modèle global d'avancement
  const [loaded, setLoaded] = useState({
    users: false, chantiers: false, config: false, rolesConfig: false, tasksConfig: false,
  });

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

  // ── Overrides de rôles (Droits types modifiables) ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "rolesConfig"),
      snap => {
        const cfg = {};
        snap.docs.forEach(d => { cfg[d.id] = d.data(); });
        setRolesConfig(cfg);
        setLoaded(l => ({ ...l, rolesConfig: true }));
      },
      err => { console.error("Firestore rolesConfig:", err); setLoaded(l => ({ ...l, rolesConfig: true })); }
    );
    return () => unsub();
  }, []);

  // ── Modèle global des tâches d'avancement ──
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "tasksConfig", "default"),
      snap => {
        setTasksConfig(snap.exists() ? snap.data() : null);
        setLoaded(l => ({ ...l, tasksConfig: true }));
      },
      err => { console.error("Firestore tasksConfig:", err); setLoaded(l => ({ ...l, tasksConfig: true })); }
    );
    return () => unsub();
  }, []);

  const allLoaded = loaded.users && loaded.chantiers && loaded.config && loaded.rolesConfig && loaded.tasksConfig;

  return (
    <DataContext.Provider value={{
      users, chantiers, config, rolesConfig, tasksConfig, loaded, allLoaded,
    }}>
      {children}
    </DataContext.Provider>
  );
}

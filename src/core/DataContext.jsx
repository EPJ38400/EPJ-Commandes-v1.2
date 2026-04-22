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
  const [company, setCompany] = useState({});
  const [rolesConfig, setRolesConfig] = useState({}); // { "Admin": {...}, "Direction": {...}, ... }
  const [tasksConfig, setTasksConfig] = useState(null); // modèle global d'avancement
  const [outils, setOutils] = useState([]);
  const [outillageSorties, setOutillageSorties] = useState([]);
  const [outillageCategories, setOutillageCategories] = useState([]);
  const [outillagePannes, setOutillagePannes] = useState([]);
  const [smsTemplates, setSmsTemplates] = useState([]);
  const [avancementValidations, setAvancementValidations] = useState([]);
  const [reserves, setReserves] = useState([]);
  const [reservesCategories, setReservesCategories] = useState([]);
  const [reservesEmetteurs, setReservesEmetteurs] = useState([]);
  // v10.C — commandes exposées globalement pour le Dashboard Direction
  const [commandes, setCommandes] = useState([]);
  const [loaded, setLoaded] = useState({
    users: false, chantiers: false, config: false, company: false, rolesConfig: false,
    tasksConfig: false, outils: false, outillageSorties: false,
    outillageCategories: false, outillagePannes: false, smsTemplates: false,
    avancementValidations: false,
    reserves: false, reservesCategories: false, reservesEmetteurs: false,
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

  // ── Config société (infos EPJ + papier en-tête pour quitus) ──
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "config", "company"),
      snap => {
        setCompany(snap.exists() ? snap.data() : {});
        setLoaded(l => ({ ...l, company: true }));
      },
      err => { console.error("Firestore company:", err); setLoaded(l => ({ ...l, company: true })); }
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

  // ── Outils (catalogue parc machines) ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "outils"),
      snap => {
        setOutils(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
        setLoaded(l => ({ ...l, outils: true }));
      },
      err => { console.error("Firestore outils:", err); setLoaded(l => ({ ...l, outils: true })); }
    );
    return () => unsub();
  }, []);

  // ── Sorties d'outillage (en cours + historique) ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "outillageSorties"),
      snap => {
        setOutillageSorties(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
        setLoaded(l => ({ ...l, outillageSorties: true }));
      },
      err => { console.error("Firestore outillageSorties:", err); setLoaded(l => ({ ...l, outillageSorties: true })); }
    );
    return () => unsub();
  }, []);

  // ── Catégories d'outillage (modifiables) ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "outillageCategories"),
      snap => {
        const cats = snap.docs.map(d => ({ ...d.data(), _id: d.id }));
        cats.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
        setOutillageCategories(cats);
        setLoaded(l => ({ ...l, outillageCategories: true }));
      },
      err => { console.error("Firestore outillageCategories:", err); setLoaded(l => ({ ...l, outillageCategories: true })); }
    );
    return () => unsub();
  }, []);

  // ── Pannes récurrentes ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "outillagePannes"),
      snap => {
        const pannes = snap.docs.map(d => ({ ...d.data(), _id: d.id }));
        pannes.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
        setOutillagePannes(pannes);
        setLoaded(l => ({ ...l, outillagePannes: true }));
      },
      err => { console.error("Firestore outillagePannes:", err); setLoaded(l => ({ ...l, outillagePannes: true })); }
    );
    return () => unsub();
  }, []);

  // ── Modèles SMS globaux ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "smsTemplates"),
      snap => {
        setSmsTemplates(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
        setLoaded(l => ({ ...l, smsTemplates: true }));
      },
      err => { console.error("Firestore smsTemplates:", err); setLoaded(l => ({ ...l, smsTemplates: true })); }
    );
    return () => unsub();
  }, []);

  // ── Validations d'avancement mensuel ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "avancementValidations"),
      snap => {
        setAvancementValidations(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
        setLoaded(l => ({ ...l, avancementValidations: true }));
      },
      err => { console.error("Firestore avancementValidations:", err); setLoaded(l => ({ ...l, avancementValidations: true })); }
    );
    return () => unsub();
  }, []);

  // ── Réserves (module 4) ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "reserves"),
      snap => {
        setReserves(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
        setLoaded(l => ({ ...l, reserves: true }));
      },
      err => { console.error("Firestore reserves:", err); setLoaded(l => ({ ...l, reserves: true })); }
    );
    return () => unsub();
  }, []);

  // ── Catégories de réserves (configurables) ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "reservesCategories"),
      snap => {
        const cats = snap.docs.map(d => ({ ...d.data(), _id: d.id }));
        cats.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
        setReservesCategories(cats);
        setLoaded(l => ({ ...l, reservesCategories: true }));
      },
      err => { console.error("Firestore reservesCategories:", err); setLoaded(l => ({ ...l, reservesCategories: true })); }
    );
    return () => unsub();
  }, []);

  // ── Émetteurs de réserves (configurables) ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "reservesEmetteurs"),
      snap => {
        const emt = snap.docs.map(d => ({ ...d.data(), _id: d.id }));
        emt.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
        setReservesEmetteurs(emt);
        setLoaded(l => ({ ...l, reservesEmetteurs: true }));
      },
      err => { console.error("Firestore reservesEmetteurs:", err); setLoaded(l => ({ ...l, reservesEmetteurs: true })); }
    );
    return () => unsub();
  }, []);

  // ── Commandes (v10.C — pour Dashboard) ──
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "commandes"),
      snap => {
        setCommandes(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
      },
      err => { console.error("Firestore commandes:", err); }
    );
    return () => unsub();
  }, []);

  const allLoaded = loaded.users && loaded.chantiers && loaded.config && loaded.company
    && loaded.rolesConfig && loaded.tasksConfig && loaded.outils && loaded.outillageSorties
    && loaded.outillageCategories && loaded.outillagePannes && loaded.smsTemplates
    && loaded.avancementValidations
    && loaded.reserves && loaded.reservesCategories && loaded.reservesEmetteurs;

  return (
    <DataContext.Provider value={{
      users, chantiers, config, company, rolesConfig, tasksConfig,
      outils, outillageSorties, outillageCategories, outillagePannes, smsTemplates,
      avancementValidations,
      reserves, reservesCategories, reservesEmetteurs,
      commandes,
      loaded, allLoaded,
    }}>
      {children}
    </DataContext.Provider>
  );
}

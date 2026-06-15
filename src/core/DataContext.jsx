// ═══════════════════════════════════════════════════════════════
//  DataContext — abonnements Firestore partagés
//  v2.0.0 :
//   • Séparation onSnapshot (données vivantes) / getDocs (référentiel)
//   • Réduit les lectures Firestore facturables sur les collections
//     qui changent rarement (config, catégories, rôles, templates).
//   • Une fonction `refreshReferenceData()` est exposée pour que les
//     écrans Admin rechargent le référentiel après modification.
//
//  TEMPS RÉEL (onSnapshot, 9 collections) :
//    utilisateurs, chantiers, commandes, reserves,
//    outils, outillageSorties, outillageInterventions,
//    avancementValidations, reserveMailsAClasser
//
//  RÉFÉRENTIEL (getDocs au démarrage + refresh manuel, 9 collections) :
//    config/settings, config/company, rolesConfig, tasksConfig,
//    outillageCategories, outillagePannes, smsTemplates,
//    reservesCategories, reservesEmetteurs
//
//  v1.13.7 (conservé) : on attend que Firebase Auth ait restauré la
//  session ET rafraîchi le token JWT avec les Custom Claims avant
//  d'ouvrir les listeners Firestore.
// ═══════════════════════════════════════════════════════════════
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { db, auth } from "../firebase";
import { collection, doc, onSnapshot, getDocs, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

export function DataProvider({ children }) {
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setAuthReady(false);
        return;
      }
      try {
        await fbUser.getIdToken(true);
        setAuthReady(true);
      } catch (err) {
        console.warn("DataContext: refresh token a échoué, listeners restent fermés:", err);
        setAuthReady(false);
      }
    });
    return () => unsub();
  }, []);

  // ─── États : données vivantes (temps réel) ────────────────────
  const [users, setUsers] = useState([]);
  const [chantiers, setChantiers] = useState([]);
  const [commandes, setCommandes] = useState([]);
  const [reserves, setReserves] = useState([]);
  const [outils, setOutils] = useState([]);
  const [outillageSorties, setOutillageSorties] = useState([]);
  const [outillageInterventions, setOutillageInterventions] = useState([]);
  const [avancementValidations, setAvancementValidations] = useState([]);

  // ─── États : référentiel (chargement initial + refresh manuel) ──
  const [config, setConfig] = useState({});
  const [company, setCompany] = useState({});
  const [rolesConfig, setRolesConfig] = useState({});
  const [tasksConfig, setTasksConfig] = useState(null);
  const [outillageCategories, setOutillageCategories] = useState([]);
  const [outillagePannes, setOutillagePannes] = useState([]);
  const [smsTemplates, setSmsTemplates] = useState([]);
  const [reservesCategories, setReservesCategories] = useState([]);
  const [reservesEmetteurs, setReservesEmetteurs] = useState([]);

  const [loaded, setLoaded] = useState({
    users: false, chantiers: false, commandes: false, reserves: false,
    outils: false, outillageSorties: false, outillageInterventions: false,
    avancementValidations: false,
    config: false, company: false, rolesConfig: false, tasksConfig: false,
    outillageCategories: false, outillagePannes: false, smsTemplates: false,
    reservesCategories: false, reservesEmetteurs: false,
  });

  // ─── Helper pour mapper un snapshot collection → tableau ────────
  const mapDocs = (snap) => snap.docs.map(d => ({ ...d.data(), _id: d.id }));

  // ─── REFERENCE DATA : chargement initial + fonction de refresh ──
  const loadReferenceData = useCallback(async () => {
    try {
      // config/settings
      const cfgSnap = await getDoc(doc(db, "config", "settings"));
      setConfig(cfgSnap.exists() ? cfgSnap.data() : {});
      setLoaded(l => ({ ...l, config: true }));

      // config/company
      const compSnap = await getDoc(doc(db, "config", "company"));
      setCompany(compSnap.exists() ? compSnap.data() : {});
      setLoaded(l => ({ ...l, company: true }));

      // rolesConfig
      const rolesSnap = await getDocs(collection(db, "rolesConfig"));
      const cfg = {};
      rolesSnap.docs.forEach(d => { cfg[d.id] = d.data(); });
      setRolesConfig(cfg);
      setLoaded(l => ({ ...l, rolesConfig: true }));

      // tasksConfig/default
      const tasksSnap = await getDoc(doc(db, "tasksConfig", "default"));
      setTasksConfig(tasksSnap.exists() ? tasksSnap.data() : null);
      setLoaded(l => ({ ...l, tasksConfig: true }));

      // outillageCategories (trié par ordre)
      const catOutSnap = await getDocs(collection(db, "outillageCategories"));
      const cats = mapDocs(catOutSnap);
      cats.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
      setOutillageCategories(cats);
      setLoaded(l => ({ ...l, outillageCategories: true }));

      // outillagePannes (trié par code)
      const pannesSnap = await getDocs(collection(db, "outillagePannes"));
      const pannes = mapDocs(pannesSnap);
      pannes.sort((a, b) => (a.code || "").localeCompare(b.code || ""));
      setOutillagePannes(pannes);
      setLoaded(l => ({ ...l, outillagePannes: true }));

      // smsTemplates
      const smsSnap = await getDocs(collection(db, "smsTemplates"));
      setSmsTemplates(mapDocs(smsSnap));
      setLoaded(l => ({ ...l, smsTemplates: true }));

      // reservesCategories (trié par ordre)
      const catResSnap = await getDocs(collection(db, "reservesCategories"));
      const catsR = mapDocs(catResSnap);
      catsR.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
      setReservesCategories(catsR);
      setLoaded(l => ({ ...l, reservesCategories: true }));

      // reservesEmetteurs (trié par ordre)
      const emtSnap = await getDocs(collection(db, "reservesEmetteurs"));
      const emt = mapDocs(emtSnap);
      emt.sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
      setReservesEmetteurs(emt);
      setLoaded(l => ({ ...l, reservesEmetteurs: true }));
    } catch (err) {
      console.error("DataContext: échec chargement référentiel:", err);
      // On marque quand même comme "loaded" pour ne pas bloquer l'app
      setLoaded(l => ({
        ...l, config: true, company: true, rolesConfig: true, tasksConfig: true,
        outillageCategories: true, outillagePannes: true, smsTemplates: true,
        reservesCategories: true, reservesEmetteurs: true,
      }));
    }
  }, []);

  // Charge le référentiel une fois que l'auth est prête
  useEffect(() => {
    if (!authReady) return;
    loadReferenceData();
  }, [authReady, loadReferenceData]);

  // ─── LIVE DATA : listeners temps réel ───────────────────────────

  // Utilisateurs
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "utilisateurs"),
      snap => {
        setUsers(mapDocs(snap));
        setLoaded(l => ({ ...l, users: true }));
      },
      err => { console.error("Firestore utilisateurs:", err); setLoaded(l => ({ ...l, users: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // Chantiers
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "chantiers"),
      snap => {
        setChantiers(mapDocs(snap));
        setLoaded(l => ({ ...l, chantiers: true }));
      },
      err => { console.error("Firestore chantiers:", err); setLoaded(l => ({ ...l, chantiers: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // Commandes
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "commandes"),
      snap => {
        setCommandes(mapDocs(snap));
        setLoaded(l => ({ ...l, commandes: true }));
      },
      err => { console.error("Firestore commandes:", err); setLoaded(l => ({ ...l, commandes: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // Réserves
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "reserves"),
      snap => {
        setReserves(mapDocs(snap));
        setLoaded(l => ({ ...l, reserves: true }));
      },
      err => { console.error("Firestore reserves:", err); setLoaded(l => ({ ...l, reserves: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // Outils (parc machines — l'état d'un outil change souvent : sortie/retour)
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "outils"),
      snap => {
        setOutils(mapDocs(snap));
        setLoaded(l => ({ ...l, outils: true }));
      },
      err => { console.error("Firestore outils:", err); setLoaded(l => ({ ...l, outils: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // Sorties d'outillage (création/clôture en temps réel)
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "outillageSorties"),
      snap => {
        setOutillageSorties(mapDocs(snap));
        setLoaded(l => ({ ...l, outillageSorties: true }));
      },
      err => { console.error("Firestore outillageSorties:", err); setLoaded(l => ({ ...l, outillageSorties: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // Interventions SAV (déclaration de panne autonome + suivi)
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "outillageInterventions"),
      snap => {
        setOutillageInterventions(mapDocs(snap));
        setLoaded(l => ({ ...l, outillageInterventions: true }));
      },
      err => { console.error("Firestore outillageInterventions:", err); setLoaded(l => ({ ...l, outillageInterventions: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // Validations d'avancement mensuel
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "avancementValidations"),
      snap => {
        setAvancementValidations(mapDocs(snap));
        setLoaded(l => ({ ...l, avancementValidations: true }));
      },
      err => { console.error("Firestore avancementValidations:", err); setLoaded(l => ({ ...l, avancementValidations: true })); }
    );
    return () => unsub();
  }, [authReady]);

  const allLoaded =
    loaded.users && loaded.chantiers && loaded.commandes && loaded.reserves &&
    loaded.outils && loaded.outillageSorties && loaded.outillageInterventions &&
    loaded.avancementValidations &&
    loaded.config && loaded.company && loaded.rolesConfig && loaded.tasksConfig &&
    loaded.outillageCategories && loaded.outillagePannes && loaded.smsTemplates &&
    loaded.reservesCategories && loaded.reservesEmetteurs;

  // ─── Feature flags ───────────────────────────────────────────────
  const featureFlags = {
    ocrArEnabled: config?.ocrArEnabled === true,
    esaboraEnabled: config?.esaboraEnabled === true,
    esaboraWebhookUrl: config?.esaboraWebhookUrl || "",
    esaboraTvaDefault: typeof config?.esaboraTvaDefault === "number"
      ? config.esaboraTvaDefault
      : 20,
  };

  return (
    <DataContext.Provider value={{
      users, chantiers, commandes, reserves,
      outils, outillageSorties, outillageInterventions, avancementValidations,
      config, company, rolesConfig, tasksConfig,
      outillageCategories, outillagePannes, smsTemplates,
      reservesCategories, reservesEmetteurs,
      featureFlags,
      loaded, allLoaded,
      // v2.0.0 — À appeler depuis les écrans Admin après modification
      // du référentiel pour le rafraîchir manuellement (vu qu'il n'est
      // plus en temps réel).
      refreshReferenceData: loadReferenceData,
    }}>
      {children}
    </DataContext.Provider>
  );
}

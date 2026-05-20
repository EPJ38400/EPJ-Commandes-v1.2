// ═══════════════════════════════════════════════════════════════
//  DataContext — abonnements Firestore partagés
//  Collections : utilisateurs, chantiers, config/settings, rolesConfig/*
//  v1.13.7 : Attendre que Firebase Auth ait restauré la session
//            ET rafraîchi le token JWT avec les Custom Claims AVANT
//            d'ouvrir les listeners Firestore. Sinon, les listeners
//            partent avec un token incomplet et plantent en boucle
//            avec permission-denied.
// ═══════════════════════════════════════════════════════════════
import { createContext, useContext, useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

export function DataProvider({ children }) {
  // v1.13.7 — Signal d'authentification complète :
  //   - utilisateur Firebase Auth dispo
  //   - token JWT rafraîchi (Custom Claims à jour)
  // Tant que ce signal est false, AUCUN listener Firestore n'est ouvert.
  // Cela évite les permission-denied au démarrage de l'app quand le
  // SDK Firebase restaure une session avec un ancien token JWT.
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        setAuthReady(false);
        return;
      }
      try {
        // Force la récupération d'un token frais avec les Custom Claims à jour.
        // Indispensable car le SDK peut restaurer une session avec un ancien
        // token qui ne contient pas encore le claim "role".
        await fbUser.getIdToken(true);
        setAuthReady(true);
      } catch (err) {
        console.warn("DataContext: refresh token a échoué, listeners restent fermés:", err);
        setAuthReady(false);
      }
    });
    return () => unsub();
  }, []);
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
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "utilisateurs"),
      snap => {
        setUsers(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
        setLoaded(l => ({ ...l, users: true }));
      },
      err => { console.error("Firestore utilisateurs:", err); setLoaded(l => ({ ...l, users: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // ── Chantiers ──
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "chantiers"),
      snap => {
        setChantiers(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
        setLoaded(l => ({ ...l, chantiers: true }));
      },
      err => { console.error("Firestore chantiers:", err); setLoaded(l => ({ ...l, chantiers: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // ── Config globale ──
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      doc(db, "config", "settings"),
      snap => {
        setConfig(snap.exists() ? snap.data() : {});
        setLoaded(l => ({ ...l, config: true }));
      },
      err => { console.error("Firestore config:", err); setLoaded(l => ({ ...l, config: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // ── Config société (infos EPJ + papier en-tête pour quitus) ──
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      doc(db, "config", "company"),
      snap => {
        setCompany(snap.exists() ? snap.data() : {});
        setLoaded(l => ({ ...l, company: true }));
      },
      err => { console.error("Firestore company:", err); setLoaded(l => ({ ...l, company: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // ── Overrides de rôles (Droits types modifiables) ──
  useEffect(() => {
    if (!authReady) return;
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
  }, [authReady]);

  // ── Modèle global des tâches d'avancement ──
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      doc(db, "tasksConfig", "default"),
      snap => {
        setTasksConfig(snap.exists() ? snap.data() : null);
        setLoaded(l => ({ ...l, tasksConfig: true }));
      },
      err => { console.error("Firestore tasksConfig:", err); setLoaded(l => ({ ...l, tasksConfig: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // ── Outils (catalogue parc machines) ──
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "outils"),
      snap => {
        setOutils(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
        setLoaded(l => ({ ...l, outils: true }));
      },
      err => { console.error("Firestore outils:", err); setLoaded(l => ({ ...l, outils: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // ── Sorties d'outillage (en cours + historique) ──
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "outillageSorties"),
      snap => {
        setOutillageSorties(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
        setLoaded(l => ({ ...l, outillageSorties: true }));
      },
      err => { console.error("Firestore outillageSorties:", err); setLoaded(l => ({ ...l, outillageSorties: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // ── Catégories d'outillage (modifiables) ──
  useEffect(() => {
    if (!authReady) return;
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
  }, [authReady]);

  // ── Pannes récurrentes ──
  useEffect(() => {
    if (!authReady) return;
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
  }, [authReady]);

  // ── Modèles SMS globaux ──
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "smsTemplates"),
      snap => {
        setSmsTemplates(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
        setLoaded(l => ({ ...l, smsTemplates: true }));
      },
      err => { console.error("Firestore smsTemplates:", err); setLoaded(l => ({ ...l, smsTemplates: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // ── Validations d'avancement mensuel ──
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "avancementValidations"),
      snap => {
        setAvancementValidations(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
        setLoaded(l => ({ ...l, avancementValidations: true }));
      },
      err => { console.error("Firestore avancementValidations:", err); setLoaded(l => ({ ...l, avancementValidations: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // ── Réserves (module 4) ──
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "reserves"),
      snap => {
        setReserves(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
        setLoaded(l => ({ ...l, reserves: true }));
      },
      err => { console.error("Firestore reserves:", err); setLoaded(l => ({ ...l, reserves: true })); }
    );
    return () => unsub();
  }, [authReady]);

  // ── Catégories de réserves (configurables) ──
  useEffect(() => {
    if (!authReady) return;
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
  }, [authReady]);

  // ── Émetteurs de réserves (configurables) ──
  useEffect(() => {
    if (!authReady) return;
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
  }, [authReady]);

  // ── Commandes (v10.C — pour Dashboard) ──
  useEffect(() => {
    if (!authReady) return;
    const unsub = onSnapshot(
      collection(db, "commandes"),
      snap => {
        setCommandes(snap.docs.map(d => ({ ...d.data(), _id: d.id })));
      },
      err => { console.error("Firestore commandes:", err); }
    );
    return () => unsub();
  }, [authReady]);

  const allLoaded = loaded.users && loaded.chantiers && loaded.config && loaded.company
    && loaded.rolesConfig && loaded.tasksConfig && loaded.outils && loaded.outillageSorties
    && loaded.outillageCategories && loaded.outillagePannes && loaded.smsTemplates
    && loaded.avancementValidations
    && loaded.reserves && loaded.reservesCategories && loaded.reservesEmetteurs;

  // v10.J — Feature flags extraits de config/settings (avec valeurs par défaut sûres)
  // Chaque flag est consommé via useData().featureFlags.<nom>. Ajouter ici tout
  // nouveau flag pour qu'il soit accessible partout dans l'app sans bricoler.
  const featureFlags = {
    // OCR Make/OpenAI pour AR/BL fournisseur : par défaut DÉSACTIVÉ tant
    // que le scénario Make n'est pas en place chez Pierre-Julien. Une fois
    // activé depuis Admin → Paramètres, les dates de livraison annoncées
    // par les fournisseurs sont affichées et la bannière retard les utilise.
    ocrArEnabled: config?.ocrArEnabled === true,
    // v10.L — Intégration Esabora via Zapier
    esaboraEnabled: config?.esaboraEnabled === true,
    esaboraWebhookUrl: config?.esaboraWebhookUrl || "",
    // v10.L.1 — TVA par défaut envoyée dans l'entête du fichier Esabora.
    // Esabora calcule les montants à partir de cette TVA d'entête ; les
    // colonnes TVA des lignes d'articles restent vides (le taux d'entête
    // est appliqué par défaut à toutes les lignes du draft).
    esaboraTvaDefault: typeof config?.esaboraTvaDefault === "number"
      ? config.esaboraTvaDefault
      : 20,
  };

  return (
    <DataContext.Provider value={{
      users, chantiers, config, company, rolesConfig, tasksConfig,
      outils, outillageSorties, outillageCategories, outillagePannes, smsTemplates,
      avancementValidations,
      reserves, reservesCategories, reservesEmetteurs,
      commandes,
      featureFlags, // v10.J
      loaded, allLoaded,
    }}>
      {children}
    </DataContext.Provider>
  );
}

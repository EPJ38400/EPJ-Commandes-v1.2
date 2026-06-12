import { useState, useMemo, useEffect, useRef } from "react";
import { db } from "../../firebase";
import { collection, addDoc, updateDoc, doc, onSnapshot, query, getDoc, setDoc, deleteDoc, writeBatch, getDocs, runTransaction } from "firebase/firestore";
import { initEPJData, uploadCatalog, deleteCategoryByQuery, buildCatalogueDocId } from "../../initFirestore";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { uploadPhotoToFolder, deletePhotoByPath } from "../parc-machines/parcUtils";
import { EmojiPicker } from "../../core/components/EmojiPicker";
import { CATALOG_SEED } from "./catalogSeed";
// PERF (lot trio) : xlsx n'est plus importé statiquement — chargé via
// import() dynamique aux 2 points d'usage admin (export / import catalogue).
import {
  parseCatalogAoa, findDuplicateRefs, compareCatalogues, articlesToAoa,
  countMultiCategoryArticles,
} from "./catalogImporter";
// v10.H — Module SMS automatique via Brevo + Make
// v10.I — Helpers étendus (validation/passage/réception/suppression) + delete queue
import {
  smsCommandeCreee, smsCommandeModifiee,
  smsCommandeValidee, smsCommandePassee, smsCommandeRecue, smsCommandeSupprimee,
  findConducteur, findAssistanteAchats, findUserByUid,
  deleteSentSmsQueueDocs,
} from "../../core/smsService";
import { can } from "../../core/permissions";
// Lot trio — tokens charte + primitives DS-1 (DIRECTION_ARTISTIQUE.md)
import { EPJ, fontString as font, font as fontFamilies, radius, space, fontSize, fontWeight, shadow } from "../../core/theme";
import { Badge } from "../../core/components/Badge";
import { Button } from "../../core/components/Button";
import { IconButton } from "../../core/components/IconButton";
import { Field } from "../../core/components/Field";
import { Banner } from "../../core/components/Banner";
import { DataTable } from "../../core/components/DataTable";
import { useViewport } from "../../core/useViewport";
// v10.J — helpers réception (chantier) + dates (souhaitée/fournisseur)
import {
  buildReceptionPayload, computeReliquatItems, validateReceivedQuantities, normalizeQty,
} from "./orderReceive";
import { getExpectedDeliveryDate, formatDateFR } from "./orderDates";
import { OrderMessageThread } from "./OrderMessageThread";
import { PartialPassSheet } from "./PartialPassSheet";
import { buildPartialPassPayload } from "./orderPartialPass";

/* ═══════════════════════════════════════════════════
   EPJ App Globale — Module Commandes (ex-V1.3)
   Encapsulé dans le Socle : session & page de garde
   sont gérées au niveau du Layout global.
   ═══════════════════════════════════════════════════ */

// ─── v10.G — Suppression des USERS et CHANTIERS en dur ───
// Avant la v10.G, ce fichier contenait deux constantes en dur :
//   const USERS = [...]    // 7 utilisateurs avec emails et mots de passe
//   const CHANTIERS = [...] // 19 chantiers
// Ces données sont désormais lues UNIQUEMENT depuis Firestore via les
// listeners ci-dessous (`onSnapshot` collection "utilisateurs" et "chantiers").
// La source de vérité est unique : Firestore. Plus de risque d'incohérence
// entre les noms de salariés présents en code et ceux de la base.
//
// Le fichier `initFirestore.js` conserve une copie de ces seeds car elle
// sert UNIQUEMENT lors de l'opération "🔄 Réinitialiser Firebase" (Admin)
// pour repeupler une base vide. Cette opération est désormais sécurisée
// par une confirmation à 2 étapes (cf. v10.G — bouton Réinitialiser).
//
// Les fallbacks `useState(USERS)` et `useState(CHANTIERS)` sont remplacés
// par `useState([])` ; pendant le tout premier chargement (~200ms),
// les listes sont vides — ce qui est inoffensif vu qu'on a déjà un
// `fbLoading` en place pour les commandes.
// ─── fin v10.G ───


// ─── v10.G — CATALOG déplacé dans catalogSeed.js ───
// Le seed est utilisé UNIQUEMENT par la fonction "🔄 Réinitialiser Firebase".
// En usage normal, dynCatalog est peuplé par onSnapshot('catalogue').
// CAT_ICONS est conservé en dur car c'est un mapping d'icônes (config UI),
// pas des données métier. Il sert de fallback si Firestore est vide.
const CAT_ICONS = {"Béton + Descente":"🧱","Conduit + Manchon":"🔧","Équip. Sous-Sol":"🏗️","Plexo":"🔌","Placo":"📦","Colonne Montante":"⚡","Équipement Commun":"🏢","Équipement Logement":"🏠","Audace + Ovalis":"⚪","Courant Faible":"📡","Interphonie":"🔔","Lustrerie":"💡","Quincaillerie":"🔩","Outillage":"🛠️","Divers":"📎","Fils / Câbles":"🔌","Vêtements de travail":"👔","EPI":"🦺"};

const EPJ_LOGO = "data:image/jpeg;base64,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gXajx44X0weCKetrJyHupXUggqVUdfoKAK1nqFzqMJuLaCNYtxCmVyC2O+AOKI9WC3Vxa3UflyQR+aSjblZfarNhYx6daLbRMzIpJBY880w6ZA2oSXrFmeSPy2U/dIoAoJqpv4o5lkht0Dbgj3G1mx/ewP0qzNq3lfZYkRJp7kkIEf5BjvnH9Kkg0z7LEIre6mjiBO1Plbb9MjNLJpkc1zbXMssjSW2dp4G7PrgUASK90hLTrCsagklGJP8AKqFvrn2uMyx/Z4kyQommwxHrgDitaRBJG0ZzhgQcVBYWMWn2i20RZlXOC3Xk5oAoprqk3UZjQy28RkBR9yOPY9qvafdm+sIbkpsMi525ziozpdub+S8bczSx+WyH7pFJBpv2WIQ293PHEv3U+Vtv5jNAEd7q6W18lmip5jLuLyPtVR9fWpLW9aecIZLVsgnEcpZvyxTptNjmniufMdLiNdolXGSPcYwaligljfc11JIP7rKoH6CgCeiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/2Q==";
// Lot trio : EPJ / font viennent désormais de src/core/theme.js (tokens charte).
// La table statut→couleur vit dans <Badge> (source unique, DA §5). Restent ici :
//   • ORDER_STATUTS : liste ordonnée des statuts commande (filtre Historique).
//   • STATUT_ACCENT : teinte foncée par statut (bordures / labels de section),
//     même famille que le tone <Badge> correspondant.
const ORDER_STATUTS = ["En attente de validation","Validée","Envoyée aux achats","Commandée","Commandée partiellement","Refusée","Réceptionnée","Réceptionnée partiellement","Scindée"];
const STATUT_ACCENT = {
  "En attente de validation": EPJ.orangeText,
  "Validée": EPJ.blueText,
  "Envoyée aux achats": EPJ.blueText,
  "Commandée": EPJ.greenText,
  "Commandée partiellement": EPJ.catEtude,      // partiel = violet (décision PJ)
  "Refusée": EPJ.redText,
  "Réceptionnée": EPJ.greenText,
  "Réceptionnée partiellement": EPJ.catEtude,   // partiel = violet (décision PJ)
  "Scindée": EPJ.gray600,
};

// Affichage statut. Les enfants de scission ("-1"/"-2") suivent le cycle normal
// d'une commande (Envoyée aux achats → Commandée …). Seul l'AFFICHAGE diffère :
// une fois réellement commandé, un enfant de scission (createdBySplit) montre
// "Partiellement commandée" (c'est une fraction de la commande d'origine).
// Le statut réel reste "Commandée" → filtres et logique inchangés.
// Retourne { status, label } à passer à <Badge status label> (la couleur est
// décidée par la table centralisée de Badge, plus par cet écran).
function getStatusDisplay(order) {
  if (!order || !order.statut) return { status: null, label: "—" };
  if (order.createdBySplit === true && order.statut === "Commandée") {
    return { status: "Commandée", label: "Partiellement commandée" };
  }
  return { status: order.statut, label: order.statut };
}

// Équipement salarié = only Outillage category
const EMAIL_ACHATS = "achat@epj-electricite.com";
const EQUIP_CATS = ["Outillage","EPI","Vêtements de travail"];

// ─── PDF COMPONENT (React natif, pas d'iframe) ───
const PdfView = ({order, onClose}) => {
  const byFourn = {};
  const items = order.items || [];
  items.forEach(it => { const c = (it.r||'').split(' ')[0].substring(0,3).toUpperCase(); if(!byFourn[c]) byFourn[c]=[]; byFourn[c].push(it); });
  const totalQty = items.reduce((s,i)=>s+(i.qty||0),0);
  const ch = order.chantierObj || {num:order.chantierNum||order.numAffaire, nom:order.chantierNom||order.chantier, adresse:order.chantierAdresse||'', conducteur:order.chantierConducteur||''};
  const S = {
    page:{fontFamily:'Arial,Helvetica,sans-serif',color:'#3d3d3d',fontSize:11,lineHeight:1.4,background:'#fff',padding:20,borderRadius:12,maxWidth:520,margin:'0 auto'},
    hdr:{display:'flex',justifyContent:'space-between',alignItems:'center',paddingBottom:12,borderBottom:'3px solid #00A3E0'},
    logoArea:{display:'flex',alignItems:'center',gap:12},
    logoTxt:{fontSize:28,fontWeight:900,color:'#3d3d3d',letterSpacing:-1},
    logoSub:{fontSize:9,color:'#8C8C8C',letterSpacing:3,textTransform:'uppercase'},
    cmdNum:{fontSize:20,fontWeight:900,color:'#00A3E0',textAlign:'right'},
    cmdDate:{fontSize:10,color:'#8C8C8C',textAlign:'right'},
    colorBar:{height:4,background:'linear-gradient(90deg,#00A3E0 0%,#A8C536 40%,#F5841F 70%,#F5841F 100%)',margin:'0 0 15px'},
    urgBanner:{background:'#E53935',color:'#fff',padding:'8px 16px',fontWeight:900,fontSize:13,textAlign:'center',borderRadius:4,marginBottom:12},
    infoGrid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:15},
    infoBox:{background:'#f8f9fa',borderRadius:6,padding:'10px 12px',borderLeft:'3px solid #00A3E0'},
    infoBoxG:{background:'#f8f9fa',borderRadius:6,padding:'10px 12px',borderLeft:'3px solid #A8C536'},
    label:{fontSize:9,textTransform:'uppercase',color:'#8C8C8C',fontWeight:700,marginBottom:3,letterSpacing:.5},
    val:{fontSize:12,fontWeight:700,color:'#3d3d3d'},
    fournHdr:{background:'#00A3E0',color:'#fff',padding:'6px 12px',fontWeight:700,fontSize:11,borderRadius:'4px 4px 0 0',marginTop:10},
    tbl:{width:'100%',borderCollapse:'collapse',marginBottom:2},
    th:{background:'#f0f1f3',padding:'5px 8px',textAlign:'left',fontSize:9,textTransform:'uppercase',color:'#8C8C8C',fontWeight:700,borderBottom:'1px solid #ddd'},
    td:{padding:'5px 8px',borderBottom:'1px solid #eee',fontSize:10},
    tdRef:{padding:'5px 8px',borderBottom:'1px solid #eee',fontSize:9,fontFamily:'Courier New,monospace',color:'#00A3E0',fontWeight:600,width:'25%'},
    tdQty:{padding:'5px 8px',borderBottom:'1px solid #eee',textAlign:'center',fontWeight:900,color:'#3d3d3d',fontSize:12,width:'8%'},
    tdUnit:{padding:'5px 8px',borderBottom:'1px solid #eee',textAlign:'center',color:'#8C8C8C',width:'10%'},
    totalBar:{background:'#3d3d3d',color:'#fff',padding:'8px 14px',borderRadius:4,display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:12,marginTop:8},
    footer:{marginTop:20,paddingTop:10,borderTop:'2px solid #eee',display:'flex',justifyContent:'space-between',fontSize:8,color:'#8C8C8C'},
    remarques:{background:'#FFF8E1',border:'1px solid #FFE082',borderRadius:4,padding:'8px 12px',marginBottom:12,fontSize:10},
  };
  return (
    <div id="epj-pdf-content" style={S.page}>
      <div style={S.hdr}>
        <div style={S.logoArea}>
          <img src={EPJ_LOGO} alt="EPJ" style={{height:50,objectFit:"contain"}}/>
          
        </div>
        <div><div style={S.cmdNum}>{order.num}</div><div style={S.cmdDate}>{order.date}</div></div>
      </div>
      <div style={S.colorBar}/>
      {order.urgent && <div style={S.urgBanner}>⚠️ COMMANDE URGENTE</div>}
      <div style={S.infoGrid}>
        <div style={S.infoBox}><div style={S.label}>Demandeur</div><div style={S.val}>{order.user}</div><div style={{fontSize:9,color:'#8C8C8C'}}>{order.fonction}</div></div>
        {order.type==='chantier'
          ? <div style={S.infoBoxG}><div style={S.label}>Chantier — N°{ch?.num||''}</div><div style={S.val}>{order.chantier}</div><div style={{fontSize:9,color:'#8C8C8C'}}>{ch?.adresse||''}</div></div>
          : <div style={S.infoBoxG}><div style={S.label}>Destinataire</div><div style={S.val}>{order.salarie}</div></div>
        }
        <div style={S.infoBox}><div style={S.label}>Livraison</div><div style={S.val}>{order.livraison||'—'}</div></div>
        <div style={S.infoBox}><div style={S.label}>Date réception souhaitée</div><div style={S.val}>{order.dateReception||'Non précisée'}</div></div>
      </div>
      {order.remarques && <div style={S.remarques}><strong>📝 Remarques :</strong> {order.remarques}</div>}
      {Object.entries(byFourn).sort(([a],[b])=>a.localeCompare(b)).map(([code,items])=>(
        <div key={code}>
          <div style={S.fournHdr}>▸ {code} — {items.length} réf.</div>
          <table style={S.tbl}><thead><tr><th style={S.th}>Référence</th><th style={S.th}>Désignation</th><th style={{...S.th,textAlign:'center'}}>Qté</th><th style={{...S.th,textAlign:'center'}}>Unité</th></tr></thead>
          <tbody>{items.map(it=>(<tr key={it.r}><td style={S.tdRef}>{it.r}</td><td style={S.td}>{it.n}</td><td style={S.tdQty}>{it.qty}</td><td style={S.tdUnit}>{it.u||'Pièce'}</td></tr>))}</tbody></table>
        </div>
      ))}
      <div style={S.totalBar}><span>Total</span><span>{totalQty} articles — {items.length} références</span></div>
      <div style={S.footer}><div>EPJ — Électricité Générale<br/>Commande générée le {order.date}</div><div style={{textAlign:'right'}}>Document interne — {order.num}<br/>Statut : {order.statut}</div></div>
    </div>
  );
};

// ═══ MODULE COMMANDES ═══
export function CommandesInner({ onExitModule }) {
  const { user } = useAuth();
  // v10.H — smsTemplates pour SMS conducteur
  // v10.I — rolesConfig pour gardes UI propres via can()
  // v10.J — featureFlags.ocrArEnabled pour affichage date fournisseur (AR/BL)
  const { smsTemplates = [], rolesConfig = {}, featureFlags = {} } = useData();
  // Le Socle ne monte ce composant que si l'utilisateur est connecté.

  // Lot trio — bascule responsive (seuil 760, source unique useViewport).
  // PWA : rendu colonne historique (520) ; desktop : contenu élargi dans le
  // cadre 1320 du Layout (listes 1100, formulaires 720).
  const isPwa = useViewport() === "mobile";
  const wrapStyle = (max = 1100, extra = {}) => ({
    fontFamily: font, background: 'transparent', minHeight: '100vh',
    maxWidth: isPwa ? 520 : max, margin: '0 auto', ...extra,
  });

  // ─── v10.E — B2/B3 : Persistance du brouillon de commande ───
  // Avant, dès que l'iPhone se mettait en veille ou qu'on changeait d'app,
  // on perdait tout (panier, chantier sélectionné, type, etc.). Maintenant
  // on sauvegarde tout dans localStorage à chaque changement, sous une clé
  // dédiée à l'utilisateur courant (pour ne pas mélanger les brouillons
  // entre comptes sur un appareil partagé).
  const draftKey = `epj_commandes_draft_${user?.id || "_anon"}`;
  const loadDraft = () => {
    try {
      const raw = localStorage.getItem(draftKey);
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };
  const initialDraft = loadDraft() || {};

  // ⚠️ view démarre sur 'home' (page d'accueil du module Commandes).
  const [view, setView] = useState(() => {
    // v1.13.0 — Si le dashboard a posé un target_view, on l'ouvre directement
    // Whitelist stricte pour ne pas se retrouver bloqué sur une vue inconnue
    // ou corrompue dans le localStorage.
    const ALLOWED_TARGET_VIEWS = ["home", "history", "toOrder", "pending"];
    try {
      const target = localStorage.getItem("epj_commandes_target_view");
      localStorage.removeItem("epj_commandes_target_view");
      if (target && ALLOWED_TARGET_VIEWS.includes(target)) {
        return target;
      }
    } catch {}
    return 'home';
  });

  // v1.17.2 — Filet de sécurité : si on se retrouve sur une vue inaccessible
  // (ex: toOrder pour quelqu'un sans le droit), on rebascule sur home.
  // Utilise useEffect pour faire ça PROPREMENT (jamais pendant le render).
  useEffect(() => {
    if (view === "toOrder" && user && !canSeeToOrder()) {
      setView("home");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, user]);
  // ─── v10.G — Helper pour retour à l'accueil du module ───
  // Reset propre (vues, sélections temporaires) quand on clique sur le
  // bouton "← Commandes" du sub-header.
  const goToModuleHome = () => {
    setView('home');
    setSelectedCat(null); setSearch('');
    setAdminSection(null); setAdminEdit(null); setAdminForm({});
    setSelectedOrder(null);
  };
  const [cart, setCart] = useState(initialDraft.cart || {});
  const [selectedCat, setSelectedCat] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [orderType, setOrderType] = useState(initialDraft.orderType || "");
  const [chantier, setChantier] = useState(initialDraft.chantier || "");
  const [newChantier, setNewChantier] = useState("");
  const [showNewChantier, setShowNewChantier] = useState(false);
  const [targetSalarie, setTargetSalarie] = useState(initialDraft.targetSalarie || "");
  const [livraison, setLivraison] = useState(initialDraft.livraison || "Dépôt");
  const [urgent, setUrgent] = useState(!!initialDraft.urgent);
  const [dateReception, setDateReception] = useState(initialDraft.dateReception || "");
  const [remarques, setRemarques] = useState(initialDraft.remarques || "");
  const [extraEmail, setExtraEmail] = useState(initialDraft.extraEmail || "");
  const [diversName, setDiversName] = useState("");
  const [diversRef, setDiversRef] = useState("");
  const [diversQty, setDiversQty] = useState(1);
  const [showDivers, setShowDivers] = useState(false);
  const [history, setHistory] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [cmdCounter, setCmdCounter] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [historyFilter, setHistoryFilter] = useState({chantier:"",statut:""});
  const [refuseMotif, setRefuseMotif] = useState("");
  const [showRefuseModal, setShowRefuseModal] = useState(null);
  const [editingQty, setEditingQty] = useState(null);
  const [pdfOrder, setPdfOrder] = useState(null);
  const [fbLoading, setFbLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastSentOrder, setLastSentOrder] = useState(null);
  // ─── v10.D.2 — édition commande par conducteur avant validation ───
  // ─── v10.G.2 — étendu : édition commande déjà envoyée par demandeur/admin ─
  // Contient la commande en cours d'édition. Selon le contexte :
  //   - En v10.D.2 (validation par conducteur) : utilisé dans la vue 'validateEdit'
  //   - En v10.G.2 (édition par demandeur/admin) : initialisé via beginEditOrder()
  //     et utilisé dans les vues 'cart' et 'details' pour distinguer création vs édition.
  // Le booléen editingOrder.editMode === 'rework' indique le mode v10.G.2.
  const [editingOrder, setEditingOrder] = useState(null);
  const [editingItems, setEditingItems] = useState([]);

  // ─── v10.J — Réception inline pour commande type "chantier" ───
  // L'utilisateur clique "Réceptionner" dans le détail → état rec:{ orderId, mode, qties }
  // mode = "choice" | "detail"
  // qties = map { [itemIndex]: qty } pour le mode détail
  const [reception, setReception] = useState({ orderId: null, mode: "choice", qties: {} });

  // ─── DONNÉES DYNAMIQUES (chargées depuis Firestore ou fallback) ───
  // ─── DONNÉES DYNAMIQUES (chargées depuis Firestore) ───
  // v10.G : USERS et CHANTIERS ne sont plus en dur dans le code source.
  // Le state démarre vide ; les listeners Firestore (plus bas) vont le peupler.
  // CATALOG vient désormais de catalogSeed.js (qui ne sert plus que pour la
  // fonction "Réinitialiser Firebase" de l'admin).
  const [dynUsers, setDynUsers] = useState([]);
  const [dynChantiers, setDynChantiers] = useState([]);
  const [dynCatalog, setDynCatalog] = useState([]);
  const [dynCatIcons, setDynCatIcons] = useState(CAT_ICONS);
  const [dynEquipCats, setDynEquipCats] = useState(EQUIP_CATS);
  const [dynCatOrder, setDynCatOrder] = useState([]);
  const [receptionOrder, setReceptionOrder] = useState(null);
  const [dynEmailAchats, setDynEmailAchats] = useState(EMAIL_ACHATS);
  const [configLoaded, setConfigLoaded] = useState(false);

  // ─── ADMIN STATES ───
  const [adminSection, setAdminSection] = useState(null); // 'catalog','categories' (users/chantiers gérés par le Socle)
  const [adminEdit, setAdminEdit] = useState(null); // item being edited
  const [adminForm, setAdminForm] = useState({});
  const [adminSaving, setAdminSaving] = useState(false);
  const [artPhotoUploading, setArtPhotoUploading] = useState(null);
  const artFileInputLibraryRef = useRef(null);
  const artFileInputCameraRef = useRef(null);
  const [bulkSelected, setBulkSelected] = useState([]); // v10.G.1 : array de {c, r}
  const [bulkMode, setBulkMode] = useState(false);
  // v1.13.0 — modale passage partiel chez fournisseur
  const [partialPassOrder, setPartialPassOrder] = useState(null);

  // ─── FIREBASE : écoute temps réel des commandes ───
  useEffect(() => {
    const q = query(collection(db, "commandes"));
    const unsub = onSnapshot(q, (snap) => {
      const allOrders = snap.docs.map(d => ({ ...d.data(), _id: d.id }));
      console.log("Firebase: " + allOrders.length + " commande(s) chargée(s)");
      allOrders.sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
      setHistory(allOrders);
      setPendingOrders(allOrders.filter(o => o.statut === "En attente de validation"));
      setFbLoading(false);
    }, (err) => {
      console.error("Erreur Firestore commandes:", err);
      setFbLoading(false);
    });
    return () => unsub();
  }, []);

  // ─── FIREBASE : écoute temps réel des utilisateurs ───
  // v10.I — Fix bug recipientUserId : on injecte le doc ID Firestore comme `_id`
  // (et aussi `id` pour rétro-compatibilité avec le reste du code qui utilise u.id).
  // Avant v10.I, `snap.docs.map(d => d.data())` perdait l'UID, ce qui causait
  // le bug "Yver" dans le champ recipientUserId du doc smsQueue.
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "utilisateurs"), (snap) => {
      if (snap.size > 0) {
        setDynUsers(snap.docs.map(d => ({ ...d.data(), _id: d.id, id: d.data().id || d.id })));
        console.log("Firebase: " + snap.size + " utilisateur(s)");
      }
    });
    return () => unsub();
  }, []);

  // ─── v10.I — Purge périodique de smsQueue (docs déjà envoyés par Make) ───
  // Contexte : Make ne supprime pas les docs après envoi (problème path
  // Firestore côté Make). On nettoie nous-mêmes : au montage + toutes les 5 min.
  // Make doit passer `status: "sent"` pour qu'on identifie les docs à purger.
  useEffect(() => {
    deleteSentSmsQueueDocs(); // au montage
    const itv = setInterval(() => { deleteSentSmsQueueDocs(); }, 5 * 60 * 1000);
    return () => clearInterval(itv);
  }, []);

  // ─── FIREBASE : écoute temps réel des chantiers ───
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "chantiers"), (snap) => {
      if (snap.size > 0) {
        setDynChantiers(snap.docs.map(d => d.data()));
        console.log("Firebase: " + snap.size + " chantier(s)");
      }
    });
    return () => unsub();
  }, []);

  // ─── FIREBASE : écoute temps réel du catalogue ───
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "catalogue"), (snap) => {
      if (snap.size > 0) {
        setDynCatalog(snap.docs.map(d => d.data()));
        console.log("Firebase: " + snap.size + " article(s) catalogue");
      }
    });
    return () => unsub();
  }, []);

  // ─── FIREBASE : config (email, catégories équipement, icônes) ───
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "settings"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if(d.emailAchats) setDynEmailAchats(d.emailAchats);
        if(d.equipCategories) setDynEquipCats(d.equipCategories);
        if(d.catIcons) setDynCatIcons(d.catIcons);
        if(d.catOrder) setDynCatOrder(d.catOrder);
      }
      setConfigLoaded(true); // toujours marquer comme chargé, même si pas de catOrder
    });
    return () => unsub();
  }, []);

  // ─── FIREBASE : compteur de commandes auto-incrémenté ───
  useEffect(() => {
    const loadCounter = async () => {
      try {
        const ref = doc(db, "config", "compteur");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setCmdCounter(snap.data().value || 1);
        } else {
          await setDoc(ref, { value: 1 });
        }
      } catch(e) { console.error("Erreur compteur:", e); }
    };
    loadCounter();
  }, []);

  const cartHasItems = Object.values(cart).some(q=>q>0);
  const isCartLocked = cartHasItems && orderType !== "";

  // Selected chantier object (for n° affaire)
  const selectedChantierObj = useMemo(() => dynChantiers.find(c=>c.nom===chantier), [chantier, dynChantiers]);

  const allCategories = useMemo(() => [...new Set(dynCatalog.map(p=>p.c))], [dynCatalog]);
  const availableCategories = useMemo(() => {
    if (orderType==="equipement") {
      // Only show equip cats that actually exist in catalog
      return dynEquipCats.filter(c => allCategories.includes(c));
    }
    const cats = allCategories.filter(c => !dynEquipCats.includes(c));
    if (dynCatOrder.length > 0) {
      return [...cats].sort((a,b) => {
        const ia = dynCatOrder.indexOf(a); const ib = dynCatOrder.indexOf(b);
        if(ia===-1 && ib===-1) return a.localeCompare(b);
        if(ia===-1) return 1; if(ib===-1) return -1;
        return ia - ib;
      });
    }
    return cats;
  }, [orderType, allCategories, dynEquipCats, dynCatOrder]);

  const filteredProducts = useMemo(() => {
    let items = dynCatalog;
    if (orderType==="equipement") items = items.filter(p=>dynEquipCats.includes(p.c));
    if (selectedCat) items = items.filter(p=>p.c===selectedCat);
    if (search.trim()) { const q=search.toLowerCase(); items=items.filter(p=>p.n.toLowerCase().includes(q)||p.r.toLowerCase().includes(q)||p.s.toLowerCase().includes(q)); }
    return items;
  }, [selectedCat, search, orderType, dynCatalog, dynEquipCats]);

  const grouped = useMemo(() => {
    const g = {};
    filteredProducts.forEach(p => { const k = selectedCat ? p.s : p.c; if(!g[k]) g[k]=[]; g[k].push(p); });
    return g;
  }, [filteredProducts, selectedCat]);

  const cartItems = useMemo(() => Object.entries(cart).filter(([,q])=>q>0).map(([r,q])=>{const p=dynCatalog.find(x=>x.r===r);return p?{...p,qty:q}:null}).filter(Boolean), [cart, dynCatalog]);
  const cartCount = cartItems.reduce((s,i)=>s+i.qty, 0);

  const pendingCount = useMemo(() => {
    if(!user) return 0;
    if(user.fonction==="Admin") return pendingOrders.length;
    const fullName = `${user.prenom} ${user.nom}`;
    return pendingOrders.filter(o => {
      const ch = dynChantiers.find(c=>c.nom===o.chantier);
      return ch && ch.conducteur===fullName;
    }).length;
  }, [user, pendingOrders]);

  // v10.E — B4-bis : compteur Historique filtré par user (pas le total global).
  // Avant, l'Admin voyait "5 commandes" alors qu'aucune ne le concernait.
  // Maintenant on applique exactement la même logique que la vue Historique :
  //   • Admin → voit tout (logique préservée pour la rétrocompat)
  //   • Conducteur → voit les commandes de ses chantiers + celles qu'il a passées
  //   • Autres → uniquement ses propres commandes
  // v1.12.1 — Fix : utilise can(user,"commandes","view") au lieu de
  // tests fragiles sur user.fonction (qui ratait "Direction", "Achat",
  // et "Conducteur de travaux" avec le "de" en plus).
  // Scopes possibles retournés par can() :
  //   "all"            → voit tout (Admin, Direction, Achat)
  //   "own_chantiers"  → voit les commandes des chantiers où il/elle est
  //                      conducteur, + celles qu'il/elle a passées (CdT, CdC)
  //   "own_items"      → voit uniquement ses propres commandes (Monteur, Artisan)
  const myHistoryCount = useMemo(() => {
    if(!user) return 0;
    const fullName = `${user.prenom} ${user.nom}`;
    // v1.17.3 — Exclure aussi les reliquats "-2" du compteur de l'historique
    const safe = (history || []).filter(h =>
      h && h.num &&
      h.statut !== "Scindée" &&
      !(h.createdBySplit === true && h.statut === "Envoyée aux achats") &&
      // Reliquat "-2" parqué : masqué tant qu'il est dans "À commander" (Validée).
      // Dès qu'il est commandé (→ Envoyée aux achats / Commandée), il réapparaît.
      !(h.createdBySplit === true && h.commanderPlusTard === true && h.statut === "Validée")
    );
    const scope = can(user, "commandes", "view", rolesConfig);
    if (scope === "all") {
      return safe.length;
    }
    if (scope === "own_chantiers") {
      const mesChantiers = dynChantiers.filter(c => c.conducteur === fullName).map(c => c.nom);
      return safe.filter(h => mesChantiers.includes(h.chantier) || h.user === fullName).length;
    }
    if (scope === "own_items") {
      return safe.filter(h => h.userId === user.id || h.user === fullName).length;
    }
    // scope === false ou undefined → aucune visibilité
    return 0;
  }, [user, history, dynChantiers, rolesConfig]);

  // ─── v10.I — Fix 2 : peut marquer "Commandée" ? ───
  // Réservé à Admin + Direction + Assistante (décision Pierre-Julien Q2=1).
  // v1.13.0 : + Achat
  // Implémenté via les rôles plutôt que via can() car c'est une action métier
  // très spécifique (= "passer la commande chez le fournisseur") qui n'est pas
  // bien capturée par les 6 actions génériques view/create/edit/delete/validate/export.
  // Définie ICI (avant toOrderCount) pour être disponible dès le premier useMemo.
  const canMarkAsCommandee = () => {
    if (!user) return false;
    const roles = Array.isArray(user.roles) ? user.roles
                : (user.role ? [user.role] : []);
    const fonction = user.fonction || "";
    if (roles.includes("Admin") || fonction === "Admin") return true;
    if (roles.includes("Direction") || fonction === "Direction") return true;
    if (roles.includes("Achat") || fonction === "Achat") return true;
    if (roles.some(r => (r||"").toLowerCase().includes("assist"))) return true;
    if ((fonction||"").toLowerCase().includes("assist")) return true;
    return false;
  };

  // v1.17.2 — Peut VOIR la carte "À commander" ?
  // Plus large que canMarkAsCommandee : inclut aussi les Conducteurs travaux,
  // Chefs de chantier, et tout user avec directAchat=true (qui passent leurs
  // propres commandes en direct). Ils ne voient QUE leur scope (own_chantiers
  // ou own_items), pas toutes les commandes.
  const canSeeToOrder = () => {
    if (!user) return false;
    if (canMarkAsCommandee()) return true; // Admin/Direction/Achat/Assistante
    if (user.directAchat === true) return true; // CdT/CdC avec directAchat
    const roles = Array.isArray(user.roles) ? user.roles
                : (user.role ? [user.role] : []);
    if (roles.includes("Conducteur travaux")) return true;
    if (roles.includes("Chef chantier")) return true;
    return false;
  };

  // v1.17.2 — Compteur "À commander" élargi
  // Admin/Direction/Achat/Assistante voient TOUT
  // Conducteur travaux / Chef chantier / users directAchat voient
  // uniquement leurs commandes (own_chantiers ou own_items)
  const toOrderCount = useMemo(() => {
    if (!user || !canSeeToOrder()) return 0;
    const fullName = `${user.prenom} ${user.nom}`;
    const baseFilter = (h) => h && h.num && (
      h.statut === "Validée" ||
      h.statut === "Envoyée aux achats" ||
      h.statut === "Commandée partiellement"
    );
    const safe = (history || []).filter(baseFilter);

    // Si admin/direction/achat/assistante → tout
    if (canMarkAsCommandee()) return safe.length;

    // Sinon on filtre par scope
    const scope = can(user, "commandes", "view", rolesConfig);
    if (scope === "all") return safe.length;
    if (scope === "own_chantiers") {
      const mesChantiers = dynChantiers.filter(c => c.conducteur === fullName).map(c => c.nom);
      return safe.filter(h => mesChantiers.includes(h.chantier) || h.user === fullName).length;
    }
    if (scope === "own_items") {
      return safe.filter(h => h.userId === user.id || h.user === fullName).length;
    }
    return 0;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, history, dynChantiers, rolesConfig]);

  const showT = (m) => { setToast(m); setTimeout(()=>setToast(null), 1800); };
  const addToCart = (r) => { setCart(p=>({...p,[r]:(p[r]||0)+1})); showT("✓ Ajouté"); };
  const updateQty = (r, q) => { const v=Math.max(0,parseInt(q)||0); if(v<=0) setCart(p=>{const n={...p};delete n[r];return n;}); else setCart(p=>({...p,[r]:v})); };

  // doLogin / logout : gérés en amont par le Socle (AuthContext).
  // v1.17.5 — Génération du numéro de commande depuis l'historique Firestore.
  //
  // Avant : on lisait config/compteur en base + on faisait setDoc pour
  // l'incrémenter à chaque envoi. Problème : les règles Firestore rejettent
  // l'écriture sur config/compteur pour les users non-admin. Conséquence :
  //   - setDoc plantait après l'addDoc de la commande
  //   - sendOrder tombait dans son catch
  //   - setView("done") n'était JAMAIS atteint
  //   - la page restait bloquée sur l'écran de finalisation
  //   - et le même compteur restait utilisé → DOUBLONS de numéros
  // Maintenant : on calcule le numéro à la volée depuis le max des CMD-YYYY-NNNN
  // déjà en base (historique chargé via onSnapshot). Plus aucune dépendance à
  // config/compteur côté code. Le doc en base est conservé pour rétrocompat
  // mais on l'écrit dans son propre try/catch (cf. sendOrder).
  // Helper sync : max séquence CMD pour une année donnée depuis history.
  // Ignore les suffixes -1 / -2 / -1-1 (commandes scindées ne consomment pas de num).
  const computeMaxCmdSeqForYear = (hist, year) => {
    const prefix = `CMD-${year}-`;
    let max = 0;
    (hist || []).forEach(h => {
      const num = h?.num || "";
      if (!num.startsWith(prefix)) return;
      const afterPrefix = num.slice(prefix.length); // "0053" ou "0053-1"
      const baseNumStr = afterPrefix.split("-")[0]; // "0053"
      const n = parseInt(baseNumStr, 10);
      if (!isNaN(n) && n > max) max = n;
    });
    return max;
  };
  const computeNextCmdNum = () => {
    const year = new Date().getFullYear();
    const max = computeMaxCmdSeqForYear(history, year);
    // Filet de sécurité : on prend aussi en compte cmdCounter (au cas où
    // history n'a pas encore été synchronisé par onSnapshot au démarrage).
    const next = Math.max(max + 1, cmdCounter);
    return `CMD-${year}-${String(next).padStart(4, "0")}`;
  };
  const numCmd = () => computeNextCmdNum();

  // v2.0.1 — Génération atomique du numéro de commande via runTransaction.
  // Garantit l'unicité même en cas d'envois simultanés. Self-init depuis
  // history au tout premier appel (zéro action manuelle post-déploiement).
  // Rollover d'année automatique (year !== currentYear → reset lastSeq=1).
  const reserveNextCmdNum = async () => {
    const currentYear = new Date().getFullYear();
    const maxFromHistory = computeMaxCmdSeqForYear(history, currentYear);
    return await runTransaction(db, async (tx) => {
      const counterRef = doc(db, "config", "counters");
      const snap = await tx.get(counterRef);
      let newSeq;
      if (!snap.exists() || !snap.data()?.commandes) {
        newSeq = maxFromHistory + 1;
      } else {
        const storedYear = snap.data().commandes.year;
        const lastSeq = snap.data().commandes.lastSeq || 0;
        newSeq = (storedYear !== currentYear) ? 1 : lastSeq + 1;
      }
      tx.set(counterRef, {
        commandes: { year: currentYear, lastSeq: newSeq },
      }, { merge: true });
      return `CMD-${currentYear}-${String(newSeq).padStart(4, "0")}`;
    });
  };
  const clearOrder = () => {
    setCart({});setOrderType("");setChantier("");setNewChantier("");setShowNewChantier(false);
    setTargetSalarie("");setUrgent(false);setDateReception("");setRemarques("");setExtraEmail("");
    setSelectedCat(null);setSearch("");setSending(false);
    // v10.E — vider le brouillon localStorage à la fin d'une commande envoyée
    try { localStorage.removeItem(draftKey); } catch {}
  };

  // ─── v10.E — B2/B3 : sauvegarde automatique du brouillon à chaque change ───
  useEffect(() => {
    try {
      const hasContent = Object.keys(cart).length > 0 || orderType || chantier || targetSalarie || remarques;
      if (!hasContent) {
        // Rien dans le brouillon → on supprime la clé pour éviter les vieilles entrées
        localStorage.removeItem(draftKey);
        return;
      }
      const draft = {
        cart, orderType, chantier, targetSalarie, livraison, urgent,
        dateReception, remarques, extraEmail,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    } catch {}
  }, [cart, orderType, chantier, targetSalarie, livraison, urgent, dateReception, remarques, extraEmail, draftKey]);

  // ─── Générer PDF (ouvre dans un nouvel onglet pour téléchargement/impression) ───
  const EPJ_LOGO_B64 = "data:image/png;base64,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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z";

  const generateAndOpenPdf = (order) => {
    const ch = order.chantierObj || {num:order.chantierNum||order.numAffaire, nom:order.chantierNom||order.chantier, adresse:order.chantierAdresse||'', conducteur:order.chantierConducteur||''};
    const items = order.items || [];
    const byFourn = {};
    items.forEach(it => { const c = (it.r||'').split(' ')[0].substring(0,3).toUpperCase(); if(!byFourn[c]) byFourn[c]=[]; byFourn[c].push(it); });
    const totalQty = items.reduce((s,i)=>s+(i.qty||0),0);
    let rows = '';
    Object.entries(byFourn).sort(([a],[b])=>a.localeCompare(b)).forEach(([code,fitems])=>{
      rows += `<tr><td colspan="4" style="background:#00A3E0;color:#fff;padding:6px 12px;font-weight:700;font-size:11px">\u25b8 ${code} \u2014 ${fitems.length} r\u00e9f.</td></tr>`;
      fitems.forEach(it => {
        rows += `<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;font-family:monospace;color:#00A3E0;font-weight:600;font-size:9px">${it.r||''}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:10px">${it.n||''}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center;font-weight:900;font-size:12px">${it.qty||0}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center;color:#8C8C8C;font-size:9px">${it.u||'Pi\u00e8ce'}</td></tr>`;
      });
    });
    const sigBlock = order.signatureData ? `<div style="margin-top:16px;border:2px solid #3d3d3d;border-radius:8px;padding:12px;page-break-inside:avoid"><div style="font-size:10px;font-weight:700;margin-bottom:4px">\u270d\ufe0f Signature : ${order.salarie||order.user}</div><div style="font-size:9px;color:#388E3C;margin-bottom:6px">\u2705 R\u00e9ceptionn\u00e9e le ${order.dateReceptionEffective||order.date}</div><img src="${order.signatureData}" style="width:100%;max-height:70px;object-fit:contain;background:#fff"/></div>` : '';
    const logoB64 = EPJ_LOGO_B64;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${order.num} \u2014 EPJ</title>
    <style>
      * { box-sizing:border-box; margin:0; padding:0; }
      @media print { .no-print { display:none !important } @page { size:A4; margin:0 } }
      html, body { background:#f4f5f7; }
      body { font-family:Arial,sans-serif;color:#3d3d3d;font-size:10px;padding:8mm 0; }
      /* v10.E - C1 : largeur fixe = 190mm = largeur utile A4 (210mm - 2x10mm de marge).
         html2canvas capture cette largeur EXACTE → ratio préservé dans le PDF final. */
      #pdf-page {
        width: 190mm;
        margin: 0 auto;
        padding: 6mm 8mm;
        background: #fff;
        box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      }
      table { width:100%;border-collapse:collapse }
      .dl-btn { display:block;width:190mm;max-width:100%;margin:14px auto 8px;padding:14px;background:linear-gradient(135deg,#00A3E0,#A8C536);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;text-align:center;box-sizing:border-box }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
    </head><body>
    <div id="pdf-page">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:3px solid #00A3E0;margin-bottom:10px">
      <img src="${logoB64}" style="height:50px;object-fit:contain;background:#3d3d3d;padding:4px 8px;border-radius:6px"/>
      <div style="text-align:right"><div style="font-size:18px;font-weight:900;color:#00A3E0">${order.num}</div><div style="font-size:9px;color:#8C8C8C">${order.date}</div><div style="font-size:9px;color:#8C8C8C">Statut : ${order.statut}</div></div>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,#00A3E0,#A8C536,#F5841F);margin-bottom:10px"></div>
    ${order.urgent?'<div style="background:#E53935;color:#fff;padding:5px 10px;font-weight:900;text-align:center;border-radius:4px;margin-bottom:8px;font-size:10px">\u26a0\ufe0f COMMANDE URGENTE</div>':''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div style="background:#f8f9fa;border-radius:5px;padding:7px 9px;border-left:3px solid #00A3E0"><div style="font-size:7px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Demandeur</div><div style="font-size:11px;font-weight:700">${order.user}</div><div style="font-size:8px;color:#8C8C8C">${order.fonction||''}</div></div>
      ${order.type==='chantier'
        ?`<div style="background:#f8f9fa;border-radius:5px;padding:7px 9px;border-left:3px solid #A8C536"><div style="font-size:7px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Chantier \u2014 N\u00b0${ch?.num||''}</div><div style="font-size:11px;font-weight:700">${order.chantier||''}</div><div style="font-size:8px;color:#8C8C8C">${ch?.adresse||''}</div></div>`
        :`<div style="background:#f8f9fa;border-radius:5px;padding:7px 9px;border-left:3px solid #A8C536"><div style="font-size:7px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Destinataire</div><div style="font-size:11px;font-weight:700">${order.salarie||''}</div></div>`}
      <div style="background:#f8f9fa;border-radius:5px;padding:7px 9px;border-left:3px solid #00A3E0"><div style="font-size:7px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Livraison</div><div style="font-size:11px;font-weight:700">${order.livraison||'\u2014'}</div></div>
      <div style="background:#f8f9fa;border-radius:5px;padding:7px 9px;border-left:3px solid #00A3E0"><div style="font-size:7px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Date r\u00e9ception</div><div style="font-size:11px;font-weight:700">${order.dateReception||'Non pr\u00e9cis\u00e9e'}</div></div>
    </div>
    ${order.remarques?`<div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:4px;padding:6px 9px;margin-bottom:8px;font-size:9px"><strong>Remarques :</strong> ${order.remarques}</div>`:''}
    <table><thead><tr>
      <th style="background:#f0f1f3;padding:4px 7px;text-align:left;font-size:7px;text-transform:uppercase;color:#8C8C8C;border-bottom:1px solid #ddd">R\u00e9f\u00e9rence</th>
      <th style="background:#f0f1f3;padding:4px 7px;text-align:left;font-size:7px;text-transform:uppercase;color:#8C8C8C;border-bottom:1px solid #ddd">D\u00e9signation</th>
      <th style="background:#f0f1f3;padding:4px 7px;text-align:center;font-size:7px;text-transform:uppercase;color:#8C8C8C;border-bottom:1px solid #ddd">Qt\u00e9</th>
      <th style="background:#f0f1f3;padding:4px 7px;text-align:center;font-size:7px;text-transform:uppercase;color:#8C8C8C;border-bottom:1px solid #ddd">Unit\u00e9</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div style="background:#3d3d3d;color:#fff;padding:7px 10px;border-radius:4px;display:flex;justify-content:space-between;font-weight:700;font-size:10px;margin-top:5px"><span>Total</span><span>${totalQty} articles \u2014 ${items.length} r\u00e9f\u00e9rences</span></div>
    ${sigBlock}
    <div style="margin-top:12px;padding-top:6px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:7px;color:#8C8C8C"><div>EPJ \u2014 \u00c9lectricit\u00e9 G\u00e9n\u00e9rale \u2022 Saint-\u00c9gr\u00e8ve, Is\u00e8re</div><div style="text-align:right">Document interne \u2014 ${order.num}</div></div>
    </div><!-- /#pdf-page -->
    <div class="no-print">
      <button class="dl-btn" id="dlbtn" onclick="doDownload()">\ud83d\udce5 T\u00e9l\u00e9charger le PDF (A4)</button>
      <div id="dlmsg" style="text-align:center;margin-top:8px;font-size:12px;color:#2E7D32;font-weight:700;display:none">\u2705 PDF t\u00e9l\u00e9charg\u00e9 !</div>
    </div>
    <script>
    async function doDownload(){
      const btn=document.getElementById('dlbtn');
      const msg=document.getElementById('dlmsg');
      btn.textContent='\u23f3 G\u00e9n\u00e9ration...';btn.disabled=true;
      try{
        const el=document.getElementById('pdf-page');
        // v10.E - C1 : on capture le wrapper #pdf-page (190mm de large) à scale 2.
        // Le ratio de l'image correspond donc EXACTEMENT au ratio que l'on
        // doit afficher dans la zone utile A4 (190mm de large).
        const canvas=await html2canvas(el,{scale:2,useCORS:true,backgroundColor:'#ffffff'});
        const {jsPDF}=window.jspdf;
        const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
        const pW=pdf.internal.pageSize.getWidth();   // 210mm
        const pH=pdf.internal.pageSize.getHeight();  // 297mm
        const margin=10;                              // 10mm de marge gauche/droite/haut/bas
        const imgW=pW-margin*2;                       // 190mm de large utile (= largeur capturée)
        const imgH=imgW*(canvas.height/canvas.width); // hauteur totale image en mm
        const usableH=pH-margin*2;                    // 277mm utiles par page

        let y=0;
        while(y<imgH){
          const sliceH=Math.min(usableH,imgH-y);
          const sc=document.createElement('canvas');
          const scale=canvas.width/imgW;
          sc.width=canvas.width;
          sc.height=Math.round(sliceH*scale);
          const ctx=sc.getContext('2d');
          ctx.drawImage(canvas,0,Math.round(y*scale),canvas.width,sc.height,0,0,canvas.width,sc.height);
          if(y>0) pdf.addPage();
          pdf.addImage(sc.toDataURL('image/png'),'PNG',margin,margin,imgW,sliceH);
          y+=sliceH;
        }
        pdf.save('${order.num}_EPJ_${order.date.replace(/\//g,"-")}.pdf');
        btn.textContent='\u2705 T\u00e9l\u00e9charg\u00e9 !';
        msg.style.display='block';
      }catch(e){
        btn.textContent='\u274c Erreur - r\u00e9essayez';
        btn.disabled=false;
        console.error(e);
      }
    }
    <\/script>
    </body></html>`;
    const w = window.open('', '_blank');
    if(w) { w.document.write(html); w.document.close(); }
    else { showT("\u26a0\ufe0f Autorisez les popups pour g\u00e9n\u00e9rer le PDF"); }
  };

  const openReceptionSheet = (order) => {
    if(order.signatureData) { showT("✅ Déjà réceptionnée"); return; }
    setReceptionOrder(order);
    setView('reception');
  };

  const sendOrder = async () => {
    if(sending) return;
    setSending(true);

    // ─── v10.G.2 — Mode édition (rework) d'une commande existante ─────
    // Si editingOrder est en mode 'rework', on n'appelle pas addDoc (sinon
    // on créerait une nouvelle commande), on appelle saveEditedOrder() qui
    // fait un updateDoc sur le doc Firestore existant.
    if (editingOrder && editingOrder.editMode === 'rework') {
      try {
        const newCartItems = cartItems.map(it=>({
          r:it.r, n:it.n, c:it.c, s:it.s, u:it.u||'Pièce',
          qty:parseInt(it.qty)||1, img:it.img||''
        }));
        const newOrderData = {
          urgent, dateReception, remarques, extraEmail,
        };
        const updated = await saveEditedOrder(newCartItems, newOrderData);
        if (!updated) { setSending(false); return; }

        setLastSentOrder(updated);
        setPdfOrder(updated);

        // Reset propre du panier et du draft
        try {
          setCart({});
          setOrderType("");
          setChantier(""); setNewChantier(""); setShowNewChantier(false);
          setTargetSalarie("");
          setUrgent(false); setDateReception(""); setRemarques(""); setExtraEmail("");
          setSelectedCat(null); setSearch("");
          if (typeof draftKey === "string" && draftKey) {
            localStorage.removeItem(draftKey);
          }
        } catch(e) { console.warn("v10.G.2: clear panier post-édition échoué (non bloquant):", e); }

        // Sortir du mode édition
        const wasSent = editingOrder._originalStatut === "Envoyée aux achats";
        setEditingOrder(null);

        setSending(false);
        setView("done");
        if (wasSent) {
          showT(`✏️ Commande modifiée — la Direction est notifiée (achats à re-prévenir)`);
        } else {
          showT(`✏️ Commande modifiée${updated.statut === "En attente de validation" ? " — repassée en validation" : ""}`);
        }
      } catch(err) {
        console.error("Erreur sauvegarde édition:", err);
        setSending(false);
        showT("❌ Erreur : " + (err.message||"vérifiez votre connexion"));
      }
      return;
    }

    // ─── Mode normal : création d'une nouvelle commande ────────────────
    const cmd = await reserveNextCmdNum();
    const chObj = selectedChantierObj;
    const needsValidation = orderType==='chantier' && !user.directAchat;
    const statut = needsValidation ? "En attente de validation" : "Envoyée aux achats";
    const orderData = {
      num:cmd, date:new Date().toLocaleDateString('fr-FR'), type:orderType,
      items: cartItems.map(it=>({r:it.r, n:it.n, c:it.c, s:it.s, u:it.u||'Pièce', qty:parseInt(it.qty)||1, img:it.img||''})),
      user:`${user.prenom} ${user.nom}`, userId:user.id, fonction:user.fonction,
      chantier:orderType==='chantier'?(showNewChantier?newChantier:chantier):'',
      chantierNom:chObj?.nom||'', chantierNum:chObj?.num||'', chantierAdresse:chObj?.adresse||'', chantierConducteur:chObj?.conducteur||'',
      numAffaire:chObj?.num||'',
      salarie:targetSalarie||`${user.prenom} ${user.nom}`,
      urgent, livraison, remarques, dateReception, statut, extraEmail, motifRefus:"",
      createdAt: new Date().toISOString()
    };

    try {
      const docRef = await addDoc(collection(db, "commandes"), orderData);
      const newCount = cmdCounter + 1;
      setCmdCounter(newCount);
      // v1.17.5 — setDoc dans son propre try/catch.
      // Les règles Firestore rejettent l'écriture sur config/compteur pour
      // les users non-admin → ça plantait sendOrder et bloquait setView("done").
      // Maintenant, si ça échoue, on s'en moque : le numéro de commande est
      // calculé à la volée depuis l'historique (computeNextCmdNum), donc
      // config/compteur est purement informatif (rétrocompat).
      try {
        await setDoc(doc(db, "config", "compteur"), { value: newCount });
      } catch (compteurErr) {
        console.warn("[v1.17.5] setDoc config/compteur non bloquant (rules):", compteurErr?.message || compteurErr);
      }

      // ─── v10.H — SMS conducteur si la commande nécessite validation ───
      // Règle : on n'envoie un SMS QUE si needsValidation === true (= demandeur
      // sans directAchat, sur un chantier). Si admin/direction crée une commande
      // (directAchat=true), pas de SMS car pas besoin de validation.
      if (needsValidation && chObj && orderType === 'chantier') {
        try {
          const conducteur = findConducteur(chObj, dynUsers);
          if (conducteur) {
            const result = await smsCommandeCreee({
              smsTemplates: smsTemplates || [],
              conducteur,
              demandeurNom: `${user.prenom} ${user.nom}`,
              numCmd: cmd,
              chantier: chObj.nom || orderData.chantier,
              orderId: docRef.id,
            });
            if (!result.queued) {
              console.warn("[v10.H] SMS conducteur non envoyé:", result.reason);
            }
          } else {
            console.warn("[v10.H] Conducteur introuvable pour le chantier", chObj.nom);
          }
        } catch(smsErr) {
          // Erreur SMS non bloquante : la commande est créée, c'est l'essentiel
          console.warn("[v10.H] Échec queueing SMS conducteur (non bloquant):", smsErr);
        }
      }

      const localOrder = {...orderData, chantierObj:chObj, _id: docRef.id};
      setLastSentOrder(localOrder);
      if(!needsValidation) { setPdfOrder(localOrder); }

      // ─── v10.G — BUG FIX panier (Frasca / CMD-2026-0028) ───
      // Avant : le panier n'était vidé QUE si l'utilisateur cliquait
      // "🏠 Nouvelle commande" sur l'écran de confirmation. S'il fermait
      // l'app ou faisait "← retour", le panier restait plein dans
      // localStorage et pouvait être ré-envoyé en doublon.
      // Maintenant : on vide le panier + le brouillon localStorage dès que
      // la commande est enregistrée avec succès dans Firestore. On conserve
      // lastSentOrder + pdfOrder pour l'écran de confirmation (qui les
      // utilise via lastSentOrder.items, pas via le state cart).
      try {
        setCart({});
        setOrderType("");
        setChantier(""); setNewChantier(""); setShowNewChantier(false);
        setTargetSalarie("");
        setUrgent(false); setDateReception(""); setRemarques(""); setExtraEmail("");
        setSelectedCat(null); setSearch("");
        if (typeof draftKey === "string" && draftKey) {
          localStorage.removeItem(draftKey);
        }
      } catch(e) {
        console.warn("v10.G: clear panier post-envoi a échoué (non bloquant):", e);
      }
      // ─── fin BUG FIX panier ───

      setSending(false);
      setView("done");
      showT(needsValidation ? "📤 Commande soumise !" : "✅ Commande enregistrée !");
    } catch(err) {
      console.error("Erreur envoi commande:", err);
      setSending(false);
      showT("❌ Erreur : " + (err.message||"vérifiez votre connexion"));
    }
  };

  // ═══════════════════════════════════════════════════════════
  // v10.D.2 — REFONTE du workflow de validation commande
  //
  // Avant : clic "Valider" → passe direct "Validée" → écran confirmation
  //         avec lien mailto (mais statut déjà changé même si mail pas envoyé)
  //
  // Maintenant :
  //   1. Clic "Valider" → ouvre écran ÉDITION (modifier qté/refs si besoin)
  //   2. Sur l'écran édition, 2 boutons :
  //      - "✅ Valider et envoyer maintenant" → passe "Validée" + ouvre mail
  //        (le statut passera "Envoyée aux achats" SEULEMENT si on clique l'envoi)
  //      - "💾 Valider (envoyer plus tard)" → passe "Validée" tout court
  //   3. Dans l'historique :
  //      - Validées pas encore envoyées : bouton "🔄 Envoyer aux achats"
  //      - Envoyées pas encore reçues fournisseur : bouton "🛒 Marquer commandée"
  // ═══════════════════════════════════════════════════════════

  // Ouvre l'écran d'édition avec les données de la commande
  const openValidateEdit = (orderNum) => {
    const order = pendingOrders.find(o=>o.num===orderNum);
    if(!order) return;
    setEditingOrder(order);
    setEditingItems((order.items || []).map(it => ({...it}))); // clone
    setView('validateEdit');
  };

  // "Valider" : juste passer en statut "Validée" (sans envoyer)
  // + enregistrer les items modifiés si applicable
  const saveValidatedOrder = async (sendImmediately = false) => {
    if (!editingOrder || !editingOrder._id) return null;
    try {
      const payload = {
        statut: "Validée",
        items: editingItems,
        validePar: `${user.prenom || ""} ${user.nom || ""}`.trim(),
        dateValidation: new Date().toISOString(),
      };
      await updateDoc(doc(db, "commandes", editingOrder._id), payload);
      const updated = {...editingOrder, ...payload};
      setPdfOrder(updated);
      setLastSentOrder(updated);
      showT(sendImmediately ? "✅ Validée — envoi du mail..." : "💾 Validée — à envoyer plus tard");
      // v10.I — SMS à l'assistante achats : "nouvelle commande à traiter"
      try {
        const assistante = findAssistanteAchats(dynUsers);
        if (assistante) {
          await smsCommandeValidee({
            smsTemplates,
            assistante,
            validateurNom: `${user.prenom||""} ${user.nom||""}`.trim(),
            numCmd: editingOrder.num,
            chantier: editingOrder.chantier || "",
            orderId: editingOrder._id,
          });
        } else {
          console.warn("[v10.I] Aucune assistante achats trouvée — SMS validation non envoyé");
        }
      } catch(smsErr) {
        console.warn("[v10.I] SMS validation non bloquant:", smsErr);
      }
      return updated;
    } catch(err) {
      console.error("Erreur validation:", err);
      showT("❌ Erreur — réessayez");
      return null;
    }
  };

  // ═══════════════════════════════════════════════════════════
  // v10.G.2 — Édition d'une commande déjà envoyée
  // ═══════════════════════════════════════════════════════════
  // Conditions pour pouvoir éditer (vérifiées dans canEditOrder ci-dessous) :
  //   - Statut ∈ {En attente de validation, Validée, Envoyée aux achats}
  //   - User est le demandeur OU est Admin/Direction
  //
  // Mécanique :
  //   1. beginEditOrder(o) charge la commande dans le panier (cart, orderType,
  //      chantier, etc.) et marque editingOrder.editMode='rework'
  //   2. L'utilisateur modifie via les écrans cart/details normaux
  //   3. Au submit, on détecte editingOrder.editMode==='rework' et on fait
  //      updateDoc au lieu de addDoc + on ajoute une entrée dans editHistory
  //   4. Si l'utilisateur a directAchat=false → la commande repasse en
  //      "En attente de validation" (le conducteur revalidera)
  //      Si directAchat=true → on garde le statut courant
  //   5. Si le statut avant édition était "Envoyée aux achats", on note dans
  //      le toast et la trace que les achats devront être re-prévenus
  //      (la Direction reçoit l'info via le statut qui repasse en "Validée"
  //      → bannière "À envoyer aux achats" ré-apparaît côté Direction)

  const canEditOrder = (o) => {
    if (!o || !user) return false;
    // Statut bloquant (v10.J — ajout "Réceptionnée partiellement")
    if (o.statut === "Commandée" || o.statut === "Réceptionnée"
        || o.statut === "Réceptionnée partiellement"
        || o.statut === "Refusée") return false;
    // Demandeur lui-même OU Admin/Direction
    const isOwner = o.user === `${user.prenom} ${user.nom}`.trim();
    const isDirectionOrAdmin = user.fonction === "Admin"
        || user.fonction === "Direction"
        || (Array.isArray(user.roles) && user.roles.includes("Direction"));
    return isOwner || isDirectionOrAdmin;
  };

  // ─── v10.I — Fix 1 : peut supprimer cette commande ? ───
  // Combine la permission générique can() avec la règle métier :
  // suppression bloquée une fois "Commandée" / "Réceptionnée" / "Refusée"
  // v10.J — extension : "Réceptionnée partiellement" est aussi un statut final.
  // (Suppression autorisée sur "En attente de validation", "Validée", "Envoyée aux achats".)
  // can() renvoie le scope ("all" | "own_chantiers" | "own_items" | false).
  const canDeleteThisOrder = (o) => {
    if (!o || !user) return false;
    // Règle métier : bloque sur statuts finaux
    if (o.statut === "Commandée" || o.statut === "Réceptionnée"
        || o.statut === "Réceptionnée partiellement"
        || o.statut === "Refusée") return false;
    const scope = can(user, "commandes", "delete", rolesConfig);
    if (!scope) return false;
    if (scope === "all") return true;
    if (scope === "own_chantiers") {
      // Le chantier doit être sous la responsabilité de l'utilisateur
      const fullName = `${user.prenom||""} ${user.nom||""}`.trim();
      const ch = dynChantiers.find(c => c.nom === o.chantier);
      if (!ch) return false;
      // Conducteur du chantier OU chef chantier affecté
      if (ch.conducteur === fullName) return true;
      if (ch.chefChantier === fullName) return true;
      // Fallback : créateur de la commande sur ce chantier
      if (o.user === fullName) return true;
      return false;
    }
    if (scope === "own_items") {
      return o.user === `${user.prenom||""} ${user.nom||""}`.trim();
    }
    return false;
  };

  // ─── v10.I — Helper : suppression d'une commande avec SMS si pertinent ───
  // Centralise la logique deleteDoc + SMS (pour éviter de la dupliquer entre
  // les 2 boutons "Supprimer tout" et "Supprimer" individuel).
  const performDeleteOrder = async (h, withConfirm = true) => {
    if (!h || !h._id) return false;
    if (withConfirm && !confirm(`Supprimer ${h.num} ?`)) return false;
    try {
      // SMS conducteur AVANT delete (sinon on perd les données du chantier)
      // Uniquement si la commande était déjà envoyée aux achats (sinon pas d'enjeu)
      if (h.statut === "Envoyée aux achats" || h.statut === "Validée") {
        try {
          const chObj = dynChantiers.find(c => c.nom === h.chantier);
          const conducteur = chObj ? findConducteur(chObj, dynUsers) : null;
          if (conducteur) {
            await smsCommandeSupprimee({
              smsTemplates,
              conducteur,
              supprimeParNom: `${user.prenom||""} ${user.nom||""}`.trim(),
              numCmd: h.num,
              chantier: chObj?.nom || h.chantier,
              orderId: h._id,
            });
          }
        } catch (smsErr) {
          console.warn("[v10.I] SMS suppression non bloquant:", smsErr);
        }
      }
      await deleteDoc(doc(db, "commandes", h._id));
      return true;
    } catch (e) {
      console.warn("Échec deleteDoc:", e);
      return false;
    }
  };

  const beginEditOrder = (o) => {
    if (!o || !canEditOrder(o)) {
      showT("Impossible de modifier cette commande");
      return;
    }
    // Charger les items dans le panier
    const newCart = {};
    (o.items || []).forEach(it => {
      newCart[it.r] = it.qty || 1;
    });
    setCart(newCart);
    setOrderType(o.type || 'chantier');
    setChantier(o.chantier || '');
    setTargetSalarie(o.salarie || '');
    setUrgent(!!o.urgent);
    setDateReception(o.dateReception || '');
    setRemarques(o.remarques || '');
    setExtraEmail(o.extraEmail || '');
    setSelectedCat(null);
    setSearch('');
    // Marquer le mode édition
    setEditingOrder({
      ...o,
      editMode: 'rework',           // distingue du flow validation conducteur
      _originalStatut: o.statut,    // pour notification SMS si statut était "Envoyée aux achats"
      _originalItems: o.items || [],
    });
    // Aller directement au panier
    setView('cart');
    showT(`✏️ Modification de ${o.num}`);
  };

  // Compose un résumé "humain" des modifications faites à une commande
  const buildEditSummary = (originalItems, newItems, originalOther, newOther) => {
    const parts = [];
    const oRefs = new Set((originalItems||[]).map(i => i.r));
    const nRefs = new Set((newItems||[]).map(i => i.r));
    let added = 0, removed = 0, qtyChanged = 0;
    for (const r of nRefs) if (!oRefs.has(r)) added++;
    for (const r of oRefs) if (!nRefs.has(r)) removed++;
    for (const it of (newItems||[])) {
      const orig = (originalItems||[]).find(x => x.r === it.r);
      if (orig && orig.qty !== it.qty) qtyChanged++;
    }
    if (added > 0) parts.push(`${added} article${added>1?'s':''} ajouté${added>1?'s':''}`);
    if (removed > 0) parts.push(`${removed} retiré${removed>1?'s':''}`);
    if (qtyChanged > 0) parts.push(`${qtyChanged} qté modifiée${qtyChanged>1?'s':''}`);
    if (originalOther.dateReception !== newOther.dateReception) parts.push("date réception");
    if (!!originalOther.urgent !== !!newOther.urgent) parts.push(newOther.urgent ? "passée urgente" : "urgent retiré");
    if ((originalOther.remarques||'') !== (newOther.remarques||'')) parts.push("remarques modifiées");
    if ((originalOther.extraEmail||'') !== (newOther.extraEmail||'')) parts.push("email supplémentaire modifié");
    return parts.length === 0 ? "Aucune modification visible" : parts.join(", ");
  };

  // Sauvegarde une commande en mode édition (v10.G.2)
  const saveEditedOrder = async (newCartItems, newOrderData) => {
    if (!editingOrder || !editingOrder._id) return null;
    try {
      // Calcule le nouveau statut selon directAchat
      const myDirectAchat = user.directAchat === true;
      let newStatut;
      if (myDirectAchat) {
        // Admin/Direction : on garde le statut courant SAUF si la commande
        // était déjà refusée (impossible vu canEditOrder, mais sécurité)
        newStatut = editingOrder._originalStatut;
      } else {
        // Demandeur normal : on repasse en attente de validation
        newStatut = "En attente de validation";
      }

      // Construit l'entrée d'historique
      const summary = buildEditSummary(
        editingOrder._originalItems,
        newCartItems,
        { dateReception: editingOrder.dateReception, urgent: editingOrder.urgent,
          remarques: editingOrder.remarques, extraEmail: editingOrder.extraEmail },
        { dateReception: newOrderData.dateReception, urgent: newOrderData.urgent,
          remarques: newOrderData.remarques, extraEmail: newOrderData.extraEmail }
      );
      const newHistEntry = {
        by: `${user.prenom||""} ${user.nom||""}`.trim() || user.id,
        at: new Date().toISOString(),
        previousStatut: editingOrder._originalStatut,
        newStatut,
        summary,
      };
      const editHistory = Array.isArray(editingOrder.editHistory)
        ? [...editingOrder.editHistory, newHistEntry]
        : [newHistEntry];

      // Payload de mise à jour (on ne touche PAS aux champs immuables :
      // num, user, type, chantier, numAffaire, salarie, date, signatureData...)
      const payload = {
        items: newCartItems,
        urgent: !!newOrderData.urgent,
        dateReception: newOrderData.dateReception || '',
        remarques: newOrderData.remarques || '',
        extraEmail: newOrderData.extraEmail || '',
        statut: newStatut,
        editHistory,
      };
      // Si statut repasse en "En attente de validation", on efface validePar
      // et dateEnvoiAchats (sinon on garde un historique cohérent)
      if (newStatut === "En attente de validation") {
        payload.validePar = "";
        payload.dateValidation = "";
      }

      await updateDoc(doc(db, "commandes", editingOrder._id), payload);

      // ─── v10.H — SMS au conducteur du chantier ───
      // Règle : on n'envoie un SMS QUE si la commande repasse en attente de
      // validation (donc demandeur sans directAchat). Pour Admin/Direction
      // qui éditent (directAchat=true), pas de SMS car pas besoin de
      // revalidation par un conducteur.
      // Note : remplace l'ancien "notificationsPending" de v10.G.2.
      if (newStatut === "En attente de validation"
          && editingOrder.type === 'chantier'
          && editingOrder.chantier) {
        try {
          // Trouve l'objet chantier puis son conducteur
          const chObj = dynChantiers.find(c =>
            c.nom === editingOrder.chantier
            || (c.num && (c.num === editingOrder.numAffaire || c.num === editingOrder.chantierNum))
          );
          const conducteur = chObj ? findConducteur(chObj, dynUsers) : null;
          if (conducteur) {
            const result = await smsCommandeModifiee({
              smsTemplates: smsTemplates || [],
              conducteur,
              modifieParNom: `${user.prenom||""} ${user.nom||""}`.trim(),
              numCmd: editingOrder.num,
              chantier: editingOrder.chantier,
              orderId: editingOrder._id,
            });
            if (!result.queued) {
              console.warn("[v10.H] SMS conducteur (édition) non envoyé:", result.reason);
            }
          } else {
            console.warn("[v10.H] Conducteur introuvable pour chantier édité:", editingOrder.chantier);
          }
        } catch(smsErr) {
          // Erreur SMS non bloquante : la modification est sauvegardée, c'est l'essentiel
          console.warn("[v10.H] Échec queueing SMS conducteur après édition (non bloquant):", smsErr);
        }
      }

      return { ...editingOrder, ...payload, _id: editingOrder._id };
    } catch (err) {
      console.error("saveEditedOrder échouée:", err);
      showT("❌ Erreur sauvegarde : " + (err.message || "voir console"));
      return null;
    }
  };

  // Appelée UNIQUEMENT quand on confirme avoir envoyé le mail
  // (l'utilisateur doit explicitement confirmer)
  const markOrderAsSent = async (order) => {
    if (!order || !order._id) return;
    try {
      await updateDoc(doc(db, "commandes", order._id), {
        statut: "Envoyée aux achats",
        dateEnvoiAchats: new Date().toISOString(),
      });
      showT("📨 Commande envoyée aux achats");
    } catch(err) {
      console.error("Erreur envoi:", err);
      showT("❌ Erreur — réessayez");
    }
  };

  // Passe "Envoyée aux achats" → "Commandée" (le fournisseur a reçu)
  const markOrderAsCommandee = async (order) => {
    if (!order || !order._id) return;
    if (!confirm(`Confirmer que la commande ${order.num} a bien été passée chez le fournisseur ?`)) return;
    try {
      await updateDoc(doc(db, "commandes", order._id), {
        statut: "Commandée",
        dateCommande: new Date().toISOString(),
      });
      showT("🛒 Commande passée chez le fournisseur");
      // v10.I — SMS au demandeur initial : "ta commande a été passée"
      try {
        const demandeur = findUserByUid(order.userId, dynUsers);
        if (demandeur) {
          await smsCommandePassee({
            smsTemplates,
            demandeur,
            numCmd: order.num,
            chantier: order.chantier || "",
            orderId: order._id,
          });
        }
      } catch(smsErr) {
        console.warn("[v10.I] SMS commande passée non bloquant:", smsErr);
      }
    } catch(err) {
      console.error("Erreur marquage commandée:", err);
      showT("❌ Erreur — réessayez");
    }
  };

  // v1.17.0 — Passage chez le fournisseur (Achat/Direction/Admin)
  //
  // Cas 1 — Tout commandé : update mère statut "Commandée" (rétrocompatible)
  // Cas 2 — Passage partiel : scission de la mère en deux commandes filles
  //          • CMD-XXXX-NNNN-1 : items effectivement commandés, statut "Commandée",
  //            réceptionnable par le demandeur. PAS de push Esabora auto :
  //            visible dans l'historique, l'agent la pousse via "Envoyer dans Esabora".
  //          • CMD-XXXX-NNNN-2 : items reliquat, statut "Validée" + commanderPlusTard,
  //            NON poussée, parquée dans "À commander" (hors pipeline achats).
  //          La mère prend le statut "Scindée" et est masquée des listes.
  const performPartialPass = async (order, { orderedByIndex }) => {
    if (!order || !order._id) return false;
    try {
      const { payload, reliquatItems } = buildPartialPassPayload(order, orderedByIndex, { user });
      if (!payload) {
        showT("ℹ️ Aucune ligne commandée — annulation");
        return false;
      }

      // ─── CAS 1 : tout commandé (pas de reliquat) ───────────────
      // Comportement classique inchangé : on update juste la mère.
      if (reliquatItems.length === 0) {
        await updateDoc(doc(db, "commandes", order._id), payload);

        // SMS au demandeur
        try {
          const demandeur = findUserByUid(order.userId, dynUsers);
          if (demandeur) {
            await smsCommandePassee({
              smsTemplates,
              demandeur,
              numCmd: order.num,
              chantier: order.chantier || "",
              orderId: order._id,
            });
          }
        } catch (smsErr) {
          console.warn("[v1.17] SMS passage non bloquant:", smsErr);
        }

        showT("🛒 Commande passée chez le fournisseur");
        if (selectedOrder && selectedOrder._id === order._id) {
          setSelectedOrder({ ...order, ...payload });
        }
        return true;
      }

      // ─── CAS 2 : passage partiel → scission en -1 / -2 ─────────

      // 2.a — Items effectivement commandés (avec qtés réelles passées)
      const orderedItems = [];
      const items = order.items || [];
      const passLog = payload.passLog?.orderedByIndex || {};
      items.forEach((it, idx) => {
        const passedQty = Number(passLog[idx]) || 0;
        if (passedQty > 0) {
          orderedItems.push({ ...it, qty: passedQty });
        }
      });

      if (orderedItems.length === 0) {
        showT("ℹ️ Aucune ligne commandée — annulation");
        return false;
      }

      // 2.b — Calculer les numéros des enfants
      const baseNum = order.num || "";
      const child1Num = `${baseNum}-1`;
      const child2Num = `${baseNum}-2`;

      // 2.c — Champs hérités de la mère
      const todayFR = new Date().toLocaleDateString('fr-FR');
      const nowISO = new Date().toISOString();
      const inheritedFields = {
        type: order.type || "chantier",
        chantier: order.chantier || "",
        numAffaire: order.numAffaire || order.chantierNum || "",
        chantierNum: order.chantierNum || order.numAffaire || "",
        user: order.user || "",
        userId: order.userId || "",
        salarie: order.salarie || "",
        livraison: order.livraison || "",
        dateReception: order.dateReception || "",
        urgent: !!order.urgent,
        validePar: order.validePar || "",
        parentOrderId: order._id,
        parentOrderNum: order.num,
        createdBySplit: true,
        splitAt: nowISO,
        // createdAt : sans lui les enfants tombent en bas du tri history (l.~297)
        // et deviennent invisibles en pratique — ils doivent trier comme une commande normale.
        createdAt: nowISO,
      };

      // 2.d — Payload enfant 1 (commandé, réceptionnable)
      const child1Payload = {
        ...inheritedFields,
        num: child1Num,
        date: todayFR,
        // "Valider partiel" ne commande rien : -1 part dans le pipeline achats
        // comme une commande normale prête à envoyer. C'est le bouton Esabora
        // qui la fera passer "Commandée" (et rejoindre l'historique).
        statut: "Envoyée aux achats",
        dateEnvoiAchats: nowISO,
        remarques: `Partie sélectionnée de ${order.num}${order.remarques ? " — " + order.remarques : ""}`,
        items: orderedItems,
        passLog: payload.passLog,
      };

      // 2.e — Payload enfant 2 (reliquat à re-passer)
      const child2Payload = {
        ...inheritedFields,
        num: child2Num,
        date: todayFR,
        statut: "Validée",
        commanderPlusTard: true,
        remarques: `Reliquat de passage de ${order.num}${order.remarques ? " — " + order.remarques : ""}`,
        items: reliquatItems,
      };

      // 2.f — Création des enfants en base
      let child1Ref, child2Ref;
      try {
        child1Ref = await addDoc(collection(db, "commandes"), child1Payload);
        child2Ref = await addDoc(collection(db, "commandes"), child2Payload);
        console.log(`[v1.17] Scission ${order.num} → ${child1Num} + ${child2Num}`);
      } catch (createErr) {
        console.error("[v1.17] Échec création enfants:", createErr);
        if (child1Ref && !child2Ref) {
          try { await deleteDoc(doc(db, "commandes", child1Ref.id)); } catch {}
        }
        showT("❌ Erreur lors de la scission — la commande n'a pas été modifiée");
        return false;
      }

      // 2.g — Marquer la mère comme "Scindée"
      try {
        const splitHistEntry = {
          by: user ? (`${user.prenom || ""} ${user.nom || ""}`.trim() || user.id) : "—",
          at: nowISO,
          previousStatut: order.statut || "",
          newStatut: "Scindée",
          summary: `Scindée → ${child1Num} (à envoyer aux achats) + ${child2Num} (à commander plus tard)`,
        };
        const editHistory = Array.isArray(order.editHistory)
          ? [...order.editHistory, splitHistEntry]
          : [splitHistEntry];
        await updateDoc(doc(db, "commandes", order._id), {
          statut: "Scindée",
          splitAt: nowISO,
          splitInto: [
            { id: child1Ref.id, num: child1Num, role: "a_envoyer" },
            { id: child2Ref.id, num: child2Num, role: "reliquat" },
          ],
          splitBy: user ? `${user.prenom || ""} ${user.nom || ""}`.trim() : "—",
          splitByUid: user?.id || user?._id || "",
          editHistory,
        });
      } catch (motherErr) {
        console.warn("[v1.17] Mère pas marquée Scindée (enfants OK) :", motherErr);
      }

      // Pas de SMS "commande passée" ici : "Valider partiel" ne commande rien.
      // -1 part en "Envoyée aux achats" ; le SMS partira quand elle sera
      // réellement passée chez le fournisseur (markOrderAsCommandee).

      showT(`✅ Scission validée — ${child1Num} à envoyer, ${child2Num} à commander plus tard`);

      // La mère devient "Scindée" (masquée). On ramène TOUJOURS l'utilisateur sur
      // "À commander" (les deux enfants y sont visibles). Sans ce setView, rester
      // sur "orderDetail" avec selectedOrder vidé ne matche aucune vue → le
      // composant finit par `return null` → écran blanc.
      setSelectedOrder(null);
      setView('toOrder');
      return true;
    } catch (err) {
      console.error("[v1.17] Erreur passage partiel:", err);
      showT("❌ Erreur — réessayez");
      return false;
    }
  };

  // ─── v10.J — Réception d'une commande type "chantier" ───
  // Deux modes :
  //   - quick = true  → "Tout reçu" : un clic, statut "Réceptionnée"
  //   - quick = false → article par article via receivedByIndex { idx: qty }
  // En cas de quantités < commandées, on génère un reliquat automatique :
  // une nouvelle commande Firestore avec les lignes manquantes, statut
  // "Envoyée aux achats" (le besoin est déjà acté → pas besoin de re-validation),
  // et un lien parentOrderId vers la commande mère.
  // SMS commande_recue envoyé au demandeur initial (non bloquant).
  const performReceptionChantier = async (order, { quick, receivedByIndex }) => {
    if (!order || !order._id) return false;
    try {
      const todayFR = new Date().toLocaleDateString('fr-FR');
      const payload = buildReceptionPayload(order, receivedByIndex, {
        user,
        todayISO: todayFR,
        detailMode: !quick,
      });
      if (!payload.statut) {
        showT("ℹ️ Aucune quantité reçue saisie");
        return false;
      }
      await updateDoc(doc(db, "commandes", order._id), payload);

      // Reliquat : créer une nouvelle commande Firestore avec les lignes manquantes
      let reliquatNum = "";
      if (payload.reliquatItems && payload.reliquatItems.length > 0) {
        try {
          // Génère un nouveau numéro de commande (suite des CMD-2026-XXXX existants)
          const year = new Date().getFullYear();
          const existing = history
            .map(h => h.num || "")
            .filter(n => n.startsWith(`CMD-${year}-`))
            .map(n => parseInt(n.split("-")[2], 10))
            .filter(n => !isNaN(n));
          const nextNum = (existing.length > 0 ? Math.max(...existing) : 0) + 1;
          reliquatNum = `CMD-${year}-${String(nextNum).padStart(4, "0")}`;
          const reliquatPayload = {
            num: reliquatNum,
            date: todayFR,
            statut: "Envoyée aux achats",
            type: order.type || "chantier",
            chantier: order.chantier || "",
            numAffaire: order.numAffaire || order.chantierNum || "",
            chantierNum: order.chantierNum || order.numAffaire || "",
            user: order.user || "",
            userId: order.userId || "",
            livraison: order.livraison || "",
            dateReception: order.dateReception || "",
            urgent: !!order.urgent,
            remarques: `Reliquat automatique de ${order.num}${order.remarques ? " — "+order.remarques : ""}`,
            items: payload.reliquatItems,
            parentOrderId: order._id,
            parentOrderNum: order.num,
            createdByReliquat: true,
            dateEnvoiAchats: new Date().toISOString(),
          };
          const ref = await addDoc(collection(db, "commandes"), reliquatPayload);
          console.log(`[v10.J] Reliquat créé : ${reliquatNum} (id=${ref.id})`);
        } catch (relErr) {
          console.warn("[v10.J] Échec création reliquat (réception OK quand même):", relErr);
          showT("⚠️ Reliquat non créé, à recréer manuellement");
        }
      }

      // SMS au demandeur initial : "ta commande a été réceptionnée"
      try {
        const demandeur = findUserByUid(order.userId, dynUsers);
        if (demandeur) {
          await smsCommandeRecue({
            smsTemplates,
            demandeur,
            numCmd: order.num,
            chantier: order.chantier || "",
            orderId: order._id,
          });
        }
      } catch (smsErr) {
        console.warn("[v10.J] SMS réception non bloquant:", smsErr);
      }

      if (payload.statut === "Réceptionnée") {
        showT(`✅ Commande ${order.num} réceptionnée`);
      } else {
        showT(`✅ Réception partielle — reliquat ${reliquatNum || "à recréer"}`);
      }
      return true;
    } catch (e) {
      console.error("[v10.J] Échec réception:", e);
      showT("❌ Erreur — réessayez");
      return false;
    }
  };

  // Wrapper rétrocompat : valide sans édition (si quelque part appel direct)
  const validateOrder = async (orderNum) => {
    openValidateEdit(orderNum);
  };

  const refuseOrder = async (orderNum, motif) => {
    const order = history.find(o=>o.num===orderNum);
    if(!order || !order._id) return;
    try {
      await updateDoc(doc(db, "commandes", order._id), { statut: "Refusée", motifRefus: motif });
      setShowRefuseModal(null); setRefuseMotif("");
      showT("❌ Commande refusée");
    } catch(err) {
      console.error("Erreur refus:", err);
      showT("❌ Erreur — réessayez");
    }
  };

  // Lot trio : le <style> local a été supprimé — les classes .epj-btn/.epj-input/
  // .epj-card/.epj-row/.badge-pulse et les keyframes (fadeUp, spin, badgePulse)
  // sont fournies par globalCss (src/core/theme.js), injecté par Layout.

  // ─── Header interne du module Commandes — v10.G ───
  // Sub-header sticky avec :
  //   • Bouton "← Commandes" (à gauche) : retour à l'accueil du module
  //     Caché sur l'accueil du module (showModuleHome=false par défaut sur 'home').
  //   • Bouton flèche ← contrastée (= "page précédente") quand `back` est fourni
  //     et qu'on a un `backView` qui définit où revenir.
  //   • Titre de la section
  //   • Indicateur 🛒 panier à droite
  //
  // À noter : le bouton 🏠 Accueil de l'application est dans le HEADER GLOBAL
  // (Layout.jsx), au-dessus de ce sub-header. La logique à 3 niveaux est :
  //   1. Header global → 🏠 Accueil → accueil de l'app
  //   2. Sub-header du module → ← Commandes → accueil du module
  //   3. Bouton flèche du sub-header → ← (page précédente dans le module)
  const Header = ({title, back, backView, showCart=true, showModuleHome=true}) => (
    <div style={{background:'rgba(255,255,255,.92)',backdropFilter:'blur(8px)',WebkitBackdropFilter:'blur(8px)',borderBottom:`1px solid ${EPJ.gray200}`,color:EPJ.dark,padding:`${space.sm}px ${space.md}px`,position:'sticky',top:0,zIndex:100}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:space.sm}}>
        <div style={{display:'flex',alignItems:'center',gap:space.sm,flex:1,minWidth:0}}>
          {/* Bouton "← Commandes" : retour à l'accueil du module — v10.G */}
          {showModuleHome && view !== 'home' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={goToModuleHome}
              title="Accueil du module Commandes"
              aria-label="Accueil du module Commandes"
            >
              ← Commandes
            </Button>
          )}
          {/* Flèche "← page précédente" — v10.G */}
          {back && (
            <IconButton
              label="Retour à l'écran précédent"
              onClick={()=>{
                if(backView==='cats'){setSelectedCat(null);setSearch('')}
                else if(backView==='admin'){setAdminSection(null);setAdminEdit(null);setAdminForm({});setSelectedCat(null);setSearch('');setView('admin')}
                else setView(backView||'home')
              }}
            >
              ←
            </IconButton>
          )}
          <div style={{fontSize:fontSize.md,fontWeight:fontWeight.medium,letterSpacing:'-0.01em',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{title}</div>
        </div>
        <div style={{display:'flex',gap:space.sm,alignItems:'center',flexShrink:0}}>
          {showCart&&cartCount>0&&view!=='cart'&&<button onClick={()=>setView('cart')} style={{background:EPJ.orange,color:EPJ.white,border:'none',borderRadius:radius.pill,padding:`6px ${space.md + 2}px`,fontSize:fontSize.sm,fontWeight:fontWeight.medium,cursor:'pointer',fontFamily:font,fontVariantNumeric:'tabular-nums'}}>🛒 {cartCount}</button>}
        </div>
      </div>
    </div>
  );

  const CatIcon = ({cat, size=36}) => {
    const icon = dynCatIcons[cat] || '📦';
    const isImg = icon.startsWith('http') || icon.startsWith('data:');
    if(isImg) return <img src={icon} alt="" style={{width:size,height:size,borderRadius:radius.sm + 2,objectFit:'cover',flexShrink:0}}/>;
    return <div style={{width:size,height:size,borderRadius:radius.sm + 2,background:`${EPJ.blue}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.round(size*0.5),flexShrink:0,border:`1px solid ${EPJ.blue}22`}}>{icon}</div>;
  };

  const Thumb = ({cat, imageUrl, size=36}) => {
    if (imageUrl) {
      return <img src={imageUrl} alt="" style={{width:size,height:size,borderRadius:radius.sm + 2,objectFit:'cover',flexShrink:0,background:EPJ.gray100}} onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex'}}/>;
    }
    return <CatIcon cat={cat} size={size}/>;
  };

  // ─── QTY CONTROL ───
  const [qtyPopup, setQtyPopup] = useState(null); // {r, value}
  const [qtyPopupVal, setQtyPopupVal] = useState('');
  const QtyControl = ({r, value, compact, showDelete}) => (
    <div style={{display:'flex',alignItems:'center',gap:space.xs}}>
      {showDelete && <button aria-label="Retirer du panier" onClick={()=>{setCart(p=>{const n={...p};delete n[r];return n})}} style={{width:28,height:28,borderRadius:radius.sm + 2,border:'none',background:EPJ.dangerBg,color:EPJ.redText,fontSize:fontSize.xs,cursor:'pointer'}}>🗑</button>}
      <button aria-label="Diminuer la quantité" onClick={()=>updateQty(r,value-1)} style={{width:compact?30:34,height:compact?30:34,borderRadius:radius.sm + 2,border:'none',background:value<=1&&!showDelete?EPJ.dangerBg:EPJ.gray100,color:value<=1&&!showDelete?EPJ.redText:EPJ.dark,fontSize:fontSize.base,cursor:'pointer',fontWeight:fontWeight.medium}}>−</button>
      <div onClick={()=>{setQtyPopup({r,value});setQtyPopupVal(String(value))}} style={{width:compact?48:60,height:compact?30:34,borderRadius:radius.sm + 2,border:`2px solid ${EPJ.blue}`,background:EPJ.white,display:'flex',alignItems:'center',justifyContent:'center',fontSize:fontSize.base,fontWeight:fontWeight.medium,fontFamily:font,cursor:'pointer',color:EPJ.blue,fontVariantNumeric:'tabular-nums'}}>{value}</div>
      <button aria-label="Augmenter la quantité" onClick={()=>updateQty(r,value+1)} style={{width:compact?30:34,height:compact?30:34,borderRadius:radius.sm + 2,border:'none',background:EPJ.gray100,fontSize:fontSize.base,cursor:'pointer',fontWeight:fontWeight.medium}}>+</button>
    </div>
  );

  const QtyPopupOverlay = () => qtyPopup ? (
    <div style={{position:'fixed',inset:0,background:EPJ.scrim,zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:space.xl - 4}} onClick={()=>setQtyPopup(null)}>
      <div style={{background:EPJ.white,borderRadius:radius.xl,padding:space.xl,width:'100%',maxWidth:320,textAlign:'center',boxShadow:shadow.lg}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:fontSize.base,fontWeight:fontWeight.medium,color:EPJ.dark,marginBottom:space.lg}}>Saisir la quantité</div>
        <input type="text" inputMode="numeric" pattern="[0-9]*" autoFocus
          value={qtyPopupVal} onChange={e=>setQtyPopupVal(e.target.value.replace(/[^0-9]/g,''))}
          onKeyDown={e=>{if(e.key==='Enter'){const n=parseInt(qtyPopupVal)||1;updateQty(qtyPopup.r,n);setQtyPopup(null)}}}
          style={{width:'100%',fontSize:32,fontWeight:fontWeight.semibold,textAlign:'center',border:`2px solid ${EPJ.blue}`,borderRadius:radius.lg,padding:space.md,fontFamily:font,color:EPJ.dark,marginBottom:space.lg,fontVariantNumeric:'tabular-nums'}}/>
        <div style={{display:'flex',gap:space.sm + 2}}>
          <div style={{flex:1}}><Button full variant="secondary" onClick={()=>setQtyPopup(null)}>Annuler</Button></div>
          <div style={{flex:1}}><Button full onClick={()=>{const n=parseInt(qtyPopupVal)||1;updateQty(qtyPopup.r,n);setQtyPopup(null)}}>✓ OK</Button></div>
        </div>
      </div>
    </div>
  ) : null;

  // ═══ RÉCEPTION SIGNÉE (inline React, pas de popup) ═══
  if(view==='reception' && receptionOrder) {
    const o = receptionOrder;
    const alreadySigned = !!o.signatureData;
    return (
      <div style={wrapStyle(720)}>
        <Header title={`✍️ Réception ${o.num}`} back={!alreadySigned} backView="detail" showCart={false}/>
        <div style={{padding:`${space.md}px ${space.lg}px`}}>
          {/* Infos commande */}
          <div style={{background:EPJ.white,borderRadius:radius.lg,padding:space.md + 2,marginBottom:space.md,border:`1px solid ${EPJ.gray200}`,borderLeft:`3px solid ${alreadySigned?EPJ.green:EPJ.blue}`}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:space.sm,marginBottom:space.sm}}>
              <div><div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.gray500,textTransform:'uppercase',letterSpacing:'0.03em'}}>Bénéficiaire</div><div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.dark}}>{o.salarie||o.user}</div></div>
              <div><div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.gray500,textTransform:'uppercase',letterSpacing:'0.03em'}}>Date de remise</div><div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.dark}}>{new Date().toLocaleDateString('fr-FR')}</div></div>
            </div>
            <div style={{fontSize:fontSize.xs,color:EPJ.gray,fontFamily:fontFamilies.mono}}>Commande {o.num} • {o.date}</div>
          </div>
          {/* Articles */}
          <div style={{background:EPJ.white,borderRadius:radius.lg,padding:space.md + 2,marginBottom:space.md,border:`1px solid ${EPJ.gray200}`}}>
            <div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.gray500,textTransform:'uppercase',letterSpacing:'0.03em',marginBottom:space.sm}}>Articles ({o.items?.length||0} réf.)</div>
            {(o.items||[]).map((it,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:i<(o.items.length-1)?`1px solid ${EPJ.gray100}`:'none'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.dark,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.n}</div>
                  <div style={{fontSize:fontSize.xs,color:EPJ.gray,fontFamily:fontFamilies.mono}}>{it.r}</div>
                </div>
                <div style={{marginLeft:space.sm,background:EPJ.infoBg,color:EPJ.blueText,borderRadius:radius.pill,padding:'2px 10px',fontWeight:fontWeight.medium,fontSize:fontSize.sm,fontVariantNumeric:'tabular-nums'}}>×{it.qty}</div>
              </div>
            ))}
          </div>
          {alreadySigned ? (
            /* Vue si déjà réceptionnée */
            <div style={{background:EPJ.successBg,borderRadius:radius.lg,padding:space.xl - 4,textAlign:'center',border:`1px solid ${EPJ.green}66`}}>
              <div style={{fontSize:32,marginBottom:space.sm}}>✅</div>
              <div style={{fontSize:fontSize.base,fontWeight:fontWeight.medium,color:EPJ.greenText,marginBottom:space.xs}}>Réception confirmée</div>
              <div style={{fontSize:fontSize.xs,color:EPJ.greenText,opacity:.85,marginBottom:space.lg}}>Signée le {o.dateReception||o.date}</div>
              <img src={o.signatureData} alt="Signature" style={{width:'100%',maxHeight:100,objectFit:'contain',border:`1px solid ${EPJ.gray300}`,borderRadius:radius.sm + 2,background:EPJ.white,padding:space.xs}}/>
              <div style={{marginTop:space.lg}}><Button full variant="secondary" onClick={()=>setView('history')}>← Retour historique</Button></div>
            </div>
          ) : (
            /* Zone signature */
            <div style={{background:EPJ.white,borderRadius:radius.lg,padding:space.md + 2,marginBottom:space.md,border:`1px solid ${EPJ.gray200}`,borderLeft:`3px solid ${EPJ.dark}`}}>
              <div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.dark,marginBottom:space.xs}}>✍️ Signature de {o.salarie||o.user}</div>
              <div style={{fontSize:fontSize.xs,color:EPJ.gray,marginBottom:space.sm + 2}}>Signez avec le doigt (ou la souris) ci-dessous, puis appuyez sur Enregistrer</div>
              <canvas
                id="receptionCanvas"
                width={460} height={160}
                style={{width:'100%',border:`1px solid ${EPJ.gray}`,borderRadius:10,touchAction:'none',cursor:'crosshair',background:'#fafafa',display:'block'}}
                ref={el => {
                  if(!el) return;
                  if(el._epjInited) return;
                  el._epjInited = true;
                  const ctx = el.getContext('2d');
                  ctx.fillStyle = '#fafafa'; ctx.fillRect(0,0,el.width,el.height);
                  let drawing = false, lx = 0, ly = 0;
                  const getPos = (e) => { const r=el.getBoundingClientRect(); const t=e.touches?e.touches[0]:e; return [(t.clientX-r.left)*(el.width/r.width),(t.clientY-r.top)*(el.height/r.height)]; };
                  const draw = (x,y) => { ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(x,y);ctx.strokeStyle='#1a1a1a';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.stroke();lx=x;ly=y; };
                  el.addEventListener('mousedown',e=>{drawing=true;[lx,ly]=getPos(e)});
                  el.addEventListener('mousemove',e=>{if(!drawing)return;const[x,y]=getPos(e);draw(x,y)});
                  el.addEventListener('mouseup',()=>drawing=false);
                  el.addEventListener('mouseleave',()=>drawing=false);
                  el.addEventListener('touchstart',e=>{e.preventDefault();drawing=true;[lx,ly]=getPos(e)},{passive:false});
                  el.addEventListener('touchmove',e=>{e.preventDefault();if(!drawing)return;const[x,y]=getPos(e);draw(x,y)},{passive:false});
                  el.addEventListener('touchend',()=>drawing=false);
                }}
              />
              <button onClick={()=>{const c=document.getElementById('receptionCanvas');const ctx=c.getContext('2d');ctx.fillStyle='#fafafa';ctx.fillRect(0,0,c.width,c.height);}} style={{width:'100%',marginTop:space.sm,padding:space.sm,border:`1px solid ${EPJ.gray300}`,borderRadius:radius.sm + 2,background:EPJ.white,cursor:'pointer',fontSize:fontSize.xs,color:EPJ.gray,fontFamily:font}}>🗑 Effacer et recommencer</button>
            </div>
          )}
          {!alreadySigned && (
            <Button full onClick={async()=>{
              const c = document.getElementById('receptionCanvas');
              if(!c){showT('❌ Erreur canvas');return;}
              const sigData = c.toDataURL('image/png');
              // Check not blank
              const blank = document.createElement('canvas'); blank.width=c.width; blank.height=c.height;
              const bctx=blank.getContext('2d'); bctx.fillStyle='#fafafa'; bctx.fillRect(0,0,blank.width,blank.height);
              if(sigData === blank.toDataURL('image/png')){showT('⚠️ Veuillez signer avant de valider');return;}
              try{
                const dateAuj = new Date().toLocaleDateString('fr-FR');
                await updateDoc(doc(db,'commandes',o._id),{signatureData:sigData,dateReceptionEffective:dateAuj,statut:'Réceptionnée'});
                setReceptionOrder({...o,signatureData:sigData,dateReceptionEffective:dateAuj,statut:'Réceptionnée'});
                showT('✅ Réception enregistrée !');
                // v10.I — SMS au demandeur initial : "ta commande a été réceptionnée"
                try {
                  const demandeur = findUserByUid(o.userId, dynUsers);
                  if (demandeur) {
                    await smsCommandeRecue({
                      smsTemplates,
                      demandeur,
                      numCmd: o.num,
                      chantier: o.chantier || "",
                      orderId: o._id,
                    });
                  }
                } catch(smsErr) {
                  console.warn("[v10.I] SMS réception non bloquant:", smsErr);
                }
              }catch(e){showT('❌ Erreur: '+e.message);}
            }}>✅ Enregistrer la réception</Button>
          )}
        </div>
        {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:EPJ.white,padding:`${space.sm}px ${space.xl - 4}px`,borderRadius:radius.pill,fontSize:fontSize.sm,fontWeight:fontWeight.medium,zIndex:400}}>{toast}</div>}
      </div>
    );
  }

  // ═══ LOGIN supprimé : géré par le Socle ═══

  // ═══ HOME (page d'accueil du module Commandes) ═══
  if(view==="home") return (
    <div style={wrapStyle(1100)}>
      <div style={{padding:`${space.lg}px ${space.lg}px ${space.sm}px`,borderBottom:`1px solid ${EPJ.gray200}`,marginBottom:space.sm,display:'flex',alignItems:'center',gap:space.md}}>
        {/* v10.G : Le bouton "← Accueil" a été supprimé d'ici car le bouton
            🏠 Accueil du header global de l'app fait déjà cette action. */}
        <div style={{flex:1}}>
          <div style={{fontSize:fontSize.xs,color:EPJ.gray500,textTransform:'uppercase',letterSpacing:'0.03em',fontWeight:fontWeight.medium}}>Module</div>
          <div style={{fontSize:fontSize.lg,fontWeight:fontWeight.medium,color:EPJ.gray900,letterSpacing:'-0.01em'}}>Commandes</div>
        </div>
      </div>
      <div style={{padding:space.lg}}>
        {isCartLocked&&(
          <Banner
            tone="warning"
            icon="🛒"
            title="Panier en cours"
            text={`${cartCount} article(s) (${orderType==='chantier'?'Chantier':'Équipement'})`}
            action={
              <div style={{display:'flex',gap:space.sm}}>
                <Button size="sm" onClick={()=>setView('cart')}>🛒 Panier</Button>
                <Button size="sm" variant="ghost" onClick={()=>{setCart({});setOrderType('');showT('Panier vidé')}}>🗑 Vider</Button>
              </div>
            }
          />
        )}
        <div style={{fontSize:fontSize.md,fontWeight:fontWeight.medium,color:EPJ.dark,margin:`${space.xs}px 0 ${space.md}px`}}>Que souhaitez-vous faire ?</div>
        <div style={{display:'grid',gridTemplateColumns:isPwa?'1fr':'repeat(auto-fill,minmax(320px,1fr))',gap:space.sm + 2}}>
        <div onClick={()=>{if(isCartLocked&&orderType!=='chantier')return;setOrderType('chantier');setView('catalog');setSelectedCat(null);setSearch('')}} className="epj-card clickable" style={{cursor:isCartLocked&&orderType!=='chantier'?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:space.md + 2,opacity:isCartLocked&&orderType!=='chantier'?.4:1}}>
          <div style={{width:48,height:48,borderRadius:radius.lg,background:`${EPJ.blue}1A`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>🏗️</div>
          <div style={{flex:1}}><div style={{fontWeight:fontWeight.medium,fontSize:fontSize.base,color:EPJ.dark}}>Commande Chantier</div><div style={{fontSize:fontSize.xs,color:EPJ.gray}}>Matériel pour un chantier</div></div>
          {isCartLocked&&orderType==='chantier'&&<Badge tone="warning" label="En cours"/>}
        </div>
        <div onClick={()=>{if(isCartLocked&&orderType!=='equipement')return;setOrderType('equipement');setView('catalog');setSelectedCat(null);setSearch('')}} className="epj-card clickable" style={{cursor:isCartLocked&&orderType!=='equipement'?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:space.md + 2,opacity:isCartLocked&&orderType!=='equipement'?.4:1}}>
          <div style={{width:48,height:48,borderRadius:radius.lg,background:`${EPJ.orange}1A`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>👷</div>
          <div style={{flex:1}}><div style={{fontWeight:fontWeight.medium,fontSize:fontSize.base,color:EPJ.dark}}>Équipement Salarié</div><div style={{fontSize:fontSize.xs,color:EPJ.gray}}>Outillage, vêtements, EPI</div></div>
          {isCartLocked&&orderType==='equipement'&&<Badge tone="warning" label="En cours"/>}
        </div>
        {pendingCount>0&&<div onClick={()=>setView('pending')} className="epj-card clickable" style={{cursor:'pointer',display:'flex',alignItems:'center',gap:space.md + 2,borderLeft:`3px solid ${EPJ.red}`}}>
          <div style={{width:48,height:48,borderRadius:radius.lg,background:`${EPJ.red}1A`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,position:'relative',flexShrink:0}} className="badge-pulse">📋<div style={{position:'absolute',top:-4,right:-4,background:EPJ.red,color:EPJ.white,borderRadius:'50%',width:22,height:22,fontSize:fontSize.xs,fontWeight:fontWeight.semibold,display:'flex',alignItems:'center',justifyContent:'center',border:`2px solid ${EPJ.white}`,fontVariantNumeric:'tabular-nums'}}>{pendingCount}</div></div>
          <div><div style={{fontWeight:fontWeight.medium,fontSize:fontSize.base,color:EPJ.redText}}>Commandes à valider</div><div style={{fontSize:fontSize.xs,color:EPJ.gray}}>{pendingCount} en attente</div></div>
        </div>}
        <div onClick={()=>setView('history')} className="epj-card clickable" style={{cursor:'pointer',display:'flex',alignItems:'center',gap:space.md + 2}}>
          <div style={{width:48,height:48,borderRadius:radius.lg,background:EPJ.gray100,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>📋</div>
          <div><div style={{fontWeight:fontWeight.medium,fontSize:fontSize.base,color:EPJ.dark}}>Historique</div><div style={{fontSize:fontSize.xs,color:EPJ.gray}}>{myHistoryCount} commande{myHistoryCount>1?'s':''}</div></div>
        </div>
        {/* v1.17.2 — Carte "À commander" élargie : Admin/Direction/Achat/Assistante voient toutes,
            Conducteurs travaux / Chefs de chantier / users directAchat voient les leurs */}
        {canSeeToOrder() && toOrderCount > 0 && (
          <div onClick={()=>setView('toOrder')} className="epj-card clickable" style={{cursor:'pointer',display:'flex',alignItems:'center',gap:space.md + 2,borderLeft:`3px solid ${EPJ.orange}`}}>
            <div style={{width:48,height:48,borderRadius:radius.lg,background:`${EPJ.orange}1A`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,position:'relative',flexShrink:0}}>📦<div style={{position:'absolute',top:-4,right:-4,background:EPJ.orange,color:EPJ.white,borderRadius:'50%',width:22,height:22,fontSize:fontSize.xs,fontWeight:fontWeight.semibold,display:'flex',alignItems:'center',justifyContent:'center',border:`2px solid ${EPJ.white}`,fontVariantNumeric:'tabular-nums'}}>{toOrderCount}</div></div>
            <div><div style={{fontWeight:fontWeight.medium,fontSize:fontSize.base,color:EPJ.orangeText}}>À commander</div><div style={{fontSize:fontSize.xs,color:EPJ.gray}}>{toOrderCount} commande{toOrderCount>1?'s':''} à passer chez le fournisseur</div></div>
          </div>
        )}
        {user.fonction==="Admin"&&<div onClick={()=>{setAdminSection(null);setSelectedCat(null);setSearch('');setView('admin')}} className="epj-card clickable" style={{cursor:'pointer',display:'flex',alignItems:'center',gap:space.md + 2}}>
          <div style={{width:48,height:48,borderRadius:radius.lg,background:EPJ.gray100,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>⚙️</div>
          <div><div style={{fontWeight:fontWeight.medium,fontSize:fontSize.base,color:EPJ.dark}}>Administration</div><div style={{fontSize:fontSize.xs,color:EPJ.gray}}>Chantiers, utilisateurs, catalogue</div></div>
        </div>}
        </div>
      </div>
    </div>
  );

  // ═══ CATALOG ═══
  if(view==="catalog") return (
    <div style={wrapStyle(1100, { paddingBottom: 80 })}>
      <Header title={selectedCat||(orderType==='chantier'?'Catalogue Chantier':'Catalogue Équipement')} back={true} backView={selectedCat?'cats':'home'}/>
      <div style={{padding:`${space.sm}px ${space.md}px`,background:EPJ.dark}}>
        <input className="epj-input" placeholder="Rechercher article, référence..." value={search} onChange={e=>setSearch(e.target.value)} style={{background:'rgba(255,255,255,.1)',border:'none',color:EPJ.white}}/>
      </div>
      <div style={{padding:space.md}}>
        {!selectedCat&&!search ? (
          <>
            {!configLoaded ? (
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:`${space.xxl + 8}px ${space.xl}px`,gap:space.sm + 2,color:EPJ.gray}}>
                <div style={{width:20,height:20,border:`3px solid ${EPJ.blue}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
                <span style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium}}>Chargement du catalogue…</span>
              </div>
            ) : (
            <div style={{display:'grid',gridTemplateColumns:isPwa?'1fr 1fr':'repeat(auto-fill,minmax(150px,1fr))',gap:space.sm}}>
              {availableCategories.map(cat=>(
                <div key={cat} onClick={()=>setSelectedCat(cat)} style={{background:EPJ.white,borderRadius:radius.lg,padding:`${space.md + 2}px ${space.sm + 2}px`,cursor:'pointer',textAlign:'center',fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.dark,boxShadow:shadow.sm,lineHeight:1.3,border:`1px solid ${EPJ.gray200}`}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',marginBottom:space.xs}}><CatIcon cat={cat} size={40}/></div>{cat}
                </div>
              ))}
            </div>
            )}
            <div onClick={()=>setShowDivers(true)} style={{marginTop:space.sm + 2,background:EPJ.white,borderRadius:radius.lg,padding:space.md + 2,cursor:'pointer',textAlign:'center',border:`2px dashed ${EPJ.blue}`,color:EPJ.blue,fontWeight:fontWeight.medium,fontSize:fontSize.sm}}>+ Article divers</div>
          </>
        ) : (
          Object.keys(grouped).length===0 ? <div style={{textAlign:'center',padding:`${space.xxl + 8}px ${space.xl}px`,color:EPJ.gray500}}><div style={{fontSize:40,marginBottom:space.sm,opacity:.7}}>🔍</div><div style={{fontWeight:fontWeight.medium,color:EPJ.gray600}}>Aucun résultat</div></div>
          : Object.entries(grouped).map(([g,items])=>(
            <div key={g}>
              <div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.gray,textTransform:'uppercase',letterSpacing:'0.03em',margin:`${space.md + 2}px 0 6px`,paddingLeft:space.xs}}>{g}</div>
              {items.map(p=>(
                <div key={p.r} className="epj-row">
                  <Thumb cat={p.c} imageUrl={p.img}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.dark,lineHeight:1.3}}>{p.n}</div>
                    <div style={{fontSize:fontSize.xs,color:EPJ.gray,marginTop:2,fontFamily:fontFamilies.mono}}>{p.r} • {p.u||'Pièce'} <span style={{marginLeft:space.xs,verticalAlign:'middle'}}><Badge tone={p.stock===false?'warning':'success'} label={p.stock===false?'Hors stock':'En stock'}/></span></div>
                  </div>
                  {cart[p.r] ? <QtyControl r={p.r} value={cart[p.r]} compact={true}/> : <button aria-label={`Ajouter ${p.n}`} onClick={()=>addToCart(p.r)} style={{width:36,height:36,borderRadius:radius.md,border:'none',background:EPJ.blue,color:EPJ.white,fontSize:fontSize.lg,cursor:'pointer',fontWeight:fontWeight.medium,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>+</button>}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:isPwa?520:1100,background:EPJ.white,padding:`${space.sm + 2}px ${space.lg}px`,boxShadow:'0 -2px 10px rgba(0,0,0,.06)',display:'flex',gap:space.sm,zIndex:100}}>
        {/* v10.G : "← Accueil" devient "← Retour" et ramène à la PAGE PRÉCÉDENTE
            (liste des catégories si on est dans une catégorie, sinon home du module). */}
        <Button
          variant="secondary"
          onClick={()=>{
            if(selectedCat){ setSelectedCat(null); setSearch(''); }
            else { setView('home'); setSearch(''); }
          }}
          title="Retour à l'écran précédent"
        >← Retour</Button>
        {cartCount>0&&<div style={{flex:1}}><Button full onClick={()=>setView('cart')}>🛒 Panier ({cartCount})</Button></div>}
      </div>
      {toast&&<div style={{position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:EPJ.white,padding:`${space.sm}px ${space.xl - 4}px`,borderRadius:radius.pill,fontSize:fontSize.sm,fontWeight:fontWeight.medium,zIndex:200,animation:'fadeUp .3s ease'}}>{toast}</div>}
      {showDivers&&<div style={{position:'fixed',inset:0,background:EPJ.scrim,zIndex:300,display:'flex',alignItems:isPwa?'flex-end':'center',justifyContent:'center'}} onClick={()=>setShowDivers(false)}>
        <div style={{background:EPJ.white,borderRadius:isPwa?`${radius.xl + 4}px ${radius.xl + 4}px 0 0`:radius.xl,padding:`${space.xl}px ${space.xl - 4}px ${isPwa?space.xxl - 2:space.xl}px`,width:'100%',maxWidth:520,boxShadow:shadow.lg}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:fontSize.lg,fontWeight:fontWeight.medium,color:EPJ.dark,marginBottom:space.lg}}>Article divers</div>
          <div style={{marginBottom:space.sm + 2}}><Field label="Désignation" required value={diversName} onChange={e=>setDiversName(e.target.value)} placeholder="Description"/></div>
          <div style={{marginBottom:space.sm + 2}}><Field label="Référence" value={diversRef} onChange={e=>setDiversRef(e.target.value)} placeholder="Optionnel"/></div>
          <div style={{marginBottom:space.lg}}><Field label="Quantité" type="number" min="1" width={120} value={diversQty} onChange={e=>setDiversQty(parseInt(e.target.value)||1)}/></div>
          <Button full onClick={()=>{if(diversName.trim()){const ref=diversRef.trim()||`DIV-${Date.now()}`;const newArticle={c:'Divers',s:'Article libre',r:ref,n:diversName.trim(),u:'Pièce',stock:false};setDynCatalog(prev=>[...prev,newArticle]);setCart(p=>({...p,[ref]:diversQty}));setDiversName('');setDiversRef('');setDiversQty(1);setShowDivers(false);showT('✓ Ajouté au panier')}}} disabled={!diversName.trim()}>Ajouter au panier</Button>
        </div>
      </div>}
      <QtyPopupOverlay/>
    </div>
  );

  // ═══ CART ═══
  if(view==="cart"){
    const cg={};cartItems.forEach(i=>{if(!cg[i.c])cg[i.c]=[];cg[i.c].push(i)});
    return (
      <div style={wrapStyle(720, { paddingBottom: 80 })}>
        <Header title="Panier" back={true} backView="catalog" showCart={false}/>
        <div style={{padding:`6px ${space.md}px`,background:EPJ.dark,color:'rgba(255,255,255,.6)',fontSize:fontSize.xs,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>{user.prenom} {user.nom} • {orderType==='chantier'?'Chantier':'Équipement'}</span>
          {cartItems.length>0&&<button onClick={()=>{setCart({});showT('Panier vidé')}} style={{background:'rgba(255,255,255,.1)',border:'none',color:EPJ.white,borderRadius:radius.sm,padding:`${space.xs}px ${space.sm + 2}px`,fontSize:fontSize.xs,cursor:'pointer',fontFamily:font}}>🗑 Vider</button>}
        </div>
        <div style={{padding:space.md}}>
          {cartItems.length===0?<div style={{textAlign:'center',padding:`${space.xxl + 16}px ${space.xl}px`,color:EPJ.gray500}}><div style={{fontSize:40,marginBottom:space.sm,opacity:.7}}>🛒</div><div style={{fontWeight:fontWeight.medium,color:EPJ.gray600}}>Panier vide</div></div>:(
            <>
              {Object.entries(cg).map(([cat,items])=>(
                <div key={cat}>
                  <div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.gray,textTransform:'uppercase',letterSpacing:'0.03em',margin:`${space.md}px 0 6px`,display:'flex',alignItems:'center',gap:6}}><CatIcon cat={cat} size={16}/> {cat}</div>
                  {items.map(it=>(
                    <div key={it.r} className="epj-row">
                      <Thumb cat={it.c} imageUrl={it.img}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.dark}}>{it.n}</div>
                        <div style={{fontSize:fontSize.xs,color:EPJ.gray,fontFamily:fontFamilies.mono}}>{it.r}</div>
                      </div>
                      <QtyControl r={it.r} value={cart[it.r]} showDelete={true}/>
                    </div>
                  ))}
                </div>
              ))}
              <div className="epj-card" style={{marginTop:space.md + 2}}>
                <div style={{display:'flex',justifyContent:'space-between',fontWeight:fontWeight.medium,color:EPJ.dark,fontVariantNumeric:'tabular-nums'}}><span>Total</span><span>{cartCount} articles</span></div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:fontSize.xs,color:EPJ.gray,marginTop:space.xs,fontVariantNumeric:'tabular-nums'}}><span>Références</span><span>{cartItems.length}</span></div>
              </div>
            </>
          )}
        </div>
        {cartItems.length>0&&<div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:isPwa?520:720,background:EPJ.white,padding:`${space.sm + 2}px ${space.lg}px`,boxShadow:'0 -2px 10px rgba(0,0,0,.06)',display:'flex',gap:space.sm,zIndex:100}}>
          <Button variant="secondary" onClick={()=>setView('catalog')}>← Catalogue</Button>
          <div style={{flex:1}}><Button full onClick={()=>setView('details')}>Finaliser →</Button></div>
        </div>}
        <QtyPopupOverlay/>
      </div>
    );
  }

  // ═══ ORDER DETAILS ═══
  if(view==="details") return (
    <div style={wrapStyle(720, { paddingBottom: 80 })}>
      <Header title="Détails commande" back={true} backView="cart" showCart={false}/>
      <div style={{padding:space.md}}>
        <div className="epj-card" style={{marginBottom:space.sm + 2}}>
          {orderType==='chantier'?(
            <>
              <div style={{marginBottom:space.md}}>
                {!showNewChantier?(<>
                  <Field as="select" label="Chantier" required value={chantier} onChange={e=>setChantier(e.target.value)}
                    options={[{value:'',label:'-- Sélectionnez --'},...dynChantiers.filter(c=>c.statut==='Actif').map(c=>({value:c.nom,label:`[${c.num}] ${c.nom}`}))]}/>
                  {/* N° affaire auto */}
                  {selectedChantierObj&&<div style={{marginTop:6,fontSize:fontSize.xs,color:EPJ.blueText,fontWeight:fontWeight.medium}}>📋 N° Affaire : {selectedChantierObj.num} — Conducteur : {selectedChantierObj.conducteur}</div>}
                  {(user.fonction==='Conducteur de travaux'||user.fonction==='Admin')&&<button onClick={()=>setShowNewChantier(true)} style={{background:'none',border:'none',color:EPJ.blue,fontSize:fontSize.xs,fontWeight:fontWeight.medium,cursor:'pointer',marginTop:6,fontFamily:font}}>+ Nouveau chantier</button>}
                </>):(<>
                  <Field label="Nouveau chantier" value={newChantier} onChange={e=>setNewChantier(e.target.value)} placeholder="Nom du nouveau chantier"/>
                  <button onClick={()=>setShowNewChantier(false)} style={{background:'none',border:'none',color:EPJ.gray,fontSize:fontSize.xs,cursor:'pointer',marginTop:6,fontFamily:font}}>← Chantier existant</button>
                </>)}
              </div>
              <div style={{marginBottom:space.md}}><label style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.gray700,display:'block',marginBottom:space.xs + 2}}>Livraison</label>
                <div style={{display:'flex',gap:space.sm}}>
                  {['Dépôt','Chantier'].map(l=>(<div key={l} style={{flex:1}}><Button full variant={livraison===l?'primary':'secondary'} onClick={()=>setLivraison(l)}>{l==='Chantier'?'🏗️':'🏭'} {l}</Button></div>))}
                </div>
              </div>
            </>
          ):(
            <div style={{marginBottom:space.md}}>
              <Field as="select" label="Salarié destinataire" value={targetSalarie} onChange={e=>setTargetSalarie(e.target.value)}
                options={[{value:'',label:`Moi-même (${user.prenom} ${user.nom})`},...dynUsers.filter(u=>u.id!==user.id).map(u=>({value:`${u.prenom} ${u.nom}`,label:`${u.prenom} ${u.nom}`}))]}/>
            </div>
          )}
          <div style={{marginBottom:space.md}}><Field label="Date de réception souhaitée" type="date" value={dateReception} onChange={e=>setDateReception(e.target.value)}/></div>
          <div style={{marginBottom:space.md}}><label style={{display:'flex',alignItems:'center',gap:space.sm,cursor:'pointer'}}><input type="checkbox" checked={urgent} onChange={e=>setUrgent(e.target.checked)} style={{width:20,height:20,accentColor:EPJ.red}}/><span style={{fontSize:fontSize.md,fontWeight:fontWeight.medium,color:urgent?EPJ.redText:EPJ.dark}}>⚠️ Commande URGENTE</span></label></div>
          <div style={{marginBottom:space.md}}><Field label="Email supplémentaire" type="email" value={extraEmail} onChange={e=>setExtraEmail(e.target.value)} placeholder="email@exemple.fr"/></div>
          <div><Field as="textarea" label="Remarques" rows={3} value={remarques} onChange={e=>setRemarques(e.target.value)} placeholder="Instructions..."/></div>
        </div>
      </div>
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:isPwa?520:720,background:EPJ.white,padding:`${space.sm + 2}px ${space.lg}px`,boxShadow:'0 -2px 10px rgba(0,0,0,.06)',display:'flex',gap:space.sm,zIndex:100}}>
        <Button variant="secondary" onClick={()=>setView('cart')}>← Panier</Button>
        <div style={{flex:1}}><Button full onClick={()=>setView('confirm')} disabled={orderType==='chantier'&&!chantier&&!newChantier}>Récapitulatif →</Button></div>
      </div>
    </div>
  );

  // ═══ CONFIRM ═══
  if(view==="confirm"){
    const byFourn={};cartItems.forEach(it=>{const c=it.r.split(' ')[0].substring(0,3).toUpperCase();if(!byFourn[c])byFourn[c]=[];byFourn[c].push(it)});
    const needsVal=orderType==='chantier'&&!user.directAchat;
    return (
      <div style={wrapStyle(720, { paddingBottom: 80 })}>
        <Header title="Confirmation" back={true} backView="details" showCart={false}/>
        <div style={{padding:space.md}}>
          <div className="epj-card" style={{marginBottom:space.sm + 2}}>
            {/* v10.G.2 : en mode édition, on affiche le numéro existant + bandeau */}
            {editingOrder?.editMode === 'rework' && (
              <Banner
                tone="info"
                icon="✏️"
                title={`Modification de la commande ${editingOrder.num}`}
                text={<>
                  {editingOrder._originalStatut === "Envoyée aux achats" && (
                    <div>⚠️ Cette commande a déjà été envoyée aux achats. La modification les rendra incohérents — la Direction sera notifiée.</div>
                  )}
                  {!user.directAchat && (
                    <div>Après enregistrement, la commande repassera en attente de validation par le conducteur.</div>
                  )}
                </>}
              />
            )}
            <div style={{fontSize:fontSize.base,fontWeight:fontWeight.medium,color:EPJ.dark,marginBottom:space.md,fontFamily:fontFamilies.mono}}>{editingOrder?.editMode==='rework' ? editingOrder.num : numCmd()}</div>
            {urgent&&<div style={{marginBottom:space.sm + 2}}><Badge status="urgent" label="Urgent"/></div>}
            {needsVal&&<div style={{background:EPJ.warningBg,color:EPJ.orangeText,padding:`${space.sm}px ${space.md}px`,borderRadius:radius.sm + 2,fontSize:fontSize.xs,fontWeight:fontWeight.medium,marginBottom:space.sm + 2}}>⏳ Soumise à validation ({selectedChantierObj?.conducteur})</div>}
            <div style={{background:EPJ.gray50,borderRadius:radius.md,padding:space.md,fontSize:fontSize.sm,lineHeight:1.8,color:EPJ.dark}}>
              <strong>Demandeur :</strong> {user.prenom} {user.nom}<br/>
              {orderType==='chantier'&&<><strong>Chantier :</strong> {showNewChantier?newChantier:chantier}<br/>{selectedChantierObj&&<><strong>N° Affaire :</strong> {selectedChantierObj.num}<br/></>}<strong>Livraison :</strong> {livraison}<br/></>}
              {orderType==='equipement'&&<><strong>Destinataire :</strong> {targetSalarie||`${user.prenom} ${user.nom}`}<br/></>}
              <strong>Articles :</strong> {cartCount} ({cartItems.length} réf.)<br/>
              {remarques&&<><strong>Remarques :</strong> {remarques}<br/></>}
              <strong>Envoi à :</strong> {needsVal?`${selectedChantierObj?.conducteur} (validation)`:'Achats directement'}
            </div>
          </div>
          <div className="epj-card">
            <div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.dark,marginBottom:space.sm}}>Articles par fournisseur</div>
            <div style={{maxHeight:250,overflowY:'auto'}}>
              {Object.entries(byFourn).sort(([a],[b])=>a.localeCompare(b)).map(([code,items])=>(
                <div key={code} style={{marginBottom:space.sm + 2}}>
                  <div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.blueText,marginBottom:space.xs,fontFamily:fontFamilies.mono}}>▸ {code}</div>
                  {items.map(it=>(<div key={it.r} style={{display:'flex',justifyContent:'space-between',fontSize:fontSize.xs,padding:'3px 0',borderBottom:`1px solid ${EPJ.gray100}`}}><span style={{color:EPJ.dark,flex:1}}>{it.n}</span><span style={{color:EPJ.blueText,fontWeight:fontWeight.medium,marginLeft:space.sm,fontVariantNumeric:'tabular-nums'}}>x{it.qty}</span></div>))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:isPwa?520:720,background:EPJ.white,padding:`${space.sm + 2}px ${space.lg}px`,boxShadow:'0 -2px 10px rgba(0,0,0,.06)',display:'flex',gap:space.sm,zIndex:100}}>
          <Button variant="secondary" onClick={()=>setView('details')}>← Modifier</Button>
          {/* v10.G.2 — Libellé adapté en mode édition d'une commande existante */}
          <div style={{flex:1}}>
            <Button full onClick={sendOrder} disabled={sending} loading={sending}>
              {editingOrder?.editMode==='rework' ? '💾 Enregistrer les modifications' : (needsVal ? '📤 Soumettre' : '✉️ Envoyer + PDF')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ═══ DONE ═══
  if(view==="done"){
    const o=lastSentOrder||history[0];
    const wasV=o?.statut==="En attente de validation";
    
    const mailDest = o ? (o.extraEmail ? `${dynEmailAchats},${o.extraEmail}` : dynEmailAchats) : dynEmailAchats;
    const mailSubj = o ? `${o.urgent?'⚠️ URGENT — ':''}Commande ${o.num} — ${o.chantier||o.salarie}` : '';
    const buildMailBody = () => {
      if(!o) return '';
      const oItems = o.items||[];
      let b = `BON DE COMMANDE ${o.num}\nDate : ${o.date}\n`;
      if(o.urgent) b += `⚠️ COMMANDE URGENTE\n`;
      b += `\nDemandeur : ${o.user}\n`;
      if(o.type==='chantier') { b += `Chantier : ${o.chantier}\nN° Affaire : ${o.numAffaire||o.chantierNum||''}\n`; }
      else { b += `Destinataire : ${o.salarie}\n`; }
      b += `\n--- ARTICLES ---\n`;
      oItems.forEach(it => { b += `• ${it.r} — ${it.n} — Qté: ${it.qty} ${it.u||'Pièce'}\n`; });
      b += `\nTOTAL : ${oItems.reduce((s,i)=>s+(i.qty||0),0)} articles\n\nCordialement,\n${o.user}\nEPJ — Électricité Générale`;
      return b;
    };
    const mailtoUrl = `mailto:${mailDest}?subject=${encodeURIComponent(mailSubj)}&body=${encodeURIComponent(buildMailBody())}`;

    return(
    <div style={wrapStyle(720, { textAlign:'center', padding:`${space.xxl - 2}px ${space.lg}px` })}>
      <div style={{fontSize:56,marginBottom:space.md}}>{wasV?'📤':'✅'}</div>
      <div style={{fontSize:fontSize.xl,fontWeight:fontWeight.medium,color:EPJ.dark,marginBottom:6}}>{wasV?'Commande soumise !':'Commande enregistrée !'}</div>
      <div style={{fontSize:fontSize.sm,color:EPJ.gray,lineHeight:1.6,marginBottom:space.lg}}>{wasV?'Transmise au conducteur pour validation.':'Enregistrée dans Firebase. Utilisez les boutons ci-dessous.'}</div>
      {o&&(()=>{const s=getStatusDisplay(o);return(<div style={{background:EPJ.white,border:`1px solid ${EPJ.gray200}`,borderRadius:radius.lg,padding:space.md + 2,marginBottom:space.lg,textAlign:'left',fontSize:fontSize.sm}}><div style={{fontWeight:fontWeight.medium,fontFamily:fontFamilies.mono}}>{o.num}{(o.numAffaire||o.chantierNum)?` — N°${o.numAffaire||o.chantierNum}`:''}</div><div style={{marginTop:space.xs}}><Badge status={s.status} label={s.label} dot/></div></div>);})()}

      {!wasV&&<div style={{display:'flex',flexDirection:'column',gap:space.sm + 2,marginBottom:space.lg}}>
        <a href={mailtoUrl} style={{textDecoration:'none',display:'block',background:EPJ.blue,color:EPJ.white,padding:`${space.md}px`,fontSize:fontSize.base,fontWeight:fontWeight.medium,fontFamily:font,borderRadius:radius.md,textAlign:'center'}}>✉️ Envoyer par email</a>
        <Button full variant="secondary" onClick={()=>generateAndOpenPdf(o)}>📄 Voir / Télécharger le PDF</Button>
        {o&&o.type==='equipement'&&(
          o.signatureData
            ? <div style={{background:EPJ.successBg,borderRadius:radius.lg,padding:`${space.md}px ${space.lg}px`,display:'flex',alignItems:'center',gap:space.sm + 2,border:`1px solid ${EPJ.green}66`}}>
                <span style={{fontSize:24}}>✅</span>
                <div><div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.greenText}}>Réception confirmée</div><div style={{fontSize:fontSize.xs,color:EPJ.greenText,opacity:.85}}>Signée le {o.dateReceptionEffective||o.date}</div></div>
              </div>
            : <Button full variant="secondary" onClick={()=>openReceptionSheet(o)}>✍️ Feuille de réception + Signature</Button>
        )}
      </div>}

      {/* Aperçu rapide */}
      {pdfOrder&&<div style={{marginBottom:space.lg}}>
        <div style={{background:EPJ.dark,color:EPJ.white,padding:`${space.sm}px ${space.md + 2}px`,borderRadius:`${radius.lg}px ${radius.lg}px 0 0`,fontSize:fontSize.xs,fontWeight:fontWeight.medium}}>Aperçu du bon de commande</div>
        <div style={{border:`1px solid ${EPJ.gray200}`,borderTop:'none',borderRadius:`0 0 ${radius.lg}px ${radius.lg}px`,overflow:'hidden',maxHeight:300,overflowY:'auto'}}>
          <PdfView order={pdfOrder}/>
        </div>
      </div>}
      <Button full variant={wasV?'primary':'secondary'} onClick={()=>{clearOrder();setPdfOrder(null);setLastSentOrder(null);setView('home')}}>🏠 Nouvelle commande</Button>
    </div>
  )}

  // ═══ VALIDATION CONFIRMÉE (conducteur vient de valider) ═══
  // ═══ VALIDATE EDIT (v10.D.2) ═══
  // Écran d'édition de commande pour le conducteur avant validation :
  // - Modifier quantités
  // - Retirer des références
  // - Ajouter de nouvelles références (via catalogue)
  // - Modifier la date de réception souhaitée
  // Puis 2 choix : Valider + envoyer immédiatement / Valider + envoyer plus tard
  if(view==="validateEdit" && editingOrder) {
    const o = editingOrder;
    const totalRefs = editingItems.length;
    const totalQty = editingItems.reduce((s, it) => s + (Number(it.qty) || 0), 0);

    const updateItemQty = (idx, newQty) => {
      const q = Math.max(0, parseInt(newQty, 10) || 0);
      if (q === 0) {
        if (!confirm("Retirer cette référence de la commande ?")) return;
        setEditingItems(its => its.filter((_, i) => i !== idx));
      } else {
        setEditingItems(its => its.map((it, i) => i === idx ? {...it, qty: q} : it));
      }
    };

    const removeItem = (idx) => {
      if (!confirm("Retirer cette référence de la commande ?")) return;
      setEditingItems(its => its.filter((_, i) => i !== idx));
    };

    const addItemFromCatalog = () => {
      // Ouvre le catalogue en mode "ajout à commande en édition"
      // On stocke l'intention dans un state, le catalogue classique ajoute au panier,
      // donc on passe par une astuce : on met view=catalog et on récupère au retour.
      // Simple pour MVP : demander ref + nom + qté + unité à la main.
      const ref = prompt("Référence article :");
      if (!ref) return;
      const nom = prompt("Désignation :");
      if (!nom) return;
      const qtyStr = prompt("Quantité :", "1");
      const qty = parseInt(qtyStr, 10);
      if (!qty || qty <= 0) return;
      const unite = prompt("Unité (Pièce, M, Kg, Rouleau...) :", "Pièce") || "Pièce";
      setEditingItems(its => [...its, { r: ref.trim(), n: nom.trim(), qty, u: unite.trim() }]);
    };

    const saveAndSendMail = async () => {
      if (editingItems.length === 0) {
        alert("❌ La commande doit contenir au moins une référence.");
        return;
      }
      const updated = await saveValidatedOrder(true);
      if (updated) {
        setView('validateConfirm');
      }
    };

    const saveLater = async () => {
      if (editingItems.length === 0) {
        alert("❌ La commande doit contenir au moins une référence.");
        return;
      }
      const updated = await saveValidatedOrder(false);
      if (updated) {
        setEditingOrder(null);
        setEditingItems([]);
        setView('history');
      }
    };

    const cancel = () => {
      if (!confirm("Abandonner les modifications et revenir à la liste ?")) return;
      setEditingOrder(null);
      setEditingItems([]);
      setView('pending');
    };

    return (
      <div style={wrapStyle(720)}>
        <Header title="Valider la commande" back={false} showCart={false}/>
        <div style={{padding:space.md}}>
          {/* Infos commande */}
          <div className="epj-card" style={{padding:space.md + 2,marginBottom:space.sm + 2}}>
            <div style={{fontSize:fontSize.md,fontWeight:fontWeight.medium,color:EPJ.dark,marginBottom:space.xs,fontFamily:fontFamilies.mono}}>{o.num}</div>
            <div style={{fontSize:fontSize.xs,color:EPJ.gray,marginBottom:2}}>{o.date} • par {o.user}</div>
            {o.type === 'chantier' && (
              <div style={{fontSize:fontSize.xs,color:EPJ.blueText,marginBottom:2}}>🏗 [{o.numAffaire || o.chantierNum || '?'}] {o.chantier}</div>
            )}
            {o.urgent && (
              <div style={{marginTop:2}}><Badge status="urgent" label="Urgent"/></div>
            )}
            {o.remarques && (
              <div style={{fontSize:fontSize.xs,color:EPJ.orangeText,marginTop:6,padding:6,background:EPJ.warningBg,borderRadius:radius.sm,borderLeft:`3px solid ${EPJ.orange}`}}>
                <strong>Remarque :</strong> {o.remarques}
              </div>
            )}
          </div>

          {/* Liste articles éditable */}
          <div className="epj-card" style={{padding:space.md + 2,marginBottom:space.sm + 2}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:space.sm + 2}}>
              <div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.dark}}>Articles à commander</div>
              <div style={{fontSize:fontSize.xs,color:EPJ.gray,fontVariantNumeric:'tabular-nums'}}>{totalRefs} réf. · {totalQty} pcs</div>
            </div>

            {editingItems.length === 0 && (
              <div style={{
                padding:space.lg,textAlign:'center',color:EPJ.gray500,fontSize:fontSize.xs,
                background:EPJ.gray50,borderRadius:radius.sm + 2,marginBottom:space.sm + 2,
              }}>
                Aucune référence — ajoute au moins un article pour valider.
              </div>
            )}

            {editingItems.map((it, idx) => (
              <div key={idx} style={{
                display:'flex',alignItems:'center',gap:space.sm,
                padding:`${space.sm}px 0`,borderBottom:`1px solid ${EPJ.gray100}`,
              }}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.dark,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                    {it.n}
                  </div>
                  <div style={{fontSize:fontSize.xs,color:EPJ.gray,fontFamily:fontFamilies.mono}}>
                    {it.r} · {it.u || 'Pièce'}
                  </div>
                </div>
                <Field
                  dense width={64}
                  type="number" min="0" value={it.qty || 0}
                  onChange={e => updateItemQty(idx, e.target.value)}
                  inputStyle={{textAlign:'center',fontWeight:fontWeight.medium,color:EPJ.blueText,fontVariantNumeric:'tabular-nums'}}
                />
                <IconButton variant="danger" label="Retirer cette référence" onClick={() => removeItem(idx)}>🗑</IconButton>
              </div>
            ))}

            <button
              onClick={addItemFromCatalog}
              style={{
                width:'100%',marginTop:space.sm + 2,
                background:EPJ.gray50,color:EPJ.dark,
                padding:space.sm + 2,fontSize:fontSize.sm,fontWeight:fontWeight.medium,
                border:`1px dashed ${EPJ.gray400}`,borderRadius:radius.md,
                cursor:'pointer',fontFamily:font,
              }}
            >➕ Ajouter une référence</button>
          </div>

          {/* Actions */}
          <div style={{display:'flex',flexDirection:'column',gap:space.sm}}>
            <Button full onClick={saveAndSendMail} disabled={editingItems.length === 0}>✅ Valider et envoyer aux achats</Button>
            <Button full variant="secondary" onClick={saveLater} disabled={editingItems.length === 0}>💾 Valider (envoyer plus tard)</Button>
            <Button full variant="ghost" onClick={cancel}>← Annuler</Button>
          </div>

          <div style={{
            fontSize:fontSize.xs,color:EPJ.gray500,marginTop:space.md,
            padding:`${space.sm}px ${space.sm + 2}px`,background:`${EPJ.blue}10`,
            borderRadius:radius.sm,lineHeight:1.4,
          }}>
            💡 <strong>Envoyer plus tard</strong> : la commande reste dans l'historique
            en attente d'envoi. Tu pourras l'envoyer quand tu voudras via le bouton
            « Envoyer aux achats ».
          </div>
        </div>
        {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:EPJ.white,padding:`${space.sm}px ${space.xl - 4}px`,borderRadius:radius.pill,fontSize:fontSize.sm,fontWeight:fontWeight.medium,zIndex:400}}>{toast}</div>}
      </div>
    );
  }

  if(view==="validateConfirm" && lastSentOrder) {
    const o = lastSentOrder;
    const mailDest = o.extraEmail ? `${dynEmailAchats},${o.extraEmail}` : dynEmailAchats;
    const mailSubj = `${o.urgent?'⚠️ URGENT — ':''}Commande ${o.num} — ${o.chantier||o.salarie}`;
    const buildBody = () => {
      const oItems = o.items||[];
      let b = `BON DE COMMANDE ${o.num}\nDate : ${o.date}\n`;
      if(o.urgent) b += `⚠️ COMMANDE URGENTE\n`;
      b += `\nDemandeur : ${o.user}\n`;
      if(o.type==='chantier'){ b += `Chantier : ${o.chantier}\nN° Affaire : ${o.numAffaire||o.chantierNum||''}\n`; }
      else { b += `Destinataire : ${o.salarie}\n`; }
      b += `\n--- ARTICLES ---\n`;
      oItems.forEach(it=>{ b += `• ${it.r} — ${it.n} — Qté: ${it.qty} ${it.u||'Pièce'}\n`; });
      b += `\nTOTAL : ${oItems.reduce((s,i)=>s+(i.qty||0),0)} articles\n\nCordialement,\n${user.prenom} ${user.nom}\nEPJ — Électricité Générale`;
      return b;
    };
    const mailtoUrl = `mailto:${mailDest}?subject=${encodeURIComponent(mailSubj)}&body=${encodeURIComponent(buildBody())}`;

    // v10.D.2 — CRITIQUE : le statut "Envoyée aux achats" ne passe que si on a VRAIMENT cliqué le bouton email
    // et confirmé. Sinon la commande reste "Validée" = en attente d'envoi dans l'historique.
    const handleEmailClick = () => {
      // Ouvre l'app mail
      window.location.href = mailtoUrl;
      // Après un court délai, demande confirmation que le mail a bien été envoyé
      setTimeout(() => {
        if (confirm(`Confirmes-tu que l'email de la commande ${o.num} a bien été envoyé ?\n\nSi oui, elle passera au statut "Envoyée aux achats".\nSi non, elle restera "à envoyer" dans l'historique.`)) {
          markOrderAsSent(o).then(() => {
            setPdfOrder(null);
            setLastSentOrder(null);
            setView('history');
          });
        }
      }, 1500);
    };

    return (
      <div style={wrapStyle(720, { textAlign:'center', padding:`${space.xxl - 2}px ${space.lg}px` })}>
        <div style={{fontSize:56,marginBottom:space.md}}>✅</div>
        <div style={{fontSize:fontSize.xl,fontWeight:fontWeight.medium,color:EPJ.dark,marginBottom:6}}>Commande validée !</div>
        <div style={{fontSize:fontSize.sm,color:EPJ.gray,lineHeight:1.6,marginBottom:space.lg}}>
          Elle est enregistrée en statut <strong>Validée</strong>.<br/>
          Clique sur <strong>« Envoyer par email »</strong> pour la transmettre
          aux achats — tu seras invité à confirmer l'envoi après.
        </div>
        <div style={{background:EPJ.white,border:`1px solid ${EPJ.gray200}`,borderRadius:radius.lg,padding:space.md + 2,marginBottom:space.lg,textAlign:'left',fontSize:fontSize.sm}}>
          <div style={{fontWeight:fontWeight.medium,fontFamily:fontFamilies.mono}}>{o.num}{(o.numAffaire||o.chantierNum)?` — N°${o.numAffaire||o.chantierNum}`:''}</div>
          <div style={{fontSize:fontSize.xs,color:EPJ.gray,marginTop:2}}>{o.date} • {o.user} • {o.chantier||o.salarie}</div>
          <div style={{marginTop:6}}><Badge status="Validée" label="Validée" dot/></div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:space.sm + 2,marginBottom:space.lg}}>
          <Button full onClick={handleEmailClick}>✉️ Envoyer par email aux achats</Button>
          <Button full variant="secondary" onClick={()=>generateAndOpenPdf(o)}>📄 Voir / Télécharger le PDF</Button>
        </div>
        <div style={{display:'flex',gap:space.sm}}>
          <div style={{flex:1}}><Button full variant="secondary" onClick={()=>setView('pending')}>← Autres commandes</Button></div>
          <div style={{flex:1}}><Button full variant="ghost" onClick={()=>{setPdfOrder(null);setLastSentOrder(null);setView('home')}}>🏠 Accueil</Button></div>
        </div>
        <div style={{
          fontSize:fontSize.xs,color:EPJ.gray500,marginTop:space.lg,textAlign:'left',
          padding:`${space.sm}px ${space.sm + 2}px`,background:`${EPJ.orange}10`,
          borderRadius:radius.sm,lineHeight:1.4,
        }}>
          💡 Tant que tu n'as pas confirmé l'envoi, la commande reste en
          statut <strong>Validée</strong> (= à envoyer) dans l'historique.
          Tu pourras la renvoyer plus tard via le bouton « Envoyer aux achats ».
        </div>
        {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:EPJ.white,padding:`${space.sm}px ${space.xl - 4}px`,borderRadius:radius.pill,fontSize:fontSize.sm,fontWeight:fontWeight.medium,zIndex:400}}>{toast}</div>}
      </div>
    );
  }

  // ═══ PENDING ═══
  if(view==="pending"){
    const fullName=`${user.prenom} ${user.nom}`;
    const myP=user.fonction==="Admin"?pendingOrders:pendingOrders.filter(o=>{const ch=dynChantiers.find(c=>c.nom===o.chantier);return ch&&ch.conducteur===fullName});
    return(
      <div style={wrapStyle(1100)}>
        <Header title="Commandes à valider" back={true} backView="home" showCart={false}/>
        <div style={{padding:space.md}}>
          {myP.length===0?<div style={{textAlign:'center',padding:`${space.xxl + 16}px ${space.xl}px`,color:EPJ.gray500}}><div style={{fontSize:40,marginBottom:space.sm,opacity:.7}}>✅</div><div style={{fontWeight:fontWeight.medium,color:EPJ.gray600}}>Aucune commande en attente</div></div>
          :<div style={{display:'grid',gridTemplateColumns:isPwa?'1fr':'repeat(auto-fill,minmax(380px,1fr))',gap:space.sm + 2,alignItems:'start'}}>
          {myP.map(o=>(
            <div key={o.num} className="epj-card">
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:space.sm + 2}}>
                <div><div style={{fontSize:fontSize.md,fontWeight:fontWeight.medium,color:EPJ.dark,fontFamily:fontFamilies.mono}}>{o.num}</div><div style={{fontSize:fontSize.xs,color:EPJ.gray}}>{o.date} • {o.user}</div><div style={{fontSize:fontSize.xs,color:EPJ.blueText}}>🏗️ [{o.numAffaire}] {o.chantier}</div>{o.urgent&&<div style={{marginTop:space.xs}}><Badge status="urgent" label="Urgent"/></div>}</div>
                <div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,fontVariantNumeric:'tabular-nums'}}>{(o.items||[]).length} réf.</div>
              </div>
              <div style={{background:EPJ.gray50,borderRadius:radius.sm + 2,padding:space.sm,marginBottom:space.sm + 2,maxHeight:120,overflowY:'auto'}}>
                {(o.items||[]).map(it=>(<div key={it.r} style={{display:'flex',justifyContent:'space-between',fontSize:fontSize.xs,padding:'2px 0'}}><span>{it.n}</span><span style={{color:EPJ.blueText,fontWeight:fontWeight.medium,fontVariantNumeric:'tabular-nums'}}>x{it.qty}</span></div>))}
              </div>
              <div style={{display:'flex',gap:space.sm}}>
                <div style={{flex:1}}><Button full onClick={()=>validateOrder(o.num)}>✅ Valider</Button></div>
                <div style={{flex:1}}><Button full variant="danger" onClick={()=>{setShowRefuseModal(o.num);setRefuseMotif('')}}>Refuser</Button></div>
              </div>
            </div>
          ))}
          </div>}
        </div>
        {showRefuseModal&&<div style={{position:'fixed',inset:0,background:EPJ.scrim,zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:space.xl - 4}} onClick={()=>setShowRefuseModal(null)}>
          <div style={{background:EPJ.white,borderRadius:radius.xl,padding:space.xl,width:'100%',maxWidth:400,boxShadow:shadow.lg}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:fontSize.lg,fontWeight:fontWeight.medium,color:EPJ.dark,marginBottom:space.lg}}>Motif de refus</div>
            <Field as="textarea" rows={3} value={refuseMotif} onChange={e=>setRefuseMotif(e.target.value)} placeholder="Motif..."/>
            <div style={{display:'flex',gap:space.sm,marginTop:space.md}}>
              <div style={{flex:1}}><Button full variant="secondary" onClick={()=>setShowRefuseModal(null)}>Annuler</Button></div>
              <div style={{flex:1}}><Button full variant="danger" onClick={()=>refuseOrder(showRefuseModal,refuseMotif)} disabled={!refuseMotif.trim()}>Confirmer</Button></div>
            </div>
          </div>
        </div>}
        {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:EPJ.white,padding:`${space.sm}px ${space.xl - 4}px`,borderRadius:radius.pill,fontSize:fontSize.sm,fontWeight:fontWeight.medium,zIndex:400}}>{toast}</div>}
      </div>
    );
  }

  // ═══ PDF PREVIEW (after validation) ═══
  if(view==="pdfPreview"&&pdfOrder) return(
    <div style={wrapStyle(720)}>
      <Header title="PDF Commande" back={true} backView="home" showCart={false}/>
      <div style={{padding:space.md}}>
        <PdfView order={pdfOrder}/>
        <div style={{marginTop:space.md}}><Button full onClick={()=>{setPdfOrder(null);setView('home')}}>← Commandes</Button></div>
      </div>
    </div>
  );

  // ═══ HISTORY ═══
  if(view==="history"){
    const fullName = `${user.prenom} ${user.nom}`;
    let myHistory = history.filter(h=>
      h && h.num &&
      h.statut !== "Scindée" &&
      // v1.17.3 — Exclure les reliquats de scission ("-2") en attente d'achat
      // (ils s'affichent dans "À commander", pas dans l'historique du demandeur)
      !(h.createdBySplit === true && h.statut === "Envoyée aux achats") &&
      // Reliquat "-2" parqué "Commander plus tard" : masqué tant qu'il est en "Validée".
      // Dès qu'il est commandé (→ Envoyée aux achats / Commandée), il réapparaît.
      !(h.createdBySplit === true && h.commanderPlusTard === true && h.statut === "Validée")
    );
    // v1.12.1 — Utilise can() au lieu de user.fonction (cf. myHistoryCount)
    const scope = can(user, "commandes", "view", rolesConfig);
    if (scope === "all") {
      // Admin, Direction, Achat → tout
    } else if (scope === "own_chantiers") {
      // Conducteur travaux, Chef chantier
      const mesChantiers = dynChantiers.filter(c=>c.conducteur===fullName).map(c=>c.nom);
      myHistory = myHistory.filter(h=>mesChantiers.includes(h.chantier)||h.user===fullName);
    } else if (scope === "own_items") {
      // Monteur, Artisan
      myHistory = myHistory.filter(h=>h.userId===user.id||h.user===fullName);
    } else {
      // Aucune visibilité (rôle sans droits ou config manquante)
      myHistory = [];
    }
    // Appliquer les filtres manuels
    if(historyFilter.statut) myHistory = myHistory.filter(h=>h.statut===historyFilter.statut);
    if(historyFilter.chantier) myHistory = myHistory.filter(h=>h.chantier===historyFilter.chantier);

    // v1.17.2 — Tri par date décroissante (plus récentes en premier)
    // Utilise createdAt (ISO précis à la milliseconde) en priorité, puis num
    // (CMD-2026-NNNN) comme tie-breaker. Les commandes scindées -1/-2 restent
    // groupées avec leur parent grâce au tri par num.
    myHistory.sort((a, b) => {
      const ta = a.createdAt || "";
      const tb = b.createdAt || "";
      if (ta && tb) return tb.localeCompare(ta);
      if (ta && !tb) return -1;
      if (!ta && tb) return 1;
      // Pas de createdAt : tri par num desc (CMD-2026-0053 avant CMD-2026-0052)
      return (b.num || "").localeCompare(a.num || "");
    });
    const deletables = myHistory.filter(h => canDeleteThisOrder(h));
    const deleteAll = async () => {
      if(!confirm(`Supprimer les ${deletables.length} commande(s) supprimable(s) parmi celles affichées ?`))return;
      let okCount = 0;
      for(const h of deletables){
        const ok = await performDeleteOrder(h, false);
        if (ok) okCount++;
      }
      showT(`🗑️ ${okCount} commande(s) supprimée(s)`);
    };
    const deleteOne = async (h) => {
      const ok = await performDeleteOrder(h, true);
      if (ok) showT("🗑️ Supprimée"); else showT("❌ Erreur");
    };
    // Lignes enrichies pour <DataTable> (tri sur valeurs réelles)
    const histRows = myHistory.map((h,i)=>({ ...h, _key: h._id || String(i), _refs:(h.items||[]).length, _cible: h.type==='chantier' ? `[${h.numAffaire||''}] ${h.chantier||''}` : (h.salarie||'') }));
    const histCols = [
      { key:'num', header:'N°', render:(v,h)=>(<span style={{fontFamily:fontFamilies.mono,fontSize:fontSize.sm}}>{h.urgent?'⚠️ ':''}{v}</span>) },
      { key:'date', header:'Date', sortable:false },
      { key:'user', header:'Demandeur' },
      { key:'_cible', header:'Chantier / Destinataire' },
      { key:'_refs', header:'Réf.', numeric:true },
      { key:'statut', header:'Statut', render:(_,h)=>{const s=getStatusDisplay(h);return <Badge status={s.status} label={s.label||'—'} dot/>;} },
      { key:'_del', header:'', sortable:false, align:'right', render:(_,h)=>canDeleteThisOrder(h)?(<IconButton variant="danger" label={`Supprimer ${h.num}`} onClick={async(e)=>{e.stopPropagation();await deleteOne(h);}}>🗑</IconButton>):null },
    ];
    return(
    <div style={wrapStyle(1100)}>
      <Header title="Historique" back={true} backView="home" showCart={false}/>
      <div style={{padding:`${space.sm}px ${space.md}px`,background:EPJ.white,borderBottom:`1px solid ${EPJ.gray200}`}}>
        <div style={{display:'flex',gap:space.sm,alignItems:'flex-end'}}>
          <div style={{flex:1}}>
            <Field as="select" dense value={historyFilter.statut} onChange={e=>setHistoryFilter(f=>({...f,statut:e.target.value}))}
              options={[{value:'',label:'Tous statuts'},...ORDER_STATUTS.map(s=>({value:s,label:s}))]}/>
          </div>
          <div style={{flex:1}}>
            <Field as="select" dense value={historyFilter.chantier} onChange={e=>setHistoryFilter(f=>({...f,chantier:e.target.value}))}
              options={[{value:'',label:'Tous chantiers'},...[...new Set(myHistory.filter(h=>h.chantier).map(h=>h.chantier))].map(c=>({value:c,label:c}))]}/>
          </div>
          {/* v10.I — Fix 1 : "Supprimer tout" affiché si au moins 1 commande supprimable */}
          {deletables.length > 0 && !isPwa && (
            <Button variant="danger" size="sm" onClick={deleteAll}>🗑️ Supprimer ({deletables.length})</Button>
          )}
        </div>
        {deletables.length > 0 && isPwa && (
          <div style={{marginTop:space.sm}}><Button full variant="danger" size="sm" onClick={deleteAll}>🗑️ Supprimer ({deletables.length})</Button></div>
        )}
      </div>
      <div style={{padding:space.md}}>
        {isPwa ? (
          myHistory.length===0?<div style={{textAlign:'center',padding:`${space.xxl + 16}px ${space.xl}px`,color:EPJ.gray500}}><div style={{fontSize:40,marginBottom:space.sm,opacity:.7}}>📋</div><div style={{fontWeight:fontWeight.medium,color:EPJ.gray600}}>Aucune commande</div></div>
          :myHistory.map((h,i)=>(
          <div key={h._id||i} className="epj-card" style={{marginBottom:space.sm,cursor:'pointer'}}>
            <div onClick={()=>{setSelectedOrder(h);setView('orderDetail')}} style={{display:'flex',justifyContent:'space-between'}}>
              <div><div style={{fontSize:fontSize.md,fontWeight:fontWeight.medium,color:EPJ.dark,fontFamily:fontFamilies.mono}}>{h.num}</div><div style={{fontSize:fontSize.xs,color:EPJ.gray}}>{h.date} • {h.user}</div><div style={{fontSize:fontSize.xs,color:EPJ.blueText,marginTop:2}}>{h.type==='chantier'?`🏗️ [${h.numAffaire||''}] ${h.chantier||''}`:`👷 ${h.salarie||''}`}</div></div>
              {(()=>{const s=getStatusDisplay(h);return(<div style={{textAlign:'right'}}><div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.dark,marginBottom:space.xs,fontVariantNumeric:'tabular-nums'}}>{(h.items||[]).length} réf.</div>{h.urgent&&<div style={{marginBottom:space.xs}}><Badge status="urgent" label="Urgent"/></div>}<Badge status={s.status} label={s.label||'—'} dot/></div>);})()}
            </div>
            {canDeleteThisOrder(h)&&<button onClick={async(e)=>{e.stopPropagation();await deleteOne(h);}} style={{marginTop:space.sm,width:'100%',background:EPJ.dangerBg,color:EPJ.redText,border:'none',borderRadius:radius.sm,padding:`${space.xs}px`,fontSize:fontSize.xs,cursor:'pointer',fontFamily:font}}>🗑️ Supprimer</button>}
          </div>
        ))) : (
          <DataTable
            columns={histCols}
            rows={histRows}
            keyField="_key"
            onRowClick={(h)=>{setSelectedOrder(h);setView('orderDetail')}}
            empty={{ icon:'📋', title:'Aucune commande', text:'Aucune commande ne correspond aux filtres.' }}
          />
        )}
      </div>
      {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:EPJ.white,padding:`${space.sm}px ${space.xl - 4}px`,borderRadius:radius.pill,fontSize:fontSize.sm,fontWeight:fontWeight.medium,zIndex:400}}>{toast}</div>}
    </div>
  );}

  // ═══ ORDER DETAIL ═══
  if(view==="orderDetail"&&selectedOrder){
    const o=selectedOrder;const byFourn={};(o.items||[]).forEach(it=>{const c=(it.r||'').split(' ')[0].substring(0,3).toUpperCase();if(!byFourn[c])byFourn[c]=[];byFourn[c].push(it)});
    return(
      <>
      {partialPassOrder && (
        <PartialPassSheet
          order={partialPassOrder}
          onClose={() => setPartialPassOrder(null)}
          onConfirm={async ({ orderedByIndex }) => {
            try {
              await performPartialPass(partialPassOrder, { orderedByIndex });
            } catch (e) {
              console.error("[v1.17] Scission — exception onConfirm:", e);
              showT("❌ Erreur — réessayez");
            } finally {
              // Toujours fermer la modale : empêche tout écran blanc même si une
              // erreur survient après les écritures Firestore.
              setPartialPassOrder(null);
            }
          }}
        />
      )}
      <div style={wrapStyle(720)}>
        <Header title={o.num} back={true} backView="history" showCart={false}/>
        <div style={{padding:space.md}}>
          <div className="epj-card" style={{marginBottom:space.sm + 2}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:space.md}}>
              <div style={{fontSize:fontSize.lg,fontWeight:fontWeight.medium,color:EPJ.dark,fontFamily:fontFamilies.mono}}>{o.num}</div>
              {(()=>{const s=getStatusDisplay(o);return(<Badge status={s.status} label={s.label} dot/>);})()}
            </div>
            {o.urgent&&<div style={{marginBottom:space.sm + 2}}><Badge status="urgent" label="Urgent"/></div>}
            {o.motifRefus&&<div style={{background:EPJ.dangerBg,color:EPJ.redText,padding:`${space.sm}px ${space.md}px`,borderRadius:radius.sm + 2,fontSize:fontSize.xs,fontWeight:fontWeight.medium,marginBottom:space.sm + 2}}>Motif : {o.motifRefus}</div>}
            <div style={{background:EPJ.gray50,borderRadius:radius.md,padding:space.md,fontSize:fontSize.sm,lineHeight:1.8,color:EPJ.dark}}>
              <strong>Date :</strong> {o.date}<br/><strong>Demandeur :</strong> {o.user}<br/>
              {o.chantier&&<><strong>Chantier :</strong> [{o.numAffaire}] {o.chantier}<br/></>}
              {o.type==='equipement'&&<><strong>Destinataire :</strong> {o.salarie}<br/></>}
              {o.livraison&&<><strong>Livraison :</strong> {o.livraison}<br/></>}
              {/* v10.J — Date réception : souhaitée + fournisseur (si OCR activé) côte à côte */}
              <strong>Réception souhaitée :</strong> {o.dateReception||'Non précisée'}<br/>
              {featureFlags.ocrArEnabled && o.datelivraison && (() => {
                const { date: dFournisseur } = getExpectedDeliveryDate(o, { featureFlags });
                return dFournisseur ? (
                  <span style={{background:EPJ.infoBg,padding:'2px 6px',borderRadius:radius.sm - 2,fontSize:fontSize.xs}}>
                    <strong style={{color:EPJ.blueText}}>📨 Livraison annoncée fournisseur :</strong> {formatDateFR(dFournisseur)}
                    {o.fournisseur ? <span style={{color:EPJ.blueText}}> ({o.fournisseur})</span> : null}
                  </span>
                ) : null;
              })()}
              {featureFlags.ocrArEnabled && o.datelivraison && <br/>}
              {o.remarques&&<><strong>Remarques :</strong> {o.remarques}<br/></>}
              {o.validePar&&<><strong>Validée par :</strong> {o.validePar}<br/></>}
              {o.dateEnvoiAchats&&<><strong>Envoyée le :</strong> {new Date(o.dateEnvoiAchats).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}<br/></>}
              {o.dateCommande&&<><strong>Commandée le :</strong> {new Date(o.dateCommande).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}<br/></>}
            </div>
          </div>

          {/* v10.D.2 — Actions workflow selon le statut ═══ */}
          {o.statut === "Validée" && (
            <div className="epj-card" style={{marginBottom:space.sm + 2,borderLeft:`3px solid ${EPJ.blue}`}}>
              <div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.blueText,marginBottom:space.sm,letterSpacing:'0.03em'}}>
                📤 À ENVOYER AUX ACHATS
              </div>
              <div style={{fontSize:fontSize.xs,color:EPJ.gray,marginBottom:space.sm + 2,lineHeight:1.4}}>
                Cette commande est validée mais n'a pas encore été envoyée aux achats.
                Clique sur le bouton ci-dessous pour l'envoyer par email.
              </div>
              <Button
                full
                onClick={() => {
                  const mailDest = o.extraEmail ? `${dynEmailAchats},${o.extraEmail}` : dynEmailAchats;
                  const mailSubj = `${o.urgent?'⚠️ URGENT — ':''}Commande ${o.num} — ${o.chantier||o.salarie}`;
                  const oItems = o.items||[];
                  let body = `BON DE COMMANDE ${o.num}\nDate : ${o.date}\n`;
                  if(o.urgent) body += `⚠️ COMMANDE URGENTE\n`;
                  body += `\nDemandeur : ${o.user}\n`;
                  if(o.type==='chantier'){ body += `Chantier : ${o.chantier}\nN° Affaire : ${o.numAffaire||o.chantierNum||''}\n`; }
                  else { body += `Destinataire : ${o.salarie}\n`; }
                  body += `\n--- ARTICLES ---\n`;
                  oItems.forEach(it=>{ body += `• ${it.r} — ${it.n} — Qté: ${it.qty} ${it.u||'Pièce'}\n`; });
                  body += `\nTOTAL : ${oItems.reduce((s,i)=>s+(i.qty||0),0)} articles\n\nCordialement,\n${user.prenom} ${user.nom}\nEPJ — Électricité Générale`;
                  const mailtoUrl = `mailto:${mailDest}?subject=${encodeURIComponent(mailSubj)}&body=${encodeURIComponent(body)}`;
                  window.location.href = mailtoUrl;
                  setTimeout(() => {
                    if (confirm(`Confirmes-tu que l'email de la commande ${o.num} a bien été envoyé ?\n\nSi oui, elle passera au statut "Envoyée aux achats".`)) {
                      markOrderAsSent(o).then(() => {
                        setSelectedOrder({...o, statut: "Envoyée aux achats", dateEnvoiAchats: new Date().toISOString()});
                      });
                    }
                  }, 1500);
                }}
              >📨 Envoyer aux achats par email</Button>
            </div>
          )}

          {/* v10.I — Fix 2 : bouton "Marquer commandée" réservé Admin/Direction/Assistante */}
          {/* v1.13.0 : ajout du bouton "Passer partiellement" à côté */}
          {(o.statut === "Envoyée aux achats" || o.statut === "Commandée partiellement") && canMarkAsCommandee() && (
            <div className="epj-card" style={{marginBottom:space.sm + 2,borderLeft:`3px solid ${EPJ.blue}`}}>
              <div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.blueText,marginBottom:space.sm,letterSpacing:'0.03em'}}>
                🛒 COMMANDE PASSÉE CHEZ LE FOURNISSEUR ?
              </div>
              <div style={{fontSize:fontSize.xs,color:EPJ.gray,marginBottom:space.sm + 2,lineHeight:1.4}}>
                {o.statut === "Commandée partiellement"
                  ? "Cette commande a déjà été passée partiellement. Tu peux passer le reste, ou continuer en partiel si certaines lignes sont encore indisponibles."
                  : "Une fois que tu as effectivement passé la commande chez le fournisseur (saisie dans l'ERP, accusé de réception reçu...), clique ici. Si tu n'as pas pu tout commander (rupture, attente stock), utilise le bouton « partiellement »."}
              </div>
              <div style={{display:'flex',gap:space.sm}}>
                <div style={{flex:2}}>
                  <Button
                    full
                    onClick={() => {
                      markOrderAsCommandee(o).then(() => {
                        setSelectedOrder({...o, statut: "Commandée", dateCommande: new Date().toISOString()});
                      });
                    }}
                  >🛒 Tout commandé</Button>
                </div>
                <div style={{flex:1}}>
                  <Button
                    full
                    variant="secondary"
                    onClick={() => setPartialPassOrder(o)}
                    title="Cocher ligne par ligne ce qui a été commandé"
                  >◐ Partiel…</Button>
                </div>
              </div>
            </div>
          )}

          {/* ─── v10.L — Intégration Esabora (Zapier) ─── */}
          {/* Visible si esaboraEnabled === true ET statut = Envoyée aux achats / Commandée
              v10.L.4 — Restriction aux mêmes rôles que "Marquer commandée" :
                        Admin + Direction + Assistante achats.
                        Les conducteurs travaux et autres rôles ne voient PAS le bouton. */}
          {featureFlags.esaboraEnabled
            && canMarkAsCommandee()
            && (o.statut === "Envoyée aux achats" || o.statut === "Commandée")
            && (() => {
            const st = o.esaboraStatus || "pending";
            const isSynced = st === "synced";
            const isPartial = st === "partial";
            const isError = st === "error";
            const isInProgress = st === "pending" && o.esaboraStartedAt
              && (Date.now() - new Date(o.esaboraStartedAt).getTime() < 30000);
            return (
              <div className="epj-card" style={{
                marginBottom:space.sm + 2,
                borderLeft:`3px solid ${isSynced ? EPJ.green : isError ? EPJ.red : isPartial ? EPJ.orange : EPJ.blue}`,
              }}>
                <div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,letterSpacing:'0.03em',
                  color: isSynced ? EPJ.greenText : isError ? EPJ.redText : isPartial ? EPJ.orangeText : EPJ.blueText,
                  marginBottom:space.sm}}>
                  🔗 SYNCHRONISATION ESABORA
                </div>

                {/* Statut */}
                {isSynced && (
                  <div style={{
                    background:EPJ.successBg,padding:`${space.sm}px ${space.sm + 2}px`,borderRadius:radius.sm,
                    fontSize:fontSize.xs,color:EPJ.greenText,marginBottom:space.sm,lineHeight:1.5,
                  }}>
                    ✅ Synchronisée le {o.esaboraSyncedAt ? new Date(o.esaboraSyncedAt).toLocaleString('fr-FR') : ''}
                    {o.esaboraSyncedBy ? ` par ${o.esaboraSyncedBy}` : ''}
                    {Array.isArray(o.esaboraResults) && (
                      <div style={{marginTop:space.xs,fontSize:fontSize.xs}}>
                        {o.esaboraResults.length} fournisseur(s) :
                        {o.esaboraResults.map(r => ` ${r.codeEsabora}✓`).join(",")}
                      </div>
                    )}
                  </div>
                )}

                {isPartial && (
                  <div style={{
                    background:EPJ.warningBg,padding:`${space.sm}px ${space.sm + 2}px`,borderRadius:radius.sm,
                    fontSize:fontSize.xs,color:EPJ.orangeText,marginBottom:space.sm,lineHeight:1.5,
                  }}>
                    ⚠️ Synchronisation partielle — certains fournisseurs ont échoué.
                    {Array.isArray(o.esaboraResults) && o.esaboraResults
                      .filter(r => !r.ok)
                      .map((r,i) => (
                        <div key={i} style={{marginTop:2,fontSize:fontSize.xs}}>
                          • {r.codeEsabora} : {r.error || 'erreur inconnue'}
                        </div>
                      ))}
                  </div>
                )}

                {isError && (
                  <div style={{
                    background:EPJ.dangerBg,padding:`${space.sm}px ${space.sm + 2}px`,borderRadius:radius.sm,
                    fontSize:fontSize.xs,color:EPJ.redText,marginBottom:space.sm,lineHeight:1.5,
                  }}>
                    ❌ Échec de synchronisation
                    {Array.isArray(o.esaboraResults) && o.esaboraResults
                      .filter(r => !r.ok)
                      .map((r,i) => (
                        <div key={i} style={{marginTop:2,fontSize:fontSize.xs}}>
                          • {r.codeEsabora} : {r.error || 'erreur'}
                        </div>
                      ))}
                  </div>
                )}

                {!isSynced && !isPartial && !isError && (
                  <div style={{fontSize:fontSize.xs,color:EPJ.gray,marginBottom:space.sm,lineHeight:1.4}}>
                    Cette commande peut être envoyée dans Esabora.
                    L'app va générer un fichier Excel par fournisseur (basé sur
                    le code Esabora de chaque article) et le pousser via Zapier.
                  </div>
                )}

                {/* Bouton envoi / resync */}
                <button
                  disabled={isInProgress || !featureFlags.esaboraWebhookUrl}
                  onClick={async () => {
                    if (!featureFlags.esaboraWebhookUrl) {
                      showT("❌ URL Zapier non configurée — voir Admin → Paramètres");
                      return;
                    }
                    const cmd = isSynced
                      ? `Re-synchroniser ${o.num} avec Esabora ? (ça créera de nouveaux drafts)`
                      : `Envoyer ${o.num} dans Esabora ?`;
                    if (!confirm(cmd)) return;
                    try {
                      const { sendOrderToEsabora } = await import("./esaboraUtils");
                      const chObj = dynChantiers.find(c => c.nom === o.chantier);
                      showT("🚀 Envoi en cours…");
                      const res = await sendOrderToEsabora({
                        order: o,
                        catalog: dynCatalog,
                        chantier: chObj || null,
                        user,
                        webhookUrl: featureFlags.esaboraWebhookUrl,
                        tvaDefault: featureFlags.esaboraTvaDefault, // v10.L.1
                      });
                      {
                        const ignored = res.ignored?.length || 0;
                        const ignoredSuffix = ignored ? ` — ${ignored} article(s) sans code ignoré(s)` : '';
                        const results = res.results || [];
                        const okCodes = results.filter(r => r.ok).map(r => r.codeEsabora);
                        const koCodes = results.filter(r => !r.ok).map(r => r.codeEsabora);
                        if (res.status === 'synced') {
                          showT(`✅ Esabora — ${okCodes.length} fournisseur(s) envoyé(s) : ${okCodes.join(', ')}${ignoredSuffix}`);
                        } else if (res.status === 'partial') {
                          showT(`⚠️ Esabora — ${okCodes.length}/${results.length} envoyé(s) : ${okCodes.join(', ')} — KO : ${koCodes.join(', ')}${ignoredSuffix}`);
                        } else if (results.length > 0) {
                          showT(`❌ Esabora — ${koCodes.length} fournisseur(s) en échec : ${koCodes.join(', ')}`);
                        } else {
                          showT(`❌ ${res.error || 'Échec Esabora'}`);
                        }
                      }
                      // Rafraîchit la vue (le doc Firestore a été update par sendOrderToEsabora)
                      setSelectedOrder(prev => prev ? { ...prev } : prev);
                    } catch (err) {
                      console.error("[esabora] erreur:", err);
                      showT("❌ Erreur : " + (err.message || err));
                    }
                  }}
                  style={{
                    width:'100%',
                    background: isSynced
                      ? EPJ.white
                      : isError || isPartial
                        ? EPJ.orange
                        : EPJ.blue,
                    color: isSynced ? EPJ.gray900 : EPJ.white,
                    padding:space.md,fontSize:fontSize.md,fontWeight:fontWeight.medium,
                    border: isSynced ? `1px solid ${EPJ.gray300}` : 'none',
                    borderRadius:radius.md,fontFamily:font,
                    cursor: isInProgress ? 'wait' : 'pointer',
                    opacity: isInProgress ? 0.6 : 1,
                  }}
                >
                  {isInProgress ? "⏳ Envoi en cours…" :
                   isSynced ? "🔄 Re-synchroniser" :
                   isError || isPartial ? "🔄 Réessayer" :
                   "🚀 Envoyer dans Esabora"}
                </button>
              </div>
            );
          })()}

          {/* ─── v10.J — Réception type chantier ─── */}
          {/* Affiché si type='chantier', statut Commandée OU Envoyée aux achats,
              et pas encore réceptionnée. Mode hybride : "Tout reçu" + option détailler. */}
          {o.type === "chantier"
            && (o.statut === "Commandée" || o.statut === "Envoyée aux achats")
            && (() => {
            const isOpen = reception.orderId === o._id;
            const detailMode = isOpen && reception.mode === "detail";
            const items = o.items || [];
            const validation = detailMode
              ? validateReceivedQuantities(items, reception.qties)
              : { valid: true, errors: [] };
            return (
              <div className="epj-card" style={{marginBottom:space.sm + 2,borderLeft:`3px solid ${EPJ.green}`}}>
                <div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.greenText,marginBottom:space.sm,letterSpacing:'0.03em'}}>
                  📦 RÉCEPTIONNER LA COMMANDE
                </div>

                {!isOpen && (
                  <>
                    <div style={{fontSize:fontSize.xs,color:EPJ.gray,marginBottom:space.sm + 2,lineHeight:1.4}}>
                      Marque cette commande comme reçue sur le chantier.
                      Si une partie manque, choisis « Détailler article par article » :
                      un reliquat sera créé automatiquement pour les manquants.
                    </div>
                    <Button
                      full
                      onClick={() => setReception({ orderId: o._id, mode: "choice", qties: {} })}
                    >📦 Réceptionner cette commande</Button>
                  </>
                )}

                {isOpen && reception.mode === "choice" && (
                  <>
                    <div style={{fontSize:fontSize.xs,color:EPJ.gray,marginBottom:space.sm + 2,lineHeight:1.4}}>
                      Choisis le mode de réception :
                    </div>
                    <div style={{marginBottom:space.sm}}>
                    <Button
                      full
                      onClick={async () => {
                        if (!confirm(`Confirmer que la commande ${o.num} a été entièrement reçue ?`)) return;
                        const ok = await performReceptionChantier(o, { quick: true });
                        if (ok) {
                          setReception({ orderId: null, mode: "choice", qties: {} });
                          setSelectedOrder({...o, statut: "Réceptionnée", dateReceptionEffective: new Date().toLocaleDateString('fr-FR')});
                        }
                      }}
                    >✅ Tout réceptionné</Button>
                    </div>
                    <Button
                      full
                      variant="secondary"
                      onClick={() => {
                        // Pré-remplit chaque ligne avec la quantité commandée
                        const initQties = {};
                        items.forEach((it, idx) => { initQties[idx] = normalizeQty(it.qty || it.qte); });
                        setReception({ orderId: o._id, mode: "detail", qties: initQties });
                      }}
                    >📝 Détailler article par article</Button>
                    <div style={{marginTop:6}}>
                    <Button
                      full
                      variant="ghost"
                      onClick={() => setReception({ orderId: null, mode: "choice", qties: {} })}
                    >Annuler</Button>
                    </div>
                  </>
                )}

                {isOpen && reception.mode === "detail" && (
                  <>
                    <div style={{fontSize:fontSize.xs,color:EPJ.gray,marginBottom:space.sm + 2,lineHeight:1.4}}>
                      Saisis pour chaque article la quantité <b>réellement reçue</b>.
                      Les manquants seront mis en reliquat.
                    </div>
                    <div style={{maxHeight:280,overflowY:'auto',background:EPJ.gray50,borderRadius:radius.sm + 2,padding:space.sm,marginBottom:space.sm + 2}}>
                      {items.map((it, idx) => {
                        const ordered = normalizeQty(it.qty || it.qte);
                        const received = normalizeQty(reception.qties[idx]);
                        return (
                          <div key={idx} style={{display:'flex',alignItems:'center',gap:space.sm,marginBottom:6,paddingBottom:6,borderBottom:`1px solid ${EPJ.gray200}`}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.dark,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis',fontFamily:fontFamilies.mono}}>
                                {it.r || it.ref || ""}
                              </div>
                              <div style={{fontSize:fontSize.xs,color:EPJ.gray,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                                {it.n || it.designation || ""}
                              </div>
                              <div style={{fontSize:fontSize.xs,color:EPJ.gray,fontVariantNumeric:'tabular-nums'}}>
                                Commandé : <b>{ordered}</b> {it.u || "Pièce"}
                              </div>
                            </div>
                            <input
                              type="number"
                              min="0"
                              max={ordered}
                              value={received}
                              onChange={e => {
                                const v = normalizeQty(e.target.value);
                                setReception(r => ({ ...r, qties: { ...r.qties, [idx]: v }}));
                              }}
                              style={{
                                width:60,padding:6,fontSize:fontSize.md,fontWeight:fontWeight.medium,
                                border:`2px solid ${received === ordered ? EPJ.green : received === 0 ? EPJ.red : EPJ.orange}`,
                                borderRadius:radius.sm,textAlign:'center',fontFamily:font,fontVariantNumeric:'tabular-nums',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>
                    {!validation.valid && (
                      <div style={{background:EPJ.dangerBg,color:EPJ.redText,padding:space.sm,borderRadius:radius.sm,fontSize:fontSize.xs,marginBottom:space.sm}}>
                        {validation.errors.map((err, i) => <div key={i}>⚠️ {err}</div>)}
                      </div>
                    )}
                    <button
                      className="epj-btn"
                      disabled={!validation.valid}
                      onClick={async () => {
                        if (!validation.valid) return;
                        const ok = await performReceptionChantier(o, { quick: false, receivedByIndex: reception.qties });
                        if (ok) {
                          setReception({ orderId: null, mode: "choice", qties: {} });
                          // Refresh la vue sélectionnée avec le nouveau statut
                          const newStatut = computeReliquatItems(items, reception.qties).length > 0
                            ? "Réceptionnée partiellement" : "Réceptionnée";
                          setSelectedOrder({...o, statut: newStatut, dateReceptionEffective: new Date().toLocaleDateString('fr-FR')});
                        }
                      }}
                      style={{width:'100%',background:validation.valid?EPJ.green:EPJ.gray300,color:EPJ.white,padding:space.md + 2,fontSize:fontSize.md,fontWeight:fontWeight.medium,cursor:validation.valid?'pointer':'not-allowed',border:'none',borderRadius:radius.md,fontFamily:font}}
                    >✅ Valider la réception détaillée</button>
                    <div style={{marginTop:6}}>
                    <Button
                      full
                      variant="ghost"
                      onClick={() => setReception({ orderId: o._id, mode: "choice", qties: {} })}
                    >← Retour</Button>
                    </div>
                  </>
                )}
              </div>
            );
          })()}

          {/* Affichage statut réceptionnée pour chantier (sans bouton) */}
          {o.type === "chantier"
            && (o.statut === "Réceptionnée" || o.statut === "Réceptionnée partiellement")
            && (
            <div style={{background:EPJ.successBg,borderRadius:radius.lg,padding:`${space.md}px ${space.lg}px`,marginBottom:space.sm + 2,display:'flex',alignItems:'center',gap:space.sm + 2,border:`1px solid ${EPJ.green}66`}}>
              <span style={{fontSize:24}}>{o.statut === "Réceptionnée" ? "✅" : "📦"}</span>
              <div>
                <div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.greenText}}>{o.statut}</div>
                <div style={{fontSize:fontSize.xs,color:EPJ.greenText,opacity:.85}}>
                  Le {o.dateReceptionEffective||o.date}{o.receptionParNom ? ` par ${o.receptionParNom}` : ''}
                </div>
              </div>
            </div>
          )}

          {o.statut === "Refusée" && user.fonction === "Admin" && (
            <div className="epj-card" style={{marginBottom:space.sm + 2,borderLeft:`3px solid ${EPJ.gray400}`}}>
              <div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.gray600,marginBottom:space.sm,letterSpacing:'0.03em'}}>
                ↩ RÉOUVRIR LA COMMANDE
              </div>
              <div style={{fontSize:fontSize.xs,color:EPJ.gray,marginBottom:space.sm + 2,lineHeight:1.4}}>
                Cette commande a été refusée. Tu peux la réouvrir pour la re-valider.
              </div>
              <Button
                full
                variant="secondary"
                onClick={async () => {
                  if (!confirm(`Réouvrir la commande ${o.num} ? Elle repassera en attente de validation.`)) return;
                  try {
                    await updateDoc(doc(db, "commandes", o._id), {
                      statut: "En attente de validation",
                      motifRefus: "",
                    });
                    showT("✓ Commande réouverte");
                    setSelectedOrder({...o, statut: "En attente de validation", motifRefus: ""});
                  } catch(e) { showT("❌ " + e.message); }
                }}
              >↩ Réouvrir cette commande</Button>
            </div>
          )}

          {/* ─── v10.G.2 — Bouton "Modifier" sur les commandes encore éditables ─── */}
          {canEditOrder(o) && (
            <div className="epj-card" style={{marginBottom:space.sm + 2,borderLeft:`3px solid ${EPJ.orange}`}}>
              <div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.orangeText,marginBottom:space.sm,letterSpacing:'0.03em'}}>
                ✏️ MODIFIER CETTE COMMANDE
              </div>
              <div style={{fontSize:fontSize.xs,color:EPJ.gray,marginBottom:space.sm + 2,lineHeight:1.4}}>
                {o.statut === "Envoyée aux achats"
                  ? "Cette commande a été envoyée aux achats. La modifier déclenchera une notification à la Direction (à renvoyer aux achats)."
                  : (!user.directAchat && o.statut !== "En attente de validation")
                    ? "Après enregistrement, la commande repassera en attente de validation."
                    : "Tu peux ajouter, retirer ou modifier la quantité des articles."}
              </div>
              <Button
                full
                variant="secondary"
                onClick={() => beginEditOrder(o)}
              >✏️ Modifier les articles ou les détails</Button>
            </div>
          )}

          {/* ─── v10.G.2 — Historique des modifications ─── */}
          {Array.isArray(o.editHistory) && o.editHistory.length > 0 && (
            <div className="epj-card" style={{marginBottom:space.sm + 2}}>
              <div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.dark,marginBottom:space.sm}}>
                📝 Historique des modifications ({o.editHistory.length})
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {o.editHistory.slice().reverse().map((h, i) => (
                  <div key={i} style={{fontSize:fontSize.xs,padding:space.sm,background:EPJ.gray50,borderRadius:radius.sm,lineHeight:1.4}}>
                    <div style={{fontWeight:fontWeight.medium,color:EPJ.dark}}>
                      {h.by} • {new Date(h.at).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'})}
                    </div>
                    <div style={{color:EPJ.gray,marginTop:2}}>{h.summary}</div>
                    {h.previousStatut !== h.newStatut && (
                      <div style={{fontSize:fontSize.xs,color:EPJ.gray,fontStyle:'italic',marginTop:2}}>
                        statut : {h.previousStatut} → {h.newStatut}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="epj-card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:space.sm + 2,gap:space.sm}}>
              <div style={{fontSize:fontSize.md,fontWeight:fontWeight.medium,color:EPJ.dark}}>Articles par fournisseur</div>
              <div style={{display:'flex',gap:space.sm,alignItems:'center'}}>
                {/* Bouton re-générer PDF */}
                <Button size="sm" variant="secondary" onClick={()=>generateAndOpenPdf(o)}>📄 PDF</Button>
                {o.type==='equipement'&&(o.signatureData?<span style={{fontSize:fontSize.xs,color:EPJ.greenText,fontWeight:fontWeight.medium}}>✅ Réceptionnée</span>:<Button size="sm" onClick={()=>openReceptionSheet(o)}>✍️ Réception</Button>)}
              </div>
            </div>
            {Object.entries(byFourn).sort(([a],[b])=>a.localeCompare(b)).map(([code,items])=>(
              <div key={code} style={{marginBottom:space.md}}>
                <div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.blueText,marginBottom:6,paddingBottom:space.xs,borderBottom:`2px solid ${EPJ.blue}22`,fontFamily:fontFamilies.mono}}>▸ {code} ({items.length})</div>
                {items.map(it=>(<div key={it.r} style={{display:'flex',alignItems:'center',gap:space.sm,padding:'6px 0',borderBottom:`1px solid ${EPJ.gray100}`}}><Thumb cat={it.c} imageUrl={it.img}/><div style={{flex:1}}><div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.dark}}>{it.n}</div><div style={{fontSize:fontSize.xs,color:EPJ.gray,fontFamily:fontFamilies.mono}}>{it.r}</div></div><div style={{fontSize:fontSize.md,fontWeight:fontWeight.medium,color:EPJ.blueText,fontVariantNumeric:'tabular-nums'}}>x{it.qty}</div></div>))}
              </div>
            ))}
            <div style={{marginTop:space.sm + 2,padding:`${space.sm + 2}px 0`,borderTop:`2px solid ${EPJ.dark}11`,display:'flex',justifyContent:'space-between',fontWeight:fontWeight.medium,color:EPJ.dark,fontVariantNumeric:'tabular-nums'}}><span>Total</span><span>{(o.items||[]).reduce((s,i)=>s+(i.qty||0),0)} articles ({(o.items||[]).length} réf.)</span></div>
          </div>
          {o.signatureData&&<div className="epj-card" style={{marginBottom:space.sm + 2,borderLeft:`3px solid ${EPJ.green}`}}>
            <div style={{display:'flex',alignItems:'center',gap:space.sm,marginBottom:space.sm}}>
              <span style={{fontSize:20}}>✅</span>
              <div><div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.greenText}}>Réception confirmée</div><div style={{fontSize:fontSize.xs,color:EPJ.greenText,opacity:.85}}>Signée le {o.dateReceptionEffective||o.date}</div></div>
            </div>
            <img src={o.signatureData} alt="Signature" style={{width:'100%',maxHeight:90,objectFit:'contain',border:`1px solid ${EPJ.gray300}`,borderRadius:radius.sm + 2,background:EPJ.gray50,padding:space.xs}}/>
          </div>}

          {/* v1.13.0 — Fil de discussion sur la commande */}
          <OrderMessageThread
            order={o}
            user={user}
            dynChantiers={dynChantiers}
            rolesConfig={rolesConfig}
            onUpdated={(updated) => setSelectedOrder(updated)}
          />
        </div>
      </div>
      </>
    );
  }

  // ═══ v1.17.2 — TO ORDER (À commander) ═══
  // Liste les commandes à passer chez le fournisseur, groupées par statut.
  // Admin/Direction/Achat/Assistante : voient TOUTES les commandes.
  // Conducteur travaux / Chef chantier / users directAchat : voient les leurs
  // selon leur scope (own_chantiers ou own_items).
  if(view==="toOrder" && canSeeToOrder()){
    const fullName = `${user.prenom} ${user.nom}`;
    let toOrder = (history || []).filter(h =>
      h && h.num && (
        h.statut === "Validée" ||
        h.statut === "Envoyée aux achats" ||
        h.statut === "Commandée partiellement"
      )
    );

    // Si pas Admin/Direction/Achat/Assistante → filtrer par scope
    if (!canMarkAsCommandee()) {
      const scope = can(user, "commandes", "view", rolesConfig);
      if (scope === "own_chantiers") {
        const mesChantiers = dynChantiers.filter(c => c.conducteur === fullName).map(c => c.nom);
        toOrder = toOrder.filter(h => mesChantiers.includes(h.chantier) || h.user === fullName);
      } else if (scope === "own_items") {
        toOrder = toOrder.filter(h => h.userId === user.id || h.user === fullName);
      } else if (scope !== "all") {
        toOrder = [];
      }
    }

    // Tri : urgent d'abord, puis date réception croissante, puis date création
    toOrder.sort((a, b) => {
      if ((b.urgent?1:0) - (a.urgent?1:0) !== 0) return (b.urgent?1:0) - (a.urgent?1:0);
      const da = a.dateReception || "9999-99-99";
      const dbb = b.dateReception || "9999-99-99";
      return da.localeCompare(dbb);
    });
    const byStatus = {
      "Commandée partiellement": toOrder.filter(o => o.statut === "Commandée partiellement"),
      "Envoyée aux achats": toOrder.filter(o => o.statut === "Envoyée aux achats"),
      "Validée": toOrder.filter(o => o.statut === "Validée"),
    };

    return (
      <>
      {partialPassOrder && (
        <PartialPassSheet
          order={partialPassOrder}
          onClose={() => setPartialPassOrder(null)}
          onConfirm={async ({ orderedByIndex }) => {
            try {
              await performPartialPass(partialPassOrder, { orderedByIndex });
            } catch (e) {
              console.error("[v1.17] Scission — exception onConfirm:", e);
              showT("❌ Erreur — réessayez");
            } finally {
              // Toujours fermer la modale : empêche tout écran blanc même si une
              // erreur survient après les écritures Firestore.
              setPartialPassOrder(null);
            }
          }}
        />
      )}
      <div style={wrapStyle(1100)}>
        <Header title="À commander" back={true} backView="home" showCart={false}/>
        <div style={{padding:`${space.sm}px ${space.md}px ${space.xs}px`}}>
          <Banner
            tone="warning"
            icon="📦"
            title={`${toOrder.length} commande${toOrder.length>1?'s':''} à passer chez le fournisseur`}
            text="Clique sur une commande pour la passer (en totalité ou partiellement)."
          />
        </div>
        <div style={{padding:`0 ${space.md}px ${space.md}px`}}>
          {toOrder.length === 0 && (
            <div style={{textAlign:'center',padding:`${space.xxl + 8}px ${space.md}px`,color:EPJ.gray500,fontSize:fontSize.sm}}>
              <div style={{fontSize:44,marginBottom:space.sm,opacity:.7}}>✨</div>
              Tout est passé. Aucune commande en attente.
            </div>
          )}
          {Object.entries(byStatus).map(([statusName, list]) => (
            list.length > 0 && (
              <div key={statusName} style={{marginBottom:space.md + 2}}>
                <div style={{
                  fontSize:fontSize.xs,fontWeight:fontWeight.medium,letterSpacing:'0.03em',
                  textTransform:'uppercase',color:STATUT_ACCENT[statusName] || EPJ.gray,
                  marginBottom:6,paddingLeft:space.xs,
                }}>
                  {statusName} ({list.length})
                </div>
                {isPwa ? list.map(o => (
                  <div
                    key={o._id}
                    onClick={() => { setSelectedOrder(o); setView('orderDetail'); }}
                    className="epj-card"
                    style={{
                      marginBottom:space.sm,cursor:'pointer',padding:space.md,
                      borderLeft:`4px solid ${STATUT_ACCENT[o.statut] || EPJ.gray}`,
                    }}
                  >
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:space.xs,gap:space.sm}}>
                      <div style={{fontSize:fontSize.md,fontWeight:fontWeight.medium,color:EPJ.dark,fontFamily:fontFamilies.mono}}>
                        {o.urgent && <span style={{color:EPJ.red,marginRight:space.xs}}>⚠️</span>}
                        {o.num}
                        {o.commanderPlusTard === true && (
                          <span style={{marginLeft:6,verticalAlign:'middle'}}><Badge tone="warning" label="⏳ Commander plus tard"/></span>
                        )}
                      </div>
                      <div style={{fontSize:fontSize.xs,color:EPJ.gray,whiteSpace:'nowrap'}}>{o.date}</div>
                    </div>
                    <div style={{fontSize:fontSize.xs,color:EPJ.dark,marginBottom:3}}>
                      {o.type === 'equipement'
                        ? <>👤 {o.salarie || "—"}</>
                        : <>🏗️ {o.chantier || "—"}{o.numAffaire ? <span style={{color:EPJ.gray}}> [{o.numAffaire}]</span> : null}</>
                      }
                    </div>
                    <div style={{fontSize:fontSize.xs,color:EPJ.gray,display:'flex',justifyContent:'space-between'}}>
                      <span>Par {o.user || "—"} · {(o.items||[]).length} réf.</span>
                      {o.dateReception && <span>Souhaité : {o.dateReception}</span>}
                    </div>
                  </div>
                )) : (
                  <DataTable
                    columns={[
                      { key:'num', header:'N°', render:(v,o)=>(
                        <span style={{fontFamily:fontFamilies.mono,fontSize:fontSize.sm}}>
                          {o.urgent?'⚠️ ':''}{v}
                          {o.commanderPlusTard === true && <span style={{marginLeft:6}}><Badge tone="warning" label="⏳ plus tard"/></span>}
                        </span>) },
                      { key:'date', header:'Date', sortable:false },
                      { key:'_cible', header:'Chantier / Destinataire' },
                      { key:'user', header:'Par' },
                      { key:'_refs', header:'Réf.', numeric:true },
                      { key:'dateReception', header:'Souhaité', render:(v)=>v||'—' },
                    ]}
                    rows={list.map(o=>({ ...o, _key:o._id, _refs:(o.items||[]).length, _cible: o.type==='equipement' ? (o.salarie||'—') : `${o.chantier||'—'}${o.numAffaire?` [${o.numAffaire}]`:''}` }))}
                    keyField="_key"
                    onRowClick={(o)=>{ setSelectedOrder(o); setView('orderDetail'); }}
                  />
                )}
              </div>
            )
          ))}
        </div>
      </div>
      </>
    );
  }

  // ═══ ADMIN ═══
  if(view==="admin"&&user?.fonction==="Admin"){
    const adminSave = async (collName, docId, data) => {
      setAdminSaving(true);
      try {
        await setDoc(doc(db, collName, docId), data, {merge:true});
        showT("✅ Sauvegardé");
      } catch(e) { showT("❌ Erreur: "+e.message); }
      setAdminSaving(false);
      setAdminEdit(null);
      setAdminForm({});
    };
    const adminDelete = async (collName, docId) => {
      if(!confirm("Supprimer ?")) return;
      setAdminSaving(true);
      try {
        await deleteDoc(doc(db, collName, docId));
        showT("🗑️ Supprimé");
      } catch(e) { showT("❌ Erreur: "+e.message); }
      setAdminSaving(false);
    };
    // ─── Upload photo article vers Firebase Storage ───
    const handleArticlePhotoSelect = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) { showT("❌ Choisissez une image"); return; }
      if (file.size > 10 * 1024 * 1024) { showT("❌ Image trop lourde (max 10 Mo)"); return; }
      const idForUpload = adminForm.r || `art_${Date.now()}`;
      try {
        const oldPath = adminForm.imgPath;
        setArtPhotoUploading("upload");
        const { url, path } = await uploadPhotoToFolder(
          "articles",
          idForUpload,
          file,
          (step) => setArtPhotoUploading(step)
        );
        setAdminForm(f => ({ ...f, img: url, imgPath: path }));
        if (oldPath) await deletePhotoByPath(oldPath);
        showT("✓ Photo téléversée");
      } catch (err) {
        console.error(err);
        showT("❌ Échec : " + (err.message || "upload"));
      } finally {
        setArtPhotoUploading(null);
        if (artFileInputLibraryRef.current) artFileInputLibraryRef.current.value = "";
        if (artFileInputCameraRef.current) artFileInputCameraRef.current.value = "";
      }
    };
    const handleArticlePhotoRemove = async () => {
      if (!confirm("Supprimer la photo ?")) return;
      const oldPath = adminForm.imgPath;
      setAdminForm(f => ({ ...f, img: "", imgPath: "" }));
      if (oldPath) await deletePhotoByPath(oldPath);
      showT("Photo supprimée");
    };
    // ─── v10.G — Import / Export Excel du catalogue ───
    const handleExportCatalog = async () => {
      try {
        const XLSX = await import("xlsx");
        const aoa = articlesToAoa(dynCatalog);
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        // Largeurs colonnes
        ws["!cols"] = [
          { wch: 25 }, { wch: 22 }, { wch: 18 }, { wch: 50 },
          { wch: 12 }, { wch: 8 },  { wch: 22 }, { wch: 14 }, { wch: 30 },
        ];
        // Figer la 1ère ligne
        ws["!freeze"] = { xSplit: 0, ySplit: 1 };
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Catalogue");
        const today = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(wb, `Catalogue_EPJ_${today}.xlsx`);
        showT(`✅ ${dynCatalog.length} articles exportés`);
      } catch (e) {
        console.error("Export Excel échoué:", e);
        showT("❌ Échec export : " + (e?.message || "voir console"));
      }
    };

    const handleImportFile = async (file, mode) => {
      // mode = "merge" ou "replace"
      if (!file) return;
      if (!file.name.match(/\.(xlsx|xls)$/i)) {
        showT("❌ Format non supporté (utilise un .xlsx)");
        return;
      }
      setAdminSaving(true);
      try {
        const XLSX = await import("xlsx");
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        // Cherche la feuille "Catalogue" en priorité, sinon la 1ère
        const sheetName = wb.SheetNames.includes("Catalogue") ? "Catalogue" : wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const { articles, errors, warnings } = parseCatalogAoa(aoa);

        if (errors.length > 0) {
          alert("❌ Le fichier contient des erreurs :\n\n" + errors.join("\n"));
          return;
        }
        if (articles.length === 0) {
          alert("❌ Le fichier ne contient aucun article valide.");
          return;
        }

        // ─── v10.G.1 — Détection des VRAIS doublons (même cat+ref) ──
        // Un article qui apparaît dans plusieurs catégories n'est PAS un doublon.
        const dups = findDuplicateRefs(articles);
        if (dups.length > 0) {
          const list = dups.slice(0, 10).map(d => `• ${d.ref} en "${d.cat}" (${d.count}×)`).join("\n");
          const ok = confirm(
            `⚠️ ${dups.length} vrai(s) doublon(s) (même catégorie + même référence) dans le fichier :\n\n${list}` +
            (dups.length > 10 ? `\n... et ${dups.length - 10} autre(s)` : "") +
            "\n\nLa dernière ligne gagnera. Continuer ?"
          );
          if (!ok) return;
        }

        // ─── v10.G.1 — Stats multi-catégories ─────────────────────
        const multiStats = countMultiCategoryArticles(articles);

        // Comparaison avant/après pour rapport de pré-import
        const cmp = compareCatalogues(dynCatalog, articles);
        let preImportMsg = `📊 Rapport de pré-import\n\n`;
        preImportMsg += `Mode : ${mode === "replace" ? "REMPLACER (efface tout puis charge)" : "Fusionner (upsert)"}\n\n`;
        preImportMsg += `Lignes dans le fichier : ${articles.length}\n`;
        preImportMsg += `Articles physiques distincts : ${multiStats.uniqueRefs}\n`;
        if (multiStats.multiCategoryCount > 0) {
          preImportMsg += `Articles classés dans plusieurs catégories : ${multiStats.multiCategoryCount}\n`;
        }
        preImportMsg += `\nArticles actuels Firestore : ${dynCatalog.length}\n\n`;
        preImportMsg += `→ ${cmp.newCount} nouveau(x)\n`;
        preImportMsg += `→ ${cmp.updatedCount} mis à jour\n`;
        if (mode === "replace") {
          preImportMsg += `→ ${cmp.removedCount} supprimé(s)\n`;
        } else {
          preImportMsg += `→ ${cmp.removedCount} restera(ont) en plus dans Firestore (mode Fusionner)\n`;
        }
        if (cmp.newCategories.length > 0) {
          preImportMsg += `\n🆕 Nouvelles catégories : ${cmp.newCategories.join(", ")}`;
        }
        if (cmp.removedCategories.length > 0 && mode === "replace") {
          preImportMsg += `\n⚠️ Catégories qui disparaîtront : ${cmp.removedCategories.join(", ")}`;
        }
        if (warnings.length > 0) {
          preImportMsg += `\n\n${warnings.length} avertissement(s) (lignes ignorées ou champs vides).`;
        }
        preImportMsg += "\n\nConfirmer l'import ?";

        if (!confirm(preImportMsg)) return;

        if (mode === "replace") {
          // Confirmation supplémentaire pour le mode destructeur
          const challenge = prompt(
            "⚠️ MODE REMPLACER : tout le catalogue Firestore actuel sera SUPPRIMÉ avant l'import.\n\n" +
            'Pour confirmer, tape exactement : EFFACER'
          );
          if (challenge === null) return;
          if (challenge.trim().toUpperCase() !== "EFFACER") {
            showT("❌ Mot de confirmation incorrect — annulé");
            return;
          }
          // Supprimer tout le catalogue Firestore
          showT("⏳ Suppression de l'ancien catalogue…");
          const snap = await getDocs(collection(db, "catalogue"));
          const docs = snap.docs;
          for (let i = 0; i < docs.length; i += 450) {
            const batch = writeBatch(db);
            docs.slice(i, i + 450).forEach(d => batch.delete(d.ref));
            await batch.commit();
          }
        }

        // Import (upsert)
        showT(`⏳ Import de ${articles.length} articles…`);
        const count = await uploadCatalog(articles);
        showT(`✅ ${count} articles importés`);
      } catch (e) {
        console.error("Import Excel échoué:", e);
        alert("❌ Échec de l'import :\n\n" + (e?.message || "voir console"));
      } finally {
        setAdminSaving(false);
      }
    };

    const triggerImport = (mode) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      input.onchange = (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) handleImportFile(file, mode);
      };
      input.click();
    };

    // ─── v10.G — Réinitialisation Firebase SÉCURISÉE ───
    // Avant : 1 seul confirm() avant d'écraser toute la base.
    //         + le bouton utilisait `CATALOG` (en dur dans CommandesInner) qui
    //           pouvait diverger de `initFirestore.js` (incohérence Bilardo).
    // Maintenant :
    //   • Confirmation par saisie de la chaîne "RÉINITIALISER" (anti-clic accidentel)
    //   • Puis confirm() final.
    //   • Source unique : CATALOG_SEED (catalogSeed.js).
    //   • initEPJData() utilise les seeds USERS_INIT/CHANTIERS_INIT de
    //     initFirestore.js qui restent la source de vérité pour ces 2 collections.
    const adminInitAll = async () => {
      const challenge = prompt(
        "⚠️ ATTENTION — Cette action va EFFACER les utilisateurs, chantiers, et le catalogue Firestore actuels, puis recharger les données par défaut.\n\n" +
        "Pour confirmer, tape exactement le mot suivant :\n\nRÉINITIALISER"
      );
      if (challenge === null) return; // annulé
      if (challenge.trim().toUpperCase() !== "RÉINITIALISER" && challenge.trim().toUpperCase() !== "REINITIALISER") {
        showT("❌ Mot de confirmation incorrect — annulé");
        return;
      }
      if (!confirm("Dernière confirmation : es-tu absolument sûr ?\n\nLes commandes existantes seront PRÉSERVÉES, mais les utilisateurs, chantiers et catalogue seront remplacés par les valeurs par défaut.")) return;

      setAdminSaving(true);
      try {
        const r = await initEPJData(true);
        showT(r.message);
        showT(`⏳ Chargement du catalogue (${CATALOG_SEED.length} articles)…`);
        const catCount = await uploadCatalog(CATALOG_SEED);
        showT(`✅ ${catCount} articles chargés`);
      } catch (e) {
        console.error("Réinitialisation échouée:", e);
        showT("❌ Erreur : " + (e?.message || "voir la console"));
      } finally {
        setAdminSaving(false);
      }
    };

    // ─── Admin menu ───
    if(!adminSection) return(
      <div style={wrapStyle(720)}>
        <Header title="⚙️ Admin Catalogue" back={true} backView="home" showCart={false}/>
        <div style={{padding:space.lg}}>
          <Banner
            tone="info"
            icon="ℹ️"
            title="Utilisateurs & chantiers"
            text="Désormais gérés dans l'Administration générale (icône ⚙ en haut à droite de l'accueil)."
          />
          {[
            {key:'categories',icon:'📁',label:'Catégories & Sous-catégories',desc:`${[...new Set(dynCatalog.map(p=>p.c))].length} catégories`},
            {key:'catalog',icon:'📦',label:'Articles du catalogue',desc:`${dynCatalog.length} article(s)`},
          ].map(s=>(
            <div key={s.key} onClick={()=>{setAdminSection(s.key);setAdminEdit(null);setAdminForm({})}} className="epj-card clickable" style={{marginBottom:space.sm + 2,cursor:'pointer',display:'flex',alignItems:'center',gap:space.md + 2}}>
              <div style={{width:48,height:48,borderRadius:radius.lg,background:`${EPJ.blue}1A`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,flexShrink:0}}>{s.icon}</div>
              <div><div style={{fontWeight:fontWeight.medium,fontSize:fontSize.base,color:EPJ.dark}}>{s.label}</div><div style={{fontSize:fontSize.xs,color:EPJ.gray}}>{s.desc}</div></div>
            </div>
          ))}
          <div style={{marginTop:space.xl - 4,borderTop:`1px solid ${EPJ.gray200}`,paddingTop:space.lg}}>
            {/* ─── v10.G — Bloc Import / Export Excel ─── */}
            <div style={{marginBottom:space.lg + 2,padding:space.md,background:EPJ.gray50,border:`1px solid ${EPJ.blue}33`,borderRadius:radius.md}}>
              <div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.dark,marginBottom:space.sm,display:'flex',alignItems:'center',gap:6}}>
                📊 Import / Export Excel
              </div>
              <div style={{fontSize:fontSize.xs,color:EPJ.gray,marginBottom:space.sm + 2,lineHeight:1.4}}>
                Mets à jour ou exporte le catalogue via un fichier Excel. Format à plat 9 colonnes (Catégorie, Sous-catégorie, Référence, Désignation, Unité, Stock, Fournisseur principal, Code Esabora, Photo URL).
              </div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <div style={{flex:1,minWidth:140}}>
                  <Button
                    full size="sm"
                    onClick={()=>triggerImport('merge')}
                    disabled={adminSaving}
                    title="Fusion (upsert) : ajoute les nouveaux, met à jour les existants. Articles non listés conservés."
                  >📥 Importer (fusionner)</Button>
                </div>
                <div style={{flex:1,minWidth:140}}>
                  <Button
                    full size="sm" variant="danger"
                    onClick={()=>triggerImport('replace')}
                    disabled={adminSaving}
                    title="Efface tout le catalogue Firestore puis importe. Action destructive."
                  >🗑️ Importer (remplacer)</Button>
                </div>
                <div style={{flex:1,minWidth:140}}>
                  <Button
                    full size="sm" variant="secondary"
                    onClick={handleExportCatalog}
                    disabled={adminSaving || dynCatalog.length===0}
                    title="Télécharge le catalogue actuel au format Excel"
                  >📤 Exporter en Excel</Button>
                </div>
              </div>
              <div style={{fontSize:fontSize.xs,color:EPJ.gray500,marginTop:space.sm,lineHeight:1.4}}>
                💡 <b>Fusionner</b> : ajoute / met à jour, sans supprimer les articles absents du fichier.
                <br/>💡 <b>Remplacer</b> : EFFACE tout puis recharge depuis le fichier (confirmation requise).
              </div>
            </div>

            <div style={{marginBottom:space.sm}}>
              <Button full variant="secondary" onClick={adminInitAll} disabled={adminSaving} loading={adminSaving}>
                {`🔄 Réinitialiser Firebase (${CATALOG_SEED.length} articles)`}
              </Button>
            </div>
            <div style={{fontSize:fontSize.xs,color:EPJ.gray,textAlign:'center',marginBottom:space.md}}>⚠️ Charge les données par défaut. Confirmation requise par saisie. À utiliser uniquement si la base est corrompue ou vide.</div>
            <Button full variant="secondary" onClick={async()=>{
              const validCats = new Set(CATALOG_SEED.map(p=>p.c));
              const orphanCats = [...new Set(dynCatalog.filter(p=>p.r && !validCats.has(p.c)).map(p=>p.c))];
              if(orphanCats.length===0){showT('✅ Aucune catégorie parasite');return;}
              if(!confirm(`Supprimer les catégories parasites : ${orphanCats.join(', ')} ?`))return;
              setAdminSaving(true);
              let total=0;
              for(const cat of orphanCats){
                try{ total += await deleteCategoryByQuery(cat); }catch(e){console.error("[admin] Erreur suppression catégorie parasite:", cat, e);}
              }
              setAdminSaving(false);showT(`🗑️ ${total} articles parasites supprimés`);
            }} disabled={adminSaving}>
              🧹 Nettoyer catégories parasites Firebase
            </Button>
            <div style={{fontSize:fontSize.xs,color:EPJ.gray500,textAlign:'center',marginTop:space.xs}}>Supprime les anciennes catégories (Câbles, Câble Colonne, Vêtements...) non présentes dans le catalogue standard</div>
          </div>
        </div>
        {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:EPJ.white,padding:`${space.sm}px ${space.xl - 4}px`,borderRadius:radius.pill,fontSize:fontSize.sm,fontWeight:fontWeight.medium,zIndex:400}}>{toast}</div>}
      </div>
    );

    // ─── Admin: Catégories & Sous-catégories ───
    if(adminSection==='categories'){
      const allCatsRaw = [...new Set(dynCatalog.map(p=>p.c))];
      const cats = dynCatOrder.length > 0
        ? [...allCatsRaw].sort((a,b)=>{const ia=dynCatOrder.indexOf(a),ib=dynCatOrder.indexOf(b);if(ia===-1&&ib===-1)return a.localeCompare(b);if(ia===-1)return 1;if(ib===-1)return -1;return ia-ib;})
        : [...allCatsRaw].sort();
      const subcats = selectedCat ? [...new Set(dynCatalog.filter(p=>p.c===selectedCat).map(p=>p.s))].sort() : [];
      const moveCat = async (idx, dir) => {
        const newOrder = [...cats];
        const swapIdx = idx + dir;
        if(swapIdx < 0 || swapIdx >= newOrder.length) return;
        [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
        setDynCatOrder(newOrder);
        await setDoc(doc(db,'config','settings'),{catOrder:newOrder},{merge:true});
        showT('✅ Ordre sauvegardé');
      };
      return(
      <div style={wrapStyle(720)}>
        <Header title={selectedCat?`📁 ${selectedCat}`:"📁 Catégories"} back={true} backView={selectedCat?"admin":"admin"} showCart={false}/>
        <div style={{padding:space.md}}>
          {!selectedCat ? (<>
            <div style={{marginBottom:space.md}}><Button full onClick={()=>{setAdminEdit('newCat');setAdminForm({nom:'',icon:'📦'})}}>+ Nouvelle catégorie</Button></div>
            {adminEdit==='newCat'&&<div className="epj-card" style={{marginBottom:space.md,border:`1px solid ${EPJ.blue}`}}>
              <div style={{display:'flex',gap:space.sm,marginBottom:space.sm,alignItems:'flex-end'}}>
                <div style={{flex:1}}><Field dense placeholder="Nom de la catégorie" value={adminForm.nom||''} onChange={e=>setAdminForm(p=>({...p,nom:e.target.value}))}/></div>
                <div style={{width:56,height:46,borderRadius:radius.md,border:`2px solid ${EPJ.blue}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,background:EPJ.gray50,overflow:'hidden',flexShrink:0}}>
                  {adminForm.icon&&(adminForm.icon.startsWith('http')||adminForm.icon.startsWith('data:'))
                    ? <img src={adminForm.icon} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:radius.sm + 2}}/>
                    : <span>{adminForm.icon||'📦'}</span>}
                </div>
              </div>
              <div style={{marginBottom:space.sm + 2}}>
                <EmojiPicker value={adminForm.icon||''} onChange={v=>setAdminForm(p=>({...p,icon:v}))}/>
              </div>
              <div style={{display:'flex',gap:space.sm}}>
                <div style={{flex:1}}><Button full variant="secondary" onClick={()=>{setAdminEdit(null);setAdminForm({})}}>Annuler</Button></div>
                <div style={{flex:1}}><Button full onClick={async()=>{
                  if(!adminForm.nom) return;
                  const newIcons = {...dynCatIcons, [adminForm.nom]:adminForm.icon||'📦'};
                  await setDoc(doc(db,"config","settings"),{catIcons:newIcons},{merge:true});
                  // Add a placeholder article to create the category
                  await setDoc(doc(db,"catalogue","__cat_"+adminForm.nom.replace(/\s/g,'_')),{c:adminForm.nom,s:'Général',r:'',n:'(catégorie vide)',u:'',img:''});
                  setAdminEdit(null);setAdminForm({});showT("✅ Catégorie ajoutée");
                }} disabled={adminSaving||!adminForm.nom}>💾 Ajouter</Button></div>
              </div>
            </div>}
            {cats.map((cat,idx)=>(
              <div key={cat} className="epj-card" style={{marginBottom:6,display:'flex',alignItems:'center',gap:space.sm}}>
                <div style={{display:'flex',flexDirection:'column',gap:2}}>
                  <button aria-label={`Monter ${cat}`} onClick={()=>moveCat(idx,-1)} disabled={idx===0} style={{background:idx===0?EPJ.gray100:EPJ.dark,color:idx===0?EPJ.gray300:EPJ.white,border:'none',borderRadius:radius.sm,width:24,height:22,fontSize:fontSize.xs,cursor:idx===0?'default':'pointer',lineHeight:1}}>↑</button>
                  <button aria-label={`Descendre ${cat}`} onClick={()=>moveCat(idx,1)} disabled={idx===cats.length-1} style={{background:idx===cats.length-1?EPJ.gray100:EPJ.dark,color:idx===cats.length-1?EPJ.gray300:EPJ.white,border:'none',borderRadius:radius.sm,width:24,height:22,fontSize:fontSize.xs,cursor:idx===cats.length-1?'default':'pointer',lineHeight:1}}>↓</button>
                </div>
                <div onClick={()=>setSelectedCat(cat)} style={{flex:1,display:'flex',alignItems:'center',gap:space.sm + 2,cursor:'pointer'}}>
                  <CatIcon cat={cat} size={32}/>
                  <div>
                    <div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.dark}}>{cat}</div>
                    <div style={{fontSize:fontSize.xs,color:EPJ.gray}}>{dynCatalog.filter(p=>p.c===cat).length} art. • {[...new Set(dynCatalog.filter(p=>p.c===cat).map(p=>p.s))].length} sous-cat.{dynEquipCats.includes(cat)?' • 👷 Équip.':''}</div>
                  </div>
                </div>
                <IconButton label={`Modifier la catégorie ${cat}`} onClick={()=>{setAdminEdit('renameCat');setAdminForm({oldNom:cat,nom:cat,icon:dynCatIcons[cat]||'📦',isEquip:dynEquipCats.includes(cat)})}}>✏️</IconButton>
                <IconButton variant="danger" label={`Supprimer la catégorie ${cat}`} onClick={async()=>{
                  if(!confirm(`Supprimer la catégorie "${cat}" et tous ses articles ?`))return;
                  setAdminSaving(true);
                  try {
                    // Suppression fiable par requête Firestore (pas par ID deviné)
                    const deleted = await deleteCategoryByQuery(cat);
                    const newIcons={...dynCatIcons};delete newIcons[cat];
                    const newOrder=dynCatOrder.filter(c=>c!==cat);
                    await setDoc(doc(db,"config","settings"),{catIcons:newIcons,catOrder:newOrder},{merge:true});
                    showT(`🗑️ ${deleted} articles supprimés`);
                  } catch(e) { showT("❌ Erreur: "+e.message); }
                  setAdminSaving(false);
                }}>🗑️</IconButton>
              </div>
            ))}
            {adminEdit==='renameCat'&&<div className="epj-card" style={{marginBottom:space.md,border:`1px solid ${EPJ.blue}`,marginTop:space.sm + 2}}>
              <div style={{fontSize:fontSize.md,fontWeight:fontWeight.medium,marginBottom:space.sm + 2}}>✏️ Modifier la catégorie</div>
              <div style={{display:'flex',gap:space.sm,marginBottom:space.sm,alignItems:'flex-end'}}>
                <div style={{flex:1}}><Field dense placeholder="Nouveau nom" value={adminForm.nom||''} onChange={e=>setAdminForm(p=>({...p,nom:e.target.value}))}/></div>
                <div style={{width:56,height:46,borderRadius:radius.md,border:`2px solid ${EPJ.blue}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,background:EPJ.gray50,overflow:'hidden',flexShrink:0}}>
                  {adminForm.icon&&(adminForm.icon.startsWith('http')||adminForm.icon.startsWith('data:'))
                    ? <img src={adminForm.icon} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:radius.sm + 2}}/>
                    : <span>{adminForm.icon||'📦'}</span>}
                </div>
              </div>
              <div style={{marginBottom:space.sm + 2}}>
                <EmojiPicker value={adminForm.icon||''} onChange={v=>setAdminForm(p=>({...p,icon:v}))}/>
              </div>
              <label style={{display:'flex',alignItems:'center',gap:space.sm,marginBottom:space.md,cursor:'pointer',padding:`${space.sm}px ${space.sm + 2}px`,background:adminForm.isEquip?EPJ.successBg:EPJ.gray100,borderRadius:radius.sm + 2,border:adminForm.isEquip?`2px solid ${EPJ.green}`:`2px solid ${EPJ.gray200}`}}>
                <input type="checkbox" checked={adminForm.isEquip||false} onChange={e=>setAdminForm(p=>({...p,isEquip:e.target.checked}))} style={{width:18,height:18}}/>
                <div><div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium}}>Équipement Salarié</div><div style={{fontSize:fontSize.xs,color:EPJ.gray}}>Visible dans "Commande Équipement"</div></div>
              </label>
              <div style={{display:'flex',gap:space.sm}}>
                <div style={{flex:1}}><Button full variant="secondary" onClick={()=>{setAdminEdit(null);setAdminForm({})}}>Annuler</Button></div>
                <div style={{flex:1}}><Button full loading={adminSaving} onClick={async()=>{
                  if(!adminForm.nom||!adminForm.oldNom)return;
                  setAdminSaving(true);
                  // Si le nom a changé : déplacer les articles vers le nouveau nom de catégorie
                  if(adminForm.nom !== adminForm.oldNom) {
                    // ─── v10.G.1 — Renommage catégorie ─────────────────
                    // Le docId est désormais composite {catégorie}__{référence}.
                    // Renommer la catégorie change donc le docId : il faut
                    // supprimer l'ancien doc et créer le nouveau (pas de merge).
                    const toUpdate=dynCatalog.filter(p=>p.c===adminForm.oldNom);
                    for(const p of toUpdate){
                      try {
                        const oldDocId = buildCatalogueDocId(adminForm.oldNom, p.r);
                        const newDocId = buildCatalogueDocId(adminForm.nom, p.r);
                        // Crée le nouveau doc avec toutes les propriétés de l'ancien + c modifiée
                        await setDoc(doc(db,"catalogue",newDocId), { ...p, c: adminForm.nom });
                        // Supprime l'ancien doc (sauf si oldDocId === newDocId, cas improbable)
                        if (oldDocId !== newDocId) {
                          await deleteDoc(doc(db,"catalogue",oldDocId));
                        }
                      } catch(e) { console.warn("Renommage cat: échec sur", p.r, e); }
                    }
                  }
                  const newIcons={...dynCatIcons};
                  if(adminForm.nom !== adminForm.oldNom) delete newIcons[adminForm.oldNom];
                  newIcons[adminForm.nom]=adminForm.icon||'📦';
                  let newEquip=[...dynEquipCats].filter(c=>c!==adminForm.oldNom);
                  if(adminForm.isEquip) newEquip.push(adminForm.nom);
                  const newOrder=dynCatOrder.map(c=>c===adminForm.oldNom?adminForm.nom:c);
                  await setDoc(doc(db,"config","settings"),{catIcons:newIcons,equipCategories:newEquip,catOrder:newOrder},{merge:true});
                  setDynEquipCats(newEquip);setDynCatOrder(newOrder);
                  setAdminSaving(false);setAdminEdit(null);setAdminForm({});showT("✅ Catégorie mise à jour");
                }} disabled={adminSaving||!adminForm.nom}>💾 Enregistrer</Button></div>
              </div>
            </div>}
          </>) : (<>
            <div style={{marginBottom:space.md}}><Button full variant="secondary" onClick={()=>setSelectedCat(null)}>← Toutes les catégories</Button></div>
            <div style={{marginBottom:space.md}}><Button full onClick={()=>{setAdminEdit('newSub');setAdminForm({nom:''})}}>+ Nouvelle sous-catégorie dans {selectedCat}</Button></div>
            {adminEdit==='newSub'&&<div className="epj-card" style={{marginBottom:space.md,border:`1px solid ${EPJ.blue}`}}>
              <div style={{marginBottom:space.sm}}><Field dense placeholder="Nom de la sous-catégorie" value={adminForm.nom||''} onChange={e=>setAdminForm(p=>({...p,nom:e.target.value}))}/></div>
              <div style={{display:'flex',gap:space.sm}}>
                <div style={{flex:1}}><Button full variant="secondary" onClick={()=>{setAdminEdit(null);setAdminForm({})}}>Annuler</Button></div>
                <div style={{flex:1}}><Button full onClick={async()=>{
                  const nom = (adminForm.nom||'').trim();
                  if(!nom) return;
                  try {
                    await setDoc(doc(db,"catalogue","__sub_"+selectedCat.replace(/[\/\s]/g,'_')+"_"+nom.replace(/[\/\s]/g,'_')),{c:selectedCat,s:nom,r:'',n:'(sous-catégorie vide)',u:'',img:'',stock:true});
                    setAdminEdit(null);setAdminForm({});showT("✅ Sous-catégorie ajoutée");
                  } catch(e) { showT("❌ Erreur: "+e.message); }
                }} disabled={adminSaving||!(adminForm.nom||'').trim()}>💾 Ajouter</Button></div>
              </div>
            </div>}
            {subcats.map(sub=>(
              <div key={sub} className="epj-card" style={{marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.dark}}>{sub}</div>
                  <div style={{fontSize:fontSize.xs,color:EPJ.gray}}>{dynCatalog.filter(p=>p.c===selectedCat&&p.s===sub).length} articles</div>
                </div>
              </div>
            ))}
          </>)}
        </div>
        {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:EPJ.white,padding:`${space.sm}px ${space.xl - 4}px`,borderRadius:radius.pill,fontSize:fontSize.sm,fontWeight:fontWeight.medium,zIndex:400}}>{toast}</div>}
      </div>
    );}

    // ─── Admin: Catalogue (articles) ───
    if(adminSection==='catalog'){
      const cats = [...new Set(dynCatalog.map(p=>p.c))].sort();
      const adminCatFilter = selectedCat;
      const adminSearch = search;
      let filtered = dynCatalog.filter(p=>p.r); // exclude placeholders
      if(adminCatFilter) filtered = filtered.filter(p=>p.c===adminCatFilter);
      if(adminSearch) { const q=adminSearch.toLowerCase(); filtered=filtered.filter(p=>(p.n||'').toLowerCase().includes(q)||(p.r||'').toLowerCase().includes(q)); }
      return(
      <div style={wrapStyle(900, { paddingBottom: 80 })}>
        <Header title="📦 Articles" back={true} backView="admin" showCart={false}/>
        <div style={{padding:`${space.sm}px ${space.md}px`,background:EPJ.white,borderBottom:`1px solid ${EPJ.gray200}`}}>
          <div style={{display:'flex',flexDirection:isPwa?'column':'row',gap:space.sm}}>
            <div style={{flex:1}}>
              <Field as="select" dense value={adminCatFilter||''} onChange={e=>{setSelectedCat(e.target.value||null)}}
                options={[{value:'',label:'Toutes catégories'},...cats.map(c=>({value:c,label:c}))]}/>
            </div>
            <div style={{flex:isPwa?undefined:2}}>
              <Field dense placeholder="Rechercher..." value={adminSearch||''} onChange={e=>setSearch(e.target.value)}/>
            </div>
          </div>
        </div>
        <div style={{padding:space.md}}>
          <div style={{display:'flex',gap:6,marginBottom:space.md}}>
            <div style={{flex:1}}><Button full size="sm" onClick={()=>{setAdminEdit('newArt');setAdminForm({c:adminCatFilter||cats[0]||'',s:'',r:'',n:'',u:'Pièce',img:'',stock:true})}}>+ Ajouter</Button></div>
            <Button size="sm" variant={bulkMode?'primary':'secondary'} onClick={()=>{setBulkMode(!bulkMode);setBulkSelected([])}}>{bulkMode?'✓ Sélection':'☐ Sélection bloc'}</Button>
          </div>
          {bulkMode&&bulkSelected.length>0&&<div className="epj-card" style={{marginBottom:space.md,border:`1px solid ${EPJ.orange}`}}>
            <div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,marginBottom:space.sm}}>{bulkSelected.length} article(s) sélectionné(s)</div>
            <div style={{marginBottom:6}}>
              <label style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.gray500}}>Déplacer vers catégorie :</label>
              <select className="epj-input" id="bulkCat" style={{padding:6,fontSize:fontSize.xs}}><option value="">--</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select>
            </div>
            <div style={{marginBottom:space.sm}}>
              <label style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.gray500}}>Sous-catégorie :</label>
              <input className="epj-input" id="bulkSub" placeholder="Optionnel" style={{padding:6,fontSize:fontSize.xs}}/>
            </div>
            <div style={{display:'flex',gap:6}}>
              <div style={{flex:1}}><Button full size="sm" variant="secondary" onClick={()=>setBulkSelected([])}>Tout désélectionner</Button></div>
              <div style={{flex:1}}><Button full size="sm" loading={adminSaving} onClick={async()=>{
                const newCat=document.getElementById('bulkCat').value;
                const newSub=document.getElementById('bulkSub').value;
                if(!newCat){showT('Choisissez une catégorie');return}
                setAdminSaving(true);
                // ─── v10.G.1 — Déplacement en bloc ───────────────────
                // Le docId est composite {catégorie}__{référence}. Changer la
                // catégorie → changer le docId → delete+create.
                let moved = 0;
                for(const sel of bulkSelected){
                  try {
                    const oldDocId = buildCatalogueDocId(sel.c, sel.r);
                    const newDocId = buildCatalogueDocId(newCat, sel.r);
                    if (oldDocId === newDocId) continue; // déjà dans la bonne cat
                    // Récupérer l'article complet pour préserver toutes ses propriétés
                    const orig = dynCatalog.find(x => x.c === sel.c && x.r === sel.r);
                    if (!orig) continue;
                    const newData = { ...orig, c: newCat };
                    if (newSub) newData.s = newSub;
                    await setDoc(doc(db,'catalogue',newDocId), newData);
                    await deleteDoc(doc(db,'catalogue',oldDocId));
                    moved++;
                  } catch(e) { console.warn("Bulk move échec:", sel, e); }
                }
                setAdminSaving(false);setBulkSelected([]);setBulkMode(false);
                showT(`✅ ${moved} article(s) déplacé(s)`);
              }} disabled={adminSaving}>📦 Déplacer</Button></div>
            </div>
          </div>}
          {adminEdit&&(adminEdit==='newArt'||adminEdit.startsWith?.('edit_'))&&<div className="epj-card" style={{marginBottom:space.md,border:`1px solid ${EPJ.blue}`}}>
            <div style={{fontSize:fontSize.md,fontWeight:fontWeight.medium,marginBottom:space.sm + 2}}>{adminEdit==='newArt'?'Nouvel article':'Modifier article'}</div>
            <div style={{marginBottom:space.sm}}>
              <Field as="select" dense label="Catégorie" value={adminForm.c||''} onChange={e=>setAdminForm(p=>({...p,c:e.target.value,s:''}))}
                options={cats.map(c=>({value:c,label:c}))}/>
            </div>
            <div style={{marginBottom:space.sm}}>
              <label style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.gray700,display:'block',marginBottom:2}}>Sous-catégorie</label>
              {(()=>{const subs=[...new Set(dynCatalog.filter(p=>p.c===adminForm.c).map(p=>p.s))].sort();return subs.length>0?(
                <div style={{display:'flex',gap:6}}>
                  <select className="epj-input" value={adminForm.s||''} onChange={e=>setAdminForm(p=>({...p,s:e.target.value}))} style={{flex:1,padding:space.sm,fontSize:fontSize.sm}}>
                    <option value="">-- Choisir --</option>
                    {subs.map(s=><option key={s} value={s}>{s}</option>)}
                    <option value="__new__">+ Nouvelle...</option>
                  </select>
                  {adminForm.s==='__new__'&&<input className="epj-input" placeholder="Nom" value={adminForm._newSub||''} onChange={e=>setAdminForm(p=>({...p,_newSub:e.target.value,s:'__new__'}))} style={{flex:1,padding:space.sm,fontSize:fontSize.sm}}/>}
                </div>
              ):(<Field dense value={adminForm.s||''} onChange={e=>setAdminForm(p=>({...p,s:e.target.value}))} placeholder="Nom de la sous-catégorie"/>)})()}
            </div>
            {['r','n','u'].map(f=>(
              <div key={f} style={{marginBottom:space.sm}}>
                <Field dense label={f==='r'?'Référence':f==='n'?'Désignation':'Unité'} mono={f==='r'} value={adminForm[f]||''} onChange={e=>setAdminForm(p=>({...p,[f]:e.target.value}))}/>
              </div>
            ))}
            {/* ─── Photo de l'article ─── */}
            <div style={{marginBottom:space.md}}>
              <label style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium,color:EPJ.gray700,display:'block',marginBottom:space.xs}}>Photo</label>
              {adminForm.img ? (
                <div>
                  <img src={adminForm.img} alt="" style={{width:'100%',maxHeight:180,objectFit:'cover',borderRadius:radius.sm + 2,border:`1px solid ${EPJ.gray200}`,display:'block',marginBottom:6}} onError={e=>{e.target.style.display='none'}}/>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <div style={{flex:1}}><Button full size="sm" variant="secondary" onClick={()=>artFileInputLibraryRef.current?.click()} disabled={!!artPhotoUploading}>🖼 Bibliothèque</Button></div>
                    <div style={{flex:1}}><Button full size="sm" variant="secondary" onClick={()=>artFileInputCameraRef.current?.click()} disabled={!!artPhotoUploading}>📷 Caméra</Button></div>
                    <Button size="sm" variant="danger" onClick={handleArticlePhotoRemove}>🗑 Supprimer</Button>
                  </div>
                </div>
              ) : (
                artPhotoUploading ? (
                  <div style={{width:'100%',padding:`${space.lg + 2}px ${space.sm + 2}px`,border:`2px dashed ${EPJ.orange}`,borderRadius:radius.sm + 2,background:EPJ.warningBg,color:EPJ.orangeText,fontSize:fontSize.sm,fontWeight:fontWeight.medium,textAlign:'center'}}>📤 Téléversement en cours… ({artPhotoUploading})</div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:6}}>
                    <button type="button" onClick={()=>artFileInputLibraryRef.current?.click()} style={{width:'100%',padding:`${space.md + 2}px ${space.sm + 2}px`,border:`2px dashed ${EPJ.gray300}`,borderRadius:radius.sm + 2,background:EPJ.gray50,color:EPJ.dark,fontSize:fontSize.sm,fontWeight:fontWeight.medium,cursor:'pointer',fontFamily:font}}>🖼 Choisir depuis la bibliothèque</button>
                    <button type="button" onClick={()=>artFileInputCameraRef.current?.click()} style={{width:'100%',padding:`${space.md + 2}px ${space.sm + 2}px`,border:`2px dashed ${EPJ.gray300}`,borderRadius:radius.sm + 2,background:EPJ.gray50,color:EPJ.dark,fontSize:fontSize.sm,fontWeight:fontWeight.medium,cursor:'pointer',fontFamily:font}}>📷 Prendre une photo (mobile)</button>
                  </div>
                )
              )}
              <input ref={artFileInputLibraryRef} type="file" accept="image/*" onChange={handleArticlePhotoSelect} style={{display:'none'}}/>
              <input ref={artFileInputCameraRef} type="file" accept="image/*" capture="environment" onChange={handleArticlePhotoSelect} style={{display:'none'}}/>
              <div style={{fontSize:fontSize.xs,color:EPJ.gray500,marginTop:space.xs}}>L'image sera compressée (max 1024 px) avant envoi.</div>
            </div>
            <label style={{display:"flex",alignItems:"center",gap:space.sm,marginBottom:space.md,cursor:"pointer",padding:`${space.sm}px ${space.sm + 2}px`,background:adminForm.stock!==false?EPJ.successBg:EPJ.warningBg,borderRadius:radius.sm + 2,border:adminForm.stock!==false?`2px solid ${EPJ.green}`:`2px solid ${EPJ.orange}`}}>
              <input type="checkbox" checked={adminForm.stock!==false} onChange={e=>setAdminForm(p=>({...p,stock:e.target.checked}))} style={{width:18,height:18}}/>
              <div><div style={{fontSize:fontSize.sm,fontWeight:fontWeight.medium}}>{adminForm.stock!==false?"📦 En stock":"⚠️ Hors stock"}</div><div style={{fontSize:fontSize.xs,color:EPJ.gray}}>Article tenu en stock au dépôt</div></div>
            </label>
            <div style={{display:'flex',gap:space.sm}}>
              <div style={{flex:1}}><Button full variant="secondary" onClick={()=>{setAdminEdit(null);setAdminForm({})}}>Annuler</Button></div>
              <div style={{flex:1}}><Button full loading={adminSaving} onClick={async()=>{
                // ─── v10.G.1 — Sauvegarde article ───────────────────
                // docId composite {catégorie}__{référence}.
                const newDocId = adminForm.r ? buildCatalogueDocId(adminForm.c, adminForm.r) : 'art_'+Date.now();
                const origDocId = (adminForm._origRef && adminForm._origCat)
                  ? buildCatalogueDocId(adminForm._origCat, adminForm._origRef)
                  : null;
                const subCat = adminForm.s==='__new__' ? (adminForm._newSub||'Général') : (adminForm.s||'Général');
                const saveData = {c:adminForm.c,s:subCat,r:adminForm.r,n:adminForm.n,u:adminForm.u||'Pièce',img:adminForm.img||'',imgPath:adminForm.imgPath||'',stock:adminForm.stock!==false,fournisseur:adminForm.fournisseur||'',codeEsabora:adminForm.codeEsabora||''};
                // Si la catégorie OU la référence a changé, l'ancien docId est obsolète → on supprime
                if(origDocId && origDocId !== newDocId) {
                  try { await deleteDoc(doc(db,'catalogue',origDocId)); } catch(e){ console.warn("Suppression ancien docId échouée:", e); }
                }
                adminSave('catalogue',newDocId,saveData);
              }} disabled={adminSaving||!adminForm.r||!adminForm.n}>💾 Sauvegarder</Button></div>
            </div>
          </div>}
          <div style={{fontSize:fontSize.xs,color:EPJ.gray,marginBottom:space.sm,fontVariantNumeric:'tabular-nums'}}>{filtered.length} article(s)</div>
          {filtered.slice(0,50).map(p=>(
            <div key={p._docId||(p.c+'__'+p.r)} className="epj-card" style={{marginBottom:space.xs,display:'flex',alignItems:'center',gap:space.sm,padding:`${space.sm}px ${space.md}px`,background:bulkSelected.some(x=>x.c===p.c&&x.r===p.r)?EPJ.infoBg:EPJ.white}}>
              {bulkMode&&<input type="checkbox" checked={bulkSelected.some(x=>x.c===p.c&&x.r===p.r)} onChange={e=>{if(e.target.checked)setBulkSelected(s=>[...s,{c:p.c,r:p.r}]);else setBulkSelected(s=>s.filter(x=>!(x.c===p.c&&x.r===p.r)))}} style={{width:18,height:18,flexShrink:0}}/>}
              {p.img?<img src={p.img} alt="" style={{width:36,height:36,borderRadius:radius.sm,objectFit:'cover'}}/>:<CatIcon cat={p.c} size={36}/>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:fontSize.xs,fontWeight:fontWeight.medium,color:EPJ.dark,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.n}</div>
                <div style={{fontSize:fontSize.xs,color:EPJ.gray,fontFamily:fontFamilies.mono}}>{p.r} • {p.s} {p.stock===false?'• ⚠️':''}</div>
              </div>
              {!bulkMode&&<IconButton label={`Modifier ${p.r}`} onClick={()=>{setAdminEdit('edit_'+p.c+'__'+p.r);setAdminForm({...p,_origRef:p.r,_origCat:p.c})}}>✏️</IconButton>}
              {!bulkMode&&<IconButton variant="danger" label={`Supprimer ${p.r}`} onClick={()=>{const docId=buildCatalogueDocId(p.c,p.r);adminDelete('catalogue',docId)}}>🗑️</IconButton>}
            </div>
          ))}
          {filtered.length>50&&<div style={{textAlign:'center',padding:space.sm + 2,fontSize:fontSize.xs,color:EPJ.gray500}}>... et {filtered.length-50} autres articles (utilisez la recherche)</div>}
        </div>
        {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:EPJ.white,padding:`${space.sm}px ${space.xl - 4}px`,borderRadius:radius.pill,fontSize:fontSize.sm,fontWeight:fontWeight.medium,zIndex:400}}>{toast}</div>}
      </div>
    );}
  }

  return null;
}

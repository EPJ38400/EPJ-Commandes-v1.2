// Script d'initialisation Firestore — À exécuter UNE SEULE FOIS
// Ce script charge les utilisateurs, chantiers et catalogue dans Firebase
// Accédez à votre app avec ?init=true pour l'exécuter

import { db } from "./firebase";
import { collection, doc, setDoc, getDocs, writeBatch } from "firebase/firestore";

// ─── DONNÉES INITIALES ───

const USERS_INIT = [
  { id:"admin", pwd:"admin2010", prenom:"Admin", nom:"EPJ", fonction:"Admin", email:"admin@epj.fr", directAchat:true },
  { id:"Bilardo", pwd:"1234", prenom:"Joseph", nom:"BILARDO", fonction:"Conducteur de travaux", email:"j.bilardo@epj-electricite.com", directAchat:true },
  { id:"Frasca", pwd:"1234", prenom:"Thibaut", nom:"FRASCA", fonction:"Conducteur de travaux", email:"t.frasca@epj-electricite.com", directAchat:false },
  { id:"Courteau", pwd:"1234", prenom:"Mickael", nom:"COURTEAU", fonction:"Chef de chantier", email:"m.courteau@epj-electricite.com", directAchat:false },
  { id:"Rey", pwd:"1234", prenom:"Guillaume", nom:"REY", fonction:"Conducteur de travaux", email:"g.rey@epj-electricite.com", directAchat:false },
  { id:"Bartoli", pwd:"1234", prenom:"Thomas", nom:"BARTOLI", fonction:"Ouvrier", email:"", directAchat:false },
  { id:"Mollin", pwd:"1234", prenom:"Sylvain", nom:"MOLLIN", fonction:"Chef de chantier", email:"", directAchat:false },
];

const CHANTIERS_INIT = [
  { num:"001386", nom:"LE VAL/JADE", conducteur:"Mickael COURTEAU", emailConducteur:"m.courteau@epj-electricite.com", adresse:"RUE DU 19 MARS 1962 - 38320 EYBENS", statut:"Actif" },
  { num:"002179", nom:"LES HAUTS DU CERVOLAY", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"LIEU DIT L'ETANG - 73290 LA MOTTE SERVOLEX", statut:"Actif" },
  { num:"001983", nom:"LE 17", conducteur:"Joseph BILARDO", emailConducteur:"j.bilardo@epj-electricite.com", adresse:"17 RUE FIRMIN ROBERT - 38800 LE PONT DE CLAIX", statut:"Actif" },
  { num:"002209", nom:"L'OISEAU BLANC", conducteur:"Joseph BILARDO", emailConducteur:"j.bilardo@epj-electricite.com", adresse:"199/201 Av. A. Croizat - 38400 SMH", statut:"Actif" },
  { num:"002223", nom:"VILLA ST ALBAN LEYSSE", conducteur:"Guillaume REY", emailConducteur:"g.rey@epj-electricite.com", adresse:"193 rue du Villaret - 73230 ST-ALBAN-LEYSSE", statut:"Actif" },
  { num:"002216", nom:"DOMAINE DE BEAUVOIR", conducteur:"Guillaume REY", emailConducteur:"g.rey@epj-electricite.com", adresse:"Rue Victor Hugo - 73190 CHALLES-LES-EAUX", statut:"Actif" },
  { num:"002234", nom:"TERRA FLORA", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"18 Chemin du Foray - 73000 CHAMBÉRY", statut:"Actif" },
  { num:"001374", nom:"LES OREADES", conducteur:"Joseph BILARDO", emailConducteur:"j.bilardo@epj-electricite.com", adresse:"Rue Gavanière - 38120 SAINT-ÉGRÈVE", statut:"Actif" },
  { num:"002232", nom:"LE CLOS MARENGO", conducteur:"Mickael COURTEAU", emailConducteur:"m.courteau@epj-electricite.com", adresse:"54, route des Angonnes - 38320 BRIE ET ANGONNES", statut:"Actif" },
  { num:"002243", nom:"LE PETIT BROGNY/HOYA", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"75-77 ROUTE DU PERIMETRE - 74000 ANNECY", statut:"Actif" },
  { num:"001984", nom:"SCI LE VILLAGE / TEMPORA", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"Route de Lyon - 38140 APPRIEU", statut:"Actif" },
  { num:"002257", nom:"FLORE ET SENS", conducteur:"Joseph BILARDO", emailConducteur:"j.bilardo@epj-electricite.com", adresse:"Rue Guy Moquet - 38130 ÉCHIROLLES", statut:"Actif" },
  { num:"002279", nom:"TERRA FLORA OPAC", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"18 Chemin du Foray - 73000 CHAMBÉRY", statut:"Actif" },
  { num:"002264", nom:"BELLE ETOILE", conducteur:"Joseph BILARDO", emailConducteur:"j.bilardo@epj-electricite.com", adresse:"32, rue des Écoles - 38250 LANS-EN-VERCORS", statut:"Actif" },
  { num:"002280", nom:"FIL DE SOIE", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"105, Rue du Champs de Mars - 38630 CORBELIN", statut:"Actif" },
  { num:"002281", nom:"FLEUR DE VIGNE", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"Chemin du Fangeat - 38330 SAINT-ISMIER", statut:"Actif" },
  { num:"002282", nom:"L'ASTRÉE", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"36, place de la Gare - 38530 PONTCHARRA", statut:"Actif" },
  { num:"002275", nom:"SENNES DU LAC", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"2A chemin du Pêcheur - 73100 AIX-LES-BAINS", statut:"Actif" },
  { num:"002256", nom:"CROIX BLANCHE", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"", statut:"Actif" },
];

export async function initEPJData(forceReinit = false) {
  const results = { users: 0, chantiers: 0, catalog: 0, errors: [] };
  
  try {
    // Check if already initialized
    if (!forceReinit) {
      const usersSnap = await getDocs(collection(db, "utilisateurs"));
      if (usersSnap.size > 0) {
        return { ...results, message: "Base déjà initialisée (" + usersSnap.size + " utilisateurs trouvés). Utilisez forceReinit pour réinitialiser." };
      }
    }

    // Upload Users
    for (const u of USERS_INIT) {
      await setDoc(doc(db, "utilisateurs", u.id), u);
      results.users++;
    }

    // Upload Chantiers
    for (const ch of CHANTIERS_INIT) {
      await setDoc(doc(db, "chantiers", ch.num), ch);
      results.chantiers++;
    }

    // Upload config with NEW categories
    await setDoc(doc(db, "config", "settings"), {
      emailAchats: "achat@epj-electricite.com",
      equipCategories: ["Outillage","Habillé","EPI"],
      catIcons: {"Béton + Descente":"🧱","Conduit + Manchon":"🔧","Équip. Sous-Sol":"🏗️","Plexo":"🔌","Placo":"📦","Colonne Montante":"⚡","Câble Colonne":"🔗","Équipement Commun":"🏢","Équipement Logement":"🏠","Courant Faible":"📡","Interphonie":"🔔","Lustrerie":"💡","Quincaillerie":"🔩","Outillage":"🛠️","Divers":"📎","Fils / Câbles":"🔌","Habillé":"👔","EPI":"🦺","Câbles":"🔌"}
    });

    results.message = `Initialisation terminée : ${results.users} utilisateurs, ${results.chantiers} chantiers.`;
  } catch (err) {
    results.errors.push(err.message);
    results.message = "Erreur: " + err.message;
  }
  
  return results;
}

export async function uploadCatalog(catalogArray) {
  let count = 0;
  // Use batched writes (max 500 per batch)
  const batchSize = 450;
  for (let i = 0; i < catalogArray.length; i += batchSize) {
    const batch = writeBatch(db);
    const chunk = catalogArray.slice(i, i + batchSize);
    for (const item of chunk) {
      const docId = item.r.replace(/[\/\s]/g, '_'); // Safe doc ID
      batch.set(doc(db, "catalogue", docId), {
        c: item.c || '',
        s: item.s || '',
        r: item.r || '',
        n: item.n || '',
        u: item.u || 'Pièce',
        img: item.img || ''
      });
      count++;
    }
    await batch.commit();
  }
  return count;
}

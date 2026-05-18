// ═══════════════════════════════════════════════════════════════
//  Firebase init — projet ap-epj
//  v1.12.0 : ajout fonctions Auth pour gestion mdp
//   - sendPasswordResetEmail : mdp oublié
//   - updatePassword + reauthenticate : changement mdp dans l'app
//   - onAuthStateChanged : reactivité session
// ═══════════════════════════════════════════════════════════════
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, browserLocalPersistence, setPersistence } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDBrJnApDSAXDCww5fs2Y6qKPylK-vwSqM",
  authDomain: "ap-epj.firebaseapp.com",
  projectId: "ap-epj",
  storageBucket: "ap-epj.firebasestorage.app",
  messagingSenderId: "133243660224",
  appId: "1:133243660224:web:a0f7fc0ebd18a7c0ba0a25",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Locale française pour les emails de reset envoyés par Firebase
auth.languageCode = "fr";

// Persistance locale : la session Auth survit à un refresh / fermeture d'onglet
setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn("Firebase Auth persistence:", err);
});

// ═══════════════════════════════════════════════════════════════
//  Firebase init — projet ap-epj (conservé de la V1.3)
// ═══════════════════════════════════════════════════════════════
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDBrJnApDSAXDCww5fs2Y6qKPylK-vwSqM",
  authDomain: "ap-epj.firebaseapp.com",
  projectId: "ap-epj",
  storageBucket: "ap-epj.firebasestorage.app",
  messagingSenderId: "133243660224",
  appId: "1:133243660224:web:a0f7fc0ebd18a7c0ba0a25",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);

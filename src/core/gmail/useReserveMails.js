// ═══════════════════════════════════════════════════════════════
//  useReserveMails — Hook d'écoute Firestore des mails d'une réserve
//  v1.13.0 — Brique mail
//  Synchronise en temps réel reserveMails et reconstruit la timeline
//  d'événements internes à partir des champs de la réserve.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState, useMemo } from "react";
import { db } from "../../firebase";
import {
  collection, query, where, orderBy, onSnapshot,
  addDoc, serverTimestamp, doc, updateDoc,
} from "firebase/firestore";
import {
  COLLECTION_RESERVE_MAILS,
  COLLECTION_MAILS_A_CLASSER,
} from "../../../firestore/SCHEMA_MAILS";

/**
 * Écoute en temps réel les mails rattachés à une réserve.
 * @param {string} reserveId
 * @returns {{ mails: Array, loading: boolean, error: any }}
 */
export function useReserveMails(reserveId) {
  const [mails, setMails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!reserveId) {
      setMails([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(
      collection(db, COLLECTION_RESERVE_MAILS),
      where("reserveId", "==", reserveId),
      orderBy("dateEnvoi", "asc"),
    );
    const unsub = onSnapshot(
      q,
      snap => {
        const list = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
        // Conversion Timestamp Firestore → ISO pour cohérence avec le reste de l'app
        list.forEach(m => {
          if (m.dateEnvoi?.toDate) m.dateEnvoi = m.dateEnvoi.toDate().toISOString();
          if (m.dateAspiration?.toDate) m.dateAspiration = m.dateAspiration.toDate().toISOString();
        });
        setMails(list);
        setLoading(false);
        setError(null);
      },
      err => {
        console.error("[useReserveMails] erreur snapshot:", err);
        setError(err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, [reserveId]);

  return { mails, loading, error };
}

/**
 * Construit la liste d'événements internes à afficher dans la timeline
 * à partir des champs d'une réserve. Ne fait que dériver, ne stocke rien.
 *
 * Types renvoyés : creation, attribution, rdv, note, signature, statut, quitus.
 */
export function useReserveEvents(reserve) {
  return useMemo(() => {
    if (!reserve) return [];
    const events = [];

    // Création
    if (reserve.dateCreation) {
      events.push({
        kind: "creation",
        date: reserve.dateCreation,
        auteur: reserve.creeParNom,
        texte: `Réserve ${reserve.numReserve} créée`,
      });
    }

    // Attribution
    if (reserve.affecteAUserId && reserve.dateAffectation) {
      events.push({
        kind: "attribution",
        date: reserve.dateAffectation,
        auteur: "Système",
        texte: `Attribuée à ${reserve.affecteANom || "—"}`,
      });
    }

    // RDV planifié
    if (reserve.rdvPris && reserve.rdvDate) {
      // Date du RDV considérée comme date de l'événement
      const heure = reserve.rdvHeure || "00:00";
      const dateRdv = `${reserve.rdvDate}T${heure}:00`;
      events.push({
        kind: "rdv",
        date: dateRdv,
        texte: `RDV planifié`,
      });
    }

    // Notes internes (tableau dans la réserve)
    (reserve.notes || []).forEach(n => {
      events.push({
        kind: "note",
        date: n.date,
        auteur: n.auteur,
        texte: n.texte,
      });
    });

    // Levée
    if (reserve.dateLevee) {
      events.push({
        kind: "signature",
        date: reserve.dateLevee,
        auteur: reserve.leveeParNom,
        texte: reserve.commentaireLevee || "Réserve levée",
      });
    }

    // Quitus
    if (reserve.dateQuitus) {
      events.push({
        kind: "quitus",
        date: reserve.dateQuitus,
        texte: "Quitus signé — PDF verrouillé",
      });
    }

    return events;
  }, [reserve]);
}

/**
 * Ajoute une note interne à la réserve (dans le tableau `notes`).
 * Apparaît immédiatement dans la timeline via useReserveEvents.
 */
export async function addInternalNote(reserveId, texte, auteur) {
  if (!reserveId || !texte?.trim()) return;
  const ref = doc(db, "reserves", reserveId);
  // Lecture optimiste : on récupère les notes existantes pour les concaténer
  // (alternative : arrayUnion, mais le tri par date serait perdu)
  const { getDoc } = await import("firebase/firestore");
  const snap = await getDoc(ref);
  const notes = snap.exists() ? (snap.data().notes || []) : [];
  notes.push({
    id: `note_${Date.now()}`,
    date: new Date().toISOString(),
    auteur: auteur || "—",
    texte: texte.trim(),
  });
  await updateDoc(ref, { notes, updatedAt: serverTimestamp() });
}

/**
 * Envoie une demande d'envoi de mail (via Cloud Function gmailSend).
 * En attendant que la Cloud Function existe, on crée juste un enregistrement
 * dans la collection `mailOutbox` qui sera traité par la fonction.
 */
export async function queueOutgoingMail(draft, userId) {
  return await addDoc(collection(db, "mailOutbox"), {
    ...draft,
    senderUserId: userId,
    statut: "pending",
    createdAt: serverTimestamp(),
  });
}

/**
 * Écoute la file "à classer" (pour l'écran admin/conducteur).
 */
export function useMailsAClasser() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, COLLECTION_MAILS_A_CLASSER),
      where("statut", "==", "en_attente"),
      orderBy("dateAspiration", "desc"),
    );
    const unsub = onSnapshot(q, snap => {
      const list = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      list.forEach(m => {
        if (m.dateEnvoi?.toDate) m.dateEnvoi = m.dateEnvoi.toDate().toISOString();
        if (m.dateAspiration?.toDate) m.dateAspiration = m.dateAspiration.toDate().toISOString();
      });
      setItems(list);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  return { items, loading };
}

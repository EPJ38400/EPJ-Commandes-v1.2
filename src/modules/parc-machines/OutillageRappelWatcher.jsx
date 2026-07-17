// ═══════════════════════════════════════════════════════════════
//  OutillageRappelWatcher.jsx — v10.K
//  Composant invisible monté quand l'utilisateur est connecté.
//  Parcourt les sorties d'outils actives et :
//    1) déclenche le SMS de rappel J si la date prévue est dépassée
//       (idempotent : flag smsRappelJSent posé sur la sortie)
//    2) flagge l'anomalie J+2 sur la sortie (pour le Dashboard)
//
//  Exécuté au montage + toutes les 30 min tant que l'app est ouverte.
//  AUCUN SMS ne dépend du fait que ce soit le monteur lui-même qui ait
//  ouvert l'app — n'importe quel utilisateur connecté déclenche le cycle.
// ═══════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { db } from "../../firebase";
import { doc, updateDoc, getDoc } from "firebase/firestore";
import { useData } from "../../core/DataContext";
import {
  shouldSendRappelJ, shouldFlagAnomalieJ2, isSortieActive,
} from "./outillageRappel";
import { smsOutillageRappelRetour, findUserByUid } from "../../core/smsService";

// Intervalle de re-vérification (30 minutes)
const CHECK_INTERVAL_MS = 30 * 60 * 1000;

export function OutillageRappelWatcher() {
  const { outillageSorties = [], users = [], smsTemplates = [], allLoaded } = useData();

  useEffect(() => {
    if (!allLoaded) return;
    // Pas de listener tant que les données ne sont pas chargées
    let stopped = false;

    const runCheck = async () => {
      if (stopped) return;
      const today = new Date();
      for (const cached of outillageSorties) {
        if (stopped) return;
        try {
          const sortieId = cached._id || cached.id;
          // Décision préliminaire sur le cache DataContext (peut être PÉRIMÉ :
          // sur iPhone PWA en arrière-plan, le listener Firestore se suspend et
          // l'intervalle refire au réveil sur un tableau obsolète — c'est la
          // cause du bug prod « SMS de rappel sur outil déjà rentré »).
          const wantSms = shouldSendRappelJ(cached, today);
          const wantAnomalie = shouldFlagAnomalieJ2(cached, today);
          if (!wantSms && !wantAnomalie) continue;

          // ─── DOUBLE GARDE : re-lecture autoritative AVANT toute écriture ───
          // On ne se fie jamais au cache pour agir : on relit le doc frais.
          let fresh;
          try {
            const snap = await getDoc(doc(db, "outillageSorties", sortieId));
            if (!snap.exists()) continue;
            fresh = { ...snap.data(), _id: sortieId };
          } catch (e) {
            console.warn("[relance] échec re-lecture sortie", sortieId, e.message);
            continue;
          }
          // Sortie clôturée entre la construction de la file et l'envoi → skip.
          if (!isSortieActive(fresh)) {
            console.log(
              `[relance] sortie ${sortieId} ignorée — rentrée le ${formatDateFR(fresh.dateRetourReelle) || "?"} par ${fresh.retourParNom || "?"}`
            );
            continue;
          }

          const sortie = fresh;
          // ─── 1) SMS de rappel J (ré-évalué sur le doc frais) ───
          if (shouldSendRappelJ(sortie, today)) {
            const emprunteur = findUserByUid(sortie.emprunteurId, users);
            if (emprunteur && (emprunteur.telephone || emprunteur.tel)) {
              const res = await smsOutillageRappelRetour({
                smsTemplates,
                emprunteur,
                refOutil: sortie.ref,
                nomOutil: sortie.nom,
                dateRetour: formatDateFR(sortie.dateRetourPrevue),
                sortieId: sortie._id || sortie.id,
              });
              // Marquer la sortie pour éviter renvoi (idempotence)
              if (res?.queued || res?.reason) {
                try {
                  await updateDoc(doc(db, "outillageSorties", sortie._id || sortie.id), {
                    smsRappelJSent: true,
                    smsRappelJSentAt: new Date().toISOString(),
                  });
                  console.log(`[v10.K] SMS rappel J posé pour sortie ${sortie._id || sortie.id} (${sortie.ref})`);
                } catch (e) {
                  console.warn("[v10.K] Échec maj smsRappelJSent:", e.message);
                }
              }
            } else {
              console.warn(`[v10.K] Pas d'emprunteur/téléphone pour sortie ${sortie._id} — SMS non envoyé`);
            }
          }

          // ─── 2) Anomalie J+2 (pas de SMS, juste flag pour Dashboard) ───
          if (shouldFlagAnomalieJ2(sortie, today)) {
            try {
              await updateDoc(doc(db, "outillageSorties", sortie._id || sortie.id), {
                anomalieJ2: true,
                anomalieJ2At: new Date().toISOString(),
              });
              console.log(`[v10.K] Anomalie J+2 flaggée pour sortie ${sortie._id || sortie.id} (${sortie.ref})`);
            } catch (e) {
              console.warn("[v10.K] Échec maj anomalieJ2:", e.message);
            }
          }
        } catch (err) {
          console.warn("[v10.K] Erreur traitement sortie:", err);
        }
      }
    };

    // Premier passage au montage
    runCheck();
    // Re-vérification périodique
    const itv = setInterval(runCheck, CHECK_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(itv);
    };
  }, [allLoaded, outillageSorties, users, smsTemplates]);

  // Composant invisible (rien à afficher)
  return null;
}

// Format JJ/MM/AAAA depuis une date ISO ou FR
function formatDateFR(raw) {
  if (!raw) return "";
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return s.slice(0, 10);
  return s;
}

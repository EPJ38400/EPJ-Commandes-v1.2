// ═══════════════════════════════════════════════════════════════
//  ReservesRappelWatcher.jsx — v10.N
//
//  Composant invisible monté quand l'utilisateur est connecté.
//  Parcourt les réserves actives en retard et déclenche le SMS de
//  rappel au destinataire COURANT (cohérent avec les transferts).
//
//  Exécuté au montage + toutes les 5 min (Q6 PJY confirmée).
//  Idempotent via flag smsRappelRetardSent sur la réserve.
//  Si transfert : flag reset → nouveau cycle au prochain check.
// ═══════════════════════════════════════════════════════════════
import { useEffect } from "react";
import { db } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";
import { useData } from "../../core/DataContext";
import { shouldSendRappelLevee } from "./reservesRappel";
import { smsReserveRappelLevee, findUserByUid } from "../../core/smsService";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min

export function ReservesRappelWatcher() {
  const { reserves = [], users = [], smsTemplates = [], allLoaded } = useData();

  useEffect(() => {
    if (!allLoaded) return;
    let stopped = false;

    const runCheck = async () => {
      if (stopped) return;
      const today = new Date();
      for (const reserve of reserves) {
        if (stopped) return;
        try {
          if (!shouldSendRappelLevee(reserve, today)) continue;

          const destinataire = findUserByUid(reserve.affecteAUserId, users);
          if (!destinataire || (!destinataire.telephone && !destinataire.tel)) {
            console.warn(`[v10.N] Réserve ${reserve._id} : destinataire sans téléphone`);
            continue;
          }

          const res = await smsReserveRappelLevee({
            smsTemplates,
            destinataire,
            refReserve: reserve.numReserve || reserve._id,
            titreReserve: reserve.titre || reserve.description || "",
            chantier: reserve.chantierNom || "",
            dateLevee: formatDateFR(reserve.dateSouhaiteLevee),
            reserveId: reserve._id,
          });

          if (res?.queued || res?.reason) {
            try {
              await updateDoc(doc(db, "reserves", reserve._id), {
                smsRappelRetardSent: true,
                smsRappelRetardSentAt: new Date().toISOString(),
              });
              console.log(`[v10.N] SMS rappel levée posé pour réserve ${reserve.numReserve}`);
            } catch (e) {
              console.warn("[v10.N] Échec maj flag rappel:", e.message);
            }
          }
        } catch (err) {
          console.warn("[v10.N] Erreur traitement réserve:", err);
        }
      }
    };

    runCheck();
    const itv = setInterval(runCheck, CHECK_INTERVAL_MS);
    return () => {
      stopped = true;
      clearInterval(itv);
    };
  }, [allLoaded, reserves, users, smsTemplates]);

  return null;
}

function formatDateFR(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[3] + "/" + m[2] + "/" + m[1];
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return s.slice(0, 10);
  return s;
}

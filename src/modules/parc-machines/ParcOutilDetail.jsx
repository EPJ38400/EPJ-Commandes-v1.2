// ═══════════════════════════════════════════════════════════════
//  ParcOutilDetail v8 — Fiche d'un outil + boutons d'action
//  - Sortir / Retourner / Transférer selon le statut
//  - Affectation permanente
//  - Historique complet (sorties + transferts)
//  - Bouton "Copier SMS rappel" si en retard
// ═══════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import {
  OUTIL_STATUTS, computeOutilStatut, findSortieEnCours, canSortirOutil,
  canGererCatalogue, isLate, formatDate, getCategorieIcon, getCategorieLabel,
  renderSmsTemplate, copyToClipboard,
} from "./parcUtils";
import { ParcOutilSortie } from "./ParcOutilSortie";
import { ParcOutilRetour } from "./ParcOutilRetour";
import { ParcOutilTransfert } from "./ParcOutilTransfert";

export function ParcOutilDetail({ outil, onBack }) {
  const { user } = useAuth();
  const {
    outillageSorties, users, chantiers,
    outillageCategories, outillagePannes, smsTemplates,
  } = useData();
  const toast = useToast();

  const [flow, setFlow] = useState(null); // null | "sortie" | "retour" | "transfert"

  const effectiveStatus = computeOutilStatut(outil, outillageSorties);
  const sortieEnCours = findSortieEnCours(outil._id, outillageSorties);
  const st = OUTIL_STATUTS[effectiveStatus];
  const catLabel = getCategorieLabel(outillageCategories, outil.categorieId);
  const catIcon = getCategorieIcon(outillageCategories, outil.categorieId);

  const emprunteur = sortieEnCours ? users.find(u => u.id === sortieEnCours.emprunteurId) : null;
  const affecteUser = outil.affectationPermanenteUserId
    ? users.find(u => u.id === outil.affectationPermanenteUserId)
    : null;
  const chantierSortie = sortieEnCours?.chantierNum
    ? chantiers.find(c => c.num === sortieEnCours.chantierNum)
    : null;

  // Permissions
  const userCanSortir = canSortirOutil(user);
  const userCanGerer = canGererCatalogue(user);
  const isCurrentHolder = sortieEnCours && user.id === sortieEnCours.emprunteurId;
  const canTransfer = (isCurrentHolder || userCanGerer) && sortieEnCours;
  const canRetour = (isCurrentHolder || userCanGerer) && sortieEnCours;

  // Historique des sorties rendues pour cet outil
  const historiqueRendues = useMemo(() => {
    return outillageSorties
      .filter(s => s.outilId === outil._id && !!s.dateRetourReelle)
      .sort((a, b) => (b.dateRetourReelle || "").localeCompare(a.dateRetourReelle || ""))
      .slice(0, 5);
  }, [outillageSorties, outil._id]);

  // Si on est dans un sous-flow → affiche le formulaire correspondant
  if (flow === "sortie") {
    return <ParcOutilSortie outil={outil} onBack={() => setFlow(null)} onDone={() => setFlow(null)}/>;
  }
  if (flow === "retour" && sortieEnCours) {
    return <ParcOutilRetour outil={outil} sortie={sortieEnCours} onBack={() => setFlow(null)} onDone={() => setFlow(null)}/>;
  }
  if (flow === "transfert" && sortieEnCours) {
    return <ParcOutilTransfert outil={outil} sortie={sortieEnCours} onBack={() => setFlow(null)} onDone={() => setFlow(null)}/>;
  }

  // Génère le SMS de rappel avec le premier template actif de module parc-machines
  const handleCopySms = async () => {
    if (!sortieEnCours) return;
    const template = smsTemplates.find(
      t => t.module === "parc-machines" && t.actif !== false &&
        (isLate(sortieEnCours.dateRetourPrevue) ? t.id.includes("retard") : true)
    ) || smsTemplates.find(t => t.module === "parc-machines" && t.actif !== false);

    if (!template) {
      toast("❌ Aucun modèle SMS configuré. Ajoute-en un dans Admin → Modèles SMS.");
      return;
    }
    const emprunteurUser = emprunteur;
    const vars = {
      prenom: emprunteurUser?.prenom || sortieEnCours.emprunteurNom?.split(" ")[0] || "",
      nom: outil.nom,
      ref: outil.ref,
      dateRetour: formatDate(sortieEnCours.dateRetourPrevue),
      chantier: chantierSortie ? `${chantierSortie.num} - ${chantierSortie.nom}` : "",
    };
    const msg = renderSmsTemplate(template.body, vars);
    const ok = await copyToClipboard(msg);
    if (ok) {
      toast("✓ SMS copié. Colle-le dans Messages.");
      if (emprunteurUser?.telephone) {
        // Propose d'ouvrir Messages directement (iOS : sms:, Android gère aussi)
        setTimeout(() => {
          if (confirm(`SMS copié dans le presse-papier.\n\nOuvrir Messages pour ${emprunteurUser.prenom} (${emprunteurUser.telephone}) ?`)) {
            window.location.href = `sms:${emprunteurUser.telephone}`;
          }
        }, 300);
      }
    } else {
      toast("❌ Copie impossible sur cet appareil");
    }
  };

  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: font.display, fontSize: 18, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{outil.nom}</div>
          <div style={{
            fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3,
            textTransform: "uppercase", fontWeight: 600, marginTop: 1,
            fontFamily: "monospace",
          }}>{outil.ref}</div>
        </div>
      </div>

      {/* Bandeau statut */}
      <div style={{
        padding: "12px 14px", marginBottom: 12,
        background: `${st.color}12`,
        borderLeft: `4px solid ${st.color}`,
        borderRadius: 8,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ fontSize: 18 }}>{st.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: st.color }}>{st.label}</div>
          {affecteUser && effectiveStatus === "affecte" && (
            <div style={{ fontSize: 11, color: EPJ.gray600, marginTop: 2 }}>
              Attribué en permanence à <b>{affecteUser.prenom} {affecteUser.nom}</b>
            </div>
          )}
          {sortieEnCours && (
            <div style={{ fontSize: 11, color: EPJ.gray600, marginTop: 2 }}>
              Chez <b>{emprunteur ? `${emprunteur.prenom} ${emprunteur.nom}` : sortieEnCours.emprunteurNom || "—"}</b>
              {" — retour prévu le "}{formatDate(sortieEnCours.dateRetourPrevue)}
              {isLate(sortieEnCours.dateRetourPrevue) && (
                <span style={{ color: EPJ.red, fontWeight: 700 }}> (en retard)</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Photo */}
      {outil.photoURL ? (
        <img src={outil.photoURL} alt={outil.nom} style={{
          width: "100%", maxHeight: 280, objectFit: "cover",
          borderRadius: 12, border: `1px solid ${EPJ.gray200}`,
          marginBottom: 12,
        }}/>
      ) : (
        <div style={{
          height: 160, borderRadius: 12, background: EPJ.gray100,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 64, marginBottom: 12,
        }}>{catIcon}</div>
      )}

      {/* Infos */}
      <div className="epj-card" style={{ padding: 0, marginBottom: 12, overflow: "hidden" }}>
        <InfoRow label="Catégorie" value={`${catIcon} ${catLabel}`}/>
        {outil.marque && <InfoRow label="Marque" value={outil.marque}/>}
        {outil.numSerie && <InfoRow label="N° de série" value={outil.numSerie} mono/>}
        {outil.codeBarres && <InfoRow label="Code-barres" value={outil.codeBarres} mono/>}
        {outil.notes && <InfoRow label="Notes" value={outil.notes}/>}
      </div>

      {/* Sortie en cours — détails */}
      {sortieEnCours && (
        <div className="epj-card" style={{ padding: "12px 14px", marginBottom: 12 }}>
          <div style={{
            fontSize: 10, color: EPJ.gray500, fontWeight: 600,
            letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8,
          }}>📤 Sortie en cours</div>
          <div style={{ fontSize: 12, color: EPJ.gray700, marginBottom: 4 }}>
            <b>Sortie le :</b> {formatDate(sortieEnCours.dateSortie)}
          </div>
          {chantierSortie && (
            <div style={{ fontSize: 12, color: EPJ.gray700, marginBottom: 4 }}>
              <b>Chantier :</b> {chantierSortie.num} — {chantierSortie.nom}
            </div>
          )}
          {sortieEnCours.commentaireSortie && (
            <div style={{
              fontSize: 11, color: EPJ.gray600, marginTop: 6,
              fontStyle: "italic", lineHeight: 1.5,
              padding: "6px 8px", background: EPJ.gray50, borderRadius: 6,
            }}>💬 {sortieEnCours.commentaireSortie}</div>
          )}

          {/* Bouton SMS rappel si en retard */}
          {isLate(sortieEnCours.dateRetourPrevue) && (
            <button onClick={handleCopySms} style={{
              width: "100%", marginTop: 10,
              padding: "10px 12px", borderRadius: 8,
              background: `${EPJ.red}12`, color: EPJ.red,
              border: `1px solid ${EPJ.red}40`,
              fontSize: 12, fontWeight: 700, cursor: "pointer",
              fontFamily: font.body,
            }}>📱 Copier SMS rappel & ouvrir Messages</button>
          )}
        </div>
      )}

      {/* Historique des transferts de la sortie en cours */}
      {sortieEnCours?.transferts?.length > 0 && (
        <div className="epj-card" style={{ padding: "12px 14px", marginBottom: 12 }}>
          <div style={{
            fontSize: 10, color: EPJ.gray500, fontWeight: 600,
            letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8,
          }}>🔄 Transferts ({sortieEnCours.transferts.length})</div>
          {sortieEnCours.transferts.map(t => {
            const tChantier = t.chantierNum ? chantiers.find(c => c.num === t.chantierNum) : null;
            return (
              <div key={t.id} style={{
                padding: "8px 10px", marginBottom: 4,
                background: `${EPJ.blue}06`, borderRadius: 6,
                borderLeft: `2px solid ${EPJ.blue}`,
                fontSize: 11, lineHeight: 1.5,
              }}>
                <div style={{ color: EPJ.gray900, fontWeight: 600 }}>
                  {t.fromUserNom} → {t.toUserNom}
                </div>
                <div style={{ color: EPJ.gray500, marginTop: 1 }}>
                  {new Date(t.date).toLocaleString("fr-FR", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  })}
                  {tChantier && ` • ${tChantier.num}`}
                </div>
                {t.motif && (
                  <div style={{ color: EPJ.gray600, marginTop: 3, fontStyle: "italic" }}>
                    "{t.motif}"
                  </div>
                )}
                {(t.signatureFrom || t.signatureTo) && (
                  <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                    {t.signatureFrom && (
                      <img src={t.signatureFrom} alt="sig-from" style={{
                        height: 40, borderRadius: 4,
                        background: "#fff", border: `1px solid ${EPJ.gray200}`,
                        flex: 1, objectFit: "contain",
                      }}/>
                    )}
                    {t.signatureTo && (
                      <img src={t.signatureTo} alt="sig-to" style={{
                        height: 40, borderRadius: 4,
                        background: "#fff", border: `1px solid ${EPJ.gray200}`,
                        flex: 1, objectFit: "contain",
                      }}/>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* BOUTONS D'ACTION selon statut */}

      {/* Outil disponible → bouton Sortir */}
      {effectiveStatus === "disponible" && userCanSortir && (
        <button onClick={() => setFlow("sortie")} style={{
          width: "100%", padding: "14px 0", marginBottom: 10,
          background: EPJ.orange, color: "#fff", border: "none",
          borderRadius: 10, fontSize: 14, fontWeight: 700,
          cursor: "pointer", fontFamily: font.body,
        }}>📤 Sortir cet outil</button>
      )}

      {effectiveStatus === "disponible" && !userCanSortir && (
        <div className="epj-card" style={{
          padding: "10px 12px", marginBottom: 10,
          background: `${EPJ.gray500}10`,
          fontSize: 11, color: EPJ.gray600, lineHeight: 1.5,
        }}>
          🔒 Tu n'es pas autorisé à sortir des outils. Contacte un administrateur.
        </div>
      )}

      {/* Outil sorti → bouton Retourner + Transférer */}
      {(effectiveStatus === "sorti" || effectiveStatus === "en_retard") && (
        <>
          {canRetour && (
            <button onClick={() => setFlow("retour")} style={{
              width: "100%", padding: "14px 0", marginBottom: 8,
              background: EPJ.green, color: "#fff", border: "none",
              borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: font.body,
            }}>✓ Enregistrer le retour</button>
          )}
          {canTransfer && (
            <button onClick={() => setFlow("transfert")} style={{
              width: "100%", padding: "14px 0", marginBottom: 10,
              background: EPJ.blue, color: "#fff", border: "none",
              borderRadius: 10, fontSize: 14, fontWeight: 700,
              cursor: "pointer", fontFamily: font.body,
            }}>🔄 Transférer à une autre personne</button>
          )}
          {!canRetour && !canTransfer && (
            <div className="epj-card" style={{
              padding: "10px 12px", marginBottom: 10,
              background: `${EPJ.gray500}08`,
              fontSize: 11, color: EPJ.gray600, lineHeight: 1.5,
            }}>
              🔒 Seul le détenteur actuel ou un gestionnaire peut retourner ou transférer cet outil.
            </div>
          )}
        </>
      )}

      {/* Outil affecté en permanence */}
      {effectiveStatus === "affecte" && (
        <div className="epj-card" style={{
          padding: "12px 14px", marginBottom: 10,
          background: `${EPJ.blue}08`,
          borderLeft: `3px solid ${EPJ.blue}`,
          fontSize: 12, color: EPJ.gray700, lineHeight: 1.5,
        }}>
          👤 Cet outil est attribué en permanence à <b>{affecteUser?.prenom} {affecteUser?.nom}</b>.
          {userCanGerer && (
            <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 4 }}>
              Pour retirer l'affectation, va dans Admin → Catalogue outillage.
            </div>
          )}
        </div>
      )}

      {/* Outil en maintenance / hors service */}
      {(effectiveStatus === "maintenance" || effectiveStatus === "hors_service") && (
        <div className="epj-card" style={{
          padding: "10px 12px", marginBottom: 10,
          background: `${st.color}08`,
          borderLeft: `3px solid ${st.color}`,
          fontSize: 12, color: EPJ.gray700, lineHeight: 1.5,
        }}>
          {st.icon} Cet outil est actuellement <b>{st.label.toLowerCase()}</b> et ne peut pas être sorti.
        </div>
      )}

      {/* Historique récent (sorties rendues) */}
      {historiqueRendues.length > 0 && (
        <>
          <div style={{
            fontSize: 10, color: EPJ.gray500, fontWeight: 600,
            letterSpacing: 0.4, textTransform: "uppercase",
            marginTop: 16, marginBottom: 6,
          }}>📋 Historique récent</div>
          {historiqueRendues.map(h => {
            const emp = users.find(u => u.id === h.emprunteurId);
            const abime = h.etatRetour === "abime";
            return (
              <div key={h._id} className="epj-card" style={{
                padding: "10px 12px", marginBottom: 6,
                borderLeft: `3px solid ${abime ? EPJ.orange : EPJ.green}`,
              }}>
                <div style={{
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between", marginBottom: 2,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: EPJ.gray900 }}>
                    {emp ? `${emp.prenom} ${emp.nom}` : h.emprunteurNom || "—"}
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    color: abime ? EPJ.orange : EPJ.green,
                  }}>{abime ? "⚠ Abîmé" : "✓ Bon état"}</span>
                </div>
                <div style={{ fontSize: 10, color: EPJ.gray500 }}>
                  {formatDate(h.dateSortie)} → {formatDate(h.dateRetourReelle)}
                  {h.transferts?.length > 0 && ` • ${h.transferts.length} transfert(s)`}
                </div>
                {h.panneIds?.length > 0 && (
                  <div style={{ display: "flex", gap: 3, marginTop: 4, flexWrap: "wrap" }}>
                    {h.panneIds.map(pid => {
                      const p = outillagePannes.find(x => x.code === pid || x._id === pid);
                      return p ? (
                        <span key={pid} style={{
                          fontSize: 9, fontWeight: 600,
                          padding: "2px 5px", borderRadius: 3,
                          background: p.bloquante ? `${EPJ.red}15` : `${EPJ.orange}15`,
                          color: p.bloquante ? EPJ.red : EPJ.orange,
                          fontFamily: "monospace",
                        }}>{p.code}</span>
                      ) : null;
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function InfoRow({ label, value, mono }) {
  return (
    <div style={{
      padding: "10px 14px",
      borderBottom: `1px solid ${EPJ.gray100}`,
      display: "flex", gap: 10,
    }}>
      <div style={{
        fontSize: 11, fontWeight: 600, color: EPJ.gray500,
        textTransform: "uppercase", letterSpacing: 0.3,
        minWidth: 100, flexShrink: 0,
      }}>{label}</div>
      <div style={{
        flex: 1, fontSize: 12, color: EPJ.gray900,
        fontFamily: mono ? "monospace" : "inherit",
        lineHeight: 1.5, wordBreak: "break-word",
      }}>{value}</div>
    </div>
  );
}

const backBtnStyle = {
  background: EPJ.gray100, border: "none", borderRadius: 10,
  padding: "9px 14px", fontSize: 13, fontWeight: 600,
  color: EPJ.gray700, cursor: "pointer", fontFamily: "Inter, sans-serif",
  whiteSpace: "nowrap", flexShrink: 0,
};

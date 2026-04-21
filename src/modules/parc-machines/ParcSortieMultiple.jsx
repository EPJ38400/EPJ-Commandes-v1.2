// ═══════════════════════════════════════════════════════════════
//  ParcSortieMultiple — Valider une sortie groupée d'outils
//  1 emprunteur, 1 chantier, 1 date retour pour N outils
//  Crée N docs outillageSorties avec un groupeSortieId commun
// ═══════════════════════════════════════════════════════════════
import { useState, useRef, useMemo } from "react";
import { db } from "../../firebase";
import { doc, setDoc, writeBatch } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import { SignaturePad } from "../../core/components/SignaturePad";
import {
  generateId, todayISO, canGererCatalogue, getCategorieIcon,
  computeOutilStatut,
} from "./parcUtils";
import { usePanierSortie } from "./PanierSortieContext";

export function ParcSortieMultiple({ onBack, onDone }) {
  const { user } = useAuth();
  const { users, chantiers, outils, outillageSorties, outillageCategories } = useData();
  const toast = useToast();
  const panier = usePanierSortie();

  const isGestionnaire = canGererCatalogue(user);

  const [emprunteurId, setEmprunteurId] = useState(
    isGestionnaire ? "" : user.id
  );
  const [chantierNum, setChantierNum] = useState("");
  const [dateRetourPrevue, setDateRetourPrevue] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  });
  const [commentaire, setCommentaire] = useState("");
  const [showSignature, setShowSignature] = useState(false);
  const [saving, setSaving] = useState(false);
  const sigRef = useRef(null);

  // Récupère les outils du panier avec leur statut
  const panierOutils = useMemo(() => {
    return panier.items
      .map(id => outils.find(o => o._id === id))
      .filter(Boolean)
      .map(o => ({
        ...o,
        effectiveStatus: computeOutilStatut(o, outillageSorties),
      }));
  }, [panier.items, outils, outillageSorties]);

  // Alertes : outils indisponibles dans le panier
  const indisponibles = panierOutils.filter(o =>
    o.effectiveStatus !== "disponible"
  );

  const eligibleUsers = useMemo(() => {
    return [...users].sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));
  }, [users]);

  const activeChantiers = useMemo(() => {
    return [...chantiers]
      .filter(c => !c.archive)
      .sort((a, b) => (a.num || "").localeCompare(b.num || ""));
  }, [chantiers]);

  const save = async () => {
    if (panierOutils.length === 0) { toast("❌ Panier vide"); return; }
    if (!emprunteurId) { toast("❌ Sélectionne l'emprunteur"); return; }
    if (!dateRetourPrevue) { toast("❌ Date de retour requise"); return; }

    if (indisponibles.length > 0) {
      if (!confirm(`⚠ ${indisponibles.length} outil(s) du panier ne sont plus disponibles (sortis, en maintenance, etc.). Ils seront ignorés. Continuer avec les ${panierOutils.length - indisponibles.length} autre(s) ?`)) return;
    }

    setSaving(true);
    try {
      const emprunteur = users.find(u => u.id === emprunteurId);
      if (!emprunteur) { toast("❌ Emprunteur introuvable"); setSaving(false); return; }

      const signatureSortie = showSignature && sigRef.current && !sigRef.current.isEmpty()
        ? sigRef.current.getDataURL()
        : null;

      // ID de groupe commun pour identifier ces sorties comme "groupées"
      const groupeSortieId = generateId("grp_");
      const now = new Date().toISOString();
      const dateSortie = todayISO();

      // Filtre les outils réellement disponibles
      const outilsASortir = panierOutils.filter(o => o.effectiveStatus === "disponible");
      if (outilsASortir.length === 0) {
        toast("❌ Aucun outil disponible dans le panier");
        setSaving(false);
        return;
      }

      // Batch Firestore : 1 doc par outil
      // Détection des packs pour lier les outils
      // Principe : pour chaque pack maître présent dans le panier, on génère un packSortieId.
      // Tous les outils du pack (maître + contenu) qui sont aussi dans le panier
      // reçoivent ce packSortieId + packMaitreOutilId.
      const packMap = {}; // outilId → { packSortieId, packMaitreOutilId }
      outilsASortir.forEach(outil => {
        if (outil.isPack && Array.isArray(outil.packContent)) {
          const packSortieId = generateId("pack_");
          // Le pack maître lui-même
          packMap[outil._id] = { packSortieId, packMaitreOutilId: outil._id };
          // Les outils du pack qui sont dans le panier
          outil.packContent.forEach(p => {
            const childInLot = outilsASortir.find(x => x._id === p.outilId);
            if (childInLot) {
              packMap[p.outilId] = { packSortieId, packMaitreOutilId: outil._id };
            }
          });
        }
      });

      const batch = writeBatch(db);
      outilsASortir.forEach(outil => {
        const sortieId = generateId("sortie_");
        const packLink = packMap[outil._id] || {};
        batch.set(doc(db, "outillageSorties", sortieId), {
          id: sortieId,
          groupeSortieId,
          packSortieId: packLink.packSortieId || null,
          packMaitreOutilId: packLink.packMaitreOutilId || null,
          outilId: outil._id,
          ref: outil.ref,
          nom: outil.nom,
          emprunteurId,
          emprunteurNom: `${emprunteur.prenom} ${emprunteur.nom}`,
          chantierNum: chantierNum || "",
          dateSortie,
          dateRetourPrevue,
          dateRetourReelle: null,
          signatureSortie,
          signatureRetour: null,
          commentaireSortie: commentaire.trim() || "",
          commentaireRetour: "",
          etatRetour: null,
          panneIds: [],
          transferts: [],
          retourParUserId: null,
          retourParNom: null,
          createdBy: user.id,
          createdAt: now,
          updatedAt: now,
        });
      });
      await batch.commit();

      const packCount = Object.values(packMap).reduce((acc, v) => {
        if (!acc.ids.includes(v.packSortieId)) acc.ids.push(v.packSortieId);
        return acc;
      }, { ids: [] }).ids.length;
      const msg = packCount > 0
        ? `✓ ${outilsASortir.length} outil(s) sorti(s) (dont ${packCount} pack${packCount > 1 ? "s" : ""}) pour ${emprunteur.prenom} ${emprunteur.nom}`
        : `✓ ${outilsASortir.length} outil(s) sorti(s) pour ${emprunteur.prenom} ${emprunteur.nom}`;
      toast(msg);
      panier.clear();
      onDone?.();
    } catch (e) {
      console.error(e);
      toast("❌ " + e.message);
    } finally { setSaving(false); }
  };

  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: font.display, fontSize: 20, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.15,
          }}>Sortie groupée</div>
          <div style={{
            fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3,
            textTransform: "uppercase", fontWeight: 600, marginTop: 1,
          }}>{panierOutils.length} outil{panierOutils.length > 1 ? "s" : ""} dans le panier</div>
        </div>
      </div>

      {/* Liste des outils du panier */}
      <div className="epj-card" style={{ padding: 12, marginBottom: 12 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: EPJ.gray500,
          textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8,
        }}>🛒 Outils sélectionnés ({panierOutils.length})</div>

        {panierOutils.length === 0 ? (
          <div style={{ fontSize: 12, color: EPJ.gray500, padding: 8, textAlign: "center" }}>
            Aucun outil dans le panier.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {panierOutils.map(o => {
              const catIcon = getCategorieIcon(outillageCategories, o.categorieId);
              const indispo = o.effectiveStatus !== "disponible";
              return (
                <div key={o._id} style={{
                  padding: "8px 10px", borderRadius: 6,
                  background: indispo ? `${EPJ.red}08` : EPJ.gray50,
                  border: indispo ? `1px solid ${EPJ.red}30` : "1px solid transparent",
                  display: "flex", gap: 8, alignItems: "center",
                }}>
                  {o.photoURL ? (
                    <img src={o.photoURL} alt="" style={{
                      width: 32, height: 32, borderRadius: 6, objectFit: "cover",
                      flexShrink: 0, border: `1px solid ${EPJ.gray200}`,
                    }}/>
                  ) : (
                    <div style={{
                      width: 32, height: 32, borderRadius: 6,
                      background: EPJ.gray100, display: "flex", alignItems: "center",
                      justifyContent: "center", fontSize: 16, flexShrink: 0,
                    }}>{catIcon}</div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: EPJ.gray900,
                      fontFamily: "monospace",
                    }}>{o.ref}</div>
                    <div style={{
                      fontSize: 11, color: EPJ.gray700,
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{o.nom}</div>
                    {indispo && (
                      <div style={{ fontSize: 9, color: EPJ.red, fontWeight: 700, marginTop: 1 }}>
                        ⚠ Pas disponible (sera ignoré)
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => panier.remove(o._id)}
                    style={{
                      background: `${EPJ.red}10`, color: EPJ.red, border: "none",
                      borderRadius: 5, padding: "4px 7px", fontSize: 12, fontWeight: 600,
                      cursor: "pointer", flexShrink: 0,
                    }}
                  >✕</button>
                </div>
              );
            })}
          </div>
        )}

        {indisponibles.length > 0 && (
          <div style={{
            marginTop: 8, padding: "8px 10px",
            background: `${EPJ.red}08`, borderRadius: 6,
            fontSize: 11, color: EPJ.red, lineHeight: 1.4,
          }}>
            ⚠ {indisponibles.length} outil(s) indisponible(s) seront ignorés à la validation.
          </div>
        )}
      </div>

      {/* Formulaire de sortie groupée */}
      <div className="epj-card" style={{ padding: 14, marginBottom: 14 }}>
        <FormRow>
          <label style={labelStyle}>Emprunteur <span style={{ color: EPJ.red }}>*</span></label>
          {isGestionnaire ? (
            <select className="epj-input" value={emprunteurId}
              onChange={e => setEmprunteurId(e.target.value)}
              style={{ width: "100%" }}>
              <option value="">— Sélectionner une personne —</option>
              {eligibleUsers.map(u => (
                <option key={u.id} value={u.id}>
                  {u.prenom} {u.nom}
                </option>
              ))}
            </select>
          ) : (
            <div style={{
              padding: "8px 12px", background: EPJ.gray50,
              borderRadius: 6, fontSize: 13, color: EPJ.gray900,
            }}>
              👤 {user.prenom} {user.nom}
              <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 2 }}>
                Tu ne peux sortir des outils que pour toi-même
              </div>
            </div>
          )}
        </FormRow>

        <FormRow>
          <label style={labelStyle}>Chantier (optionnel)</label>
          <select className="epj-input" value={chantierNum}
            onChange={e => setChantierNum(e.target.value)}
            style={{ width: "100%" }}>
            <option value="">— Aucun chantier associé —</option>
            {activeChantiers.map(c => (
              <option key={c.num || c._id} value={c.num || ""}>
                {c.num} — {c.nom}
              </option>
            ))}
          </select>
        </FormRow>

        <FormRow>
          <label style={labelStyle}>Date de retour prévue <span style={{ color: EPJ.red }}>*</span></label>
          <input type="date" className="epj-input" value={dateRetourPrevue}
            min={todayISO()}
            onChange={e => setDateRetourPrevue(e.target.value)}
            style={{ width: "100%" }}/>
          <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 4 }}>
            Date commune à tous les outils du panier.
          </div>
        </FormRow>

        <FormRow>
          <label style={labelStyle}>Commentaire (optionnel)</label>
          <textarea className="epj-input" value={commentaire}
            onChange={e => setCommentaire(e.target.value)}
            placeholder="État initial, consignes particulières…"
            rows={2} style={{ resize: "vertical", minHeight: 50 }}/>
        </FormRow>

        {/* Signature optionnelle */}
        <div style={{
          padding: "10px 12px", background: EPJ.gray50,
          borderRadius: 8, marginTop: 8,
        }}>
          {!showSignature ? (
            <button type="button" onClick={() => setShowSignature(true)}
              style={{
                width: "100%", padding: "10px 12px",
                background: "transparent", border: `1px dashed ${EPJ.gray300}`,
                borderRadius: 8, color: EPJ.gray600,
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                fontFamily: font.body,
              }}>
              ✍ Ajouter une signature (optionnelle)
            </button>
          ) : (
            <>
              <SignaturePad ref={sigRef} label="Signature de l'emprunteur" height={160}/>
              <button type="button" onClick={() => setShowSignature(false)}
                style={{
                  marginTop: 4, fontSize: 10, color: EPJ.gray500,
                  background: "transparent", border: "none",
                  cursor: "pointer", fontFamily: font.body,
                }}>
                ✕ Retirer la signature
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onBack} className="epj-btn" style={{
          flex: 1, background: EPJ.gray100, color: EPJ.gray700,
        }}>Annuler</button>
        <button
          onClick={save}
          disabled={saving || panierOutils.length === 0}
          className="epj-btn"
          style={{
            flex: 2, background: EPJ.orange, color: "#fff",
            opacity: saving || panierOutils.length === 0 ? 0.6 : 1,
          }}
        >
          {saving
            ? "Enregistrement…"
            : `📤 Sortir ${panierOutils.length - indisponibles.length} outil${panierOutils.length - indisponibles.length > 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}

const backBtnStyle = {
  background: EPJ.gray100, border: "none", borderRadius: 10,
  padding: "9px 14px", fontSize: 13, fontWeight: 600,
  color: EPJ.gray700, cursor: "pointer", fontFamily: "Inter, sans-serif",
  whiteSpace: "nowrap", flexShrink: 0,
};
const labelStyle = {
  display: "block", fontSize: 10, fontWeight: 600,
  color: EPJ.gray500, letterSpacing: 0.4, textTransform: "uppercase",
  marginBottom: 4,
};
function FormRow({ children }) { return <div style={{ marginBottom: 12 }}>{children}</div>; }

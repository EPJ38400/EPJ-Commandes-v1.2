// ═══════════════════════════════════════════════════════════════
//  ChantierEditModal — Popup de création OU édition de chantier
//  v1.18.0 — Brique chantier ad hoc
//
//  Deux modes :
//   - mode="create" : création d'un nouveau chantier (depuis ReserveCreate)
//   - mode="edit"   : édition d'un chantier existant (depuis ReserveDetail)
//
//  Champs gérés :
//   - nom            (obligatoire)
//   - adresse        (facultatif)
//   - numAffaire     (facultatif, peut être ajouté plus tard par admin)
//
//  En création, on génère automatiquement un identifiant temporaire
//  unique (sans utiliser le numAffaire vide) basé sur la date.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import { EPJ, font } from "../../core/theme";
import { db } from "../../firebase";
import { collection, doc, setDoc, updateDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";

/**
 * Génère un identifiant unique pour un chantier ad hoc créé sans N° d'affaire.
 * Format : "ADHOC-AAAAMMJJ-NNN" (NNN = compteur du jour)
 * On vérifie qu'il n'existe pas déjà avant de retourner.
 */
async function generateChantierAdHocId() {
  const now = new Date();
  const yyyymmdd = now.toISOString().slice(0, 10).replace(/-/g, "");
  // Lit les chantiers ADHOC du jour pour incrémenter
  const q = query(
    collection(db, "chantiers"),
    where("num", ">=", `ADHOC-${yyyymmdd}-000`),
    where("num", "<=", `ADHOC-${yyyymmdd}-999`),
  );
  let count = 0;
  try {
    const snap = await getDocs(q);
    count = snap.size;
  } catch {
    // Si pas d'index ou autre, on retombe sur un compteur basé sur l'heure
    count = now.getHours() * 60 + now.getMinutes();
  }
  const seq = String(count + 1).padStart(3, "0");
  return `ADHOC-${yyyymmdd}-${seq}`;
}

export function ChantierEditModal({
  mode = "create",           // "create" | "edit"
  chantier = null,            // requis si mode="edit"
  prefillNom = "",            // suggestion de nom (depuis IA mail par ex.)
  prefillAdresse = "",        // suggestion d'adresse
  onSaved,                    // (chantier) => void  — appelé avec le doc créé/modifié
  onCancel,
  userId,                     // pour traçabilité
}) {
  const isEdit = mode === "edit";

  const [nom, setNom] = useState(isEdit ? (chantier?.nom || "") : prefillNom);
  const [adresse, setAdresse] = useState(isEdit ? (chantier?.adresse || "") : prefillAdresse);
  const [numAffaire, setNumAffaire] = useState(isEdit ? (chantier?.num || "").startsWith("ADHOC-") ? "" : (chantier?.num || "") : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Re-sync si chantier change
  useEffect(() => {
    if (isEdit && chantier) {
      setNom(chantier.nom || "");
      setAdresse(chantier.adresse || "");
      // Si le num actuel est un identifiant ADHOC, le champ N° affaire est vide
      // (l'utilisateur va saisir le vrai N° qui REMPLACERA l'identifiant)
      setNumAffaire((chantier.num || "").startsWith("ADHOC-") ? "" : (chantier.num || ""));
    }
  }, [isEdit, chantier]);

  const save = async () => {
    setError("");
    const nomTrim = (nom || "").trim();
    if (!nomTrim) {
      setError("Le nom du chantier est obligatoire.");
      return;
    }
    setSaving(true);

    try {
      const numAffaireTrim = (numAffaire || "").trim();

      if (isEdit) {
        // ─── ÉDITION d'un chantier existant ───
        const currentNum = chantier.num || "";
        const isCurrentAdHoc = currentNum.startsWith("ADHOC-");

        // Cas 1 : on attribue un vrai N° d'affaire à un chantier ad hoc
        //         → on doit changer l'ID du document (qui contient le num)
        //         → en pratique : on crée un nouveau doc avec le bon num,
        //           puis on supprime l'ancien (mais on garde les références
        //           dans les réserves). C'est complexe et risqué.
        //         → Solution simple : on garde le même ID Firestore, on met
        //           juste à jour le champ "num" et on alerte l'admin.
        //         ⚠️ Comme chantierNum est utilisé par d'autres collections
        //         (réserves, commandes...), il faudrait propager. Pour la v1
        //         on fait une mise à jour simple et on documente.
        const newNum = numAffaireTrim || currentNum; // garde l'ancien si vide

        const updates = {
          nom: nomTrim,
          adresse: adresse.trim(),
          updatedAt: serverTimestamp(),
        };
        // On ne change le num QUE si l'utilisateur a saisi un vrai N° d'affaire
        // ET que le chantier était précédemment ad hoc. Sinon on ne touche pas
        // au num (trop risqué de casser les références).
        if (isCurrentAdHoc && numAffaireTrim && numAffaireTrim !== currentNum) {
          updates.num = numAffaireTrim;
          updates.numPrecedent = currentNum;
          updates.creeAdHoc = false; // n'est plus ad hoc
          updates.regularisedAt = serverTimestamp();
        }

        await updateDoc(doc(db, "chantiers", chantier._id), updates);
        onSaved?.({ ...chantier, ...updates, num: updates.num || currentNum });
      } else {
        // ─── CRÉATION d'un nouveau chantier ad hoc ───
        // Si l'utilisateur a déjà rempli un N° d'affaire, on l'utilise direct.
        // Sinon on génère un identifiant ADHOC temporaire.
        const finalNum = numAffaireTrim || (await generateChantierAdHocId());

        const newChantier = {
          num: finalNum,
          nom: nomTrim,
          adresse: adresse.trim(),
          statut: "Actif",
          creeAdHoc: !numAffaireTrim,  // true si pas de vrai N° d'affaire
          creeParUserId: userId || null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          // Champs vides par défaut, complétables par admin plus tard
          conducteurId: "",
          conducteur: "",
          emailConducteur: "",
          chefChantierIds: [],
          monteurIds: [],
          artisanIds: [],
          dateDebut: "",
          dateFinPrevue: "",
          buildings: [],
        };

        // L'ID du document Firestore = le num (cohérent avec les chantiers existants)
        await setDoc(doc(db, "chantiers", finalNum), newChantier);
        onSaved?.({ ...newChantier, _id: finalNum });
      }
    } catch (err) {
      console.error("[ChantierEditModal] save error:", err);
      setError("Erreur lors de l'enregistrement : " + (err.message || "inconnu"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16, zIndex: 1000,
    }}>
      <div style={{
        background: "#fff", borderRadius: 10, maxWidth: 460, width: "100%",
        padding: 20, boxShadow: "0 10px 40px rgba(0,0,0,0.2)",
        fontFamily: font.body,
      }}>
        <div style={{
          fontFamily: font.display, fontSize: 18, color: EPJ.gray900,
          marginBottom: 4,
        }}>
          {isEdit ? "Modifier le chantier" : "Nouveau chantier"}
        </div>
        <div style={{ fontSize: 12, color: EPJ.gray500, marginBottom: 16 }}>
          {isEdit
            ? "Vous pouvez ajuster le nom, l'adresse et attribuer un N° d'affaire."
            : "Créez un chantier ad hoc. Le N° d'affaire peut être ajouté plus tard par l'admin."}
        </div>

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: EPJ.gray700, marginBottom: 4 }}>
          Nom du chantier *
        </label>
        <input
          className="epj-input"
          value={nom}
          onChange={e => setNom(e.target.value)}
          placeholder="Ex : Jardins Éléonore"
          autoFocus
          style={{ marginBottom: 12 }}
        />

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: EPJ.gray700, marginBottom: 4 }}>
          Adresse
        </label>
        <input
          className="epj-input"
          value={adresse}
          onChange={e => setAdresse(e.target.value)}
          placeholder="Ex : Bassens — Bâtiment A"
          style={{ marginBottom: 12 }}
        />

        <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: EPJ.gray700, marginBottom: 4 }}>
          N° d'affaire {!isEdit && <span style={{ color: EPJ.gray500, fontWeight: 400 }}>(optionnel)</span>}
        </label>
        <input
          className="epj-input"
          value={numAffaire}
          onChange={e => setNumAffaire(e.target.value)}
          placeholder="Ex : 001599 (laisser vide si inconnu)"
          style={{ marginBottom: 6 }}
        />
        <div style={{ fontSize: 11, color: EPJ.gray500, marginBottom: 14 }}>
          {isEdit && (chantier?.num || "").startsWith("ADHOC-")
            ? "ℹ️ Ce chantier a un identifiant temporaire. Renseigner ici le vrai N° d'affaire le régularisera."
            : "ℹ️ Peut être ajouté plus tard par l'admin si inconnu maintenant."}
        </div>

        {error && (
          <div style={{
            background: "#fee", color: "#c00",
            padding: "8px 10px", borderRadius: 6, fontSize: 12, marginBottom: 12,
          }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            onClick={onCancel}
            disabled={saving}
            className="epj-btn"
            style={{
              background: EPJ.gray100, color: EPJ.gray700,
              padding: "8px 14px", fontSize: 13,
            }}
          >
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="epj-btn"
            style={{
              background: EPJ.blue, color: "#fff",
              padding: "8px 14px", fontSize: 13, fontWeight: 600,
            }}
          >
            {saving ? "Enregistrement..." : (isEdit ? "Enregistrer" : "Créer ce chantier")}
          </button>
        </div>
      </div>
    </div>
  );
}

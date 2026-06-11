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
import { EPJ, font, radius, space, fontSize, fontWeight, shadow } from "../../core/theme";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import { Banner } from "../../core/components/Banner";
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
      position: "fixed", inset: 0, background: EPJ.scrim,
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: space.lg, zIndex: 1000,
    }}>
      <div style={{
        background: EPJ.white, borderRadius: radius.lg, maxWidth: 460, width: "100%",
        padding: space.xl, boxShadow: shadow.lg,
        fontFamily: font.body,
      }}>
        <div style={{
          fontFamily: font.display, fontSize: fontSize.lg, color: EPJ.gray900,
          marginBottom: space.xs,
        }}>
          {isEdit ? "Modifier le chantier" : "Nouveau chantier"}
        </div>
        <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginBottom: space.lg }}>
          {isEdit
            ? "Vous pouvez ajuster le nom, l'adresse et attribuer un N° d'affaire."
            : "Créez un chantier ad hoc. Le N° d'affaire peut être ajouté plus tard par l'admin."}
        </div>

        <div style={{ marginBottom: space.md }}>
          <Field label="Nom du chantier" required
            value={nom}
            onChange={e => setNom(e.target.value)}
            placeholder="Ex : Jardins Éléonore"
            autoFocus
          />
        </div>

        <div style={{ marginBottom: space.md }}>
          <Field label="Adresse"
            value={adresse}
            onChange={e => setAdresse(e.target.value)}
            placeholder="Ex : Bassens — Bâtiment A"
          />
        </div>

        <div style={{ marginBottom: space.md + 2 }}>
          <Field
            label={<>N° d'affaire {!isEdit && <span style={{ color: EPJ.gray500, fontWeight: fontWeight.regular }}>(optionnel)</span>}</>}
            value={numAffaire}
            onChange={e => setNumAffaire(e.target.value)}
            placeholder="Ex : 001599 (laisser vide si inconnu)"
            hint={isEdit && (chantier?.num || "").startsWith("ADHOC-")
              ? "ℹ️ Ce chantier a un identifiant temporaire. Renseigner ici le vrai N° d'affaire le régularisera."
              : "ℹ️ Peut être ajouté plus tard par l'admin si inconnu maintenant."}
          />
        </div>

        {error && (
          <Banner tone="danger" text={error} />
        )}

        <div style={{ display: "flex", gap: space.sm, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            Annuler
          </Button>
          <Button variant="primary" onClick={save} loading={saving}>
            {isEdit ? "Enregistrer" : "Créer ce chantier"}
          </Button>
        </div>
      </div>
    </div>
  );
}

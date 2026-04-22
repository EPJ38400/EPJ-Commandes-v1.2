// ═══════════════════════════════════════════════════════════════
//  AdminCompany — Gestion des infos société EPJ + papier en-tête
//  Les valeurs sont utilisées dans la génération des quitus PDF
// ═══════════════════════════════════════════════════════════════
import { useState, useRef, useEffect } from "react";
import { db, storage } from "../../firebase";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";

// Valeurs par défaut issues du papier officiel EPJ
const DEFAULT_COMPANY = {
  nom: "SARL EPJ",
  sousTitre: "Électricité générale et Photovoltaïque",
  adresse: "3, rue Georges Pérec",
  codePostal: "38400",
  ville: "Saint Martin d'Hères",
  telephone: "09 67 24 20 88",
  email: "contact@epj-electricite.com",
  siteWeb: "",
  siret: "525 079 919 00045",
  tvaIntracom: "FR24525079919",
  capital: "5000€",
  mentionLegale: "Je soussigné(e) {CLIENT_NOM}, agissant en qualité de {CLIENT_QUALITE}, reconnais que les travaux de levée de la présente réserve ont été réalisés à ma satisfaction par l'entreprise EPJ Électricité Générale et accepte la levée définitive.",
  papierEnteteUrl: "",
  papierEntetePath: "",
  // v10.B.2 — Envoi email du quitus
  emailCopieAuto: "contact@epj-electricite.com", // Email en CC à chaque envoi quitus
  signatureMail:
    "Cordialement,\n\n" +
    "L'équipe EPJ Électricité Générale\n" +
    "3 rue Georges Pérec — 38400 Saint-Martin-d'Hères\n" +
    "Tél : 09 67 24 20 88\n" +
    "contact@epj-electricite.com",
  // v10.B.3 — Mention RGPD (affichée avant signature + sur le quitus PDF)
  mentionRgpd:
    "Votre signature et vos informations sont conservées sur le quitus " +
    "pour une durée de 10 ans (prescription décennale BTP). Droit d'accès, " +
    "rectification ou suppression : contact@epj-electricite.com",
};

export function AdminCompany({ onBack }) {
  const { config } = useData();
  const [form, setForm] = useState(DEFAULT_COMPANY);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(null);
  const fileRef = useRef(null);

  // Chargement des valeurs existantes
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "config", "company"));
        if (snap.exists()) {
          setForm({ ...DEFAULT_COMPANY, ...snap.data() });
        }
      } catch (e) {
        console.warn("Chargement company:", e.message);
      }
      setLoaded(true);
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, "config", "company"), form);
      alert("✓ Infos société enregistrées");
    } catch (e) {
      alert("❌ " + e.message);
    }
    setSaving(false);
  };

  const handlePapierSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.match(/^image\/(jpe?g|png)$/)) {
      alert("❌ Format accepté : JPG ou PNG uniquement");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert("❌ Fichier trop lourd (max 5 Mo)");
      return;
    }
    try {
      setUploading("Téléversement...");
      // Supprime l'ancien si existant
      if (form.papierEntetePath) {
        try {
          await deleteObject(ref(storage, form.papierEntetePath));
        } catch {}
      }
      const ext = file.type === "image/png" ? "png" : "jpg";
      const path = `config/papier-entete-${Date.now()}.${ext}`;
      const fileRef2 = ref(storage, path);
      await uploadBytes(fileRef2, file);
      const url = await getDownloadURL(fileRef2);
      const newForm = { ...form, papierEnteteUrl: url, papierEntetePath: path };
      setForm(newForm);
      // Sauvegarde immédiate de l'URL
      await setDoc(doc(db, "config", "company"), newForm);
      alert("✓ Papier en-tête uploadé");
    } catch (e) {
      alert("❌ " + e.message);
    }
    setUploading(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePapier = async () => {
    if (!confirm("Retirer le papier en-tête ?")) return;
    try {
      if (form.papierEntetePath) {
        try { await deleteObject(ref(storage, form.papierEntetePath)); } catch {}
      }
      const newForm = { ...form, papierEnteteUrl: "", papierEntetePath: "" };
      setForm(newForm);
      await setDoc(doc(db, "config", "company"), newForm);
    } catch (e) { alert("❌ " + e.message); }
  };

  if (!loaded) return (
    <div style={{ padding: 24, textAlign: "center", color: EPJ.gray500 }}>
      Chargement...
    </div>
  );

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div style={{ paddingTop: 12, paddingBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div style={{ fontFamily: font.display, fontSize: 22, color: EPJ.gray900, letterSpacing: "-0.02em" }}>
          Config Société
        </div>
      </div>

      <div style={{
        background: `${EPJ.blue}08`, border: `1px solid ${EPJ.blue}55`,
        borderRadius: 8, padding: "10px 12px", marginBottom: 14,
        fontSize: 11, color: EPJ.gray700,
      }}>
        💡 Ces informations et ce papier en-tête sont utilisés automatiquement
        lors de la génération des quitus de levée de réserve (module Réserves).
      </div>

      {/* Papier en-tête */}
      <div className="epj-card" style={{ padding: 14, marginBottom: 12 }}>
        <FieldLabel>Papier en-tête officiel</FieldLabel>
        <div style={{ fontSize: 10, color: EPJ.gray500, marginBottom: 8 }}>
          Image de fond utilisée sur les quitus générés (JPG/PNG, 5 Mo max).
          Format recommandé : A4 portrait, 300 DPI.
        </div>
        {form.papierEnteteUrl ? (
          <div>
            <img src={form.papierEnteteUrl} alt="Papier en-tête" style={{
              width: "100%", maxHeight: 280, objectFit: "contain",
              borderRadius: 6, border: `1px solid ${EPJ.gray200}`,
              background: "#fff", marginBottom: 6,
            }}/>
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" onClick={() => fileRef.current?.click()}
                      disabled={!!uploading} style={smallBtnStyle()}>
                🖼 Remplacer
              </button>
              <button type="button" onClick={removePapier}
                      style={smallBtnStyle(true)}>
                🗑 Retirer
              </button>
            </div>
          </div>
        ) : uploading ? (
          <div style={{
            padding: "14px 10px", border: `2px dashed ${EPJ.orange}`, borderRadius: 8,
            background: `${EPJ.orange}14`, color: EPJ.orange, fontSize: 13,
            fontWeight: 600, textAlign: "center",
          }}>📤 {uploading}</div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} style={{
            width: "100%", padding: "16px 10px", border: `2px dashed ${EPJ.gray300}`,
            borderRadius: 8, background: EPJ.gray50, color: EPJ.gray700,
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: font.body,
          }}>
            🖼 Uploader le papier en-tête
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/jpeg,image/png"
               onChange={handlePapierSelect} style={{ display: "none" }}/>
      </div>

      {/* Infos société */}
      <div className="epj-card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: EPJ.blue, marginBottom: 10 }}>
          IDENTITÉ
        </div>
        <FieldLabel>Raison sociale</FieldLabel>
        <input className="epj-input" value={form.nom} style={{ marginBottom: 8 }}
               onChange={e => setField("nom", e.target.value)}/>
        <FieldLabel>Activité / Sous-titre</FieldLabel>
        <input className="epj-input" value={form.sousTitre} style={{ marginBottom: 8 }}
               onChange={e => setField("sousTitre", e.target.value)}
               placeholder="ex : Électricité générale et Photovoltaïque"/>
      </div>

      <div className="epj-card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: EPJ.blue, marginBottom: 10 }}>
          ADRESSE
        </div>
        <FieldLabel>Adresse</FieldLabel>
        <input className="epj-input" value={form.adresse} style={{ marginBottom: 8 }}
               onChange={e => setField("adresse", e.target.value)}/>
        <div style={{ display: "grid", gridTemplateColumns: "90px 1fr", gap: 6, marginBottom: 8 }}>
          <div>
            <FieldLabel>CP</FieldLabel>
            <input className="epj-input" value={form.codePostal}
                   onChange={e => setField("codePostal", e.target.value)}/>
          </div>
          <div>
            <FieldLabel>Ville</FieldLabel>
            <input className="epj-input" value={form.ville}
                   onChange={e => setField("ville", e.target.value)}/>
          </div>
        </div>
      </div>

      <div className="epj-card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: EPJ.blue, marginBottom: 10 }}>
          CONTACT
        </div>
        <FieldLabel>Téléphone</FieldLabel>
        <input className="epj-input" value={form.telephone} style={{ marginBottom: 8 }}
               onChange={e => setField("telephone", e.target.value)}/>
        <FieldLabel>Email</FieldLabel>
        <input className="epj-input" value={form.email} style={{ marginBottom: 8 }}
               type="email"
               onChange={e => setField("email", e.target.value)}/>
        <FieldLabel>Site web (optionnel)</FieldLabel>
        <input className="epj-input" value={form.siteWeb}
               onChange={e => setField("siteWeb", e.target.value)}
               placeholder="www.epj-electricite.com"/>
      </div>

      <div className="epj-card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: EPJ.blue, marginBottom: 10 }}>
          MENTIONS LÉGALES
        </div>
        <FieldLabel>SIRET</FieldLabel>
        <input className="epj-input" value={form.siret} style={{ marginBottom: 8 }}
               onChange={e => setField("siret", e.target.value)}/>
        <FieldLabel>N° TVA intracommunautaire</FieldLabel>
        <input className="epj-input" value={form.tvaIntracom} style={{ marginBottom: 8 }}
               onChange={e => setField("tvaIntracom", e.target.value)}/>
        <FieldLabel>Capital social</FieldLabel>
        <input className="epj-input" value={form.capital}
               onChange={e => setField("capital", e.target.value)}
               placeholder="ex : 5000€"/>
      </div>

      <div className="epj-card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: EPJ.blue, marginBottom: 10 }}>
          QUITUS — MENTION DE DÉCLARATION
        </div>
        <FieldLabel>Texte imprimé dans l'encart signature</FieldLabel>
        <div style={{ fontSize: 10, color: EPJ.gray500, marginBottom: 6 }}>
          Variables disponibles : <code>{"{CLIENT_NOM}"}</code> <code>{"{CLIENT_QUALITE}"}</code>
        </div>
        <textarea className="epj-input" value={form.mentionLegale}
                  onChange={e => setField("mentionLegale", e.target.value)}
                  style={{ minHeight: 100, resize: "vertical", fontSize: 12 }}/>

        <FieldLabel style={{ marginTop: 12 }}>Mention RGPD</FieldLabel>
        <div style={{ fontSize: 10, color: EPJ.gray500, marginBottom: 6 }}>
          Affichée avant la signature client dans l'app et en petit en bas du
          quitus PDF. Information sur la conservation/suppression des données.
        </div>
        <textarea className="epj-input" value={form.mentionRgpd || ""}
                  onChange={e => setField("mentionRgpd", e.target.value)}
                  style={{ minHeight: 80, resize: "vertical", fontSize: 11 }}/>
      </div>

      <div className="epj-card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: EPJ.blue, marginBottom: 10 }}>
          ENVOI EMAIL DU QUITUS
        </div>

        <FieldLabel>Email en copie automatique (CC)</FieldLabel>
        <div style={{ fontSize: 10, color: EPJ.gray500, marginBottom: 6 }}>
          À chaque envoi de quitus, cette adresse sera mise en copie
          (utile pour archiver / centraliser chez l'assistante).
        </div>
        <input className="epj-input" value={form.emailCopieAuto || ""} type="email"
               onChange={e => setField("emailCopieAuto", e.target.value)}
               placeholder="ex : contact@epj-electricite.com"
               style={{ marginBottom: 12 }}/>

        <FieldLabel>Signature de fin de mail</FieldLabel>
        <div style={{ fontSize: 10, color: EPJ.gray500, marginBottom: 6 }}>
          Ajoutée automatiquement en fin de chaque email de quitus.
        </div>
        <textarea className="epj-input" value={form.signatureMail || ""}
                  onChange={e => setField("signatureMail", e.target.value)}
                  style={{ minHeight: 110, resize: "vertical", fontSize: 12 }}
                  placeholder="Cordialement,&#10;L'équipe EPJ..."/>
      </div>

      <button onClick={save} disabled={saving} className="epj-btn" style={{
        width: "100%", background: EPJ.blue, color: "#fff",
        fontSize: 14, padding: "12px",
      }}>
        {saving ? "⏳ Enregistrement..." : "💾 Enregistrer"}
      </button>
    </div>
  );
}

function FieldLabel({ children, style }) {
  return (
    <label style={{
      display: "block", fontSize: 10, fontWeight: 700, color: EPJ.gray500,
      textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3,
      ...(style || {}),
    }}>{children}</label>
  );
}

const backBtnStyle = {
  background: "transparent", border: "none", color: EPJ.gray700,
  fontSize: 14, cursor: "pointer", fontFamily: font.body, padding: "6px 10px",
};

function smallBtnStyle(danger = false) {
  return {
    flex: 1, padding: "8px 10px", fontSize: 12, fontWeight: 600,
    border: "none", borderRadius: 6, cursor: "pointer",
    background: danger ? `${EPJ.red}15` : EPJ.gray100,
    color: danger ? EPJ.red : EPJ.gray700,
    fontFamily: font.body,
  };
}

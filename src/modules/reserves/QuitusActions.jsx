// ═══════════════════════════════════════════════════════════════
//  QuitusActions — Bloc d'actions sur un quitus (v10.B.2)
//  • Générer PDF (popup visualisation/téléchargement/impression)
//  • Envoyer par email (formulaire destinataires + deeplink mailto)
//  • Copier le lien (URL Firebase partageable)
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font } from "../../core/theme";
import { openQuitusWindow } from "./quitusPdfGenerator";
import { generateQuitusPdfBlob, uploadQuitusPdf } from "./reservesUtils";
import { db } from "../../firebase";
import { doc, updateDoc } from "firebase/firestore";

// ─── Génération du corps d'email ────────────────────────────
function buildEmailBody({ reserve, company, technomFull, pdfUrl }) {
  const parts = [];
  parts.push("Bonjour,");
  parts.push("");
  parts.push(
    `Veuillez trouver ci-dessous le quitus de levée de la réserve ` +
    `N° ${reserve.numReserve || "—"} concernant le chantier ` +
    `${reserve.chantierNom || "—"} ` +
    (reserve.chantierAdresse ? `(${reserve.chantierAdresse})` : "") + "."
  );
  parts.push("");
  if (reserve.titre) parts.push(`Objet de la réserve : ${reserve.titre}`);
  if (reserve.dateLevee) {
    parts.push(`Intervention réalisée le ${fmtFR(reserve.dateLevee)}${technomFull ? " par " + technomFull : ""}, à la satisfaction du client.`);
  }
  parts.push("");
  if (pdfUrl) {
    parts.push(`📄 Lien du quitus : ${pdfUrl}`);
  } else {
    parts.push(`📎 Le quitus PDF est joint à ce message.`);
  }
  parts.push("");
  if (company.signatureMail) {
    parts.push(company.signatureMail);
  } else {
    parts.push("Cordialement,");
    parts.push("L'équipe EPJ Électricité Générale");
  }
  return parts.join("\n");
}

function fmtFR(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// Sanitize email list → retire vides / doublons / trimmés
function cleanEmails(list) {
  const seen = new Set();
  return (list || [])
    .map(e => (e || "").trim().toLowerCase())
    .filter(e => e && /\S+@\S+\.\S+/.test(e) && !seen.has(e) && seen.add(e));
}

// ═══════════════════════════════════════════════════════════
export function QuitusActions({ reserve, chantier, company, technicien, users, reservesEmetteurs }) {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(reserve?.quitusUrl || "");
  const [copied, setCopied] = useState(false);

  const technomFull = reserve.leveeParNom ||
    (technicien ? `${technicien.prenom || ""} ${technicien.nom || ""}`.trim() : "");

  const openPdf = () => {
    openQuitusWindow({
      reserve, chantier, company, technicien,
      clientSigPng: reserve.clientSignaturePng || "",
      clientNom: reserve.clientSignataireNom || reserve.clientFinal?.nom || "",
      clientQualite: reserve.clientSignataireQualite || "Client final",
    });
  };

  // Upload du PDF vers Firebase si pas déjà fait, retourne l'URL
  const ensurePdfUploaded = async () => {
    if (pdfUrl) return pdfUrl;
    setUploading(true);
    try {
      // Génère le PDF sous forme de Blob
      const blob = await generateQuitusPdfBlob({
        reserve, chantier, company, technicien,
        clientSigPng: reserve.clientSignaturePng || "",
        clientNom: reserve.clientSignataireNom || reserve.clientFinal?.nom || "",
        clientQualite: reserve.clientSignataireQualite || "Client final",
      });
      const { url, path } = await uploadQuitusPdf(reserve._id, blob);
      // Sauvegarde l'URL dans Firestore
      await updateDoc(doc(db, "reserves", reserve._id), {
        quitusUrl: url,
        quitusPath: path,
        quitusGeneratedAt: new Date().toISOString(),
      });
      setPdfUrl(url);
      return url;
    } finally {
      setUploading(false);
    }
  };

  const copyLink = async () => {
    try {
      const url = await ensurePdfUploaded();
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error(e);
      alert("❌ " + (e.message || "Échec copie"));
    }
  };

  return (
    <>
      {/* Bloc 3 boutons principaux */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
        <button onClick={openPdf} className="epj-btn" style={{
          width: "100%",
          background: `linear-gradient(135deg, ${EPJ.blue}, ${EPJ.green})`,
          color: "#fff", fontSize: 14, fontWeight: 700,
          padding: "12px",
        }}>
          📄 Générer / Voir le quitus PDF
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => setShowEmailForm(true)}
                  disabled={uploading}
                  className="epj-btn" style={{
            flex: 2, background: EPJ.orange, color: "#fff",
            fontSize: 13, fontWeight: 700, padding: "10px",
            opacity: uploading ? 0.5 : 1,
          }}>
            ✉ Envoyer par email
          </button>
          <button onClick={copyLink}
                  disabled={uploading}
                  className="epj-btn" style={{
            flex: 1, background: EPJ.gray100, color: EPJ.gray700,
            fontSize: 13, fontWeight: 600, padding: "10px",
            opacity: uploading ? 0.5 : 1,
          }}>
            {copied ? "✓ Copié !" : uploading ? "⏳ …" : "🔗 Lien"}
          </button>
        </div>
        {!company.papierEnteteUrl && (
          <div style={{
            fontSize: 10, color: EPJ.orange, marginTop: 0,
            background: `${EPJ.orange}14`, padding: "6px 8px", borderRadius: 4,
          }}>
            ⚠ Pense à uploader le papier en-tête dans Admin → Config Société
            pour un rendu complet.
          </div>
        )}
      </div>

      {/* Modale formulaire envoi email */}
      {showEmailForm && (
        <EmailForm
          reserve={reserve}
          chantier={chantier}
          company={company}
          technomFull={technomFull}
          reservesEmetteurs={reservesEmetteurs}
          ensurePdfUploaded={ensurePdfUploaded}
          onClose={() => setShowEmailForm(false)}
        />
      )}
    </>
  );
}


// ═══════════════════════════════════════════════════════════
function EmailForm({ reserve, chantier, company, technomFull, reservesEmetteurs, ensurePdfUploaded, onClose }) {
  // Destinataires par défaut
  const clientEmail = reserve?.clientFinal?.email || "";
  // Email émetteur : on cherche dans reservesEmetteurs
  const emetteur = (reservesEmetteurs || []).find(e => e._id === reserve.emisParId);
  const emetteurEmail = emetteur?.email || "";
  const copieAuto = company?.emailCopieAuto || "";

  const [toEmail, setToEmail] = useState(clientEmail);
  const [ccEmetteur, setCcEmetteur] = useState(emetteurEmail);
  const [ccAuto, setCcAuto] = useState(copieAuto);
  const [ccExtra, setCcExtra] = useState("");
  const [subject, setSubject] = useState(
    `Quitus de levée de réserve N° ${reserve.numReserve || "—"} — ${reserve.chantierNom || ""}`
  );
  const [sending, setSending] = useState(false);
  const [pdfReady, setPdfReady] = useState(!!reserve?.quitusUrl);

  const prepareAndSend = async () => {
    if (!toEmail || !/\S+@\S+\.\S+/.test(toEmail)) {
      alert("❌ Adresse destinataire invalide.");
      return;
    }
    setSending(true);
    try {
      // 1. Upload le PDF si pas déjà fait
      const url = await ensurePdfUploaded();
      setPdfReady(true);

      // 2. Construit le corps avec le lien
      const body = buildEmailBody({
        reserve, company, technomFull, pdfUrl: url,
      });

      // 3. Construit le mailto:
      const cc = cleanEmails([ccEmetteur, ccAuto, ccExtra]);
      const params = [];
      if (cc.length) params.push(`cc=${encodeURIComponent(cc.join(","))}`);
      params.push(`subject=${encodeURIComponent(subject)}`);
      params.push(`body=${encodeURIComponent(body)}`);
      const mailto = `mailto:${encodeURIComponent(toEmail)}?${params.join("&")}`;

      // 4. Ouvre l'app mail
      window.location.href = mailto;

      // 5. Ferme la modale après un court délai
      setTimeout(() => {
        setSending(false);
        onClose();
      }, 500);
    } catch (e) {
      console.error(e);
      alert("❌ " + (e.message || "Échec"));
      setSending(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 999,
      background: "rgba(0,0,0,.5)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "#fff", width: "100%", maxWidth: 520,
          maxHeight: "92vh", overflowY: "auto",
          borderTopLeftRadius: 16, borderTopRightRadius: 16,
          padding: 16,
          paddingBottom: "calc(16px + env(safe-area-inset-bottom))",
          fontFamily: font.body,
        }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginBottom: 12, paddingBottom: 8,
          borderBottom: `1px solid ${EPJ.gray200}`,
        }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: EPJ.gray900 }}>
            ✉ Envoyer le quitus
          </div>
          <button onClick={onClose} style={{
            background: "transparent", border: "none",
            fontSize: 20, color: EPJ.gray500, cursor: "pointer",
            padding: 0, width: 28, height: 28,
          }}>✕</button>
        </div>

        <div style={{
          background: `${EPJ.blue}08`, border: `1px solid ${EPJ.blue}55`,
          borderRadius: 6, padding: "8px 10px", marginBottom: 12,
          fontSize: 11, color: EPJ.gray700, lineHeight: 1.4,
        }}>
          💡 Le PDF sera envoyé <strong>sous forme de lien</strong> dans le corps
          du mail (plus fiable sur mobile). Tu peux aussi cliquer sur
          📥 <em>Générer le quitus</em> puis joindre manuellement le PDF
          à l'email si besoin.
        </div>

        <Label>Destinataire principal (À)</Label>
        <input className="epj-input" type="email" value={toEmail}
               onChange={e => setToEmail(e.target.value)}
               placeholder="email@client.fr"
               style={{ marginBottom: 10 }}/>

        <Label>Copie — Maître d'œuvre / émetteur</Label>
        <input className="epj-input" type="email" value={ccEmetteur}
               onChange={e => setCcEmetteur(e.target.value)}
               placeholder="Optionnel"
               style={{ marginBottom: 10 }}/>

        <Label>Copie automatique (EPJ)</Label>
        <input className="epj-input" type="email" value={ccAuto}
               onChange={e => setCcAuto(e.target.value)}
               placeholder="Optionnel"
               style={{ marginBottom: 10 }}/>

        <Label>Copie supplémentaire</Label>
        <input className="epj-input" type="email" value={ccExtra}
               onChange={e => setCcExtra(e.target.value)}
               placeholder="Optionnel"
               style={{ marginBottom: 10 }}/>

        <Label>Objet</Label>
        <input className="epj-input" value={subject}
               onChange={e => setSubject(e.target.value)}
               style={{ marginBottom: 14 }}/>

        <div style={{
          fontSize: 10, color: EPJ.gray500, marginBottom: 10,
          padding: "6px 8px", background: EPJ.gray50,
          borderRadius: 4, border: `1px dashed ${EPJ.gray300}`,
        }}>
          Le corps du mail sera prérempli avec toutes les infos et le lien
          vers le PDF. Tu pourras le modifier dans ton application Mail
          avant l'envoi.
        </div>

        <button onClick={prepareAndSend}
                disabled={sending || !toEmail}
                className="epj-btn" style={{
          width: "100%", background: EPJ.blue, color: "#fff",
          fontSize: 14, fontWeight: 700, padding: "12px",
          opacity: (sending || !toEmail) ? 0.5 : 1,
        }}>
          {sending
            ? (pdfReady ? "⏳ Ouverture de l'app Mail..." : "⏳ Upload du PDF...")
            : "✉ Préparer l'email"}
        </button>

        <button onClick={onClose}
                style={{
          width: "100%", marginTop: 6,
          background: "transparent", border: "none",
          color: EPJ.gray500, fontSize: 13, padding: "8px",
          cursor: "pointer", fontFamily: font.body,
        }}>
          Annuler
        </button>
      </div>
    </div>
  );
}

function Label({ children }) {
  return (
    <label style={{
      display: "block", fontSize: 10, fontWeight: 700, color: EPJ.gray500,
      textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3,
    }}>{children}</label>
  );
}

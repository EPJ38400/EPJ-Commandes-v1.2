// ═══════════════════════════════════════════════════════════════
//  quitusPdfGenerator.js
//  Ouvre une popup HTML qui rend le quitus, puis utilise
//  html2canvas + jsPDF pour générer un PDF A4 téléchargeable.
//
//  Usage : generateQuitusPdf({ reserve, chantier, company, technicien,
//                               clientSignaturePng })
// ═══════════════════════════════════════════════════════════════

const fmt = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString("fr-FR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
};

const escapeHtml = (str) => String(str || "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

const renderMention = (template, vars) => {
  if (!template) return "";
  let out = template;
  Object.entries(vars || {}).forEach(([k, v]) => {
    const re = new RegExp(`\\{${k}\\}`, "g");
    out = out.replace(re, v || "");
  });
  return out;
};

/**
 * Ouvre une popup qui rend le quitus HTML, puis propose la génération PDF.
 * L'utilisateur clique sur le bouton pour télécharger / partager.
 *
 * @param {Object} opts
 * @param {Object} opts.reserve       Document réserve Firestore
 * @param {Object} opts.chantier      Chantier associé (pour l'adresse etc.)
 * @param {Object} opts.company       Config société (infos + papierEnteteUrl)
 * @param {Object} opts.technicien    Utilisateur qui a levé (avec signatureUrl si existe)
 * @param {string} opts.clientSigPng  Signature client PNG base64
 * @param {string} opts.clientNom     Nom du signataire (peut être différent du client final)
 * @param {string} opts.clientQualite Qualité (Client final / Représentant MOE / ...)
 */
export function openQuitusWindow({
  reserve, chantier, company, technicien,
  clientSigPng, clientNom, clientQualite,
}) {
  const co = company || {};
  const numReserve = reserve.numReserve || "—";
  const papierUrl = co.papierEnteteUrl || "";

  // Variables de substitution pour la mention légale
  const mentionText = renderMention(co.mentionLegale || "", {
    CLIENT_NOM: clientNom || reserve.clientFinal?.nom || "—",
    CLIENT_QUALITE: clientQualite || "Client final",
  });

  // Emplacement formaté
  const empl = reserve.emplacement || {};
  const emplacementParts = [];
  if (empl.partiesCommunes) emplacementParts.push("Parties communes");
  if (empl.batiment) emplacementParts.push(`Bât. ${empl.batiment}`);
  if (empl.cage) emplacementParts.push(`Cage/étage ${empl.cage}`);
  if (empl.apt && !empl.partiesCommunes) emplacementParts.push(`Apt ${empl.apt}`);
  const emplacementStr = emplacementParts.join(" — ") || "—";

  // Priorité
  const prioriteLabel = reserve.priorite === "bloquante" ? "BLOQUANTE" : "NORMALE";
  const prioriteColor = reserve.priorite === "bloquante" ? "#E53935" : "#F5841F";

  // Description courte (fallback sur titre)
  const description = reserve.description || reserve.titre || "—";

  // Travaux réalisés
  const travaux = reserve.commentaireLevee || reserve.titre || "—";

  // Émetteur
  const emisParFull = [reserve.emisParLabel, reserve.emisParNom].filter(Boolean).join(" — ") || "—";

  // Technicien nom
  const technomFull = reserve.leveeParNom ||
    (technicien ? `${technicien.prenom || ""} ${technicien.nom || ""}`.trim() : "—");

  // Ville pour "Fait à..."
  const villeChantier = (() => {
    const adresse = reserve.chantierAdresse || chantier?.adresse || "";
    const m = /\b\d{5}\s+([^,\-\(]+)/.exec(adresse);
    if (m) return m[1].trim();
    return co.ville || "Saint Martin d'Hères";
  })();

  // Génération du HTML complet
  const html = `<!DOCTYPE html>
<html lang="fr" translate="no">
<head>
  <meta charset="utf-8"/>
  <meta name="google" content="notranslate"/>
  <title>Quitus ${escapeHtml(numReserve)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #1A1A1A;
      background: #f0f0f0;
      padding: 20px;
    }
    #quitus-page {
      /* A4 ratio 210x297 mm, width fixe pour html2canvas */
      width: 794px;   /* 210mm à 96dpi */
      height: 1123px; /* 297mm à 96dpi */
      margin: 0 auto;
      background: #ffffff;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,.12);
    }
    .bg-papier {
      position: absolute; inset: 0;
      width: 100%; height: 100%;
      object-fit: cover;
      z-index: 0;
    }
    .content {
      position: relative; z-index: 1;
      padding: 150px 52px 140px 52px; /* respecte la zone logo et la zone pied de page */
    }
    .title-block {
      text-align: right;
      margin-bottom: 26px;
    }
    .title-main {
      font-size: 22px; font-weight: 800; color: #00A3E0;
      line-height: 1.1; letter-spacing: -0.02em;
    }
    .title-sub {
      font-size: 14px; font-weight: 700; color: #4A4A4A;
      margin-top: 8px; font-family: monospace;
    }
    .title-date {
      font-size: 11px; color: #8E8E8E; margin-top: 4px;
    }
    .section-title {
      display: flex; align-items: center; gap: 10px;
      margin-top: 14px; margin-bottom: 8px;
    }
    .section-title-bar { width: 22px; height: 3px; background: #00A3E0; border-radius: 2px; }
    .section-title-text {
      font-size: 11px; font-weight: 800; color: #00A3E0;
      letter-spacing: 1px; text-transform: uppercase;
    }
    .section-title-line {
      flex: 1; height: 1px; background: #E5E5E5;
    }
    .kv { display: grid; grid-template-columns: 150px 1fr; gap: 4px 12px; margin-left: 6px; }
    .kv-label { font-size: 11px; color: #8E8E8E; }
    .kv-value { font-size: 11px; font-weight: 700; color: #1A1A1A; }
    .photos-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 8px 6px; }
    .photo-card {
      border: 2px solid #D4D4D4;
      border-radius: 6px;
      overflow: hidden;
      background: #fff;
    }
    .photo-card.avant { border-color: #E53935; }
    .photo-card.apres { border-color: #A8C536; }
    .photo-card img {
      width: 100%; height: 140px; object-fit: cover; display: block;
    }
    .photo-card-label {
      padding: 4px 8px; font-size: 9px; font-weight: 700;
      text-transform: uppercase; letter-spacing: 0.5px;
    }
    .photo-card.avant .photo-card-label { background: #E53935; color: #fff; }
    .photo-card.apres .photo-card-label { background: #A8C536; color: #fff; }
    .decl-box {
      margin: 14px 6px 0;
      background: #F0F9FD;
      border: 1.5px solid #00A3E0;
      border-radius: 8px;
      padding: 12px 14px;
    }
    .decl-title {
      font-size: 11px; font-weight: 800; color: #00A3E0;
      letter-spacing: 1px; text-transform: uppercase;
      margin-bottom: 8px;
    }
    .decl-text {
      font-size: 10.5px; line-height: 1.45; color: #1A1A1A; margin-bottom: 6px;
    }
    .decl-lieu {
      font-size: 10px; font-style: italic; color: #4A4A4A; margin-bottom: 10px;
    }
    .sig-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .sig-box {
      border: 1px solid #D4D4D4; border-radius: 6px; padding: 8px;
      background: #fff; min-height: 80px; position: relative;
    }
    .sig-label {
      font-size: 9px; font-weight: 800; color: #00A3E0;
      letter-spacing: 0.5px; text-transform: uppercase;
      margin-bottom: 4px;
    }
    .sig-image {
      width: 100%; height: 50px; object-fit: contain;
      display: block; margin: 2px 0;
    }
    .sig-name {
      font-size: 9px; color: #4A4A4A; font-weight: 600;
    }
    .priorite-pill {
      display: inline-block;
      font-size: 10px; font-weight: 800;
      padding: 2px 8px; border-radius: 10px;
      color: #fff;
      margin-left: 4px;
    }
    .description {
      font-size: 11px; line-height: 1.4;
      margin-left: 6px; margin-top: 4px;
      padding: 6px 8px;
      background: #F5F5F5; border-radius: 4px;
    }
    .controls {
      max-width: 794px; margin: 20px auto 0; text-align: center;
    }
    .controls button {
      margin: 0 4px;
      padding: 12px 22px;
      border: none; border-radius: 8px; cursor: pointer;
      font-size: 14px; font-weight: 700;
      background: linear-gradient(135deg, #00A3E0, #A8C536);
      color: #fff;
    }
    .controls button:disabled { opacity: .5; cursor: wait; }
    .controls .secondary {
      background: #F5F5F5; color: #4A4A4A;
    }
    #status-msg { margin-top: 10px; font-size: 13px; color: #4A4A4A; }
    @media print {
      body { background: #fff; padding: 0; }
      #quitus-page { box-shadow: none; }
      .controls { display: none; }
    }
  </style>
</head>
<body class="notranslate" translate="no">
  <div id="quitus-page">
    ${papierUrl ? `<img class="bg-papier" src="${escapeHtml(papierUrl)}" crossorigin="anonymous" alt=""/>` : ""}
    <div class="content">

      <div class="title-block">
        <div class="title-main">QUITUS DE LEVÉE<br/>DE RÉSERVE</div>
        <div class="title-sub">N° ${escapeHtml(numReserve)}</div>
        <div class="title-date">Émis le ${escapeHtml(fmt(reserve.dateEmission))}</div>
      </div>

      <div class="section-title">
        <span class="section-title-bar"></span>
        <span class="section-title-text">Chantier</span>
        <span class="section-title-line"></span>
      </div>
      <div class="kv">
        <div class="kv-label">N° d'affaire</div>
        <div class="kv-value">${escapeHtml(reserve.chantierNum || "—")}</div>
        <div class="kv-label">Nom du chantier</div>
        <div class="kv-value">${escapeHtml(reserve.chantierNom || "—")}</div>
        <div class="kv-label">Adresse</div>
        <div class="kv-value">${escapeHtml(reserve.chantierAdresse || chantier?.adresse || "—")}</div>
        <div class="kv-label">Emplacement</div>
        <div class="kv-value">${escapeHtml(emplacementStr)}</div>
      </div>

      <div class="section-title">
        <span class="section-title-bar"></span>
        <span class="section-title-text">Descriptif de la réserve</span>
        <span class="section-title-line"></span>
      </div>
      <div class="kv">
        <div class="kv-label">Émise par</div>
        <div class="kv-value">${escapeHtml(emisParFull)}</div>
        <div class="kv-label">Date d'émission</div>
        <div class="kv-value">${escapeHtml(fmt(reserve.dateEmission))}</div>
        <div class="kv-label">Priorité</div>
        <div class="kv-value">
          <span class="priorite-pill" style="background:${prioriteColor}">${prioriteLabel}</span>
        </div>
      </div>
      <div class="description">${escapeHtml(description)}</div>

      ${(reserve.photoAvant || reserve.photoApres) ? `
      <div class="section-title">
        <span class="section-title-bar"></span>
        <span class="section-title-text">Constat &amp; Reprise</span>
        <span class="section-title-line"></span>
      </div>
      <div class="photos-row">
        ${reserve.photoAvant ? `
        <div class="photo-card avant">
          <img src="${escapeHtml(reserve.photoAvant)}" crossorigin="anonymous" alt="avant"/>
          <div class="photo-card-label">▸ Avant — Constat</div>
        </div>` : `<div></div>`}
        ${reserve.photoApres ? `
        <div class="photo-card apres">
          <img src="${escapeHtml(reserve.photoApres)}" crossorigin="anonymous" alt="après"/>
          <div class="photo-card-label">▸ Après — Reprise réalisée</div>
        </div>` : `<div></div>`}
      </div>
      ` : ""}

      <div class="section-title">
        <span class="section-title-bar"></span>
        <span class="section-title-text">Intervention</span>
        <span class="section-title-line"></span>
      </div>
      <div class="kv">
        <div class="kv-label">Technicien EPJ</div>
        <div class="kv-value">${escapeHtml(technomFull)}</div>
        <div class="kv-label">Date d'intervention</div>
        <div class="kv-value">${escapeHtml(fmt(reserve.dateLevee))}</div>
      </div>
      <div class="description">${escapeHtml(travaux)}</div>

      <div class="section-title">
        <span class="section-title-bar"></span>
        <span class="section-title-text">Client final (occupant)</span>
        <span class="section-title-line"></span>
      </div>
      <div class="kv">
        <div class="kv-label">Nom</div>
        <div class="kv-value">${escapeHtml(reserve.clientFinal?.nom || "—")}</div>
        ${reserve.clientFinal?.telephone ? `
          <div class="kv-label">Téléphone</div>
          <div class="kv-value">${escapeHtml(reserve.clientFinal.telephone)}</div>` : ""}
        ${reserve.clientFinal?.email ? `
          <div class="kv-label">Email</div>
          <div class="kv-value">${escapeHtml(reserve.clientFinal.email)}</div>` : ""}
      </div>

      <div class="decl-box">
        <div class="decl-title">Déclaration de levée de réserve</div>
        <div class="decl-text">${escapeHtml(mentionText)}</div>
        <div class="decl-lieu">Fait à ${escapeHtml(villeChantier)}, le ${escapeHtml(fmt(reserve.dateLevee || new Date().toISOString()))}</div>
        <div class="sig-row">
          <div class="sig-box">
            <div class="sig-label">Signature client</div>
            ${clientSigPng ? `<img class="sig-image" src="${escapeHtml(clientSigPng)}" alt="signature client"/>` : `<div style="height:50px"></div>`}
            <div class="sig-name">${escapeHtml(clientNom || reserve.clientFinal?.nom || "—")}</div>
          </div>
          <div class="sig-box">
            <div class="sig-label">Signature technicien EPJ</div>
            ${technicien?.signatureUrl ? `<img class="sig-image" src="${escapeHtml(technicien.signatureUrl)}" crossorigin="anonymous" alt="signature technicien"/>` : `<div style="height:50px"></div>`}
            <div class="sig-name">${escapeHtml(technomFull)}</div>
          </div>
        </div>
      </div>

    </div>
  </div>

  <div class="controls">
    <button id="dl-btn">📥 Télécharger le PDF</button>
    <button id="print-btn" class="secondary">🖨 Imprimer</button>
    <div id="status-msg"></div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
  <script>
  (function(){
    const dlBtn = document.getElementById('dl-btn');
    const printBtn = document.getElementById('print-btn');
    const statusMsg = document.getElementById('status-msg');
    const page = document.getElementById('quitus-page');

    function setStatus(txt, color){
      statusMsg.textContent = txt || '';
      statusMsg.style.color = color || '#4A4A4A';
    }

    async function generatePdf(){
      dlBtn.disabled = true;
      printBtn.disabled = true;
      setStatus('⏳ Génération du PDF en cours...', '#00A3E0');
      try{
        // Attendre que toutes les images soient chargées
        const imgs = Array.from(page.querySelectorAll('img'));
        await Promise.all(imgs.map(img => {
          if (img.complete) return Promise.resolve();
          return new Promise((resolve) => {
            img.onload = resolve;
            img.onerror = resolve; // on continue même si une image échoue
            setTimeout(resolve, 5000); // timeout de sécurité
          });
        }));

        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          allowTaint: false,
          backgroundColor: '#ffffff',
          logging: false,
        });

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.9);
        const pW = pdf.internal.pageSize.getWidth();  // 210
        const pH = pdf.internal.pageSize.getHeight(); // 297

        pdf.addImage(imgData, 'JPEG', 0, 0, pW, pH);
        pdf.save('Quitus_${escapeHtml(numReserve).replace(/[^a-zA-Z0-9\\-_]/g, "_")}.pdf');
        setStatus('✓ PDF téléchargé !', '#2E7D32');
      } catch(err){
        console.error(err);
        setStatus('❌ Erreur : ' + (err.message || 'inconnue'), '#E53935');
      } finally {
        dlBtn.disabled = false;
        printBtn.disabled = false;
      }
    }

    dlBtn.addEventListener('click', generatePdf);
    printBtn.addEventListener('click', () => window.print());
  })();
  <\/script>
</body>
</html>`;

  // Ouvre la popup
  const win = window.open("", "_blank", "width=900,height=1200,scrollbars=yes");
  if (!win) {
    alert("❌ Veuillez autoriser les pop-ups pour générer le PDF.");
    return null;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  return win;
}

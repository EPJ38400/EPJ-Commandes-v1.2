// ═══════════════════════════════════════════════════════════════
//  pieuvresPdf.js — export PDF du planning pieuvre (M5, lecture seule)
//
//  Mécanisme calqué sur quitusPdfGenerator.js : popup window.open +
//  html2canvas + jsPDF chargés depuis le CDN dans la popup. Ici :
//  A4 PAYSAGE, UNE PAGE PAR BÂTIMENT (html2canvas multi-pages →
//  jsPDF.addPage), pied de page avec n° de page maîtrisé.
//
//  Logo EPJ : injecté en DATA URI (préchargé côté app via
//  loadLogoDataUri) — JAMAIS un chemin relatif (qui ne résout pas dans
//  une popup about:blank) ni une URL cross-origin (illisible par
//  html2canvas) : c'est la leçon du bug logo du quitus (BUG 3).
//
//  100 % lecture seule : ne lit que `chantier` + les lignes pieuvre déjà
//  chargées. Aucune écriture Firestore.
// ═══════════════════════════════════════════════════════════════
import { LOGO_HEADER } from "../../core/logo";
import { resolveBuildings, getBuildingLetter, getChantierSousSols } from "../avancement/avancementTasks";
import {
  niveauxForConfig, niveauxForSousSol, sousSolConfig,
  pieuvreId, niveauLabel, LIEU_OPTIONS, STATUT_OPTIONS,
} from "./pieuvresModel";

// Charte EPJ (cf. theme.js / DIRECTION_ARTISTIQUE)
const C = { blue: "#00A3E0", orange: "#F8A018", green: "#98D038", ink: "#1A1A1A", soft: "#F7F7F7", line: "#E5E5E5", muted: "#8E8E8E" };

// ─── Logo en data URI (même origine, sans CORS) — à précharger ───
export async function loadLogoDataUri() {
  try {
    const res = await fetch(LOGO_HEADER);
    if (!res.ok) return "";
    const blob = await res.blob();
    return await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === "string" ? fr.result : "");
      fr.onerror = () => resolve("");
      fr.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

// ─── Helpers ────────────────────────────────────────────────────
function fmtFr(ts) {
  if (!ts) return "—";
  const d = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  if (!d || isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
const escapeHtml = (s) => String(s == null ? "" : s)
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
const lieuLabel = (v) => (LIEU_OPTIONS.find((o) => o.value === v) || {}).label || "—";
const statutLabel = (v) => (STATUT_OPTIONS.find((o) => o.value === v) || {}).label || "—";

// Regroupe les lignes par bâtiment (SS→RDC→R→Combles) puis par sous-sol commun.
function groupRowsByBuilding(chantier, rows) {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out = [];
  for (const b of resolveBuildings(chantier)) {
    const lettre = getBuildingLetter(b);
    const ordered = niveauxForConfig(b.config)
      .map((n) => byId.get(pieuvreId(chantier.num, lettre, n.niveau)))
      .filter(Boolean);
    if (ordered.length) out.push({ titre: `Bâtiment ${lettre}`, rows: ordered });
  }
  for (const ss of getChantierSousSols(chantier)) {
    const ordered = niveauxForSousSol(sousSolConfig(ss))
      .map((n) => byId.get(pieuvreId(chantier.num, ss.id, n.niveau)))
      .filter(Boolean);
    if (ordered.length) out.push({ titre: `Sous-sol commun ${ss.nom || ""}`.trim(), rows: ordered });
  }
  // Filet de sécurité : lignes non rattachées à un (unité×niveau) attendu
  const matched = new Set(out.flatMap((g) => g.rows.map((r) => r.id)));
  const leftovers = rows.filter((r) => !matched.has(r.id));
  if (leftovers.length) {
    const byBat = {};
    leftovers.forEach((r) => { (byBat[r.batiment || "?"] ||= []).push(r); });
    Object.entries(byBat).forEach(([lettre, rs]) => out.push({ titre: `Bâtiment ${lettre}`, rows: rs }));
  }
  return out;
}

// ─── HTML d'une page (= un bâtiment) ─────────────────────────────
function buildPageHtml(group, pageNo, total, ctx) {
  const { chantier, logoDataUri, selection, editLe } = ctx;
  const titre = selection ? "Planning pieuvres — sélection" : "Planning pieuvres";

  const lignes = group.rows.map((r, i) => `
    <tr class="${i % 2 ? "alt" : ""}">
      <td class="b">${escapeHtml(niveauLabel(r.niveau))}</td>
      <td class="mono">${escapeHtml(r.posteAvancementKey || "—")}</td>
      <td>${escapeHtml(fmtFr(r.jourDemande))}</td>
      <td>${escapeHtml(fmtFr(r.dateReceptionPlansCotes))}</td>
      <td>${escapeHtml(fmtFr(r.dateLivraison))}</td>
      <td>${escapeHtml(lieuLabel(r.lieuLivraison))}</td>
      <td>${escapeHtml(statutLabel(r.statut))}</td>
      <td class="rem">${escapeHtml(r.remarques || "")}</td>
    </tr>`).join("");

  return `
  <div class="pdf-page">
    <div class="hd">
      <div class="hd-left">
        ${logoDataUri ? `<img class="logo" src="${logoDataUri}" alt="EPJ"/>` : `<div class="logo-fallback">EPJ Électricité&nbsp;Générale</div>`}
      </div>
      <div class="hd-right">
        <div class="ch-nom">${escapeHtml(chantier.nom || "—")}</div>
        <div class="ch-num">N° ${escapeHtml(chantier.num || "—")}</div>
        <div class="ch-adr">${escapeHtml(chantier.adresse || "")}</div>
      </div>
    </div>

    <div class="title-row">
      <div class="title">${escapeHtml(titre)}</div>
      <div class="title-date">Édité le ${escapeHtml(editLe)}</div>
    </div>
    <div class="rule"></div>

    <div class="bat">${escapeHtml(group.titre)}</div>

    <table>
      <colgroup>
        <col style="width:8%"/><col style="width:12%"/><col style="width:12%"/>
        <col style="width:14%"/><col style="width:12%"/><col style="width:8%"/>
        <col style="width:11%"/><col style="width:23%"/>
      </colgroup>
      <thead>
        <tr>
          <th>Niveau</th><th>Dalle / poste</th><th>Jour demande</th>
          <th>Réception plans cotés</th><th>Livraison prévue</th><th>Lieu</th>
          <th>Statut</th><th>Remarques</th>
        </tr>
      </thead>
      <tbody>${lignes}</tbody>
    </table>

    <div class="ft">
      <span>EPJ Électricité Générale</span>
      <span>Page ${pageNo}/${total}</span>
      <span>Édité le ${escapeHtml(editLe)}</span>
    </div>
  </div>`;
}

// ─── Ouvre la popup et génère le PDF ─────────────────────────────
export function openPieuvresPdfWindow({ chantier, rows, logoDataUri, selection }) {
  const groups = groupRowsByBuilding(chantier, rows || []);
  if (groups.length === 0) {
    alert("Aucune pieuvre à exporter.");
    return null;
  }
  const editLe = fmtFr(new Date());
  const total = groups.length;
  const ctx = { chantier, logoDataUri: logoDataUri || "", selection: !!selection, editLe };
  const pagesHtml = groups.map((g, i) => buildPageHtml(g, i + 1, total, ctx)).join("\n");

  const safeNum = String(chantier.num || "chantier").replace(/[^a-zA-Z0-9\-_]/g, "_");
  const filename = `Planning_pieuvres_${safeNum}${selection ? "_selection" : ""}.pdf`;

  const html = `<!DOCTYPE html>
<html lang="fr" translate="no">
<head>
  <meta charset="utf-8"/>
  <meta name="google" content="notranslate"/>
  <title>Planning pieuvres ${escapeHtml(chantier.num || "")}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; color: ${C.ink}; background: #ececec; padding: 16px; }
    .pdf-page {
      width: 1123px; height: 794px;            /* A4 paysage à 96 dpi */
      background: #fff; margin: 0 auto 16px; position: relative;
      padding: 34px 38px 30px; overflow: hidden;
      box-shadow: 0 4px 24px rgba(0,0,0,.12);
    }
    .hd { display: flex; align-items: flex-start; justify-content: space-between; }
    .logo { height: 52px; width: auto; display: block; }
    .logo-fallback { font-size: 18px; font-weight: 800; color: ${C.blue}; }
    .hd-right { text-align: right; }
    .ch-nom { font-size: 17px; font-weight: 800; color: ${C.ink}; }
    .ch-num { font-size: 12px; font-weight: 700; color: ${C.blue}; font-family: monospace; margin-top: 2px; }
    .ch-adr { font-size: 11px; color: ${C.muted}; margin-top: 2px; }
    .title-row { display: flex; align-items: baseline; justify-content: space-between; margin-top: 18px; }
    .title { font-size: 20px; font-weight: 800; color: ${C.blue}; letter-spacing: -0.01em; }
    .title-date { font-size: 11px; color: ${C.muted}; }
    .rule { height: 3px; background: ${C.blue}; border-radius: 2px; margin-top: 6px; }
    .bat { font-size: 14px; font-weight: 800; color: ${C.ink}; margin: 16px 0 8px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    thead th {
      background: ${C.blue}; color: #fff; font-size: 11px; font-weight: 700;
      text-align: left; padding: 7px 8px; border: 1px solid ${C.blue};
      vertical-align: middle;
    }
    tbody td {
      font-size: 11px; color: ${C.ink}; padding: 6px 8px;
      border: 1px solid ${C.line}; vertical-align: top;
      overflow-wrap: break-word; word-break: break-word;
    }
    tbody tr.alt td { background: ${C.soft}; }
    td.b { font-weight: 700; }
    td.mono { font-family: monospace; font-size: 10px; color: #4A4A4A; }
    td.rem { white-space: normal; }
    .ft {
      position: absolute; left: 38px; right: 38px; bottom: 18px;
      display: flex; justify-content: space-between;
      font-size: 10px; color: ${C.muted};
      border-top: 1px solid ${C.line}; padding-top: 6px;
    }
    .controls { max-width: 1123px; margin: 0 auto 16px; text-align: center; }
    .controls button {
      margin: 0 4px; padding: 12px 22px; border: none; border-radius: 8px;
      cursor: pointer; font-size: 14px; font-weight: 700; color: #fff;
      background: linear-gradient(135deg, ${C.blue}, ${C.green});
    }
    .controls button:disabled { opacity: .5; cursor: wait; }
    .controls .secondary { background: #F0F0F0; color: #4A4A4A; }
    #status { margin-top: 8px; font-size: 13px; color: #4A4A4A; }
    @media print {
      body { background: #fff; padding: 0; }
      .pdf-page { box-shadow: none; margin: 0; page-break-after: always; }
      .controls { display: none; }
      @page { size: A4 landscape; margin: 0; }
    }
  </style>
</head>
<body class="notranslate" translate="no">
  <div class="controls">
    <button id="dl">📥 Télécharger le PDF</button>
    <button id="pr" class="secondary">🖨 Imprimer</button>
    <div id="status"></div>
  </div>
  ${pagesHtml}

  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
  <script>
  (function(){
    var FILENAME = ${JSON.stringify(filename)};
    var dl = document.getElementById('dl');
    var pr = document.getElementById('pr');
    var status = document.getElementById('status');
    function setStatus(t, c){ status.textContent = t || ''; status.style.color = c || '#4A4A4A'; }

    async function generate(){
      dl.disabled = true; pr.disabled = true;
      setStatus('⏳ Génération du PDF…', '#00A3E0');
      try {
        var imgs = Array.from(document.querySelectorAll('img'));
        await Promise.all(imgs.map(function(img){
          if (img.complete) return Promise.resolve();
          return new Promise(function(res){ img.onload = res; img.onerror = res; setTimeout(res, 4000); });
        }));
        var jsPDF = window.jspdf.jsPDF;
        var pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        var pages = document.querySelectorAll('.pdf-page');
        var pW = pdf.internal.pageSize.getWidth();
        var pH = pdf.internal.pageSize.getHeight();
        for (var i = 0; i < pages.length; i++){
          var canvas = await html2canvas(pages[i], { scale: 2, useCORS: true, backgroundColor: '#ffffff', logging: false });
          var imgData = canvas.toDataURL('image/jpeg', 0.92);
          if (i > 0) pdf.addPage();
          pdf.addImage(imgData, 'JPEG', 0, 0, pW, pH);
        }
        pdf.save(FILENAME);
        setStatus('✓ PDF téléchargé !', '#2E7D32');
      } catch(err){
        console.error(err);
        setStatus('❌ Erreur : ' + (err && err.message ? err.message : 'inconnue'), '#E53935');
      } finally {
        dl.disabled = false; pr.disabled = false;
      }
    }
    dl.addEventListener('click', generate);
    pr.addEventListener('click', function(){ window.print(); });
  })();
  <\/script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=1200,height=850,scrollbars=yes");
  if (!win) {
    alert("❌ Veuillez autoriser les pop-ups pour générer le PDF.");
    return null;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  return win;
}

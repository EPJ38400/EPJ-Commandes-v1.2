// ═══════════════════════════════════════════════════════════════
//  exportUtils.js — Export PDF et Excel d'un snapshot mensuel
// ═══════════════════════════════════════════════════════════════
import { totalHoursForTask, totalHoursFromSessions, totalHoursForBuilding } from "./avancementTasks";

// ─── Format "2026-04" → "avril 2026" ─────────────────────────
function formatMonth(ym) {
  const [y, m] = ym.split("-");
  const months = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
  return `${months[parseInt(m) - 1]} ${y}`;
}

// ─── Calcule % d'une catégorie ──────────────────────────────
function categoryPct(tasks, progress) {
  if (!tasks || tasks.length === 0) return 0;
  let sum = 0;
  tasks.forEach(t => { sum += Number(progress?.[t.id] || 0); });
  return Math.round(sum / tasks.length);
}

// ─── Calcule % global d'un bâtiment ─────────────────────────
function buildingPct(categories, progress) {
  let sum = 0, count = 0;
  (categories || []).forEach(cat => {
    (cat.tasks || []).forEach(t => {
      sum += Number(progress?.[t.id] || 0);
      count++;
    });
  });
  return count > 0 ? Math.round(sum / count) : 0;
}

// ─── Convertit l'objet snapshot d'un mois en liste de catégories pour render ──
function categoriesFromSnapshot(snapshotBuilding) {
  if (!snapshotBuilding || !snapshotBuilding.categories) return [];
  // snapshotBuilding.categories = { etude: { tasks: [...] }, beton: { tasks: [...] }, ... }
  // On a besoin du num + label + color qui sont dans le FACTORY
  const FACTORY_META = {
    etude:     { num: 1, label: "ÉTUDE / TMA",                 color: "#8E44AD" },
    beton:     { num: 2, label: "INCORPORATION BÉTON",         color: "#6B6B6B" },
    divers:    { num: 3, label: "AVANCEMENT DIVERS",           color: "#F5841F" },
    placo:     { num: 4, label: "AVANCEMENT PLACO",            color: "#E53935" },
    logements: { num: 5, label: "ÉQUIPEMENT DES LOGEMENTS",    color: "#00A3E0" },
    communs:   { num: 6, label: "ÉQUIPEMENT DES COMMUNS",      color: "#00A3E0" },
    controle:  { num: 7, label: "CONTRÔLE ET MISE EN SERVICE", color: "#A8C536" },
  };
  const order = ["etude", "beton", "divers", "placo", "logements", "communs", "controle"];
  const cats = [];
  order.forEach(id => {
    const data = snapshotBuilding.categories[id];
    if (!data) return;
    const meta = FACTORY_META[id] || { num: 0, label: id.toUpperCase(), color: "#3D3D3D" };
    cats.push({
      id,
      num: meta.num,
      label: meta.label,
      color: meta.color,
      tasks: data.tasks || [],
    });
  });
  return cats;
}

// ═══════════════════════════════════════════════════════════════
//  EXPORT PDF (via window.print sur un HTML stylé charte EPJ)
//
//  v10.E :
//   • A1 — Bandeau "AVANCEMENT TOTAL CHANTIER" en haut du PDF, qui agrège
//     tous les bâtiments (moyenne pondérée par nb de tâches).
//   • A3 — Les tâches à 0% sont MASQUÉES dans le PDF. Les catégories qui
//     n'ont plus aucune tâche après filtrage sont masquées également.
//     Le calcul des % de catégorie reste sur l'ensemble des tâches de la
//     catégorie (sinon une catégorie à 50% (1/2 tâche faite) afficherait 100%).
// ═══════════════════════════════════════════════════════════════
export function exportSnapshotToPdf(chantier, month, snapshot, logoHeaderBase64) {
  const monthLabel = formatMonth(month);
  const buildingIds = Object.keys(snapshot || {});

  // ─── A1 : calcul du total global multi-bâtiments ──
  // On somme TOUTES les valeurs de progression de TOUTES les tâches de TOUS
  // les bâtiments puis on divise par le nombre total de tâches.
  let globalSum = 0, globalCount = 0;
  let globalHours = 0;
  buildingIds.forEach(bId => {
    const sb = snapshot[bId];
    if (!sb) return;
    const cats = categoriesFromSnapshot(sb);
    cats.forEach(cat => {
      (cat.tasks || []).forEach(t => {
        globalSum += Number(sb.progress?.[t.id] || 0);
        globalCount++;
      });
    });
    globalHours += totalHoursForBuilding(sb.hoursSessions, sb.hours);
  });
  const globalPct = globalCount > 0 ? Math.round(globalSum / globalCount) : 0;
  const showGlobalHeader = buildingIds.length > 1; // utile surtout en multi-bâtiments

  // Construit le HTML
  let body = "";
  const frozenAt = (snapshot?.[buildingIds[0]]?.frozenAt) || new Date().toISOString();
  const frozenDate = new Date(frozenAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  // ─── A1 : bandeau récapitulatif global au-dessus des bâtiments (multi-bât.) ───
  if (showGlobalHeader) {
    body += `
      <div class="global-summary">
        <div class="global-summary-head">
          <div class="global-summary-title">AVANCEMENT TOTAL DU CHANTIER</div>
          <div class="global-summary-pct">${globalPct}%</div>
        </div>
        <div class="global-summary-meta">
          ${buildingIds.length} bâtiment${buildingIds.length > 1 ? "s" : ""}
          ${globalHours > 0 ? ` • ⏱ ${globalHours.toFixed(1)} h cumulées` : ""}
        </div>
      </div>
    `;
  }

  buildingIds.forEach(bId => {
    const sb = snapshot[bId];
    if (!sb) return;
    const cats = categoriesFromSnapshot(sb);
    const pct = buildingPct(cats, sb.progress);
    const totalH = totalHoursForBuilding(sb.hoursSessions, sb.hours);

    body += `
      <div class="building">
        <div class="building-head">
          <div class="building-id">${buildingIds.length > 1 ? `Bâtiment ${bId}` : "Avancement"}</div>
          <div class="building-pct">${pct}%</div>
        </div>
        ${totalH > 0 ? `<div class="building-hours">⏱ ${totalH.toFixed(1)} h cumulées</div>` : ""}
    `;

    cats.forEach(cat => {
      // A3 : filtrer les tâches non avancées (progression == 0)
      const advancedTasks = (cat.tasks || []).filter(t => Number(sb.progress?.[t.id] || 0) > 0);
      if (advancedTasks.length === 0) return; // Catégorie totalement vide → on la skip

      const catPct = categoryPct(cat.tasks, sb.progress); // % de la cat. ENTIÈRE (référence stable)
      body += `
        <div class="category">
          <div class="category-head">
            <span class="category-num" style="background:${cat.color}22;color:${cat.color}">${cat.num}</span>
            <span class="category-label">${escape(cat.label)}</span>
            <span class="category-pct" style="color:${cat.color}">${catPct}%</span>
          </div>
          <table class="tasks">
            <tr>
              <th>Tâche</th>
              <th class="pct">%</th>
              <th class="hrs">Heures</th>
            </tr>
      `;
      advancedTasks.forEach(t => {
        const p = Number(sb.progress?.[t.id] || 0);
        const sessions = sb.hoursSessions?.[t.id];
        const h = totalHoursForTask(sessions, sb.hours?.[t.id]);
        body += `
          <tr>
            <td>${escape(t.label)}</td>
            <td class="pct" style="color:${p === 100 ? "#A8C536" : p > 0 ? "#00A3E0" : "#ccc"}">${p}%</td>
            <td class="hrs">${h > 0 ? h.toFixed(1) + " h" : ""}</td>
          </tr>
        `;
      });
      body += `</table></div>`;
    });

    body += `</div>`;
  });

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Avancement ${escape(chantier.nom)} — ${monthLabel}</title>
<style>
  @page { size: A4; margin: 14mm 12mm; }
  *, *::before, *::after { box-sizing: border-box; }
  body {
    font-family: -apple-system, 'Inter', 'Segoe UI', sans-serif;
    color: #1A1A1A;
    font-size: 11px;
    line-height: 1.4;
    margin: 0;
    background: #fff;
  }
  .page-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    padding-bottom: 10px;
    border-bottom: 3px solid transparent;
    border-image: linear-gradient(90deg, #00A3E0, #A8C536, #F5841F) 1;
    margin-bottom: 18px;
  }
  .page-head .left { flex: 1; }
  .page-head h1 {
    font-size: 22px; font-weight: 700; margin: 0 0 4px 0;
    letter-spacing: -0.02em; color: #1A1A1A;
  }
  .page-head .subtitle {
    font-size: 10px; text-transform: uppercase; color: #8C8C8C;
    letter-spacing: 0.4px; font-weight: 600;
  }
  .page-head .right { text-align: right; }
  .page-head .right .label {
    font-size: 9px; text-transform: uppercase; color: #8C8C8C;
    letter-spacing: 0.4px; font-weight: 600; margin-bottom: 2px;
  }
  .page-head .right .month {
    font-size: 16px; font-weight: 700; color: #F5841F;
  }
  .meta {
    display: flex; gap: 20px; flex-wrap: wrap;
    margin-bottom: 16px; font-size: 10px;
  }
  .meta-item { flex: 1; min-width: 140px; }
  .meta-item .label {
    font-size: 8px; text-transform: uppercase; color: #8C8C8C;
    letter-spacing: 0.4px; font-weight: 600; margin-bottom: 2px;
  }
  .meta-item .value {
    font-size: 11px; font-weight: 600; color: #1A1A1A;
  }
  .building { margin-bottom: 20px; page-break-inside: avoid; }
  .global-summary {
    margin-bottom: 18px;
    padding: 14px 16px;
    background: linear-gradient(135deg, #00A3E0, #A8C536);
    border-radius: 10px;
    color: #fff;
    page-break-inside: avoid;
  }
  .global-summary-head {
    display: flex; justify-content: space-between; align-items: center;
  }
  .global-summary-title {
    font-size: 11px; font-weight: 700;
    letter-spacing: 0.6px; text-transform: uppercase;
  }
  .global-summary-pct {
    font-size: 26px; font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .global-summary-meta {
    margin-top: 4px;
    font-size: 10px; opacity: 0.95; font-weight: 500;
  }
  .building-head {
    display: flex; justify-content: space-between; align-items: center;
    padding: 10px 12px; background: #F4F5F7; border-radius: 8px;
    margin-bottom: 10px;
  }
  .building-id { font-size: 13px; font-weight: 700; color: #3D3D3D; }
  .building-pct { font-size: 18px; font-weight: 700; color: #F5841F; }
  .building-hours { font-size: 10px; color: #8C8C8C; margin-bottom: 10px; padding-left: 4px; }
  .category { margin-bottom: 12px; page-break-inside: avoid; }
  .category-head {
    display: flex; align-items: center; gap: 8px;
    padding: 5px 0; margin-bottom: 4px;
    border-bottom: 1px solid #EAEAEA;
  }
  .category-num {
    font-family: monospace; font-size: 9px; font-weight: 700;
    padding: 2px 6px; border-radius: 3px;
  }
  .category-label { flex: 1; font-size: 11px; font-weight: 700; letter-spacing: 0.3px; }
  .category-pct { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }
  table.tasks {
    width: 100%; border-collapse: collapse; margin-top: 2px;
  }
  table.tasks th {
    font-size: 8px; text-transform: uppercase; color: #8C8C8C;
    letter-spacing: 0.4px; font-weight: 600;
    text-align: left; padding: 4px 6px; border-bottom: 1px solid #EAEAEA;
  }
  table.tasks th.pct, table.tasks th.hrs,
  table.tasks td.pct, table.tasks td.hrs {
    text-align: right; font-variant-numeric: tabular-nums;
    width: 70px;
  }
  table.tasks td {
    font-size: 10px; padding: 4px 6px; border-bottom: 1px dotted #EAEAEA;
  }
  table.tasks td.pct { font-weight: 700; }
  table.tasks td.hrs { color: #8C8C8C; }
  .footer {
    margin-top: 20px; padding-top: 10px; border-top: 1px solid #EAEAEA;
    font-size: 9px; color: #8C8C8C; text-align: center;
  }
  .print-btn {
    display: block; width: 100%; padding: 14px;
    background: linear-gradient(135deg, #00A3E0, #A8C536); color: #fff;
    border: none; border-radius: 10px; font-size: 15px; font-weight: 700;
    cursor: pointer; margin-top: 20px; text-align: center;
  }
  @media print { .print-btn { display: none; } }
</style>
</head>
<body>
  <div class="page-head">
    <div class="left">
      <h1>${escape(chantier.nom)}</h1>
      <div class="subtitle">Situation d'avancement mensuelle</div>
    </div>
    <div class="right">
      <div class="label">Situation</div>
      <div class="month">${monthLabel}</div>
    </div>
  </div>

  <div class="meta">
    <div class="meta-item"><div class="label">N° Affaire</div><div class="value">${escape(chantier.num)}</div></div>
    ${chantier.adresse ? `<div class="meta-item"><div class="label">Adresse</div><div class="value">${escape(chantier.adresse)}</div></div>` : ""}
    <div class="meta-item"><div class="label">Figé le</div><div class="value">${frozenDate}</div></div>
  </div>

  ${body}

  <div class="footer">
    EPJ Électricité Générale — Document généré depuis l'application EPJ
  </div>

  <button class="print-btn" onclick="window.print()">🖨️ Imprimer / Enregistrer en PDF</button>
</body>
</html>`;

  // Ouvre un nouvel onglet avec le HTML
  const win = window.open("", "_blank");
  if (!win) {
    alert("Popup bloquée — autorise les popups pour générer le PDF.");
    return;
  }
  win.document.write(html);
  win.document.close();
  // Lance l'impression automatiquement après un court délai
  setTimeout(() => {
    try { win.focus(); win.print(); } catch (e) { /* ignore */ }
  }, 500);
}

// ═══════════════════════════════════════════════════════════════
//  EXPORT EXCEL (via SheetJS chargé en CDN à la volée)
// ═══════════════════════════════════════════════════════════════
export async function exportSnapshotToExcel(chantier, month, snapshot) {
  const XLSX = await loadSheetJS();
  const monthLabel = formatMonth(month);
  const buildingIds = Object.keys(snapshot || {});
  const wb = XLSX.utils.book_new();

  buildingIds.forEach(bId => {
    const sb = snapshot[bId];
    if (!sb) return;
    const cats = categoriesFromSnapshot(sb);
    const rows = [];

    // En-têtes
    rows.push([chantier.nom]);
    rows.push([`N° Affaire : ${chantier.num}`]);
    if (chantier.adresse) rows.push([`Adresse : ${chantier.adresse}`]);
    rows.push([`Situation : ${monthLabel}`]);
    if (buildingIds.length > 1) rows.push([`Bâtiment : ${bId}`]);
    rows.push([]);

    // Table
    rows.push(["N°", "Catégorie / Tâche", "Avancement %", "Heures"]);

    cats.forEach(cat => {
      const catPct = categoryPct(cat.tasks, sb.progress);
      rows.push([cat.num, cat.label, `${catPct}%`, ""]);
      cat.tasks.forEach(t => {
        const p = Number(sb.progress?.[t.id] || 0);
        const sessions = sb.hoursSessions?.[t.id];
        const h = totalHoursForTask(sessions, sb.hours?.[t.id]);
        rows.push(["", `   ${t.label}`, p / 100, h > 0 ? h : ""]);
      });
      rows.push([]);
    });

    const pct = buildingPct(cats, sb.progress);
    const totalH = totalHoursForBuilding(sb.hoursSessions, sb.hours);
    rows.push(["", "TOTAL GÉNÉRAL", `${pct}%`, totalH > 0 ? totalH : ""]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    // Largeurs de colonnes
    ws["!cols"] = [{ wch: 5 }, { wch: 50 }, { wch: 14 }, { wch: 10 }];
    // Format % sur la colonne C pour les valeurs numériques
    for (let R = 0; R < rows.length; R++) {
      const cell = ws[XLSX.utils.encode_cell({ c: 2, r: R })];
      if (cell && typeof cell.v === "number" && cell.v < 1 && cell.v >= 0) {
        cell.z = "0%";
      }
    }

    const sheetName = (buildingIds.length > 1 ? `Bât ${bId}` : "Avancement").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  });

  const fileName = `Avancement_${sanitize(chantier.nom)}_${month}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

// ─── Helper : charge SheetJS depuis CDN si besoin ────────────
function loadSheetJS() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const script = document.createElement("script");
    script.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    script.onload = () => resolve(window.XLSX);
    script.onerror = () => reject(new Error("Impossible de charger SheetJS"));
    document.head.appendChild(script);
  });
}

function escape(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function sanitize(s) {
  return String(s || "chantier").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);
}

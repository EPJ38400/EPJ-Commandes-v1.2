#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════
//  audit:tokens — compteur de reliquat Design System (EPJ)
//  Node pur, zéro dépendance. Lecture seule de src/.
//
//  Compte ce qui DOIT migrer vers les tokens theme.js :
//   1. Couleurs littérales (hex + rgb/rgba) → EPJ.*
//   2. fontWeight numériques en dur → fontWeight.* (700/800 = interdits UI)
//   3. borderRadius / padding / margin / gap littéraux → radius.* / space.*
//   4. Top 10 fichiers les plus chargés
//
//  Exclusions du comptage global :
//   - Générateurs PDF/export : exportUtils.js, quitusPdfGenerator.js, reservesUtils.js
//   - Tests : *.test.js
//   - theme.js : fichier SOURCE des tokens (ses hex sont la cible, pas le reliquat ;
//     couvre la consigne « neutraliser globalCss »)
//   - (lot trio livré : CommandesInner.jsx est désormais compté normalement.
//     Son reliquat est dominé par les générateurs print INLINE — PdfView +
//     generateAndOpenPdf — légitimes au même titre que quitusPdfGenerator.js.)
//
//  C'est un compteur de décrue : relire sa sortie après chaque lot DS.
// ═══════════════════════════════════════════════════════════════

import { readdir, readFile } from 'node:fs/promises';
import { join, basename, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');

const IGNORED_FILES = new Set([
  'exportUtils.js',
  'quitusPdfGenerator.js',
  'reservesUtils.js',
  'theme.js',
]);
// ── Helpers ──────────────────────────────────────────────────────

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await walk(full));
    } else if (/\.(js|jsx)$/.test(entry.name) && !/\.test\.js$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

// Retire commentaires (bloc + ligne) pour éviter les faux positifs.
// Le lookbehind (?<![:/]) épargne les URL (https://) et les ///.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(?<![:/])\/\/.*$/gm, '');
}

const HEX_RE  = /#[0-9A-Fa-f]{3,8}\b/g;
const RGB_RE  = /rgba?\([^)]*\)/g;
const FW_RE   = /font-?[wW]eight\s*:\s*['"]?(\d{3})['"]?/g;
const DIM_RE  = /\b(borderRadius|padding(?:Top|Right|Bottom|Left)?|margin(?:Top|Right|Bottom|Left)?|gap|rowGap|columnGap)\s*:\s*([^,;}\n]+)/g;

// Une valeur est « littérale » si elle contient un nombre et NE référence PAS un token.
function isLiteralDim(val) {
  if (/\b(space|radius|fontSize)\s*[.[]/.test(val)) return false; // token ref
  return /\d/.test(val);
}

function pad(s, n) { s = String(s); return s + ' '.repeat(Math.max(0, n - s.length)); }
function padL(s, n) { s = String(s); return ' '.repeat(Math.max(0, n - s.length)) + s; }

// ── Analyse d'un fichier ─────────────────────────────────────────

function analyze(code) {
  const src = stripComments(code);
  const colors = {};   // littéral -> count
  const weights = {};  // valeur -> count
  let radiusLit = 0, spacingLit = 0;

  for (const m of src.matchAll(HEX_RE)) {
    const k = m[0].toLowerCase();
    colors[k] = (colors[k] || 0) + 1;
  }
  for (const m of src.matchAll(RGB_RE)) {
    const k = m[0].replace(/\s+/g, '');
    colors[k] = (colors[k] || 0) + 1;
  }
  for (const m of src.matchAll(FW_RE)) {
    weights[m[1]] = (weights[m[1]] || 0) + 1;
  }
  for (const m of src.matchAll(DIM_RE)) {
    if (!isLiteralDim(m[2])) continue;
    if (m[1] === 'borderRadius') radiusLit++; else spacingLit++;
  }

  const colorCount  = Object.values(colors).reduce((a, b) => a + b, 0);
  const weightCount = Object.values(weights).reduce((a, b) => a + b, 0);
  return { colors, weights, radiusLit, spacingLit, colorCount, weightCount };
}

// ── Programme ────────────────────────────────────────────────────

const files = await walk(SRC);

const totalColors = {};
const totalWeights = {};
let totalRadius = 0, totalSpacing = 0;
const colorFiles = new Set();
const weightFiles = new Set();
const perFile = []; // { file, colorCount, weightCount, dim, score }

for (const f of files) {
  const name = basename(f);
  if (IGNORED_FILES.has(name)) continue;

  const a = analyze(await readFile(f, 'utf8'));
  const dim = a.radiusLit + a.spacingLit;
  const rec = {
    file: relative(SRC, f),
    colorCount: a.colorCount,
    weightCount: a.weightCount,
    dim,
    radiusLit: a.radiusLit,
    spacingLit: a.spacingLit,
    score: a.colorCount + a.weightCount + dim,
  };

  for (const [k, v] of Object.entries(a.colors)) totalColors[k] = (totalColors[k] || 0) + v;
  for (const [k, v] of Object.entries(a.weights)) totalWeights[k] = (totalWeights[k] || 0) + v;
  totalRadius += a.radiusLit;
  totalSpacing += a.spacingLit;
  if (a.colorCount) colorFiles.add(f);
  if (a.weightCount) weightFiles.add(f);
  if (rec.score) perFile.push(rec);
}

// ── Sortie ───────────────────────────────────────────────────────

const colorTotal  = Object.values(totalColors).reduce((a, b) => a + b, 0);
const weightTotal = Object.values(totalWeights).reduce((a, b) => a + b, 0);
const wForbidden  = (totalWeights['700'] || 0) + (totalWeights['800'] || 0) + (totalWeights['900'] || 0);

const line = '─'.repeat(58);
console.log(`\n  AUDIT TOKENS — reliquat Design System EPJ`);
console.log(`  src/ · ${files.length} fichiers scannés · exclus : PDF/export, *.test.js, theme.js`);
console.log(line);

// 1. Couleurs
console.log(`\n  1. COULEURS LITTÉRALES (→ EPJ.*)`);
console.log(`     ${colorTotal} occurrences · ${colorFiles.size} fichiers concernés`);
const topColors = Object.entries(totalColors).sort((a, b) => b[1] - a[1]).slice(0, 15);
console.log(`     Top 15 :`);
for (const [val, n] of topColors) {
  console.log(`       ${pad(val, 26)} ${padL(n, 4)}`);
}

// 2. fontWeight
console.log(`\n  2. fontWeight NUMÉRIQUES EN DUR (→ fontWeight.*)`);
console.log(`     ${weightTotal} occurrences · ${weightFiles.size} fichiers concernés`);
console.log(`     Ventilation par valeur :`);
for (const [val, n] of Object.entries(totalWeights).sort((a, b) => Number(a[0]) - Number(b[0]))) {
  const flag = ['700', '800', '900'].includes(val) ? '  ⛔ interdit UI' : '';
  console.log(`       ${pad(val, 6)} ${padL(n, 4)}${flag}`);
}
console.log(`     → ${wForbidden} graisses 700/800/900 à résorber (cible : 0)`);

// 3. Dimensions
console.log(`\n  3. DIMENSIONS LITTÉRALES (→ radius.* / space.*)`);
console.log(`     borderRadius : ${padL(totalRadius, 5)}`);
console.log(`     padding/margin/gap : ${padL(totalSpacing, 5)}`);
console.log(`     total dimensions : ${padL(totalRadius + totalSpacing, 5)}`);

// 4. Top fichiers
console.log(`\n  4. TOP 10 FICHIERS LES PLUS CHARGÉS`);
console.log(`     ${pad('fichier', 46)} ${pad('coul', 5)}${pad('fw', 4)}${pad('dim', 5)}${pad('tot', 5)}`);
for (const r of perFile.sort((a, b) => b.score - a.score).slice(0, 10)) {
  const f = r.file.length > 45 ? '…' + r.file.slice(-44) : r.file;
  console.log(`     ${pad(f, 46)} ${pad(r.colorCount, 5)}${pad(r.weightCount, 4)}${pad(r.dim, 5)}${pad(r.score, 5)}`);
}

console.log(`\n${line}`);
console.log(`\n  TOTAL RELIQUAT : ${colorTotal + weightTotal + totalRadius + totalSpacing} occurrences`);
console.log(`${line}\n`);

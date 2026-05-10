// ═══════════════════════════════════════════════════════════════
//  smsService.test.js — v10.H (Charte Option D)
//
//  Tests unitaires sur la logique pure du service SMS :
//    - normalizePhone : normalisation des formats de téléphone
//    - findActiveTemplate : recherche + filtrage par flag actif
//
//  queueSms (qui fait du Firestore) n'est pas testé ici — ça serait un test
//  d'intégration. On teste les bouts purs uniquement.
//
//  Lancement : node src/core/smsService.test.js
// ═══════════════════════════════════════════════════════════════

// Reproduction des fonctions pures de smsService.js (extraites pour test)
function normalizePhone(raw) {
  if (!raw || typeof raw !== "string") return null;
  let cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  if (cleaned.startsWith("+33")) {
    return cleaned.length >= 11 ? cleaned : null;
  }
  if (cleaned.startsWith("33") && cleaned.length === 11) {
    return "+" + cleaned;
  }
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return "+33" + cleaned.slice(1);
  }
  return null;
}

function findActiveTemplate(smsTemplates, code) {
  if (!Array.isArray(smsTemplates) || !code) return null;
  const tpl = smsTemplates.find(t => (t.id === code || t.code === code));
  if (!tpl) return null;
  if (tpl.actif === false) return null;
  return tpl;
}

// Reproduction de renderSmsTemplate (parcUtils) pour test combiné
function renderSmsTemplate(template, vars) {
  if (!template) return "";
  let out = template;
  Object.entries(vars || {}).forEach(([k, v]) => {
    const re = new RegExp(`\\{${k}\\}`, "g");
    out = out.replace(re, v ?? "");
  });
  return out;
}

let pass = 0, fail = 0;
function assertEq(actual, expected, name) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`✓ ${name}`); pass++; }
  else {
    console.log(`✗ ${name}`);
    console.log(`  Attendu: ${JSON.stringify(expected)}`);
    console.log(`  Obtenu : ${JSON.stringify(actual)}`);
    fail++;
  }
}

// ─── Tests normalizePhone ────────────────────────────────────

// Format français standard 10 chiffres
assertEq(normalizePhone("0612345678"), "+33612345678", "0612345678 → +33612345678");
assertEq(normalizePhone("06 12 34 56 78"), "+33612345678", "Avec espaces → normalisé");
assertEq(normalizePhone("06.12.34.56.78"), "+33612345678", "Avec points → normalisé");
assertEq(normalizePhone("06-12-34-56-78"), "+33612345678", "Avec tirets → normalisé");

// Format E.164 déjà
assertEq(normalizePhone("+33612345678"), "+33612345678", "Déjà au format E.164");
assertEq(normalizePhone("+33 6 12 34 56 78"), "+33612345678", "E.164 avec espaces");

// Format 33 sans +
assertEq(normalizePhone("33612345678"), "+33612345678", "33... sans + → ajouté");

// Cas invalides
assertEq(normalizePhone(""), null, "Chaîne vide → null");
assertEq(normalizePhone(null), null, "null → null");
assertEq(normalizePhone(undefined), null, "undefined → null");
assertEq(normalizePhone("abc"), null, "Pas de chiffres → null");
assertEq(normalizePhone("123"), null, "Trop court → null");
assertEq(normalizePhone(123456), null, "Number (pas string) → null");

// Format mobile français bien identifié
assertEq(normalizePhone("0712345678"), "+33712345678", "07... mobile aussi OK");

// Fixe français
assertEq(normalizePhone("0123456789"), "+33123456789", "Numéro fixe Paris");

// ─── Tests findActiveTemplate ────────────────────────────────

const templates = [
  { id: "tpl_a", body: "Hello {name}", actif: true },
  { id: "tpl_b", body: "Bye", actif: false },           // désactivé
  { id: "tpl_c", body: "Test" },                        // pas de flag → considéré actif
  { code: "tpl_d", body: "Code-based" },                // utilise "code" au lieu de "id"
];

// Template actif trouvé
{
  const r = findActiveTemplate(templates, "tpl_a");
  assertEq(r?.id, "tpl_a", "Template actif trouvé");
}

// Template désactivé → null
{
  const r = findActiveTemplate(templates, "tpl_b");
  assertEq(r, null, "Template désactivé → null");
}

// Template sans flag → considéré actif (rétrocompat)
{
  const r = findActiveTemplate(templates, "tpl_c");
  assertEq(r?.id, "tpl_c", "Template sans flag → trouvé (rétrocompat)");
}

// Template via "code" au lieu de "id"
{
  const r = findActiveTemplate(templates, "tpl_d");
  assertEq(r?.body, "Code-based", "Template via 'code' aussi reconnu");
}

// Template inexistant
{
  const r = findActiveTemplate(templates, "tpl_inconnu");
  assertEq(r, null, "Template inexistant → null");
}

// Liste vide ou nulle
assertEq(findActiveTemplate([], "x"), null, "Liste vide → null");
assertEq(findActiveTemplate(null, "x"), null, "Liste null → null");
assertEq(findActiveTemplate(undefined, "x"), null, "Liste undefined → null");

// Code vide
assertEq(findActiveTemplate(templates, ""), null, "Code vide → null");
assertEq(findActiveTemplate(templates, null), null, "Code null → null");

// ─── Tests combinés (rendu de message après lookup) ──────────

{
  const tpl = findActiveTemplate(templates, "tpl_a");
  const msg = renderSmsTemplate(tpl?.body || "", { name: "Joseph" });
  assertEq(msg, "Hello Joseph", "Rendu après lookup template actif");
}

// Variables manquantes → la variable reste telle quelle (pas de remplacement)
// Comportement actuel de renderSmsTemplate : seules les clés présentes dans
// `vars` sont remplacées. Les autres variables {xxx} restent intactes.
{
  const tpl = findActiveTemplate(templates, "tpl_a");
  const msg = renderSmsTemplate(tpl?.body || "", {});
  assertEq(msg, "Hello {name}", "Variable manquante → reste {name} (pas remplacée)");
}

// Template avec plusieurs variables
{
  const t = "Bonjour {prenom}, commande {numCmd} sur {chantier} de {demandeur}";
  const msg = renderSmsTemplate(t, {
    prenom: "Mickael",
    numCmd: "CMD-2026-0042",
    chantier: "LE 17",
    demandeur: "Thomas BARTOLI",
  });
  assertEq(msg, "Bonjour Mickael, commande CMD-2026-0042 sur LE 17 de Thomas BARTOLI",
    "Rendu multi-variables");
}

// ─── Récap ───────────────────────────────────────────────────
console.log("\n────────────────────────────────────────");
console.log(`Tests smsService : ${pass} OK, ${fail} KO`);
if (fail > 0) process.exit(1);

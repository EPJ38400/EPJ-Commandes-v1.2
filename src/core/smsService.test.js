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

// ═══════════════════════════════════════════════════════════════
//  v10.I — Tests fix recipientUserId (extractUid) + nouveaux helpers
// ═══════════════════════════════════════════════════════════════

// Reproduction de extractUid (privé dans smsService.js)
function extractUid(u) {
  if (!u || typeof u !== "object") return "";
  return u._id || u.id || u.uid || "";
}

// Reproduction de findAssistanteAchats
function findAssistanteAchats(users) {
  if (!Array.isArray(users)) return null;
  const byRole = users.find(u => {
    const roles = Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []);
    return roles.some(r => (r || "").toLowerCase().includes("assist"));
  });
  if (byRole) return byRole;
  return users.find(u => (u.fonction || "").toLowerCase().includes("assist")) || null;
}

// Reproduction de findResponsableParc
function findResponsableParc(users) {
  if (!Array.isArray(users)) return null;
  const flagged = users.find(u => u.responsableParc === true);
  if (flagged) return flagged;
  const direction = users.find(u => {
    const roles = Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []);
    return roles.includes("Direction");
  });
  if (direction) return direction;
  return users.find(u => {
    const roles = Array.isArray(u.roles) ? u.roles : (u.role ? [u.role] : []);
    return roles.includes("Admin");
  }) || null;
}

// Reproduction de findUserByUid
function findUserByUid(uid, users) {
  if (!uid || !Array.isArray(users)) return null;
  return users.find(u =>
    u._id === uid || u.id === uid || u.uid === uid
  ) || null;
}

// ─── Test : extractUid (fix bug recipientUserId) ────────────
assertEq(extractUid({ _id: "abc123", nom: "Yver" }), "abc123",
  "extractUid privilégie _id");
assertEq(extractUid({ id: "abc123", nom: "Yver" }), "abc123",
  "extractUid prend id si pas de _id");
assertEq(extractUid({ uid: "abc123", nom: "Yver" }), "abc123",
  "extractUid prend uid si pas de _id ni id");
assertEq(extractUid({ nom: "Yver" }), "",
  "extractUid retourne '' si aucun champ ID (bug v10.H corrigé)");
assertEq(extractUid(null), "", "extractUid résiste à null");
assertEq(extractUid(undefined), "", "extractUid résiste à undefined");
assertEq(extractUid("Yver"), "", "extractUid résiste à une string (ancien bug)");

// ─── Test : findAssistanteAchats ─────────────────────────────
{
  const users = [
    { prenom: "Joseph", nom: "BILARDO", roles: ["Monteur"] },
    { prenom: "Marie", nom: "DUPONT", roles: ["Assistante"] },
    { prenom: "Paul", nom: "MARTIN", roles: ["Direction"] },
  ];
  const a = findAssistanteAchats(users);
  assertEq(a?.nom, "DUPONT", "Trouve assistante via rôle 'Assistante'");
}
{
  const users = [
    { prenom: "Joseph", nom: "BILARDO", fonction: "Monteur" },
    { prenom: "Marie", nom: "DUPONT", fonction: "Assistante achats" },
  ];
  const a = findAssistanteAchats(users);
  assertEq(a?.nom, "DUPONT", "Trouve assistante via ancien champ fonction");
}
assertEq(findAssistanteAchats([{ nom: "Yver", roles: ["Direction"] }]), null,
  "Pas d'assistante → null");
assertEq(findAssistanteAchats(null), null, "findAssistanteAchats résiste à null");

// ─── Test : findResponsableParc ─────────────────────────────
{
  const users = [
    { prenom: "Joseph", nom: "BILARDO", roles: ["Monteur"] },
    { prenom: "Paul", nom: "MARTIN", roles: ["Direction"] },
    { prenom: "Alex", nom: "REPARO", roles: ["Monteur"], responsableParc: true },
  ];
  const r = findResponsableParc(users);
  assertEq(r?.nom, "REPARO", "Flag responsableParc prioritaire sur Direction");
}
{
  const users = [
    { prenom: "Joseph", nom: "BILARDO", roles: ["Monteur"] },
    { prenom: "Paul", nom: "MARTIN", roles: ["Direction"] },
  ];
  const r = findResponsableParc(users);
  assertEq(r?.nom, "MARTIN", "Fallback Direction si pas de flag");
}

// ─── Test : findUserByUid ────────────────────────────────────
{
  const users = [
    { _id: "abc", nom: "A" },
    { id: "def", nom: "B" },
    { uid: "ghi", nom: "C" },
  ];
  assertEq(findUserByUid("abc", users)?.nom, "A", "findUserByUid via _id");
  assertEq(findUserByUid("def", users)?.nom, "B", "findUserByUid via id");
  assertEq(findUserByUid("ghi", users)?.nom, "C", "findUserByUid via uid");
  assertEq(findUserByUid("xxx", users), null, "findUserByUid retourne null si absent");
  assertEq(findUserByUid("", users), null, "findUserByUid résiste à uid vide");
  assertEq(findUserByUid("abc", null), null, "findUserByUid résiste à users null");
}

// ─── Récap ───────────────────────────────────────────────────
console.log("\n────────────────────────────────────────");
console.log(`Tests smsService : ${pass} OK, ${fail} KO`);
if (fail > 0) process.exit(1);

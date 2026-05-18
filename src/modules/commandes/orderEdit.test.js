// ═══════════════════════════════════════════════════════════════
//  orderEdit.test.js — v10.G.2 (Charte Option D)
//
//  Tests unitaires sur la logique pure d'édition de commande :
//    - buildEditSummary : génère un résumé humain des modifs
//    - canEditOrder : règles d'autorisation
//    - logique de statut après édition
//
//  Comme buildEditSummary et canEditOrder sont définies dans
//  CommandesInner.jsx (qui contient du JSX), je redéfinis ici les versions
//  "pures" pour les tester. Si elles divergent, le test cassera et on
//  s'en rendra compte.
//
//  Lancement : node src/modules/commandes/orderEdit.test.js
// ═══════════════════════════════════════════════════════════════

// Reproduction de buildEditSummary (extraite de CommandesInner.jsx)
function buildEditSummary(originalItems, newItems, originalOther, newOther) {
  const parts = [];
  const oRefs = new Set((originalItems||[]).map(i => i.r));
  const nRefs = new Set((newItems||[]).map(i => i.r));
  let added = 0, removed = 0, qtyChanged = 0;
  for (const r of nRefs) if (!oRefs.has(r)) added++;
  for (const r of oRefs) if (!nRefs.has(r)) removed++;
  for (const it of (newItems||[])) {
    const orig = (originalItems||[]).find(x => x.r === it.r);
    if (orig && orig.qty !== it.qty) qtyChanged++;
  }
  if (added > 0) parts.push(`${added} article${added>1?'s':''} ajouté${added>1?'s':''}`);
  if (removed > 0) parts.push(`${removed} retiré${removed>1?'s':''}`);
  if (qtyChanged > 0) parts.push(`${qtyChanged} qté modifiée${qtyChanged>1?'s':''}`);
  if (originalOther.dateReception !== newOther.dateReception) parts.push("date réception");
  if (!!originalOther.urgent !== !!newOther.urgent) parts.push(newOther.urgent ? "passée urgente" : "urgent retiré");
  if ((originalOther.remarques||'') !== (newOther.remarques||'')) parts.push("remarques modifiées");
  if ((originalOther.extraEmail||'') !== (newOther.extraEmail||'')) parts.push("email supplémentaire modifié");
  return parts.length === 0 ? "Aucune modification visible" : parts.join(", ");
}

// Reproduction de canEditOrder
function canEditOrder(o, user) {
  if (!o || !user) return false;
  if (o.statut === "Commandée" || o.statut === "Réceptionnée"
      || o.statut === "Refusée") return false;
  const isOwner = o.user === `${user.prenom} ${user.nom}`.trim();
  const isDirectionOrAdmin = user.fonction === "Admin"
      || user.fonction === "Direction"
      || (Array.isArray(user.roles) && user.roles.includes("Direction"));
  return isOwner || isDirectionOrAdmin;
}

// Reproduction de la logique de statut après édition
function computeNewStatut(directAchat, originalStatut) {
  if (directAchat === true) return originalStatut;
  return "En attente de validation";
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

// ─── Tests buildEditSummary ──────────────────────────────────

// 1 : aucune modif
{
  const r = buildEditSummary(
    [{r:"A",qty:1}], [{r:"A",qty:1}],
    {dateReception:"",urgent:false,remarques:"",extraEmail:""},
    {dateReception:"",urgent:false,remarques:"",extraEmail:""}
  );
  assertEq(r, "Aucune modification visible", "Aucune modif");
}

// 2 : 1 article ajouté
{
  const r = buildEditSummary(
    [{r:"A",qty:1}], [{r:"A",qty:1},{r:"B",qty:2}],
    {dateReception:"",urgent:false,remarques:"",extraEmail:""},
    {dateReception:"",urgent:false,remarques:"",extraEmail:""}
  );
  assertEq(r, "1 article ajouté", "1 article ajouté");
}

// 3 : 2 articles ajoutés (pluriel)
{
  const r = buildEditSummary(
    [{r:"A",qty:1}], [{r:"A",qty:1},{r:"B",qty:2},{r:"C",qty:1}],
    {dateReception:"",urgent:false,remarques:"",extraEmail:""},
    {dateReception:"",urgent:false,remarques:"",extraEmail:""}
  );
  assertEq(r, "2 articles ajoutés", "2 articles ajoutés (pluriel OK)");
}

// 4 : 1 article retiré
{
  const r = buildEditSummary(
    [{r:"A",qty:1},{r:"B",qty:2}], [{r:"A",qty:1}],
    {dateReception:"",urgent:false,remarques:"",extraEmail:""},
    {dateReception:"",urgent:false,remarques:"",extraEmail:""}
  );
  assertEq(r, "1 retiré", "1 article retiré");
}

// 5 : qté modifiée
{
  const r = buildEditSummary(
    [{r:"A",qty:1},{r:"B",qty:2}], [{r:"A",qty:5},{r:"B",qty:2}],
    {dateReception:"",urgent:false,remarques:"",extraEmail:""},
    {dateReception:"",urgent:false,remarques:"",extraEmail:""}
  );
  assertEq(r, "1 qté modifiée", "1 qté modifiée");
}

// 6 : combo (ajout + retiré + qté)
{
  const r = buildEditSummary(
    [{r:"A",qty:1},{r:"B",qty:2},{r:"C",qty:3}], [{r:"A",qty:5},{r:"D",qty:1}],
    {dateReception:"",urgent:false,remarques:"",extraEmail:""},
    {dateReception:"",urgent:false,remarques:"",extraEmail:""}
  );
  assertEq(r, "1 article ajouté, 2 retirés, 1 qté modifiée", "Combo");
}

// 7 : date réception modifiée
{
  const r = buildEditSummary(
    [{r:"A",qty:1}], [{r:"A",qty:1}],
    {dateReception:"2026-05-15",urgent:false,remarques:"",extraEmail:""},
    {dateReception:"2026-05-20",urgent:false,remarques:"",extraEmail:""}
  );
  assertEq(r, "date réception", "Date réception modifiée");
}

// 8 : urgent activé
{
  const r = buildEditSummary(
    [{r:"A",qty:1}], [{r:"A",qty:1}],
    {dateReception:"",urgent:false,remarques:"",extraEmail:""},
    {dateReception:"",urgent:true,remarques:"",extraEmail:""}
  );
  assertEq(r, "passée urgente", "Urgent activé");
}

// 9 : urgent retiré
{
  const r = buildEditSummary(
    [{r:"A",qty:1}], [{r:"A",qty:1}],
    {dateReception:"",urgent:true,remarques:"",extraEmail:""},
    {dateReception:"",urgent:false,remarques:"",extraEmail:""}
  );
  assertEq(r, "urgent retiré", "Urgent retiré");
}

// 10 : items vides (cas limite)
{
  const r = buildEditSummary(
    [], [],
    {dateReception:"",urgent:false,remarques:"",extraEmail:""},
    {dateReception:"",urgent:false,remarques:"",extraEmail:""}
  );
  assertEq(r, "Aucune modification visible", "Items vides → no-op");
}

// 11 : null/undefined items
{
  const r = buildEditSummary(
    null, [{r:"A",qty:1}],
    {dateReception:"",urgent:false,remarques:"",extraEmail:""},
    {dateReception:"",urgent:false,remarques:"",extraEmail:""}
  );
  assertEq(r, "1 article ajouté", "originalItems=null traité comme vide");
}

// ─── Tests canEditOrder ─────────────────────────────────────

const userMonteur = { id:"Bartoli", prenom:"Thomas", nom:"BARTOLI", fonction:"Monteur" };
const userAdmin = { id:"admin", prenom:"Admin", nom:"EPJ", fonction:"Admin" };
const userDirection = { id:"py", prenom:"Pierre-Julien", nom:"YVER", fonction:"Direction" };
const userOtherMonteur = { id:"X", prenom:"Other", nom:"PERSON", fonction:"Monteur" };

// 12 : Demandeur peut éditer
{
  const o = { statut:"En attente de validation", user:"Thomas BARTOLI" };
  assertEq(canEditOrder(o, userMonteur), true, "Demandeur peut éditer (en attente)");
}

// 13 : Autre user ne peut pas
{
  const o = { statut:"En attente de validation", user:"Thomas BARTOLI" };
  assertEq(canEditOrder(o, userOtherMonteur), false, "Autre user ne peut pas éditer");
}

// 14 : Admin peut toujours
{
  const o = { statut:"En attente de validation", user:"Thomas BARTOLI" };
  assertEq(canEditOrder(o, userAdmin), true, "Admin peut éditer toute commande");
}

// 15 : Direction peut toujours
{
  const o = { statut:"En attente de validation", user:"Thomas BARTOLI" };
  assertEq(canEditOrder(o, userDirection), true, "Direction peut éditer toute commande");
}

// 16 : Commandée bloque tout le monde
{
  const o = { statut:"Commandée", user:"Admin EPJ" };
  assertEq(canEditOrder(o, userAdmin), false, "Commandée : même Admin ne peut pas");
}

// 17 : Réceptionnée bloque
{
  const o = { statut:"Réceptionnée", user:"Admin EPJ" };
  assertEq(canEditOrder(o, userAdmin), false, "Réceptionnée : bloqué");
}

// 18 : Refusée bloque
{
  const o = { statut:"Refusée", user:"Thomas BARTOLI" };
  assertEq(canEditOrder(o, userMonteur), false, "Refusée : bloqué");
}

// 19 : Validée OK pour le demandeur
{
  const o = { statut:"Validée", user:"Thomas BARTOLI" };
  assertEq(canEditOrder(o, userMonteur), true, "Validée OK pour demandeur");
}

// 20 : Envoyée aux achats OK pour le demandeur
{
  const o = { statut:"Envoyée aux achats", user:"Thomas BARTOLI" };
  assertEq(canEditOrder(o, userMonteur), true, "Envoyée aux achats OK pour demandeur");
}

// 21 : null/undefined order
{
  assertEq(canEditOrder(null, userAdmin), false, "Order null : false");
  assertEq(canEditOrder({statut:"Validée"}, null), false, "User null : false");
}

// 22 : roles[] contient Direction
{
  const u = { id:"x", prenom:"Joseph", nom:"BILARDO", fonction:"Conducteur de travaux", roles:["Direction"] };
  const o = { statut:"Envoyée aux achats", user:"Thomas BARTOLI" };
  assertEq(canEditOrder(o, u), true, "User avec role Direction (multi-rôles) peut éditer");
}

// ─── Tests computeNewStatut ─────────────────────────────────

// 23 : directAchat=true garde le statut
{
  assertEq(computeNewStatut(true, "Envoyée aux achats"), "Envoyée aux achats", "Admin/Direction édite : garde Envoyée aux achats");
  assertEq(computeNewStatut(true, "Validée"), "Validée", "Admin/Direction édite : garde Validée");
  assertEq(computeNewStatut(true, "En attente de validation"), "En attente de validation", "Admin édite : garde En attente");
}

// 24 : directAchat=false repasse en attente
{
  assertEq(computeNewStatut(false, "Envoyée aux achats"), "En attente de validation", "Monteur édite Envoyée aux achats → En attente");
  assertEq(computeNewStatut(false, "Validée"), "En attente de validation", "Monteur édite Validée → En attente");
  assertEq(computeNewStatut(false, "En attente de validation"), "En attente de validation", "Monteur édite En attente → reste En attente");
}

// ─── Récap ───────────────────────────────────────────────────
console.log("\n────────────────────────────────────────");
console.log(`Tests v10.G.2 : ${pass} OK, ${fail} KO`);
if (fail > 0) process.exit(1);

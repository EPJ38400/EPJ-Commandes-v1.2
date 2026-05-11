// ═══════════════════════════════════════════════════════════════
//  orderDates.test.js — v10.J
//
//  Tests unitaires des helpers PURS de logique dates de commande.
//  Lancement : node src/modules/commandes/orderDates.test.js
// ═══════════════════════════════════════════════════════════════

// Reproduction locale des fonctions pour test (mêmes signatures)
function parseOrderDate(raw) {
  if (!raw || typeof raw !== "string") return null;
  const s = raw.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return isNaN(d.getTime()) ? null : d;
  }
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function getExpectedDeliveryDate(order, { featureFlags } = {}) {
  if (!order) return { date: null, source: null };
  if (featureFlags?.ocrArEnabled) {
    const dFournisseur = parseOrderDate(order.datelivraison);
    if (dFournisseur) return { date: dFournisseur, source: "fournisseur" };
  }
  const dSouhaitee = parseOrderDate(order.dateReception);
  if (dSouhaitee) return { date: dSouhaitee, source: "souhaitee" };
  return { date: null, source: null };
}

function isOrderLate(order, { featureFlags, today } = {}) {
  if (!order) return false;
  const st = order.statut;
  if (st === "Réceptionnée" || st === "Refusée") return false;
  if (st === "En attente de validation" || st === "Validée") return false;
  if (order.signatureData) return false;
  const { date } = getExpectedDeliveryDate(order, { featureFlags });
  if (!date) return false;
  const ref = today || new Date();
  const todayUTC = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return date.getTime() < todayUTC;
}

function computeLateOrders(orders, { featureFlags, today } = {}) {
  if (!Array.isArray(orders)) return { late: 0, lateOrders: [] };
  const lateOrders = orders.filter(o => isOrderLate(o, { featureFlags, today }));
  return { late: lateOrders.length, lateOrders };
}

let pass = 0, fail = 0;
function assertEq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log(`✓ ${label}`); pass++; }
  else { console.error(`✗ ${label}\n  attendu: ${JSON.stringify(expected)}\n  reçu:    ${JSON.stringify(actual)}`); fail++; }
}

const ref2026 = new Date(Date.UTC(2026, 4, 11)); // 11 mai 2026

// ─── parseOrderDate ────────────────────────────────────────────
assertEq(parseOrderDate("2026-05-15")?.toISOString().slice(0,10), "2026-05-15", "parseOrderDate: ISO");
assertEq(parseOrderDate("15/05/2026")?.toISOString().slice(0,10), "2026-05-15", "parseOrderDate: FR");
assertEq(parseOrderDate(""), null, "parseOrderDate: chaîne vide → null");
assertEq(parseOrderDate(null), null, "parseOrderDate: null → null");
assertEq(parseOrderDate("date pourrie"), null, "parseOrderDate: format invalide → null");
// Note : on ne teste pas les mois > 12 — JS fait du roll-over par design,
// et l'OCR Make/OpenAI ne produit jamais de mois invalides en pratique.

// ─── getExpectedDeliveryDate ───────────────────────────────────
// OCR OFF → toujours dateReception
{
  const o = { dateReception: "2026-05-20", datelivraison: "2026-05-15" };
  const r = getExpectedDeliveryDate(o, { featureFlags: { ocrArEnabled: false }});
  assertEq(r.source, "souhaitee", "OCR off → source = souhaitee");
  assertEq(r.date.toISOString().slice(0,10), "2026-05-20", "OCR off → date = souhaitée");
}
// OCR ON + datelivraison → fournisseur
{
  const o = { dateReception: "2026-05-20", datelivraison: "2026-05-15" };
  const r = getExpectedDeliveryDate(o, { featureFlags: { ocrArEnabled: true }});
  assertEq(r.source, "fournisseur", "OCR on + datelivraison → source = fournisseur");
  assertEq(r.date.toISOString().slice(0,10), "2026-05-15", "OCR on → date = fournisseur");
}
// OCR ON mais pas de datelivraison → fallback souhaitée
{
  const o = { dateReception: "2026-05-20" };
  const r = getExpectedDeliveryDate(o, { featureFlags: { ocrArEnabled: true }});
  assertEq(r.source, "souhaitee", "OCR on mais pas de datelivraison → fallback souhaitee");
}
// Aucune date du tout → null
assertEq(getExpectedDeliveryDate({}, { featureFlags: { ocrArEnabled: true }}).date, null,
  "Pas de date du tout → null");
// Order null
assertEq(getExpectedDeliveryDate(null).source, null, "Order null → source null");

// ─── isOrderLate ───────────────────────────────────────────────
// Commande Envoyée aux achats, date souhaitée dépassée → en retard
{
  const o = { statut: "Envoyée aux achats", dateReception: "2026-05-01" };
  assertEq(isOrderLate(o, { featureFlags: { ocrArEnabled: false }, today: ref2026 }), true,
    "Envoyée aux achats + date souhaitée dépassée → en retard");
}
// Commandée, date souhaitée dépassée mais date fournisseur dans le futur, OCR on → PAS en retard
{
  const o = { statut: "Commandée", dateReception: "2026-05-01", datelivraison: "2026-05-25" };
  assertEq(isOrderLate(o, { featureFlags: { ocrArEnabled: true }, today: ref2026 }), false,
    "OCR on : date fournisseur > today → pas en retard même si souhaitée dépassée");
}
// Commandée, date fournisseur dépassée, OCR on → en retard
{
  const o = { statut: "Commandée", dateReception: "2026-05-25", datelivraison: "2026-05-05" };
  assertEq(isOrderLate(o, { featureFlags: { ocrArEnabled: true }, today: ref2026 }), true,
    "OCR on : date fournisseur < today → en retard");
}
// Réceptionnée → jamais en retard
{
  const o = { statut: "Réceptionnée", dateReception: "2026-05-01" };
  assertEq(isOrderLate(o, { featureFlags: { ocrArEnabled: false }, today: ref2026 }), false,
    "Réceptionnée → jamais en retard");
}
// Refusée → jamais en retard
{
  const o = { statut: "Refusée", dateReception: "2026-05-01" };
  assertEq(isOrderLate(o, { featureFlags: { ocrArEnabled: false }, today: ref2026 }), false,
    "Refusée → jamais en retard");
}
// En attente de validation → jamais "en retard" (pas encore envoyée)
{
  const o = { statut: "En attente de validation", dateReception: "2026-05-01" };
  assertEq(isOrderLate(o, { featureFlags: { ocrArEnabled: false }, today: ref2026 }), false,
    "En attente de validation → pas en retard (pas encore envoyée)");
}
// Validée → idem
{
  const o = { statut: "Validée", dateReception: "2026-05-01" };
  assertEq(isOrderLate(o, { featureFlags: { ocrArEnabled: false }, today: ref2026 }), false,
    "Validée → pas en retard (pas encore envoyée)");
}
// signatureData posée → pas en retard
{
  const o = { statut: "Commandée", dateReception: "2026-05-01", signatureData: "data:image..." };
  assertEq(isOrderLate(o, { featureFlags: { ocrArEnabled: false }, today: ref2026 }), false,
    "Signature posée → pas en retard");
}
// Date exactement aujourd'hui → PAS en retard (strict)
{
  const o = { statut: "Commandée", dateReception: "2026-05-11" };
  assertEq(isOrderLate(o, { featureFlags: { ocrArEnabled: false }, today: ref2026 }), false,
    "Date = today → pas en retard (comparaison stricte)");
}
// Pas de date du tout → pas en retard
{
  const o = { statut: "Commandée" };
  assertEq(isOrderLate(o, { featureFlags: { ocrArEnabled: false }, today: ref2026 }), false,
    "Pas de date → pas en retard");
}

// ─── computeLateOrders ─────────────────────────────────────────
{
  const orders = [
    { num: "A", statut: "Commandée", dateReception: "2026-05-01" },          // en retard
    { num: "B", statut: "Commandée", dateReception: "2026-06-01" },          // pas en retard
    { num: "C", statut: "Réceptionnée", dateReception: "2026-05-01" },       // exclu (livrée)
    { num: "D", statut: "En attente de validation", dateReception: "2026-05-01" }, // exclu
    { num: "E", statut: "Envoyée aux achats", dateReception: "2026-04-01" }, // en retard
  ];
  const r = computeLateOrders(orders, { featureFlags: { ocrArEnabled: false }, today: ref2026 });
  assertEq(r.late, 2, "computeLateOrders : 2 commandes en retard");
  assertEq(r.lateOrders.map(o => o.num).sort(), ["A", "E"], "computeLateOrders : A et E");
}
// orders non-array
assertEq(computeLateOrders(null).late, 0, "computeLateOrders : null → 0");
assertEq(computeLateOrders(undefined).late, 0, "computeLateOrders : undefined → 0");

// ─── Récap ─────────────────────────────────────────────────────
console.log("\n────────────────────────────────────────");
console.log(`Tests orderDates v10.J : ${pass} OK, ${fail} KO`);
if (fail > 0) process.exit(1);

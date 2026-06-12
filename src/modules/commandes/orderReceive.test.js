// orderReceive.test.js v10.J - Tests purs de la logique de reception.

function normalizeQty(raw) {
  const n = Number(raw);
  if (!isFinite(n) || isNaN(n)) return 0;
  if (n < 0) return 0;
  return Math.floor(n);
}

function getReceptionKind(items, receivedByIndex) {
  if (!Array.isArray(items) || items.length === 0) return "vide";
  let to = 0, tr = 0;
  items.forEach((it, idx) => {
    to += normalizeQty(it.qty ?? it.qte);
    tr += normalizeQty(receivedByIndex && receivedByIndex[idx]);
  });
  if (tr === 0) return "vide";
  if (tr >= to) return "complete";
  return "partielle";
}

function computeReliquatItems(items, receivedByIndex) {
  if (!Array.isArray(items)) return [];
  const out = [];
  items.forEach((it, idx) => {
    const ordered = normalizeQty(it.qty ?? it.qte);
    const received = normalizeQty(receivedByIndex && receivedByIndex[idx]);
    const missing = ordered - received;
    if (missing > 0) out.push(Object.assign({}, it, { qty: missing }));
  });
  return out;
}

function validateReceivedQuantities(items, receivedByIndex) {
  const errors = [];
  if (!Array.isArray(items)) return { valid: false, errors: ["items invalide"] };
  items.forEach((it, idx) => {
    const ordered = normalizeQty(it.qty ?? it.qte);
    const received = normalizeQty(receivedByIndex && receivedByIndex[idx]);
    if (received > ordered) {
      errors.push("Ligne " + (idx + 1) + " > commande");
    }
  });
  return { valid: errors.length === 0, errors };
}

function buildReceptionPayload(order, receivedByIndex, opts) {
  if (!order) throw new Error("order requis");
  const o = opts || {};
  let effectiveReceived = receivedByIndex || {};
  if (!o.detailMode) {
    effectiveReceived = {};
    (order.items || []).forEach((it, idx) => {
      effectiveReceived[idx] = normalizeQty(it.qty ?? it.qte);
    });
  }
  const kind = getReceptionKind(order.items, effectiveReceived);
  const payload = {
    receptionParNom: o.user ? ((o.user.prenom || "") + " " + (o.user.nom || "")).trim() : "",
    dateReceptionEffective: o.todayISO || "",
    receptionDetail: o.detailMode === true,
    receptionQuantites: Object.assign({}, effectiveReceived),
  };
  if (kind === "complete") {
    payload.statut = "Réceptionnée";
  } else if (kind === "partielle") {
    payload.statut = "Réceptionnée partiellement";
    payload.reliquatItems = computeReliquatItems(order.items, effectiveReceived);
  }
  return payload;
}

let pass = 0, fail = 0;
function assertEq(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { console.log("✓ " + label); pass++; }
  else { console.error("✗ " + label + "\n  attendu: " + JSON.stringify(expected) + "\n  recu:    " + JSON.stringify(actual)); fail++; }
}

// normalizeQty
assertEq(normalizeQty(5), 5, "normalizeQty: 5 → 5");
assertEq(normalizeQty("3"), 3, "normalizeQty: '3' → 3");
assertEq(normalizeQty(-1), 0, "normalizeQty: négatif → 0");
assertEq(normalizeQty("abc"), 0, "normalizeQty: NaN → 0");
assertEq(normalizeQty(null), 0, "normalizeQty: null → 0");
assertEq(normalizeQty(undefined), 0, "normalizeQty: undefined → 0");
assertEq(normalizeQty(2.7), 2, "normalizeQty: 2.7 → 2 (floor)");

// getReceptionKind — fixtures sur `qty` (champ réel des commandes, cf. CommandesInner.jsx:858)
const items3 = [{ qty: 10 }, { qty: 5 }, { qty: 2 }];
assertEq(getReceptionKind(items3, { 0: 10, 1: 5, 2: 2 }), "complete", "kind: tout reçu");
assertEq(getReceptionKind(items3, { 0: 10, 1: 5, 2: 1 }), "partielle", "kind: 1 manquant");
assertEq(getReceptionKind(items3, { 0: 0, 1: 0, 2: 0 }), "vide", "kind: rien reçu");
assertEq(getReceptionKind(items3, {}), "vide", "kind: map vide");
assertEq(getReceptionKind([], {}), "vide", "kind: items vide");
assertEq(getReceptionKind(items3, { 0: 100 }), "complete", "kind: surplus toléré (≥ total)");

// computeReliquatItems — le reliquat doit s'écrire avec `qty` (cohérence app)
{
  const r = computeReliquatItems([{ ref: "A", qty: 10 }, { ref: "B", qty: 5 }], { 0: 7, 1: 5 });
  assertEq(r.length, 1, "reliquat: 1 ligne (B complet)");
  assertEq(r[0].ref, "A", "reliquat: ref A préservée");
  assertEq(r[0].qty, 3, "reliquat: qty = manquant");
}
{
  const r = computeReliquatItems([{ ref: "A", qty: 10 }], { 0: 10 });
  assertEq(r.length, 0, "reliquat: rien si tout reçu");
}
{
  const r = computeReliquatItems([{ ref: "A", qty: 10 }], {});
  assertEq(r[0].qty, 10, "reliquat: rien reçu → reliquat = commande entière");
}

// validateReceivedQuantities
assertEq(validateReceivedQuantities([{ qty: 5 }], { 0: 3 }).valid, true, "validate: 3<5 OK");
assertEq(validateReceivedQuantities([{ qty: 5 }], { 0: 5 }).valid, true, "validate: 5=5 OK");
assertEq(validateReceivedQuantities([{ qty: 5 }], { 0: 6 }).valid, false, "validate: 6>5 KO");
assertEq(validateReceivedQuantities([{ qty: 5 }], { 0: 6 }).errors.length, 1, "validate: 1 erreur");
assertEq(validateReceivedQuantities(null, {}).valid, false, "validate: items null → invalide");

// buildReceptionPayload — mode "tout reçu"
{
  const order = { items: [{ qty: 10 }, { qty: 5 }] };
  const p = buildReceptionPayload(order, null, { detailMode: false, user: { prenom: "PJ", nom: "YVER" }, todayISO: "2026-05-11" });
  assertEq(p.statut, "Réceptionnée", "payload: tout reçu → Réceptionnée");
  assertEq(p.receptionParNom, "PJ YVER", "payload: receptionParNom");
  assertEq(p.dateReceptionEffective, "2026-05-11", "payload: date");
  assertEq(p.receptionDetail, false, "payload: detailMode false");
  assertEq(p.reliquatItems, undefined, "payload: pas de reliquat");
}

// buildReceptionPayload — mode détaillé, partiel
{
  const order = { items: [{ ref: "A", qty: 10 }, { ref: "B", qty: 5 }] };
  const p = buildReceptionPayload(order, { 0: 7, 1: 5 }, { detailMode: true, user: { prenom: "PJ", nom: "YVER" }, todayISO: "2026-05-11" });
  assertEq(p.statut, "Réceptionnée partiellement", "payload détail: partielle");
  assertEq(p.reliquatItems.length, 1, "payload détail: 1 ligne de reliquat");
  assertEq(p.reliquatItems[0].ref, "A", "payload détail: bonne ref");
  assertEq(p.reliquatItems[0].qty, 3, "payload détail: qty = manquant");
}

// buildReceptionPayload — mode détaillé, complet
{
  const order = { items: [{ qty: 10 }, { qty: 5 }] };
  const p = buildReceptionPayload(order, { 0: 10, 1: 5 }, { detailMode: true, todayISO: "2026-05-11" });
  assertEq(p.statut, "Réceptionnée", "payload détail complet: Réceptionnée");
  assertEq(p.reliquatItems, undefined, "payload détail complet: pas de reliquat");
}

// buildReceptionPayload — mode détaillé, rien reçu = pas de statut
{
  const order = { items: [{ qty: 10 }] };
  const p = buildReceptionPayload(order, { 0: 0 }, { detailMode: true, todayISO: "2026-05-11" });
  assertEq(p.statut, undefined, "payload: rien reçu → pas de statut (annule)");
}

// ─── NON-RÉGRESSION du bug qty vs qte (cause de la réception en panne) ───
// Le champ réel est `qty` ; on garde la tolérance `qte` pour d'éventuelles
// vieilles données. Les deux noms doivent produire le même résultat.

// Régression directe : "tout reçu" sur des items `qty` doit poser le statut
// (avant le fix, qty était ignoré → kind "vide" → aucun statut → échec silencieux).
{
  const order = { items: [{ ref: "A", qty: 3 }, { ref: "B", qty: 1 }] };
  const p = buildReceptionPayload(order, null, { detailMode: false, todayISO: "2026-05-11" });
  assertEq(p.statut, "Réceptionnée", "régression qty: tout reçu pose bien le statut");
}

// Tolérance : `qte` (legacy) reste pris en charge à l'identique.
{
  const orderQty = { items: [{ qty: 10 }, { qty: 5 }] };
  const orderQte = { items: [{ qte: 10 }, { qte: 5 }] };
  assertEq(getReceptionKind(orderQty.items, { 0: 10, 1: 5 }), "complete", "tolérance: qty → complete");
  assertEq(getReceptionKind(orderQte.items, { 0: 10, 1: 5 }), "complete", "tolérance: qte → complete");
}

// validate : ordered lu depuis qty (avant le fix, ordered=0 → toute saisie >0 = KO → bouton bloqué).
assertEq(validateReceivedQuantities([{ qty: 5 }], { 0: 4 }).valid, true, "régression qty: 4<5 OK (bouton actif)");

console.log("\n────────────────────────────────────────");
console.log("Tests orderReceive v10.J : " + pass + " OK, " + fail + " KO");
if (fail > 0) process.exit(1);

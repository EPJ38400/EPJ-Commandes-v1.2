// orderReceive.js v10.J - Helpers PURS pour la reception article par article.

export function normalizeQty(raw) {
  const n = Number(raw);
  if (!isFinite(n) || isNaN(n)) return 0;
  if (n < 0) return 0;
  return Math.floor(n);
}

export function validateReceivedQuantities(items, receivedByIndex) {
  const errors = [];
  if (!Array.isArray(items)) return { valid: false, errors: ["items invalide"] };
  items.forEach((it, idx) => {
    const ordered = normalizeQty(it.qte);
    const received = normalizeQty(receivedByIndex && receivedByIndex[idx]);
    if (received > ordered) {
      errors.push("Ligne " + (idx + 1) + " (" + (it.ref || it.designation || "?") + ") : qte recue (" + received + ") > qte commandee (" + ordered + ")");
    }
  });
  return { valid: errors.length === 0, errors };
}

export function getReceptionKind(items, receivedByIndex) {
  if (!Array.isArray(items) || items.length === 0) return "vide";
  let totalOrdered = 0;
  let totalReceived = 0;
  items.forEach((it, idx) => {
    totalOrdered += normalizeQty(it.qte);
    totalReceived += normalizeQty(receivedByIndex && receivedByIndex[idx]);
  });
  if (totalReceived === 0) return "vide";
  if (totalReceived >= totalOrdered) return "complete";
  return "partielle";
}

export function computeReliquatItems(items, receivedByIndex) {
  if (!Array.isArray(items)) return [];
  const out = [];
  items.forEach((it, idx) => {
    const ordered = normalizeQty(it.qte);
    const received = normalizeQty(receivedByIndex && receivedByIndex[idx]);
    const missing = ordered - received;
    if (missing > 0) {
      out.push(Object.assign({}, it, { qte: missing }));
    }
  });
  return out;
}

export function buildReceptionPayload(order, receivedByIndex, opts) {
  if (!order) throw new Error("order requis");
  const o = opts || {};
  let effectiveReceived = receivedByIndex || {};
  if (!o.detailMode) {
    effectiveReceived = {};
    (order.items || []).forEach(function (it, idx) {
      effectiveReceived[idx] = normalizeQty(it.qte);
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

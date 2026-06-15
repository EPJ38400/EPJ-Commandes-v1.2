// outillageInterventions.test.js — Tests purs (logique SAV)
// Reproduction locale des helpers (mêmes règles que outillageInterventions.js,
// sans l'import de theme.js pour rester runnable en `node`).

const INTERVENTION_STATUTS_OUVERTS = ["signalee", "en_reparation"];
function isInterventionOuverte(it) {
  return INTERVENTION_STATUTS_OUVERTS.includes(it?.statut);
}

const INTERVENTION_TRANSITIONS = {
  signalee:      ["en_reparation", "reparee", "reformee"],
  en_reparation: ["reparee", "reformee"],
  reparee:       [],
  reformee:      [],
};
function nextInterventionStatuts(from) { return INTERVENTION_TRANSITIONS[from] || []; }
function canTransitionInterventionTo(from, to) {
  return nextInterventionStatuts(from).includes(to);
}

function buildInterventionPayload({ outil, panneIds, descriptionLibre, user, nowISO }) {
  return {
    outilId: outil?._id || "",
    outilRef: outil?.ref || "",
    outilNom: outil?.nom || "",
    panneIds: Array.isArray(panneIds) ? panneIds : [],
    descriptionLibre: (descriptionLibre || "").trim(),
    statut: "signalee",
    dateSignalement: nowISO,
    dateReparation: null,
    notes: "",
    declareePar: user?.id || "",
    declareeParNom: `${user?.prenom || ""} ${user?.nom || ""}`.trim(),
    createdAt: nowISO,
    updatedAt: nowISO,
  };
}

function outilStatutForDeclaration(pannes, selectedCodes) {
  const list = Array.isArray(pannes) ? pannes : [];
  const codes = Array.isArray(selectedCodes) ? selectedCodes : [];
  const hasBloquante = codes.some(code => {
    const p = list.find(x => x.code === code || x._id === code);
    return p?.bloquante === true;
  });
  return hasBloquante ? "hors_service" : "maintenance";
}

function buildStatusChangePayload({ newStatut, nowISO }) {
  const patch = { statut: newStatut, updatedAt: nowISO };
  if (newStatut === "reparee" || newStatut === "reformee") patch.dateReparation = nowISO;
  return patch;
}

function outilStatutAfterStatusChange({ newStatut, outilId, interventions, currentInterventionId }) {
  if (newStatut === "reformee") return "hors_service";
  if (newStatut === "reparee") {
    const autresOuvertes = (interventions || []).some(it =>
      it.outilId === outilId &&
      (it._id || it.id) !== currentInterventionId &&
      isInterventionOuverte(it)
    );
    return autresOuvertes ? null : "disponible";
  }
  return null;
}

// ─── Mini-harnais ───────────────────────────────────────────────
let ok = 0, ko = 0;
function eq(actual, expected, label) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log("✓", label); ok++; }
  else { console.log("✗", label, "\n   attendu:", e, "\n   reçu:   ", a); ko++; }
}

// ─── isInterventionOuverte ──────────────────────────────────────
eq(isInterventionOuverte({ statut: "signalee" }), true, "signalee → ouverte");
eq(isInterventionOuverte({ statut: "en_reparation" }), true, "en_reparation → ouverte");
eq(isInterventionOuverte({ statut: "reparee" }), false, "reparee → close");
eq(isInterventionOuverte({ statut: "reformee" }), false, "reformee → close");
eq(isInterventionOuverte(null), false, "null → close");

// ─── transitions ────────────────────────────────────────────────
eq(canTransitionInterventionTo("signalee", "en_reparation"), true, "signalee→en_reparation OK");
eq(canTransitionInterventionTo("signalee", "reparee"), true, "signalee→reparee OK");
eq(canTransitionInterventionTo("en_reparation", "signalee"), false, "en_reparation→signalee KO");
eq(canTransitionInterventionTo("reparee", "en_reparation"), false, "reparee figée");
eq(nextInterventionStatuts("reformee"), [], "reformee terminale");

// ─── buildInterventionPayload ───────────────────────────────────
const payload = buildInterventionPayload({
  outil: { _id: "o1", ref: "R-001", nom: "Perceuse" },
  panneIds: ["MEC"],
  descriptionLibre: "  bruit anormal  ",
  user: { id: "u1", prenom: "Jean", nom: "Dupont" },
  nowISO: "2026-06-15T10:00:00.000Z",
});
eq(payload.outilId, "o1", "payload outilId");
eq(payload.outilRef, "R-001", "payload outilRef snapshot");
eq(payload.statut, "signalee", "payload statut initial");
eq(payload.dateReparation, null, "payload dateReparation null à la création");
eq(payload.descriptionLibre, "bruit anormal", "payload description trim");
eq(payload.declareeParNom, "Jean Dupont", "payload déclarant");
eq(payload.dateSignalement, "2026-06-15T10:00:00.000Z", "payload dateSignalement");

// ─── outilStatutForDeclaration ──────────────────────────────────
const pannes = [
  { code: "MEC", libelle: "Mécanique", bloquante: false },
  { code: "SEC", libelle: "Sécurité", bloquante: true },
];
eq(outilStatutForDeclaration(pannes, ["MEC"]), "maintenance", "panne non bloquante → maintenance");
eq(outilStatutForDeclaration(pannes, ["MEC", "SEC"]), "hors_service", "une bloquante → hors_service");
eq(outilStatutForDeclaration(pannes, []), "maintenance", "aucune panne → maintenance");

// ─── buildStatusChangePayload ───────────────────────────────────
eq(buildStatusChangePayload({ newStatut: "en_reparation", nowISO: "T" }),
   { statut: "en_reparation", updatedAt: "T" }, "en_reparation : pas de dateReparation");
eq(buildStatusChangePayload({ newStatut: "reparee", nowISO: "T" }),
   { statut: "reparee", updatedAt: "T", dateReparation: "T" }, "reparee : dateReparation posée");
eq(buildStatusChangePayload({ newStatut: "reformee", nowISO: "T" }),
   { statut: "reformee", updatedAt: "T", dateReparation: "T" }, "reformee : dateReparation posée");

// ─── outilStatutAfterStatusChange ───────────────────────────────
eq(outilStatutAfterStatusChange({ newStatut: "reformee", outilId: "o1", interventions: [], currentInterventionId: "i1" }),
   "hors_service", "reformee → hors_service");
eq(outilStatutAfterStatusChange({ newStatut: "en_reparation", outilId: "o1", interventions: [], currentInterventionId: "i1" }),
   null, "en_reparation → outil inchangé");
// reparee sans autre intervention ouverte → disponible
eq(outilStatutAfterStatusChange({
  newStatut: "reparee", outilId: "o1", currentInterventionId: "i1",
  interventions: [{ _id: "i1", outilId: "o1", statut: "signalee" }],
}), "disponible", "reparee seule → disponible");
// reparee MAIS une autre intervention ouverte sur le même outil → ne pas toucher
eq(outilStatutAfterStatusChange({
  newStatut: "reparee", outilId: "o1", currentInterventionId: "i1",
  interventions: [
    { _id: "i1", outilId: "o1", statut: "signalee" },
    { _id: "i2", outilId: "o1", statut: "en_reparation" },
  ],
}), null, "reparee mais autre ouverte → outil inchangé");
// reparee, autre intervention close sur le même outil → disponible
eq(outilStatutAfterStatusChange({
  newStatut: "reparee", outilId: "o1", currentInterventionId: "i1",
  interventions: [
    { _id: "i1", outilId: "o1", statut: "signalee" },
    { _id: "i2", outilId: "o1", statut: "reparee" },
  ],
}), "disponible", "reparee, autre déjà close → disponible");
// reparee, intervention ouverte mais sur un AUTRE outil → disponible
eq(outilStatutAfterStatusChange({
  newStatut: "reparee", outilId: "o1", currentInterventionId: "i1",
  interventions: [
    { _id: "i1", outilId: "o1", statut: "signalee" },
    { _id: "i2", outilId: "o2", statut: "signalee" },
  ],
}), "disponible", "reparee, ouverte sur autre outil → disponible");

console.log("\n────────────────────────────────────────");
console.log(`Tests outillageInterventions : ${ok} OK, ${ko} KO`);
if (ko > 0) process.exit(1);

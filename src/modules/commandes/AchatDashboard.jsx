// ═══════════════════════════════════════════════════════════════
//  AchatDashboard — Écran 2 du Module Commande (front) — V2
//
//  • Bandeau 4 KPIs (KpisAchat) : écarts ouverts · montant à récupérer ·
//    top fournisseur · récupéré ce mois.
//  • Section A : AR manquants à relancer (+ Acquitter / Sans AR attendu).
//  • Section B : écarts de prix — barre de 6 filtres (FiltresBarreAchat),
//    badge de cycle de vie (Ouvert/Réclamé/Résolu), actions :
//      – Préparer brouillon IA → Cloud Function prepareAchatReclamation
//        (Claude Haiku rédige, brouillon créé dans achat@).
//      – Clôturer → Cloud Function clotureEcartAchat (Accordé/Refusé/Abandonné).
//      – Voir AR (PDF) / Voir brouillon (lien Gmail).
//  • Section C : historique des commandes par chantier (EsaboraHistory).
//
//  Lectures live : commandesEsabora + achatEcartsPrix (onSnapshot).
//  Écritures cycle de vie des écarts : via Cloud Functions (service account).
//  Écritures AR manquant (acquitte / arStatut) : client, bornées aux rules.
//  Robuste au permission-denied (états vides, pas de crash).
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { app, db } from "../../firebase";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import { EPJ, font } from "../../core/theme";
import { ModuleSubHeader } from "../../core/components/ModuleSubHeader";
import { Spinner } from "../../core/components/Spinner";
import { EsaboraHistory } from "./EsaboraHistory";
import { ArPdfLink } from "./components/ArPdfLink";
import { useIsNarrow } from "./components/useIsNarrow";
import { fmtMoney, fmtDate, fmtPct, daysSince } from "./components/esaboraFormat";
import { KpisAchat } from "./components/KpisAchat";
import { FiltresBarreAchat, FILTRES_DEFAUT } from "./components/FiltresBarreAchat";
import { EcartStatutBadge } from "./components/EcartStatutBadge";
import { EcartClotureModal } from "./components/EcartClotureModal";
import { PrepareReclamationModal } from "./components/PrepareReclamationModal";

const fns = getFunctions(app, "europe-west1");
const fnPrepareReclamation = httpsCallable(fns, "prepareAchatReclamation");
const fnClotureEcart = httpsCallable(fns, "clotureEcartAchat");

const PERIODE_LABEL = {
  "30": "sur 30 derniers jours",
  "90": "sur 90 derniers jours",
  "365": "sur 12 mois",
  ALL: "toutes périodes",
};

export function AchatDashboard({ onBack }) {
  const { user } = useAuth();
  const { chantiers = [] } = useData();
  const toast = useToast();
  const isNarrow = useIsNarrow();

  const [ce, setCe] = useState([]);
  const [ecarts, setEcarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [selectedChantier, setSelectedChantier] = useState("ALL");
  const [filters, setFilters] = useState(FILTRES_DEFAUT);

  // Modales
  const [reclamModal, setReclamModal] = useState(null);   // { ecart }
  const [reclamBusy, setReclamBusy] = useState(false);
  const [reclamResult, setReclamResult] = useState(null);
  const [reclamError, setReclamError] = useState(null);
  const [clotureModal, setClotureModal] = useState(null); // { ecart }
  const [clotureBusy, setClotureBusy] = useState(false);

  useEffect(() => {
    let gotCe = false;
    let gotEc = false;
    const done = () => { if (gotCe && gotEc) setLoading(false); };

    const unsubCe = onSnapshot(
      collection(db, "commandesEsabora"),
      (snap) => { setCe(snap.docs.map((d) => ({ _id: d.id, ...d.data() }))); gotCe = true; done(); },
      () => { setDenied(true); gotCe = true; done(); }
    );
    const unsubEc = onSnapshot(
      collection(db, "achatEcartsPrix"),
      (snap) => { setEcarts(snap.docs.map((d) => ({ _id: d.id, ...d.data() }))); gotEc = true; done(); },
      () => { setDenied(true); gotEc = true; done(); }
    );
    return () => { unsubCe(); unsubEc(); };
  }, []);

  const ceByNumero = useMemo(() => {
    const m = new Map();
    ce.forEach((c) => m.set(c.numero || c._id, c));
    return m;
  }, [ce]);

  const arManquants = useMemo(
    () => ce
      .filter((c) => c.arStatut === "MANQUANT" && !c.arAcquitte)
      .sort((a, b) => (daysSince(b.dateCommande) || 0) - (daysSince(a.dateCommande) || 0)),
    [ce]
  );

  // Options de filtres auto-alimentées par les écarts présents.
  const fournisseurOptions = useMemo(
    () => [...new Set(ecarts.map((e) => e.fournisseur).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [ecarts]
  );
  const chantierFilterOptions = useMemo(
    () => [...new Set(ecarts.map((e) => e.chantierNum).filter(Boolean))].sort((a, b) => `${a}`.localeCompare(`${b}`)),
    [ecarts]
  );

  // Prédicat de filtre (option `skipStatut` pour les KPIs cumulés).
  const passe = (e, skipStatut = false) => {
    const statut = e.statut || "OUVERT";
    if (!skipStatut && filters.statut !== "ALL" && statut !== filters.statut) return false;
    if (!matchPeriode(e, filters.periode)) return false;
    if (filters.fournisseur !== "ALL" && (e.fournisseur || "") !== filters.fournisseur) return false;
    if (filters.typeEcart !== "ALL" && ecartType(e) !== filters.typeEcart) return false;
    if (filters.chantier !== "ALL" && (e.chantierNum || "") !== filters.chantier) return false;
    const min = Number(filters.montantMin) || 0;
    if (min > 0 && Math.abs(Number(e.ecart) || 0) < min) return false;
    return true;
  };

  const filteredEcarts = useMemo(
    () => ecarts
      .filter((e) => passe(e))
      .sort((a, b) => Math.abs(Number(b.ecart) || 0) - Math.abs(Number(a.ecart) || 0)),
    [ecarts, filters]
  );

  const kpis = useMemo(() => {
    // Cartes 1-3 : base = filtres courants SAUF le statut, sous-ensemble OUVERT.
    const base = ecarts.filter((e) => passe(e, true));
    const ouverts = base.filter((e) => (e.statut || "OUVERT") === "OUVERT");
    const ouvertsMontant = ouverts.reduce((s, e) => s + Math.abs(Number(e.ecart) || 0), 0);

    const groups = {};
    ouverts.forEach((e) => {
      const f = e.fournisseur || "—";
      if (!groups[f]) groups[f] = { nom: f, count: 0, montant: 0 };
      groups[f].count += 1;
      groups[f].montant += Math.abs(Number(e.ecart) || 0);
    });
    let topFournisseur = null;
    Object.values(groups).forEach((g) => {
      if (!topFournisseur || g.count > topFournisseur.count
        || (g.count === topFournisseur.count && g.montant > topFournisseur.montant)) {
        topFournisseur = g;
      }
    });

    // Carte 4 : récupéré ce mois civil (toutes périodes), clôturé ACCORDE.
    const now = new Date();
    const recus = ecarts.filter((e) =>
      e.statut === "RESOLU" && e.clotureRaison === "ACCORDE"
      && sameMonth(e.clotureLe, now.getFullYear(), now.getMonth()));
    const recupereMoisMontant = recus.reduce((s, e) => s + Math.abs(Number(e.ecart) || 0), 0);

    return {
      ouvertsCount: ouverts.length,
      ouvertsMontant,
      topFournisseur,
      recupereMoisCount: recus.length,
      recupereMoisMontant,
      periodeLabel: PERIODE_LABEL[filters.periode] || "",
    };
  }, [ecarts, filters]);

  const chantierOptions = useMemo(
    () => [...chantiers]
      .filter((c) => c?._id)
      .sort((a, b) => `${a.num || a._id}`.localeCompare(`${b.num || b._id}`))
      .map((c) => ({ value: c._id, label: `${c.num || c._id}${c.nom ? ` — ${c.nom}` : ""}` })),
    [chantiers]
  );

  const uid = user?.uid || user?._id || null;

  const acquitter = async (numero) => {
    try {
      await setDoc(
        doc(db, "commandesEsabora", numero),
        { arAcquitte: true, arAcquitPar: uid, arAcquitLe: serverTimestamp() },
        { merge: true }
      );
      toast("✓ AR acquitté");
    } catch {
      toast("Action refusée (droits ou règles non déployées)");
    }
  };

  const sansAR = async (numero) => {
    if (!window.confirm(`Commande ${numero} : marquer « Sans AR attendu » ?\nElle sortira des relances.`)) return;
    try {
      await setDoc(doc(db, "commandesEsabora", numero), { arStatut: "SANS_AR" }, { merge: true });
      toast("✓ Marqué sans AR");
    } catch {
      toast("Action refusée (droits ou règles non déployées)");
    }
  };

  // ─── Réclamation IA ─────────────────────────────────────────
  const openReclam = (e) => {
    setReclamResult(null);
    setReclamError(null);
    setReclamModal({ ecart: e });
  };
  const doReclam = async (customEmail) => {
    if (!reclamModal?.ecart) return;
    setReclamBusy(true);
    setReclamError(null);
    try {
      const res = await fnPrepareReclamation({ ecartId: reclamModal.ecart._id, customEmail: customEmail || null });
      setReclamResult(res.data);
      toast("✓ Brouillon prêt dans achat@");
    } catch (err) {
      setReclamError(traduireErreur(err));
    } finally {
      setReclamBusy(false);
    }
  };

  // ─── Clôture ────────────────────────────────────────────────
  const doCloture = async (raison, commentaire) => {
    if (!clotureModal?.ecart) return;
    setClotureBusy(true);
    try {
      await fnClotureEcart({ ecartId: clotureModal.ecart._id, raison, commentaire: commentaire || null });
      toast("✓ Écart clôturé");
      setClotureModal(null);
    } catch (err) {
      toast(traduireErreur(err));
    } finally {
      setClotureBusy(false);
    }
  };

  return (
    <div style={{ paddingBottom: 24 }}>
      <ModuleSubHeader
        moduleName="Dashboards"
        title="Dashboard achat"
        subtitle="SUIVI ESABORA · AR FOURNISSEURS"
        onBackToModuleHome={onBack}
      />

      {denied && (
        <div
          style={{
            marginBottom: 14, padding: "10px 14px", borderRadius: 10,
            background: `${EPJ.orange}12`, border: `1px solid ${EPJ.orange}40`,
            fontSize: 12, color: EPJ.gray700,
          }}
        >
          ⚠ Données Esabora momentanément inaccessibles (règles Firestore pas encore déployées, ou accès non autorisé). Le dashboard s'allumera dès l'activation.
        </div>
      )}

      {loading ? (
        <div style={{ padding: 16 }}><Spinner label="Chargement du dashboard achat…" /></div>
      ) : (
        <>
          <KpisAchat kpis={kpis} isNarrow={isNarrow} />

          {/* Section A — AR manquants */}
          <SectionCard title="AR manquants à relancer" count={arManquants.length} accent={EPJ.red}>
            {arManquants.length === 0 ? (
              <Empty text="Aucun AR manquant. 🎉" />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {arManquants.map((c) => (
                  <ManquantRow
                    key={c._id}
                    c={c}
                    isNarrow={isNarrow}
                    onAcquitter={() => acquitter(c.numero || c._id)}
                    onSansAR={() => sansAR(c.numero || c._id)}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Section B — Écarts prix */}
          <SectionCard title="Écarts de prix" count={filteredEcarts.length} accent={EPJ.orange}>
            <FiltresBarreAchat
              value={filters}
              onChange={setFilters}
              fournisseurOptions={fournisseurOptions}
              chantierOptions={chantierFilterOptions}
            />
            {filteredEcarts.length === 0 ? (
              <Empty text={ecarts.length === 0 ? "Aucun écart de prix détecté." : "Aucun écart ne correspond aux filtres."} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {filteredEcarts.map((e) => (
                  <EcartRow
                    key={e._id}
                    e={e}
                    isNarrow={isNarrow}
                    arRef={ceByNumero.get(e.numero)?.arRef}
                    onReclamer={() => openReclam(e)}
                    onCloturer={() => setClotureModal({ ecart: e })}
                  />
                ))}
              </div>
            )}
          </SectionCard>

          {/* Section C — Historique par chantier */}
          <SectionCard title="Historique des commandes par chantier" accent={EPJ.gray700}>
            <div style={{ marginBottom: 12 }}>
              <select
                value={selectedChantier}
                onChange={(e) => setSelectedChantier(e.target.value)}
                style={{
                  width: "100%", maxWidth: 420, padding: "9px 12px",
                  borderRadius: 10, border: `1px solid ${EPJ.gray200}`,
                  fontSize: 13, color: EPJ.gray900, background: EPJ.white,
                }}
              >
                <option value="ALL">Tous les chantiers</option>
                {chantierOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <EsaboraHistory chantierNum={selectedChantier === "ALL" ? null : selectedChantier} />
          </SectionCard>
        </>
      )}

      {reclamModal && (
        <PrepareReclamationModal
          ecart={reclamModal.ecart}
          defaultEmail=""
          busy={reclamBusy}
          result={reclamResult}
          error={reclamError}
          onClose={() => setReclamModal(null)}
          onConfirm={doReclam}
        />
      )}
      {clotureModal && (
        <EcartClotureModal
          ecart={clotureModal.ecart}
          busy={clotureBusy}
          onClose={() => setClotureModal(null)}
          onConfirm={doCloture}
        />
      )}
    </div>
  );
}

// ─── Helpers de filtre ────────────────────────────────────────
function tsToMs(value) {
  if (!value) return null;
  if (typeof value === "object" && typeof value.toDate === "function") return value.toDate().getTime();
  if (typeof value === "object" && typeof value.seconds === "number") return value.seconds * 1000;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

function matchPeriode(e, periode) {
  if (periode === "ALL") return true;
  const ms = tsToMs(e.dateConstat);
  if (ms == null) return true; // pas de date de constat → on ne masque pas
  const days = (Date.now() - ms) / 86_400_000;
  return days <= Number(periode);
}

// Mappe la source price-watch sur le type d'écart (forward-compat AR↔Fact…).
function ecartType(e) {
  if (e.typeEcart) return e.typeEcart;
  if (e.source === "PRICE_WATCH") return "CMD_AR";
  return null;
}

function sameMonth(value, year, month) {
  const ms = tsToMs(value);
  if (ms == null) return false;
  const d = new Date(ms);
  return d.getFullYear() === year && d.getMonth() === month;
}

function traduireErreur(err) {
  const code = err?.code || "";
  const msg = err?.message || "Erreur inattendue.";
  if (code.includes("permission-denied")) return "Action réservée aux rôles de pilotage.";
  if (code.includes("failed-precondition")) return "Destinataire introuvable : précise l'adresse du fournisseur.";
  if (code.includes("unauthenticated")) return "Session expirée, reconnecte-toi.";
  return msg;
}

// ─── Sous-composants ──────────────────────────────────────────
function SectionCard({ title, count, accent = EPJ.gray700, children }) {
  return (
    <div
      style={{
        background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
        borderRadius: 14, padding: 16, marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <div style={{ width: 8, height: 8, borderRadius: 999, background: accent }} />
        <div style={{ fontFamily: font.display, fontSize: 18, color: EPJ.gray900 }}>{title}</div>
        {count != null && (
          <span style={{ fontSize: 12, fontWeight: 700, color: accent, background: `${accent}14`, padding: "2px 9px", borderRadius: 999 }}>
            {count}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function ManquantRow({ c, isNarrow, onAcquitter, onSansAR }) {
  const age = daysSince(c.dateCommande);
  return (
    <div
      style={{
        border: `1px solid ${EPJ.gray200}`, borderRadius: 12, padding: 12,
        display: "flex", flexDirection: isNarrow ? "column" : "row",
        alignItems: isNarrow ? "stretch" : "center", gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontFamily: font.mono, fontSize: 14 }}>{c.numero}</span>
          <span style={{ fontSize: 12, color: EPJ.gray500 }}>{fmtDate(c.dateCommande)}</span>
          {age != null && (
            <span style={{ fontSize: 11, fontWeight: 700, color: age >= 7 ? EPJ.red : EPJ.orange, background: `${age >= 7 ? EPJ.red : EPJ.orange}14`, padding: "2px 8px", borderRadius: 999 }}>
              {age} j
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: EPJ.gray700, marginTop: 4 }}>
          {(c.codeFournisseur || c.arRef?.fournisseur || "Fournisseur ?")} · <b>{fmtMoney(c.totalHT)}</b>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button onClick={onAcquitter} style={btnStyle(EPJ.blue)}>Acquitter AR</button>
        <button onClick={onSansAR} style={btnStyle(EPJ.gray500, true)}>Sans AR attendu</button>
      </div>
    </div>
  );
}

function EcartRow({ e, isNarrow, arRef, onReclamer, onCloturer }) {
  const up = (Number(e.ecart) || 0) > 0;
  const statut = e.statut || "OUVERT";
  const resolu = statut === "RESOLU";
  return (
    <div
      style={{
        border: `1px solid ${EPJ.gray200}`, borderRadius: 12, padding: 12,
        display: "flex", flexDirection: isNarrow ? "column" : "row",
        alignItems: isNarrow ? "stretch" : "center", gap: 12,
        opacity: resolu ? 0.72 : 1,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span style={{ fontWeight: 700, fontFamily: font.mono, fontSize: 13 }}>{e.numero}</span>
          <span style={{ fontSize: 12, color: EPJ.gray700 }}>{e.reference || "—"}</span>
          <span style={{ fontSize: 11, color: EPJ.gray500 }}>{e.fournisseur || ""}</span>
          <EcartStatutBadge statut={statut} size="sm" />
          {resolu && e.clotureRaison && (
            <span
              title={e.clotureCommentaire || ""}
              style={{ fontSize: 10.5, fontWeight: 700, color: EPJ.gray500, background: `${EPJ.gray500}14`, padding: "2px 7px", borderRadius: 999 }}
            >
              {RAISON_LABEL[e.clotureRaison] || e.clotureRaison}
            </span>
          )}
        </div>
        {e.designation && (
          <div style={{ fontSize: 12, color: EPJ.gray500, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={e.designation}>
            {e.designation}
          </div>
        )}
        <div style={{ fontSize: 13, color: EPJ.gray900, marginTop: 5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <span>{fmtMoney(e.prixUnitaireCommande)}</span>
          <span style={{ color: EPJ.gray300 }}>→</span>
          <span style={{ fontWeight: 700 }}>{fmtMoney(e.prixUnitaireAR)}</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: up ? EPJ.red : EPJ.green, background: `${up ? EPJ.red : EPJ.green}14`, padding: "2px 8px", borderRadius: 999 }}>
            {up ? "+" : ""}{fmtMoney(e.ecart)} ({fmtPct(e.ecartPct)})
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", alignItems: "center", justifyContent: isNarrow ? "flex-start" : "flex-end" }}>
        {!resolu && statut !== "RECLAME" && (
          <button onClick={onReclamer} style={btnStyle(EPJ.blue)}>Préparer brouillon IA</button>
        )}
        {!resolu && statut === "RECLAME" && (
          <>
            {e.reclameDraftUrl && (
              <a href={e.reclameDraftUrl} target="_blank" rel="noreferrer" style={{ ...btnStyle(EPJ.blue, true), textDecoration: "none", display: "inline-block" }}>
                Voir brouillon ↗
              </a>
            )}
            <button onClick={onReclamer} style={btnStyle(EPJ.gray500, true)}>Régénérer</button>
          </>
        )}
        {!resolu && (
          <button onClick={onCloturer} style={btnStyle(EPJ.gray900, true)}>Clôturer</button>
        )}
        <ArPdfLink refObj={arRef} />
      </div>
    </div>
  );
}

const RAISON_LABEL = { ACCORDE: "Accordé", REFUSE: "Refusé", ABANDONNE: "Abandonné" };

function btnStyle(color, ghost = false) {
  return {
    border: `1px solid ${color}${ghost ? "55" : ""}`,
    background: ghost ? `${color}10` : color,
    color: ghost ? color : "#fff",
    borderRadius: 9, padding: "8px 12px",
    fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
  };
}

function Empty({ text }) {
  return <div style={{ fontSize: 13, color: EPJ.gray500, padding: "8px 2px" }}>{text}</div>;
}

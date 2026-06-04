// ═══════════════════════════════════════════════════════════════
//  AchatDashboard — Écran 2 du Module Commande (front) — V2
//
//  • Bandeau 4 KPIs (KpisAchat) : écarts ouverts · montant à récupérer ·
//    top fournisseur · récupéré ce mois.
//  • Section A : AR manquants à relancer (+ Acquitter / Sans AR attendu).
//  • Section B : écarts de prix REGROUPÉS PAR COMMANDE (1 carte = 1 commande
//    avec ses N lignes d'écart). Barre de 6 filtres (FiltresBarreAchat),
//    statut global dérivé (Ouvert/Réclamé/Résolu), actions AU NIVEAU COMMANDE :
//      – Préparer brouillon IA → prepareAchatReclamation({ numero }) :
//        un seul mail listant toutes les lignes, brouillon créé dans achat@.
//      – Clôturer → clotureEcartAchat({ numero }) : clôture groupée.
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

  // Modales (au niveau commande)
  const [reclamModal, setReclamModal] = useState(null);   // { commande }
  const [reclamBusy, setReclamBusy] = useState(false);
  const [reclamResult, setReclamResult] = useState(null);
  const [reclamError, setReclamError] = useState(null);
  const [clotureModal, setClotureModal] = useState(null); // { commande }
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

  // Regroupement des écarts par commande (numero). Une commande = un seul
  // fournisseur (codeFournisseur) → grouper par numero suffit.
  const commands = useMemo(() => {
    const map = new Map();
    ecarts.forEach((e) => {
      const num = e.numero || "—";
      if (!map.has(num)) {
        map.set(num, { numero: num, fournisseur: e.fournisseur || null, chantierNum: e.chantierNum || null, lignes: [] });
      }
      const g = map.get(num);
      g.lignes.push(e);
      if (!g.fournisseur && e.fournisseur) g.fournisseur = e.fournisseur;
      if (!g.chantierNum && e.chantierNum) g.chantierNum = e.chantierNum;
    });
    return [...map.values()].map((g) => {
      const statuts = g.lignes.map((l) => l.statut || "OUVERT");
      let statut = "RESOLU";
      if (statuts.some((s) => s === "OUVERT")) statut = "OUVERT";
      else if (statuts.some((s) => s === "RECLAME")) statut = "RECLAME";
      const montantTotal = g.lignes.reduce((s, l) => s + Math.abs(Number(l.ecart) || 0), 0);
      const dateMax = Math.max(0, ...g.lignes.map((l) => tsToMs(l.dateConstat) || 0));
      const reclameDraftUrl = g.lignes.find((l) => l.reclameDraftUrl)?.reclameDraftUrl || null;
      const raisons = [...new Set(g.lignes.filter((l) => l.statut === "RESOLU").map((l) => l.clotureRaison).filter(Boolean))];
      const clotureRaison = statut === "RESOLU" && raisons.length === 1 ? raisons[0] : null;
      const clotureCommentaire = g.lignes.find((l) => l.clotureCommentaire)?.clotureCommentaire || null;
      return { ...g, statut, montantTotal, dateMax, reclameDraftUrl, clotureRaison, clotureCommentaire };
    });
  }, [ecarts]);

  // Options de filtres auto-alimentées par les commandes présentes.
  const fournisseurOptions = useMemo(
    () => [...new Set(commands.map((c) => c.fournisseur).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [commands]
  );
  const chantierFilterOptions = useMemo(
    () => [...new Set(commands.map((c) => c.chantierNum).filter(Boolean))].sort((a, b) => `${a}`.localeCompare(`${b}`)),
    [commands]
  );

  // Prédicat de filtre au NIVEAU COMMANDE (skipStatut pour les KPIs cumulés).
  const passeCmd = (cmd, skipStatut = false) => {
    if (!skipStatut && filters.statut !== "ALL" && cmd.statut !== filters.statut) return false;
    if (filters.periode !== "ALL" && cmd.dateMax) {
      const days = (Date.now() - cmd.dateMax) / 86_400_000;
      if (days > Number(filters.periode)) return false;
    }
    if (filters.fournisseur !== "ALL" && (cmd.fournisseur || "") !== filters.fournisseur) return false;
    if (filters.typeEcart !== "ALL" && !cmd.lignes.some((l) => ecartType(l) === filters.typeEcart)) return false;
    if (filters.chantier !== "ALL" && (cmd.chantierNum || "") !== filters.chantier) return false;
    const min = Number(filters.montantMin) || 0;
    if (min > 0 && cmd.montantTotal < min) return false;
    return true;
  };

  const filteredCommands = useMemo(
    () => commands
      .filter((c) => passeCmd(c))
      .sort((a, b) => b.montantTotal - a.montantTotal),
    [commands, filters]
  );

  const kpis = useMemo(() => {
    // Cartes 1-3 : lignes des commandes passant les filtres SAUF le statut.
    const baseLines = commands.filter((c) => passeCmd(c, true)).flatMap((c) => c.lignes);
    const ouverts = baseLines.filter((l) => (l.statut || "OUVERT") === "OUVERT");
    const ouvertsMontant = ouverts.reduce((s, l) => s + Math.abs(Number(l.ecart) || 0), 0);

    const groups = {};
    ouverts.forEach((l) => {
      const f = l.fournisseur || "—";
      if (!groups[f]) groups[f] = { nom: f, count: 0, montant: 0 };
      groups[f].count += 1;
      groups[f].montant += Math.abs(Number(l.ecart) || 0);
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
  }, [commands, ecarts, filters]);

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

  // ─── Réclamation IA (par commande) ──────────────────────────
  const openReclam = (commande) => {
    setReclamResult(null);
    setReclamError(null);
    setReclamModal({ commande });
  };
  const doReclam = async (customEmail) => {
    const numero = reclamModal?.commande?.numero;
    if (!numero) return;
    setReclamBusy(true);
    setReclamError(null);
    try {
      const res = await fnPrepareReclamation({ numero, customEmail: customEmail || null });
      setReclamResult(res.data);
      toast("✓ Brouillon prêt dans achat@");
    } catch (err) {
      setReclamError(traduireErreur(err));
    } finally {
      setReclamBusy(false);
    }
  };

  // ─── Clôture (par commande) ─────────────────────────────────
  const doCloture = async (raison, commentaire) => {
    const numero = clotureModal?.commande?.numero;
    if (!numero) return;
    setClotureBusy(true);
    try {
      await fnClotureEcart({ numero, raison, commentaire: commentaire || null });
      toast("✓ Commande clôturée");
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

          {/* Section B — Écarts prix regroupés par commande */}
          <SectionCard title="Écarts de prix par commande" count={filteredCommands.length} accent={EPJ.orange}>
            <FiltresBarreAchat
              value={filters}
              onChange={setFilters}
              fournisseurOptions={fournisseurOptions}
              chantierOptions={chantierFilterOptions}
            />
            {filteredCommands.length === 0 ? (
              <Empty text={commands.length === 0 ? "Aucun écart de prix détecté." : "Aucune commande ne correspond aux filtres."} />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredCommands.map((cmd) => (
                  <CommandCard
                    key={cmd.numero}
                    cmd={cmd}
                    isNarrow={isNarrow}
                    arRef={ceByNumero.get(cmd.numero)?.arRef}
                    onReclamer={() => openReclam(cmd)}
                    onCloturer={() => setClotureModal({ commande: cmd })}
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
          commande={reclamModal.commande}
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
          commande={clotureModal.commande}
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
  if (code.includes("failed-precondition")) return msg; // message déjà explicite (destinataire / scope)
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

// Carte = 1 commande, avec ses N lignes d'écart à l'intérieur + actions
// au niveau commande (statut global dérivé).
function CommandCard({ cmd, isNarrow, arRef, onReclamer, onCloturer }) {
  const resolu = cmd.statut === "RESOLU";
  const n = cmd.lignes.length;
  return (
    <div style={{ border: `1px solid ${EPJ.gray200}`, borderRadius: 12, padding: 12, opacity: resolu ? 0.72 : 1 }}>
      {/* En-tête commande */}
      <div style={{ display: "flex", flexDirection: isNarrow ? "column" : "row", alignItems: isNarrow ? "stretch" : "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontWeight: 700, fontFamily: font.mono, fontSize: 14 }}>{cmd.numero}</span>
            {cmd.fournisseur && <span style={{ fontSize: 12.5, color: EPJ.gray700 }}>{cmd.fournisseur}</span>}
            {cmd.chantierNum && <span style={{ fontSize: 11, color: EPJ.gray500 }}>· chantier {cmd.chantierNum}</span>}
            <EcartStatutBadge statut={cmd.statut} size="sm" />
            {resolu && cmd.clotureRaison && (
              <span
                title={cmd.clotureCommentaire || ""}
                style={{ fontSize: 10.5, fontWeight: 700, color: EPJ.gray500, background: `${EPJ.gray500}14`, padding: "2px 7px", borderRadius: 999 }}
              >
                {RAISON_LABEL[cmd.clotureRaison] || cmd.clotureRaison}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: EPJ.gray500, marginTop: 4 }}>
            {n} ligne{n > 1 ? "s" : ""} en écart · total <b style={{ color: EPJ.gray900 }}>{fmtMoney(cmd.montantTotal)}</b>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap", alignItems: "center", justifyContent: isNarrow ? "flex-start" : "flex-end" }}>
          {!resolu && cmd.statut !== "RECLAME" && (
            <button onClick={onReclamer} style={btnStyle(EPJ.blue)}>Préparer brouillon IA</button>
          )}
          {!resolu && cmd.statut === "RECLAME" && (
            <>
              {cmd.reclameDraftUrl && (
                <a href={cmd.reclameDraftUrl} target="_blank" rel="noreferrer" style={{ ...btnStyle(EPJ.blue, true), textDecoration: "none", display: "inline-block" }}>
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

      {/* Lignes d'écart de la commande */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${EPJ.gray200}` }}>
        {cmd.lignes.map((l, i) => (
          <LigneEcart key={l._id || i} l={l} />
        ))}
      </div>
    </div>
  );
}

function LigneEcart({ l }) {
  const up = (Number(l.ecart) || 0) > 0;
  const resolu = (l.statut || "OUVERT") === "RESOLU";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 12.5, color: EPJ.gray700, opacity: resolu ? 0.7 : 1 }}>
      <span style={{ fontWeight: 700, color: EPJ.gray900 }}>{l.reference || "—"}</span>
      {l.designation && (
        <span style={{ flex: 1, minWidth: 80, color: EPJ.gray500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.designation}>
          {l.designation}
        </span>
      )}
      <span>{fmtMoney(l.prixUnitaireCommande)}</span>
      <span style={{ color: EPJ.gray300 }}>→</span>
      <span style={{ fontWeight: 700 }}>{fmtMoney(l.prixUnitaireAR)}</span>
      <span style={{ fontSize: 11.5, fontWeight: 700, color: up ? EPJ.red : EPJ.green, background: `${up ? EPJ.red : EPJ.green}14`, padding: "1px 7px", borderRadius: 999 }}>
        {up ? "+" : ""}{fmtMoney(l.ecart)} ({fmtPct(l.ecartPct)})
      </span>
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

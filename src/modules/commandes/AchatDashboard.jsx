// ═══════════════════════════════════════════════════════════════
//  AchatDashboard — Écran 2 du Module Commande (front)
//  Premier dashboard de la Collection Dashboards.
//
//  • Bandeau KPI : AR manquants · écarts ouverts · montant total écarts.
//  • Section A : AR manquants à relancer (+ Acquitter / Sans AR attendu).
//  • Section B : écarts de prix à vérifier (+ Voir AR).
//  • Section C : historique des commandes par chantier (EsaboraHistory).
//
//  Lectures live : commandesEsabora + achatEcartsPrix (onSnapshot).
//  Écritures bornées (merge:true) : arAcquitte / arStatut uniquement,
//  alignées sur les Firestore rules. Robuste au permission-denied tant que
//  les rules ne sont pas déployées (affiche des états vides, pas de crash).
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
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

  const kpis = useMemo(() => {
    const montant = ecarts.reduce((s, e) => s + Math.abs(Number(e.ecart) || 0), 0);
    return {
      manquants: arManquants.length,
      ecarts: ecarts.length,
      montant,
    };
  }, [arManquants, ecarts]);

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
          {/* Bandeau KPI */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isNarrow ? "1fr" : "repeat(3, 1fr)",
              gap: 10, marginBottom: 18,
            }}
          >
            <KpiCard label="AR manquants à relancer" value={kpis.manquants} accent={EPJ.red} icon="⚠" />
            <KpiCard label="Écarts de prix ouverts" value={kpis.ecarts} accent={EPJ.orange} icon="≠" />
            <KpiCard label="Montant total des écarts" value={fmtMoney(kpis.montant)} accent={EPJ.blue} icon="€" isText />
          </div>

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
          <SectionCard title="Écarts de prix à vérifier" count={ecarts.length} accent={EPJ.orange}>
            {ecarts.length === 0 ? (
              <Empty text="Aucun écart de prix détecté." />
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {ecarts.map((e) => (
                  <EcartRow key={e._id} e={e} isNarrow={isNarrow} arRef={ceByNumero.get(e.numero)?.arRef} />
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
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────

function KpiCard({ label, value, accent, icon, isText = false }) {
  return (
    <div
      style={{
        background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
        borderLeft: `3px solid ${accent}`, borderRadius: 12,
        padding: "14px 16px", display: "flex", flexDirection: "column", gap: 4,
      }}
    >
      <div style={{ fontSize: 11, color: EPJ.gray500, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>
        {icon} {label}
      </div>
      <div style={{ fontFamily: font.display, fontSize: isText ? 24 : 30, color: accent, lineHeight: 1.1 }}>
        {value}
      </div>
    </div>
  );
}

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

function EcartRow({ e, isNarrow, arRef }) {
  const up = (Number(e.ecart) || 0) > 0;
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
          <span style={{ fontWeight: 700, fontFamily: font.mono, fontSize: 13 }}>{e.numero}</span>
          <span style={{ fontSize: 12, color: EPJ.gray700 }}>{e.reference || "—"}</span>
          <span style={{ fontSize: 11, color: EPJ.gray500 }}>{e.fournisseur || ""}</span>
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
      <div style={{ flexShrink: 0 }}>
        <ArPdfLink refObj={arRef} />
      </div>
    </div>
  );
}

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

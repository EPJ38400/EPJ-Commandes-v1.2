// ═══════════════════════════════════════════════════════════════
//  EsaboraHistory — Écran 1 du Module Commande (front)
//  Historique unifié des commandes (origine APP | ESABORA) pour un
//  chantier donné, ou toutes commandes si chantierNum est null.
//
//  Lecture seule. Composant réutilisable : monté dans le Dashboard achat
//  (V1) et branchable plus tard dans la fiche chantier.
//  Source : collection Firestore commandesEsabora (écrite par les Cloud
//  Functions). Tri par dateCommande décroissante côté client (pas d'index
//  composite requis).
// ═══════════════════════════════════════════════════════════════
import { Fragment, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font } from "../../core/theme";
import { Spinner } from "../../core/components/Spinner";
import { ArStatusBadge } from "./components/ArStatusBadge";
import { ArPdfLink } from "./components/ArPdfLink";
import { useIsNarrow } from "./components/useIsNarrow";
import { fmtMoney, fmtDate, fmtDateOrRaw, deriveLivraison, ORIGINE_META, resolveArPieces } from "./components/esaboraFormat";

const FILTERS = [
  { key: "all", label: "Tous" },
  { key: "APP", label: "Origine App" },
  { key: "ESABORA", label: "Origine Esabora" },
  { key: "MANQUANT", label: "AR manquant" },
  { key: "ECART", label: "Avec écart" },
];

// Colonnes : chevron · N° · Date · Fournisseur · Total HT · État · Origine ·
// AR · Livraison (dérivée) · Actions.
const GRID = "26px 84px 92px minmax(120px,1fr) 110px minmax(100px,1fr) 96px 110px minmax(130px,1fr) 80px";
// Largeur mini sous laquelle le tableau scrolle horizontalement (somme des
// colonnes fixes/min + gaps) — évite le troncage des colonnes de droite sur
// desktop dans un conteneur étroit.
const TABLE_MIN_WIDTH = 1080;

export function EsaboraHistory({ chantierNum = null }) {
  const isNarrow = useIsNarrow();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);
  const toggleExpand = (id) => setExpandedId((cur) => (cur === id ? null : id));

  useEffect(() => {
    setLoading(true);
    setError(null);
    const col = collection(db, "commandesEsabora");
    const q = chantierNum ? query(col, where("chantierNum", "==", chantierNum)) : col;
    const unsub = onSnapshot(
      q,
      (snap) => {
        setRows(snap.docs.map((d) => ({ _id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        // permission-denied tant que les rules ne sont pas déployées.
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [chantierNum]);

  const visible = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const da = a.dateCommande ? new Date(a.dateCommande).getTime() : 0;
      const dbb = b.dateCommande ? new Date(b.dateCommande).getTime() : 0;
      return dbb - da;
    });
    return sorted.filter((r) => {
      if (filter === "APP") return r.origine === "APP";
      if (filter === "ESABORA") return r.origine === "ESABORA";
      if (filter === "MANQUANT") return r.arStatut === "MANQUANT";
      if (filter === "ECART") return (r.nbLignesEnEcart || 0) > 0;
      return true;
    });
  }, [rows, filter]);

  if (loading) {
    return (
      <div style={{ padding: 16 }}>
        <Spinner label="Chargement de l'historique…" />
      </div>
    );
  }

  if (error) {
    return <NoticeBox kind="error" text="Données Esabora non accessibles (règles Firestore pas encore déployées, ou accès refusé)." />;
  }

  return (
    <div>
      {/* Filtre */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                fontSize: 12,
                fontWeight: 600,
                padding: "6px 12px",
                borderRadius: 999,
                border: `1px solid ${active ? EPJ.gray900 : EPJ.gray200}`,
                background: active ? EPJ.gray900 : EPJ.white,
                color: active ? "#fff" : EPJ.gray700,
                cursor: "pointer",
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <NoticeBox kind="empty" text="Aucune commande Esabora pour ce filtre." />
      ) : isNarrow ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {visible.map((r) => (
            <CardRow key={r._id} r={r} expanded={expandedId === r._id} onToggle={() => toggleExpand(r._id)} />
          ))}
        </div>
      ) : (
        <div style={{ border: `1px solid ${EPJ.gray200}`, borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <div style={{ minWidth: TABLE_MIN_WIDTH }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: GRID,
                  gap: 8,
                  padding: "10px 12px",
                  background: EPJ.gray50,
                  fontSize: 11,
                  fontWeight: 700,
                  color: EPJ.gray500,
                  textTransform: "uppercase",
                  letterSpacing: 0.4,
                }}
              >
                <div /><div>N°</div><div>Date</div><div>Fournisseur</div><div>Total HT</div>
                <div>État</div><div>Origine</div><div>AR</div><div>Livraison</div><div>Actions</div>
              </div>
              {visible.map((r) => (
                <Fragment key={r._id}>
                  <TableRow r={r} expanded={expandedId === r._id} onToggle={() => toggleExpand(r._id)} />
                  {expandedId === r._id && <DetailLignes r={r} />}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function fournisseurLabel(r) {
  return r.codeFournisseur || r.arRef?.fournisseur || "—";
}

function OrigineCell({ r }) {
  const meta = ORIGINE_META[r.origine] || ORIGINE_META.ESABORA;
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
          background: `${meta.color}1A`, color: meta.color, width: "fit-content",
        }}
      >
        {meta.label}
      </span>
      {r.origine === "APP" && r.appCommandeNum && (
        <span style={{ fontSize: 10, color: EPJ.gray500 }}>{r.appCommandeNum}</span>
      )}
    </span>
  );
}

function TableRow({ r, expanded, onToggle }) {
  const liv = deriveLivraison(r);
  return (
    <div
      onClick={onToggle}
      style={{
        display: "grid",
        gridTemplateColumns: GRID,
        gap: 8,
        padding: "11px 12px",
        borderTop: `1px solid ${EPJ.gray100}`,
        fontSize: 13,
        color: EPJ.gray900,
        alignItems: "center",
        cursor: "pointer",
        background: expanded ? EPJ.gray50 : undefined,
      }}
    >
      <div style={{ color: EPJ.gray400, fontSize: 12, textAlign: "center" }}>{expanded ? "▾" : "▸"}</div>
      <div style={{ fontWeight: 700, fontFamily: font.mono }}>{r.numero}</div>
      <div style={{ color: EPJ.gray700 }}>{fmtDate(r.dateCommande)}</div>
      <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={fournisseurLabel(r)}>
        {fournisseurLabel(r)}
      </div>
      <div style={{ fontVariantNumeric: "tabular-nums" }}>{fmtMoney(r.totalHT)}</div>
      <div style={{ color: EPJ.gray700, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.etat || ""}>
        {r.etat || "—"}
      </div>
      <div><OrigineCell r={r} /></div>
      <div><ArStatusBadge statut={r.arStatut} acquitte={r.arAcquitte} size="sm" /></div>
      <div style={{ fontSize: 12, color: liv.min ? EPJ.gray900 : EPJ.gray500, fontStyle: liv.min ? "normal" : "italic", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={liv.label}>
        {liv.label}
      </div>
      <div onClick={(e) => e.stopPropagation()}><ArPdfLink pieces={resolveArPieces(r)} /></div>
    </div>
  );
}

// Panneau détail (déplié) : dates de livraison par ligne AR.
function DetailLignes({ r }) {
  const lignes = Array.isArray(r.lignesAR) ? r.lignesAR : [];
  const liv = deriveLivraison(r);
  return (
    <div style={{ borderTop: `1px solid ${EPJ.gray100}`, background: EPJ.gray50, padding: "10px 14px 14px 48px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: EPJ.gray500, textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 8 }}>
        Livraison prévue : <span style={{ color: liv.min ? EPJ.gray900 : EPJ.gray500 }}>{liv.label}</span>
      </div>
      {lignes.length === 0 ? (
        <div style={{ fontSize: 12.5, color: EPJ.gray500 }}>
          {r.arStatut === "RECU" ? "Aucune ligne d'AR enregistrée." : "Lignes disponibles après réception de l'AR."}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {lignes.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: EPJ.gray700, flexWrap: "wrap" }}>
              <span style={{ fontWeight: 700, fontFamily: font.mono, color: EPJ.gray900, minWidth: 90 }}>{l.reference || "—"}</span>
              <span style={{ flex: 1, minWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.designation || ""}>
                {l.designation || "—"}
              </span>
              {l.quantite != null && <span style={{ color: EPJ.gray500 }}>qté {l.quantite}{l.unite ? ` ${l.unite}` : ""}</span>}
              <span style={{ fontWeight: 600, color: l.dateLivraisonPrevue ? EPJ.gray900 : EPJ.gray400 }}>
                livr. {l.dateLivraisonPrevue ? fmtDateOrRaw(l.dateLivraisonPrevue) : "—"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CardRow({ r, expanded, onToggle }) {
  const liv = deriveLivraison(r);
  const lignes = Array.isArray(r.lignesAR) ? r.lignesAR : [];
  const Line = ({ k, children }) => (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13 }}>
      <span style={{ color: EPJ.gray500, fontSize: 11, fontWeight: 600 }}>{k}</span>
      <span style={{ textAlign: "right", minWidth: 0 }}>{children}</span>
    </div>
  );
  return (
    <div style={{ border: `1px solid ${EPJ.gray200}`, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontWeight: 700, fontFamily: font.mono, fontSize: 14 }}>{r.numero}</span>
        <ArStatusBadge statut={r.arStatut} acquitte={r.arAcquitte} size="sm" />
      </div>
      <Line k="Date">{fmtDate(r.dateCommande)}</Line>
      <Line k="Fournisseur">{fournisseurLabel(r)}</Line>
      <Line k="Total HT"><b>{fmtMoney(r.totalHT)}</b></Line>
      <Line k="État">{r.etat || "—"}</Line>
      <Line k="Origine"><OrigineCell r={r} /></Line>
      <Line k="Livraison">
        <span style={{ color: liv.min ? EPJ.gray900 : EPJ.gray500, fontStyle: liv.min ? "normal" : "italic" }}>{liv.label}</span>
      </Line>
      <Line k="AR"><ArPdfLink pieces={resolveArPieces(r)} /></Line>

      <button
        onClick={onToggle}
        style={{ marginTop: 2, alignSelf: "flex-start", background: "none", border: "none", color: EPJ.blue, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0 }}
      >
        {expanded ? "Masquer le détail ▴" : "Détail lignes ▾"}
      </button>
      {expanded && (
        <div style={{ borderTop: `1px solid ${EPJ.gray100}`, paddingTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          {lignes.length === 0 ? (
            <div style={{ fontSize: 12, color: EPJ.gray500 }}>
              {r.arStatut === "RECU" ? "Aucune ligne d'AR enregistrée." : "Lignes disponibles après réception de l'AR."}
            </div>
          ) : (
            lignes.map((l, i) => (
              <div key={i} style={{ fontSize: 12.5, color: EPJ.gray700 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontFamily: font.mono, color: EPJ.gray900 }}>{l.reference || "—"}</span>
                  <span style={{ fontWeight: 600, color: l.dateLivraisonPrevue ? EPJ.gray900 : EPJ.gray400 }}>
                    livr. {l.dateLivraisonPrevue ? fmtDateOrRaw(l.dateLivraisonPrevue) : "—"}
                  </span>
                </div>
                {l.designation && (
                  <div style={{ fontSize: 11.5, color: EPJ.gray500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.designation}>
                    {l.designation}{l.quantite != null ? ` · qté ${l.quantite}${l.unite ? ` ${l.unite}` : ""}` : ""}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function NoticeBox({ kind, text }) {
  const c = kind === "error" ? EPJ.red : EPJ.gray500;
  return (
    <div
      style={{
        background: kind === "error" ? `${EPJ.red}0A` : EPJ.gray50,
        border: `1px solid ${kind === "error" ? `${EPJ.red}30` : EPJ.gray200}`,
        borderRadius: 12, padding: 18, textAlign: "center",
        fontSize: 13, color: c,
      }}
    >
      {text}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  SuiviCommandesTab — contenu de l'onglet « Suivi commandes » (M5)
//
//  • Source liste : useData().commandes (listener global DataContext déjà
//    actif — on le RÉUTILISE, aucun nouveau listener). Filtre client :
//    c.chantierNum === chantier.num (n° 6 chiffres). Tri client par `date`
//    "JJ/MM/AAAA" parsée → Date, décroissant, SUR UNE COPIE.
//  • Colonne « Réception prévue » : date de livraison AR par ligne, bâtie
//    depuis commandesEsabora via UN getDocs scopé chantierNum (pas de
//    listener permanent, pas de prix, pas de section). Lien EXACT par
//    commande (appCommandeId puis appCommandeNum) et appariement de lignes
//    UNIQUEMENT si lignesAR.length === lignesCommande.length (anti-date-fausse).
//  • Liste (1 ligne/commande, dépliable) + détail tableau items.
//
//  100 % LECTURE SEULE : aucune écriture Firestore. `chantiers` lu via la
//  prop seulement. Mapping statut→couleur via <Badge>. Aucun import de
//  CommandesInner. Aucune logique de droits.
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useData } from "../../core/DataContext";
import { useViewport } from "../../core/useViewport";
import { Badge } from "../../core/components/Badge";

// État de synchro Esabora → libellé doux lecture seule.
function esaboraLabel(status) {
  if (status === "synced") return "synchronisée";
  if (status === "pending") return "en cours";
  return "—";
}

// Date de livraison AR → "JJ/MM/AAAA". Accepte ISO "AAAA-MM-JJ", déjà
// "JJ/MM/AAAA", ou Timestamp Firestore. Format inattendu → null (jamais
// de date approchée).
function fmtLivr(v) {
  if (!v) return null;
  if (typeof v === "object" && typeof v.toDate === "function") {
    const d = v.toDate();
    if (!d || isNaN(d)) return null;
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);     // ISO AAAA-MM-JJ
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);       // déjà JJ/MM/AAAA
  if (m) return s;
  return null;
}

export function SuiviCommandesTab({ chantier }) {
  const { commandes } = useData();
  const isPwa = useViewport() === "mobile";
  const [openId, setOpenId] = useState(null);
  // Cartes de dates AR par référence, indexées par lien vers la commande app.
  const [arDates, setArDates] = useState({ byId: {}, byNum: {} });
  // Commandes passées DIRECTEMENT dans Esabora (hors app) pour ce chantier.
  const [esaboraDirects, setEsaboraDirects] = useState([]);

  // Commandes de l'app rattachées à ce chantier (filtre sur une COPIE).
  const appRows = useMemo(
    () => (commandes || []).filter((c) => c.chantierNum === chantier.num),
    [commandes, chantier.num],
  );

  // Affichage : commandes app + commandes Esabora-directes, tri par date desc.
  const allRows = useMemo(
    () => [...appRows, ...esaboraDirects]
      .sort((a, b) => String(b._dateSort || b.date || "").localeCompare(String(a._dateSort || a.date || ""))),
    [appRows, esaboraDirects],
  );

  // Lecture seule one-shot de commandesEsabora (scopé chantier) → map de dates.
  // Pas de listener permanent : ces dates servent uniquement à remplir la
  // colonne « Réception prévue ».
  useEffect(() => {
    let alive = true;
    const q = query(collection(db, "commandesEsabora"), where("chantierNum", "==", chantier.num));
    getDocs(q)
      .then((snap) => {
        if (!alive) return;
        const byId = {};
        const byNum = {};
        const directs = [];
        snap.forEach((d) => {
          const e = d.data();
          const lc = e.lignesCommande;
          const la = e.lignesAR;
          // (a) Commandes LIÉES à l'app → alimentent la map de dates AR.
          //     Anti-date-fausse : on n'apparie QUE si les deux listes existent
          //     et ont strictement la même longueur (correspondance positionnelle).
          if (Array.isArray(la) && Array.isArray(lc) && la.length === lc.length) {
            const entries = {};
            for (let i = 0; i < lc.length; i++) {
              const ref = lc[i]?.reference;
              if (ref == null) continue;
              entries[ref] = la[i]?.dateLivraisonPrevue || null;
            }
            // Une commande app peut être scindée en plusieurs docs Esabora (par
            // fournisseur) partageant le même appCommandeId → on fusionne.
            if (e.appCommandeId) byId[e.appCommandeId] = { ...(byId[e.appCommandeId] || {}), ...entries };
            if (e.appCommandeNum) byNum[e.appCommandeNum] = { ...(byNum[e.appCommandeNum] || {}), ...entries };
          }
          // (b) Commandes passées DIRECTEMENT dans Esabora (aucun lien app) →
          //     mappées au format d'affichage (dates AR portées par le doc).
          if (!e.appCommandeId && !e.appCommandeNum) {
            directs.push({
              id: e.numero,
              num: e.numero,
              statut: e.etat || "Commandée",
              date: e.dateCommande ? new Date(e.dateCommande).toLocaleDateString("fr-FR") : "—",
              _dateSort: e.dateCommande || "",
              items: (e.lignesCommande || []).map((l) => ({
                r: l.reference, n: l.designation, qty: l.quantite, u: l.unite,
              })),
              source: "esabora",
              _refDates: Object.fromEntries(
                (e.lignesAR || []).map((l) => [l.reference, l.dateLivraisonPrevue || null]),
              ),
            });
          }
        });
        setArDates({ byId, byNum });
        setEsaboraDirects(directs);
      })
      .catch((err) => {
        // Pas de blocage : sans dates AR, la colonne affiche « — ».
        console.error("[SuiviCommandesTab] lecture commandesEsabora échouée :", err);
      });
    return () => { alive = false; };
  }, [chantier.num]);

  if (allRows.length === 0) {
    return (
      <div style={{
        background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
        borderRadius: radius.lg, padding: space.xl, textAlign: "center",
      }}>
        <div style={{ fontSize: 32, marginBottom: space.sm }}>📦</div>
        <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, lineHeight: 1.5 }}>
          Aucune commande rattachée à ce chantier.
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
      <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, marginBottom: space.xs }}>
        {allRows.length} commande{allRows.length > 1 ? "s" : ""}
      </div>
      {allRows.map((o) => (
        <CommandeRow
          key={o.id || o.num}
          order={o}
          isPwa={isPwa}
          refDates={o.source === "esabora" ? (o._refDates || null) : (arDates.byId[o.id] || arDates.byNum[o.num] || null)}
          open={openId === (o.id || o.num)}
          onToggle={() => setOpenId((k) => (k === (o.id || o.num) ? null : (o.id || o.num)))}
        />
      ))}
    </div>
  );
}

function CommandeRow({ order, isPwa, refDates, open, onToggle }) {
  const items = Array.isArray(order.items) ? order.items : [];
  const nbItems = items.length;

  return (
    <div style={{
      background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
      borderRadius: radius.lg, overflow: "hidden",
    }}>
      {/* ─── En-tête cliquable (repli/dépli) ─── */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
        style={{
          display: "flex", alignItems: "flex-start", gap: space.md,
          padding: space.lg, cursor: "pointer",
        }}
      >
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: space.xs }}>
          {/* Ligne 1 : num + badges + nb articles */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: space.sm }}>
            <span style={{
              fontFamily: font.body, fontSize: fontSize.md, fontWeight: fontWeight.semibold,
              color: EPJ.gray900, fontVariantNumeric: "tabular-nums",
            }}>
              {order.num || "—"}
            </span>
            <Badge status={order.statut} />
            {order.source === "esabora" && <Badge tone="neutral" label="Esabora" />}
            {order.createdBySplit === true && (
              <Badge tone="neutral" label={`scindée — ${order.parentOrderNum || "?"}`} />
            )}
            {order.urgent === true && <Badge tone="urgent" label="Urgent" dot />}
            <span style={{ fontSize: fontSize.xs, color: EPJ.gray500, fontVariantNumeric: "tabular-nums" }}>
              {nbItems} article{nbItems > 1 ? "s" : ""}
            </span>
          </div>
          {/* Ligne 2 : dates */}
          <div style={{ fontSize: fontSize.xs, color: EPJ.gray600, fontVariantNumeric: "tabular-nums" }}>
            {order.date || "—"}
            {" · réception souhaitée "}{order.dateReception || "—"}
            {order.dateReceptionEffective ? ` · reçue ${order.dateReceptionEffective}` : ""}
          </div>
          {/* Ligne 3 : livraison + Esabora */}
          <div style={{ fontSize: fontSize.xs, color: EPJ.gray500 }}>
            Livraison : {order.livraison || "—"}
            {" · Esabora : "}{esaboraLabel(order.esaboraStatus)}
          </div>
        </div>
        <span aria-hidden style={{
          fontSize: fontSize.sm, color: EPJ.gray400, marginTop: 2,
          transition: "transform .15s ease", transform: open ? "rotate(90deg)" : "none",
        }}>
          ▸
        </span>
      </div>

      {/* ─── Détail dépliable : tableau items (SANS PRIX) ─── */}
      {open && (
        <div style={{ borderTop: `1px solid ${EPJ.gray100}`, padding: space.lg, background: EPJ.gray50 }}>
          {nbItems === 0 ? (
            <div style={{ fontSize: fontSize.sm, color: EPJ.gray500, textAlign: "center", padding: space.md }}>
              Aucun article sur cette commande.
            </div>
          ) : isPwa ? (
            <ItemCards items={items} refDates={refDates} />
          ) : (
            <ItemTable items={items} refDates={refDates} />
          )}
        </div>
      )}
    </div>
  );
}

// Date de réception prévue d'un article (réf == lignesCommande[].reference).
// Absente / pas d'AR / longueurs différentes → null → "—".
function recPrevue(refDates, ref) {
  if (!refDates) return null;
  return fmtLivr(refDates[ref]);
}

// ─── Desktop : tableau items ───
function ItemTable({ items, refDates }) {
  const th = {
    textAlign: "left", padding: `${space.sm}px ${space.md}px`,
    fontSize: fontSize.xs, fontWeight: fontWeight.medium, color: EPJ.gray500,
    borderBottom: `2px solid ${EPJ.gray200}`, whiteSpace: "nowrap",
  };
  const td = {
    padding: `${space.sm}px ${space.md}px`, fontSize: fontSize.sm,
    color: EPJ.gray900, borderBottom: `1px solid ${EPJ.gray100}`, verticalAlign: "top",
  };
  return (
    <div style={{ background: EPJ.white, border: `1px solid ${EPJ.gray200}`, borderRadius: radius.md, overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font.body }}>
        <thead>
          <tr>
            <th style={th}>Réf</th>
            <th style={th}>Désignation</th>
            <th style={th}>Catégorie</th>
            <th style={th}>Sous-cat.</th>
            <th style={{ ...th, textAlign: "right" }}>Qté</th>
            <th style={th}>Unité</th>
            <th style={th}>Réception prévue</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={it.r || i}>
              <td style={{ ...td, fontFamily: font.mono, color: EPJ.blueText, whiteSpace: "nowrap" }}>{it.r || "—"}</td>
              <td style={td}>{it.n || "—"}</td>
              <td style={{ ...td, color: EPJ.gray600 }}>{it.c || "—"}</td>
              <td style={{ ...td, color: EPJ.gray600 }}>{it.s || "—"}</td>
              <td style={{ ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: fontWeight.medium }}>{it.qty ?? "—"}</td>
              <td style={{ ...td, color: EPJ.gray600 }}>{it.u || "Pièce"}</td>
              <td style={{ ...td, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{recPrevue(refDates, it.r) || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── PWA : cartes items ───
function ItemCards({ items, refDates }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
      {items.map((it, i) => {
        const liv = recPrevue(refDates, it.r);
        return (
          <div key={it.r || i} style={{
            background: EPJ.white, border: `1px solid ${EPJ.gray200}`,
            borderRadius: radius.md, padding: space.md,
            display: "flex", flexDirection: "column", gap: space.xs,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: space.md, alignItems: "baseline" }}>
              <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900 }}>{it.n || "—"}</span>
              <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.semibold, color: EPJ.blueText, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                ×{it.qty ?? "—"} {it.u || "Pièce"}
              </span>
            </div>
            <div style={{ fontSize: fontSize.xs, color: EPJ.blueText, fontFamily: font.mono }}>{it.r || "—"}</div>
            {(it.c || it.s) && (
              <div style={{ fontSize: fontSize.xs, color: EPJ.gray500 }}>
                {[it.c, it.s].filter(Boolean).join(" · ")}
              </div>
            )}
            <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, fontVariantNumeric: "tabular-nums" }}>
              Réception prévue : {liv || "—"}
            </div>
          </div>
        );
      })}
    </div>
  );
}

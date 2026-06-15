// ═══════════════════════════════════════════════════════════════
//  SuiviCommandesTab — contenu de l'onglet « Suivi commandes » (M5)
//
//  • Source : useData().commandes (listener global DataContext déjà
//    actif — on le RÉUTILISE, aucun nouveau onSnapshot/read/index).
//    Filtre client : c.chantierNum === chantier.num (n° 6 chiffres).
//  • Tri client par `date` "JJ/MM/AAAA" parsée → Date, décroissant,
//    SUR UNE COPIE (jamais de mutation de useData().commandes).
//  • Liste (1 ligne/commande, dépliable) + détail tableau items.
//
//  100 % LECTURE SEULE : aucune écriture Firestore, aucune action qui
//  écrit. `chantiers` lu via la prop seulement. Mapping statut→couleur
//  réutilisé via <Badge> (source unique). Aucun import de CommandesInner.
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useData } from "../../core/DataContext";
import { useViewport } from "../../core/useViewport";
import { Badge } from "../../core/components/Badge";

// "JJ/MM/AAAA" → timestamp (ms). Invalide/vide → 0 (rejeté en bas du tri).
function parseFrDate(s) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s || "").trim());
  return m ? new Date(+m[3], +m[2] - 1, +m[1]).getTime() : 0;
}

// État de synchro Esabora → libellé doux lecture seule.
function esaboraLabel(status) {
  if (status === "synced") return "synchronisée";
  if (status === "pending") return "en cours";
  return "—";
}

export function SuiviCommandesTab({ chantier }) {
  const { commandes } = useData();
  const isPwa = useViewport() === "mobile";
  const [openId, setOpenId] = useState(null);

  // Filtre + tri sur une COPIE (Array.prototype.filter renvoie déjà un
  // nouveau tableau → sort() ne mute pas useData().commandes).
  const rows = useMemo(() => {
    return (commandes || [])
      .filter((c) => c.chantierNum === chantier.num)
      .sort((a, b) => parseFrDate(b.date) - parseFrDate(a.date));
  }, [commandes, chantier.num]);

  if (rows.length === 0) {
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
        {rows.length} commande{rows.length > 1 ? "s" : ""}
      </div>
      {rows.map((o) => (
        <CommandeRow
          key={o.id || o.num}
          order={o}
          isPwa={isPwa}
          open={openId === (o.id || o.num)}
          onToggle={() => setOpenId((k) => (k === (o.id || o.num) ? null : (o.id || o.num)))}
        />
      ))}
    </div>
  );
}

function CommandeRow({ order, isPwa, open, onToggle }) {
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
            <ItemCards items={items} />
          ) : (
            <ItemTable items={items} />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Desktop : tableau items ───
function ItemTable({ items }) {
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── PWA : cartes items ───
function ItemCards({ items }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
      {items.map((it, i) => (
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
        </div>
      ))}
    </div>
  );
}

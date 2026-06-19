// ═══════════════════════════════════════════════════════════════
//  SmsHistoryPage — historique des SMS (lecture seule, Admin/Direction)
//
//  Lit les 200 derniers docs smsQueue (orderBy createdAt desc). Filtrage
//  100 % CÔTÉ CLIENT (statut / module / destinataire) → aucun index
//  composite. Aucune écriture. Garde de rôle locale (pas de nouvelle clé
//  permissions.js). NB : le balayage `sweepSentSmsQueue` (functions) purge
//  les SMS `sent` → l'historique montre surtout pending/failed + envois
//  récents non encore balayés.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import { Badge } from "../../core/components/Badge";

const STATUT_OPTIONS = [
  { value: "tous", label: "Tous les statuts" },
  { value: "sent", label: "Envoyés" },
  { value: "failed", label: "Échoués" },
  { value: "pending", label: "En attente" },
];
const STATUT_BADGE = {
  sent:    { tone: "success", label: "Envoyé" },
  failed:  { tone: "danger",  label: "Échoué" },
  pending: { tone: "neutral", label: "En attente" },
};

// Module d'un SMS : context.module si présent, sinon préfixe du templateCode.
function moduleOf(s) {
  if (s.context?.module) return s.context.module;
  const code = s.templateCode || "";
  if (code.startsWith("planning")) return "planning";
  if (code.startsWith("commande")) return "commandes";
  if (code.startsWith("outillage")) return "parc-machines";
  if (code.startsWith("reserve")) return "reserves";
  return code ? code.split("_")[0] : "—";
}

function fmtDate(ts) {
  if (!ts) return "—";
  const d = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function SmsHistoryPage({ onBack }) {
  const { user } = useAuth();
  const authorized = (user?.roles || []).some((r) => ["Admin", "Direction"].includes(r));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statut, setStatut] = useState("tous");
  const [mod, setMod] = useState("tous");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const snap = await getDocs(query(
        collection(db, "smsQueue"), orderBy("createdAt", "desc"), limit(200),
      ));
      setRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error("[SmsHistoryPage] lecture smsQueue échouée :", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (authorized) load(); else setLoading(false); }, [authorized, load]);

  const moduleOptions = useMemo(() => {
    const mods = new Set(rows.map(moduleOf));
    return [{ value: "tous", label: "Tous les modules" }, ...[...mods].sort().map((m) => ({ value: m, label: m }))];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((s) => {
      if (statut !== "tous" && (s.status || "pending") !== statut) return false;
      if (mod !== "tous" && moduleOf(s) !== mod) return false;
      if (q) {
        const hay = `${s.recipientName || ""} ${s.recipientPhone || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statut, mod, search]);

  if (!authorized) {
    return (
      <div style={{ paddingTop: 20 }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: EPJ.gray500 }}>Accès réservé à la Direction et l'administration.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ paddingTop: 20, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: space.sm, marginBottom: space.md }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 400, color: EPJ.gray900, letterSpacing: "-0.02em" }}>
            Historique SMS
          </div>
          <div style={{ fontSize: 12, color: EPJ.gray500, marginTop: 2 }}>
            200 derniers SMS enfilés. Les envois confirmés sont purgés automatiquement.
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={load} loading={loading}>↻ Rafraîchir</Button>
      </div>

      {/* Filtres */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: space.sm, marginBottom: space.md }}>
        <Field as="select" label="Statut" value={statut} options={STATUT_OPTIONS} onChange={(e) => setStatut(e.target.value)} />
        <Field as="select" label="Module" value={mod} options={moduleOptions} onChange={(e) => setMod(e.target.value)} />
        <Field label="Destinataire" value={search} placeholder="Nom ou téléphone…" onChange={(e) => setSearch(e.target.value)} />
      </div>

      {error ? (
        <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 13, color: EPJ.redText }}>Impossible de charger l'historique. Réessayez.</div>
        </div>
      ) : loading ? (
        <div className="epj-card" style={{ padding: 20, textAlign: "center", color: EPJ.gray500, fontSize: 13 }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="epj-card" style={{ padding: 20, textAlign: "center", color: EPJ.gray500, fontSize: 13 }}>Aucun SMS.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: space.xs }}>
          {filtered.map((s) => {
            const open = openId === s.id;
            const st = STATUT_BADGE[s.status] || STATUT_BADGE.pending;
            const credits = s.brevoResponse?.usedCredits;
            return (
              <div
                key={s.id}
                className="epj-card"
                onClick={() => setOpenId(open ? null : s.id)}
                style={{ padding: `${space.sm}px ${space.md}px`, cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: space.sm, flexWrap: "wrap" }}>
                  <span style={{ fontSize: fontSize.xs, color: EPJ.gray500, fontVariantNumeric: "tabular-nums", minWidth: 84 }}>
                    {fmtDate(s.createdAt)}
                  </span>
                  <span style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray900, minWidth: 0, flex: 1 }}>
                    {s.recipientName || "—"}
                    <span style={{ color: EPJ.gray400, fontWeight: fontWeight.regular }}> · {s.recipientPhone || "—"}</span>
                  </span>
                  <Badge tone="neutral" label={moduleOf(s)} />
                  <Badge tone={st.tone} label={st.label} dot />
                  {credits != null && (
                    <span style={{ fontSize: fontSize.xs, color: EPJ.gray500, fontVariantNumeric: "tabular-nums" }}>{credits} cr.</span>
                  )}
                </div>
                <div style={{
                  fontSize: fontSize.sm, color: EPJ.gray700, marginTop: 4,
                  whiteSpace: open ? "pre-wrap" : "nowrap",
                  overflow: "hidden", textOverflow: "ellipsis",
                }}>
                  {s.message || "—"}
                </div>
                {open && s.status === "failed" && s.failureReason && (
                  <div style={{ marginTop: 6, fontSize: fontSize.xs, color: EPJ.redText, background: EPJ.dangerBg, borderRadius: radius.sm, padding: `4px 8px` }}>
                    Échec : {s.failureReason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const backBtnStyle = {
  background: EPJ.gray100, border: "none", borderRadius: 10,
  padding: "9px 14px", fontSize: 13, fontWeight: 600,
  color: EPJ.gray700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
};

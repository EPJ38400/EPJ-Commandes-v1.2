// ═══════════════════════════════════════════════════════════════
//  SmsHistoryPage — Gestion SMS (Admin/Direction)
//
//  1. Réglage de la FENÊTRE HORAIRE d'envoi (config/sms.fenetre) — écriture
//     Admin/Direction (rules). Les toggles PAR TYPE vivent dans
//     Administration → Modèles SMS (smsTemplates.actif), source unique.
//  2. Journal : 200 derniers docs smsQueue (orderBy createdAt desc).
//     Filtrage 100 % CÔTÉ CLIENT (statut / origine / module / destinataire).
//     Le balayage purge les SMS `sent` → l'historique montre surtout
//     pending/failed/différés + envois récents non encore balayés.
//  Garde de rôle locale (pas de clé permissions.js).
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, query, orderBy, limit, getDocs, doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useToast } from "../../core/components/Toast";
import { Field } from "../../core/components/Field";
import { Button } from "../../core/components/Button";
import { Badge } from "../../core/components/Badge";
import { StatCard } from "../../core/components/StatCard";

const STATUT_OPTIONS = [
  { value: "tous", label: "Tous les statuts" },
  { value: "sent", label: "Envoyés" },
  { value: "failed", label: "Échoués" },
  { value: "pending", label: "En attente" },
  { value: "EN_ATTENTE_FENETRE", label: "Différés (fenêtre)" },
  { value: "ANNULE_CONFIG", label: "Annulés (config)" },
  { value: "ANNULE_OBSOLETE", label: "Annulés (obsolète)" },
];
const STATUT_BADGE = {
  sent:    { tone: "success", label: "Envoyé" },
  failed:  { tone: "danger",  label: "Échoué" },
  pending: { tone: "neutral", label: "En attente" },
  EN_ATTENTE_FENETRE: { tone: "info",    label: "Différé" },
  ANNULE_CONFIG:      { tone: "neutral", label: "Annulé (config)" },
  ANNULE_OBSOLETE:    { tone: "neutral", label: "Annulé (obsolète)" },
};
const ORIGINE_OPTIONS = [
  { value: "tous", label: "Toutes origines" },
  { value: "auto", label: "Automatiques" },
  { value: "manuel", label: "Manuels" },
];

// Miroir client de DEFAULT_FENETRE (functions/lib/smsWindow.js) — garder en phase.
const DEFAULT_FENETRE = {
  actif: true, heureDebut: 8, heureFin: 17,
  jours: [1, 2, 3, 4, 5], exclureFeries: true, timezone: "Europe/Paris",
};
const JOURS_LABELS = [
  { iso: 1, l: "L" }, { iso: 2, l: "M" }, { iso: 3, l: "M" }, { iso: 4, l: "J" },
  { iso: 5, l: "V" }, { iso: 6, l: "S" }, { iso: 7, l: "D" },
];

// Crédits Brevo : usedCredits si renvoyé, sinon estimation par segments de 160.
function creditsOf(s) {
  const used = s.brevoResponse?.usedCredits;
  if (typeof used === "number") return used;
  if (s.status !== "sent") return 0;
  const len = (s.message || "").length;
  return len ? Math.ceil(len / 160) : 1;
}

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
  const toast = useToast();
  const authorized = (user?.roles || []).some((r) => ["Admin", "Direction"].includes(r));

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statut, setStatut] = useState("tous");
  const [origine, setOrigine] = useState("tous");
  const [mod, setMod] = useState("tous");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState(null);

  // ── Fenêtre horaire (config/sms) ──
  const [fenetre, setFenetre] = useState(DEFAULT_FENETRE);
  const [savingFenetre, setSavingFenetre] = useState(false);

  const loadFenetre = useCallback(async () => {
    try {
      const snap = await getDoc(doc(db, "config", "sms"));
      const f = (snap.exists() && snap.data().fenetre) || {};
      setFenetre({ ...DEFAULT_FENETRE, ...f });
    } catch (e) {
      console.warn("[SmsHistoryPage] lecture config/sms échouée :", e.message);
    }
  }, []);

  const saveFenetre = async () => {
    setSavingFenetre(true);
    try {
      await setDoc(doc(db, "config", "sms"), {
        fenetre: { ...fenetre, timezone: "Europe/Paris" },
      }, { merge: true });
      toast("✓ Fenêtre horaire enregistrée");
    } catch (e) {
      console.error("[SmsHistoryPage] écriture config/sms échouée :", e);
      toast("❌ " + (e.code === "permission-denied" ? "Accès refusé" : e.message));
    } finally {
      setSavingFenetre(false);
    }
  };

  const setF = (patch) => setFenetre((f) => ({ ...f, ...patch }));
  const toggleJour = (iso) => setFenetre((f) => {
    const has = (f.jours || []).includes(iso);
    const jours = has ? f.jours.filter((j) => j !== iso) : [...(f.jours || []), iso].sort((a, b) => a - b);
    return { ...f, jours };
  });

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

  useEffect(() => {
    if (authorized) { load(); loadFenetre(); }
    else setLoading(false);
  }, [authorized, load, loadFenetre]);

  const moduleOptions = useMemo(() => {
    const mods = new Set(rows.map(moduleOf));
    return [{ value: "tous", label: "Tous les modules" }, ...[...mods].sort().map((m) => ({ value: m, label: m }))];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((s) => {
      if (statut !== "tous" && (s.status || "pending") !== statut) return false;
      if (origine !== "tous" && (s.origine || "auto") !== origine) return false;
      if (mod !== "tous" && moduleOf(s) !== mod) return false;
      if (q) {
        const hay = `${s.recipientName || ""} ${s.recipientPhone || ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, statut, origine, mod, search]);

  // Compteurs (sur l'ensemble chargé, indépendants des filtres d'affichage).
  const stats = useMemo(() => {
    let envoyes = 0, differes = 0, credits = 0;
    for (const s of rows) {
      if (s.status === "sent") envoyes++;
      if (s.status === "EN_ATTENTE_FENETRE") differes++;
      credits += creditsOf(s);
    }
    return { total: rows.length, envoyes, differes, credits };
  }, [rows]);

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
            Gestion SMS
          </div>
          <div style={{ fontSize: 12, color: EPJ.gray500, marginTop: 2 }}>
            Fenêtre horaire d'envoi + journal des 200 derniers SMS.
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={load} loading={loading}>↻ Rafraîchir</Button>
      </div>

      {/* Fenêtre horaire */}
      <FenetrePanel
        fenetre={fenetre}
        setF={setF}
        toggleJour={toggleJour}
        onSave={saveFenetre}
        saving={savingFenetre}
      />

      {/* Compteurs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: space.sm, margin: `${space.md}px 0` }}>
        <StatCard label="SMS chargés" value={stats.total} icon="📨" />
        <StatCard label="Envoyés" value={stats.envoyes} icon="✓" />
        <StatCard label="Différés (fenêtre)" value={stats.differes} icon="⏳" />
        <StatCard label="Crédits (≈)" value={stats.credits} icon="💳" />
      </div>

      {/* Filtres */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: space.sm, marginBottom: space.md }}>
        <Field as="select" label="Statut" value={statut} options={STATUT_OPTIONS} onChange={(e) => setStatut(e.target.value)} />
        <Field as="select" label="Origine" value={origine} options={ORIGINE_OPTIONS} onChange={(e) => setOrigine(e.target.value)} />
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
                  {(s.origine || "auto") === "manuel" && <Badge tone="info" label="manuel" />}
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
                {open && (
                  <div style={{ marginTop: 6, fontSize: fontSize.xs, color: EPJ.gray500, display: "flex", gap: space.sm, flexWrap: "wrap" }}>
                    {s.templateCode && <span>type : <b style={{ color: EPJ.gray700 }}>{s.templateCode}</b></span>}
                    <span>origine : <b style={{ color: EPJ.gray700 }}>{s.origine || "auto"}</b></span>
                    {s.status === "EN_ATTENTE_FENETRE" && s.envoyerApres && (
                      <span>envoi prévu : <b style={{ color: EPJ.gray700 }}>{fmtDate(s.envoyerApres)}</b></span>
                    )}
                  </div>
                )}
                {open && s.status === "failed" && s.failureReason && (
                  <div style={{ marginTop: 6, fontSize: fontSize.xs, color: EPJ.redText, background: EPJ.dangerBg, borderRadius: radius.sm, padding: `4px 8px` }}>
                    Échec : {s.failureReason}
                  </div>
                )}
                {open && (s.status === "ANNULE_CONFIG" || s.status === "ANNULE_OBSOLETE") && s.annuleRaison && (
                  <div style={{ marginTop: 6, fontSize: fontSize.xs, color: EPJ.gray600, background: EPJ.gray100, borderRadius: radius.sm, padding: `4px 8px` }}>
                    Annulé : {s.annuleRaison}
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

// ── Panneau de réglage de la fenêtre horaire ──────────────────
function FenetrePanel({ fenetre, setF, toggleJour, onSave, saving }) {
  const f = fenetre;
  return (
    <div className="epj-card" style={{ padding: `${space.md}px`, marginBottom: space.md }}>
      <div style={{ display: "flex", alignItems: "center", gap: space.sm, marginBottom: space.sm, flexWrap: "wrap" }}>
        <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.semibold, color: EPJ.gray900, flex: 1 }}>
          Fenêtre horaire d'envoi
        </div>
        <Button
          variant={f.actif ? "primary" : "secondary"}
          size="sm"
          onClick={() => setF({ actif: !f.actif })}
        >{f.actif ? "Activée" : "Désactivée"}</Button>
      </div>
      <div style={{ fontSize: fontSize.xs, color: EPJ.gray500, marginBottom: space.sm, lineHeight: 1.5 }}>
        S'applique aux SMS <b>automatiques</b> (rappels, récaps). Hors fenêtre, ils sont
        différés à la prochaine ouverture — jamais perdus. Les envois <b>manuels</b> partent
        toujours immédiatement. Fuseau : Europe/Paris.
      </div>

      <div style={{ display: "flex", gap: space.sm, alignItems: "flex-end", flexWrap: "wrap", opacity: f.actif ? 1 : 0.5 }}>
        <Field
          label="Heure début" type="number" width={110} dense
          value={String(f.heureDebut)} min={0} max={23} disabled={!f.actif}
          onChange={(e) => setF({ heureDebut: Math.max(0, Math.min(23, +e.target.value || 0)) })}
        />
        <Field
          label="Heure fin" type="number" width={110} dense
          value={String(f.heureFin)} min={1} max={24} disabled={!f.actif}
          onChange={(e) => setF({ heureFin: Math.max(1, Math.min(24, +e.target.value || 0)) })}
        />
        <div>
          <div style={{ fontSize: fontSize.sm, fontWeight: fontWeight.medium, color: EPJ.gray700, marginBottom: space.xs + 2 }}>Jours</div>
          <div style={{ display: "flex", gap: 4 }}>
            {JOURS_LABELS.map((j, idx) => {
              const on = (f.jours || []).includes(j.iso);
              return (
                <button
                  key={idx}
                  type="button"
                  disabled={!f.actif}
                  onClick={() => toggleJour(j.iso)}
                  style={{
                    width: 32, height: 32, borderRadius: radius.sm,
                    border: `1px solid ${on ? EPJ.blue : EPJ.gray300}`,
                    background: on ? EPJ.infoBg : EPJ.white,
                    color: on ? EPJ.blueText : EPJ.gray500,
                    fontSize: fontSize.sm, fontWeight: fontWeight.semibold,
                    cursor: f.actif ? "pointer" : "not-allowed", fontFamily: font.body,
                  }}
                >{j.l}</button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: space.sm, marginTop: space.md, flexWrap: "wrap" }}>
        <Button
          variant={f.exclureFeries ? "primary" : "secondary"}
          size="sm"
          disabled={!f.actif}
          onClick={() => setF({ exclureFeries: !f.exclureFeries })}
        >{f.exclureFeries ? "✓ " : ""}Exclure les jours fériés</Button>
        <div style={{ flex: 1 }} />
        <Button variant="primary" size="sm" onClick={onSave} loading={saving}>Enregistrer</Button>
      </div>
    </div>
  );
}

const backBtnStyle = {
  background: EPJ.gray100, border: "none", borderRadius: 10,
  padding: "9px 14px", fontSize: 13, fontWeight: 600,
  color: EPJ.gray700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
};

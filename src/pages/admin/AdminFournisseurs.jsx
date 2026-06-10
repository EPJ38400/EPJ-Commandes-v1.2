// ═══════════════════════════════════════════════════════════════
//  AdminFournisseurs — Contacts fournisseurs (référentiel partagé)
//
//  CRUD complet de la collection `fournisseurs/{code}` (source unique des
//  fiches fournisseurs + contacts), partagée par le Module Commande (relance
//  AR) et les futures consultations Chiffrage.
//
//  Accès : Direction / Admin. Écritures client (rules : write Direction/Admin).
//  ⚠ Les rules `fournisseurs` doivent être déployées séparément des functions
//  (firebase deploy --only firestore:rules) — sinon lecture/écriture refusées.
//
//  Bouton "Initialiser depuis l'historique" : collecte les codeFournisseur
//  distincts de commandesEsabora + MIGRE les emails de la collection legacy
//  fournisseursContacts en contacts { usages:["relance"], source:"auto" }.
//  Idempotent : ne crée que ce qui manque, n'écrase jamais l'existant.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useMemo, useState } from "react";
import {
  collection, doc, getDoc, getDocs, onSnapshot,
  setDoc, deleteDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../firebase";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useToast } from "../../core/components/Toast";
import { USAGES_DEFAUT, USAGE_LABEL } from "../../core/fournisseurs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const genId = () => "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function AdminFournisseurs({ onBack }) {
  const { user } = useAuth();
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState(null); // "new" | code
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const authorized = (user?.roles || []).some((r) => ["Admin", "Direction"].includes(r));

  useEffect(() => {
    if (!authorized) { setLoading(false); return; }
    const unsub = onSnapshot(
      collection(db, "fournisseurs"),
      (snap) => { setRows(snap.docs.map((d) => ({ _id: d.id, ...d.data() }))); setLoading(false); },
      () => { setDenied(true); setLoading(false); }
    );
    return unsub;
  }, [authorized]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...rows]
      .filter((f) => !q
        || (f.code || "").toLowerCase().includes(q)
        || (f.nom || "").toLowerCase().includes(q)
        || (f.contacts || []).some((c) => (c.email || "").toLowerCase().includes(q) || (c.nom || "").toLowerCase().includes(q)))
      .sort((a, b) => (a.nom || a.code || "").localeCompare(b.nom || b.code || ""));
  }, [rows, search]);

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

  // ─── Seed / migration ───────────────────────────────────────
  const seed = async () => {
    if (!confirm("Initialiser le référentiel depuis l'historique des commandes Esabora et migrer les emails connus ?\n(Idempotent : n'écrase rien.)")) return;
    setSeeding(true);
    try {
      const codes = new Map(); // code -> nom suggéré
      const setNom = (code, nom) => {
        if (!codes.has(code) || (!codes.get(code) && nom)) codes.set(code, nom || "");
      };
      const ceSnap = await getDocs(collection(db, "commandesEsabora"));
      ceSnap.forEach((d) => {
        const c = d.data() || {};
        const code = String(c.codeFournisseur || "").trim();
        if (code) setNom(code, c.arRef?.fournisseur || "");
      });

      const legacy = new Map(); // code -> { email, nom }
      const legacySnap = await getDocs(collection(db, "fournisseursContacts"));
      legacySnap.forEach((d) => {
        const v = d.data() || {};
        legacy.set(d.id, { email: v.email || "", nom: v.fournisseurNom || "" });
        setNom(d.id, v.fournisseurNom || "");
      });

      let created = 0, migrated = 0;
      for (const [code, nomSug] of codes) {
        const ref = doc(db, "fournisseurs", code);
        const existing = await getDoc(ref);
        const data = existing.exists() ? (existing.data() || {}) : null;
        const contacts = Array.isArray(data?.contacts) ? [...data.contacts] : [];
        const lg = legacy.get(code);
        let changed = false;
        if (lg?.email && !contacts.some((c) => (c.email || "").toLowerCase() === lg.email.toLowerCase())) {
          contacts.push({
            id: genId(), nom: lg.nom || nomSug || "", email: lg.email,
            telephone: "", usages: ["relance"], source: "auto",
          });
          changed = true; migrated++;
        }
        if (!existing.exists()) {
          await setDoc(ref, {
            code, nom: nomSug || lg?.nom || "", actif: true, telephone: "",
            contacts, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
          });
          created++;
        } else if (changed) {
          await setDoc(ref, { contacts, updatedAt: serverTimestamp() }, { merge: true });
        }
      }
      toast(`✓ Seed terminé — ${created} fiche(s) créée(s), ${migrated} email(s) migré(s)`);
    } catch (e) {
      console.error(e);
      toast("❌ " + (e?.message || "Échec du seed"));
    } finally {
      setSeeding(false);
    }
  };

  // ─── Form ───────────────────────────────────────────────────
  const startNew = () => {
    setForm({ code: "", nom: "", telephone: "", actif: true, contacts: [], _isNew: true });
    setEditing("new");
  };
  const startEdit = (f) => {
    setForm({
      code: f.code || f._id,
      nom: f.nom || "",
      telephone: f.telephone || "",
      actif: f.actif !== false,
      contacts: (f.contacts || []).map((c) => ({
        id: c.id || genId(), nom: c.nom || "", email: c.email || "",
        telephone: c.telephone || "", usages: Array.isArray(c.usages) ? c.usages : [],
        source: c.source === "auto" ? "auto" : "manuel",
      })),
      _isNew: false,
    });
    setEditing(f._id);
  };
  const cancel = () => { setEditing(null); setForm(null); };

  const patchContact = (i, patch) =>
    setForm((f) => ({ ...f, contacts: f.contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const toggleUsage = (i, u) =>
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((c, j) => {
        if (j !== i) return c;
        const has = c.usages.includes(u);
        return { ...c, usages: has ? c.usages.filter((x) => x !== u) : [...c.usages, u] };
      }),
    }));
  const addContact = () =>
    setForm((f) => ({ ...f, contacts: [...f.contacts, { id: genId(), nom: "", email: "", telephone: "", usages: ["relance"], source: "manuel" }] }));
  const removeContact = (i) =>
    setForm((f) => ({ ...f, contacts: f.contacts.filter((_, j) => j !== i) }));

  const save = async () => {
    const code = String(form.code || "").trim();
    if (!code) { toast("❌ Code fournisseur requis"); return; }
    const badEmail = form.contacts.find((c) => c.email && !EMAIL_RE.test(c.email.trim()));
    if (badEmail) { toast("❌ Email invalide : " + badEmail.email); return; }
    if (form._isNew && rows.some((r) => (r.code || r._id) === code)) {
      toast("❌ Un fournisseur avec ce code existe déjà"); return;
    }
    setSaving(true);
    try {
      const contacts = form.contacts.map((c) => ({
        id: c.id || genId(),
        nom: (c.nom || "").trim(),
        email: (c.email || "").trim(),
        telephone: (c.telephone || "").trim(),
        usages: c.usages || [],
        source: c.source === "auto" ? "auto" : "manuel",
      }));
      await setDoc(
        doc(db, "fournisseurs", code),
        {
          code,
          nom: (form.nom || "").trim(),
          telephone: (form.telephone || "").trim(),
          actif: form.actif !== false,
          contacts,
          updatedAt: serverTimestamp(),
          ...(form._isNew ? { createdAt: serverTimestamp() } : {}),
        },
        { merge: true },
      );
      toast(form._isNew ? "✓ Fournisseur créé" : "✓ Fournisseur mis à jour");
      cancel();
    } catch (e) {
      console.error(e);
      toast("❌ " + (e?.message || "Échec de l'enregistrement"));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (f) => {
    if (!confirm(`Supprimer le fournisseur "${f.nom || f.code}" et tous ses contacts ?`)) return;
    try {
      await deleteDoc(doc(db, "fournisseurs", f._id));
      toast("🗑 Fournisseur supprimé");
    } catch (e) { toast("❌ " + (e?.message || "Échec")); }
  };

  // ─── Vue formulaire ─────────────────────────────────────────
  if (editing && form) {
    const isNew = form._isNew;
    return (
      <div style={{ paddingTop: 12, paddingBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
          <button onClick={cancel} style={backBtnStyle}>← Retour</button>
          <div style={{ fontFamily: font.display, fontSize: 20, color: EPJ.gray900 }}>
            {isNew ? "Nouveau fournisseur" : "Modifier le fournisseur"}
          </div>
        </div>

        <div className="epj-card" style={{ padding: 14, marginBottom: 12 }}>
          <FormRow>
            <label style={labelStyle}>Code fournisseur (Esabora) <span style={{ color: EPJ.red }}>*</span></label>
            <input className="epj-input" value={form.code} disabled={!isNew}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="ex : SONE" />
          </FormRow>
          <FormRow>
            <label style={labelStyle}>Nom</label>
            <input className="epj-input" value={form.nom}
              onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
              placeholder="ex : Sonepar" />
          </FormRow>
          <FormRow>
            <label style={labelStyle}>Téléphone société</label>
            <input className="epj-input" value={form.telephone}
              onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
              placeholder="ex : 04 76 …" />
          </FormRow>
          <FormRow>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={form.actif !== false}
                onChange={(e) => setForm((f) => ({ ...f, actif: e.target.checked }))}
                style={{ width: 18, height: 18, accentColor: EPJ.green }} />
              <span style={{ fontSize: 13, color: EPJ.gray900 }}>Fournisseur actif</span>
            </label>
          </FormRow>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "0 2px 8px" }}>
          <div style={labelStyle}>Contacts ({form.contacts.length})</div>
          <button onClick={addContact} className="epj-btn"
            style={{ background: `${EPJ.blue}12`, color: EPJ.blue, border: `1px solid ${EPJ.blue}`, padding: "6px 12px", fontSize: 12 }}>
            + Ajouter un contact
          </button>
        </div>

        {form.contacts.length === 0 ? (
          <div className="epj-card" style={{ padding: 16, textAlign: "center", fontSize: 12.5, color: EPJ.gray500, marginBottom: 12 }}>
            Aucun contact. Ajoute au moins une adresse de relance.
          </div>
        ) : (
          form.contacts.map((c, i) => (
            <div key={c.id} className="epj-card" style={{ padding: 12, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <SourceBadge source={c.source}
                  onToggle={() => patchContact(i, { source: c.source === "auto" ? "manuel" : "auto" })} />
                <button onClick={() => removeContact(i)} style={actionBtnStyle(`${EPJ.red}12`, EPJ.red)}>🗑</button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input className="epj-input" value={c.nom} placeholder="Nom du contact"
                  onChange={(e) => patchContact(i, { nom: e.target.value })} />
                <input className="epj-input" value={c.telephone} placeholder="Téléphone"
                  onChange={(e) => patchContact(i, { telephone: e.target.value })} />
              </div>
              <input className="epj-input" value={c.email} placeholder="email@fournisseur.fr" type="email"
                style={{ marginTop: 8, borderColor: c.email && !EMAIL_RE.test(c.email.trim()) ? EPJ.red : undefined }}
                onChange={(e) => patchContact(i, { email: e.target.value })} />
              <div style={{ marginTop: 10 }}>
                <div style={{ ...labelStyle, marginBottom: 6 }}>Usages</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {USAGES_DEFAUT.map((u) => {
                    const on = c.usages.includes(u);
                    return (
                      <button key={u} type="button" onClick={() => toggleUsage(i, u)}
                        style={{
                          padding: "5px 10px", borderRadius: 999,
                          border: `1px solid ${on ? EPJ.gray900 : EPJ.gray200}`,
                          background: on ? EPJ.gray900 : EPJ.white,
                          color: on ? EPJ.white : EPJ.gray600,
                          fontSize: 11, fontWeight: 600, cursor: "pointer",
                        }}>
                        {USAGE_LABEL[u] || u}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          ))
        )}

        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={cancel} className="epj-btn" style={{ flex: 1, background: EPJ.gray100, color: EPJ.gray700 }}>Annuler</button>
          <button onClick={save} disabled={saving} className="epj-btn"
            style={{ flex: 2, background: EPJ.gray900, color: EPJ.white, opacity: saving ? 0.6 : 1 }}>
            {saving ? "…" : (isNew ? "Créer" : "Enregistrer")}
          </button>
        </div>
      </div>
    );
  }

  // ─── Vue liste ──────────────────────────────────────────────
  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onBack} style={backBtnStyle}>← Retour</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: font.display, fontSize: 20, color: EPJ.gray900, lineHeight: 1.15 }}>Contacts fournisseurs</div>
          <div style={{ fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3, textTransform: "uppercase", fontWeight: 600, marginTop: 1 }}>
            {rows.length} fournisseur{rows.length > 1 ? "s" : ""} — référentiel partagé (relance AR, consultations)
          </div>
        </div>
      </div>

      {denied && (
        <div style={{ padding: "10px 12px", background: `${EPJ.orange}12`, border: `1px solid ${EPJ.orange}40`, borderRadius: 8, marginBottom: 12, fontSize: 12, color: EPJ.gray700 }}>
          ⚠ Collection inaccessible. Les règles Firestore <b>fournisseurs</b> ne sont probablement pas encore déployées (firebase deploy --only firestore:rules).
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={startNew} className="epj-btn" style={{ flex: 1, background: EPJ.gray900, color: EPJ.white }}>+ Nouveau fournisseur</button>
        <button onClick={seed} disabled={seeding} className="epj-btn"
          style={{ flex: 1, background: `${EPJ.orange}12`, color: EPJ.orange, border: `1px solid ${EPJ.orange}`, opacity: seeding ? 0.6 : 1 }}>
          {seeding ? "…" : "📥 Initialiser depuis l'historique"}
        </button>
      </div>

      <input className="epj-input" value={search} onChange={(e) => setSearch(e.target.value)}
        placeholder="Rechercher (code, nom, email…)" style={{ marginBottom: 12 }} />

      {loading ? (
        <div className="epj-card" style={{ padding: 20, textAlign: "center", fontSize: 13, color: EPJ.gray500 }}>Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏭</div>
          <div style={{ fontSize: 13, color: EPJ.gray500, lineHeight: 1.5 }}>
            {rows.length === 0 ? "Aucun fournisseur. Lance « Initialiser depuis l'historique » ou crée-en un." : "Aucun résultat pour cette recherche."}
          </div>
        </div>
      ) : (
        filtered.map((f) => {
          const contacts = f.contacts || [];
          const relance = contacts.find((c) => Array.isArray(c.usages) && c.usages.includes("relance") && c.email);
          return (
            <div key={f._id} className="epj-card" style={{ padding: "10px 12px", marginBottom: 6, opacity: f.actif === false ? 0.55 : 1, borderLeft: `3px solid ${EPJ.blue}` }}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 700, fontFamily: font.mono, fontSize: 13 }}>{f.code || f._id}</span>
                    {f.nom && <span style={{ fontSize: 13, color: EPJ.gray900 }}>{f.nom}</span>}
                    {f.actif === false && <span style={{ fontSize: 10, color: EPJ.gray400 }}>(inactif)</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: EPJ.gray500, marginTop: 3 }}>
                    {contacts.length} contact{contacts.length > 1 ? "s" : ""}
                    {relance ? ` · relance → ${relance.email}` : " · aucune adresse de relance"}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
                  <button onClick={() => startEdit(f)} style={actionBtnStyle(EPJ.gray100, EPJ.gray700)}>✏</button>
                  <button onClick={() => remove(f)} style={actionBtnStyle(`${EPJ.red}12`, EPJ.red)}>🗑</button>
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function SourceBadge({ source, onToggle }) {
  const auto = source === "auto";
  return (
    <button type="button" onClick={onToggle} title={auto ? "Capturé automatiquement (cliquer pour protéger)" : "Saisi manuellement (protégé de l'auto-capture)"}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "3px 9px", borderRadius: 999, cursor: "pointer",
        border: `1px solid ${auto ? EPJ.orange : EPJ.green}55`,
        background: `${auto ? EPJ.orange : EPJ.green}12`,
        color: auto ? EPJ.orange : EPJ.green, fontSize: 10.5, fontWeight: 700,
      }}>
      {auto ? "🔓 auto" : "🔒 manuel"}
    </button>
  );
}

const backBtnStyle = {
  background: EPJ.gray100, border: "none", borderRadius: 10,
  padding: "9px 14px", fontSize: 13, fontWeight: 600,
  color: EPJ.gray700, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
};
const labelStyle = {
  display: "block", fontSize: 10, fontWeight: 600,
  color: EPJ.gray500, letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 4,
};
function FormRow({ children }) { return <div style={{ marginBottom: 12 }}>{children}</div>; }
function actionBtnStyle(bg, color) {
  return {
    background: bg, color, border: "none", borderRadius: 6,
    padding: "6px 9px", fontSize: 12, fontWeight: 600, cursor: "pointer",
  };
}

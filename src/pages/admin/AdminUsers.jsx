// ═══════════════════════════════════════════════════════════════
//  AdminUsers — gestion des utilisateurs (CRUD)
//  Rôles MULTIPLES par utilisateur (cases à cocher)
//  + Reset mot de passe
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { db } from "../../firebase";
import { doc, setDoc, deleteDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import { ROLES, getRoles, rolesLabel } from "../../core/permissions";

export function AdminUsers({ onBack, onEditRights }) {
  const { users } = useData();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | 'new' | userId
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const startNew = () => {
    setForm({
      id: "",
      prenom: "",
      nom: "",
      email: "",
      telephone: "",
      pwd: "",
      roles: ["Monteur"],
      fonction: "",
      canSortirOutil: false,
    });
    setEditing("new");
  };

  const startEdit = (u) => {
    setForm({
      id: u.id,
      prenom: u.prenom || "",
      nom: u.nom || "",
      email: u.email || "",
      telephone: u.telephone || "",
      pwd: "", // on ne montre jamais le mot de passe actuel
      roles: getRoles(u),
      fonction: u.fonction || "",
      canSortirOutil: u.canSortirOutil === true,
    });
    setEditing(u.id);
  };

  const cancel = () => {
    setEditing(null);
    setForm({});
  };

  const toggleRole = (role) => {
    setForm(f => {
      const roles = f.roles || [];
      if (roles.includes(role)) {
        return { ...f, roles: roles.filter(r => r !== role) };
      } else {
        return { ...f, roles: [...roles, role] };
      }
    });
  };

  const save = async () => {
    if (!form.id || !form.prenom || !form.nom) {
      toast("❌ ID, prénom et nom requis");
      return;
    }
    if (editing === "new" && !form.pwd) {
      toast("❌ Mot de passe requis à la création");
      return;
    }
    if (!form.roles || form.roles.length === 0) {
      toast("❌ Au moins un rôle requis");
      return;
    }
    setSaving(true);
    try {
      // On récupère l'user existant pour conserver les champs qu'on n'édite pas
      const existing = users.find(u => u.id === form.id);
      const payload = {
        id: form.id,
        prenom: form.prenom,
        nom: form.nom,
        email: form.email || "",
        telephone: normalizePhone(form.telephone || ""),
        roles: form.roles,
        fonction: form.fonction || form.roles[0], // rétrocompat V1.3
        // Mot de passe : seulement si nouveau ou si modifié explicitement
        pwd: form.pwd || (existing?.pwd || ""),
        // Garde les affectations / surcharges existantes si présentes
        permissionsOverride: existing?.permissionsOverride || {},
        directAchat: existing?.directAchat ?? false,
        canSortirOutil: form.canSortirOutil === true,
      };
      await setDoc(doc(db, "utilisateurs", form.id), payload);
      toast(editing === "new" ? "✓ Utilisateur créé" : "✓ Utilisateur mis à jour");
      cancel();
    } catch (e) {
      console.error(e);
      toast("❌ Erreur : " + e.message);
    }
    setSaving(false);
  };

  const remove = async (userId) => {
    if (!confirm(`Supprimer définitivement l'utilisateur "${userId}" ?\nCette action est irréversible.`)) return;
    try {
      await deleteDoc(doc(db, "utilisateurs", userId));
      toast("🗑️ Utilisateur supprimé");
    } catch (e) {
      toast("❌ " + e.message);
    }
  };

  const resetPwd = async (u) => {
    const newPwd = prompt(`Nouveau mot de passe pour ${u.prenom} ${u.nom} :`, "1234");
    if (!newPwd) return;
    try {
      await setDoc(doc(db, "utilisateurs", u.id), { ...u, pwd: newPwd });
      toast("🔑 Mot de passe réinitialisé");
    } catch (e) {
      toast("❌ " + e.message);
    }
  };

  // ── Rendu du formulaire de création/édition ──
  if (editing) {
    const isNew = editing === "new";
    return (
      <div style={{ paddingTop: 12, paddingBottom: 24 }}>
        <SectionHeader
          title={isNew ? "Nouvel utilisateur" : "Modifier l'utilisateur"}
          onBack={cancel}
        />

        <div className="epj-card" style={{ padding: 18, marginBottom: 12 }}>
          <Field label="Identifiant (login)" required>
            <input
              className="epj-input"
              value={form.id || ""}
              onChange={e => setForm(f => ({ ...f, id: e.target.value.trim() }))}
              disabled={!isNew}
              placeholder="ex: Dupont"
              autoCapitalize="none"
            />
            {!isNew && <Hint>L'identifiant ne peut pas être modifié une fois créé.</Hint>}
          </Field>

          <Row>
            <Field label="Prénom" required>
              <input className="epj-input" value={form.prenom || ""} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}/>
            </Field>
            <Field label="Nom" required>
              <input className="epj-input" value={form.nom || ""} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}/>
            </Field>
          </Row>

          <Field label="Email">
            <input className="epj-input" type="email" value={form.email || ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="ex: j.dupont@epj-electricite.com"/>
          </Field>

          <Field label="Téléphone mobile">
            <input
              className="epj-input"
              type="tel"
              value={form.telephone || ""}
              onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))}
              placeholder="ex: 06 12 34 56 78"
              autoComplete="tel"
            />
            <Hint>Format français (06… ou +33…). Utilisé pour les notifications SMS.</Hint>
          </Field>

          {isNew && (
            <Field label="Mot de passe" required>
              <input className="epj-input" value={form.pwd || ""} onChange={e => setForm(f => ({ ...f, pwd: e.target.value }))} placeholder="mot de passe initial"/>
              <Hint>L'utilisateur pourra le changer plus tard. Vous pourrez aussi le réinitialiser.</Hint>
            </Field>
          )}

          <Field label="Rôles" required>
            <div style={{ fontSize: 11, color: EPJ.gray500, marginBottom: 6 }}>
              Sélectionnez un ou plusieurs rôles. Les droits se cumulent.
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {ROLES.map(role => {
                const checked = (form.roles || []).includes(role);
                return (
                  <button
                    key={role}
                    type="button"
                    onClick={() => toggleRole(role)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 999,
                      border: `1px solid ${checked ? EPJ.blue : EPJ.gray200}`,
                      background: checked ? `${EPJ.blue}15` : EPJ.white,
                      color: checked ? EPJ.blue : EPJ.gray700,
                      fontSize: 12, fontWeight: 600,
                      cursor: "pointer", fontFamily: font.body,
                    }}
                  >
                    {checked ? "✓ " : ""}{role}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Droits spéciaux">
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 4px",
            }}>
              <input
                type="checkbox"
                id="canSortirOutil"
                checked={form.canSortirOutil === true}
                onChange={e => setForm(f => ({ ...f, canSortirOutil: e.target.checked }))}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: EPJ.orange }}
              />
              <label htmlFor="canSortirOutil" style={{
                fontSize: 13, color: EPJ.gray900, cursor: "pointer", flex: 1, lineHeight: 1.4,
              }}>
                <b>🔧 Autorisé à sortir un outil du parc</b>
                <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 2, fontWeight: 400 }}>
                  Admin et Direction l'ont par défaut.
                </div>
              </label>
            </div>
          </Field>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button className="epj-btn" onClick={cancel} style={{ flex: 1, background: EPJ.gray100, color: EPJ.gray700 }}>
            Annuler
          </button>
          <button className="epj-btn" onClick={save} disabled={saving} style={{ flex: 2, background: EPJ.gray900, color: "#fff" }}>
            {saving ? "Enregistrement…" : (isNew ? "Créer l'utilisateur" : "Enregistrer")}
          </button>
        </div>
      </div>
    );
  }

  // ── Rendu liste ──
  const sortedUsers = [...users].sort((a, b) => (a.nom || "").localeCompare(b.nom || ""));

  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      <SectionHeader title="Utilisateurs" onBack={onBack}/>

      <button
        onClick={startNew}
        className="epj-btn"
        style={{ width: "100%", background: EPJ.gray900, color: "#fff", marginBottom: 14 }}
      >
        + Nouvel utilisateur
      </button>

      <div style={{ fontSize: 11, color: EPJ.gray500, marginBottom: 8, fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
        {sortedUsers.length} utilisateur{sortedUsers.length > 1 ? "s" : ""}
      </div>

      {sortedUsers.map(u => (
        <div key={u.id} className="epj-card" style={{ padding: "14px 16px", marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: `${EPJ.blue}15`, color: EPJ.blue,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 14, flexShrink: 0,
            }}>
              {(u.prenom?.[0] || "") + (u.nom?.[0] || "")}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: EPJ.gray900 }}>
                {u.prenom} {u.nom}
              </div>
              <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 2, fontFamily: "monospace" }}>
                {u.id}{u.email ? ` • ${u.email}` : ""}{u.telephone ? ` • ${u.telephone}` : ""}
              </div>
              <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                {getRoles(u).map(r => (
                  <span key={r} style={{
                    fontSize: 10, fontWeight: 600, padding: "2px 8px",
                    borderRadius: 999, background: `${EPJ.blue}15`, color: EPJ.blue,
                  }}>
                    {r}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <ActionBtn onClick={() => startEdit(u)}>✎ Modifier</ActionBtn>
            <ActionBtn onClick={() => onEditRights(u.id)}>🔒 Droits</ActionBtn>
            <ActionBtn onClick={() => resetPwd(u)}>🔑 Mot de passe</ActionBtn>
            <ActionBtn onClick={() => remove(u.id)} danger>🗑</ActionBtn>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Helpers visuels ────────────────────────────────────────────
function SectionHeader({ title, onBack }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <button onClick={onBack} style={{
        background: EPJ.gray100, border: "none", borderRadius: 8,
        padding: "8px 12px", fontSize: 13, fontWeight: 600,
        color: EPJ.gray700, cursor: "pointer", fontFamily: font.body, whiteSpace: "nowrap", flexShrink: 0,
      }}>← Retour</button>
      <div style={{
        fontFamily: font.display, fontSize: 22, fontWeight: 400,
        color: EPJ.gray900, letterSpacing: "-0.02em",
      }}>
        {title}
      </div>
    </div>
  );
}

function Field({ label, required, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{
        display: "block", fontSize: 11, fontWeight: 600, color: EPJ.gray500,
        letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 6,
      }}>
        {label}{required && <span style={{ color: EPJ.red, marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Row({ children }) {
  return <div style={{ display: "flex", gap: 10 }}>{children}</div>;
}

function Hint({ children }) {
  return <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 4 }}>{children}</div>;
}

function ActionBtn({ children, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "8px 10px", borderRadius: 8,
        border: `1px solid ${danger ? `${EPJ.red}44` : EPJ.gray200}`,
        background: danger ? `${EPJ.red}0D` : EPJ.white,
        color: danger ? EPJ.red : EPJ.gray700,
        fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font.body,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

// Normalise un numéro de téléphone français
// Retourne format "06 12 34 56 78" ou "+33 6 12 34 56 78"
function normalizePhone(raw) {
  if (!raw) return "";
  // Retire tout sauf chiffres et +
  let n = String(raw).replace(/[^\d+]/g, "");
  // +33... → +33 X XX XX XX XX
  if (n.startsWith("+33")) {
    const digits = n.slice(3);
    if (digits.length === 9) {
      return `+33 ${digits[0]} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
    }
    return n;
  }
  // 0X... → 0X XX XX XX XX
  if (n.startsWith("0") && n.length === 10) {
    return `${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 6)} ${n.slice(6, 8)} ${n.slice(8, 10)}`;
  }
  // Sinon on renvoie tel quel (l'utilisateur saura ce qu'il fait)
  return raw.trim();
}

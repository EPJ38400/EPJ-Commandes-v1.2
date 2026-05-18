// ═══════════════════════════════════════════════════════════════
//  AdminUsers — v1.14.0
//  Gestion des utilisateurs côté admin via Cloud Functions.
//
//  Plus aucune écriture directe sur Firestore : tout passe par les
//  Cloud Functions onCall qui :
//   - Créent/suppriment le compte Firebase Auth
//   - Posent les custom claims
//   - Maintiennent le doc Firestore en cohérence
//
//  Bénéfices :
//   - L'admin reste connecté (pas de "session switch" sur création)
//   - Mots de passe temporaires générés côté serveur
//   - Désactivation au lieu de suppression possible (préserve l'historique)
//   - Affichage du mdp temporaire à l'admin (pour transmission)
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";
import { useToast } from "../../core/components/Toast";
import { ROLES, getRoles } from "../../core/permissions";
import { httpsCallable, getFunctions } from "firebase/functions";
import { app } from "../../firebase";

// Cloud Functions admin (région europe-west1)
const functions = getFunctions(app, "europe-west1");
const fnCreateUser     = httpsCallable(functions, "adminCreateUser");
const fnUpdateUser     = httpsCallable(functions, "adminUpdateUser");
const fnResetPassword  = httpsCallable(functions, "adminResetPassword");
const fnDeleteUser     = httpsCallable(functions, "adminDeleteUser");
const fnToggleDisabled = httpsCallable(functions, "adminToggleDisabled");

export function AdminUsers({ onBack, onEditRights }) {
  const { users } = useData();
  const toast = useToast();
  const [editing, setEditing] = useState(null); // null | 'new' | userId
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  // État pour afficher un mdp temporaire généré par le serveur
  const [tempPasswordModal, setTempPasswordModal] = useState(null);
  // forme : { name, email, password, action: "created" | "reset" }

  const startNew = () => {
    setForm({
      id: "",
      prenom: "",
      nom: "",
      email: "",
      telephone: "",
      roles: ["Monteur"],
      fonction: "",
      canSortirOutil: false,
      directAchat: false,
      responsableParc: false,
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
      roles: getRoles(u),
      fonction: u.fonction || "",
      canSortirOutil: u.canSortirOutil === true,
      directAchat: u.directAchat === true,
      responsableParc: u.responsableParc === true,
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
    if (!form.email || !form.email.includes("@")) {
      toast("❌ Email valide requis (sert au login)");
      return;
    }
    if (!form.roles || form.roles.length === 0) {
      toast("❌ Au moins un rôle requis");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: form.id,
        prenom: form.prenom.trim(),
        nom: form.nom.trim(),
        email: form.email.trim(),
        telephone: normalizePhone(form.telephone || ""),
        roles: form.roles,
        fonction: form.fonction || form.roles[0],
        directAchat: form.directAchat === true,
        canSortirOutil: form.canSortirOutil === true,
        responsableParc: form.responsableParc === true,
      };

      if (editing === "new") {
        const res = await fnCreateUser(payload);
        const result = res.data || {};
        toast("✓ Utilisateur créé");
        // Affiche le mdp temporaire pour transmission à l'utilisateur
        setTempPasswordModal({
          name: `${payload.prenom} ${payload.nom}`,
          email: result.email || payload.email,
          password: result.tempPassword,
          action: "created",
        });
      } else {
        await fnUpdateUser(payload);
        toast("✓ Utilisateur mis à jour");
      }
      cancel();
    } catch (e) {
      console.error("[AdminUsers] save:", e);
      const msg = humanError(e);
      toast("❌ " + msg);
    }
    setSaving(false);
  };

  const remove = async (u) => {
    if (!confirm(
      `Supprimer définitivement l'utilisateur "${u.prenom} ${u.nom}" (${u.id}) ?\n\n` +
      `⚠️ Cette action supprime aussi son compte de connexion (Firebase Auth).\n\n` +
      `Cette action est irréversible.\n\n` +
      `💡 Si tu veux juste l'empêcher de se connecter temporairement, utilise plutôt "Désactiver".`
    )) return;
    try {
      await fnDeleteUser({ id: u.id });
      toast("🗑️ Utilisateur supprimé");
    } catch (e) {
      console.error("[AdminUsers] delete:", e);
      toast("❌ " + humanError(e));
    }
  };

  const resetPwd = async (u) => {
    if (!confirm(
      `Réinitialiser le mot de passe de ${u.prenom} ${u.nom} ?\n\n` +
      `Un nouveau mot de passe temporaire sera généré et affiché. ` +
      `Tu devras le communiquer à l'utilisateur.\n\n` +
      `L'ancien mot de passe sera immédiatement invalidé.`
    )) return;
    try {
      const res = await fnResetPassword({ id: u.id });
      const result = res.data || {};
      toast("🔑 Mot de passe réinitialisé");
      setTempPasswordModal({
        name: `${u.prenom} ${u.nom}`,
        email: u.email,
        password: result.tempPassword,
        action: "reset",
      });
    } catch (e) {
      console.error("[AdminUsers] reset:", e);
      toast("❌ " + humanError(e));
    }
  };

  const toggleDisabled = async (u) => {
    const wantDisable = u.disabled !== true;
    if (!confirm(
      wantDisable
        ? `Désactiver ${u.prenom} ${u.nom} ?\n\nL'utilisateur ne pourra plus se connecter, ` +
          `mais son compte et son historique sont préservés. Tu pourras le réactiver à tout moment.`
        : `Réactiver ${u.prenom} ${u.nom} ?\n\nL'utilisateur pourra à nouveau se connecter avec son mot de passe.`
    )) return;
    try {
      await fnToggleDisabled({ id: u.id, disabled: wantDisable });
      toast(wantDisable ? "🚫 Utilisateur désactivé" : "✓ Utilisateur réactivé");
    } catch (e) {
      console.error("[AdminUsers] toggleDisabled:", e);
      toast("❌ " + humanError(e));
    }
  };

  // ─── Modale d'affichage du mdp temporaire ──────────────────────
  if (tempPasswordModal) {
    return <TempPasswordModal info={tempPasswordModal} onClose={() => setTempPasswordModal(null)}/>;
  }

  // ─── Rendu du formulaire de création/édition ───────────────────
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
            {isNew && <Hint>Identifiant unique de l'utilisateur (utilisé en interne, ex: Dupont, Martin).</Hint>}
          </Field>

          <Row>
            <Field label="Prénom" required>
              <input className="epj-input" value={form.prenom || ""} onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))}/>
            </Field>
            <Field label="Nom" required>
              <input className="epj-input" value={form.nom || ""} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}/>
            </Field>
          </Row>

          <Field label="Email" required>
            <input
              className="epj-input"
              type="email"
              value={form.email || ""}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="ex: j.dupont@epj-electricite.com"
              autoCapitalize="none"
              disabled={!isNew}
            />
            {isNew && <Hint>Sert au login de l'utilisateur. Doit être valide et unique.</Hint>}
            {!isNew && <Hint>L'email ne peut pas être modifié après création (lié au compte Auth).</Hint>}
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
            <div style={{
              padding: "10px 12px", borderRadius: 8,
              background: `${EPJ.blue}10`, border: `1px solid ${EPJ.blue}30`,
              marginBottom: 14, fontSize: 12, color: EPJ.gray700, lineHeight: 1.5,
            }}>
              🔐 <b>Mot de passe</b> : un mot de passe temporaire sera <b>généré automatiquement</b>
              et affiché après création. Tu pourras le copier et le communiquer à l'utilisateur,
              qui devra le changer à sa première connexion.
            </div>
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
            <SpecialFlag
              id="canSortirOutil"
              checked={form.canSortirOutil}
              onChange={v => setForm(f => ({ ...f, canSortirOutil: v }))}
              accent={EPJ.orange}
              label="🔧 Autorisé à sortir un outil du parc"
              hint="Admin et Direction l'ont par défaut."
              isFirst
            />
            <SpecialFlag
              id="directAchat"
              checked={form.directAchat}
              onChange={v => setForm(f => ({ ...f, directAchat: v }))}
              accent={EPJ.green}
              label="🟢 Achats directs (sans validation)"
              hint="Si coché, les commandes de cet utilisateur partent directement aux achats. Sinon, elles passent par 'En attente de validation'. À réserver à la Direction."
            />
            <SpecialFlag
              id="responsableParc"
              checked={form.responsableParc}
              onChange={v => setForm(f => ({ ...f, responsableParc: v }))}
              accent={EPJ.blue}
              label="🛠 Responsable parc machines"
              hint="Reçoit les SMS d'alerte (panne signalée au retour d'un outil) et peut envoyer manuellement une demande de retour."
            />
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

  // ─── Rendu liste ──────────────────────────────────────────────
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

      {sortedUsers.map(u => {
        const isDisabled = u.disabled === true;
        return (
          <div key={u.id} className="epj-card" style={{
            padding: "14px 16px", marginBottom: 8,
            opacity: isDisabled ? 0.55 : 1,
          }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: isDisabled ? `${EPJ.gray500}20` : `${EPJ.blue}15`,
                color: isDisabled ? EPJ.gray500 : EPJ.blue,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontWeight: 700, fontSize: 14, flexShrink: 0,
              }}>
                {(u.prenom?.[0] || "") + (u.nom?.[0] || "")}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: EPJ.gray900 }}>
                  {u.prenom} {u.nom}
                  {isDisabled && (
                    <span style={{
                      marginLeft: 8, fontSize: 10, fontWeight: 700, padding: "2px 8px",
                      borderRadius: 999, background: `${EPJ.red}15`, color: EPJ.red,
                    }}>
                      DÉSACTIVÉ
                    </span>
                  )}
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

            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" }}>
              <ActionBtn onClick={() => startEdit(u)}>✎ Modifier</ActionBtn>
              <ActionBtn onClick={() => onEditRights(u.id)}>🔒 Droits</ActionBtn>
              <ActionBtn onClick={() => resetPwd(u)}>🔑 Mot de passe</ActionBtn>
              <ActionBtn onClick={() => toggleDisabled(u)} warning>
                {isDisabled ? "✓ Réactiver" : "🚫 Désactiver"}
              </ActionBtn>
              <ActionBtn onClick={() => remove(u)} danger>🗑</ActionBtn>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Modale d'affichage du mot de passe temporaire ──────────────
function TempPasswordModal({ info, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(info.password).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };
  return (
    <div style={{ paddingTop: 12, paddingBottom: 24 }}>
      <SectionHeader
        title={info.action === "created" ? "Compte créé" : "Mot de passe réinitialisé"}
        onBack={onClose}
      />

      <div className="epj-card" style={{ padding: 18, marginBottom: 12, border: `2px solid ${EPJ.green}` }}>
        <div style={{ fontSize: 13, color: EPJ.gray700, lineHeight: 1.6, marginBottom: 16 }}>
          {info.action === "created"
            ? <>Le compte de <b>{info.name}</b> a été créé avec succès. Voici ses identifiants&nbsp;:</>
            : <>Un nouveau mot de passe a été généré pour <b>{info.name}</b>. Communique-le-lui&nbsp;:</>
          }
        </div>

        <div style={{
          padding: "12px 14px", borderRadius: 10,
          background: EPJ.gray50, marginBottom: 10,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: EPJ.gray500, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>Email (login)</div>
          <div style={{ fontSize: 14, fontFamily: "monospace", color: EPJ.gray900, wordBreak: "break-all" }}>{info.email}</div>
        </div>

        <div style={{
          padding: "12px 14px", borderRadius: 10,
          background: `${EPJ.green}10`, border: `1px solid ${EPJ.green}40`,
          marginBottom: 14,
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: EPJ.green, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>Mot de passe temporaire</div>
          <div style={{
            fontSize: 18, fontFamily: "monospace", color: EPJ.gray900,
            fontWeight: 700, letterSpacing: 1, wordBreak: "break-all",
          }}>{info.password}</div>
        </div>

        <button
          onClick={copy}
          className="epj-btn"
          style={{ width: "100%", background: copied ? EPJ.green : EPJ.gray900, color: "#fff", marginBottom: 8 }}
        >
          {copied ? "✓ Copié !" : "📋 Copier le mot de passe"}
        </button>

        <div style={{
          fontSize: 12, color: EPJ.gray500, lineHeight: 1.5,
          padding: "10px 12px", borderRadius: 8,
          background: `${EPJ.orange}10`, border: `1px solid ${EPJ.orange}30`,
        }}>
          ⚠️ <b>Important</b> : ce mot de passe ne sera plus affiché après cette page.
          Note-le ou copie-le maintenant. L'utilisateur devra le changer à sa première connexion.
        </div>
      </div>

      <button
        className="epj-btn"
        onClick={onClose}
        style={{ width: "100%", background: EPJ.gray900, color: "#fff" }}
      >
        J'ai noté, fermer
      </button>
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

function ActionBtn({ children, onClick, danger, warning }) {
  let style = {
    border: `1px solid ${EPJ.gray200}`, background: EPJ.white, color: EPJ.gray700,
  };
  if (danger) style = {
    border: `1px solid ${EPJ.red}44`, background: `${EPJ.red}0D`, color: EPJ.red,
  };
  else if (warning) style = {
    border: `1px solid ${EPJ.orange}44`, background: `${EPJ.orange}0D`, color: EPJ.orange,
  };
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "8px 10px", borderRadius: 8,
        ...style,
        fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: font.body,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function SpecialFlag({ id, checked, onChange, accent, label, hint, isFirst }) {
  return (
    <div style={{
      display: "flex", alignItems: "flex-start", gap: 10,
      padding: "8px 4px",
      borderTop: isFirst ? "none" : `1px solid ${EPJ.gray200}`,
      marginTop: isFirst ? 0 : 4,
    }}>
      <input
        type="checkbox"
        id={id}
        checked={checked === true}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 18, height: 18, cursor: "pointer", accentColor: accent, marginTop: 2 }}
      />
      <label htmlFor={id} style={{
        fontSize: 13, color: EPJ.gray900, cursor: "pointer", flex: 1, lineHeight: 1.4,
      }}>
        <b>{label}</b>
        <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 2, fontWeight: 400 }}>
          {hint}
        </div>
      </label>
    </div>
  );
}

// ─── Utils ──────────────────────────────────────────────────────

function humanError(e) {
  // Erreurs Firebase Functions onCall
  const code = e?.code || "";
  const msg = e?.message || "Erreur inconnue";
  if (code === "functions/permission-denied" || code === "permission-denied") return "Accès refusé (admin requis)";
  if (code === "functions/unauthenticated" || code === "unauthenticated") return "Vous devez être connecté";
  if (code === "functions/already-exists" || code === "already-exists") return msg;
  if (code === "functions/not-found" || code === "not-found") return msg;
  if (code === "functions/invalid-argument" || code === "invalid-argument") return msg;
  if (code === "functions/failed-precondition" || code === "failed-precondition") return msg;
  return msg;
}

// Normalise un numéro de téléphone français
function normalizePhone(raw) {
  if (!raw) return "";
  let n = String(raw).replace(/[^\d+]/g, "");
  if (n.startsWith("+33")) {
    const digits = n.slice(3);
    if (digits.length === 9) {
      return `+33 ${digits[0]} ${digits.slice(1, 3)} ${digits.slice(3, 5)} ${digits.slice(5, 7)} ${digits.slice(7, 9)}`;
    }
    return n;
  }
  if (n.startsWith("0") && n.length === 10) {
    return `${n.slice(0, 2)} ${n.slice(2, 4)} ${n.slice(4, 6)} ${n.slice(6, 8)} ${n.slice(8, 10)}`;
  }
  return raw.trim();
}

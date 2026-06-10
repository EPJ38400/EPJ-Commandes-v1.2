// ═══════════════════════════════════════════════════════════════
//  ChangePasswordPage — Changement de mot de passe
//  v1.12.0 (nouveau)
//  Deux modes :
//   • mode="free" → l'utilisateur a cliqué "Changer mon mot de passe"
//     depuis le menu. Bouton "Annuler" disponible.
//   • mode="forced" → l'utilisateur vient de se connecter avec son
//     mdp temporaire (mustResetPassword=true). Pas de retour possible
//     tant qu'il n'a pas changé son mdp.
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font, globalCss } from "../core/theme";
import { APP_ICON } from "../core/logo";
import { useAuth } from "../core/AuthContext";
import { auth } from "../firebase";

export function ChangePasswordPage({ mode = "free", onDone, onCancel }) {
  const { user, changePassword, logout } = useAuth();
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  const forced = mode === "forced";

  // Validation du nouveau mdp
  const validateNewPwd = (pwd) => {
    if (pwd.length < 8) return "Au moins 8 caractères.";
    if (!/[a-zA-Z]/.test(pwd)) return "Au moins une lettre.";
    if (!/[0-9]/.test(pwd)) return "Au moins un chiffre.";
    if (pwd === currentPwd) return "Le nouveau mot de passe doit être différent de l'actuel.";
    return null;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError("");

    if (newPwd !== confirmPwd) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    const validation = validateNewPwd(newPwd);
    if (validation) {
      setError(validation);
      return;
    }

    setPending(true);
    try {
      const res = await changePassword(currentPwd, newPwd);
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(res.error);
      }
    } finally {
      setPending(false);
    }
  };

  // Après succès : auto-retour selon le mode
  const handleContinue = () => {
    if (onDone) onDone();
  };

  return (
    <>
      <style>{globalCss}</style>
      <div style={{
        minHeight: "100vh", width: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "32px 16px",
        background: EPJ.gray50,
      }}>
        <div style={{
          width: "100%", maxWidth: 420,
          animation: "fadeUp .4s ease",
        }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div style={{
              width: 72, height: 72, margin: "0 auto 14px",
              borderRadius: 16, overflow: "hidden",
              boxShadow: "0 8px 20px rgba(0,0,0,.10)",
            }}>
              <img src={APP_ICON} alt="EPJ" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}/>
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700, color: forced ? EPJ.orange : EPJ.gray500,
              letterSpacing: 1.4, textTransform: "uppercase", marginBottom: 6,
            }}>
              {forced ? "Première connexion" : "Sécurité"}
            </div>
            <div style={{
              fontSize: 20, fontWeight: 700, color: EPJ.gray900,
            }}>
              {forced ? "Choisissez votre mot de passe" : "Changer mon mot de passe"}
            </div>
            {forced && (
              <div style={{
                fontSize: 13, color: EPJ.gray500, marginTop: 8,
                lineHeight: 1.5, padding: "0 8px",
              }}>
                Pour votre sécurité, vous devez choisir un nouveau mot de passe
                avant d'accéder à l'application.
              </div>
            )}
          </div>

          {success ? (
            <div style={{
              background: EPJ.white,
              border: `1px solid ${EPJ.gray200}`,
              borderRadius: 16, padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,.08)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>✓</div>
              <div style={{
                fontSize: 16, fontWeight: 700, color: EPJ.gray900, marginBottom: 8,
              }}>
                Mot de passe modifié
              </div>
              <div style={{
                fontSize: 13, color: EPJ.gray500, lineHeight: 1.5, marginBottom: 20,
              }}>
                Votre nouveau mot de passe est en place. Conservez-le précieusement.
              </div>
              <button
                type="button"
                onClick={handleContinue}
                className="epj-btn"
                style={{
                  width: "100%", background: EPJ.gray900, color: EPJ.white,
                  fontSize: 14, fontWeight: 600, padding: "14px",
                }}
              >
                {forced ? "Continuer vers l'application" : "Retour"}
              </button>
            </div>
          ) : (
            <form onSubmit={submit} style={{
              background: EPJ.white,
              border: `1px solid ${EPJ.gray200}`,
              borderRadius: 16, padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,.08)",
            }}>
              {/* v1.13.5 — On affiche l'email Auth (pas Firestore), car
                  c'est celui qui sert au login (cas admin où ils diffèrent). */}
              {auth.currentUser?.email && (
                <div style={{
                  fontSize: 12, color: EPJ.gray500, marginBottom: 16,
                  padding: "10px 12px",
                  background: EPJ.gray50, borderRadius: 8,
                }}>
                  Compte : <b style={{ color: EPJ.gray900 }}>{auth.currentUser.email}</b>
                </div>
              )}

              <div style={{ marginBottom: 14 }}>
                <label style={{
                  display: "block", fontSize: 11, fontWeight: 600,
                  color: EPJ.gray500, letterSpacing: 0.4, textTransform: "uppercase",
                  marginBottom: 6,
                }}>
                  {forced ? "Mot de passe temporaire reçu" : "Mot de passe actuel"}
                </label>
                <input
                  className="epj-input"
                  type="password"
                  value={currentPwd}
                  onChange={e => setCurrentPwd(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{
                  display: "block", fontSize: 11, fontWeight: 600,
                  color: EPJ.gray500, letterSpacing: 0.4, textTransform: "uppercase",
                  marginBottom: 6,
                }}>Nouveau mot de passe</label>
                <input
                  className="epj-input"
                  type="password"
                  value={newPwd}
                  onChange={e => setNewPwd(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  required
                />
                <div style={{
                  fontSize: 11, color: EPJ.gray500, marginTop: 6, lineHeight: 1.4,
                }}>
                  Au moins 8 caractères, avec lettres et chiffres.
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: "block", fontSize: 11, fontWeight: 600,
                  color: EPJ.gray500, letterSpacing: 0.4, textTransform: "uppercase",
                  marginBottom: 6,
                }}>Confirmer le nouveau mot de passe</label>
                <input
                  className="epj-input"
                  type="password"
                  value={confirmPwd}
                  onChange={e => setConfirmPwd(e.target.value)}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <div style={{
                  background: `${EPJ.red}0D`, color: EPJ.red,
                  borderRadius: 10, padding: "10px 12px",
                  fontSize: 12, fontWeight: 500, marginBottom: 14,
                  border: `1px solid ${EPJ.red}33`,
                }}>
                  {error}
                </div>
              )}

              <button
                type="submit"
                className="epj-btn"
                disabled={pending || !currentPwd || !newPwd || !confirmPwd}
                style={{
                  width: "100%", background: EPJ.gray900, color: EPJ.white,
                  fontSize: 14, fontWeight: 600, padding: "14px",
                  marginBottom: forced ? 10 : 8,
                }}
              >
                {pending ? "Modification…" : "Modifier le mot de passe"}
              </button>

              {/* Mode forced : pas d'annuler, juste un logout discret */}
              {forced ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Se déconnecter sans changer votre mot de passe ? Vous devrez le faire à votre prochaine connexion.")) {
                      logout();
                    }
                  }}
                  style={{
                    width: "100%", background: "transparent", color: EPJ.gray500,
                    border: "none", padding: "10px",
                    fontSize: 12, fontWeight: 500, cursor: "pointer",
                    fontFamily: font.body,
                  }}
                >
                  Se déconnecter
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCancel}
                  style={{
                    width: "100%", background: "transparent", color: EPJ.gray500,
                    border: "none", padding: "10px",
                    fontSize: 12, fontWeight: 600, cursor: "pointer",
                    fontFamily: font.body,
                  }}
                >
                  Annuler
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
//  ForgotPasswordPage — Demande d'email de reset
//  v1.12.0 (nouveau)
//  L'utilisateur saisit son email. Firebase envoie un email
//  officiel avec un lien sécurisé pour choisir un nouveau mdp.
//  Le contenu de l'email se personnalise dans la console Firebase
//  → Authentication → Templates.
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font, globalCss } from "../core/theme";
import { LOGO_LOGIN, APP_ICON, BG_LOGIN } from "../core/logo";
import { useAuth } from "../core/AuthContext";

export function ForgotPasswordPage({ onBack }) {
  const { sendResetEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setPending(true);
    try {
      const res = await sendResetEmail(email);
      if (res.ok) {
        setSuccess(true);
      } else {
        setError(res.error);
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <style>{globalCss}</style>
      <div style={{
        minHeight: "100vh", width: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "32px 16px",
        position: "relative",
        background: EPJ.gray50, overflow: "hidden",
      }}>
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${BG_LOGIN})`,
          backgroundSize: "cover", backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.22, filter: "saturate(1.1)", pointerEvents: "none",
        }}/>
        <div style={{
          position: "absolute", inset: 0,
          background: "radial-gradient(600px 400px at 50% 50%, rgba(255,255,255,.75), rgba(255,255,255,.35))",
          pointerEvents: "none",
        }}/>

        <div style={{
          width: "100%", maxWidth: 380,
          animation: "fadeUp .4s ease",
          position: "relative", zIndex: 1,
        }}>
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{
              width: 92, height: 92, margin: "0 auto 18px",
              borderRadius: 20, overflow: "hidden",
              boxShadow: "0 10px 28px rgba(0,0,0,.14)",
            }}>
              <img src={APP_ICON} alt="EPJ" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}/>
            </div>
            <img src={LOGO_LOGIN} alt="EPJ Électricité Générale" style={{ width: "100%", maxWidth: 260, height: "auto", display: "block", margin: "0 auto" }}/>
            <div style={{
              fontSize: 11, fontWeight: 600, color: EPJ.gray500,
              letterSpacing: 1.4, textTransform: "uppercase", marginTop: 8,
            }}>
              Mot de passe oublié
            </div>
          </div>

          {success ? (
            <div style={{
              background: EPJ.white,
              border: `1px solid ${EPJ.gray200}`,
              borderRadius: 16, padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,.08)",
              textAlign: "center",
            }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>📧</div>
              <div style={{
                fontSize: 16, fontWeight: 700, color: EPJ.gray900,
                marginBottom: 8,
              }}>
                Email envoyé
              </div>
              <div style={{
                fontSize: 13, color: EPJ.gray500, lineHeight: 1.5, marginBottom: 20,
              }}>
                Si un compte existe avec cette adresse, vous recevrez un email
                avec un lien pour réinitialiser votre mot de passe.
                <br/><br/>
                Vérifiez aussi votre dossier spam.
              </div>
              <button
                type="button"
                onClick={onBack}
                className="epj-btn"
                style={{
                  width: "100%", background: EPJ.gray900, color: "#fff",
                  fontSize: 14, fontWeight: 600, padding: "14px",
                }}
              >
                Retour à la connexion
              </button>
            </div>
          ) : (
            <form onSubmit={submit} style={{
              background: EPJ.white,
              border: `1px solid ${EPJ.gray200}`,
              borderRadius: 16, padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,.08)",
            }}>
              <div style={{
                fontSize: 13, color: EPJ.gray500, lineHeight: 1.5,
                marginBottom: 18,
              }}>
                Saisissez l'adresse email associée à votre compte EPJ.
                Vous recevrez un email avec un lien pour choisir un nouveau
                mot de passe.
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{
                  display: "block", fontSize: 11, fontWeight: 600,
                  color: EPJ.gray500, letterSpacing: 0.4, textTransform: "uppercase",
                  marginBottom: 6,
                }}>Email</label>
                <input
                  className="epj-input"
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  autoComplete="email"
                  autoCapitalize="none"
                  placeholder="votre.email@exemple.fr"
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
                disabled={pending || !email}
                style={{
                  width: "100%", background: EPJ.gray900, color: "#fff",
                  fontSize: 14, fontWeight: 600, padding: "14px",
                  marginBottom: 10,
                }}
              >
                {pending ? "Envoi…" : "Envoyer le lien de réinitialisation"}
              </button>

              <button
                type="button"
                onClick={onBack}
                style={{
                  width: "100%", background: "transparent", color: EPJ.gray500,
                  border: "none", padding: "10px",
                  fontSize: 12, fontWeight: 600, cursor: "pointer",
                  fontFamily: font.body,
                }}
              >
                ← Retour à la connexion
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

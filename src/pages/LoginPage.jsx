// ═══════════════════════════════════════════════════════════════
//  LoginPage — écran de connexion
//  - Icône PWA (style carte de visite : arcs + logo centré)
//  - Logo couleur EPJ (PNG transparent)
//  - Arcs de la charte en arrière-plan
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font, globalCss } from "../core/theme";
import { LOGO_LOGIN, APP_ICON, BG_LOGIN } from "../core/logo";
import { useAuth } from "../core/AuthContext";

export function LoginPage() {
  const { login } = useAuth();
  const [id, setId] = useState("");
  const [pwd, setPwd] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    setError("");
    setPending(true);
    const res = login(id.trim(), pwd);
    if (!res.ok) { setError(res.error); setPending(false); }
  };

  return (
    <>
      <style>{globalCss}</style>
      <div style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "32px 16px",
        position: "relative",
        background: EPJ.gray50,
        overflow: "hidden",
      }}>
        {/* Arrière-plan : arcs colorés EPJ */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundImage: `url(${BG_LOGIN})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.22,
          filter: "saturate(1.1)",
          pointerEvents: "none",
        }}/>
        {/* Voile blanc radial pour garantir la lisibilité du formulaire */}
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
          {/* Bloc identité */}
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            {/* Icône d'app (style carte de visite EPJ) */}
            <div style={{
              width: 92, height: 92, margin: "0 auto 18px",
              borderRadius: 20, overflow: "hidden",
              boxShadow: "0 10px 28px rgba(0,0,0,.14)",
            }}>
              <img
                src={APP_ICON}
                alt="EPJ"
                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            </div>
            {/* Logo couleur (PNG transparent) */}
            <img
              src={LOGO_LOGIN}
              alt="EPJ Électricité Générale"
              style={{
                width: "100%", maxWidth: 260, height: "auto",
                display: "block", margin: "0 auto",
              }}
            />
            <div style={{
              fontSize: 11, fontWeight: 600, color: EPJ.gray500,
              letterSpacing: 1.4, textTransform: "uppercase", marginTop: 8,
            }}>
              Application interne
            </div>
          </div>

          {/* Formulaire */}
          <form onSubmit={submit} style={{
            background: EPJ.white,
            border: `1px solid ${EPJ.gray200}`,
            borderRadius: 16, padding: 24,
            boxShadow: "0 20px 50px rgba(0,0,0,.08), 0 2px 4px rgba(0,0,0,.02)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
          }}>
            <div style={{ marginBottom: 14 }}>
              <label style={{
                display: "block", fontSize: 11, fontWeight: 600,
                color: EPJ.gray500, letterSpacing: 0.4, textTransform: "uppercase",
                marginBottom: 6,
              }}>Identifiant</label>
              <input
                className="epj-input"
                value={id}
                onChange={e => setId(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                placeholder="Votre identifiant"
                required
              />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: "block", fontSize: 11, fontWeight: 600,
                color: EPJ.gray500, letterSpacing: 0.4, textTransform: "uppercase",
                marginBottom: 6,
              }}>Mot de passe</label>
              <input
                className="epj-input"
                type="password"
                value={pwd}
                onChange={e => setPwd(e.target.value)}
                autoComplete="current-password"
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
              disabled={pending || !id || !pwd}
              style={{
                width: "100%", background: EPJ.gray900, color: "#fff",
                fontSize: 14, fontWeight: 600, padding: "14px",
              }}
            >
              {pending ? "Connexion…" : "Se connecter"}
            </button>
          </form>

          <div style={{
            marginTop: 20, textAlign: "center",
            fontSize: 11, color: EPJ.gray500,
          }}>
            EPJ Électricité Générale
          </div>
        </div>
      </div>
    </>
  );
}

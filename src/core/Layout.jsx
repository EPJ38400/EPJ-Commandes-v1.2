// ═══════════════════════════════════════════════════════════════
//  Layout — shell global de l'application — v10.E
//  - Header refondu (Schéma C) :
//      • Flèche retour blanche grosse sur fond contrasté (à gauche)
//      • Bouton Déconnexion ROUGE explicite avec confirmation (à droite)
//      • Bouton Admin gris à côté
//  - Le bouton retour s'affiche uniquement si onBack est passé par App.jsx
//    (= on est dans un module ou un dashboard, pas sur la home).
//  - L'utilisateur peut TOUJOURS cliquer sur le logo pour revenir à l'accueil.
// ═══════════════════════════════════════════════════════════════
import { EPJ, font, globalCss } from "./theme";
import { LOGO_HEADER, BG_LOGIN } from "./logo";
import { useAuth } from "./AuthContext";
import { useData } from "./DataContext";
import { can } from "./permissions";

export function Layout({ children, currentModule, onHome, onBack, onOpenAdmin, fullWidth = false }) {
  const { user, logout } = useAuth();

  return (
    <>
      <style>{globalCss}</style>
      <div style={{
        minHeight: "100vh",
        background: EPJ.gray50,
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}>
        {/* Arcs colorés EPJ en filigrane (fixe, traverse toutes les pages) */}
        <div style={{
          position: "fixed", inset: 0, zIndex: 0,
          backgroundImage: `url(${BG_LOGIN})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          opacity: 0.10,
          filter: "saturate(1.2)",
          pointerEvents: "none",
        }}/>

        {user && (
          <Header
            user={user}
            currentModule={currentModule}
            onHome={onHome}
            onBack={onBack}
            onLogout={logout}
            onOpenAdmin={onOpenAdmin}
            fullWidth={fullWidth}
          />
        )}

        <main style={{
          flex: 1,
          width: "100%",
          maxWidth: fullWidth ? 1320 : 520,
          margin: "0 auto",
          padding: user
            ? "0 max(16px, env(safe-area-inset-left)) 40px max(16px, env(safe-area-inset-right))"
            : 0,
          position: "relative",
          zIndex: 1,
        }}>
          {children}
        </main>
      </div>
    </>
  );
}

// ─── Header global ─────────────────────────────────────────────
function Header({ user, currentModule, onHome, onBack, onLogout, onOpenAdmin }) {
  const { rolesConfig } = useData();
  const isAdmin = can(user, "_admin", null, rolesConfig);

  // Confirmation déconnexion : on demande confirmation pour éviter les
  // erreurs (le user clique parfois "Déconnexion" en pensant à "Retour").
  const handleLogout = () => {
    const ok = window.confirm(
      "Voulez-vous vraiment vous déconnecter ?\n\n" +
      "Toute saisie en cours sera sauvegardée automatiquement et restaurée à votre prochaine connexion."
    );
    if (ok) onLogout();
  };

  // La flèche retour ne s'affiche que si onBack est fourni
  // (= on n'est pas sur la home).
  const showBack = typeof onBack === "function";

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "rgba(255,255,255,.96)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      borderBottom: `1px solid ${EPJ.gray200}`,
      paddingTop: "var(--safe-top, 44px)",
      paddingLeft: "env(safe-area-inset-left)",
      paddingRight: "env(safe-area-inset-right)",
    }}>
      <div style={{
        maxWidth: 520, margin: "0 auto",
        padding: "10px 12px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        {/* ─── BOUTON RETOUR (gauche) — gros, blanc sur fond contrasté ─── */}
        {showBack && (
          <button
            onClick={onBack}
            style={{
              background: EPJ.dark,
              border: "none",
              color: "#fff",
              borderRadius: 10,
              width: 44, height: 44,
              fontSize: 24, fontWeight: 700, lineHeight: 1,
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0,
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            }}
            title="Retour"
            aria-label="Retour"
          >
            ←
          </button>
        )}

        {/* ─── Logo + nom de section (cliquable = retour accueil) ─── */}
        <button
          onClick={onHome}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            padding: 0, display: "flex", alignItems: "center", gap: 10,
            flex: 1, minWidth: 0, textAlign: "left",
          }}
          title="Retour à l'accueil"
        >
          <img
            src={LOGO_HEADER}
            alt="EPJ Électricité Générale"
            style={{ height: 28, width: "auto", display: "block", flexShrink: 0 }}
          />
          <div style={{
            minWidth: 0, display: "flex", flexDirection: "column",
            lineHeight: 1.2, justifyContent: "center",
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600, color: EPJ.gray500,
              letterSpacing: 0.8, textTransform: "uppercase",
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {currentModule || "Application interne"}
            </div>
            <div style={{
              fontSize: 11, fontWeight: 600, color: EPJ.gray900,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {user.prenom} {user.nom}
            </div>
          </div>
        </button>

        {/* ─── Boutons d'action droite : ⚙ Admin (gris) + Déconnexion (ROUGE) ─── */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {isAdmin && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              style={{
                background: EPJ.gray900, border: "none", color: "#fff",
                borderRadius: 10, padding: 0, fontSize: 18, fontWeight: 600,
                cursor: "pointer", fontFamily: font.body,
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 40, height: 40,
              }}
              title="Administration"
              aria-label="Administration"
            >
              ⚙
            </button>
          )}
          <button
            onClick={handleLogout}
            style={{
              background: EPJ.red, border: "none", color: "#fff",
              borderRadius: 10, padding: "0 12px",
              fontSize: 12, fontWeight: 700,
              cursor: "pointer", fontFamily: font.body,
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 5, height: 40,
              boxShadow: "0 1px 3px rgba(229,57,53,0.35)",
              letterSpacing: 0.3,
            }}
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>⏻</span>
            <span>Déconnexion</span>
          </button>
        </div>
      </div>
    </header>
  );
}

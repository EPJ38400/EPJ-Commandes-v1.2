// ═══════════════════════════════════════════════════════════════
//  Layout — shell global de l'application
//  - Header avec logo couleur EPJ
//  - Boutons à droite : ⚙ Admin (si droit) + ↪ Déconnexion
//  - Arcs colorés EPJ en filigrane d'arrière-plan
// ═══════════════════════════════════════════════════════════════
import { EPJ, font, globalCss } from "./theme";
import { LOGO_HEADER, BG_LOGIN } from "./logo";
import { useAuth } from "./AuthContext";
import { can } from "./permissions";

export function Layout({ children, currentModule, onHome, onOpenAdmin }) {
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
            onLogout={logout}
            onOpenAdmin={onOpenAdmin}
          />
        )}

        <main style={{
          flex: 1,
          width: "100%",
          maxWidth: 520,
          margin: "0 auto",
          padding: user ? "0 16px 40px" : 0,
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
function Header({ user, currentModule, onHome, onLogout, onOpenAdmin }) {
  const isAdmin = can(user, "_admin");

  return (
    <header style={{
      position: "sticky", top: 0, zIndex: 100,
      background: "rgba(255,255,255,.92)",
      backdropFilter: "blur(8px)",
      WebkitBackdropFilter: "blur(8px)",
      borderBottom: `1px solid ${EPJ.gray200}`,
    }}>
      <div style={{
        maxWidth: 520, margin: "0 auto",
        padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 10,
      }}>
        {/* Logo + nom de section (cliquable = retour accueil) */}
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
          </div>
        </button>

        {/* Identité utilisateur */}
        <div style={{ textAlign: "right", lineHeight: 1.2 }}>
          <div style={{
            fontSize: 12, fontWeight: 600, color: EPJ.gray900,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            maxWidth: 110,
          }}>
            {user.prenom} {user.nom}
          </div>
          <div style={{
            fontSize: 9, fontWeight: 500, color: EPJ.gray500,
            letterSpacing: 0.3, textTransform: "uppercase",
          }}>
            {user.role || user.fonction || "—"}
          </div>
        </div>

        {/* Boutons d'action : ⚙ Admin (si droit) + ↪ Déconnexion */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isAdmin && onOpenAdmin && (
            <button
              onClick={onOpenAdmin}
              style={{
                background: EPJ.gray900, border: "none", color: "#fff",
                borderRadius: 8, padding: "8px 10px", fontSize: 13, fontWeight: 600,
                cursor: "pointer", fontFamily: font.body,
                display: "flex", alignItems: "center", justifyContent: "center",
                width: 34, height: 34,
              }}
              title="Administration"
              aria-label="Administration"
            >
              ⚙
            </button>
          )}
          <button
            onClick={onLogout}
            style={{
              background: EPJ.gray100, border: "none", color: EPJ.gray700,
              borderRadius: 8, padding: "8px 10px", fontSize: 13, fontWeight: 600,
              cursor: "pointer", fontFamily: font.body,
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 34, height: 34,
            }}
            title="Se déconnecter"
            aria-label="Se déconnecter"
          >
            ↪
          </button>
        </div>
      </div>
    </header>
  );
}

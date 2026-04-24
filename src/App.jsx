// ═══════════════════════════════════════════════════════════════
//  App.jsx — Routeur racine de l'EPJ App Globale
//  - Bouton ⚙ Admin dans le header → AdminPage (Livraison 2)
//  - Tuile Dashboard → dashboard correspondant au rôle
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";

import { DataProvider, useData } from "./core/DataContext";
import { AuthProvider, useAuth } from "./core/AuthContext";
import { ToastProvider } from "./core/components/Toast";
import { Layout } from "./core/Layout";
import { FullPageSpinner } from "./core/components/Spinner";
import { can } from "./core/permissions";

import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
import { AdminPage } from "./pages/admin/AdminPage";
import { DashboardDirection } from "./pages/DashboardDirection";

import { CommandesModule } from "./modules/commandes/CommandesModule";
import { AvancementModule } from "./modules/avancement/AvancementModule";
import { ParcMachinesModule } from "./modules/parc-machines/ParcMachinesModule";
import { ReservesModule } from "./modules/reserves/ReservesModule";

export default function App() {
  return (
    <DataProvider>
      <AuthProvider>
        <ToastProvider>
          <Router />
        </ToastProvider>
      </AuthProvider>
    </DataProvider>
  );
}

// ─── Router interne ─────────────────────────────────────────────
function Router() {
  const { user } = useAuth();
  const { allLoaded, rolesConfig } = useData();
  const [route, setRoute] = useState("home");

  // Force le retour à l'accueil à CHAQUE nouvelle connexion
  // (notamment après déconnexion + reconnexion avec un autre compte)
  const userId = user?._id || null;
  useEffect(() => {
    if (userId) {
      setRoute("home");
    }
  }, [userId]);

  // Force le retour à l'accueil quand l'app reprend le focus APRÈS avoir
  // été VRAIMENT cachée (pas juste un changement de focus interne).
  //
  // Fix v10.D : avant, on écoutait window.focus ce qui se déclenchait
  // à la moindre interaction (clavier iOS qui s'ouvre, tap sur canvas
  // signature, etc.) → on retombait sur l'accueil en pleine édition.
  //
  // Maintenant on utilise UNIQUEMENT visibilitychange qui ne se
  // déclenche qu'au vrai retour d'arrière-plan.
  useEffect(() => {
    let wasHidden = false;
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        wasHidden = true;
      } else if (document.visibilityState === "visible" && wasHidden) {
        wasHidden = false;
        setRoute("home");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  if (!allLoaded) return <FullPageSpinner label="Chargement de l'application…"/>;
  if (!user) return <LoginPage/>;

  const openBestDashboard = () => {
    if (can(user, "_dashboards", "direction", rolesConfig)) setRoute("dashboard:direction");
    else if (can(user, "_dashboards", "conducteur", rolesConfig)) setRoute("dashboard:conducteur");
    else if (can(user, "_dashboards", "public", rolesConfig)) setRoute("dashboard:public");
  };

  const currentModule = (() => {
    if (route === "home")                  return "Accueil";
    if (route === "module:commandes")      return "Commandes";
    if (route === "module:avancement")     return "Avancement chantier";
    if (route === "module:parc-machines")  return "Parc machines";
    if (route === "module:reserves")       return "Réserves & quitus";
    if (route === "dashboard:direction")   return "Dashboard Direction";
    if (route === "dashboard:conducteur")  return "Dashboard Conducteur";
    if (route === "dashboard:public")      return "Dashboard Public";
    if (route === "admin")                 return "Administration";
    return null;
  })();

  // Vues qui bénéficient du layout large sur desktop (Mac/PC)
  const useFullWidth =
    route === "dashboard:direction" ||
    route === "admin";

  return (
    <Layout
      currentModule={currentModule}
      onHome={() => setRoute("home")}
      onOpenAdmin={() => setRoute("admin")}
      fullWidth={useFullWidth}
    >
      {route === "home" && (
        <HomePage
          onOpenModule={(mod) => setRoute(`module:${mod}`)}
          onOpenDashboard={openBestDashboard}
        />
      )}

      {route === "module:commandes" && (
        <CommandesModule onExitModule={() => setRoute("home")}/>
      )}

      {route === "module:avancement" && (
        <AvancementModule onExitModule={() => setRoute("home")}/>
      )}

      {route === "module:parc-machines" && (
        <ParcMachinesModule onExitModule={() => setRoute("home")}/>
      )}

      {route === "module:reserves" && (
        <ReservesModule onExitModule={() => setRoute("home")}/>
      )}

      {/* Dashboard Direction — vue de pilotage (v10.C) */}
      {route === "dashboard:direction" && (
        <DashboardDirection
          onBack={() => setRoute("home")}
          onGoto={(target) => setRoute(target)}
        />
      )}

      {/* Autres dashboards (placeholders — à construire) */}
      {(route === "dashboard:conducteur" || route === "dashboard:public") && (
        <PlaceholderScreen title={currentModule} onBack={() => setRoute("home")}/>
      )}

      {/* Administration (Livraison 2 — opérationnelle) */}
      {route === "admin" && (
        <AdminPage onExit={() => setRoute("home")}/>
      )}
    </Layout>
  );
}

function PlaceholderScreen({ title, onBack }) {
  return (
    <div style={{ padding: "32px 8px", textAlign: "center" }}>
      <div style={{ fontSize: 44, marginBottom: 12 }}>🛠️</div>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#1A1A1A", marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: "#6B6B6B", marginBottom: 20 }}>
        À construire dans une prochaine livraison du Socle.
      </div>
      <button
        onClick={onBack}
        style={{
          background: "#1A1A1A", color: "#fff", border: "none",
          borderRadius: 10, padding: "10px 18px",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}
      >
        ← Retour à l'accueil
      </button>
    </div>
  );
}

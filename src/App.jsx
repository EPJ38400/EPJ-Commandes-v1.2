// ═══════════════════════════════════════════════════════════════
//  App.jsx — Routeur racine de l'EPJ App Globale — v10.E
//  v10.E :
//   • Le retour à l'accueil au visibilitychange est SUPPRIMÉ.
//     C'est ce qui faisait perdre les paniers / saisies en cours
//     quand l'iPhone se mettait en veille. Désormais, l'app reste
//     exactement où elle était. Les modules persistent leur état
//     localement (panier, formulaires) via localStorage.
//   • La route courante est sauvegardée dans localStorage pour
//     que le user retrouve son écran si l'app redémarre.
//   • Le bouton "← Retour" (Schéma C) est propagé au Layout via
//     la prop onBack quand on n'est pas sur la home.
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

const ROUTE_STORAGE_KEY = "epj_last_route";

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

  // Restaure la dernière route consultée (panier, etc. survivent à
  // une fermeture/réouverture de l'app).
  const [route, setRoute] = useState(() => {
    try {
      return localStorage.getItem(ROUTE_STORAGE_KEY) || "home";
    } catch { return "home"; }
  });

  // Persiste la route courante à chaque changement
  useEffect(() => {
    try { localStorage.setItem(ROUTE_STORAGE_KEY, route); } catch {}
  }, [route]);

  // Force le retour à l'accueil à CHAQUE nouvelle connexion
  // (notamment après déconnexion + reconnexion avec un autre compte).
  // Note : la sauvegarde des brouillons (panier, etc.) reste en localStorage,
  // donc si le même user se reconnecte il retrouve ses saisies.
  const userId = user?._id || null;
  useEffect(() => {
    if (userId) {
      setRoute("home");
    }
  }, [userId]);

  // ─── v10.E : SUPPRESSION du retour forcé à l'accueil au visibilitychange ───
  // Avant (v10.D), au moindre passage de l'app en arrière-plan (verrouillage
  // iPhone, app switcher, etc.), on revenait de force à l'accueil. Conséquence :
  // un panier de commande en cours, un formulaire de réserve à moitié rempli,
  // un avancement chantier en saisie → tout disparaissait à l'écran et le user
  // devait recommencer.
  //
  // Désormais, on ne touche plus à la route au retour de veille. Chaque module
  // persiste son état local (panier, brouillon de formulaire) en localStorage
  // dans des clés dédiées (ex: "epj_commandes_draft"), et ces états sont
  // restaurés à chaque montage du composant. Le user retrouve donc son écran
  // EXACTEMENT là où il l'avait laissé.

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

  // Pour le bouton "← Retour" du header : il s'affiche dans tous les écrans
  // sauf la home. Sur la home, pas de retour (on est déjà à la racine).
  const headerOnBack = route === "home" ? null : () => setRoute("home");

  return (
    <Layout
      currentModule={currentModule}
      onHome={() => setRoute("home")}
      onBack={headerOnBack}
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

      {/* Administration */}
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

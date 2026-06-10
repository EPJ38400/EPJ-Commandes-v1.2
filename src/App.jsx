// ═══════════════════════════════════════════════════════════════
//  App.jsx — Routeur racine de l'EPJ App Globale
//  v1.12.0 :
//   • Ajout de la route "change-password" (libre depuis le menu)
//   • Forcing mustResetPassword : si le user a ce flag à true,
//     l'app le redirige automatiquement vers ChangePasswordPage
//     en mode "forced". Aucun autre écran n'est accessible.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";

import { EPJ } from "./core/theme";
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
import { CollectionDashboards } from "./pages/CollectionDashboards";
import { ChangePasswordPage } from "./pages/ChangePasswordPage";

import { CommandesModule } from "./modules/commandes/CommandesModule";
import { AvancementModule } from "./modules/avancement/AvancementModule";
import { ParcMachinesModule } from "./modules/parc-machines/ParcMachinesModule";
import { ReservesModule } from "./modules/reserves/ReservesModule";
import { OutillageRappelWatcher } from "./modules/parc-machines/OutillageRappelWatcher";
import { ReservesRappelWatcher } from "./modules/reserves/ReservesRappelWatcher";

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

function Router() {
  const { user, mustResetPassword } = useAuth();
  const { allLoaded, rolesConfig } = useData();

  const [route, setRoute] = useState(() => {
    try {
      return localStorage.getItem(ROUTE_STORAGE_KEY) || "home";
    } catch { return "home"; }
  });

  useEffect(() => {
    try { localStorage.setItem(ROUTE_STORAGE_KEY, route); } catch {}
  }, [route]);

  const userId = user?._id || null;
  useEffect(() => {
    if (userId) setRoute("home");
  }, [userId]);

  // v2.0.0 — fix runtime : tester !user AVANT !allLoaded.
  // Le DataContext n'ouvre ses listeners qu'après authReady (= user connecté +
  // JWT refreshé). Sans user, aucun loaded.xxx ne passe à true et allLoaded
  // reste false pour toujours → l'app resterait bloquée sur le spinner alors
  // qu'elle devrait afficher la page de login.
  if (!user) return <LoginPage/>;
  if (!allLoaded) return <FullPageSpinner label="Chargement de l'application…"/>;

  // ─── v1.12.0 — Forcing mustResetPassword ─────────────────────────
  // Si le compte a le flag à true (compte créé avec mdp temporaire),
  // on bloque TOUT accès à l'app tant que le mdp n'est pas changé.
  if (mustResetPassword) {
    return (
      <ChangePasswordPage
        mode="forced"
        onDone={() => {
          // Après reset, le flag passe à false côté Firestore, la sync
          // automatique va rafraîchir user.mustResetPassword et on
          // sortira de ce return naturellement.
          setRoute("home");
        }}
      />
    );
  }

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
    if (route === "dashboards")            return "Collection Dashboards";
    if (route === "dashboard:conducteur")  return "Dashboard Conducteur";
    if (route === "dashboard:public")      return "Dashboard Public";
    if (route === "admin")                 return "Administration";
    if (route === "change-password")       return "Mot de passe";
    return null;
  })();

  // Lot 0 desktop : la largeur du cadre est désormais pilotée par le shell
  // (Layout, seuil 760 px), plus par route. Plus de calcul fullWidth ici.
  const headerOnBack = route === "home" ? null : () => setRoute("home");

  // ─── v1.12.0 — Changement de mot de passe libre (depuis menu) ───
  // Affiché en standalone (sans Layout) pour avoir un écran propre,
  // comme l'écran de login.
  if (route === "change-password") {
    return (
      <ChangePasswordPage
        mode="free"
        onDone={() => setRoute("home")}
        onCancel={() => setRoute("home")}
      />
    );
  }

  return (
    <Layout
      currentModule={currentModule}
      onHome={() => setRoute("home")}
      onBack={headerOnBack}
      onOpenAdmin={() => setRoute("admin")}
      onChangePassword={() => setRoute("change-password")}
    >
      <OutillageRappelWatcher/>
      <ReservesRappelWatcher/>

      {route === "home" && (
        <HomePage
          onOpenModule={(mod) => setRoute(`module:${mod}`)}
          onOpenDashboard={openBestDashboard}
          onOpenCollectionDashboards={() => setRoute("dashboards")}
        />
      )}

      {route === "dashboards" && (
        <CollectionDashboards onBack={() => setRoute("home")} />
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

      {route === "dashboard:direction" && (
        <DashboardDirection
          onBack={() => setRoute("home")}
          onGoto={(target) => setRoute(target)}
        />
      )}

      {(route === "dashboard:conducteur" || route === "dashboard:public") && (
        // TODO v2.0.1 : filtrer chantiers c.statut === "Terminé" (toujours masqués, pas de toggle) quand le vrai dashboard public sera développé
        <PlaceholderScreen title={currentModule} onBack={() => setRoute("home")}/>
      )}

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
      <div style={{ fontSize: 18, fontWeight: 600, color: EPJ.gray900, marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ fontSize: 13, color: EPJ.gray500, marginBottom: 20 }}>
        À construire dans une prochaine livraison du Socle.
      </div>
      <button
        onClick={onBack}
        style={{
          background: EPJ.gray900, color: EPJ.white, border: "none",
          borderRadius: 10, padding: "10px 18px",
          fontSize: 13, fontWeight: 600, cursor: "pointer",
        }}
      >
        ← Retour à l'accueil
      </button>
    </div>
  );
}

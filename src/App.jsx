// ═══════════════════════════════════════════════════════════════
//  App.jsx — Routeur racine de l'EPJ App Globale
//  v1.12.0 :
//   • Ajout de la route "change-password" (libre depuis le menu)
//   • Forcing mustResetPassword : si le user a ce flag à true,
//     l'app le redirige automatiquement vers ChangePasswordPage
//     en mode "forced". Aucun autre écran n'est accessible.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect, lazy, Suspense } from "react";

import { EPJ } from "./core/theme";
import { DataProvider, useData } from "./core/DataContext";
import { AuthProvider, useAuth } from "./core/AuthContext";
import { ToastProvider } from "./core/components/Toast";
import { Layout } from "./core/Layout";
import { Spinner, FullPageSpinner } from "./core/components/Spinner";
import { can } from "./core/permissions";

// Chemin de boot (login → home) : import statique, doit peindre immédiatement.
import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";
// Watchers de rappel : toujours montés dans le shell authentifié, légers.
import { OutillageRappelWatcher } from "./modules/parc-machines/OutillageRappelWatcher";
import { ReservesRappelWatcher } from "./modules/reserves/ReservesRappelWatcher";

// ─── Code-splitting (PERF-1) ──────────────────────────────────────
// Tout ce qui est hors du chemin de boot est chargé à la demande via
// React.lazy : les modules (commandes/avancement/parc/réserves), l'admin
// et les pages secondaires sortent du bundle initial (`index`).
// helper : nos modules/pages sont des exports NOMMÉS → on les remappe en
// `default` pour React.lazy.
const named = (loader, key) => lazy(() => loader().then(m => ({ default: m[key] })));

const CommandesModule    = named(() => import("./modules/commandes/CommandesModule"), "CommandesModule");
const AvancementModule   = named(() => import("./modules/avancement/AvancementModule"), "AvancementModule");
const GestionChantierModule = named(() => import("./modules/gestion-chantier/GestionChantierModule"), "GestionChantierModule");
const PlanningPage       = named(() => import("./modules/planning/PlanningPage"), "PlanningPage");
const RHModule           = named(() => import("./modules/rh/RHModule"), "RHModule");
const ParcMachinesModule = named(() => import("./modules/parc-machines/ParcMachinesModule"), "ParcMachinesModule");
const ReservesModule     = named(() => import("./modules/reserves/ReservesModule"), "ReservesModule");
const AdminPage          = named(() => import("./pages/admin/AdminPage"), "AdminPage");
const DashboardDirection = named(() => import("./pages/DashboardDirection"), "DashboardDirection");
const CollectionDashboards = named(() => import("./pages/CollectionDashboards"), "CollectionDashboards");
const ChangePasswordPage = named(() => import("./pages/ChangePasswordPage"), "ChangePasswordPage");

const ROUTE_STORAGE_KEY = "epj_last_route";

// Fallback de chargement d'un écran lazy, dans le cadre du Layout.
function RouteFallback() {
  return (
    <div style={{ padding: "48px 8px", display: "flex", justifyContent: "center" }}>
      <Spinner label="Chargement…" size={26} />
    </div>
  );
}

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

  // Cible optionnelle transmise par onOpenModule (ex. ouvrir directement une
  // commande depuis la bannière "messages non lus"). Non persistée (état
  // volatile) → pas de ré-ouverture au reload. Consommée one-shot par le module.
  const [pendingOrderId, setPendingOrderId] = useState(null);
  const openModule = (mod, opts) => {
    setPendingOrderId(opts?.orderId || null);
    setRoute(`module:${mod}`);
  };

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
      <Suspense fallback={<FullPageSpinner label="Chargement…"/>}>
        <ChangePasswordPage
          mode="forced"
          onDone={() => {
            // Après reset, le flag passe à false côté Firestore, la sync
            // automatique va rafraîchir user.mustResetPassword et on
            // sortira de ce return naturellement.
            setRoute("home");
          }}
        />
      </Suspense>
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
    if (route === "module:gestionChantier") return "Gestion de chantier";
    if (route === "module:planning")       return "Planning";
    if (route === "module:rh")             return "Ressources humaines";
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
      <Suspense fallback={<FullPageSpinner label="Chargement…"/>}>
        <ChangePasswordPage
          mode="free"
          onDone={() => setRoute("home")}
          onCancel={() => setRoute("home")}
        />
      </Suspense>
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

      <Suspense fallback={<RouteFallback/>}>
      {route === "home" && (
        <HomePage
          onOpenModule={openModule}
          onOpenDashboard={openBestDashboard}
          onOpenCollectionDashboards={() => setRoute("dashboards")}
        />
      )}

      {route === "dashboards" && (
        <CollectionDashboards onBack={() => setRoute("home")} />
      )}

      {route === "module:commandes" && (
        <CommandesModule onExitModule={() => setRoute("home")} initialOrderId={pendingOrderId}/>
      )}

      {route === "module:avancement" && (
        <AvancementModule onExitModule={() => setRoute("home")}/>
      )}

      {route === "module:gestionChantier" && (
        <GestionChantierModule onExitModule={() => setRoute("home")}/>
      )}

      {route === "module:planning" && (
        <PlanningPage onExitModule={() => setRoute("home")}/>
      )}

      {route === "module:rh" && (
        <RHModule onExitModule={() => setRoute("home")}/>
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
      </Suspense>
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

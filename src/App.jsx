
// ═══════════════════════════════════════════════════════════════
//  App.jsx — Routeur racine de l'EPJ App Globale
//  Responsabilités :
//   - fournit AuthContext + DataContext + ToastContext à toute l'app
//   - aiguille entre LoginPage / HomePage / Modules / Dashboards / Admin
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";

import { DataProvider, useData } from "./core/DataContext";
import { AuthProvider, useAuth } from "./core/AuthContext";
import { ToastProvider } from "./core/components/Toast";
import { Layout } from "./core/Layout";
import { FullPageSpinner } from "./core/components/Spinner";

import { LoginPage } from "./pages/LoginPage";
import { HomePage } from "./pages/HomePage";

import { CommandesModule } from "./modules/commandes/CommandesModule";

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
  const { allLoaded } = useData();

  // "route" interne simple : 'home' | 'module:commandes' | 'dashboard:xxx' | 'admin'
  const [route, setRoute] = useState("home");

  // Attente du chargement initial des données Firestore pour pouvoir se connecter
  if (!allLoaded) return <FullPageSpinner label="Chargement de l'application…"/>;

  // Pas connecté → page de login (pas de Layout, pas de header)
  if (!user) return <LoginPage/>;

  // Connecté : détermine le label affiché dans le header en fonction de la route
  const currentModule = (() => {
    if (route === "home")                  return "Accueil";
    if (route === "module:commandes")      return "Commandes";
    if (route === "dashboard:direction")   return "Dashboard Direction";
    if (route === "dashboard:conducteur")  return "Dashboard Conducteur";
    if (route === "dashboard:public")      return "Dashboard Public";
    if (route === "admin")                 return "Administration";
    return null;
  })();

  return (
    <Layout currentModule={currentModule} onHome={() => setRoute("home")}>
      {route === "home" && (
        <HomePage
          onOpenModule={(mod) => setRoute(`module:${mod}`)}
          onOpenDashboard={(dash) => setRoute(`dashboard:${dash}`)}
          onOpenAdmin={() => setRoute("admin")}
        />
      )}

      {route === "module:commandes" && (
        <CommandesModule onExitModule={() => setRoute("home")}/>
      )}

      {/* Placeholders pour les futurs modules / dashboards / admin global du Socle */}
      {route.startsWith("dashboard:") && <PlaceholderScreen title="Dashboard" onBack={() => setRoute("home")}/>}
      {route === "admin" && <PlaceholderScreen title="Administration (Socle)" onBack={() => setRoute("home")}/>}
    </Layout>
  );
}

// ─── Placeholder temporaire pour les zones pas encore implémentées ──
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

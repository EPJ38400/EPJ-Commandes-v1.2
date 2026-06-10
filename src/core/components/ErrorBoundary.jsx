// ═══════════════════════════════════════════════════════════════
//  ErrorBoundary — v2.0.0
//
//  Capture les erreurs React non gérées et :
//   1. Affiche une page d'erreur lisible (au lieu de l'écran blanc)
//   2. Logue l'erreur dans Firestore (collection errorLog/) pour
//      qu'on puisse les consulter depuis Admin → Diagnostics
//
//  Pourquoi pas Sentry ? On reste sur Firebase pour ne pas multiplier
//  les services payants. La collection errorLog est purgée
//  automatiquement après 30 jours (à ajouter dans purgeSmsQueue ou
//  équivalent si besoin).
//
//  Usage :
//   <ErrorBoundary>
//     <App />
//   </ErrorBoundary>
// ═══════════════════════════════════════════════════════════════
import { Component } from "react";
import { EPJ } from "../theme";
import { db, auth } from "../../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary a capturé :", error, errorInfo);
    // Log async dans Firestore, non bloquant
    this.logToFirestore(error, errorInfo).catch(err => {
      console.error("Échec log errorLog Firestore:", err);
    });
  }

  async logToFirestore(error, errorInfo) {
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, "errorLog"), {
        message: error?.message || String(error),
        stack: error?.stack?.slice(0, 5000) || null,
        componentStack: errorInfo?.componentStack?.slice(0, 3000) || null,
        url: window.location.href,
        userAgent: navigator.userAgent?.slice(0, 500) || null,
        userId: user?.uid || null,
        userEmail: user?.email || null,
        appVersion: "2.0.0",
        timestamp: serverTimestamp(),
      });
    } catch (e) {
      // Pas de boucle d'erreur : on ne fait rien
    }
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
    // Soft reload pour que React reconstruise tout proprement
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
          fontFamily: "system-ui, -apple-system, sans-serif",
          background: EPJ.gray50,
        }}>
          <div style={{
            maxWidth: 480,
            background: EPJ.white,
            borderRadius: 12,
            padding: 32,
            boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
            <h1 style={{ fontSize: 20, marginBottom: 12, color: EPJ.gray900 }}>
              Une erreur est survenue
            </h1>
            <p style={{ fontSize: 14, color: EPJ.gray500, marginBottom: 24, lineHeight: 1.5 }}>
              L'application a rencontré un problème inattendu.
              L'incident a été enregistré et sera examiné.
            </p>
            {this.state.error && (
              <pre style={{
                background: EPJ.gray100,
                padding: 12,
                borderRadius: 6,
                fontSize: 11,
                textAlign: "left",
                maxHeight: 120,
                overflow: "auto",
                marginBottom: 16,
                color: EPJ.gray700,
              }}>
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <button onClick={this.reset} style={{
              background: EPJ.blue,
              color: EPJ.white,
              border: "none",
              borderRadius: 8,
              padding: "12px 24px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}>
              Recharger l'application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

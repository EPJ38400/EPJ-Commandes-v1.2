// ═══════════════════════════════════════════════════════════════
//  ParcMachinesModule v9 — Module 2 : Parc machines
//  - Router interne : Dashboard + Matériels + Historique + Détail outil
//  - Panier de sortie multiple (barre flottante + écran validation)
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";
import { ParcDashboard } from "./ParcDashboard";
import { ParcMateriels } from "./ParcMateriels";
import { ParcHistorique } from "./ParcHistorique";
import { ParcOutilDetail } from "./ParcOutilDetail";
import { ParcSortieMultiple } from "./ParcSortieMultiple";
import { PanierSortieProvider, usePanierSortie } from "./PanierSortieContext";
import { PanierFloatingBar } from "./PanierFloatingBar";

export function ParcMachinesModule({ onExitModule }) {
  return (
    <PanierSortieProvider>
      <ParcMachinesInner onExitModule={onExitModule}/>
    </PanierSortieProvider>
  );
}

function ParcMachinesInner({ onExitModule }) {
  const { outils } = useData();
  const [tab, setTab] = useState("dashboard"); // dashboard | materiels | historique
  const [selectedOutilId, setSelectedOutilId] = useState(null);
  const [showValidation, setShowValidation] = useState(false);
  const panier = usePanierSortie();

  // Écran validation sortie multiple
  if (showValidation) {
    return (
      <ParcSortieMultiple
        onBack={() => setShowValidation(false)}
        onDone={() => setShowValidation(false)}
      />
    );
  }

  // Écran détail outil
  if (selectedOutilId) {
    const outil = outils.find(o => o._id === selectedOutilId);
    if (!outil) {
      setSelectedOutilId(null);
      return null;
    }
    return (
      <ParcOutilDetail
        outil={outil}
        onBack={() => setSelectedOutilId(null)}
      />
    );
  }

  return (
    <div style={{
      paddingTop: 12,
      // Si panier actif : réserve de la place pour la barre flottante + home indicator iPhone
      paddingBottom: panier.active
        ? "calc(90px + env(safe-area-inset-bottom))"
        : "calc(24px + env(safe-area-inset-bottom))",
    }}>
      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <button onClick={onExitModule} style={{
          background: EPJ.gray100, border: "none", borderRadius: 10,
          padding: "9px 14px", fontSize: 13, fontWeight: 600,
          color: EPJ.gray700, cursor: "pointer", fontFamily: font.body,
          whiteSpace: "nowrap", flexShrink: 0,
        }}>← Accueil</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: font.display, fontSize: 22, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.15,
          }}>Parc machines</div>
          <div style={{
            fontSize: 10, color: EPJ.gray500, letterSpacing: 0.3,
            textTransform: "uppercase", fontWeight: 600, marginTop: 1,
          }}>Outillage et matériel</div>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        <TabButton active={tab === "dashboard"} onClick={() => setTab("dashboard")}>
          📊 Tableau de bord
        </TabButton>
        <TabButton active={tab === "materiels"} onClick={() => setTab("materiels")}>
          🔧 Matériels
        </TabButton>
        <TabButton active={tab === "historique"} onClick={() => setTab("historique")}>
          📋 Historique
        </TabButton>
      </div>

      {/* Contenu onglet */}
      {tab === "dashboard" && <ParcDashboard onSelectOutil={setSelectedOutilId}/>}
      {tab === "materiels" && <ParcMateriels onSelectOutil={setSelectedOutilId}/>}
      {tab === "historique" && <ParcHistorique/>}

      {/* Barre flottante quand panier actif (fixe en bas) */}
      <PanierFloatingBar onContinue={() => setShowValidation(true)}/>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "10px 8px", borderRadius: 8,
        border: `1px solid ${active ? EPJ.gray900 : EPJ.gray200}`,
        background: active ? EPJ.gray900 : EPJ.white,
        color: active ? "#fff" : EPJ.gray700,
        fontSize: 11, fontWeight: 600, cursor: "pointer",
        fontFamily: font.body, whiteSpace: "nowrap",
      }}
    >{children}</button>
  );
}

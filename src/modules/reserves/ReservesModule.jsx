// ═══════════════════════════════════════════════════════════════
//  ReservesModule — Module 4 : Réserves & Quitus (v10.A Fondations)
//  Router interne : Dashboard → Create / Detail / Levee
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { can } from "../../core/permissions";
import { ReservesInner } from "./ReservesInner";
import { ReserveCreate } from "./ReserveCreate";
import { ReserveDetail } from "./ReserveDetail";
import { ReserveLevee } from "./ReserveLevee";

export function ReservesModule({ onExitModule }) {
  const { user } = useAuth();
  const { rolesConfig } = useData();
  const [view, setView] = useState("dashboard"); // dashboard | create | detail | levee
  const [selectedReserveId, setSelectedReserveId] = useState(null);
  const [prefillChantierNum, setPrefillChantierNum] = useState(null);

  const viewScope = can(user, "reserves-quitus", "view", rolesConfig);
  if (!viewScope) {
    return (
      <div style={{ padding: 24, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <div style={{ fontSize: 15, color: EPJ.gray700, fontFamily: font.body }}>
          Vous n'avez pas accès au module Réserves.
        </div>
        <button onClick={onExitModule} className="epj-btn" style={{
          marginTop: 16, background: EPJ.gray100, color: EPJ.gray700,
        }}>← Retour</button>
      </div>
    );
  }

  const goToDetail = (reserveId) => { setSelectedReserveId(reserveId); setView("detail"); };
  const goToLevee  = (reserveId) => { setSelectedReserveId(reserveId); setView("levee"); };
  const goToCreate = (chantierNum) => { setPrefillChantierNum(chantierNum || null); setView("create"); };
  const goToDashboard = () => { setSelectedReserveId(null); setPrefillChantierNum(null); setView("dashboard"); };

  if (view === "create") {
    return <ReserveCreate
      onDone={(reserveId) => reserveId ? goToDetail(reserveId) : goToDashboard()}
      onCancel={goToDashboard}
      prefillChantierNum={prefillChantierNum}
    />;
  }
  if (view === "detail" && selectedReserveId) {
    return <ReserveDetail
      reserveId={selectedReserveId}
      onBack={goToDashboard}
      onLevee={() => goToLevee(selectedReserveId)}
    />;
  }
  if (view === "levee" && selectedReserveId) {
    return <ReserveLevee
      reserveId={selectedReserveId}
      onDone={() => goToDetail(selectedReserveId)}
      onCancel={() => goToDetail(selectedReserveId)}
    />;
  }

  return <ReservesInner
    onCreate={goToCreate}
    onSelect={goToDetail}
    onExitModule={onExitModule}
  />;
}

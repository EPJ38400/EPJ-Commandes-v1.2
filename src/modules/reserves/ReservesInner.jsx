// ═══════════════════════════════════════════════════════════════
//  ReservesInner — Dashboard + liste filtrable
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ, font } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { can } from "../../core/permissions";
import {
  RESERVE_STATUTS, RESERVE_PRIORITES,
  formatDate, isReserveEnRetard, isRdvEnRetard,
} from "./reservesUtils";

export function ReservesInner({ onCreate, onSelect, onExitModule }) {
  const { user } = useAuth();
  const data = useData();
  const reserves = data.reserves || [];
  const chantiers = data.chantiers || [];
  const users = data.users || [];
  const rolesConfig = data.rolesConfig;

  const viewScope = can(user, "reserves-quitus", "view", rolesConfig);
  const canCreate = !!can(user, "reserves-quitus", "create", rolesConfig);
  const canSeeAll = viewScope === "all";

  // Défaut intelligent selon le rôle (v10.A.3)
  // Les rôles "pilotage" voient par défaut TOUT, les rôles "terrain"
  // voient par défaut UNIQUEMENT ce qui les concerne.
  const roles = [
    ...(Array.isArray(user?.roles) ? user.roles : []),
    user?.role || "",
    user?.fonction || "",
  ].map(r => String(r || "").toLowerCase()).filter(Boolean);

  const isPilotageRole =
    roles.some(r => r.includes("admin") || r.includes("direction") ||
                    r.includes("conducteur") || r.includes("assistant"));

  const defaultMode = (canSeeAll && isPilotageRole) ? "all" : "mine";

  const [mode, setMode] = useState(defaultMode);
  const [statutFilter, setStatutFilter] = useState("");
  const [prioriteFilter, setPrioriteFilter] = useState("");
  const [chantierFilter, setChantierFilter] = useState("");

  // Filtrage selon mode + scope
  const visibles = useMemo(() => {
    let list = reserves.slice();
    // Scope par défaut
    if (viewScope !== "all") {
      const myChantierNums = new Set(
        chantiers.filter(c => {
          const aff = c.affectations || {};
          return aff.conducteurId === user._id
              || aff.chefChantierId === user._id
              || (aff.monteurIds || []).includes(user._id);
        }).map(c => c.num)
      );
      list = list.filter(r => myChantierNums.has(r.chantierNum) || r.affecteAUserId === user._id);
    }
    // Mode "Mes réserves" : uniquement celles attribuées à moi
    if (mode === "mine") {
      list = list.filter(r => r.affecteAUserId === user._id);
    }
    if (statutFilter) list = list.filter(r => r.statut === statutFilter);
    if (prioriteFilter) list = list.filter(r => r.priorite === prioriteFilter);
    if (chantierFilter) list = list.filter(r => r.chantierNum === chantierFilter);
    // Tri : bloquantes d'abord, puis date limite (null en dernier), puis création récente
    list.sort((a, b) => {
      const pa = a.priorite === "bloquante" ? 0 : 1;
      const pb = b.priorite === "bloquante" ? 0 : 1;
      if (pa !== pb) return pa - pb;
      const da = a.dateLimite || "9999-12-31";
      const db = b.dateLimite || "9999-12-31";
      if (da !== db) return da < db ? -1 : 1;
      return (b.dateEmission || "").localeCompare(a.dateEmission || "");
    });
    return list;
  }, [reserves, chantiers, user, viewScope, mode, statutFilter, prioriteFilter, chantierFilter]);

  // Indicateurs
  const kpi = useMemo(() => {
    const list = visibles;
    return {
      total: list.length,
      bloquantes: list.filter(r => r.priorite === "bloquante" && !["levee","quitus_signe","cloturee"].includes(r.statut)).length,
      enCours: list.filter(r => ["attribuee","planifiee","intervention"].includes(r.statut)).length,
      leveesMois: list.filter(r => {
        if (!["levee","quitus_signe","cloturee"].includes(r.statut)) return false;
        if (!r.dateLevee) return false;
        const d = new Date(r.dateLevee);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      }).length,
      enRetard: list.filter(r => isReserveEnRetard(r) || isRdvEnRetard(r)).length,
    };
  }, [visibles]);

  const chantiersDispo = useMemo(() =>
    Array.from(new Set(reserves.map(r => r.chantierNum).filter(Boolean))).sort(),
    [reserves]
  );

  const getUserName = (id) => {
    const u = users.find(x => x._id === id);
    if (!u) return "—";
    return `${u.prenom || ""} ${u.nom || ""}`.trim() || u.id || "—";
  };

  return (
    <div style={{ paddingTop: 12, paddingBottom: 40 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <button onClick={onExitModule} style={{
          background: "transparent", border: "none", color: EPJ.gray700,
          fontSize: 14, cursor: "pointer", fontFamily: font.body, padding: "6px 10px",
        }}>← Accueil</button>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: font.display, fontSize: 24, color: EPJ.gray900, letterSpacing: "-0.02em" }}>
            Réserves & quitus
          </div>
          <div style={{ fontSize: 10, color: EPJ.gray500, letterSpacing: 0.8, textTransform: "uppercase" }}>
            Suivi SAV & garantie
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, marginBottom: 14 }}>
        <KpiCard label="Bloquantes" value={kpi.bloquantes} color={EPJ.red} icon="🔴"/>
        <KpiCard label="En cours"  value={kpi.enCours}  color={EPJ.orange} icon="🟡"/>
        <KpiCard label="Levées /mois" value={kpi.leveesMois} color={EPJ.green} icon="✓"/>
        <KpiCard label="Retards"   value={kpi.enRetard} color={EPJ.red} icon="⏰"/>
      </div>

      {/* Bannière retards */}
      {kpi.enRetard > 0 && (
        <div style={{
          background: `${EPJ.red}12`, border: `1px solid ${EPJ.red}55`,
          borderRadius: 10, padding: "10px 12px", marginBottom: 12,
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <span style={{ fontSize: 18 }}>⚠</span>
          <span style={{ fontSize: 13, color: EPJ.red, fontWeight: 600, fontFamily: font.body }}>
            {kpi.enRetard} réserve(s) en retard — action requise
          </span>
        </div>
      )}

      {/* Mode switcher */}
      {canSeeAll && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10, background: EPJ.gray100, borderRadius: 8, padding: 3 }}>
          <button onClick={() => setMode("mine")} style={modeBtnStyle(mode === "mine")}>Mes réserves</button>
          <button onClick={() => setMode("all")} style={modeBtnStyle(mode === "all")}>Toutes</button>
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
        <select value={statutFilter} onChange={e => setStatutFilter(e.target.value)}
                className="epj-input" style={{ flex: 1, minWidth: 120, fontSize: 12, padding: "8px 10px" }}>
          <option value="">Tous statuts</option>
          {Object.entries(RESERVE_STATUTS).map(([k, v]) =>
            <option key={k} value={k}>{v.icon} {v.label}</option>
          )}
        </select>
        <select value={prioriteFilter} onChange={e => setPrioriteFilter(e.target.value)}
                className="epj-input" style={{ flex: 1, minWidth: 100, fontSize: 12, padding: "8px 10px" }}>
          <option value="">Toutes priorités</option>
          {Object.entries(RESERVE_PRIORITES).map(([k, v]) =>
            <option key={k} value={k}>{v.icon} {v.label}</option>
          )}
        </select>
        {chantiersDispo.length > 1 && (
          <select value={chantierFilter} onChange={e => setChantierFilter(e.target.value)}
                  className="epj-input" style={{ flex: 1, minWidth: 120, fontSize: 12, padding: "8px 10px" }}>
            <option value="">Tous chantiers</option>
            {chantiersDispo.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
      </div>

      {/* Bouton création */}
      {canCreate && (
        <button onClick={() => onCreate()} className="epj-btn" style={{
          width: "100%", background: EPJ.blue, color: "#fff", marginBottom: 12,
          fontSize: 14, padding: "12px",
        }}>+ Nouvelle réserve</button>
      )}

      {/* Liste */}
      {visibles.length === 0 ? (
        <div className="epj-card" style={{ padding: 24, textAlign: "center", color: EPJ.gray500 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
          <div style={{ fontSize: 13 }}>Aucune réserve {mode === "mine" ? "attribuée" : ""} ne correspond aux filtres.</div>
        </div>
      ) : (
        visibles.map(r => (
          <ReserveRow key={r._id} reserve={r} onClick={() => onSelect(r._id)} userName={getUserName(r.affecteAUserId)}/>
        ))
      )}
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────
function KpiCard({ label, value, color, icon }) {
  return (
    <div className="epj-card" style={{
      padding: "10px 8px", textAlign: "center",
      borderTop: `3px solid ${color}`, borderRadius: 10,
    }}>
      <div style={{ fontSize: 14, marginBottom: 2 }}>{icon}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 9, color: EPJ.gray500, textTransform: "uppercase", letterSpacing: 0.3, marginTop: 3 }}>
        {label}
      </div>
    </div>
  );
}

function modeBtnStyle(active) {
  return {
    flex: 1, padding: "8px 10px", fontSize: 12, fontWeight: 600,
    border: "none", borderRadius: 6, cursor: "pointer",
    background: active ? "#fff" : "transparent",
    color: active ? EPJ.gray900 : EPJ.gray500,
    fontFamily: font.body,
    boxShadow: active ? "0 1px 3px rgba(0,0,0,.08)" : "none",
  };
}

function ReserveRow({ reserve, onClick, userName }) {
  const st = RESERVE_STATUTS[reserve.statut] || RESERVE_STATUTS.creee;
  const pr = RESERVE_PRIORITES[reserve.priorite] || RESERVE_PRIORITES.normale;
  const retard = isReserveEnRetard(reserve) || isRdvEnRetard(reserve);

  return (
    <div onClick={onClick} className="epj-card clickable" style={{
      padding: "12px 14px", marginBottom: 6, display: "flex",
      alignItems: "center", gap: 10,
      borderLeft: `3px solid ${pr.color}`,
      background: retard ? `${EPJ.red}08` : undefined,
    }}>
      {reserve.photoAvant ? (
        <img src={reserve.photoAvant} alt="" style={{
          width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0,
        }}/>
      ) : (
        <div style={{
          width: 44, height: 44, borderRadius: 8, background: EPJ.gray100,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, flexShrink: 0,
        }}>📝</div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{
            fontSize: 10, fontFamily: "monospace", color: EPJ.gray500, fontWeight: 600,
          }}>{reserve.numReserve || "—"}</span>
          <span style={{
            fontSize: 9, padding: "2px 6px", borderRadius: 4,
            background: `${st.color}22`, color: st.color, fontWeight: 600,
          }}>{st.icon} {st.label}</span>
          {retard && (
            <span style={{
              fontSize: 9, padding: "2px 6px", borderRadius: 4,
              background: `${EPJ.red}22`, color: EPJ.red, fontWeight: 700,
            }}>⏰ Retard</span>
          )}
        </div>
        <div style={{
          fontSize: 13, fontWeight: 600, color: EPJ.gray900,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          fontFamily: font.body,
        }}>{reserve.titre || "(sans titre)"}</div>
        <div style={{
          fontSize: 10, color: EPJ.gray500, marginTop: 2,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {reserve.chantierNum && <span>📍 {reserve.chantierNum}</span>}
          {reserve.affecteAUserId && <span> · 👤 {userName}</span>}
          {reserve.dateLimite && <span> · 🎯 {formatDate(reserve.dateLimite)}</span>}
        </div>
      </div>
    </div>
  );
}

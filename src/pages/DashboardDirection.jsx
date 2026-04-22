// ═══════════════════════════════════════════════════════════════
//  DashboardDirection — Vue de pilotage globale EPJ (v10.C)
//
//  Pensée pour être utilisée sur Mac/PC ET sur iPhone.
//  Sur grand écran : layout 2 colonnes avec plus d'espace.
//  Sur mobile : empilé sur 1 colonne.
//
//  Contenu :
//   • Bandeau d'alertes (retards, commandes en attente, etc.)
//   • 6 KPIs principaux cliquables
//   • Colonne gauche : À suivre (réserves + commandes actionnables)
//   • Colonne droite : Activité récente + répartition par chantier
// ═══════════════════════════════════════════════════════════════
import { useMemo } from "react";
import { EPJ, font } from "../core/theme";
import { useAuth } from "../core/AuthContext";
import { useData } from "../core/DataContext";

// ─── Formats ─────────────────────────────────────────────
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
};
const salutation = () => {
  const h = new Date().getHours();
  if (h < 6) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
};
const fmtDateLong = () => {
  return new Date().toLocaleDateString("fr-FR", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
};

const isLate = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return false;
  return d.getTime() < Date.now();
};

// ═══════════════════════════════════════════════════════════
export function DashboardDirection({ onBack, onGoto }) {
  const { user } = useAuth();
  const data = useData();

  const chantiers = data.chantiers || [];
  const reserves = data.reserves || [];
  const commandes = data.commandes || []; // Peut ne pas exister si pas chargé
  const users = data.users || [];
  const outils = data.outils || [];
  const outillageSorties = data.outillageSorties || [];

  // ─── Calculs KPIs & listes ─────────────────────────────
  const stats = useMemo(() => {
    // Réserves ouvertes (pas encore levées)
    const reservesOuvertes = reserves.filter(r =>
      !["levee", "quitus_signe", "archivee"].includes(r.statut)
    );
    // Réserves en retard
    const reservesEnRetard = reservesOuvertes.filter(r => {
      if (isLate(r.dateLimiteLevee)) return true;
      if (r.rdvPris && isLate(r.dateRdv)) return true;
      return false;
    });
    // Réserves bloquantes
    const reservesBloquantes = reservesOuvertes.filter(r => r.priorite === "bloquante");
    // Non attribuées
    const reservesNonAttribuees = reservesOuvertes.filter(r => !r.affecteAUserId);

    // Chantiers actifs (ceux qui ne sont pas archivés)
    const chantiersActifs = chantiers.filter(c => c.archive !== true);

    // Commandes en attente (pas encore réceptionnées ni refusées)
    // Vraies valeurs Firestore : "En attente de validation" | "Validée" |
    //   "Envoyée aux achats" | "Refusée" | "Réceptionnée"
    const commandesEnAttente = commandes.filter(cmd =>
      ["En attente de validation", "Validée", "Envoyée aux achats"].includes(cmd.statut)
    );
    const commandesEnRetard = commandesEnAttente.filter(cmd =>
      cmd.dateReception && isLate(cmd.dateReception)
    );
    const commandesUrgentes = commandesEnAttente.filter(cmd => cmd.urgent === true);
    const commandesAValider = commandes.filter(cmd => cmd.statut === "En attente de validation");

    // Parc machines en panne
    const outilsEnPanne = outils.filter(o => o.statut === "panne" || o.statut === "HS");

    // Outils sortis actuellement (sorties non retournées)
    const outilsSortis = outillageSorties.filter(s => !s.dateRetour);

    return {
      reservesOuvertes, reservesEnRetard, reservesBloquantes, reservesNonAttribuees,
      chantiersActifs,
      commandesEnAttente, commandesEnRetard, commandesUrgentes, commandesAValider,
      outilsEnPanne, outilsSortis,
    };
  }, [reserves, chantiers, commandes, outils, outillageSorties]);

  // ─── Activité récente (toutes réserves + commandes) ─────
  const activiteRecente = useMemo(() => {
    const events = [];
    reserves.forEach(r => {
      if (r.dateCreation) {
        events.push({
          type: "reserve-creee",
          date: r.dateCreation,
          label: `Réserve ${r.numReserve || ""} créée`,
          sub: `${r.chantierNom || ""} — ${r.titre || ""}`,
          color: EPJ.blue,
          icon: "📝",
          onClick: () => onGoto && onGoto("module:reserves"),
        });
      }
      if (r.dateLevee) {
        events.push({
          type: "reserve-levee",
          date: r.dateLevee,
          label: `Réserve ${r.numReserve || ""} levée`,
          sub: `par ${r.leveeParNom || "?"} — ${r.chantierNom || ""}`,
          color: EPJ.green,
          icon: "✓",
          onClick: () => onGoto && onGoto("module:reserves"),
        });
      }
    });
    commandes.forEach(cmd => {
      if (cmd.dateCreation) {
        events.push({
          type: "commande-creee",
          date: cmd.dateCreation,
          label: `Commande ${cmd.num || ""} créée`,
          sub: `${cmd.chantier || cmd.salarie || ""} — ${cmd.user || ""}`,
          color: EPJ.orange,
          icon: "📦",
          onClick: () => onGoto && onGoto("module:commandes"),
        });
      }
      if (cmd.dateValidation) {
        events.push({
          type: "commande-validee",
          date: cmd.dateValidation,
          label: `Commande ${cmd.num || ""} validée`,
          sub: cmd.chantier || cmd.user || "",
          color: EPJ.green,
          icon: "✅",
          onClick: () => onGoto && onGoto("module:commandes"),
        });
      }
      if (cmd.dateReceptionEffective) {
        events.push({
          type: "commande-recue",
          date: cmd.dateReceptionEffective,
          label: `Commande ${cmd.num || ""} réceptionnée`,
          sub: cmd.chantier || cmd.user || "",
          color: EPJ.blue,
          icon: "📦",
          onClick: () => onGoto && onGoto("module:commandes"),
        });
      }
    });
    // Tri par date desc, max 15
    return events
      .filter(e => !!e.date)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 15);
  }, [reserves, commandes, onGoto]);

  // ─── Répartition réserves par chantier (top 5) ──────────
  const topChantiers = useMemo(() => {
    const map = {};
    stats.reservesOuvertes.forEach(r => {
      const k = r.chantierNum || "?";
      if (!map[k]) {
        map[k] = {
          num: r.chantierNum,
          nom: r.chantierNom || "",
          total: 0,
          bloquantes: 0,
          enRetard: 0,
        };
      }
      map[k].total++;
      if (r.priorite === "bloquante") map[k].bloquantes++;
      if (isLate(r.dateLimiteLevee) || (r.rdvPris && isLate(r.dateRdv))) map[k].enRetard++;
    });
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [stats.reservesOuvertes]);

  // ═══ Render ═══
  return (
    <>
      <style>{dashboardCss}</style>
      <div className="dash-root">

        {/* HEADER */}
        <div className="dash-header">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 2 }}>
            <button onClick={onBack} className="back-btn">← Accueil</button>
          </div>
          <div className="dash-title-row">
            <div>
              <div className="dash-salutation">
                {salutation()}, {user?.prenom || user?.nom || ""}
              </div>
              <div className="dash-title">
                Vue de pilotage
              </div>
              <div className="dash-date">{fmtDateLong()}</div>
            </div>
            <div className="dash-badges">
              <span className="dash-badge dash-badge-blue">
                Direction
              </span>
            </div>
          </div>
        </div>

        {/* BANDEAU D'ALERTES */}
        <AlertsBanner stats={stats} onGoto={onGoto}/>

        {/* KPIs */}
        <div className="dash-section-title">Chiffres clés</div>
        <div className="kpi-grid">
          <Kpi
            label="Chantiers actifs"
            value={stats.chantiersActifs.length}
            icon="🏗"
            color={EPJ.orange}
            onClick={() => onGoto && onGoto("module:avancement")}
          />
          <Kpi
            label="Réserves ouvertes"
            value={stats.reservesOuvertes.length}
            sub={stats.reservesBloquantes.length > 0
              ? `dont ${stats.reservesBloquantes.length} bloquante${stats.reservesBloquantes.length > 1 ? "s" : ""}` : null}
            icon="📝"
            color="#8E44AD"
            onClick={() => onGoto && onGoto("module:reserves")}
          />
          <Kpi
            label="Réserves en retard"
            value={stats.reservesEnRetard.length}
            icon="⚠"
            color={EPJ.red}
            alert={stats.reservesEnRetard.length > 0}
            onClick={() => onGoto && onGoto("module:reserves")}
          />
          <Kpi
            label="Commandes en attente"
            value={stats.commandesEnAttente.length}
            sub={stats.commandesUrgentes.length > 0
              ? `${stats.commandesUrgentes.length} urgente${stats.commandesUrgentes.length > 1 ? "s" : ""}` : null}
            icon="📦"
            color={EPJ.blue}
            onClick={() => onGoto && onGoto("module:commandes")}
          />
          <Kpi
            label="Matériel en retard"
            value={stats.commandesEnRetard.length}
            icon="⏰"
            color={EPJ.red}
            alert={stats.commandesEnRetard.length > 0}
            onClick={() => onGoto && onGoto("module:commandes")}
          />
          <Kpi
            label="Outils sortis"
            value={stats.outilsSortis.length}
            sub={stats.outilsEnPanne.length > 0
              ? `${stats.outilsEnPanne.length} en panne` : null}
            icon="🔧"
            color={EPJ.green}
            onClick={() => onGoto && onGoto("module:parc-machines")}
          />
        </div>

        {/* 2 COLONNES (1 col sur mobile) */}
        <div className="dash-cols">

          {/* COLONNE GAUCHE : À suivre */}
          <div className="dash-col">

            {/* Réserves en retard */}
            {stats.reservesEnRetard.length > 0 && (
              <div className="dash-card">
                <div className="dash-card-title">
                  <span style={{ color: EPJ.red }}>⚠</span> Réserves en retard
                </div>
                {stats.reservesEnRetard.slice(0, 5).map(r => (
                  <ReserveLine key={r._id} reserve={r} onClick={() => onGoto && onGoto("module:reserves")}/>
                ))}
                {stats.reservesEnRetard.length > 5 && (
                  <MoreLink
                    count={stats.reservesEnRetard.length - 5}
                    onClick={() => onGoto && onGoto("module:reserves")}
                  />
                )}
              </div>
            )}

            {/* Réserves non attribuées */}
            {stats.reservesNonAttribuees.length > 0 && (
              <div className="dash-card">
                <div className="dash-card-title">
                  <span style={{ color: EPJ.orange }}>👤</span> Réserves non attribuées
                </div>
                {stats.reservesNonAttribuees.slice(0, 5).map(r => (
                  <ReserveLine key={r._id} reserve={r} onClick={() => onGoto && onGoto("module:reserves")}/>
                ))}
                {stats.reservesNonAttribuees.length > 5 && (
                  <MoreLink
                    count={stats.reservesNonAttribuees.length - 5}
                    onClick={() => onGoto && onGoto("module:reserves")}
                  />
                )}
              </div>
            )}

            {/* Commandes en attente/retard */}
            {stats.commandesEnAttente.length > 0 && (
              <div className="dash-card">
                <div className="dash-card-title">
                  <span style={{ color: EPJ.blue }}>📦</span> Commandes en cours
                </div>
                {stats.commandesEnAttente.slice(0, 6).map(cmd => (
                  <CommandeLine key={cmd._id || cmd.id} commande={cmd}
                                users={users}
                                onClick={() => onGoto && onGoto("module:commandes")}/>
                ))}
                {stats.commandesEnAttente.length > 6 && (
                  <MoreLink
                    count={stats.commandesEnAttente.length - 6}
                    onClick={() => onGoto && onGoto("module:commandes")}
                  />
                )}
              </div>
            )}

            {/* Si rien d'actionnable */}
            {stats.reservesEnRetard.length === 0 &&
             stats.reservesNonAttribuees.length === 0 &&
             stats.commandesEnAttente.length === 0 && (
              <div className="dash-card" style={{
                background: `${EPJ.green}0D`,
                borderColor: `${EPJ.green}55`,
              }}>
                <div style={{
                  textAlign: "center", padding: "18px 0",
                  color: EPJ.green, fontWeight: 600,
                }}>
                  ✓ Tout est sous contrôle — rien ne nécessite ton attention immédiate.
                </div>
              </div>
            )}
          </div>

          {/* COLONNE DROITE */}
          <div className="dash-col">

            {/* Top chantiers */}
            {topChantiers.length > 0 && (
              <div className="dash-card">
                <div className="dash-card-title">
                  <span style={{ color: EPJ.orange }}>🏗</span> Chantiers actifs
                </div>
                {topChantiers.map(c => (
                  <div key={c.num} className="chantier-line">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: EPJ.gray900 }}>
                        {c.num} — {c.nom}
                      </div>
                      <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 2 }}>
                        {c.total} réserve{c.total > 1 ? "s" : ""} ouverte{c.total > 1 ? "s" : ""}
                        {c.bloquantes > 0 && (
                          <span style={{ color: EPJ.red, fontWeight: 600 }}>
                            {" · "}{c.bloquantes} bloquante{c.bloquantes > 1 ? "s" : ""}
                          </span>
                        )}
                        {c.enRetard > 0 && (
                          <span style={{ color: EPJ.red, fontWeight: 600 }}>
                            {" · "}{c.enRetard} en retard
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="chantier-count" style={{
                      background: c.bloquantes > 0 ? EPJ.red :
                                  c.enRetard > 0 ? EPJ.orange : EPJ.blue,
                    }}>
                      {c.total}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Activité récente */}
            {activiteRecente.length > 0 && (
              <div className="dash-card">
                <div className="dash-card-title">
                  <span style={{ color: EPJ.gray700 }}>📅</span> Activité récente
                </div>
                <div className="activity-list">
                  {activiteRecente.slice(0, 10).map((evt, idx) => (
                    <div key={idx} className="activity-item"
                         onClick={evt.onClick}>
                      <div className="activity-icon" style={{ background: `${evt.color}20`, color: evt.color }}>
                        {evt.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="activity-label">{evt.label}</div>
                        <div className="activity-sub">{evt.sub}</div>
                      </div>
                      <div className="activity-time">{fmtDateTime(evt.date)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
//  Sous-composants
// ═══════════════════════════════════════════════════════════

function AlertsBanner({ stats, onGoto }) {
  const alerts = [];
  if (stats.commandesAValider.length > 0) {
    alerts.push({
      icon: "⏳",
      text: `${stats.commandesAValider.length} commande${stats.commandesAValider.length > 1 ? "s" : ""} à valider`,
      color: "#E65100",
      action: () => onGoto && onGoto("module:commandes"),
    });
  }
  if (stats.reservesEnRetard.length > 0) {
    alerts.push({
      icon: "⚠",
      text: `${stats.reservesEnRetard.length} réserve${stats.reservesEnRetard.length > 1 ? "s" : ""} en retard`,
      color: EPJ.red,
      action: () => onGoto && onGoto("module:reserves"),
    });
  }
  if (stats.commandesEnRetard.length > 0) {
    alerts.push({
      icon: "⏰",
      text: `${stats.commandesEnRetard.length} commande${stats.commandesEnRetard.length > 1 ? "s" : ""} dépassée${stats.commandesEnRetard.length > 1 ? "s" : ""}`,
      color: EPJ.red,
      action: () => onGoto && onGoto("module:commandes"),
    });
  }
  if (stats.commandesUrgentes.length > 0) {
    alerts.push({
      icon: "🚨",
      text: `${stats.commandesUrgentes.length} commande${stats.commandesUrgentes.length > 1 ? "s" : ""} urgente${stats.commandesUrgentes.length > 1 ? "s" : ""}`,
      color: EPJ.orange,
      action: () => onGoto && onGoto("module:commandes"),
    });
  }
  if (stats.reservesBloquantes.length > 0) {
    alerts.push({
      icon: "🔴",
      text: `${stats.reservesBloquantes.length} réserve${stats.reservesBloquantes.length > 1 ? "s" : ""} bloquante${stats.reservesBloquantes.length > 1 ? "s" : ""}`,
      color: EPJ.red,
      action: () => onGoto && onGoto("module:reserves"),
    });
  }
  if (stats.outilsEnPanne.length > 0) {
    alerts.push({
      icon: "🔧",
      text: `${stats.outilsEnPanne.length} outil${stats.outilsEnPanne.length > 1 ? "s" : ""} en panne`,
      color: EPJ.orange,
      action: () => onGoto && onGoto("module:parc-machines"),
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="alerts-row">
      {alerts.map((a, i) => (
        <button key={i} onClick={a.action} className="alert-chip"
                style={{ borderColor: `${a.color}88`, background: `${a.color}10`, color: a.color }}>
          <span style={{ fontSize: 14 }}>{a.icon}</span>
          <span style={{ fontWeight: 700 }}>{a.text}</span>
          <span style={{ opacity: 0.6, fontSize: 12 }}>→</span>
        </button>
      ))}
    </div>
  );
}

function Kpi({ label, value, sub, icon, color, alert, onClick }) {
  return (
    <div className="kpi" onClick={onClick} style={{
      cursor: onClick ? "pointer" : "default",
      borderLeft: `3px solid ${color}`,
      boxShadow: alert ? `0 0 0 2px ${color}33` : undefined,
    }}>
      <div className="kpi-header">
        <div className="kpi-icon" style={{ background: `${color}18`, color }}>
          {icon}
        </div>
        <div className="kpi-label">{label}</div>
      </div>
      <div className="kpi-value" style={{ color: alert ? EPJ.red : EPJ.gray900 }}>
        {value}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

function ReserveLine({ reserve, onClick }) {
  const bloquante = reserve.priorite === "bloquante";
  const retard = isLate(reserve.dateLimiteLevee) || (reserve.rdvPris && isLate(reserve.dateRdv));
  return (
    <div className="mini-line" onClick={onClick}>
      <div style={{
        width: 6, height: 36, borderRadius: 3,
        background: bloquante ? EPJ.red : (retard ? EPJ.orange : EPJ.blue),
        flexShrink: 0,
      }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: EPJ.gray900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {reserve.numReserve || "—"} · {reserve.titre || "—"}
        </div>
        <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 1 }}>
          {reserve.chantierNom || "—"}
          {reserve.affecteAUserNom && ` · ${reserve.affecteAUserNom}`}
        </div>
      </div>
      {retard && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: EPJ.red,
          background: `${EPJ.red}12`, padding: "3px 6px", borderRadius: 4,
          whiteSpace: "nowrap",
        }}>EN RETARD</span>
      )}
    </div>
  );
}

function CommandeLine({ commande: cmd, users, onClick }) {
  const inRetard = cmd.dateReception && isLate(cmd.dateReception);
  const aValider = cmd.statut === "En attente de validation";
  const color = cmd.urgent ? EPJ.red : inRetard ? EPJ.orange : aValider ? "#E65100" : EPJ.blue;
  return (
    <div className="mini-line" onClick={onClick}>
      <div style={{
        width: 6, height: 36, borderRadius: 3, background: color, flexShrink: 0,
      }}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: EPJ.gray900, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {cmd.num || "—"}
          {cmd.urgent && <span style={{ color: EPJ.red, marginLeft: 6 }}>🚨</span>}
        </div>
        <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 1 }}>
          {cmd.statut || "—"}
          {cmd.chantier && ` · ${cmd.chantier}`}
          {cmd.user && ` · ${cmd.user}`}
        </div>
      </div>
      {inRetard && (
        <span style={{
          fontSize: 9, fontWeight: 700, color: EPJ.red,
          background: `${EPJ.red}12`, padding: "3px 6px", borderRadius: 4,
          whiteSpace: "nowrap",
        }}>DÉPASSÉE</span>
      )}
    </div>
  );
}

function MoreLink({ count, onClick }) {
  return (
    <div onClick={onClick} style={{
      textAlign: "center", fontSize: 11, fontWeight: 600,
      color: EPJ.blue, padding: "8px 0", marginTop: 4,
      cursor: "pointer", borderTop: `1px dashed ${EPJ.gray200}`,
    }}>
      + {count} autre{count > 1 ? "s" : ""} →
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════════════════════
const dashboardCss = `
.dash-root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 12px 6px 40px;
  font-family: ${font.body};
}
.back-btn {
  background: transparent; border: none; color: ${EPJ.gray700};
  font-size: 13px; cursor: pointer; padding: 6px 10px 6px 0;
  font-family: ${font.body};
}
.dash-header { margin-bottom: 18px; }
.dash-title-row {
  display: flex; align-items: flex-end; justify-content: space-between;
  gap: 12px; flex-wrap: wrap;
}
.dash-salutation {
  font-size: 13px; color: ${EPJ.gray500}; font-weight: 500;
}
.dash-title {
  font-family: ${font.display}; font-size: 30px; font-weight: 400;
  color: ${EPJ.gray900}; letter-spacing: -0.02em; line-height: 1.1;
  margin-top: 2px;
}
.dash-date {
  font-size: 12px; color: ${EPJ.gray500}; margin-top: 4px;
  text-transform: capitalize;
}
.dash-badges { display: flex; gap: 6px; }
.dash-badge {
  font-size: 10px; font-weight: 700; padding: 4px 10px; border-radius: 12px;
  letter-spacing: 0.5px; text-transform: uppercase;
}
.dash-badge-blue { background: ${EPJ.blue}14; color: ${EPJ.blue}; }

.alerts-row {
  display: flex; gap: 8px; margin-bottom: 18px; flex-wrap: wrap;
}
.alert-chip {
  display: flex; align-items: center; gap: 7px;
  border: 1.5px solid; border-radius: 24px;
  padding: 8px 14px; cursor: pointer;
  font-family: ${font.body}; font-size: 12px;
  transition: transform 0.1s;
}
.alert-chip:hover { transform: translateY(-1px); }

.dash-section-title {
  font-size: 11px; font-weight: 700; color: ${EPJ.gray500};
  text-transform: uppercase; letter-spacing: 0.7px;
  margin: 4px 0 10px 2px;
}

.kpi-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}
@media (min-width: 640px) {
  .kpi-grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 960px) {
  .kpi-grid { grid-template-columns: repeat(6, 1fr); gap: 12px; }
}
.kpi {
  background: #fff;
  border: 1px solid ${EPJ.gray200};
  border-radius: 10px;
  padding: 12px;
  transition: all 0.15s;
}
.kpi:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(0,0,0,.08);
}
.kpi-header {
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 6px;
}
.kpi-icon {
  width: 26px; height: 26px; border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-size: 14px; flex-shrink: 0;
}
.kpi-label {
  font-size: 10px; font-weight: 600; color: ${EPJ.gray500};
  letter-spacing: 0.3px; text-transform: uppercase;
  line-height: 1.2;
}
.kpi-value {
  font-size: 28px; font-weight: 800; line-height: 1;
  margin-top: 2px;
}
.kpi-sub {
  font-size: 10px; color: ${EPJ.gray500};
  margin-top: 4px;
}

.dash-cols {
  display: grid; grid-template-columns: 1fr; gap: 14px;
}
@media (min-width: 960px) {
  .dash-cols { grid-template-columns: 1fr 1fr; gap: 18px; }
}
.dash-col {
  display: flex; flex-direction: column; gap: 12px;
}
.dash-card {
  background: #fff;
  border: 1px solid ${EPJ.gray200};
  border-radius: 10px;
  padding: 14px 12px;
}
.dash-card-title {
  display: flex; align-items: center; gap: 8px;
  font-size: 13px; font-weight: 700; color: ${EPJ.gray900};
  margin-bottom: 10px;
}

.mini-line {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid ${EPJ.gray100};
  cursor: pointer;
  transition: background 0.1s;
}
.mini-line:hover { background: ${EPJ.gray50}; }
.mini-line:last-child { border-bottom: none; }

.chantier-line {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid ${EPJ.gray100};
}
.chantier-line:last-child { border-bottom: none; }
.chantier-count {
  width: 32px; height: 32px; border-radius: 8px;
  color: #fff; font-weight: 800; font-size: 14px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.activity-list {
  display: flex; flex-direction: column;
}
.activity-item {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid ${EPJ.gray100};
  cursor: pointer;
}
.activity-item:hover { background: ${EPJ.gray50}; }
.activity-item:last-child { border-bottom: none; }
.activity-icon {
  width: 30px; height: 30px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center;
  font-size: 13px; flex-shrink: 0;
}
.activity-label {
  font-size: 12px; font-weight: 600; color: ${EPJ.gray900};
  line-height: 1.3;
}
.activity-sub {
  font-size: 10px; color: ${EPJ.gray500};
  margin-top: 1px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.activity-time {
  font-size: 10px; color: ${EPJ.gray500};
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}
`;

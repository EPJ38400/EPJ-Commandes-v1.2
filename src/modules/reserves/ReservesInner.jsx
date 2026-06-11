// ═══════════════════════════════════════════════════════════════
//  ReservesInner — Dashboard + liste filtrable
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { app, db } from "../../firebase";
import { EPJ, font, radius, space, fontSize, fontWeight } from "../../core/theme";
import { useAuth } from "../../core/AuthContext";
import { useData } from "../../core/DataContext";
import { can } from "../../core/permissions";
import { useViewport } from "../../core/useViewport";
import { ModuleSubHeader } from "../../core/components/ModuleSubHeader";
import { StatCard } from "../../core/components/StatCard";
import { Banner } from "../../core/components/Banner";
import { Button } from "../../core/components/Button";
import { Field } from "../../core/components/Field";
import { DataTable } from "../../core/components/DataTable";
import { Badge } from "../../core/components/Badge";
import {
  RESERVE_STATUTS, RESERVE_PRIORITES,
  formatDate, isReserveEnRetard, isRdvEnRetard,
} from "./reservesUtils";

const fnForceSyncGmail = httpsCallable(getFunctions(app, "europe-west1"), "forceSyncGmail");

export function ReservesInner({ onCreate, onSelect, onOpenMailsAClasser, onExitModule }) {
  const { user } = useAuth();
  const isPwa = useViewport() === "mobile";
  const data = useData();
  const reserves = data.reserves || [];
  const chantiers = data.chantiers || [];
  const users = data.users || [];
  const rolesConfig = data.rolesConfig;

  // ─── v1.13.0 — Brique mail : compteur live des mails à classer ──
  const [nbMailsAClasser, setNbMailsAClasser] = useState(0);
  useEffect(() => {
    const q = query(
      collection(db, "reserveMailsAClasser"),
      where("statut", "==", "en_attente"),
    );
    const unsub = onSnapshot(q, (snap) => setNbMailsAClasser(snap.size));
    return unsub;
  }, []);

  const viewScope = can(user, "reserves-quitus", "view", rolesConfig);
  const canCreate = !!can(user, "reserves-quitus", "create", rolesConfig);
  const canSeeAll = viewScope === "all";

  // ─── Brique mail : "Forcer le sync" — Admin + Direction uniquement ──
  // can(...,"validate") === "all" cible exactement Admin et Direction
  // (les autres rôles ont validate=false ou un scope "own_chantiers").
  const canForceSync = can(user, "reserves-quitus", "validate", rolesConfig) === "all";
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMsg, setSyncMsg] = useState("");

  const handleForceSync = async () => {
    setSyncBusy(true);
    setSyncMsg("");
    try {
      const { data } = await fnForceSyncGmail();
      if (data?.skipped) {
        setSyncMsg(data.skipped === "inactif" ? "Aspiration désactivée (config)." : "Config mail absente.");
      } else {
        const n = data?.nbNouveaux ?? 0;
        setSyncMsg(
          (n === 0 ? "Sync OK — aucun nouveau mail." : `Sync OK — ${n} mail(s) ramené(s).`) +
          (data?.fullResync ? " (resync complet)" : "")
        );
      }
    } catch (e) {
      setSyncMsg(`Échec : ${e?.message || "erreur inconnue"}`);
    } finally {
      setSyncBusy(false);
    }
  };

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

  // Options de filtres (Field as="select")
  const statutOptions = [
    { value: "", label: "Tous statuts" },
    ...Object.entries(RESERVE_STATUTS).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` })),
  ];
  const prioriteOptions = [
    { value: "", label: "Toutes priorités" },
    ...Object.entries(RESERVE_PRIORITES).map(([k, v]) => ({ value: k, label: `${v.icon} ${v.label}` })),
  ];
  const chantierOptions = [
    { value: "", label: "Tous chantiers" },
    ...chantiersDispo.map(n => ({ value: n, label: n })),
  ];

  // Action principale — header (desktop) / pleine largeur (PWA)
  const addBtn = canCreate ? (
    <Button variant="primary" icon="+" onClick={() => onCreate()} full={isPwa}>
      Nouvelle réserve
    </Button>
  ) : null;

  // Colonnes DataTable (desktop) — statut/priorité/retard via <Badge>
  const columns = [
    {
      key: "numReserve", header: "Réf", width: 120,
      render: (v) => <span style={{ fontFamily: font.mono, fontSize: fontSize.sm }}>{v || "—"}</span>,
    },
    {
      key: "titre", header: "Réserve",
      render: (v, row) => (
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontWeight: fontWeight.medium, color: EPJ.gray900,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{v || "(sans titre)"}</div>
          <div style={{
            fontSize: fontSize.sm, color: EPJ.gray500, marginTop: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {row.chantierNum ? `📍 ${row.chantierNum}` : ""}
            {row.affecteAUserId ? ` · 👤 ${getUserName(row.affecteAUserId)}` : ""}
          </div>
        </div>
      ),
    },
    {
      key: "statut", header: "Statut", width: 160,
      render: (v) => {
        const st = RESERVE_STATUTS[v] || RESERVE_STATUTS.creee;
        return <Badge status={v} icon={st.icon} label={st.label} />;
      },
    },
    {
      key: "priorite", header: "Priorité", width: 120,
      render: (v) => v === "bloquante"
        ? <Badge tone="danger" icon="🔴" label="Bloquante" />
        : <span style={{ color: EPJ.gray400 }}>—</span>,
    },
    {
      key: "dateLimite", header: "Échéance", width: 160,
      render: (v, row) => {
        const retard = isReserveEnRetard(row) || isRdvEnRetard(row);
        return (
          <span style={{ display: "inline-flex", alignItems: "center", gap: space.sm }}>
            <span style={{ fontVariantNumeric: "tabular-nums", color: v ? EPJ.gray900 : EPJ.gray400 }}>
              {v ? formatDate(v) : "—"}
            </span>
            {retard && <Badge tone="danger" icon="⏰" label="Retard" />}
          </span>
        );
      },
    },
  ];

  // Carte PWA (bascule interne du DataTable) — vignette + badges
  const renderCard = (row) => {
    const st = RESERVE_STATUTS[row.statut] || RESERVE_STATUTS.creee;
    const retard = isReserveEnRetard(row) || isRdvEnRetard(row);
    return (
      <div style={{ display: "flex", gap: space.md, alignItems: "flex-start" }}>
        {row.photoAvant ? (
          <img src={row.photoAvant} alt="" style={{
            width: 48, height: 48, borderRadius: radius.sm, objectFit: "cover",
            flexShrink: 0, border: `1px solid ${EPJ.gray200}`,
          }}/>
        ) : (
          <div style={{
            width: 48, height: 48, borderRadius: radius.sm, background: EPJ.gray100,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 20, flexShrink: 0,
          }}>📝</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: font.mono, fontSize: fontSize.sm, color: EPJ.gray500 }}>
            {row.numReserve || "—"}
          </div>
          <div style={{
            fontSize: fontSize.base, fontWeight: fontWeight.medium, color: EPJ.gray900, marginTop: 1,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{row.titre || "(sans titre)"}</div>
          <div style={{ display: "flex", alignItems: "center", gap: space.sm, flexWrap: "wrap", marginTop: space.sm }}>
            <Badge status={row.statut} icon={st.icon} label={st.label} />
            {row.priorite === "bloquante" && <Badge tone="danger" icon="🔴" label="Bloquante" />}
            {retard && <Badge tone="danger" icon="⏰" label="Retard" />}
          </div>
          <div style={{
            fontSize: fontSize.xs, color: EPJ.gray500, marginTop: space.sm,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            {row.chantierNum && <span>📍 {row.chantierNum}</span>}
            {row.affecteAUserId && <span> · 👤 {getUserName(row.affecteAUserId)}</span>}
            {row.dateLimite && <span> · 🎯 {formatDate(row.dateLimite)}</span>}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div style={{ paddingTop: space.md, paddingBottom: space.xxl }}>
      <ModuleSubHeader
        moduleName="Réserves"
        title="Réserves & quitus"
        subtitle="Suivi SAV & garantie"
        onBackToModuleHome={null}
        rightSlot={!isPwa ? addBtn : null}
      />
      {isPwa && addBtn && <div style={{ marginBottom: space.lg }}>{addBtn}</div>}

      {/* KPIs */}
      <div style={{
        display: "grid",
        gridTemplateColumns: isPwa ? "1fr 1fr" : "repeat(4, 1fr)",
        gap: space.md, marginBottom: space.lg,
      }}>
        <StatCard label="Bloquantes" value={kpi.bloquantes} />
        <StatCard label="En cours" value={kpi.enCours} />
        <StatCard label="Levées /mois" value={kpi.leveesMois} />
        <StatCard label="Retards" value={kpi.enRetard} />
      </div>

      {/* Mails à classer (v1.13.0) */}
      {nbMailsAClasser > 0 && (
        <Banner
          tone="warning"
          icon="📥"
          title={`${nbMailsAClasser} mail(s) à classer`}
          text="Rattacher à une réserve ou créer une nouvelle réserve"
          onClick={onOpenMailsAClasser}
        />
      )}

      {/* Forcer le sync mails SAV — Admin + Direction */}
      {canForceSync && (
        <div style={{ marginBottom: space.md }}>
          <Button variant="secondary" full onClick={handleForceSync} loading={syncBusy}>
            🔄 Forcer le sync mails
          </Button>
          {syncMsg && (
            <div style={{ marginTop: space.xs + 2, fontSize: fontSize.xs, color: EPJ.gray500, fontFamily: font.body }}>
              {syncMsg}
            </div>
          )}
        </div>
      )}

      {/* Bannière retards */}
      {kpi.enRetard > 0 && (
        <Banner
          tone="danger"
          icon="⚠"
          title={`${kpi.enRetard} réserve(s) en retard`}
          text="Action requise"
        />
      )}

      {/* Mode switcher — chips */}
      {canSeeAll && (
        <div style={{ display: "flex", gap: space.sm, marginBottom: space.md }}>
          <Button variant={mode === "mine" ? "secondary" : "ghost"} onClick={() => setMode("mine")}>
            Mes réserves
          </Button>
          <Button variant={mode === "all" ? "secondary" : "ghost"} onClick={() => setMode("all")}>
            Toutes
          </Button>
        </div>
      )}

      {/* Filtres */}
      <div style={{
        display: "flex", flexDirection: isPwa ? "column" : "row",
        gap: space.md, marginBottom: space.lg, alignItems: isPwa ? "stretch" : "center",
      }}>
        <div style={{ flex: 1 }}>
          <Field as="select" value={statutFilter}
            onChange={e => setStatutFilter(e.target.value)} options={statutOptions} />
        </div>
        <div style={{ flex: 1 }}>
          <Field as="select" value={prioriteFilter}
            onChange={e => setPrioriteFilter(e.target.value)} options={prioriteOptions} />
        </div>
        {chantiersDispo.length > 1 && (
          <div style={{ flex: 1 }}>
            <Field as="select" value={chantierFilter}
              onChange={e => setChantierFilter(e.target.value)} options={chantierOptions} />
          </div>
        )}
      </div>

      {/* Liste */}
      <DataTable
        columns={columns}
        rows={visibles}
        keyField="_id"
        onRowClick={(row) => onSelect(row._id)}
        renderCard={renderCard}
        empty={{
          icon: "📂",
          title: `Aucune réserve${mode === "mine" ? " attribuée" : ""}`,
          text: "Aucune réserve ne correspond aux filtres actuels.",
        }}
      />
    </div>
  );
}

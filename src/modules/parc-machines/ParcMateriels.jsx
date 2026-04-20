// ═══════════════════════════════════════════════════════════════
//  ParcMateriels — Liste du catalogue avec photos, recherche, filtres
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";
import {
  OUTIL_STATUTS, computeOutilStatut, findSortieEnCours,
  getCategorieIcon, getCategorieLabel,
} from "./parcUtils";

export function ParcMateriels({ onSelectOutil }) {
  const { outils, outillageSorties, users, outillageCategories } = useData();
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // "" | "disponible" | "sorti" | "en_retard"

  const enriched = useMemo(() => {
    return outils.map(o => ({
      ...o,
      effectiveStatus: computeOutilStatut(o, outillageSorties),
      sortieEnCours: findSortieEnCours(o._id, outillageSorties),
    }));
  }, [outils, outillageSorties]);

  const filtered = useMemo(() => {
    let result = enriched;
    if (catFilter) result = result.filter(o => o.categorieId === catFilter);
    if (statusFilter) result = result.filter(o => o.effectiveStatus === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        (o.ref || "").toLowerCase().includes(q) ||
        (o.nom || "").toLowerCase().includes(q) ||
        (o.marque || "").toLowerCase().includes(q) ||
        (o.numSerie || "").toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => (a.ref || "").localeCompare(b.ref || ""));
  }, [enriched, catFilter, statusFilter, search]);

  return (
    <div>
      {/* Barre de recherche */}
      <input
        className="epj-input"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Rechercher par référence, nom, marque…"
        style={{ marginBottom: 8 }}
      />

      {/* Filtres catégorie */}
      <div style={{
        display: "flex", gap: 5, flexWrap: "wrap",
        marginBottom: 8, paddingBottom: 4,
      }}>
        <FilterChip active={catFilter === ""} onClick={() => setCatFilter("")}>Toutes</FilterChip>
        {outillageCategories.filter(c => c.actif !== false).map(cat => (
          <FilterChip key={cat.id} active={catFilter === cat.id} onClick={() => setCatFilter(cat.id)}>
            {cat.icon} {cat.label}
          </FilterChip>
        ))}
      </div>

      {/* Filtres statut */}
      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
        <FilterChip active={statusFilter === ""} onClick={() => setStatusFilter("")}>Tous statuts</FilterChip>
        {["disponible", "sorti", "en_retard", "maintenance", "hors_service"].map(st => (
          <FilterChip
            key={st}
            active={statusFilter === st}
            onClick={() => setStatusFilter(st)}
            color={OUTIL_STATUTS[st].color}
          >
            {OUTIL_STATUTS[st].icon} {OUTIL_STATUTS[st].label}
          </FilterChip>
        ))}
      </div>

      {/* Compteur */}
      <div style={{
        fontSize: 10, color: EPJ.gray500, fontWeight: 600,
        letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8,
      }}>
        {filtered.length} outil{filtered.length > 1 ? "s" : ""}
        {(catFilter || statusFilter || search) && ` sur ${outils.length}`}
      </div>

      {/* Liste */}
      {filtered.length === 0 ? (
        <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 13, color: EPJ.gray500 }}>
            {outils.length === 0
              ? "Aucun outil dans le catalogue. Un administrateur doit d'abord en ajouter."
              : "Aucun résultat pour ces filtres."}
          </div>
        </div>
      ) : (
        filtered.map(o => (
          <OutilCard
            key={o._id}
            outil={o}
            users={users}
            categories={outillageCategories}
            onClick={() => onSelectOutil(o._id)}
          />
        ))
      )}
    </div>
  );
}

function OutilCard({ outil, users, categories, onClick }) {
  const st = OUTIL_STATUTS[outil.effectiveStatus] || OUTIL_STATUTS.disponible;
  const emp = outil.sortieEnCours
    ? users.find(u => u.id === outil.sortieEnCours.emprunteurId)
    : null;
  const catLabel = getCategorieLabel(categories, outil.categorieId);
  const catIcon = getCategorieIcon(categories, outil.categorieId);

  return (
    <div
      className="epj-card clickable"
      onClick={onClick}
      style={{
        padding: "12px 14px", marginBottom: 8,
        display: "flex", gap: 12, alignItems: "center",
        borderLeft: `3px solid ${st.color}`,
      }}
    >
      {outil.photoURL ? (
        <img src={outil.photoURL} alt="" style={{
          width: 56, height: 56, borderRadius: 8, objectFit: "cover",
          flexShrink: 0, border: `1px solid ${EPJ.gray200}`,
        }}/>
      ) : (
        <div style={{
          width: 56, height: 56, borderRadius: 8,
          background: EPJ.gray100, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 26, flexShrink: 0,
        }}>{catIcon}</div>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: EPJ.gray900,
          fontFamily: "monospace", marginBottom: 1,
        }}>
          {outil.ref}
        </div>
        <div style={{
          fontSize: 12, color: EPJ.gray700,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{outil.nom}</div>
        <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 2 }}>
          {catLabel}{outil.marque ? ` • ${outil.marque}` : ""}
        </div>
        {emp && outil.effectiveStatus !== "disponible" && (
          <div style={{ fontSize: 10, color: st.color, marginTop: 2, fontWeight: 600 }}>
            👤 {emp.prenom} {emp.nom}
          </div>
        )}
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <span style={{
          fontSize: 9, fontWeight: 700,
          background: `${st.color}20`, color: st.color,
          padding: "3px 7px", borderRadius: 4,
          letterSpacing: 0.3,
        }}>
          {st.icon} {st.label}
        </span>
      </div>
    </div>
  );
}

function FilterChip({ active, onClick, children, color }) {
  const activeColor = color || EPJ.gray900;
  return (
    <button onClick={onClick} style={{
      padding: "5px 9px", borderRadius: 999,
      border: `1px solid ${active ? activeColor : EPJ.gray200}`,
      background: active ? (color ? `${color}15` : activeColor) : EPJ.white,
      color: active ? (color ? color : "#fff") : EPJ.gray700,
      fontSize: 10, fontWeight: 600, cursor: "pointer",
      fontFamily: font.body, whiteSpace: "nowrap",
    }}>
      {children}
    </button>
  );
}

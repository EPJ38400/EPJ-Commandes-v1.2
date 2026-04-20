// ═══════════════════════════════════════════════════════════════
//  ParcMateriels — Navigation en 2 niveaux
//  1. Grille 3 colonnes des catégories (+ recherche globale)
//  2. Liste filtrée d'une catégorie sélectionnée
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
  const [selectedCatId, setSelectedCatId] = useState(null); // null = vue grille
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const enriched = useMemo(() => {
    return outils.map(o => ({
      ...o,
      effectiveStatus: computeOutilStatut(o, outillageSorties),
      sortieEnCours: findSortieEnCours(o._id, outillageSorties),
    }));
  }, [outils, outillageSorties]);

  // Liste des catégories actives, triées par ordre
  const activeCategories = useMemo(() => {
    return outillageCategories
      .filter(c => c.actif !== false)
      .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
  }, [outillageCategories]);

  // Comptage outils par catégorie (avec stats disponibles/sortis)
  const catStats = useMemo(() => {
    const map = {};
    activeCategories.forEach(c => { map[c.id] = { total: 0, dispo: 0, sortis: 0, retard: 0 }; });
    enriched.forEach(o => {
      const cid = o.categorieId;
      if (!map[cid]) return;
      map[cid].total++;
      if (o.effectiveStatus === "disponible" || o.effectiveStatus === "affecte") map[cid].dispo++;
      else if (o.effectiveStatus === "sorti") map[cid].sortis++;
      else if (o.effectiveStatus === "en_retard") map[cid].retard++;
    });
    return map;
  }, [enriched, activeCategories]);

  // Outils recherchés (recherche globale, toutes catégories)
  const globalSearchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return enriched
      .filter(o =>
        (o.ref || "").toLowerCase().includes(q) ||
        (o.nom || "").toLowerCase().includes(q) ||
        (o.marque || "").toLowerCase().includes(q) ||
        (o.numSerie || "").toLowerCase().includes(q) ||
        (o.codeBarres || "").toLowerCase().includes(q)
      )
      .sort((a, b) => (a.ref || "").localeCompare(b.ref || ""));
  }, [enriched, search]);

  // ═══════════════════════════════════════════════════════════
  // VUE 2 : Liste d'une catégorie sélectionnée
  // ═══════════════════════════════════════════════════════════
  if (selectedCatId) {
    const category = outillageCategories.find(c => c.id === selectedCatId);
    if (!category) {
      // Catégorie introuvable, retour à la grille
      setSelectedCatId(null);
      return null;
    }

    let filtered = enriched.filter(o => o.categorieId === selectedCatId);
    if (statusFilter) filtered = filtered.filter(o => o.effectiveStatus === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(o =>
        (o.ref || "").toLowerCase().includes(q) ||
        (o.nom || "").toLowerCase().includes(q) ||
        (o.marque || "").toLowerCase().includes(q) ||
        (o.numSerie || "").toLowerCase().includes(q)
      );
    }
    filtered.sort((a, b) => (a.ref || "").localeCompare(b.ref || ""));

    const totalCat = enriched.filter(o => o.categorieId === selectedCatId).length;

    return (
      <div>
        {/* Header catégorie */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          marginBottom: 12,
        }}>
          <button
            onClick={() => { setSelectedCatId(null); setSearch(""); setStatusFilter(""); }}
            style={catBackBtnStyle}
          >← Catégories</button>
          <div style={{
            width: 40, height: 40, borderRadius: 8,
            background: `${EPJ.blue}12`, color: EPJ.blue,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, flexShrink: 0,
          }}>{category.icon}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 15, fontWeight: 700, color: EPJ.gray900,
              lineHeight: 1.2,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>{category.label}</div>
            <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 1 }}>
              {totalCat} outil{totalCat > 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* Recherche dans la catégorie */}
        <input
          className="epj-input"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Rechercher dans cette catégorie…"
          style={{ marginBottom: 8 }}
        />

        {/* Filtres statut */}
        <div style={{
          display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12,
        }}>
          <FilterChip active={statusFilter === ""} onClick={() => setStatusFilter("")}>
            Tous statuts
          </FilterChip>
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

        {/* Compteur + liste */}
        <div style={{
          fontSize: 10, color: EPJ.gray500, fontWeight: 600,
          letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8,
        }}>
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
          {(search || statusFilter) && ` sur ${totalCat}`}
        </div>

        {filtered.length === 0 ? (
          <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
            <div style={{ fontSize: 13, color: EPJ.gray500 }}>
              {totalCat === 0
                ? "Aucun outil dans cette catégorie."
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

  // ═══════════════════════════════════════════════════════════
  // VUE 1 : Grille des catégories (+ recherche globale)
  // ═══════════════════════════════════════════════════════════
  return (
    <div>
      {/* Recherche globale */}
      <input
        className="epj-input"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Rechercher dans tout le parc…"
        style={{ marginBottom: 14 }}
      />

      {/* Si recherche active → résultats globaux */}
      {globalSearchResults !== null ? (
        <>
          <div style={{
            fontSize: 10, color: EPJ.gray500, fontWeight: 600,
            letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8,
          }}>
            {globalSearchResults.length} résultat{globalSearchResults.length > 1 ? "s" : ""} sur {enriched.length}
          </div>
          {globalSearchResults.length === 0 ? (
            <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 13, color: EPJ.gray500 }}>
                Aucun résultat dans le catalogue.
              </div>
            </div>
          ) : (
            globalSearchResults.map(o => (
              <OutilCard
                key={o._id}
                outil={o}
                users={users}
                categories={outillageCategories}
                onClick={() => onSelectOutil(o._id)}
                showCategory
              />
            ))
          )}
        </>
      ) : (
        /* Grille catégories (mode normal) */
        <>
          {activeCategories.length === 0 ? (
            <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
              <div style={{ fontSize: 13, color: EPJ.gray500, lineHeight: 1.5 }}>
                Aucune catégorie configurée. Un admin doit d'abord les importer via Admin → Catalogue outillage.
              </div>
            </div>
          ) : (
            <>
              <div style={{
                fontSize: 10, color: EPJ.gray500, fontWeight: 600,
                letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 10,
              }}>
                {activeCategories.length} catégories — {enriched.length} outils
              </div>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 8,
              }}>
                {activeCategories.map(cat => {
                  const stats = catStats[cat.id] || { total: 0, dispo: 0, sortis: 0, retard: 0 };
                  return (
                    <CategoryTile
                      key={cat.id}
                      category={cat}
                      stats={stats}
                      onClick={() => setSelectedCatId(cat.id)}
                    />
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tuile catégorie ─────────────────────────────────────────
function CategoryTile({ category, stats, onClick }) {
  const empty = stats.total === 0;
  return (
    <div
      onClick={onClick}
      style={{
        background: EPJ.white,
        border: `1px solid ${EPJ.gray200}`,
        borderRadius: 12,
        padding: "14px 8px 10px",
        cursor: empty ? "default" : "pointer",
        transition: "transform .15s ease, box-shadow .15s ease, border-color .15s ease",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        aspectRatio: "1",
        opacity: empty ? 0.5 : 1,
        position: "relative",
      }}
      onMouseEnter={(e) => {
        if (empty) return;
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,.06)";
        e.currentTarget.style.borderColor = EPJ.gray300;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "";
        e.currentTarget.style.borderColor = EPJ.gray200;
      }}
    >
      {/* Badge retard si > 0 */}
      {stats.retard > 0 && (
        <div style={{
          position: "absolute", top: 6, right: 6,
          background: EPJ.red, color: "#fff",
          fontSize: 9, fontWeight: 800,
          padding: "2px 6px", borderRadius: 999,
          minWidth: 18, textAlign: "center", lineHeight: 1.3,
        }}>{stats.retard}</div>
      )}

      {/* Icône */}
      <div style={{ fontSize: 34, lineHeight: 1, marginTop: 2 }}>
        {category.icon}
      </div>

      {/* Label */}
      <div style={{
        fontSize: 10.5, fontWeight: 600, color: EPJ.gray900,
        lineHeight: 1.15, marginTop: 6,
        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        overflow: "hidden", wordBreak: "break-word",
        minHeight: "2.3em",
      }}>
        {category.label}
      </div>

      {/* Compteur */}
      <div style={{
        fontSize: 10, color: EPJ.gray500, fontWeight: 600,
        marginTop: 4, display: "flex", gap: 4, alignItems: "center",
        justifyContent: "center", flexWrap: "wrap",
      }}>
        {empty ? (
          <span>—</span>
        ) : (
          <>
            <span style={{
              fontSize: 13, fontWeight: 800, color: EPJ.gray900,
              fontVariantNumeric: "tabular-nums",
            }}>{stats.total}</span>
            {stats.sortis > 0 && (
              <span style={{ color: EPJ.orange, fontWeight: 700 }}>
                · {stats.sortis}↗
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Ligne outil (fiche compacte) ────────────────────────────
function OutilCard({ outil, users, categories, onClick, showCategory }) {
  const st = OUTIL_STATUTS[outil.effectiveStatus] || OUTIL_STATUTS.disponible;
  const emp = outil.sortieEnCours
    ? users.find(u => u.id === outil.sortieEnCours.emprunteurId)
    : null;
  const catIcon = getCategorieIcon(categories, outil.categorieId);
  const catLabel = getCategorieLabel(categories, outil.categorieId);

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
        }}>{outil.ref}</div>
        <div style={{
          fontSize: 12, color: EPJ.gray700,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{outil.nom}</div>
        {showCategory && (
          <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 2 }}>
            {catIcon} {catLabel}{outil.marque ? ` • ${outil.marque}` : ""}
          </div>
        )}
        {!showCategory && outil.marque && (
          <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 2 }}>
            {outil.marque}
          </div>
        )}
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
          padding: "3px 7px", borderRadius: 4, letterSpacing: 0.3,
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
    }}>{children}</button>
  );
}

const catBackBtnStyle = {
  background: EPJ.gray100, border: "none", borderRadius: 10,
  padding: "7px 11px", fontSize: 11, fontWeight: 600,
  color: EPJ.gray700, cursor: "pointer", fontFamily: "Inter, sans-serif",
  whiteSpace: "nowrap", flexShrink: 0,
};

// ═══════════════════════════════════════════════════════════════
//  ParcHistorique — Liste des sorties terminées (rendues)
// ═══════════════════════════════════════════════════════════════
import { useMemo, useState } from "react";
import { EPJ, font } from "../../core/theme";
import { useData } from "../../core/DataContext";
import { getCategorieIcon, formatDate } from "./parcUtils";

export function ParcHistorique() {
  const { outils, outillageSorties, users, chantiers, outillageCategories } = useData();
  const [search, setSearch] = useState("");

  const historique = useMemo(() => {
    let rendus = outillageSorties.filter(s => !!s.dateRetourReelle);
    if (search) {
      const q = search.toLowerCase();
      rendus = rendus.filter(s => {
        const emp = users.find(u => u.id === s.emprunteurId);
        const empName = emp ? `${emp.prenom} ${emp.nom}` : (s.emprunteurNom || "");
        return (
          (s.ref || "").toLowerCase().includes(q) ||
          (s.nom || "").toLowerCase().includes(q) ||
          empName.toLowerCase().includes(q) ||
          (s.chantierNum || "").toLowerCase().includes(q)
        );
      });
    }
    // Plus récent en premier (par date de retour réelle)
    return rendus.sort((a, b) => (b.dateRetourReelle || "").localeCompare(a.dateRetourReelle || ""));
  }, [outillageSorties, users, search]);

  return (
    <div>
      <input
        className="epj-input"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="🔍 Rechercher (référence, employé, chantier…)"
        style={{ marginBottom: 10 }}
      />

      <div style={{
        fontSize: 10, color: EPJ.gray500, fontWeight: 600,
        letterSpacing: 0.4, textTransform: "uppercase", marginBottom: 8,
      }}>
        {historique.length} sortie{historique.length > 1 ? "s" : ""} rendue{historique.length > 1 ? "s" : ""}
      </div>

      {historique.length === 0 ? (
        <div className="epj-card" style={{ padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          <div style={{ fontSize: 13, color: EPJ.gray500 }}>
            {outillageSorties.length === 0
              ? "Aucune sortie enregistrée pour l'instant."
              : search
                ? "Aucun résultat pour cette recherche."
                : "Pas encore de sorties rendues dans l'historique."}
          </div>
        </div>
      ) : (
        historique.map(s => {
          const outil = outils.find(o => o._id === s.outilId);
          const emp = users.find(u => u.id === s.emprunteurId);
          const chantier = s.chantierNum ? chantiers.find(c => c.num === s.chantierNum) : null;
          const isAbime = s.etatRetour === "abime";

          return (
            <div
              key={s._id}
              className="epj-card"
              style={{
                padding: "12px 14px", marginBottom: 8,
                borderLeft: `3px solid ${isAbime ? EPJ.orange : EPJ.green}`,
                display: "flex", gap: 12, alignItems: "flex-start",
              }}
            >
              {outil?.photoURL ? (
                <img src={outil.photoURL} alt="" style={{
                  width: 44, height: 44, borderRadius: 8, objectFit: "cover",
                  flexShrink: 0, border: `1px solid ${EPJ.gray200}`,
                }}/>
              ) : (
                <div style={{
                  width: 44, height: 44, borderRadius: 8,
                  background: EPJ.gray100, display: "flex", alignItems: "center",
                  justifyContent: "center", fontSize: 22, flexShrink: 0,
                }}>{getCategorieIcon(outillageCategories, outil?.categorieId)}</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 12, fontWeight: 700, color: EPJ.gray900, fontFamily: "monospace",
                }}>{s.ref}</div>
                <div style={{
                  fontSize: 11, color: EPJ.gray700,
                  whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                }}>{s.nom}</div>
                <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 2 }}>
                  👤 Sorti par {emp ? `${emp.prenom} ${emp.nom}` : s.emprunteurNom || "—"}
                </div>
                {s.retourParNom && s.retourParUserId !== s.emprunteurId && (
                  <div style={{ fontSize: 10, color: EPJ.green, marginTop: 1, fontWeight: 600 }}>
                    ✅ Rendu par {s.retourParNom}
                  </div>
                )}
                {chantier && (
                  <div style={{ fontSize: 10, color: EPJ.gray500, marginTop: 1 }}>
                    📍 {chantier.num} — {chantier.nom}
                  </div>
                )}
                <div style={{ fontSize: 10, color: EPJ.gray400, marginTop: 3 }}>
                  {formatDate(s.dateSortie)} → {formatDate(s.dateRetourReelle)}
                </div>
                {s.commentaireRetour && (
                  <div style={{
                    fontSize: 10, color: EPJ.gray600, marginTop: 4,
                    fontStyle: "italic", lineHeight: 1.4,
                  }}>💬 {s.commentaireRetour}</div>
                )}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  background: isAbime ? `${EPJ.orange}20` : `${EPJ.green}20`,
                  color: isAbime ? EPJ.orange : EPJ.green,
                  padding: "3px 7px", borderRadius: 4, letterSpacing: 0.3,
                }}>
                  {isAbime ? "⚠ Abîmé" : "✓ Bon état"}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

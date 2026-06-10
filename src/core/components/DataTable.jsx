// ═══════════════════════════════════════════════════════════════
//  <DataTable> — primitive DS-1 (desktop dense ↔ cartes PWA)
//
//  Anatomie (DIRECTION_ARTISTIQUE §5/§6) :
//   • Desktop (>760) : table dense — en-têtes 13px medium gris, lignes
//     44-48px, hover gray50, colonnes chiffres alignées droite tabular-
//     nums, tri au clic en-tête, pagination sobre en pied.
//   • PWA (≤760) : LE MÊME composant rend des cartes (bascule interne
//     via useViewport) — c'est la primitive qui gère table↔carte.
//
//  columns : [{ key, header, align, numeric, render, sortable, width }]
//  États : repos / hover / tri / chargement (squelette) / vide (soigné).
// ═══════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";
import { EPJ, font, radius, space, fontSize, fontWeight, shadow } from "../theme";
import { useViewport } from "../useViewport";

function cellValue(col, row) {
  return col.render ? col.render(row[col.key], row) : row[col.key];
}

function EmptyState({ empty }) {
  if (empty && typeof empty === "object" && !Array.isArray(empty) && empty.$$typeof == null && (empty.title || empty.icon)) {
    // forme { icon, title, text }
    return (
      <div style={{ textAlign: "center", padding: `${space.xxl}px ${space.lg}px`, color: EPJ.gray500 }}>
        {empty.icon != null && <div style={{ fontSize: 28, marginBottom: space.sm, opacity: 0.7 }}>{empty.icon}</div>}
        <div style={{ fontSize: fontSize.md, fontWeight: fontWeight.medium, color: EPJ.gray600 }}>{empty.title}</div>
        {empty.text && <div style={{ fontSize: fontSize.sm, marginTop: space.xs, lineHeight: 1.4 }}>{empty.text}</div>}
      </div>
    );
  }
  return (
    <div style={{ textAlign: "center", padding: `${space.xxl}px ${space.lg}px`, color: EPJ.gray500, fontSize: fontSize.sm }}>
      {empty || "Aucune donnée à afficher."}
    </div>
  );
}

export function DataTable({
  columns = [],
  rows = [],
  keyField = "id",
  onRowClick,
  sortable = true,
  pageSize = 0,
  empty,
  loading = false,
  renderCard,
}) {
  const isPwa = useViewport() === "mobile";
  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [page, setPage] = useState(0);
  const [hoverKey, setHoverKey] = useState(null);

  const sortedRows = useMemo(() => {
    if (!sort.key) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = a[sort.key], vb = b[sort.key];
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "fr", { numeric: true }) * factor;
    });
  }, [rows, sort, columns]);

  const paged = useMemo(() => {
    if (!pageSize) return sortedRows;
    return sortedRows.slice(page * pageSize, page * pageSize + pageSize);
  }, [sortedRows, page, pageSize]);

  const pageCount = pageSize ? Math.ceil(rows.length / pageSize) : 1;

  const toggleSort = (col) => {
    if (!sortable || col.sortable === false) return;
    setPage(0);
    setSort((s) =>
      s.key === col.key
        ? { key: col.key, dir: s.dir === "asc" ? "desc" : "asc" }
        : { key: col.key, dir: "asc" }
    );
  };

  // ─── Chargement (squelette) ───
  if (loading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{
            height: isPwa ? 64 : 46,
            background: EPJ.gray100,
            borderRadius: radius.md,
            animation: "fadeIn .3s ease",
          }} aria-label="Chargement" />
        ))}
      </div>
    );
  }

  // ─── Vide ───
  if (!rows.length) return <EmptyState empty={empty} />;

  // ─── PWA : cartes ───
  if (isPwa) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: space.sm }}>
        {paged.map((row) => {
          const key = row[keyField];
          return (
            <div
              key={key}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{
                background: EPJ.white,
                border: `1px solid ${EPJ.gray200}`,
                borderRadius: radius.lg,
                boxShadow: shadow.sm,
                padding: space.lg,
                cursor: onRowClick ? "pointer" : "default",
                display: "flex", flexDirection: "column", gap: space.sm,
              }}
            >
              {renderCard ? renderCard(row) : columns.map((col) => (
                <div key={col.key} style={{ display: "flex", justifyContent: "space-between", gap: space.md }}>
                  <span style={{ fontSize: fontSize.xs, color: EPJ.gray500, fontWeight: fontWeight.medium }}>
                    {col.header}
                  </span>
                  <span style={{
                    fontSize: fontSize.sm, color: EPJ.gray900, textAlign: "right",
                    fontVariantNumeric: col.numeric ? "tabular-nums" : undefined,
                  }}>
                    {cellValue(col, row)}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
        {pageSize > 0 && pageCount > 1 && (
          <Pager page={page} pageCount={pageCount} setPage={setPage} />
        )}
      </div>
    );
  }

  // ─── Desktop : table dense ───
  return (
    <div style={{
      background: EPJ.white,
      border: `1px solid ${EPJ.gray200}`,
      borderRadius: radius.lg,
      overflow: "hidden",
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: font.body }}>
        <thead>
          <tr>
            {columns.map((col) => {
              const isSorted = sort.key === col.key;
              const canSort = sortable && col.sortable !== false;
              return (
                <th
                  key={col.key}
                  onClick={() => toggleSort(col)}
                  style={{
                    textAlign: col.align || (col.numeric ? "right" : "left"),
                    padding: `${space.md}px ${space.md}px`,
                    fontSize: fontSize.sm,
                    fontWeight: fontWeight.medium,
                    color: EPJ.gray500,
                    borderBottom: `2px solid ${EPJ.gray200}`,
                    cursor: canSort ? "pointer" : "default",
                    userSelect: "none",
                    whiteSpace: "nowrap",
                    width: col.width,
                  }}
                >
                  {col.header}
                  {canSort && (
                    <span style={{ marginLeft: 4, color: isSorted ? EPJ.blue : EPJ.gray300 }} aria-hidden="true">
                      {isSorted ? (sort.dir === "asc" ? "▲" : "▼") : "↕"}
                    </span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {paged.map((row) => {
            const key = row[keyField];
            const hovered = hoverKey === key;
            return (
              <tr
                key={key}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onMouseEnter={() => setHoverKey(key)}
                onMouseLeave={() => setHoverKey(null)}
                style={{
                  background: hovered ? EPJ.gray50 : EPJ.white,
                  cursor: onRowClick ? "pointer" : "default",
                  transition: "background .12s ease",
                }}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      textAlign: col.align || (col.numeric ? "right" : "left"),
                      padding: `${space.md - 1}px ${space.md}px`,
                      fontSize: fontSize.md,
                      color: EPJ.gray900,
                      borderBottom: `1px solid ${EPJ.gray100}`,
                      fontVariantNumeric: col.numeric ? "tabular-nums" : undefined,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: col.width,
                    }}
                  >
                    {cellValue(col, row)}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      {pageSize > 0 && pageCount > 1 && (
        <div style={{ borderTop: `1px solid ${EPJ.gray100}` }}>
          <Pager page={page} pageCount={pageCount} setPage={setPage} />
        </div>
      )}
    </div>
  );
}

function Pager({ page, pageCount, setPage }) {
  const btn = (enabled) => ({
    border: `1px solid ${EPJ.gray200}`,
    background: EPJ.white,
    color: enabled ? EPJ.gray700 : EPJ.gray300,
    borderRadius: radius.sm,
    padding: `${space.xs}px ${space.md}px`,
    fontSize: fontSize.sm,
    fontFamily: font.body,
    cursor: enabled ? "pointer" : "not-allowed",
  });
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "flex-end",
      gap: space.sm, padding: `${space.sm}px ${space.md}px`,
    }}>
      <span style={{ fontSize: fontSize.xs, color: EPJ.gray500, fontVariantNumeric: "tabular-nums" }}>
        Page {page + 1} / {pageCount}
      </span>
      <button disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))} style={btn(page > 0)}>
        ←
      </button>
      <button disabled={page >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))} style={btn(page < pageCount - 1)}>
        →
      </button>
    </div>
  );
}

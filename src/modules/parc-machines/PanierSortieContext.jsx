// ═══════════════════════════════════════════════════════════════
//  PanierSortieContext v10 — Panier de sortie (multi ou simple)
//  Mode "toujours actif" : les cases à cocher sont permanentes.
//  Le panier est visible dès qu'au moins 1 outil est coché.
// ═══════════════════════════════════════════════════════════════
import { createContext, useContext, useState, useCallback } from "react";

const PanierSortieContext = createContext(null);

export function PanierSortieProvider({ children }) {
  const [items, setItems] = useState([]); // array d'outilIds

  const toggle = useCallback((outilId) => {
    setItems(prev => prev.includes(outilId)
      ? prev.filter(id => id !== outilId)
      : [...prev, outilId]);
  }, []);

  const add = useCallback((outilId) => {
    setItems(prev => prev.includes(outilId) ? prev : [...prev, outilId]);
  }, []);

  // Ajoute plusieurs outils d'un coup (utile pour les packs)
  const addMany = useCallback((outilIds) => {
    setItems(prev => {
      const set = new Set(prev);
      outilIds.forEach(id => set.add(id));
      return Array.from(set);
    });
  }, []);

  const remove = useCallback((outilId) => {
    setItems(prev => prev.filter(id => id !== outilId));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
  }, []);

  const has = useCallback((outilId) => items.includes(outilId), [items]);

  return (
    <PanierSortieContext.Provider value={{
      items, count: items.length,
      active: items.length > 0,  // "actif" = au moins 1 item
      toggle, add, addMany, remove, clear, has,
    }}>
      {children}
    </PanierSortieContext.Provider>
  );
}

export function usePanierSortie() {
  const ctx = useContext(PanierSortieContext);
  if (!ctx) throw new Error("usePanierSortie doit être utilisé dans PanierSortieProvider");
  return ctx;
}

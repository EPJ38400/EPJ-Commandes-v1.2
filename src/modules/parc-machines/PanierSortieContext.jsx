// ═══════════════════════════════════════════════════════════════
//  PanierSortieContext — Panier de sortie multiple d'outils
//  Permet de sélectionner plusieurs outils au fil de la navigation
//  puis de les sortir en une seule opération
// ═══════════════════════════════════════════════════════════════
import { createContext, useContext, useState, useCallback } from "react";

const PanierSortieContext = createContext(null);

export function PanierSortieProvider({ children }) {
  // Map outilId → true (set ordonné)
  const [items, setItems] = useState([]); // array d'outilIds
  const [active, setActive] = useState(false); // mode "panier actif" (affiche cases à cocher)

  const toggle = useCallback((outilId) => {
    setItems(prev => prev.includes(outilId)
      ? prev.filter(id => id !== outilId)
      : [...prev, outilId]);
  }, []);

  const add = useCallback((outilId) => {
    setItems(prev => prev.includes(outilId) ? prev : [...prev, outilId]);
  }, []);

  const remove = useCallback((outilId) => {
    setItems(prev => prev.filter(id => id !== outilId));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setActive(false);
  }, []);

  const startPanier = useCallback(() => {
    setActive(true);
  }, []);

  const cancelPanier = useCallback(() => {
    setItems([]);
    setActive(false);
  }, []);

  const has = useCallback((outilId) => items.includes(outilId), [items]);

  return (
    <PanierSortieContext.Provider value={{
      items, active, count: items.length,
      toggle, add, remove, clear, has,
      startPanier, cancelPanier,
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

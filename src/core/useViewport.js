// ═══════════════════════════════════════════════════════════════
//  useViewport — source unique des décisions de largeur (Lot 0 desktop)
//
//  L'app est 100 % inline-styles (aucun framework CSS) : les bascules
//  de mise en page se décident en JS. Ce module centralise la largeur
//  de fenêtre réactive et sa classification.
//
//  Seuils :
//   • mobile   : largeur ≤ 760  (= seuil narrow historique, bascule table↔carte)
//   • tablette : 761 – 1023
//   • desktop  : ≥ 1024
//
//  Le pilotage du cadre (Layout fullWidth) se fait sur le seuil 760
//  (> 760 ⇒ cadre large), aligné sur la bascule table↔carte pour qu'un
//  tableau ne se retrouve jamais coincé dans un cadre étroit. Les 3 tiers
//  restent exposés pour les adaptations internes des lots suivants.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";

export const VIEWPORT_BREAKPOINTS = { narrow: 760, desktop: 1024 };

function getWidth() {
  // Fallback "desktop" hors navigateur (SSR / tests) : neutre, comme
  // l'ancien useIsNarrow qui renvoyait false (= non-narrow) sans window.
  return typeof window !== "undefined"
    ? window.innerWidth
    : VIEWPORT_BREAKPOINTS.desktop;
}

// Primitive partagée : largeur de fenêtre réactive. Source unique du
// listener resize (useViewport ET useIsNarrow s'appuient dessus).
export function useViewportWidth() {
  const [width, setWidth] = useState(getWidth);

  useEffect(() => {
    const onResize = () => setWidth(getWidth());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return width;
}

export function classifyViewport(width) {
  if (width <= VIEWPORT_BREAKPOINTS.narrow) return "mobile";
  if (width < VIEWPORT_BREAKPOINTS.desktop) return "tablette";
  return "desktop";
}

// 'mobile' | 'tablette' | 'desktop'
export function useViewport() {
  return classifyViewport(useViewportWidth());
}

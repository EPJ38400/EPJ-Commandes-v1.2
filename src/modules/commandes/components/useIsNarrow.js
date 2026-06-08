// ═══════════════════════════════════════════════════════════════
//  useIsNarrow — hook responsive minimal (desktop ↔ mobile/PWA).
//  L'app fait surtout du CSS @media, mais les écrans Module Commande
//  basculent table ↔ cartes en JS pour rester en inline-styles cohérents
//  avec le reste du module. Breakpoint par défaut : 760 px.
//
//  Lot 0 desktop : réimplémenté PAR-DESSUS useViewportWidth (source de
//  largeur unique) — même sémantique `<= breakpoint`, rétrocompat totale
//  (y compris breakpoint custom), sans listener resize dupliqué.
// ═══════════════════════════════════════════════════════════════
import { useViewportWidth } from "../../../core/useViewport";

export function useIsNarrow(breakpoint = 760) {
  return useViewportWidth() <= breakpoint;
}

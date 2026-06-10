// ═══════════════════════════════════════════════════════════════
//  useInteractive — états interactifs locaux pour les primitives DS-1
//
//  L'app est 100 % inline-styles (aucun framework CSS) : les pseudo-
//  classes :hover / :focus-visible / :active ne sont pas exprimables en
//  style inline. Ce hook centralise ces états en JS, sans muter la
//  feuille globale (globalCss reste figée — cf. ticket DS-1).
//
//  Chaque primitive applique l'effet visuel (fond, bordure, anneau focus)
//  en lisant { hover, focus, active } et en gardant le hover au desktop
//  (le tactile n'a pas de hover — cf. DIRECTION_ARTISTIQUE §5/§6).
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";

export function useInteractive(disabled = false) {
  const [hover, setHover] = useState(false);
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(false);

  const handlers = disabled
    ? {}
    : {
        onMouseEnter: () => setHover(true),
        onMouseLeave: () => { setHover(false); setActive(false); },
        onFocus: () => setFocus(true),
        onBlur: () => setFocus(false),
        onMouseDown: () => setActive(true),
        onMouseUp: () => setActive(false),
      };

  return { hover, focus, active, handlers };
}

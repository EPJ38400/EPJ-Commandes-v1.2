// ═══════════════════════════════════════════════════════════════
//  useIsNarrow — hook responsive minimal (desktop ↔ mobile/PWA).
//  L'app fait surtout du CSS @media, mais les écrans Module Commande
//  bascullent table ↔ cartes en JS pour rester en inline-styles cohérents
//  avec le reste du module. Breakpoint par défaut : 760 px.
// ═══════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";

export function useIsNarrow(breakpoint = 760) {
  const get = () =>
    typeof window !== "undefined" && window.innerWidth <= breakpoint;
  const [narrow, setNarrow] = useState(get);

  useEffect(() => {
    const onResize = () => setNarrow(get());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakpoint]);

  return narrow;
}

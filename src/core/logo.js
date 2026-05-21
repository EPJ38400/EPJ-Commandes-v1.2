// ═══════════════════════════════════════════════════════════════
//  Logos officiels EPJ (atome couleur bleu/orange/vert) — v2.0.0
//
//  AVANT v2.0.0 : ces logos étaient embarqués en base64 directement
//  dans ce fichier (~174 Ko de chaînes base64 dans le bundle JS).
//
//  DEPUIS v2.0.0 : les images sont servies en tant que fichiers
//  statiques depuis /public/, ce qui :
//   - Réduit la taille du bundle JS de ~174 Ko (gzip ~50 Ko)
//   - Permet au navigateur de mettre les logos en cache séparément
//   - Permet de remplacer les logos sans rebuild
//
//  Les fichiers source à placer dans public/ :
//   • /public/logo-header.png  — PNG transparent pour le header
//   • /public/logo-login.png   — PNG transparent grand format login
//   • /public/app-icon.jpg     — icône PWA (arcs + logo centré)
//   • /public/bg-login.jpg     — arrière-plan arcs colorés
// ═══════════════════════════════════════════════════════════════

export const LOGO_HEADER = "/logo-header.png";
export const LOGO_LOGIN  = "/logo-login.png";
export const APP_ICON    = "/app-icon.jpg";
export const BG_LOGIN    = "/bg-login.jpg";

// Alias rétrocompat (ancien export)
export const EPJ_LOGO = LOGO_LOGIN;

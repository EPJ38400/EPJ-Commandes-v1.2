// ═══════════════════════════════════════════════════════════════
//  EPJ App Globale — Design Tokens
//  Palette conservée depuis la V1.3 + refonte espacement/typo
// ═══════════════════════════════════════════════════════════════

export const EPJ = {
  // Couleurs identité EPJ (charte vérifiée logo + print officiels, 2026-06-10)
  dark:       "#3D3D3D",
  blue:       "#00A3E0",   // couleur de travail — conforme au dégradé du logo
  orange:     "#F8A018",   // orange doré charte (ex #F5841F)
  green:      "#98D038",   // vert pomme charte (ex #A8C536)
  red:        "#E53935",

  // Accents métier / signal (≠ palette de marque)
  urgent:     "#E65100",   // signal d'alerte / retard — volontairement distinct d'EPJ.orange
  catEtude:   "#8E44AD",   // couleur métier catégorie « ÉTUDE / TMA » (avancement)

  // Échelle de gris
  gray900:    "#1A1A1A",
  gray700:    "#3D3D3D",
  gray600:    "#545454",   // interpolé entre gray700 (#3D3D3D) et gray500 (#6B6B6B)
  gray500:    "#6B6B6B",
  gray400:    "#999999",   // interpolé entre gray500 (#6B6B6B) et gray300 (#C7C7C7)
  gray300:    "#C7C7C7",
  gray200:    "#EAEAEA",
  gray100:    "#F4F5F7",
  gray50:     "#FAFAFA",
  white:      "#FFFFFF",

  // Fonds sémantiques doux (valeurs Material déjà utilisées dans le code, teintes inchangées)
  successBg:  "#E8F5E9",
  warningBg:  "#FFF3E0",
  dangerBg:   "#FFEBEE",
  infoBg:     "#E3F2FD",

  // Texte sémantique foncé — lisible sur fonds clairs/doux (teinte foncée de chaque famille)
  greenText:  "#4C7A14",
  orangeText: "#9A6200",
  redText:    "#B71C1C",
  blueText:   "#006B94",

  // Alias rétrocompat
  gray:       "#6B6B6B",
  grayLight:  "#FAFAFA",
};

export const font = {
  display: `'Instrument Serif', 'Georgia', serif`,
  body:    `'Inter', 'Segoe UI', -apple-system, sans-serif`,
  mono:    `'JetBrains Mono', 'SF Mono', 'Menlo', monospace`,
};

export const fontString = font.body;

export const radius = { sm: 6, md: 10, lg: 12, xl: 16, pill: 999 };
export const space  = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };

// Échelle typo (tailles en px, graisses) — adoption progressive (DS-1 et lots opportunistes)
export const fontSize   = { xs: 12, sm: 13, md: 14, base: 16, lg: 20, xl: 24 };
export const fontWeight = { regular: 400, medium: 500, semibold: 600, bold: 700 };

// Ombres — 3 niveaux + focus, repris des boxShadow les plus fréquents du code
export const shadow = {
  sm:    "0 1px 2px rgba(0,0,0,0.1)",
  md:    "0 4px 16px rgba(0,0,0,.04)",
  lg:    "0 20px 50px rgba(0,0,0,.08)",
  focus: `0 0 0 3px ${EPJ.blue}1A`,
};

export const globalCss = `
  /* Polices Google : chargées via <link rel="preconnect"/"stylesheet"> dans
     index.html (en parallèle du JS). Plus de @import ici (render-blocking,
     ne démarrait qu'après injection JS de cette feuille). */

  *{box-sizing:border-box;margin:0;padding:0}
  html,body{margin:0;padding:0;min-height:100vh;background:${EPJ.gray50};color:${EPJ.gray900};font-family:${font.body};-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
  html{
    /* Supporte l'encoche / Dynamic Island iPhone + home indicator */
    height:-webkit-fill-available;
  }
  body{
    min-height:100vh;
    min-height:-webkit-fill-available;
    font-feature-settings:"ss01","cv11";line-height:1.5;
    /* Couleur de fond qui remonte derrière la barre de statut iOS */
    background:${EPJ.gray50};
  }
  #root{min-height:100vh;min-height:-webkit-fill-available;display:flex;flex-direction:column}

  /* Classes utilitaires safe-area (iPhone notch / home indicator) */
  .epj-safe-top{padding-top:env(safe-area-inset-top)}
  .epj-safe-bottom{padding-bottom:env(safe-area-inset-bottom)}
  .epj-safe-left{padding-left:env(safe-area-inset-left)}
  .epj-safe-right{padding-right:env(safe-area-inset-right)}

  input,select,textarea,button{font-family:inherit}
  input:focus,select:focus,textarea:focus{border-color:${EPJ.blue}!important;outline:none;box-shadow:0 0 0 3px ${EPJ.blue}1A}
  ::placeholder{color:${EPJ.gray300}}

  .tabnum{font-variant-numeric:tabular-nums}

  @keyframes fadeUp{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes spin{to{transform:rotate(360deg)}}
  @keyframes badgePulse{0%,100%{box-shadow:0 0 0 0 ${EPJ.red}66}50%{box-shadow:0 0 0 8px ${EPJ.red}00}}
  @keyframes stagger{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}

  .epj-btn{
    border:none;border-radius:${radius.lg}px;padding:13px 18px;
    font-size:14px;font-weight:600;letter-spacing:-0.01em;
    cursor:pointer;transition:transform .15s ease, box-shadow .15s ease, background .15s ease;
    font-family:${font.body};
  }
  .epj-btn:hover{transform:translateY(-1px)}
  .epj-btn:active{transform:translateY(0) scale(.98)}
  .epj-btn:disabled{opacity:.45;cursor:not-allowed;transform:none}

  .epj-input{
    width:100%;padding:12px 14px;border-radius:${radius.md}px;
    border:1px solid ${EPJ.gray200};font-size:14px;font-family:${font.body};
    background:${EPJ.white};color:${EPJ.gray900};transition:border-color .15s ease, box-shadow .15s ease;
  }

  /* Cards semi-transparentes pour laisser passer les arcs en arrière-plan */
  .epj-card{
    background:rgba(255,255,255,.92);
    backdrop-filter:blur(6px);
    -webkit-backdrop-filter:blur(6px);
    border:1px solid ${EPJ.gray200};border-radius:${radius.xl}px;
    padding:18px;transition:transform .2s ease, border-color .2s ease, box-shadow .2s ease;
  }
  .epj-card.clickable{cursor:pointer}
  .epj-card.clickable:hover{border-color:${EPJ.gray300};box-shadow:0 4px 16px rgba(0,0,0,.04);transform:translateY(-2px)}

  .epj-row{
    display:flex;align-items:center;gap:12px;
    background:rgba(255,255,255,.92);border:1px solid ${EPJ.gray200};border-radius:${radius.lg}px;
    padding:12px 14px;margin-bottom:6px;
  }

  .status-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:${radius.pill}px;font-size:11px;font-weight:600;font-variant-numeric:tabular-nums}

  .badge-pulse{animation:badgePulse 2s infinite}
  .badge-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:currentColor;margin-right:6px}

  .qty-input{width:56px;text-align:center;font-size:16px;font-weight:700;border:1px solid ${EPJ.gray200};border-radius:${radius.md}px;padding:6px 4px;background:${EPJ.white};font-variant-numeric:tabular-nums}

  /* Tuiles de module sur page de garde */
  .epj-tile{
    position:relative;
    background:rgba(255,255,255,.92);
    backdrop-filter:blur(6px);
    -webkit-backdrop-filter:blur(6px);
    border:1px solid ${EPJ.gray200};
    border-radius:${radius.xl}px;padding:20px 18px;cursor:pointer;
    display:flex;flex-direction:column;gap:14px;min-height:132px;
    transition:border-color .2s ease, box-shadow .2s ease, transform .2s ease;
    overflow:hidden;
  }
  .epj-tile::before{
    content:"";position:absolute;left:0;top:16px;bottom:16px;width:3px;
    border-radius:0 3px 3px 0;background:var(--accent,${EPJ.blue});
    transition:width .2s ease;
  }
  .epj-tile:hover{border-color:${EPJ.gray300};box-shadow:0 6px 20px rgba(0,0,0,.05);transform:translateY(-2px)}
  .epj-tile:hover::before{width:5px}

  .epj-tile-icon{
    width:44px;height:44px;border-radius:${radius.md}px;
    display:flex;align-items:center;justify-content:center;font-size:22px;
    background:var(--accent-soft,${EPJ.blue}1A);color:var(--accent,${EPJ.blue});
  }

  @media(max-width:400px){
    .epj-tile{padding:16px 14px;min-height:118px}
  }
`;

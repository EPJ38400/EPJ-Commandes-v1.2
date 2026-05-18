// ═══════════════════════════════════════════════════════════════
//  ModuleSubHeader — v10.G
//
//  Composant partagé qui affiche le sous-header d'un module avec :
//    - Bouton "← {moduleName}" (à gauche) pour revenir à l'accueil DU MODULE
//      Ce bouton ne s'affiche QUE si on n'est pas déjà sur l'accueil du module
//      (c'est-à-dire si onBackToModuleHome est fourni ET différent de null).
//    - Titre + sous-titre du module ou de la section courante
//
//  Le bouton 🏠 Accueil (haut, accueil de l'app) est dans Layout.jsx (header global).
//  Le bouton ← Retour (bas, page précédente) est géré au cas par cas par chaque
//  module (CommandesInner.jsx pour le module Commandes, etc.).
//
//  Ce composant centralise UNIQUEMENT le pattern du milieu pour garantir une
//  apparence et un comportement homogènes dans toute l'app.
// ═══════════════════════════════════════════════════════════════
import { EPJ, font } from "../theme";

export function ModuleSubHeader({
  moduleName,           // ex: "Commandes" — le nom à afficher dans le bouton
  title,                // ex: "Parc machines" — gros titre du module
  subtitle,             // ex: "Outillage et matériel" — sous-titre en uppercase
  onBackToModuleHome,   // callback pour revenir à l'accueil du module
                        // (si null → bouton masqué = on EST sur l'accueil du module)
  rightSlot,            // optionnel : contenu à droite (ex: nombre de chantiers)
}) {
  const showButton = typeof onBackToModuleHome === "function";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      marginBottom: 14,
      minHeight: 44, // évite les sauts visuels quand le bouton est masqué
    }}>
      {showButton && (
        <button
          onClick={onBackToModuleHome}
          style={{
            background: EPJ.gray100,
            border: `1px solid ${EPJ.gray200}`,
            borderRadius: 10,
            padding: "9px 14px",
            fontSize: 13, fontWeight: 600,
            color: EPJ.gray900,
            cursor: "pointer",
            fontFamily: font.body,
            whiteSpace: "nowrap", flexShrink: 0,
            display: "flex", alignItems: "center", gap: 6,
          }}
          title={`Retour à l'accueil du module ${moduleName}`}
          aria-label={`Retour à l'accueil du module ${moduleName}`}
        >
          <span>←</span>
          <span>{moduleName}</span>
        </button>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {subtitle && (
          <div style={{
            fontSize: 10, color: EPJ.gray500, letterSpacing: 0.8,
            textTransform: "uppercase", fontWeight: 600,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {subtitle}
          </div>
        )}
        {title && (
          <div style={{
            fontFamily: font.display, fontSize: 22, fontWeight: 400,
            color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.15,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {title}
          </div>
        )}
      </div>

      {rightSlot && (
        <div style={{ flexShrink: 0 }}>
          {rightSlot}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  <Badge> — primitive DS-1 (statuts — ~119 sites)
//
//  Anatomie (DIRECTION_ARTISTIQUE §5) : fond doux sémantique + texte
//  teinte foncée de la même famille + point/icône optionnel. 12px,
//  graisse 500, radius pill.
//
//  Table de correspondance statut → couleur CENTRALISÉE ici : aucun
//  écran ne décide de ses propres couleurs de statut.
// ═══════════════════════════════════════════════════════════════
import { EPJ, font, radius, fontSize, fontWeight } from "../theme";

// Familles de couleurs (fond doux + texte foncé même famille).
const TONES = {
  success: { bg: EPJ.successBg, text: EPJ.greenText  },
  warning: { bg: EPJ.warningBg, text: EPJ.orangeText },
  danger:  { bg: EPJ.dangerBg,  text: EPJ.redText    },
  info:    { bg: EPJ.infoBg,    text: EPJ.blueText   },
  neutral: { bg: EPJ.gray100,   text: EPJ.gray600    },
  etude:   { bg: `${EPJ.catEtude}1A`, text: EPJ.catEtude },
  urgent:  { bg: `${EPJ.urgent}1A`,   text: EPJ.urgent   },
  // Workflow commandes (décision PJ, lot trio) :
  violet:        { bg: EPJ.violetBg,  text: EPJ.catEtude }, // règle : partiel = violet
  successStrong: { bg: EPJ.greenText, text: EPJ.white },    // PLEIN — état terminal du
  // workflow (Réceptionnée). Seule exception assumée au pattern fond doux + texte foncé.
};

// Table statut métier → { tone, label }. Source unique de vérité couleur.
// Les clés couvrent les libellés rencontrés dans l'app (parc machines,
// commandes, réserves). `label` peut être surchargé par la prop.
const STATUS_MAP = {
  // Parc machines
  "Disponible":            { tone: "success", label: "Disponible" },
  "Maintenance":           { tone: "warning", label: "Maintenance" },
  "Hors service":          { tone: "danger",  label: "Hors service" },
  // Commandes — 4 états du workflow = 4 couleurs distinctes (décision PJ, lot trio) :
  // Envoyée = bleu · partiel = violet · Commandée = vert clair · Réceptionnée = vert plein.
  "Commandée":             { tone: "success", label: "Commandée" },
  "En attente de validation": { tone: "warning", label: "En attente" },
  "Validée":               { tone: "info",    label: "Validée" },
  "Envoyée aux achats":    { tone: "info",    label: "Envoyée aux achats" },
  "Réceptionnée":          { tone: "successStrong", label: "Réceptionnée" },
  "Refusée":               { tone: "danger",  label: "Refusée" },
  "Commandée partiellement":    { tone: "violet", label: "Commandée partiellement" },
  "Réceptionnée partiellement": { tone: "violet", label: "Réceptionnée partiellement" },
  "Scindée":               { tone: "neutral", label: "Scindée" },
  // Réserves (clés = statut Firestore)
  "creee":                 { tone: "neutral", label: "Créée" },
  "attribuee":             { tone: "info",    label: "Attribuée" },
  "planifiee":             { tone: "warning", label: "Planifiée" },
  "intervention":          { tone: "warning", label: "En intervention" },
  "levee":                 { tone: "success", label: "Levée" },
  "partiellement_levee":   { tone: "warning", label: "Partiellement levée" },
  "quitus_signe":          { tone: "success", label: "Quitus signé" },
  "cloturee":              { tone: "neutral", label: "Clôturée" },
  // Signaux génériques
  "urgent":                { tone: "urgent",  label: "Urgent" },
  "etude":                 { tone: "etude",   label: "Étude / TMA" },
};

export function Badge({ status, tone, label, icon, dot }) {
  const mapped = status != null ? STATUS_MAP[status] : null;
  const finalTone = tone || mapped?.tone || "neutral";
  const finalLabel = label != null ? label : (mapped?.label ?? status ?? "");
  const t = TONES[finalTone] || TONES.neutral;

  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 5,
      padding: "3px 9px",
      borderRadius: radius.pill,
      background: t.bg,
      color: t.text,
      fontSize: fontSize.xs,
      fontWeight: fontWeight.medium,
      fontFamily: font.body,
      lineHeight: 1.4,
      whiteSpace: "nowrap",
      fontVariantNumeric: "tabular-nums",
    }}>
      {dot && (
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "currentColor", flexShrink: 0,
        }} aria-hidden="true" />
      )}
      {icon != null && <span style={{ lineHeight: 1 }}>{icon}</span>}
      {finalLabel}
    </span>
  );
}

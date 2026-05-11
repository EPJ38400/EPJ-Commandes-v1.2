// ═══════════════════════════════════════════════════════════════
//  AdminSettings — v10.J
//  Paramètres globaux de l'application (feature flags, intégrations).
//
//  Stocké dans Firestore : config/settings
//  Consommé via useData().featureFlags.<nom> partout dans l'app.
//
//  Le premier flag est `ocrArEnabled` : pilote l'affichage de la date
//  de livraison annoncée par les fournisseurs (extraite de l'AR/BL
//  par le scénario Make + OpenAI). Tant qu'il est OFF, l'app ne se
//  base que sur la date de réception souhaitée par le demandeur.
// ═══════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { EPJ, font } from "../../core/theme";

export function AdminSettings({ onBack }) {
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    ocrArEnabled: false,
  });

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "config", "settings"));
        if (snap.exists()) {
          const d = snap.data() || {};
          setSettings(s => ({ ...s, ...d }));
        }
      } catch (e) {
        console.warn("Chargement settings:", e.message);
      }
      setLoaded(true);
    })();
  }, []);

  const save = async (next) => {
    setSaving(true);
    try {
      // Merge pour ne pas écraser d'autres clés du doc config/settings
      const cur = (await getDoc(doc(db, "config", "settings"))).data() || {};
      await setDoc(doc(db, "config", "settings"), { ...cur, ...next });
      setSettings(s => ({ ...s, ...next }));
    } catch (e) {
      alert("❌ Échec d'enregistrement : " + e.message);
    }
    setSaving(false);
  };

  if (!loaded) {
    return <div style={{ padding: 20, color: EPJ.gray500 }}>Chargement…</div>;
  }

  return (
    <div style={{ paddingBottom: 24 }}>
      <button
        onClick={onBack}
        style={{
          background: "transparent", border: "none", color: EPJ.gray500,
          fontFamily: font.body, fontSize: 13, padding: "8px 0", cursor: "pointer",
        }}
      >← Retour</button>

      <div style={{ marginTop: 8, marginBottom: 20 }}>
        <div style={{
          fontFamily: font.display, fontSize: 22, fontWeight: 400,
          color: EPJ.gray900, letterSpacing: "-0.02em",
        }}>
          Paramètres & intégrations
        </div>
        <div style={{ fontSize: 12, color: EPJ.gray500, marginTop: 4 }}>
          Active ou désactive les briques fonctionnelles selon ce qui est
          en place côté back-office (Make, OpenAI…).
        </div>
      </div>

      {/* ─── Bloc OCR AR/BL fournisseur ─── */}
      <div className="epj-card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${EPJ.orange}1A`, color: EPJ.orange,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0,
          }}>📨</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: EPJ.gray900 }}>
              Remontée automatique des AR / BL fournisseurs
            </div>
            <div style={{ fontSize: 12, color: EPJ.gray500, marginTop: 4, lineHeight: 1.5 }}>
              Quand cette option est <b>activée</b>, l'app affiche la date de
              livraison annoncée par le fournisseur (extraite de l'AR ou du BL
              reçu sur achat@epj-electricite.com par Make + OpenAI) à côté de
              la date de réception souhaitée. La bannière « commandes en retard »
              se base alors sur la date fournisseur quand elle existe, sinon sur
              la date souhaitée.
              <br/><br/>
              <b>Garder désactivé</b> tant que le scénario Make n'est pas en place :
              dans ce mode l'app reste sur la date de réception souhaitée par le
              demandeur uniquement.
            </div>
          </div>
        </div>

        <div style={{
          marginTop: 14, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "10px 12px",
          background: settings.ocrArEnabled ? `${EPJ.green}10` : `${EPJ.gray500}10`,
          borderRadius: 10, border: `1px solid ${settings.ocrArEnabled ? EPJ.green : EPJ.gray300}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: EPJ.gray900 }}>
            {settings.ocrArEnabled ? "✅ Activée" : "⚪️ Désactivée"}
          </div>
          <ToggleSwitch
            checked={settings.ocrArEnabled}
            disabled={saving}
            onChange={(v) => save({ ocrArEnabled: v })}
          />
        </div>
      </div>

      {/* Espace pour futurs flags (Esabora, push, etc.) */}
      <div style={{
        marginTop: 24, padding: 14, borderRadius: 10,
        background: `${EPJ.blue}08`, border: `1px dashed ${EPJ.gray300}`,
        fontSize: 12, color: EPJ.gray500, lineHeight: 1.5,
      }}>
        💡 D'autres intégrations seront pilotables depuis cet écran à
        mesure qu'on les met en place (liaison Esabora, notifications
        push…).
      </div>
    </div>
  );
}

function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      aria-pressed={checked}
      style={{
        width: 52, height: 28, borderRadius: 14, border: "none",
        background: checked ? EPJ.green : EPJ.gray300,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        position: "relative", transition: "background 120ms ease",
        padding: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 26 : 3,
        width: 22, height: 22, borderRadius: 11, background: "#fff",
        transition: "left 120ms ease",
        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
      }}/>
    </button>
  );
}

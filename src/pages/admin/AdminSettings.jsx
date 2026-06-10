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
    esaboraEnabled: false,         // v10.L
    esaboraWebhookUrl: "",         // v10.L
    esaboraTvaDefault: 20,         // v10.L.1
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

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

      {/* ─── v10.L — Bloc Intégration Esabora (Zapier) ─── */}
      <div className="epj-card" style={{ padding: 16, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${EPJ.blue}1A`, color: EPJ.blue,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0,
          }}>🔗</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 15, color: EPJ.gray900 }}>
              Synchronisation Esabora (via Zapier)
            </div>
            <div style={{ fontSize: 12, color: EPJ.gray500, marginTop: 4, lineHeight: 1.5 }}>
              Quand activé, un bouton « 🚀 Envoyer dans Esabora » apparaît dans
              le détail de chaque commande au statut « Envoyée aux achats ».
              L'app génère un fichier Excel par fournisseur (basé sur le code
              Esabora de chaque article) et le POSTe directement au webhook
              Zapier configuré ci-dessous.
              <br/><br/>
              Côté Zapier : 1 Zap = « Webhooks by Zapier — Catch Hook » →
              « Esabora — Create Order ». Copie l'URL du Catch Hook ici.
            </div>
          </div>
        </div>

        {/* Toggle activé */}
        <div style={{
          marginTop: 14, display: "flex", alignItems: "center",
          justifyContent: "space-between", padding: "10px 12px",
          background: settings.esaboraEnabled ? `${EPJ.green}10` : `${EPJ.gray500}10`,
          borderRadius: 10, border: `1px solid ${settings.esaboraEnabled ? EPJ.green : EPJ.gray300}`,
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: EPJ.gray900 }}>
            {settings.esaboraEnabled ? "✅ Synchronisation activée" : "⚪️ Synchronisation désactivée"}
          </div>
          <ToggleSwitch
            checked={settings.esaboraEnabled}
            disabled={saving}
            onChange={(v) => save({ esaboraEnabled: v })}
          />
        </div>

        {/* URL Webhook */}
        <div style={{ marginTop: 14 }}>
          <label style={{
            display: "block", fontSize: 11, fontWeight: 700,
            color: EPJ.gray500, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4,
          }}>URL Webhook Zapier (Catch Hook)</label>
          <input
            type="text"
            placeholder="https://hooks.zapier.com/hooks/catch/123456/abcdef/"
            value={settings.esaboraWebhookUrl}
            onChange={(e) => setSettings(s => ({ ...s, esaboraWebhookUrl: e.target.value }))}
            onBlur={(e) => save({ esaboraWebhookUrl: e.target.value.trim() })}
            style={{
              width: "100%", padding: "10px 12px", fontSize: 13,
              border: `1px solid ${EPJ.gray300}`, borderRadius: 8,
              fontFamily: font.body, color: EPJ.gray900, boxSizing: "border-box",
            }}
          />
          <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 4 }}>
            Récupère cette URL dans Zapier → Edit Zap → Trigger « Catch Hook » →
            « Your Webhook URL ».
          </div>
        </div>

        {/* v10.L.1 — TVA par défaut */}
        <div style={{ marginTop: 14 }}>
          <label style={{
            display: "block", fontSize: 11, fontWeight: 700,
            color: EPJ.gray500, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.4,
          }}>TVA par défaut (entête commande Esabora)</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={settings.esaboraTvaDefault}
              onChange={(e) => setSettings(s => ({ ...s, esaboraTvaDefault: Number(e.target.value) || 0 }))}
              onBlur={(e) => save({ esaboraTvaDefault: Number(e.target.value) || 0 })}
              style={{
                width: 80, padding: "10px 12px", fontSize: 14, fontWeight: 700,
                border: `1px solid ${EPJ.gray300}`, borderRadius: 8,
                fontFamily: font.body, color: EPJ.gray900, textAlign: "center",
              }}
            />
            <span style={{ fontSize: 14, color: EPJ.gray900, fontWeight: 600 }}>%</span>
          </div>
          <div style={{ fontSize: 11, color: EPJ.gray500, marginTop: 4, lineHeight: 1.4 }}>
            Taux TVA appliqué automatiquement à toutes les lignes du draft
            Esabora. <b>20 %</b> pour neuf, <b>10 %</b> pour rénovation,
            <b> 5,5 %</b> pour rénovation énergétique / logement social.
            Si besoin de taux différents par commande, on étoffera plus tard.
          </div>
        </div>

        {/* Bouton test */}
        <button
          disabled={testing || !settings.esaboraWebhookUrl}
          onClick={async () => {
            setTesting(true);
            setTestResult(null);
            try {
              const fd = new FormData();
              const testBlob = new Blob(
                ["Test EPJ\nCeci est un test de connectivite vers Zapier."],
                { type: "text/plain" }
              );
              fd.append("file", testBlob, "EPJ_test.txt");
              fd.append("test", "true");
              fd.append("source", "EPJ App Admin");
              const res = await fetch(settings.esaboraWebhookUrl, {
                method: "POST",
                body: fd,
              });
              setTestResult({
                ok: res.ok,
                status: res.status,
                text: res.ok
                  ? "✓ Zapier a reçu le test (HTTP 200). Vérifie dans Zapier → Run History."
                  : `✗ Zapier a renvoyé HTTP ${res.status}`,
              });
            } catch (e) {
              setTestResult({ ok: false, text: "✗ Erreur réseau : " + (e.message || e) });
            }
            setTesting(false);
          }}
          style={{
            marginTop: 14,
            width: "100%", padding: "10px 12px", borderRadius: 8,
            background: testing ? `${EPJ.gray300}` : `${EPJ.blue}12`,
            color: EPJ.blue, border: `1px solid ${EPJ.blue}40`,
            fontSize: 13, fontWeight: 700,
            cursor: (testing || !settings.esaboraWebhookUrl) ? "not-allowed" : "pointer",
            opacity: (testing || !settings.esaboraWebhookUrl) ? 0.6 : 1,
            fontFamily: font.body,
          }}
        >🧪 {testing ? "Test en cours…" : "Tester l'URL Zapier"}</button>

        {testResult && (
          <div style={{
            marginTop: 10, padding: "8px 12px", borderRadius: 6,
            background: testResult.ok ? `${EPJ.green}12` : `${EPJ.red}12`,
            color: testResult.ok ? EPJ.green : EPJ.red,
            fontSize: 12, lineHeight: 1.4,
          }}>
            {testResult.text}
          </div>
        )}
      </div>

      {/* Espace pour futurs flags (push, etc.) */}
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
        width: 22, height: 22, borderRadius: 11, background: EPJ.white,
        transition: "left 120ms ease",
        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
      }}/>
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
//  AdminPage — écran d'administration du Socle
//  3 sections : Utilisateurs / Chantiers / Droits
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font } from "../../core/theme";
import { AdminUsers } from "./AdminUsers";
import { AdminChantiers } from "./AdminChantiers";
import { AdminRights } from "./AdminRights";

export function AdminPage({ onExit }) {
  const [section, setSection] = useState(null); // null | 'users' | 'chantiers' | 'rights'
  const [focusedUserId, setFocusedUserId] = useState(null); // pour zoomer sur 1 user depuis Users → Droits

  // Si on a une section ouverte, on l'affiche
  if (section === "users") {
    return (
      <AdminUsers
        onBack={() => setSection(null)}
        onEditRights={(userId) => { setFocusedUserId(userId); setSection("rights"); }}
      />
    );
  }
  if (section === "chantiers") {
    return <AdminChantiers onBack={() => setSection(null)}/>;
  }
  if (section === "rights") {
    return (
      <AdminRights
        onBack={() => setSection(null)}
        focusedUserId={focusedUserId}
        onClearFocus={() => setFocusedUserId(null)}
      />
    );
  }

  // Vue d'accueil de l'Admin : 3 grandes cartes
  return (
    <div style={{ paddingTop: 16, paddingBottom: 24 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{
          fontFamily: font.display, fontSize: 24, fontWeight: 400,
          color: EPJ.gray900, letterSpacing: "-0.02em", lineHeight: 1.15,
        }}>
          Administration
        </div>
        <div style={{ fontSize: 12, color: EPJ.gray500, marginTop: 4 }}>
          Gérez les utilisateurs, chantiers et droits d'accès de l'application.
        </div>
      </div>

      <AdminSection
        icon="👥"
        accent={EPJ.blue}
        title="Utilisateurs"
        subtitle="Ajouter, modifier, supprimer les comptes"
        onClick={() => setSection("users")}
      />
      <AdminSection
        icon="🏗"
        accent={EPJ.orange}
        title="Chantiers"
        subtitle="Créer et gérer les chantiers + affectations d'équipe"
        onClick={() => setSection("chantiers")}
      />
      <AdminSection
        icon="🔒"
        accent={EPJ.green}
        title="Droits d'accès"
        subtitle="Voir et ajuster les permissions par utilisateur"
        onClick={() => setSection("rights")}
      />
    </div>
  );
}

function AdminSection({ icon, accent, title, subtitle, onClick }) {
  return (
    <div
      className="epj-card clickable"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "16px 18px", marginBottom: 10,
        borderLeft: `3px solid ${accent}`,
      }}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: `${accent}1A`, color: accent,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 20,
      }}>{icon}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 15, color: EPJ.gray900 }}>{title}</div>
        <div style={{ fontSize: 12, color: EPJ.gray500, marginTop: 1 }}>{subtitle}</div>
      </div>
      <span style={{ color: EPJ.gray300, fontSize: 18 }}>→</span>
    </div>
  );
}

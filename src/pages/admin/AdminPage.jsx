// ═══════════════════════════════════════════════════════════════
//  AdminPage — écran d'administration du Socle
//  4 sections : Utilisateurs / Chantiers / Droits des utilisateurs / Rôles types
// ═══════════════════════════════════════════════════════════════
import { useState } from "react";
import { EPJ, font } from "../../core/theme";
import { AdminUsers } from "./AdminUsers";
import { AdminChantiers } from "./AdminChantiers";
import { AdminRights } from "./AdminRights";
import { AdminRolesTypes } from "./AdminRolesTypes";
import { AdminTasksModel } from "./AdminTasksModel";

export function AdminPage({ onExit }) {
  const [section, setSection] = useState(null);
  const [focusedUserId, setFocusedUserId] = useState(null);

  if (section === "users") {
    return (
      <AdminUsers
        onBack={() => setSection(null)}
        onEditRights={(userId) => { setFocusedUserId(userId); setSection("rights"); }}
      />
    );
  }
  if (section === "chantiers") return <AdminChantiers onBack={() => setSection(null)}/>;
  if (section === "rights") {
    return (
      <AdminRights
        onBack={() => setSection(null)}
        focusedUserId={focusedUserId}
        onClearFocus={() => setFocusedUserId(null)}
      />
    );
  }
  if (section === "roles") return <AdminRolesTypes onBack={() => setSection(null)}/>;
  if (section === "tasks") return <AdminTasksModel onBack={() => setSection(null)}/>;

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
          Gérez utilisateurs, chantiers, droits et modèles de l'application.
        </div>
      </div>

      <AdminSection icon="👥" accent={EPJ.blue} title="Utilisateurs"
        subtitle="Ajouter, modifier, supprimer les comptes"
        onClick={() => setSection("users")}/>
      <AdminSection icon="🏗" accent={EPJ.orange} title="Chantiers"
        subtitle="Créer, modifier, archiver et affecter les équipes"
        onClick={() => setSection("chantiers")}/>
      <AdminSection icon="🔒" accent={EPJ.green} title="Droits des utilisateurs"
        subtitle="Ajuster les permissions d'un utilisateur en particulier"
        onClick={() => setSection("rights")}/>
      <AdminSection icon="🎭" accent="#8E44AD" title="Rôles types"
        subtitle="Modifier les droits par défaut d'un rôle (impacte tous les utilisateurs)"
        onClick={() => setSection("roles")}/>
      <AdminSection icon="📋" accent="#E53935" title="Modèle d'avancement"
        subtitle="Personnaliser les tâches par défaut pour tous les chantiers"
        onClick={() => setSection("tasks")}/>
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

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
import { AdminHomeVisibility } from "./AdminHomeVisibility";
import { AdminTasksModel } from "./AdminTasksModel";
import { AdminOutillage } from "./AdminOutillage";
import { AdminCategoriesOutillage } from "./AdminCategoriesOutillage";
import { AdminPannes } from "./AdminPannes";
import { AdminSmsTemplates } from "./AdminSmsTemplates";
import { AdminReserves } from "./AdminReserves";
import { AdminChantiersReception } from "./AdminChantiersReception";
import { AdminCompany } from "./AdminCompany";
import { AdminUserSignatures } from "./AdminUserSignatures";
import { AdminSettings } from "./AdminSettings"; // v10.J
import { AdminFournisseurs } from "./AdminFournisseurs";
import { AdminAffairesEsabora } from "./AdminAffairesEsabora";
import { SmsHistoryPage } from "./SmsHistoryPage";

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
  if (section === "affaires-esabora") return <AdminAffairesEsabora onBack={() => setSection(null)}/>;
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
  if (section === "home-visibility") return <AdminHomeVisibility onBack={() => setSection(null)}/>;
  if (section === "tasks") return <AdminTasksModel onBack={() => setSection(null)}/>;
  if (section === "outillage") return <AdminOutillage onBack={() => setSection(null)}/>;
  if (section === "categories-outillage") return <AdminCategoriesOutillage onBack={() => setSection(null)}/>;
  if (section === "pannes") return <AdminPannes onBack={() => setSection(null)}/>;
  if (section === "sms") return <AdminSmsTemplates onBack={() => setSection(null)}/>;
  if (section === "reserves-config") return <AdminReserves onBack={() => setSection(null)}/>;
  if (section === "chantiers-reception") return <AdminChantiersReception onBack={() => setSection(null)}/>;
  if (section === "company") return <AdminCompany onBack={() => setSection(null)}/>;
  if (section === "signatures") return <AdminUserSignatures onBack={() => setSection(null)}/>;
  if (section === "settings") return <AdminSettings onBack={() => setSection(null)}/>; // v10.J
  if (section === "fournisseurs") return <AdminFournisseurs onBack={() => setSection(null)}/>;
  if (section === "sms-history") return <SmsHistoryPage onBack={() => setSection(null)}/>;

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
          Gérez utilisateurs, chantiers, catalogues et modèles de l'application.
        </div>
      </div>

      <GroupTitle>Équipe & accès</GroupTitle>
      <AdminSection icon="👥" accent={EPJ.blue} title="Utilisateurs"
        subtitle="Ajouter, modifier, supprimer les comptes"
        onClick={() => setSection("users")}/>
      <AdminSection icon="🔒" accent={EPJ.green} title="Droits des utilisateurs"
        subtitle="Ajuster les permissions d'un utilisateur en particulier"
        onClick={() => setSection("rights")}/>
      <AdminSection icon="🎭" accent={EPJ.catEtude} title="Rôles types"
        subtitle="Modifier les droits par défaut d'un rôle (impacte tous les utilisateurs)"
        onClick={() => setSection("roles")}/>
      <AdminSection icon="🏠" accent={EPJ.blue} title="Visibilité accueil"
        subtitle="Choisir les tuiles d'accueil et dashboards visibles par rôle"
        onClick={() => setSection("home-visibility")}/>

      <GroupTitle>Chantiers & tâches</GroupTitle>
      <AdminSection icon="🏗" accent={EPJ.orange} title="Chantiers"
        subtitle="Créer, modifier, archiver et affecter les équipes"
        onClick={() => setSection("chantiers")}/>
      <AdminSection icon="📋" accent={EPJ.red} title="Modèle d'avancement"
        subtitle="Personnaliser les tâches par défaut pour tous les chantiers"
        onClick={() => setSection("tasks")}/>
      <AdminSection icon="📋" accent={EPJ.catCourantFaible} title="Injection affaires Esabora"
        subtitle="Importer/mettre à jour le référentiel affaires (adresses) pour les frais"
        onClick={() => setSection("affaires-esabora")}/>

      <GroupTitle>Parc machines</GroupTitle>
      <AdminSection icon="🔧" accent={EPJ.orange} title="Catalogue outillage"
        subtitle="Outils du parc (photo, référence, affectation permanente)"
        onClick={() => setSection("outillage")}/>
      <AdminSection icon="📁" accent={EPJ.blue} title="Catégories d'outillage"
        subtitle="Familles d'outils (ajouter, renommer, réordonner)"
        onClick={() => setSection("categories-outillage")}/>
      <AdminSection icon="⚠️" accent={EPJ.red} title="Pannes récurrentes"
        subtitle="Types de pannes au retour d'un outil abîmé"
        onClick={() => setSection("pannes")}/>

      <GroupTitle>Réserves & garanties</GroupTitle>
      <AdminSection icon="📝" accent={EPJ.catEtude} title="Config réserves"
        subtitle="Catégories, émetteurs, retards, garanties GPA/biennale"
        onClick={() => setSection("reserves-config")}/>
      <AdminSection icon="📅" accent={EPJ.green} title="Réceptions & garanties"
        subtitle="Saisir les dates de PV de réception par chantier"
        onClick={() => setSection("chantiers-reception")}/>

      <GroupTitle>Identité EPJ & quitus</GroupTitle>
      <AdminSection icon="🏢" accent={EPJ.blue} title="Config société"
        subtitle="Infos EPJ (SIRET, adresse…) + papier en-tête pour les quitus"
        onClick={() => setSection("company")}/>
      <AdminSection icon="✍" accent={EPJ.orange} title="Signatures techniciens"
        subtitle="Signature type de chaque utilisateur (imprimée sur les quitus)"
        onClick={() => setSection("signatures")}/>

      <GroupTitle>Achats & fournisseurs</GroupTitle>
      <AdminSection icon="🏭" accent={EPJ.blue} title="Contacts fournisseurs"
        subtitle="Fiches fournisseurs et contacts (relance AR, consultations) — référentiel partagé"
        onClick={() => setSection("fournisseurs")}/>

      <GroupTitle>Communication</GroupTitle>
      <AdminSection icon="📱" accent={EPJ.green} title="Modèles SMS"
        subtitle="Textes de rappels/relances pour tous les modules"
        onClick={() => setSection("sms")}/>
      <AdminSection icon="📨" accent={EPJ.blue} title="Historique SMS"
        subtitle="Suivi des SMS envoyés/échoués (planning, commandes, outillage…)"
        onClick={() => setSection("sms-history")}/>

      <GroupTitle>Paramètres généraux</GroupTitle>
      <AdminSection icon="⚙️" accent={EPJ.gray600} title="Paramètres & intégrations"
        subtitle="Activer/désactiver les briques en place (Make, OCR, Esabora…)"
        onClick={() => setSection("settings")}/>
    </div>
  );
}

function GroupTitle({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: EPJ.gray500,
      letterSpacing: 0.6, textTransform: "uppercase",
      marginTop: 20, marginBottom: 8, paddingLeft: 2,
    }}>{children}</div>
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

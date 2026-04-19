import { useState, useMemo, useEffect } from "react";
import { db } from "../../firebase";
import { collection, addDoc, updateDoc, doc, onSnapshot, query, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { initEPJData, uploadCatalog, deleteCategoryByQuery } from "../../initFirestore";
import { useAuth } from "../../core/AuthContext";

/* ═══════════════════════════════════════════════════
   EPJ App Globale — Module Commandes (ex-V1.3)
   Encapsulé dans le Socle : session & page de garde
   sont gérées au niveau du Layout global.
   ═══════════════════════════════════════════════════ */

// ─── USERS (from Excel Utilisateurs) ───
const USERS = [
  { id:"admin", pwd:"admin2010", prenom:"Admin", nom:"EPJ", fonction:"Admin", email:"admin@epj.fr", directAchat:true },
  { id:"Bilardo", pwd:"1234", prenom:"Joseph", nom:"BILARDO", fonction:"Conducteur de travaux", email:"j.bilardo@epj-electricite.com", directAchat:true },
  { id:"Frasca", pwd:"1234", prenom:"Thibaut", nom:"FRASCA", fonction:"Conducteur de travaux", email:"t.frasca@epj-electricite.com", directAchat:false },
  { id:"Courteau", pwd:"1234", prenom:"Mickael", nom:"COURTEAU", fonction:"Chef de chantier", email:"m.courteau@epj-electricite.com", directAchat:false },
  { id:"Rey", pwd:"1234", prenom:"Guillaume", nom:"REY", fonction:"Conducteur de travaux", email:"g.rey@epj-electricite.com", directAchat:false },
  { id:"Bartoli", pwd:"1234", prenom:"Thomas", nom:"BARTOLI", fonction:"Ouvrier", email:"", directAchat:false },
  { id:"Mollin", pwd:"1234", prenom:"Sylvain", nom:"MOLLIN", fonction:"Chef de chantier", email:"", directAchat:false },
];

// ─── CHANTIERS (from Excel — with N° Affaire) ───
const CHANTIERS = [
  { num:"001386", nom:"LE VAL/JADE", conducteur:"Mickael COURTEAU", emailConducteur:"m.courteau@epj-electricite.com", adresse:"RUE DU 19 MARS 1962 - 38320 EYBENS", statut:"Actif" },
  { num:"002179", nom:"LES HAUTS DU CERVOLAY", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"LIEU DIT L'ETANG - 73290 LA MOTTE SERVOLEX", statut:"Actif" },
  { num:"001983", nom:"LE 17", conducteur:"Joseph BILARDO", emailConducteur:"j.bilardo@epj-electricite.com", adresse:"17 RUE FIRMIN ROBERT - 38800 LE PONT DE CLAIX", statut:"Actif" },
  { num:"002209", nom:"L'OISEAU BLANC", conducteur:"Joseph BILARDO", emailConducteur:"j.bilardo@epj-electricite.com", adresse:"199/201 Av. A. Croizat - 38400 SMH", statut:"Actif" },
  { num:"002223", nom:"VILLA ST ALBAN LEYSSE", conducteur:"Guillaume REY", emailConducteur:"g.rey@epj-electricite.com", adresse:"193 rue du Villaret - 73230 ST-ALBAN-LEYSSE", statut:"Actif" },
  { num:"002216", nom:"DOMAINE DE BEAUVOIR", conducteur:"Guillaume REY", emailConducteur:"g.rey@epj-electricite.com", adresse:"Rue Victor Hugo - 73190 CHALLES-LES-EAUX", statut:"Actif" },
  { num:"002234", nom:"TERRA FLORA", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"18 Chemin du Foray - 73000 CHAMBÉRY", statut:"Actif" },
  { num:"001374", nom:"LES OREADES", conducteur:"Joseph BILARDO", emailConducteur:"j.bilardo@epj-electricite.com", adresse:"Rue Gavanière - 38120 SAINT-ÉGRÈVE", statut:"Actif" },
  { num:"002232", nom:"LE CLOS MARENGO", conducteur:"Mickael COURTEAU", emailConducteur:"m.courteau@epj-electricite.com", adresse:"54, route des Angonnes - 38320 BRIE ET ANGONNES", statut:"Actif" },
  { num:"002243", nom:"LE PETIT BROGNY/HOYA", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"75-77 ROUTE DU PERIMETRE - 74000 ANNECY", statut:"Actif" },
  { num:"001984", nom:"SCI LE VILLAGE / TEMPORA", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"Route de Lyon - 38140 APPRIEU", statut:"Actif" },
  { num:"002257", nom:"FLORE ET SENS", conducteur:"Joseph BILARDO", emailConducteur:"j.bilardo@epj-electricite.com", adresse:"Rue Guy Moquet - 38130 ÉCHIROLLES", statut:"Actif" },
  { num:"002279", nom:"TERRA FLORA OPAC", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"18 Chemin du Foray - 73000 CHAMBÉRY", statut:"Actif" },
  { num:"002264", nom:"BELLE ETOILE", conducteur:"Joseph BILARDO", emailConducteur:"j.bilardo@epj-electricite.com", adresse:"32, rue des Écoles - 38250 LANS-EN-VERCORS", statut:"Actif" },
  { num:"002280", nom:"FIL DE SOIE", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"105, Rue du Champs de Mars - 38630 CORBELIN", statut:"Actif" },
  { num:"002281", nom:"FLEUR DE VIGNE", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"Chemin du Fangeat - 38330 SAINT-ISMIER", statut:"Actif" },
  { num:"002282", nom:"L'ASTRÉE", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"36, place de la Gare - 38530 PONTCHARRA", statut:"Actif" },
  { num:"002275", nom:"SENNES DU LAC", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"2A chemin du Pêcheur - 73100 AIX-LES-BAINS", statut:"Actif" },
  { num:"002256", nom:"CROIX BLANCHE", conducteur:"Thibaut FRASCA", emailConducteur:"t.frasca@epj-electricite.com", adresse:"", statut:"Actif" },
];


// ─── CATALOG (583 articles from pressbook — stock col G) ───
const CATALOG = [
  {c:"Béton + Descente",s:"Capri",r:"CAP 959922",n:"BOITE MAXIBANCHE GTI IRL2",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Capri",r:"CAP 959937",n:"BOITE MAXIBANCHE DOS A DOS IRL",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Capri",r:"CAP 859320",n:"Boîtier 32 A Ø 80",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Capri",r:"CAP 598940",n:"CONE D'EXTRACTION",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Rallonge Doublage",r:"SIB P0106009",n:"Manchon doublage",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Rallonge Doublage",r:"SIB P0106108",n:"Anneau adaptateur appareil vis",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Sib",r:"SIB P01052",n:"ANNEAU A VIS UNIVERSEL",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Sib",r:"SIB P0110013",n:"BOITIER + COUVERCLE 32 AMPERES",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Blm",r:"BLI 779930",n:"BANCHEBOX IRL25 murs de 160 à 200 mm",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Blm",r:"BLI 779925",n:"BANCHEBOX IRL25 murs de 160 à 200 mm (non percée)",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Blm",r:"BLI 759010",n:"COUV. DE POSE MURBOX",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Blm",r:"BLI 759920",n:"BAGUE DE RALLONGUE MURBOX 20MM",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Blm",r:"BLI 750090",n:"DISTANCIER MURBOX TYPE 'C' 71X100 MM",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Blm",r:"BLI 759020",n:"ANNEAU A VIS MURBOX",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Blm",r:"BLI 755108",n:"AIMANT RESINE 800N JAUNE",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Tube Iro",r:"GEW DX27725",n:"IRL 3321 D25 T G TUBE IRL (GEWISS)",u:"Pièce",stock:true},
  {c:"Béton + Descente",s:"Tube Iro",r:"IBO B28970",n:"IRL 3321 D25 T G TUBE IRL",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Tube Iro",r:"IBO B28980",n:"IRL 3321 D32 T G TUBE IRL",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Terre",r:"FIL CUIVRENU25C50",n:"CUIVRE NU 1X25²  50M",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Terre",r:"KKE RG10-50",n:"RACCORD A GRIFFES 10 A 50MM",u:"Pièce",stock:false},
  {c:"Béton + Descente",s:"Terre",r:"CAT AMG-10",n:"PIQUET AC/GALVA D.16MMX1,00M",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Icta",r:"EFI ECICTA20T",n:"FLEX ICTA 3422 AVEC FIL 20MM",u:"Pièce",stock:true},
  {c:"Conduit + Manchon",s:"Icta",r:"EFI ECICTA25T",n:"FLEX ICTA 3422 AVEC FIL 25MM",u:"Pièce",stock:true},
  {c:"Conduit + Manchon",s:"Icta",r:"EFI ECICTA32T",n:"FLEX ICTA 3422 AVEC FIL 32MM",u:"Pièce",stock:true},
  {c:"Conduit + Manchon",s:"Icta",r:"EFI ECICTA40T",n:"FLEX ICTA 3422 AVEC FIL 40MM",u:"Pièce",stock:true},
  {c:"Conduit + Manchon",s:"Manchon",r:"SIB P0300209",n:"MANCHON ICT 20",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Manchon",r:"SIB P0300254",n:"MANCHON ICT 25",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Manchon",r:"SIB P0300322",n:"MANCHON ICT 32",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Manchon",r:"SIB P0300400",n:"MANCHON ICT 40",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Janolene Rouge",r:"PUM 55148",n:"COURONNE GAINE TPC 450N ROUGE 50M D 40",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Janolene Rouge",r:"PUM 55142",n:"COURONNE GAINE TPC 450N ROUGE 25M D 63",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Janolene Rouge",r:"PUM 55144",n:"COURONNE GAINE TPC 450N ROUGE 25M D 90",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Janolene Rouge",r:"PUM 55145",n:"COURONNE GAINE TPC 450N ROUGE 25M D 110",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Janolene Rouge",r:"PUM 55147",n:"COURONNE GAINE TPC 450N ROUGE 25M D 160",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Janolene Ik10",r:"CNT 12024320",n:"RLX ICTA 3522 IK10 25M AV.TIRE FIL D63",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Janolene Ik10",r:"CNT 12025120",n:"RLX ICTA 3522 IK10 25M AV.TIRE FIL D90",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Janolene Ik10",r:"CNT 12025520",n:"RLX ICTA 3522 IK10 25M AV.TIRE FIL D110",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Janolene Ik10",r:"PUM 64998",n:"RLX ICTA 3522 IK10 25M AV.TIRE FIL D160",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Pvc Ft",r:"PUM 12867",n:"GAINE PVC LST 6M 45X1,8",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Pvc Ft",r:"PUM 56220",n:"COURBE TELECOM MF-90' R210 D 45",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Pvc Ft",r:"PUM 7600",n:"COURBE TELECOM MF-45' R525 D 45",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Tube Iro",r:"IBO B28960",n:"Tube iro - PVC - tulipé - Ø20 mm - long 3 m - Gris",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Tube Iro",r:"IBO B28970",n:"Tube iro - PVC - tulipé - Ø25 mm - long 3 m - Gris",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Tube Iro",r:"IBO B28990",n:"Tube iro - PVC - tulipé - Ø40 mm",u:"Pièce",stock:false},
  {c:"Conduit + Manchon",s:"Tube Iro",r:"IBO B29010",n:"Tube iro - PVC - tulipé - Ø63 mm",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Tableautin",r:"GW42001",n:"TABLEAUTIN 200X150X40 IP41 (BS)",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Tableautin",r:"MIH R152",n:"TABLEAU BOIS (BS)",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Tableautin",r:"MIH R150",n:"TABLEAU BOIS (DECT)",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Installation De Chantier",r:"BRE 1159961",n:"SOCLE 4 PRISES NOIR IP44 AVEC VOLETS (REGLETTE)",u:"Pièce",stock:true},
  {c:"Équip. Sous-Sol",s:"Installation De Chantier",r:"DIG-31132",n:"Coffret de distribution 4 PC 2P+T + AU",u:"Pièce",stock:true},
  {c:"Équip. Sous-Sol",s:"Installation De Chantier",r:"DIG-31324",n:"Coffret de distribution 4PC Nf/1PC 3P+N+T 32A + AU",u:"Pièce",stock:true},
  {c:"Équip. Sous-Sol",s:"Installation De Chantier",r:"ARI 50416",n:"ECOLED BLC 5,5W/4000K (LAMPE CHANTIER)",u:"Pièce",stock:true},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 607000",n:"SIMPLY 35W 4000K 4196lm (FLUO COURT)",u:"Pièce",stock:true},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 607001",n:"SIMPLY 50W 4000K 5517lm (FLUO LONG)",u:"Pièce",stock:true},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 607011",n:"SIMPLY 50W 4000K 5517lm (FLUO LONG) + 1M50 de câble",u:"Pièce",stock:true},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 830000",n:"HUBO 18W CCT 4000K 1678lm (LOCAUX ANNEXE)",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 830001",n:"HUBO 18W DET CCT 4000K 1678lm (LOCAUX ANNEXE)",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 830020",n:"HUBO 8/15W CCT 4000K 1678lm (LOCAUX ANNEXE)",u:"Pièce",stock:true},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 830021",n:"HUBO 8/15W DET CCT 4000K 1678lm (LOCAUX ANNEXE)",u:"Pièce",stock:true},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 830022",n:"HUBO 17/24W CCT 4000K 1678lm (LOCAUX ANNEXE)",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 830023",n:"HUBO 17/24W DET CCT 4000K 1678lm (LOCAUX ANNEXE)",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Detecteur",r:"BE4 91101",n:"LC CLICK DETECTEUR 140DEG BLANC",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Detecteur",r:"BE4 91102",n:"LC CLICK DETECTEUR 200DEG BLANC",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Detecteur",r:"BE4 92194",n:"DETECTEUR PD3-1C-APPLIQUE 360°",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"B.a.e.s.",r:"ZEM AGV-60-NM",n:"Grille de protection IK 10 pour bloc XENA FLAT",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"B.a.e.s.",r:"ZEM LXF-3045EX",n:"Bloc évacuation SATI 45 lms IP42/IK04 - 0,85w",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Tube Iro",r:"SCH IMT35201",n:"(TUBE NOIR POUR BS) IRL X LOURD 4554 STD 20",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Tube Iro",r:"SCH IMT35213",n:"MANCHON Ø20 TUB.LOURD SS HALO",u:"Pièce",stock:true},
  {c:"Équip. Sous-Sol",s:"Tube Iro",r:"IBO B28960",n:"Tube iro - PVC - tulipé - Ø20 mm - long 3 m - Gris",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Tube Iro",r:"IBO B28970",n:"Tube iro - PVC - tulipé - Ø25 mm - long 3 m - Gris",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Equipement Box Garage",r:"POI MM32LM",n:"Compteur monophasé 45A Certifié MID",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Equipement Box Garage",r:"ENI P01330740",n:"COMPTEUR MEMO MD32 230VAC 32A",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Equipement Box Garage",r:"BLD BL000047",n:"MILO-HUBLOT-1XE27-IK10-IP65 (ECL BOX)",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Equipement Box Garage",r:"RES 830251",n:"RESIDETECT INFRAROUGE 1XE27 BLANC (ECL BOX AVEC DET)",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"Equipement Box Garage",r:"BIY 80100038991",n:"ECOBASIC LED A60 E27 240V 10W",u:"Pièce",stock:false},
  {c:"Plexo",s:"Boite Plexo",r:"BLI 560409",n:"BOITE PLEXO 100X100",u:"Pièce",stock:true},
  {c:"Plexo",s:"Boite Plexo",r:"BLI 560209",n:"BOITE PLEXO Ø70",u:"Pièce",stock:true},
  {c:"Plexo",s:"Boite Plexo",r:"BLI 560309",n:"BOITE PLEXO 80x80",u:"Pièce",stock:true},
  {c:"Plexo",s:"Boite Plexo",r:"BLI 515509",n:"BOITE OPTIBOX IP55 1/4T 155X110X80",u:"Pièce",stock:false},
  {c:"Plexo",s:"Boite Plexo",r:"BLI 515609",n:"BOITE PLEXO 175x150x80",u:"Pièce",stock:false},
  {c:"Plexo",s:"Prise",r:"SCH MUR35031",n:"PRISE PLEXO EN SAILLIE GRIS",u:"Pièce",stock:false},
  {c:"Plexo",s:"Prise",r:"SCH MUR39030",n:"PRISE PLEXO EN SAILLIE BLANC",u:"Pièce",stock:false},
  {c:"Plexo",s:"Prise",r:"SCH MUR36010",n:"PRISE PLEXO IRVE EN SAILLIE GRIS",u:"Pièce",stock:false},
  {c:"Plexo",s:"Prise",r:"SCH MUR39010",n:"PRISE PLEXO IRVE EN SAILLIE BLANC",u:"Pièce",stock:false},
  {c:"Plexo",s:"Va Et Vient",r:"SCH MUR35021",n:"VA-ET-VIENT PLEXO SAILLI GRIS",u:"Pièce",stock:false},
  {c:"Plexo",s:"Va Et Vient",r:"SCH MUR39021",n:"VA-ET-VIENT PLEXO SAILLI BLANC",u:"Pièce",stock:false},
  {c:"Plexo",s:"Bp",r:"SCH MUR35026",n:"BP PLEXO EN SAILLIE GRIS",u:"Pièce",stock:false},
  {c:"Plexo",s:"Bp",r:"SCH MUR39026",n:"BP PLEXO EN SAILLIE BLANC",u:"Pièce",stock:false},
  {c:"Plexo",s:"Support Saillie",r:"SCH MUR37911",n:"SUPPORT 1 POSTE GRIS",u:"Pièce",stock:false},
  {c:"Plexo",s:"Support Saillie",r:"SCH MUR39911",n:"SUPPORT 1 POSTE BLANC",u:"Pièce",stock:false},
  {c:"Plexo",s:"Support Saillie",r:"SCH MUR37914",n:"SUPPORT 2 POSTE HORIZONTAL GRIS",u:"Pièce",stock:false},
  {c:"Plexo",s:"Support Saillie",r:"SCH MUR39914",n:"SUPPORT 2 POSTE HORIZONTAL BLANC",u:"Pièce",stock:false},
  {c:"Plexo",s:"Support Saillie",r:"SCH MUR37912",n:"SUPPORT 2 POSTE VERTICAL GRIS",u:"Pièce",stock:false},
  {c:"Plexo",s:"Support Saillie",r:"SCH MUR39912",n:"SUPPORT 2 POSTE VERTICAL BLANC",u:"Pièce",stock:false},
  {c:"Placo",s:"Simple",r:"BLI 613409",n:"LOT DE 300 BLUE BOX + SIMPLES + SCIE CLOCHE",u:"Pièce",stock:false},
  {c:"Placo",s:"Simple",r:"BLI 675400",n:"LOT DE 500 NO AIR II + 1 SCIE CLOCHE",u:"Pièce",stock:false},
  {c:"Placo",s:"Simple",r:"BLI 613409U",n:"BOITE PLACO BLUE BOX Ø68 SIMPLE UNITAIRE",u:"Pièce",stock:true},
  {c:"Placo",s:"Simple",r:"BLI 675400U",n:"BOITE PLACO NO AIR Ø68 SIMPLE UNITAIRE",u:"Pièce",stock:true},
  {c:"Placo",s:"Simple 32a",r:"CAP 736869",n:"CAPRICLIPS SIMPLE 32 AMPERES",u:"Pièce",stock:false},
  {c:"Placo",s:"Simple 32a",r:"BLI 690860",n:"Boîtier 32 Amp. No Air D.86 prof.40",u:"Pièce",stock:false},
  {c:"Placo",s:"Double",r:"BLI 620719",n:"BOITE  DOUBLE ENTRAXE 71mm",u:"Pièce",stock:false},
  {c:"Placo",s:"Double",r:"BLI 682710",n:"BOITE NO AIR DOUBLE ENTRAXE 71mm",u:"Pièce",stock:false},
  {c:"Placo",s:"Triple",r:"EUR 52046",n:"BOITE  TRIPLE ENTRAXE 71mm",u:"Pièce",stock:false},
  {c:"Placo",s:"Triple",r:"BLI 683710",n:"BOITE NO AIR TRIPLE ENTRAXE 71mm",u:"Pièce",stock:false},
  {c:"Placo",s:"Quadruple",r:"EUR 52048",n:"BOITE  QUADRUPLE ENTRAXE 71mm",u:"Pièce",stock:false},
  {c:"Placo",s:"Quadruple",r:"BLI 684710",n:"BOITE NO AIR QUADRUPLE ENTRAXE 71mm",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"BLI 685500",n:"BOITE MICRO MODULE NO AIR",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"BLI 759020",n:"ANNEAU POUR APPAREILLAGE",u:"Pièce",stock:false},
  {c:"Divers",s:"Kit Dcl + Kit Dcl Bbc",r:"BLI 610559",n:"POINT DE CENTRE BLUE BOX DCL HT55 D67",u:"Pièce",stock:false},
  {c:"Divers",s:"Kit Dcl + Kit Dcl Bbc",r:"CAP 735049",n:"CAPRICLIPS POINT DE CENTRE DCL HT40 D86",u:"Pièce",stock:false},
  {c:"Divers",s:"Kit Dcl + Kit Dcl Bbc",r:"BLI 670510",n:"NO AIR BBC POINT DE CENTRE DCL HT55 D67",u:"Pièce",stock:false},
  {c:"Divers",s:"Kit Dcl + Kit Dcl Bbc",r:"EUR 53063",n:"Eur Ohm - Point de centre air'metic d85​​​​​​​",u:"Pièce",stock:false},
  {c:"Divers",s:"Kit Dcl + Kit Dcl Bbc",r:"BLI 670860",n:"Point Centre GV No Air DCL D.86 Prof.40",u:"Pièce",stock:false},
  {c:"Divers",s:"Bac D'encastrement + Porte",r:"AOE PATT0",n:"Pettite trappe affleurante pour BTT26",u:"Pièce",stock:false},
  {c:"Divers",s:"Bac D'encastrement + Porte",r:"AOE PATT2",n:"Porte affleurante pour BTT26",u:"Pièce",stock:false},
  {c:"Divers",s:"Bac D'encastrement + Porte",r:"AOE GTA203",n:"Partie démontable haute pour PATT 766*518mm",u:"Pièce",stock:false},
  {c:"Divers",s:"Bac D'encastrement + Porte",r:"AOE BTT20CBL",n:"Bac 2 travées PC+4R+ VA avec tableau com intégré 200 mm",u:"Pièce",stock:false},
  {c:"Divers",s:"Bac D'encastrement + Porte",r:"AOE BTT20CBLX3",n:"Lot de 3 Bac 2 travées PC+4R+ VA avec tableau com intégré 200 mm",u:"Pièce",stock:false},
  {c:"Divers",s:"Gtl",r:"GTL235ES01",n:"1 FOND 235 + 1 COUVERCLE + SANS SUPPORT + SANS EMBALLAGE",u:"Pièce",stock:false},
  {c:"Divers",s:"Gtl",r:"GTL235ED02",n:"1 FOND 235 + 2 COUVERCLES + 1 CLOISON + 6 SUPPORTS, CONDITIONNEE PAR 4",u:"Pièce",stock:false},
  {c:"Divers",s:"Gtl",r:"ELGTL00005",n:"CORNET EPANOUISSEUR POUR 1 GTL EXTRUDEE DIM 400X160",u:"Pièce",stock:false},
  {c:"Divers",s:"Gtl",r:"ELGTL00007",n:"CORNET EPANOUISSEUR POUR 1 GTL EXTRUDEE DIM 540X170",u:"Pièce",stock:false},
  {c:"Divers",s:"Gtl",r:"ELGTL00006",n:"CORNET EPANOUISSEUR POUR 1 GTL EXTRUDEE DIM 540X170",u:"Pièce",stock:false},
  {c:"Divers",s:"Bac D'encastrement + Porte",r:"LPE 98129",n:"MORTIER ADHESIF KRAFT 25KG MAP",u:"Pièce",stock:true},
  {c:"Colonne Montante",s:"Coffret De Façade",r:"BEO 0702",n:"BORNE ECP2D",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Coffret De Façade",r:"BEO 0706",n:"BORNE ECP3D",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Spcm",r:"BEO 1613",n:"CC 200A SPCM+cornet+2DEP.95MM2",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Spcm",r:"BEO 1615",n:"CC 200A SPCM ARR 240 + CORNET",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Spcm",r:"BEO 0854",n:"KIT LIAISON DIST.400A - 1 SPCM",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Distributeur",r:"BEO 0960",n:"DISTRIBUTEUR ARRIVEE 200A 3 DEP CPF",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Distributeur",r:"BEO 0961",n:"DISTRIBUTEUR 200A",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Porte Fusible",r:"BEO 0962",n:"ENSEMBLE CPF 60A UNIVERSEL MONO",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Porte Fusible",r:"BEO 0963",n:"ENSEMBLE CPF 60A UNIVERSEL TRI",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Colonne De Terre",r:"BEO 3115",n:"REPARTITEUR DE TERRE 6 DERIVATIONS ALU",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Colonne De Terre",r:"BEO 3116",n:"REPARTITEUR DE TERRE 12 DERIVATIONS ALU",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Colonne De Terre",r:"BEO 3131",n:"BARRETTE DE COUPURE DE TERRE BASSE CUIVRE",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Colonne De Terre",r:"BEO 3105",n:"BARRETTE DE COUPURE DE TERRE BASSE ALU",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Colonne De Terre",r:"BEO 3106",n:"BARRETTE DE COUPURE DE TERRE BASSE ALU AVEC BOITIER",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Tri",r:"BEO 0410",n:"PANNEAU 330x330 COMPTEUR TRI + DISJ.",u:"Pièce",stock:true},
  {c:"Colonne Montante",s:"Tri",r:"BEO 0451",n:"TAB.250x550 CBE TRI+DISJ+CONNECT.ARR.",u:"Pièce",stock:true},
  {c:"Colonne Montante",s:"Tri",r:"LEG 401012",n:"DISJ.BRANCH.4P 10/30A 500MA S",u:"Pièce",stock:true},
  {c:"Colonne Montante",s:"Tri",r:"LEG 401013",n:"DISJ.BRANCH.4P 30/60A 500MA S",u:"Pièce",stock:true},
  {c:"Colonne Montante",s:"Tri",r:"BEO 04100153",n:"PLAT.0410 + 0153 DISJ.4X10/30S",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Tri",r:"BEO 04100154",n:"PLAT.0410 + 0154 DISJ.4X30/60S",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Tri",r:"BEO 0175",n:"TAB.250x550 CBE + DISJ.4X10/30 S",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Tri",r:"BEO 0176",n:"TAB.250x550 CBE + DISJ.4X30/60 S",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Fouet",r:"BEO 3140",n:"FOUET EBCP TRI",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Fouet",r:"BEO 3109",n:"FOUET EBCP MONO",u:"Pièce",stock:false},
  {c:"Colonne Montante",s:"Tete De Cable",r:"TRM 82914",n:"EXT. E4R 10-35²",u:"Pièce",stock:true},
  {c:"Colonne Montante",s:"Tete De Cable",r:"TRM 82915",n:"EXT. E4R 50-150²",u:"Pièce",stock:true},
  {c:"Colonne Montante",s:"Tete De Cable",r:"TRM 82916",n:"EXT. E4R 240²",u:"Pièce",stock:true},
  {c:"Colonne Montante",s:"Tete De Cable",r:"BLI 694000",n:"BOUCHON ETANCHE NO AIR ICTA 40",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"Tronçon Alu",r:"FIL AR2V1X35TGL",n:"AR2V ALU 1X35 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Tronçon Alu",r:"FIL AR2V1X50TGL",n:"AR2V ALU 1X50TGL",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Tronçon Alu",r:"FIL AR2V1X70TGL",n:"AR2V ALU 1X70 TGL",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Tronçon Alu",r:"FIL AR2V1X95TGL",n:"AR2V ALU 1X95 TGL",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Tronçon Alu",r:"FIL AR2V1X120TGL",n:"AR2V ALU 1X120 TGL",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Tronçon Cuivre",r:"FIL R2V1X35TGL",n:"R2V CU 1X35 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Tronçon Cuivre",r:"FIL R2V1X50TGL",n:"R2V CU 1X50 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Tronçon Cuivre",r:"FIL R2V1X70TGL",n:"R2V CU 1X70 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Tronçon Cuivre",r:"FIL R2V1X95TGL",n:"R2V CU 1X95 TGL",u:"ML",stock:false},
  {c:"Équipement Commun",s:"Detecteur",r:"BE4 92194",n:"DETECTEUR PD3-1C-AP SAILLIE",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Detecteur",r:"BE4 92197",n:"DETECTEUR PD3-1C-FP ENCASTRE",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Detecteur",r:"BE4 91101",n:"LC CLICK DETECTEUR 140DEG BLANC",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Detecteur",r:"BE4 91102",n:"LC CLICK DETECTEUR 200DEG BLANC",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Detecteur",r:"BE4 92144",n:"PD4N-1C-AP DETECTEUR DE MOUVEMENT EN SAILLIE",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Detecteur",r:"BE4 92149",n:"PD4N-1C-FP DETECTEUR DE MOUVEMENT FAUX PLAFOND",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Detecteur",r:"YUX EP10428746",n:"Détecteur de mouvement de plafond MD-FLAT 360i/8 BK ENCASTRE",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Detecteur",r:"YUX EP10055416",n:"Détecteur de mouvement de plafond MD-C 360i/8 BK SAILLI",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Report Defaut",r:"SCH NU3772",n:"Voyant 230V vert rouge inco 2m",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Report Defaut",r:"SCH NU7002PC",n:"Support fixation 2m plastique",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Report Defaut",r:"SCH NU400218",n:"Plaque de finition Blanc 1P",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Tableau + Gtl",r:"SCH R9H13401",n:"TABLEAU 1 RANGEE",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Tableau + Gtl",r:"SCH R9H13402",n:"TABLEAU 2 RANGEES",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Tableau + Gtl",r:"DIG 07813",n:"TABLEAU 3 RANGEES",u:"Pièce",stock:true},
  {c:"Équipement Commun",s:"Tableau + Gtl",r:"SCH R9HKT13",n:"kit goulotte GTL 13M",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Tableau + Gtl",r:"SCH R9HKT18",n:"kit goulotte GTL 18M",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"B.a.e.s. Commun",r:"ZEM LXF3017EX",n:"BAEH XENA FLAT SATI 5H 8LM IP42/IK04 NP NF NI-CD 1.2W",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"B.a.e.s. Commun",r:"ZEM 90091NMF",n:"PORTE ETIQUETTE ENCASTRE XENA-DIANA-PICTO NON INCLUS",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"B.a.e.s. Commun",r:"ZEM APV000OP",n:"ETIQUETTE ADHESIVE OPAQUE MILTIDIRECTION - XENA - FORMAT 390",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Dad",r:"FRA NEU4710R1C",n:"DECLENCHEUR MANUEL ROUGE 1 CONTACT + CAPOT",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Dad",r:"FRA FINCARAIBES1",n:"DAD SECOURU AVEC 2 BATTERIES 12V 1.2AH",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Dad",r:"FRA FINSEXTANTDOC",n:"DETECTEUR OPTIQUE FUMEE CONVENTIONNEL SEXTANT 12/24V + SOCLE",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Coupure Pompier",r:"GEW FR60161",n:"COFFRET CHAUFFERIE MONOPHASÉ",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Coupure Pompier",r:"GEW FR60160",n:"COFFRET CHAUFFERIE TRI+NEUTRE",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"Coupure Pompier",r:"GW42201",n:"COFFRET IP55 SYST.SECUR.AVEC BOUT.POUSSO",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Lot",r:"SCH S523059P",n:"LOT DE 40 PC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Lot",r:"SCH S523204P",n:"LOT DE 60 VA ET VIENT",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S520059",n:"PC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S520276",n:"BP VOYANT",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S520204",n:"VA ET VIENT",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S520263",n:"INTER VOYANT",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S520263",n:"VA ET VIENT LUMINEUX",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S520214",n:"DOUBLE VA ET VIENT",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S520206",n:"BOUTON POUSSOIR",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S520246",n:"BP SONNETTE",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S520208",n:"MONTE ET BAISSE VR",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Tv / Rj45",r:"SCH S520451",n:"TV/FM",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Tv / Rj45",r:"SCH S520461",n:"TV/FM/SAT",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Tv / Rj45",r:"SCH VDIB1772XB12",n:"NOYAUX  ONE RJ45 CAT6A BLINDE",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Tv / Rj45",r:"SCH S520400",n:"SUPPORT RJ 45 SIMPLE",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Tv / Rj45",r:"SCH S520410",n:"SUPPORT RJ 45 DOUBLE",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Accessoire",r:"SCH S520299",n:"SACHET DE RESSORT ODACE",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Accessoire",r:"SCH S520666",n:"OBTURATEUR",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Accessoire",r:"SCH S520291",n:"ACCESSOIRE VOYANT LED BASSE CONSO (PAR CABLE)",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S520702",n:"PLAQUE SIMPLE ODACE STYL",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S520704",n:"PLAQUE DOUBLE ODACE STYL",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S520706",n:"PLAQUE TRIPLE ODACE STYL",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S520708",n:"PLAQUE QUADRUPLE ODACE STYL",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S523702P",n:"LOT DE 100 PLAQUES ODACE STYL",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S520802",n:"PLAQUE ODACE TOUCH",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S520804",n:"PLAQUE DOUBLE ODACE TOUCH",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S520806",n:"PLAQUE TRIPLE ODACE TOUCH",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S520808",n:"PLAQUE QUADRUPLE ODACE TOUCH",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Appareillage Special",r:"SCH S520519",n:"VARIATEUR UNIVERSEL - BLANC - LED 400W",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Appareillage Special",r:"SCH S520523",n:"ODACE DETECT TT CHARG BLC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Lot",r:"SCH S320059P",n:"LOT 108 2P+T A PUITS BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Lot",r:"SCH S320052P",n:"LOT 108 2P+T AFFLEURANTE BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Lot",r:"SCH S320204P",n:"LOT 108 VA ET VIENT BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Lot",r:"SCH  S320214P",n:"LOT 108 DOUBLE VV BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Lot",r:"SCH  S320476P",n:"LOT 108 RJ45 CAT6 STP BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S320059",n:"PC 2P+T A PUITS BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S320052",n:"PC 2P+T AFFLEURANTE BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S320204",n:"VA ET VIENT BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH  S320214",n:"DOUBLE VV BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S320206",n:"POUSSOIR FERMETURE BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S320266",n:"POUSSOIR PORTE ETIQUETTE BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S320666",n:"OBTURATEUR BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Pc + Commande Unitaire",r:"SCH S320208",n:"INTER VOLET ROULANT BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Commande Dloble",r:"SCH S320216",n:"DOUBLE POUSSOIR BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Commande Dloble",r:"SCH S320263",n:"VA ET VIENT LUM+LAMPE BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Commande Dloble",r:"SCH S320285",n:"COMBI VV + POUSSOIR BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Tv / Rj45",r:"SCH  S320476",n:"RJ45 CAT6 STP BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Tv / Rj45",r:"SCH S320451",n:"PRISE TV - R BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Tv / Rj45",r:"SCH S320461",n:"PRISE TV-R-SAT BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Appareillage Special",r:"SCH S320519",n:"VARIATEUR",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Appareillage Special",r:"SCH S320236",n:"POUSSOIR VMC BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Appareillage Special",r:"SCH S320523",n:"DETECTEUR DE MOUVEMENT / PRÉSENCE",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S320702P",n:"LOT 360 PLAQUES 1P BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S320704P",n:"LOT 180 PLAQUES 2P HOR BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S320702",n:"PLAQUE 1 POST BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S320704",n:"PLAQUE 2 POST HORIZ 71MM BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S320724",n:"PLAQUE 2 POST VERT 71MM BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S320706",n:"PLAQUE 3 POST HORIZ 71MM BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S320726",n:"PLAQUE 3 POST VERT 71MM BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Plaque",r:"SCH S320708",n:"PLAQUE 4 POST HORIZ 71MM BLANC",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Sortie De Cable",r:"BLI 605201",n:"SORTIE DE CABLE 16A",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Sortie De Cable",r:"BLI 605320",n:"SORTIE DE CABLE 32A",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Sortie De Cable",r:"BLI 605211",n:"SORTIE DE CABLE 16A IP44",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Sortie De Cable",r:"BLI 605215",n:"SORTIE DE CABLE 16A GRIFFES",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Sortie De Cable",r:"EUR 60087",n:"SORTIE DE CABLE 32A GRIFFES",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Dcl",r:"BLI 600800",n:"COUVERCLE D'APPLIQUE Ø67",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Dcl",r:"BLI 601200",n:"COUVERCLE DCL Ø120",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Dcl",r:"EUR 53042F",n:"Couv. de finition DCL d 120 IP44 avec membrane caoutchouc",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Dcl",r:"BLI 601300",n:"COUVERCLE DCL Ø130",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Douille + Fiche",r:"BLI 710100",n:"DOUILLE E27 + FICHE DCL",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Douille + Fiche",r:"BLI 710110",n:"FICHE DCL",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Piton",r:"BLI 754110",n:"PITON L 85mm",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Piton",r:"BLI 750192",n:"PITON L 100mm",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Piton",r:"BLI 750193",n:"PITON L 120mm",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Piton",r:"BLI 750194",n:"PITON L 130mm",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Piton",r:"SIB P0039940",n:"Piton + ressort lame pour boite Ø100",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Couvercle Vierge",r:"SIB P0221090",n:"Couvercle de finition diametre ext 82",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Couvercle Vierge",r:"SIB P0221091",n:"Couvercle de finition diametre ext 70",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Couvercle Vierge",r:"SIB P03210",n:"Couvercle finition petite et grande tete de pieuvre Ø85",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Couvercle Vierge",r:"SIB P0211048",n:"Couvercle finition petite et grande tete de pieuvre Ø100",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Seche-serviette",r:"ATL 831416",n:"SECHE-SERVIETTE DEVO-DCB18 500W",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Seche-serviette",r:"ATL 831417",n:"SECHE-SERVIETTE DEVO-DCB18 750W",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Appareillage Special",r:"LEG 081988",n:"BOITE D'ENCASTREMENT PRISE DE SOL",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Appareillage Special",r:"LEG 089760",n:"PRISE SOL 2P+T 16A CARRÉE IB",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Appareillage Special",r:"LEG 089770",n:"PRISE SOL 2P+T 16A RONDE IB",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Divers",r:"POI MM100TC",n:"COMPTEUR ELECTRIQUE MONOPHASE 100 A AVEC TRANSFORM",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Divers",r:"LCI 031276",n:"compteur multi-mesure monophasé, sur TI 100A fourni",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Divers",r:"SAT DIG04924",n:"COMPTEUR WIFI MONO + TORE OUVRANT 60A - DIGITAL ELECTRIC",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Tv",r:"AOE GTC113",n:"Répartiteur TV/SAT 3 sorties-1 entrée",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Noyaux Rj",r:"BLI 731110",n:"Lot de 100 noyaux RJ45 G3",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Noyaux Rj",r:"BLI 731110U",n:"Noyaux RJ45 G3",u:"Pièce",stock:true},
  {c:"Courant Faible",s:"Répartiteur Tv / Rj45",r:"EVC ABS021RJKIT",n:"KIT REPARTITEUR ULB 2 DIR. F/RJ45 + 2 CORDONS RJ/RJ PLATS",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Répartiteur Tv / Rj45",r:"EVC ABS041RJKIT",n:"KIT REPARTITEUR ULB 4 DIR. F/RJ45 + 4 CORDONS RJ/RJ PLATS",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Répartiteur Tv / Rj45",r:"BLI 731102",n:"Prise simple 2P+T encastrable 45x45 mm",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Répartiteur Tv / Rj45",r:"SAT DECDCP1PCDBC003",n:"PRISE PC 2PLOT +TERRE DROITE BLANCHE ENCASTRABLE 45X45",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Pri",r:"RTSB-70-001015",n:"PBO T2 Boîtier pour point de branchement V2 - vide",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Pri",r:"RTSB-01-100160",n:"Cassette 12 fusions 1pas",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Pri",r:"RTSB-01-100161",n:"Cassette 24 Fusions 1pas pour BPEO & PBO",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Pbo",r:"RTSB-73-911111000",n:"PTO THD FACTORY 1FO équipée 1Rac&1Pigtail SC-APC",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Pbo",r:"RTSB-73-943144000",n:"Lot de 10 PTO THD FACTORY 80/80 4FO SCAPC",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Di 1 Fo",r:"RTSB-73-913111030",n:"KIT PTO/DTIO THD FACTORY 1FO SCAPC LSZH 30M",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Di 1 Fo",r:"TET RTSB-73-913111050",n:"KIT PTO THD FACTORY 1FO SCAPC LSZH 50M",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Di 4 Fo",r:"RTSB-73-993144030",n:"KIT DTIO MOD THD FACTORY 4FO SCAPC LSZH 30M",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Di 4 Fo",r:"TET RTSB-73-943144050",n:"KIT PTO THD FACTORY 4FO SCAPC LSZH 50M",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Amorçe Fibre",r:"TET CTSH-33-246024N",n:"Câble Colonne mte M6 G657A2 LSZH FRP LAT 24FO",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Amorçe Fibre",r:"TET CTSH-33-246048N",n:"Câble Colonne mte M6 G657A2 LSZH FRP LAT 48FO",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Amorçe Fibre",r:"TET CTSH-33-246096N",n:"Câble Colonne mte M6 G657A2 LSZH FRP LAT 96FO",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"MAE 0145332R13",n:"ANTENNE TNT 13DB LTE 700-5G",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"EVC EALBPROG32L",n:"AMPLIFICATEUR 50 DB PROGRAMMABLE 32 CANAUX A TRES HAUTE SELE",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"EVC AWC611",n:"DERIVATEUR TERMINAL 5 - 1 220 MHZ 6 SORTIES -11 DB",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"EVC AWC408",n:"DERIVATEUR TERMINAL 5 - 1 220 MHZ 4 SORTIES -8 DB",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"EVC AWC812",n:"DERIVATEUR TERMINAL 5 - 1 220 MHZ 8 SORTIES -12 DB",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"EVC ABS021RJKIT",n:"KIT REPARTITEUR ULB 2 DIR. F/RJ45 + 2 CORDONS RJ/RJ PLATS +",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"EVC ABS041RJKIT",n:"KIT REPARTITEUR ULB 4 DIR. F/RJ45 + 4 CORDONS RJ/RJ PLATS +",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"EVC EPRI2SDIN",n:"AMPLIFICATEUR D'APPARTEMENT TV + SAT 2 SORTIES",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"EVC EPRI224",n:"AMPLIFICATEUR D'APPARTEMENT TV REGLABLE 2 SORTIES",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"SAT ANT-DPA001",n:"AMPLIFICATEUR PROGRAMMABLE 55DB 32 CANAUX 3E V/ U 1E FMFILTRE 4G/ 5G ANTTRON",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"SAT 6831",n:"PATTE EN M DEP.200MM GALVANISE",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"SAT OPT-4015",n:"MAT D.40MM L.1,5M EMBOITABLE GALVANISE",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"SAT OPT-50151",n:"MAT D.50MM L.1,5M EMBOITABLE GALVANISE",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"MAE 0140880",n:"ANT SMC 100 V2 MONTURE LONGUE",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"MAE 0914801R13",n:"CONV QUATTRO > 4 SORTIES",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"D3EES45033",n:"ECO-TAXE",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"MAE 0914513",n:"SUPP 6° REG ÉLEV PR SMC100/120",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"SAT FVS4P",n:"REPARTITEUR 4D BLINDE F ULB PASSAGE CC",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"SAT FAG-85278",n:"DERIVATEUR 6D 5/ 2300 MHZ -15DB DER615 - FAGOR",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"SAT FAG-85281",n:"DERIVATEUR ULB 8D 5/ 2300 MHZ -15DB DER815 - FAGOR",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"EVC AWC408",n:"DERIVATEUR TERMINAL 5 - 1 220 MHZ 4 SORTIES -8 DB",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"EVC SREP804",n:"REPARTITEUR SYMETRIQUE POUR COMMUTATION 8 X 8 BIS.",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"EVC SCSC9208U",n:"COMMUTATEUR UNIVERSEL 9 CABLES 8 SAT. + TERRESTRE, 8 SORTIES",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"EVC SCSC9212U",n:"COMMUTATEUR UNIVERSEL 9 CABLES 8 SAT. + TERRESTRE, 12 SORTIE",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Colonne + Antenne Tv",r:"EVC SPS25",n:"ALIMENTATION 18 VOLTS POUR COMMUTATEUR SATELLITE 8 POLARISAT",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT RCKPIC6L1020VP",n:"Kit de Démarrage VIGIK Plus Platine PIC 6 Plus - alim 4888C",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT RCKPIC6L2020VP",n:"Kit de Démarrage VIGIK Plus Platine PIC 6 Plus - alim 1210A",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT PIC6PL1020",n:"Platine PIC 6 Plus Light SBC1 avec 4680C - alim 4888C",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT PIC6PL2020",n:"Platine PIC 6 Plus Light SBC2 avec 4681 - alim 1210A",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT PICSWP6B1020",n:"Platine PIC Switch Plus Noir SBC1 avec 4680C - alim 4888C",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT PICSWP6B2020",n:"Platine PIC Switch Plus Noir SBC2 avec 4681 - alim 1210A",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT ACMRP",n:"Centrale 1 porte VIGIK PLUS",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT RCKT25VP",n:"Kit de Démarrage VIGIK Plus Lecteur T25",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT 4399",n:"Alimentation 12 Volts 4A",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT BP/408L",n:"Bouton sonore + led monté sur façade inox",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT 1210",n:"Alimentation 2 fils",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT 1595",n:"TRANSFORMATEUR D'ALIMENTATION 33VCC",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT 1214/2C",n:"BORNE DE DÉRIVATION DE SIGNAL",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT CLE/B",n:"Clé résidant mifare Bleu",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT CLE/J",n:"Clé résidant mifare Jaune",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT CLE/O",n:"Clé résidant mifare Orange",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT CLE/V",n:"Clé résidant mifare Vert",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT 6710",n:"Etrier et borne de dérivation pour moniteur mini",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT 6721W/BM",n:"Moniteur mini main libre BM blanc SB TOP",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT PL6721BM",n:"MONITEUR PEOPLE MAINS LIBRES BM 4,3 pouces",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Comelit",r:"COT PL6731BM",n:"MONITEUR PEOPLE MAINS LIBRES BM 5 pouces",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Urmet",r:"URM D83/I",n:"PLATINE VIDEO À DEFILEMENT 2VOICE 2 LIGNES PERCAGE T25 - INO",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Urmet",r:"URM CVPLUS1P",n:"CENTRALE 1 PORTE CVPLUS1P, GESTION CONNECTEE OU L/E, JUSQU'A",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Urmet",r:"URM CVPLUS1P/SP",n:"CENTRALE 1P VIGIK+ LE/IP PERSONNALISE POUR SYSTEMES URMET",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Urmet",r:"URM KDATACVPLUS1P",n:"KIT COMPLET AVEC ALIM, CENTRALE CERTIFIEE VIGIK+, LECTEUR, M",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Urmet",r:"URM ANTGPRS3G4G",n:"ANTENNE URMET POUR DEPORTER LA RECEPTION DU MODEM GPRS, 3G,",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Urmet",r:"URM 1083/75",n:"2VOICE INTERFACE 4P 4C POUR SYSTEMES URMET",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Urmet",r:"URM 1083/53",n:"INTERFACE 2 PLATINES 2 COLONNES 2VOICE 4 DIN",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Urmet",r:"URM 1083/55",n:"DERIVATEUR VIDEO 4 SORTIES 2VOICE POUR SYSTEMES URMET",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Urmet",r:"URM AL12/2DIN",n:"ALIM REGULEE 12VCC 2A, REGLABLE 12-14V, 3 MODULES, VOYANT SE",u:"Pièce",stock:false},
  {c:"Interphonie",s:"Urmet",r:"URM 1760/6",n:"MONITEUR D'INTERPHONIE MAIN-LIBRE VOG5 AVEC ÉCRAN 5' COMPATI",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Ampoule Led E27",r:"BLD BL06092002",n:"BULB LAMPE A60-E27-9W-4000K-NON DIM",u:"Pièce",stock:true},
  {c:"Lustrerie",s:"Ampoule Led E27",r:"BLD BL06092001",n:"BULB LAMPE A60-E27-9W-3000K NON DIM",u:"Pièce",stock:true},
  {c:"Lustrerie",s:"Ampoule Led Gu10",r:"SON LAPAR01",n:"LAMPE LED GU10 4.9W 535LM 3000K x5p (BLANC CHAUD)",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Ampoule Led Gu10",r:"SON LAPAR02",n:"LAMPE LED GU10  4.9W 535LM 4000K x5p (BLANC FROID)",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Ampoule Led Gu10",r:"SON LAPAR03",n:"LAMPE LED GU10 DIM 5.7W 540LM 3000K x5p (BLANC CHAUD DIM)",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Ampoule Led Gu10",r:"SON LAPAR04",n:"LAMPE LED GU10 DIM 5.7W 540LM 4000K x5p (BLANC FROID DIM)",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Ampoule Led Gu10",r:"RES 931015",n:"AMP LED 7W 756lm GU10 3000K",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Ampoule Led Gu10",r:"RES 931016",n:"AMP LED 7W 742lm GU10 4000K",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Fluo Led",r:"RES 607000",n:"SIMPLY 35W 4000K 4196lm",u:"Pièce",stock:true},
  {c:"Lustrerie",s:"Fluo Led",r:"RES 607001",n:"SIMPLY 50W 4000K 5517lm",u:"Pièce",stock:true},
  {c:"Lustrerie",s:"Local Technique / Sas Sous-sol",r:"RES 830000",n:"HUBO 18W CCT 4000K 1678lm",u:"Pièce",stock:true},
  {c:"Lustrerie",s:"Local Technique / Sas Sous-sol",r:"RES 830001",n:"HUBO 18W DET CCT 4000K 1678lm",u:"Pièce",stock:true},
  {c:"Lustrerie",s:"Escalier",r:"RES 850700",n:"KOMET 20W 4000K BLANC 2193lm",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Escalier",r:"RES 850701",n:"KOMET 20W HF 4000K BLANC 2193lm",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Escalier",r:"BLD BL12256507",n:"FOG 360-24W-3000K-IP66-DETECT",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Escalier",r:"BLD BL12256504",n:"TF100-FOG ASYM SENSOR-25W-IP66-WHITE-3000K-850°",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Circulation",r:"RES 759405",n:"MUSE ROND 18W 2231LM CCT",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Circulation",r:"RES 759407",n:"MUSE CARRE 18W 2231LM CCT",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Circulation",r:"RES 946215",n:"BALDER 500 DOWN 3000K ANTHRA",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Spot Led",r:"RES 963210",n:"MIKS 598lm CCT ANNEAU FIXE ROND BLANC",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Spot Led",r:"RES 963240",n:"MIKS 1185lm CCT ANNEAU FIXE ROND BLANC",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Spot Led",r:"RES 963222",n:"MIKS 506lm CCT B.LUM RD/RD BLANC REFLECTEUR BLANC",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Spot Led",r:"RES 9633252",n:"MIKS 1043lm CCT B.LUM RD/RD BLANC REFLECTEUR BLANC",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Spot Led",r:"RES 963226",n:"MIKS 412lm CCT B.LUM RD/RD NOIR REFLECTEUR NOIR",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Exterieur",r:"NOL 623180",n:"Bassi hub. GRAPH. E27/CFL",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Exterieur",r:"RES 946532",n:"MARKIZ E27 NOIR + LAMPE E27",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Exterieur",r:"RES 946533",n:"MARKIZ E27 BLANC + LAMPE E27",u:"Pièce",stock:false},
  {c:"Lustrerie",s:"Exterieur",r:"RES 946610",n:"LETARI 8W 3000K NR",u:"Pièce",stock:false},
  {c:"Quincaillerie",s:"Scotch",r:"WUR 0992500999",n:"RUBAN ORANGE PE CHANTIER 33M",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Scotch",r:"VIN 2000083",n:"ADHESIF PLASTIFIE 38MMX33M ROUGE",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Scotch Lock",r:"WUR 0556010",n:"CONNECTEUR BASSE TENSION 2 ENTREES J",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Scotch Lock",r:"WUR 0556012",n:"CONNECTEUR BASSE TENSION 3 ENTREES R",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Wago",r:"WUR 0556500300",n:"CONNECTEUR TRANS. REDUIT 3 ENTREES",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Wago",r:"WUR 0556500500",n:"CONNECTEUR TRANS. REDUIT 5 ENTREES",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Wago",r:"BLI 460180",n:"CONNECTEUR TRANS. REDUIT 8 ENTREES",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Wago Souple Rigide",r:"BLI 401022",n:"Borne luminaire 1 fil sple - 2 fils rigides 2,5mm²",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Wago Souple Rigide",r:"WUR 05561183",n:"CONN. MINI SPLE/RGDE 3E.KOMPAKT PLUS",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Sucre",r:"WUR 0556200102",n:"BARRETTE DE CONNEX. NOIR 2.5-10 MM²",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Sucre",r:"WUR 0556200103",n:"BARRETTE DE CONNEX. NOIR 16 MM²",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Sucre",r:"WUR 0556200120",n:"BARRETTE DE CONNEX. NOIR 25 MM²",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Collier",r:"WUR 0502109260",n:"COLSONE 260 mm",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Collier",r:"WUR 0502109360",n:"COLSONE 360 mm",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Collier",r:"WUR 0502131",n:"FRETTE 200mm",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Collier",r:"WUR 0502151",n:"FRETTE 280mm",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Embase",r:"WUR 050336537",n:"EMBASE A CHEVILLE STANDARD",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Embase",r:"WUR 0971510032",n:"FIXE-TUBES VARIABLE DIAM. 15 A 32 MM",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Mousse / Pistolet",r:"WUR 08921521",n:"MOUSSE MONTAGE PU 750ML - PISTOLABLE",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Mousse / Pistolet",r:"WUR 0892160",n:"NETTOYANT PISTOLET MOUSSE MONT.500ML",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Mousse / Pistolet",r:"VIN 0104531",n:"PISTOLET BOMBE MOUSSE POLYURET OX",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Bombe De Traçage",r:"WUR 08921751",n:"TRACEUR DE CHANTIER BLANC",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Bombe De Traçage",r:"WUR 08921753",n:"TRACEUR DE CHANTIER ROUGE FLUO",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Acrylique",r:"WUR 0892165001",n:"MASTIC ACRYLIQUE STANDARD310ML BLANC",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Silicone",r:"WUR 089285732",n:"A8 PRO SILICONE NEUTRE TRANS 310ML",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Vis",r:"WUR 019864535",n:"VIS WUPO TF POZI AC ZI 4,5X35",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Vis",r:"WUR 01986640",n:"VIS WUPO TF POZI AC ZI 6X40",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Cheville",r:"WUR 090320630",n:"CHEVILLE Ø6",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Cheville",r:"WUR 090320840",n:"CHEVILLE Ø8",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Cheville",r:"WUR 0903300301",n:"CHEVILLE ARPON Ø6",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Cheville",r:"WUR 0903300302",n:"CHEVILLE ARPON Ø8",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Ecrou / Rondelle",r:"WUR 03178",n:"ECROU M8",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Ecrou / Rondelle",r:"WUR 0411625",n:"RONDELLE M6",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Ecrou / Rondelle",r:"WUR 0411825",n:"RONDELLE M8",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Tifix",r:"WUR 5932008075",n:"TI-FIX 75 mm",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Tifix",r:"WUR 0904520804",n:"TI-FIX 165 mm",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Cheville Molly",r:"WUR 0903811634",n:"CHEV. PAROIS CREUSES 6X34 AVEC VIS",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Cheville Molly",r:"WUR 0903811675",n:"CHEV. PAROIS CREUSES 6X75 AVEC VIS",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Driva",r:"WUR 0903252",n:"CHEV-METAL-AUTOPERC-(W-GS/Z)-ZD-14,5X33",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Cheville Isolant Exterieur",r:"WUR 59035005",n:"CHEVILLE POUR ISOLATION SHARK ISO 50",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Foret",r:"WUR 0648556011",n:"FORET Ø6 COURT",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Foret",r:"WUR 0648556016",n:"FORET Ø6 LONG",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Foret",r:"WUR 0648558011",n:"FORET Ø8 COURT",u:"Pièce",stock:true},
  {c:"Quincaillerie",s:"Foret",r:"WUR 0648558016",n:"FORET Ø8 LONG",u:"Pièce",stock:true},
  {c:"Outillage",s:"Scie Cloche / Embout / Malaxeur",r:"VIN 2002057",n:"ADAPTATEUR POWER CHANGE PLUS QUEUE 6 PANS 8.7MM",u:"Pièce",stock:false},
  {c:"Outillage",s:"Scie Cloche / Embout / Malaxeur",r:"VIN 2002301",n:"SCIE TREPAN 68MM POWERCHANGE",u:"Pièce",stock:false},
  {c:"Outillage",s:"Scie Cloche / Embout / Malaxeur",r:"VIN 0421671",n:"SCIE TREPAN 86MM POWERCHANGE",u:"Pièce",stock:false},
  {c:"Outillage",s:"Scie Cloche / Embout / Malaxeur",r:"VIN 2002054",n:"FORET DE CENTRAGE PLUS HSS-G Ø7.15X85MM",u:"Pièce",stock:false},
  {c:"Outillage",s:"Scie Cloche / Embout / Malaxeur",r:"VIN421822",n:"MANDRIN AUTOMATIQUE + ADAPTATEUR SDS+",u:"Pièce",stock:false},
  {c:"Outillage",s:"Scie Cloche / Embout / Malaxeur",r:"VIN 421370",n:"PORTE EMBOUT MAGNETIQUE BOSCH",u:"Pièce",stock:false},
  {c:"Outillage",s:"Scie Cloche / Embout / Malaxeur",r:"VIN 423492",n:"TIGE MALAXAGE SVEDEN 100X500",u:"Pièce",stock:false},
  {c:"Outillage",s:"Trepant",r:"VIN 0424089",n:"FORET DE CENTRAGE SDS+ PLUS-5 S4L",u:"Pièce",stock:false},
  {c:"Outillage",s:"Trepant",r:"VIN423848",n:"PORTE OUTIL COURONNE TREPAN BOSCH",u:"Pièce",stock:false},
  {c:"Outillage",s:"Trepant",r:"VIN423846",n:"TREPAN BOSCH 68",u:"Pièce",stock:false},
  {c:"Outillage",s:"Trepant",r:"VIN423846",n:"TREPAN BOSCH 90",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 266535",n:"SEAU PLAST NOIRE 11L  310183",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 265318",n:"TENAILLE RUSSE 220MM KNIPEX",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 265160",n:"PINCE BECS MI-RONDS DR 200",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 265656",n:"POCHE CLOUS 8 POCHES TOILE",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 266176",n:"MASSETTE 1.20KG LEBOR M.BOIS",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 268413",n:"BURIN DE CARROSSIER 235MM EXTRA PLAT",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 269280",n:"BROCHE MACON 16X300 MERCIER",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 265849",n:"MARTEAU ELECTR. 18MM  GRAPHITE 200GR",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 265041",n:"COUTEAU CARBONE OPINEL N°10V",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 0269467",n:"COUTEAU AVEC SIFFLET OUTDOOR",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 264440",n:"NIVEAU COMPOSIT 40CM STANLEY",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 268884",n:"MESURE  5MX32MM MAGNET FATMAX BLADE ARMOR  STANLEY",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 268885",n:"MESURE 8MX32MM MAGNET FATMAX BLADE ARMOR STANLEY",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 266680",n:"TOURNEVIS JEU DE 6 ISOLE STAN",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 267366",n:"TOURNEVIS PROTWIST PH1 VE 1000V",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 267366",n:"TOURNEVIS PROTWIST 2X75VE 1000V",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 268501",n:"TOURNEVIS PROTWIST 4X100VE 1000V",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 268462",n:"TOURNEVIS PROTWIST FENT FORGEE 6.5X150",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"LEG 031996",n:"PINCE POUR COLLIER COLSON",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"AGI 221009",n:"PINCE DENUDE 1,5 / 2,5",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"AGI 424023",n:"COUPE CABLES",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 267416",n:"CLE MIXTE 42 10  BETA France",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 267419",n:"CLE MIXTE 42 13  BETA France",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 267467",n:"CLE A PIPE DEBOUCHEE 6X6PANS 933 10X10 BETA France",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN267470",n:"CLE A PIPE DEBOUCHEE 6X6PANS 933 13X13 BETA France",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 267323",n:"CLE BTR JEU DE 8 1.5A8 MONTURE STANLEY",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 264977",n:"SCIE A METAUX URKO",u:"Pièce",stock:false},
  {c:"Outillage",s:"Equipement Monteur",r:"VIN 264987",n:"SCIE EGOINE 152MM PANN PLATRE",u:"Pièce",stock:false},
  {c:"Outillage",s:"Platre",r:"VIN 265987",n:"TRUELLE CARREE 16 M PLASTIQUE",u:"Pièce",stock:false},
  {c:"Outillage",s:"Platre",r:"VIN 268339",n:"PLATOIR ACIER INOX 28X12",u:"Pièce",stock:false},
  {c:"Outillage",s:"Platre",r:"VIN 520144",n:"COUTEAU A ENDUIRE INOX 20CM",u:"Pièce",stock:false},
  {c:"Outillage",s:"Platre",r:"VIN 269525",n:"AUGE PLASTIQUE NOIRE N.1 25L  RUBI 88771",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"VIN 204290",n:"ESCABEAU ALU COFAQ 3 MARCHES",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"VIN 204291",n:"ESCABEAU ALU COFAQ 4 MARCHES",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"VIN 480044",n:"ENROULEUR 25M 3X1.5",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"VIN 266240",n:"COUPE BOULON SAM 1/600MM L95",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"VIN 284168",n:"HOUSSE PROTEGE PLAN 150X100",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"VIN 144404",n:"FIL DE FER N10 SEAU 20KG EN PETITE BOBINE",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"VIN 264345",n:"CORDEX PVC RONDO 30M",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"VIN 264291",n:"BIBERON POUDRE BLEU 400G",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"VIN 264307",n:"CRAYON MACON LYRA",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"VIN 1060399",n:"CRAYON GRAPHITE PICA DRY WILMART",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"VIN 1100007",n:"MINE RECHARGE PICA DRY 10 UNI WILMART",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"VIN 264987",n:"SCIE EGOINE 152MM PANN PLATRE",u:"Pièce",stock:false},
  {c:"Vêtements de travail",s:"Pantalon",r:"VIN 360505",n:"PANTALON MULTIPOCHES NOIR     T38",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Pantalon",r:"VIN 361084",n:"PANTALON MULTIPOCHES NOIR     T40",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Pantalon",r:"VIN 361085",n:"PANTALON MULTIPOCHES NOIR     T42",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Pantalon",r:"VIN 361086",n:"PANTALON MULTIPOCHES NOIR     T44",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Pantalon",r:"VIN 361087",n:"PANTALON MULTIPOCHES NOIR     T46",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-shirt",r:"TEX T-SHIRT NOIR M",n:"T-SHIRT NOIR TAILLE M",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-shirt",r:"TEX T-SHIRT NOIR L",n:"T-SHIRT NOIR TAILLE L",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-shirt",r:"TEX T-SHIRT NOIR XL",n:"T-SHIRT NOIR TAILLE XL",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-shirt",r:"TEX T-SHIRT BLEU M",n:"T-SHIRT BLEU TAILLE M",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-shirt",r:"TEX T-SHIRT BLEU L",n:"T-SHIRT BLEU TAILLE L",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-shirt",r:"TEX T-SHIRT BLEU XL",n:"T-SHIRT BLEU TAILLE XL",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-shirt",r:"TEX T-SHIRT ORANGE M",n:"T-SHIRT ORANGE TAILLE M",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-shirt",r:"TEX T-SHIRT ORANGE L",n:"T-SHIRT ORANGE TAILLE L",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-shirt",r:"TEX T-SHIRT ORANGE XL",n:"T-SHIRT ORANGE TAILLE XL",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Sweet A Capuche",r:"TEX SWEET A CAPUCHE M",n:"SWEET A CAPUCHE TAILLE M",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Sweet A Capuche",r:"TEX SWEET A CAPUCHE L",n:"SWEET A CAPUCHE TAILLE L",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Sweet A Capuche",r:"TEX SWEET A CAPUCHE XL",n:"SWEET A CAPUCHE TAILLE XL",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Veste Softshell",r:"TEX VESTE SOFTSHELL M",n:"VESTE SOFTSHELL TAILLE M",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Veste Softshell",r:"TEX VESTE SOFTSHELL L",n:"VESTE SOFTSHELL TAILLE L",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Veste Softshell",r:"TEX VESTE SOFTSHELL XL",n:"VESTE SOFTSHELL TAILLE XL",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Gilet Polaire",r:"TEX GILET POLAIRE S",n:"VESTE SOFTSHELL TAILLE M",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Gilet Polaire",r:"TEX GILET POLAIRE M",n:"VESTE SOFTSHELL TAILLE L",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Gilet Polaire",r:"TEX GILET POLAIRE  L",n:"VESTE SOFTSHELL TAILLE XL",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Bonnet / Casquette",r:"TEX BONNETG",n:"BONNET GRIS",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Bonnet / Casquette",r:"TEX BONNET N",n:"BONNET NOIR",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Bonnet / Casquette",r:"TEX CASQUETTE",n:"CAQUETTE DE SECURITE",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"Botte De Securite",r:"VIN 362357",n:"BOTTE SECURITE FOURREES ZEUS T42 K702",u:"Pièce",stock:false},
  {c:"Vêtements de travail",s:"Botte De Securite",r:"VIN 362358",n:"BOTTE SECURITE FOURREES ZEUS  T43 K702",u:"Pièce",stock:false},
  {c:"Vêtements de travail",s:"Botte De Securite",r:"VIN 362353",n:"BOTTE SECURITE FOURREES ZEUS  T44 K702",u:"Pièce",stock:false},
  {c:"Vêtements de travail",s:"Botte De Securite",r:"VIN 362360",n:"BOTTE SECURITE FOURREES ZEUS  T45 K702",u:"Pièce",stock:false},
  {c:"EPI",s:"Epi",r:"VIN 360351",n:"CASQUE CHANTIER + LUNETTE KARA   BLANC",u:"Pièce",stock:false},
  {c:"EPI",s:"Epi",r:"VIN 360471",n:"GARNITURE SANI CONTOURE CASQUE KARA",u:"Pièce",stock:true},
  {c:"EPI",s:"Epi",r:"VIN 361660",n:"GANT CHAUD NOIR SNOWFLEX T9/  T10/T11",u:"Pièce",stock:true},
  {c:"EPI",s:"Epi",r:"VIN 360027",n:"LUNETTE A BRANCHE VISILUX",u:"Pièce",stock:false},
  {c:"EPI",s:"Epi",r:"VIN 360332",n:"CASQUE ANTIBRUIT ARCEAU",u:"Pièce",stock:true},
  {c:"EPI",s:"Epi",r:"VIN 360239",n:"MASQUE PAPIER FFP2 AV VALVE",u:"Pièce",stock:true},
  {c:"Divers",s:"Général",r:"BIZ 700231",n:"GEL LUBRIFIANT POUR CABLES ET FILS BIZ'LUB",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"CAP 599200",n:"CAPRIGEL GTI 1L POUR TOUS TYPES DE CABLES",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"AGI 398443",n:"Aiguille en nylon de 25 m",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"AGI 398445",n:"Aiguille en nylon de 30 m",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"AGI 398425",n:"Tête de guidage flexible M4",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"AGI 398429",n:"Oeillet de tirage M4",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"AGI 398431",n:"Chaussette de tirage pourcâbles de ø 4 à 6 mm M4",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"AGI 398419",n:"Tête de guidage flexible à sertir",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"AGI 398421",n:"Oeillet de tirage à sertir",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"AGI 398607",n:"Pince à sertir",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"ACO R7295AST",n:"CABLE 4P CAT6A F/FTP LSOH DCA",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"ACO R8596AT5",n:"2X4P F/FTP CAT.6A LSOH- CCA-T500",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU1,5VJC100",n:"Fil H07VU 1,5 Vert/Jaune C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU1,5RGC100",n:"Fil H07VU 1,5 Rouge C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU1,5BEC100",n:"Fil H07VU 1,5 Bleu C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU1,5GRC100",n:"Fil H07VU 1,5 Gris C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU1,5IVC100",n:"Fil H07VU 1,5 Ivoire C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU1,5NRC100",n:"Fil H07VU 1,5 Noir C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU1,5ORC100",n:"Fil H07VU 1,5 Orange C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU1,5MNC100",n:"Fil H07VU 1,5 Marron C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU1,5VIC100",n:"Fil H07VU 1,5 Violet C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU2,5VJC100",n:"Fil H07VU 2,5 Vert/Jaune C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU2,5RGC100",n:"Fil H07VU 2,5 Rouge C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU2,5BEC100",n:"Fil H07VU 2,5 Bleu C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU2,5GRC100",n:"Fil H07VU 2,5 Gris C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU2,5IVC100",n:"Fil H07VU 2,5 Ivoire C100M",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU2,5NRC100",n:"Fil H07VU 2,5 Noir C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU2,5ORC100",n:"Fil H07VU 2,5 Orange C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU2,5MNC100",n:"Fil H07VU 2,5 Marron C100M",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU2,5VIC100",n:"Fil H07VU 2,5 Violet C100M",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VU2,5BAC100",n:"Fil H07VU 2,5 Blanc C100M",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VR6VJC100",n:"Fil H07VR 6 Vert/Jaune C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VR6RGC100",n:"Fil H07VR 6 Rouge C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VR6BEC100",n:"Fil H07VR 6 Bleu C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VR6NRC100",n:"Fil H07VR 6 Noir C100M",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL H07VR6MNC100",n:"Fil H07VR 6 Marron C100M",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V2X1,5C100",n:"Câble U1000 R2V CU 2X1,5 C100M",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V3G1,5C100",n:"Câble U1000 R2V CU 3G1,5 C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V4G1,5C100",n:"Câble U1000 R2V CU 4G1,5 C100M",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V5G1,5C100",n:"Câble U1000 R2V CU 5G1,5 C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V3G2,5C100",n:"Câble U1000 R2V CU 3G2,5 C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V4G2,5C100",n:"Câble U1000 R2V CU 4G2,5 C100M",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V5G2,5C100",n:"Câble U1000 R2V CU 5G2,5 C100M",u:"ML",stock:true},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V7G2,5TGL",n:"Câble U1000 R2V CU 7G2,5 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V3G4TGL",n:"Câble U1000 R2V CU 3G4 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V4G4TGL",n:"Câble U1000 R2V CU 4G4 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V5G4TGL",n:"Câble U1000 R2V CU 5G4 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V3G6TGL",n:"Câble U1000 R2V CU 3G6 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V5G6TGL",n:"Câble U1000 R2V CU 5G6 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V3G10TGL",n:"Câble U1000 R2V CU 3G10 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V4G10TGL",n:"Câble U1000 R2V CU 4G10 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V4X10TGL",n:"Câble U1000 R2V CU 4X10 SVJ TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V5G10TGL",n:"Câble U1000 R2V CU 5G10 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V2X16TGL",n:"Câble U1000 R2V CU 2X16 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V3G16TGL",n:"Câble U1000 R2V CU 3G16 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V4G16TGL",n:"Câble U1000 R2V CU 4G16 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V4X16TGL",n:"Câble U1000 R2V CU 4X16 SVJ TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V5G16TGL",n:"Câble U1000 R2V CU 5G16 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V2X25TGL",n:"Câble U1000 R2V CU 2X25 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V4G25TGL",n:"Câble U1000 R2V CU 4G25 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V4X25TGL",n:"Câble U1000 R2V CU 4X25 SVJ TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V5G25TGL",n:"Câble U1000 R2V CU 5G25 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V2X35TGL",n:"Câble U1000 R2V CU 2X35 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V4G35TGL",n:"Câble U1000 R2V CU 4G35 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V4X35TGL",n:"Câble U1000 R2V CU 4X35 SVJ TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V5G35TGL",n:"Câble U1000 R2V CU 5G35 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V1X50TGL",n:"Câble U1000 R2V CU 1X50 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V2X50TGL",n:"Câble U1000 R2V CU 2X50 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V4G50TGL",n:"Câble U1000 R2V CU 4G50 TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V4X50TGL",n:"Câble U1000 R2V CU 4X50 SVJ TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Général",r:"FIL R2V5G50TGL",n:"Câble U1000 R2V CU 5G50 TGL",u:"ML",stock:false},
];const CAT_ICONS = {"Béton + Descente":"🧱","Conduit + Manchon":"🔧","Équip. Sous-Sol":"🏗️","Plexo":"🔌","Placo":"📦","Colonne Montante":"⚡","Équipement Commun":"🏢","Équipement Logement":"🏠","Courant Faible":"📡","Interphonie":"🔔","Lustrerie":"💡","Quincaillerie":"🔩","Outillage":"🛠️","Divers":"📎","Fils / Câbles":"🔌","Vêtements de travail":"👔","EPI":"🦺"};

const EPJ_LOGO = "data:image/jpeg;base64,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gXajx44X0weCKetrJyHupXUggqVUdfoKAK1nqFzqMJuLaCNYtxCmVyC2O+AOKI9WC3Vxa3UflyQR+aSjblZfarNhYx6daLbRMzIpJBY880w6ZA2oSXrFmeSPy2U/dIoAoJqpv4o5lkht0Dbgj3G1mx/ewP0qzNq3lfZYkRJp7kkIEf5BjvnH9Kkg0z7LEIre6mjiBO1Plbb9MjNLJpkc1zbXMssjSW2dp4G7PrgUASK90hLTrCsagklGJP8AKqFvrn2uMyx/Z4kyQommwxHrgDitaRBJG0ZzhgQcVBYWMWn2i20RZlXOC3Xk5oAoprqk3UZjQy28RkBR9yOPY9qvafdm+sIbkpsMi525ziozpdub+S8bczSx+WyH7pFJBpv2WIQ293PHEv3U+Vtv5jNAEd7q6W18lmip5jLuLyPtVR9fWpLW9aecIZLVsgnEcpZvyxTptNjmniufMdLiNdolXGSPcYwaligljfc11JIP7rKoH6CgCeiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/2Q==";
const EPJ = {dark:"#3d3d3d",blue:"#00A3E0",orange:"#F5841F",green:"#A8C536",gray:"#8C8C8C",grayLight:"#f4f5f7",white:"#fff",red:"#E53935"};
const font = "'Outfit','Segoe UI',sans-serif";
const STATUS_COLORS = {"En attente de validation":{bg:"#FFF3E0",color:"#E65100",icon:"⏳"},"Validée":{bg:"#E8F5E9",color:"#2E7D32",icon:"✅"},"Envoyée aux achats":{bg:"#E3F2FD",color:"#1565C0",icon:"📨"},"Refusée":{bg:"#FFEBEE",color:"#C62828",icon:"❌"},"Réceptionnée":{bg:"#E8F5E9",color:"#1B5E20",icon:"📦"}};

// Équipement salarié = only Outillage category
const EMAIL_ACHATS = "achat@epj-electricite.com";
const EQUIP_CATS = ["Outillage","EPI","Vêtements de travail"];

// ─── PDF COMPONENT (React natif, pas d'iframe) ───
const PdfView = ({order, onClose}) => {
  const byFourn = {};
  const items = order.items || [];
  items.forEach(it => { const c = (it.r||'').split(' ')[0].substring(0,3).toUpperCase(); if(!byFourn[c]) byFourn[c]=[]; byFourn[c].push(it); });
  const totalQty = items.reduce((s,i)=>s+(i.qty||0),0);
  const ch = order.chantierObj || {num:order.chantierNum||order.numAffaire, nom:order.chantierNom||order.chantier, adresse:order.chantierAdresse||'', conducteur:order.chantierConducteur||''};
  const S = {
    page:{fontFamily:'Arial,Helvetica,sans-serif',color:'#3d3d3d',fontSize:11,lineHeight:1.4,background:'#fff',padding:20,borderRadius:12,maxWidth:520,margin:'0 auto'},
    hdr:{display:'flex',justifyContent:'space-between',alignItems:'center',paddingBottom:12,borderBottom:'3px solid #00A3E0'},
    logoArea:{display:'flex',alignItems:'center',gap:12},
    logoTxt:{fontSize:28,fontWeight:900,color:'#3d3d3d',letterSpacing:-1},
    logoSub:{fontSize:9,color:'#8C8C8C',letterSpacing:3,textTransform:'uppercase'},
    cmdNum:{fontSize:20,fontWeight:900,color:'#00A3E0',textAlign:'right'},
    cmdDate:{fontSize:10,color:'#8C8C8C',textAlign:'right'},
    colorBar:{height:4,background:'linear-gradient(90deg,#00A3E0 0%,#A8C536 40%,#F5841F 70%,#F5841F 100%)',margin:'0 0 15px'},
    urgBanner:{background:'#E53935',color:'#fff',padding:'8px 16px',fontWeight:900,fontSize:13,textAlign:'center',borderRadius:4,marginBottom:12},
    infoGrid:{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:15},
    infoBox:{background:'#f8f9fa',borderRadius:6,padding:'10px 12px',borderLeft:'3px solid #00A3E0'},
    infoBoxG:{background:'#f8f9fa',borderRadius:6,padding:'10px 12px',borderLeft:'3px solid #A8C536'},
    label:{fontSize:9,textTransform:'uppercase',color:'#8C8C8C',fontWeight:700,marginBottom:3,letterSpacing:.5},
    val:{fontSize:12,fontWeight:700,color:'#3d3d3d'},
    fournHdr:{background:'#00A3E0',color:'#fff',padding:'6px 12px',fontWeight:700,fontSize:11,borderRadius:'4px 4px 0 0',marginTop:10},
    tbl:{width:'100%',borderCollapse:'collapse',marginBottom:2},
    th:{background:'#f0f1f3',padding:'5px 8px',textAlign:'left',fontSize:9,textTransform:'uppercase',color:'#8C8C8C',fontWeight:700,borderBottom:'1px solid #ddd'},
    td:{padding:'5px 8px',borderBottom:'1px solid #eee',fontSize:10},
    tdRef:{padding:'5px 8px',borderBottom:'1px solid #eee',fontSize:9,fontFamily:'Courier New,monospace',color:'#00A3E0',fontWeight:600,width:'25%'},
    tdQty:{padding:'5px 8px',borderBottom:'1px solid #eee',textAlign:'center',fontWeight:900,color:'#3d3d3d',fontSize:12,width:'8%'},
    tdUnit:{padding:'5px 8px',borderBottom:'1px solid #eee',textAlign:'center',color:'#8C8C8C',width:'10%'},
    totalBar:{background:'#3d3d3d',color:'#fff',padding:'8px 14px',borderRadius:4,display:'flex',justifyContent:'space-between',fontWeight:700,fontSize:12,marginTop:8},
    footer:{marginTop:20,paddingTop:10,borderTop:'2px solid #eee',display:'flex',justifyContent:'space-between',fontSize:8,color:'#8C8C8C'},
    remarques:{background:'#FFF8E1',border:'1px solid #FFE082',borderRadius:4,padding:'8px 12px',marginBottom:12,fontSize:10},
  };
  return (
    <div id="epj-pdf-content" style={S.page}>
      <div style={S.hdr}>
        <div style={S.logoArea}>
          <img src={EPJ_LOGO} alt="EPJ" style={{height:50,objectFit:"contain"}}/>
          
        </div>
        <div><div style={S.cmdNum}>{order.num}</div><div style={S.cmdDate}>{order.date}</div></div>
      </div>
      <div style={S.colorBar}/>
      {order.urgent && <div style={S.urgBanner}>⚠️ COMMANDE URGENTE</div>}
      <div style={S.infoGrid}>
        <div style={S.infoBox}><div style={S.label}>Demandeur</div><div style={S.val}>{order.user}</div><div style={{fontSize:9,color:'#8C8C8C'}}>{order.fonction}</div></div>
        {order.type==='chantier'
          ? <div style={S.infoBoxG}><div style={S.label}>Chantier — N°{ch?.num||''}</div><div style={S.val}>{order.chantier}</div><div style={{fontSize:9,color:'#8C8C8C'}}>{ch?.adresse||''}</div></div>
          : <div style={S.infoBoxG}><div style={S.label}>Destinataire</div><div style={S.val}>{order.salarie}</div></div>
        }
        <div style={S.infoBox}><div style={S.label}>Livraison</div><div style={S.val}>{order.livraison||'—'}</div></div>
        <div style={S.infoBox}><div style={S.label}>Date réception souhaitée</div><div style={S.val}>{order.dateReception||'Non précisée'}</div></div>
      </div>
      {order.remarques && <div style={S.remarques}><strong>📝 Remarques :</strong> {order.remarques}</div>}
      {Object.entries(byFourn).sort(([a],[b])=>a.localeCompare(b)).map(([code,items])=>(
        <div key={code}>
          <div style={S.fournHdr}>▸ {code} — {items.length} réf.</div>
          <table style={S.tbl}><thead><tr><th style={S.th}>Référence</th><th style={S.th}>Désignation</th><th style={{...S.th,textAlign:'center'}}>Qté</th><th style={{...S.th,textAlign:'center'}}>Unité</th></tr></thead>
          <tbody>{items.map(it=>(<tr key={it.r}><td style={S.tdRef}>{it.r}</td><td style={S.td}>{it.n}</td><td style={S.tdQty}>{it.qty}</td><td style={S.tdUnit}>{it.u||'Pièce'}</td></tr>))}</tbody></table>
        </div>
      ))}
      <div style={S.totalBar}><span>Total</span><span>{totalQty} articles — {items.length} références</span></div>
      <div style={S.footer}><div>EPJ — Électricité Générale<br/>Commande générée le {order.date}</div><div style={{textAlign:'right'}}>Document interne — {order.num}<br/>Statut : {order.statut}</div></div>
    </div>
  );
};

// ═══ MODULE COMMANDES ═══
export function CommandesInner({ onExitModule }) {
  const { user } = useAuth();
  // Le Socle ne monte ce composant que si l'utilisateur est connecté.
  // ⚠️ view démarre sur 'home' (page d'accueil du module Commandes).
  const [view, setView] = useState('home');
  const [cart, setCart] = useState({});
  const [selectedCat, setSelectedCat] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [orderType, setOrderType] = useState("");
  const [chantier, setChantier] = useState("");
  const [newChantier, setNewChantier] = useState("");
  const [showNewChantier, setShowNewChantier] = useState(false);
  const [targetSalarie, setTargetSalarie] = useState("");
  const [livraison, setLivraison] = useState("Chantier");
  const [urgent, setUrgent] = useState(false);
  const [dateReception, setDateReception] = useState("");
  const [remarques, setRemarques] = useState("");
  const [extraEmail, setExtraEmail] = useState("");
  const [diversName, setDiversName] = useState("");
  const [diversRef, setDiversRef] = useState("");
  const [diversQty, setDiversQty] = useState(1);
  const [showDivers, setShowDivers] = useState(false);
  const [history, setHistory] = useState([]);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [cmdCounter, setCmdCounter] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [historyFilter, setHistoryFilter] = useState({chantier:"",statut:""});
  const [refuseMotif, setRefuseMotif] = useState("");
  const [showRefuseModal, setShowRefuseModal] = useState(null);
  const [editingQty, setEditingQty] = useState(null);
  const [pdfOrder, setPdfOrder] = useState(null);
  const [fbLoading, setFbLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [lastSentOrder, setLastSentOrder] = useState(null);

  // ─── DONNÉES DYNAMIQUES (chargées depuis Firestore ou fallback) ───
  const [dynUsers, setDynUsers] = useState(USERS);
  const [dynChantiers, setDynChantiers] = useState(CHANTIERS);
  const [dynCatalog, setDynCatalog] = useState(CATALOG);
  const [dynCatIcons, setDynCatIcons] = useState(CAT_ICONS);
  const [dynEquipCats, setDynEquipCats] = useState(EQUIP_CATS);
  const [dynCatOrder, setDynCatOrder] = useState([]);
  const [receptionOrder, setReceptionOrder] = useState(null);
  const [dynEmailAchats, setDynEmailAchats] = useState(EMAIL_ACHATS);
  const [configLoaded, setConfigLoaded] = useState(false);

  // ─── ADMIN STATES ───
  const [adminSection, setAdminSection] = useState(null); // 'users','chantiers','catalog','categories'
  const [adminEdit, setAdminEdit] = useState(null); // item being edited
  const [adminForm, setAdminForm] = useState({});
  const [adminSaving, setAdminSaving] = useState(false);
  const [bulkSelected, setBulkSelected] = useState([]); // refs selected for bulk edit
  const [bulkMode, setBulkMode] = useState(false);

  // ─── FIREBASE : écoute temps réel des commandes ───
  useEffect(() => {
    const q = query(collection(db, "commandes"));
    const unsub = onSnapshot(q, (snap) => {
      const allOrders = snap.docs.map(d => ({ ...d.data(), _id: d.id }));
      console.log("Firebase: " + allOrders.length + " commande(s) chargée(s)");
      allOrders.sort((a,b) => (b.createdAt||'').localeCompare(a.createdAt||''));
      setHistory(allOrders);
      setPendingOrders(allOrders.filter(o => o.statut === "En attente de validation"));
      setFbLoading(false);
    }, (err) => {
      console.error("Erreur Firestore commandes:", err);
      setFbLoading(false);
    });
    return () => unsub();
  }, []);

  // ─── FIREBASE : écoute temps réel des utilisateurs ───
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "utilisateurs"), (snap) => {
      if (snap.size > 0) {
        setDynUsers(snap.docs.map(d => d.data()));
        console.log("Firebase: " + snap.size + " utilisateur(s)");
      }
    });
    return () => unsub();
  }, []);

  // ─── FIREBASE : écoute temps réel des chantiers ───
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "chantiers"), (snap) => {
      if (snap.size > 0) {
        setDynChantiers(snap.docs.map(d => d.data()));
        console.log("Firebase: " + snap.size + " chantier(s)");
      }
    });
    return () => unsub();
  }, []);

  // ─── FIREBASE : écoute temps réel du catalogue ───
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "catalogue"), (snap) => {
      if (snap.size > 0) {
        setDynCatalog(snap.docs.map(d => d.data()));
        console.log("Firebase: " + snap.size + " article(s) catalogue");
      }
    });
    return () => unsub();
  }, []);

  // ─── FIREBASE : config (email, catégories équipement, icônes) ───
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "config", "settings"), (snap) => {
      if (snap.exists()) {
        const d = snap.data();
        if(d.emailAchats) setDynEmailAchats(d.emailAchats);
        if(d.equipCategories) setDynEquipCats(d.equipCategories);
        if(d.catIcons) setDynCatIcons(d.catIcons);
        if(d.catOrder) setDynCatOrder(d.catOrder);
      }
      setConfigLoaded(true); // toujours marquer comme chargé, même si pas de catOrder
    });
    return () => unsub();
  }, []);

  // ─── FIREBASE : compteur de commandes auto-incrémenté ───
  useEffect(() => {
    const loadCounter = async () => {
      try {
        const ref = doc(db, "config", "compteur");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setCmdCounter(snap.data().value || 1);
        } else {
          await setDoc(ref, { value: 1 });
        }
      } catch(e) { console.error("Erreur compteur:", e); }
    };
    loadCounter();
  }, []);

  const cartHasItems = Object.values(cart).some(q=>q>0);
  const isCartLocked = cartHasItems && orderType !== "";

  // Selected chantier object (for n° affaire)
  const selectedChantierObj = useMemo(() => dynChantiers.find(c=>c.nom===chantier), [chantier, dynChantiers]);

  const allCategories = useMemo(() => [...new Set(dynCatalog.map(p=>p.c))], [dynCatalog]);
  const availableCategories = useMemo(() => {
    if (orderType==="equipement") {
      // Only show equip cats that actually exist in catalog
      return dynEquipCats.filter(c => allCategories.includes(c));
    }
    const cats = allCategories.filter(c => !dynEquipCats.includes(c));
    if (dynCatOrder.length > 0) {
      return [...cats].sort((a,b) => {
        const ia = dynCatOrder.indexOf(a); const ib = dynCatOrder.indexOf(b);
        if(ia===-1 && ib===-1) return a.localeCompare(b);
        if(ia===-1) return 1; if(ib===-1) return -1;
        return ia - ib;
      });
    }
    return cats;
  }, [orderType, allCategories, dynEquipCats, dynCatOrder]);

  const filteredProducts = useMemo(() => {
    let items = dynCatalog;
    if (orderType==="equipement") items = items.filter(p=>dynEquipCats.includes(p.c));
    if (selectedCat) items = items.filter(p=>p.c===selectedCat);
    if (search.trim()) { const q=search.toLowerCase(); items=items.filter(p=>p.n.toLowerCase().includes(q)||p.r.toLowerCase().includes(q)||p.s.toLowerCase().includes(q)); }
    return items;
  }, [selectedCat, search, orderType, dynCatalog, dynEquipCats]);

  const grouped = useMemo(() => {
    const g = {};
    filteredProducts.forEach(p => { const k = selectedCat ? p.s : p.c; if(!g[k]) g[k]=[]; g[k].push(p); });
    return g;
  }, [filteredProducts, selectedCat]);

  const cartItems = useMemo(() => Object.entries(cart).filter(([,q])=>q>0).map(([r,q])=>{const p=dynCatalog.find(x=>x.r===r);return p?{...p,qty:q}:null}).filter(Boolean), [cart, dynCatalog]);
  const cartCount = cartItems.reduce((s,i)=>s+i.qty, 0);

  const pendingCount = useMemo(() => {
    if(!user) return 0;
    if(user.fonction==="Admin") return pendingOrders.length;
    const fullName = `${user.prenom} ${user.nom}`;
    return pendingOrders.filter(o => {
      const ch = dynChantiers.find(c=>c.nom===o.chantier);
      return ch && ch.conducteur===fullName;
    }).length;
  }, [user, pendingOrders]);

  const showT = (m) => { setToast(m); setTimeout(()=>setToast(null), 1800); };
  const addToCart = (r) => { setCart(p=>({...p,[r]:(p[r]||0)+1})); showT("✓ Ajouté"); };
  const updateQty = (r, q) => { const v=Math.max(0,parseInt(q)||0); if(v<=0) setCart(p=>{const n={...p};delete n[r];return n;}); else setCart(p=>({...p,[r]:v})); };

  // doLogin / logout : gérés en amont par le Socle (AuthContext).
  const numCmd = () => `CMD-${new Date().getFullYear()}-${String(cmdCounter).padStart(4,'0')}`;
  const clearOrder = () => {setCart({});setOrderType("");setChantier("");setNewChantier("");setShowNewChantier(false);setTargetSalarie("");setUrgent(false);setDateReception("");setRemarques("");setExtraEmail("");setSelectedCat(null);setSearch("");setSending(false)};

  // ─── Générer PDF (ouvre dans un nouvel onglet pour téléchargement/impression) ───
  const EPJ_LOGO_B64 = "data:image/png;base64,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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/Z";

  const generateAndOpenPdf = (order) => {
    const ch = order.chantierObj || {num:order.chantierNum||order.numAffaire, nom:order.chantierNom||order.chantier, adresse:order.chantierAdresse||'', conducteur:order.chantierConducteur||''};
    const items = order.items || [];
    const byFourn = {};
    items.forEach(it => { const c = (it.r||'').split(' ')[0].substring(0,3).toUpperCase(); if(!byFourn[c]) byFourn[c]=[]; byFourn[c].push(it); });
    const totalQty = items.reduce((s,i)=>s+(i.qty||0),0);
    let rows = '';
    Object.entries(byFourn).sort(([a],[b])=>a.localeCompare(b)).forEach(([code,fitems])=>{
      rows += `<tr><td colspan="4" style="background:#00A3E0;color:#fff;padding:6px 12px;font-weight:700;font-size:11px">\u25b8 ${code} \u2014 ${fitems.length} r\u00e9f.</td></tr>`;
      fitems.forEach(it => {
        rows += `<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;font-family:monospace;color:#00A3E0;font-weight:600;font-size:9px">${it.r||''}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:10px">${it.n||''}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center;font-weight:900;font-size:12px">${it.qty||0}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center;color:#8C8C8C;font-size:9px">${it.u||'Pi\u00e8ce'}</td></tr>`;
      });
    });
    const sigBlock = order.signatureData ? `<div style="margin-top:16px;border:2px solid #3d3d3d;border-radius:8px;padding:12px;page-break-inside:avoid"><div style="font-size:10px;font-weight:700;margin-bottom:4px">\u270d\ufe0f Signature : ${order.salarie||order.user}</div><div style="font-size:9px;color:#388E3C;margin-bottom:6px">\u2705 R\u00e9ceptionn\u00e9e le ${order.dateReceptionEffective||order.date}</div><img src="${order.signatureData}" style="width:100%;max-height:70px;object-fit:contain;background:#fff"/></div>` : '';
    const logoB64 = EPJ_LOGO_B64;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${order.num} \u2014 EPJ</title>
    <style>
      * { box-sizing:border-box; margin:0; padding:0; }
      @media print { .no-print { display:none !important } @page { size:A4; margin:12mm } }
      body { font-family:Arial,sans-serif;color:#3d3d3d;max-width:210mm;margin:0 auto;padding:12mm;font-size:10px;background:#fff }
      table { width:100%;border-collapse:collapse }
      .dl-btn { display:block;width:100%;box-sizing:border-box;margin-top:20px;padding:14px;background:linear-gradient(135deg,#00A3E0,#A8C536);color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:700;cursor:pointer;text-align:center }
    </style>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script>
    </head><body id="pdf-body">
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:10px;border-bottom:3px solid #00A3E0;margin-bottom:10px">
      <img src="${logoB64}" style="height:50px;object-fit:contain;background:#3d3d3d;padding:4px 8px;border-radius:6px"/>
      <div style="text-align:right"><div style="font-size:18px;font-weight:900;color:#00A3E0">${order.num}</div><div style="font-size:9px;color:#8C8C8C">${order.date}</div><div style="font-size:9px;color:#8C8C8C">Statut : ${order.statut}</div></div>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,#00A3E0,#A8C536,#F5841F);margin-bottom:10px"></div>
    ${order.urgent?'<div style="background:#E53935;color:#fff;padding:5px 10px;font-weight:900;text-align:center;border-radius:4px;margin-bottom:8px;font-size:10px">\u26a0\ufe0f COMMANDE URGENTE</div>':''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
      <div style="background:#f8f9fa;border-radius:5px;padding:7px 9px;border-left:3px solid #00A3E0"><div style="font-size:7px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Demandeur</div><div style="font-size:11px;font-weight:700">${order.user}</div><div style="font-size:8px;color:#8C8C8C">${order.fonction||''}</div></div>
      ${order.type==='chantier'
        ?`<div style="background:#f8f9fa;border-radius:5px;padding:7px 9px;border-left:3px solid #A8C536"><div style="font-size:7px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Chantier \u2014 N\u00b0${ch?.num||''}</div><div style="font-size:11px;font-weight:700">${order.chantier||''}</div><div style="font-size:8px;color:#8C8C8C">${ch?.adresse||''}</div></div>`
        :`<div style="background:#f8f9fa;border-radius:5px;padding:7px 9px;border-left:3px solid #A8C536"><div style="font-size:7px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Destinataire</div><div style="font-size:11px;font-weight:700">${order.salarie||''}</div></div>`}
      <div style="background:#f8f9fa;border-radius:5px;padding:7px 9px;border-left:3px solid #00A3E0"><div style="font-size:7px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Livraison</div><div style="font-size:11px;font-weight:700">${order.livraison||'\u2014'}</div></div>
      <div style="background:#f8f9fa;border-radius:5px;padding:7px 9px;border-left:3px solid #00A3E0"><div style="font-size:7px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Date r\u00e9ception</div><div style="font-size:11px;font-weight:700">${order.dateReception||'Non pr\u00e9cis\u00e9e'}</div></div>
    </div>
    ${order.remarques?`<div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:4px;padding:6px 9px;margin-bottom:8px;font-size:9px"><strong>Remarques :</strong> ${order.remarques}</div>`:''}
    <table><thead><tr>
      <th style="background:#f0f1f3;padding:4px 7px;text-align:left;font-size:7px;text-transform:uppercase;color:#8C8C8C;border-bottom:1px solid #ddd">R\u00e9f\u00e9rence</th>
      <th style="background:#f0f1f3;padding:4px 7px;text-align:left;font-size:7px;text-transform:uppercase;color:#8C8C8C;border-bottom:1px solid #ddd">D\u00e9signation</th>
      <th style="background:#f0f1f3;padding:4px 7px;text-align:center;font-size:7px;text-transform:uppercase;color:#8C8C8C;border-bottom:1px solid #ddd">Qt\u00e9</th>
      <th style="background:#f0f1f3;padding:4px 7px;text-align:center;font-size:7px;text-transform:uppercase;color:#8C8C8C;border-bottom:1px solid #ddd">Unit\u00e9</th>
    </tr></thead><tbody>${rows}</tbody></table>
    <div style="background:#3d3d3d;color:#fff;padding:7px 10px;border-radius:4px;display:flex;justify-content:space-between;font-weight:700;font-size:10px;margin-top:5px"><span>Total</span><span>${totalQty} articles \u2014 ${items.length} r\u00e9f\u00e9rences</span></div>
    ${sigBlock}
    <div style="margin-top:12px;padding-top:6px;border-top:1px solid #eee;display:flex;justify-content:space-between;font-size:7px;color:#8C8C8C"><div>EPJ \u2014 \u00c9lectricit\u00e9 G\u00e9n\u00e9rale \u2022 Saint-\u00c9gr\u00e8ve, Is\u00e8re</div><div style="text-align:right">Document interne \u2014 ${order.num}</div></div>
    <div class="no-print" style="margin-top:16px">
      <button class="dl-btn" id="dlbtn" onclick="doDownload()">\ud83d\udce5 T\u00e9l\u00e9charger le PDF (A4)</button>
      <div id="dlmsg" style="text-align:center;margin-top:8px;font-size:12px;color:#2E7D32;font-weight:700;display:none">\u2705 PDF t\u00e9l\u00e9charg\u00e9 !</div>
    </div>
    <script>
    async function doDownload(){
      const btn=document.getElementById('dlbtn');
      const msg=document.getElementById('dlmsg');
      btn.textContent='\u23f3 G\u00e9n\u00e9ration...';btn.disabled=true;
      try{
        const el=document.getElementById('pdf-body');
        const canvas=await html2canvas(el,{scale:2,useCORS:true,backgroundColor:'#ffffff',ignoreElements:e=>e.classList.contains('no-print')});
        const {jsPDF}=window.jspdf;
        const pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
        const pW=pdf.internal.pageSize.getWidth();
        const pH=pdf.internal.pageSize.getHeight();
        const margin=10;
        const imgW=pW-margin*2;
        const imgH=imgW*(canvas.height/canvas.width);
        let y=0;
        while(y<imgH){
          const sliceH=Math.min(pH-margin*2,imgH-y);
          const sc=document.createElement('canvas');
          const scale=canvas.width/imgW;
          sc.width=canvas.width;
          sc.height=Math.round(sliceH*scale);
          const ctx=sc.getContext('2d');
          ctx.drawImage(canvas,0,Math.round(y*scale),canvas.width,sc.height,0,0,canvas.width,sc.height);
          if(y>0) pdf.addPage();
          pdf.addImage(sc.toDataURL('image/png'),'PNG',margin,margin,imgW,sliceH);
          y+=sliceH;
        }
        pdf.save('${order.num}_EPJ_${order.date.replace(/\//g,"-")}.pdf');
        btn.textContent='\u2705 T\u00e9l\u00e9charg\u00e9 !';
        msg.style.display='block';
      }catch(e){
        btn.textContent='\u274c Erreur - r\u00e9essayez';
        btn.disabled=false;
        console.error(e);
      }
    }
    <\/script>
    </body></html>`;
    const w = window.open('', '_blank');
    if(w) { w.document.write(html); w.document.close(); }
    else { showT("\u26a0\ufe0f Autorisez les popups pour g\u00e9n\u00e9rer le PDF"); }
  };

  const openReceptionSheet = (order) => {
    if(order.signatureData) { showT("✅ Déjà réceptionnée"); return; }
    setReceptionOrder(order);
    setView('reception');
  };

  const sendOrder = async () => {
    if(sending) return;
    setSending(true);
    const cmd = numCmd();
    const chObj = selectedChantierObj;
    const needsValidation = orderType==='chantier' && !user.directAchat;
    const statut = needsValidation ? "En attente de validation" : "Envoyée aux achats";
    const orderData = {
      num:cmd, date:new Date().toLocaleDateString('fr-FR'), type:orderType,
      items: cartItems.map(it=>({r:it.r, n:it.n, c:it.c, s:it.s, u:it.u||'Pièce', qty:parseInt(it.qty)||1, img:it.img||''})),
      user:`${user.prenom} ${user.nom}`, userId:user.id, fonction:user.fonction,
      chantier:orderType==='chantier'?(showNewChantier?newChantier:chantier):'',
      chantierNom:chObj?.nom||'', chantierNum:chObj?.num||'', chantierAdresse:chObj?.adresse||'', chantierConducteur:chObj?.conducteur||'',
      numAffaire:chObj?.num||'',
      salarie:targetSalarie||`${user.prenom} ${user.nom}`,
      urgent, livraison, remarques, dateReception, statut, extraEmail, motifRefus:"",
      createdAt: new Date().toISOString()
    };

    try {
      await addDoc(collection(db, "commandes"), orderData);
      const newCount = cmdCounter + 1;
      setCmdCounter(newCount);
      await setDoc(doc(db, "config", "compteur"), { value: newCount });

      const localOrder = {...orderData, chantierObj:chObj};
      setLastSentOrder(localOrder);
      if(!needsValidation) { setPdfOrder(localOrder); }
      setSending(false);
      setView("done");
      showT(needsValidation ? "📤 Commande soumise !" : "✅ Commande enregistrée !");
    } catch(err) {
      console.error("Erreur envoi commande:", err);
      setSending(false);
      showT("❌ Erreur : " + (err.message||"vérifiez votre connexion"));
    }
  };

  const validateOrder = async (orderNum) => {
    const order = pendingOrders.find(o=>o.num===orderNum);
    if(!order || !order._id) return;
    try {
      await updateDoc(doc(db, "commandes", order._id), { statut: "Validée" });
      const validatedOrder = {...order, statut:"Validée"};
      setPdfOrder(validatedOrder);
      setLastSentOrder(validatedOrder);
      setView('validateConfirm');
      showT("✅ Commande validée !");
    } catch(err) {
      console.error("Erreur validation:", err);
      showT("❌ Erreur — réessayez");
    }
  };

  const refuseOrder = async (orderNum, motif) => {
    const order = history.find(o=>o.num===orderNum);
    if(!order || !order._id) return;
    try {
      await updateDoc(doc(db, "commandes", order._id), { statut: "Refusée", motifRefus: motif });
      setShowRefuseModal(null); setRefuseMotif("");
      showT("❌ Commande refusée");
    } catch(err) {
      console.error("Erreur refus:", err);
      showT("❌ Erreur — réessayez");
    }
  };

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    input:focus,select:focus,textarea:focus{border-color:${EPJ.blue}!important;outline:none}
    ::placeholder{color:#aaa}
    @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes badgePulse{0%,100%{box-shadow:0 0 0 0 rgba(229,57,53,.4)}50%{box-shadow:0 0 0 8px rgba(229,57,53,0)}}
    .epj-btn{border:none;border-radius:12px;padding:14px;font-size:15px;font-weight:700;cursor:pointer;font-family:${font};transition:all .2s}
    .epj-btn:active{transform:scale(0.97)}.epj-btn:disabled{opacity:.5;cursor:not-allowed}
    .epj-input{width:100%;padding:12px 14px;border-radius:10px;border:2px solid #e0e0e0;font-size:14px;font-family:${font};background:#fff}
    .epj-card{background:#fff;border-radius:16px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.04)}
    .epj-row{display:flex;align-items:center;gap:10px;background:#fff;border-radius:12px;padding:10px 14px;margin-bottom:5px;box-shadow:0 1px 2px rgba(0,0,0,.03)}
    .badge-pulse{animation:badgePulse 2s infinite}
    .status-pill{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700}
    .qty-input{width:56px;text-align:center;font-size:16px;font-weight:700;border:2px solid #e0e0e0;border-radius:8px;padding:6px 4px;font-family:${font};background:#fff}
    .qty-input:focus{border-color:${EPJ.blue};outline:none}
  `;

  const Header = ({title,back,backView,showCart=true}) => (
    <div style={{background:EPJ.dark,color:'#fff',padding:'14px 16px',position:'sticky',top:0,zIndex:100,boxShadow:'0 2px 8px rgba(0,0,0,.15)'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          {back&&<button onClick={()=>{if(backView==='cats'){setSelectedCat(null);setSearch('')}else if(backView==='admin'){setAdminSection(null);setAdminEdit(null);setAdminForm({});setSelectedCat(null);setSearch('');setView('admin')}else setView(backView||'home')}} style={{background:'rgba(255,255,255,.12)',border:'none',color:'#fff',borderRadius:8,padding:'6px 12px',fontSize:13,cursor:'pointer',fontWeight:600,fontFamily:font}}>←</button>}
          <div style={{fontSize:16,fontWeight:700}}>{title}</div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {showCart&&cartCount>0&&view!=='cart'&&<button onClick={()=>setView('cart')} style={{background:EPJ.orange,color:'#fff',border:'none',borderRadius:20,padding:'6px 14px',fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:font}}>🛒 {cartCount}</button>}
        </div>
      </div>
    </div>
  );

  const CatIcon = ({cat, size=36}) => {
    const icon = dynCatIcons[cat] || '📦';
    const isImg = icon.startsWith('http') || icon.startsWith('data:');
    if(isImg) return <img src={icon} alt="" style={{width:size,height:size,borderRadius:8,objectFit:'cover',flexShrink:0}}/>;
    return <div style={{width:size,height:size,borderRadius:8,background:`${EPJ.blue}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.round(size*0.5),flexShrink:0,border:`1px solid ${EPJ.blue}22`}}>{icon}</div>;
  };

  const Thumb = ({cat, imageUrl, size=36}) => {
    if (imageUrl) {
      return <img src={imageUrl} alt="" style={{width:size,height:size,borderRadius:8,objectFit:'cover',flexShrink:0,background:EPJ.grayLight}} onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex'}}/>;
    }
    return <CatIcon cat={cat} size={size}/>;
  };

  // ─── QTY CONTROL ───
  const [qtyPopup, setQtyPopup] = useState(null); // {r, value}
  const [qtyPopupVal, setQtyPopupVal] = useState('');
  const QtyControl = ({r, value, compact, showDelete}) => (
    <div style={{display:'flex',alignItems:'center',gap:4}}>
      {showDelete && <button onClick={()=>{setCart(p=>{const n={...p};delete n[r];return n})}} style={{width:28,height:28,borderRadius:8,border:'none',background:'#fee',color:EPJ.red,fontSize:12,cursor:'pointer',fontWeight:700}}>🗑</button>}
      <button onClick={()=>updateQty(r,value-1)} style={{width:compact?30:34,height:compact?30:34,borderRadius:8,border:'none',background:value<=1&&!showDelete?'#fee':'#eee',color:value<=1&&!showDelete?EPJ.red:EPJ.dark,fontSize:16,cursor:'pointer',fontWeight:700}}>−</button>
      <div onClick={()=>{setQtyPopup({r,value});setQtyPopupVal(String(value))}} style={{width:compact?48:60,height:compact?30:34,borderRadius:8,border:`2px solid ${EPJ.blue}`,background:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,fontWeight:700,fontFamily:font,cursor:'pointer',color:EPJ.blue}}>{value}</div>
      <button onClick={()=>updateQty(r,value+1)} style={{width:compact?30:34,height:compact?30:34,borderRadius:8,border:'none',background:'#eee',fontSize:16,cursor:'pointer',fontWeight:700}}>+</button>
    </div>
  );

  const QtyPopupOverlay = () => qtyPopup ? (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:500,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setQtyPopup(null)}>
      <div style={{background:'#fff',borderRadius:20,padding:24,width:'100%',maxWidth:320,textAlign:'center'}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:16,fontWeight:700,color:EPJ.dark,marginBottom:16}}>Saisir la quantité</div>
        <input type="text" inputMode="numeric" pattern="[0-9]*" autoFocus
          value={qtyPopupVal} onChange={e=>setQtyPopupVal(e.target.value.replace(/[^0-9]/g,''))}
          onKeyDown={e=>{if(e.key==='Enter'){const n=parseInt(qtyPopupVal)||1;updateQty(qtyPopup.r,n);setQtyPopup(null)}}}
          style={{width:'100%',fontSize:32,fontWeight:800,textAlign:'center',border:`3px solid ${EPJ.blue}`,borderRadius:12,padding:'12px',fontFamily:font,color:EPJ.dark,marginBottom:16}}/>
        <div style={{display:'flex',gap:10}}>
          <button className="epj-btn" onClick={()=>setQtyPopup(null)} style={{flex:1,background:'#eee',color:EPJ.dark,padding:'12px'}}>Annuler</button>
          <button className="epj-btn" onClick={()=>{const n=parseInt(qtyPopupVal)||1;updateQty(qtyPopup.r,n);setQtyPopup(null)}} style={{flex:1,background:EPJ.blue,color:'#fff',padding:'12px'}}>✓ OK</button>
        </div>
      </div>
    </div>
  ) : null;

  // ═══ RÉCEPTION SIGNÉE (inline React, pas de popup) ═══
  if(view==='reception' && receptionOrder) {
    const o = receptionOrder;
    const alreadySigned = !!o.signatureData;
    return (
      <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto'}}>
        <style>{css}</style>
        <Header title={`✍️ Réception ${o.num}`} back={!alreadySigned} backView="detail" showCart={false}/>
        <div style={{padding:'12px 16px'}}>
          {/* Infos commande */}
          <div style={{background:'#fff',borderRadius:14,padding:14,marginBottom:12,border:`2px solid ${alreadySigned?EPJ.green:EPJ.blue}`}}>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              <div><div style={{fontSize:9,fontWeight:700,color:EPJ.gray,textTransform:'uppercase'}}>Bénéficiaire</div><div style={{fontSize:13,fontWeight:700,color:EPJ.dark}}>{o.salarie||o.user}</div></div>
              <div><div style={{fontSize:9,fontWeight:700,color:EPJ.gray,textTransform:'uppercase'}}>Date de remise</div><div style={{fontSize:13,fontWeight:700,color:EPJ.dark}}>{new Date().toLocaleDateString('fr-FR')}</div></div>
            </div>
            <div style={{fontSize:10,color:EPJ.gray}}>Commande {o.num} • {o.date}</div>
          </div>
          {/* Articles */}
          <div style={{background:'#fff',borderRadius:14,padding:14,marginBottom:12}}>
            <div style={{fontSize:11,fontWeight:700,color:EPJ.gray,textTransform:'uppercase',marginBottom:8}}>Articles ({o.items?.length||0} réf.)</div>
            {(o.items||[]).map((it,i)=>(
              <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:i<(o.items.length-1)?`1px solid ${EPJ.grayLight}`:'none'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:12,fontWeight:600,color:EPJ.dark,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{it.n}</div>
                  <div style={{fontSize:10,color:EPJ.gray,fontFamily:'monospace'}}>{it.r}</div>
                </div>
                <div style={{marginLeft:8,background:EPJ.blue,color:'#fff',borderRadius:8,padding:'2px 10px',fontWeight:700,fontSize:13}}>×{it.qty}</div>
              </div>
            ))}
          </div>
          {alreadySigned ? (
            /* Vue si déjà réceptionnée */
            <div style={{background:'#E8F5E9',borderRadius:14,padding:20,textAlign:'center',border:'2px solid #4CAF50'}}>
              <div style={{fontSize:32,marginBottom:8}}>✅</div>
              <div style={{fontSize:16,fontWeight:700,color:'#2E7D32',marginBottom:4}}>Réception confirmée</div>
              <div style={{fontSize:12,color:'#388E3C',marginBottom:16}}>Signée le {o.dateReception||o.date}</div>
              <img src={o.signatureData} alt="Signature" style={{width:'100%',maxHeight:100,objectFit:'contain',border:'1px solid #ccc',borderRadius:8,background:'#fff',padding:4}}/>
              <button className="epj-btn" onClick={()=>setView('history')} style={{width:'100%',marginTop:16,background:EPJ.dark,color:'#fff',padding:'12px'}}>← Retour historique</button>
            </div>
          ) : (
            /* Zone signature */
            <div style={{background:'#fff',borderRadius:14,padding:14,marginBottom:12,border:`2px solid ${EPJ.dark}`}}>
              <div style={{fontSize:13,fontWeight:700,color:EPJ.dark,marginBottom:4}}>✍️ Signature de {o.salarie||o.user}</div>
              <div style={{fontSize:11,color:EPJ.gray,marginBottom:10}}>Signez avec le doigt ci-dessous, puis appuyez sur Enregistrer</div>
              <canvas
                id="receptionCanvas"
                width={460} height={160}
                style={{width:'100%',border:`1px solid ${EPJ.gray}`,borderRadius:10,touchAction:'none',cursor:'crosshair',background:'#fafafa',display:'block'}}
                ref={el => {
                  if(!el) return;
                  if(el._epjInited) return;
                  el._epjInited = true;
                  const ctx = el.getContext('2d');
                  ctx.fillStyle = '#fafafa'; ctx.fillRect(0,0,el.width,el.height);
                  let drawing = false, lx = 0, ly = 0;
                  const getPos = (e) => { const r=el.getBoundingClientRect(); const t=e.touches?e.touches[0]:e; return [(t.clientX-r.left)*(el.width/r.width),(t.clientY-r.top)*(el.height/r.height)]; };
                  const draw = (x,y) => { ctx.beginPath();ctx.moveTo(lx,ly);ctx.lineTo(x,y);ctx.strokeStyle='#1a1a1a';ctx.lineWidth=2.5;ctx.lineCap='round';ctx.stroke();lx=x;ly=y; };
                  el.addEventListener('mousedown',e=>{drawing=true;[lx,ly]=getPos(e)});
                  el.addEventListener('mousemove',e=>{if(!drawing)return;const[x,y]=getPos(e);draw(x,y)});
                  el.addEventListener('mouseup',()=>drawing=false);
                  el.addEventListener('mouseleave',()=>drawing=false);
                  el.addEventListener('touchstart',e=>{e.preventDefault();drawing=true;[lx,ly]=getPos(e)},{passive:false});
                  el.addEventListener('touchmove',e=>{e.preventDefault();if(!drawing)return;const[x,y]=getPos(e);draw(x,y)},{passive:false});
                  el.addEventListener('touchend',()=>drawing=false);
                }}
              />
              <button onClick={()=>{const c=document.getElementById('receptionCanvas');const ctx=c.getContext('2d');ctx.fillStyle='#fafafa';ctx.fillRect(0,0,c.width,c.height);}} style={{width:'100%',marginTop:8,padding:'8px',border:`1px solid ${EPJ.gray}`,borderRadius:8,background:'#fff',cursor:'pointer',fontSize:12,color:EPJ.gray}}>🗑 Effacer et recommencer</button>
            </div>
          )}
          {!alreadySigned && (
            <button className="epj-btn" style={{width:'100%',background:`linear-gradient(135deg,${EPJ.green},#2E7D32)`,color:'#fff',padding:'16px',fontSize:16,fontWeight:700,borderRadius:14}} onClick={async()=>{
              const c = document.getElementById('receptionCanvas');
              if(!c){showT('❌ Erreur canvas');return;}
              const sigData = c.toDataURL('image/png');
              // Check not blank
              const blank = document.createElement('canvas'); blank.width=c.width; blank.height=c.height;
              const bctx=blank.getContext('2d'); bctx.fillStyle='#fafafa'; bctx.fillRect(0,0,blank.width,blank.height);
              if(sigData === blank.toDataURL('image/png')){showT('⚠️ Veuillez signer avant de valider');return;}
              try{
                const dateAuj = new Date().toLocaleDateString('fr-FR');
                await updateDoc(doc(db,'commandes',o._id),{signatureData:sigData,dateReceptionEffective:dateAuj,statut:'Réceptionnée'});
                setReceptionOrder({...o,signatureData:sigData,dateReceptionEffective:dateAuj,statut:'Réceptionnée'});
                showT('✅ Réception enregistrée !');
              }catch(e){showT('❌ Erreur: '+e.message);}
            }}>✅ Enregistrer la réception</button>
          )}
        </div>
        {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:'#fff',padding:'8px 20px',borderRadius:20,fontSize:13,fontWeight:600,zIndex:400}}>{toast}</div>}
      </div>
    );
  }

  // ═══ LOGIN supprimé : géré par le Socle ═══

  // ═══ HOME (page d'accueil du module Commandes) ═══
  if(view==="home") return (
    <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto'}}>
      <style>{css}</style>
      <div style={{padding:'18px 16px 8px',borderBottom:`1px solid #EAEAEA`,marginBottom:8,display:'flex',alignItems:'center',gap:12}}>
        <button onClick={onExitModule} style={{background:'#F4F5F7',border:'none',color:'#3D3D3D',borderRadius:8,padding:'8px 12px',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:font}}>← Accueil</button>
        <div style={{flex:1}}>
          <div style={{fontSize:11,color:'#6B6B6B',textTransform:'uppercase',letterSpacing:1,fontWeight:600}}>Module</div>
          <div style={{fontSize:18,fontWeight:700,color:'#1A1A1A',letterSpacing:'-0.01em'}}>Commandes</div>
        </div>
      </div>
      <div style={{padding:16}}>
        {isCartLocked&&<div style={{background:'#FFF3E0',border:`2px solid ${EPJ.orange}`,borderRadius:14,padding:14,marginBottom:12,fontSize:13,color:'#E65100',lineHeight:1.5}}>
          <strong>⚠️ Panier en cours</strong> — {cartCount} article(s) ({orderType==='chantier'?'Chantier':'Équipement'}).
          <div style={{marginTop:8,display:'flex',gap:8}}>
            <button className="epj-btn" onClick={()=>setView('cart')} style={{background:EPJ.orange,color:'#fff',padding:'8px 14px',fontSize:12,flex:1}}>🛒 Panier</button>
            <button className="epj-btn" onClick={()=>{setCart({});setOrderType('');showT('Panier vidé')}} style={{background:'#eee',color:EPJ.dark,padding:'8px 14px',fontSize:12}}>🗑 Vider</button>
          </div>
        </div>}
        <div style={{fontSize:14,fontWeight:700,color:EPJ.dark,marginBottom:12}}>Que souhaitez-vous faire ?</div>
        <div onClick={()=>{if(isCartLocked&&orderType!=='chantier')return;setOrderType('chantier');setView('catalog');setSelectedCat(null);setSearch('')}} className="epj-card" style={{marginBottom:10,cursor:isCartLocked&&orderType!=='chantier'?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:14,opacity:isCartLocked&&orderType!=='chantier'?.4:1}}>
          <div style={{width:48,height:48,borderRadius:12,background:`linear-gradient(135deg,${EPJ.blue},${EPJ.green})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>🏗️</div>
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:15,color:EPJ.dark}}>Commande Chantier</div><div style={{fontSize:12,color:EPJ.gray}}>Matériel pour un chantier</div></div>
          {isCartLocked&&orderType==='chantier'&&<span style={{fontSize:10,background:EPJ.orange,color:'#fff',padding:'3px 8px',borderRadius:8,fontWeight:700}}>EN COURS</span>}
        </div>
        <div onClick={()=>{if(isCartLocked&&orderType!=='equipement')return;setOrderType('equipement');setView('catalog');setSelectedCat(null);setSearch('')}} className="epj-card" style={{marginBottom:10,cursor:isCartLocked&&orderType!=='equipement'?'not-allowed':'pointer',display:'flex',alignItems:'center',gap:14,opacity:isCartLocked&&orderType!=='equipement'?.4:1}}>
          <div style={{width:48,height:48,borderRadius:12,background:`linear-gradient(135deg,${EPJ.orange},${EPJ.red})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>👷</div>
          <div style={{flex:1}}><div style={{fontWeight:700,fontSize:15,color:EPJ.dark}}>Équipement Salarié</div><div style={{fontSize:12,color:EPJ.gray}}>Outillage, vêtements, EPI</div></div>
          {isCartLocked&&orderType==='equipement'&&<span style={{fontSize:10,background:EPJ.orange,color:'#fff',padding:'3px 8px',borderRadius:8,fontWeight:700}}>EN COURS</span>}
        </div>
        {pendingCount>0&&<div onClick={()=>setView('pending')} className="epj-card" style={{marginBottom:10,cursor:'pointer',display:'flex',alignItems:'center',gap:14,border:`2px solid ${EPJ.red}`}}>
          <div style={{width:48,height:48,borderRadius:12,background:EPJ.red,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,position:'relative'}} className="badge-pulse">📋<div style={{position:'absolute',top:-4,right:-4,background:EPJ.red,color:'#fff',borderRadius:'50%',width:22,height:22,fontSize:12,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',border:'2px solid #fff'}}>{pendingCount}</div></div>
          <div><div style={{fontWeight:700,fontSize:15,color:EPJ.red}}>Commandes à valider</div><div style={{fontSize:12,color:EPJ.gray}}>{pendingCount} en attente</div></div>
        </div>}
        <div onClick={()=>setView('history')} className="epj-card" style={{marginBottom:10,cursor:'pointer',display:'flex',alignItems:'center',gap:14}}>
          <div style={{width:48,height:48,borderRadius:12,background:`linear-gradient(135deg,${EPJ.gray},${EPJ.dark})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>📋</div>
          <div><div style={{fontWeight:700,fontSize:15,color:EPJ.dark}}>Historique</div><div style={{fontSize:12,color:EPJ.gray}}>{history.length} commande(s)</div></div>
        </div>
        {user.fonction==="Admin"&&<div onClick={()=>{setAdminSection(null);setSelectedCat(null);setSearch('');setView('admin')}} className="epj-card" style={{marginBottom:10,cursor:'pointer',display:'flex',alignItems:'center',gap:14,border:`2px solid ${EPJ.dark}`}}>
          <div style={{width:48,height:48,borderRadius:12,background:`linear-gradient(135deg,#555,${EPJ.dark})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>⚙️</div>
          <div><div style={{fontWeight:700,fontSize:15,color:EPJ.dark}}>Administration</div><div style={{fontSize:12,color:EPJ.gray}}>Chantiers, utilisateurs, catalogue</div></div>
        </div>}
      </div>
    </div>
  );

  // ═══ CATALOG ═══
  if(view==="catalog") return (
    <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto',paddingBottom:80}}>
      <style>{css}</style>
      <Header title={selectedCat||(orderType==='chantier'?'Catalogue Chantier':'Catalogue Équipement')} back={true} backView={selectedCat?'cats':'home'}/>
      <div style={{padding:'8px 12px',background:EPJ.dark}}>
        <input className="epj-input" placeholder="Rechercher article, référence..." value={search} onChange={e=>setSearch(e.target.value)} style={{background:'rgba(255,255,255,.1)',border:'none',color:'#fff'}}/>
      </div>
      <div style={{padding:12}}>
        {!selectedCat&&!search ? (
          <>
            {!configLoaded ? (
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px',gap:10,color:EPJ.gray}}>
                <div style={{width:20,height:20,border:`3px solid ${EPJ.blue}`,borderTopColor:'transparent',borderRadius:'50%',animation:'spin .7s linear infinite'}}/>
                <span style={{fontSize:13,fontWeight:600}}>Chargement du catalogue…</span>
              </div>
            ) : (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {availableCategories.map(cat=>(
                <div key={cat} onClick={()=>setSelectedCat(cat)} style={{background:'#fff',borderRadius:14,padding:'14px 10px',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:600,color:EPJ.dark,boxShadow:'0 1px 3px rgba(0,0,0,.04)',lineHeight:1.3,border:'2px solid transparent'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',marginBottom:4}}><CatIcon cat={cat} size={40}/></div>{cat}
                </div>
              ))}
            </div>
            )}
            <div onClick={()=>setShowDivers(true)} style={{marginTop:10,background:'#fff',borderRadius:14,padding:14,cursor:'pointer',textAlign:'center',border:`2px dashed ${EPJ.blue}`,color:EPJ.blue,fontWeight:600,fontSize:13}}>+ Article divers</div>
          </>
        ) : (
          Object.keys(grouped).length===0 ? <div style={{textAlign:'center',padding:'40px 20px',color:EPJ.gray}}><div style={{fontSize:40,marginBottom:8}}>🔍</div><div style={{fontWeight:600}}>Aucun résultat</div></div>
          : Object.entries(grouped).map(([g,items])=>(
            <div key={g}>
              <div style={{fontSize:11,fontWeight:700,color:EPJ.gray,textTransform:'uppercase',letterSpacing:.5,margin:'14px 0 6px',paddingLeft:4}}>{g}</div>
              {items.map(p=>(
                <div key={p.r} className="epj-row">
                  <Thumb cat={p.c} imageUrl={p.img}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:600,color:EPJ.dark,lineHeight:1.3}}>{p.n}</div>
                    <div style={{fontSize:10,color:EPJ.gray,marginTop:2,fontFamily:'monospace'}}>{p.r} • {p.u||'Pièce'} <span style={{display:'inline-block',marginLeft:4,padding:'1px 6px',borderRadius:8,fontSize:9,fontWeight:700,background:p.stock===false?'#FFF3E0':'#E8F5E9',color:p.stock===false?'#E65100':'#2E7D32'}}>{p.stock===false?'⚠️ Hors stock':'📦 En stock'}</span></div>
                  </div>
                  {cart[p.r] ? <QtyControl r={p.r} value={cart[p.r]} compact={true}/> : <button onClick={()=>addToCart(p.r)} style={{width:36,height:36,borderRadius:10,border:'none',background:EPJ.blue,color:'#fff',fontSize:20,cursor:'pointer',fontWeight:700,display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>}
                </div>
              ))}
            </div>
          ))
        )}
      </div>
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:520,background:'#fff',padding:'10px 16px',boxShadow:'0 -2px 10px rgba(0,0,0,.06)',display:'flex',gap:8,zIndex:100}}>
        <button className="epj-btn" onClick={()=>{setView('home');setSelectedCat(null);setSearch('')}} style={{background:'#eee',color:EPJ.dark,padding:'12px 16px'}}>← Accueil</button>
        {cartCount>0&&<button className="epj-btn" onClick={()=>setView('cart')} style={{flex:1,background:`linear-gradient(135deg,${EPJ.blue},${EPJ.green})`,color:'#fff'}}>🛒 Panier ({cartCount})</button>}
      </div>
      {toast&&<div style={{position:'fixed',bottom:80,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:'#fff',padding:'8px 20px',borderRadius:20,fontSize:13,fontWeight:600,zIndex:200,animation:'fadeUp .3s ease'}}>{toast}</div>}
      {showDivers&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:300,display:'flex',alignItems:'flex-end',justifyContent:'center'}} onClick={()=>setShowDivers(false)}>
        <div style={{background:'#fff',borderRadius:'20px 20px 0 0',padding:'24px 20px 30px',width:'100%',maxWidth:520}} onClick={e=>e.stopPropagation()}>
          <div style={{fontSize:18,fontWeight:700,color:EPJ.dark,marginBottom:16}}>Article divers</div>
          <div style={{marginBottom:10}}><label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:4}}>DÉSIGNATION *</label><input className="epj-input" value={diversName} onChange={e=>setDiversName(e.target.value)} placeholder="Description"/></div>
          <div style={{marginBottom:10}}><label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:4}}>RÉFÉRENCE</label><input className="epj-input" value={diversRef} onChange={e=>setDiversRef(e.target.value)} placeholder="Optionnel"/></div>
          <div style={{marginBottom:16}}><label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:4}}>QUANTITÉ</label><input className="epj-input" type="number" min="1" value={diversQty} onChange={e=>setDiversQty(parseInt(e.target.value)||1)} style={{width:100}}/></div>
          <button className="epj-btn" onClick={()=>{if(diversName.trim()){const ref=diversRef.trim()||`DIV-${Date.now()}`;CATALOG.push({c:'Divers',s:'Article libre',r:ref,n:diversName.trim(),u:'Pièce'});setCart(p=>({...p,[ref]:diversQty}));setDiversName('');setDiversRef('');setDiversQty(1);setShowDivers(false);showT('Ajouté')}}} style={{width:'100%',background:EPJ.blue,color:'#fff'}} disabled={!diversName.trim()}>Ajouter au panier</button>
        </div>
      </div>}
      <QtyPopupOverlay/>
    </div>
  );

  // ═══ CART ═══
  if(view==="cart"){
    const cg={};cartItems.forEach(i=>{if(!cg[i.c])cg[i.c]=[];cg[i.c].push(i)});
    return (
      <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto',paddingBottom:80}}>
        <style>{css}</style>
        <Header title="Panier" back={true} backView="catalog" showCart={false}/>
        <div style={{padding:'6px 12px',background:EPJ.dark,color:'rgba(255,255,255,.6)',fontSize:12,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <span>{user.prenom} {user.nom} • {orderType==='chantier'?'Chantier':'Équipement'}</span>
          {cartItems.length>0&&<button onClick={()=>{setCart({});showT('Panier vidé')}} style={{background:'rgba(255,255,255,.1)',border:'none',color:'#fff',borderRadius:6,padding:'4px 10px',fontSize:11,cursor:'pointer',fontFamily:font}}>🗑 Vider</button>}
        </div>
        <div style={{padding:12}}>
          {cartItems.length===0?<div style={{textAlign:'center',padding:'50px 20px',color:EPJ.gray}}><div style={{fontSize:40,marginBottom:8}}>🛒</div><div style={{fontWeight:600}}>Panier vide</div></div>:(
            <>
              {Object.entries(cg).map(([cat,items])=>(
                <div key={cat}>
                  <div style={{fontSize:11,fontWeight:700,color:EPJ.gray,textTransform:'uppercase',margin:'12px 0 6px',display:'flex',alignItems:'center',gap:6}}><CatIcon cat={cat} size={16}/> {cat}</div>
                  {items.map(it=>(
                    <div key={it.r} className="epj-row">
                      <Thumb cat={it.c} imageUrl={it.img}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,fontWeight:600,color:EPJ.dark}}>{it.n}</div>
                        <div style={{fontSize:10,color:EPJ.gray,fontFamily:'monospace'}}>{it.r}</div>
                      </div>
                      <QtyControl r={it.r} value={cart[it.r]} showDelete={true}/>
                    </div>
                  ))}
                </div>
              ))}
              <div className="epj-card" style={{marginTop:14}}>
                <div style={{display:'flex',justifyContent:'space-between',fontWeight:700,color:EPJ.dark}}><span>Total</span><span>{cartCount} articles</span></div>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:EPJ.gray,marginTop:4}}><span>Références</span><span>{cartItems.length}</span></div>
              </div>
            </>
          )}
        </div>
        {cartItems.length>0&&<div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:520,background:'#fff',padding:'10px 16px',boxShadow:'0 -2px 10px rgba(0,0,0,.06)',display:'flex',gap:8,zIndex:100}}>
          <button className="epj-btn" onClick={()=>setView('catalog')} style={{background:'#eee',color:EPJ.dark,padding:'12px 16px'}}>← Catalogue</button>
          <button className="epj-btn" onClick={()=>setView('details')} style={{flex:1,background:`linear-gradient(135deg,${EPJ.blue},${EPJ.green})`,color:'#fff'}}>Finaliser →</button>
        </div>}
        <QtyPopupOverlay/>
      </div>
    );
  }

  // ═══ ORDER DETAILS ═══
  if(view==="details") return (
    <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto',paddingBottom:80}}>
      <style>{css}</style>
      <Header title="Détails commande" back={true} backView="cart" showCart={false}/>
      <div style={{padding:12}}>
        <div className="epj-card" style={{marginBottom:10}}>
          {orderType==='chantier'?(
            <>
              <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:4}}>CHANTIER *</label>
                {!showNewChantier?(<>
                  <select className="epj-input" value={chantier} onChange={e=>setChantier(e.target.value)} style={{cursor:'pointer'}}>
                    <option value="">-- Sélectionnez --</option>
                    {dynChantiers.filter(c=>c.statut==='Actif').map(c=><option key={c.nom} value={c.nom}>[{c.num}] {c.nom}</option>)}
                  </select>
                  {/* N° affaire auto */}
                  {selectedChantierObj&&<div style={{marginTop:6,fontSize:12,color:EPJ.blue,fontWeight:600}}>📋 N° Affaire : {selectedChantierObj.num} — Conducteur : {selectedChantierObj.conducteur}</div>}
                  {(user.fonction==='Conducteur de travaux'||user.fonction==='Admin')&&<button onClick={()=>setShowNewChantier(true)} style={{background:'none',border:'none',color:EPJ.blue,fontSize:12,fontWeight:600,cursor:'pointer',marginTop:6,fontFamily:font}}>+ Nouveau chantier</button>}
                </>):(<>
                  <input className="epj-input" value={newChantier} onChange={e=>setNewChantier(e.target.value)} placeholder="Nom du nouveau chantier"/>
                  <button onClick={()=>setShowNewChantier(false)} style={{background:'none',border:'none',color:EPJ.gray,fontSize:12,cursor:'pointer',marginTop:6,fontFamily:font}}>← Chantier existant</button>
                </>)}
              </div>
              <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:4}}>LIVRAISON</label>
                <div style={{display:'flex',gap:8}}>
                  {['Chantier','Dépôt'].map(l=>(<button key={l} onClick={()=>setLivraison(l)} className="epj-btn" style={{flex:1,background:livraison===l?EPJ.blue:'#eee',color:livraison===l?'#fff':EPJ.dark,padding:'10px'}}>{l==='Chantier'?'🏗️':'🏭'} {l}</button>))}
                </div>
              </div>
            </>
          ):(
            <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:4}}>SALARIÉ DESTINATAIRE</label>
              <select className="epj-input" value={targetSalarie} onChange={e=>setTargetSalarie(e.target.value)} style={{cursor:'pointer'}}>
                <option value="">Moi-même ({user.prenom} {user.nom})</option>
                {dynUsers.filter(u=>u.id!==user.id).map(u=><option key={u.id} value={`${u.prenom} ${u.nom}`}>{u.prenom} {u.nom}</option>)}
              </select>
            </div>
          )}
          <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:4}}>DATE DE RÉCEPTION SOUHAITÉE</label><input className="epj-input" type="date" value={dateReception} onChange={e=>setDateReception(e.target.value)}/></div>
          <div style={{marginBottom:12}}><label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer'}}><input type="checkbox" checked={urgent} onChange={e=>setUrgent(e.target.checked)} style={{width:20,height:20,accentColor:EPJ.red}}/><span style={{fontSize:14,fontWeight:600,color:urgent?EPJ.red:EPJ.dark}}>⚠️ Commande URGENTE</span></label></div>
          <div style={{marginBottom:12}}><label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:4}}>EMAIL SUPPLÉMENTAIRE</label><input className="epj-input" type="email" value={extraEmail} onChange={e=>setExtraEmail(e.target.value)} placeholder="email@exemple.fr"/></div>
          <div><label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:4}}>REMARQUES</label><textarea className="epj-input" rows={3} value={remarques} onChange={e=>setRemarques(e.target.value)} placeholder="Instructions..." style={{resize:'vertical'}}/></div>
        </div>
      </div>
      <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:520,background:'#fff',padding:'10px 16px',boxShadow:'0 -2px 10px rgba(0,0,0,.06)',display:'flex',gap:8,zIndex:100}}>
        <button className="epj-btn" onClick={()=>setView('cart')} style={{background:'#eee',color:EPJ.dark,padding:'12px 16px'}}>← Panier</button>
        <button className="epj-btn" onClick={()=>setView('confirm')} disabled={orderType==='chantier'&&!chantier&&!newChantier} style={{flex:1,background:(orderType==='chantier'&&!chantier&&!newChantier)?'#ccc':`linear-gradient(135deg,${EPJ.blue},${EPJ.green})`,color:'#fff'}}>Récapitulatif →</button>
      </div>
    </div>
  );

  // ═══ CONFIRM ═══
  if(view==="confirm"){
    const byFourn={};cartItems.forEach(it=>{const c=it.r.split(' ')[0].substring(0,3).toUpperCase();if(!byFourn[c])byFourn[c]=[];byFourn[c].push(it)});
    const needsVal=orderType==='chantier'&&!user.directAchat;
    return (
      <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto',paddingBottom:80}}>
        <style>{css}</style>
        <Header title="Confirmation" back={true} backView="details" showCart={false}/>
        <div style={{padding:12}}>
          <div className="epj-card" style={{marginBottom:10}}>
            <div style={{fontSize:16,fontWeight:700,color:EPJ.dark,marginBottom:12}}>{numCmd()}</div>
            {urgent&&<div style={{background:EPJ.red,color:'#fff',padding:'6px 12px',borderRadius:8,fontSize:13,fontWeight:700,marginBottom:10,display:'inline-block'}}>⚠️ URGENT</div>}
            {needsVal&&<div style={{background:'#FFF3E0',color:'#E65100',padding:'8px 12px',borderRadius:8,fontSize:12,fontWeight:600,marginBottom:10}}>⏳ Soumise à validation ({selectedChantierObj?.conducteur})</div>}
            <div style={{background:EPJ.grayLight,borderRadius:10,padding:12,fontSize:13,lineHeight:1.8,color:EPJ.dark}}>
              <strong>Demandeur :</strong> {user.prenom} {user.nom}<br/>
              {orderType==='chantier'&&<><strong>Chantier :</strong> {showNewChantier?newChantier:chantier}<br/>{selectedChantierObj&&<><strong>N° Affaire :</strong> {selectedChantierObj.num}<br/></>}<strong>Livraison :</strong> {livraison}<br/></>}
              {orderType==='equipement'&&<><strong>Destinataire :</strong> {targetSalarie||`${user.prenom} ${user.nom}`}<br/></>}
              <strong>Articles :</strong> {cartCount} ({cartItems.length} réf.)<br/>
              {remarques&&<><strong>Remarques :</strong> {remarques}<br/></>}
              <strong>Envoi à :</strong> {needsVal?`${selectedChantierObj?.conducteur} (validation)`:'Achats directement'}
            </div>
          </div>
          <div className="epj-card">
            <div style={{fontSize:13,fontWeight:700,color:EPJ.dark,marginBottom:8}}>Articles par fournisseur</div>
            <div style={{maxHeight:250,overflowY:'auto'}}>
              {Object.entries(byFourn).sort(([a],[b])=>a.localeCompare(b)).map(([code,items])=>(
                <div key={code} style={{marginBottom:10}}>
                  <div style={{fontSize:12,fontWeight:700,color:EPJ.blue,marginBottom:4}}>▸ {code}</div>
                  {items.map(it=>(<div key={it.r} style={{display:'flex',justifyContent:'space-between',fontSize:12,padding:'3px 0',borderBottom:'1px solid #f0f0f0'}}><span style={{color:EPJ.dark,flex:1}}>{it.n}</span><span style={{color:EPJ.blue,fontWeight:700,marginLeft:8}}>x{it.qty}</span></div>))}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{position:'fixed',bottom:0,left:'50%',transform:'translateX(-50%)',width:'100%',maxWidth:520,background:'#fff',padding:'10px 16px',boxShadow:'0 -2px 10px rgba(0,0,0,.06)',display:'flex',gap:8,zIndex:100}}>
          <button className="epj-btn" onClick={()=>setView('details')} style={{background:'#eee',color:EPJ.dark,padding:'12px 16px'}}>← Modifier</button>
          <button className="epj-btn" onClick={sendOrder} disabled={sending} style={{flex:1,background:`linear-gradient(135deg,${EPJ.green},${EPJ.blue})`,color:'#fff'}}>{sending?'⏳ Envoi en cours...':needsVal?'📤 Soumettre':'✉️ Envoyer + PDF'}</button>
        </div>
      </div>
    );
  }

  // ═══ DONE ═══
  if(view==="done"){
    const o=lastSentOrder||history[0];
    const wasV=o?.statut==="En attente de validation";
    
    const mailDest = o ? (o.extraEmail ? `${dynEmailAchats},${o.extraEmail}` : dynEmailAchats) : dynEmailAchats;
    const mailSubj = o ? `${o.urgent?'⚠️ URGENT — ':''}Commande ${o.num} — ${o.chantier||o.salarie}` : '';
    const buildMailBody = () => {
      if(!o) return '';
      const oItems = o.items||[];
      let b = `BON DE COMMANDE ${o.num}\nDate : ${o.date}\n`;
      if(o.urgent) b += `⚠️ COMMANDE URGENTE\n`;
      b += `\nDemandeur : ${o.user}\n`;
      if(o.type==='chantier') { b += `Chantier : ${o.chantier}\nN° Affaire : ${o.numAffaire||o.chantierNum||''}\n`; }
      else { b += `Destinataire : ${o.salarie}\n`; }
      b += `\n--- ARTICLES ---\n`;
      oItems.forEach(it => { b += `• ${it.r} — ${it.n} — Qté: ${it.qty} ${it.u||'Pièce'}\n`; });
      b += `\nTOTAL : ${oItems.reduce((s,i)=>s+(i.qty||0),0)} articles\n\nCordialement,\n${o.user}\nEPJ — Électricité Générale`;
      return b;
    };
    const mailtoUrl = `mailto:${mailDest}?subject=${encodeURIComponent(mailSubj)}&body=${encodeURIComponent(buildMailBody())}`;

    return(
    <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto',textAlign:'center',padding:'30px 16px'}}>
      <style>{css}</style>
      <div style={{fontSize:56,marginBottom:12}}>{wasV?'📤':'✅'}</div>
      <div style={{fontSize:22,fontWeight:800,color:EPJ.dark,marginBottom:6}}>{wasV?'Commande soumise !':'Commande enregistrée !'}</div>
      <div style={{fontSize:13,color:EPJ.gray,lineHeight:1.6,marginBottom:16}}>{wasV?'Transmise au conducteur pour validation.':'Enregistrée dans Firebase. Utilisez les boutons ci-dessous.'}</div>
      {o&&<div style={{background:'#fff',borderRadius:14,padding:14,marginBottom:16,textAlign:'left',fontSize:13}}><div style={{fontWeight:700}}>{o.num}{(o.numAffaire||o.chantierNum)?` — N°${o.numAffaire||o.chantierNum}`:''}</div><div className="status-pill" style={{background:STATUS_COLORS[o.statut]?.bg,color:STATUS_COLORS[o.statut]?.color,marginTop:4}}>{STATUS_COLORS[o.statut]?.icon||''} {o.statut}</div></div>}
      
      {!wasV&&<div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
        <button className="epj-btn" onClick={()=>generateAndOpenPdf(o)} style={{background:`linear-gradient(135deg,${EPJ.blue},#0077B6)`,color:'#fff',padding:'16px',fontSize:15,width:'100%'}}>📄 Voir / Télécharger le PDF</button>
        <a href={mailtoUrl} style={{textDecoration:'none'}}>
          <div className="epj-btn" style={{background:`linear-gradient(135deg,${EPJ.orange},${EPJ.red})`,color:'#fff',padding:'16px',fontSize:15,width:'100%',textAlign:'center'}}>✉️ Envoyer par email</div>
        </a>
        {o&&o.type==='equipement'&&(
          o.signatureData
            ? <div style={{background:'#E8F5E9',borderRadius:12,padding:'12px 16px',display:'flex',alignItems:'center',gap:10,border:'2px solid #4CAF50'}}>
                <span style={{fontSize:24}}>✅</span>
                <div><div style={{fontSize:13,fontWeight:700,color:'#2E7D32'}}>Réception confirmée</div><div style={{fontSize:11,color:'#388E3C'}}>Signée le {o.dateReceptionEffective||o.date}</div></div>
              </div>
            : <button className="epj-btn" onClick={()=>openReceptionSheet(o)} style={{background:`linear-gradient(135deg,${EPJ.green},#2E7D32)`,color:'#fff',padding:'16px',fontSize:15,width:'100%'}}>✍️ Feuille de réception + Signature</button>
        )}
      </div>}

      {/* Aperçu rapide */}
      {pdfOrder&&<div style={{marginBottom:16}}>
        <div style={{background:EPJ.dark,color:'#fff',padding:'8px 14px',borderRadius:'14px 14px 0 0',fontSize:11,fontWeight:700}}>Aperçu du bon de commande</div>
        <div style={{border:'1px solid #ddd',borderTop:'none',borderRadius:'0 0 14px 14px',overflow:'hidden',maxHeight:300,overflowY:'auto'}}>
          <PdfView order={pdfOrder}/>
        </div>
      </div>}
      <button className="epj-btn" onClick={()=>{clearOrder();setPdfOrder(null);setLastSentOrder(null);setView('home')}} style={{background:`linear-gradient(135deg,${EPJ.blue},${EPJ.green})`,color:'#fff',padding:'16px 40px',fontSize:16,width:'100%'}}>🏠 Nouvelle commande</button>
    </div>
  )}

  // ═══ VALIDATION CONFIRMÉE (conducteur vient de valider) ═══
  if(view==="validateConfirm" && lastSentOrder) {
    const o = lastSentOrder;
    const mailDest = o.extraEmail ? `${dynEmailAchats},${o.extraEmail}` : dynEmailAchats;
    const mailSubj = `${o.urgent?'⚠️ URGENT — ':''}Commande ${o.num} — ${o.chantier||o.salarie}`;
    const buildBody = () => {
      const oItems = o.items||[];
      let b = `BON DE COMMANDE ${o.num}\nDate : ${o.date}\n`;
      if(o.urgent) b += `⚠️ COMMANDE URGENTE\n`;
      b += `\nDemandeur : ${o.user}\n`;
      if(o.type==='chantier'){ b += `Chantier : ${o.chantier}\nN° Affaire : ${o.numAffaire||o.chantierNum||''}\n`; }
      else { b += `Destinataire : ${o.salarie}\n`; }
      b += `\n--- ARTICLES ---\n`;
      oItems.forEach(it=>{ b += `• ${it.r} — ${it.n} — Qté: ${it.qty} ${it.u||'Pièce'}\n`; });
      b += `\nTOTAL : ${oItems.reduce((s,i)=>s+(i.qty||0),0)} articles\n\nCordialement,\n${user.prenom} ${user.nom}\nEPJ — Électricité Générale`;
      return b;
    };
    const mailtoUrl = `mailto:${mailDest}?subject=${encodeURIComponent(mailSubj)}&body=${encodeURIComponent(buildBody())}`;
    return (
      <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto',textAlign:'center',padding:'30px 16px'}}>
        <style>{css}</style>
        <div style={{fontSize:56,marginBottom:12}}>✅</div>
        <div style={{fontSize:22,fontWeight:800,color:EPJ.dark,marginBottom:6}}>Commande validée !</div>
        <div style={{fontSize:13,color:EPJ.gray,lineHeight:1.6,marginBottom:16}}>La commande a été validée. Générez le PDF et envoyez-la aux achats.</div>
        <div style={{background:'#fff',borderRadius:14,padding:14,marginBottom:16,textAlign:'left',fontSize:13}}>
          <div style={{fontWeight:700}}>{o.num}{(o.numAffaire||o.chantierNum)?` — N°${o.numAffaire||o.chantierNum}`:''}</div>
          <div style={{fontSize:11,color:EPJ.gray,marginTop:2}}>{o.date} • {o.user} • {o.chantier||o.salarie}</div>
          <div className="status-pill" style={{background:STATUS_COLORS['Validée']?.bg,color:STATUS_COLORS['Validée']?.color,marginTop:6}}>✅ Validée</div>
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10,marginBottom:16}}>
          <button className="epj-btn" onClick={()=>generateAndOpenPdf(o)} style={{background:`linear-gradient(135deg,${EPJ.blue},#0077B6)`,color:'#fff',padding:'16px',fontSize:15,width:'100%'}}>📄 Voir / Télécharger le PDF</button>
          <a href={mailtoUrl} style={{textDecoration:'none'}}>
            <div className="epj-btn" style={{background:`linear-gradient(135deg,${EPJ.orange},${EPJ.red})`,color:'#fff',padding:'16px',fontSize:15,width:'100%',textAlign:'center',borderRadius:12,fontWeight:700,cursor:'pointer'}}>✉️ Envoyer par email aux achats</div>
          </a>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="epj-btn" onClick={()=>setView('pending')} style={{flex:1,background:'#eee',color:EPJ.dark,padding:'12px',fontSize:14}}>← Autres commandes</button>
          <button className="epj-btn" onClick={()=>{setPdfOrder(null);setLastSentOrder(null);setView('home')}} style={{flex:1,background:`linear-gradient(135deg,${EPJ.blue},${EPJ.green})`,color:'#fff',padding:'12px',fontSize:14}}>🏠 Accueil</button>
        </div>
        {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:'#fff',padding:'8px 20px',borderRadius:20,fontSize:13,fontWeight:600,zIndex:400}}>{toast}</div>}
      </div>
    );
  }

  // ═══ PENDING ═══
  if(view==="pending"){
    const fullName=`${user.prenom} ${user.nom}`;
    const myP=user.fonction==="Admin"?pendingOrders:pendingOrders.filter(o=>{const ch=dynChantiers.find(c=>c.nom===o.chantier);return ch&&ch.conducteur===fullName});
    return(
      <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto'}}>
        <style>{css}</style>
        <Header title="Commandes à valider" back={true} backView="home" showCart={false}/>
        <div style={{padding:12}}>
          {myP.length===0?<div style={{textAlign:'center',padding:'50px 20px',color:EPJ.gray}}><div style={{fontSize:40,marginBottom:8}}>✅</div><div style={{fontWeight:600}}>Aucune commande en attente</div></div>
          :myP.map(o=>(
            <div key={o.num} className="epj-card" style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                <div><div style={{fontSize:14,fontWeight:700,color:EPJ.dark}}>{o.num}</div><div style={{fontSize:12,color:EPJ.gray}}>{o.date} • {o.user}</div><div style={{fontSize:12,color:EPJ.blue}}>🏗️ [{o.numAffaire}] {o.chantier}</div>{o.urgent&&<span style={{fontSize:10,background:EPJ.red,color:'#fff',padding:'2px 6px',borderRadius:4,fontWeight:700}}>⚠️ URGENT</span>}</div>
                <div style={{fontSize:13,fontWeight:700}}>{(o.items||[]).length} réf.</div>
              </div>
              <div style={{background:EPJ.grayLight,borderRadius:8,padding:8,marginBottom:10,maxHeight:120,overflowY:'auto'}}>
                {(o.items||[]).map(it=>(<div key={it.r} style={{display:'flex',justifyContent:'space-between',fontSize:11,padding:'2px 0'}}><span>{it.n}</span><span style={{color:EPJ.blue,fontWeight:700}}>x{it.qty}</span></div>))}
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="epj-btn" onClick={()=>validateOrder(o.num)} style={{flex:1,background:EPJ.green,color:'#fff',padding:'10px'}}>✅ Valider</button>
                <button className="epj-btn" onClick={()=>{setShowRefuseModal(o.num);setRefuseMotif('')}} style={{flex:1,background:EPJ.red,color:'#fff',padding:'10px'}}>❌ Refuser</button>
              </div>
            </div>
          ))}
        </div>
        {showRefuseModal&&<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',zIndex:300,display:'flex',alignItems:'center',justifyContent:'center',padding:20}} onClick={()=>setShowRefuseModal(null)}>
          <div style={{background:'#fff',borderRadius:20,padding:24,width:'100%',maxWidth:400}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:700,color:EPJ.dark,marginBottom:16}}>Motif de refus</div>
            <textarea className="epj-input" rows={3} value={refuseMotif} onChange={e=>setRefuseMotif(e.target.value)} placeholder="Motif..." style={{resize:'vertical',marginBottom:12}}/>
            <div style={{display:'flex',gap:8}}>
              <button className="epj-btn" onClick={()=>setShowRefuseModal(null)} style={{flex:1,background:'#eee',color:EPJ.dark,padding:'10px'}}>Annuler</button>
              <button className="epj-btn" onClick={()=>refuseOrder(showRefuseModal,refuseMotif)} style={{flex:1,background:EPJ.red,color:'#fff',padding:'10px'}} disabled={!refuseMotif.trim()}>Confirmer</button>
            </div>
          </div>
        </div>}
        {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:'#fff',padding:'8px 20px',borderRadius:20,fontSize:13,fontWeight:600,zIndex:400}}>{toast}</div>}
      </div>
    );
  }

  // ═══ PDF PREVIEW (after validation) ═══
  if(view==="pdfPreview"&&pdfOrder) return(
    <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto'}}>
      <style>{css}</style>
      <Header title="PDF Commande" back={true} backView="home" showCart={false}/>
      <div style={{padding:12}}>
        <PdfView order={pdfOrder}/>
        <button className="epj-btn" onClick={()=>{setPdfOrder(null);setView('home')}} style={{width:'100%',marginTop:12,background:`linear-gradient(135deg,${EPJ.blue},${EPJ.green})`,color:'#fff'}}>← Retour accueil</button>
      </div>
    </div>
  );

  // ═══ HISTORY ═══
  if(view==="history"){
    const fullName = `${user.prenom} ${user.nom}`;
    // Filtrer selon le rôle
    let myHistory = history.filter(h=>h&&h.num);
    if(user.fonction==="Admin") {
      // Admin voit tout
    } else if(user.fonction==="Conducteur de travaux") {
      // Conducteur voit les commandes de ses chantiers
      const mesChantiers = dynChantiers.filter(c=>c.conducteur===fullName).map(c=>c.nom);
      myHistory = myHistory.filter(h=>mesChantiers.includes(h.chantier)||h.user===fullName);
    } else {
      // Monteur/Chef de chantier voit uniquement ses commandes
      myHistory = myHistory.filter(h=>h.userId===user.id||h.user===fullName);
    }
    // Appliquer les filtres manuels
    if(historyFilter.statut) myHistory = myHistory.filter(h=>h.statut===historyFilter.statut);
    if(historyFilter.chantier) myHistory = myHistory.filter(h=>h.chantier===historyFilter.chantier);
    return(
    <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto'}}>
      <style>{css}</style>
      <Header title="Historique" back={true} backView="home" showCart={false}/>
      <div style={{padding:'8px 12px',background:'#fff',borderBottom:'1px solid #eee'}}>
        <div style={{display:'flex',gap:6}}>
          <select className="epj-input" value={historyFilter.statut} onChange={e=>setHistoryFilter(f=>({...f,statut:e.target.value}))} style={{flex:1,fontSize:12,padding:'8px 10px'}}><option value="">Tous statuts</option>{Object.keys(STATUS_COLORS).map(s=><option key={s} value={s}>{s}</option>)}</select>
          <select className="epj-input" value={historyFilter.chantier} onChange={e=>setHistoryFilter(f=>({...f,chantier:e.target.value}))} style={{flex:1,fontSize:12,padding:'8px 10px'}}><option value="">Tous chantiers</option>{[...new Set(myHistory.filter(h=>h.chantier).map(h=>h.chantier))].map(c=><option key={c} value={c}>{c}</option>)}</select>
        </div>
        {user.fonction==="Admin"&&myHistory.length>0&&<button className="epj-btn" onClick={async()=>{if(!confirm(`Supprimer les ${myHistory.length} commandes affichées ?`))return;for(const h of myHistory){if(h._id){try{await deleteDoc(doc(db,"commandes",h._id))}catch(e){}}}showT(`🗑️ ${myHistory.length} commandes supprimées`)}} style={{width:'100%',marginTop:6,background:EPJ.red,color:'#fff',padding:'8px',fontSize:12}}>🗑️ Supprimer tout ({myHistory.length})</button>}
      </div>
      <div style={{padding:12}}>
        {myHistory.length===0?<div style={{textAlign:'center',padding:'50px 20px',color:EPJ.gray}}><div style={{fontSize:40,marginBottom:8}}>📋</div><div style={{fontWeight:600}}>Aucune commande</div></div>
        :myHistory.map((h,i)=>(
          <div key={h._id||i} className="epj-card" style={{marginBottom:8,cursor:'pointer'}}>
            <div onClick={()=>{setSelectedOrder(h);setView('orderDetail')}} style={{display:'flex',justifyContent:'space-between'}}>
              <div><div style={{fontSize:14,fontWeight:700,color:EPJ.dark}}>{h.num}</div><div style={{fontSize:12,color:EPJ.gray}}>{h.date} • {h.user}</div><div style={{fontSize:12,color:EPJ.blue,marginTop:2}}>{h.type==='chantier'?`🏗️ [${h.numAffaire||''}] ${h.chantier||''}`:`👷 ${h.salarie||''}`}</div></div>
              <div style={{textAlign:'right'}}><div style={{fontSize:13,fontWeight:700,color:EPJ.dark,marginBottom:4}}>{(h.items||[]).length} réf.</div>{h.urgent&&<div style={{fontSize:10,background:EPJ.red,color:'#fff',padding:'2px 6px',borderRadius:4,fontWeight:700,marginBottom:4}}>URGENT</div>}<div className="status-pill" style={{background:STATUS_COLORS[h.statut]?.bg||'#eee',color:STATUS_COLORS[h.statut]?.color||'#333'}}>{STATUS_COLORS[h.statut]?.icon||''} {h.statut||'—'}</div></div>
            </div>
            {user.fonction==="Admin"&&<button onClick={async(e)=>{e.stopPropagation();if(!confirm(`Supprimer ${h.num} ?`))return;if(h._id){try{await deleteDoc(doc(db,"commandes",h._id));showT("🗑️ Supprimée")}catch(e){showT("❌ Erreur")}}}} style={{marginTop:6,width:'100%',background:'#fee',color:EPJ.red,border:'none',borderRadius:6,padding:'4px',fontSize:11,cursor:'pointer',fontFamily:font}}>🗑️ Supprimer</button>}
          </div>
        ))}
      </div>
    </div>
  );}

  // ═══ ORDER DETAIL ═══
  if(view==="orderDetail"&&selectedOrder){
    const o=selectedOrder;const byFourn={};(o.items||[]).forEach(it=>{const c=(it.r||'').split(' ')[0].substring(0,3).toUpperCase();if(!byFourn[c])byFourn[c]=[];byFourn[c].push(it)});
    return(
      <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto'}}>
        <style>{css}</style>
        <Header title={o.num} back={true} backView="history" showCart={false}/>
        <div style={{padding:12}}>
          <div className="epj-card" style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
              <div style={{fontSize:18,fontWeight:800,color:EPJ.dark}}>{o.num}</div>
              <div className="status-pill" style={{background:STATUS_COLORS[o.statut]?.bg,color:STATUS_COLORS[o.statut]?.color,fontSize:12,padding:'5px 12px'}}>{STATUS_COLORS[o.statut]?.icon} {o.statut}</div>
            </div>
            {o.urgent&&<div style={{background:EPJ.red,color:'#fff',padding:'6px 12px',borderRadius:8,fontSize:13,fontWeight:700,marginBottom:10,display:'inline-block'}}>⚠️ URGENT</div>}
            {o.motifRefus&&<div style={{background:'#FFEBEE',color:'#C62828',padding:'8px 12px',borderRadius:8,fontSize:12,fontWeight:600,marginBottom:10}}>Motif : {o.motifRefus}</div>}
            <div style={{background:EPJ.grayLight,borderRadius:10,padding:12,fontSize:13,lineHeight:1.8,color:EPJ.dark}}>
              <strong>Date :</strong> {o.date}<br/><strong>Demandeur :</strong> {o.user}<br/>
              {o.chantier&&<><strong>Chantier :</strong> [{o.numAffaire}] {o.chantier}<br/></>}
              {o.type==='equipement'&&<><strong>Destinataire :</strong> {o.salarie}<br/></>}
              {o.livraison&&<><strong>Livraison :</strong> {o.livraison}<br/></>}
              <strong>Réception :</strong> {o.dateReception||'Non précisée'}<br/>
              {o.remarques&&<><strong>Remarques :</strong> {o.remarques}<br/></>}
            </div>
          </div>
          <div className="epj-card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
              <div style={{fontSize:14,fontWeight:700,color:EPJ.dark}}>Articles par fournisseur</div>
              {/* Bouton re-générer PDF */}
              <button className="epj-btn" onClick={()=>generateAndOpenPdf(o)} style={{background:EPJ.blue,color:'#fff',padding:'6px 14px',fontSize:11}}>📄 PDF</button>
              {o.type==='equipement'&&(o.signatureData?<span style={{fontSize:11,color:'#2E7D32',fontWeight:700}}>✅ Réceptionnée</span>:<button className="epj-btn" onClick={()=>openReceptionSheet(o)} style={{background:EPJ.green,color:'#fff',padding:'6px 14px',fontSize:11}}>✍️ Réception</button>)}
            </div>
            {Object.entries(byFourn).sort(([a],[b])=>a.localeCompare(b)).map(([code,items])=>(
              <div key={code} style={{marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:700,color:EPJ.blue,marginBottom:6,paddingBottom:4,borderBottom:`2px solid ${EPJ.blue}22`}}>▸ {code} ({items.length})</div>
                {items.map(it=>(<div key={it.r} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid #f5f5f5'}}><Thumb cat={it.c} imageUrl={it.img}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:EPJ.dark}}>{it.n}</div><div style={{fontSize:10,color:EPJ.gray,fontFamily:'monospace'}}>{it.r}</div></div><div style={{fontSize:14,fontWeight:800,color:EPJ.blue}}>x{it.qty}</div></div>))}
              </div>
            ))}
            <div style={{marginTop:10,padding:'10px 0',borderTop:`2px solid ${EPJ.dark}11`,display:'flex',justifyContent:'space-between',fontWeight:700,color:EPJ.dark}}><span>Total</span><span>{(o.items||[]).reduce((s,i)=>s+(i.qty||0),0)} articles ({(o.items||[]).length} réf.)</span></div>
          </div>
          {o.signatureData&&<div className="epj-card" style={{marginBottom:10,border:`2px solid ${EPJ.green}`}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
              <span style={{fontSize:20}}>✅</span>
              <div><div style={{fontSize:13,fontWeight:700,color:'#2E7D32'}}>Réception confirmée</div><div style={{fontSize:11,color:'#388E3C'}}>Signée le {o.dateReceptionEffective||o.date}</div></div>
            </div>
            <img src={o.signatureData} alt="Signature" style={{width:'100%',maxHeight:90,objectFit:'contain',border:`1px solid ${EPJ.gray}33`,borderRadius:8,background:'#fafafa',padding:4}}/>
          </div>}
        </div>
      </div>
    );
  }

  // ═══ ADMIN ═══
  if(view==="admin"&&user?.fonction==="Admin"){
    const adminSave = async (collName, docId, data) => {
      setAdminSaving(true);
      try {
        await setDoc(doc(db, collName, docId), data, {merge:true});
        showT("✅ Sauvegardé");
      } catch(e) { showT("❌ Erreur: "+e.message); }
      setAdminSaving(false);
      setAdminEdit(null);
      setAdminForm({});
    };
    const adminDelete = async (collName, docId) => {
      if(!confirm("Supprimer ?")) return;
      setAdminSaving(true);
      try {
        await deleteDoc(doc(db, collName, docId));
        showT("🗑️ Supprimé");
      } catch(e) { showT("❌ Erreur: "+e.message); }
      setAdminSaving(false);
    };
    const adminInitAll = async () => {
      if(!confirm("Réinitialiser la base complète ? (utilisateurs + chantiers + catalogue 583 articles)")) return;
      setAdminSaving(true);
      const r = await initEPJData(true);
      showT(r.message);
      // Always upload catalog
      showT("⏳ Chargement du catalogue (583 articles)...");
      const catCount = await uploadCatalog(CATALOG);
      showT(`✅ ${catCount} articles chargés`);
      setAdminSaving(false);
    };

    // ─── Admin menu ───
    if(!adminSection) return(
      <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto'}}>
        <style>{css}</style>
        <Header title="⚙️ Administration" back={true} backView="home" showCart={false}/>
        <div style={{padding:16}}>
          {[
            {key:'chantiers',icon:'🏗️',label:'Chantiers',desc:`${dynChantiers.length} chantier(s)`},
            {key:'users',icon:'👷',label:'Utilisateurs',desc:`${dynUsers.length} utilisateur(s)`},
            {key:'categories',icon:'📁',label:'Catégories & Sous-catégories',desc:`${[...new Set(dynCatalog.map(p=>p.c))].length} catégories`},
            {key:'catalog',icon:'📦',label:'Articles du catalogue',desc:`${dynCatalog.length} article(s)`},
          ].map(s=>(
            <div key={s.key} onClick={()=>{setAdminSection(s.key);setAdminEdit(null);setAdminForm({})}} className="epj-card" style={{marginBottom:10,cursor:'pointer',display:'flex',alignItems:'center',gap:14}}>
              <div style={{width:48,height:48,borderRadius:12,background:`linear-gradient(135deg,${EPJ.blue},${EPJ.green})`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22}}>{s.icon}</div>
              <div><div style={{fontWeight:700,fontSize:15,color:EPJ.dark}}>{s.label}</div><div style={{fontSize:12,color:EPJ.gray}}>{s.desc}</div></div>
            </div>
          ))}
          <div style={{marginTop:20,borderTop:`1px solid #ddd`,paddingTop:16}}>
            <button className="epj-btn" onClick={adminInitAll} disabled={adminSaving} style={{width:'100%',background:'#555',color:'#fff',padding:'14px',fontSize:14,marginBottom:8}}>
              {adminSaving?'⏳ En cours...':'🔄 Réinitialiser Firebase (589 articles)'}
            </button>
            <div style={{fontSize:11,color:EPJ.gray,textAlign:'center',marginBottom:12}}>Charge les données par défaut (utilisateurs, chantiers, catalogue) dans Firebase</div>
            <button className="epj-btn" onClick={async()=>{
              const validCats = new Set(CATALOG.map(p=>p.c));
              const orphanCats = [...new Set(dynCatalog.filter(p=>p.r && !validCats.has(p.c)).map(p=>p.c))];
              if(orphanCats.length===0){showT('✅ Aucune catégorie parasite');return;}
              if(!confirm(`Supprimer les catégories parasites : ${orphanCats.join(', ')} ?`))return;
              setAdminSaving(true);
              let total=0;
              for(const cat of orphanCats){
                try{ total += await deleteCategoryByQuery(cat); }catch(e){}
              }
              setAdminSaving(false);showT(`🗑️ ${total} articles parasites supprimés`);
            }} disabled={adminSaving} style={{width:'100%',background:'#E65100',color:'#fff',padding:'12px',fontSize:13,marginBottom:4}}>
              🧹 Nettoyer catégories parasites Firebase
            </button>
            <div style={{fontSize:10,color:EPJ.gray,textAlign:'center'}}>Supprime les anciennes catégories (Câbles, Câble Colonne, Vêtements...) non présentes dans le catalogue standard</div>
          </div>
        </div>
        {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:'#fff',padding:'8px 20px',borderRadius:20,fontSize:13,fontWeight:600,zIndex:400}}>{toast}</div>}
      </div>
    );

    // ─── Admin: Chantiers ───
    if(adminSection==='chantiers') return(
      <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto'}}>
        <style>{css}</style>
        <Header title="🏗️ Chantiers" back={true} backView="admin" showCart={false}/>
        <div style={{padding:12}}>
          <button className="epj-btn" onClick={()=>{setAdminEdit('new');setAdminForm({num:'',nom:'',conducteur:'',emailConducteur:'',adresse:'',statut:'Actif'})}} style={{width:'100%',background:EPJ.green,color:'#fff',padding:'12px',fontSize:14,marginBottom:12}}>+ Ajouter un chantier</button>
          {adminEdit&&<div className="epj-card" style={{marginBottom:12,border:`2px solid ${EPJ.blue}`}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>{adminEdit==='new'?'Nouveau chantier':'Modifier le chantier'}</div>
            {['num','nom','conducteur','emailConducteur','adresse'].map(f=>(
              <div key={f} style={{marginBottom:8}}>
                <label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:2}}>{f==='num'?'N° AFFAIRE':f==='nom'?'NOM':f==='conducteur'?'CONDUCTEUR':f==='emailConducteur'?'EMAIL CONDUCTEUR':'ADRESSE'}</label>
                <input className="epj-input" value={adminForm[f]||''} onChange={e=>setAdminForm(p=>({...p,[f]:e.target.value}))} style={{padding:'8px 10px',fontSize:13}}/>
              </div>
            ))}
            <div style={{marginBottom:8}}>
              <label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:2}}>STATUT</label>
              <select className="epj-input" value={adminForm.statut||'Actif'} onChange={e=>setAdminForm(p=>({...p,statut:e.target.value}))}>
                <option value="Actif">Actif</option><option value="Terminé">Terminé</option><option value="Archivé">Archivé</option>
              </select>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="epj-btn" onClick={()=>{setAdminEdit(null);setAdminForm({})}} style={{flex:1,background:'#eee',color:EPJ.dark,padding:'10px'}}>Annuler</button>
              <button className="epj-btn" onClick={()=>adminSave('chantiers',adminForm.num,adminForm)} disabled={adminSaving||!adminForm.num||!adminForm.nom} style={{flex:1,background:EPJ.blue,color:'#fff',padding:'10px'}}>{adminSaving?'⏳':'💾 Sauvegarder'}</button>
            </div>
          </div>}
          {dynChantiers.filter(c=>c.statut==='Actif').map(ch=>(
            <div key={ch.num} className="epj-card" style={{marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:EPJ.dark}}>[{ch.num}] {ch.nom}</div>
                <div style={{fontSize:11,color:EPJ.gray}}>{ch.conducteur} • {ch.adresse?.substring(0,40)}</div>
              </div>
              <div style={{display:'flex',gap:4}}>
                <button onClick={()=>{setAdminEdit(ch.num);setAdminForm({...ch})}} style={{background:EPJ.blue,color:'#fff',border:'none',borderRadius:8,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>✏️</button>
                <button onClick={()=>adminDelete('chantiers',ch.num)} style={{background:EPJ.red,color:'#fff',border:'none',borderRadius:8,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
        {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:'#fff',padding:'8px 20px',borderRadius:20,fontSize:13,fontWeight:600,zIndex:400}}>{toast}</div>}
      </div>
    );

    // ─── Admin: Utilisateurs ───
    if(adminSection==='users') return(
      <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto'}}>
        <style>{css}</style>
        <Header title="👷 Utilisateurs" back={true} backView="admin" showCart={false}/>
        <div style={{padding:12}}>
          <button className="epj-btn" onClick={()=>{setAdminEdit('new');setAdminForm({id:'',pwd:'1234',prenom:'',nom:'',fonction:'Ouvrier',email:'',directAchat:false})}} style={{width:'100%',background:EPJ.green,color:'#fff',padding:'12px',fontSize:14,marginBottom:12}}>+ Ajouter un utilisateur</button>
          {adminEdit&&<div className="epj-card" style={{marginBottom:12,border:`2px solid ${EPJ.blue}`}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>{adminEdit==='new'?'Nouvel utilisateur':'Modifier utilisateur'}</div>
            {['id','pwd','prenom','nom','email'].map(f=>(
              <div key={f} style={{marginBottom:8}}>
                <label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:2}}>{f==='id'?'IDENTIFIANT':f==='pwd'?'MOT DE PASSE':f==='prenom'?'PRÉNOM':f==='nom'?'NOM':'EMAIL'}</label>
                <input className="epj-input" value={adminForm[f]||''} onChange={e=>setAdminForm(p=>({...p,[f]:e.target.value}))} style={{padding:'8px 10px',fontSize:13}}/>
              </div>
            ))}
            <div style={{marginBottom:8}}>
              <label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:2}}>FONCTION</label>
              <select className="epj-input" value={adminForm.fonction||'Ouvrier'} onChange={e=>setAdminForm(p=>({...p,fonction:e.target.value}))}>
                {['Admin','Conducteur de travaux','Chef de chantier','Ouvrier'].map(f=><option key={f}>{f}</option>)}
              </select>
            </div>
            <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,cursor:'pointer'}}>
              <input type="checkbox" checked={adminForm.directAchat||false} onChange={e=>setAdminForm(p=>({...p,directAchat:e.target.checked}))} style={{width:18,height:18}}/>
              <span style={{fontSize:13}}>Achat direct (sans validation conducteur)</span>
            </label>
            <div style={{display:'flex',gap:8}}>
              <button className="epj-btn" onClick={()=>{setAdminEdit(null);setAdminForm({})}} style={{flex:1,background:'#eee',color:EPJ.dark,padding:'10px'}}>Annuler</button>
              <button className="epj-btn" onClick={()=>adminSave('utilisateurs',adminForm.id,adminForm)} disabled={adminSaving||!adminForm.id||!adminForm.prenom} style={{flex:1,background:EPJ.blue,color:'#fff',padding:'10px'}}>{adminSaving?'⏳':'💾 Sauvegarder'}</button>
            </div>
          </div>}
          {dynUsers.map(u=>(
            <div key={u.id} className="epj-card" style={{marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:700,color:EPJ.dark}}>{u.prenom} {u.nom}</div>
                <div style={{fontSize:11,color:EPJ.gray}}>{u.fonction} • {u.id}{u.directAchat?' • Achat direct':''}</div>
              </div>
              <div style={{display:'flex',gap:4}}>
                <button onClick={()=>{setAdminEdit(u.id);setAdminForm({...u})}} style={{background:EPJ.blue,color:'#fff',border:'none',borderRadius:8,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>✏️</button>
                {u.id!=='admin'&&<button onClick={()=>adminDelete('utilisateurs',u.id)} style={{background:EPJ.red,color:'#fff',border:'none',borderRadius:8,padding:'4px 10px',fontSize:11,cursor:'pointer'}}>🗑️</button>}
              </div>
            </div>
          ))}
        </div>
        {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:'#fff',padding:'8px 20px',borderRadius:20,fontSize:13,fontWeight:600,zIndex:400}}>{toast}</div>}
      </div>
    );

    // ─── Admin: Catégories & Sous-catégories ───
    if(adminSection==='categories'){
      const allCatsRaw = [...new Set(dynCatalog.map(p=>p.c))];
      const cats = dynCatOrder.length > 0
        ? [...allCatsRaw].sort((a,b)=>{const ia=dynCatOrder.indexOf(a),ib=dynCatOrder.indexOf(b);if(ia===-1&&ib===-1)return a.localeCompare(b);if(ia===-1)return 1;if(ib===-1)return -1;return ia-ib;})
        : [...allCatsRaw].sort();
      const subcats = selectedCat ? [...new Set(dynCatalog.filter(p=>p.c===selectedCat).map(p=>p.s))].sort() : [];
      const EMOJI_QUICK = ['🧱','🔧','🏗️','🔌','📦','⚡','🔗','🏢','🏠','📡','🔔','💡','🔩','🛠️','📎','👔','🦺','🚪','🔑','💧','🌡️','🪛','🔋','📏','🗜️','🪝','🔦','🧰','🪜','🏷️'];
      const moveCat = async (idx, dir) => {
        const newOrder = [...cats];
        const swapIdx = idx + dir;
        if(swapIdx < 0 || swapIdx >= newOrder.length) return;
        [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
        setDynCatOrder(newOrder);
        await setDoc(doc(db,'config','settings'),{catOrder:newOrder},{merge:true});
        showT('✅ Ordre sauvegardé');
      };
      return(
      <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto'}}>
        <style>{css}</style>
        <Header title={selectedCat?`📁 ${selectedCat}`:"📁 Catégories"} back={true} backView={selectedCat?"admin":"admin"} showCart={false}/>
        <div style={{padding:12}}>
          {!selectedCat ? (<>
            <button className="epj-btn" onClick={()=>{setAdminEdit('newCat');setAdminForm({nom:'',icon:'📦'})}} style={{width:'100%',background:EPJ.green,color:'#fff',padding:'12px',fontSize:14,marginBottom:12}}>+ Nouvelle catégorie</button>
            {adminEdit==='newCat'&&<div className="epj-card" style={{marginBottom:12,border:`2px solid ${EPJ.blue}`}}>
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                <input className="epj-input" placeholder="Nom de la catégorie" value={adminForm.nom||''} onChange={e=>setAdminForm(p=>({...p,nom:e.target.value}))} style={{flex:1,padding:'8px 10px',fontSize:13}}/>
                <input className="epj-input" placeholder="Icône" value={adminForm.icon||''} onChange={e=>setAdminForm(p=>({...p,icon:e.target.value}))} style={{width:60,padding:'8px',fontSize:20,textAlign:'center'}}/>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="epj-btn" onClick={()=>{setAdminEdit(null);setAdminForm({})}} style={{flex:1,background:'#eee',color:EPJ.dark,padding:'10px'}}>Annuler</button>
                <button className="epj-btn" onClick={async()=>{
                  if(!adminForm.nom) return;
                  const newIcons = {...dynCatIcons, [adminForm.nom]:adminForm.icon||'📦'};
                  await setDoc(doc(db,"config","settings"),{catIcons:newIcons},{merge:true});
                  // Add a placeholder article to create the category
                  await setDoc(doc(db,"catalogue","__cat_"+adminForm.nom.replace(/\s/g,'_')),{c:adminForm.nom,s:'Général',r:'',n:'(catégorie vide)',u:'',img:''});
                  setAdminEdit(null);setAdminForm({});showT("✅ Catégorie ajoutée");
                }} disabled={adminSaving||!adminForm.nom} style={{flex:1,background:EPJ.blue,color:'#fff',padding:'10px'}}>💾 Ajouter</button>
              </div>
            </div>}
            {cats.map((cat,idx)=>(
              <div key={cat} className="epj-card" style={{marginBottom:6,display:'flex',alignItems:'center',gap:8}}>
                <div style={{display:'flex',flexDirection:'column',gap:2}}>
                  <button onClick={()=>moveCat(idx,-1)} disabled={idx===0} style={{background:idx===0?'#eee':EPJ.dark,color:idx===0?'#bbb':'#fff',border:'none',borderRadius:6,width:24,height:22,fontSize:11,cursor:idx===0?'default':'pointer',lineHeight:1}}>↑</button>
                  <button onClick={()=>moveCat(idx,1)} disabled={idx===cats.length-1} style={{background:idx===cats.length-1?'#eee':EPJ.dark,color:idx===cats.length-1?'#bbb':'#fff',border:'none',borderRadius:6,width:24,height:22,fontSize:11,cursor:idx===cats.length-1?'default':'pointer',lineHeight:1}}>↓</button>
                </div>
                <div onClick={()=>setSelectedCat(cat)} style={{flex:1,display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}>
                  <CatIcon cat={cat} size={32}/>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:EPJ.dark}}>{cat}</div>
                    <div style={{fontSize:10,color:EPJ.gray}}>{dynCatalog.filter(p=>p.c===cat).length} art. • {[...new Set(dynCatalog.filter(p=>p.c===cat).map(p=>p.s))].length} sous-cat.{dynEquipCats.includes(cat)?' • 👷 Équip.':''}</div>
                  </div>
                </div>
                <button onClick={()=>{setAdminEdit('renameCat');setAdminForm({oldNom:cat,nom:cat,icon:dynCatIcons[cat]||'📦',isEquip:dynEquipCats.includes(cat)})}} style={{background:EPJ.blue,color:'#fff',border:'none',borderRadius:8,padding:'4px 8px',fontSize:11,cursor:'pointer'}}>✏️</button>
                <button onClick={async()=>{
                  if(!confirm(`Supprimer la catégorie "${cat}" et tous ses articles ?`))return;
                  setAdminSaving(true);
                  try {
                    // Suppression fiable par requête Firestore (pas par ID deviné)
                    const deleted = await deleteCategoryByQuery(cat);
                    const newIcons={...dynCatIcons};delete newIcons[cat];
                    const newOrder=dynCatOrder.filter(c=>c!==cat);
                    await setDoc(doc(db,"config","settings"),{catIcons:newIcons,catOrder:newOrder},{merge:true});
                    showT(`🗑️ ${deleted} articles supprimés`);
                  } catch(e) { showT("❌ Erreur: "+e.message); }
                  setAdminSaving(false);
                }} style={{background:EPJ.red,color:'#fff',border:'none',borderRadius:8,padding:'4px 8px',fontSize:11,cursor:'pointer'}}>🗑️</button>
              </div>
            ))}
            {adminEdit==='renameCat'&&<div className="epj-card" style={{marginBottom:12,border:`2px solid ${EPJ.blue}`,marginTop:10}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>✏️ Modifier la catégorie</div>
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                <input className="epj-input" placeholder="Nouveau nom" value={adminForm.nom||''} onChange={e=>setAdminForm(p=>({...p,nom:e.target.value}))} style={{flex:1,padding:'8px 10px',fontSize:13}}/>
                <div style={{width:56,height:46,borderRadius:10,border:`2px solid ${EPJ.blue}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,cursor:'pointer',background:'#f8f9fa',overflow:'hidden'}} onClick={()=>setAdminForm(p=>({...p,showEmojiPicker:!p.showEmojiPicker}))}>
                  {adminForm.icon&&(adminForm.icon.startsWith('http')||adminForm.icon.startsWith('data:'))
                    ? <img src={adminForm.icon} alt="" style={{width:'100%',height:'100%',objectFit:'cover',borderRadius:8}}/>
                    : <span>{adminForm.icon||'📦'}</span>}
                </div>
              </div>
              {adminForm.showEmojiPicker&&<div style={{background:'#f8f9fa',borderRadius:10,padding:10,marginBottom:8}}>
                <div style={{fontSize:11,fontWeight:700,color:EPJ.gray,marginBottom:6}}>CHOISIR UNE ICÔNE</div>
                <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
                  {EMOJI_QUICK.map(em=>(
                    <button key={em} onClick={()=>setAdminForm(p=>({...p,icon:em,showEmojiPicker:false}))} style={{width:38,height:38,borderRadius:8,border:adminForm.icon===em?`2px solid ${EPJ.blue}`:'2px solid transparent',background:adminForm.icon===em?'#E3F2FD':'#fff',fontSize:20,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>{em}</button>
                  ))}
                </div>
                <div style={{marginTop:10,borderTop:`1px solid #ddd`,paddingTop:10}}>
                  <div style={{fontSize:10,fontWeight:700,color:EPJ.gray,marginBottom:4}}>OU COLLER UN ÉMOJI / URL D'IMAGE</div>
                  <input className="epj-input" placeholder="Émoji ou URL https://..." value={adminForm.icon||''} onChange={e=>setAdminForm(p=>({...p,icon:e.target.value}))} style={{width:'100%',padding:'6px 8px',fontSize:14,boxSizing:'border-box'}}/>
                  <div style={{marginTop:8}}>
                    <div style={{fontSize:10,fontWeight:700,color:EPJ.gray,marginBottom:4}}>📸 OU UPLOADER UNE IMAGE</div>
                    <input type="file" accept="image/*" style={{fontSize:12}} onChange={e=>{
                      const file=e.target.files[0]; if(!file)return;
                      if(file.size>200000){showT('⚠️ Image trop lourde (max 200KB)');return;}
                      const reader=new FileReader();
                      reader.onload=ev=>setAdminForm(p=>({...p,icon:ev.target.result,showEmojiPicker:false}));
                      reader.readAsDataURL(file);
                    }}/>
                    <div style={{fontSize:9,color:EPJ.gray,marginTop:2}}>Max 200KB — JPG, PNG, SVG recommandé</div>
                  </div>
                </div>
              </div>}
              <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,cursor:'pointer',padding:'8px 10px',background:adminForm.isEquip?'#E8F5E9':'#f5f5f5',borderRadius:8,border:adminForm.isEquip?'2px solid #4CAF50':'2px solid #ddd'}}>
                <input type="checkbox" checked={adminForm.isEquip||false} onChange={e=>setAdminForm(p=>({...p,isEquip:e.target.checked}))} style={{width:18,height:18}}/>
                <div><div style={{fontSize:13,fontWeight:600}}>Équipement Salarié</div><div style={{fontSize:10,color:EPJ.gray}}>Visible dans "Commande Équipement"</div></div>
              </label>
              <div style={{display:'flex',gap:8}}>
                <button className="epj-btn" onClick={()=>{setAdminEdit(null);setAdminForm({})}} style={{flex:1,background:'#eee',color:EPJ.dark,padding:'10px'}}>Annuler</button>
                <button className="epj-btn" onClick={async()=>{
                  if(!adminForm.nom||!adminForm.oldNom)return;
                  setAdminSaving(true);
                  const toUpdate=dynCatalog.filter(p=>p.c===adminForm.oldNom);
                  for(const p of toUpdate){const docId=(p.r||'').replace(/[\/\s]/g,'_')||('__cat_'+adminForm.oldNom.replace(/\s/g,'_'));try{await setDoc(doc(db,"catalogue",docId),{...p,c:adminForm.nom},{merge:true})}catch(e){}}
                  const newIcons={...dynCatIcons};delete newIcons[adminForm.oldNom];newIcons[adminForm.nom]=adminForm.icon||'📦';
                  let newEquip=[...dynEquipCats].filter(c=>c!==adminForm.oldNom);
                  if(adminForm.isEquip) newEquip.push(adminForm.nom);
                  const newOrder=dynCatOrder.map(c=>c===adminForm.oldNom?adminForm.nom:c);
                  await setDoc(doc(db,"config","settings"),{catIcons:newIcons,equipCategories:newEquip,catOrder:newOrder},{merge:true});
                  setDynEquipCats(newEquip);setDynCatOrder(newOrder);
                  setAdminSaving(false);setAdminEdit(null);setAdminForm({});showT("✅ Catégorie mise à jour");
                }} disabled={adminSaving||!adminForm.nom} style={{flex:1,background:EPJ.blue,color:'#fff',padding:'10px'}}>{adminSaving?'⏳':'💾 Enregistrer'}</button>
              </div>
            </div>}
          </>) : (<>
            <button className="epj-btn" onClick={()=>setSelectedCat(null)} style={{width:'100%',background:'#eee',color:EPJ.dark,padding:'10px',fontSize:13,marginBottom:12}}>← Toutes les catégories</button>
            <button className="epj-btn" onClick={()=>{setAdminEdit('newSub');setAdminForm({nom:''})}} style={{width:'100%',background:EPJ.green,color:'#fff',padding:'12px',fontSize:14,marginBottom:12}}>+ Nouvelle sous-catégorie dans {selectedCat}</button>
            {adminEdit==='newSub'&&<div className="epj-card" style={{marginBottom:12,border:`2px solid ${EPJ.blue}`}}>
              <input className="epj-input" placeholder="Nom de la sous-catégorie" value={adminForm.nom||''} onChange={e=>setAdminForm(p=>({...p,nom:e.target.value}))} style={{marginBottom:8,padding:'8px 10px',fontSize:13}}/>
              <div style={{display:'flex',gap:8}}>
                <button className="epj-btn" onClick={()=>{setAdminEdit(null);setAdminForm({})}} style={{flex:1,background:'#eee',color:EPJ.dark,padding:'10px'}}>Annuler</button>
                <button className="epj-btn" onClick={async()=>{
                  const nom = (adminForm.nom||'').trim();
                  if(!nom) return;
                  try {
                    await setDoc(doc(db,"catalogue","__sub_"+selectedCat.replace(/[\/\s]/g,'_')+"_"+nom.replace(/[\/\s]/g,'_')),{c:selectedCat,s:nom,r:'',n:'(sous-catégorie vide)',u:'',img:'',stock:true});
                    setAdminEdit(null);setAdminForm({});showT("✅ Sous-catégorie ajoutée");
                  } catch(e) { showT("❌ Erreur: "+e.message); }
                }} disabled={adminSaving||!(adminForm.nom||'').trim()} style={{flex:1,background:EPJ.blue,color:'#fff',padding:'10px'}}>💾 Ajouter</button>
              </div>
            </div>}
            {subcats.map(sub=>(
              <div key={sub} className="epj-card" style={{marginBottom:6,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:EPJ.dark}}>{sub}</div>
                  <div style={{fontSize:11,color:EPJ.gray}}>{dynCatalog.filter(p=>p.c===selectedCat&&p.s===sub).length} articles</div>
                </div>
              </div>
            ))}
          </>)}
        </div>
        {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:'#fff',padding:'8px 20px',borderRadius:20,fontSize:13,fontWeight:600,zIndex:400}}>{toast}</div>}
      </div>
    );}

    // ─── Admin: Catalogue (articles) ───
    if(adminSection==='catalog'){
      const cats = [...new Set(dynCatalog.map(p=>p.c))].sort();
      const adminCatFilter = selectedCat;
      const adminSearch = search;
      let filtered = dynCatalog.filter(p=>p.r); // exclude placeholders
      if(adminCatFilter) filtered = filtered.filter(p=>p.c===adminCatFilter);
      if(adminSearch) { const q=adminSearch.toLowerCase(); filtered=filtered.filter(p=>(p.n||'').toLowerCase().includes(q)||(p.r||'').toLowerCase().includes(q)); }
      return(
      <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto',paddingBottom:80}}>
        <style>{css}</style>
        <Header title="📦 Articles" back={true} backView="admin" showCart={false}/>
        <div style={{padding:'8px 12px',background:'#fff',borderBottom:'1px solid #eee'}}>
          <div style={{display:'flex',gap:6,marginBottom:6}}>
            <select className="epj-input" value={adminCatFilter||''} onChange={e=>{setSelectedCat(e.target.value||null)}} style={{flex:1,fontSize:12,padding:'8px'}}><option value="">Toutes catégories</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select>
          </div>
          <input className="epj-input" placeholder="Rechercher..." value={adminSearch||''} onChange={e=>setSearch(e.target.value)} style={{fontSize:12,padding:'8px'}}/>
        </div>
        <div style={{padding:12}}>
          <div style={{display:'flex',gap:6,marginBottom:12}}>
            <button className="epj-btn" onClick={()=>{setAdminEdit('newArt');setAdminForm({c:adminCatFilter||cats[0]||'',s:'',r:'',n:'',u:'Pièce',img:'',stock:true})}} style={{flex:1,background:EPJ.green,color:'#fff',padding:'10px',fontSize:13}}>+ Ajouter</button>
            <button className="epj-btn" onClick={()=>{setBulkMode(!bulkMode);setBulkSelected([])}} style={{background:bulkMode?EPJ.orange:'#eee',color:bulkMode?'#fff':EPJ.dark,padding:'10px',fontSize:13}}>{bulkMode?'✓ Sélection':'☐ Sélection bloc'}</button>
          </div>
          {bulkMode&&bulkSelected.length>0&&<div className="epj-card" style={{marginBottom:12,border:`2px solid ${EPJ.orange}`}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:8}}>{bulkSelected.length} article(s) sélectionné(s)</div>
            <div style={{marginBottom:6}}>
              <label style={{fontSize:11,fontWeight:700,color:EPJ.gray}}>Déplacer vers catégorie :</label>
              <select className="epj-input" id="bulkCat" style={{padding:'6px',fontSize:12}}><option value="">--</option>{cats.map(c=><option key={c} value={c}>{c}</option>)}</select>
            </div>
            <div style={{marginBottom:8}}>
              <label style={{fontSize:11,fontWeight:700,color:EPJ.gray}}>Sous-catégorie :</label>
              <input className="epj-input" id="bulkSub" placeholder="Optionnel" style={{padding:'6px',fontSize:12}}/>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button className="epj-btn" onClick={()=>setBulkSelected([])} style={{flex:1,background:'#eee',color:EPJ.dark,padding:'8px',fontSize:12}}>Tout désélectionner</button>
              <button className="epj-btn" onClick={async()=>{
                const newCat=document.getElementById('bulkCat').value;
                const newSub=document.getElementById('bulkSub').value;
                if(!newCat){showT('Choisissez une catégorie');return}
                setAdminSaving(true);
                for(const ref of bulkSelected){
                  const docId=ref.replace(/[\/\s]/g,'_');
                  const updates={c:newCat};
                  if(newSub) updates.s=newSub;
                  try{await setDoc(doc(db,'catalogue',docId),updates,{merge:true})}catch(e){}
                }
                setAdminSaving(false);setBulkSelected([]);setBulkMode(false);
                showT(`✅ ${bulkSelected.length} articles déplacés`);
              }} disabled={adminSaving} style={{flex:1,background:EPJ.blue,color:'#fff',padding:'8px',fontSize:12}}>{adminSaving?'⏳':'📦 Déplacer'}</button>
            </div>
          </div>}
          {adminEdit&&(adminEdit==='newArt'||adminEdit.startsWith?.('edit_'))&&<div className="epj-card" style={{marginBottom:12,border:`2px solid ${EPJ.blue}`}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>{adminEdit==='newArt'?'Nouvel article':'Modifier article'}</div>
            <div style={{marginBottom:8}}>
              <label style={{fontSize:11,fontWeight:700,color:EPJ.gray}}>CATÉGORIE</label>
              <select className="epj-input" value={adminForm.c||''} onChange={e=>setAdminForm(p=>({...p,c:e.target.value,s:''}))} style={{padding:'8px',fontSize:13}}>{cats.map(c=><option key={c}>{c}</option>)}</select>
            </div>
            <div style={{marginBottom:8}}>
              <label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:2}}>SOUS-CATÉGORIE</label>
              {(()=>{const subs=[...new Set(dynCatalog.filter(p=>p.c===adminForm.c).map(p=>p.s))].sort();return subs.length>0?(
                <div style={{display:'flex',gap:6}}>
                  <select className="epj-input" value={adminForm.s||''} onChange={e=>setAdminForm(p=>({...p,s:e.target.value}))} style={{flex:1,padding:'8px',fontSize:13}}>
                    <option value="">-- Choisir --</option>
                    {subs.map(s=><option key={s} value={s}>{s}</option>)}
                    <option value="__new__">+ Nouvelle...</option>
                  </select>
                  {adminForm.s==='__new__'&&<input className="epj-input" placeholder="Nom" value={adminForm._newSub||''} onChange={e=>setAdminForm(p=>({...p,_newSub:e.target.value,s:'__new__'}))} style={{flex:1,padding:'8px',fontSize:13}}/>}
                </div>
              ):(<input className="epj-input" value={adminForm.s||''} onChange={e=>setAdminForm(p=>({...p,s:e.target.value}))} placeholder="Nom de la sous-catégorie" style={{padding:'8px 10px',fontSize:13}}/>)})()}
            </div>
            {['r','n','u','img'].map(f=>(
              <div key={f} style={{marginBottom:8}}>
                <label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:2}}>{f==='r'?'RÉFÉRENCE':f==='n'?'DÉSIGNATION':f==='u'?'UNITÉ':'URL IMAGE'}</label>
                <input className="epj-input" value={adminForm[f]||''} onChange={e=>setAdminForm(p=>({...p,[f]:e.target.value}))} style={{padding:'8px 10px',fontSize:13}}/>
              </div>
            ))}
            {adminForm.img&&<div style={{marginBottom:8}}><img src={adminForm.img} alt="" style={{width:60,height:60,objectFit:'cover',borderRadius:8}} onError={e=>{e.target.style.display='none'}}/></div>}
            <label style={{display:"flex",alignItems:"center",gap:8,marginBottom:12,cursor:"pointer",padding:"8px 10px",background:adminForm.stock!==false?"#E8F5E9":"#FFF3E0",borderRadius:8,border:adminForm.stock!==false?"2px solid #4CAF50":"2px solid #FF9800"}}>
              <input type="checkbox" checked={adminForm.stock!==false} onChange={e=>setAdminForm(p=>({...p,stock:e.target.checked}))} style={{width:18,height:18}}/>
              <div><div style={{fontSize:13,fontWeight:600}}>{adminForm.stock!==false?"📦 En stock":"⚠️ Hors stock"}</div><div style={{fontSize:10,color:EPJ.gray}}>Article tenu en stock au dépôt</div></div>
            </label>
            <div style={{display:'flex',gap:8}}>
              <button className="epj-btn" onClick={()=>{setAdminEdit(null);setAdminForm({})}} style={{flex:1,background:'#eee',color:EPJ.dark,padding:'10px'}}>Annuler</button>
              <button className="epj-btn" onClick={async()=>{
                const newDocId = adminForm.r ? adminForm.r.replace(/[\/\s]/g,'_') : 'art_'+Date.now();
                const origDocId = adminForm._origRef ? adminForm._origRef.replace(/[\/\s]/g,'_') : null;
                const subCat = adminForm.s==='__new__' ? (adminForm._newSub||'Général') : (adminForm.s||'Général');
                const saveData = {c:adminForm.c,s:subCat,r:adminForm.r,n:adminForm.n,u:adminForm.u||'Pièce',img:adminForm.img||'',stock:adminForm.stock!==false};
                // If ref changed, delete old doc first
                if(origDocId && origDocId !== newDocId) {
                  try { await deleteDoc(doc(db,'catalogue',origDocId)); } catch(e){}
                }
                adminSave('catalogue',newDocId,saveData);
              }} disabled={adminSaving||!adminForm.r||!adminForm.n} style={{flex:1,background:EPJ.blue,color:'#fff',padding:'10px'}}>{adminSaving?'⏳':'💾 Sauvegarder'}</button>
            </div>
          </div>}
          <div style={{fontSize:12,color:EPJ.gray,marginBottom:8}}>{filtered.length} article(s)</div>
          {filtered.slice(0,50).map(p=>(
            <div key={p.r} className="epj-card" style={{marginBottom:4,display:'flex',alignItems:'center',gap:8,padding:'8px 12px',background:bulkSelected.includes(p.r)?'#E3F2FD':'#fff'}}>
              {bulkMode&&<input type="checkbox" checked={bulkSelected.includes(p.r)} onChange={e=>{if(e.target.checked)setBulkSelected(s=>[...s,p.r]);else setBulkSelected(s=>s.filter(r=>r!==p.r))}} style={{width:18,height:18,flexShrink:0}}/>}
              {p.img?<img src={p.img} alt="" style={{width:36,height:36,borderRadius:6,objectFit:'cover'}}/>:<CatIcon cat={p.c} size={36}/>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:EPJ.dark,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.n}</div>
                <div style={{fontSize:10,color:EPJ.gray,fontFamily:'monospace'}}>{p.r} • {p.s} {p.stock===false?'• ⚠️':''}</div>
              </div>
              {!bulkMode&&<button onClick={()=>{setAdminEdit('edit_'+p.r);setAdminForm({...p,_origRef:p.r})}} style={{background:EPJ.blue,color:'#fff',border:'none',borderRadius:8,padding:'4px 8px',fontSize:10,cursor:'pointer'}}>✏️</button>}
              {!bulkMode&&<button onClick={()=>{const docId=p.r.replace(/[\/\s]/g,'_');adminDelete('catalogue',docId)}} style={{background:EPJ.red,color:'#fff',border:'none',borderRadius:8,padding:'4px 8px',fontSize:10,cursor:'pointer'}}>🗑️</button>}
            </div>
          ))}
          {filtered.length>50&&<div style={{textAlign:'center',padding:10,fontSize:12,color:EPJ.gray}}>... et {filtered.length-50} autres articles (utilisez la recherche)</div>}
        </div>
        {toast&&<div style={{position:'fixed',bottom:30,left:'50%',transform:'translateX(-50%)',background:EPJ.dark,color:'#fff',padding:'8px 20px',borderRadius:20,fontSize:13,fontWeight:600,zIndex:400}}>{toast}</div>}
      </div>
    );}
  }

  return null;
}

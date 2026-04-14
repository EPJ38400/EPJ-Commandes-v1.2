import { useState, useMemo, useEffect } from "react";
import { db } from "./firebase";
import { collection, addDoc, updateDoc, doc, onSnapshot, query, getDoc, setDoc, deleteDoc } from "firebase/firestore";
import { initEPJData, uploadCatalog } from "./initFirestore";

/* ═══════════════════════════════════════════════════
   EPJ — Application de Commande de Matériel V1.3
   Électricité Générale — Firebase Edition
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


// ─── CATALOG (265 articles from pressbook) ───
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
  {c:"Béton + Descente",s:"Blm",r:"BLI 755108",n:"AIMANT RESINE Ø800N JAUNE",u:"Pièce",stock:false},
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
  {c:"Équip. Sous-Sol",s:"B.A.E.S.",r:"ZEM AGV-60-NM",n:"Grille de protection IK 10 pour bloc XENA FLAT",u:"Pièce",stock:false},
  {c:"Équip. Sous-Sol",s:"B.A.E.S.",r:"ZEM LXF-3045EX",n:"Bloc évacuation SATI 45 lms IP42/IK04 - 0,85w",u:"Pièce",stock:false},
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
  {c:"Plexo",s:"Va Et Vient",r:"SCH MUR35026",n:"BP PLEXO EN SAILLIE GRIS",u:"Pièce",stock:false},
  {c:"Plexo",s:"Va Et Vient",r:"SCH MUR39026",n:"BP PLEXO EN SAILLIE BLANC",u:"Pièce",stock:false},
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
  {c:"Placo",s:"Simple 32A",r:"CAP 736869",n:"CAPRICLIPS SIMPLE 32 AMPERES",u:"Pièce",stock:false},
  {c:"Placo",s:"Simple 32A",r:"BLI 690860",n:"Boîtier 32 Amp. No Air D.86 prof.40",u:"Pièce",stock:false},
  {c:"Placo",s:"Double",r:"BLI 620719",n:"BOITE  DOUBLE ENTRAXE 71mm",u:"Pièce",stock:false},
  {c:"Placo",s:"Double",r:"BLI 682710",n:"BOITE NO AIR DOUBLE ENTRAXE 71mm",u:"Pièce",stock:false},
  {c:"Placo",s:"Triple",r:"EUR 52046",n:"BOITE  TRIPLE ENTRAXE 71mm",u:"Pièce",stock:false},
  {c:"Placo",s:"Triple",r:"BLI 683710",n:"BOITE NO AIR TRIPLE ENTRAXE 71mm",u:"Pièce",stock:false},
  {c:"Placo",s:"Quadruple",r:"EUR 52048",n:"BOITE  QUADRUPLE ENTRAXE 71mm",u:"Pièce",stock:false},
  {c:"Placo",s:"Quadruple",r:"BLI 684710",n:"BOITE NO AIR QUADRUPLE ENTRAXE 71mm",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"BLI 685500",n:"BOITE MICRO MODULE NO AIR",u:"Pièce",stock:false},
  {c:"Divers",s:"Général",r:"BLI 759020",n:"ANNEAU POUR APPAREILLAGE",u:"Pièce",stock:false},
  {c:"Divers",s:"Kit Dcl + Kit Dcl Bbc",r:"BLI 610559",n:"POINT DE CENTRE BLUE BOX DCL HT55 ØD67",u:"Pièce",stock:false},
  {c:"Divers",s:"Kit Dcl + Kit Dcl Bbc",r:"CAP 735049",n:"CAPRICLIPS POINT DE CENTRE DCL HT40 ØD86",u:"Pièce",stock:false},
  {c:"Divers",s:"Kit Dcl + Kit Dcl Bbc",r:"BLI 670510",n:"NO AIR BBC POINT DE CENTRE DCL HT55 ØD67",u:"Pièce",stock:false},
  {c:"Divers",s:"Kit Dcl + Kit Dcl Bbc",r:"EUR 53063",n:"Eur Ohm - Point de centre air'metic d85",u:"Pièce",stock:false},
  {c:"Divers",s:"Kit Dcl + Kit Dcl Bbc",r:"BLI 670860",n:"Point Centre GV No Air DCL D.86 Prof.40",u:"Pièce",stock:false},
  {c:"Divers",s:"Bac D'Encastrement + Porte",r:"AOE PATT0",n:"Pettite trappe affleurante pour BTT26",u:"Pièce",stock:false},
  {c:"Divers",s:"Bac D'Encastrement + Porte",r:"AOE PATT2",n:"Porte affleurante pour BTT26",u:"Pièce",stock:false},
  {c:"Divers",s:"Bac D'Encastrement + Porte",r:"AOE GTA203",n:"Partie démontable haute pour PATT 766*518mm",u:"Pièce",stock:false},
  {c:"Divers",s:"Bac D'Encastrement + Porte",r:"AOE BTT20CBL",n:"Bac 2 travées PC+4R+ VA avec tableau com intégré 200 mm",u:"Pièce",stock:false},
  {c:"Divers",s:"Bac D'Encastrement + Porte",r:"AOE BTT20CBLX3",n:"Lot de 3 Bac 2 travées PC+4R+ VA avec tableau com intégré 200 mm",u:"Pièce",stock:false},
  {c:"Divers",s:"Gtl",r:"GTL235ES01",n:"1 FOND 235 + 1 COUVERCLE + SANS SUPPORT + SANS EMBALLAGE",u:"Pièce",stock:false},
  {c:"Divers",s:"Gtl",r:"GTL235ED02",n:"1 FOND 235 + 2 COUVERCLES + 1 CLOISON + 6 SUPPORTS, CONDITIONNEE PAR 4",u:"Pièce",stock:false},
  {c:"Divers",s:"Gtl",r:"ELGTL00005",n:"CORNET EPANOUISSEUR POUR 1 GTL EXTRUDEE DIM 400X160",u:"Pièce",stock:false},
  {c:"Divers",s:"Gtl",r:"ELGTL00007",n:"CORNET EPANOUISSEUR POUR 1 GTL EXTRUDEE DIM 540X170",u:"Pièce",stock:false},
  {c:"Divers",s:"Gtl",r:"ELGTL00006",n:"CORNET EPANOUISSEUR POUR 1 GTL EXTRUDEE DIM 540X170",u:"Pièce",stock:false},
  {c:"Divers",s:"Bac D'Encastrement + Porte",r:"LPE 98129",n:"MORTIER ADHESIF KRAFT 25KG MAP",u:"Pièce",stock:true},
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
  {c:"Câble Colonne",s:"Tronçon Alu",r:"FIL AR2V1X35TGL",n:"AR2V ALU 1X35 TGL",u:"Pièce",stock:false},
  {c:"Câble Colonne",s:"Tronçon Alu",r:"FIL AR2V1X50TGL",n:"AR2V ALU 1X50TGL",u:"Pièce",stock:true},
  {c:"Câble Colonne",s:"Tronçon Alu",r:"FIL AR2V1X70TGL",n:"AR2V ALU 1X70 TGL",u:"Pièce",stock:true},
  {c:"Câble Colonne",s:"Tronçon Alu",r:"FIL AR2V1X95TGL",n:"AR2V ALU 1X95 TGL",u:"Pièce",stock:true},
  {c:"Câble Colonne",s:"Tronçon Alu",r:"FIL AR2V1X120TGL",n:"AR2V ALU 1X120 TGL",u:"Pièce",stock:true},
  {c:"Câble Colonne",s:"Tronçon Cuivre",r:"FIL R2V1X35TGL",n:"R2V CU 1X35 TGL",u:"Pièce",stock:false},
  {c:"Câble Colonne",s:"Tronçon Cuivre",r:"FIL R2V1X50TGL",n:"R2V CU 1X50 TGL",u:"Pièce",stock:false},
  {c:"Câble Colonne",s:"Tronçon Cuivre",r:"FIL R2V1X70TGL",n:"R2V CU 1X70 TGL",u:"Pièce",stock:false},
  {c:"Câble Colonne",s:"Tronçon Cuivre",r:"FIL R2V1X95TGL",n:"R2V CU 1X95 TGL",u:"Pièce",stock:false},
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
  {c:"Équipement Commun",s:"B.A.E.S. Commun",r:"ZEM LXF3017EX",n:"BAEH XENA FLAT SATI 5H 8LM IP42/IK04 NP NF NI-CD 1.2W",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"B.A.E.S. Commun",r:"ZEM 90091NMF",n:"PORTE ETIQUETTE ENCASTRE XENA-DIANA-PICTO NON INCLUS",u:"Pièce",stock:false},
  {c:"Équipement Commun",s:"B.A.E.S. Commun",r:"ZEM APV000OP",n:"ETIQUETTE ADHESIVE OPAQUE MILTIDIRECTION - XENA - FORMAT 390",u:"Pièce",stock:false},
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
  {c:"Équipement Logement",s:"Seche-Serviette",r:"ATL 831416",n:"SECHE-SERVIETTE DEVO-DCB18 500W",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Seche-Serviette",r:"ATL 831417",n:"SECHE-SERVIETTE DEVO-DCB18 750W",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Appareillage Special",r:"LEG 081988",n:"BOITE D'ENCASTREMENT PRISE DE SOL",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Appareillage Special",r:"LEG 089760",n:"PRISE SOL 2P+T 16A CARRÉE IB",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Appareillage Special",r:"LEG 089770",n:"PRISE SOL 2P+T 16A RONDE IB",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Divers",r:"POI MM100TC",n:"COMPTEUR ELECTRIQUE MONOPHASE 100 A AVEC TRANSFORM",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Divers",r:"LCI 031276",n:"compteur multi-mesure monophasé, sur TI 100A fourni",u:"Pièce",stock:false},
  {c:"Équipement Logement",s:"Divers",r:"SAT DIG04924",n:"COMPTEUR WIFI MONO + TORE OUVRANT 60A - DIGITAL ELECTRIC",u:"Pièce",stock:false},
  {c:"Courant Faible",s:"Équipement Tableau De Com",r:"AOE GTC113",n:"Répartiteur TV/SAT 3 sorties-1 entrée",u:"Pièce",stock:false},
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
  {c:"Lustrerie",s:"Local Technique / Sas Sous-Sol",r:"RES 830000",n:"HUBO 18W CCT 4000K 1678lm",u:"Pièce",stock:true},
  {c:"Lustrerie",s:"Local Technique / Sas Sous-Sol",r:"RES 830001",n:"HUBO 18W DET CCT 4000K 1678lm",u:"Pièce",stock:true},
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
  {c:"Lustrerie",s:"Spot Led",r:"RES  963226",n:"MIKS 412lm CCT B.LUM RD/RD NOIR REFLECTEUR NOIR",u:"Pièce",stock:false},
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
  {c:"Outillage",s:"Général",r:"VIN 266535",n:"SEAU PLAST NOIRE 11L  310183",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 265318",n:"TENAILLE RUSSE 220MM KNIPEX",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 265160",n:"PINCE BECS MI-RONDS DR 200",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 265656",n:"POCHE CLOUS 8 POCHES TOILE",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 266176",n:"MASSETTE 1.20KG LEBOR M.BOIS",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 268413",n:"BURIN DE CARROSSIER 235MM EXTRA PLAT",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 269280",n:"BROCHE MACON 16X300 MERCIER",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 265849",n:"MARTEAU ELECTR. 18MM  GRAPHITE 200GR",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 265041",n:"COUTEAU CARBONE OPINEL N°10V",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 0269467",n:"COUTEAU AVEC SIFFLET OUTDOOR",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 264440",n:"NIVEAU COMPOSIT 40CM STANLEY",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 268884",n:"MESURE  5MX32MM MAGNET FATMAX BLADE ARMOR  STANLEY",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 268885",n:"MESURE 8MX32MM MAGNET FATMAX BLADE ARMOR STANLEY",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 266680",n:"TOURNEVIS JEU DE 6 ISOLE STAN",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 267366",n:"TOURNEVIS PROTWIST PH1 VE 1000V",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 267366",n:"TOURNEVIS PROTWIST 2X75VE 1000V",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 268501",n:"TOURNEVIS PROTWIST 4X100VE 1000V",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 268462",n:"TOURNEVIS PROTWIST FENT FORGEE 6.5X150",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"LEG 031996",n:"PINCE POUR COLLIER COLSON",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"AGI 221009",n:"PINCE DENUDE 1,5 / 2,5",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"AGI 424023",n:"COUPE CABLES",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 267416",n:"CLE MIXTE 42 10  BETA France",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 267419",n:"CLE MIXTE 42 13  BETA France",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 267467",n:"CLE A PIPE DEBOUCHEE 6X6PANS 933 10X10 BETA France",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN267470",n:"CLE A PIPE DEBOUCHEE 6X6PANS 933 13X13 BETA France",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 267323",n:"CLE BTR JEU DE 8 1.5A8 MONTURE STANLEY",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 264977",n:"SCIE A METAUX URKO",u:"Pièce",stock:false},
  {c:"Outillage",s:"Général",r:"VIN 264987",n:"SCIE EGOINE 152MM PANN PLATRE",u:"Pièce",stock:false},
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
  {c:"Vêtements de travail",s:"T-Shirt",r:"TEX T-SHIRT NOIR M",n:"T-SHIRT NOIR TAILLE M",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-Shirt",r:"TEX T-SHIRT NOIR L",n:"T-SHIRT NOIR TAILLE L",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-Shirt",r:"TEX T-SHIRT NOIR XL",n:"T-SHIRT NOIR TAILLE XL",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-Shirt",r:"TEX T-SHIRT BLEU M",n:"T-SHIRT BLEU TAILLE M",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-Shirt",r:"TEX T-SHIRT BLEU L",n:"T-SHIRT BLEU TAILLE L",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-Shirt",r:"TEX T-SHIRT BLEU XL",n:"T-SHIRT BLEU TAILLE XL",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-Shirt",r:"TEX T-SHIRT ORANGE M",n:"T-SHIRT ORANGE TAILLE M",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-Shirt",r:"TEX T-SHIRT ORANGE L",n:"T-SHIRT ORANGE TAILLE L",u:"Pièce",stock:true},
  {c:"Vêtements de travail",s:"T-Shirt",r:"TEX T-SHIRT ORANGE XL",n:"T-SHIRT ORANGE TAILLE XL",u:"Pièce",stock:true},
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
  {c:"EPI",s:"Général",r:"VIN 360351",n:"CASQUE CHANTIER + LUNETTE KARA   BLANC",u:"Pièce",stock:false},
  {c:"EPI",s:"Général",r:"VIN 360471",n:"GARNITURE SANI CONTOURE CASQUE KARA",u:"Pièce",stock:true},
  {c:"EPI",s:"Général",r:"VIN 361660",n:"GANT CHAUD NOIR SNOWFLEX T9/  T10/T11",u:"Pièce",stock:true},
  {c:"EPI",s:"Général",r:"VIN 360027",n:"LUNETTE A BRANCHE VISILUX",u:"Pièce",stock:false},
  {c:"EPI",s:"Général",r:"VIN 360332",n:"CASQUE ANTIBRUIT ARCEAU",u:"Pièce",stock:true},
  {c:"EPI",s:"Général",r:"VIN 360239",n:"MASQUE PAPIER FFP2 AV VALVE",u:"Pièce",stock:true},
  {c:"Divers",s:"Divers",r:"BIZ 700231",n:"GEL LUBRIFIANT POUR CABLES ET FILS BIZ'LUB",u:"Pièce",stock:false},
  {c:"Divers",s:"Divers",r:"CAP 599200",n:"CAPRIGEL GTI 1L POUR TOUS TYPES DE CABLES",u:"Pièce",stock:false},
  {c:"Divers",s:"Divers",r:"AGI 398443",n:"Aiguille en nylon de 25 m",u:"Pièce",stock:false},
  {c:"Divers",s:"Divers",r:"AGI 398445",n:"Aiguille en nylon de 30 m",u:"Pièce",stock:false},
  {c:"Divers",s:"Divers",r:"AGI 398425",n:"Tête de guidage flexible M4",u:"Pièce",stock:false},
  {c:"Divers",s:"Divers",r:"AGI 398429",n:"Oeillet de tirage M4",u:"Pièce",stock:false},
  {c:"Divers",s:"Divers",r:"AGI 398431",n:"Chaussette de tirage pourcâbles de ø 4 à 6 mm M4",u:"Pièce",stock:false},
  {c:"Divers",s:"Divers",r:"AGI 398419",n:"Tête de guidage flexible à sertir",u:"Pièce",stock:false},
  {c:"Divers",s:"Divers",r:"AGI 398421",n:"Oeillet de tirage à sertir",u:"Pièce",stock:false},
  {c:"Divers",s:"Divers",r:"AGI 398607",n:"Pince à sertir",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"Câbles réseaux",r:"ACO R7295AST",n:"CABLE 4P CAT6A F/FTP LSOH DCA",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"Câbles réseaux",r:"ACO R8596AT5",n:"2X4P F/FTP CAT.6A LSOH- CCA-T500",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"Interphone",r:"FIL SYT15PAWG20GRTGL",n:"SYT1 5 paires AWG20 Gris TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Interphone",r:"FIL SYT12PAWG20GRTGL",n:"SYT1 2 paires AWG20 Gris TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Incendie",r:"FIL SYT11PAWG20RGAEGTGL",n:"SYT1 1 paire AWG20 Rouge AE Gris TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Incendie",r:"FIL SYT11PAWG20RGSETGL",n:"SYT1 1 paire AWG20 Rouge SE TGL",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Incendie",r:"FIL CR1C1NA2X1,5RONDTGL",n:"CR1-C1 2x1,5 Rond TGL Sécurité incendie",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"Câbles coaxiaux (antenne, vidéo)",r:"FIL 17VATCC100B",n:"Câble coaxial 17 VATC C100M",u:"ML",stock:false},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU1,5VJC100",n:"Fil H07VU 1,5 Vert/Jaune C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU1,5RGC100",n:"Fil H07VU 1,5 Rouge C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU1,5BEC100",n:"Fil H07VU 1,5 Bleu C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU1,5GRC100",n:"Fil H07VU 1,5 Gris C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU1,5IVC100",n:"Fil H07VU 1,5 Ivoire C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU1,5NRC100",n:"Fil H07VU 1,5 Noir C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU1,5ORC100",n:"Fil H07VU 1,5 Orange C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU1,5MNC100",n:"Fil H07VU 1,5 Marron C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU1,5VIC100",n:"Fil H07VU 1,5 Violet C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU2,5VJC100",n:"Fil H07VU 2,5 Vert/Jaune C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU2,5RGC100",n:"Fil H07VU 2,5 Rouge C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU2,5BEC100",n:"Fil H07VU 2,5 Bleu C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU2,5GRC100",n:"Fil H07VU 2,5 Gris C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU2,5IVC100",n:"Fil H07VU 2,5 Ivoire C100M",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU2,5NRC100",n:"Fil H07VU 2,5 Noir C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU2,5ORC100",n:"Fil H07VU 2,5 Orange C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU2,5MNC100",n:"Fil H07VU 2,5 Marron C100M",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU2,5VIC100",n:"Fil H07VU 2,5 Violet C100M",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VU2,5BAC100",n:"Fil H07VU 2,5 Blanc C100M",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VR6VJC100",n:"Fil H07VR 6 Vert/Jaune C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VR6RGC100",n:"Fil H07VR 6 Rouge C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VR6BEC100",n:"Fil H07VR 6 Bleu C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VR6NRC100",n:"Fil H07VR 6 Noir C100M",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"FILS",r:"FIL H07VR6MNC100",n:"Fil H07VR 6 Marron C100M",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V2X1,5C100",n:"Câble U1000 R2V CU 2X1,5 C100M",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V3G1,5C100",n:"Câble U1000 R2V CU 3G1,5 C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V4G1,5C100",n:"Câble U1000 R2V CU 4G1,5 C100M",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V5G1,5C100",n:"Câble U1000 R2V CU 5G1,5 C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V3G2,5C100",n:"Câble U1000 R2V CU 3G2,5 C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V4G2,5C100",n:"Câble U1000 R2V CU 4G2,5 C100M",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V5G2,5C100",n:"Câble U1000 R2V CU 5G2,5 C100M",u:"Pièce",stock:true},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V7G2,5TGL",n:"Câble U1000 R2V CU 7G2,5 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V3G4TGL",n:"Câble U1000 R2V CU 3G4 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V4G4TGL",n:"Câble U1000 R2V CU 4G4 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V5G4TGL",n:"Câble U1000 R2V CU 5G4 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V3G6TGL",n:"Câble U1000 R2V CU 3G6 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V5G6TGL",n:"Câble U1000 R2V CU 5G6 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V3G10TGL",n:"Câble U1000 R2V CU 3G10 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V4G10TGL",n:"Câble U1000 R2V CU 4G10 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V4X10TGL",n:"Câble U1000 R2V CU 4X10 SVJ TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V5G10TGL",n:"Câble U1000 R2V CU 5G10 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V2X16TGL",n:"Câble U1000 R2V CU 2X16 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V3G16TGL",n:"Câble U1000 R2V CU 3G16 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V4G16TGL",n:"Câble U1000 R2V CU 4G16 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V4X16TGL",n:"Câble U1000 R2V CU 4X16 SVJ TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V5G16TGL",n:"Câble U1000 R2V CU 5G16 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V2X25TGL",n:"Câble U1000 R2V CU 2X25 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V4G25TGL",n:"Câble U1000 R2V CU 4G25 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V4X25TGL",n:"Câble U1000 R2V CU 4X25 SVJ TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V5G25TGL",n:"Câble U1000 R2V CU 5G25 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V2X35TGL",n:"Câble U1000 R2V CU 2X35 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V4G35TGL",n:"Câble U1000 R2V CU 4G35 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V4X35TGL",n:"Câble U1000 R2V CU 4X35 SVJ TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V5G35TGL",n:"Câble U1000 R2V CU 5G35 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V1X50TGL",n:"Câble U1000 R2V CU 1X50 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V2X50TGL",n:"Câble U1000 R2V CU 2X50 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V4G50TGL",n:"Câble U1000 R2V CU 4G50 TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V4X50TGL",n:"Câble U1000 R2V CU 4X50 SVJ TGL",u:"Pièce",stock:false},
  {c:"Fils / Câbles",s:"CABLES",r:"FIL R2V5G50TGL",n:"Câble U1000 R2V CU 5G50 TGL",u:"Pièce",stock:false}
];const CAT_ICONS = {"Béton + Descente":"🧱","Conduit + Manchon":"🔧","Équip. Sous-Sol":"🏗️","Plexo":"🔌","Placo":"📦","Colonne Montante":"⚡","Câble Colonne":"🔗","Équipement Commun":"🏢","Équipement Logement":"🏠","Courant Faible":"📡","Interphonie":"🔔","Lustrerie":"💡","Quincaillerie":"🔩","Outillage":"🛠️","Divers":"📎","Fils / Câbles":"🔌","Vêtements de travail":"👔","EPI":"🦺","Câbles":"🔌"};

const EPJ_LOGO = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAoHBwgHBgoICAgLCgoLDhgQDg0NDh0VFhEYIx8lJCIfIiEmKzcvJik0KSEiMEExNDk7Pj4+JS5ESUM8SDc9Pjv/2wBDAQoLCw4NDhwQEBw7KCIoOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozv/wAARCACnAZADASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwD2aiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKZJJ5absEnoAO5pNpK7BK4+iqzS3cY3tCjr3WNvmH59alhmjnjEkbblP6e1TGopOxTi0rklFFUdQ1nTtLXN7eRQk9FJyx+gHNaKLk7JGcpKKvJ2L1FYI8W28nzQadqU8f8AfS2OP1rS07VbTVImktnJKHDo67WQ+hFXKlOKu0Zwr0py5Yy1LlFFFZmwUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFZl7c3T3otLYhCRndWNasqUbtXvpoBpVy+uz3aXrbXkUqf3YUn8MVsLYXuMnUnB9l4pHh1GKRCLiKY5IXzEx/L6Vw4uNSvBJpx1Xb/M3w9VUp8zVy5amVrWIzjEpQbx745qlqU8OlML9pEjRmCyoTjf2BH+0P1FVr3xBJYN9mltUN46kwxrKDvP8AMVS0jS01S6GpazdR3l4OY7YH93b+wXuff+fWvSjGnOPvSt27/czkeIanaCvffsh32rXfEZxZBtJ08nHnyLmaQf7I/h+taOm+GdL0xvMjg864PLXE53yMfXJ6fhU1mfsd5JYH/VkGWD/dz8y/gf0NaFaqu5RstPJf1qDw8YyvJ8z7v+tCC7vLaxgM91OkMY/ic4rGs9W0i98RpJY3kTSSW7JIOVLkMpXr1P3q5Xxxdyz67JA7Hy4FVUXtyASf1rlHZkcOjFWU5DA4IPrXq0cAnT5m9WjwsRmj9s4KOkX89D3WiqGh3cl9odldTf6yWFWY+pxyav15ElytpnvxkpJNdQooqneavp2n/wDH3fQQkdnkAP5daRRcorAfxv4dQ4/tEN/uxuf6U3/hO/Dv/P8AH/vy/wDhQB0NFc9/wnfh3/n+P/fl/wDCj/hO/Dv/AD/H/vy/+FAHQ0Vz3/Cd+Hf+f4/9+X/wq9pfiHTNZlkjsLgytGoZgUZcA/UUAadFFFABRSZrOu/EWjWJK3GpW6MOq7wT+QoA0qK59vHPh1Tj7fn3ET/4Un/Cd+Hf+f4/9+X/AMKAOhornv8AhO/Dv/P8f+/L/wCFH/Cd+Hf+f4/9+X/woA6GisWDxf4fuGCpqkIJ/v5T+YrWhnhuEEkMqSoejIwYfmKAJKKKKACiiigAooqjqmsWOjQJPfTGJHbYp2lsnGe30oAvUVz3/Cd+Hf8An+P/AH5f/CrOneKdH1W8W0s7oyTMCwXy2HA68kUAbFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFVbq3ZpEuIQPOi6A/xDuKtUVE4KaswI4ZknTcufQg9VPoayte1lLExWkH7y+mOYk6heDy3tTtf1KDR7X7VybhzsiResh9CO4qtomlC1klvdSLPf3f3nkA+VT/COwrSMLU3Kr8vN/wDA/wCGOadWTqKnT36+S/zfT7ybQ9BGnlr28k+06jPzLM3OP9lfQVo3Nha3XMsQLDo44YfiKfasTDsb70Z2N+H/ANbFTVMp+3XNLqbRpRpLkRi3tne2qpcRXH2hLZvMCyffA7gN3yPWr1nqVveYVSUkxny3GGx6+49xVsgEEEZB61iKImtfsDxiW5hkaOEZwygchsjkAAjmufllCqlDr38v+B+Rq/4d+36/8H8yj4p8Of2xdo9kyrdhP3gb7pXtk9j2H/1qwbL4e6hPcr9vkjggB+bY25mHoPT612sJl0skXJ86JzlrgD5gf9oenvWkCCAQcg9CK9KlmFRQ9nHp33PMll9CpU9pJajIYY7eBIYlCRxqFVR2A6VFqGoW2l2Ul5dyCOKMcnufQAdzVmvMviLqr3OrppysfKtVDMPV2Gf0GPzNc256GxV1zxxqequ0ds7Wdr0CRnDsP9pv6CsGysrnU71La1jaaeU8D+ZJ9PeoK9F+GunJHp9xqTKPMmfy1Poq9fzP8qYFe0+GWYQbzUiJD1WGMED8T1/Kp/8AhWNp/wBBO4/74Wu3opDOI/4Vjaf9BO4/74Wj/hWNp/0E7j/vha7eigDiP+FY2n/QTuP++FrY8O+E4fDtxNNFdyzGZApDqBjBz2rfooAWsjxD4itPD9oJZv3kz5EUKnlz/Qe9a1eL+ItVfWNbuLpmJTcUiHogOB/j+NAD9X8T6rrLt9ouWSE9IIiVQf4/jTND8P32vXLRWiKqJ/rJX4VP8T7Vl17H4S05NN8OWkYUB5UEsh9Wbn+WB+FMRz8fwxt9g8zVJi3fbEoH607/AIVjaf8AQTuP++FruKKQzh/+FY2n/QTuP++Fo/4Vjaf9BO4/74Wu4ooA8t13wFe6VbvdWswvIEGXAXa6j1x3H0rnLO+utPmE1ncSQOO8bYz9fWvdCMjFeMeJtPXS/EN5axjbGH3oPRWGQP1xTA7Lwv47+3TJYartSdztjnXhXPoR2P6V21eB17D4Q1V9X8PQTytumjzFIfUr3/EYNIDbooooAK434l/8gW1/6+R/6C1dlXG/Ev8A5Atr/wBfI/8AQWoA81rpPAH/ACNcP/XKT+Vc3XSeAP8Aka4f+uUn8qYj1iiiikMKKKKACiiigAooooAKKKKACiiigApsjrHG0jsFVQSSewp1c542vmtdF8hDh7lth/3Ryf6D8a0pU3UmoLqY4iqqNKVR9CtoyN4i1yXWrhT9mtm2WqH19f6/U+1dWVDAggEHqDVPR7NbDSba2UY2Rjd7seSfzq7VV5qc9NlovQjC0nTp+98T1fqUXRrS6QxMFjm+UhuRu7fTI4/KrHnFf9ahT3HI/OluYUnt3jc4BH3v7p7H8KzLfU7nUE+z2fl+YnEtySCi84yo/iJx9B+lccIuM+VaJ7dvNfr951yfu36r+v8AgFy5vhGyw2yie4kGUQHgD+8x7L/kVXsonttWlSaTzZJoldnxjJBxgeg9qtW+nwWyELuZ2OXlZvnc+pP+RVSdXTWoFSQ7jC2C3NTiZcqi10a/HT9Qoptu/Z/5mmSjEoSCcciqcCmzvPsoyYZFLxD+4R1H05rnDDeHUEEauJw4OcHI56n2rqkt8TefI5dwCF4wFHsKwpVZYi0lGzT/AA6/13M07smrxvxZu/4SrUd3Xzv0wK9lrzD4iaW9trS36r+6u1AJ9HUYI/LB/Ou8o5KtrTLnxNFZKmmG+FsCdvkxkrnPPb1rFr0j4bagkulz6eW/eQSbwPVW/wDr5/OmI5v7b42/vap/36P+FL9t8bf3tU/79H/CvV6KQzyf7b42/vap/wB+j/hS/bfG397VP+/R/wAK9XooA8n+2+Nv72qf9+j/AIV03gmfX5ry6Grm8MYjXy/tCFRnPOOK7KigCG7YrZzMOojYj8q8IHKg+1e7Xv8Ax4z/APXNv5GvCV+6PoKABvun6V7tZALZQAdBGo/QV4S33T9K93tP+POH/rmv8qAJqKKKACiiigAryj4gY/4SqTH/ADxjz+terV4z4o1BNT8R3lzGd0e/YhHcKMZ/SgDKr0n4Z7v7Hu8/d+08f98ivNq9f8HaW+leHYIpVKzSkyyKexboPwGKYG7RRRSAK4z4mEf2NaDubn/2U12ded/EvUEkurTT0bLRAyyY7E8AfkD+dAHD10vw/BPiuIjtDIT+Qrmq7z4a6W4e51SRcIV8mInvzlj+gH50xHoFFFFIYUUUUAFFFFABRRRQAUUUUAFFFFABXKePLKe4sbe4iQssDNvwM4Bxz+ldXSVrRqulUU10MMTQVek6bdrnM6Z410ySzjF7K0EyqA4Kkgn1BFXU8Qm840vT7m7z0kZfKjH/AAJv6CtMWNoH3i1hD/3hGM1NVznRbvGP46f18zOnTxCXLOa+S1/O34GWumXN6Q+r3AlX/n1hysQ/3u7/AI8e1SX1lIuy6sAqXEK7QnRZF/un+laNFc1Ve1Vn/wAMddJKk7r/AIcybbxHYyqRO5tpl4eOQHINQ2Nx/aWtvcoD5USbVz/n61fvNIsr5t88I8z++pwamtLOCyi8uBNo6nnJP1NcLo15ziptcqd/N9jrdSjGLcE7v7kTUtFFd5yBVTU9NtdWsZLO7j3xv6dVPYg9iKt0UAeR654M1PR3Z442u7UciWNckD/aXt/KsnTdRutKvku7OTZKnHqCO4I9K9yrPvdB0nUCWu9PglY9WKAN+Y5oA5a1+JtuYh9s06VZB1MLAqfzxipv+FmaZ/z5Xf5J/jV+TwF4ec5Fo6eyzN/jTf8AhX/h/wD54Tf9/wBqAKX/AAszTP8Anyu/yT/Gj/hZmmf8+V3+Sf41d/4V/wCH/wDnhN/3/aj/AIV/4f8A+eE3/f8AagCl/wALM0z/AJ8rv8k/xrW0DxXaeIZ5obe3niMKhiZMYOTjsarf8K/8P/8APCb/AL/tWhpHhrTdDlklsY3VpVCtukLcA570AX73/jxn/wCubfyNeEr90fQV7te/8eM//XNv5GvCV+6PoKYAeQR7V6PD8SNNigjjNldkqoB+52H1rzg8An2r1ODwFoMlvG7QTZZAT++b0oEVv+FmaZ/z5Xf5J/jR/wALM0z/AJ8rz8k/xq7/AMK/8P8A/PCb/v8AtR/wr/w//wA8Jv8Av+1IZS/4WZpn/Pld/kn+NH/CzNM/58rz8k/xq7/wr/w//wA8Jv8Av+1H/Cv/AA//AM8Jv+/7UAcvrvj+61K2e1sYDaROMO5bLkegxwK5W2tZ7yYQ2sDzSHoka5NetQeCfD0BBGnrIR/z0dm/Qmti2tLazj8u2t44U/uxoFH6UAcX4W8CNbTR3+rhTIh3R24OQp7Fj3PtW5r/AIttPD11Fb3FvPK0qbwY9uAM47mt6sjV/DOma5cRz30cjPGmxSshXjOe1AGH/wALM0z/AJ8rz8k/xo/4WZpn/Pld/kn+NXf+Ff8Ah/8A54Tf9/2o/wCFf+H/APnhN/3/AGoAx7/4mKYSunWDCQjh52GF/Adfzrhri4nvbp5p3aWeVssTyWNeqxeA/D0ZybNpP9+Vj/WtWy0fTdO/487GCE/3kQZ/PrQB5zoHgW/1KRJr9Hs7XqdwxI49h2+pr021tYbK2jtreMRxRLtRV6AVNRQAUUUUAFFFFABRRRQAUUUUAFFFFABRRRQAUUUUAFFFFAGdfastpeRWiqpkkXcWkfaqj3P4Uy0u2UsDPBMTuc4mLMeM4AxwKs3OnxXFxHc7njniBCyIecehzwRT47eRHy91JIvdWVcH8hQBFpN+dSsFuWjEZYkbQc9DTNR1VLGeG3ChpJs4LttVR6k06DS1tFZLW4mhjZi2wbSAfbINOn02O4MMkkknnwHKTLgN/LH6UARwX7SzqhltDuPRJSW/AYptpqU+oiSS0hjESOUDSuQWI74Aq1Hbyo4ZruVwP4Sq4P5CoYtLS2aQ2s8sCyNuZFwVz7ZBxQBNm88r7kHmbum84x+XWqVrqV5d3VzbpBArWzBWJkOD9OPatGGN40IeVpTnqwAP6CoLXT4rS6uLhGctcMGYE8D6UARS6k/9oLp8ESvN5e92ZsKo/LJou7y6sbCe6miibywCFRzzzjuKlXT4l1Nr8M/mMmwjPGKkvbRL60ktpCwSQYJXr1oApDV2kntraGENPPCJTubCoCPXHNWTLeRo8kscO1FLfK5J4H0pjaTBugkR5I5rdBGkikZK4xg8YNS/ZZCGWS7lkVlKlSFHX6CgCvY39zqGnxXUMMSl87ldzxg44wKj0/UrvUVlaOCFBFIUO6Q84/CrlhZR6faJbRMzImcFuvJzTbDT4tPWVYmdhK5c7j3NAFS41hTezWURjjMS/NLK+0AnsODk1Y06cuvlebDIEUcpKXY/XIpz6bH9re7hkkglkGHKYw31BBqaGGSMkvcPLnswUY/ICgBL3/jxn/65t/I14Sv3R9BXvUsYmieNiQHUqce9ckPhrpAAH2m84/21/wDiaAPMm+6fpXu9p/x5w/8AXNf5Vyp+GukEY+03n/fa/wDxNdbGgiiWMZwoAGfagCpe6j9muoLSOLzJ5ydoLYAA7k0rXFzE6iY2iA+spBx7ZFPu9Phu5IpWLJLCcpIhwRUVxpa3kfl3NzLLH3UhRn2yBmgBl7rEdtdxWsYRnlXfvd9qKvrmksroq5V7mCQHc7ETFm9eBjpU82mQSSwzJuhlgXajx44X0weCKetrJyHupXUggqVUdfoKAK1nqFzqMJuLaCNYtxCmVyC2O+AOKI9WC3Vxa3UflyQR+aSjblZfarNhYx6daLbRMzIpJBY880w6ZA2oSXrFmeSPy2U/dIoAoJqpv4o5lkht0Dbgj3G1mx/ewP0qzNq3lfZYkRJp7kkIEf5BjvnH9Kkg0z7LEIre6mjiBO1Plbb9MjNLJpkc1zbXMssjSW2dp4G7PrgUASK90hLTrCsagklGJP8AKqFvrn2uMyx/Z4kyQommwxHrgDitaRBJG0ZzhgQcVBYWMWn2i20RZlXOC3Xk5oAoprqk3UZjQy28RkBR9yOPY9qvafdm+sIbkpsMi525ziozpdub+S8bczSx+WyH7pFJBpv2WIQ293PHEv3U+Vtv5jNAEd7q6W18lmip5jLuLyPtVR9fWpLW9aecIZLVsgnEcpZvyxTptNjmniufMdLiNdolXGSPcYwaligljfc11JIP7rKoH6CgCeiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/2Q==";
const EPJ = {dark:"#3d3d3d",blue:"#00A3E0",orange:"#F5841F",green:"#A8C536",gray:"#8C8C8C",grayLight:"#f4f5f7",white:"#fff",red:"#E53935"};
const font = "'Outfit','Segoe UI',sans-serif";
const STATUS_COLORS = {"En attente de validation":{bg:"#FFF3E0",color:"#E65100",icon:"⏳"},"Validée":{bg:"#E8F5E9",color:"#2E7D32",icon:"✅"},"Envoyée aux achats":{bg:"#E3F2FD",color:"#1565C0",icon:"📨"},"Refusée":{bg:"#FFEBEE",color:"#C62828",icon:"❌"}};

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

// ═══ MAIN APP ═══
export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login");
  const [loginId, setLoginId] = useState("");
  const [loginPwd, setLoginPwd] = useState("");
  const [loginError, setLoginError] = useState("");
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
  const [dynEmailAchats, setDynEmailAchats] = useState(EMAIL_ACHATS);

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
      }
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
    return allCategories.filter(c => !dynEquipCats.includes(c));
  }, [orderType, allCategories, dynEquipCats]);

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

  const doLogin = () => {
    const u = dynUsers.find(x=>x.id===loginId && x.pwd===loginPwd);
    if(u){setUser(u);setView("home");setLoginError("")} else setLoginError("Identifiant ou mot de passe incorrect");
  };
  const logout = () => {setUser(null);setView("login");setLoginId("");setLoginPwd("");setCart({});setOrderType("")};
  const numCmd = () => `CMD-${new Date().getFullYear()}-${String(cmdCounter).padStart(4,'0')}`;
  const clearOrder = () => {setCart({});setOrderType("");setChantier("");setNewChantier("");setShowNewChantier(false);setTargetSalarie("");setUrgent(false);setDateReception("");setRemarques("");setExtraEmail("");setSelectedCat(null);setSearch("");setSending(false)};

  // ─── Générer PDF (ouvre dans un nouvel onglet pour téléchargement/impression) ───
  const generateAndOpenPdf = (order) => {
    const ch = order.chantierObj || {num:order.chantierNum||order.numAffaire, nom:order.chantierNom||order.chantier, adresse:order.chantierAdresse||'', conducteur:order.chantierConducteur||''};
    const items = order.items || [];
    const byFourn = {};
    items.forEach(it => { const c = (it.r||'').split(' ')[0].substring(0,3).toUpperCase(); if(!byFourn[c]) byFourn[c]=[]; byFourn[c].push(it); });
    const totalQty = items.reduce((s,i)=>s+(i.qty||0),0);
    
    let rows = '';
    Object.entries(byFourn).sort(([a],[b])=>a.localeCompare(b)).forEach(([code,fitems])=>{
      rows += `<tr><td colspan="4" style="background:#00A3E0;color:#fff;padding:6px 12px;font-weight:700;font-size:12px">▸ ${code} — ${fitems.length} réf.</td></tr>`;
      fitems.forEach(it => {
        rows += `<tr><td style="padding:5px 8px;border-bottom:1px solid #eee;font-family:monospace;color:#00A3E0;font-weight:600;font-size:10px">${it.r||''}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;font-size:11px">${it.n||''}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center;font-weight:900;font-size:13px">${it.qty||0}</td><td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center;color:#8C8C8C;font-size:10px">${it.u||'Pièce'}</td></tr>`;
      });
    });

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${order.num} — EPJ</title>
    <style>@media print{body{margin:0}button{display:none!important}}body{font-family:Arial,sans-serif;color:#3d3d3d;max-width:700px;margin:20px auto;padding:20px}table{width:100%;border-collapse:collapse}</style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:12px;border-bottom:3px solid #00A3E0">
      <div style="font-size:24px;font-weight:900;color:#3d3d3d">EPJ <span style="font-size:10px;color:#8C8C8C;letter-spacing:2px">ÉLECTRICITÉ GÉNÉRALE</span></div>
      <div style="text-align:right"><div style="font-size:20px;font-weight:900;color:#00A3E0">${order.num}</div><div style="font-size:11px;color:#8C8C8C">${order.date}</div></div>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,#00A3E0,#A8C536,#F5841F);margin:0 0 15px"></div>
    ${order.urgent?'<div style="background:#E53935;color:#fff;padding:8px 16px;font-weight:900;text-align:center;border-radius:4px;margin-bottom:12px">⚠️ COMMANDE URGENTE</div>':''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:15px">
      <div style="background:#f8f9fa;border-radius:6px;padding:10px 12px;border-left:3px solid #00A3E0"><div style="font-size:9px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Demandeur</div><div style="font-size:13px;font-weight:700">${order.user}</div><div style="font-size:9px;color:#8C8C8C">${order.fonction||''}</div></div>
      ${order.type==='chantier'
        ?`<div style="background:#f8f9fa;border-radius:6px;padding:10px 12px;border-left:3px solid #A8C536"><div style="font-size:9px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Chantier — N°${ch?.num||''}</div><div style="font-size:13px;font-weight:700">${order.chantier||''}</div><div style="font-size:9px;color:#8C8C8C">${ch?.adresse||''}</div></div>`
        :`<div style="background:#f8f9fa;border-radius:6px;padding:10px 12px;border-left:3px solid #A8C536"><div style="font-size:9px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Destinataire</div><div style="font-size:13px;font-weight:700">${order.salarie||''}</div></div>`}
      <div style="background:#f8f9fa;border-radius:6px;padding:10px 12px;border-left:3px solid #00A3E0"><div style="font-size:9px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Livraison</div><div style="font-size:13px;font-weight:700">${order.livraison||'—'}</div></div>
      <div style="background:#f8f9fa;border-radius:6px;padding:10px 12px;border-left:3px solid #00A3E0"><div style="font-size:9px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Date réception</div><div style="font-size:13px;font-weight:700">${order.dateReception||'Non précisée'}</div></div>
    </div>
    ${order.remarques?`<div style="background:#FFF8E1;border:1px solid #FFE082;border-radius:4px;padding:8px 12px;margin-bottom:12px;font-size:11px"><strong>📝 Remarques :</strong> ${order.remarques}</div>`:''}
    <table><thead><tr><th style="background:#f0f1f3;padding:5px 8px;text-align:left;font-size:9px;text-transform:uppercase;color:#8C8C8C;border-bottom:1px solid #ddd">Référence</th><th style="background:#f0f1f3;padding:5px 8px;text-align:left;font-size:9px;text-transform:uppercase;color:#8C8C8C;border-bottom:1px solid #ddd">Désignation</th><th style="background:#f0f1f3;padding:5px 8px;text-align:center;font-size:9px;text-transform:uppercase;color:#8C8C8C;border-bottom:1px solid #ddd">Qté</th><th style="background:#f0f1f3;padding:5px 8px;text-align:center;font-size:9px;text-transform:uppercase;color:#8C8C8C;border-bottom:1px solid #ddd">Unité</th></tr></thead><tbody>${rows}</tbody></table>
    <div style="background:#3d3d3d;color:#fff;padding:8px 14px;border-radius:4px;display:flex;justify-content:space-between;font-weight:700;font-size:12px;margin-top:8px"><span>Total</span><span>${totalQty} articles — ${items.length} références</span></div>
    <div style="margin-top:20px;padding-top:10px;border-top:2px solid #eee;display:flex;justify-content:space-between;font-size:9px;color:#8C8C8C"><div>EPJ — Électricité Générale<br/>Commande générée le ${order.date}</div><div style="text-align:right">Document interne — ${order.num}<br/>Statut : ${order.statut}</div></div>
    <div style="margin-top:30px;text-align:center"><button onclick="window.print()" style="background:#00A3E0;color:#fff;border:none;padding:12px 30px;border-radius:8px;font-size:14px;font-weight:700;cursor:pointer">🖨️ Imprimer / Enregistrer en PDF</button></div>
    </body></html>`;

    const w = window.open('', '_blank');
    if(w) { w.document.write(html); w.document.close(); }
    else { showT("⚠️ Autorisez les popups pour télécharger le PDF"); }
  };

  const generateReceptionSheet = (order) => {
    const items = order.items||[];
    const rows = items.map(it=>`<tr><td style="padding:8px;border:1px solid #ddd;font-size:12px">${it.r}</td><td style="padding:8px;border:1px solid #ddd;font-size:12px">${it.n}</td><td style="padding:8px;border:1px solid #ddd;text-align:center;font-weight:700;font-size:14px">${it.qty}</td><td style="padding:8px;border:1px solid #ddd;text-align:center;font-size:12px">${it.u||'Pièce'}</td><td style="padding:8px;border:1px solid #ddd;text-align:center;width:50px"><input type="checkbox" style="width:20px;height:20px"></td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Réception ${order.num}</title>
    <style>@media print{.no-print{display:none !important}canvas{border:1px solid #000 !important}} body{font-family:Arial,sans-serif;margin:0;padding:15px;color:#3d3d3d}</style></head><body>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
      <div><div style="font-size:22px;font-weight:900;color:#3d3d3d">EPJ</div><div style="font-size:9px;color:#8C8C8C">Électricité Générale</div></div>
      <div style="text-align:right"><div style="font-size:16px;font-weight:800;color:#00A3E0">FEUILLE DE RÉCEPTION</div><div style="font-size:11px;color:#8C8C8C">${order.num} — ${order.date}</div></div>
    </div>
    <div style="height:4px;background:linear-gradient(90deg,#00A3E0,#A8C536,#F5841F);margin-bottom:15px"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px">
      <div style="background:#f8f9fa;border-radius:6px;padding:10px;border-left:3px solid #00A3E0"><div style="font-size:9px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Bénéficiaire</div><div style="font-size:14px;font-weight:700">${order.salarie||order.user}</div></div>
      <div style="background:#f8f9fa;border-radius:6px;padding:10px;border-left:3px solid #A8C536"><div style="font-size:9px;text-transform:uppercase;color:#8C8C8C;font-weight:700">Date de remise</div><div style="font-size:14px;font-weight:700">${new Date().toLocaleDateString('fr-FR')}</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr><th style="background:#f0f1f3;padding:6px;text-align:left;font-size:9px;text-transform:uppercase;color:#8C8C8C;border:1px solid #ddd">Réf.</th><th style="background:#f0f1f3;padding:6px;text-align:left;font-size:9px;text-transform:uppercase;color:#8C8C8C;border:1px solid #ddd">Désignation</th><th style="background:#f0f1f3;padding:6px;text-align:center;font-size:9px;text-transform:uppercase;color:#8C8C8C;border:1px solid #ddd">Qté</th><th style="background:#f0f1f3;padding:6px;text-align:center;font-size:9px;text-transform:uppercase;color:#8C8C8C;border:1px solid #ddd">Unité</th><th style="background:#f0f1f3;padding:6px;text-align:center;font-size:9px;text-transform:uppercase;color:#8C8C8C;border:1px solid #ddd">Reçu</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div style="background:#f8f9fa;border-radius:10px;padding:16px;margin-bottom:15px">
      <div style="font-size:12px;font-weight:700;margin-bottom:8px">📝 Observations :</div>
      <div style="min-height:60px;border:1px dashed #ccc;border-radius:6px;padding:8px" contenteditable="true"></div>
    </div>
    <div style="background:#fff;border:2px solid #3d3d3d;border-radius:10px;padding:16px;margin-bottom:15px">
      <div style="font-size:12px;font-weight:700;margin-bottom:4px">✍️ Signature du bénéficiaire : ${order.salarie||order.user}</div>
      <div style="font-size:10px;color:#8C8C8C;margin-bottom:8px">Signez ci-dessous avec le doigt ou la souris</div>
      <canvas id="signCanvas" width="460" height="150" style="border:1px solid #ccc;border-radius:6px;width:100%;touch-action:none;cursor:crosshair"></canvas>
      <div style="display:flex;gap:8px;margin-top:8px" class="no-print">
        <button onclick="clearSign()" style="flex:1;padding:8px;border:1px solid #ddd;border-radius:6px;background:#fff;cursor:pointer;font-size:12px">Effacer</button>
      </div>
    </div>
    <div style="text-align:center;margin-top:20px" class="no-print">
      <button onclick="window.print()" style="background:#00A3E0;color:#fff;border:none;padding:14px 40px;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer">🖨️ Imprimer / Enregistrer en PDF</button>
    </div>
    <div style="margin-top:15px;font-size:9px;color:#8C8C8C;text-align:center">EPJ — Électricité Générale • Feuille de réception ${order.num} • ${order.date}</div>
    <script>
    const c=document.getElementById('signCanvas'),ctx=c.getContext('2d');
    let drawing=false,lastX=0,lastY=0;
    function getPos(e){const r=c.getBoundingClientRect();const t=e.touches?e.touches[0]:e;return[(t.clientX-r.left)*(c.width/r.width),(t.clientY-r.top)*(c.height/r.height)]}
    c.addEventListener('mousedown',e=>{drawing=true;[lastX,lastY]=getPos(e)});
    c.addEventListener('mousemove',e=>{if(!drawing)return;const[x,y]=getPos(e);ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(x,y);ctx.strokeStyle='#1a1a1a';ctx.lineWidth=2;ctx.lineCap='round';ctx.stroke();lastX=x;lastY=y});
    c.addEventListener('mouseup',()=>drawing=false);
    c.addEventListener('mouseleave',()=>drawing=false);
    c.addEventListener('touchstart',e=>{e.preventDefault();drawing=true;[lastX,lastY]=getPos(e)},{passive:false});
    c.addEventListener('touchmove',e=>{e.preventDefault();if(!drawing)return;const[x,y]=getPos(e);ctx.beginPath();ctx.moveTo(lastX,lastY);ctx.lineTo(x,y);ctx.strokeStyle='#1a1a1a';ctx.lineWidth=2;ctx.lineCap='round';ctx.stroke();lastX=x;lastY=y},{passive:false});
    c.addEventListener('touchend',()=>drawing=false);
    function clearSign(){ctx.clearRect(0,0,c.width,c.height)}
    </script></body></html>`;
    const w = window.open('', '_blank');
    if(w) { w.document.write(html); w.document.close(); }
    else { showT("⚠️ Autorisez les popups"); }
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
      // Générer le PDF
      generateAndOpenPdf(validatedOrder);
      // Ouvrir le mail
      const mailDest = order.extraEmail ? `${dynEmailAchats},${order.extraEmail}` : dynEmailAchats;
      const mailSubj = `${order.urgent?'⚠️ URGENT — ':''}Commande ${order.num} — ${order.chantier||order.salarie}`;
      const mailItems = (order.items||[]).map(it=>`  • ${it.r} — ${it.n} — Qté: ${it.qty}`).join('\n');
      const mailBody = `Bonjour,\n\nCommande ${order.num} validée.\n\n${mailItems}\n\nTotal : ${(order.items||[]).reduce((s,i)=>s+(i.qty||0),0)} articles\n\nCordialement,\n${user.prenom} ${user.nom}\nEPJ — Électricité Générale`;
      setTimeout(()=>{window.location.href=`mailto:${mailDest}?subject=${encodeURIComponent(mailSubj)}&body=${encodeURIComponent(mailBody)}`},800);
      showT("✅ Commande validée — PDF + mail générés");
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

  const Thumb = ({cat, imageUrl, size=36}) => {
    if (imageUrl) {
      return <img src={imageUrl} alt="" style={{width:size,height:size,borderRadius:8,objectFit:'cover',flexShrink:0,background:EPJ.grayLight}} onError={e=>{e.target.style.display='none';e.target.nextSibling.style.display='flex'}}/>;
    }
    const icon = dynCatIcons[cat] || '📦';
    return <div style={{width:size,height:size,borderRadius:8,background:`${EPJ.blue}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:Math.round(size*0.5),flexShrink:0,border:`1px solid ${EPJ.blue}22`}}>{icon}</div>;
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

  // ═══ LOGIN ═══
  if(view==="login") return (
    <div style={{fontFamily:font,background:`linear-gradient(135deg,${EPJ.dark} 0%,#2a2a2a 100%)`,minHeight:'100vh',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:20}}>
      <style>{css}</style>
      <div style={{background:'#fff',borderRadius:16,padding:'16px 24px',marginBottom:30,display:'inline-block'}}><img src={EPJ_LOGO} alt="EPJ" style={{height:60,objectFit:'contain',display:'block'}}/></div>
      <div style={{width:'100%',maxWidth:360}}>
        <input className="epj-input" placeholder="Identifiant" value={loginId} onChange={e=>setLoginId(e.target.value)} style={{marginBottom:10,background:'rgba(255,255,255,.08)',border:'2px solid rgba(255,255,255,.1)',color:'#fff'}} onKeyDown={e=>e.key==='Enter'&&doLogin()}/>
        <input className="epj-input" placeholder="Mot de passe" type="password" value={loginPwd} onChange={e=>setLoginPwd(e.target.value)} style={{marginBottom:16,background:'rgba(255,255,255,.08)',border:'2px solid rgba(255,255,255,.1)',color:'#fff'}} onKeyDown={e=>e.key==='Enter'&&doLogin()}/>
        {loginError&&<div style={{color:EPJ.orange,fontSize:13,marginBottom:10,textAlign:'center'}}>{loginError}</div>}
        <button className="epj-btn" onClick={doLogin} style={{width:'100%',background:`linear-gradient(135deg,${EPJ.blue},${EPJ.green})`,color:'#fff',fontSize:16}}>Se connecter</button>
      </div>
      <div style={{marginTop:20,fontSize:11,color:'rgba(255,255,255,.3)'}}>v1.3 — EPJ Commandes {fbLoading?'⏳':'🟢'}</div>
    </div>
  );

  // ═══ HOME ═══
  if(view==="home") return (
    <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto'}}>
      <style>{css}</style>
      <div style={{background:EPJ.dark,color:'#fff',padding:'20px 16px',borderRadius:'0 0 24px 24px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:11,color:'rgba(255,255,255,.5)',textTransform:'uppercase',letterSpacing:1}}>Bonjour</div>
            <div style={{fontSize:20,fontWeight:700}}>{user.prenom} {user.nom}</div>
            <div style={{fontSize:12,color:EPJ.blue,fontWeight:600}}>{user.fonction}</div>
          </div>
          <button onClick={logout} style={{background:'rgba(255,255,255,.1)',border:'none',color:'#fff',borderRadius:10,padding:'8px 14px',fontSize:12,cursor:'pointer',fontFamily:font}}>Déconnexion</button>
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
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
              {availableCategories.map(cat=>(
                <div key={cat} onClick={()=>setSelectedCat(cat)} style={{background:'#fff',borderRadius:14,padding:'14px 10px',cursor:'pointer',textAlign:'center',fontSize:11,fontWeight:600,color:EPJ.dark,boxShadow:'0 1px 3px rgba(0,0,0,.04)',lineHeight:1.3,border:'2px solid transparent'}}>
                  <span style={{fontSize:26,display:'block',marginBottom:4}}>{dynCatIcons[cat]||'📦'}</span>{cat}
                </div>
              ))}
            </div>
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
                    <div style={{fontSize:10,color:EPJ.gray,marginTop:2,fontFamily:'monospace'}}>{p.r} • {p.u||'Pièce'} {p.stock===false?'• ⚠️ Hors stock':''}</div>
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
                  <div style={{fontSize:11,fontWeight:700,color:EPJ.gray,textTransform:'uppercase',margin:'12px 0 6px'}}>{dynCatIcons[cat]||'📦'} {cat}</div>
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
        {o&&o.type==='equipement'&&<button className="epj-btn" onClick={()=>generateReceptionSheet(o)} style={{background:`linear-gradient(135deg,${EPJ.green},#2E7D32)`,color:'#fff',padding:'16px',fontSize:15,width:'100%'}}>✍️ Feuille de réception + Signature</button>}
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
              {o.type==='equipement'&&<button className="epj-btn" onClick={()=>generateReceptionSheet(o)} style={{background:EPJ.green,color:'#fff',padding:'6px 14px',fontSize:11}}>✍️ Réception</button>}
            </div>
            {Object.entries(byFourn).sort(([a],[b])=>a.localeCompare(b)).map(([code,items])=>(
              <div key={code} style={{marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:700,color:EPJ.blue,marginBottom:6,paddingBottom:4,borderBottom:`2px solid ${EPJ.blue}22`}}>▸ {code} ({items.length})</div>
                {items.map(it=>(<div key={it.r} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom:'1px solid #f5f5f5'}}><Thumb cat={it.c} imageUrl={it.img}/><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:EPJ.dark}}>{it.n}</div><div style={{fontSize:10,color:EPJ.gray,fontFamily:'monospace'}}>{it.r}</div></div><div style={{fontSize:14,fontWeight:800,color:EPJ.blue}}>x{it.qty}</div></div>))}
              </div>
            ))}
            <div style={{marginTop:10,padding:'10px 0',borderTop:`2px solid ${EPJ.dark}11`,display:'flex',justifyContent:'space-between',fontWeight:700,color:EPJ.dark}}><span>Total</span><span>{(o.items||[]).reduce((s,i)=>s+(i.qty||0),0)} articles ({(o.items||[]).length} réf.)</span></div>
          </div>
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
              {adminSaving?'⏳ En cours...':'🔄 Réinitialiser Firebase (583 articles)'}
            </button>
            <div style={{fontSize:11,color:EPJ.gray,textAlign:'center'}}>Charge les données par défaut (utilisateurs, chantiers, catalogue) dans Firebase</div>
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
      const cats = [...new Set(dynCatalog.map(p=>p.c))].sort();
      const subcats = selectedCat ? [...new Set(dynCatalog.filter(p=>p.c===selectedCat).map(p=>p.s))].sort() : [];
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
            {cats.map(cat=>(
              <div key={cat} className="epj-card" style={{marginBottom:6,display:'flex',alignItems:'center',gap:12}}>
                <div onClick={()=>setSelectedCat(cat)} style={{flex:1,display:'flex',alignItems:'center',gap:12,cursor:'pointer'}}>
                  <span style={{fontSize:24}}>{dynCatIcons[cat]||'📦'}</span>
                  <div>
                    <div style={{fontSize:14,fontWeight:700,color:EPJ.dark}}>{cat}</div>
                    <div style={{fontSize:11,color:EPJ.gray}}>{dynCatalog.filter(p=>p.c===cat).length} articles • {[...new Set(dynCatalog.filter(p=>p.c===cat).map(p=>p.s))].length} sous-cat.</div>
                  </div>
                </div>
                <button onClick={()=>{setAdminEdit('renameCat');setAdminForm({oldNom:cat,nom:cat,icon:dynCatIcons[cat]||'📦',isEquip:dynEquipCats.includes(cat)})}} style={{background:EPJ.blue,color:'#fff',border:'none',borderRadius:8,padding:'4px 8px',fontSize:10,cursor:'pointer'}}>✏️</button>
                <button onClick={async()=>{if(!confirm(`Supprimer la catégorie "${cat}" et tous ses articles ?`))return;setAdminSaving(true);const toDelete=dynCatalog.filter(p=>p.c===cat);for(const p of toDelete){const docId=(p.r||'').replace(/[\/\s]/g,'_')||('__cat_'+cat.replace(/\s/g,'_'));try{await deleteDoc(doc(db,"catalogue",docId))}catch(e){}}const newIcons={...dynCatIcons};delete newIcons[cat];await setDoc(doc(db,"config","settings"),{catIcons:newIcons},{merge:true});setAdminSaving(false);showT("🗑️ Catégorie supprimée")}} style={{background:EPJ.red,color:'#fff',border:'none',borderRadius:8,padding:'4px 8px',fontSize:10,cursor:'pointer'}}>🗑️</button>
              </div>
            ))}
            {adminEdit==='renameCat'&&<div className="epj-card" style={{marginBottom:12,border:`2px solid ${EPJ.blue}`,marginTop:10}}>
              <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>Modifier la catégorie</div>
              <div style={{display:'flex',gap:8,marginBottom:8}}>
                <input className="epj-input" placeholder="Nouveau nom" value={adminForm.nom||''} onChange={e=>setAdminForm(p=>({...p,nom:e.target.value}))} style={{flex:1,padding:'8px 10px',fontSize:13}}/>
                <input className="epj-input" placeholder="Icône" value={adminForm.icon||''} onChange={e=>setAdminForm(p=>({...p,icon:e.target.value}))} style={{width:60,padding:'8px',fontSize:20,textAlign:'center'}}/>
              </div>
              <label style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,cursor:'pointer',padding:'8px 10px',background:adminForm.isEquip?'#E8F5E9':'#f5f5f5',borderRadius:8,border:adminForm.isEquip?'2px solid #4CAF50':'2px solid #ddd'}}>
                <input type="checkbox" checked={adminForm.isEquip||false} onChange={e=>setAdminForm(p=>({...p,isEquip:e.target.checked}))} style={{width:18,height:18}}/>
                <div><div style={{fontSize:13,fontWeight:600}}>Équipement Salarié</div><div style={{fontSize:10,color:EPJ.gray}}>Visible dans "Commande Équipement"</div></div>
              </label>
              <div style={{display:'flex',gap:8}}>
                <button className="epj-btn" onClick={()=>{setAdminEdit(null);setAdminForm({})}} style={{flex:1,background:'#eee',color:EPJ.dark,padding:'10px'}}>Annuler</button>
                <button className="epj-btn" onClick={async()=>{
                  if(!adminForm.nom||!adminForm.oldNom)return;
                  setAdminSaving(true);
                  // Rename: update all articles in this category
                  const toUpdate=dynCatalog.filter(p=>p.c===adminForm.oldNom);
                  for(const p of toUpdate){const docId=(p.r||'').replace(/[\/\s]/g,'_')||('__cat_'+adminForm.oldNom.replace(/\s/g,'_'));try{await setDoc(doc(db,"catalogue",docId),{...p,c:adminForm.nom},{merge:true})}catch(e){}}
                  // Update icon
                  const newIcons={...dynCatIcons};delete newIcons[adminForm.oldNom];newIcons[adminForm.nom]=adminForm.icon||'📦';
                  // Update equipCategories
                  let newEquip=[...dynEquipCats].filter(c=>c!==adminForm.oldNom);
                  if(adminForm.isEquip) newEquip.push(adminForm.nom);
                  await setDoc(doc(db,"config","settings"),{catIcons:newIcons,equipCategories:newEquip},{merge:true});
                  setDynEquipCats(newEquip);
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
              {p.img?<img src={p.img} alt="" style={{width:36,height:36,borderRadius:6,objectFit:'cover'}}/>:<div style={{width:36,height:36,borderRadius:6,background:`${EPJ.blue}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>{dynCatIcons[p.c]||'📦'}</div>}
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

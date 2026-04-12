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
  {c:"Béton + Descente",s:"Capri",r:"CAP 959922",n:"Boîte Maxibanche GTI IRL2",u:"Pièce"},
  {c:"Béton + Descente",s:"Capri",r:"CAP 959937",n:"Boîte Maxibanche dos à dos IRL",u:"Pièce"},
  {c:"Béton + Descente",s:"Capri",r:"CAP 859320",n:"Boîtier 32 A Ø 80",u:"Pièce"},
  {c:"Béton + Descente",s:"Capri",r:"CAP 598940",n:"Cône d'extraction",u:"Pièce"},
  {c:"Béton + Descente",s:"Rallonge Doublage",r:"SIB P0106009",n:"Manchon doublage",u:"Pièce"},
  {c:"Béton + Descente",s:"Rallonge Doublage",r:"SIB P0106108",n:"Anneau adaptateur appareil vis",u:"Pièce"},
  {c:"Béton + Descente",s:"SIB",r:"SIB P01052",n:"Anneau à vis universel",u:"Pièce"},
  {c:"Béton + Descente",s:"SIB",r:"SIB P0110013",n:"Boîtier + couvercle 32 ampères",u:"Pièce"},
  {c:"Béton + Descente",s:"BLM",r:"BLI 779930",n:"Banchebox IRL25 murs de 160 à 200 mm",u:"Pièce"},
  {c:"Béton + Descente",s:"BLM",r:"BLI 779925",n:"Banchebox IRL25 murs 160-200mm (non percée)",u:"Pièce"},
  {c:"Béton + Descente",s:"BLM",r:"BLI 759010",n:"Couv. de pose Murbox",u:"Pièce"},
  {c:"Béton + Descente",s:"BLM",r:"BLI 759920",n:"Bague de rallonge Murbox 20mm",u:"Pièce"},
  {c:"Béton + Descente",s:"BLM",r:"BLI 750090",n:"Distancier Murbox type 'C' 71x100mm",u:"Pièce"},
  {c:"Béton + Descente",s:"BLM",r:"BLI 759020",n:"Anneau à vis Murbox",u:"Pièce"},
  {c:"Béton + Descente",s:"BLM",r:"BLI 755108",n:"Aimant résine 800N jaune",u:"Pièce"},
  {c:"Béton + Descente",s:"Tube IRO",r:"GEW DX27725",n:"IRL 3321 D25 Tube IRL (Gewiss)",u:"Barre"},
  {c:"Béton + Descente",s:"Tube IRO",r:"IBO B28970",n:"IRL 3321 D25 Tube IRL",u:"Barre"},
  {c:"Béton + Descente",s:"Tube IRO",r:"IBO B28980",n:"IRL 3321 D32 Tube IRL",u:"Barre"},
  {c:"Béton + Descente",s:"Terre",r:"FIL CUIVRENU25C50",n:"Cuivre nu 1x25² 50M",u:"ML"},
  {c:"Béton + Descente",s:"Terre",r:"KKE RG10-50",n:"Raccord à griffes 10 à 50mm",u:"Pièce"},
  {c:"Béton + Descente",s:"Terre",r:"CAT AMG-10",n:"Piquet AC/Galva D.16mmx1,00m",u:"Pièce"},
  {c:"Conduit + Manchon",s:"ICTA",r:"EFI ECICTA20T",n:"Flex ICTA 3422 avec fil 20mm",u:"Rouleau"},
  {c:"Conduit + Manchon",s:"ICTA",r:"EFI ECICTA25T",n:"Flex ICTA 3422 avec fil 25mm",u:"Rouleau"},
  {c:"Conduit + Manchon",s:"ICTA",r:"EFI ECICTA32T",n:"Flex ICTA 3422 avec fil 32mm",u:"Rouleau"},
  {c:"Conduit + Manchon",s:"ICTA",r:"EFI ECICTA40T",n:"Flex ICTA 3422 avec fil 40mm",u:"Rouleau"},
  {c:"Conduit + Manchon",s:"Manchon",r:"SIB P0300209",n:"Manchon ICT 20",u:"Pièce"},
  {c:"Conduit + Manchon",s:"Manchon",r:"SIB P0300254",n:"Manchon ICT 25",u:"Pièce"},
  {c:"Conduit + Manchon",s:"Manchon",r:"SIB P0300322",n:"Manchon ICT 32",u:"Pièce"},
  {c:"Conduit + Manchon",s:"Manchon",r:"SIB P0300400",n:"Manchon ICT 40",u:"Pièce"},
  {c:"Conduit + Manchon",s:"Janolène Rouge",r:"PUM 55148",n:"Couronne gaine TPC 450N rouge 50M D40",u:"Couronne"},
  {c:"Conduit + Manchon",s:"Janolène Rouge",r:"PUM 55142",n:"Couronne gaine TPC 450N rouge 25M D63",u:"Couronne"},
  {c:"Conduit + Manchon",s:"Janolène Rouge",r:"PUM 55144",n:"Couronne gaine TPC 450N rouge 25M D90",u:"Couronne"},
  {c:"Conduit + Manchon",s:"Janolène Rouge",r:"PUM 55145",n:"Couronne gaine TPC 450N rouge 25M D110",u:"Couronne"},
  {c:"Conduit + Manchon",s:"Janolène Rouge",r:"PUM 55147",n:"Couronne gaine TPC 450N rouge 25M D160",u:"Couronne"},
  {c:"Conduit + Manchon",s:"Janolène IK10",r:"CNT 12024320",n:"Rlx ICTA 3522 IK10 25M tire fil D63",u:"Rouleau"},
  {c:"Conduit + Manchon",s:"Janolène IK10",r:"CNT 12025120",n:"Rlx ICTA 3522 IK10 25M tire fil D90",u:"Rouleau"},
  {c:"Conduit + Manchon",s:"Janolène IK10",r:"CNT 12025520",n:"Rlx ICTA 3522 IK10 25M tire fil D110",u:"Rouleau"},
  {c:"Conduit + Manchon",s:"Janolène IK10",r:"PUM 64998",n:"Rlx ICTA 3522 IK10 25M tire fil D160",u:"Rouleau"},
  {c:"Conduit + Manchon",s:"PVC FT",r:"PUM 12867",n:"Gaine PVC LST 6M 45x1,8",u:"Barre"},
  {c:"Conduit + Manchon",s:"PVC FT",r:"PUM 56220",n:"Courbe Telecom MF-90' R210 D45",u:"Pièce"},
  {c:"Conduit + Manchon",s:"PVC FT",r:"PUM 7600",n:"Courbe Telecom MF-45' R525 D45",u:"Pièce"},
  {c:"Conduit + Manchon",s:"Tube IRO",r:"IBO B28960",n:"Tube IRO PVC tulipé Ø20mm 3m gris",u:"Barre"},
  {c:"Conduit + Manchon",s:"Tube IRO",r:"IBO B28990",n:"Tube IRO PVC tulipé Ø40mm",u:"Barre"},
  {c:"Conduit + Manchon",s:"Tube IRO",r:"IBO B29010",n:"Tube IRO PVC tulipé Ø63mm",u:"Barre"},
  {c:"Équip. Sous-Sol",s:"Tableautin",r:"GW42001",n:"Tableautin 200x150x40 IP41 (BS)",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Tableautin",r:"MIH R152",n:"Tableau bois (BS)",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Tableautin",r:"MIH R150",n:"Tableau bois (DECT)",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Install. Chantier",r:"BRE 1159961",n:"Socle 4 prises noir IP44 (réglette)",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Install. Chantier",r:"DIG-31132",n:"Coffret distribution 4 PC 2P+T + AU",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Install. Chantier",r:"DIG-31324",n:"Coffret distribution 4PC 3P+N+T 32A + AU",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Install. Chantier",r:"ARI 50416",n:"Ecoled BLC 5,5W/4000K (lampe chantier)",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 607000",n:"Simply 35W 4000K 4196lm (fluo court)",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 607001",n:"Simply 50W 4000K 5517lm (fluo long)",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 607011",n:"Simply 50W 4000K + 1M50 câble",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 830000",n:"Hubo 18W CCT 4000K 1678lm",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 830001",n:"Hubo 18W DET CCT 4000K 1678lm",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 830020",n:"Hubo 8/15W CCT 4000K",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 830021",n:"Hubo 8/15W DET CCT 4000K",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 830022",n:"Hubo 17/24W CCT 4000K",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Luminaire",r:"RES 830023",n:"Hubo 17/24W DET CCT 4000K",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Détecteur",r:"BE4 91101",n:"LC Click détecteur 140DEG blanc",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Détecteur",r:"BE4 91102",n:"LC Click détecteur 200DEG blanc",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Détecteur",r:"BE4 92194",n:"Détecteur PD3-1C-Applique 360°",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"B.A.E.S.",r:"ZEM AGV-60-NM",n:"Grille protection IK10 XENA FLAT",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"B.A.E.S.",r:"ZEM LXF-3045EX",n:"Bloc évacuation SATI 45lms",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Box Garage",r:"POI MM32LM",n:"Compteur monophasé 45A MID",u:"Pièce"},
  {c:"Équip. Sous-Sol",s:"Box Garage",r:"BLD BL000047",n:"Milo-Hublot 1xE27 IK10 IP65",u:"Pièce"},
  {c:"Plexo",s:"Boîte Plexo",r:"BLI 560409",n:"Boîte Plexo 100x100",u:"Pièce"},
  {c:"Plexo",s:"Boîte Plexo",r:"BLI 560209",n:"Boîte Plexo Ø70",u:"Pièce"},
  {c:"Plexo",s:"Boîte Plexo",r:"BLI 560309",n:"Boîte Plexo 80x80",u:"Pièce"},
  {c:"Plexo",s:"Boîte Plexo",r:"BLI 515509",n:"Boîte Optibox IP55 155x110x80",u:"Pièce"},
  {c:"Plexo",s:"Boîte Plexo",r:"BLI 515609",n:"Boîte Plexo 175x150x80",u:"Pièce"},
  {c:"Plexo",s:"Saillie - Prise",r:"SCH MUR35031",n:"Prise Plexo saillie gris",u:"Pièce"},
  {c:"Plexo",s:"Saillie - Prise",r:"SCH MUR39030",n:"Prise Plexo saillie blanc",u:"Pièce"},
  {c:"Plexo",s:"Saillie - Prise",r:"SCH MUR36010",n:"Prise Plexo IRVE saillie gris",u:"Pièce"},
  {c:"Plexo",s:"Saillie - Prise",r:"SCH MUR39010",n:"Prise Plexo IRVE saillie blanc",u:"Pièce"},
  {c:"Plexo",s:"Saillie - VA/Vient",r:"SCH MUR35021",n:"VA-et-Vient Plexo saillie gris",u:"Pièce"},
  {c:"Plexo",s:"Saillie - VA/Vient",r:"SCH MUR39021",n:"VA-et-Vient Plexo saillie blanc",u:"Pièce"},
  {c:"Plexo",s:"Saillie - BP",r:"SCH MUR35026",n:"BP Plexo saillie gris",u:"Pièce"},
  {c:"Plexo",s:"Saillie - BP",r:"SCH MUR39026",n:"BP Plexo saillie blanc",u:"Pièce"},
  {c:"Plexo",s:"Support Saillie",r:"SCH MUR37911",n:"Support 1 poste gris",u:"Pièce"},
  {c:"Plexo",s:"Support Saillie",r:"SCH MUR39911",n:"Support 1 poste blanc",u:"Pièce"},
  {c:"Plexo",s:"Encastrée - Prise",r:"SCH MUR34107+36133",n:"Prise Plexo encastré gris",u:"Pièce"},
  {c:"Plexo",s:"Encastrée - Prise",r:"SCH MUR39107+39133",n:"Prise Plexo encastré blanc",u:"Pièce"},
  {c:"Plexo",s:"Encastrée - VA/Vient",r:"SCH MUR34107+37021",n:"VA-et-Vient Plexo encastré gris",u:"Pièce"},
  {c:"Plexo",s:"Encastrée - VA/Vient",r:"SCH MUR39107+39723",n:"VA-et-Vient Plexo encastré blanc",u:"Pièce"},
  {c:"Placo",s:"Simple",r:"BLI 613409",n:"Lot 300 Blue Box + scie cloche",u:"Lot"},
  {c:"Placo",s:"Simple",r:"BLI 675400",n:"Lot 500 No Air II + scie cloche",u:"Lot"},
  {c:"Placo",s:"Simple",r:"BLI 613409U",n:"Blue Box Ø68 simple unitaire",u:"Pièce"},
  {c:"Placo",s:"Simple",r:"BLI 675400U",n:"No Air Ø68 simple unitaire",u:"Pièce"},
  {c:"Placo",s:"Simple 32A",r:"CAP 736869",n:"Capriclips simple 32A",u:"Pièce"},
  {c:"Placo",s:"Simple 32A",r:"BLI 690860",n:"Boîtier 32A No Air D.86",u:"Pièce"},
  {c:"Placo",s:"Double",r:"BLI 620719",n:"Boîte double entraxe 71mm",u:"Pièce"},
  {c:"Placo",s:"Double",r:"BLI 682710",n:"No Air double entraxe 71mm",u:"Pièce"},
  {c:"Placo",s:"Triple",r:"EUR 52046",n:"Boîte triple entraxe 71mm",u:"Pièce"},
  {c:"Placo",s:"Triple",r:"BLI 683710",n:"No Air triple entraxe 71mm",u:"Pièce"},
  {c:"Placo",s:"Quadruple",r:"EUR 52048",n:"Boîte quadruple entraxe 71mm",u:"Pièce"},
  {c:"Placo",s:"Quadruple",r:"BLI 684710",n:"No Air quadruple entraxe 71mm",u:"Pièce"},
  {c:"Placo",s:"Kit DCL",r:"BLI 610559",n:"Point centre Blue Box DCL HT55",u:"Pièce"},
  {c:"Placo",s:"Kit DCL",r:"CAP 735049",n:"Capriclips DCL HT40 D86",u:"Pièce"},
  {c:"Placo",s:"Kit DCL",r:"BLI 670510",n:"No Air BBC DCL HT55 D67",u:"Pièce"},
  {c:"Placo",s:"Kit DCL",r:"EUR 53063",n:"Point centre air'metic D85",u:"Pièce"},
  {c:"Placo",s:"GTL",r:"GTL235ES01",n:"Fond 235 + 1 couvercle",u:"Pièce"},
  {c:"Placo",s:"GTL",r:"GTL235ED02",n:"Fond 235 + 2 couvercles + cloison",u:"Pièce"},
  {c:"Placo",s:"Bac encastrement",r:"AOE BTT20CBL",n:"Bac 2 travées PC+4R+VA com 200mm",u:"Pièce"},
  {c:"Placo",s:"Bac encastrement",r:"AOE BTT20CBLX3",n:"Lot 3 Bac 2 travées",u:"Lot"},
  {c:"Colonne Montante",s:"Colonne",r:"BEO 0702",n:"Borne ECP2D",u:"Pièce"},
  {c:"Colonne Montante",s:"Colonne",r:"BEO 0706",n:"Borne ECP3D",u:"Pièce"},
  {c:"Colonne Montante",s:"SPCM",r:"BEO 1613",n:"CC 200A SPCM+cornet+2DEP.95MM2",u:"Pièce"},
  {c:"Colonne Montante",s:"SPCM",r:"BEO 1615",n:"CC 200A SPCM ARR 240 + Cornet",u:"Pièce"},
  {c:"Colonne Montante",s:"Distributeur",r:"BEO 0960",n:"Distributeur arrivée 200A 3 DEP CPF",u:"Pièce"},
  {c:"Colonne Montante",s:"Distributeur",r:"BEO 0961",n:"Distributeur 200A",u:"Pièce"},
  {c:"Colonne Montante",s:"DB Platine Tri",r:"BEO 0410",n:"Panneau 330x330 compteur tri + disj.",u:"Pièce"},
  {c:"Colonne Montante",s:"DB Platine Tri",r:"LEG 401012",n:"Disj.Branch.4P 10/30A 500mA S",u:"Pièce"},
  {c:"Colonne Montante",s:"DB Platine Tri",r:"LEG 401013",n:"Disj.Branch.4P 30/60A 500mA S",u:"Pièce"},
  {c:"Colonne Montante",s:"DB Platine Mono",r:"SCH R9HPNFC15115",n:"Platine + DB 15/45A Type S",u:"Pièce"},
  {c:"Colonne Montante",s:"DB Platine Mono",r:"SCH R9HPNFC15160",n:"Platine + DB 30/60A Type S",u:"Pièce"},
  {c:"Colonne Montante",s:"Tête de Câble",r:"TRM 82914",n:"EXT. E4R 10-35²",u:"Pièce"},
  {c:"Colonne Montante",s:"Tête de Câble",r:"TRM 82915",n:"EXT. E4R 50-150²",u:"Pièce"},
  {c:"Colonne Montante",s:"Tête de Câble",r:"TRM 82916",n:"EXT. E4R 240²",u:"Pièce"},
  {c:"Câble Colonne",s:"Tronçon Alu",r:"FIL AR2V1X35TGL",n:"AR2V ALU 1X35 TGL",u:"ML"},
  {c:"Câble Colonne",s:"Tronçon Alu",r:"FIL AR2V1X50TGL",n:"AR2V ALU 1X50 TGL",u:"ML"},
  {c:"Câble Colonne",s:"Tronçon Alu",r:"FIL AR2V1X70TGL",n:"AR2V ALU 1X70 TGL",u:"ML"},
  {c:"Câble Colonne",s:"Tronçon Alu",r:"FIL AR2V1X95TGL",n:"AR2V ALU 1X95 TGL",u:"ML"},
  {c:"Câble Colonne",s:"Tronçon Cuivre",r:"FIL R2V1X35TGL",n:"R2V CU 1X35 TGL",u:"ML"},
  {c:"Câble Colonne",s:"Tronçon Cuivre",r:"FIL R2V1X50TGL",n:"R2V CU 1X50 TGL",u:"ML"},
  {c:"Câble Colonne",s:"Tronçon Cuivre",r:"FIL R2V1X70TGL",n:"R2V CU 1X70 TGL",u:"ML"},
  {c:"Câble Colonne",s:"DI Alu",r:"FIL FRN07VAR16ALUBET500",n:"FR-N07V-AR 16mm² ALU Bleu",u:"ML"},
  {c:"Câble Colonne",s:"DI Alu",r:"FIL FRN07VAR16ALURGT500",n:"FR-N07V-AR 16mm² ALU Rouge",u:"ML"},
  {c:"Câble Colonne",s:"DI Alu",r:"FIL FRN07VAR25ALUVJT500",n:"FR-N07V-AR 25mm² ALU V/J",u:"ML"},
  {c:"Câble Colonne",s:"DI Cuivre",r:"FIL H07VR16BETGL",n:"H07VR 16 Bleu TGL",u:"ML"},
  {c:"Câble Colonne",s:"DI Cuivre",r:"FIL H07VR16RGTGL",n:"H07VR 16 Rouge TGL",u:"ML"},
  {c:"Câble Colonne",s:"DI Cuivre",r:"FIL H07VR25BETGL",n:"H07VR 25 Bleu TGL",u:"ML"},
  {c:"Câble Colonne",s:"DI Cuivre",r:"FIL H07VR25RGTGL",n:"H07VR 25 Rouge TGL",u:"ML"},
  {c:"Câble Colonne",s:"Amorce Alu",r:"FIL AR2V4X70TGL",n:"AR2V ALU 4X70 TGL",u:"ML"},
  {c:"Câble Colonne",s:"Amorce Alu",r:"FIL AR2V4X95TGL",n:"AR2V ALU 4X95 TGL",u:"ML"},
  {c:"Câble Colonne",s:"Amorce Alu",r:"FIL AR2V4X120TGL",n:"AR2V ALU 4X120 TGL",u:"ML"},
  {c:"Câble Colonne",s:"Amorce Cuivre",r:"FIL R2V4X50TGL",n:"R2V CU 4X50 SVJ TGL",u:"ML"},
  {c:"Câble Colonne",s:"Amorce Cuivre",r:"FIL R2V4X70TGL",n:"R2V CU 4X70 SVJ TGL",u:"ML"},
  {c:"Équipement Commun",s:"Détecteur",r:"BE4 92194B",n:"Détecteur PD3-1C-AP Saillie",u:"Pièce"},
  {c:"Équipement Commun",s:"Détecteur",r:"BE4 92197",n:"Détecteur PD3-1C-FP Encastré",u:"Pièce"},
  {c:"Équipement Commun",s:"Détecteur",r:"YUX EP10428746",n:"Détecteur MD-FLAT 360i/8 encastré",u:"Pièce"},
  {c:"Équipement Commun",s:"Tableau",r:"SCH R9H13401",n:"Tableau 1 rangée",u:"Pièce"},
  {c:"Équipement Commun",s:"Tableau",r:"SCH R9H13402",n:"Tableau 2 rangées",u:"Pièce"},
  {c:"Équipement Commun",s:"B.A.E.S.",r:"ZEM LXF3017EX",n:"BAEH XENA FLAT SATI 5H 8LM",u:"Pièce"},
  {c:"Équipement Commun",s:"DAD",r:"FRA NEU4710R1C",n:"Déclencheur manuel rouge + capot",u:"Pièce"},
  {c:"Équipement Commun",s:"DAD",r:"FRA FINCARAIBES1",n:"DAD secouru 2 batteries 12V",u:"Pièce"},
  {c:"Équipement Commun",s:"Coupure Pompier",r:"GEW FR60161",n:"Coffret chaufferie monophasé",u:"Pièce"},
  {c:"Équipement Commun",s:"Coupure Pompier",r:"GEW FR60160",n:"Coffret chaufferie Tri+Neutre",u:"Pièce"},
  {c:"Équipement Logement",s:"Odace - Lot",r:"SCH S523059P",n:"Lot de 40 PC",u:"Lot"},
  {c:"Équipement Logement",s:"Odace - Lot",r:"SCH S523204P",n:"Lot de 60 VA et Vient",u:"Lot"},
  {c:"Équipement Logement",s:"Odace - Unitaire",r:"SCH S520059",n:"PC",u:"Pièce"},
  {c:"Équipement Logement",s:"Odace - Unitaire",r:"SCH S520204",n:"VA et Vient",u:"Pièce"},
  {c:"Équipement Logement",s:"Odace - Unitaire",r:"SCH S520214",n:"Double VA et Vient",u:"Pièce"},
  {c:"Équipement Logement",s:"Odace - Unitaire",r:"SCH S520206",n:"Bouton Poussoir",u:"Pièce"},
  {c:"Équipement Logement",s:"Odace - Unitaire",r:"SCH S520208",n:"Monte et baisse VR",u:"Pièce"},
  {c:"Équipement Logement",s:"Odace - TV/RJ45",r:"SCH S520451",n:"TV/FM",u:"Pièce"},
  {c:"Équipement Logement",s:"Odace - TV/RJ45",r:"SCH S520461",n:"TV/FM/SAT",u:"Pièce"},
  {c:"Équipement Logement",s:"Odace - Plaque",r:"SCH S520702",n:"Plaque simple Odace Styl",u:"Pièce"},
  {c:"Équipement Logement",s:"Odace - Plaque",r:"SCH S520704",n:"Plaque double Odace Styl",u:"Pièce"},
  {c:"Équipement Logement",s:"Odace - Plaque",r:"SCH S520706",n:"Plaque triple Odace Styl",u:"Pièce"},
  {c:"Équipement Logement",s:"Odace - Plaque",r:"SCH S520708",n:"Plaque quadruple Odace Styl",u:"Pièce"},
  {c:"Équipement Logement",s:"Ovalis - Lot",r:"SCH S320059P",n:"Lot 108 2P+T à puits blanc",u:"Lot"},
  {c:"Équipement Logement",s:"Ovalis - Lot",r:"SCH S320204P",n:"Lot 108 VA et Vient blanc",u:"Lot"},
  {c:"Équipement Logement",s:"Ovalis - Unitaire",r:"SCH S320059",n:"PC 2P+T à puits blanc",u:"Pièce"},
  {c:"Équipement Logement",s:"Ovalis - Unitaire",r:"SCH S320204",n:"VA et Vient blanc",u:"Pièce"},
  {c:"Équipement Logement",s:"Ovalis - Unitaire",r:"SCH S320214",n:"Double VV blanc",u:"Pièce"},
  {c:"Équipement Logement",s:"Ovalis - Unitaire",r:"SCH S320208",n:"Inter volet roulant blanc",u:"Pièce"},
  {c:"Équipement Logement",s:"Ovalis - Plaque",r:"SCH S320702",n:"Plaque 1 post blanc",u:"Pièce"},
  {c:"Équipement Logement",s:"Ovalis - Plaque",r:"SCH S320704",n:"Plaque 2 post horiz blanc",u:"Pièce"},
  {c:"Équipement Logement",s:"Sortie de Câble",r:"BLI 605201",n:"Sortie de câble 16A",u:"Pièce"},
  {c:"Équipement Logement",s:"Sortie de Câble",r:"BLI 605320",n:"Sortie de câble 32A",u:"Pièce"},
  {c:"Équipement Logement",s:"DCL",r:"BLI 601200",n:"Couvercle DCL Ø120",u:"Pièce"},
  {c:"Équipement Logement",s:"DCL",r:"BLI 710100",n:"Douille E27 + Fiche DCL",u:"Pièce"},
  {c:"Équipement Logement",s:"Piton",r:"BLI 754110",n:"Piton L 85mm",u:"Pièce"},
  {c:"Équipement Logement",s:"Piton",r:"BLI 750192",n:"Piton L 100mm",u:"Pièce"},
  {c:"Équipement Logement",s:"Piton",r:"BLI 750193",n:"Piton L 120mm",u:"Pièce"},
  {c:"Courant Faible",s:"Équip. Tableau Com",r:"AOE GTC113",n:"Répartiteur TV/SAT 3 sorties",u:"Pièce"},
  {c:"Courant Faible",s:"Noyaux RJ",r:"BLI 731110",n:"Lot 100 noyaux RJ45 G3",u:"Lot"},
  {c:"Courant Faible",s:"Noyaux RJ",r:"BLI 731110U",n:"Noyaux RJ45 G3 unitaire",u:"Pièce"},
  {c:"Courant Faible",s:"Tableau Com",r:"COF KITCOMECOG3",n:"Kit Com saillie Grade 3 DTI",u:"Kit"},
  {c:"Courant Faible",s:"Fibre",r:"RTSB-73-913111030",n:"Kit PTO/DTIO 1FO SCAPC LSZH 30M",u:"Kit"},
  {c:"Courant Faible",s:"Fibre",r:"TET CTSH-33-246024N",n:"Câble Colonne M6 G657A2 24FO",u:"ML"},
  {c:"Interphonie",s:"Comelit PIC6",r:"COT RCKPIC6L1020VP",n:"Kit Démarrage VIGIK Plus PIC6 alim 4888C",u:"Kit"},
  {c:"Interphonie",s:"Comelit PIC6",r:"COT ACMRP",n:"Centrale 1 porte VIGIK PLUS",u:"Pièce"},
  {c:"Interphonie",s:"Comelit PIC6",r:"COT 4399",n:"Alimentation 12 Volts 4A",u:"Pièce"},
  {c:"Interphonie",s:"Comelit PIC6",r:"COT 1210",n:"Alimentation 2 fils",u:"Pièce"},
  {c:"Interphonie",s:"Clés Mifare",r:"COT CLE/B",n:"Clé résidant mifare Bleu",u:"Pièce"},
  {c:"Interphonie",s:"Clés Mifare",r:"COT CLE/J",n:"Clé résidant mifare Jaune",u:"Pièce"},
  {c:"Interphonie",s:"Clés Mifare",r:"COT CLE/O",n:"Clé résidant mifare Orange",u:"Pièce"},
  {c:"Interphonie",s:"Clés Mifare",r:"COT CLE/V",n:"Clé résidant mifare Vert",u:"Pièce"},
  {c:"Interphonie",s:"Combiné",r:"COT 6721W/BM",n:"Moniteur mini main libre BM blanc",u:"Pièce"},
  {c:"Interphonie",s:"Combiné",r:"COT PL6721BM",n:"Moniteur People BM 4,3\"",u:"Pièce"},
  {c:"Lustrerie",s:"Ampoule E27",r:"BLD BL06092002",n:"Bulb A60-E27-9W-4000K Non Dim",u:"Pièce"},
  {c:"Lustrerie",s:"Ampoule E27",r:"BLD BL06092001",n:"Bulb A60-E27-9W-3000K Non Dim",u:"Pièce"},
  {c:"Lustrerie",s:"Ampoule GU10",r:"SON LAPAR01",n:"LED GU10 4.9W 535LM 3000K x5p",u:"Lot"},
  {c:"Lustrerie",s:"Ampoule GU10",r:"SON LAPAR02",n:"LED GU10 4.9W 535LM 4000K x5p",u:"Lot"},
  {c:"Lustrerie",s:"Fluo LED",r:"RES 607000B",n:"Simply 35W 4000K 4196lm",u:"Pièce"},
  {c:"Lustrerie",s:"Fluo LED",r:"RES 607001B",n:"Simply 50W 4000K 5517lm",u:"Pièce"},
  {c:"Lustrerie",s:"Escalier",r:"RES 850700",n:"Komet 20W 4000K blanc 2193lm",u:"Pièce"},
  {c:"Lustrerie",s:"Circulation",r:"RES 759405",n:"Muse rond 18W 2231LM CCT",u:"Pièce"},
  {c:"Lustrerie",s:"Circulation",r:"RES 759407",n:"Muse carré 18W 2231LM CCT",u:"Pièce"},
  {c:"Lustrerie",s:"Spot LED",r:"RES 963210",n:"Miks 598lm CCT rond blanc",u:"Pièce"},
  {c:"Lustrerie",s:"Spot LED",r:"RES 963240",n:"Miks 1185lm CCT rond blanc",u:"Pièce"},
  {c:"Lustrerie",s:"Extérieur",r:"RES 946532",n:"Markiz E27 Noir + lampe",u:"Pièce"},
  {c:"Lustrerie",s:"Extérieur",r:"RES 946533",n:"Markiz E27 Blanc + lampe",u:"Pièce"},
  {c:"Quincaillerie",s:"Wago",r:"WUR 0556500300",n:"Connecteur trans. 3 entrées",u:"Pièce"},
  {c:"Quincaillerie",s:"Wago",r:"WUR 0556500500",n:"Connecteur trans. 5 entrées",u:"Pièce"},
  {c:"Quincaillerie",s:"Wago",r:"BLI 460180",n:"Connecteur trans. 8 entrées",u:"Pièce"},
  {c:"Quincaillerie",s:"Wago Souple",r:"BLI 401022",n:"Borne luminaire 1 fil 2 rigides 2,5mm²",u:"Pièce"},
  {c:"Quincaillerie",s:"Sucre",r:"WUR 0556200102",n:"Barrette connex. noir 2.5-10mm²",u:"Pièce"},
  {c:"Quincaillerie",s:"Sucre",r:"WUR 0556200103",n:"Barrette connex. noir 16mm²",u:"Pièce"},
  {c:"Quincaillerie",s:"Collier",r:"WUR 0502109260",n:"Colsone 260mm",u:"Pièce"},
  {c:"Quincaillerie",s:"Collier",r:"WUR 0502109360",n:"Colsone 360mm",u:"Pièce"},
  {c:"Quincaillerie",s:"Collier",r:"WUR 0502131",n:"Frette 200mm",u:"Pièce"},
  {c:"Quincaillerie",s:"Collier",r:"WUR 0502151",n:"Frette 280mm",u:"Pièce"},
  {c:"Quincaillerie",s:"Embase",r:"WUR 050336537",n:"Embase à cheville standard",u:"Pièce"},
  {c:"Quincaillerie",s:"Mousse",r:"WUR 08921521",n:"Mousse montage PU 750ML",u:"Pièce"},
  {c:"Quincaillerie",s:"Traçage",r:"WUR 08921751",n:"Traceur chantier blanc",u:"Pièce"},
  {c:"Quincaillerie",s:"Traçage",r:"WUR 08921753",n:"Traceur chantier rouge fluo",u:"Pièce"},
  {c:"Quincaillerie",s:"Mastic",r:"WUR 0892165001",n:"Mastic acrylique 310ML blanc",u:"Pièce"},
  {c:"Quincaillerie",s:"Mastic",r:"WUR 089285732",n:"Silicone neutre trans 310ML",u:"Pièce"},
  {c:"Quincaillerie",s:"Vis",r:"WUR 019864535",n:"Vis Wupo TF 4,5x35",u:"Boîte"},
  {c:"Quincaillerie",s:"Vis",r:"WUR 01986640",n:"Vis Wupo TF 6x40",u:"Boîte"},
  {c:"Quincaillerie",s:"Cheville",r:"WUR 090320630",n:"Cheville Ø6",u:"Boîte"},
  {c:"Quincaillerie",s:"Cheville",r:"WUR 090320840",n:"Cheville Ø8",u:"Boîte"},
  {c:"Quincaillerie",s:"Foret",r:"WUR 0648556011",n:"Foret Ø6 court",u:"Pièce"},
  {c:"Quincaillerie",s:"Foret",r:"WUR 0648558011",n:"Foret Ø8 court",u:"Pièce"},
  {c:"Outillage",s:"Scie Cloche",r:"VIN 2002301",n:"Scie trépan 68mm Powerchange",u:"Pièce"},
  {c:"Outillage",s:"Scie Cloche",r:"VIN 0421671",n:"Scie trépan 86mm Powerchange",u:"Pièce"},
  {c:"Outillage",s:"Trépan",r:"VIN423846",n:"Trépan Bosch 68",u:"Pièce"},
  {c:"Outillage",s:"Équip. Monteur",r:"VIN 265318",n:"Tenaille russe 220mm Knipex",u:"Pièce"},
  {c:"Outillage",s:"Équip. Monteur",r:"VIN 266176",n:"Massette 1.20KG Lebor",u:"Pièce"},
  {c:"Outillage",s:"Équip. Monteur",r:"VIN 268884",n:"Mesure 5M Fatmax Stanley",u:"Pièce"},
  {c:"Outillage",s:"Équip. Monteur",r:"VIN 268885",n:"Mesure 8M Fatmax Stanley",u:"Pièce"},
  {c:"Outillage",s:"Équip. Monteur",r:"VIN 266680",n:"Tournevis jeu de 6 isolé",u:"Jeu"},
  {c:"Outillage",s:"Équip. Monteur",r:"LEG 031996",n:"Pince collier Colson",u:"Pièce"},
  {c:"Outillage",s:"Équip. Monteur",r:"AGI 221009",n:"Pince dénude 1,5/2,5",u:"Pièce"},
  {c:"Outillage",s:"Équip. Monteur",r:"AGI 424023",n:"Coupe câbles",u:"Pièce"},
  {c:"Outillage",s:"EPI",r:"VIN 360351",n:"Casque chantier + lunette Kara",u:"Pièce"},
  {c:"Outillage",s:"EPI",r:"VIN 361660",n:"Gant chaud noir Snowflex",u:"Paire"},
  {c:"Outillage",s:"EPI",r:"VIN 360332",n:"Casque antibruit arceau",u:"Pièce"},
  {c:"Outillage",s:"EPI",r:"VIN 360239",n:"Masque FFP2 av valve",u:"Pièce"},
  {c:"Outillage",s:"EPI",r:"VIN 360027",n:"Lunette à branche Visilux",u:"Pièce"},
  {c:"Outillage",s:"Habillé",r:"VIN 360505",n:"Pantalon multipoches noir T38",u:"Pièce"},
  {c:"Outillage",s:"Habillé",r:"VIN 361084",n:"Pantalon multipoches noir T40",u:"Pièce"},
  {c:"Outillage",s:"Habillé",r:"VIN 361085",n:"Pantalon multipoches noir T42",u:"Pièce"},
  {c:"Outillage",s:"Habillé",r:"VIN 361086",n:"Pantalon multipoches noir T44",u:"Pièce"},
  {c:"Outillage",s:"Habillé",r:"VIN 361087",n:"Pantalon multipoches noir T46",u:"Pièce"},
  {c:"Outillage",s:"Habillé",r:"VIN 362357",n:"Botte sécurité Zeus T42",u:"Paire"},
  {c:"Outillage",s:"Habillé",r:"VIN 362358",n:"Botte sécurité Zeus T43",u:"Paire"},
  {c:"Outillage",s:"Habillé",r:"VIN 362353",n:"Botte sécurité Zeus T44",u:"Paire"},
  {c:"Outillage",s:"Habillé",r:"VIN 362360",n:"Botte sécurité Zeus T45",u:"Paire"},
  {c:"Outillage",s:"Divers",r:"VIN 204290",n:"Escabeau alu 3 marches",u:"Pièce"},
  {c:"Outillage",s:"Divers",r:"VIN 204291",n:"Escabeau alu 4 marches",u:"Pièce"},
  {c:"Outillage",s:"Divers",r:"VIN 480044",n:"Enrouleur 25M 3x1.5",u:"Pièce"},
  {c:"Divers",s:"Divers",r:"BIZ 700231",n:"Gel lubrifiant câbles Biz'Lub",u:"Pièce"},
  {c:"Divers",s:"Divers",r:"CAP 599200",n:"Caprigel GTI 1L",u:"Pièce"},
  {c:"Divers",s:"Divers",r:"AGI 398443",n:"Aiguille nylon 25m",u:"Pièce"},
  {c:"Divers",s:"Divers",r:"AGI 398445",n:"Aiguille nylon 30m",u:"Pièce"},
  {c:"Divers",s:"Divers",r:"AGI 398607",n:"Pince à sertir",u:"Pièce"},
  {c:"Câbles",s:"Réseaux",r:"ACO R7295AST",n:"Câble 4P CAT6A F/FTP LSOH",u:"ML"},
  {c:"Câbles",s:"Interphone",r:"FIL SYT15PAWG20GRTGL",n:"SYT1NUM 5PAWG20 GR TGL",u:"ML"},
  {c:"Câbles",s:"Incendie",r:"FIL SYT11PAWG20RGAEGTGL",n:"SYT1NUM 1PAWG20 Rouge AE",u:"ML"},
  {c:"Câbles",s:"Incendie",r:"FIL CR1C1NA2X1,5RONDTGL",n:"Sécurité CR1-C1 2X1,5 TGL",u:"ML"},
  {c:"Câbles",s:"Coaxial",r:"FIL 17VATCC100B",n:"Câble coaxial antenne TV 17 VATC",u:"ML"},
];

const CAT_ICONS = {"Béton + Descente":"🧱","Conduit + Manchon":"🔧","Équip. Sous-Sol":"🏗️","Plexo":"🔌","Placo":"📦","Colonne Montante":"⚡","Câble Colonne":"🔗","Équipement Commun":"🏢","Équipement Logement":"🏠","Courant Faible":"📡","Interphonie":"🔔","Lustrerie":"💡","Quincaillerie":"🔩","Outillage":"🛠️","Divers":"📎","Câbles":"🔌"};


const EPJ_LOGO = "data:image/jpeg;base64,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gXajx44X0weCKetrJyHupXUggqVUdfoKAK1nqFzqMJuLaCNYtxCmVyC2O+AOKI9WC3Vxa3UflyQR+aSjblZfarNhYx6daLbRMzIpJBY880w6ZA2oSXrFmeSPy2U/dIoAoJqpv4o5lkht0Dbgj3G1mx/ewP0qzNq3lfZYkRJp7kkIEf5BjvnH9Kkg0z7LEIre6mjiBO1Plbb9MjNLJpkc1zbXMssjSW2dp4G7PrgUASK90hLTrCsagklGJP8AKqFvrn2uMyx/Z4kyQommwxHrgDitaRBJG0ZzhgQcVBYWMWn2i20RZlXOC3Xk5oAoprqk3UZjQy28RkBR9yOPY9qvafdm+sIbkpsMi525ziozpdub+S8bczSx+WyH7pFJBpv2WIQ293PHEv3U+Vtv5jNAEd7q6W18lmip5jLuLyPtVR9fWpLW9aecIZLVsgnEcpZvyxTptNjmniufMdLiNdolXGSPcYwaligljfc11JIP7rKoH6CgCeiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigAooooAKKKKACiiigD/2Q==";
const EPJ = {dark:"#3d3d3d",blue:"#00A3E0",orange:"#F5841F",green:"#A8C536",gray:"#8C8C8C",grayLight:"#f4f5f7",white:"#fff",red:"#E53935"};
const font = "'Outfit','Segoe UI',sans-serif";
const STATUS_COLORS = {"En attente de validation":{bg:"#FFF3E0",color:"#E65100",icon:"⏳"},"Validée":{bg:"#E8F5E9",color:"#2E7D32",icon:"✅"},"Envoyée aux achats":{bg:"#E3F2FD",color:"#1565C0",icon:"📨"},"Refusée":{bg:"#FFEBEE",color:"#C62828",icon:"❌"}};

// Équipement salarié = only Outillage category
const EMAIL_ACHATS = "achat@epj-electricite.com";
const EQUIP_CATS = ["Outillage"];

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
  const availableCategories = useMemo(() => orderType==="equipement" ? dynEquipCats : allCategories, [orderType, allCategories, dynEquipCats]);

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

  const sendOrder = async () => {
    if(sending) return;
    setSending(true);
    const cmd = numCmd();
    const chObj = selectedChantierObj;
    const needsValidation = orderType==='chantier' && !user.directAchat;
    const statut = needsValidation ? "En attente de validation" : "Envoyée aux achats";
    const orderData = {
      num:cmd, date:new Date().toLocaleDateString('fr-FR'), type:orderType,
      items: cartItems.map(it=>({r:it.r, n:it.n, c:it.c, s:it.s, u:it.u||'Pièce', qty:it.qty, img:it.img||''})),
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
      setPdfOrder({...order, statut:"Validée"});
      setView("pdfPreview");
      showT("✅ Commande validée — PDF généré");
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

  // ─── QTY CONTROL with editable input ───
  const [typingRef, setTypingRef] = useState(null);
  const [typingVal, setTypingVal] = useState('');
  const QtyControl = ({r, value, compact}) => {
    const isTyping = typingRef === r;
    return (
    <div style={{display:'flex',alignItems:'center',gap:4}}>
      <button onClick={()=>updateQty(r,value-1)} style={{width:compact?30:34,height:compact?30:34,borderRadius:8,border:'none',background:value===1?'#fee':'#eee',color:value===1?EPJ.red:EPJ.dark,fontSize:16,cursor:'pointer',fontWeight:700}}>{value===1?'🗑':'−'}</button>
      <input type="text" inputMode="numeric" pattern="[0-9]*" className="qty-input"
        value={isTyping ? typingVal : value}
        onFocus={e=>{setTypingRef(r);setTypingVal('');e.target.value='';}}
        onChange={e=>{const v=e.target.value.replace(/[^0-9]/g,'');setTypingVal(v)}}
        onBlur={()=>{const n=parseInt(typingVal)||value;if(n>0)updateQty(r,n);setTypingRef(null);setTypingVal('')}}
        onKeyDown={e=>{if(e.key==='Enter'){e.target.blur()}}}
        placeholder={String(value)}
        style={{width:compact?48:60}} />
      <button onClick={()=>updateQty(r,value+1)} style={{width:compact?30:34,height:compact?30:34,borderRadius:8,border:'none',background:'#eee',fontSize:16,cursor:'pointer',fontWeight:700}}>+</button>
    </div>);
  };

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
                    <div style={{fontSize:10,color:EPJ.gray,marginTop:2,fontFamily:'monospace'}}>{p.r} • {p.u||'Pièce'}</div>
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
                      <QtyControl r={it.r} value={cart[it.r]}/>
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
        <button className="epj-btn" onClick={()=>{setPdfOrder(null);setView('home')}} style={{width:'100%',marginTop:12,background:`linear-gradient(135deg,${EPJ.blue},${EPJ.green})`,color:'#fff'}}>← Retour à l'accueil</button>
      </div>
    </div>
  );

  // ═══ HISTORY ═══
  if(view==="history") return(
    <div style={{fontFamily:font,background:EPJ.grayLight,minHeight:'100vh',maxWidth:520,margin:'0 auto'}}>
      <style>{css}</style>
      <Header title="Historique" back={true} backView="home" showCart={false}/>
      <div style={{padding:'8px 12px',background:'#fff',borderBottom:'1px solid #eee'}}>
        <div style={{display:'flex',gap:6}}>
          <select className="epj-input" value={historyFilter.statut} onChange={e=>setHistoryFilter(f=>({...f,statut:e.target.value}))} style={{flex:1,fontSize:12,padding:'8px 10px'}}><option value="">Tous statuts</option>{Object.keys(STATUS_COLORS).map(s=><option key={s} value={s}>{s}</option>)}</select>
          <select className="epj-input" value={historyFilter.chantier} onChange={e=>setHistoryFilter(f=>({...f,chantier:e.target.value}))} style={{flex:1,fontSize:12,padding:'8px 10px'}}><option value="">Tous chantiers</option>{[...new Set(history.filter(h=>h.chantier).map(h=>h.chantier))].map(c=><option key={c} value={c}>{c}</option>)}</select>
        </div>
      </div>
      <div style={{padding:12}}>
        {history.length===0?<div style={{textAlign:'center',padding:'50px 20px',color:EPJ.gray}}><div style={{fontSize:40,marginBottom:8}}>📋</div><div style={{fontWeight:600}}>Aucune commande</div></div>
        :history.filter(h=>h&&h.num).filter(h=>!historyFilter.statut||h.statut===historyFilter.statut).filter(h=>!historyFilter.chantier||h.chantier===historyFilter.chantier).map((h,i)=>(
          <div key={h._id||i} onClick={()=>{setSelectedOrder(h);setView('orderDetail')}} className="epj-card" style={{marginBottom:8,cursor:'pointer'}}>
            <div style={{display:'flex',justifyContent:'space-between'}}>
              <div><div style={{fontSize:14,fontWeight:700,color:EPJ.dark}}>{h.num}</div><div style={{fontSize:12,color:EPJ.gray}}>{h.date} • {h.user}</div><div style={{fontSize:12,color:EPJ.blue,marginTop:2}}>{h.type==='chantier'?`🏗️ [${h.numAffaire||''}] ${h.chantier||''}`:`👷 ${h.salarie||''}`}</div></div>
              <div style={{textAlign:'right'}}><div style={{fontSize:13,fontWeight:700,color:EPJ.dark,marginBottom:4}}>{(h.items||[]).length} réf.</div>{h.urgent&&<div style={{fontSize:10,background:EPJ.red,color:'#fff',padding:'2px 6px',borderRadius:4,fontWeight:700,marginBottom:4}}>URGENT</div>}<div className="status-pill" style={{background:STATUS_COLORS[h.statut]?.bg||'#eee',color:STATUS_COLORS[h.statut]?.color||'#333'}}>{STATUS_COLORS[h.statut]?.icon||''} {h.statut||'—'}</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

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
      if(!confirm("Initialiser la base avec les données par défaut ? (utilisateurs + chantiers + config)")) return;
      setAdminSaving(true);
      const r = await initEPJData();
      showT(r.message);
      if(r.users > 0) {
        // Also upload catalog
        showT("⏳ Chargement du catalogue...");
        const catCount = await uploadCatalog(CATALOG);
        showT(`✅ ${catCount} articles chargés`);
      }
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
              {adminSaving?'⏳ En cours...':'🔄 Initialiser Firebase (première fois)'}
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
            <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>{adminEdit==='new'?'Nouvel utilisateur':'Modifier l\'utilisateur'}</div>
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
              <div key={cat} onClick={()=>setSelectedCat(cat)} className="epj-card" style={{marginBottom:6,cursor:'pointer',display:'flex',alignItems:'center',gap:12}}>
                <span style={{fontSize:24}}>{dynCatIcons[cat]||'📦'}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:EPJ.dark}}>{cat}</div>
                  <div style={{fontSize:11,color:EPJ.gray}}>{dynCatalog.filter(p=>p.c===cat).length} articles • {[...new Set(dynCatalog.filter(p=>p.c===cat).map(p=>p.s))].length} sous-cat.</div>
                </div>
                <span style={{color:EPJ.gray}}>›</span>
              </div>
            ))}
          </>) : (<>
            <button className="epj-btn" onClick={()=>setSelectedCat(null)} style={{width:'100%',background:'#eee',color:EPJ.dark,padding:'10px',fontSize:13,marginBottom:12}}>← Toutes les catégories</button>
            <button className="epj-btn" onClick={()=>{setAdminEdit('newSub');setAdminForm({nom:''})}} style={{width:'100%',background:EPJ.green,color:'#fff',padding:'12px',fontSize:14,marginBottom:12}}>+ Nouvelle sous-catégorie dans {selectedCat}</button>
            {adminEdit==='newSub'&&<div className="epj-card" style={{marginBottom:12,border:`2px solid ${EPJ.blue}`}}>
              <input className="epj-input" placeholder="Nom de la sous-catégorie" value={adminForm.nom||''} onChange={e=>setAdminForm(p=>({...p,nom:e.target.value}))} style={{marginBottom:8,padding:'8px 10px',fontSize:13}}/>
              <div style={{display:'flex',gap:8}}>
                <button className="epj-btn" onClick={()=>{setAdminEdit(null);setAdminForm({})}} style={{flex:1,background:'#eee',color:EPJ.dark,padding:'10px'}}>Annuler</button>
                <button className="epj-btn" onClick={async()=>{
                  if(!adminForm.nom) return;
                  await setDoc(doc(db,"catalogue","__sub_"+selectedCat.replace(/\s/g,'_')+"_"+adminForm.nom.replace(/\s/g,'_')),{c:selectedCat,s:adminForm.nom,r:'',n:'(sous-catégorie vide)',u:'',img:''});
                  setAdminEdit(null);setAdminForm({});showT("✅ Sous-catégorie ajoutée");
                }} disabled={adminSaving||!adminForm.nom} style={{flex:1,background:EPJ.blue,color:'#fff',padding:'10px'}}>💾 Ajouter</button>
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
          <button className="epj-btn" onClick={()=>{setAdminEdit('newArt');setAdminForm({c:adminCatFilter||cats[0]||'',s:'',r:'',n:'',u:'Pièce',img:''})}} style={{width:'100%',background:EPJ.green,color:'#fff',padding:'12px',fontSize:14,marginBottom:12}}>+ Ajouter un article</button>
          {adminEdit&&(adminEdit==='newArt'||adminEdit.startsWith?.('edit_'))&&<div className="epj-card" style={{marginBottom:12,border:`2px solid ${EPJ.blue}`}}>
            <div style={{fontSize:14,fontWeight:700,marginBottom:10}}>{adminEdit==='newArt'?'Nouvel article':'Modifier l\'article'}</div>
            <div style={{marginBottom:8}}>
              <label style={{fontSize:11,fontWeight:700,color:EPJ.gray}}>CATÉGORIE</label>
              <select className="epj-input" value={adminForm.c||''} onChange={e=>setAdminForm(p=>({...p,c:e.target.value}))} style={{padding:'8px',fontSize:13}}>{cats.map(c=><option key={c}>{c}</option>)}</select>
            </div>
            {['s','r','n','u','img'].map(f=>(
              <div key={f} style={{marginBottom:8}}>
                <label style={{fontSize:11,fontWeight:700,color:EPJ.gray,display:'block',marginBottom:2}}>{f==='s'?'SOUS-CATÉGORIE':f==='r'?'RÉFÉRENCE':f==='n'?'DÉSIGNATION':f==='u'?'UNITÉ':'URL IMAGE'}</label>
                <input className="epj-input" value={adminForm[f]||''} onChange={e=>setAdminForm(p=>({...p,[f]:e.target.value}))} style={{padding:'8px 10px',fontSize:13}}/>
              </div>
            ))}
            {adminForm.img&&<div style={{marginBottom:8}}><img src={adminForm.img} alt="" style={{width:60,height:60,objectFit:'cover',borderRadius:8}} onError={e=>{e.target.style.display='none'}}/></div>}
            <div style={{display:'flex',gap:8}}>
              <button className="epj-btn" onClick={()=>{setAdminEdit(null);setAdminForm({})}} style={{flex:1,background:'#eee',color:EPJ.dark,padding:'10px'}}>Annuler</button>
              <button className="epj-btn" onClick={()=>{
                const docId = adminForm.r ? adminForm.r.replace(/[\/\s]/g,'_') : 'art_'+Date.now();
                adminSave('catalogue',docId,{c:adminForm.c,s:adminForm.s,r:adminForm.r,n:adminForm.n,u:adminForm.u||'Pièce',img:adminForm.img||''});
              }} disabled={adminSaving||!adminForm.r||!adminForm.n} style={{flex:1,background:EPJ.blue,color:'#fff',padding:'10px'}}>{adminSaving?'⏳':'💾 Sauvegarder'}</button>
            </div>
          </div>}
          <div style={{fontSize:12,color:EPJ.gray,marginBottom:8}}>{filtered.length} article(s)</div>
          {filtered.slice(0,50).map(p=>(
            <div key={p.r} className="epj-card" style={{marginBottom:4,display:'flex',alignItems:'center',gap:8,padding:'8px 12px'}}>
              {p.img?<img src={p.img} alt="" style={{width:36,height:36,borderRadius:6,objectFit:'cover'}}/>:<div style={{width:36,height:36,borderRadius:6,background:`${EPJ.blue}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:16}}>{dynCatIcons[p.c]||'📦'}</div>}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:12,fontWeight:600,color:EPJ.dark,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.n}</div>
                <div style={{fontSize:10,color:EPJ.gray,fontFamily:'monospace'}}>{p.r} • {p.s}</div>
              </div>
              <button onClick={()=>{setAdminEdit('edit_'+p.r);setAdminForm({...p})}} style={{background:EPJ.blue,color:'#fff',border:'none',borderRadius:8,padding:'4px 8px',fontSize:10,cursor:'pointer'}}>✏️</button>
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

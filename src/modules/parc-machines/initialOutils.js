// ═══════════════════════════════════════════════════════════════
//  initialOutils.js — Catalogue initial EPJ (généré depuis MATE_RIELS_categorise_1.xlsx)
//  223 outils répartis dans 18 catégories métier EPJ
//
//  Importé dans Firestore une seule fois via le bouton "Importer catalogue initial"
//  dans Admin → Catalogue outillage
// ═══════════════════════════════════════════════════════════════

export const INITIAL_CATEGORIES = [
  {
    "id": "carottage",
    "label": "Carottage",
    "icon": "🕳️",
    "ordre": 10,
    "actif": true
  },
  {
    "id": "chauffage_et_ventilation",
    "label": "Chauffage & Ventilation",
    "icon": "💨",
    "ordre": 20,
    "actif": true
  },
  {
    "id": "coffrets_et_alimentation",
    "label": "Coffrets & Alimentation",
    "icon": "🔋",
    "ordre": 30,
    "actif": true
  },
  {
    "id": "divers",
    "label": "Divers",
    "icon": "🧰",
    "ordre": 40,
    "actif": true
  },
  {
    "id": "decoupe",
    "label": "Découpe",
    "icon": "🪚",
    "ordre": 50,
    "actif": true
  },
  {
    "id": "fixation_et_clouage",
    "label": "Fixation & Clouage",
    "icon": "🔨",
    "ordre": 60,
    "actif": true
  },
  {
    "id": "laser_et_guidage",
    "label": "Laser & Guidage",
    "icon": "🎯",
    "ordre": 70,
    "actif": true
  },
  {
    "id": "marteaux_piqueurs",
    "label": "Marteaux-piqueurs",
    "icon": "⚒️",
    "ordre": 80,
    "actif": true
  },
  {
    "id": "mesure_et_test",
    "label": "Mesure & Test",
    "icon": "📏",
    "ordre": 90,
    "actif": true
  },
  {
    "id": "meches_forets_et_trepans",
    "label": "Mèches, Forets & Trépans",
    "icon": "🪛",
    "ordre": 100,
    "actif": true
  },
  {
    "id": "packs_wurth",
    "label": "Packs Würth",
    "icon": "🛠️",
    "ordre": 110,
    "actif": true
  },
  {
    "id": "perceuses_et_perforateurs",
    "label": "Perceuses & Perforateurs",
    "icon": "⚙️",
    "ordre": 120,
    "actif": true
  },
  {
    "id": "sertissage_et_pinces",
    "label": "Sertissage & Pinces",
    "icon": "🔧",
    "ordre": 130,
    "actif": true
  },
  {
    "id": "sondes_et_aiguilles_de_tirage",
    "label": "Sondes & Aiguilles de tirage",
    "icon": "🔌",
    "ordre": 140,
    "actif": true
  },
  {
    "id": "soudure_et_thermique",
    "label": "Soudure & Thermique",
    "icon": "🔥",
    "ordre": 150,
    "actif": true
  },
  {
    "id": "securite_et_signalisation",
    "label": "Sécurité & Signalisation",
    "icon": "🚧",
    "ordre": 160,
    "actif": true
  },
  {
    "id": "visseuses",
    "label": "Visseuses",
    "icon": "🔩",
    "ordre": 170,
    "actif": true
  },
  {
    "id": "echelles_et_echafaudages",
    "label": "Échelles & Échafaudages",
    "icon": "🪜",
    "ordre": 180,
    "actif": true
  }
];

export const INITIAL_OUTILS = [
  {
    "ref": "TOR SQU44 N1",
    "nom": "PORTE ANTISQUATT N°1",
    "categorieId": "securite_et_signalisation",
    "codeBarres": ""
  },
  {
    "ref": "AIGUILLE/D00007",
    "nom": "AIGUILLE D5 ROUGE",
    "categorieId": "sondes_et_aiguilles_de_tirage",
    "codeBarres": ""
  },
  {
    "ref": "AIGUILLE/D00006",
    "nom": "AIGUILLES D10 ROUGE",
    "categorieId": "sondes_et_aiguilles_de_tirage",
    "codeBarres": ""
  },
  {
    "ref": "RAINUREUSE00002",
    "nom": "ASPIRATEUR SPIT AC1625",
    "categorieId": "decoupe",
    "codeBarres": ""
  },
  {
    "ref": "AIGUILLE/D00001",
    "nom": "Aiguille acier nylon 6mm N°1",
    "categorieId": "sondes_et_aiguilles_de_tirage",
    "codeBarres": ""
  },
  {
    "ref": "AIGUILLE/D00002",
    "nom": "Aiguille acier nylon 6mm N°2",
    "categorieId": "sondes_et_aiguilles_de_tirage",
    "codeBarres": ""
  },
  {
    "ref": "CAROTTEUSE00001",
    "nom": "CAROTTEUSE WURTH DS 130-P",
    "categorieId": "carottage",
    "codeBarres": ""
  },
  {
    "ref": "SERTISSAGE00007",
    "nom": "CLÉ DYNAMOMÉTRIQUE 1/2 BETA",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": ""
  },
  {
    "ref": "SERTISSAGE00009",
    "nom": "COFFRET BTR BETA",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": ""
  },
  {
    "ref": "SERTISSAGE00006",
    "nom": "COFFRET CLIQUET BETA",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": ""
  },
  {
    "ref": "COFFRETDEC00001",
    "nom": "COFFRET DE BRANCHEMENT CHANTIER MONOPHASE 30/60A",
    "categorieId": "coffrets_et_alimentation",
    "codeBarres": ""
  },
  {
    "ref": "CAROTTEUSE00003",
    "nom": "COLONNE CAROTTEUSE WURTH",
    "categorieId": "carottage",
    "codeBarres": ""
  },
  {
    "ref": "DIVERS00001",
    "nom": "COMPRESSEUR MECAFER 24L",
    "categorieId": "coffrets_et_alimentation",
    "codeBarres": ""
  },
  {
    "ref": "MESURE/TES00002",
    "nom": "CONTROLEUR SEFRAM MW9660",
    "categorieId": "mesure_et_test",
    "codeBarres": ""
  },
  {
    "ref": "AIGUILLE/D00010",
    "nom": "CORDE POUR TREUIL",
    "categorieId": "sondes_et_aiguilles_de_tirage",
    "codeBarres": ""
  },
  {
    "ref": "CAROTTEUSE00006",
    "nom": "COURONNE ZEBRA Ø112 X 400 MM N°1",
    "categorieId": "carottage",
    "codeBarres": ""
  },
  {
    "ref": "CAROTTEUSE00007",
    "nom": "COURONNE ZEBRA Ø112 X 400 MM N°2",
    "categorieId": "carottage",
    "codeBarres": ""
  },
  {
    "ref": "DIVERS00009",
    "nom": "DECAPEUR STEINEL 1",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": ""
  },
  {
    "ref": "DIVERS00010",
    "nom": "DECAPEUR STEINEL 2",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": ""
  },
  {
    "ref": "DIVERS00003",
    "nom": "DECAPEUR THERMIQUE BOSH PHG 500-2",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": ""
  },
  {
    "ref": "DISQUEUSE/00003",
    "nom": "DECOUPEUSE BETON STIHL TS240",
    "categorieId": "decoupe",
    "codeBarres": ""
  },
  {
    "ref": "AIGUILLE/D00003",
    "nom": "DEROULEUR DE CABLE ROTOMAX N°1",
    "categorieId": "sondes_et_aiguilles_de_tirage",
    "codeBarres": ""
  },
  {
    "ref": "AIGUILLE/D00004",
    "nom": "DEROULEUR DE CABLE ROTOMAX N°2",
    "categorieId": "sondes_et_aiguilles_de_tirage",
    "codeBarres": ""
  },
  {
    "ref": "DISQUEUSE/00001",
    "nom": "DISQUEUSE MAKITA G9020 N°1",
    "categorieId": "decoupe",
    "codeBarres": ""
  },
  {
    "ref": "DISQUEUSE/00002",
    "nom": "DISQUEUSE MAKITA G9020 N°2",
    "categorieId": "decoupe",
    "codeBarres": ""
  },
  {
    "ref": "ECHELLE00001",
    "nom": "ECHELLE TELESCOPIQUE 1",
    "categorieId": "echelles_et_echafaudages",
    "codeBarres": ""
  },
  {
    "ref": "ECHELLE00002",
    "nom": "ECHELLE TELESCOPIQUE 2",
    "categorieId": "echelles_et_echafaudages",
    "codeBarres": ""
  },
  {
    "ref": "ECHELLE00003",
    "nom": "ECHELLE TELESCOPIQUE 3",
    "categorieId": "echelles_et_echafaudages",
    "codeBarres": ""
  },
  {
    "ref": "DIVERS00004",
    "nom": "FER A SOUDER",
    "categorieId": "soudure_et_thermique",
    "codeBarres": ""
  },
  {
    "ref": "CAROTTEUSE00004",
    "nom": "KIT FIXATION CAROTTEUSE WURTH",
    "categorieId": "carottage",
    "codeBarres": ""
  },
  {
    "ref": "LASER00002",
    "nom": "LASER BOSH PLL360",
    "categorieId": "laser_et_guidage",
    "codeBarres": ""
  },
  {
    "ref": "LASER00001",
    "nom": "LASER PLS HVR505R",
    "categorieId": "laser_et_guidage",
    "codeBarres": ""
  },
  {
    "ref": "SCIECLOCHE00005",
    "nom": "MECHE A BOIS 26MM",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX00009",
    "nom": "MECHE Ø16 1 M",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX00005",
    "nom": "MECHE Ø16 SDS MAX",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX00014",
    "nom": "MECHE Ø22 SDS MAX",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX00006",
    "nom": "MECHE Ø28 SDS MAX",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX00007",
    "nom": "MECHE Ø38 SDS MAX",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX00008",
    "nom": "MECHE Ø40 SDS MAX",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "MESURE/TES00001",
    "nom": "MESUREUR DE CHAMP SEFRAM",
    "categorieId": "mesure_et_test",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX00012",
    "nom": "Méche Ø22 1m SDS MAX",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR01",
    "nom": "PACK 1 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR10",
    "nom": "PACK 10 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR11",
    "nom": "PACK 11 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR12 ANCIEN",
    "nom": "PACK 12 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR13",
    "nom": "PACK 13 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR14",
    "nom": "PACK 14 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR15",
    "nom": "PACK 15 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR16",
    "nom": "PACK 16 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR17",
    "nom": "PACK 17 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR18",
    "nom": "PACK 18 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR19",
    "nom": "PACK 19 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR02",
    "nom": "PACK 2 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR20",
    "nom": "PACK 20 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR03",
    "nom": "PACK 3 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR04",
    "nom": "PACK 4 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR05",
    "nom": "PACK 5 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR06",
    "nom": "PACK 6 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR07",
    "nom": "PACK 7 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR08",
    "nom": "PACK 8 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR09",
    "nom": "PACK 9 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PERFORATEU00026",
    "nom": "PERFORATEUR FILAIRE SPIT 321 N°1",
    "categorieId": "perceuses_et_perforateurs",
    "codeBarres": ""
  },
  {
    "ref": "PERFORATEU00027",
    "nom": "PERFORATEUR FILAIRE SPIT 321 N°2",
    "categorieId": "perceuses_et_perforateurs",
    "codeBarres": ""
  },
  {
    "ref": "PERFORATEU00028",
    "nom": "PERFORATEUR FILAIRE SPIT 321 N°3",
    "categorieId": "perceuses_et_perforateurs",
    "codeBarres": ""
  },
  {
    "ref": "SERTISSAGE00004",
    "nom": "PINCE A SERTIR 6 / 50 mm² BLEU",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": ""
  },
  {
    "ref": "SERTISSAGE00005",
    "nom": "PINCE A SERTIR 6 / 50 mm² NOIR",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": ""
  },
  {
    "ref": "SERTISSAGE00003",
    "nom": "PINCE A SERTIR VERTE",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": ""
  },
  {
    "ref": "MARTEAUPIQ00001",
    "nom": "PIQUEUR SPIT 353 N°1",
    "categorieId": "marteaux_piqueurs",
    "codeBarres": ""
  },
  {
    "ref": "MARTEAUPIQ00005",
    "nom": "PIQUEUR SPIT 353 N°5",
    "categorieId": "marteaux_piqueurs",
    "codeBarres": ""
  },
  {
    "ref": "MARTEAUPIQ00006",
    "nom": "PIQUEUR SPIT 353 N°6",
    "categorieId": "marteaux_piqueurs",
    "codeBarres": ""
  },
  {
    "ref": "MARTEAUPIQ00008",
    "nom": "PIQUEUR WURTH N°1",
    "categorieId": "marteaux_piqueurs",
    "codeBarres": ""
  },
  {
    "ref": "MARTEAUPIQ00010",
    "nom": "PIQUEUR WURTH N°2",
    "categorieId": "marteaux_piqueurs",
    "codeBarres": ""
  },
  {
    "ref": "MARTEAUPIQ00011",
    "nom": "PIQUEUR WURTH N°3",
    "categorieId": "marteaux_piqueurs",
    "codeBarres": ""
  },
  {
    "ref": "MARTEAUPIQ00012",
    "nom": "PIQUEUR WURTH N°4",
    "categorieId": "marteaux_piqueurs",
    "codeBarres": ""
  },
  {
    "ref": "MARTEAUPIQ00013",
    "nom": "PIQUEUR WURTH N°5",
    "categorieId": "marteaux_piqueurs",
    "codeBarres": ""
  },
  {
    "ref": "PULSA00001",
    "nom": "PULSA SPIT 800E",
    "categorieId": "fixation_et_clouage",
    "codeBarres": ""
  },
  {
    "ref": "RAINUREUSE00001",
    "nom": "RAINUREUSE SPIT D90 N°1",
    "categorieId": "decoupe",
    "codeBarres": ""
  },
  {
    "ref": "CAROTTEUSE00002",
    "nom": "RALLONGE CAROTTEUSE WURTH",
    "categorieId": "carottage",
    "codeBarres": ""
  },
  {
    "ref": "CAROTTEUSE00008",
    "nom": "RESERVOIR D'EAU WURTH",
    "categorieId": "carottage",
    "codeBarres": ""
  },
  {
    "ref": "SCIECLOCHE00002",
    "nom": "SCICLOCHE REGLABE",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "SCIECLOCHE00003",
    "nom": "SCIE CIRCULAIRE MAKITA",
    "categorieId": "decoupe",
    "codeBarres": ""
  },
  {
    "ref": "SCIECLOCHE00004",
    "nom": "SCIE CLOCHE Ø152",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "DISQUEUSE/00007",
    "nom": "SCIE SABRE 230V",
    "categorieId": "decoupe",
    "codeBarres": ""
  },
  {
    "ref": "MESURE/TES00007",
    "nom": "SONDE D18",
    "categorieId": "mesure_et_test",
    "codeBarres": ""
  },
  {
    "ref": "MESURE/TES00008",
    "nom": "SONDE V6",
    "categorieId": "mesure_et_test",
    "codeBarres": ""
  },
  {
    "ref": "DIVERS00015",
    "nom": "SOUFLEUR MAKITA",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": ""
  },
  {
    "ref": "SCIECLOCHE00001",
    "nom": "Scie-cloche au carbure Ø68 N°1",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "MESURE/TES00003",
    "nom": "TESTEUR DE TERRE",
    "categorieId": "mesure_et_test",
    "codeBarres": ""
  },
  {
    "ref": "MESURE/TES00004",
    "nom": "TESTEUR RJ45 + METRIX TURBOTECH",
    "categorieId": "mesure_et_test",
    "codeBarres": ""
  },
  {
    "ref": "DIVERS00002",
    "nom": "THERMO-FOREUR WURTH N°1",
    "categorieId": "carottage",
    "codeBarres": ""
  },
  {
    "ref": "SERTISSAGE00001",
    "nom": "TOURNEVIS DYNANOMETRIQUE N°1",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": ""
  },
  {
    "ref": "SERTISSAGE00002",
    "nom": "TOURNEVIS DYNANOMETRIQUE N°2",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX00001",
    "nom": "TREPANT Ø68 SDS MAX N°1",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX00002",
    "nom": "TREPANT Ø68 SDS MAX N°2",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX00003",
    "nom": "TREPANT Ø68 SDS MAX N°3",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX00010",
    "nom": "TREPANT Ø68 SDS MAX N°4",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX00011",
    "nom": "TREPANT Ø68 SDS MAX N°5",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX00015",
    "nom": "TREPANT Ø68 SDS MAX N°6",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX00004",
    "nom": "TREPANT Ø90 SDS MAX",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "AIGUILLE/D00009",
    "nom": "TREUIL THERMIQUE",
    "categorieId": "sondes_et_aiguilles_de_tirage",
    "codeBarres": ""
  },
  {
    "ref": "MESURE/TES00005",
    "nom": "TESTEUR BORNE IRVE",
    "categorieId": "mesure_et_test",
    "codeBarres": ""
  },
  {
    "ref": "MESURE/TES00006",
    "nom": "V LOC3 PRO",
    "categorieId": "mesure_et_test",
    "codeBarres": ""
  },
  {
    "ref": "VISSEUSE00001",
    "nom": "VISSEUSE SPIT BS 18 N°1",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "VISSEUSE00010",
    "nom": "VISSEUSE SPIT BS 18 N°10",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "VISSEUSE00011",
    "nom": "VISSEUSE SPIT BS 18 N°11",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "VISSEUSE00012",
    "nom": "VISSEUSE SPIT BS 18 N°12",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "VISSEUSE00013",
    "nom": "VISSEUSE SPIT BS 18 N°13",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "VISSEUSE00014",
    "nom": "VISSEUSE SPIT BS 18 N°14",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "VISSEUSE00015",
    "nom": "VISSEUSE SPIT BS 18 N°15",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "VISSEUSE00002",
    "nom": "VISSEUSE SPIT BS 18 N°2",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "VISSEUSE00003",
    "nom": "VISSEUSE SPIT BS 18 N°3",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "VISSEUSE00004",
    "nom": "VISSEUSE SPIT BS 18 N°4",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "VISSEUSE00005",
    "nom": "VISSEUSE SPIT BS 18 N°5",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "VISSEUSE00006",
    "nom": "VISSEUSE SPIT BS 18 N°6",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "VISSEUSE00007",
    "nom": "VISSEUSE SPIT BS 18 N°7",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "VISSEUSE00008",
    "nom": "VISSEUSE SPIT BS 18 N°8",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "VISSEUSE00009",
    "nom": "VISSEUSE SPIT BS 18 N°9",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "SERTISSAGE00008",
    "nom": "SERTISSEUSE HYDRAULIQUE EKM 60/22 KLAUKE",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": ""
  },
  {
    "ref": "SERTISSAGE00010",
    "nom": "PINCE A SERTIR EMBOUT 25 / 50 mm²",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": ""
  },
  {
    "ref": "SERTISSAGE00011",
    "nom": "PINCE A SERTIR EMBOUT 50 / 95 mm²",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": ""
  },
  {
    "ref": "SERTISSAGE00012",
    "nom": "PINCE A SERTIR K22 KLAUKE",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": ""
  },
  {
    "ref": "SERTISSAGE00013",
    "nom": "CLÉ DYNAMOMÉTRIQUE 1/4 WURTH",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": ""
  },
  {
    "ref": "MESURE/TES00009",
    "nom": "CAMERA THERMIQUE SEFRAM",
    "categorieId": "mesure_et_test",
    "codeBarres": ""
  },
  {
    "ref": "TOR SQU44 N2",
    "nom": "PORTE ANTISQUATT N°2",
    "categorieId": "securite_et_signalisation",
    "codeBarres": ""
  },
  {
    "ref": "TOR SQU44 N3",
    "nom": "PORTE ANTISQUATT N°3",
    "categorieId": "securite_et_signalisation",
    "codeBarres": ""
  },
  {
    "ref": "TOR SQU44 N4",
    "nom": "PORTE ANTISQUATT N°4",
    "categorieId": "securite_et_signalisation",
    "codeBarres": ""
  },
  {
    "ref": "TOR SQU44 N5",
    "nom": "PORTE ANTISQUATT N°5",
    "categorieId": "securite_et_signalisation",
    "codeBarres": ""
  },
  {
    "ref": "TOR SQU44 N6",
    "nom": "PORTE ANTISQUATT N°6",
    "categorieId": "securite_et_signalisation",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX00016",
    "nom": "MECHE Ø20 SDS MAX",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "ECHELLE00004",
    "nom": "ECHELLE PARISIENNE",
    "categorieId": "echelles_et_echafaudages",
    "codeBarres": ""
  },
  {
    "ref": "ECHELLE00005",
    "nom": "ESCABEAU 12 MARCHES",
    "categorieId": "echelles_et_echafaudages",
    "codeBarres": ""
  },
  {
    "ref": "ECHELLE00006",
    "nom": "ESCABEAU 8 MARCHES",
    "categorieId": "echelles_et_echafaudages",
    "codeBarres": ""
  },
  {
    "ref": "DIVERS00005",
    "nom": "POSTE A SOUDER",
    "categorieId": "soudure_et_thermique",
    "codeBarres": ""
  },
  {
    "ref": "PERFORATEU00029",
    "nom": "PERFORATEUR FILAIRE SPIT 321 N°4",
    "categorieId": "perceuses_et_perforateurs",
    "codeBarres": ""
  },
  {
    "ref": "SERTISSAGE00014",
    "nom": "PINCE A SERTIR AUTOMATIQUE EMBOUT 6 / 10 mm²",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": ""
  },
  {
    "ref": "MESURE/TES00011",
    "nom": "TESTEUR RJ45 CPJ20",
    "categorieId": "mesure_et_test",
    "codeBarres": ""
  },
  {
    "ref": "MESURE/TES00012",
    "nom": "TESTEUR RJ45 CPJ20",
    "categorieId": "mesure_et_test",
    "codeBarres": ""
  },
  {
    "ref": "MESURE/TES00013",
    "nom": "TESTEUR RJ45 CPJ20",
    "categorieId": "mesure_et_test",
    "codeBarres": ""
  },
  {
    "ref": "MESURE/TES00014",
    "nom": "TESTEUR RJ45 CPJ20",
    "categorieId": "mesure_et_test",
    "codeBarres": ""
  },
  {
    "ref": "MESURE/TES00015",
    "nom": "TESTEUR RJ45 CPJ20",
    "categorieId": "mesure_et_test",
    "codeBarres": ""
  },
  {
    "ref": "SCIEFEIN1",
    "nom": "SCIE FEIN 1",
    "categorieId": "decoupe",
    "codeBarres": "FEIN"
  },
  {
    "ref": "LASER00004",
    "nom": "LASER BOSH / GCL2-15G",
    "categorieId": "laser_et_guidage",
    "codeBarres": ""
  },
  {
    "ref": "VIN 2608900148",
    "nom": "MECHE D 22MM X 600MM",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": "2608900148"
  },
  {
    "ref": "PISTO001",
    "nom": "Pisto 58-MK",
    "categorieId": "fixation_et_clouage",
    "codeBarres": "ATTACHE"
  },
  {
    "ref": "PISTO002",
    "nom": "Pisto 58-MK",
    "categorieId": "fixation_et_clouage",
    "codeBarres": "ATTACHE"
  },
  {
    "ref": "BOULONNEUSE001",
    "nom": "Hitachi WH180BDL",
    "categorieId": "fixation_et_clouage",
    "codeBarres": "BOULONEUSE001"
  },
  {
    "ref": "SDSMAX00017",
    "nom": "SDS PLUS Ø22 40CM",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": "SDS PLUS 22 40CM"
  },
  {
    "ref": "VIN 2061933",
    "nom": "FORET A BETON SDS PLUS 5X PRO 22X550X600",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": "6949509227829"
  },
  {
    "ref": "VIN 0266240",
    "nom": "COUPE BOULON SAM n 1/600MM​​​​​​​",
    "categorieId": "decoupe",
    "codeBarres": ""
  },
  {
    "ref": "VIN 0268330",
    "nom": "COUPE BOULON KAPRIOL 750MM",
    "categorieId": "decoupe",
    "codeBarres": "VIN 0268330"
  },
  {
    "ref": "MALETTE ODACE",
    "nom": "MALETTE ODACE",
    "categorieId": "coffrets_et_alimentation",
    "codeBarres": "MALETTE ODACE"
  },
  {
    "ref": "VIN 2010917",
    "nom": "FORET BETON SDSPLUS 7X EXPERT 30X400X450",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": "VIN 2010917"
  },
  {
    "ref": "VIN 0420476",
    "nom": "MECHE BOIS CYLIN 26X200 FAMMAB 84260235",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": "VIN 0420476"
  },
  {
    "ref": "VIN 0420505",
    "nom": "MECHE BOIS PLATE 28X160 53002800",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": "VIN 0420505"
  },
  {
    "ref": "VIN 0269105",
    "nom": "CLEX TORX JEU DE 7 FACOM 89SR.J 7PB",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": "VIN 0269105"
  },
  {
    "ref": "GR20B",
    "nom": "DECOUPEUSE A BATTERIE ATDV",
    "categorieId": "decoupe",
    "codeBarres": "GR20B"
  },
  {
    "ref": "WUR 070022701",
    "nom": "Scie circulaire à batterie Li-Ion 28 V HKS 28-A",
    "categorieId": "decoupe",
    "codeBarres": "WUR 070022701"
  },
  {
    "ref": "WUR 07002172",
    "nom": "Scie sauteuse à batterie APS 18 compact M-CUBE",
    "categorieId": "decoupe",
    "codeBarres": "WUR 07002172"
  },
  {
    "ref": "VIN 0425061",
    "nom": "MECHE BOIS SDS+ 26X450 FAMMAB 88260450",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": "VIN 0425061"
  },
  {
    "ref": "MAN A008662",
    "nom": "Dérouleur touret avec système de blocage du rouleau - 800 kg",
    "categorieId": "sondes_et_aiguilles_de_tirage",
    "codeBarres": "MAN A008662"
  },
  {
    "ref": "BAUDRIER",
    "nom": "BAUDRIER",
    "categorieId": "securite_et_signalisation",
    "codeBarres": "BAUDRIER"
  },
  {
    "ref": "BIZ700012",
    "nom": "Pince à sertir les cosses et manchons de puissance en cuivre de 6 à 50 mm²",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": "BIZ700012"
  },
  {
    "ref": "HARNAIS DE SECURITE 1",
    "nom": "HARNAIS DE SECURITE",
    "categorieId": "securite_et_signalisation",
    "codeBarres": "HARNAIS DE SECURITE"
  },
  {
    "ref": "CONE DE CHANTIER",
    "nom": "CONE DE CHANTIER",
    "categorieId": "securite_et_signalisation",
    "codeBarres": "CONE DE CHANTIER"
  },
  {
    "ref": "CAMERA TELESCOPIQUE",
    "nom": "CAMERA TELESCOPIQUE",
    "categorieId": "mesure_et_test",
    "codeBarres": "CAMERA TELESCOPIQUE"
  },
  {
    "ref": "PINCE PHOTOVOLTAIQUE",
    "nom": "PINCE PHOTOVOLTAIQUE",
    "categorieId": "mesure_et_test",
    "codeBarres": "PINCE PHOTOVOLTAIQUE"
  },
  {
    "ref": "TOURNEVIS ELECTRIQUE SANS FIL N° 1",
    "nom": "Tournevis Electrique sans fil N°1",
    "categorieId": "visseuses",
    "codeBarres": "TOURNEVIS ELECTRIQUE SANS FIL"
  },
  {
    "ref": "TOURNEVIS ELECTRIQUE SANS FIL N° 2",
    "nom": "TOURNEVIS ELECTRIQUE SANS FIL N° 2",
    "categorieId": "visseuses",
    "codeBarres": "TOURNEVIS ELECTRIQUE SANS FIL N° 2"
  },
  {
    "ref": "TOURNEVIS ELECTRIQUE SANS FIL N° 3",
    "nom": "TOURNEVIS ELECTRIQUE SANS FIL N° 3",
    "categorieId": "visseuses",
    "codeBarres": "TOURNEVIS ELECTRIQUE SANS FIL N° 3"
  },
  {
    "ref": "P93-0 N°1",
    "nom": "Aérotherme P Tiger portable 9kW 400V 720m3/h",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": "P93-0"
  },
  {
    "ref": "P93-0 N°2",
    "nom": "Aérotherme P Tiger portable 9kW 400V 720m3/h",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": "P93-0 N°2"
  },
  {
    "ref": "P93-0 N°3",
    "nom": "Aérotherme P Tiger portable 9kW 400V 720m3/h",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": "P93-0 N°3"
  },
  {
    "ref": "P93-0 N°4",
    "nom": "Aérotherme P Tiger portable 9kW 400V 720m3/h",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": "P93-0 N°4"
  },
  {
    "ref": "P93-0 N°5",
    "nom": "Aérotherme P Tiger portable 9kW 400V 720m3/h",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": "P93-0 N°5"
  },
  {
    "ref": "P93-0 N°6",
    "nom": "Aérotherme P Tiger portable 9kW 400V 720m3/h",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": "P93-0"
  },
  {
    "ref": "TLS503T N°1",
    "nom": "Convecteur mobile TLS503T - 800 / 1200 / 2000 W",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": "TLS503T N°1"
  },
  {
    "ref": "TLS503T N°2",
    "nom": "Convecteur mobile TLS503T - 800 / 1200 / 2000 W",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": "TLS503T N°2"
  },
  {
    "ref": "TLS503T N°3",
    "nom": "Convecteur mobile TLS503T - 800 / 1200 / 2000 W",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": "TLS503T N°3"
  },
  {
    "ref": "TLS503T N°4",
    "nom": "Convecteur mobile TLS503T - 800 / 1200 / 2000 W",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": "TLS503T N°4"
  },
  {
    "ref": "TOURNEVIS ELECTRIQUE SANS FIL N° 4",
    "nom": "TOURNEVIS ELECTRIQUE SANS FIL N° 4",
    "categorieId": "visseuses",
    "codeBarres": "TOURNEVIS ELECTRIQUE SANS FIL N° 4"
  },
  {
    "ref": "TOURNEVIS ELECTRIQUE SANS FIL N° 5",
    "nom": "TOURNEVIS ELECTRIQUE SANS FIL N° 5",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "TOURNEVIS ELECTRIQUE SANS FIL N° 6",
    "nom": "TOURNEVIS ELECTRIQUE SANS FIL N° 6",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "TOURNEVIS ELECTRIQUE SANS FIL N° 7",
    "nom": "TOURNEVIS ELECTRIQUE SANS FIL N° 7",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "TOURNEVIS ELECTRIQUE SANS FIL N° 8",
    "nom": "TOURNEVIS ELECTRIQUE SANS FIL N° 8",
    "categorieId": "visseuses",
    "codeBarres": ""
  },
  {
    "ref": "753306",
    "nom": "Échafaudage roulant aluminium Speed-up XL hauteur de travail 6,70 m CENTAURE",
    "categorieId": "echelles_et_echafaudages",
    "codeBarres": ""
  },
  {
    "ref": "SCIE CLOCHE 152 MM",
    "nom": "SCIE CLOCHE 152 MM",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": "SCIE CLOCHE 152 MM"
  },
  {
    "ref": "P93-0 N°7",
    "nom": "Aérotherme P Tiger portable 9kW 400V 720m3/h",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": ""
  },
  {
    "ref": "P93-0 N°8",
    "nom": "Aérotherme P Tiger portable 9kW 400V 720m3/h",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": "P93-0 N°8"
  },
  {
    "ref": "AIMANT 001",
    "nom": "LOT N°1 (x30) - Aimant classique 800N",
    "categorieId": "divers",
    "codeBarres": "BLI 755108"
  },
  {
    "ref": "AIGUILLE/D00005 N° 2",
    "nom": "DEROULEUR DE CABLE ROUGE BIZLINE N°2",
    "categorieId": "sondes_et_aiguilles_de_tirage",
    "codeBarres": "AIGUILLE/D00005"
  },
  {
    "ref": "AIMANT 002",
    "nom": "LOT N°2 (X30) - Aimant classique 800N",
    "categorieId": "divers",
    "codeBarres": "BLI 755108"
  },
  {
    "ref": "AIMANT 003",
    "nom": "LOT N°3 (x30) - Aimant classique 800N",
    "categorieId": "divers",
    "codeBarres": "AIMANT 003"
  },
  {
    "ref": "AIMANT 004",
    "nom": "LOT N°4 (x30) - Aimant classique 800N",
    "categorieId": "divers",
    "codeBarres": "AIMANT 004"
  },
  {
    "ref": "SERTISSAGE00015",
    "nom": "COFFRET CLIQUET BETA N°2",
    "categorieId": "sertissage_et_pinces",
    "codeBarres": ""
  },
  {
    "ref": "VDV500-820",
    "nom": "Kit traceur de câbles Tone & Probe 2E génération",
    "categorieId": "mesure_et_test",
    "codeBarres": "VDV500-820"
  },
  {
    "ref": "TOR SQU44 N7",
    "nom": "PORTE ANTISQUATT N°7",
    "categorieId": "securite_et_signalisation",
    "codeBarres": ""
  },
  {
    "ref": "SCIERADIAL001",
    "nom": "SCIE RADIALE A METAL",
    "categorieId": "decoupe",
    "codeBarres": "SCIE"
  },
  {
    "ref": "LASERLINE",
    "nom": "GUIDE DE PERCAGE PRECIS",
    "categorieId": "laser_et_guidage",
    "codeBarres": "LASERLINE"
  },
  {
    "ref": "SDSMAX00018",
    "nom": "TREPANT Ø68 SDS MAX N°7",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "MAN A008662 N°2",
    "nom": "Dérouleur touret avec système de blocage du rouleau - 800 kg",
    "categorieId": "sondes_et_aiguilles_de_tirage",
    "codeBarres": "MAN A008662 N°2"
  },
  {
    "ref": "HARNAIS DE SECURITE 2",
    "nom": "HARNAIS DE SECURITE",
    "categorieId": "securite_et_signalisation",
    "codeBarres": "HARNAIS DE SECURITE 2"
  },
  {
    "ref": "SICLOCHE DE 200",
    "nom": "SICLOCHE DE 200",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": "SICLOCHE DE 200"
  },
  {
    "ref": "COUPE CABLE M",
    "nom": "COUPE CABLE MOYEN",
    "categorieId": "decoupe",
    "codeBarres": "COUPE CABLE M"
  },
  {
    "ref": "MECHE A BOIS 22 40 CM",
    "nom": "MECHE A BOIS 22 40 CM",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": "MECHE A BOIS 22 40 CM"
  },
  {
    "ref": "MECHE A BOIS 12 20 CM",
    "nom": "MECHE A BOIS 12 20 CM",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": "MECHE A BOIS 12 20 CM"
  },
  {
    "ref": "PONCEUSE",
    "nom": "PONCEUSE",
    "categorieId": "decoupe",
    "codeBarres": ""
  },
  {
    "ref": "COUPE CABLE P",
    "nom": "COUPE CABLE PETIT",
    "categorieId": "decoupe",
    "codeBarres": "COUPE CABLE P"
  },
  {
    "ref": "DIVERS00006",
    "nom": "THERMO-FOREUR WURTH N°2",
    "categorieId": "carottage",
    "codeBarres": ""
  },
  {
    "ref": "SDSMAX000017",
    "nom": "MECHE Ø22 SDS MAX",
    "categorieId": "meches_forets_et_trepans",
    "codeBarres": ""
  },
  {
    "ref": "MARTEAUPIQ00014",
    "nom": "PIQUEUR WURTH N°6",
    "categorieId": "marteaux_piqueurs",
    "codeBarres": ""
  },
  {
    "ref": "MARTEAUPIQ00015",
    "nom": "PIQUEUR WURTH N°7",
    "categorieId": "marteaux_piqueurs",
    "codeBarres": ""
  },
  {
    "ref": "MARTEAUPIQ00016",
    "nom": "PIQUEUR WURTH N°8",
    "categorieId": "marteaux_piqueurs",
    "codeBarres": ""
  },
  {
    "ref": "MARTEAUPIQ00017",
    "nom": "PIQUEUR WURTH N°9",
    "categorieId": "marteaux_piqueurs",
    "codeBarres": ""
  },
  {
    "ref": "MARTEAUPIQ00018",
    "nom": "PIQUEUR WURTH N°10",
    "categorieId": "marteaux_piqueurs",
    "codeBarres": ""
  },
  {
    "ref": "TLS503T N°5",
    "nom": "Convecteur mobile TLS503T - 800 / 1200 / 2000 W",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": "TLS503T N°5"
  },
  {
    "ref": "TLS503T N°6",
    "nom": "Convecteur mobile TLS503T - 800 / 1200 / 2000 W",
    "categorieId": "chauffage_et_ventilation",
    "codeBarres": "TLS503T N°6"
  },
  {
    "ref": "CHALU 1",
    "nom": "chalumeau gaz",
    "categorieId": "soudure_et_thermique",
    "codeBarres": "CHALU 1"
  },
  {
    "ref": "PACKWUR21",
    "nom": "PACK 21 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR22",
    "nom": "PACK 22 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR23",
    "nom": "PACK 23 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR24",
    "nom": "PACK 24 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "PACKWUR25",
    "nom": "PACK 25 COMBO TOP 3",
    "categorieId": "packs_wurth",
    "codeBarres": ""
  },
  {
    "ref": "RAINUREUSE",
    "nom": "rainureuse",
    "categorieId": "decoupe",
    "codeBarres": "RAINUREUSE"
  }
];

export const INITIAL_PANNES = [
  { code: "PAN",      libelle: "PANNE PERCUSSION",        bloquante: false, actif: true },
  { code: "PANBAT",   libelle: "PANNE BATTERIE",          bloquante: false, actif: true },
  { code: "PANCHARG", libelle: "PANNE CHARGEUR",          bloquante: false, actif: true },
  { code: "PANCORD",  libelle: "CORDON D'ALIMENTATION HS", bloquante: true,  actif: true },
  { code: "PANDISQ",  libelle: "PANNE DISQUEUSE",         bloquante: false, actif: true },
  { code: "PANPERF",  libelle: "PANNE PERFORATEUR",       bloquante: false, actif: true },
  { code: "PANPIQ",   libelle: "PANNE MARTEAU PIQUEUR",   bloquante: false, actif: true },
  { code: "PANVIS",   libelle: "PANNE VISSEUSE",          bloquante: false, actif: true },
];

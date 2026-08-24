/**
 * Phase 1 ontology subset — representative, not complete.
 * The full Telangana ontology (all 33 districts, complete mandal lists,
 * complete scheme/crop/input vocabularies) extends these arrays without
 * touching matching or pipeline code.
 */
import type { DistrictEntry, OntologyTerm, TopicEntry } from "./types";

export const TELANGANA_MARKERS: OntologyTerm = {
  id: "telangana",
  en: "Telangana",
  te: "తెలంగాణ",
  variants: ["telangana", "తెలంగాణ", "తెలంగాణా", "telangana state", "ts govt"],
};

export const DISTRICTS: DistrictEntry[] = [
  {
    id: "hyderabad",
    en: "Hyderabad",
    te: "హైదరాబాద్",
    variants: ["hyderabad", "హైదరాబాద్", "hyd"],
  },
  {
    id: "karimnagar",
    en: "Karimnagar",
    te: "కరీంనగర్",
    variants: ["karimnagar", "కరీంనగర్", "karim nagar"],
    mandals: [
      {
        id: "huzurabad",
        en: "Huzurabad",
        te: "హుజూరాబాద్",
        variants: ["huzurabad", "హుజూరాబాద్", "huzoorabad"],
      },
    ],
  },
  {
    id: "warangal",
    en: "Warangal",
    te: "వరంగల్",
    variants: ["warangal", "వరంగల్", "warangal urban", "warangal rural"],
  },
  {
    id: "nizamabad",
    en: "Nizamabad",
    te: "నిజామాబాద్",
    variants: ["nizamabad", "నిజామాబాద్"],
  },
  {
    id: "mahabubnagar",
    en: "Mahabubnagar",
    te: "మహబూబ్‌నగర్",
    variants: [
      "mahabubnagar",
      "mahbubnagar",
      "మహబూబ్‌నగర్",
      "మహబూబ్ నగర్",
      "palamuru",
      "పాలమూరు",
    ],
  },
  {
    id: "nalgonda",
    en: "Nalgonda",
    te: "నల్గొండ",
    variants: ["nalgonda", "నల్గొండ", "నల్లగొండ"],
  },
];

export const TOPICS: TopicEntry[] = [
  {
    id: "fertilizer-availability",
    en: "Fertilizer availability",
    te: "ఎరువుల లభ్యత",
    variants: [
      "fertilizer",
      "fertiliser",
      "fertilizers",
      "ఎరువు",
      "ఎరువులు",
      "dap",
      "డీఏపీ",
      "డి.ఎ.పి",
      "urea",
      "యూరియా",
    ],
    subtopics: [
      {
        id: "dap-availability",
        en: "DAP availability",
        variants: ["dap", "డీఏపీ", "డి.ఎ.పి", "di-ammonium phosphate"],
      },
      {
        id: "black-market-sales",
        en: "Above-MRP / black market sales",
        variants: ["black market", "బ్లాక్", "mrp కంటే ఎక్కువ", "above mrp", "బ్లాక్ లో"],
      },
    ],
  },
  {
    id: "rainfall",
    en: "Rainfall",
    te: "వర్షపాతం",
    variants: [
      "rainfall",
      "rain deficit",
      "వర్షం",
      "వర్షాలు",
      "వాన",
      "వర్షపాతం",
      "drought",
      "కరువు",
      "monsoon",
    ],
  },
  {
    id: "procurement",
    en: "Procurement",
    te: "కొనుగోలు",
    variants: [
      "procurement",
      "msp",
      "కొనుగోలు",
      "కొనుగోళ్లు",
      "మద్దతు ధర",
      "ధాన్యం కొనుగోలు",
      "paddy purchase",
      "procurement payment",
    ],
    subtopics: [
      {
        id: "payment-delay",
        en: "Payment delays",
        variants: ["payment delay", "payments delayed", "డబ్బులు పడలేదు", "డబ్బులు రాలేదు"],
      },
    ],
  },
  {
    id: "crop-damage",
    en: "Crop damage",
    te: "పంట నష్టం",
    variants: ["crop loss", "crop damage", "పంట నష్టం", "పంటనష్టం", "crops damaged"],
  },
  {
    id: "farmer-support-schemes",
    en: "Farmer support schemes",
    te: "రైతు సంక్షేమ పథకాలు",
    variants: [
      "rythu bharosa",
      "raithu bharosa",
      "రైతు భరోసా",
      "rythu bima",
      "రైతు బీమా",
      "input subsidy",
    ],
  },
  {
    id: "agricultural-power",
    en: "Agricultural power supply",
    te: "వ్యవసాయ విద్యుత్",
    variants: [
      "power supply",
      "power cut",
      "electricity",
      "కరెంటు",
      "విద్యుత్",
      "transformer",
      "ట్రాన్స్‌ఫార్మర్",
    ],
  },
  {
    id: "pest-outbreak",
    en: "Pest outbreak",
    te: "పురుగు ఉధృతి",
    variants: ["pest", "pink bollworm", "గులాబీ పురుగు", "పురుగు", "తెగులు", "bollworm"],
  },
];

export const INPUTS: OntologyTerm[] = [
  {
    id: "dap",
    en: "DAP",
    te: "డీఏపీ",
    variants: ["dap", "డీఏపీ", "డి.ఎ.పి", "di-ammonium phosphate"],
  },
  { id: "urea", en: "Urea", te: "యూరియా", variants: ["urea", "యూరియా"] },
  {
    id: "seed",
    en: "Seed",
    te: "విత్తనాలు",
    variants: ["seeds", "seed supply", "విత్తనాలు", "విత్తనం", "fake seeds", "నకిలీ విత్తనాలు"],
    exclusions: ["seed funding", "seed round"],
  },
];

export const CROPS: OntologyTerm[] = [
  {
    id: "paddy",
    en: "Paddy",
    te: "వరి",
    variants: ["paddy", "వరి", "ధాన్యం", "rice crop", "వరి నాట్లు"],
  },
  { id: "cotton", en: "Cotton", te: "పత్తి", variants: ["cotton", "పత్తి"] },
  { id: "maize", en: "Maize", te: "మొక్కజొన్న", variants: ["maize", "మొక్కజొన్న", "corn crop"] },
];

export const SCHEMES: OntologyTerm[] = [
  {
    id: "rythu-bharosa",
    en: "Rythu Bharosa",
    te: "రైతు భరోసా",
    variants: ["rythu bharosa", "raithu bharosa", "rytu bharosa", "రైతు భరోసా"],
  },
  {
    id: "rythu-bima",
    en: "Rythu Bima",
    te: "రైతు బీమా",
    variants: ["rythu bima", "raithu bima", "రైతు బీమా"],
  },
];

export const GOVERNMENT_ENTITIES: OntologyTerm[] = [
  {
    id: "agriculture-department",
    en: "Agriculture Department",
    te: "వ్యవసాయ శాఖ",
    variants: [
      "agriculture department",
      "వ్యవసాయ శాఖ",
      "వ్యవసాయశాఖ",
      "dept of agriculture",
      "agri department",
    ],
  },
  {
    id: "agriculture-minister",
    en: "Agriculture Minister",
    te: "వ్యవసాయ మంత్రి",
    variants: ["agriculture minister", "వ్యవసాయ మంత్రి", "agri minister"],
  },
  {
    id: "civil-supplies",
    en: "Civil Supplies",
    te: "పౌర సరఫరాల శాఖ",
    variants: ["civil supplies", "పౌర సరఫరాల"],
  },
  {
    id: "district-administration",
    en: "District administration",
    variants: ["district collector", "కలెక్టర్", "district administration"],
  },
  {
    id: "pjtsau",
    en: "PJTSAU",
    variants: ["pjtsau", "agricultural university", "వ్యవసాయ విశ్వవిద్యాలయం"],
  },
];

/**
 * Generic agriculture markers — used by the relevance gate in addition to
 * topics/crops/inputs/schemes. A text is agriculture-relevant if it matches
 * any of these families.
 */
export const AGRICULTURE_MARKERS: OntologyTerm = {
  id: "agriculture",
  en: "Agriculture",
  te: "వ్యవసాయం",
  variants: [
    "farmer",
    "farmers",
    "రైతు",
    "రైతులు",
    "agriculture",
    "agricultural",
    "వ్యవసాయం",
    "వ్యవసాయ",
    "farming",
    "crop",
    "crops",
    "పంట",
    "పంటలు",
    "sowing",
    "rabi",
    "kharif",
    "రబీ",
    "ఖరీఫ్",
  ],
};

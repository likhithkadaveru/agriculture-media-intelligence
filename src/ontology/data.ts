/**
 * Telangana agriculture listening ontology — configuration, not code.
 * Every concept: canonical id, English/Telugu labels, variants
 * (English spellings, Telugu forms, transliterations), exclusions.
 *
 * Districts live in ./districts.ts (all 33).
 */
import type { GovernmentEntityEntry, OntologyTerm, TopicEntry } from "./types";

export { DISTRICTS } from "./districts";

export const TELANGANA_MARKERS: OntologyTerm = {
  id: "telangana",
  en: "Telangana",
  te: "తెలంగాణ",
  variants: ["telangana", "తెలంగాణ", "తెలంగాణా", "telangana state", "ts govt"],
};

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
      "complex fertilizer",
      "కాంప్లెక్స్ ఎరువులు",
    ],
    subtopics: [
      {
        id: "dap-availability",
        en: "DAP availability",
        variants: ["dap", "డీఏపీ", "డి.ఎ.పి", "di-ammonium phosphate"],
      },
      {
        id: "urea-availability",
        en: "Urea availability",
        variants: ["urea", "యూరియా"],
      },
      {
        id: "black-market-sales",
        en: "Above-MRP / black market sales",
        variants: ["black market", "బ్లాక్", "mrp కంటే ఎక్కువ", "above mrp", "బ్లాక్ లో"],
      },
      {
        id: "fertilizer-price",
        en: "Fertilizer price",
        variants: ["fertilizer price", "ఎరువుల ధర", "ఎరువుల ధరలు", "price of dap"],
      },
    ],
  },
  {
    id: "seeds",
    en: "Seed availability and quality",
    te: "విత్తనాలు",
    variants: [
      "seeds",
      "seed supply",
      "విత్తనాలు",
      "విత్తనం",
      "fake seeds",
      "నకిలీ విత్తనాలు",
      "spurious seeds",
      "seed shortage",
      "విత్తన కొరత",
    ],
    exclusions: ["seed funding", "seed round"],
    subtopics: [
      {
        id: "fake-seeds",
        en: "Fake / spurious seeds",
        variants: ["fake seeds", "spurious seeds", "నకిలీ విత్తనాలు", "కల్తీ విత్తనాలు"],
      },
      {
        id: "seed-availability",
        en: "Seed availability",
        variants: ["seed shortage", "seed supply", "విత్తన కొరత", "విత్తనాల కొరత"],
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
      "వానలు",
      "వర్షపాతం",
      "monsoon",
      "రుతుపవన",
    ],
    subtopics: [
      {
        id: "rainfall-deficit",
        en: "Rainfall deficit",
        variants: ["rain deficit", "deficit rainfall", "వర్షాభావం", "వర్షాలు తక్కువ", "లోటు వర్షపాతం"],
      },
      {
        id: "drought",
        en: "Drought",
        variants: ["drought", "కరువు", "కరవు"],
      },
      {
        id: "flooding",
        en: "Flooding / heavy rain",
        variants: ["flood", "floods", "flooding", "వరద", "వరదలు", "heavy rain", "భారీ వర్షాలు", "కుండపోత"],
      },
    ],
  },
  {
    id: "procurement",
    en: "Procurement and MSP",
    te: "కొనుగోలు",
    variants: [
      "procurement",
      "msp",
      "minimum support price",
      "కొనుగోలు",
      "కొనుగోళ్లు",
      "మద్దతు ధర",
      "కనీస మద్దతు ధర",
      "ధాన్యం కొనుగోలు",
      "paddy purchase",
      "procurement centre",
      "కొనుగోలు కేంద్రం",
      "కొనుగోలు కేంద్రాలు",
    ],
    subtopics: [
      {
        id: "payment-delay",
        en: "Payment delays",
        variants: [
          "payment delay",
          "payments delayed",
          "payment pending",
          "డబ్బులు పడలేదు",
          "డబ్బులు రాలేదు",
          "చెల్లింపులు ఆలస్యం",
        ],
      },
      {
        id: "msp-demand",
        en: "MSP demands",
        variants: ["msp demand", "మద్దతు ధర డిమాండ్", "bonus over msp", "బోనస్"],
      },
    ],
  },
  {
    id: "crop-damage",
    en: "Crop loss and damage",
    te: "పంట నష్టం",
    variants: [
      "crop loss",
      "crop damage",
      "crops damaged",
      "పంట నష్టం",
      "పంటనష్టం",
      "పంటలు దెబ్బతిన్నాయి",
      "crop failure",
      "compensation for crop",
      "పంట నష్ట పరిహారం",
    ],
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
      "పెట్టుబడి సాయం",
      "farmer support payment",
    ],
    subtopics: [
      {
        id: "rythu-bharosa-payment",
        en: "Rythu Bharosa payments",
        variants: ["rythu bharosa", "రైతు భరోసా"],
      },
      {
        id: "loan-waiver",
        en: "Crop loan waiver",
        variants: ["loan waiver", "రుణమాఫీ", "runa mafi", "crop loan waiver", "పంట రుణ మాఫీ"],
      },
      {
        id: "crop-insurance",
        en: "Crop insurance",
        variants: ["crop insurance", "పంటల బీమా", "పంట బీమా", "fasal bima"],
      },
    ],
  },
  {
    id: "agricultural-power",
    en: "Agricultural power supply",
    te: "వ్యవసాయ విద్యుత్",
    variants: [
      "power supply to agriculture",
      "power cut",
      "free power",
      "కరెంటు",
      "విద్యుత్",
      "ఉచిత విద్యుత్",
      "transformer",
      "ట్రాన్స్‌ఫార్మర్",
      "24 గంటల కరెంట్",
    ],
  },
  {
    id: "irrigation",
    en: "Irrigation and water availability",
    te: "సాగునీరు",
    variants: [
      "irrigation",
      "సాగునీరు",
      "సాగు నీరు",
      "canal water",
      "కాలువ నీరు",
      "project water",
      "borewell",
      "బోరు",
      "చెరువు",
      "reservoir release",
    ],
  },
  {
    id: "pest-outbreak",
    en: "Pest and disease outbreak",
    te: "పురుగు ఉధృతి",
    variants: [
      "pest",
      "pest attack",
      "pink bollworm",
      "గులాబీ పురుగు",
      "పురుగు",
      "తెగులు",
      "తెగుళ్లు",
      "bollworm",
      "brown planthopper",
      "దోమ పోటు",
      "వైరస్ తెగులు",
    ],
  },
  {
    id: "market-price",
    en: "Market prices",
    te: "మార్కెట్ ధర",
    variants: [
      "market price",
      "market rate",
      "మార్కెట్ ధర",
      "ధర పతనం",
      "price crash",
      "price fall",
      "ధరలు పడిపోయాయి",
      "మద్దతు ధర లేదు",
      "market yard",
      "మార్కెట్ యార్డ్",
    ],
  },
  {
    id: "agricultural-credit",
    en: "Agricultural credit",
    te: "పంట రుణాలు",
    variants: [
      "crop loan",
      "crop loans",
      "పంట రుణం",
      "పంట రుణాలు",
      "agricultural credit",
      "kisan credit",
      "రుణం ఇవ్వడం లేదు",
    ],
  },
  {
    id: "input-cost",
    en: "Input costs",
    te: "పెట్టుబడి ఖర్చు",
    variants: [
      "input cost",
      "cost of cultivation",
      "పెట్టుబడి ఖర్చు",
      "సాగు ఖర్చు",
      "పెట్టుబడి పెరిగింది",
    ],
  },
  {
    id: "farm-mechanisation",
    en: "Farm mechanisation",
    te: "వ్యవసాయ యాంత్రీకరణ",
    variants: [
      "farm mechanisation",
      "farm mechanization",
      "యాంత్రీకరణ",
      "tractor subsidy",
      "ట్రాక్టర్ సబ్సిడీ",
      "harvester",
      "హార్వెస్టర్",
    ],
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
    id: "fertilizer",
    en: "Fertilizer",
    te: "ఎరువులు",
    variants: ["fertilizer", "fertiliser", "ఎరువు", "ఎరువులు"],
  },
  {
    id: "seed",
    en: "Seed",
    te: "విత్తనాలు",
    variants: ["seeds", "seed supply", "విత్తనాలు", "విత్తనం"],
    exclusions: ["seed funding", "seed round"],
  },
  {
    id: "pesticide",
    en: "Pesticides",
    te: "పురుగుమందులు",
    variants: ["pesticide", "pesticides", "పురుగుమందు", "పురుగుమందులు", "పురుగు మందులు"],
  },
  {
    id: "electricity",
    en: "Electricity",
    te: "విద్యుత్",
    variants: ["electricity", "power supply", "విద్యుత్", "కరెంటు"],
  },
  {
    id: "irrigation-water",
    en: "Irrigation water",
    te: "సాగునీరు",
    variants: ["irrigation", "సాగునీరు", "సాగు నీరు"],
  },
  {
    id: "credit",
    en: "Agricultural credit",
    te: "పంట రుణం",
    variants: ["crop loan", "పంట రుణం", "agricultural credit"],
  },
];

export const CROPS: OntologyTerm[] = [
  {
    id: "paddy",
    en: "Paddy",
    te: "వరి",
    variants: ["paddy", "వరి", "ధాన్యం", "rice crop", "వరి నాట్లు", "వడ్లు"],
  },
  { id: "cotton", en: "Cotton", te: "పత్తి", variants: ["cotton", "పత్తి", "kapas"] },
  {
    id: "maize",
    en: "Maize",
    te: "మొక్కజొన్న",
    variants: ["maize", "మొక్కజొన్న", "corn crop", "makka", "మక్క"],
  },
  {
    id: "chilli",
    en: "Chilli",
    te: "మిర్చి",
    variants: ["chilli", "chillies", "mirchi", "మిర్చి", "మిరప", "red chilli"],
  },
  {
    id: "turmeric",
    en: "Turmeric",
    te: "పసుపు",
    variants: ["turmeric", "పసుపు", "పసుపు పంట"],
  },
  {
    id: "soybean",
    en: "Soybean",
    te: "సోయాబీన్",
    variants: ["soybean", "soya", "సోయా", "సోయాబీన్"],
  },
  {
    id: "red-gram",
    en: "Red gram (pigeon pea)",
    te: "కంది",
    variants: ["red gram", "redgram", "pigeon pea", "tur dal", "కంది", "కందులు"],
  },
  {
    id: "green-gram",
    en: "Green gram",
    te: "పెసర",
    variants: ["green gram", "moong", "పెసర", "పెసలు"],
  },
  {
    id: "bengal-gram",
    en: "Bengal gram",
    te: "శనగ",
    variants: ["bengal gram", "chana", "శనగ", "శనగలు"],
  },
  {
    id: "groundnut",
    en: "Groundnut",
    te: "వేరుశనగ",
    variants: ["groundnut", "peanut crop", "వేరుశనగ", "పల్లీ"],
  },
  {
    id: "horticulture",
    en: "Horticulture",
    te: "ఉద్యాన పంటలు",
    variants: [
      "horticulture",
      "ఉద్యాన",
      "vegetables",
      "కూరగాయలు",
      "mango",
      "మామిడి",
      "fruit crop",
      "పండ్ల తోట",
    ],
  },
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
  {
    id: "crop-insurance",
    en: "Crop insurance",
    te: "పంటల బీమా",
    variants: ["crop insurance", "పంటల బీమా", "పంట బీమా", "fasal bima"],
  },
  {
    id: "loan-waiver",
    en: "Crop loan waiver",
    te: "రుణమాఫీ",
    variants: ["loan waiver", "రుణమాఫీ", "runa mafi", "crop loan waiver", "పంట రుణ మాఫీ"],
  },
  {
    id: "farm-mechanisation-scheme",
    en: "Farm mechanisation support",
    te: "యాంత్రీకరణ పథకం",
    variants: ["farm mechanisation scheme", "tractor subsidy", "ట్రాక్టర్ సబ్సిడీ", "యాంత్రీకరణ"],
  },
];

export const GOVERNMENT_ENTITIES: GovernmentEntityEntry[] = [
  {
    id: "agriculture-department",
    agricultureSpecific: true,
    en: "Agriculture Department",
    te: "వ్యవసాయ శాఖ",
    variants: [
      "agriculture department",
      "వ్యవసాయ శాఖ",
      "వ్యవసాయశాఖ",
      "dept of agriculture",
      "agri department",
      "agriculture officer",
      "వ్యవసాయ అధికారి",
    ],
  },
  {
    id: "agriculture-minister",
    agricultureSpecific: true,
    en: "Agriculture Minister",
    te: "వ్యవసాయ మంత్రి",
    variants: ["agriculture minister", "వ్యవసాయ మంత్రి", "agri minister", "వ్యవసాయ శాఖ మంత్రి"],
  },
  {
    id: "civil-supplies",
    agricultureSpecific: false,
    en: "Civil Supplies",
    te: "పౌర సరఫరాల శాఖ",
    variants: ["civil supplies", "పౌర సరఫరాల"],
  },
  {
    id: "district-administration",
    agricultureSpecific: false,
    en: "District administration",
    variants: ["district collector", "కలెక్టర్", "district administration"],
  },
  {
    id: "agricultural-marketing",
    agricultureSpecific: true,
    en: "Agricultural Marketing",
    te: "వ్యవసాయ మార్కెటింగ్",
    variants: ["agricultural marketing", "market committee", "మార్కెట్ కమిటీ", "marketing department"],
  },
  {
    id: "pjtsau",
    agricultureSpecific: true,
    en: "Agricultural University (PJTSAU)",
    variants: ["pjtsau", "agricultural university", "వ్యవసాయ విశ్వవిద్యాలయం", "agriculture university"],
  },
  {
    id: "cmo",
    agricultureSpecific: false,
    en: "Chief Minister / CMO",
    te: "ముఖ్యమంత్రి",
    variants: ["chief minister", "ముఖ్యమంత్రి", "cm revanth", "సీఎం"],
  },
];

/**
 * Generic agriculture markers — used by the relevance gate in addition to
 * topics/crops/inputs/schemes.
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
    "harvest",
    "కోత",
    "rabi",
    "kharif",
    "రబీ",
    "ఖరీఫ్",
    "వానాకాలం",
    "యాసంగి",
  ],
};

/**
 * All 33 districts of Telangana — official English name, Telugu name,
 * spelling variants and common transliterations/aliases.
 *
 * Mandal lists are intentionally sparse (Phase 2 requires district-level
 * intelligence); the structure supports district → mandal → village later.
 */
import type { DistrictEntry } from "./types";

export const DISTRICTS: DistrictEntry[] = [
  {
    id: "adilabad",
    en: "Adilabad",
    te: "ఆదిలాబాద్",
    variants: ["adilabad", "ఆదిలాబాద్", "ఆదిలాబాదు"],
  },
  {
    id: "komaram-bheem-asifabad",
    en: "Komaram Bheem Asifabad",
    te: "కుమురం భీం ఆసిఫాబాద్",
    variants: [
      "asifabad",
      "komaram bheem",
      "kumram bheem",
      "కుమురం భీం",
      "ఆసిఫాబాద్",
    ],
  },
  {
    id: "mancherial",
    en: "Mancherial",
    te: "మంచిర్యాల",
    variants: ["mancherial", "manchiryala", "మంచిర్యాల"],
  },
  {
    id: "nirmal",
    en: "Nirmal",
    te: "నిర్మల్",
    variants: ["nirmal district", "నిర్మల్"],
    exclusions: ["nirmala sitharaman"],
  },
  {
    id: "nizamabad",
    en: "Nizamabad",
    te: "నిజామాబాద్",
    variants: ["nizamabad", "నిజామాబాద్", "indur", "ఇందూరు"],
  },
  {
    id: "jagtial",
    en: "Jagtial",
    te: "జగిత్యాల",
    variants: ["jagtial", "jagityal", "jagitial", "జగిత్యాల"],
  },
  {
    id: "peddapalli",
    en: "Peddapalli",
    te: "పెద్దపల్లి",
    variants: ["peddapalli", "peddapally", "పెద్దపల్లి"],
  },
  {
    id: "kamareddy",
    en: "Kamareddy",
    te: "కామారెడ్డి",
    variants: ["kamareddy", "కామారెడ్డి"],
  },
  {
    id: "rajanna-sircilla",
    en: "Rajanna Sircilla",
    te: "రాజన్న సిరిసిల్ల",
    variants: ["sircilla", "sircilla", "సిరిసిల్ల", "rajanna sircilla"],
  },
  {
    id: "karimnagar",
    en: "Karimnagar",
    te: "కరీంనగర్",
    variants: ["karimnagar", "karim nagar", "కరీంనగర్"],
    mandals: [
      {
        id: "huzurabad",
        en: "Huzurabad",
        te: "హుజూరాబాద్",
        variants: ["huzurabad", "huzoorabad", "హుజూరాబాద్"],
      },
    ],
  },
  {
    id: "jayashankar-bhupalpally",
    en: "Jayashankar Bhupalpally",
    te: "జయశంకర్ భూపాలపల్లి",
    variants: ["bhupalpally", "bhupalapally", "భూపాలపల్లి", "jayashankar"],
  },
  {
    id: "sangareddy",
    en: "Sangareddy",
    te: "సంగారెడ్డి",
    variants: ["sangareddy", "sanga reddy", "సంగారెడ్డి"],
  },
  {
    id: "medak",
    en: "Medak",
    te: "మెదక్",
    variants: ["medak", "మెదక్"],
    exclusions: ["medchal"],
  },
  {
    id: "siddipet",
    en: "Siddipet",
    te: "సిద్దిపేట",
    variants: ["siddipet", "siddipeta", "సిద్దిపేట"],
  },
  {
    id: "jangaon",
    en: "Jangaon",
    te: "జనగామ",
    variants: ["jangaon", "janagama", "janagaon", "జనగామ"],
  },
  {
    id: "hanumakonda",
    en: "Hanumakonda",
    te: "హనుమకొండ",
    variants: ["hanumakonda", "hanamkonda", "హనుమకొండ", "warangal urban"],
  },
  {
    id: "warangal",
    en: "Warangal",
    te: "వరంగల్",
    variants: ["warangal", "వరంగల్", "warangal rural", "orugallu", "ఓరుగల్లు"],
    exclusions: ["warangal urban"],
  },
  {
    id: "mulugu",
    en: "Mulugu",
    te: "ములుగు",
    variants: ["mulugu", "ములుగు"],
  },
  {
    id: "bhadradri-kothagudem",
    en: "Bhadradri Kothagudem",
    te: "భద్రాద్రి కొత్తగూడెం",
    variants: ["kothagudem", "bhadradri", "కొత్తగూడెం", "భద్రాద్రి"],
  },
  {
    id: "khammam",
    en: "Khammam",
    te: "ఖమ్మం",
    variants: ["khammam", "ఖమ్మం"],
  },
  {
    id: "mahabubabad",
    en: "Mahabubabad",
    te: "మహబూబాబాద్",
    variants: ["mahabubabad", "mahaboobabad", "మహబూబాబాద్", "manukota", "మానుకోట"],
    exclusions: ["mahabubnagar", "mahbubnagar"],
  },
  {
    id: "suryapet",
    en: "Suryapet",
    te: "సూర్యాపేట",
    variants: ["suryapet", "suryapeta", "సూర్యాపేట"],
  },
  {
    id: "nalgonda",
    en: "Nalgonda",
    te: "నల్గొండ",
    variants: ["nalgonda", "నల్గొండ", "నల్లగొండ"],
  },
  {
    id: "yadadri-bhuvanagiri",
    en: "Yadadri Bhuvanagiri",
    te: "యాదాద్రి భువనగిరి",
    variants: ["yadadri", "bhuvanagiri", "bhongir", "యాదాద్రి", "భువనగిరి", "భొంగీర్"],
  },
  {
    id: "medchal-malkajgiri",
    en: "Medchal–Malkajgiri",
    te: "మేడ్చల్ మల్కాజిగిరి",
    variants: ["medchal", "malkajgiri", "మేడ్చల్", "మల్కాజిగిరి"],
  },
  {
    id: "hyderabad",
    en: "Hyderabad",
    te: "హైదరాబాద్",
    variants: ["hyderabad", "హైదరాబాద్", "bhagyanagar"],
  },
  {
    id: "ranga-reddy",
    en: "Ranga Reddy",
    te: "రంగారెడ్డి",
    variants: ["ranga reddy", "rangareddy", "రంగారెడ్డి"],
  },
  {
    id: "vikarabad",
    en: "Vikarabad",
    te: "వికారాబాద్",
    variants: ["vikarabad", "వికారాబాద్"],
  },
  {
    id: "narayanpet",
    en: "Narayanpet",
    te: "నారాయణపేట",
    variants: ["narayanpet", "narayanapet", "నారాయణపేట"],
  },
  {
    id: "mahabubnagar",
    en: "Mahabubnagar",
    te: "మహబూబ్‌నగర్",
    variants: [
      "mahabubnagar",
      "mahbubnagar",
      "mahaboobnagar",
      "మహబూబ్‌నగర్",
      "మహబూబ్ నగర్",
      "palamuru",
      "పాలమూరు",
    ],
    exclusions: ["mahabubabad"],
  },
  {
    id: "nagarkurnool",
    en: "Nagarkurnool",
    te: "నాగర్‌కర్నూల్",
    variants: ["nagarkurnool", "nagar kurnool", "నాగర్‌కర్నూల్", "నాగర్ కర్నూల్"],
    exclusions: ["kurnool district"],
  },
  {
    id: "wanaparthy",
    en: "Wanaparthy",
    te: "వనపర్తి",
    variants: ["wanaparthy", "wanaparthi", "వనపర్తి"],
  },
  {
    id: "jogulamba-gadwal",
    en: "Jogulamba Gadwal",
    te: "జోగులాంబ గద్వాల",
    variants: ["gadwal", "jogulamba", "గద్వాల", "జోగులాంబ"],
  },
];

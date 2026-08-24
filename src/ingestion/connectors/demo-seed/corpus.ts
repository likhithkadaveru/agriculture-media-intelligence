/**
 * DEVELOPMENT SEED CORPUS — data_origin = "demo_seed" on every item.
 *
 * Purpose: exercise raw item → normalization → relevance → enrichment →
 * narrative → finding → evidence with zero external credentials.
 *
 * Nothing here is a real post, article, statement, person or organisation.
 * Authors, outlets, channels, URLs (demo.invalid) and engagement figures are
 * fictional. `devTranslation` fields are translations authored together with
 * the corpus (recorded as translation_provenance = "seed_authored"), because
 * no LLM credential is assumed during development.
 *
 * Payload shapes deliberately mimic the platform APIs each future live
 * connector will produce, so normalization code paths are the real ones.
 */

export interface SeedItem {
  platform: "youtube" | "x" | "news" | "official" | "web";
  externalId: string;
  publishedAt: string; // ISO
  payload: unknown;
  devTranslation?: string;
}

const D = "2026-08"; // corpus month

export const SEED_CORPUS: SeedItem[] = [
  /* ---------------- DAP / fertilizer availability narrative ---------------- */

  // 1. Farmer post, Telugu, Karimnagar (Huzurabad mandal)
  {
    platform: "x",
    externalId: "seed-x-001",
    publishedAt: `${D}-21T06:42:00+05:30`,
    devTranslation:
      "In Huzurabad mandal of Karimnagar district, DAP has not been available for three days. Farmers keep going back and forth to the society. Sowing time is passing. #DAP #Telangana",
    payload: {
      id: "seed-x-001",
      text: "కరీంనగర్ జిల్లా హుజూరాబాద్ మండలంలో మూడు రోజులుగా డీఏపీ దొరకడం లేదు. రైతులు సొసైటీ చుట్టూ తిరుగుతున్నారు. విత్తే సమయం దాటిపోతోంది. #DAP #తెలంగాణ",
      url: "https://demo.invalid/x/seed-x-001",
      author: {
        name: "Rythu Voice KMR (demo)",
        handle: "rythu_kmr_demo",
        bio: "రైతు, హుజూరాబాద్. వ్యవసాయం మా జీవితం.",
      },
      metrics: { likes: 45, reposts: 12, replies: 8 },
    },
  },

  // 2. Farmer post, Telugu, Warangal — black-market angle
  {
    platform: "x",
    externalId: "seed-x-002",
    publishedAt: `${D}-21T09:15:00+05:30`,
    devTranslation:
      "In Warangal, DAP bags are being sold on the black market above MRP. The Agriculture Department should pay attention. How can farmers afford this?",
    payload: {
      id: "seed-x-002",
      text: "వరంగల్ లో డీఏపీ బస్తాలు బ్లాక్ లో MRP కంటే ఎక్కువకి అమ్ముతున్నారు. వ్యవసాయ శాఖ పట్టించుకోవాలి. రైతులు ఎలా భరించాలి?",
      url: "https://demo.invalid/x/seed-x-002",
      author: {
        name: "Warangal Rythu (demo)",
        handle: "wgl_rythu_demo",
        bio: "Farmer from Warangal district. వరి, పత్తి సాగు.",
      },
      metrics: { likes: 89, reposts: 31, replies: 14 },
    },
  },

  // 3. Farmer post, mixed Telugu/English, Nalgonda
  {
    platform: "x",
    externalId: "seed-x-003",
    publishedAt: `${D}-22T07:58:00+05:30`,
    devTranslation:
      "In Nalgonda they say there is no DAP stock. Only urea is available. If it is like this at paddy sowing time, how will we manage?",
    payload: {
      id: "seed-x-003",
      text: "Nalgonda lo DAP stock ledu antunnaru. యూరియా మాత్రమే ఉంది. వరి వేసే టైంలో ఇలా అయితే ఎలా? #farmers #Telangana",
      url: "https://demo.invalid/x/seed-x-003",
      author: {
        name: "NLG Farmer Diary (demo)",
        handle: "nlg_farmer_demo",
        bio: "చిన్న రైతు, నల్గొండ జిల్లా",
      },
      metrics: { likes: 27, reposts: 6, replies: 4 },
    },
  },

  // 4. Farmer organisation statement, English, multi-district
  {
    platform: "x",
    externalId: "seed-x-004",
    publishedAt: `${D}-22T11:30:00+05:30`,
    payload: {
      id: "seed-x-004",
      text: "Our members in Karimnagar and Warangal report DAP shortages at primary agricultural cooperative societies for the past week. We urge the Agriculture Department to release stocks to the affected mandals immediately. #Telangana #DAP",
      url: "https://demo.invalid/x/seed-x-004",
      author: {
        name: "Telangana Rythu Sangham (demo)",
        handle: "trs_sangham_demo",
        bio: "Farmer organisation working for Telangana farmers. రైతు సంఘం.",
      },
      metrics: { likes: 210, reposts: 96, replies: 22 },
    },
  },

  // 5. Second independent Karimnagar farmer voice, Telugu
  {
    platform: "x",
    externalId: "seed-x-005",
    publishedAt: `${D}-22T17:05:00+05:30`,
    devTranslation:
      "At our society they said there is no DAP. A private dealer is selling it at ₹1,600 per bag. Where should a farmer go?",
    payload: {
      id: "seed-x-005",
      text: "మా సొసైటీలో డీఏపీ లేదని చెప్పారు. ప్రైవేట్ డీలర్ దగ్గర బస్తా ₹1600కి అమ్ముతున్నారు. రైతు ఎక్కడికి పోవాలి? కరీంనగర్",
      url: "https://demo.invalid/x/seed-x-005",
      author: {
        name: "Pedda Rythu (demo)",
        handle: "pedda_rythu_demo",
        bio: "రైతు — కరీంనగర్",
      },
      metrics: { likes: 63, reposts: 18, replies: 9 },
    },
  },

  // 6. Agriculture creator video, Telugu, Warangal ground report
  {
    platform: "youtube",
    externalId: "seed-yt-001",
    publishedAt: `${D}-22T14:00:00+05:30`,
    devTranslation:
      "Is the DAP shortage real? Farmers' difficulties — ground report. We visited societies in Warangal district: in three places farmers were told stock had run out. Watch what farmers say.",
    payload: {
      videoId: "seed-yt-001",
      snippet: {
        title: "డీఏపీ కొరత నిజమేనా? రైతుల ఇబ్బందులు | గ్రౌండ్ రిపోర్ట్",
        description:
          "వరంగల్ జిల్లాలో సొసైటీల వద్ద పరిశీలన. మూడు చోట్ల స్టాక్ అయిపోయిందని రైతులకు చెప్పారు. రైతులు ఏమంటున్నారో చూడండి. #DAP #తెలంగాణ #వ్యవసాయం",
        channelTitle: "Telugu Vyavasayam (demo)",
        channelDescription: "వ్యవసాయ వీడియోలు — farming content creator",
      },
      statistics: { viewCount: "84210", likeCount: "3900", commentCount: "412" },
      url: "https://demo.invalid/yt/seed-yt-001",
      durationSeconds: 512,
    },
  },

  // 7. TV news bulletin video, Telugu, statewide framing
  {
    platform: "youtube",
    externalId: "seed-yt-002",
    publishedAt: `${D}-23T08:30:00+05:30`,
    devTranslation:
      "DAP shortage in Telangana? Farmer distress reported in several districts. Farmers say supply at societies is irregular; officials say stocks are sufficient.",
    payload: {
      videoId: "seed-yt-002",
      snippet: {
        title: "తెలంగాణలో డీఏపీ కొరత? పలు జిల్లాల్లో రైతుల ఆందోళన",
        description:
          "సొసైటీల వద్ద సరఫరా సక్రమంగా లేదని రైతులు అంటున్నారు. నిల్వలు సరిపడా ఉన్నాయని అధికారులు చెబుతున్నారు. కరీంనగర్, వరంగల్, నల్గొండ జిల్లాల నుంచి నివేదికలు.",
        channelTitle: "Demo TV News Telugu",
        channelDescription: "24x7 Telugu news channel (demo)",
      },
      statistics: { viewCount: "21050", likeCount: "640", commentCount: "188" },
      url: "https://demo.invalid/yt/seed-yt-002",
      durationSeconds: 245,
    },
  },

  // 8. English news article — original wire copy
  {
    platform: "news",
    externalId: "seed-news-001",
    publishedAt: `${D}-23T06:10:00+05:30`,
    payload: {
      articleId: "seed-news-001",
      headline:
        "Farmers in north Telangana districts report DAP shortage ahead of sowing",
      body:
        "Farmers in Karimnagar, Warangal and Nalgonda districts say di-ammonium phosphate (DAP) has been unavailable at several primary agricultural cooperative societies for close to a week. Some farmers allege private dealers are charging above the maximum retail price. Agriculture Department officials said fertilizer stocks in the state are adequate and that supplies are being moved to district points. Farmer organisations have asked the department to prioritise the affected mandals before the sowing window closes.",
      outlet: "Demo Chronicle",
      section: "Telangana",
      url: "https://demo.invalid/news/seed-news-001",
    },
  },

  // 9. EXACT syndication of #8 — same wire body, different outlet
  {
    platform: "news",
    externalId: "seed-news-002",
    publishedAt: `${D}-23T07:45:00+05:30`,
    payload: {
      articleId: "seed-news-002",
      headline:
        "Farmers in north Telangana districts report DAP shortage ahead of sowing",
      body:
        "Farmers in Karimnagar, Warangal and Nalgonda districts say di-ammonium phosphate (DAP) has been unavailable at several primary agricultural cooperative societies for close to a week. Some farmers allege private dealers are charging above the maximum retail price. Agriculture Department officials said fertilizer stocks in the state are adequate and that supplies are being moved to district points. Farmer organisations have asked the department to prioritise the affected mandals before the sowing window closes.",
      outlet: "Demo Express (syndicated)",
      section: "State",
      url: "https://demo.invalid/news/seed-news-002",
    },
  },

  // 10. NEAR duplicate — lightly re-edited version of the same story
  {
    platform: "news",
    externalId: "seed-news-003",
    publishedAt: `${D}-23T09:20:00+05:30`,
    payload: {
      articleId: "seed-news-003",
      headline: "DAP shortage worries Telangana farmers as sowing window nears",
      body:
        "Farmers in Karimnagar, Warangal and Nalgonda districts say DAP has been unavailable at several primary agricultural cooperative societies for nearly a week. Some farmers allege that private dealers are charging above the maximum retail price. Agriculture Department officials maintained that fertilizer stocks in the state are adequate and said supplies are being moved to district points. Farmer organisations urged the department to prioritise affected mandals before the sowing window closes.",
      outlet: "Demo Times of Telangana",
      section: "Districts",
      url: "https://demo.invalid/news/seed-news-003",
    },
  },

  // 11. Official statement, English
  {
    platform: "official",
    externalId: "seed-off-001",
    publishedAt: `${D}-23T12:00:00+05:30`,
    payload: {
      releaseId: "seed-off-001",
      title: "Fertilizer availability position — statement",
      body:
        "The Agriculture Department stated that DAP and urea stocks are adequate across the state, with over 1.2 lakh metric tonnes positioned at district points. Farmers are requested not to panic. District officials have been instructed to monitor distribution at primary agricultural cooperative societies.",
      organisation: "Agriculture Department, Government of Telangana (demo)",
      url: "https://demo.invalid/gov/seed-off-001",
    },
  },

  // 12. Official post, Telugu
  {
    platform: "official",
    externalId: "seed-off-002",
    publishedAt: `${D}-23T13:10:00+05:30`,
    devTranslation:
      "Fertilizer stocks in the state are sufficient. Farmers need not worry. Distribution at societies is being monitored daily. — Agriculture Department",
    payload: {
      releaseId: "seed-off-002",
      title: "ఎరువుల నిల్వలపై ప్రకటన",
      body:
        "రాష్ట్రంలో ఎరువుల నిల్వలు సరిపడా ఉన్నాయి. రైతులు ఆందోళన చెందవద్దు. సొసైటీల వద్ద పంపిణీని ప్రతిరోజూ పర్యవేక్షిస్తున్నాం. — వ్యవసాయ శాఖ",
      organisation: "వ్యవసాయ శాఖ, తెలంగాణ ప్రభుత్వం (demo)",
      url: "https://demo.invalid/gov/seed-off-002",
    },
  },

  // 13. FPO web statement, English, Nalgonda
  {
    platform: "web",
    externalId: "seed-web-001",
    publishedAt: `${D}-22T19:40:00+05:30`,
    payload: {
      pageId: "seed-web-001",
      title: "Member advisory: DAP availability in Nalgonda mandals",
      body:
        "Our FPO members across four mandals in Nalgonda district report that DAP has not been issued at societies since Monday. Members are advised not to purchase above MRP and to record dealer receipts. We have formally requested the district agriculture office to allocate stocks.",
      siteName: "Nalgonda Farmers Producer Company (demo)",
      url: "https://demo.invalid/web/seed-web-001",
    },
  },

  // 14. Dealer voice — contrast: stocks fine in Mahabubnagar
  {
    platform: "x",
    externalId: "seed-x-006",
    publishedAt: `${D}-23T10:05:00+05:30`,
    payload: {
      id: "seed-x-006",
      text: "DAP stock arrived at our Mahabubnagar outlet this morning. Available at MRP, no shortage here. Farmers please carry pattadar passbook copy. #Telangana",
      url: "https://demo.invalid/x/seed-x-006",
      author: {
        name: "Palamuru Agro Traders (demo)",
        handle: "palamuru_agro_demo",
        bio: "Licensed fertilizer and seed dealer, Mahabubnagar",
      },
      metrics: { likes: 12, reposts: 2, replies: 3 },
    },
  },

  /* ---------------- Rainfall narrative (small, watch-level) ---------------- */

  // 15. Farmer post, Telugu, Nizamabad
  {
    platform: "x",
    externalId: "seed-x-007",
    publishedAt: `${D}-20T18:22:00+05:30`,
    devTranslation:
      "Rainfall in Nizamabad is low this month. Paddy transplantation is getting delayed. If it doesn't rain this week the seedlings will dry up.",
    payload: {
      id: "seed-x-007",
      text: "నిజామాబాద్ లో ఈ నెల వర్షాలు తక్కువ. వరి నాట్లు ఆలస్యం అవుతున్నాయి. ఈ వారం వాన పడకపోతే నారు ఎండిపోతుంది.",
      url: "https://demo.invalid/x/seed-x-007",
      author: {
        name: "Indur Rythu (demo)",
        handle: "indur_rythu_demo",
        bio: "రైతు, నిజామాబాద్ జిల్లా",
      },
      metrics: { likes: 34, reposts: 9, replies: 5 },
    },
  },

  // 16. News, English, Nizamabad rainfall
  {
    platform: "news",
    externalId: "seed-news-004",
    publishedAt: `${D}-21T07:30:00+05:30`,
    payload: {
      articleId: "seed-news-004",
      headline: "Rainfall deficit in Nizamabad raises concern over paddy transplantation",
      body:
        "Nizamabad district has recorded below-normal rainfall this month, and farmers say paddy transplantation is falling behind schedule. Agricultural officers advised farmers to protect nurseries and stagger transplantation where borewell irrigation is available.",
      outlet: "Demo Chronicle",
      section: "Telangana",
      url: "https://demo.invalid/news/seed-news-004",
    },
  },

  // 17. Creator video, Telugu, rainfall + paddy
  {
    platform: "youtube",
    externalId: "seed-yt-003",
    publishedAt: `${D}-21T16:45:00+05:30`,
    devTranslation:
      "Low rainfall in Nizamabad — what should paddy farmers do now? Nursery protection, alternate wetting, and transplantation timing explained.",
    payload: {
      videoId: "seed-yt-003",
      snippet: {
        title: "నిజామాబాద్ లో తక్కువ వర్షాలు — వరి రైతులు ఇప్పుడు ఏం చేయాలి?",
        description:
          "నారు రక్షణ, నీటి యాజమాన్యం, నాట్ల సమయం గురించి వివరణ. #వరి #నిజామాబాద్ #వ్యవసాయం",
        channelTitle: "Rythu Guide (demo)",
        channelDescription: "వ్యవసాయ సలహాలు — agriculture education channel",
      },
      statistics: { viewCount: "12800", likeCount: "710", commentCount: "64" },
      url: "https://demo.invalid/yt/seed-yt-003",
      durationSeconds: 431,
    },
  },

  /* ---------------- Procurement narrative (small) ---------------- */

  // 18. Farmer post, mixed, Mahabubnagar payment delay
  {
    platform: "x",
    externalId: "seed-x-008",
    publishedAt: `${D}-19T20:11:00+05:30`,
    devTranslation:
      "Paddy procurement money has still not been credited. It has been three weeks. Small farmers depend on this money for the next crop's investment. #procurement",
    payload: {
      id: "seed-x-008",
      text: "ధాన్యం కొనుగోలు డబ్బులు ఇంకా పడలేదు. మూడు వారాలు అయింది. Next crop investment కోసం చిన్న రైతులు ఈ డబ్బుల మీదే ఆధారపడతారు. #procurement #Mahabubnagar",
      url: "https://demo.invalid/x/seed-x-008",
      author: {
        name: "Palamuru Rythu (demo)",
        handle: "palamuru_rythu_demo",
        bio: "రైతు — మహబూబ్‌నగర్ (పాలమూరు)",
      },
      metrics: { likes: 51, reposts: 15, replies: 7 },
    },
  },

  // 19. News, English, procurement payments
  {
    platform: "news",
    externalId: "seed-news-005",
    publishedAt: `${D}-20T08:50:00+05:30`,
    payload: {
      articleId: "seed-news-005",
      headline: "Paddy procurement payments delayed in parts of Telangana, farmers say",
      body:
        "Farmers in Mahabubnagar and Nalgonda districts say payments for paddy sold at procurement centres have been pending for up to three weeks. Civil Supplies officials said payment files are being cleared in batches and pending amounts would be released shortly.",
      outlet: "Demo Express",
      section: "State",
      url: "https://demo.invalid/news/seed-news-005",
    },
  },

  /* ---------------- Other relevant, non-narrative items ---------------- */

  // 20. Official advisory (PJTSAU-style), cotton pest, Warangal
  {
    platform: "official",
    externalId: "seed-off-003",
    publishedAt: `${D}-21T11:00:00+05:30`,
    payload: {
      releaseId: "seed-off-003",
      title: "Advisory: pink bollworm monitoring in cotton",
      body:
        "The agricultural university advisory recommends pheromone trap monitoring for pink bollworm in cotton in Warangal and adjoining districts. Farmers should scout fields weekly and avoid indiscriminate spraying.",
      organisation: "Agricultural University (demo)",
      url: "https://demo.invalid/gov/seed-off-003",
    },
  },

  // 21. Citizen scheme question, Telugu
  {
    platform: "x",
    externalId: "seed-x-009",
    publishedAt: `${D}-23T15:35:00+05:30`,
    devTranslation:
      "When will Rythu Bharosa money be deposited? Farmers are waiting. Is there any clarity on the date?",
    payload: {
      id: "seed-x-009",
      text: "రైతు భరోసా డబ్బులు ఎప్పుడు వేస్తారు? రైతులు ఎదురు చూస్తున్నారు. తేదీపై స్పష్టత ఉందా? #తెలంగాణ",
      url: "https://demo.invalid/x/seed-x-009",
      author: {
        name: "Telangana Citizen (demo)",
        handle: "ts_citizen_demo",
        bio: "Hyderabad",
      },
      metrics: { likes: 96, reposts: 40, replies: 19 },
    },
  },

  /* ---------------- Noise / false positives (must be REJECTED) ---------------- */

  // 22. Telangana but not agriculture
  {
    platform: "news",
    externalId: "seed-news-006",
    publishedAt: `${D}-22T10:00:00+05:30`,
    payload: {
      articleId: "seed-news-006",
      headline: "Warangal to host state marathon next month",
      body:
        "The city of Warangal will host the state marathon next month, with over five thousand runners expected. Traffic diversions will be announced a week in advance.",
      outlet: "Demo Chronicle",
      section: "Sport",
      url: "https://demo.invalid/news/seed-news-006",
    },
  },

  // 23. Agriculture but not Telangana
  {
    platform: "news",
    externalId: "seed-news-007",
    publishedAt: `${D}-22T12:30:00+05:30`,
    payload: {
      articleId: "seed-news-007",
      headline: "Punjab announces bonus over MSP for paddy procurement",
      body:
        "The Punjab government announced an additional bonus over the minimum support price for paddy procurement this season. Farmer unions in the state welcomed the move.",
      outlet: "Demo National Desk",
      section: "Nation",
      url: "https://demo.invalid/news/seed-news-007",
    },
  },

  // 24. Neither — city lifestyle chatter
  {
    platform: "x",
    externalId: "seed-x-010",
    publishedAt: `${D}-23T21:00:00+05:30`,
    payload: {
      id: "seed-x-010",
      text: "Weekend biryani in Hyderabad hits different. Best city!",
      url: "https://demo.invalid/x/seed-x-010",
      author: {
        name: "Foodie Demo",
        handle: "foodie_hyd_demo",
        bio: "food | travel",
      },
      metrics: { likes: 230, reposts: 11, replies: 25 },
    },
  },

  // 25. Agriculture-adjacent term, no Telangana, no real signal
  {
    platform: "youtube",
    externalId: "seed-yt-004",
    publishedAt: `${D}-20T12:00:00+05:30`,
    payload: {
      videoId: "seed-yt-004",
      snippet: {
        title: "Top 10 toy tractor unboxing for kids",
        description: "Unboxing the most popular toy tractors of the year. Fun for kids!",
        channelTitle: "Demo Toys Studio",
        channelDescription: "Toy reviews and unboxings",
      },
      statistics: { viewCount: "560000", likeCount: "8200", commentCount: "930" },
      url: "https://demo.invalid/yt/seed-yt-004",
      durationSeconds: 610,
    },
  },

  // 26. Telangana + agriculture word but different-state district false positive
  {
    platform: "news",
    externalId: "seed-news-008",
    publishedAt: `${D}-21T14:15:00+05:30`,
    payload: {
      articleId: "seed-news-008",
      headline: "Karnataka farmers protest sugarcane pricing in Belagavi",
      body:
        "Farmers in Belagavi district of Karnataka staged a protest over sugarcane pricing, demanding higher rates from mills before the crushing season.",
      outlet: "Demo National Desk",
      section: "Nation",
      url: "https://demo.invalid/news/seed-news-008",
    },
  },
];

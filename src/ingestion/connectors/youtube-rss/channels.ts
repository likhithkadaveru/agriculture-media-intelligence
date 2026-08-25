/**
 * Curated YouTube channel registry for RSS collection.
 *
 * Every channel id below was resolved from the channel's public page and its
 * feed verified live (2026-08-25). RSS feeds are official, key-free Google
 * endpoints (youtube.com/feeds/videos.xml) returning the ~15 most recent
 * uploads with title, description, timestamps, thumbnail and view counts.
 *
 * `kind` seeds author-classification priors; enrichment still classifies
 * per-content with confidence.
 */

export interface ChannelEntry {
  channelId: string;
  name: string;
  kind: "media_organisation" | "government" | "creator" | "agriculture_programme";
  language: "te" | "en";
  /** Why this channel is monitored. */
  note: string;
  enabled: boolean;
}

export const YOUTUBE_CHANNELS: ChannelEntry[] = [
  {
    channelId: "UCDCMjD1XIAsCZsYHNMGVcog",
    name: "V6 News Telugu",
    kind: "media_organisation",
    language: "te",
    note: "Major Telugu news channel with strong Telangana district coverage",
    enabled: true,
  },
  {
    channelId: "UCPXTXMecYqnRKNdqdVOGSFg",
    name: "TV9 Telugu Live",
    kind: "media_organisation",
    language: "te",
    note: "Major Telugu news channel",
    enabled: true,
  },
  {
    channelId: "UCfymZbh17_3T_UhgjkQ9fRQ",
    name: "10TV News Telugu",
    kind: "media_organisation",
    language: "te",
    note: "Telugu news channel",
    enabled: true,
  },
  {
    channelId: "UC_2irx_BQR7RsBKmUV9fePQ",
    name: "ABN Telugu",
    kind: "media_organisation",
    language: "te",
    note: "Telugu news channel",
    enabled: true,
  },
  {
    channelId: "UCZ9m4KOh8Ei60428xeGYDCQ",
    name: "Sakshi TV",
    kind: "media_organisation",
    language: "te",
    note: "Telugu news channel",
    enabled: true,
  },
  {
    channelId: "UCtzYV2L-m8ew93mZb3qhf5w",
    name: "NTV Live",
    kind: "media_organisation",
    language: "te",
    note: "Telugu news channel",
    enabled: true,
  },
  {
    channelId: "UCauZntyqGqex2t2DO_6tujA",
    name: "hmtv",
    kind: "media_organisation",
    language: "te",
    note: "Telugu news channel",
    enabled: true,
  },
  {
    channelId: "UCF5tCQmxJqYZOZq-kuWAZ3g",
    name: "ETV Annadata",
    kind: "agriculture_programme",
    language: "te",
    note: "Dedicated Telugu agriculture programme (advisories, farmer stories)",
    enabled: true,
  },
  {
    channelId: "UClhEYVi8bcqXCk4RTfGmKYA",
    name: "Raithu Nestham",
    kind: "agriculture_programme",
    language: "te",
    note: "Telugu agriculture magazine channel",
    enabled: true,
  },
  {
    channelId: "UC_gvbd0N1gJEbba4K6LWerg",
    name: "Telangana CMO",
    kind: "government",
    language: "te",
    note: "Official Chief Minister's Office channel — official voice",
    enabled: true,
  },
  // Telugu farming creators. These cover both Telangana and Andhra Pradesh,
  // so the Telangana relevance gate does real work on their output; they
  // contribute creator/expert voices that news channels do not.
  {
    channelId: "UC124dk6vzaoIEIFnLYRMpuA",
    name: "Agri Telugu",
    kind: "creator",
    language: "te",
    note: "Telugu farming creator — practices, equipment, farmer stories",
    enabled: true,
  },
  {
    channelId: "UCtnwoAjrEE67Cvj1C9oHIFQ",
    name: "VYAVASAYAM వ్యవసాయం",
    kind: "creator",
    language: "te",
    note: "Telugu agriculture creator — cultivation and farm economics",
    enabled: true,
  },
  {
    channelId: "UCN6lrK_pEwFgHJ0KSu0NnMA",
    name: "Karshaka Mitra",
    kind: "creator",
    language: "te",
    note: "Telugu farm equipment and practice channel",
    enabled: true,
  },
  {
    channelId: "UCNoRc8QYvJ6avkiKYRCYQfg",
    name: "hmr TELUGU AGRICULTURE",
    kind: "creator",
    language: "te",
    note: "Telugu crop protection and agronomy advice",
    enabled: true,
  },
  {
    channelId: "UCLRmroXWRc_20xKSvRLIr_Q",
    name: "Saraswathi Agriculture Telugu",
    kind: "creator",
    language: "te",
    note: "Telugu agriculture creator",
    enabled: true,
  },
];

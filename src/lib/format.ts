/** Formatting + display-classification helpers shared by UI components. */

const IST = "Asia/Kolkata";

export function formatDateTime(date: Date | null | undefined): string {
  if (!date) return "time unknown";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatFullDate(date: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: IST,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-IN").format(n);
}

export function percent(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/**
 * Display voice classes — the five-way grouping used for composition bars.
 * Fixed order = fixed categorical color slot (see globals.css --viz-*).
 */
export const VOICE_CLASSES = [
  { key: "farmers", label: "Farmers", cssVar: "var(--viz-1)" },
  { key: "media", label: "Media", cssVar: "var(--viz-2)" },
  { key: "government", label: "Government", cssVar: "var(--viz-3)" },
  { key: "creators", label: "Creators", cssVar: "var(--viz-4)" },
  { key: "other", label: "Other", cssVar: "var(--viz-other)" },
] as const;

export type VoiceClassKey = (typeof VOICE_CLASSES)[number]["key"];

export function voiceClassOf(authorType: string): VoiceClassKey {
  switch (authorType) {
    case "farmer":
    case "farmer_organisation":
    case "fpo":
      return "farmers";
    case "media_organisation":
    case "journalist":
      return "media";
    case "government":
      return "government";
    case "creator":
      return "creators";
    default:
      return "other";
  }
}

export function groupVoiceMix(voiceMix: Record<string, number>): Record<VoiceClassKey, number> {
  const grouped: Record<VoiceClassKey, number> = {
    farmers: 0,
    media: 0,
    government: 0,
    creators: 0,
    other: 0,
  };
  for (const [authorType, count] of Object.entries(voiceMix)) {
    grouped[voiceClassOf(authorType)] += count;
  }
  return grouped;
}

export const AUTHOR_TYPE_LABELS: Record<string, string> = {
  government: "Government",
  farmer: "Farmer",
  farmer_organisation: "Farmer organisation",
  fpo: "FPO",
  agriculture_expert: "Agriculture expert",
  academic: "Academic",
  journalist: "Journalist",
  media_organisation: "Media organisation",
  politician: "Politician",
  creator: "Creator",
  dealer: "Dealer",
  ngo: "NGO",
  citizen: "Citizen",
  unknown: "Unclassified",
};

export const PLATFORM_LABELS: Record<string, string> = {
  youtube: "YouTube",
  x: "X",
  news: "News",
  official: "Official",
  web: "Public web",
};

export const LANGUAGE_LABELS: Record<string, string> = {
  te: "Telugu",
  en: "English",
  mixed: "Telugu / English",
  other: "Other",
};

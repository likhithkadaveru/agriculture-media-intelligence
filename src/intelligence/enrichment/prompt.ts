/**
 * Shared enrichment prompt — used by every LLM-backed enricher (AI Gateway,
 * Claude CLI). Constrains extraction to ontology ids and forbids guessing.
 */
import { CROPS, DISTRICTS, GOVERNMENT_ENTITIES, SCHEMES, TOPICS } from "@/ontology";
import type { EnrichmentInput } from "./schema";

export const ENRICHMENT_PROMPT_VERSION = "llm-v2";

const SUBTOPIC_IDS = TOPICS.flatMap((t) => (t.subtopics ?? []).map((s) => s.id));

export function buildEnrichmentPrompt(input: EnrichmentInput): string {
  return [
    "You analyse one piece of public content about Telangana agriculture for a government intelligence system.",
    "Extract ONLY what the text itself supports. Use null when information is absent. Never guess.",
    "",
    "Rules:",
    "- district: assign ONLY if the content (title/description/text) clearly evidences a Telangana district. Do NOT infer a district from what the channel usually covers. Unknown is correct and common. Use the district id from the allowed list.",
    "- locationConfidence: your confidence in the district assignment (null when district is null).",
    "- stance: the author's stance toward the government/public authorities on this issue (critical | supportive | neutral | mixed).",
    "- authorType: judged from the author metadata AND content style. A news channel reporting farmer complaints is media_organisation, not farmer. Confidence required.",
    '- englishTranslation: faithful English translation of the content when it is Telugu or mixed; null for English content. NEVER paraphrase away details. Output the translated text ONLY — no "Title:" or "Description:" prefixes, no commentary.',
    "- summary: 1–2 sentence neutral English summary of what the content says.",
    "- claim: one falsifiable factual assertion the content makes (in English), or null if none.",
    "- telanganaRelevance / agricultureRelevance: 0..1 — is this genuinely about Telangana, and genuinely about agriculture? Political speech that merely name-drops agriculture scores low agricultureRelevance.",
    "- Output MUST be a single JSON object with exactly these keys:",
    '  language ("te"|"en"|"mixed"|"other"), telanganaRelevance, agricultureRelevance,',
    "  topics (array of allowed topic ids), subtopics (array of allowed subtopic ids),",
    "  schemes (array of allowed scheme ids), crops (array of allowed crop ids),",
    "  governmentEntities (array of allowed entity ids),",
    "  district (allowed district id or null), mandal (string or null), locationConfidence (0..1 or null),",
    '  authorType (one of: government, farmer, farmer_organisation, fpo, agriculture_expert, academic, journalist, media_organisation, politician, creator, dealer, ngo, citizen, unknown),',
    "  authorTypeConfidence (0..1 or null),",
    '  sentiment ("negative"|"positive"|"neutral"|"mixed"), stance ("critical"|"supportive"|"neutral"|"mixed"),',
    "  claim (string or null), claimConfidence (0..1 or null),",
    "  englishTranslation (string or null), summary (string or null), confidence (0..1).",
    "",
    `Allowed topic ids: ${TOPICS.map((t) => t.id).join(", ")}`,
    `Allowed subtopic ids: ${SUBTOPIC_IDS.join(", ")}`,
    `Allowed scheme ids: ${SCHEMES.map((s) => s.id).join(", ")}`,
    `Allowed crop ids: ${CROPS.map((c) => c.id).join(", ")}`,
    `Allowed government entity ids: ${GOVERNMENT_ENTITIES.map((e) => e.id).join(", ")}`,
    `Allowed district ids: ${DISTRICTS.map((d) => d.id).join(", ")}`,
    "",
    `PLATFORM: ${input.platform}`,
    `AUTHOR: ${input.authorName ?? "unknown"}`,
    `AUTHOR BIO/CONTEXT: ${input.authorBio ?? "unknown"}`,
    `OFFICIAL ACCOUNT: ${input.isOfficialAccount}`,
    input.title ? `TITLE: ${input.title}` : "",
    "TEXT:",
    input.originalText.slice(0, 6000),
    input.transcript
      ? [
          "",
          "SPOKEN TRANSCRIPT (auto-generated captions, may be imperfect):",
          "Broadcast items usually name the district out loud rather than in",
          "the title. Prefer a district named here over one merely inferred,",
          "but do not invent one if the transcript never says it.",
          input.transcript.slice(0, 8000),
        ].join("\n")
      : "",
  ]
    .filter(Boolean)
    .join("\n");
}

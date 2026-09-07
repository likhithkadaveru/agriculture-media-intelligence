import { describe, expect, it } from "vitest";
import { EnrichmentResultSchema } from "@/intelligence/enrichment/schema";
import { HeuristicEnricher } from "@/intelligence/enrichment/heuristic";

describe("enrichment schema validation", () => {
  it("rejects out-of-range confidences and unknown enums", () => {
    const base = {
      language: "te",
      telanganaRelevance: 0.9,
      agricultureRelevance: 0.9,
      topics: [],
      subtopics: [],
      schemes: [],
      crops: [],
      governmentEntities: [],
      district: null,
      mandal: null,
      locationConfidence: null,
      authorType: "farmer",
      authorTypeConfidence: 0.8,
      sentiment: "negative",
      stance: "critical",
      eventType: null,
      department: null,
      claim: null,
      claimConfidence: null,
      englishTranslation: null,
      summary: null,
      confidence: 0.7,
    };
    expect(EnrichmentResultSchema.safeParse(base).success).toBe(true);
    expect(
      EnrichmentResultSchema.safeParse({ ...base, confidence: 1.4 }).success,
    ).toBe(false);
    expect(
      EnrichmentResultSchema.safeParse({ ...base, authorType: "alien" }).success,
    ).toBe(false);
    expect(
      EnrichmentResultSchema.safeParse({ ...base, stance: "angry" }).success,
    ).toBe(false);
    expect(
      EnrichmentResultSchema.safeParse({ ...base, eventType: "riot" }).success,
    ).toBe(false);
    /*
     * Both new fields are required-but-nullable rather than optional. That is
     * not a style choice: OpenAI's strict structured outputs reject a schema
     * whose `required` array omits any property, so an omitted field must
     * fail here or it will fail at the API instead.
     */
    const { eventType: _e, ...withoutEventType } = base;
    expect(EnrichmentResultSchema.safeParse(withoutEventType).success).toBe(false);
    const { department: _d, ...withoutDepartment } = base;
    expect(EnrichmentResultSchema.safeParse(withoutDepartment).success).toBe(false);
  });

  it("heuristic enricher output always passes the schema", async () => {
    const enricher = new HeuristicEnricher();
    const result = await enricher.enrich({
      platform: "x",
      title: null,
      originalText:
        "కరీంనగర్ జిల్లాలో మూడు రోజులుగా డీఏపీ దొరకడం లేదు. రైతులు ఇబ్బంది పడుతున్నారు.",
      authorName: "Rythu Voice (demo)",
      authorBio: "రైతు, కరీంనగర్",
      isOfficialAccount: false,
      dataOrigin: "demo_seed",
      seedTranslation: "DAP has not been available for three days in Karimnagar district.",
    });
    expect(EnrichmentResultSchema.safeParse(result).success).toBe(true);
    expect(result.language).toBe("te");
    expect(result.district).toBe("karimnagar");
    expect(result.topics).toContain("fertilizer-availability");
    expect(result.authorType).toBe("farmer");
    expect(result.stance).toBe("critical");
    expect(result.englishTranslation).not.toBeNull();
  });

  it("does not use seed translations for non-seed data", async () => {
    const enricher = new HeuristicEnricher();
    const result = await enricher.enrich({
      platform: "x",
      title: null,
      originalText: "వరంగల్ లో డీఏపీ కొరత",
      authorName: null,
      authorBio: null,
      isOfficialAccount: false,
      dataOrigin: "live",
      seedTranslation: "should never be used",
    });
    expect(result.englishTranslation).toBeNull();
  });

  it("negation-aware stance: 'no shortage' is not a complaint", async () => {
    const enricher = new HeuristicEnricher();
    const result = await enricher.enrich({
      platform: "x",
      title: null,
      originalText:
        "DAP stock arrived at our Mahabubnagar outlet this morning. Available at MRP, no shortage here. #Telangana",
      authorName: "Palamuru Agro Traders (demo)",
      authorBio: "Licensed fertilizer dealer, Mahabubnagar",
      isOfficialAccount: false,
      dataOrigin: "demo_seed",
    });
    expect(result.stance).toBe("supportive");
    expect(result.sentiment).toBe("positive");
  });
});

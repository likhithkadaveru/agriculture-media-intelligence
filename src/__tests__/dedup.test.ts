import { describe, expect, it } from "vitest";
import {
  contentHash,
  nearDuplicateSimilarity,
  normalizeForHash,
} from "@/intelligence/dedup";

const WIRE_COPY =
  "Farmers in Karimnagar, Warangal and Nalgonda districts say di-ammonium phosphate (DAP) has been unavailable at several primary agricultural cooperative societies for close to a week. Some farmers allege private dealers are charging above the maximum retail price.";

const LIGHT_REWRITE =
  "Farmers in Karimnagar, Warangal and Nalgonda districts say DAP has been unavailable at several primary agricultural cooperative societies for nearly a week. Some farmers allege that private dealers are charging above the maximum retail price.";

const DIFFERENT_STORY =
  "Nizamabad district has recorded below-normal rainfall this month, and farmers say paddy transplantation is falling behind schedule.";

describe("deduplication", () => {
  it("exact hash ignores punctuation, case and whitespace", () => {
    expect(contentHash("DAP  shortage in Warangal!")).toBe(
      contentHash("dap shortage in warangal"),
    );
    expect(normalizeForHash("డీఏపీ కొరత,  వరంగల్")).toBe("డీఏపీ కొరత వరంగల్");
  });

  it("different content produces different hashes", () => {
    expect(contentHash(WIRE_COPY)).not.toBe(contentHash(DIFFERENT_STORY));
  });

  it("flags lightly re-edited syndicated copy as near-duplicate", () => {
    expect(nearDuplicateSimilarity(WIRE_COPY, LIGHT_REWRITE)).toBeGreaterThan(0);
  });

  it("does not flag distinct stories on the same topic", () => {
    expect(nearDuplicateSimilarity(WIRE_COPY, DIFFERENT_STORY)).toBe(0);
  });

  it("does not flag short distinct posts", () => {
    expect(
      nearDuplicateSimilarity(
        "వరంగల్ లో డీఏపీ బస్తాలు బ్లాక్ లో అమ్ముతున్నారు",
        "మా సొసైటీలో డీఏపీ లేదని చెప్పారు కరీంనగర్",
      ),
    ).toBe(0);
  });
});

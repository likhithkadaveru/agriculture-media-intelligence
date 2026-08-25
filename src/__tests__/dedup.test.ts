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
    expect(
      nearDuplicateSimilarity(
        { title: "Farmers report DAP shortage ahead of sowing", body: WIRE_COPY },
        { title: "DAP shortage worries farmers as sowing nears", body: LIGHT_REWRITE },
      ),
    ).toBeGreaterThan(0);
  });

  it("does not flag distinct stories on the same topic", () => {
    expect(
      nearDuplicateSimilarity(
        { title: "DAP shortage reported", body: WIRE_COPY },
        { title: "Rainfall deficit in Nizamabad", body: DIFFERENT_STORY },
      ),
    ).toBe(0);
  });

  it("does not flag short distinct posts", () => {
    expect(
      nearDuplicateSimilarity(
        { title: null, body: "వరంగల్ లో డీఏపీ బస్తాలు బ్లాక్ లో అమ్ముతున్నారు" },
        { title: null, body: "మా సొసైటీలో డీఏపీ లేదని చెప్పారు కరీంనగర్" },
      ),
    ).toBe(0);
  });

  it("title gate protects distinct stories that share channel boilerplate", () => {
    // Live-data defect: unrelated videos from one channel shared ~1500 chars
    // of promo text and scored 0.75–0.97 body similarity.
    const promo =
      "Watch our channel for the latest Telugu news updates from Telangana and around the world with breaking news exclusive interviews live reports sports update weather reports business trends";
    expect(
      nearDuplicateSimilarity(
        { title: "Telangana Graduate MLC Elections analysis", body: `MLC election contest heats up. ${promo}` },
        { title: "Non Stop 90 News political roundup", body: `Political roundup of the day. ${promo}` },
      ),
    ).toBe(0);
  });

  it("still merges genuine re-uploads with the same title", () => {
    const body = "CM addresses the media at the Secretariat on the assembly session schedule.";
    expect(
      nearDuplicateSimilarity(
        { title: "LIVE: CM Press Meet at Secretariat", body },
        { title: "LIVE: CM Press Meet at Secretariat", body },
      ),
    ).toBeGreaterThan(0);
  });
});

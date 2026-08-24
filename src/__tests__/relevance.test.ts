import { describe, expect, it } from "vitest";
import { assessRelevance } from "@/intelligence/relevance";

describe("relevance gate", () => {
  it("accepts Telangana + agriculture content", () => {
    const verdict = assessRelevance(
      "కరీంనగర్ జిల్లాలో మూడు రోజులుగా డీఏపీ దొరకడం లేదు. రైతులు ఇబ్బంది పడుతున్నారు.",
    );
    expect(verdict.accepted).toBe(true);
    expect(verdict.matchedDistricts).toContain("karimnagar");
  });

  it("rejects Telangana content with no agriculture signal", () => {
    const verdict = assessRelevance("Warangal to host state marathon next month.");
    expect(verdict.accepted).toBe(false);
    expect(verdict.reason).toContain("no agriculture evidence");
  });

  it("rejects out-of-state agriculture content", () => {
    const verdict = assessRelevance(
      "Punjab announces bonus over MSP for paddy procurement this season.",
    );
    expect(verdict.accepted).toBe(false);
  });

  it("rejects content with neither signal", () => {
    const verdict = assessRelevance("Weekend biryani hits different!");
    expect(verdict.accepted).toBe(false);
  });

  it("author organisation anchors Telangana relevance but never agriculture relevance", () => {
    const statement =
      "Fertilizer stocks are adequate across the state. Farmers are requested not to panic.";
    const without = assessRelevance(statement);
    expect(without.accepted).toBe(false);

    const withOrg = assessRelevance(statement, {
      authorContext: "Agriculture Department, Government of Telangana",
    });
    expect(withOrg.accepted).toBe(true);

    // Telangana-anchored author posting non-agriculture content: still rejected.
    const offTopic = assessRelevance("Our office will remain closed on Monday.", {
      authorContext: "Government of Telangana",
    });
    expect(offTopic.accepted).toBe(false);
  });
});

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
    expect(verdict.reason).toContain("Insufficient agriculture evidence");
  });

  it("rejects political content that only name-drops agriculture in the body", () => {
    // Live-data defect: official/political items are saturated with Telangana
    // markers and mention farmers once in passing, so they passed the gate and
    // consumed model budget. Agriculture must be evidenced in the headline.
    const verdict = assessRelevance(
      [
        "CM Revanth Reddy: No Hidden Agenda in US Visit, Condemns Centre's Discrimination",
        "The Chief Minister addressed the media at the Secretariat regarding the denial of",
        "permission for the US tour, and listed the government's work for farmers, students",
        "and workers across the state of Telangana over the past year in various sectors.",
      ].join(" "),
      {
        title: "CM Revanth Reddy: No Hidden Agenda in US Visit, Condemns Centre's Discrimination",
        authorContext: "Telangana CMO channel-kind:government",
        sourceKind: "government",
      },
    );
    expect(verdict.accepted).toBe(false);
    expect(verdict.agricultureRelevance).toBeLessThan(0.5);
  });

  it("accepts a genuine agriculture headline from a news channel", () => {
    const verdict = assessRelevance(
      "ఖమ్మం జిల్లాలో యూరియా కోసం రైతుల ఆందోళన. సొసైటీ వద్ద రైతులు బారులు తీరారు.",
      {
        title: "Farmers Protest for Fertiliser : ఖమ్మం జిల్లాలో యూరియా కోసం రైతుల ఆందోళన - TV9",
        authorContext: "TV9 Telugu Live channel-kind:media_organisation",
        sourceKind: "media_organisation",
      },
    );
    expect(verdict.accepted).toBe(true);
    expect(verdict.matchedDistricts).toContain("khammam");
  });

  it("lets agriculture-dedicated sources through on a regional prior", () => {
    // Telugu farming content often never names the state; the model decides
    // state relevance downstream rather than the gate discarding it for free.
    const verdict = assessRelevance(
      "వరి పంటలో కలుపు నివారణ మరియు ఎరువుల యాజమాన్యం గురించి వివరణ",
      {
        title: "వరి పంటలో కలుపు నివారణ | ఎరువుల యాజమాన్యం",
        authorContext: "ETV Annadata channel-kind:agriculture_programme",
        sourceKind: "agriculture_programme",
      },
    );
    expect(verdict.accepted).toBe(true);
    expect(verdict.reason).toContain("regional prior");
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

import { describe, expect, it } from "vitest";
import { briefText } from "@/components/ShareBrief";

const SIGNAL = {
  headline: "Urea supply challenges and multi-stakeholder response",
  districts: ["Medak", "Nirmal", "Jagtial", "Adilabad", "Nalgonda"],
  voices: 50,
  url: "https://agriculture.likhithlabs.com/findings/abc",
};

describe("shareable brief", () => {
  it("names three districts and counts the rest", () => {
    const t = briefText(SIGNAL, false);
    expect(t).toContain("Medak, Nirmal, Jagtial and 2 more districts");
    expect(t).not.toContain("Nalgonda");
  });

  it("uses Telugu district names in the Telugu brief", () => {
    expect(briefText(SIGNAL, true)).toContain("మెదక్");
  });

  /*
   * The wording carries the epistemic claim, and this text is forwarded
   * under an officer's own name. It must say a concern was REPORTED and that
   * verification is RECOMMENDED — never that a shortage is confirmed, nor
   * that anyone is required to act. Asserted in both languages because a
   * translation is exactly where that distinction goes quietly missing.
   */
  it.each([false, true])("claims reporting, not fact (telugu=%s)", (telugu) => {
    const t = briefText(SIGNAL, telugu).toLowerCase();
    for (const forbidden of ["confirmed", "shortage", "must ", "required", "ధృవీకరించబడింది"]) {
      expect(t).not.toContain(forbidden.toLowerCase());
    }
  });

  it("recommends verification in both languages", () => {
    expect(briefText(SIGNAL, false)).toContain("Field verification recommended");
    expect(briefText(SIGNAL, true)).toContain("సిఫార్సు");
  });

  it("carries an absolute link, since a relative one is useless in WhatsApp", () => {
    expect(briefText(SIGNAL, false)).toContain("https://");
  });

  it("omits the district line entirely when none is evidenced", () => {
    const t = briefText({ ...SIGNAL, districts: [] }, false);
    expect(t).not.toContain("Evidence in");
  });
});

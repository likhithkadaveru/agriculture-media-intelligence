import { describe, expect, it } from "vitest";
import { deriveContentText, stripBoilerplate } from "@/ingestion/normalization/boilerplate";

// Shape taken from a real collected YouTube description.
const REAL_DESCRIPTION = `Farmers in Khammam district have staged a protest over the shortage of urea fertiliser, raising concerns about the availability of essential inputs during the agricultural season.

With demand for urea increasing, farmers are reportedly facing difficulties in getting adequate supplies.

#Khammam #UreaShortage #FarmersProtest #TelanganaFarmers #tv9telugu
🔔 Subscribe to TV9 Telugu & press the Bell Icon for breaking news alerts.
👍 Like | Comment | Share

Follow TV9 Telugu on Social Media:
► TV9 News App : https://onelink.to/de8b7y
► Follow us on X : https://twitter.com/Tv9Telugu

Sakshi News, Sakshi TV, Telugu News Live, Latest Telugu News, Breaking News Telugu, AP News Today`;

describe("boilerplate stripping", () => {
  it("keeps the author-written content", () => {
    const stripped = stripBoilerplate(REAL_DESCRIPTION);
    expect(stripped).toContain("Khammam district have staged a protest");
    expect(stripped).toContain("difficulties in getting adequate supplies");
  });

  it("removes promotional lines, links, hashtag blocks and SEO tails", () => {
    const stripped = stripBoilerplate(REAL_DESCRIPTION);
    expect(stripped).not.toContain("Subscribe");
    expect(stripped).not.toContain("https://");
    expect(stripped).not.toContain("#UreaShortage");
    expect(stripped).not.toContain("Latest Telugu News");
    expect(stripped.length).toBeLessThan(REAL_DESCRIPTION.length / 2);
  });

  it("removes hashtag runs written without spaces", () => {
    const stripped = stripBoilerplate(
      "Real content line here.\n#annadata #etvshow #farming#agriculturetechnology#annadataetv",
    );
    expect(stripped).toBe("Real content line here.");
  });

  it("removes emoji-led calls to action", () => {
    const stripped = stripBoilerplate("Useful farming advice.\n📺 Your favorite ETV shows are now just a tap away!");
    expect(stripped).toBe("Useful farming advice.");
  });

  it("preserves Telugu content untouched", () => {
    const telugu = "ఖమ్మం జిల్లాలో యూరియా కోసం రైతుల ఆందోళన. సొసైటీ వద్ద రైతులు బారులు తీరారు.";
    expect(stripBoilerplate(`${telugu}\n#Khammam #Telangana`)).toBe(telugu);
  });

  it("falls back to the original when stripping would empty the text", () => {
    // Short official statements are all signal and must survive intact.
    const short = "Fertilizer stocks are adequate across the state.";
    expect(deriveContentText(null, short)).toBe(short);
  });

  it("prefixes the title so headline terms are available to the gate", () => {
    const result = deriveContentText("Farmers protest for urea", "Body text about the protest.");
    expect(result.startsWith("Farmers protest for urea")).toBe(true);
    expect(result).toContain("Body text");
  });
});

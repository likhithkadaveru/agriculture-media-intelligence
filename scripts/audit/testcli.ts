import { ClaudeCliEnricher } from "@/intelligence/enrichment/claude-cli";
async function main() {
  const e = new ClaudeCliEnricher();
  const r = await e.enrich({
    platform: "youtube",
    title: "Farmers Protest for Fertiliser : ఖమ్మం జిల్లాలో యూరియా కోసం రైతుల ఆందోళన - TV9",
    originalText: "ఖమ్మం జిల్లాలో యూరియా కోసం రైతుల ఆందోళన. సొసైటీ వద్ద రైతులు బారులు తీరారు.",
    authorName: "TV9 Telugu Live",
    authorBio: "channel-kind:media_organisation",
    isOfficialAccount: false,
    dataOrigin: "live",
  });
  console.log(JSON.stringify(r, null, 2));
}
main().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });

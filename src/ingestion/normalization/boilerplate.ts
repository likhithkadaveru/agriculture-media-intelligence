/**
 * Boilerplate stripping for platform descriptions.
 *
 * Real YouTube news descriptions are dominated by channel promotion:
 * subscribe/follow CTAs, URLs, hashtag blocks and SEO keyword tails. On the
 * first live run this boilerplate caused two concrete defects:
 *
 *  1. False duplicates — unrelated videos from one channel scored 0.75–0.97
 *     similarity because they shared ~1500 characters of identical promo.
 *  2. False relevance — an Andhra Pradesh story was accepted as Telangana
 *     because the SEO tail contained "Telangana News Today".
 *
 * So the pipeline derives a `contentText` (this module) used for relevance,
 * deduplication and enrichment, while `originalText` stays verbatim as
 * evidence. Source content is never altered — only what the intelligence
 * layer reads is narrowed to the part the author actually wrote.
 */

/** Lines at/after these markers are channel boilerplate, not content. */
const CUT_MARKERS = [
  /^\s*for (the )?latest (news|updates)/i,
  /^\s*subscribe\b/i,
  /^\s*watch .{0,40}\blive\b\s*[-–:]/i,
  /^\s*download .{0,30}\bapp\b/i,
  /^\s*follow us\b/i,
  /^\s*like us\b/i,
  /^\s*visit us\b/i,
  /^\s*connect with us\b/i,
  /^\s*stay tuned\b/i,
  /^\s*about .{0,40}:\s*$/i,
  /^\s*-{3,}\*+/,
];

/** Individual lines that are always promotional noise. */
const DROP_LINE = [
  /https?:\/\//i,
  /^\s*[-=*_~►▶👉•]+\s*$/, // separator lines
  /\b(subscribe|whatsapp channel|telegram|instagram|facebook|twitter)\b/i,
  /^\s*©/,
  // Emoji-led calls to action ("📺 Your favorite shows are a tap away!").
  /^\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u,
  /\b(download the app|tap away|press the bell|like \| comment)\b/i,
];

/**
 * A line is hashtag noise when hashtags dominate it, even if they run
 * together without spaces (`#agriculture#farming#etv`).
 */
function isHashtagNoise(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("#")) return false;
  const withoutTags = trimmed.replace(/#[\wఀ-౿]+/gu, "").replace(/[\s|,·-]/g, "");
  return withoutTags.length <= Math.max(3, trimmed.length * 0.15);
}

/**
 * SEO keyword tails: long comma-separated lists of channel/news keywords.
 * Detected by comma density rather than by keyword matching.
 */
function isKeywordStuffing(line: string): boolean {
  const commas = (line.match(/,/g) ?? []).length;
  if (commas < 4) return false;
  const segments = line.split(",").map((s) => s.trim());
  const shortSegments = segments.filter((s) => s.length > 0 && s.split(/\s+/).length <= 6);
  return shortSegments.length / segments.length > 0.8;
}

/** Remove hashtag runs that trail real sentences. */
function stripTrailingHashtags(line: string): string {
  return line.replace(/(\s+#[\wఀ-౿]+){2,}\s*$/g, "").trim();
}

export function stripBoilerplate(text: string): string {
  const lines = text.split(/\r?\n/);
  const kept: string[] = [];

  for (const raw of lines) {
    if (CUT_MARKERS.some((re) => re.test(raw))) break;
    if (DROP_LINE.some((re) => re.test(raw))) continue;
    if (isHashtagNoise(raw)) continue;
    if (isKeywordStuffing(raw)) continue;
    const cleaned = stripTrailingHashtags(raw);
    if (cleaned.length > 0) kept.push(cleaned);
  }

  // Collapse repeated blank structure and duplicate consecutive lines
  // (titles are frequently repeated inside descriptions).
  const deduped: string[] = [];
  for (const line of kept) {
    if (deduped.length > 0 && deduped[deduped.length - 1] === line) continue;
    deduped.push(line);
  }

  return deduped.join("\n").trim();
}

/**
 * Build the intelligence-facing text for a mention: title plus the
 * author-written part of the body. Falls back to the original text when
 * stripping removes everything (short posts, official statements).
 */
export function deriveContentText(title: string | null, originalText: string): string {
  const stripped = stripBoilerplate(originalText);
  const body = stripped.length >= 20 ? stripped : originalText;
  if (title && !body.startsWith(title)) {
    return `${title}\n\n${body}`.trim();
  }
  return body.trim();
}

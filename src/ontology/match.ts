/**
 * Ontology matching utilities.
 *
 * Latin-script variants match case-insensitively on word-ish boundaries.
 * Telugu-script variants match as exact substrings (Telugu has no casing and
 * agglutinative suffixes make word-boundary matching counterproductive for a
 * conservative first pass).
 */
import type { OntologyTerm } from "./types";

const TELUGU_RANGE = /[ఀ-౿]/;

export function isTeluguText(variant: string): boolean {
  return TELUGU_RANGE.test(variant);
}

/** Share of Telugu-script characters among all letters in the text. */
export function teluguRatio(text: string): number {
  let telugu = 0;
  let letters = 0;
  for (const ch of text) {
    if (/[ఀ-౿]/.test(ch)) {
      telugu++;
      letters++;
    } else if (/[a-zA-Z]/.test(ch)) {
      letters++;
    }
  }
  return letters === 0 ? 0 : telugu / letters;
}

function latinVariantMatches(text: string, variant: string): boolean {
  // Escape regex specials, then require non-letter boundaries so that
  // e.g. "dap" does not match inside "update".
  const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(^|[^a-z])${escaped}([^a-z]|$)`, "i");
  return re.test(text);
}

export function termMatches(text: string, term: OntologyTerm): boolean {
  const lower = text.toLowerCase();
  for (const exclusion of term.exclusions ?? []) {
    if (
      isTeluguText(exclusion)
        ? text.includes(exclusion)
        : latinVariantMatches(lower, exclusion.toLowerCase())
    ) {
      return false;
    }
  }
  return term.variants.some((v) =>
    isTeluguText(v) ? text.includes(v) : latinVariantMatches(lower, v.toLowerCase()),
  );
}

/** Return every term in the list that matches the text. */
export function matchTerms<T extends OntologyTerm>(text: string, terms: T[]): T[] {
  return terms.filter((t) => termMatches(text, t));
}

/**
 * Ontology configuration types. Everything the listening/relevance/enrichment
 * layers know about Telangana agriculture is expressed as configuration here —
 * never scattered through application code.
 */

export interface OntologyTerm {
  /** Stable identifier, kebab-case. */
  id: string;
  /** Canonical English label. */
  en: string;
  /** Canonical Telugu label, where applicable. */
  te?: string;
  /**
   * All surface forms that count as a match: English variants, Telugu
   * variants, transliterations, abbreviations. Matching is case-insensitive
   * for Latin script and exact-substring for Telugu script.
   */
  variants: string[];
  /** Surface forms that must NOT count as a match (disambiguation). */
  exclusions?: string[];
}

export interface DistrictEntry extends OntologyTerm {
  /** Known mandals (small subset for now; extend without code changes). */
  mandals?: OntologyTerm[];
}

export interface TopicEntry extends OntologyTerm {
  /** Subtopic ids that specialise this topic. */
  subtopics?: OntologyTerm[];
}

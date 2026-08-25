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

export interface GovernmentEntityEntry extends OntologyTerm {
  /**
   * True when the entity is inherently about agriculture (Agriculture
   * Department, Agriculture Minister, agricultural university). Generic
   * offices — the CMO, a district collector, Civil Supplies — are relevant
   * only inside an agriculture context and must NOT by themselves count as
   * agriculture evidence in the relevance gate.
   */
  agricultureSpecific: boolean;
}

export interface DistrictEntry extends OntologyTerm {
  /** Known mandals (small subset for now; extend without code changes). */
  mandals?: OntologyTerm[];
}

export interface TopicEntry extends OntologyTerm {
  /** Subtopic ids that specialise this topic. */
  subtopics?: OntologyTerm[];
}

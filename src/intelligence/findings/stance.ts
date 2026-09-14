/**
 * What a week's evidence says, as opposed to how much of it there is.
 *
 * A finding used to be framed as a concern because it was large. Twenty-six
 * neutral how-to videos about horticulture outranked eighty-nine mostly
 * critical items about power cuts, and were shown with the same "needs
 * attention" label and the same seasonal warning. Volume is a property of
 * the monitoring; stance is what the officer is being asked to act on.
 *
 * Pure — no database imports — so the client-side board can show the same
 * figures the stage computed.
 */

export type Signal = "concern" | "escalating" | "positive" | "coverage";

/** Share of stance-carrying items that are critical or mixed before a week is a concern. */
export const CONCERN_MAJORITY = 0.5;
/** Supportive share that makes a week good news… */
export const POSITIVE_MAJORITY = 0.5;
/** …provided criticism stays under this. */
export const POSITIVE_CONCERN_CEILING = 0.25;
/** Below a majority, criticism still counts when it is clearly rising: */
export const ESCALATION_FLOOR = 0.25;
/** at least this many points above the narrative's four-week share. */
export const ESCALATION_SHIFT = 0.2;

export interface StanceInputs {
  /** Items in the window that carry any stance at all. */
  stanceCarrying: number;
  /** (critical + mixed) ÷ stanceCarrying. "Mixed" carries criticism. */
  concernShare: number;
  /** supportive ÷ stanceCarrying. */
  supportiveShare: number;
  /** The same concern share over the baseline weeks; null when none carried a stance. */
  baselineConcernShare: number | null;
}

export function stanceShares(mix: Record<string, number>): {
  total: number;
  concernShare: number;
  supportiveShare: number;
} {
  const total = Object.values(mix).reduce((a, b) => a + b, 0);
  if (total === 0) return { total, concernShare: 0, supportiveShare: 0 };
  return {
    total,
    concernShare: ((mix["critical"] ?? 0) + (mix["mixed"] ?? 0)) / total,
    supportiveShare: (mix["supportive"] ?? 0) / total,
  };
}

/** The rules, in the order they are applied. */
export function classifySignal(s: StanceInputs): Signal {
  if (s.stanceCarrying === 0) return "coverage";
  if (s.supportiveShare >= POSITIVE_MAJORITY && s.concernShare < POSITIVE_CONCERN_CEILING) {
    return "positive";
  }
  if (s.concernShare >= CONCERN_MAJORITY) return "concern";
  if (
    s.concernShare >= ESCALATION_FLOOR &&
    s.baselineConcernShare !== null &&
    s.concernShare >= s.baselineConcernShare + ESCALATION_SHIFT
  ) {
    return "escalating";
  }
  return "coverage";
}

/**
 * How much stance moves the rank: criticism itself, and criticism that is
 * growing. Both bounded, like every other component.
 */
export function stanceContribution(s: Pick<StanceInputs, "concernShare" | "baselineConcernShare">): number {
  const shift = s.baselineConcernShare === null ? 0 : s.concernShare - s.baselineConcernShare;
  return s.concernShare * 4 + Math.max(0, shift) * 5;
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

/** e.g. "54% of items critical or mixed this week, up from 20% over the previous four weeks". */
export function describeStance(s: StanceInputs): string {
  if (s.stanceCarrying === 0) return "no item this week carries a stance";
  const signal = classifySignal(s);
  if (signal === "positive") {
    return `${pct(s.supportiveShare)} of items supportive this week`;
  }
  const head = `${pct(s.concernShare)} of items critical or mixed this week`;
  if (s.baselineConcernShare === null) return head;
  const delta = s.concernShare - s.baselineConcernShare;
  const compare =
    delta >= 0.1
      ? `up from ${pct(s.baselineConcernShare)}`
      : delta <= -0.1
        ? `down from ${pct(s.baselineConcernShare)}`
        : `in line with ${pct(s.baselineConcernShare)}`;
  return `${head}, ${compare} over the previous four weeks`;
}

/** The same fact as a stat tile. */
export function stanceStat(s: StanceInputs): { value: string; detail: string } {
  if (s.stanceCarrying === 0) return { value: "—", detail: "no stance carried" };
  return {
    value: pct(s.concernShare),
    detail:
      s.baselineConcernShare === null
        ? "no earlier stance"
        : `vs ${pct(s.baselineConcernShare)} 4-week avg`,
  };
}

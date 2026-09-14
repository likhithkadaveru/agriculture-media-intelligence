/**
 * How a finding's week reads against the narrative's own recent past.
 *
 * Pure — no database imports — because the board that shows the label is a
 * client component and must not drag the schema into the browser bundle.
 */

/** Days of evidence a finding describes. */
export const WINDOW_DAYS = 7;
/** Weeks immediately before the window that form the baseline rate. */
export const BASELINE_WEEKS = 4;
/** A week at least this many times its baseline reads as "rising". */
export const RISING_FACTOR = 1.5;

export interface TrajectoryInputs {
  /** Canonical items inside the window. */
  mentionCount: number;
  /** Canonical items per week across the BASELINE_WEEKS before the window. */
  baselineWeeklyRate: number;
  /** mentionCount ÷ baselineWeeklyRate; null when there is no baseline. */
  growthFactor: number | null;
  /** Everything the narrative has ever gathered, for context only. */
  lifetimeMentionCount: number;
}

/** The week against its own recent past, in words an officer can repeat. */
export type Trajectory = "new" | "resurfacing" | "rising" | "steady" | "falling";

export function trajectoryOf(
  c: TrajectoryInputs,
): Trajectory {
  if (c.growthFactor === null) {
    return c.lifetimeMentionCount > c.mentionCount ? "resurfacing" : "new";
  }
  if (c.growthFactor >= RISING_FACTOR) return "rising";
  if (c.growthFactor <= 1 / RISING_FACTOR) return "falling";
  return "steady";
}

function formatRate(rate: number): string {
  return rate >= 10 ? String(Math.round(rate)) : rate.toFixed(1).replace(/\.0$/, "");
}

/** e.g. "3.2× its four-week average of 6 a week" — one clause, no number soup. */
export function describeGrowth(c: TrajectoryInputs): string {
  const weeks = BASELINE_WEEKS === 4 ? "four-week" : `${BASELINE_WEEKS}-week`;
  switch (trajectoryOf(c)) {
    case "new":
      return "first evidence this week";
    case "resurfacing":
      return `resurfacing after no evidence in the previous ${BASELINE_WEEKS} weeks`;
    case "rising":
      return `${c.growthFactor!.toFixed(1).replace(/\.0$/, "")}× its ${weeks} average of ${formatRate(c.baselineWeeklyRate)} a week`;
    case "falling":
      return `down from a ${weeks} average of ${formatRate(c.baselineWeeklyRate)} a week`;
    case "steady":
      return `in line with its ${weeks} average of ${formatRate(c.baselineWeeklyRate)} a week`;
  }
}


/**
 * The same comparison as a figure for a stat tile: "3.2×", "New", "Back",
 * "Flat", "Down" — with the baseline as the detail line.
 */
export function trajectoryStat(c: TrajectoryInputs): { value: string; detail: string } {
  const weeks = `${BASELINE_WEEKS}-week avg`;
  const rate = `${formatRate(c.baselineWeeklyRate)}/week ${weeks}`;
  switch (trajectoryOf(c)) {
    case "new":
      return { value: "New", detail: "no earlier evidence" };
    case "resurfacing":
      return { value: "Back", detail: `quiet for ${BASELINE_WEEKS} weeks` };
    case "rising":
      return { value: `${c.growthFactor!.toFixed(1).replace(/\.0$/, "")}×`, detail: rate };
    case "falling":
      return { value: "Down", detail: rate };
    case "steady":
      return { value: "Flat", detail: rate };
  }
}

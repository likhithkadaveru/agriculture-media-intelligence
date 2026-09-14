/**
 * The windowed half of finding generation: how a week reads against its own
 * baseline, and how much that moves the rank. The stage itself is exercised
 * end to end in pipeline.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
  describeGrowth,
  growthContribution,
  rankScore,
  trajectoryOf,
  type FindingComponents,
} from "@/intelligence/findings/stage";

function components(overrides: Partial<FindingComponents>): FindingComponents {
  return {
    mentionCount: 12,
    independentVoices: 8,
    districtCount: 3,
    districts: ["nizamabad", "siddipet", "khammam"],
    sourceTypeCount: 3,
    sourceTypes: ["news", "youtube", "x"],
    officialVoicePresent: false,
    farmerOriginatedShare: 0,
    criticalShare: 0.8,
    divergenceObserved: false,
    governmentRelevant: true,
    duplicatesExcluded: 0,
    seasonalMultiplier: 1,
    seasonalReason: null,
    seasonalWindow: null,
    windowDays: 7,
    windowEnd: "2026-09-14T00:00:00.000Z",
    baselineWeeklyRate: 4,
    growthFactor: 3,
    lifetimeMentionCount: 28,
    ...overrides,
  };
}

describe("trajectory", () => {
  it("reads a week against the four-week baseline", () => {
    expect(trajectoryOf(components({ growthFactor: 3 }))).toBe("rising");
    expect(trajectoryOf(components({ growthFactor: 1.1 }))).toBe("steady");
    expect(trajectoryOf(components({ growthFactor: 0.4 }))).toBe("falling");
  });

  it("tells a new narrative from one resurfacing after a quiet month", () => {
    expect(
      trajectoryOf(components({ growthFactor: null, mentionCount: 12, lifetimeMentionCount: 12 })),
    ).toBe("new");
    expect(
      trajectoryOf(components({ growthFactor: null, mentionCount: 12, lifetimeMentionCount: 40 })),
    ).toBe("resurfacing");
  });

  it("says the comparison in one clause", () => {
    expect(describeGrowth(components({ growthFactor: 3.25, baselineWeeklyRate: 4 }))).toBe(
      "3.3× its four-week average of 4 a week",
    );
    expect(describeGrowth(components({ growthFactor: null, lifetimeMentionCount: 12 }))).toBe(
      "first evidence this week",
    );
    expect(describeGrowth(components({ growthFactor: 0.5, baselineWeeklyRate: 2.5 }))).toBe(
      "down from a four-week average of 2.5 a week",
    );
  });
});

describe("ranking", () => {
  it("credits growth up to a bounded cap", () => {
    expect(growthContribution({ growthFactor: 1 })).toBe(2);
    expect(growthContribution({ growthFactor: 4 })).toBe(8);
    expect(growthContribution({ growthFactor: 40 })).toBe(8);
    // No baseline reads as the cap: appearing from nothing is the signal.
    expect(growthContribution({ growthFactor: null })).toBe(8);
  });

  it("ranks a surging week above a larger but flat one", () => {
    const surge = components({ mentionCount: 12, independentVoices: 8, growthFactor: 4 });
    const flat = components({ mentionCount: 40, independentVoices: 10, growthFactor: 1 });
    expect(rankScore(surge)).toBeGreaterThan(rankScore(flat));
  });
});

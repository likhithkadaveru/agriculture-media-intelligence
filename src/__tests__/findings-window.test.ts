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
import { classifySignal, describeStance } from "@/intelligence/findings/stance";

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
    stanceMix: { critical: 6, mixed: 1, neutral: 4, supportive: 1 },
    baselineStanceMix: { critical: 3, neutral: 10, supportive: 3 },
    stanceCarrying: 12,
    concernShare: 7 / 12,
    baselineConcernShare: 3 / 16,
    supportiveShare: 1 / 12,
    signal: "concern",
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

describe("stance", () => {
  const stance = (o: Partial<Parameters<typeof classifySignal>[0]>) => ({
    stanceCarrying: 20,
    concernShare: 0,
    supportiveShare: 0,
    baselineConcernShare: 0.2,
    ...o,
  });

  it("needs a critical majority before a week is a concern", () => {
    expect(classifySignal(stance({ concernShare: 0.54 }))).toBe("concern");
    expect(classifySignal(stance({ concernShare: 0.1 }))).toBe("coverage");
    expect(classifySignal(stance({ stanceCarrying: 0 }))).toBe("coverage");
  });

  it("treats a clear rise in criticism as escalating even below a majority", () => {
    expect(classifySignal(stance({ concernShare: 0.4, baselineConcernShare: 0.1 }))).toBe("escalating");
    expect(classifySignal(stance({ concernShare: 0.4, baselineConcernShare: 0.35 }))).toBe("coverage");
    // Nothing to rise from.
    expect(classifySignal(stance({ concernShare: 0.4, baselineConcernShare: null }))).toBe("coverage");
  });

  it("files a supportive majority as good news unless criticism is also present", () => {
    expect(classifySignal(stance({ supportiveShare: 0.7, concernShare: 0.1 }))).toBe("positive");
    expect(classifySignal(stance({ supportiveShare: 0.5, concernShare: 0.5 }))).toBe("concern");
  });

  it("says the stance in one clause", () => {
    expect(describeStance(stance({ concernShare: 0.54, baselineConcernShare: 0.2 }))).toBe(
      "54% of items critical or mixed this week, up from 20% over the previous four weeks",
    );
    expect(describeStance(stance({ supportiveShare: 0.7, concernShare: 0.1 }))).toBe(
      "70% of items supportive this week",
    );
  });

  it("ranks a critical week above a larger neutral one", () => {
    const critical = components({
      mentionCount: 20,
      independentVoices: 8,
      growthFactor: 2,
      concernShare: 0.6,
      baselineConcernShare: 0.2,
    });
    const neutral = components({
      mentionCount: 40,
      independentVoices: 10,
      growthFactor: 2,
      concernShare: 0,
      baselineConcernShare: 0,
      signal: "coverage",
    });
    expect(rankScore(critical)).toBeGreaterThan(rankScore(neutral));
  });
});

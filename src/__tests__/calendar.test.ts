import { describe, expect, it } from "vitest";
import { getSeasonContext, seasonalUrgency } from "@/ontology/calendar";

// Fixed dates so the suite does not drift with the real calendar.
const MID_KHARIF_SOWING = new Date("2026-07-01T06:00:00Z");
// 10 days before Kharif land preparation opens (15 May) — genuinely ahead of
// every window, rather than sitting inside land preparation already.
const BEFORE_KHARIF_SOWING = new Date("2026-05-05T06:00:00Z");
const POST_HARVEST = new Date("2026-11-20T06:00:00Z");

describe("agricultural calendar", () => {
  it("knows which windows are open", () => {
    const ctx = getSeasonContext(MID_KHARIF_SOWING);
    expect(ctx.active.some((w) => w.kind === "sowing" && w.season === "kharif")).toBe(true);
  });

  it("treats a fertilizer problem during sowing as time-critical", () => {
    const u = seasonalUrgency(["fertilizer-availability"], MID_KHARIF_SOWING);
    expect(u.multiplier).toBeGreaterThan(1);
    expect(u.reason).toContain("time-critical");
    expect(u.windowLabel).toBe("Kharif sowing");
  });

  it("weights an approaching window even higher — there is still time to act", () => {
    const ahead = seasonalUrgency(["seeds"], BEFORE_KHARIF_SOWING);
    const during = seasonalUrgency(["seeds"], MID_KHARIF_SOWING);
    expect(ahead.aheadOfWindow).toBe(true);
    expect(ahead.multiplier).toBeGreaterThan(during.multiplier);
    expect(ahead.reason).toContain("cannot be recovered");
  });

  it("does not inflate an unrelated topic", () => {
    const u = seasonalUrgency(["farm-mechanisation"], MID_KHARIF_SOWING);
    expect(u.multiplier).toBe(1);
    expect(u.reason).toBeNull();
  });

  it("handles procurement windows that wrap past the year end", () => {
    const u = seasonalUrgency(["procurement"], new Date("2027-01-10T06:00:00Z"));
    expect(u.multiplier).toBeGreaterThan(1);
  });

  it("returns a neutral result for an item with no topics", () => {
    expect(seasonalUrgency([], MID_KHARIF_SOWING).multiplier).toBe(1);
  });

  it("gives every reason as readable prose, never a bare number", () => {
    const u = seasonalUrgency(["crop-damage"], POST_HARVEST);
    if (u.multiplier !== 1) {
      expect(u.reason).toBeTruthy();
      expect(u.reason!.length).toBeGreaterThan(20);
    }
  });
});

/**
 * Telangana agricultural calendar.
 *
 * The same complaint carries entirely different urgency depending on where
 * the season stands. A DAP shortage two weeks before the sowing window is an
 * emergency, because the crop cycle does not wait; the identical complaint
 * after sowing closes is a grievance to be logged. Media-monitoring tools
 * cannot tell those apart — an agriculture intelligence system must.
 *
 * Windows are approximate and configuration-driven. They describe the normal
 * Telangana pattern for the two main seasons:
 *   Kharif / vanakalam — monsoon crop, sown June–July
 *   Rabi  / yasangi    — winter crop, sown November–December
 *
 * Dates are (month, day) with month 1-12, evaluated in IST.
 */

export type SeasonId = "kharif" | "rabi";

export type WindowKind =
  | "land-preparation"
  | "sowing"
  | "growth"
  | "harvest"
  | "procurement";

export interface CalendarWindow {
  season: SeasonId;
  kind: WindowKind;
  label: string;
  /** Inclusive start and end as [month, day]. May wrap across the year end. */
  start: [number, number];
  end: [number, number];
  /**
   * Topics whose urgency is amplified during this window, because the input
   * or service is time-critical here and a delay cannot be recovered.
   */
  criticalTopics: string[];
  crops: string[];
}

export const CALENDAR: CalendarWindow[] = [
  /* ---------------- Kharif (vanakalam) ---------------- */
  {
    season: "kharif",
    kind: "land-preparation",
    label: "Kharif land preparation",
    start: [5, 15],
    end: [6, 15],
    criticalTopics: ["seeds", "agricultural-credit", "farm-mechanisation"],
    crops: ["paddy", "cotton", "maize", "soybean", "red-gram"],
  },
  {
    season: "kharif",
    kind: "sowing",
    label: "Kharif sowing",
    start: [6, 1],
    end: [7, 31],
    // Everything a farmer must have IN HAND to plant. A shortfall here costs
    // the season, not a week.
    criticalTopics: [
      "seeds",
      "fertilizer-availability",
      "rainfall",
      "agricultural-credit",
      "agricultural-power",
      "irrigation",
    ],
    crops: ["paddy", "cotton", "maize", "soybean", "red-gram"],
  },
  {
    season: "kharif",
    kind: "growth",
    label: "Kharif crop growth",
    start: [8, 1],
    end: [9, 30],
    criticalTopics: [
      "fertilizer-availability",
      "pest-outbreak",
      "irrigation",
      "agricultural-power",
      "rainfall",
    ],
    crops: ["paddy", "cotton", "maize"],
  },
  {
    season: "kharif",
    kind: "harvest",
    label: "Kharif harvest",
    start: [10, 1],
    end: [11, 30],
    criticalTopics: ["crop-damage", "rainfall", "farm-mechanisation", "market-price"],
    crops: ["paddy", "cotton", "maize"],
  },
  {
    season: "kharif",
    kind: "procurement",
    label: "Kharif procurement",
    start: [10, 15],
    end: [1, 31],
    criticalTopics: ["procurement", "market-price", "farmer-support-schemes"],
    crops: ["paddy", "cotton", "maize"],
  },

  /* ---------------- Rabi (yasangi) ---------------- */
  {
    season: "rabi",
    kind: "sowing",
    label: "Rabi sowing",
    start: [11, 1],
    end: [12, 31],
    criticalTopics: [
      "seeds",
      "fertilizer-availability",
      "irrigation",
      "agricultural-power",
      "agricultural-credit",
    ],
    crops: ["paddy", "bengal-gram", "groundnut", "maize"],
  },
  {
    season: "rabi",
    kind: "growth",
    label: "Rabi crop growth",
    start: [1, 1],
    end: [2, 28],
    criticalTopics: ["irrigation", "agricultural-power", "pest-outbreak", "fertilizer-availability"],
    crops: ["paddy", "bengal-gram", "groundnut"],
  },
  {
    season: "rabi",
    kind: "harvest",
    label: "Rabi harvest",
    start: [3, 1],
    end: [4, 30],
    criticalTopics: ["crop-damage", "farm-mechanisation", "market-price", "rainfall"],
    crops: ["paddy", "bengal-gram", "groundnut"],
  },
  {
    season: "rabi",
    kind: "procurement",
    label: "Rabi procurement",
    start: [3, 15],
    end: [6, 30],
    criticalTopics: ["procurement", "market-price", "farmer-support-schemes"],
    crops: ["paddy", "bengal-gram"],
  },
];

/** Day-of-year style ordinal that ignores leap years — adequate for windows. */
function ordinal(month: number, day: number): number {
  return month * 100 + day;
}

function inWindow(w: CalendarWindow, month: number, day: number): boolean {
  const now = ordinal(month, day);
  const from = ordinal(w.start[0], w.start[1]);
  const to = ordinal(w.end[0], w.end[1]);
  // Windows such as procurement may wrap past December into January.
  return from <= to ? now >= from && now <= to : now >= from || now <= to;
}

/** Days until a window opens; 0 if it is already open, null if far away. */
function daysUntil(w: CalendarWindow, date: Date): number | null {
  if (inWindow(w, date.getMonth() + 1, date.getDate())) return 0;
  const year = date.getFullYear();
  for (const y of [year, year + 1]) {
    const start = new Date(Date.UTC(y, w.start[0] - 1, w.start[1]));
    const diff = Math.round((start.getTime() - date.getTime()) / 86400000);
    if (diff >= 0) return diff;
  }
  return null;
}

export interface SeasonContext {
  /** Windows open on the given date. */
  active: CalendarWindow[];
  /** Windows opening within the look-ahead horizon, with days remaining. */
  approaching: { window: CalendarWindow; inDays: number }[];
}

export const APPROACH_HORIZON_DAYS = 21;

export function getSeasonContext(date: Date = new Date()): SeasonContext {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const active = CALENDAR.filter((w) => inWindow(w, month, day));
  const approaching: { window: CalendarWindow; inDays: number }[] = [];
  for (const w of CALENDAR) {
    if (active.includes(w)) continue;
    const d = daysUntil(w, date);
    if (d !== null && d > 0 && d <= APPROACH_HORIZON_DAYS) {
      approaching.push({ window: w, inDays: d });
    }
  }
  approaching.sort((a, b) => a.inDays - b.inDays);
  return { active, approaching };
}

export interface SeasonalUrgency {
  /** 1 = ordinary. Above 1 means the calendar makes this more time-critical. */
  multiplier: number;
  /** Plain-language reason, shown to the reader — never an unexplained score. */
  reason: string | null;
  windowLabel: string | null;
  /** True when the issue is critical to a window opening shortly. */
  aheadOfWindow: boolean;
}

/**
 * Score how time-critical a set of topics is right now.
 *
 * An issue critical to a window that is ALREADY OPEN is urgent. An issue
 * critical to a window about to open is urgent in a different, more
 * actionable way — there is still time to fix it, which is exactly when an
 * officer most wants to know.
 */
export function seasonalUrgency(
  topics: string[],
  date: Date = new Date(),
): SeasonalUrgency {
  if (topics.length === 0) {
    return { multiplier: 1, reason: null, windowLabel: null, aheadOfWindow: false };
  }
  const { active, approaching } = getSeasonContext(date);

  for (const w of active) {
    const hit = topics.find((t) => w.criticalTopics.includes(t));
    if (hit) {
      return {
        multiplier: 1.6,
        reason: `${w.label} is under way — ${hit.replace(/-/g, " ")} is time-critical during this window`,
        windowLabel: w.label,
        aheadOfWindow: false,
      };
    }
  }

  for (const { window: w, inDays } of approaching) {
    const hit = topics.find((t) => w.criticalTopics.includes(t));
    if (hit) {
      return {
        multiplier: 1.9,
        reason: `${w.label} opens in ${inDays} day${inDays === 1 ? "" : "s"} — ${hit.replace(/-/g, " ")} problems cannot be recovered once it starts`,
        windowLabel: w.label,
        aheadOfWindow: true,
      };
    }
  }

  return { multiplier: 1, reason: null, windowLabel: null, aheadOfWindow: false };
}

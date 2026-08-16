/**
 * The week being planned, and the plan itself.
 *
 * ONE agenda, shared by every city. You cannot be in Paris and London at the
 * same moment, but you can be in Paris in the morning and London in the evening,
 * so an entry records which city it came from and a single day can mix them.
 * Switching city changes which cards are on offer — never the plan.
 *
 * Plain data throughout: no SceneObjects, no Textures, so the whole week
 * serialises in one JSON.stringify. Runtime PlacedBlocks are VIEWS over these
 * entries, never the source of truth.
 */

/** One activity placed on one day. cityId + slug identifies it across the catalogue. */
export interface PlacedEntry {
  cityId: string;
  slug: string;
  startHour: number;
  /**
   * Ticked off as the day is lived. Part of the plan record rather than of the
   * pill, for the same reason startHour is: pills are VIEWS, rebuilt from
   * scratch on every day switch and every placement, and anything they hold
   * themselves is lost the next time the row is solved.
   *
   * A removed activity does not remember it: removeEntry drops the record and
   * addEntry writes a fresh one with done false, so putting something back on
   * the day gives you a thing still to do, which is the honest reading.
   */
  done: boolean;
}

export interface DayPlan {
  /** ISO date — stable key for persistence. */
  id: string;
  /** "Thu 13 Aug" — the compact form, used in logs and wherever space is tight. */
  label: string;
  /**
   * "Thu 13 Aug 2026" — the day button, and only the day button.
   *
   * The year is not decoration. Without it the Lens reads as an unnamed week
   * that could be any August; with it the button reads as a real date on a real
   * calendar, which is the whole claim the planner is making. It earns its room
   * on the one control that is about WHICH day, and nowhere else — the seven
   * chips in the dropdown are a week, and a week does not need telling twice.
   */
  longLabel: string;
  /** "Thu" — for the compact week strip. */
  shortLabel: string;
  dayOfMonth: number;
  entries: PlacedEntry[];
}

export interface WeekPlan {
  days: DayPlan[];
  activeDay: number;
}

/**
 * The year and month the week sits in. Held apart from the table because the
 * table repeats them seven times and a trip that moves would otherwise be seven
 * edits and a chance to get one wrong.
 */
const YEAR = "2026";
const MONTH = "Aug";

/** Thu 13 Aug 2026 through Wed 19 Aug 2026. Verified against the calendar. */
const WEEK: [string, string, number][] = [
  ["2026-08-13", "Thu", 13],
  ["2026-08-14", "Fri", 14],
  ["2026-08-15", "Sat", 15],
  ["2026-08-16", "Sun", 16],
  ["2026-08-17", "Mon", 17],
  ["2026-08-18", "Tue", 18],
  ["2026-08-19", "Wed", 19],
];

export function createWeek(): WeekPlan {
  const days: DayPlan[] = [];
  for (let i = 0; i < WEEK.length; i++) {
    const short = WEEK[i][1] + " " + WEEK[i][2] + " " + MONTH;
    days.push({
      id: WEEK[i][0],
      label: short,
      longLabel: short + " " + YEAR,
      shortLabel: WEEK[i][1],
      dayOfMonth: WEEK[i][2],
      entries: [],
    });
  }
  return { days: days, activeDay: 0 };
}

export function activeDayOf(week: WeekPlan): DayPlan {
  return week.days[week.activeDay];
}

export function plannedMinutes(
  day: DayPlan,
  durationFor: (cityId: string, slug: string) => number
): number {
  let total = 0;
  for (let i = 0; i < day.entries.length; i++) {
    total += durationFor(day.entries[i].cityId, day.entries[i].slug);
  }
  return total;
}

export function addEntry(
  day: DayPlan,
  cityId: string,
  slug: string,
  startHour: number
): void {
  day.entries.push({
    cityId: cityId,
    slug: slug,
    startHour: startHour,
    done: false,
  });
}

/** Tick an activity off, or un-tick it. No order is enforced — this is a plan. */
export function setEntryDone(
  day: DayPlan,
  cityId: string,
  slug: string,
  done: boolean
): void {
  for (let i = 0; i < day.entries.length; i++) {
    if (day.entries[i].cityId === cityId && day.entries[i].slug === slug) {
      day.entries[i].done = done;
      return;
    }
  }
}

export function entryDone(day: DayPlan, cityId: string, slug: string): boolean {
  for (let i = 0; i < day.entries.length; i++) {
    if (day.entries[i].cityId === cityId && day.entries[i].slug === slug) {
      return day.entries[i].done === true;
    }
  }
  return false;
}

/** How much of the day has actually been lived. Drives the recap's third piece. */
export function doneCount(day: DayPlan): number {
  let n = 0;
  for (let i = 0; i < day.entries.length; i++) {
    if (day.entries[i].done === true) n++;
  }
  return n;
}

export function removeEntry(day: DayPlan, cityId: string, slug: string): void {
  for (let i = day.entries.length - 1; i >= 0; i--) {
    if (day.entries[i].cityId === cityId && day.entries[i].slug === slug) {
      day.entries.splice(i, 1);
      return;
    }
  }
}

export function setEntryStart(
  day: DayPlan,
  cityId: string,
  slug: string,
  startHour: number
): void {
  for (let i = 0; i < day.entries.length; i++) {
    if (day.entries[i].cityId === cityId && day.entries[i].slug === slug) {
      day.entries[i].startHour = startHour;
      return;
    }
  }
}

/** Is THIS city's activity already on the day? Dimming is per city and per day. */
export function dayHasEntry(day: DayPlan, cityId: string, slug: string): boolean {
  for (let i = 0; i < day.entries.length; i++) {
    if (day.entries[i].cityId === cityId && day.entries[i].slug === slug) return true;
  }
  return false;
}

export function clearDay(day: DayPlan): void {
  day.entries = [];
}

/**
 * Persistence for the week.
 *
 * The entire agenda is one JSON string under one key. Entries are reconciled
 * against the catalogue on load, so a slug that no longer exists is dropped
 * rather than crashing the restore — the plan outlives the data it references.
 */
import { findActivity } from "./Catalogue";
import { DayPlan, WeekPlan, createWeek } from "./WeekPlan";

const KEY = "travelplan.week.v1";

export function saveWeek(week: WeekPlan): void {
  try {
    const store = global.persistentStorageSystem.store;
    store.putString(KEY, JSON.stringify(week));
  } catch (e) {
    print("[P9] save failed: " + e);
  }
}

/** Returns a restored week, or a fresh one when there is nothing usable saved. */
export function loadWeek(): WeekPlan {
  let raw = "";
  try {
    raw = global.persistentStorageSystem.store.getString(KEY);
  } catch (e) {
    raw = "";
  }
  if (!raw || raw.length === 0) return createWeek();

  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    print("[P9] saved plan was unreadable — starting fresh");
    return createWeek();
  }

  // Rebuild on top of a fresh week so the day list always matches this build's
  // dates, even if a previous version saved a different range.
  const week = createWeek();
  if (!parsed || !parsed.days) return week;

  let restored = 0;
  let dropped = 0;
  for (let i = 0; i < week.days.length; i++) {
    const saved = findSavedDay(parsed.days, week.days[i].id);
    if (!saved || !saved.entries) continue;
    for (let e = 0; e < saved.entries.length; e++) {
      const entry = saved.entries[e];
      if (!entry || !entry.slug) continue;
      const cityId = entry.cityId ?? "";
      if (!findActivity(cityId, entry.slug)) {
        dropped++;
        continue;
      }
      week.days[i].entries.push({
        cityId: cityId,
        slug: entry.slug,
        startHour: entry.startHour,
        // `=== true` rather than a truthiness test, so a plan saved before Pass
        // 26 — where the field is simply absent — restores as not done rather
        // than as undefined leaking into the recap's count.
        done: entry.done === true,
      });
      restored++;
    }
  }
  if (typeof parsed.activeDay === "number" && parsed.activeDay >= 0 && parsed.activeDay < week.days.length) {
    week.activeDay = parsed.activeDay;
  }

  print(
    "[P9] plan restored — " +
      restored +
      " activities across the week" +
      (dropped > 0 ? " (" + dropped + " dropped, no longer in the catalogue)" : "")
  );
  return week;
}

function findSavedDay(days: any[], id: string): DayPlan {
  if (!days) return null;
  for (let i = 0; i < days.length; i++) {
    if (days[i] && days[i].id === id) return days[i];
  }
  return null;
}

export function clearSaved(): void {
  try {
    global.persistentStorageSystem.store.putString(KEY, "");
  } catch (e) {}
}

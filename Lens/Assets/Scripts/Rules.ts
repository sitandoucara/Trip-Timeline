/**
 * The two rules that give the day consequences.
 *
 * Pure functions over the catalogue's numeric hours — no scene access, no side
 * effects — so the same check drives BOTH the live ghost preview and the drop
 * decision. One implementation means the preview can never disagree with the
 * outcome, which is what makes a rejection feel fair rather than arbitrary.
 */
import { Activity, formatHour } from "./Catalogue";

/** Anything occupying a span on the bar. PlacedBlock satisfies this directly. */
export interface PlacedSpan {
  readonly activity: Activity;
  readonly startHour: number;
  readonly endHour: number;
}

export type RejectionKind = "closed_early" | "closed_late" | "overlap";

export interface Rejection {
  kind: RejectionKind;
  /** Short, specific, and never scolding. Shown verbatim to the user. */
  message: string;
}

/**
 * Returns null when the placement is allowed, otherwise why it is not.
 *
 * Opening hours are checked before overlap: if a museum is shut, that is the
 * more fundamental problem and the more actionable thing to tell someone.
 */
export function validatePlacement(
  activity: Activity,
  startHour: number,
  placed: PlacedSpan[]
): Rejection {
  const endHour = startHour + activity.durationMin / 60;

  if (startHour < activity.openHour) {
    return {
      kind: "closed_early",
      message: "Opens at " + formatHour(activity.openHour),
    };
  }
  if (endHour > activity.closeHour) {
    return {
      kind: "closed_late",
      message: "Closes at " + formatHour(activity.closeHour),
    };
  }

  for (let i = 0; i < placed.length; i++) {
    const other = placed[i];
    // Strict comparison, so back-to-back activities (ends 12:00, starts 12:00)
    // are allowed — touching is not overlapping.
    if (startHour < other.endHour && endHour > other.startHour) {
      return {
        kind: "overlap",
        message: "Overlaps " + other.activity.name,
      };
    }
  }

  return null;
}

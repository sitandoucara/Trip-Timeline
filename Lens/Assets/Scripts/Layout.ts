/**
 * World layout constants and the time<->length mapping.
 *
 * TIME IS A LENGTH is the whole idea of this Lens, and it lives in exactly one
 * place: CM_PER_HOUR. Everything that draws a block derives its width from it,
 * so a 2h activity is always exactly twice a 1h one, by construction.
 *
 * Units are centimetres, in world space. The composition is a single flat plane
 * at z = Z facing the user, and every hit test in the Lens is a rectangle test on
 * that plane — so world coordinates and layout coordinates are the same thing,
 * deliberately, and nothing has to be transformed to be clicked.
 *
 * ---------------------------------------------------------------------------
 * PASS 11 — THE DISTANCE FIX.
 *
 * The Camera Object is authored at the world ORIGIN and carries no
 * DeviceTracking, so on the glasses the tracking origin IS the eye at Lens
 * start: a plane at z = -75 is 75cm in front of the user's face, and that is
 * what ships.
 *
 * The "1.62m" flagged in Pass 3 was never in the Lens. Lens Studio's Interactive
 * preview stands a SIMULATED head somewhere in its virtual room — measured at
 * z = +78 and again at +94 in the same session — so a composition at z = -65 was
 * being reviewed from 143-159cm while being authored for 65cm. Every "readable
 * but not comfortable" note in Passes 3 to 10 was written against a view more
 * than twice as far away as the one the Lens actually ships.
 *
 * That is why the type sizes below are absolute and derived, not tuned by eye in
 * the preview: at VIEW_DISTANCE the visible frame is 54.1cm wide and 49.7cm tall
 * (39.6deg x 36.6deg) — but the DISPLAY only draws into the middle ~32deg of
 * that, so the board is 41cm wide, at genuine arm's length. To judge any of it honestly, the preview camera has to
 * be moved to the origin first; TravelPlanApp prints the real distance on boot.
 * ---------------------------------------------------------------------------
 */

export const BAR_START_HOUR = 8;
export const BAR_END_HOUR = 22;
export const BAR_HOURS = BAR_END_HOUR - BAR_START_HOUR; // 14

/** Arm's length. Reachable for a direct pinch, comfortable to read across. */
export const VIEW_DISTANCE = 75;
/**
 * Half-extent of what the Specs display can actually draw, at VIEW_DISTANCE.
 * Measured from the preview by finding where Lens content is clipped while the
 * simulated environment carries on: ~16deg off-axis horizontally, so ~21.6cm at
 * 75cm. Everything below is laid out inside this, with margin — NOT inside the
 * preview frame, which is considerably wider and will happily show you content
 * the glasses would cut off.
 */
export const DISPLAY_HALF_W = 20.5;
export const DISPLAY_HALF_H = 19.0;
/**
 * The composition plane, in world space. The camera sits at the origin looking
 * down -Z, so this is simply "VIEW_DISTANCE in front of the user".
 */
export const Z = -VIEW_DISTANCE;

/**
 * THE PLANNER PANEL — Pass 20.
 *
 * Everything to do with the day now lives inside one rounded container: the day
 * button, the recap and Clear day across its top, the pills below them, and the
 * hour line under those. Before this they were five objects floating at four
 * different heights, which is what made the composition read as scattered.
 *
 * The panel is 41cm — the full safe area, and exactly the width of the six-card
 * row above it, so the two share one pair of edges. That is the constraint that
 * forced the one real change to the line: a container has to be wider than the
 * thing it contains, and the line was ALREADY the full 41cm, so the line comes
 * in to 38 and the panel takes over its outer edges. The reference does the same
 * thing in the same proportion — its line is 92.6% of its container, and 38/41
 * is 92.7%. The 08:00-22:00 range is untouched; only CM_PER_HOUR moves, and that
 * is derived rather than authored.
 */
export const PLANNER_W = 41.0;
export const BAR_WIDTH = 38.0;
export const BAR_HALF = BAR_WIDTH / 2;

/** THE constant. 38cm / 14h = 2.714 cm per hour. */
export const CM_PER_HOUR = BAR_WIDTH / BAR_HOURS;

/**
 * The vertical rhythm, top to bottom. Pass 11 closed a 31cm dead gap between the
 * card row and the bar — the eye had to travel the whole frame to get from "what
 * can I add" to "where does it go". The bands are now contiguous: chrome, cards,
 * day strip, bar, readout, with ~1.7cm of air between each.
 */
export const CHROME_Y = 13.6;
/** Card row floats above the line; cards are 7.3 tall, so this spans 3.95..11.25. */
export const CARD_ROW_Y = 7.6;
/** The line sits below eye line, like a desk in front of you. */
export const BAR_Y = -5.0;

/**
 * The panel is DERIVED FROM THE LINE, not placed around it by eye.
 *
 * BAR_Y is the fixed point — it is where the drag from the cards has always
 * landed, and Pass 20 deliberately did not move it, because every gesture in the
 * Lens is calibrated to it. Everything else is measured up and down from there,
 * so changing a gap changes the panel's height rather than silently sliding the
 * line out from under the drop.
 */
const PANEL_PAD_TOP = 0.85;
/** Tall enough for the day button, which is the biggest thing on the control row. */
export const CONTROL_H = 2.3;
const CONTROL_TO_PILLS = 0.85;
/** Air between the line and the foot of a pill — the pills float, as in the reference. */
export const PILL_LIFT = 0.42;
/** Ticks, hour labels and the pad beneath them. */
const PANEL_BELOW_LINE = 2.50;

export const PILL_H = 2.9;
export const PLANNER_TOP =
  BAR_Y + PANEL_PAD_TOP + CONTROL_H + CONTROL_TO_PILLS + PILL_H + PILL_LIFT; // 2.42
export const PLANNER_BOTTOM = BAR_Y - PANEL_BELOW_LINE; // -7.50
export const PLANNER_H = PLANNER_TOP - PLANNER_BOTTOM; // 9.92
export const PLANNER_Y = (PLANNER_TOP + PLANNER_BOTTOM) / 2;

/** Day button left, recap centred, Clear day right — one row across the panel top. */
export const CONTROL_Y = PLANNER_TOP - PANEL_PAD_TOP - CONTROL_H / 2;
const PANEL_PAD_X = 1.3;
/**
 * The day button's own width, mirrored by CLEAR_BTN_X on the other side.
 *
 * PASS 25 took this from 8.2 to 9.5 to seat a calendar mark before the date and
 * the year after it. Both numbers are measured against the font's own metrics,
 * not eyeballed, and the binding string is the widest day the week can hold —
 * "Wed 19 Aug 2026", which measureText puts at 6.26cm at TYPE.label:
 *
 *     pad 0.62 + mark 0.66 + gap 0.36 + text 6.26 + gap 0.44 + chevron 0.52
 *     + pad 0.62  =  9.48, taken to 9.5
 *
 * WHETHER IT NOW HITS THE RECAP — the one thing widening this could break.
 *
 * The button grows RIGHTWARD only: DAY_STRIP_X below is derived from this
 * width, so the left edge stays pinned to the panel's pad at -19.2 and only the
 * right edge moves, from -11.0 to -9.7.
 *
 * The recap is centred on the panel midline, so it grows in BOTH directions and
 * its left edge is half its run. Its widest realistic line is "12 activities ·
 * 14h30 planned" — a fuller day than five cities of six cards can produce —
 * which measures 11.8cm, putting its left edge at -5.9.
 *
 * -9.7 against -5.9 is 3.8cm of air. They cannot meet, and the margin is wide
 * enough that a longer count string would have to double before it mattered.
 */
export const DAY_BTN_W = 9.5;
export const DAY_STRIP_X = -PLANNER_W / 2 + PANEL_PAD_X + DAY_BTN_W / 2;
export const DAY_STRIP_Y = CONTROL_Y;
/** Expanded, the seven dates drop BELOW the whole panel, as a dropdown should. */
export const DAY_STRIP_OPEN_Y = PLANNER_BOTTOM - 0.9 - CONTROL_H / 2;
export const RECAP_Y = CONTROL_Y;

/**
 * The line. Pass 14 turned the glass tube into a hairline: the bar used to be a
 * 1.25cm slab with a glowing core and a scrim band behind it, which was the
 * heaviest object on screen and competed with the pills sitting on it.
 */
export const BAR_THICKNESS = 0.5; // the band the hairline lives in
export const BAR_CORE_THICKNESS = 0.1; // the hairline itself
export const TICK_HEIGHT = 0.5;
export const TICK_GAP = 0.5; // between the line and the tick tops

/**
 * ---------------------------------------------------------------------------
 * PASS 14 — WIDTH IS NO LONGER DURATION.
 *
 * The original idea of this Lens was TIME IS A LENGTH: a block's width came
 * only from widthForMinutes(), so a 2h activity was exactly twice a 1h one by
 * construction. It is a good idea and it is why the bar exists — but it cost
 * legibility, because a block is not free to grow to fit its own name. A 1h
 * Lunch was 2.9cm wide however it was labelled, so names were truncated to
 * "Sein…" or dropped entirely.
 *
 * Blocks are now fixed-width pills, sized to hold a thumbnail, an untruncated
 * name and a duration chip. Time is still position — the dot on the line is at
 * the true start hour — but it is no longer length.
 *
 * The proportional sizing is COMMENTED OUT rather than deleted, right here, so
 * it can be restored in one edit:
 *
 *     export function widthForMinutes(minutes: number): number {
 *       return (minutes / 60) * CM_PER_HOUR;
 *     }
 *     // ...and PlacedBlock/DragController used widthForMinutes(durationMin)
 *     // wherever they now use PILL_W, with blockCenterX() for the position.
 * ---------------------------------------------------------------------------
 */
/**
 * PASS 20 — ONE ROW, AND PILLS THAT ARE THEIR OWN WIDTH.
 *
 * PILL_W and PILL_ROW_STEP are gone. The fixed 8.8cm width is what forced the
 * two-row stagger in the first place — six of them are 52.8cm against a 41cm
 * line — and the stagger was the thing that made the plan hard to read. A pill
 * is now exactly as wide as its own content: thumbnail, one line of name, chip.
 *
 * The name's cap height is SOLVED for the day, not set: PlacedBlock.solveNameHeight
 * takes the whole day's names and returns the largest size at which all of them
 * fit one row. See that function for what the real limit turns out to be.
 */
export const PILL_CHROME_L = 0.26;
export const PILL_THUMB = 1.9;
export const PILL_CHROME_GAP = 0.26;
export const PILL_CHROME_R = 0.30;
/** Everything in a pill that is not the name: pads, thumbnail, gap. */
export const PILL_CHROME =
  PILL_CHROME_L + PILL_THUMB + PILL_CHROME_GAP + PILL_CHROME_R;
/** Smallest air between two pills before they are pushed apart. */
export const PILL_GAP = 0.30;

/** Kept under its old name so DragController's ghost needs no change. */
export const BLOCK_HEIGHT = PILL_H;
/** Blocks float just in front of the line so they read as sitting "on" it. */
export const BLOCK_Z_LIFT = 0.7;
/** The pill's centre, measured up from the line. Its foot floats PILL_LIFT above. */
export const BLOCK_REST_Y = PILL_LIFT + PILL_H / 2;

/** The live-update chip mirrors the back button, top right, both flush to the bar ends. */
export const CHIP_X = 15.5;
export const CHIP_Y = CHROME_Y;

/** "Clear day" sits beside the recap, appearing only when there is something to clear. */
export const CLEAR_BTN_W = 6.6;
export const CLEAR_BTN_H = 2.3;
export const CLEAR_BTN_X = PLANNER_W / 2 - PANEL_PAD_X - CLEAR_BTN_W / 2;

/** Drops snap to half-hours: precise enough to feel deliberate, loose enough to feel easy. */
export const SNAP_HOURS = 0.5;

/**
 * Catch zone around the bar, in bar-local coordinates. Deliberately generous —
 * a drop should feel forgiving, and the bar is only 1.25cm of actual geometry.
 * Scaled with everything else so it stays the same fraction of the drag.
 */
export const BAR_CATCH_Y_MIN = -4.0;
export const BAR_CATCH_Y_MAX = 9.0;
export const BAR_CATCH_X_MARGIN = 1.7;

/**
 * Home screen: five city cards on an arc. Sized so the carousel's outermost
 * card still lands inside DISPLAY_HALF_W once the arc has swung it out and
 * perspective has pulled it back in — see HomeScreen for the arc itself.
 */
export const HOME_CARD_WIDTH = 9.5;
export const HOME_CARD_HEIGHT = 12.5;
export const HOME_CARD_Y = 0.5;

/**
 * Six activity cards, spanning exactly the line's width so the two edges align.
 *
 * PASS 15 turned them from portrait to landscape-ish: 6.7 x 7.3 is a ratio of
 * 0.92, close to the reference's own 317 x 325.
 * Pass 13 read "horizontal" as portrait and shipped 6.5 x 10.4 — a ratio of
 * 0.63 — which is the misread being corrected.
 */
export const CARD_WIDTH = 6.7;
export const CARD_HEIGHT = 7.3;
export const CARD_GAP = 0.16;

/** X of a given clock hour on the bar. 8 -> -20.5, 22 -> +20.5. */
export function xForHour(hour: number): number {
  return -BAR_HALF + (hour - BAR_START_HOUR) * CM_PER_HOUR;
}

/** Inverse — used from Pass 4 to turn a drop position into a time. */
export function hourForX(x: number): number {
  return BAR_START_HOUR + (x + BAR_HALF) / CM_PER_HOUR;
}

/**
 * A duration in minutes, as a length in cm.
 *
 * RETAINED but no longer used for pill width — see the PASS 14 note above. It
 * still describes the bar's time scale and is the function to reach for if
 * proportional blocks come back.
 */
export function widthForMinutes(minutes: number): number {
  return (minutes / 60) * CM_PER_HOUR;
}

/** Centre X of a block starting at `startHour` lasting `minutes`. */
export function blockCenterX(startHour: number, minutes: number): number {
  return xForHour(startHour + minutes / 120);
}

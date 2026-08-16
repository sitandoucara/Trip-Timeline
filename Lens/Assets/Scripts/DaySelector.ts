/**
 * The seven-day strip.
 *
 * Collapsed it is a single chip naming the day you are filling; tapped, it opens
 * into seven. Deliberately not a calendar — no months, no navigation, just the
 * week the trip covers.
 *
 * Each chip carries a dot count for how many activities that day holds, which is
 * the compact week overview: visible only while choosing, so it never clutters
 * the day you are working on.
 */
import { DAY_BTN_W, DAY_STRIP_OPEN_Y, DAY_STRIP_X, DAY_STRIP_Y, Z } from "./Layout";
import { withinRect } from "./ScreenPlane";
import { DayPlan, WeekPlan } from "./WeekPlan";
import {
  STROKE,
  ACCENT,
  Align,
  INK,
  INK_DIM,
  ORDER_STROKE,
  RADIUS,
  TYPE,
  makeGroup,
  makeLabel,
  makeLeftLabel,
  makeQuad,
  makeRoundedFill,
  makeRoundedOutline,
  measureText,
  BODY,
  makeBody,
  makeSurface,
} from "./Theme";

const CHIP_W = 5.0;
const CHIP_H = 2.3;
const CHIP_GAP = 0.42;

/**
 * THE DAY BUTTON'S INTERNAL RHYTHM — Pass 25.
 *
 * The button used to be one centred string, "Fri 14 Aug   ⌄", and that is why
 * it could not take a calendar mark: a mark is geometry, the date is type, and
 * there is no way to centre a mixed run of the two. So the contents are now
 * placed left to right from the button's own left pad and measured at every
 * step, which is the same arithmetic the activity cards use for their clock.
 *
 * Left-anchored rather than centred, deliberately. The seven days are not the
 * same width — "Fri 14" against "Wed 19" is nearly a centimetre — and a centred
 * run would slide the calendar mark sideways every time the day changed. Pinned
 * left, the mark is a fixed landmark and only the free space before the chevron
 * moves, which is what a dropdown button should do.
 */
const PAD_X = 0.62;
/** The calendar mark: page, header band, two binding tabs. */
const CAL_W = 0.66;
const CAL_H = 0.62;
const CAL_STROKE = 0.05;
/** Air between the mark and the date. */
const CAL_GAP = 0.36;
/** Least air between the date and the chevron, on the widest day. */
const CHEV_GAP = 0.44;
/**
 * The chevron, as geometry. Sized to sit where the glyph did: a shade under the
 * cap height of the date beside it, so it reads as part of the same line.
 */
const CHEV_W = 0.52;
/** One arm: thickness, length, and its tilt off vertical. */
const CHEV_T = 0.075;
const CHEV_L = 0.36;
const CHEV_ANGLE = (52.0 * Math.PI) / 180.0;

export class DaySelector {
  public readonly root: SceneObject;
  private collapsedRoot: SceneObject = null;
  private expandedRoot: SceneObject = null;
  private expanded: boolean = false;
  private accent: vec4;

  constructor(
    parent: SceneObject,
    private week: WeekPlan,
    accent: vec4,
    private onPick: (index: number) => void
  ) {
    this.accent = accent;
    this.root = makeGroup(parent, "DaySelector", DAY_STRIP_X, DAY_STRIP_Y, Z);
    this.rebuild();
  }

  /**
   * The chip is ALWAYS drawn; the seven dates hang below it when open. It used
   * to be one or the other, which meant opening the selector removed the very
   * thing you had just tapped and left nothing showing which day you were on.
   */
  public rebuild(): void {
    if (this.collapsedRoot) this.collapsedRoot.destroy();
    if (this.expandedRoot) this.expandedRoot.destroy();
    this.collapsedRoot = null;
    this.expandedRoot = null;
    this.buildCollapsed();
    if (this.expanded) this.buildExpanded();
  }

  private buildCollapsed(): void {
    const day = this.week.days[this.week.activeDay];
    const g = makeGroup(this.root, "collapsed", 0, 0, 0);
    this.collapsedRoot = g;
    makeSurface(g, "surface", DAY_BTN_W, CHIP_H, {
      tint: ACCENT,
      tintEdge: this.expanded,
      body: BODY,
      edge: this.expanded ? 0.95 : 0.6,
      edgeWidth: STROKE,
      radius: RADIUS,
    });

    // [mark] Fri 14 Aug 2026 [chevron] — see the constants above for why this
    // is placed by measurement rather than centred as one string.
    const left = -DAY_BTN_W / 2 + PAD_X;
    this.buildCalendarMark(g, left + CAL_W / 2);
    makeLeftLabel(
      g,
      "label",
      day.longLabel,
      TYPE.label,
      INK,
      left + CAL_W + CAL_GAP,
      0,
      0.02
    );

    /**
     * PASS 28 TURNED THE CHEVRON INTO GEOMETRY, and it was not a style choice.
     *
     * It used to be the glyph "⌄" (U+2304), which Inter ships. Abhaya Libre does
     * NOT — checked against the font's own cmap before the swap, along with every
     * other non-ASCII character this Lens renders, and these two were the only
     * casualties in the whole project. Left as a glyph it would have rendered as
     * nothing or as a hollow box on the one control that tells you the day
     * button opens, and it would have done it silently.
     *
     * So it joins the clock ring and the calendar mark: drawn, not typed. Same
     * reasoning the activity cards recorded in Pass 18 — a mark this small cannot
     * depend on a font shipping a symbol it may not have — now demonstrated
     * rather than predicted.
     */
    this.buildChevron(g, DAY_BTN_W / 2 - PAD_X - CHEV_W / 2, this.expanded);
  }

  /**
   * Two bars meeting at a point. `up` flips it for the open state.
   *
   * Each arm is a thin upright quad rotated in the composition plane about the
   * forward axis. makeQuad already stands its plane upright about `right`, so
   * rotating the PARENT about `forward` is what turns it within the screen
   * rather than out of it — rotating the quad itself would tip it away from the
   * viewer and it would vanish edge-on.
   */
  private buildChevron(parent: SceneObject, cx: number, up: boolean): void {
    const c = new vec4(INK.r, INK.g, INK.b, 0.9);
    // +1 draws the point DOWNWARD, which is the closed state.
    const dir = up ? -1 : 1;
    const tip = -dir;
    for (let i = 0; i < 2; i++) {
      const sign = i === 0 ? -1 : 1;
      const arm = makeGroup(parent, "chevArm", cx + sign * CHEV_W * 0.25, tip * 0.06, 0.02);
      arm
        .getTransform()
        .setLocalRotation(quat.angleAxis(sign * tip * CHEV_ANGLE, vec3.forward()));
      makeQuad(arm, "bar", CHEV_T, CHEV_L, c, true, ORDER_STROKE + 2);
    }
  }

  /**
   * The calendar mark, drawn the way the activity cards draw their clock ring:
   * real geometry, never a font glyph. Inter ships no calendar symbol, and a
   * button that depends on one is a button that shows a hollow box on the day
   * the font is swapped — which is exactly the failure the clock was built to
   * avoid, and the reason that pattern is worth repeating rather than reinventing.
   *
   * Three parts, the fewest that reads as a calendar rather than as a small
   * square: the page outline, a filled header band across its top, and two
   * binding tabs standing above it. The tabs are what do the work — an outlined
   * square with a bar is a document, and it is the two little posts on top that
   * make it a calendar.
   *
   * The whole mark is dropped 0.04cm below the text baseline's centre so that
   * the tabs' overhang does not make it read as sitting high beside the date.
   */
  private buildCalendarMark(parent: SceneObject, cx: number): void {
    const c = new vec4(INK.r, INK.g, INK.b, 0.85);
    const cy = -0.04;

    makeRoundedOutline(parent, "cal", CAL_W, CAL_H, c, CAL_STROKE, ORDER_STROKE + 1, 0.11)
      .getTransform()
      .setLocalPosition(new vec3(cx, cy, 0.02));

    // Inset by the stroke, so the band sits INSIDE the page rather than on it.
    makeQuad(parent, "calHead", CAL_W - CAL_STROKE * 2, 0.13, c, true, ORDER_STROKE + 2)
      .getTransform()
      .setLocalPosition(new vec3(cx, cy + CAL_H / 2 - 0.09, 0.03));

    for (let i = 0; i < 2; i++) {
      makeQuad(parent, "calTab", 0.07, 0.16, c, true, ORDER_STROKE + 2)
        .getTransform()
        .setLocalPosition(
          new vec3(cx + (i === 0 ? -0.17 : 0.17), cy + CAL_H / 2 + 0.05, 0.03)
        );
    }
  }

  /**
   * The seven dates, as a dropdown hanging below the chip.
   *
   * Built with explicit render orders rather than makeSurface, because this is
   * the one thing in the Lens that has to draw OVER other content: the upper
   * pill row sits at almost exactly this height, and a dropdown that a pill
   * shows through is not a dropdown. Orders run 41-47, just above the pills'
   * text at ORDER_TEXT, and stay inside the band the renderer is happy with.
   */
  private buildExpanded(): void {
    // Local, because the root already sits at DAY_STRIP_Y.
    // Local x cancels the root's offset: the trigger sits on the left of the
    // bottom row, but a seven-day strip is 40cm wide and has to be centred.
    const g = makeGroup(
      this.root,
      "expanded",
      -DAY_STRIP_X,
      DAY_STRIP_OPEN_Y - DAY_STRIP_Y,
      0.3
    );
    this.expandedRoot = g;
    const n = this.week.days.length;
    const pitch = CHIP_W + CHIP_GAP;
    const startX = -((n - 1) * pitch) / 2;
    const stripW = n * CHIP_W + (n - 1) * CHIP_GAP + 1.0;

    // One panel behind the whole strip, so the dropdown reads as a single sheet.
    makeBody(g, "sheet", stripW, CHIP_H + 1.0, BODY, 41, RADIUS)
      .getTransform()
      .setLocalPosition(new vec3(0, 0, -0.04));

    for (let i = 0; i < n; i++) {
      const day = this.week.days[i];
      const x = startX + i * pitch;
      const isActive = i === this.week.activeDay;
      const chip = makeGroup(g, "day_" + day.id, x, 0, 0.02);

      if (isActive) {
        makeRoundedFill(
          chip,
          "fill",
          CHIP_W,
          CHIP_H,
          new vec4(ACCENT.r, ACCENT.g, ACCENT.b, 0.3),
          true,
          44,
          RADIUS
        );
      }
      makeRoundedOutline(
        chip,
        "edge",
        CHIP_W,
        CHIP_H,
        isActive
          ? new vec4(ACCENT.r, ACCENT.g, ACCENT.b, 0.95)
          : new vec4(INK.r, INK.g, INK.b, 0.35),
        STROKE,
        45,
        RADIUS
      );
      makeLabel(
        chip,
        "lbl",
        day.shortLabel + " " + day.dayOfMonth,
        TYPE.label,
        isActive ? INK : new vec4(INK_DIM.r, INK_DIM.g, INK_DIM.b, 1),
        Align.Center,
        0,
        0.32,
        0.03
      ).setRenderOrder(47);

      // How full that day is, at a glance.
      const count = day.entries.length;
      if (count > 0) {
        const dotPitch = 0.42;
        const dotStart = -((count - 1) * dotPitch) / 2;
        for (let d = 0; d < count; d++) {
          makeQuad(
            chip,
            "dot",
            0.2,
            0.2,
            new vec4(ACCENT.r, ACCENT.g, ACCENT.b, 0.95),
            true,
            46
          ).getTransform().setLocalPosition(new vec3(dotStart + d * dotPitch, -0.78, 0.03));
        }
      }
    }
  }

  /** Returns true when the tap was consumed by the selector. */
  public handleTap(p: vec3): boolean {
    const onChip = withinRect(p, DAY_STRIP_X, DAY_STRIP_Y, DAY_BTN_W, CHIP_H);
    if (!this.expanded) {
      if (onChip) {
        this.expanded = true;
        this.rebuild();
        return true;
      }
      return false;
    }
    // Tapping the chip again closes it, which is what a dropdown should do.
    if (onChip) {
      this.expanded = false;
      this.rebuild();
      return true;
    }
    const n = this.week.days.length;
    const pitch = CHIP_W + CHIP_GAP;
    const startX = -((n - 1) * pitch) / 2;
    for (let i = 0; i < n; i++) {
      if (withinRect(p, startX + i * pitch, DAY_STRIP_OPEN_Y, CHIP_W, CHIP_H)) {
        this.expanded = false;
        this.onPick(i);
        return true;
      }
    }
    // Tapping away from the strip closes it without changing the day.
    this.expanded = false;
    this.rebuild();
    return true;
  }

  public get isExpanded(): boolean {
    return this.expanded;
  }
}

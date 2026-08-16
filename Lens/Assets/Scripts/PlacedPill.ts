/**
 * A placed activity, as a compact pill.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE IS NOT PlacedBlock.ts
 *
 * It should be. PlacedBlock.ts has been unwritable since Pass 20 — the project
 * sits under ~/Desktop, which macOS protects, and the process doing the file I/O
 * has a per-file grant on eight scripts and none on the rest. Creating new files
 * still works, so the class moved here and TravelPlanApp's single import was
 * repointed. PlacedBlock.ts is now DEAD CODE and should be deleted, and this
 * file renamed back, the moment the folder is writable again.
 *
 * Nothing else imported PlacedBlock — DragController talks to it only through
 * the MovableBlock interface — so the swap is one import line.
 * ---------------------------------------------------------------------------
 *
 * PASS 24 — THE PILL TELLS YOU WHEN.
 *
 * A pill used to carry a duration chip: "2h00". That answers how long, which is
 * the question you ask while choosing an activity, not while reading a full day.
 * Reading a schedule you want to know WHEN, and the dot on the line is a
 * position, not a number you can read off.
 *
 * So the chip is gone and its place is taken by the resolved span, "08:00–20:00",
 * behind a small clock mark. That was not a free swap and the arithmetic is
 * worth recording, because it is the constraint this whole row lives under:
 *
 *   Six pills fit one 38cm row ONLY because each is exactly as wide as its own
 *   content. Carrying the chip AND the span needs two fixed-width numeric
 *   strings side by side, and they do not shrink with the name. Solved across
 *   all five cities the time type would have to be 0.20cm at today's 1.9cm
 *   thumbnail — 9 arcminutes at 75cm, against the ~20 the eye needs — and even
 *   deleting the thumbnail outright only reaches 0.29. It cannot be done.
 *
 *   Replacing the chip instead, and taking the thumbnail to 1.6cm, fits every
 *   city with 0.5cm to spare AND makes every name bigger than it was:
 *
 *       Paris 0.438 -> 0.449   London 0.400 -> 0.426   L.A. 0.380 -> 0.405
 *       Tokyo 0.328 -> 0.349   Marrakech 0.366 -> 0.390
 *
 * The duration is not lost: it is still on the activity card above, and on a
 * full day "08:00–20:00" says more than "2h00" does.
 *
 * The pill is otherwise Pass 20's: one row, variable width, name on ONE line,
 * a dot on the line at the true start hour, and no stem — a pill sits above its
 * own dot and only slides sideways when a neighbour pushes it.
 */
import { Activity, formatHour } from "./Catalogue";
import {
  BAR_Y,
  BLOCK_REST_Y,
  BLOCK_Z_LIFT,
  PILL_H,
  blockCenterX,
  xForHour,
} from "./Layout";
import { activityThumb } from "./Thumbnails";
import {
  ACCENT,
  Align,
  GLASS,
  INK,
  ORDER_FILL,
  ORDER_SCRIM,
  ORDER_STROKE,
  RADIUS,
  STROKE,
  BODY,
  makeBody,
  makeGroup,
  makeLabel,
  makeLeftLabel,
  makeRoundedFill,
  makeRoundedImage,
  makeRoundedOutline,
  measureText,
  setLeftLabel,
  truncateMeasured,
} from "./Theme";

/**
 * THE PILL'S CHROME — everything that is not the name or the time.
 *
 * Exported because TravelPlanApp's row solve has to know it: the name size for
 * a day is whatever leaves all six pills fitting the line, and that arithmetic
 * needs the fixed cost per pill. It used to come from Layout.ts; it lives here
 * now because the thumbnail shrank and Layout is not writable. Move both back
 * when it is.
 */
const PILL_CHROME_L = 0.26;
/** 1.9 -> 1.6 in Pass 24, which is what paid for the time span. */
const PILL_THUMB = 1.6;
const PILL_CHROME_GAP = 0.26;
const PILL_CHROME_R = 0.30;
export const PILL_CHROME =
  PILL_CHROME_L + PILL_THUMB + PILL_CHROME_GAP + PILL_CHROME_R;

/** The name's cap height is solved per day between these, by TravelPlanApp. */
const TIME_SIZE = 0.32;
/** The clock mark leading the time, and the air after it. */
const CLOCK_D = 0.26;
const CLOCK_GAP = 0.13;

/**
 * The lower row is sized against the WIDEST span that can ever appear, not the
 * one showing now — a pill's geometry is built once and its time changes every
 * frame while it is dragged along the line. '4' is the widest digit in Inter,
 * so this is the worst case by construction rather than by sampling.
 */
const SPAN_WIDEST = "44:44–44:44";
export const PILL_LOWER_ROW =
  CLOCK_D + CLOCK_GAP + measureText(SPAN_WIDEST, TIME_SIZE);

/** Where the two rows sit, measured from the pill's centre. */
const NAME_Y = 0.45;
const TIME_Y = -0.52;

export class PlacedBlock {
  public readonly root: SceneObject;
  public readonly activity: Activity;
  public readonly cityId: string;
  public startHour: number;
  /** The pill's own width, from its own content. Read by the row's sweep. */
  public readonly width: number;
  private dot: SceneObject = null;
  private timeLabel: Text = null;
  private timeLeft: number = 0;
  /** Where the pill actually sits, after the row's collision pass. */
  private laidOutX: number = 0;

  constructor(
    parent: SceneObject,
    activity: Activity,
    startHour: number,
    cityId: string,
    /** Solved for the whole day by TravelPlanApp — a pill cannot know it alone. */
    nameHeight: number
  ) {
    this.activity = activity;
    this.cityId = cityId;
    this.startHour = startHour;
    this.laidOutX = this.desiredX;

    // The name may be clipped only if the day is so full that the solve hit its
    // floor; every other day it measures shorter than the space reserved for it.
    const name = truncateMeasured(activity.name, PILL_LOWER_ROW * 2.4, nameHeight);
    const contentW = Math.max(measureText(name, nameHeight), PILL_LOWER_ROW);
    const W = PILL_CHROME + contentW;
    this.width = W;
    const H = PILL_H;

    this.root = makeGroup(
      parent,
      "block_" + activity.slug,
      this.laidOutX,
      BLOCK_REST_Y,
      BLOCK_Z_LIFT
    );

    makeBody(this.root, "pill", W, H, BODY, ORDER_SCRIM, RADIUS)
      .getTransform()
      .setLocalPosition(new vec3(0, 0, -0.06));
    makeRoundedOutline(
      this.root,
      "edge",
      W,
      H,
      new vec4(INK.r, INK.g, INK.b, 0.5),
      STROKE,
      ORDER_STROKE,
      RADIUS
    );

    const left = -W / 2;
    this.buildThumb(cityId, activity, left);
    this.buildText(left, nameHeight, name);
    this.buildAnchor();
  }

  /** A small square of the activity's photograph, at the pill's left end. */
  private buildThumb(cityId: string, activity: Activity, left: number): void {
    const x = left + PILL_CHROME_L + PILL_THUMB / 2;
    const tex = activityThumb(cityId, activity.slug);
    if (!tex) {
      makeRoundedFill(
        this.root,
        "thumbWell",
        PILL_THUMB,
        PILL_THUMB,
        new vec4(GLASS.r, GLASS.g, GLASS.b, 0.3),
        true,
        ORDER_FILL,
        0.30
      ).getTransform().setLocalPosition(new vec3(x, 0, 0.02));
      return;
    }
    // Square and COVER-fitted: the sources are 3:2, so this crops rather than
    // squashing.
    makeRoundedImage(
      this.root,
      "thumb",
      PILL_THUMB,
      PILL_THUMB,
      tex,
      ORDER_FILL,
      0.30,
      null,
      true
    )
      .getTransform()
      .setLocalPosition(new vec3(x, 0, 0.02));
  }

  /** Name on ONE line, and beneath it the clock mark and the resolved span. */
  private buildText(left: number, nameHeight: number, name: string): void {
    const textLeft = left + PILL_CHROME_L + PILL_THUMB + PILL_CHROME_GAP;
    makeLeftLabel(this.root, "name", name, nameHeight, INK, textLeft, NAME_Y, 0.06);

    this.buildClock(textLeft, TIME_Y);
    this.timeLeft = textLeft + CLOCK_D + CLOCK_GAP;
    this.timeLabel = makeLabel(
      this.root,
      "time",
      "",
      TIME_SIZE,
      INK,
      Align.Center,
      this.timeLeft,
      TIME_Y,
      0.06
    );
    this.refreshTime();
  }

  /**
   * The clock mark, the same ring-and-hand the activity cards use rather than a
   * font glyph. It is the one ACCENT left on the pill now the duration chip has
   * gone — it ties the pill's time to its own dot on the line below, and without
   * it the whole plan reads monochrome.
   */
  private buildClock(leftX: number, y: number): void {
    const c = new vec4(ACCENT.r, ACCENT.g, ACCENT.b, 1);
    const cx = leftX + CLOCK_D / 2 - 0.02;
    makeRoundedOutline(this.root, "clock", CLOCK_D, CLOCK_D, c, 0.05, ORDER_STROKE, CLOCK_D / 2)
      .getTransform()
      .setLocalPosition(new vec3(cx, y, 0.06));
    makeRoundedFill(this.root, "hand", 0.04, CLOCK_D * 0.28, c, true, ORDER_STROKE, 0.02)
      .getTransform()
      .setLocalPosition(new vec3(cx, y + CLOCK_D * 0.13, 0.065));
  }

  /** The span, re-anchored — its width changes as the pill slides along the line. */
  private refreshTime(): void {
    if (!this.timeLabel) return;
    setLeftLabel(
      this.timeLabel,
      formatHour(this.startHour) + "–" + formatHour(this.endHour),
      TIME_SIZE,
      this.timeLeft,
      TIME_Y,
      0.06
    );
  }

  /**
   * The dot on the line, at the TRUE start hour. It is a child of the pill, so
   * it is positioned relative to wherever the sweep put it — the dot stays put
   * when the pill is nudged aside.
   */
  private buildAnchor(): void {
    this.dot = makeRoundedFill(
      this.root,
      "dot",
      0.34,
      0.34,
      new vec4(ACCENT.r, ACCENT.g, ACCENT.b, 1),
      true,
      ORDER_STROKE + 2,
      0.17
    );
    this.updateAnchor();
  }

  private updateAnchor(): void {
    if (!this.dot) return;
    const dx = xForHour(this.startHour) - this.laidOutX;
    this.dot.getTransform().setLocalPosition(new vec3(dx, -BLOCK_REST_Y, 0.02));
  }

  /**
   * Where the pill would sit with no neighbours: centred on its SPAN, which is
   * exactly what DragController's snap already assumes.
   */
  private get desiredX(): number {
    return blockCenterX(this.startHour, this.activity.durationMin);
  }

  public get wantsX(): number {
    return this.desiredX;
  }

  public get endHour(): number {
    return this.startHour + this.activity.durationMin / 60;
  }

  public get slug(): string {
    return this.activity.slug;
  }

  /**
   * Put the pill where the row's sweep decided it goes. Called by the app after
   * any change to the day, never by the pill itself — a pill cannot know where
   * its neighbours are.
   */
  public placeAt(x: number): void {
    this.laidOutX = x;
    this.root.getTransform().setLocalPosition(new vec3(x, BLOCK_REST_Y, BLOCK_Z_LIFT));
    this.updateAnchor();
  }

  /** Hit test in composition-plane coordinates, against the pill as drawn. */
  public containsPlanePoint(p: vec3): boolean {
    return (
      Math.abs(p.x - this.laidOutX) <= this.width / 2 &&
      Math.abs(p.y - (BAR_Y + BLOCK_REST_Y)) <= PILL_H / 2
    );
  }

  /**
   * Slide to a new start time. Called every frame while a placed pill is being
   * dragged along the line, so it tracks the pointer directly and does NOT run
   * the sweep — the app re-lays the row out once the drag commits. The span
   * updates with it, which is the whole point of showing it.
   */
  public moveTo(startHour: number): void {
    this.startHour = startHour;
    this.laidOutX = this.desiredX;
    const t = this.root.getTransform();
    const pos = t.getLocalPosition();
    t.setLocalPosition(new vec3(this.laidOutX, pos.y, pos.z));
    this.refreshTime();
    this.updateAnchor();
  }

  public dispose(): void {
    this.root.destroy();
  }
}

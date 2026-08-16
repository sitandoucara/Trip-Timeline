/**
 * A placed activity, as a compact pill.
 *
 * PASS 20 — ONE ROW.
 *
 * The two-row stagger was never a design choice, it was a consequence: at a
 * fixed 8.8cm a pill could not be narrower than its widest possible content, so
 * six of them were 52.8cm against a 41cm line and had to alternate. Reading a
 * plan off two interleaved rows is genuinely hard — the eye has to reconstruct
 * the time order from the dots rather than just read left to right.
 *
 * So the pill is now exactly as wide as ITS OWN content — thumbnail, one line of
 * name, duration chip — and the day solves a single name cap height at which all
 * of its pills fit one row (see solveNameHeight). Three things paid for the
 * width: the start time came off the face, since the dot on the line already
 * marks it; the name is one line always, never two; and the thumbnail came down
 * from 2.5cm to 1.8 and is now cover-fitted square rather than letterboxed.
 *
 * The stem is gone with the second row — a pill sits directly above its own dot
 * now, and only slides sideways when a neighbour pushes it.
 *
 * PASS 14 — the block became a label.
 *
 * It used to BE its duration: width came only from widthForMinutes(), so a 2h
 * activity was exactly twice a 1h one. That is the idea the whole bar was built
 * around, and giving it up was the significant decision of this pass. The reason
 * is that a block sized by time cannot be sized by its content: a 1h Lunch was
 * 2.9cm wide whatever it was called, so names were cut to "Sein…" or dropped
 * altogether, and the one thing a plan must tell you is WHAT you planned.
 *
 * So the pill is now a fixed, comfortable size — thumbnail, untruncated name,
 * duration chip — and TIME IS POSITION rather than length: a small accent dot
 * sits on the line at the true start hour, with a stem connecting it to the pill
 * when the pill has been nudged into the upper row. The bar still tells the
 * truth about when; the pill tells the truth about what.
 *
 * Colour is neutral now. The pill's stroke is white, and the accent appears only
 * on the duration chip and the dot. See ACCENT in Theme for why.
 */
import { Activity, formatDuration } from "./Catalogue";
import {
  BAR_HALF,
  BAR_Y,
  BLOCK_Z_LIFT,
  BLOCK_REST_Y,
  PILL_CHROME,
  PILL_CHROME_GAP,
  PILL_CHROME_L,
  PILL_CHROME_R,
  PILL_GAP,
  PILL_H,
  PILL_THUMB,
  blockCenterX,
  xForHour,
} from "./Layout";
import { activityThumb } from "./Thumbnails";
import {
  ACCENT,
  Align,
  GLASS,
  INK,
  INK_DIM,
  ORDER_FILL,
  ORDER_SCRIM,
  ORDER_STROKE,
  RADIUS,
  STROKE,
  makeGroup,
  makeLabel,
  makeRoundedFill,
  makeRoundedImage,
  makeRoundedOutline,
  BODY,
  makeBody,
  makeLeftLabel,
  measureText,
  truncateMeasured,
} from "./Theme";

/**
 * The name's cap height is solved per day, between these two bounds.
 *
 * NAME_MIN is the honest floor. Below it the names stop being readable at 75cm
 * and the row would be lying about fitting; solveNameHeight clamps here and
 * truncates instead, so a pill can get shorter but never smaller.
 */
const NAME_MAX = 0.46;
const NAME_MIN = 0.36;
const CHIP_SIZE = 0.34;
/** Air around the chip's label, and how tall that makes it. */
const CHIP_PAD = 0.62;
const CHIP_H = 0.86;

/** The name's baseline and the chip's, measured from the pill's centre. */
const NAME_Y = 0.52;
const CHIP_Y = -0.58;

/** Pass 17 deleted BACKING_PASSES and PHOTO_PASSES — see the note in HomeScreen. */


/** Measured width of a pill's name at a given cap height. */
function nameWidth(activity: Activity, heightCm: number): number {
  return measureText(activity.name, heightCm);
}

/** The duration chip is sized to its own label, so it never clips "45min". */
function chipWidth(activity: Activity): number {
  return measureText(formatDuration(activity.durationMin), CHIP_SIZE) + CHIP_PAD;
}

/** The line's width, named here so solveNameHeight reads as arithmetic. */
const BAR_WIDTH_FOR_PILLS = BAR_HALF * 2;

export class PlacedBlock {
  public readonly root: SceneObject;
  public readonly activity: Activity;
  public readonly cityId: string;
  public startHour: number;
  /** The pill's own width, from its own content. Read by the row's sweep. */
  public readonly width: number;
  private dot: SceneObject = null;
  /** Where the pill actually sits, after the row's collision pass. */
  private laidOutX: number = 0;

  /**
   * THE LIMIT, ANSWERED.
   *
   * Returns the largest cap height at which every one of `names` fits on one
   * row, given the line's width and each pill's fixed chrome. Measured against
   * Inter's real advances, the five cities land at:
   *
   *     Paris 0.44   London 0.40   Los Angeles 0.38   Marrakech 0.37
   *     Tokyo 0.33 -> clamped to the 0.36 floor, so its names truncate
   *
   * So six DO fit one row for four cities out of five at a size no smaller than
   * the activity cards already use. Tokyo is the exception and the honest limit:
   * carrying both "Tsukiji Outer Market" and "Sensō-ji Temple" it solves to 0.33,
   * below the floor, so it holds 0.36 and loses the tail of its longest name. Beyond six the solve keeps
   * working and the names keep shrinking until they hit NAME_MIN, at which point
   * pills truncate instead: about eight is where a name starts losing words, and
   * thirteen is where the chrome alone fills the line. The two-row fallback is
   * gone rather than hidden.
   */
  public static solveNameHeight(activities: Activity[]): number {
    const n = activities.length;
    if (n === 0) return NAME_MAX;
    let units = 0;
    for (let i = 0; i < n; i++) units += measureText(activities[i].name, 1.0);
    const budget = BAR_WIDTH_FOR_PILLS - (n - 1) * PILL_GAP - n * PILL_CHROME;
    if (units <= 0) return NAME_MAX;
    const h = budget / units;
    return Math.max(NAME_MIN, Math.min(NAME_MAX, h));
  }

  /** What one pill will measure at a given name height. */
  public static widthFor(activity: Activity, nameHeight: number): number {
    return PILL_CHROME + Math.max(nameWidth(activity, nameHeight), chipWidth(activity));
  }

  constructor(
    parent: SceneObject,
    activity: Activity,
    startHour: number,
    cityId: string,
    /** Solved for the whole day by solveNameHeight — a pill cannot know it alone. */
    nameHeight: number
  ) {
    this.activity = activity;
    this.cityId = cityId;
    this.startHour = startHour;
    this.laidOutX = this.desiredX;

    const contentW = Math.max(nameWidth(activity, nameHeight), chipWidth(activity));
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

    // PASS 15: a rounded RECTANGLE, matching the buttons and the city cards.
    const radius = RADIUS;
    makeBody(this.root, "pill", W, H, BODY, ORDER_SCRIM, radius)
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
      radius
    );

    const left = -W / 2;
    this.buildThumb(cityId, activity, left);
    this.buildText(activity, left, nameHeight, contentW);
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
        0.34
      ).getTransform().setLocalPosition(new vec3(x, 0, 0.02));
      return;
    }
    // Square and COVER-fitted: the sources are 3:2, so this crops rather than
    // squashing. Before Pass 17 there was no cover fit and the box had to be
    // letterboxed to 3:2 instead, which cost height the pill no longer has.
    makeRoundedImage(
      this.root,
      "thumb",
      PILL_THUMB,
      PILL_THUMB,
      tex,
      ORDER_FILL,
      0.34,
      null,
      true
    )
      .getTransform()
      .setLocalPosition(new vec3(x, 0, 0.02));
  }

  /**
   * Name on ONE line, duration chip beneath it. Never two lines, never a start
   * time — the dot on the line is what says when.
   */
  private buildText(
    activity: Activity,
    left: number,
    nameHeight: number,
    contentW: number
  ): void {
    const textLeft = left + PILL_CHROME_L + PILL_THUMB + PILL_CHROME_GAP;

    // Truncation only ever bites when solveNameHeight hit its floor; at every
    // other size the name measured shorter than the space reserved for it.
    const name = truncateMeasured(activity.name, contentW, nameHeight);
    makeLeftLabel(this.root, "name", name, nameHeight, INK, textLeft, NAME_Y, 0.06);

    const label = formatDuration(activity.durationMin);
    const chipW = chipWidth(activity);
    const chip = makeGroup(this.root, "durChip", textLeft + chipW / 2, CHIP_Y, 0.06);
    makeRoundedFill(
      chip,
      "chipFill",
      chipW,
      CHIP_H,
      new vec4(ACCENT.r, ACCENT.g, ACCENT.b, 0.34),
      true,
      ORDER_FILL + 2,
      0.28
    );
    makeRoundedOutline(
      chip,
      "chipEdge",
      chipW,
      CHIP_H,
      new vec4(ACCENT.r, ACCENT.g, ACCENT.b, 0.9),
      STROKE,
      ORDER_STROKE,
      0.28
    );
    makeLabel(chip, "chipText", label, CHIP_SIZE, INK, Align.Center, 0, 0, 0.02);
  }

  /**
   * The dot on the line, at the TRUE start hour.
   *
   * It is a child of the pill, so it is positioned relative to wherever the
   * sweep put it — the dot stays put when the pill is nudged aside. The stem
   * that used to reach down from the upper row is gone with that row.
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
   * the sweep — the app re-lays the row out once the drag commits.
   */
  public moveTo(startHour: number): void {
    this.startHour = startHour;
    this.laidOutX = this.desiredX;
    const t = this.root.getTransform();
    const pos = t.getLocalPosition();
    t.setLocalPosition(new vec3(this.laidOutX, pos.y, pos.z));
    this.updateAnchor();
  }

  public dispose(): void {
    this.root.destroy();
  }
}

/**
 * A placed activity, as a compact pill. THIS IS THE LIVE ONE.
 *
 * ---------------------------------------------------------------------------
 * THREE FILES, ONE CLASS — and how to clean it up.
 *
 * The project sits under ~/Desktop, which macOS protects, and the process doing
 * the file I/O holds a per-file grant on a handful of scripts and none on the
 * rest. Since Pass 20 that has meant PlacedBlock.ts cannot be opened at all.
 * Creating a file still works — but a NEW file gets no grant either, so it can
 * be written exactly once and never edited or deleted.
 *
 * So this class now exists three times. Delete the first two the moment the
 * folder is writable, and rename this one back to PlacedBlock.ts:
 *
 *     PlacedBlock.ts   DEAD  — Pass 20's version, unreachable
 *     PlacedPill.ts    DEAD  — Pass 24 attempt 1, wrong thumbnail (1.6)
 *     Pill.ts          LIVE  — this file
 *     _t1.ts           DEAD  — empty, a permissions probe that could not be removed
 *
 * Nothing but TravelPlanApp imports it; DragController talks to it only through
 * the MovableBlock interface. So the swap is one import line.
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
 * behind a small clock mark. That was not a free swap, and the arithmetic is the
 * constraint this whole row lives under:
 *
 *   Six pills fit one 38cm row ONLY because each is exactly as wide as its own
 *   content. Carrying the chip AND the span needs two fixed-width numeric
 *   strings side by side, and neither shrinks with the name. Solved across all
 *   five cities the time type would have to be 0.20cm at the old 1.9cm
 *   thumbnail — 9 arcminutes at 75cm, against the ~20 the eye needs — and even
 *   deleting the thumbnail outright only reaches 0.29. It cannot be done.
 *
 *   Replacing the chip, and taking the thumbnail to 1.4cm with 0.26cm between
 *   pills, fits every city with the full 0.5cm of slack still in hand:
 *
 *       Paris 0.438 -> 0.432    London 0.400 -> 0.428    L.A. 0.380 -> 0.394
 *       Tokyo 0.328 -> 0.345    Marrakech  0.366 -> 0.405
 *
 *   Four of the five gain cap height over the chip layout; Paris loses six
 *   thousandths of a centimetre. Tokyo, which has always been the binding city,
 *   ends up further from its floor than it was before.
 *
 * The duration is not lost: it is still on the activity card above, and on a
 * full day "08:00–20:00" says more than "2h00" does.
 *
 * Otherwise this is Pass 20's pill: one row, variable width, name on ONE line,
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
  PHOTO_GAIN,
  PHOTO_LIFT,
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
  setBodyEmission,
  setLeftLabel,
  setPhotoTint,
  setShapeColor,
  truncateMeasured,
} from "./Theme";

/**
 * THE PILL'S CHROME — everything that is not the name or the time.
 *
 * Exported because TravelPlanApp's row solve has to know it: the name size for
 * a day is whatever leaves all six pills fitting the line, and that arithmetic
 * needs the fixed cost per pill. These used to live in Layout.ts and belong
 * there; they are here only because that file is not writable.
 */
const PILL_CHROME_L = 0.26;
/** 1.9 -> 1.4 in Pass 24. This is what paid for the time span. */
const PILL_THUMB = 1.4;
const PILL_CHROME_GAP = 0.26;
const PILL_CHROME_R = 0.30;
export const PILL_CHROME =
  PILL_CHROME_L + PILL_THUMB + PILL_CHROME_GAP + PILL_CHROME_R;

/** Air between two pills. 0.30 -> 0.26 here, which bought back the last of it. */
export const PILL_GAP = 0.26;

const TIME_SIZE = 0.32;
/** The clock mark leading the time, and the air after it. */
const CLOCK_D = 0.26;
const CLOCK_GAP = 0.13;

/**
 * The lower row is sized against the WIDEST span that can ever appear, not the
 * one showing now — a pill's geometry is built once, and its time changes every
 * frame while it is dragged along the line. '4' is the widest digit in Inter, so
 * this is the worst case by construction rather than by sampling.
 */
const SPAN_WIDEST = "44:44–44:44";
export const PILL_LOWER_ROW =
  CLOCK_D + CLOCK_GAP + measureText(SPAN_WIDEST, TIME_SIZE);

/**
 * A ceiling on one pill's name, so a pathological entry cannot blow the row on
 * its own. The day solve keeps every real name well under this, so it does not
 * bite in practice — it is a backstop, not a layout rule.
 *
 * PASS 28 TOOK IT FROM 6.0 TO 7.2, because on the serif it had stopped being a
 * backstop and started being a layout rule. Measured at NAME_CEIL, the widest
 * real names in the catalogue are:
 *
 *     Tsukiji Outer Market   Abhaya 7.02   Inter 6.28
 *     Griffith Observatory   Abhaya 6.91   Inter 6.18
 *     Westminster Abbey      Abhaya 6.57   Inter 6.11
 *     Santa Monica Pier      Abhaya 6.10   Inter 5.62
 *
 * So three of them were ALREADY over 6.0 on Inter — the backstop only escaped
 * notice because it bites solely on a sparse day, where the solve leaves the
 * name at the ceiling. Abhaya adds a fourth and made it visible: a two-activity
 * day showed "Santa Monica Pi…" on the pill. 7.2 clears the widest name in the
 * catalogue with 0.18cm in hand.
 *
 * Raising it cannot overflow the row. solveRowNameHeight measures the FULL name
 * and drops the day's cap height until the row fits; truncation here only ever
 * makes a pill narrower than the solve already assumed.
 */
const MAX_NAME_W = 7.2;

/** Where the two rows sit, measured from the pill's centre. */
const NAME_Y = 0.45;
const TIME_Y = -0.52;

/**
 * DONE — PASS 26.
 *
 * A ticked-off pill is DIMMED, which is the language a placed activity card
 * already speaks in the panel above. Nothing new is added to the pill: no tick,
 * no strikethrough, no second colour. A day that is half lived should read as a
 * row where some pills have receded, not as a row carrying a new kind of badge.
 *
 * Two factors rather than one, and the split is the whole reason this reads at
 * arm's length. The brief is "dimmed but fully readable", and those pull against
 * each other on an additive display: the chrome — body, edge, thumbnail, clock,
 * dot — is what carries the sense of recession, while the NAME and the SPAN are
 * the only parts anyone actually reads. Taking both down together to a single
 * 0.5 made done pills honestly hard to read on a busy street. Taking the chrome
 * down further than the type keeps the glance-level signal and the words.
 *
 * 0.50 against 1.0 is a full stop of light — unmistakable across a row of six,
 * which is the acceptance test that matters here.
 */
const DONE_CHROME = 0.5;
const DONE_TEXT = 0.66;

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

  /**
   * Every part the done-dim drives, kept because setDone has to recolour a pill
   * that was built some time ago. `thumbLift`/`thumbImg` are the two halves of a
   * photographic thumbnail and are null when the activity has no picture, in
   * which case `thumbWell` is the fallback fill instead — exactly one of the two
   * shapes exists on any given pill.
   */
  private body: SceneObject = null;
  private edge: SceneObject = null;
  private thumbLift: SceneObject = null;
  private thumbImg: SceneObject = null;
  private thumbWell: SceneObject = null;
  private clockRing: SceneObject = null;
  private clockHand: SceneObject = null;
  private nameLabel: Text = null;
  private isDone: boolean = false;

  constructor(
    parent: SceneObject,
    activity: Activity,
    startHour: number,
    cityId: string,
    /** Solved for the whole day by TravelPlanApp — a pill cannot know it alone. */
    nameHeight: number,
    /** Restored from the plan record, so a rebuilt row keeps its ticks. */
    done: boolean = false
  ) {
    this.activity = activity;
    this.cityId = cityId;
    this.startHour = startHour;
    this.laidOutX = this.desiredX;

    const name = truncateMeasured(activity.name, MAX_NAME_W, nameHeight);
    // The pill can never be narrower than its time row, which is why the day
    // solve has to bisect rather than divide — see solveRowNameHeight.
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

    this.body = makeBody(this.root, "pill", W, H, BODY, ORDER_SCRIM, RADIUS);
    this.body.getTransform().setLocalPosition(new vec3(0, 0, -0.06));
    this.edge = makeRoundedOutline(
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

    // Applied last, so it lands on a pill that is fully built. Skipped when the
    // pill is not done, which keeps a fresh row from touching any material.
    if (done) this.setDone(true);
  }

  /** A small square of the activity's photograph, at the pill's left end. */
  private buildThumb(cityId: string, activity: Activity, left: number): void {
    const x = left + PILL_CHROME_L + PILL_THUMB / 2;
    const tex = activityThumb(cityId, activity.slug);
    if (!tex) {
      this.thumbWell = makeRoundedFill(
        this.root,
        "thumbWell",
        PILL_THUMB,
        PILL_THUMB,
        new vec4(GLASS.r, GLASS.g, GLASS.b, 0.3),
        true,
        ORDER_FILL,
        0.28
      );
      this.thumbWell.getTransform().setLocalPosition(new vec3(x, 0, 0.02));
      return;
    }
    // Square and COVER-fitted: the sources are 3:2, so this crops rather than
    // squashing.
    const thumb = makeRoundedImage(
      this.root,
      "thumb",
      PILL_THUMB,
      PILL_THUMB,
      tex,
      ORDER_FILL,
      0.28,
      null,
      true
    );
    thumb.getTransform().setLocalPosition(new vec3(x, 0, 0.02));
    // A GROUP: the lift plate that gives the picture a floor, then the picture.
    this.thumbLift = thumb.getChild(0);
    this.thumbImg = thumb.getChild(1);
  }

  /** Name on ONE line, and beneath it the clock mark and the resolved span. */
  private buildText(left: number, nameHeight: number, name: string): void {
    const textLeft = left + PILL_CHROME_L + PILL_THUMB + PILL_CHROME_GAP;
    this.nameLabel = makeLeftLabel(
      this.root,
      "name",
      name,
      nameHeight,
      INK,
      textLeft,
      NAME_Y,
      0.06
    );

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
   * it a full row of pills reads monochrome.
   */
  private buildClock(leftX: number, y: number): void {
    const c = new vec4(ACCENT.r, ACCENT.g, ACCENT.b, 1);
    const cx = leftX + CLOCK_D / 2 - 0.02;
    this.clockRing = makeRoundedOutline(
      this.root,
      "clock",
      CLOCK_D,
      CLOCK_D,
      c,
      0.05,
      ORDER_STROKE,
      CLOCK_D / 2
    );
    this.clockRing.getTransform().setLocalPosition(new vec3(cx, y, 0.06));
    this.clockHand = makeRoundedFill(
      this.root,
      "hand",
      0.04,
      CLOCK_D * 0.28,
      c,
      true,
      ORDER_STROKE,
      0.02
    );
    this.clockHand.getTransform().setLocalPosition(
      new vec3(cx, y + CLOCK_D * 0.13, 0.065)
    );
  }

  /** The span, re-anchored — it changes as the pill slides along the line. */
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

  public get done(): boolean {
    return this.isDone;
  }

  /**
   * Tick the pill off, or un-tick it. Idempotent and endlessly reversible.
   *
   * WHY THIS WRITES THROUGH THE MATERIALS RATHER THAN USING A FADER.
   *
   * A Fader would be four lines instead of forty, it is reversible, and it is
   * exactly what ActivityCard.setDimmed uses for the placed-card dim this look
   * is modelled on. It is still the wrong tool here, for a reason that only
   * shows up on the way OUT of a city.
   *
   * A Fader keeps its dim in `mainPassOverrides`, leaving `mainPass` at the
   * bright authored colour. goHome then builds a SECOND Fader over the whole
   * planner to fade it away, and that one captures each visual's `mainPass` —
   * the bright value. So every done pill would snap back to full brightness on
   * the first frame of the exit fade and then fade out from there. A visible
   * flash, on the one transition a demo is most likely to record.
   *
   * The Theme helpers write the dim into the material itself, so `mainPass`
   * always tells the truth and any Fader built afterwards captures the pill as
   * it actually looks. They also keep any override already present in step,
   * which is what makes this survive being toggled after a screen fade — see the
   * Pass 25 note above `retint` for why an override cannot simply be cleared.
   */
  public setDone(done: boolean): void {
    this.isDone = done;
    const k = done ? DONE_CHROME : 1.0;
    const t = done ? DONE_TEXT : 1.0;

    setBodyEmission(this.body, BODY * k);
    setShapeColor(this.edge, new vec4(INK.r, INK.g, INK.b, 0.5 * k), true);

    if (this.thumbImg) {
      // makeRoundedImage was given no tint, so the plate's authored emission is
      // a plain PHOTO_LIFT and the picture's a plain PHOTO_GAIN. Both simply
      // scale — there is no neighbour-dimming term on a pill as there is on a
      // carousel card.
      setBodyEmission(this.thumbLift, PHOTO_LIFT * k);
      setPhotoTint(this.thumbImg, new vec4(PHOTO_GAIN * k, PHOTO_GAIN * k, PHOTO_GAIN * k, 1));
    }
    if (this.thumbWell) {
      setShapeColor(this.thumbWell, new vec4(GLASS.r, GLASS.g, GLASS.b, 0.3 * k), true);
    }

    const accent = new vec4(ACCENT.r, ACCENT.g, ACCENT.b, k);
    setShapeColor(this.clockRing, accent, true);
    setShapeColor(this.clockHand, accent, true);
    // The dot on the line goes with it. It is the pill's mark on the timeline,
    // and a bright dot under a receded pill would read as the one part of the
    // activity still outstanding.
    if (this.dot) setShapeColor(this.dot, accent, true);

    if (this.nameLabel) this.nameLabel.textFill.color = new vec4(INK.r, INK.g, INK.b, t);
    if (this.timeLabel) this.timeLabel.textFill.color = new vec4(INK.r, INK.g, INK.b, t);
  }

  public dispose(): void {
    this.root.destroy();
  }
}

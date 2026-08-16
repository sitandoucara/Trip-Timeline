/**
 * The activity detail frame.
 *
 * ---------------------------------------------------------------------------
 * PASS 16 — REDRAWN TO Assets/Inspi/card_inspi.
 *
 * The reference is a landscape frame split in two: a full-height PHOTOGRAPH on
 * the left, and on the right a single quiet column that reads straight down —
 * category tag, name, one sentence, a rule, four facts in a row, a rule, a
 * closing note. One stroke colour, one corner radius, no panel inside the
 * panel, and the close button alone in its own corner.
 *
 * What changed from Pass 11, and why:
 *
 *   - the old panel was TWO CENTRED COLUMNS — photo+name+prose stacked on the
 *     left, three label/value pairs stacked on the right, each with its own
 *     hairline. That is a different design from the reference, not a rougher
 *     version of it. The facts now run ACROSS in one row, which is what makes
 *     the right side read as one column instead of two lists side by side.
 *   - every hue is gone. The panel used activity.color for its edge, its
 *     photograph's outline and its category chip, so the Louvre's panel was
 *     outlined in amber and Montmartre's in orange. The reference has one
 *     accent, and Pass 14 already decided that hues belong to the cards and the
 *     planner is neutral — the panel was the last place still disagreeing.
 *   - the photograph is COVER-fitted. Thumbnails are 768x512 and this box is a
 *     0.89 portrait, so the old stretch squeezed every photograph to 60% of its
 *     true aspect.
 *   - text is placed by MEASUREMENT, not by character count. See measureText in
 *     Theme: the four facts have to share one known width, and the conservative
 *     estimate textWidth() uses for wrapping allocates that badly.
 *
 * The reference's "What to expect" bullets are NOT here, and cannot be: the
 * catalogue has no such field and the live fetch may not invent one. Rather
 * than ship an empty heading, the panel is shorter than the reference by
 * exactly that band — see the summary.
 * ---------------------------------------------------------------------------
 *
 * While it is open it is the ONLY thing on screen. TravelPlanApp.setModal hides
 * the cards, the chrome, the line, everything placed on it, the day controls and
 * the recap — not dimmed, hidden — so there is nothing to drag by accident,
 * nothing behind the panel to read through it, and nothing for the close button
 * to collide with.
 */
import { Activity, formatDuration, formatHour } from "./Catalogue";
import { Z } from "./Layout";
import { withinRect } from "./ScreenPlane";
import {
  ACCENT,
  Align,
  BODY,
  GLASS,
  INK,
  INK_DIM,
  ORDER_FILL,
  ORDER_STROKE,
  RADIUS,
  STROKE,
  TYPE,
  lit,
  makeGroup,
  makeLabel,
  makeLeftLabel,
  makeQuad,
  makeRoundedFill,
  makeRoundedImage,
  makeRoundedOutline,
  makeSurface,
  measureText,
  truncateMeasured,
  wrapMeasured,
} from "./Theme";
import { activityThumb } from "./Thumbnails";

/**
 * THE FRAME.
 *
 * 39cm wide is the full board — the same frame the card row and the line
 * occupy, so the panel replaces the planner rather than floating in front of a
 * smaller hole in it. Height is not chosen, it is DERIVED: it is whatever the
 * tallest possible column needs (a two-line name, three lines of prose, three
 * closing notes) plus the top and bottom padding, and the constant below is that
 * number. Change a gap and this has to change with it.
 */
const PANEL_W = 39.0;
const PANEL_H = 19.4;
const PANEL_Y = 1.6;

/** The photograph's margin inside the panel edge — the reference's is hairline. */
const INSET = 0.7;
const PHOTO_W = 16.0;
const PHOTO_H = PANEL_H - INSET * 2; // 18.0 — full height, as in the reference
const PHOTO_X = -PANEL_W / 2 + INSET + PHOTO_W / 2; // -10.8

/** The information column, stated once. Everything on the right derives from it. */
const GUTTER = 1.7;
const RIGHT_PAD = 1.6;
const CX0 = PHOTO_X + PHOTO_W / 2 + GUTTER; // -1.1
const CX1 = PANEL_W / 2 - RIGHT_PAD; // 17.9
const RW = CX1 - CX0; // 19.0

/** First baseline and last, measured from the reference's own proportions. */
const PAD_TOP = 2.0;
const PAD_BOTTOM = 1.8;
const TOP_Y = PANEL_H / 2 - PAD_TOP; // 7.7

/** Leftover room is shared between the gaps separating the column's sections. */
const GAP_COUNT = 5;
const GAP_MAX_EXTRA = 1.1;

/** Close sits in the panel's own corner, its right edge flush with the column. */
const CLOSE_D = 2.2;
const CLOSE_X = CX1 - CLOSE_D / 2; // 16.8
const CLOSE_Y = TOP_Y;

/** Type roles. The title is fitted between the two bounds; the rest are fixed. */
const TITLE_MAX = TYPE.display;
const TITLE_MIN = TYPE.title;
const DESC_H = TYPE.head;
const DESC_STEP = 0.90;
const NOTE_H = TYPE.body;
const NOTE_STEP = 0.88;

/** The four facts share one row, so their widths are solved rather than set. */
const FACT_GAP = 0.7;
const CHIP_PAD = 1.2;
/** Ceiling on one fact's share of the row. "Sunrise – sunset" is the worst at 0.40. */
const FACT_MAX_SHARE = 0.46;

export class DetailPanel {
  public readonly root: SceneObject;
  public readonly activity: Activity;

  constructor(parent: SceneObject, activity: Activity, cityId: string) {
    this.activity = activity;
    this.root = makeGroup(parent, "DetailPanel", 0, PANEL_Y, Z);

    // One surface, one stroke colour, one radius — the same as every other
    // rounded thing in the Lens, and since Pass 17 the same dark neutral body.
    makeSurface(this.root, "surface", PANEL_W, PANEL_H, {
      bloom: false,
      body: BODY,
      edge: 0.7,
      edgeWidth: STROKE,
      radius: RADIUS,
    });

    this.buildPhoto(activity, cityId);
    this.buildColumn(activity);
    this.buildClose();
  }

  /** Left half, full height, no outline. The reference frames it with nothing. */
  private buildPhoto(activity: Activity, cityId: string): void {
    const tex = activityThumb(cityId, activity.slug);
    if (!tex) return;
    makeRoundedImage(
      this.root,
      "photo",
      PHOTO_W,
      PHOTO_H,
      tex,
      ORDER_FILL + 1,
      RADIUS,
      null,
      true // cover-fit: 3:2 thumbnail into a 0.89 portrait box
    )
      .getTransform()
      .setLocalPosition(new vec3(PHOTO_X, 0, 0.01));
  }

  /**
   * The right column, in two passes.
   *
   * The panel is one fixed size for every activity — a frame that resized as you
   * looked through the catalogue would be worse than any spacing problem it
   * solved. But the content is NOT one size: the Eiffel Tower carries two lines
   * of prose and one closing note, Griffith Observatory two and three, Meiji
   * Shrine two and two. Sized for the longest, the shortest left five
   * centimetres of nothing at the bottom, which reads as a hole rather than as
   * padding.
   *
   * So the column is measured first with no drawing, and whatever room is left
   * over is handed back to the five gaps BETWEEN its sections rather than dumped
   * at the foot. A sparse entry breathes; a full one packs tight; both fill the
   * frame. The cap stops a two-line panel from turning into five floating bands.
   */
  private buildColumn(a: Activity): void {
    const title = this.fitTitle(a.name);
    const desc = wrapMeasured(a.description, RW, DESC_H, 3);
    // Nothing here is invented: the exception comes out of hoursText, the latest
    // start is arithmetic on the opening window and the duration, and "free" is
    // the price. See buildNotes.
    const notes = this.buildNotes(a);

    const bottom = this.walk(a, title, desc, notes, 0, false);
    const slack = bottom - (-PANEL_H / 2 + PAD_BOTTOM);
    const extra = Math.max(0, Math.min(GAP_MAX_EXTRA, slack / GAP_COUNT));
    this.walk(a, title, desc, notes, extra, true);
  }

  /**
   * One descent of the column. `extra` widens each flexible gap; `draw` off
   * measures without building, so both passes are the same code and cannot
   * disagree. Returns the y of the bottom of the last line drawn.
   */
  private walk(
    a: Activity,
    title: { h: number; lines: string[] },
    desc: string[],
    notes: string[],
    extra: number,
    draw: boolean
  ): number {
    let y = TOP_Y;
    if (draw) this.buildTag(a.category, y);

    // NAME
    y -= TYPE.label / 2 + 0.85 + extra + title.h / 2;
    const titleStep = title.h * 1.22;
    if (draw) {
      for (let i = 0; i < title.lines.length; i++) {
        makeLeftLabel(
          this.root,
          "name" + i,
          title.lines[i],
          title.h,
          INK,
          CX0,
          y - i * titleStep,
          0.02
        );
      }
    }
    y -= (title.lines.length - 1) * titleStep;

    // ONE SENTENCE, dim. Three lines holds every description in the catalogue.
    y -= title.h / 2 + 0.55 + DESC_H / 2;
    if (draw) {
      for (let i = 0; i < desc.length; i++) {
        makeLeftLabel(
          this.root,
          "desc" + i,
          desc[i],
          DESC_H,
          lit(INK_DIM, 1),
          CX0,
          y - i * DESC_STEP,
          0.02
        );
      }
    }
    y -= (desc.length - 1) * DESC_STEP;

    y -= DESC_H / 2 + 1.10 + extra;
    if (draw) this.buildRule(y, "rule0");

    y -= 1.20 + extra;
    const valueY = y - 1.18;
    if (draw) this.buildFacts(a, y, valueY);
    y = valueY;

    if (notes.length === 0) return y - TYPE.head / 2;

    y -= 1.25 + extra;
    if (draw) this.buildRule(y, "rule1");
    y -= 1.30 + extra;
    if (draw) makeLeftLabel(this.root, "noteHead", "Good to know", TYPE.head, INK, CX0, y, 0.02);
    y -= 1.15;
    if (draw) {
      for (let i = 0; i < notes.length; i++) {
        makeLeftLabel(
          this.root,
          "note" + i,
          notes[i],
          NOTE_H,
          lit(INK_DIM, 0.95),
          CX0,
          y - i * NOTE_STEP,
          0.02
        );
      }
    }
    return y - (notes.length - 1) * NOTE_STEP - NOTE_H / 2;
  }

  /**
   * The name, fitted to the column rather than wrapped or truncated.
   *
   * Measured against the real metric, EVERY name in the catalogue fits one line:
   * the longest, "Tsukiji Outer Market", solves to 1.39cm against a 1.40 ceiling
   * and "Griffith Observatory" clears the ceiling outright. The two-line branch
   * is therefore a guard rather than a path anything currently takes — keep it,
   * because a city added later is one entry in CITIES and no code review.
   */
  private fitTitle(name: string): { h: number; lines: string[] } {
    const h = RW / measureText(name, 1.0);
    if (h >= TITLE_MAX) return { h: TITLE_MAX, lines: [name] };
    if (h >= TITLE_MIN) return { h: h, lines: [name] };
    return { h: TITLE_MIN, lines: wrapMeasured(name, RW, TITLE_MIN, 2) };
  }

  /**
   * The category tag: accent dot, hairline, word. The reference puts a monoline
   * pictogram where the dot is — see the summary for why there isn't one.
   */
  private buildTag(category: string, y: number): void {
    const DOT = 0.40;
    let x = CX0;
    makeRoundedFill(
      this.root,
      "tagDot",
      DOT,
      DOT,
      lit(ACCENT, 0.95),
      true,
      ORDER_FILL + 2,
      DOT / 2
    )
      .getTransform()
      .setLocalPosition(new vec3(x + DOT / 2, y, 0.02));
    x += DOT + 0.42;
    makeQuad(this.root, "tagRule", 0.06, 0.72, lit(GLASS, 0.55), true, ORDER_STROKE)
      .getTransform()
      .setLocalPosition(new vec3(x, y, 0.02));
    x += 0.42;
    makeLeftLabel(this.root, "tag", category, TYPE.label, lit(ACCENT, 1), x, y, 0.02);
  }

  /** A hairline across the column, in the panel's own stroke colour. */
  private buildRule(y: number, name: string): void {
    makeQuad(this.root, name, RW, 0.05, lit(GLASS, 0.45), true, ORDER_STROKE)
      .getTransform()
      .setLocalPosition(new vec3(CX0 + RW / 2, y, 0.01));
  }

  /**
   * FOUR FACTS ACROSS ONE ROW.
   *
   * The columns are not equal and they are not guessed: each one asks for the
   * greater of its label's and its value's MEASURED width, and if the four
   * together overrun the column the whole row is scaled by one factor until they
   * fit. Because the measurement is the font's own, that factor is the largest
   * type the row can carry — the worst string in the catalogue ("Sunrise –
   * sunset") lands at 0.90 and most entries need no scaling at all.
   *
   * The old panel truncated these values against a character count instead, and
   * "09:00 – 18:00 · Closed Tue" is where that showed. The exception now lives in
   * "Good to know", which is where the reference would have put it.
   */
  private buildFacts(a: Activity, labelY: number, valueY: number): void {
    const hours = a.hoursText.split(" · ");
    const facts = [
      ["Duration", formatDuration(a.durationMin), ""],
      ["Opening hours", hours[0], ""],
      ["Price", a.priceText, ""],
      ["Category", a.category, "chip"],
    ];

    const need: number[] = [];
    let total = 0;
    for (let i = 0; i < facts.length; i++) {
      const vh = facts[i][2] === "chip" ? TYPE.label : TYPE.head;
      // No single fact may eat the row. hoursText is live-fetched and could come
      // back as anything; without this ceiling one long value would squeeze the
      // other three past the point where scaling can still separate them.
      facts[i][1] = truncateMeasured(facts[i][1], RW * FACT_MAX_SHARE, vh);
      const w = Math.max(measureText(facts[i][0], TYPE.label), measureText(facts[i][1], vh));
      need.push(w);
      total += w;
    }
    const budget = RW - FACT_GAP * (facts.length - 1) - CHIP_PAD;
    const s = Math.max(0.78, Math.min(1, budget / total));
    const labelH = TYPE.label * s;
    const valueH = TYPE.head * s;

    let x = CX0;
    for (let i = 0; i < facts.length; i++) {
      makeLeftLabel(
        this.root,
        "factLabel" + i,
        facts[i][0],
        labelH,
        lit(INK_DIM, 0.95),
        x,
        labelY,
        0.02
      );
      if (facts[i][2] === "chip") {
        this.buildChip(facts[i][1], x, valueY, labelH);
      } else {
        makeLeftLabel(this.root, "factValue" + i, facts[i][1], valueH, INK, x, valueY, 0.02);
      }
      x += need[i] * s + FACT_GAP;
    }
  }

  /** The one place a hue appears, and it is THE accent, never the activity's. */
  private buildChip(text: string, leftX: number, y: number, textH: number): void {
    const w = measureText(text, textH) + CHIP_PAD;
    const h = textH * 2.6;
    const chip = makeGroup(this.root, "chip", leftX + w / 2, y, 0.02);
    makeRoundedFill(chip, "chipFill", w, h, lit(ACCENT, 0.32), true, ORDER_FILL + 1, RADIUS);
    makeLabel(chip, "chipText", text, textH, INK, Align.Center, 0, 0, 0.02);
  }

  /**
   * Facts a planner actually needs, derived only from what the catalogue holds.
   * No editorial copy is invented here — see the header note.
   */
  private buildNotes(a: Activity): string[] {
    const raw: string[] = [];

    // Whatever hoursText carries after the range: "Closed Tue", and so on.
    const parts = a.hoursText.split(" · ");
    for (let i = 1; i < parts.length; i++) raw.push(parts[i] + ".");

    // The one number this Lens is for: when you can still start and finish.
    const latest = a.closeHour - a.durationMin / 60;
    if (latest > a.openHour) {
      raw.push(
        "Latest start " +
          formatHour(latest) +
          " for a " +
          formatDuration(a.durationMin) +
          " visit."
      );
    }
    if (a.priceText === "Free") raw.push("Free to enter.");

    const lines: string[] = [];
    for (let i = 0; i < raw.length && lines.length < 3; i++) {
      const wrapped = wrapMeasured(raw[i], RW, NOTE_H, 2);
      for (let j = 0; j < wrapped.length && lines.length < 3; j++) lines.push(wrapped[j]);
    }
    return lines;
  }

  /** An outlined circle with a ×, alone in the corner. No fill, as in the reference. */
  private buildClose(): void {
    const b = makeGroup(this.root, "close", CLOSE_X, CLOSE_Y, 0.02);
    makeRoundedOutline(
      b,
      "closeEdge",
      CLOSE_D,
      CLOSE_D,
      lit(INK, 0.7),
      STROKE,
      ORDER_STROKE,
      CLOSE_D / 2
    );
    makeLabel(b, "x", "×", TYPE.title, INK, Align.Center, 0, 0.06, 0.02);
  }

  /** Close hit test, in world plane coordinates. Generous by 0.6cm all round. */
  public containsClose(p: vec3): boolean {
    return withinRect(p, CLOSE_X, PANEL_Y + CLOSE_Y, CLOSE_D + 1.2, CLOSE_D + 1.2);
  }

  public dispose(): void {
    this.root.destroy();
  }
}

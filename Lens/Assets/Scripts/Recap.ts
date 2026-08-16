/**
 * "6 activities · 8h15 planned" — the day, in one line, centred on the panel's
 * control row between the day button and Clear day.
 *
 * PASS 20 took its plate away. It had one because it used to float free under
 * the bar with nothing behind it; it now sits on the planner container, and a
 * second lighter patch on top of that container read as a smudge rather than as
 * a readout.
 *
 * The separator is drawn as an accent dot rather than typed as a middot, which
 * is what the reference does and what stops the line reading as one long string.
 * That means the three pieces are measured and placed by hand every time the
 * text changes — the price of not being able to centre a mixed run of type and
 * geometry any other way.
 */
import { RECAP_Y, Z } from "./Layout";
import {
  ACCENT,
  Align,
  INK,
  INK_DIM,
  TYPE,
  makeGroup,
  makeLabel,
  makeRoundedFill,
  measureText,
  ORDER_FILL,
} from "./Theme";

const SIZE = TYPE.body;
/** Air either side of the accent dot. */
const DOT_GAP = 0.62;
const DOT_D = 0.26;

/**
 * PASS 26 — THE LINE GREW A THIRD PIECE, so it is now built from a list rather
 * than from a named left and right.
 *
 * "4 activities · 6h30 planned · 2 done". The done count is APPENDED and never
 * substituted, and it is dropped entirely at zero rather than shown as "0 done"
 * — an untouched day has to read exactly as it did before this pass existed, or
 * every day starts by telling you about something you have not begun.
 *
 * WIDTH. The line is centred, so it grows both ways and its left edge is half
 * its run. The day button's right edge sits at -9.7 (see Layout.DAY_BTN_W) and
 * Clear day's left edge at 12.6, so the recap has ±9.7 to work in. Its widest
 * realistic run, "12 activities · 14h30 planned · 12 done", measures 16.4cm —
 * half of that is 8.2, which clears the day button by 1.5cm. A normal full day,
 * "6 activities · 8h15 planned · 2 done", is 15.3cm and clears it by 2.0.
 */
export class Recap {
  public readonly root: SceneObject;
  private labels: Text[] = [];
  private dots: SceneObject[] = [];

  constructor(parent: SceneObject) {
    this.root = makeGroup(parent, "Recap", 0, RECAP_Y, Z);

    // Three labels and two separators, built once and hidden when unused: the
    // recap changes on every placement, and creating geometry per change is how
    // the drag ghost used to leak objects.
    for (let i = 0; i < 3; i++) {
      this.labels.push(
        makeLabel(
          this.root,
          "part" + i,
          "",
          SIZE,
          i === 0 ? INK : new vec4(INK_DIM.r, INK_DIM.g, INK_DIM.b, 1),
          Align.Center,
          0,
          0,
          0.02
        )
      );
    }
    for (let i = 0; i < 2; i++) {
      this.dots.push(
        makeRoundedFill(
          this.root,
          "sep" + i,
          DOT_D,
          DOT_D,
          new vec4(ACCENT.r, ACCENT.g, ACCENT.b, 1),
          true,
          ORDER_FILL + 2,
          DOT_D / 2
        )
      );
    }

    this.set(0, 0, 0);
  }

  public set(count: number, minutes: number, done: number): void {
    if (count === 0) {
      this.labels[0].textFill.color = new vec4(INK_DIM.r, INK_DIM.g, INK_DIM.b, 0.85);
      this.layout(["Nothing planned yet"]);
      return;
    }
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    this.labels[0].textFill.color = new vec4(INK.r, INK.g, INK.b, 1);

    const parts = [
      count + (count === 1 ? " activity" : " activities"),
      h + "h" + (m < 10 ? "0" : "") + m + " planned",
    ];
    if (done > 0) parts.push(done + " done");
    this.layout(parts);
  }

  /**
   * Centre the whole run — text, dot, text, dot, text — on the panel's midline.
   * Unused labels and separators are emptied and disabled rather than destroyed.
   */
  private layout(parts: string[]): void {
    const widths: number[] = [];
    let total = 0;
    for (let i = 0; i < parts.length; i++) {
      const w = measureText(parts[i], SIZE);
      widths.push(w);
      total += w;
    }
    total += (parts.length - 1) * (DOT_GAP + DOT_D + DOT_GAP);

    let x = -total / 2;
    for (let i = 0; i < this.labels.length; i++) {
      if (i >= parts.length) {
        this.labels[i].text = "";
        continue;
      }
      this.labels[i].text = parts[i];
      this.place(this.labels[i], x + widths[i] / 2);
      x += widths[i];
      if (i < parts.length - 1) {
        this.dots[i].enabled = true;
        this.dots[i]
          .getTransform()
          .setLocalPosition(new vec3(x + DOT_GAP + DOT_D / 2, 0, 0.02));
        x += DOT_GAP + DOT_D + DOT_GAP;
      }
    }
    for (let i = Math.max(0, parts.length - 1); i < this.dots.length; i++) {
      this.dots[i].enabled = false;
    }
  }

  private place(label: Text, x: number): void {
    label.getSceneObject().getTransform().setLocalPosition(new vec3(x, 0, 0.02));
  }
}

/**
 * The time line — the user's day, as an axis.
 *
 * PASS 14 turned the glass tube into a hairline. It used to be a 1.25cm slab
 * with a bloom, a wash, a bright core and a scrim band behind the whole
 * assembly, which made it the heaviest object on the screen — and the pills that
 * are supposed to be the subject were sitting on top of it, competing. Now it is
 * one bright 1mm rule with short ticks and the hours beneath, and the scrim band
 * is only as tall as the labels need.
 *
 * It is still horizontal, still 08:00 to 22:00, and still the thing that turns a
 * position into an hour. It just stopped shouting.
 */
import {
  BAR_CORE_THICKNESS,
  BAR_END_HOUR,
  BAR_START_HOUR,
  BAR_THICKNESS,
  BAR_WIDTH,
  BAR_Y,
  TICK_GAP,
  TICK_HEIGHT,
  Z,
  xForHour,
} from "./Layout";
import { formatHour } from "./Catalogue";
import {
  Align,
  CORE,
  INK_DIM,
  ORDER_FILL,
  ORDER_GLOW,
  ORDER_SCRIM,
  TYPE,
  makeGroup,
  makeLabel,
  makeQuad,
} from "./Theme";

export class TimeBar {
  public readonly root: SceneObject;

  constructor(parent: SceneObject) {
    this.root = makeGroup(parent, "TimeBar", 0, BAR_Y, Z);
    this.buildTube();
    this.buildTicks();
  }

  private buildTube(): void {
    /**
     * PASS 20 removed the band that used to sit behind the ticks and hours. It
     * existed to stop a busy background eating the smallest type in the Lens;
     * the planner container now does that job for the whole panel, and a second
     * lighter patch inside it read as a seam.
     */

    // A soft halo, so the rule has presence without thickness.
    const glow = makeQuad(
      this.root,
      "lineGlow",
      BAR_WIDTH,
      BAR_THICKNESS,
      new vec4(CORE.r, CORE.g, CORE.b, 0.16),
      true,
      ORDER_GLOW
    );
    glow.getTransform().setLocalPosition(new vec3(0, 0, -0.05));

    // The line itself: 1mm, bright, edge to edge.
    const core = makeQuad(
      this.root,
      "line",
      BAR_WIDTH,
      BAR_CORE_THICKNESS,
      new vec4(CORE.r, CORE.g, CORE.b, 0.95),
      true,
      ORDER_FILL + 1
    );
    core.getTransform().setLocalPosition(new vec3(0, 0, 0));
  }

  private buildTicks(): void {
    const tickTop = -TICK_GAP;
    for (let h = BAR_START_HOUR; h <= BAR_END_HOUR; h++) {
      const isMajor = (h - BAR_START_HOUR) % 2 === 0;
      const x = xForHour(h);
      const height = isMajor ? TICK_HEIGHT : TICK_HEIGHT * 0.55;
      const tick = makeQuad(
        this.root,
        "tick_" + h,
        isMajor ? 0.1 : 0.07,
        height,
        new vec4(INK_DIM.r, INK_DIM.g, INK_DIM.b, isMajor ? 0.85 : 0.45),
        true,
        ORDER_FILL
      );
      tick.getTransform().setLocalPosition(new vec3(x, tickTop - height / 2, 0));

      // Label only the even hours — the mockup's rhythm, and it stays legible.
      // Full-strength ink, not dim: this line was called out as uncomfortable,
      // and it was losing on brightness as much as on size.
      if (isMajor) {
        makeLabel(
          this.root,
          "hour_" + h,
          formatHour(h),
          TYPE.label,
          new vec4(INK_DIM.r, INK_DIM.g, INK_DIM.b, 1),
          Align.Center,
          x,
          tickTop - height - 0.6,
          0
        );
      }
    }
  }
}

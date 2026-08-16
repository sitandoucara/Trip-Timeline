/**
 * One activity card in the panel.
 *
 * PASS 15 — corrected to the reference.
 *
 * Pass 13 read "horizontal" as portrait and shipped a 6.5 x 10.4 card carrying
 * nothing but a name. Measured against the reference, its cards are 317 x 325 —
 * essentially square, with a LANDSCAPE photograph filling the top and four
 * fields stacked beneath it: name, category, duration, opening hours. This card
 * is now 6.7 x 7.3 — a ratio of 0.92 against the reference's 0.98 — with the
 * same four fields. The remaining gap is the photographs: the reference's are
 * 1.69:1 and this project's are 3:2, so a full-bleed image costs half a
 * centimetre more height here than it does there.
 *
 * PASS 18 gave duration and hours a line each with a clock against both, as the
 * reference does. Pass 15 had shared them across one row on the assumption that
 * four lines would force the card taller; they do not — tightening the leading
 * to 0.60cm fits all four inside the same 7.3cm card, and the card now reads as
 * a list rather than as three lines with a crowded third.
 *
 * Names are never truncated and never wrapped: the name's cap height is solved
 * for its own length, from 0.46cm down to a floor of 0.34cm, so "Griffith
 * Observatory" sits on one line at 0.36 while "Lunch" gets the full size.
 *
 * The stroke is GLASS on every card. The six identity hues are gone from here —
 * they distinguished six things you were choosing between, but the planner they
 * fed is neutral now, and a row of six saturated outlines was the last loud
 * thing on the screen.
 */
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { TargetingMode } from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor";

import { Activity, formatDuration } from "./Catalogue";
import { Fader } from "./Fader";
import { activityThumb } from "./Thumbnails";
import { Draggable, DragController } from "./DragController";
import { CARD_HEIGHT, CARD_WIDTH, CARD_ROW_Y, Z } from "./Layout";

/**
 * WHERE THE ROW ACTUALLY SITS — Pass 22.
 *
 * The brief was to move the planner container DOWN, away from the cards: at
 * 1.53cm the gap between the card row's foot and the panel's top edge read as
 * almost nothing. The container's position is derived from BAR_Y in Layout.ts,
 * and BAR_Y is the fixed point every gesture in the Lens is calibrated against —
 * so the same gap can be opened from either end, and raising the row is the end
 * that touches no input maths at all. The drop accuracy the brief warned about
 * cannot regress, because nothing the drop depends on has moved.
 *
 * Exported because the row's Y has TWO consumers that must agree — the group
 * TravelPlanApp parents the cards to, and the projected hit rectangle below. It
 * lives here rather than in Layout.ts only because that file is currently not
 * writable; it belongs beside CARD_ROW_Y and should move there when it is.
 */
const ROW_RAISE = 1.2;
export const CARD_ROW_Y_EFFECTIVE = CARD_ROW_Y + ROW_RAISE;
/** The chrome row goes up with it, or the cards would close on the back button. */
export const CHROME_RAISE = 1.5;
import {
  Align,
  BODY,
  GLASS,
  INK,
  INK_DIM,
  ORDER_CARRY,
  ORDER_CARRY_BODY,
  RADIUS,
  STROKE,
  collectVisuals,
  makeBody,
  makeGroup,
  makeLabel,
  makeLeftLabel,
  makeQuad,
  makeRoundedFill,
  makeRoundedImage,
  makeRoundedOutline,
  measureText,
  setLeftLabel,
  truncateMeasured,
} from "./Theme";

/**
 * The arc. Unchanged from Pass 13 — it was right, and the cards still have to
 * read as a ROW you drag downward from rather than a carousel you spin.
 */
const ARC_RADIUS = 46.0;
const ARC_STEP = (8.86 * Math.PI) / 180.0;

const PAD = 0.35;
/** Usable width inside a card, once the side padding is taken off. */
const INNER_W = CARD_WIDTH - PAD * 2;
/** The name is solved to fit one line between these two sizes. */
const NAME_MAX = 0.46;
const NAME_MIN = 0.34;
const META_SIZE = 0.40;

/**
 * THE PHOTOGRAPH'S HEIGHT, and why it is no longer derived from the source.
 *
 * It used to be W * 2/3 — the thumbnails' own 3:2 — which made it 4.47cm and
 * left only 2.83cm for the text. Four lines fit in that, but with 0.8mm to
 * spare: the last line sat on the card's bottom border. The class note above
 * already identified the cause, that this project's photographs are 3:2 where
 * the reference's are 1.69:1 and so cost half a centimetre more height.
 *
 * So the box is now authored at the reference's ratio (6.7 / 4.0 = 1.68) and the
 * image is COVER-fitted into it, which trims about a tenth off the top and
 * bottom instead of distorting anything. That buys 0.47cm, and the four lines
 * now sit inside the card with 0.5cm clear beneath them.
 */
const PHOTO_H = 4.0;

/** Leading for the four text lines. */
const LINE_STEP = 0.60;
/** The clock mark. Its LEFT edge is the card's text margin — see buildText. */
const CLOCK_D = 0.30;
const CLOCK_GAP = 0.16;

/**
 * PASS 17 removed BACKING_PASSES = 3 and PHOTO_PASSES = 5 from here. Six coplanar
 * draws were measured to be pixel-identical to one — BlendMode.Normal at alpha 1
 * replaces the target, so every pass but the last was thrown away. Opacity comes
 * from Theme.PHOTO_GAIN instead, in a single draw.
 */

export class ActivityCard implements Draggable {
  public readonly root: SceneObject;
  public readonly activity: Activity;
  public homeWorldPos: vec3 = vec3.zero();
  public placed: boolean = false;
  private interactable: Interactable = null;
  private collider: ColliderComponent = null;
  private fader: Fader = null;
  /** The card's pose on the arc, restored when a drag releases it. */
  private slotRotation: quat = null;
  /** The same rotation as a scalar, so setLiftProgress can interpolate it. */
  private slotAngle: number = 0;
  private slotZ: number = 0;
  private hoursLabel: Text = null;
  private hoursX: number = 0;
  private hoursY: number = 0;
  private hoursMaxW: number = 0;
  /** Hit rectangle, projected onto the composition plane. */
  /** Every visual and the order it was built with — see setCarried. */
  private orders: { visual: Visual; order: number }[] = [];
  private slotOrderBase: number = 0;
  /** The backing plate — the one visual the carry band leaves behind. */
  private bodyVisual: Visual = null;

  private hitX: number = 0;
  private hitY: number = 0;
  private hitHalfW: number = 0;
  private hitHalfH: number = 0;

  constructor(
    parent: SceneObject,
    activity: Activity,
    /** Slots from the centre of the row: -2.5 .. +2.5 for six cards. */
    arcOffset: number,
    cityId: string
  ) {
    this.activity = activity;

    const angle = arcOffset * ARC_STEP;
    const x = ARC_RADIUS * Math.sin(angle);
    const z = ARC_RADIUS * (Math.cos(angle) - 1);

    this.root = makeGroup(parent, "card_" + activity.slug, x, 0, z);
    this.slotZ = z;
    this.slotAngle = angle;
    this.slotRotation = quat.angleAxis(angle, vec3.up());
    this.root.getTransform().setLocalRotation(this.slotRotation);

    this.measureHitRect(x, z, angle);

    const steps = Math.min(2, Math.round(Math.abs(arcOffset)));
    const base = 18 + (2 - steps) * 3;

    const W = CARD_WIDTH;
    const H = CARD_HEIGHT;

    // 1. Backing, then the photograph filling the card's top, edge to edge.
    const backing = makeBody(this.root, "backing", W, H, BODY, base, RADIUS);
    backing.getTransform().setLocalPosition(new vec3(0, 0, 0));
    this.bodyVisual = backing.getComponent("Component.RenderMeshVisual");

    const photoH = PHOTO_H;
    const photoY = H / 2 - photoH / 2;
    const tex = activityThumb(cityId, activity.slug);
    if (tex) {
      // cover-fit: the thumbnails are 3:2 and this box is 1.68:1, so the crop is
      // a ~10% trim off the top and bottom rather than a squeeze.
      makeRoundedImage(this.root, "photo", W, photoH, tex, base + 2, RADIUS, null, true)
        .getTransform()
        .setLocalPosition(new vec3(0, photoY, 0.01));
    } else {
      makeRoundedFill(
        this.root,
        "photoWell",
        W,
        photoH,
        new vec4(GLASS.r, GLASS.g, GLASS.b, 0.3),
        true,
        base + 2,
        RADIUS
      ).getTransform().setLocalPosition(new vec3(0, photoY, 0.01));
    }

    // 2. The frame. One stroke colour for every card in the Lens.
    makeRoundedOutline(
      this.root,
      "frame",
      W,
      H,
      new vec4(GLASS.r, GLASS.g, GLASS.b, 0.78),
      STROKE,
      base + 10,
      RADIUS
    ).getTransform().setLocalPosition(new vec3(0, 0, 0.04));

    this.buildText(activity, base + 11);

    // Recorded AFTER everything is built, so it catches the layers this file
    // assigns and the ones Theme assigns inside makeRoundedImage. See setCarried.
    this.slotOrderBase = base;
    collectVisuals(this.root, this.orders);
  }

  /**
   * Lift the whole card into the carry band while it is being dragged, and put
   * it back on release.
   *
   * A card in the row tops out at 35 and every label in the Lens sits at
   * ORDER_TEXT, so a card carried down toward the line passed correctly in front
   * of the container and the pills — both well below it — and then straight
   * BEHIND the recap, the day button and Clear day. The fix has to be a lift of
   * the whole subtree rather than of the top layer: raising only the text would
   * put the card's own words in front of its own photograph.
   *
   * Orders are re-based, not offset by a constant. The card's build order
   * depends on where it sits on the arc (18, 21 or 24), so a fixed delta would
   * land the three slots in three different bands and the outer cards would
   * still lose to something. Re-basing puts every card in exactly 44..55
   * whichever slot it came from.
   *
   * PASS 30 — with ONE exception, the backing plate. Lifting it too made the
   * card blank out the planner's text: an opaque rectangle erased the "1" of
   * 12:00 in the recap and the day button's label as the card passed over them.
   * The plate is the only layer of the card that carries no information, so it
   * is the one that gives way — it goes to ORDER_CARRY_BODY (39) instead, under
   * every label in the Lens and over the planner's fills. See the note there.
   * The content layers are untouched by this and still land in 46..55.
   *
   * Restore is unchanged: `on === false` puts every visual, plate included,
   * back on its built order.
   */
  public setCarried(on: boolean): void {
    for (let i = 0; i < this.orders.length; i++) {
      const o = this.orders[i];
      if (!on) {
        o.visual.setRenderOrder(o.order);
      } else if (o.visual === this.bodyVisual) {
        o.visual.setRenderOrder(ORDER_CARRY_BODY);
      } else {
        o.visual.setRenderOrder(ORDER_CARRY + (o.order - this.slotOrderBase));
      }
    }
  }

  /**
   * FOUR LINES, ONE LEFT EDGE.
   *
   *   name
   *   category
   *   (clock) duration
   *   (clock) opening hours
   *
   * Duration and hours used to share a row, which made the card read as three
   * lines with a crowded third rather than as a list.
   *
   * The alignment problem underneath it was subtler and is the real fix here.
   * Align.Left does not anchor a Text's left edge in this runtime — it runs the
   * string leftward from the position — so every label is a CENTRED label placed
   * half its own width to the right of the margin. That is only as accurate as
   * the width measurement, and this file was using textWidth() x ADVANCE_FIT,
   * which over-estimates by a different amount for every string: "Lunch" was
   * pushed right by a different distance than "Montmartre", so four lines that
   * were all nominally at `left` started at four different places. Pass 16
   * measured Inter's real advances out of the font file; makeLeftLabel uses
   * them, and the edges now genuinely line up.
   */
  private buildText(activity: Activity, order: number): void {
    const left = -CARD_WIDTH / 2 + PAD;
    const photoBottom = CARD_HEIGHT / 2 - PHOTO_H;
    // The clock sits ON the margin and the time text is indented past it, so all
    // four lines begin at the same x — the icon is the start of its line.
    const textLeft = left + CLOCK_D + CLOCK_GAP;

    // The name is solved to fit one line rather than wrapped or cut.
    const units = measureText(activity.name, 1.0);
    const nameSize = Math.max(NAME_MIN, Math.min(NAME_MAX, INNER_W / units));
    let y = photoBottom - 0.42 - nameSize / 2;
    makeLeftLabel(this.root, "name", activity.name, nameSize, INK, left, y, 0.06).setRenderOrder(
      order
    );

    y -= LINE_STEP;
    makeLeftLabel(
      this.root,
      "category",
      activity.category,
      META_SIZE,
      new vec4(INK_DIM.r, INK_DIM.g, INK_DIM.b, 0.95),
      left,
      y,
      0.06
    ).setRenderOrder(order);

    y -= LINE_STEP;
    this.buildClock(left, y, order);
    makeLeftLabel(
      this.root,
      "dur",
      formatDuration(activity.durationMin),
      META_SIZE,
      INK,
      textLeft,
      y,
      0.06
    ).setRenderOrder(order);

    y -= LINE_STEP;
    this.buildClock(left, y, order);
    // Hours now own a whole line, but the live fetch can still return anything
    // — "Typically 11:00 AM – 10:00 PM" arrived from a real call — so the label
    // is clipped to the card rather than allowed to run over it.
    this.hoursX = textLeft;
    this.hoursY = y;
    this.hoursMaxW = CARD_WIDTH / 2 - PAD - textLeft;
    this.hoursLabel = makeLabel(
      this.root,
      "hours",
      "",
      META_SIZE,
      new vec4(INK_DIM.r, INK_DIM.g, INK_DIM.b, 0.95),
      Align.Center,
      textLeft,
      y,
      0.06
    );
    this.hoursLabel.setRenderOrder(order);
    this.setHours();
  }

  /**
   * The clock mark, standing in for the reference's icon: a small ring with a
   * single hand. A ring reads at 3mm where a glyph at this size does not, and it
   * cannot depend on the font shipping a symbol it may not have.
   */
  private buildClock(leftX: number, y: number, order: number): void {
    const c = new vec4(INK_DIM.r, INK_DIM.g, INK_DIM.b, 0.9);
    const cx = leftX + CLOCK_D / 2 - 0.03;
    makeRoundedOutline(this.root, "clock", CLOCK_D, CLOCK_D, c, 0.05, order, CLOCK_D / 2)
      .getTransform()
      .setLocalPosition(new vec3(cx, y, 0.06));
    // One hand, pointing up — enough to say "clock" rather than "dot".
    makeQuad(this.root, "hand", 0.045, CLOCK_D * 0.3, c, true, order)
      .getTransform()
      .setLocalPosition(new vec3(cx, y + CLOCK_D * 0.14, 0.065));
  }

  /** Fit the hours string to its line, and re-anchor it to the text margin. */
  private setHours(): void {
    if (!this.hoursLabel) return;
    const raw = this.activity.hoursText
      .split(" · ")[0]
      .replace(" – ", "–")
      .replace(" - ", "–");
    setLeftLabel(
      this.hoursLabel,
      truncateMeasured(raw, this.hoursMaxW, META_SIZE),
      META_SIZE,
      this.hoursX,
      this.hoursY,
      0.06
    );
  }

  /**
   * The card sits on the arc, a little behind the composition plane and turned a
   * few degrees, so its hit rectangle is its PROJECTION onto that plane.
   * Perspective pulls a further card inward and shrinks it; the yaw narrows it.
   */
  private measureHitRect(x: number, z: number, angle: number): void {
    const k = Z / (Z + z);
    this.hitX = x * k;
    this.hitY = CARD_ROW_Y_EFFECTIVE * k;
    this.hitHalfW = (CARD_WIDTH / 2) * Math.cos(angle) * k;
    this.hitHalfH = (CARD_HEIGHT / 2) * k;
  }

  /**
   * The card body is the drag handle. SIK hit-tests with a physics probe, so the
   * card needs a real collider; the box matches the card face with a little depth
   * so a ray from any plausible angle still lands on it.
   */
  public makeDraggable(drag: DragController): void {
    // The editor uses the touch path exclusively (see DragController), so SIK
    // components are pure overhead there — and worse, SIK keeps scoring them
    // after their SceneObject is destroyed, which throws every frame once you
    // leave a city. On device they are the only input, so they are created there.
    if (global.deviceInfoSystem.isEditor()) return;

    this.collider = this.root.createComponent("ColliderComponent");
    this.collider.fitVisual = false;
    const shape = Shape.createBoxShape();
    shape.size = new vec3(CARD_WIDTH, CARD_HEIGHT, 2.0);
    this.collider.shape = shape;

    this.interactable = this.root.createComponent(Interactable.getTypeName());
    this.interactable.targetingMode = TargetingMode.All;
    this.interactable.enableInstantDrag = true;
    this.interactable.colliders = [this.collider];

    this.interactable.onTriggerStart.add((e) => {
      if (!this.placed) drag.beginFromSIK(this, e.interactor);
    });
    this.interactable.onTriggerUpdate.add((e) => {
      if (!this.placed) drag.updateFromSIK(this, e.interactor);
    });
    this.interactable.onTriggerEnd.add(() => drag.endFromSIK(this));
    this.interactable.onTriggerEndOutside.add(() => drag.endFromSIK(this));
    this.interactable.onTriggerCanceled.add(() => drag.endFromSIK(this));
  }

/**
   * SIK keeps its own registry of Interactables and scores them every frame. If
   * the SceneObject is destroyed with the component still registered, the cursor
   * update loop throws "Object is null" on every frame afterwards and input
   * stops working. Destroying the components first deregisters them cleanly.
   */
  public dispose(): void {
    if (this.interactable) {
      this.interactable.enabled = false;
      this.interactable.destroy();
      this.interactable = null;
    }
    if (this.collider) {
      this.collider.enabled = false;
      this.collider.destroy();
      this.collider = null;
    }
  }

  /**
   * The hours line is back on the card, so the live fetch has something to
   * refresh again. It was a no-op for exactly one pass.
   */
  public refreshFromCatalogue(): void {
    this.setHours();
  }

  public isPlaced(): boolean {
    return this.placed;
  }

  /** Hit test in the composition plane, against the projected rectangle. */
  public containsPlanePoint(p: vec3): boolean {
    return (
      Math.abs(p.x - this.hitX) <= this.hitHalfW &&
      Math.abs(p.y - this.hitY) <= this.hitHalfH
    );
  }

  /**
   * Un-yaw the card as it is lifted off the arc, by PROGRESS rather than by a
   * boolean — Pass 22.
   *
   * A card being carried down to the line should face the user square, not stay
   * turned to sit on an arc it has left. But this used to be a hard switch
   * thrown the instant a finger touched the card, which meant the outer cards
   * visibly snapped straight before anyone had decided whether this was a drag
   * or a tap. It is now driven from 0 to 1 by DragController once the gesture is
   * confirmed as a drag, so the card turns to face you as it comes up.
   *
   * The yaw is interpolated as an ANGLE rather than a quaternion slerp: the slot
   * pose is a single rotation about up, so scaling that angle is exact and needs
   * no interpolation API. The z-lift that used to live here is gone — during a
   * drag DragController owns the card's whole world position, and setting local
   * z here as well meant the two fought over the same transform.
   */
  public setLiftProgress(k: number): void {
    this.root
      .getTransform()
      .setLocalRotation(quat.angleAxis(this.slotAngle * (1 - k), vec3.up()));
  }

  /**
   * Placed cards stay in the row, dimmed. Hiding them left a hole in a six-card
   * row that read as broken, and removal needs somewhere to return to.
   */
  public setDimmed(dim: boolean): void {
    this.placed = dim;
    if (!this.fader) this.fader = new Fader(this.root);
    this.fader.setOpacity(dim ? 0.45 : 1.0);
    if (this.interactable) this.interactable.enabled = !dim;
    if (this.collider) this.collider.enabled = !dim;
  }

  public markPlaced(): void {
    this.setDimmed(true);
  }
}

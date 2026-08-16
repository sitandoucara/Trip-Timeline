/**
 * Pick up a card, see where it will land, drop it.
 *
 * The whole interaction is resolved on ONE plane — z = Z, the plane the bar and
 * the card panel both live on. The interactor gives a world ray; intersecting it
 * with that plane turns 3D pointing into a 2D position, which is all this Lens
 * needs and is far more predictable than free 3D manipulation.
 *
 * No rules here: any drop inside the bar's catch zone succeeds (Pass 4 adds
 * overlap and opening-hours rejection).
 */
import { Interactor } from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor";

import { Activity, formatHour } from "./Catalogue";
import { PlacedSpan, Rejection, validatePlacement } from "./Rules";
import { screenToPlane } from "./ScreenPlane";
import {
  BAR_CATCH_X_MARGIN,
  BAR_CATCH_Y_MAX,
  BAR_CATCH_Y_MIN,
  BAR_END_HOUR,
  BAR_HALF,
  BAR_START_HOUR,
  BAR_Y,
  BLOCK_HEIGHT,
  BLOCK_REST_Y,
  PLANNER_TOP,
  BLOCK_Z_LIFT,
  SNAP_HOURS,
  Z,
  blockCenterX,
  hourForX,
} from "./Layout";
import {
  ACCENT,
  ALERT,
  Align,
  BODY_CHIP,
  INK,
  ORDER_CARRY,
  ORDER_GHOST,
  ORDER_STROKE,
  ORDER_TEXT,
  TYPE,
  collectVisuals,
  makeDashedRoundedOutline,
  makeGroup,
  makeLabel,
  makePlatedLabel,
  makeQuad,
  setQuadColor,
} from "./Theme";

/**
 * Peak distance the pointer may travel and still count as a tap, in centimetres
 * on the composition plane. Measured from the press point at its FURTHEST, not
 * at release, so a drag that wanders out and comes back is never mistaken for a
 * tap.
 *
 * Pass 11 rescaled the composition, so this had to move with it or a tap would
 * have become steadily more permissive: 1.4cm is ~1.1 degrees at 75cm, still
 * comfortably above pointer settling jitter, and ~12x smaller than the 16.4cm a
 * real drag from the card row down to the bar now covers. The RATIO is what
 * keeps the two gestures unconfusable, and the ratio is unchanged.
 */
/** The drop preview's width. See buildGhost for why it is not a pill's width. */
const GHOST_W = 6.4;

/**
 * THE DRAGGED CARD SHRINKS INTO THE PLANNER — Pass 21.
 *
 * A 6.7 x 7.3cm card held over a 41 x 9.9cm panel covers most of it, so at the
 * moment you most need to see where the drop lands, the card is in the way. It
 * now scales down as it crosses into the container, toward something near the
 * size of the pill it is about to become.
 *
 * A single uniform scale cannot match a pill in both axes — the card is 0.92
 * wide-to-tall and a pill is 2.1 — so this is a compromise chosen by area
 * rather than an exact match: 0.55 puts the card at roughly a pill's footprint
 * while keeping its own proportions, which reads as "this is becoming that"
 * without the card distorting on the way down.
 */
const DRAG_SHRINK = 0.55;
/** How far ABOVE the panel's top edge the pointer starts shrinking the card. */
const SHRINK_LEAD = 1.5;
/** Per-second rate of the scale lerp — fast enough to feel attached to the hand. */
const SHRINK_RATE = 9.0;

const TAP_MAX_TRAVEL = 1.4;

/** The held card floats above the pointer so it never covers the drop preview. */
const DRAG_CARD_LIFT = 6.0;

/**
 * NOTHING MOVES ON PRESS — Pass 22.
 *
 * The lift above was applied the instant a finger went down, before the gesture
 * had been classified. So every TAP made the card leap 6cm upward, snap its x to
 * the finger, pop 1.6cm toward the viewer and un-yaw itself — and then the
 * detail panel opened over the top of all that. Four separate jumps, for a
 * gesture that turned out not to be a drag at all.
 *
 * A card now stays exactly where it is under the finger. The lift is applied
 * only once peakTravel crosses TAP_MAX_TRAVEL, which is the SAME threshold that
 * classifies the gesture at release — so the card moving and the gesture being a
 * drag are now the same event by construction, rather than two decisions that
 * could disagree. And it eases in over LIFT_DURATION rather than snapping,
 * because a card that teleports to the hand reads as a glitch even when it is
 * correct.
 */
const LIFT_DURATION = 0.16;

interface FadingMessage {
  root: SceneObject;
  label: Text;
  color: vec4;
  age: number;
}

/**
 * How long a rejection message stays before fading out.
 *
 * PASS 31 halved it: 1.4 + 0.6 held "Opens at 09:30" on screen for two full
 * seconds, which is long after the message has been read and the hand has moved
 * on — it stopped reading as feedback and started reading as something stuck.
 * 0.7 + 0.3 is still a beat longer than it takes to read four short words, and
 * the fade is now quick enough to feel like a dismissal rather than a wilt.
 *
 * PASS 32 takes it to 0.5 + 0.25. Three quarters of a second is brisk but not
 * a flash, and the message is never the first sight of its own text: the ghost
 * has been showing the same string in coral under the finger for as long as the
 * drop was hovering an invalid slot, so the release is a confirmation of
 * something already read. This is the floor — below it the words would have to
 * be found before they could be read.
 */
const MESSAGE_HOLD = 0.5;
const MESSAGE_FADE = 0.25;

interface Tween {
  obj: SceneObject;
  from: vec3;
  to: vec3;
  t: number;
  duration: number;
}

/** What a draggable card must expose. Keeps DragController free of card internals. */
export interface Draggable {
  readonly root: SceneObject;
  readonly activity: Activity;
  homeWorldPos: vec3;
  setLiftProgress(k: number): void;
  /** Raise the card into the carry band while it is being dragged. Pass 28. */
  setCarried(on: boolean): void;
  markPlaced(): void;
  isPlaced(): boolean;
  containsPlanePoint(p: vec3): boolean;
}

/** A block already on the bar, which can be slid along it or pulled off. */
export interface MovableBlock {
  readonly root: SceneObject;
  readonly activity: Activity;
  readonly slug: string;
  readonly cityId: string;
  startHour: number;
  readonly endHour: number;
  containsPlanePoint(p: vec3): boolean;
  moveTo(startHour: number): void;
}

export class DragController {
  private ghost: SceneObject = null;
  private ghostLabel: Text = null;
  private dragging: Draggable = null;
  private snappedHour: number = 0;
  private overBar: boolean = false;
  private tweens: Tween[] = [];
  private warnedNoRay: boolean = false;
  private cards: Draggable[] = [];
  private ghostDashes: SceneObject[] = [];
  private ghostInvalid: boolean = false;
  private rejection: Rejection = null;
  private messages: FadingMessage[] = [];
  private lastPoint: vec3 = null;
  /** The card currently being scaled, and where its scale is going. */
  private scaledCard: Draggable = null;
  private scaleCur: number = 1;
  private scaleTarget: number = 1;
  /**
   * The lift. `engaged` flips once, when travel proves this is a drag; `liftT`
   * then eases 0 -> 1 (and back down on release), and `followPos` is where the
   * card would sit if it were fully lifted. See the LIFT_DURATION note.
   */
  private dragEngaged: boolean = false;
  private liftT: number = 0;
  private liftRising: boolean = false;
  private liftCard: Draggable = null;
  private followPos: vec3 = null;
  private pressPoint: vec3 = null;
  private peakTravel: number = 0;
  private onTap: (card: Draggable) => void = null;
  /**
   * Which input path owns the current gesture: "touch" (mouse/preview) or "sik"
   * (hand ray on device). Both listen to the same events in the simulator, and
   * SIK resolves the pointer to a slightly different plane point — enough to
   * inflate travel past the tap threshold and turn every tap into a drag. One
   * owner per gesture; the other path is ignored until release.
   */
  private owner: string = "";
  private moving: MovableBlock = null;
  private moveOrigHour: number = 0;
  private blocks: () => MovableBlock[] = null;
  private onMove: (block: MovableBlock, startHour: number) => void = null;
  private onRemove: (block: MovableBlock) => void = null;
  private onBlockTap: (block: MovableBlock) => void = null;

  constructor(
    private barRoot: SceneObject,
    private getPlaced: () => PlacedSpan[],
    private onPlace: (card: Draggable, startHour: number) => void
  ) {}

  /**
   * Raw touch/mouse input. SIK's MouseInteractor drives the same DragController
   * on device and in preview, but its trigger path proved unreliable to verify,
   * and mouse has to work in the simulator — so this second path owns pickup
   * directly. Both funnel into the same begin/update/end, and begin() ignores a
   * second pickup while a drag is live, so the two can never fight.
   */
  public setCards(cards: Draggable[]): void {
    this.cards = cards;
  }

  /** Called instead of a placement when the gesture turned out to be a tap. */
  public setTapHandler(fn: (card: Draggable) => void): void {
    this.onTap = fn;
  }

  public setBlockHandlers(
    blocks: () => MovableBlock[],
    onMove: (block: MovableBlock, startHour: number) => void,
    onRemove: (block: MovableBlock) => void,
    onBlockTap: (block: MovableBlock) => void
  ): void {
    this.blocks = blocks;
    this.onMove = onMove;
    this.onRemove = onRemove;
    this.onBlockTap = onBlockTap;
  }

  public onTouchStart(pos: vec2): void {
    const pt = screenToPlane(pos, Z);
    if (!pt) return;

    // A block already on the bar takes priority — it is nearer the pointer.
    if (this.blocks) {
      const list = this.blocks();
      for (let i = 0; i < list.length; i++) {
        if (list[i].containsPlanePoint(pt)) {
          if (this.dragging || this.moving) return;
          this.owner = "touch";
          this.moving = list[i];
          this.moveOrigHour = list[i].startHour;
          this.pressPoint = pt;
          this.peakTravel = 0;
          this.buildGhost(list[i].activity);
          print("[P8] picked up " + list[i].activity.name + " from the bar");
          this.applyMovePoint(pt);
          return;
        }
      }
    }

    for (const c of this.cards) {
      if (!c.isPlaced() && c.containsPlanePoint(pt)) {
        if (this.dragging) return;
        this.owner = "touch";
        this.pressPoint = pt;
        this.peakTravel = 0;
        this.begin(c);
        this.applyPoint(c, pt);
        return;
      }
    }
  }

  public onTouchMove(pos: vec2): void {
    if (this.owner !== "touch") return;
    const pt = screenToPlane(pos, Z);
    if (!pt) return;
    if (this.moving) {
      this.applyMovePoint(pt);
      return;
    }
    if (this.dragging) this.applyPoint(this.dragging, pt);
  }

  public onTouchEnd(): void {
    if (this.owner !== "touch") return;
    if (this.moving) {
      this.endMove();
      return;
    }
    if (this.dragging) this.end(this.dragging);
  }

  public get isDragging(): boolean {
    return this.dragging !== null;
  }

  // ---------- drag lifecycle ----------

  public begin(card: Draggable): void {
    if (this.dragging) return;
    this.dragging = card;
    this.overBar = false;
    card.homeWorldPos = card.root.getTransform().getWorldPosition();
    // The card is NOT touched here. It stays exactly where the finger found it
    // until applyPoint decides this is really a drag — see LIFT_DURATION.
    this.dragEngaged = false;
    this.followPos = null;
    this.buildGhost(card.activity);
  }

  /**
   * SIK (hand ray) entry points — device only.
   *
   * In Preview the MouseInteractor listens to the same touch events this
   * controller already handles, and it holds on to its last target: a press
   * anywhere could re-fire trigger events against a stale card and open the
   * wrong panel. Touch is authoritative in the editor, SIK on hardware, and the
   * two are never live at once.
   */
  public beginFromSIK(card: Draggable, interactor: Interactor): void {
    if (global.deviceInfoSystem.isEditor()) return;
    if (this.dragging || this.moving) return;
    const hit = this.resolvePlanePoint(interactor);
    this.owner = "sik";
    this.pressPoint = hit;
    this.peakTravel = 0;
    this.begin(card);
    if (hit) this.applyPoint(card, hit);
  }

  public updateFromSIK(card: Draggable, interactor: Interactor): void {
    if (global.deviceInfoSystem.isEditor()) return;
    if (this.dragging !== card || this.owner !== "sik") return;
    const hit = this.resolvePlanePoint(interactor);
    if (hit) this.applyPoint(card, hit);
  }

  public endFromSIK(card: Draggable): void {
    if (global.deviceInfoSystem.isEditor()) return;
    if (this.dragging !== card || this.owner !== "sik") return;
    this.end(card);
  }

  /** Move the held card to a plane point and refresh the drop preview. */
  private applyPoint(card: Draggable, hit: vec3): void {
    this.lastPoint = hit;
    if (this.pressPoint) {
      const dx = hit.x - this.pressPoint.x;
      const dy = hit.y - this.pressPoint.y;
      const travel = Math.sqrt(dx * dx + dy * dy);
      if (travel > this.peakTravel) this.peakTravel = travel;
    }
    // THE GATE. Below the threshold this is still possibly a tap, so the card is
    // left alone entirely — no lift, no follow, no drop preview.
    if (!this.dragEngaged) {
      if (this.peakTravel <= TAP_MAX_TRAVEL) return;
      this.dragEngaged = true;
      this.liftCard = card;
      this.liftRising = true;
      // Into the carry band the moment the gesture is CONFIRMED as a drag, not
      // on press — a tap must leave the card's ordering exactly as it found it.
      card.setCarried(true);
      print("[P28] drag started — " + card.activity.name);
    }

    // Where the card would sit fully lifted. stepLift eases it there from home
    // rather than jumping, and keeps doing so between pointer events.
    this.followPos = new vec3(hit.x, hit.y + DRAG_CARD_LIFT, Z + 1.4);

    // Keyed off the POINTER, not the card's centre. The card floats
    // DRAG_CARD_LIFT above the hand, so its centre can never reach the line
    // while the pointer is still inside the catch zone — driving the scale off
    // it capped the shrink at about 0.77 and the card stayed nearly full size.
    // Measuring the hand instead means the card is fully shrunk exactly when the
    // drop would land, which is the moment the preview has to be readable.
    const from = PLANNER_TOP + SHRINK_LEAD;
    const to = BAR_Y;
    let k = (from - hit.y) / (from - to);
    k = k < 0 ? 0 : k > 1 ? 1 : k;
    this.scaledCard = card;
    this.scaleTarget = 1 + (DRAG_SHRINK - 1) * k;

    // Bar-local coordinates: the bar root sits at (0, BAR_Y, Z).
    const localX = hit.x;
    const localY = hit.y - BAR_Y;

    const inY = localY >= BAR_CATCH_Y_MIN && localY <= BAR_CATCH_Y_MAX;
    const inX =
      localX >= -BAR_HALF - BAR_CATCH_X_MARGIN &&
      localX <= BAR_HALF + BAR_CATCH_X_MARGIN;
    this.overBar = inY && inX;

    if (this.overBar) {
      this.snappedHour = this.snapFor(card.activity, localX);
      this.rejection = validatePlacement(
        card.activity,
        this.snappedHour,
        this.getPlaced()
      );
      this.showGhost(card.activity, this.snappedHour);
    } else {
      this.rejection = null;
      this.hideGhost();
    }
  }

  public end(card: Draggable): void {
    if (this.dragging !== card) return;
    this.dragging = null;
    this.dragEngaged = false;
    this.followPos = null;
    // Fall back to the arc rather than snapping — the return tween moves the
    // card home over 0.26s and the yaw unwinds alongside it.
    this.liftRising = false;
    this.destroyGhost();

    // A gesture that never really moved was a tap, not a drop.
    if (this.peakTravel <= TAP_MAX_TRAVEL) {
      print(
        "[P7] tap on " +
          card.activity.name +
          " (travel " +
          this.peakTravel.toFixed(2) +
          "cm) — opening details"
      );
      this.sendHome(card);
      this.overBar = false;
      this.rejection = null;
      this.pressPoint = null;
      this.owner = "";
      if (this.onTap) this.onTap(card);
      return;
    }

    if (this.overBar && this.rejection === null) {
      print(
        "[P4] accepted " +
          card.activity.name +
          " at " +
          formatHour(this.snappedHour)
      );
      // The card is dimmed rather than hidden now, so it must also travel back
      // to its slot — otherwise it sits wherever the drag ended.
      card.markPlaced();
      this.sendHome(card);
      this.onPlace(card, this.snappedHour);
    } else if (this.overBar) {
      print(
        "[P4] rejected " +
          card.activity.name +
          " at " +
          formatHour(this.snappedHour) +
          " — " +
          this.rejection.kind +
          ": " +
          this.rejection.message
      );
      this.showMessage(this.rejection.message, this.lastPoint);
      this.sendHome(card);
    } else {
      print("[P3] released off the bar — " + card.activity.name + " returns home");
      this.sendHome(card);
    }
    this.overBar = false;
    this.rejection = null;
    this.pressPoint = null;
    this.owner = "";
    // Whatever the outcome, the card goes back to full size on its way home.
    this.scaleTarget = 1;
  }

  private sendHome(card: Draggable): void {
    this.tweens.push({
      obj: card.root,
      from: card.root.getTransform().getWorldPosition(),
      to: card.homeWorldPos,
      t: 0,
      duration: 0.26,
    });
  }

  // ---------- rejection message ----------

  /**
   * The reason, at the drop point rather than in a corner — on glasses, a
   * message outside where the user is looking is a message they will miss.
   * Luminous text plus a thin underline; no panel, no alarm styling.
   */
  private showMessage(text: string, at: vec3): void {
    if (!at) return;
    const root = makeGroup(null, "rejectMessage", at.x, at.y + 3.6, Z + 2.2);
    const color = new vec4(ALERT.r, ALERT.g, ALERT.b, 1);
    const label = makePlatedLabel(root, "text", text, TYPE.body, color, 0, 0, 0, BODY_CHIP);
    const rule = makeQuad(root, "underline", 5.0, 0.08, color, true, ORDER_STROKE);
    rule.getTransform().setLocalPosition(new vec3(0, -0.78, 0));
    this.messages.push({ root: root, label: label, color: color, age: 0 });
  }

  // ---------- moving a placed block ----------

  private applyMovePoint(hit: vec3): void {
    this.lastPoint = hit;
    if (this.pressPoint) {
      const dx = hit.x - this.pressPoint.x;
      const dy = hit.y - this.pressPoint.y;
      const travel = Math.sqrt(dx * dx + dy * dy);
      if (travel > this.peakTravel) this.peakTravel = travel;
    }

    const localX = hit.x;
    const localY = hit.y - BAR_Y;
    this.overBar =
      localY >= BAR_CATCH_Y_MIN &&
      localY <= BAR_CATCH_Y_MAX &&
      localX >= -BAR_HALF - BAR_CATCH_X_MARGIN &&
      localX <= BAR_HALF + BAR_CATCH_X_MARGIN;

    if (!this.overBar) {
      // Off the bar means "remove" — show no slot, the block itself follows.
      this.rejection = null;
      this.hideGhost();
      this.moving.root.getTransform().setWorldPosition(new vec3(hit.x, hit.y, Z + 1.4));
      return;
    }

    this.snappedHour = this.snapFor(this.moving.activity, localX);
    // A block never collides with itself.
    const others = this.blocks().filter((b) => b !== this.moving);
    this.rejection = validatePlacement(
      this.moving.activity,
      this.snappedHour,
      others as PlacedSpan[]
    );
    this.showGhost(this.moving.activity, this.snappedHour);
    if (this.rejection === null) this.moving.moveTo(this.snappedHour);
  }

  private endMove(): void {
    const block = this.moving;
    this.moving = null;
    this.destroyGhost();

    if (this.peakTravel <= TAP_MAX_TRAVEL) {
      block.moveTo(this.moveOrigHour);
      // Pass 26: this branch used to open the detail panel. The GATE is
      // unchanged — under TAP_MAX_TRAVEL is still the only way in — only what
      // the app does with it changed. See TravelPlanApp.toggleDone.
      print("[P25] tap on placed " + block.activity.name + " — toggling done");
      this.resetGesture();
      // moveTo() puts the pill back at its RAW hour position, not the position
      // the row's sweep gave it — see the note on the rejection branch below.
      if (this.onMove) this.onMove(block, this.moveOrigHour);
      if (this.onBlockTap) this.onBlockTap(block);
      return;
    }

    if (!this.overBar) {
      print("[P8] removed " + block.activity.name + " from the bar");
      this.resetGesture();
      if (this.onRemove) this.onRemove(block);
      return;
    }

    if (this.rejection !== null) {
      print(
        "[P8] move rejected — " +
          block.activity.name +
          ": " +
          this.rejection.message
      );
      this.showMessage(this.rejection.message, this.lastPoint);
      block.moveTo(this.moveOrigHour);
      this.resetGesture();
      /**
       * PASS 24 — put the ROW back, not just the pill.
       *
       * moveTo() restores the pill to its true hour, which is not where it was
       * sitting: the row's sweep nudges pills apart to keep them readable, and
       * that sweep only runs from the app. So a rejected move used to drop the
       * pill straight on top of its neighbour and leave it there until the next
       * change to the day. Invisible on a sparse day; on a full six-pill Tokyo
       * row, where the pills already touch, it overlapped every time.
       *
       * Reporting the ORIGINAL hour is what makes this safe — the data does not
       * change, only the layout is recomputed.
       */
      if (this.onMove) this.onMove(block, this.moveOrigHour);
      return;
    }

    block.moveTo(this.snappedHour);
    print("[P8] moved " + block.activity.name + " to " + formatHour(this.snappedHour));
    this.resetGesture();
    if (this.onMove) this.onMove(block, this.snappedHour);
  }

  private resetGesture(): void {
    this.overBar = false;
    this.rejection = null;
    this.pressPoint = null;
    this.owner = "";
    this.peakTravel = 0;
  }

  // ---------- snapping ----------

  /** Centre the block on the pointer, snap to the grid, keep it inside the bar. */
  private snapFor(activity: Activity, localX: number): number {
    const durH = activity.durationMin / 60;
    let start = hourForX(localX) - durH / 2;
    start = Math.round(start / SNAP_HOURS) * SNAP_HOURS;
    const latest = BAR_END_HOUR - durH;
    if (start < BAR_START_HOUR) start = BAR_START_HOUR;
    if (start > latest) start = latest;
    return start;
  }

  // ---------- ghost preview ----------

  private buildGhost(activity: Activity): void {
    this.destroyGhost();
    // Pass 14: the ghost is the PILL's size, not the duration's length. Pass 20
    // made pills variable-width, so the ghost can no longer BE one — it previews
    // where the drop lands, not how wide the result will be, and a fixed outline
    // is the honest shape for that.
    const w = GHOST_W;
    // PASS 21: the ghost was drawn in the ACTIVITY's identity hue, so the drop
    // preview was violet for one card, amber for the next and green for Lunch.
    // Those six hues stopped meaning anything on the planner in Pass 14 and the
    // panel went neutral in Pass 17; the preview was the last place still using
    // them. It is now the one accent, always — the ONLY colour change left is
    // the rejection, which is the one thing the colour should be reserved for.
    this.ghost = makeGroup(this.barRoot, "dropGhost", 0, BLOCK_REST_Y, BLOCK_Z_LIFT - 0.3);
    this.ghostDashes = makeDashedRoundedOutline(
      this.ghost,
      w,
      BLOCK_HEIGHT,
      new vec4(ACCENT.r, ACCENT.g, ACCENT.b, 0.9),
      0.09,
      0.55
    );
    this.ghostInvalid = false;
    /**
     * PASS 32 — NO PLATE.
     *
     * This was a makePlatedLabel sized to 13cm, wide enough to hold the longest
     * rejection reason. That plate was the whole problem Passes 30 and 31 were
     * chasing at the wrong end: a translucent bar a third of the container wide,
     * riding the ghost's x, which washed over the day button, the recap and
     * Clear day whenever the drop slot came near them — while the dashes it was
     * nominally backing sat centimetres below on the line. Render order could
     * only decide who won that overlap; it could not stop the overlap, because
     * the rectangle is simply bigger than the thing it belongs to.
     *
     * So it is gone. The ghost is now exactly two things: the dashed outline at
     * the snapped slot, and this label. Legibility comes from the same dark halo
     * every other label in the Lens gets from makeLabel — an outline pass around
     * the glyphs, which is text-sized by construction and cannot cover anything
     * behind it.
     */
    this.ghostLabel = makeLabel(
      this.ghost,
      "ghostTime",
      "",
      TYPE.label,
      new vec4(INK.r, INK.g, INK.b, 1),
      Align.Center,
      0,
      BLOCK_HEIGHT / 2 + 0.85,
      0.02
    );
    /**
     * The ghost goes up with the card. It sits low on the bar and rarely meets
     * the recap in practice, but "the thing being carried draws in front" has to
     * hold for the preview too, or the one time a short day puts the recap and
     * the drop zone in the same place it reads as a bug.
     *
     * Mapped by layer rather than re-based: what is left is built by two Theme
     * helpers whose orders are 30 and 40, and collapsing those into two adjacent
     * slots keeps the ghost under the card it previews for.
     */
    const ghostVisuals: { visual: Visual; order: number }[] = [];
    collectVisuals(this.ghost, ghostVisuals);
    for (let i = 0; i < ghostVisuals.length; i++) {
      const step = ghostVisuals[i].order >= ORDER_TEXT ? 2 : 1;
      ghostVisuals[i].visual.setRenderOrder(ORDER_GHOST + step);
    }

    this.ghost.enabled = false;
  }

  private showGhost(activity: Activity, startHour: number): void {
    if (!this.ghost) return;
    this.ghost.enabled = true;
    this.ghost
      .getTransform()
      .setLocalPosition(
        new vec3(
          blockCenterX(startHour, activity.durationMin),
          BLOCK_REST_Y,
          BLOCK_Z_LIFT - 0.3
        )
      );
    const invalid = this.rejection !== null;
    if (invalid !== this.ghostInvalid) {
      this.ghostInvalid = invalid;
      const dashColor = invalid
        ? new vec4(ALERT.r, ALERT.g, ALERT.b, 0.95)
        : new vec4(ACCENT.r, ACCENT.g, ACCENT.b, 0.9);
      for (let i = 0; i < this.ghostDashes.length; i++) {
        setQuadColor(this.ghostDashes[i], dashColor, true);
      }
    }
    if (this.ghostLabel) {
      // The reason replaces the time: while it cannot land, the time is moot.
      this.ghostLabel.text = invalid
        ? this.rejection.message
        : formatHour(startHour) +
          " – " +
          formatHour(startHour + activity.durationMin / 60);
      this.ghostLabel.textFill.color = invalid
        ? new vec4(ALERT.r, ALERT.g, ALERT.b, 1)
        : new vec4(INK.r, INK.g, INK.b, 0.95);
    }
  }

  private hideGhost(): void {
    if (this.ghost) this.ghost.enabled = false;
  }

  private destroyGhost(): void {
    if (this.ghost) {
      this.ghost.destroy();
      this.ghost = null;
      this.ghostLabel = null;
    }
  }

  // ---------- ray -> plane ----------

  /**
   * Turn the interactor's world ray into a point on the composition plane.
   * Falls back to SIK's own planecast if the ray is unavailable, so this works
   * for mouse, hand ray and poke alike.
   */
  private resolvePlanePoint(interactor: Interactor): vec3 {
    const start = interactor.startPoint;
    const dir = interactor.direction;
    if (start && dir && Math.abs(dir.z) > 0.0001) {
      const t = (Z - start.z) / dir.z;
      if (t > 0) return start.add(dir.uniformScale(t));
    }
    const pc = interactor.planecastPoint;
    if (pc) return new vec3(pc.x, pc.y, Z);
    const th = interactor.targetHitPosition;
    if (th) return new vec3(th.x, th.y, Z);
    if (!this.warnedNoRay) {
      this.warnedNoRay = true;
      print("[P3] WARNING: interactor exposed no usable ray or hit point");
    }
    return null;
  }

  /** Hold the message briefly, then fade it out and clean it up. */
  private stepMessages(dt: number): void {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      const m = this.messages[i];
      m.age += dt;
      if (m.age <= MESSAGE_HOLD) continue;
      const k = (m.age - MESSAGE_HOLD) / MESSAGE_FADE;
      if (k >= 1) {
        m.root.destroy();
        this.messages.splice(i, 1);
      } else {
        const a = 1 - k;
        m.label.textFill.color = new vec4(m.color.r, m.color.g, m.color.b, a);
        const t = m.root.getTransform();
        const pos = t.getLocalPosition();
        // drift upward very slightly as it goes, so it reads as dismissed
        t.setLocalPosition(new vec3(pos.x, pos.y + dt * 1.4, pos.z));
      }
    }
  }

  // ---------- return-home tween ----------

  public step(): void {
    const dt = getDeltaTime();
    this.stepMessages(dt);
    this.stepLift(dt);
    this.stepShrink(dt);
    if (this.tweens.length === 0) return;
    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt / tw.duration;
      let k = tw.t >= 1 ? 1 : tw.t;
      k = 1 - (1 - k) * (1 - k); // ease-out
      tw.obj
        .getTransform()
        .setWorldPosition(vec3.lerp(tw.from, tw.to, k));
      if (tw.t >= 1) this.tweens.splice(i, 1);
    }
  }

  /**
   * Ease the card between its slot and the hand.
   *
   * Runs every frame rather than only on pointer events, which matters: press,
   * move 2cm, then hold still, and the ease still completes instead of freezing
   * part-way. While the card is rising it is placed by LERPING from where the
   * finger found it to where a fully-lifted card would be, so there is no jump
   * at the moment of engagement — only at k = 1 does it sit exactly on the hand.
   */
  private stepLift(dt: number): void {
    if (!this.liftCard) return;
    const d = dt / LIFT_DURATION;
    this.liftT += this.liftRising ? d : -d;
    if (this.liftT > 1) this.liftT = 1;
    if (this.liftT < 0) this.liftT = 0;

    const k = 1 - (1 - this.liftT) * (1 - this.liftT); // ease-out
    this.liftCard.setLiftProgress(k);

    if (this.liftRising && this.followPos) {
      this.liftCard.root
        .getTransform()
        .setWorldPosition(vec3.lerp(this.liftCard.homeWorldPos, this.followPos, k));
    }

    // Released and fully back on the arc: stop touching it, and drop it out of
    // the carry band. Done HERE rather than in end(), because the return tween
    // is still flying the card back across the planner at that point and
    // restoring early would put it behind the recap for the last 0.26s.
    if (!this.liftRising && this.liftT <= 0) {
      this.liftCard.setCarried(false);
      this.liftCard = null;
    }
  }

  /**
   * Ease the held card toward its target scale.
   *
   * Lerped rather than set, so crossing the panel edge is a movement rather than
   * a jump. The card is released from this only once it is back at full size —
   * dropping it the moment the drag ends would leave a shrunken card sitting in
   * the row if the release happened mid-transition.
   */
  private stepShrink(dt: number): void {
    if (!this.scaledCard) return;
    const k = Math.min(1, dt * SHRINK_RATE);
    this.scaleCur += (this.scaleTarget - this.scaleCur) * k;
    if (this.scaleTarget === 1 && Math.abs(this.scaleCur - 1) < 0.004) {
      this.scaleCur = 1;
      this.scaledCard.root.getTransform().setLocalScale(vec3.one());
      this.scaledCard = null;
      return;
    }
    const s = this.scaleCur;
    this.scaledCard.root.getTransform().setLocalScale(new vec3(s, s, s));
  }
}

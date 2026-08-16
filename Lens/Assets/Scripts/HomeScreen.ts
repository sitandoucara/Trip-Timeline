/**
 * The entry point the user actually sees: a title and five cities on an arc.
 *
 * PASS 12 — the flat row became a carousel.
 *
 * The cards sit on a circle whose centre is BEHIND them, so the arc bulges
 * toward the user: the selected card is nearest, largest and dead centre, and
 * its neighbours fall away to the sides, yawed to follow the curve, overlapping
 * it. That overlap is the point — it is what makes five flat rectangles read as
 * one curved surface rather than a row of tiles.
 *
 * At this scale the depth difference along the arc is only a few centimetres, so
 * the curve is carried almost entirely by the YAW and the size falloff, not by
 * perspective. Trying to sell it with depth alone would need a radius so tight
 * that the outer cards swing past the display edge.
 *
 * Selection still uses the same raw touch path as everything else — hit-testing
 * rectangles on the composition plane — because that is the input that provably
 * works with a mouse in the simulator. Only the CENTRE card is a target; the
 * arrows move a city into the centre first. That keeps the hit test exact: the
 * centre card is the one card that sits flat on the plane, unrotated, so its
 * rectangle needs no projection.
 */
import { CITIES, City } from "./Catalogue";
import { HOME_CARD_HEIGHT, HOME_CARD_WIDTH, HOME_CARD_Y, Z } from "./Layout";
import { screenToPlane, withinRect } from "./ScreenPlane";
import { cityThumb } from "./Thumbnails";
import {
  Align,
  BODY,
  BODY_CHIP,
  GLASS,
  INK,
  INK_DIM,
  ORDER_SCRIM,
  PHOTO_GAIN,
  PHOTO_LIFT,
  RADIUS,
  SERIF,
  STROKE,
  TYPE,
  makeBody,
  makeGroup,
  makeLabel,
  makeRoundedFill,
  makeRoundedImage,
  makeRoundedOutline,
  measureText,
  setBodyEmission,
  setPhotoTint,
  setShapeColor,
  textWidth,
} from "./Theme";

/**
 * ---------------------------------------------------------------------------
 * PASS 28 DELETED THIS FILE'S PRIVATE TYPOGRAPHY.
 *
 * Pass 27 put Abhaya on the home screen alone, which meant carrying a local copy
 * of the advance tables, the cap-height compensation and the face selection —
 * roughly 80 lines — precisely because Theme could not be touched without moving
 * the pill row solve underneath the planner.
 *
 * The serif is now global, so all of that lives in Theme where it belongs, and
 * ONE table drives both what is drawn and what is measured. The weights did not
 * change in the move: Theme picks by cap height, and this screen's four roles
 * land on exactly the cuts Pass 27 chose for them by hand —
 *
 *     title    TYPE.display 1.40  ->  ExtraBold
 *     city     TYPE.head    0.68  ->  Bold
 *     subtitle TYPE.body    0.58  ->  SemiBold
 *     country  TYPE.label   0.52  ->  SemiBold
 *
 * The revert switch moved with it: HOME_SCREEN_SERIF is gone and Theme.SERIF is
 * the single global one. Nothing here needs to know which face is showing.
 * ---------------------------------------------------------------------------
 */

/**
 * Measured width of a home-screen run.
 *
 * On the serif this is simply Theme's measureText, which now reads the same
 * table the label will be drawn in. On Inter it deliberately keeps the OLD
 * path — textWidth's flat over-estimate scaled back by ADVANCE_FIT — because
 * these two labels were laid out and signed off against that arithmetic, and a
 * revert should restore what shipped rather than something merely close.
 */
function homeWidth(text: string, capCm: number): number {
  return SERIF ? measureText(text, capCm) : textWidth(text, capCm) * ADVANCE_FIT;
}

/** Radius of the arc the cards lie on, and the angle between neighbours. */
const ARC_RADIUS = 26.0;
const ARC_STEP = (16.0 * Math.PI) / 180.0;

/**
 * Size and brightness falloff by distance from the centre slot.
 *
 * Read at FRACTIONAL distances since Pass 25 — see `ladder` — so that a card
 * halfway between two slots is halfway between two sizes. The values themselves
 * are untouched: at every whole offset these tables return exactly what they
 * always did, which is what keeps the resting carousel identical to Pass 24's.
 */
const SLOT_SCALE = [1.0, 0.88, 0.79];
const SLOT_DIM = [1.0, 0.72, 0.55];

/**
 * How long a card takes to reach its new slot. Deliberately short: this is a
 * carousel, and the arrow's job is to put a city in the middle, not to perform.
 * Long enough to read as movement rather than a cut, short enough that a second
 * press never feels blocked.
 */
const GLIDE_SEC = 0.22;

/**
 * Ease-out cubic. The card leaves the moment the arrow is pressed and settles
 * into its slot, which is the right shape for a control: all the speed is at the
 * start, where it answers the press, rather than in the middle where it would
 * only draw the eye.
 */
function ease(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

/** Read a falloff table at a fractional number of steps. */
function ladder(table: number[], steps: number): number {
  const i = Math.floor(steps);
  if (i >= table.length - 1) return table[table.length - 1];
  return table[i] + (table[i + 1] - table[i]) * (steps - i);
}

/**
 * Snap an animated brightness to 1/64ths before it reaches Theme.
 *
 * Theme's material caches key on three decimals, so an un-rounded eased value
 * would mint a new Material every frame and never hit the cache. 64 steps is far
 * finer than the eye can resolve across a 0.45 range and bounds the cache at a
 * few dozen entries for the whole session.
 */
function quant(v: number): number {
  return Math.round(v * 64) / 64;
}

/**
 * Everything the glide needs to move one card without rebuilding it.
 *
 * PASS 25 STOPPED THROWING THE CARDS AWAY. rotate() used to destroy the whole
 * carousel and build five fresh cards at their new slots, which is why the
 * movement was a cut — there was nothing left to move. Cards are now built once
 * and posed, and `orders` is the piece that makes that safe: the render order a
 * card's layers need depends on how far from centre it is, so each visual
 * records its offset from its card's base order at build time and the whole
 * stack is re-based whenever the card crosses into a new depth band.
 */
interface CardView {
  index: number;
  slot: SceneObject;
  backing: SceneObject;
  /** The photograph's floor and the photograph. Null when the city has no thumb. */
  lift: SceneObject;
  img: SceneObject;
  /** The fallback fill, used instead when the city has no thumbnail. */
  well: SceneObject;
  caption: SceneObject;
  frame: SceneObject;
  name: Text;
  country: Text;
  orders: { visual: Visual; delta: number }[];
  /** Last values written, so a still card costs nothing. */
  lastDim: number;
  lastBase: number;
  /** Slot the glide starts and ends at. Whole numbers once it is over. */
  from: number;
  to: number;
  /**
   * Set on the ONE card per press that has to cross the seam of the loop. It
   * cannot slide from one end to the other — that would drag it across the face
   * of every other card — so it leaves one edge and returns at the other.
   */
  wraps: boolean;
  wrapOut: number;
  wrapIn: number;
}

/**
 * Corner radius, shared by the frame, the image and the caption plate — and now
 * with every other rounded rectangle in the Lens. The arrows stay circles: they
 * are buttons whose whole shape is the affordance, not panels.
 */
const CARD_RADIUS = RADIUS;

/** The caption plate: how much of the card's foot the text sits on. */
const CAPTION_H = 3.4;

/**
 * PASS 17 DELETED THE STACKING FROM HERE — 3 backing passes, 5 photo passes and
 * 2 caption passes, ten draws where one does.
 *
 * The reasoning that produced them was wrong in an interesting way. "Two stacked
 * passes halved the bleed and three made it solid" was never reproducible: an
 * isolated probe found six coplanar passes pixel-identical to one, because
 * BlendMode.Normal at source alpha 1 REPLACES the target rather than
 * accumulating into it. What actually changed the picture in those old tests was
 * something else moving at the same time. The real cause was that the world is
 * added over the finished Lens frame, so an image only stops showing it once the
 * image out-emits it — which is Theme.PHOTO_GAIN, in one draw.
 */

/** textWidth() deliberately over-estimates; this scales it back to measured. */
const ADVANCE_FIT = 0.85;

/** Pass 27 renamed the Lens on this screen. Home screen copy only. */
const TITLE = "Trip Timeline";
const SUBTITLE = "Plan your activities across the day";

const ARROW_X = 5.5;
const ARROW_Y = HOME_CARD_Y - HOME_CARD_HEIGHT / 2 - 2.0;
/**
 * PASS 18 took these from 3.8cm to 2.4cm. At 3.8 they were the second largest
 * objects on the home screen and competed with the cards they only serve; a
 * discreet control is the whole brief for them. The HIT rectangle is
 * deliberately NOT reduced in step — it stays half again the disc, because a
 * 2.4cm circle at 75cm is a small target and shrinking what you can press is a
 * different decision from shrinking what you can see.
 */
const ARROW_D = 2.4;
/** Generous, because a 2.4cm circle is a small target at 75cm. */
const ARROW_HIT = 3.6;

export class HomeScreen {
  public readonly root: SceneObject;
  private carousel: SceneObject = null;
  private cards: CardView[] = [];
  /** Progress through a glide, 0..1. Negative means the carousel is at rest. */
  private glideT: number = -1;
  private pressed: string = "";
  private live: boolean = true;
  /** Index into CITIES of the card currently in the centre slot. */
  private centerIndex: number = 0;

  /**
   * `startCityId` is which city to open centred. Empty — the default — centres
   * CITIES[0], which is Paris, and that is the very first launch of a session.
   *
   * PASS 25 — THE CAROUSEL REMEMBERS. Pass 23 tried this and could not, for a
   * reason that had nothing to do with the design: this file was unwritable, so
   * the one honest fix — an argument saying where to start — was off the table,
   * and the workaround it reached for instead (retaining the HomeScreen instance
   * across a visit rather than rebuilding it) came back with `live` already
   * false and accepted no input at all. See TravelPlanApp.showHome for that
   * whole story; the file is writable again and this is the fix that was always
   * wanted.
   *
   * Note what this does NOT do: it reads nothing from storage. The caller passes
   * a plain SESSION value, so pressing "Cities" from Tokyo comes back to Tokyo
   * while a fresh launch always opens on Paris. Pass 29 deleted the persisted
   * `week.lastCityId` entirely — a relaunch now starts here by design, and a
   * carousel centred from storage would have quietly undone that.
   */
  constructor(private onSelect: (city: City) => void, startCityId: string = "") {
    this.root = makeGroup(null, "HomeScreen", 0, 0, 0);
    if (startCityId) {
      for (let i = 0; i < CITIES.length; i++) {
        if (CITIES[i].id === startCityId) {
          this.centerIndex = i;
          break;
        }
      }
    }
    this.buildTitle();
    this.buildArrows();
    this.buildCarousel();
  }

  private get centerCity(): City {
    return CITIES[this.centerIndex];
  }

  private buildTitle(): void {
    const head = makeGroup(this.root, "Title", 0, 11.0, Z);
    this.platedLabel(head, "title", TITLE, TYPE.display, INK, 0, 0);
    this.platedLabel(
      head,
      "sub",
      SUBTITLE,
      TYPE.body,
      new vec4(INK_DIM.r, INK_DIM.g, INK_DIM.b, 1),
      -2.7,
      0
    );
  }

  /**
   * Theme.makePlatedLabel's shape, rebuilt locally for one reason: it sizes the
   * plate from textWidth(), and these two labels want the MEASURED width of the
   * face they are actually drawn in. Everything else is Theme's arithmetic
   * unchanged, so the Inter path still draws exactly what Pass 26 drew.
   */
  private platedLabel(
    parent: SceneObject,
    name: string,
    text: string,
    capCm: number,
    color: vec4,
    y: number,
    z: number
  ): void {
    const w = homeWidth(text, capCm) + capCm * 1.4;
    const h = capCm * 2.5;
    makeBody(parent, name + "Plate", w, h, BODY_CHIP, ORDER_SCRIM, Math.min(0.45, h / 2))
      .getTransform()
      .setLocalPosition(new vec3(0, y, z - 0.02));
    makeLabel(parent, name, text, capCm, color, Align.Center, 0, y, z);
  }

  // ---------- the arc ----------

  /**
   * Where card `offset` slots away from centre sits, in carousel-local space.
   * The arc's centre of curvature is ARC_RADIUS behind the centre card, so the
   * centre card lands exactly on the composition plane at local z = 0.
   */
  private slotAngle(offset: number): number {
    return offset * ARC_STEP;
  }

  /**
   * Signed distance from the centre slot, wrapped so the carousel is a loop.
   *
   * With five cities (Pass 19) this yields {-2, -1, 0, +1, +2} — two either
   * side, which is what the arc and the three-step SLOT_SCALE/SLOT_DIM ladders
   * were always built for. At four it gave {-1, 0, +1, +2}, lopsided because
   * something has to be with an even count. The wrap threshold is unchanged:
   * `r > 2` is what makes both cases fall out of the same line.
   */
  private offsetFor(index: number): number {
    return this.offsetOf(index, this.centerIndex);
  }

  /** The same wrap, against an arbitrary centre — rotate() needs both ends. */
  private offsetOf(index: number, center: number): number {
    const n = CITIES.length;
    let r = (index - center + n) % n;
    if (r > 2) r -= n;
    return r;
  }

  private buildCarousel(): void {
    if (this.carousel) this.carousel.destroy();
    this.carousel = makeGroup(this.root, "Carousel", 0, HOME_CARD_Y, Z);
    this.cards = [];

    // Draw the far cards first so the centre card always lands on top of its
    // neighbours; render order does the same job for the transparent layers.
    const order: number[] = [];
    for (let i = 0; i < CITIES.length; i++) order.push(i);
    order.sort((a, b) => Math.abs(this.offsetFor(b)) - Math.abs(this.offsetFor(a)));

    for (let k = 0; k < order.length; k++) {
      const i = order[k];
      const view = this.buildCard(CITIES[i], i);
      this.cards.push(view);
      this.pose(view, this.offsetFor(i), 1);
    }
  }

  /**
   * Higher priority draws later, so the centre card is always on top.
   *
   * These stay inside the 0..40 band the rest of the Lens uses. Pushing them
   * into the hundreds — which seemed harmless, since the home screen owns the
   * whole display — made every photograph blend as though it were additive and
   * wash out against the sky. Same symptom as the detail panel's missing scrim
   * in Pass 11, and the same fix: keep render orders in the band the renderer
   * is evidently configured for.
   *
   * Rounded rather than floored, so that during a glide two cards swap depth at
   * the instant they are equidistant from the centre — which is the only moment
   * where the swap is geometrically correct and therefore the only moment where
   * it cannot be seen.
   */
  private baseOrderFor(offset: number): number {
    return 6 + (2 - Math.min(2, Math.round(Math.abs(offset)))) * 11;
  }

  /**
   * Build a card in its NEUTRAL state — centred, full size, undimmed — and hand
   * back the handles that `pose` needs. Nothing here depends on which slot the
   * card is going to occupy; that is entirely pose's job now, which is what lets
   * the same card be moved instead of rebuilt.
   */
  private buildCard(city: City, index: number): CardView {
    const base = this.baseOrderFor(0);
    const slot = makeGroup(this.carousel, "city_" + city.id, 0, 0, 0);

    const W = HOME_CARD_WIDTH;
    const H = HOME_CARD_HEIGHT;

    /**
     * 1. A backing scrim, then the photograph filling the frame edge to edge.
     *
     * The backing is the card's own dark glass, sitting under the photograph so
     * the card still reads as an object where the image is dark.
     */
    const backing = makeBody(slot, "backing", W, H, BODY, base, CARD_RADIUS);
    backing.getTransform().setLocalPosition(new vec3(0, 0, 0));

    let lift: SceneObject = null;
    let img: SceneObject = null;
    let well: SceneObject = null;
    const tex = cityThumb(city.id);
    if (tex) {
      const photo = makeRoundedImage(slot, "photo", W, H, tex, base + 2, CARD_RADIUS);
      photo.getTransform().setLocalPosition(new vec3(0, 0, 0.01));
      // makeRoundedImage returns a GROUP: the lift plate that gives the picture
      // a floor, and the picture itself. Both dim, at different rates.
      lift = photo.getChild(0);
      img = photo.getChild(1);
    } else {
      well = makeRoundedFill(
        slot,
        "photoWell",
        W,
        H,
        new vec4(GLASS.r, GLASS.g, GLASS.b, 0.3),
        true,
        base + 2,
        CARD_RADIUS
      );
    }

    /**
     * 2. A caption plate under the words. The brief said a card is four things
     * and this is a fifth, but "Los Angeles" in white over that photograph's
     * sunset is unreadable without it, and legibility outranks purity — it is
     * the one thing Pass 11 was entirely about. It is a plate, not a panel: it
     * covers only the foot of the card and carries nothing of its own.
     */
    const caption = makeBody(
      slot,
      "caption",
      W,
      CAPTION_H,
      BODY * 1.5,
      base + 4,
      CARD_RADIUS * 0.8
    );
    caption.getTransform().setLocalPosition(new vec3(0, -H / 2 + CAPTION_H / 2, 0.03));

    // 3. The frame. One stroke colour for every card — no per-city accent.
    const frame = makeRoundedOutline(
      slot,
      "frame",
      W,
      H,
      new vec4(GLASS.r, GLASS.g, GLASS.b, 0.95),
      STROKE,
      base + 8,
      CARD_RADIUS
    );
    frame.getTransform().setLocalPosition(new vec3(0, 0, 0.04));

    /**
     * 4. Name and country, left-aligned on the image.
     *
     * Align.Left does NOT anchor a Text's left edge here — it runs the string
     * leftward from the position, so both captions landed on the neighbouring
     * card. Rather than trust the alignment mode, these are centred labels
     * placed by measurement: the centre of a run that starts at the card's left
     * padding is half its width further in. textWidth over-estimates by design,
     * so it is scaled back to its measured ratio to keep the left edges true.
     */
    const leftEdge = -W / 2 + 0.8;
    const nameW = homeWidth(city.name, TYPE.head);
    const countryW = homeWidth(city.country, TYPE.label);
    const name = makeLabel(
      slot,
      "name",
      city.name,
      TYPE.head,
      new vec4(INK.r, INK.g, INK.b, 1),
      Align.Center,
      leftEdge + nameW / 2,
      -H / 2 + 2.35,
      0.06
    );
    name.setRenderOrder(base + 9);
    const country = makeLabel(
      slot,
      "country",
      city.country,
      TYPE.label,
      new vec4(INK_DIM.r, INK_DIM.g, INK_DIM.b, 1),
      Align.Center,
      leftEdge + countryW / 2,
      -H / 2 + 1.05,
      0.06
    );
    country.setRenderOrder(base + 9);

    /**
     * Record every visual's order RELATIVE to the card's base, by reading back
     * what was just set rather than by listing the offsets here. The photo group
     * assigns two of these itself, inside Theme, and a hand-written table would
     * be a second copy of that arithmetic waiting to fall out of step.
     */
    const orders: { visual: Visual; delta: number }[] = [];
    this.collectOrders(slot, base, orders);

    return {
      index: index,
      slot: slot,
      backing: backing,
      lift: lift,
      img: img,
      well: well,
      caption: caption,
      frame: frame,
      name: name,
      country: country,
      orders: orders,
      lastDim: -1,
      lastBase: base,
      from: 0,
      to: 0,
      wraps: false,
      wrapOut: 0,
      wrapIn: 0,
    };
  }

  private collectOrders(
    obj: SceneObject,
    base: number,
    out: { visual: Visual; delta: number }[]
  ): void {
    const mesh = obj.getComponent("Component.RenderMeshVisual");
    if (mesh) out.push({ visual: mesh, delta: mesh.getRenderOrder() - base });
    const text = obj.getComponent("Component.Text");
    if (text) out.push({ visual: text, delta: text.getRenderOrder() - base });
    const n = obj.getChildrenCount();
    for (let i = 0; i < n; i++) this.collectOrders(obj.getChild(i), base, out);
  }

  // ---------- posing ----------

  /**
   * Put a card at a fractional slot. THE one place a card's appearance is
   * decided, at rest and mid-glide alike — which is the point: there is no
   * separate "resting" path that could drift from the animated one, so the
   * carousel standing still is the same code as the carousel moving, at t = 1.
   *
   * `alpha` is the wrap fade and is 1 for everything else. See rotate() for the
   * one card per press that needs it.
   */
  private pose(v: CardView, offset: number, alpha: number): void {
    const a = Math.abs(offset);
    const steps = Math.min(SLOT_SCALE.length - 1, a);
    const scale = ladder(SLOT_SCALE, steps);
    const angle = this.slotAngle(offset);

    const tr = v.slot.getTransform();
    tr.setLocalPosition(
      new vec3(
        ARC_RADIUS * Math.sin(angle),
        0,
        ARC_RADIUS * (Math.cos(angle) - 1)
      )
    );
    // Face outward from the arc's centre, so each card lies flat on the curve.
    tr.setLocalRotation(quat.angleAxis(angle, vec3.up()));
    tr.setLocalScale(new vec3(scale, scale, scale));

    // Depth band. Only touched when the card actually crosses into a new one.
    const base = this.baseOrderFor(offset);
    if (base !== v.lastBase) {
      v.lastBase = base;
      for (let i = 0; i < v.orders.length; i++) {
        v.orders[i].visual.setRenderOrder(base + v.orders[i].delta);
      }
    }

    // Brightness. Quantised, and skipped entirely when it has not moved — a
    // still carousel must not be minting materials every frame.
    const dim = quant(ladder(SLOT_DIM, steps) * alpha);
    if (dim === v.lastDim) return;
    v.lastDim = dim;

    setBodyEmission(v.backing, BODY * alpha);
    if (v.img) {
      // The floor under a photograph dims only PART of the way with it: taking
      // it down in step made a neighbour read as transparent rather than as
      // distant, and the street behind cut straight through the card. The 0.7
      // here is the same constant makeRoundedImage applies at build time.
      setBodyEmission(v.lift, PHOTO_LIFT * (0.7 + 0.3 * dim) * alpha);
      setPhotoTint(v.img, new vec4(dim * PHOTO_GAIN, dim * PHOTO_GAIN, dim * PHOTO_GAIN, 1));
    }
    if (v.well) {
      setShapeColor(v.well, new vec4(GLASS.r, GLASS.g, GLASS.b, 0.3 * dim), true);
    }
    setBodyEmission(v.caption, BODY * 1.5 * dim);

    // The centre card's frame is brighter than its neighbours'. Written as a
    // ramp rather than a test on `offset === 0`, so it eases with everything
    // else instead of snapping the moment a card passes the middle.
    const edge = 0.55 + 0.4 * Math.max(0, 1 - a);
    setShapeColor(v.frame, new vec4(GLASS.r, GLASS.g, GLASS.b, edge * dim), true);

    v.name.textFill.color = new vec4(INK.r, INK.g, INK.b, dim);
    v.country.textFill.color = new vec4(INK_DIM.r, INK_DIM.g, INK_DIM.b, dim);
  }

  // ---------- arrows ----------

  private buildArrows(): void {
    this.buildArrow("prev", -ARROW_X, "‹");
    this.buildArrow("next", ARROW_X, "›");
  }

  private buildArrow(name: string, x: number, glyph: string): void {
    const g = makeGroup(this.root, "arrow_" + name, x, ARROW_Y, Z);
    // A rounded rect whose radius is half its width is a circle.
    makeBody(g, "disc", ARROW_D, ARROW_D, BODY_CHIP, 34, ARROW_D / 2);
    makeRoundedOutline(
      g,
      "ring",
      ARROW_D,
      ARROW_D,
      new vec4(GLASS.r, GLASS.g, GLASS.b, 0.8),
      STROKE,
      36,
      ARROW_D / 2
    );
    makeLabel(g, "glyph", glyph, TYPE.body, INK, Align.Center, 0, 0.04, 0.02).setRenderOrder(38);
  }

  /**
   * Start a glide to the next city.
   *
   * ARROW PRESSES DURING A GLIDE ARE IGNORED, NOT QUEUED. Both keep the ordering
   * correct, so the choice is about what the control should feel like, and
   * queueing loses: a queue lets presses bank up and keeps the carousel spinning
   * after the user has stopped asking it to, which is the one way a 0.22s
   * transition can end up feeling slow. Ignoring also makes the invariant
   * trivial — the carousel is only ever one step from the last thing it drew, so
   * there is no queue state that a selection or a dispose could interrupt
   * halfway. A press that lands mid-glide is dropped, and at this duration a
   * deliberate second press arrives after the first has finished anyway.
   */
  private rotate(direction: number): void {
    if (this.glideT >= 0) return;
    const n = CITIES.length;
    const next = (this.centerIndex + direction + n) % n;

    for (let i = 0; i < this.cards.length; i++) {
      const v = this.cards[i];
      v.from = this.offsetOf(v.index, this.centerIndex);
      v.to = this.offsetOf(v.index, next);
      /**
       * One card per press crosses the seam — it is at one end of the arc and
       * belongs at the other. Sliding it there would drag it across the face of
       * every card between, so it goes round the back instead: out past the edge
       * it is leaving while fading down, then in from beyond the opposite edge
       * while fading up. The half it is invisible for is the half it teleports
       * in, so the jump is never on screen.
       */
      v.wraps = Math.abs(v.to - v.from) > 1.5;
      if (v.wraps) {
        v.wrapOut = v.from - direction;
        v.wrapIn = v.to + direction;
      }
    }

    this.centerIndex = next;
    this.glideT = 0;
    print("[P25] centring " + this.centerCity.name);
  }

  /** Driven by TravelPlanApp's UpdateEvent — the home screen has no events of its own. */
  public step(dt: number): void {
    if (this.glideT < 0) return;
    this.glideT += dt / GLIDE_SEC;
    const done = this.glideT >= 1;
    const t = done ? 1 : this.glideT;

    for (let i = 0; i < this.cards.length; i++) {
      const v = this.cards[i];
      if (!v.wraps) {
        this.pose(v, v.from + (v.to - v.from) * ease(t), 1);
      } else if (t < 0.5) {
        const k = ease(t * 2);
        this.pose(v, v.from + (v.wrapOut - v.from) * k, 1 - k);
      } else {
        const k = ease((t - 0.5) * 2);
        this.pose(v, v.wrapIn + (v.to - v.wrapIn) * k, k);
      }
    }

    if (done) this.glideT = -1;
  }

  // ---------- input ----------

  /**
   * Press and release on the same target acts — a stray drag does nothing.
   *
   * The glide is deaf to input for its whole 0.22s, arrows and card alike. The
   * arrows because presses are dropped rather than queued (see rotate), and the
   * CARD because mid-glide the centre card is a moving object that is not yet
   * where the hit rectangle says it is — targetAt tests the flat rectangle the
   * centre slot occupies at rest, which is only true when the carousel is at
   * rest. Accepting a tap there would select whichever city happened to be
   * arriving, from a card the user never saw sitting still.
   */
  public onTouchStart(pos: vec2): void {
    if (!this.live || this.glideT >= 0) return;
    this.pressed = this.targetAt(pos);
  }

  public onTouchEnd(pos: vec2): void {
    if (!this.live || this.glideT >= 0) return;
    const released = this.targetAt(pos);
    const chosen = this.pressed;
    this.pressed = "";
    if (!chosen || released !== chosen) return;

    if (chosen === "prev") {
      this.rotate(-1);
      return;
    }
    if (chosen === "next") {
      this.rotate(1);
      return;
    }
    if (chosen === "center") {
      this.live = false;
      print("[P12] city selected — " + this.centerCity.name);
      this.onSelect(this.centerCity);
    }
  }

  /** "prev" | "next" | "center" | "" — resolved on the composition plane. */
  private targetAt(pos: vec2): string {
    const p = screenToPlane(pos, Z);
    if (!p) return "";
    if (withinRect(p, -ARROW_X, ARROW_Y, ARROW_HIT, ARROW_HIT)) return "prev";
    if (withinRect(p, ARROW_X, ARROW_Y, ARROW_HIT, ARROW_HIT)) return "next";
    // The centre card is the only card that sits flat on the plane, so its
    // rectangle is exact rather than a projection of a rotated quad.
    if (withinRect(p, 0, HOME_CARD_Y, HOME_CARD_WIDTH, HOME_CARD_HEIGHT)) {
      return "center";
    }
    return "";
  }

  public dispose(): void {
    this.live = false;
    this.root.destroy();
  }
}

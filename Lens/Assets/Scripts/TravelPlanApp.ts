/**
 * Entry point, screen flow and the single input router.
 *
 * ALL touch input is bound exactly once here and routed to whichever screen is
 * live. Screens used to bind their own events, which leaked a fresh set of
 * handlers on every rebuild — with a back button that would mean the second
 * visit to a city handled every touch twice.
 */
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

import { ActivityCard, CARD_ROW_Y_EFFECTIVE, CHROME_RAISE } from "./ActivityCard";
import { Activity, CITIES, City, findActivity, getCity } from "./Catalogue";
import { DaySelector } from "./DaySelector";
import { DetailPanel } from "./DetailPanel";
import { DragController, Draggable, MovableBlock } from "./DragController";
import { Fader } from "./Fader";
import { HomeScreen } from "./HomeScreen";
import {
  BAR_HALF,
  CARD_ROW_Y,
  CHROME_Y,
  CLEAR_BTN_H,
  CLEAR_BTN_W,
  CLEAR_BTN_X,
  PLANNER_H,
  PLANNER_W,
  PLANNER_Y,
  RECAP_Y,
  VIEW_DISTANCE,
  Z,
} from "./Layout";
// PlacedBlock.ts is unwritable (see the note at the top of PlacedPill.ts) and is
// now dead code. This is the same class, one folder-permission away from home.
import { PILL_CHROME, PILL_GAP, PILL_LOWER_ROW, PlacedBlock } from "./Pill";
import { refreshCityHours } from "./LiveHours";
import { loadWeek, saveWeek } from "./PlanStore";
import { Recap } from "./Recap";
import { UpdateChip } from "./UpdateChip";
import { screenToPlane, withinRect } from "./ScreenPlane";
import {
  STROKE,
  STROKE_FINE,
  Align,
  BODY,
  BODY_CHIP,
  GLASS,
  INK,
  INK_DIM,
  ORDER_FILL,
  ORDER_STROKE,
  RADIUS,
  TYPE,
  makeGroup,
  makeLabel,
  makeQuad,
  makeRoundedFill,
  makeRoundedOutline,
  makeSurface,
  measureText,
  makePlatedLabel,
  setBodyEmission,
  setShapeColor,
} from "./Theme";
import { TimeBar } from "./TimeBar";
import {
  DayPlan,
  WeekPlan,
  activeDayOf,
  addEntry,
  clearDay,
  dayHasEntry,
  doneCount,
  entryDone,
  plannedMinutes,
  removeEntry,
  setEntryDone,
  setEntryStart,
} from "./WeekPlan";

/** Set to a city id to skip the home screen while iterating. null = ship path. */
const DEV_BOOT_CITY: string = null;
/** Set to a slug to open its detail panel on boot while iterating. null = ship path. */
const DEV_OPEN_DETAIL: string = null;
/** Slugs to pre-place while iterating, as [slug, startHour]. Empty = ship path. */
const DEV_SEED: any[] = [];
/**
 * Wipe the persisted week on boot. false = ship path.
 *
 * Here because stale storage has now cost two passes: DEV_SEED writes a day,
 * the plan persists, and the next run silently resumes into it — so the Lens
 * "boots into a seeded Tokyo day" long after the seed itself has been removed.
 * Turning this on once, running, and turning it off clears the slate.
 */
const DEV_RESET_STORE: boolean = false;

const FADE_OUT = 0.22;
const FADE_IN = 0.28;

/** Flush to the bar's left end, so the chrome row and the day share one margin. */
const BACK_X = -17.2;
const BACK_Y = CHROME_Y + CHROME_RAISE;
const BACK_W = 6.6;
const BACK_H = 2.4;

/**
 * The centre-to-centre distance two neighbouring pills must keep. With variable
 * widths this is no longer a constant, which is the whole reason the sweep in
 * layoutBlocks had to be rewritten.
 */
function gapBetween(a: PlacedBlock, b: PlacedBlock): number {
  return a.width / 2 + PILL_GAP + b.width / 2;
}

/**
 * THE ROW'S NAME SIZE — Pass 21.
 *
 * Solved here rather than in PlacedBlock, and with a LOWER floor than the 0.36
 * that shipped in Pass 20. That floor is what made Tokyo overflow: its six names
 * want 0.33, the clamp held them at 0.36, and the row came out 1.3cm wider than
 * the line, so the last pill hung outside the panel.
 *
 * Pass 20's intended fix was to keep the floor and truncate each name to its
 * share. Shrinking to 0.33 instead turned out to be the better trade once it was
 * on screen: 0.33cm is still larger than the 0.32 floor the activity cards use
 * for their own names, and keeping "Tsukiji Outer Market" whole is worth more
 * than three hundredths of a centimetre of cap height. Nothing in the catalogue
 * needs to be cut to fit six on a row.
 *
 * Below NAME_FLOOR the size stops falling and layoutBlocks compresses instead —
 * see the containment pass there. That only happens past about seven activities.
 */
const NAME_CEIL = 0.46;
const NAME_FLOOR = 0.32;
/** Slack held back from the line, so the row never sits exactly on its limit. */
const ROW_SAFETY = 0.5;

/**
 * PASS 24 — solved by BISECTION, because a pill now has a minimum width.
 *
 * A pill measures `chrome + max(nameWidth, lowerRow)`, and since Pass 24 the
 * lower row carries the time span, which does not shrink with the name. For a
 * short name like "Lunch" the span is the wider of the two, so the pill stops
 * getting narrower — and the old closed-form solve, which assumed total width
 * was linear in the name height, would quietly under-estimate the row and let
 * it overflow. That is exactly the Tokyo bug of Pass 20 wearing a new hat.
 *
 * max() is not linear, so there is no formula. Bisection is exact enough in a
 * dozen iterations, runs once per day change, and cannot be wrong about the
 * thing that matters: whether the row fits.
 */
function solveRowNameHeight(activities: Activity[]): number {
  const n = activities.length;
  if (n === 0) return NAME_CEIL;
  const fixed = n * PILL_CHROME + (n - 1) * PILL_GAP;
  const limit = BAR_HALF * 2 - ROW_SAFETY - fixed;

  const rowAt = (h: number): number => {
    let w = 0;
    for (let i = 0; i < n; i++) {
      w += Math.max(measureText(activities[i].name, h), PILL_LOWER_ROW);
    }
    return w;
  };

  if (rowAt(NAME_CEIL) <= limit) return NAME_CEIL;
  let lo = NAME_FLOOR;
  let hi = NAME_CEIL;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (rowAt(mid) <= limit) lo = mid;
    else hi = mid;
  }
  return lo;
}

@component
export class TravelPlanApp extends BaseScriptComponent {
  private home: HomeScreen = null;
  /**
   * Which city the carousel should open centred on. Session-scoped and
   * deliberately not persisted — see start() for why a relaunch ignores it.
   */
  private homeCenterCityId: string = "";
  private root: SceneObject = null;
  private bar: TimeBar = null;
  private drag: DragController = null;
  private cards: ActivityCard[] = [];
  private blocks: PlacedBlock[] = [];
  private backPressed: boolean = false;
  private detail: DetailPanel = null;
  private closePressed: boolean = false;
  private dayTapConsumed: boolean = false;
  private cardRow: SceneObject = null;
  /** The one container the whole planner lives in. Hidden with everything else. */
  private plannerPanel: SceneObject = null;
  /** Back button + city title. Hidden while the detail panel is modal. */
  private chromeRow: SceneObject = null;
  private currentCityId: string = "";
  private city: City = null;
  private week: WeekPlan = null;
  /** True only while Clear day is ENABLED — it is the button's hit test too. */
  private clearHitVisible: boolean = false;
  private clearRoot: SceneObject = null;
  /** The button's three repaintable layers — see setClearEnabled. */
  private clearBody: SceneObject = null;
  private clearEdge: SceneObject = null;
  private clearLabel: Text = null;
  private clearPressed: boolean = false;
  private chip: UpdateChip = null;
  /** Cities already refreshed this session — switching back must not refetch. */
  private refreshed: { [cityId: string]: boolean } = {};
  private daySelector: DaySelector = null;
  private recap: Recap = null;

  private fader: Fader = null;
  private fadeT: number = 0;
  private fadeDur: number = 0;
  private fadeFrom: number = 1;
  private fadeTo: number = 1;
  private onFadeDone: () => void = null;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.start());
    this.createEvent("UpdateEvent").bind(() => this.update());
    this.createEvent("TouchStartEvent").bind((ev: TouchStartEvent) =>
      this.onTouchStart(ev.getTouchPosition())
    );
    this.createEvent("TouchMoveEvent").bind((ev: TouchMoveEvent) =>
      this.onTouchMove(ev.getTouchPosition())
    );
    this.createEvent("TouchEndEvent").bind((ev: TouchEndEvent) =>
      this.onTouchEnd(ev.getTouchPosition())
    );
  }

  private start(): void {
    this.assertViewDistance();
    // One agenda for the whole trip, restored before any screen is built.
    this.week = loadWeek();

    if (DEV_RESET_STORE) {
      for (let i = 0; i < this.week.days.length; i++) clearDay(this.week.days[i]);
      this.week.activeDay = 0;
      saveWeek(this.week);
      print("[P21] persisted week cleared");
    }

    if (DEV_BOOT_CITY) {
      const city = getCity(DEV_BOOT_CITY);
      if (!city) {
        print("[P6] FATAL: unknown DEV_BOOT_CITY '" + DEV_BOOT_CITY + "'");
        return;
      }
      print("[P6] dev boot — skipping home screen, loading " + city.name);
      this.buildPlanner(city);
      return;
    }
    /**
     * PASS 29 — EVERY LAUNCH STARTS ON THE HOME SCREEN.
     *
     * Pass 9 put a resume here: a returning user was dropped straight back into
     * whichever city they last opened. It is deleted, and the reasoning is that
     * this is simply how applications behave — reopening one puts you on its
     * front door, not back inside the thing you were last reading. The title,
     * the subtitle and the five cities ARE this Lens's identity, and skipping
     * them meant most launches never showed it.
     *
     * WHAT IS NOT LOST, because this is the part worth being precise about: the
     * WEEK still persists in full. Every placed activity, its hour and its done
     * state are restored above by loadWeek, on every day. Enter a city and the
     * plan is exactly where it was. The only thing that goes is the auto-entry.
     *
     * `week.lastCityId` went with it — this was its only reader, so keeping a
     * persisted field nothing consumes would just be a trap for the next pass.
     * The carousel's memory is unaffected and deliberately separate: it lives in
     * the session field `homeCenterCityId`, so pressing "Cities" from Tokyo
     * still comes back to Tokyo, while a fresh launch still centres Paris.
     */
    this.showHome();
  }

  /**
   * Every type size and hit target in this Lens is calibrated for a plane
   * VIEW_DISTANCE in front of the eye. On the glasses that holds by construction
   * — the camera is at the origin. In Lens Studio's Interactive preview it does
   * NOT: the simulated head stands somewhere in the virtual room, and reviewing
   * the composition from there is what produced the phantom "1.62m" of Pass 3
   * and every "readable but not comfortable" note since.
   *
   * So this prints the real distance on every boot. If it is not ~75cm, move the
   * preview camera to the origin before judging anything visual.
   */
  private assertViewDistance(): void {
    const cam = WorldCameraFinderProvider.getInstance();
    const p = cam.getTransform().getWorldPosition();
    const actual = p.z - Z;
    if (Math.abs(actual - VIEW_DISTANCE) > 5.0) {
      print(
        "[P11] preview camera is at z=" +
          p.z.toFixed(1) +
          ", so the board is being viewed from " +
          actual.toFixed(0) +
          "cm, not the " +
          VIEW_DISTANCE +
          "cm it is designed for. On device the camera is at the origin and this" +
          " is exact — move the preview camera to (0,0,0) before judging scale."
      );
    }
  }

  // ---------- input routing ----------

  private onTouchStart(pos: vec2): void {
    if (this.home) {
      this.home.onTouchStart(pos);
      return;
    }
    if (!this.root) return;
    if (this.detail) {
      const dp = screenToPlane(pos, Z);
      this.closePressed = dp !== null && this.detail.containsClose(dp);
      return;
    }
    const pt = screenToPlane(pos, Z);
    if (pt && withinRect(pt, BACK_X, BACK_Y, BACK_W, BACK_H)) {
      this.backPressed = true;
      return;
    }
    // While the strip is open it owns every touch, so choosing a day can never
    // also grab a card or a block behind it.
    if (this.daySelector) {
      const dsp = screenToPlane(pos, Z);
      const wasExpanded = this.daySelector.isExpanded;
      if (dsp && this.daySelector.handleTap(dsp)) {
        this.dayTapConsumed = true;
        return;
      }
      if (wasExpanded) {
        this.dayTapConsumed = true;
        return;
      }
    }
    if (this.clearHitVisible) {
      const cp = screenToPlane(pos, Z);
      if (cp && withinRect(cp, CLEAR_BTN_X, RECAP_Y, CLEAR_BTN_W, CLEAR_BTN_H)) {
        this.clearPressed = true;
        this.dayTapConsumed = false;
        return;
      }
    }
    this.clearPressed = false;
    this.dayTapConsumed = false;
    this.backPressed = false;
    this.drag.onTouchStart(pos);
  }

  private onTouchMove(pos: vec2): void {
    if (this.home || !this.root || this.detail || this.dayTapConsumed) return;
    this.drag.onTouchMove(pos);
  }

  private onTouchEnd(pos: vec2): void {
    if (this.home) {
      this.home.onTouchEnd(pos);
      return;
    }
    if (!this.root) return;
    if (this.detail) {
      // Either end of the gesture landing on the × closes it. Requiring both is
      // needlessly brittle for a 3.6cm target, and the pointer position sampled
      // at press can lag behind where the user actually is.
      const dp2 = screenToPlane(pos, Z);
      const onClose = dp2 !== null && this.detail.containsClose(dp2);
      if (this.closePressed || onClose) this.closeDetail();
      this.closePressed = false;
      return;
    }
    if (this.dayTapConsumed) {
      this.dayTapConsumed = false;
      return;
    }
    const cp2 = screenToPlane(pos, Z);
    const onClear =
      this.clearHitVisible &&
      cp2 !== null &&
      withinRect(cp2, CLEAR_BTN_X, RECAP_Y, CLEAR_BTN_W, CLEAR_BTN_H);
    if (this.clearPressed || onClear) {
      this.clearPressed = false;
      this.clearActiveDay();
      return;
    }
    const bp = screenToPlane(pos, Z);
    const onBack = bp !== null && withinRect(bp, BACK_X, BACK_Y, BACK_W, BACK_H);
    const wasPressed = this.backPressed;
    this.backPressed = false;
    if (wasPressed || onBack) {
      this.goHome();
      return;
    }
    this.drag.onTouchEnd();
  }

  private update(): void {
    if (this.chip) this.chip.step(getDeltaTime());
    if (this.drag) this.drag.step();
    // The carousel's glide. HomeScreen owns no events of its own, deliberately:
    // it is built and destroyed by this class, and a script component that
    // outlived its screen is exactly the kind of thing that fires once into a
    // disposed object. Ticked from here, it cannot.
    if (this.home) this.home.step(getDeltaTime());
    this.stepFade();
  }

  // ---------- screens ----------

  /**
   * PASS 25 — THE CAROUSEL REMEMBERS, and it took a filesystem to allow it.
   *
   * The ask, unchanged since Pass 23: leaving Tokyo and pressing "Cities" should
   * centre Tokyo, not Paris. The clean fix was always one constructor argument,
   * because HomeScreen already holds the centred slot in a private index — and
   * it was refused for two passes only because HomeScreen.ts could not be
   * written to (see the note at the top of Pill.ts for what that was). Pass 25
   * re-tested every file this pass needed and found all of them writable again,
   * so the workaround below is gone and the argument is in.
   *
   * KEEP THE WORKAROUND'S EPITAPH, because it is a real trap. The route Pass 23
   * took was to stop throwing the screen away: only the CENTRE card is
   * selectable, so the city you entered IS the centred one, and retaining the
   * instance restores the right card with no state to track. It half worked, and
   * then failed in a way no screenshot could show — HomeScreen sets a private
   * `live` flag false when a city is chosen, to stop a second selection landing
   * during the fade. Reused, the screen renders perfectly and accepts nothing.
   * No arrow, no selection, no way out. Do not reach for instance reuse here.
   *
   * So the screen is still disposed and rebuilt, and it is now told where to
   * start. `homeCenterCityId` is a plain SESSION field and is never persisted:
   * centring the carousel from storage would mean a fresh launch opening on
   * wherever you were yesterday, which is precisely what Pass 29 removed. Empty
   * on the first showHome of a session, so the first thing anyone ever sees is
   * Paris — and still Tokyo if you pressed "Cities" from Tokyo a moment ago.
   *
   * The other thing kept from Pass 23 is the Fader: it is constructed once per
   * screen while that screen is still fully opaque. A Fader captures each
   * material's opacity at construction and treats it as full, so building a
   * second one on an already-faded screen captured zero as full.
   */
  private showHome(): void {
    this.home = new HomeScreen(
      (city) => this.onCityChosen(city),
      this.homeCenterCityId
    );
    print(
      "[P25] home screen ready — centred on " +
        (this.homeCenterCityId || CITIES[0].id)
    );
  }

  private onCityChosen(city: City): void {
    // The Fader is built HERE, not when the screen is, and that is load-bearing:
    // it caches the objects it will drive at construction, and rotate() destroys
    // and rebuilds every card. A Fader made before an arrow press is left
    // holding dead objects and throws the moment it is used. Pass 23 hoisted
    // this for tidiness and crashed the first selection after any rotation.
    const out = new Fader(this.home.root);
    this.startFade(out, 1, 0, FADE_OUT, () => {
      this.home.dispose();
      this.home = null;
      this.buildPlanner(city);
      this.startFade(new Fader(this.root), 0, 1, FADE_IN, null);
    });
  }

  /** Tear the city down completely — a new city must never inherit old blocks. */
  private goHome(): void {
    print("[P6] back — returning to city selection");
    const out = new Fader(this.root);
    this.startFade(out, 1, 0, FADE_OUT, () => {
      this.disposeCards();
      this.chip = null;
      this.detail = null;
      this.cardRow = null;
      this.plannerPanel = null;
      this.clearRoot = null;
      this.clearBody = null;
      this.clearEdge = null;
      this.clearLabel = null;
      this.clearHitVisible = false;
      this.daySelector = null;
      this.recap = null;
      this.root.destroy();
      this.root = null;
      this.bar = null;
      this.drag = null;
      this.cards = [];
      this.blocks = [];
      this.showHome();
      this.startFade(new Fader(this.home.root), 0, 1, FADE_IN, null);
    });
  }

  /**
   * THE CONTAINER.
   *
   * One rounded panel holding the whole day: the controls across its top, the
   * pills below them, and the hour line under those. It is built FIRST so it
   * draws behind everything it holds, and it is given an explicit low render
   * order for the same reason — the pills' own bodies sit at ORDER_SCRIM, and
   * two surfaces at the same order on a display with no depth test resolve by
   * submission order, which is not something to leave to chance.
   *
   * It is 41cm, the same width as the six-card row above it, so the planner and
   * the palette share one pair of edges.
   */
  private buildPlannerPanel(): void {
    this.plannerPanel = makeGroup(this.root, "PlannerPanel", 0, PLANNER_Y, Z);
    makeSurface(this.plannerPanel, "surface", PLANNER_W, PLANNER_H, {
      body: BODY,
      edge: 0.55,
      edgeWidth: STROKE_FINE,
      radius: RADIUS,
      order: 2,
    });
  }

  /**
   * "Clear day" — PASS 33: always built, in one of two states.
   *
   * It used to be built only when the day already had something on it, and only
   * at city load: place the first activity of a session and the button did not
   * appear until a reload or a day switch, because refreshDay never rebuilt it.
   * Making it appear on placement would have fixed the staleness and introduced
   * a worse problem — the container's top row jumping as a third button pops in
   * and out beside the recap.
   *
   * So it is permanent geometry now, dimmed when there is nothing to clear. That
   * is the same language the row of cards already speaks: a placed activity is
   * dimmed in place rather than removed from the row. setClearEnabled owns which
   * of the two states it is in, and refreshDay calls it after every change.
   */
  private buildClearButton(): void {
    if (this.clearRoot) {
      this.clearRoot.destroy();
      this.clearRoot = null;
    }

    const b = makeGroup(this.root, "ClearDay", CLEAR_BTN_X, RECAP_Y, Z);
    this.clearRoot = b;
    const surface = makeSurface(b, "surface", CLEAR_BTN_W, CLEAR_BTN_H, {
      body: BODY_CHIP,
      edge: 0.45,
      edgeWidth: STROKE,
      radius: RADIUS,
    });
    // makeSurface stacks body then edge, and this call asks for no bloom.
    this.clearBody = surface.getChild(0);
    this.clearEdge = surface.getChild(1);
    this.clearLabel = makeLabel(
      b,
      "label",
      "Clear day",
      TYPE.label,
      new vec4(INK_DIM.r, INK_DIM.g, INK_DIM.b, 1),
      Align.Center,
      0,
      0,
      0.02
    );
    this.setClearEnabled(this.day.entries.length > 0);
  }

  /**
   * Light the button up or put it to sleep, in place.
   *
   * Repainted through the Pass 25 helpers rather than a Fader: a Fader writes
   * per-visual overrides that this runtime cannot clear, so a button toggled a
   * dozen times across a day switch would eventually be wearing a stale override
   * from whichever state happened to be showing when the last screen fade ended.
   * setBodyEmission and setShapeColor write the material AND the override
   * together, so the two can never fall out of step however often this runs.
   *
   * Every value here is a constant, so the material cache holds exactly two
   * entries per layer no matter how many times the day fills and empties.
   *
   * clearHitVisible is set from the same call, which is what makes "dimmed" and
   * "not tappable" one fact rather than two that can disagree.
   */
  private setClearEnabled(on: boolean): void {
    this.clearHitVisible = on;
    if (!this.clearRoot) return;
    // 0.45 is the same fraction a placed card is dimmed by — see ActivityCard.
    if (this.clearBody) {
      setBodyEmission(this.clearBody, on ? BODY_CHIP : BODY_CHIP * 0.45);
    }
    if (this.clearEdge) {
      setShapeColor(
        this.clearEdge,
        new vec4(GLASS.r, GLASS.g, GLASS.b, on ? 0.45 : 0.2),
        true
      );
    }
    if (this.clearLabel) {
      this.clearLabel.textFill.color = new vec4(
        INK_DIM.r,
        INK_DIM.g,
        INK_DIM.b,
        on ? 1 : 0.45
      );
    }
  }

  private clearActiveDay(): void {
    const day = this.day;
    if (day.entries.length === 0) return;
    print("[P9] cleared " + day.label + " — " + day.entries.length + " removed");
    clearDay(day);
    this.refreshDay();
    saveWeek(this.week);
  }

  /**
   * Fired AFTER the planner is built and interactive. Nothing waits on it: the
   * Lens is already fully usable on catalogue data by the time this starts.
   */
  private startLiveRefresh(city: City): void {
    if (this.refreshed[city.id]) return;
    this.refreshed[city.id] = true;
    if (this.chip) this.chip.showFetching();

    refreshCityHours(this, city).then((result) => {
      // The planner may have been torn down while the call was in flight.
      if (!this.root || this.currentCityId !== city.id) return;
      if (result.ok) {
        print(
          "[P10] live hours applied for " +
            city.name +
            " — " +
            result.changed +
            " changed (" +
            result.reason +
            ")"
        );
        for (let i = 0; i < this.cards.length; i++) {
          this.cards[i].refreshFromCatalogue();
        }
      } else {
        print("[P10] live refresh skipped (" + result.reason + ") — keeping catalogue");
      }
      if (this.chip) this.chip.resolve(result.ok, result.changed);
    });
  }

  // ---------- the week ----------

  private get day(): DayPlan {
    return activeDayOf(this.week);
  }

  private switchDay(index: number): void {
    if (index === this.week.activeDay) {
      this.daySelector.rebuild();
      return;
    }
    this.week.activeDay = index;
    print("[P8] switched to " + this.day.label);
    this.refreshDay();
    saveWeek(this.week);
  }

  /**
   * Rebuild everything that is per-day: the blocks on the bar, which cards are
   * dimmed, the recap and the strip. Blocks are views over entries, so this is
   * a straight teardown and rebuild — nothing can bleed between days.
   */
  private refreshDay(): void {
    for (let i = 0; i < this.blocks.length; i++) this.blocks[i].dispose();
    this.blocks = [];

    // The day's pills share one name size, so it has to be solved BEFORE any of
    // them is built — a pill's width comes from its name, and the row only fits
    // if they all agree. Cross-city days are included by construction: the
    // entries carry their own cityId and this walks all of them.
    const day = this.day;
    const present: Activity[] = [];
    for (let i = 0; i < day.entries.length; i++) {
      const a = findActivity(day.entries[i].cityId, day.entries[i].slug);
      if (a) present.push(a);
    }
    const nameHeight = solveRowNameHeight(present);

    for (let i = 0; i < day.entries.length; i++) {
      const entry = day.entries[i];
      const activity = findActivity(entry.cityId, entry.slug);
      if (!activity) continue;
      this.blocks.push(
        new PlacedBlock(
          this.bar.root,
          activity,
          entry.startHour,
          entry.cityId,
          nameHeight,
          // The record is the truth: a pill is a view, and this is the whole
          // reason done lives in the WeekPlan. Every path that lands here —
          // a day switch, a placement, a removal, a restore from storage —
          // gets its ticks back for free.
          entry.done === true
        )
      );
    }

    // Dimming is per city: an activity placed from Paris does not grey out a
    // London card, and vice versa.
    for (let i = 0; i < this.cards.length; i++) {
      const card = this.cards[i];
      card.setDimmed(dayHasEntry(day, this.currentCityId, card.activity.slug));
    }

    this.layoutBlocks();
    if (this.daySelector) this.daySelector.rebuild();
    this.updateRecap();
    // PASS 33: every path that changes what the day holds ends up here — a
    // placement, a removal, Clear day itself, a day switch, a restore from
    // storage — so this is the one place the button's state has to be decided.
    this.setClearEnabled(this.day.entries.length > 0);
  }



  /**
   * THE PILL LAYOUT PASS — one row, variable widths.
   *
   * A left-to-right sweep pushes any pill that would overlap its predecessor,
   * then a right-to-left sweep pulls the row back inside the line if the forward
   * pass ran it off the end, then one more forward pass repairs any overlap the
   * back-pass introduced at the left edge. Three passes rather than two, because
   * with VARIABLE widths the back-pass can now push a pill left into its own
   * neighbour, which could not happen when every pill was the same size.
   *
   * It cannot fail to fit: solveNameHeight has already sized the names so the
   * whole row measures no wider than the line.
   *
   * The DOT is unaffected — it stays at the activity's real hour, which is how
   * the line keeps telling the truth about time even when a pill has been nudged
   * aside to stay readable.
   *
   * Must run after ANY change to the day. A pill cannot do this itself: it is the
   * one piece of layout in the Lens that depends on what its neighbours are doing.
   */
  private layoutBlocks(): void {
    const sorted = this.blocks.slice().sort((a, b) => a.startHour - b.startHour);
    const n = sorted.length;
    if (n === 0) return;

    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      let x = sorted[i].wantsX;
      if (i > 0) x = Math.max(x, xs[i - 1] + gapBetween(sorted[i - 1], sorted[i]));
      xs.push(x);
    }

    xs[n - 1] = Math.min(xs[n - 1], BAR_HALF - sorted[n - 1].width / 2);
    for (let i = n - 2; i >= 0; i--) {
      xs[i] = Math.min(xs[i], xs[i + 1] - gapBetween(sorted[i], sorted[i + 1]));
    }

    xs[0] = Math.max(xs[0], -BAR_HALF + sorted[0].width / 2);
    for (let i = 1; i < n; i++) {
      xs[i] = Math.max(xs[i], xs[i - 1] + gapBetween(sorted[i - 1], sorted[i]));
    }

    // CONTAINMENT. The three sweeps above assume the row fits, which is true up
    // to about seven activities and then stops being true — solveRowNameHeight
    // bottoms out at NAME_FLOOR and stops buying width. Past that point the
    // forward pass would walk the last pill straight out of the panel, which is
    // exactly the defect this pass was opened to fix, so the row is compressed
    // to the line instead: pills space evenly and start to touch. Crowded is a
    // fair way to show an overfull day; spilling outside the container is not.
    const last = xs[n - 1] + sorted[n - 1].width / 2;
    if (last > BAR_HALF && n > 1) {
      const first = -BAR_HALF + sorted[0].width / 2;
      const span = BAR_HALF - sorted[n - 1].width / 2 - first;
      for (let i = 0; i < n; i++) xs[i] = first + (span * i) / (n - 1);
    }

    for (let i = 0; i < n; i++) sorted[i].placeAt(xs[i]);
  }

  private cardFor(slug: string): ActivityCard {
    for (let i = 0; i < this.cards.length; i++) {
      if (this.cards[i].activity.slug === slug) return this.cards[i];
    }
    return null;
  }

  private updateRecap(): void {
    if (!this.recap) return;
    const day = this.day;
    const minutes = plannedMinutes(day, (cityId, slug) => {
      const a = findActivity(cityId, slug);
      return a ? a.durationMin : 0;
    });
    this.recap.set(day.entries.length, minutes, doneCount(day));
  }

  /**
   * TAP ON A PLACED PILL = TOGGLE DONE — Pass 26.
   *
   * This replaced "open the detail panel", which now belongs only to the cards
   * in the row above: the detail is about CHOOSING an activity, and once one is
   * on the line the question has changed to whether you have done it yet.
   *
   * WHAT THIS DELIBERATELY DOES NOT TOUCH. Tap-versus-drag on a pill is the most
   * fragile thing in this project — Passes 7, 21 and 22 were all spent on it —
   * and none of it is changed here. DragController already resolved a press on a
   * pill into exactly one of three outcomes before this pass existed: under
   * TAP_MAX_TRAVEL it is a tap, off the bar it is a remove, otherwise it is a
   * move. This is a new BODY for the tap branch, not a new branch and not a new
   * threshold, so a toggle can only ever fire where the detail panel used to
   * open — which is to say, on a gesture the controller had already decided was
   * not a drag.
   *
   * The pill is found by cityId + slug rather than by object identity, which is
   * the same key removeEntry and setEntryStart use, so the lookup cannot
   * disagree with the record it is about to write.
   */
  private toggleDone(block: MovableBlock): void {
    const next = !entryDone(this.day, block.cityId, block.slug);
    setEntryDone(this.day, block.cityId, block.slug, next);

    for (let i = 0; i < this.blocks.length; i++) {
      const pill = this.blocks[i];
      if (pill.cityId === block.cityId && pill.slug === block.slug) {
        pill.setDone(next);
      }
    }

    // The row is NOT rebuilt. Nothing about the day's geometry changed — same
    // entries, same hours, same solved name size — so rebuilding would only
    // throw away five pills to draw them again identically, and would do it on
    // every tap.
    this.updateRecap();
    saveWeek(this.week);
    print("[P25] " + block.activity.name + (next ? " — done" : " — not done"));
  }

  private onBlockMoved(block: MovableBlock, startHour: number): void {
    setEntryStart(this.day, block.cityId, block.slug, startHour);
    this.layoutBlocks();
    if (this.daySelector) this.daySelector.rebuild();
    saveWeek(this.week);
  }

  private onBlockRemoved(block: MovableBlock): void {
    removeEntry(this.day, block.cityId, block.slug);
    print("[P8] " + block.activity.name + " returned to the panel");
    // Removing one changes the row's solved name size too — see placeCard.
    this.refreshDay();
    saveWeek(this.week);
  }

  private openDetailFor(activity: Activity): void {
    if (this.detail) return;
    this.setModal(true);
    this.detail = new DetailPanel(this.root, activity, this.currentCityId);
    print("[P7] detail opened — " + activity.name);
  }

  // ---------- detail ----------

  private openDetail(card: Draggable): void {
    if (this.detail) return;
    // Nothing else on screen: the cards are hidden, so nothing can be grabbed.
    this.setModal(true);
    this.detail = new DetailPanel(this.root, card.activity, this.currentCityId);
    print("[P7] detail opened — " + card.activity.name);
  }

  private closeDetail(): void {
    if (!this.detail) return;
    const name = this.detail.activity.name;
    this.detail.dispose();
    this.detail = null;
    this.setModal(false);
    print("[P7] detail closed — " + name);
  }

  /**
   * The detail panel OWNS THE SCREEN.
   *
   * Not "is on top of" — owns. Pass 16: the panel is a full-width frame in the
   * planner's own composition space, so anything still drawing behind it is two
   * designs occupying one rectangle. Hiding half of them was the bug: the line,
   * its hour labels, the pills placed on it and the recap all carried on
   * underneath, which is exactly the collision the reference has no answer to
   * because a reference never has a planner behind it.
   *
   * So this hides EVERYTHING the planner draws, and it is the whole list —
   * buildPlanner creates nothing else. The blocks need no separate handling:
   * they are children of the bar, so they go with it. Closing restores the same
   * objects untouched, which is why the day, the plan and the scroll of the week
   * survive a visit to the panel without any of it being saved and replayed.
   */
  private setModal(on: boolean): void {
    if (this.cardRow) this.cardRow.enabled = !on;
    if (this.chromeRow) this.chromeRow.enabled = !on;
    if (this.chip) this.chip.setHidden(on);
    if (this.daySelector) this.daySelector.root.enabled = !on;
    if (this.clearRoot) this.clearRoot.enabled = !on;
    // The line, its ticks, its hour labels and every pill standing on it.
    if (this.bar) this.bar.root.enabled = !on;
    if (this.recap) this.recap.root.enabled = !on;
    if (this.plannerPanel) this.plannerPanel.enabled = !on;
  }

  /** Cards must release their SIK components before their objects are destroyed. */
  private disposeCards(): void {
    for (let i = 0; i < this.cards.length; i++) this.cards[i].dispose();
    this.cards = [];
  }

  // ---------- planner ----------

  private buildPlanner(city: City): void {
    this.currentCityId = city.id;
    this.city = city;
    /**
     * Remembered for the next showHome, so "Cities" comes back to the city you
     * were in. Set HERE rather than in onCityChosen because this is the one
     * funnel every entry into a city passes through — a tap on the carousel and
     * DEV_BOOT_CITY both land here. Session-scoped and never persisted, which is
     * what lets a relaunch open on Paris while "Cities" still remembers Tokyo.
     */
    this.homeCenterCityId = city.id;
    saveWeek(this.week);
    this.root = makeGroup(null, "TravelPlan", 0, 0, 0);
    this.buildPlannerPanel();
    this.bar = new TimeBar(this.root);
    this.drag = new DragController(
      this.bar.root,
      () => this.blocks,
      (card, startHour) => this.placeCard(card, startHour)
    );
    this.buildCardRow(city);
    this.drag.setCards(this.cards);
    this.drag.setTapHandler((card) => this.openDetail(card));
    this.drag.setBlockHandlers(
      () => this.blocks as MovableBlock[],
      (block, startHour) => this.onBlockMoved(block, startHour),
      (block) => this.onBlockRemoved(block),
      // Pass 26: a tap on a PLACED pill ticks it off. Tapping a CARD in the row
      // above still opens the detail panel — see setTapHandler, unchanged.
      (block) => this.toggleDone(block)
    );
    this.buildBackButton(city);
    this.recap = new Recap(this.root);
    this.daySelector = new DaySelector(
      this.root,
      this.week,
      city.color,
      (index) => this.switchDay(index)
    );
    this.buildClearButton();
    this.chip = new UpdateChip(this.root);
    // The chip is the third thing on the chrome row and takes its Y from Layout,
    // which is not writable; nudged here so the row stays one line.
    const cp = this.chip.root.getTransform().getLocalPosition();
    this.chip.root
      .getTransform()
      .setLocalPosition(new vec3(cp.x, cp.y + CHROME_RAISE, cp.z));
    if (DEV_SEED.length > 0) {
      // Clear first: the old guard only seeded an EMPTY day, so a stale
      // persisted plan silently won and the seed you just wrote never ran.
      clearDay(this.day);
      for (let i = 0; i < DEV_SEED.length; i++) {
        addEntry(this.day, city.id, DEV_SEED[i][0], DEV_SEED[i][1]);
      }
    }
    this.refreshDay();
    this.startLiveRefresh(city);
    print("[P6] " + city.name + " loaded — " + this.cards.length + " activities");
    if (DEV_OPEN_DETAIL) {
      const a = findActivity(city.id, DEV_OPEN_DETAIL);
      if (a) this.openDetailFor(a);
    }
  }

  /**
   * The row is now an arc, so a card is placed by its SLOT rather than by an x
   * in centimetres — the card owns the curve, because it is the card that has to
   * project its own hit rectangle back onto the composition plane.
   */
  private buildCardRow(city: City): void {
    const row = makeGroup(this.root, "ActivityPanel", 0, CARD_ROW_Y_EFFECTIVE, Z);
    this.cardRow = row;
    const n = city.activities.length;
    const startOffset = -(n - 1) / 2;
    for (let i = 0; i < n; i++) {
      const card = new ActivityCard(
        row,
        city.activities[i],
        startOffset + i,
        city.id
      );
      card.makeDraggable(this.drag);
      this.cards.push(card);
    }
  }

  /** Discreet: a chevron and a word, in dim ink. It must not compete with the day. */
  private buildBackButton(city: City): void {
    const b = makeGroup(this.root, "BackButton", BACK_X, BACK_Y, Z);
    this.chromeRow = b;
    makeSurface(b, "surface", BACK_W, BACK_H, {
      body: BODY_CHIP,
      edge: 0.45,
      edgeWidth: STROKE,
      radius: RADIUS,
    });
    makeLabel(
      b,
      "label",
      "‹  Cities",
      TYPE.label,
      new vec4(INK_DIM.r, INK_DIM.g, INK_DIM.b, 1),
      Align.Center,
      0,
      0,
      0.02
    );
    // The city name is the screen's title and sits centred on the chrome row —
    // it lives on the back button's group only because that group is already at
    // the right height, so it is pushed back to world x = 0.
    makePlatedLabel(b, "city", city.name, TYPE.title, INK, -BACK_X, 0, 0.02, BODY_CHIP);
  }

  private placeCard(card: Draggable, startHour: number): void {
    addEntry(this.day, this.currentCityId, card.activity.slug, startHour);
    // A full rebuild rather than one more pill: adding an activity changes the
    // name size the whole row is solved against, so every pill has to be remade
    // at the new size. refreshDay already does exactly that, plus the dimming.
    this.refreshDay();
    saveWeek(this.week);
    print(
      "[P8] " +
        card.activity.name +
        " placed on " +
        this.day.label +
        " — " +
        this.day.entries.length +
        " that day"
    );
  }

  // ---------- fade ----------

  private startFade(
    fader: Fader,
    from: number,
    to: number,
    duration: number,
    done: () => void
  ): void {
    this.fader = fader;
    this.fadeFrom = from;
    this.fadeTo = to;
    this.fadeDur = duration;
    this.fadeT = 0;
    this.onFadeDone = done;
    fader.setOpacity(from);
  }

  private stepFade(): void {
    if (!this.fader) return;
    this.fadeT += getDeltaTime() / this.fadeDur;
    const k = this.fadeT >= 1 ? 1 : this.fadeT;
    this.fader.setOpacity(this.fadeFrom + (this.fadeTo - this.fadeFrom) * k);
    if (this.fadeT >= 1) {
      this.fader = null;
      const cb = this.onFadeDone;
      this.onFadeDone = null;
      if (cb) cb();
    }
  }
}

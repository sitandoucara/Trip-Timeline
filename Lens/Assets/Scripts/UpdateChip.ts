/**
 * The one visible sign that the live refresh exists.
 *
 * "updating…" while the grounded call is in flight, then it resolves and fades
 * away. It never blocks anything and never reports failure — a user who is
 * offline should see a Lens that simply works, not an apology.
 */
import { Fader } from "./Fader";
import { CHIP_X, CHIP_Y, Z } from "./Layout";
import {
  STROKE,
  BODY_CHIP,
  Align,
  GLASS,
  INK,
  INK_DIM,
  ORDER_FILL,
  ORDER_STROKE,
  RADIUS,
  TYPE,
  makeGroup,
  makeLabel,
  makeRoundedFill,
  makeRoundedOutline,
  makeSurface,
} from "./Theme";

const CHIP_W = 10.0;
const CHIP_H = 2.1;
const HOLD = 4.5;
const FADE = 0.8;

export class UpdateChip {
  public readonly root: SceneObject;
  private label: Text;
  private fader: Fader;
  private age: number = 0;
  private fading: boolean = false;
  /** The chip has something to say. */
  private live: boolean = false;
  /** Something modal is covering its corner. */
  private hidden: boolean = false;

  constructor(parent: SceneObject) {
    this.root = makeGroup(parent, "UpdateChip", CHIP_X, CHIP_Y, Z);
    makeSurface(this.root, "surface", CHIP_W, CHIP_H, {
      body: BODY_CHIP,
      edge: 0.45,
      edgeWidth: STROKE,
      radius: RADIUS,
    });
    this.label = makeLabel(
      this.root,
      "text",
      "updating…",
      TYPE.micro,
      new vec4(INK_DIM.r, INK_DIM.g, INK_DIM.b, 1),
      Align.Center,
      0,
      0,
      0.02
    );
    this.fader = new Fader(this.root);
    this.root.enabled = false;
  }

  /**
   * Two independent reasons to be invisible: the chip has nothing to say, or
   * something modal is covering its corner. Kept apart so dismissing a detail
   * panel cannot resurrect a chip that had already finished and faded.
   */
  private apply(): void {
    this.root.enabled = this.live && !this.hidden;
  }

  /** Called by the app while the detail panel owns the screen. */
  public setHidden(hidden: boolean): void {
    this.hidden = hidden;
    this.apply();
  }

  public showFetching(): void {
    this.label.text = "updating…";
    this.label.textFill.color = new vec4(INK_DIM.r, INK_DIM.g, INK_DIM.b, 1);
    this.age = 0;
    this.fading = false;
    this.live = true;
    this.apply();
    this.fader.setOpacity(1);
  }

  /** Success gets a brief, quiet confirmation. Failure just disappears. */
  public resolve(ok: boolean, changed: number): void {
    if (!ok) {
      this.beginFade();
      return;
    }
    this.label.text =
      changed > 0
        ? "hours updated · live sources"
        : "hours confirmed · live sources";
    this.label.textFill.color = new vec4(INK.r, INK.g, INK.b, 0.95);
    this.age = 0;
    this.fading = true;
  }

  private beginFade(): void {
    this.age = HOLD;
    this.fading = true;
  }

  public step(dt: number): void {
    if (!this.fading || !this.live) return;
    this.age += dt;
    if (this.age <= HOLD) return;
    const k = (this.age - HOLD) / FADE;
    if (k >= 1) {
      this.live = false;
      this.apply();
      this.fading = false;
      return;
    }
    this.fader.setOpacity(1 - k);
  }

  public dispose(): void {
    this.root.destroy();
  }
}

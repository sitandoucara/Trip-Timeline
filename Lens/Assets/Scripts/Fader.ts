/**
 * Fades a whole subtree without touching shared materials.
 *
 * Theme caches one material per (colour, blend) pair, so writing alpha on a
 * material would fade every other object using that colour too. mainPassOverrides
 * applies per-visual instead, which is exactly what a transition needs.
 */
export class Fader {
  private visuals: { visual: MaterialMeshVisual; base: vec4 }[] = [];
  private texts: { text: Text; base: vec4 }[] = [];

  constructor(root: SceneObject) {
    this.collect(root);
  }

  private collect(obj: SceneObject): void {
    const visual = obj.getComponent("Component.RenderMeshVisual");
    if (visual) {
      const c = visual.mainPass.baseColor;
      this.visuals.push({
        visual: visual,
        base: new vec4(c.r, c.g, c.b, c.a),
      });
    }
    const text = obj.getComponent("Component.Text");
    if (text) {
      const c = text.textFill.color;
      this.texts.push({ text: text, base: new vec4(c.r, c.g, c.b, c.a) });
    }
    const n = obj.getChildrenCount();
    for (let i = 0; i < n; i++) this.collect(obj.getChild(i));
  }

  /** k = 1 is fully present, k = 0 fully gone. */
  public setOpacity(k: number): void {
    for (let i = 0; i < this.visuals.length; i++) {
      const v = this.visuals[i];
      v.visual.mainPassOverrides.baseColor = new vec4(
        v.base.r,
        v.base.g,
        v.base.b,
        v.base.a * k
      );
    }
    for (let i = 0; i < this.texts.length; i++) {
      const t = this.texts[i];
      t.text.textFill.color = new vec4(t.base.r, t.base.g, t.base.b, t.base.a * k);
    }
  }

  public get count(): number {
    return this.visuals.length + this.texts.length;
  }
}

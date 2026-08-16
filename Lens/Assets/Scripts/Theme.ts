/**
 * Art direction, expressed as code.
 *
 * ---------------------------------------------------------------------------
 * PASS 17 — THE COMPOSITING QUESTION, SETTLED BY EXPERIMENT.
 *
 * Three passes carried a warning that the detail panel's scrim "does not
 * render" and that photographs "composite at roughly half strength", and five
 * files carried a workaround that drew every backing and every photograph three
 * to six times over. An isolated probe — one quad, one variable at a time —
 * settled all of it, and two of the three beliefs were wrong.
 *
 *   1. THE WORLD IS ADDED AFTER THE LENS HAS FINISHED DRAWING.
 *      BlendMode.Disabled performs no blending at all and writes the source
 *      colour straight into the target. It STILL let the street show through.
 *      Black was invisible under Multiply, Min, ColoredGlass, AlphaTest and
 *      Screen alike. So nothing inside the Lens can subtract light, no material
 *      setting was ever going to fix it, and the scrim was never broken — a
 *      near-black plate emits nothing, which is exactly what it was asked for.
 *
 *   2. STACKING WAS A NO-OP, NOT A HALF-FIX.
 *      Six coplanar passes are pixel-identical to one. BlendMode.Normal at
 *      source alpha 1 REPLACES the target, so pass six overwrote pass one and
 *      the extra draws bought nothing whatsoever. The "half strength" that
 *      motivated them was the world being added on top, not the image being
 *      drawn weakly. All of it is deleted.
 *
 *   3. BRIGHTNESS IS THE ONE REAL LEVER, AND IT WORKS.
 *      `baseColor` does reach the pixel — a red tint tints, a gain of 8 blows
 *      out. A photograph stops letting the background through once it out-emits
 *      it — see PHOTO_LIFT below for the shape that actually does it.
 *
 * WHAT THIS MEANS FOR A "DARK" PANEL. On an additive display the darkest
 * possible surface is the one that emits nothing — and that is the unmodified
 * world. Dark cannot be painted; it can only be left. So a panel here is built
 * the other way round from a screen panel: a very low NEUTRAL body emission,
 * which reads as smoked glass because it is dim and bounded, and a bright
 * neutral EDGE, which is the only part guaranteed to survive full daylight and
 * is what actually carries the panel's extent. The violet is gone from both.
 *
 * Legibility still comes from three things and only three: glyph SIZE, glyph
 * STROKE WEIGHT, and glyph BRIGHTNESS — a wash behind text raises the text's
 * surround and the world's by the same amount and cannot improve the ratio.
 * That is why the type scale below is absolute and every label is drawn bold.
 * ---------------------------------------------------------------------------
 */
import { hex } from "./Catalogue";
import { outlinePoints, radiusFor, roundedFillMesh, roundedRingMesh } from "./RoundedRect";

const QUAD_MESH = requireAsset("../Meshes/Quad.mesh") as RenderMesh;
const LUMINOUS_MAT = requireAsset("../Materials/Luminous.mat") as Material;
// The unlit preset's graph exposes no texture input, so photographs need a
// material that actually has a baseTex parameter.
const PHOTO_MAT = requireAsset("../Materials/PhotoImage.mat") as Material;
// Pass 28: the single UI_FONT is gone. makeLabel now picks a face per size —
// see faceFor — and Inter lives on as FONT_INTER, the revert path.

/** Achromatic chrome. Colour belongs to data, not to the interface. */
export const INK = hex("#F7F8FA"); // primary text — as bright as the display goes
export const INK_DIM = hex("#C8CCD2"); // secondary text; dimmed by ALPHA, not by hue
/**
 * Surfaces and strokes. NEUTRAL as of Pass 17 — it used to be #93A9CA, a blue
 * violet, and because it was both the body wash AND the edge of every panel it
 * put a violet cast over the entire interface. The reference is a dark grey
 * panel with a soft white line; a neutral here is most of the distance to it.
 */
export const GLASS = hex("#E9EBEE");
export const CORE = hex("#E4EEFA"); // the bar's glowing core

/**
 * Near-black. Its one remaining job is the halo around every glyph — see
 * makeLabel. It emits nothing, which on this display means it costs nothing and
 * does nothing; it is kept because the Text outline pass wants a colour and a
 * dark one is the right answer if this ever renders somewhere that composites.
 * It is NOT a surface treatment any more: Pass 17 established that a near-black
 * plate cannot hold the world off anything.
 */
export const SCRIM = hex("#0A111C");

/**
 * THE accent, added in Pass 14. One colour, used for exactly three things: the
 * duration chips, the dot that marks an activity's hour on the line, and the
 * selected day. Everything else in the planner is neutral.
 *
 * The planner used to carry all six identity hues at full saturation — a blue
 * block beside an amber one beside a pink one — which read as neon rather than
 * as an itinerary. The hues still belong to the activity CARDS, where they
 * distinguish six things you are choosing between. On the line, where you are
 * reading one plan, they were noise.
 */
export const ACCENT = hex("#8E7CF8");

/**
 * Reserved STRICTLY for a rejected placement, nowhere else in the Lens. A warm
 * coral rather than an alarm red — the message is information, not a telling-off.
 */
export const ALERT = hex("#FF7A6B");

/** Draw order — higher draws later, i.e. on top. */
/**
 * PASS 28 — THE CARRY BAND.
 *
 * A card being dragged is the only object in the Lens that travels ACROSS the
 * planner rather than sitting in it, so it is the only one whose render order
 * cannot be decided by where it lives in the hierarchy. Built into the card row
 * it tops out at 35, which puts it under every label in the Lens: makeLabel
 * pins text to ORDER_TEXT, so the recap, the day button and Clear day all drew
 * straight through a card being carried past them.
 *
 * 41..55 is deliberately chosen and deliberately modest. It clears ORDER_TEXT,
 * and it stays inside the band the day dropdown (41..47) has been drawing in
 * since Pass 8 without trouble. It is NOT pushed into the hundreds — see the
 * note in HomeScreen.buildCard for what that did to photographs the last time
 * someone assumed render order was a free parameter.
 *
 * The dropdown and a drag can never be open at once — the strip owns every
 * touch while it is expanded — so the overlap between the two bands is safe.
 */
export const ORDER_CARRY = 44;
export const ORDER_GHOST = 41;

/**
 * PASS 30 — the one layer the carry band must NOT lift.
 *
 * Pass 28 re-based the WHOLE card subtree, backing plate included. The plate is
 * an opaque field, so a carried card stopped being a card travelling over the
 * planner and became a rectangle cut out of it: the "1" of 12:00 in the recap
 * and the day button's own label were blanked out by empty card body.
 *
 * The plate is chrome, not content, so it does not need to win against text —
 * only against the planner's other chrome. It is pinned here, one below
 * ORDER_TEXT: it still covers the container fill and the day button's plate
 * (nothing is lost, they carry no information), while every label in the Lens
 * draws over it and stays readable. The card's own photograph, name, category,
 * duration, hours and stroke are still lifted into 46..55 by setCarried, so
 * they draw in front of that text and the card stays readable too.
 *
 * Below ORDER_GHOST as well, which is correct: the ghost is the drop preview
 * and belongs on top of the plate being carried toward it.
 */
export const ORDER_CARRY_BODY = 39;

export const ORDER_GLOW = 10;
export const ORDER_SCRIM = 14;
export const ORDER_WASH = 17;
export const ORDER_FILL = 20;
export const ORDER_STROKE = 30;
export const ORDER_TEXT = 40;

/**
 * THE TYPE SCALE, in centimetres of cap height.
 *
 * Absolute, not relative: the composition sits at VIEW_DISTANCE (75cm), so these
 * convert directly to angular size, which is the only thing the eye cares about.
 * 1 degree = 1.31cm at that distance, and roughly 20 arcminutes of cap height is
 * the floor for comfortable reading — hence MICRO at 0.45cm and nothing smaller
 * anywhere in the Lens.
 *
 *   display 1.40cm = 1.07deg    title 0.92cm = 0.70deg
 *   head    0.68cm = 0.52deg    body  0.58cm = 0.44deg
 *   label   0.52cm = 0.40deg    micro 0.45cm = 0.34deg
 */
export const TYPE = {
  display: 1.4,
  title: 0.92,
  head: 0.68,
  body: 0.58,
  label: 0.52,
  micro: 0.45,
};

/**
 * Text calibration. A Text component's `size` is not world centimetres, so we
 * author in cm and convert. TEXT_UNITS_PER_CM is measured from the preview and
 * is the single knob for all type in the Lens.
 */
const TEXT_BASE_SIZE = 48;
const TEXT_UNITS_PER_CM = 1.28;
/**
 * How many world centimetres one Text-local unit spans at scale 1. Measured, not
 * derived: it is the conversion `backgroundSettings.margins` uses, and it is not
 * the same space as `size`.
 */
const TEXT_UNIT_CM = 0.66;

/**
 * Synthetic weight. Inter ships here as a single Regular face, and a hairline
 * grotesque is the worst possible thing to put over a moving camera feed. The
 * Text component's own outline pass thickens every stem for free — this is the
 * largest single legibility win available without shipping a second font file.
 */
const TEXT_WEIGHT = 600;
/** Halo strength. Dark, so it costs nothing on an additive display. */
const HALO_SIZE = 0.4;

/**
 * TEXT METRICS.
 *
 * Every overflow bug this Lens has had — the description running under the right
 * column, "09:00 – 18:00 · Closed Tue" spilling off both edges of a card, a
 * block label wider than its own block — was the same mistake: a character
 * count picked by eye against a column nobody had measured. So width is computed
 * here, once, and layouts ask rather than guess.
 *
 * Deliberately a slight OVER-estimate (~1.0 cap heights per glyph against Inter's
 * true ~0.85 average). Text that wraps a word early is a smaller failure than
 * text that runs onto the camera feed, and on this display the second one is
 * unreadable rather than merely untidy.
 */
const ADVANCE = 1.0;
const SPACE_ADVANCE = 0.45;
/**
 * The same deliberate over-estimate, for Abhaya. Its glyphs are markedly wider
 * per cap height than Inter's — its cap is a smaller share of its em — so the
 * Inter figure would UNDER-estimate the serif and turn a conservative wrap into
 * a line that runs onto the camera feed, which is the one direction this
 * function must never be wrong in. 1.20 clears Abhaya's widest lower-case
 * (m/w at 1.36 are the outliers) while staying tight enough to be useful.
 */
const ADVANCE_SERIF = 1.2;
const SPACE_ADVANCE_SERIF = 0.32;

/** Rendered width of a string, in centimetres, at a given cap height. */
export function textWidth(text: string, heightCm: number): number {
  const per = SERIF ? ADVANCE_SERIF : ADVANCE;
  const space = SERIF ? SPACE_ADVANCE_SERIF : SPACE_ADVANCE;
  let units = 0;
  for (let i = 0; i < text.length; i++) {
    units += text.charAt(i) === " " ? space : per;
  }
  return units * heightCm;
}

/** How many characters of a generic string fit in a width. At least 1. */
export function fitChars(widthCm: number, heightCm: number): number {
  const per = SERIF ? ADVANCE_SERIF : ADVANCE;
  return Math.max(1, Math.floor(widthCm / (per * heightCm)));
}

/** Shorten to fit, with an ellipsis. Returns the original when it already fits. */
export function truncate(text: string, widthCm: number, heightCm: number): string {
  if (textWidth(text, heightCm) <= widthCm) return text;
  const n = fitChars(widthCm, heightCm) - 1;
  if (n <= 0) return "";
  return text.substring(0, n) + "…";
}

/**
 * Break on word boundaries to fit a column, capped at `maxLines`. The last line
 * absorbs anything left over and is truncated, so this can never silently drop
 * half a name.
 */
export function wrapToWidth(
  text: string,
  widthCm: number,
  heightCm: number,
  maxLines: number = 2
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const next = line.length === 0 ? words[i] : line + " " + words[i];
    if (textWidth(next, heightCm) > widthCm && line.length > 0) {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines - 1) {
        // Everything remaining has to go on the final line.
        for (let j = i + 1; j < words.length; j++) line += " " + words[j];
        break;
      }
    } else {
      line = next;
    }
  }
  if (line.length > 0) lines.push(truncate(line, widthCm, heightCm));
  return lines;
}

/**
 * ---------------------------------------------------------------------------
 * MEASURED GLYPH ADVANCES — Pass 16.
 *
 * The table below is not a guess. It was read straight out of the shipped
 * Assets/Fonts/Inter.ttf: `hmtx` advances divided by the `OS/2` cap height
 * (unitsPerEm 2048, sCapHeight 1490), so every number is "how many cap heights
 * wide this glyph is" and composes directly with the TYPE scale above.
 *
 * WHY THIS EXISTS ALONGSIDE textWidth().
 *
 * textWidth()'s flat ADVANCE = 1.0 is a deliberate over-estimate, and for
 * WRAPPING that is the right call — a line that breaks a word early is a small
 * failure, a line that runs onto the camera feed is unreadable. But the detail
 * panel has to ALLOCATE a fixed row of four columns across a known width, and
 * there an over-estimate is not conservative, it is wrong in the dangerous
 * direction: every column is scaled down to make the row fit, so one column's
 * over-estimate steals width from a neighbour that genuinely needed it.
 *
 * A single average cannot do that job either, because the spread is enormous:
 * 'i' is 0.33 cap heights and 'W' is 1.35, and "09:30 – 23:45" (all digits, mean
 * 0.70) is a different animal from "Opening hours" (mean 0.74) which is a
 * different animal again from "Iron lattice tower..." (mean 0.66). The 0.85
 * ADVANCE_FIT that ActivityCard and HomeScreen carry came from this file's own
 * prose estimate of "Inter's true ~0.85 average" — the real figure for mixed
 * case prose is 0.66, so 0.85 is ~29% loose. Those screens are NOT changed here:
 * they are laid out and signed off against 0.85, and re-measuring them is a
 * separate job from redrawing the detail panel.
 *
 * MEASURE_SAFETY covers the one thing the font file cannot tell us — whether
 * TEXT_UNITS_PER_CM above lands exactly on cap height in this runtime. 4% is
 * enough to absorb that without giving back the precision.
 * ---------------------------------------------------------------------------
 */
/** Advance x100, in cap heights, for ASCII 32..126 in order. */
const ADV_ASCII = [
  39, 40, 64, 87, 88, 135, 89, 41, 50, 50, 69, 91, 40, 63, 40, 50, // 32..47
  87, 56, 84, 85, 89, 82, 85, 78, 85, 85, 40, 41, 91, 91, 91, 70, // 48..63
  133, 95, 90, 100, 99, 83, 81, 103, 102, 37, 78, 92, 78, 124, 104, 105, // 64..79
  88, 105, 88, 88, 89, 102, 95, 135, 94, 93, 86, 50, 50, 50, 65, 63, // 80..95
  44, 77, 84, 79, 84, 80, 51, 84, 81, 33, 33, 75, 33, 120, 81, 82, // 96..111
  84, 84, 52, 73, 45, 81, 77, 112, 75, 77, 76, 59, 46, 59, 91, // 112..126
];
/** Everything outside ASCII that this Lens actually renders. */
const ADV_EXTRA: { [ch: string]: number } = {
  "é": 80, "è": 80, "ê": 80, "ë": 80, "à": 77, "â": 77, "ù": 81, "û": 81,
  "ô": 82, "î": 33, "ï": 33, "ç": 79, "ō": 82, "ū": 81, "ā": 77, "œ": 137,
  "–": 69, "—": 137, "·": 40, "…": 119, "’": 36, "‘": 36, "‹": 53, "›": 53,
  "€": 92, "£": 84, "¥": 76, "×": 91, "°": 63,
};
/** Wide enough to be safe for a glyph we have not measured. */
const ADV_FALLBACK = 0.95;
const MEASURE_SAFETY = 1.04;

/**
 * ===========================================================================
 * PASS 28 — THE SERIF, EVERYWHERE.
 *
 * Abhaya Libre replaces Inter across the whole Lens. Pass 27 proved it on the
 * home screen with a set of tables kept local to that file; this pulls the same
 * machinery down into Theme so that ONE face, ONE metric table and ONE cap
 * calibration drive everything, and nothing anywhere can end up measured
 * against a font it is not drawn in.
 *
 * THREE THINGS HAVE TO MOVE TOGETHER or the system silently decalibrates:
 *
 *   1. THE FACE. makeLabel picks a weight from the requested cap height, so
 *      small text gets a heavier cut. Abhaya has real stroke contrast and its
 *      thins are the first thing an additive display loses — Pass 27 measured
 *      Medium breaking up at 0.58cm against a lit building. See faceFor.
 *
 *   2. THE ADVANCES. measureText must read the table for the SAME weight
 *      makeLabel will draw in, or every left-anchored run sits slightly off its
 *      margin. faceFor and advFor are driven off the same threshold for exactly
 *      this reason — change one and you must change the other.
 *
 *   3. THE CAP HEIGHT. Abhaya's cap is 0.586 of its em against Inter's 0.728,
 *      so the same Text `size` renders it at 0.805 of the intended height.
 *      TEXT_UNITS_PER_CM is calibrated for Inter and is NOT touched; makeLabel
 *      multiplies by CAP_SCALE instead. The contract every call site in the Lens
 *      relies on — "heightCm is cap height in centimetres" — therefore still
 *      holds exactly, which is what keeps solveRowNameHeight, the activity
 *      cards' four lines and the detail panel's columns coherent.
 *
 * Tables extracted from the shipped .ttf files by the same method Pass 16 used
 * for Inter, validated by re-deriving Inter's own ADV_ASCII above and getting
 * all 95 advances back identical.
 * ===========================================================================
 */

/**
 * ⟵⟵ THE GLOBAL REVERT SWITCH. ⟵⟵
 *
 * Set to false and the ENTIRE Lens — every screen, every label, every measured
 * layout — is back on Inter at Pass 27's exact sizes and spacing. Face, metric
 * tables, cap compensation and the wrapping estimate all follow this one
 * constant, and every branch below returns the literal Inter value it had
 * before, so the revert is exact rather than approximate.
 *
 * HomeScreen has its own HOME_SCREEN_SERIF from Pass 27; it now defers to this.
 */
export const SERIF = true;

const FONT_INTER = requireAsset("../Fonts/Inter.ttf") as Font;
const FONT_XBOLD = requireAsset("../Fonts/AbhayaLibre-ExtraBold.ttf") as Font;
const FONT_BOLD = requireAsset("../Fonts/AbhayaLibre-Bold.ttf") as Font;
const FONT_SEMI = requireAsset("../Fonts/AbhayaLibre-SemiBold.ttf") as Font;

/** Inter cap/em 1490/2048 = 0.7275. Abhaya cap/em 600/1024 = 0.5859. */
export const CAP_SCALE = SERIF ? 0.7275 / 0.5859 : 1.0;

const AB_SEMI: number[] = [
  32, 44, 51, 96, 92, 136, 98, 30, 56, 56, 59, 77, 32, 54, 33, 70,  // 32..47
  90, 71, 80, 86, 85, 82, 88, 77, 90, 88, 34, 32, 76, 77, 76, 77,  // 48..63
  149, 104, 100, 102, 112, 94, 87, 116, 121, 55, 64, 107, 84, 135, 111, 118,  // 64..79
  94, 118, 102, 91, 94, 106, 97, 143, 103, 94, 92, 60, 71, 62, 90, 82,  // 80..95
  83, 81, 92, 74, 93, 78, 54, 82, 94, 48, 46, 85, 50, 136, 94, 86,  // 96..111
  92, 93, 68, 68, 57, 94, 78, 116, 76, 81, 70, 67, 45, 66, 82,  // 112..126
];
const AB_SEMI_EXTRA: { [ch: string]: number } = { "é": 78, "è": 78, "ê": 78, "ë": 78, "à": 81, "â": 81, "ù": 94, "û": 94, "ô": 86, "î": 48, "ï": 48, "ç": 74, "ō": 86, "ū": 94, "ā": 81, "œ": 134, "–": 108, "—": 142, "·": 47, "…": 100, "’": 35, "‘": 32, "‹": 42, "›": 42, "€": 101, "£": 95, "¥": 95, "×": 67, "°": 48 };

const AB_BOLD: number[] = [
  32, 41, 51, 96, 93, 138, 98, 29, 56, 56, 61, 76, 32, 52, 32, 71,  // 32..47
  92, 72, 81, 88, 87, 85, 90, 79, 90, 90, 34, 32, 75, 76, 75, 77,  // 48..63
  149, 106, 101, 101, 112, 94, 88, 116, 122, 56, 67, 108, 84, 134, 111, 117,  // 64..79
  94, 118, 102, 92, 94, 107, 98, 146, 104, 95, 92, 61, 73, 64, 88, 83,  // 80..95
  83, 82, 92, 75, 94, 79, 56, 83, 94, 48, 47, 86, 51, 135, 94, 86,  // 96..111
  93, 94, 69, 69, 58, 94, 78, 117, 78, 81, 70, 67, 44, 66, 81,  // 112..126
];
const AB_BOLD_EXTRA: { [ch: string]: number } = { "é": 79, "è": 79, "ê": 79, "ë": 79, "à": 82, "â": 82, "ù": 94, "û": 94, "ô": 86, "î": 47, "ï": 47, "ç": 75, "ō": 86, "ū": 94, "ā": 82, "œ": 133, "–": 105, "—": 139, "·": 45, "…": 100, "’": 37, "‘": 32, "‹": 41, "›": 41, "€": 102, "£": 95, "¥": 95, "×": 67, "°": 47 };

const AB_XBOLD: number[] = [
  32, 39, 51, 96, 94, 139, 98, 28, 56, 56, 64, 75, 31, 50, 32, 73,  // 32..47
  95, 74, 82, 90, 89, 87, 92, 81, 91, 92, 34, 31, 74, 75, 74, 78,  // 48..63
  150, 108, 102, 100, 112, 95, 88, 116, 122, 57, 70, 109, 86, 134, 111, 117,  // 64..79
  94, 118, 102, 93, 93, 108, 99, 149, 106, 96, 92, 63, 76, 65, 86, 85,  // 80..95
  83, 82, 93, 76, 95, 79, 58, 84, 94, 48, 48, 88, 52, 135, 94, 87,  // 96..111
  93, 95, 70, 70, 60, 94, 79, 118, 80, 82, 70, 67, 43, 67, 80,  // 112..126
];
const AB_XBOLD_EXTRA: { [ch: string]: number } = { "é": 79, "è": 79, "ê": 79, "ë": 79, "à": 82, "â": 82, "ù": 94, "û": 94, "ô": 87, "î": 47, "ï": 47, "ç": 76, "ō": 87, "ū": 94, "ā": 82, "œ": 132, "–": 102, "—": 135, "·": 42, "…": 100, "’": 40, "‘": 31, "‹": 40, "›": 40, "€": 103, "£": 95, "¥": 96, "×": 67, "°": 46 };


/**
 * WHICH WEIGHT AT WHICH SIZE.
 *
 * Not monotonic with size, and deliberately so. The two display sizes get the
 * heaviest cut because a title should have presence. Everything from body down
 * gets SemiBold, which Pass 27 established as the lightest Abhaya that survives
 * this display at 0.5cm. There is no Medium or Regular anywhere in the Lens:
 * they measured beautifully and disappeared against a bright camera feed.
 *
 * The 0.62 threshold sits between TYPE.body (0.58) and TYPE.head (0.68), so the
 * split lands on a real typographic boundary rather than mid-role.
 */
function faceFor(capCm: number): Font {
  if (!SERIF) return FONT_INTER;
  if (capCm >= 0.90) return FONT_XBOLD;
  if (capCm >= 0.62) return FONT_BOLD;
  return FONT_SEMI;
}

/** The advance table for whatever faceFor will draw in. Keep these in step. */
function advFor(capCm: number): number[] {
  if (!SERIF) return ADV_ASCII;
  if (capCm >= 0.90) return AB_XBOLD;
  if (capCm >= 0.62) return AB_BOLD;
  return AB_SEMI;
}

function extraFor(capCm: number): { [ch: string]: number } {
  if (!SERIF) return ADV_EXTRA;
  if (capCm >= 0.90) return AB_XBOLD_EXTRA;
  if (capCm >= 0.62) return AB_BOLD_EXTRA;
  return AB_SEMI_EXTRA;
}


/**
 * Rendered width of a string in centimetres, from the font's own metrics.
 * Accurate to a few percent — use it to place and allocate. Use textWidth() to
 * wrap, where erring wide is the safe direction.
 */
export function measureText(text: string, heightCm: number): number {
  // The table for the weight faceFor() will actually draw this size in.
  const ascii = advFor(heightCm);
  const extras = extraFor(heightCm);
  let caps = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 32 && code <= 126) {
      caps += ascii[code - 32] / 100;
    } else {
      const extra = extras[text.charAt(i)];
      caps += extra === undefined ? ADV_FALLBACK : extra / 100;
    }
  }
  return caps * heightCm * MEASURE_SAFETY;
}

/** truncate()'s shape, against the measured metric. */
export function truncateMeasured(
  text: string,
  widthCm: number,
  heightCm: number
): string {
  if (measureText(text, heightCm) <= widthCm) return text;
  let n = text.length;
  while (n > 0 && measureText(text.substring(0, n) + "…", heightCm) > widthCm) n--;
  return n <= 0 ? "" : text.substring(0, n) + "…";
}

/**
 * wrapToWidth's shape, against the measured metric.
 *
 * The final line is truncated rather than left to run: `description` and
 * `hoursText` are the two fields the Pass 12 live fetch is allowed to overwrite,
 * so nothing here may assume the catalogue's own lengths still hold.
 */
export function wrapMeasured(
  text: string,
  widthCm: number,
  heightCm: number,
  maxLines: number = 2
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let line = "";
  for (let i = 0; i < words.length; i++) {
    const next = line.length === 0 ? words[i] : line + " " + words[i];
    if (measureText(next, heightCm) > widthCm && line.length > 0) {
      lines.push(line);
      line = words[i];
      if (lines.length === maxLines - 1) {
        for (let j = i + 1; j < words.length; j++) line += " " + words[j];
        break;
      }
    } else {
      line = next;
    }
  }
  if (line.length > 0) lines.push(truncateMeasured(line, widthCm, heightCm));
  return lines;
}

/**
 * A label whose LEFT edge lands on `leftX`.
 *
 * Align.Left does not anchor a Text's left edge in this runtime — it runs the
 * string leftward from the position, which is how two earlier passes lost
 * captions onto the neighbouring card. So this is a centred label placed half
 * its measured width to the right, which is exact rather than approximately
 * right. Callers that need the run's width can ask measureText for it.
 */
export function makeLeftLabel(
  parent: SceneObject,
  name: string,
  text: string,
  heightCm: number,
  color: vec4,
  leftX: number,
  y: number,
  z: number
): Text {
  const w = measureText(text, heightCm);
  return makeLabel(parent, name, text, heightCm, color, Align.Center, leftX + w / 2, y, z);
}

/**
 * Re-anchor an existing left-aligned label after its text has changed.
 *
 * Same arithmetic as makeLeftLabel, for the one label in the Lens whose string
 * arrives from the network — see ActivityCard's opening hours.
 */
export function setLeftLabel(
  label: Text,
  text: string,
  heightCm: number,
  leftX: number,
  y: number,
  z: number
): void {
  label.text = text;
  label
    .getSceneObject()
    .getTransform()
    .setLocalPosition(new vec3(leftX + measureText(text, heightCm) / 2, y, z));
}

/**
 * Intensity on an additive display. Output is rgb * alpha, so alpha here is
 * literally "how much light this adds" — 1.0 is a bright stroke, 0.3 a wash.
 * Authoring through this helper keeps that fact in view at every call site.
 */
export function lit(c: vec4, intensity: number): vec4 {
  return new vec4(c.r, c.g, c.b, intensity);
}

/**
 * ONE corner radius, everywhere. Pass 15: the Lens had four — 0.45 on buttons,
 * 0.6 on cards, 0.7 on panels and a full half-height on the placed pills, which
 * made a pill read as a different KIND of object from the buttons beside it.
 * Every rounded rectangle in the Lens now uses this.
 */
export const RADIUS = 0.6;

/**
 * THE hairline. One stroke width for every outlined thing in the Lens.
 *
 * Pass 18 halved it, 0.16 to 0.08, and deleted the four multipliers that had
 * grown around it (0.7 on pills, 0.75 on unselected city cards, 0.8 on activity
 * cards, plus 0.07/0.09/0.1 hardcoded on chips and buttons). At 0.16 the borders
 * read as drawn frames; the reference's are closer to a line you notice only
 * because the panel stops. 0.08 at VIEW_DISTANCE is about 3.7 arcminutes —
 * still several display pixels wide, so it survives, but it no longer competes
 * with the type.
 *
 * The multipliers went because every one of them encoded a STATE — selected,
 * recessed, active — that is already carried by the edge's brightness. Two
 * channels for one signal is how a system drifts, and thickness was the weaker
 * of the two now that it is this fine.
 */
export const STROKE = 0.08;

/**
 * The hairline for LARGE surfaces — Pass 21.
 *
 * A stroke's weight on the eye is not just its thickness, it is thickness times
 * how far it runs. At 0.08 a 6.7cm card edge is a whisper and the 41cm planner
 * container is a drawn box, because the container's perimeter is nine times the
 * length. So the biggest surfaces get a finer line, which is what makes them
 * read as the same weight as everything else rather than heavier.
 *
 * Not applied below about 20cm of perimeter — at card scale 0.06 starts to break
 * up rather than read as a continuous line.
 */
export const STROKE_FINE = 0.06;

/**
 * A 1x1 opaque texture. It gives a flat fill the photo graph's texture path,
 * which is the one measured to put a controllable value on the pixel. It is 50%
 * grey, so BODY_GAIN cancels that out and an emission of 0.10 at the call site
 * really is 0.10 of white on screen.
 */
const BASE_TEX = requireAsset("../Materials/Base.png") as Texture;
const BODY_GAIN = 2.0;

/**
 * THE BODY OF EVERY SURFACE, in emitted light.
 *
 * Measured on a six-step ladder against the preview's night street: below 0.05
 * the panel is an outline around nothing; by 0.19 it has gone milky and stopped
 * reading as dark; 0.10 is the point where it is unmistakably a bounded surface
 * and still clearly something you are looking THROUGH. That is the whole budget
 * for "dark translucent" on a display that can only add.
 */
export const BODY = 0.10;
/** Chips, buttons and pills sit on the same surface, a touch quieter. */
export const BODY_CHIP = 0.07;

/**
 * PHOTOGRAPHS: A LIFT, NOT A GAIN.
 *
 * A photograph shows the world through its dark regions until it out-emits it.
 * The first fix here was a straight gain on baseColor, and shipping it made the
 * arithmetic obvious: a multiply is the wrong SHAPE for this problem. Bleed
 * lives in the darkest pixels and clipping lives in the brightest, and a
 * multiply moves the bright ones furthest. At gain 3 a 0.05 sky only reached
 * 0.15 — still under a lit building — while a 0.4 midtone blew straight past 1.
 * The Louvre and the Sacre-Coeur came back solid white.
 *
 * What actually closes the bleed is raising the FLOOR. So a photograph is now a
 * plate at PHOTO_LIFT with the image added on top: `out = LIFT + GAIN * photo`,
 * which lands the darkest pixel at 0.42 and the brightest at 1.08 — opaque at
 * the bottom, barely clipping at the top. Two draws, where five bought nothing.
 *
 * 0.42 was set against the hardest case in the Lens: the detail panel is the
 * largest photograph and it sits directly over the preview street's lit arch,
 * the brightest thing in the scene. A floor that held on the card row at 0.30
 * lost to the arch there.
 *
 * The cost is real and worth stating: a lifted photograph has grey blacks. On a
 * display that cannot subtract light, "opaque" and "deep blacks" are the same
 * dial pulled in opposite directions, because black IS transparency here. The
 * brief asks for opaque, so the floor wins.
 */
export const PHOTO_LIFT = 0.42;
export const PHOTO_GAIN = 0.66;

const matCache: { [key: string]: Material } = {};
const bodyCache: { [key: string]: Material } = {};

/**
 * A flat neutral fill at a known emission.
 *
 * Uses the photo graph rather than the Luminous one because that is the path
 * the Pass 17 probe actually measured putting a value on the pixel. Note what
 * alpha does NOT do here: the Lens framebuffer starts empty, so blending
 * `colour` at alpha `a` against nothing is just `colour * a` — alpha and colour
 * are one knob wearing two hats. That is why a 0.20-alpha wash used to render
 * at 0.05 and vanish, and why emission is now a single number with alpha pinned.
 */
function bodyMaterial(color: vec4): Material {
  const key =
    color.r.toFixed(3) + "_" + color.g.toFixed(3) + "_" + color.b.toFixed(3) + "_" + color.a.toFixed(3);
  const cached = bodyCache[key];
  if (cached) return cached;

  const mat = PHOTO_MAT.clone();
  const pass = mat.mainPass;
  pass.baseTex = BASE_TEX;
  pass.baseColor = new vec4(
    color.r * color.a * BODY_GAIN,
    color.g * color.a * BODY_GAIN,
    color.b * color.a * BODY_GAIN,
    1
  );
  pass.blendMode = BlendMode.Normal;
  pass.depthWrite = false;
  pass.twoSided = true;
  bodyCache[key] = mat;
  return mat;
}

/**
 * A rounded surface body — the dark translucent field a panel is made of.
 *
 * Replaces makeScrim, which asked a near-black plate to hold the world off the
 * content. It never could: black emits nothing, so it drew nothing. This emits
 * `emission` of neutral light instead, which is what a dark glass panel looks
 * like on a display that adds.
 */
export function makeBody(
  parent: SceneObject,
  name: string,
  widthCm: number,
  heightCm: number,
  emission: number,
  renderOrder: number,
  radius: number = -1
): SceneObject {
  const obj = global.scene.createSceneObject(name);
  obj.setParent(parent);
  const visual = obj.createComponent("Component.RenderMeshVisual");
  const r = radius < 0 ? radiusFor(widthCm, heightCm) : radius;
  visual.mesh = roundedFillMesh(widthCm, heightCm, r);
  visual.mainMaterial = bodyMaterial(new vec4(GLASS.r, GLASS.g, GLASS.b, emission));
  visual.setRenderOrder(renderOrder);
  return obj;
}

/**
 * Clone the base unlit material per (colour, blend) pair. Cached, because a
 * fresh clone per quad would mean ~60 materials for one screen.
 */
function materialFor(color: vec4, additive: boolean): Material {
  const key =
    color.r.toFixed(3) +
    "_" +
    color.g.toFixed(3) +
    "_" +
    color.b.toFixed(3) +
    "_" +
    color.a.toFixed(3) +
    "_" +
    (additive ? "add" : "norm");
  const cached = matCache[key];
  if (cached) return cached;

  const mat = LUMINOUS_MAT.clone();
  const pass = mat.mainPass;
  pass.baseColor = color;
  pass.blendMode = additive ? BlendMode.Add : BlendMode.Normal;
  pass.depthWrite = false; // transparent layers must not write depth
  pass.twoSided = true;
  matCache[key] = mat;
  return mat;
}

/**
 * A photographic quad. Photos get their own material (never the shared cached
 * ones) with opaque white baseColor and normal blending — an additive photo
 * washes out to nothing against a bright camera feed.
 */
export function makeImageQuad(
  parent: SceneObject,
  name: string,
  widthCm: number,
  heightCm: number,
  texture: Texture,
  renderOrder: number
): SceneObject {
  const obj = global.scene.createSceneObject(name);
  obj.setParent(parent);
  const visual = obj.createComponent("Component.RenderMeshVisual");
  visual.mesh = QUAD_MESH;
  const mat = PHOTO_MAT.clone();
  const pass = mat.mainPass;
  pass.baseTex = texture;
  pass.baseColor = new vec4(PHOTO_GAIN, PHOTO_GAIN, PHOTO_GAIN, 1);
  pass.blendMode = BlendMode.Normal;
  pass.depthWrite = false;
  pass.twoSided = true;
  visual.mainMaterial = mat;
  visual.setRenderOrder(renderOrder);
  const tr = obj.getTransform();
  tr.setLocalScale(new vec3(widthCm, 1, heightCm));
  tr.setLocalRotation(quat.angleAxis(Math.PI / 2, vec3.right()));
  return obj;
}

/**
 * Rounded panel fill. Rounded meshes are authored in XY at real size, so unlike
 * makeQuad they need no rotation and no scaling.
 */
export function makeRoundedFill(
  parent: SceneObject,
  name: string,
  widthCm: number,
  heightCm: number,
  color: vec4,
  additive: boolean,
  renderOrder: number,
  radius: number = -1
): SceneObject {
  const obj = global.scene.createSceneObject(name);
  obj.setParent(parent);
  const visual = obj.createComponent("Component.RenderMeshVisual");
  const r = radius < 0 ? radiusFor(widthCm, heightCm) : radius;
  visual.mesh = roundedFillMesh(widthCm, heightCm, r);
  visual.mainMaterial = materialFor(color, additive);
  visual.setRenderOrder(renderOrder);
  return obj;
}

/** Rounded luminous outline, as a single ring of geometry. */
export function makeRoundedOutline(
  parent: SceneObject,
  name: string,
  widthCm: number,
  heightCm: number,
  color: vec4,
  thicknessCm: number,
  renderOrder: number,
  radius: number = -1
): SceneObject {
  const obj = global.scene.createSceneObject(name);
  obj.setParent(parent);
  const visual = obj.createComponent("Component.RenderMeshVisual");
  const r = radius < 0 ? radiusFor(widthCm, heightCm) : radius;
  visual.mesh = roundedRingMesh(widthCm, heightCm, r, thicknessCm);
  visual.mainMaterial = materialFor(color, true);
  visual.setRenderOrder(renderOrder);
  return obj;
}

/** Options for a panel surface. All optional; the defaults are the house style. */
export interface SurfaceOptions {
  /** Identity hue for the outer bloom and, if `tintEdge`, the edge itself. */
  tint?: vec4;
  /** Corner radius. -1 derives one from the box. */
  radius?: number;
  /**
   * Emitted light in the panel's body. Defaults to BODY. This is the ONE number
   * that says how dark the surface reads — it replaced `scrim`, `wash` and
   * `scrimLayers`, which were three knobs for a thing that turned out to have
   * one. See the Pass 17 note at the top of this file.
   */
  body?: number;
  /** Edge brightness. */
  edge?: number;
  /** Edge thickness in cm. */
  edgeWidth?: number;
  /** Draw the identity bloom behind the panel. */
  bloom?: boolean;
  /** Colour the edge with `tint` instead of GLASS. */
  tintEdge?: boolean;
  /** Base render order; the layers stack from here. */
  order?: number;
}

/**
 * THE panel primitive. Every surface in the Lens — card, chip, detail frame,
 * button — is this, so they can never drift apart.
 *
 * Two layers now instead of four: a body and an edge. The scrim was deleted
 * because it drew nothing, and the wash was deleted because it WAS the body all
 * along, just at a tenth of the intended value.
 *
 * Returns the group; put content in it at positive local z.
 */
export function makeSurface(
  parent: SceneObject,
  name: string,
  widthCm: number,
  heightCm: number,
  opts: SurfaceOptions = {}
): SceneObject {
  const g = global.scene.createSceneObject(name);
  g.setParent(parent);

  const radius = opts.radius === undefined ? radiusFor(widthCm, heightCm) : opts.radius;
  const r = radius < 0 ? radiusFor(widthCm, heightCm) : radius;
  const bodyE = opts.body === undefined ? BODY : opts.body;
  const edgeA = opts.edge === undefined ? 0.75 : opts.edge;
  const edgeW = opts.edgeWidth === undefined ? STROKE : opts.edgeWidth;
  const base = opts.order === undefined ? ORDER_GLOW : opts.order;
  const tint = opts.tint;

  // 1. Identity bloom, outside the panel edge. The only place a hue spreads.
  if (opts.bloom && tint) {
    makeRoundedFill(
      g,
      "bloom",
      widthCm + 1.0,
      heightCm + 1.0,
      new vec4(tint.r, tint.g, tint.b, 0.13),
      true,
      base,
      r + 0.5
    ).getTransform().setLocalPosition(new vec3(0, 0, -0.12));
  }

  // 2. The body — a dim neutral field. On this display that IS the dark panel.
  if (bodyE > 0) {
    makeBody(g, "body", widthCm, heightCm, bodyE, base + 4, r)
      .getTransform()
      .setLocalPosition(new vec3(0, 0, -0.08));
  }

  // 4. The edge. In full daylight this is the whole panel.
  if (edgeA > 0) {
    const ec = opts.tintEdge && tint ? tint : GLASS;
    makeRoundedOutline(
      g,
      "edge",
      widthCm,
      heightCm,
      new vec4(ec.r, ec.g, ec.b, edgeA),
      edgeW,
      ORDER_STROKE,
      r
    ).getTransform().setLocalPosition(new vec3(0, 0, -0.04));
  }

  return g;
}

/** A photograph with rounded corners. */
export function makeRoundedImage(
  parent: SceneObject,
  name: string,
  widthCm: number,
  heightCm: number,
  texture: Texture,
  renderOrder: number,
  radius: number = -1,
  /** Multiplies the photograph. Used to push unselected carousel cards back. */
  tint: vec4 = null,
  /**
   * COVER-fit rather than stretch: centre-crop the texture to the box's aspect
   * so the photograph keeps its own proportions. Off by default, because every
   * existing caller was laid out against the stretched behaviour and changing
   * that silently would move photographs on screens this pass did not touch.
   */
  cover: boolean = false
): SceneObject {
  // A GROUP, not a quad: a photograph is a lift plate plus the image added on
  // top of it — see the PHOTO_LIFT note. Callers position the group, so the two
  // layers can never drift apart and every existing call site is unchanged.
  const g = global.scene.createSceneObject(name);
  g.setParent(parent);
  const r = radius < 0 ? radiusFor(widthCm, heightCm) : radius;
  // The carousel pushes unselected neighbours back by tinting. The IMAGE dims
  // with them, but the plate only partly does: dimming the floor in step made a
  // neighbour card transparent rather than distant, and the street's arch cut
  // straight through it. Recessed, not see-through — so the floor keeps 70%.
  const dim = tint ? (tint.r + tint.g + tint.b) / 3 : 1;
  const plateDim = 0.7 + 0.3 * dim;

  const plate = makeBody(g, "lift", widthCm, heightCm, PHOTO_LIFT * plateDim, renderOrder, r);
  plate.getTransform().setLocalPosition(new vec3(0, 0, -0.004));

  const obj = global.scene.createSceneObject("img");
  obj.setParent(g);
  const visual = obj.createComponent("Component.RenderMeshVisual");
  let us = 1;
  let vs = 1;
  if (cover) {
    const th = texture.getHeight();
    const texA = th > 0 ? texture.getWidth() / th : 1;
    const boxA = widthCm / heightCm;
    if (texA > boxA) us = boxA / texA;
    else vs = texA / boxA;
  }
  visual.mesh = roundedFillMesh(widthCm, heightCm, r, us, vs);
  const mat = PHOTO_MAT.clone();
  const pass = mat.mainPass;
  pass.baseTex = texture;
  pass.baseColor = tint
    ? new vec4(tint.r * PHOTO_GAIN, tint.g * PHOTO_GAIN, tint.b * PHOTO_GAIN, 1)
    : new vec4(PHOTO_GAIN, PHOTO_GAIN, PHOTO_GAIN, 1);
  // ADD, so the plate underneath survives as the image's floor. With Normal the
  // image would replace it and the lift would do nothing at all.
  pass.blendMode = BlendMode.Add;
  pass.depthWrite = false;
  pass.twoSided = true;
  visual.mainMaterial = mat;
  visual.setRenderOrder(renderOrder + 1);
  return g;
}

/** Recolour an existing quad in place, reusing the cached materials. */
export function setQuadColor(
  obj: SceneObject,
  color: vec4,
  additive: boolean
): void {
  const visual = obj.getComponent("Component.RenderMeshVisual");
  if (visual) visual.mainMaterial = materialFor(color, additive);
}

/**
 * ---------------------------------------------------------------------------
 * RETINTING A VISUAL THAT A FADER MAY HAVE TOUCHED — Pass 25.
 *
 * The three helpers below exist for the carousel's glide, which is the first
 * thing in this Lens that recolours objects it did not just build. Everything
 * before it either baked the colour in at construction or, like the drag ghost,
 * lived on a screen no Fader had ever run over. The carousel is neither, and the
 * interaction between the two mechanisms is a genuine trap:
 *
 *   Fader writes `mainPassOverrides.baseColor`, which is PER-VISUAL and wins
 *   over the material. It has to — Theme caches one material per colour, so
 *   fading through the material would fade every other object sharing it.
 *
 *   But an override, once written, is permanent: this runtime exposes no way to
 *   clear one. So after a fade-in completes, every visual on the screen carries
 *   an override pinned to the colour it had at that moment. Swapping the
 *   material underneath it — the only safe way to recolour a SHARED material —
 *   then changes nothing at all, because the stale override still wins.
 *
 * That failure is silent and it is delayed: it shows up only on the second visit
 * to the home screen, when the cards stop dimming. So these helpers do both
 * halves together — point the visual at the right cached material, then copy
 * that material's colour into the override so the two agree. Callers never touch
 * overrides themselves, and cannot get the pair out of step.
 * ---------------------------------------------------------------------------
 */
function retint(visual: MaterialMeshVisual, mat: Material): void {
  visual.mainMaterial = mat;
  const c = visual.mainPass.baseColor;
  visual.mainPassOverrides.baseColor = new vec4(c.r, c.g, c.b, c.a);
}

/** Re-emit an existing body in place. Quantise `emission` — see below. */
export function setBodyEmission(obj: SceneObject, emission: number): void {
  const visual = obj.getComponent("Component.RenderMeshVisual");
  if (visual) {
    retint(visual, bodyMaterial(new vec4(GLASS.r, GLASS.g, GLASS.b, emission)));
  }
}

/**
 * Recolour a luminous shape in place, override included.
 *
 * QUANTISE THE COLOUR BEFORE CALLING THIS, and before setBodyEmission. Both
 * caches key on three decimals of every channel, so feeding them a raw eased
 * value mints a brand new Material every frame and reuses none of them — a
 * quarter-second glide would leave ~15 dead materials behind per visual, per
 * press, for the rest of the session.
 */
export function setShapeColor(
  obj: SceneObject,
  color: vec4,
  additive: boolean
): void {
  const visual = obj.getComponent("Component.RenderMeshVisual");
  if (visual) retint(visual, materialFor(color, additive));
}

/**
 * Recolour a photograph in place.
 *
 * Photographs are the one thing in this file that already own their material
 * outright — makeRoundedImage clones per call, because a photo carries its own
 * texture — so this writes the colour straight through rather than swapping.
 * The override still has to be kept in step, for exactly the reason above.
 */
export function setPhotoTint(obj: SceneObject, color: vec4): void {
  const visual = obj.getComponent("Component.RenderMeshVisual");
  if (!visual) return;
  visual.mainPass.baseColor = color;
  visual.mainPassOverrides.baseColor = new vec4(color.r, color.g, color.b, color.a);
}

/**
 * A flat rectangle, the only primitive this Lens draws.
 * `additive` is the difference between "glows" and "washes".
 */
export function makeQuad(
  parent: SceneObject,
  name: string,
  widthCm: number,
  heightCm: number,
  color: vec4,
  additive: boolean,
  renderOrder: number
): SceneObject {
  const obj = global.scene.createSceneObject(name);
  obj.setParent(parent);
  const visual = obj.createComponent("Component.RenderMeshVisual");
  visual.mesh = QUAD_MESH;
  visual.mainMaterial = materialFor(color, additive);
  visual.setRenderOrder(renderOrder);
  // The plane preset lies in the XZ plane with its normal on +Y, so every quad
  // has to be stood upright: local Z becomes world height, normal faces the user.
  const tr = obj.getTransform();
  tr.setLocalScale(new vec3(widthCm, 1, heightCm));
  tr.setLocalRotation(quat.angleAxis(Math.PI / 2, vec3.right()));
  return obj;
}

/** A 1px-feeling luminous stroke. Width/height in cm; one of them will be thin. */
export function makeStroke(
  parent: SceneObject,
  name: string,
  widthCm: number,
  heightCm: number,
  color: vec4,
  x: number,
  y: number,
  z: number
): SceneObject {
  const q = makeQuad(parent, name, widthCm, heightCm, color, true, ORDER_STROKE);
  q.getTransform().setLocalPosition(new vec3(x, y, z));
  return q;
}

/** Draw the four luminous edges of a rectangle. Colour as outline, never fill. */
export function makeOutline(
  parent: SceneObject,
  widthCm: number,
  heightCm: number,
  color: vec4,
  thicknessCm: number,
  z: number
): void {
  const hw = widthCm / 2;
  const hh = heightCm / 2;
  makeStroke(parent, "edgeTop", widthCm, thicknessCm, color, 0, hh, z);
  makeStroke(parent, "edgeBottom", widthCm, thicknessCm, color, 0, -hh, z);
  makeStroke(parent, "edgeLeft", thicknessCm, heightCm, color, -hw, 0, z);
  makeStroke(parent, "edgeRight", thicknessCm, heightCm, color, hw, 0, z);
}

/**
 * A dashed rectangle — the empty-slot / drop-preview treatment from the mockup.
 * Built from short strokes because there is no line shader here, only quads.
 */
export function makeDashedOutline(
  parent: SceneObject,
  widthCm: number,
  heightCm: number,
  color: vec4,
  thicknessCm: number,
  z: number
): SceneObject[] {
  const made: SceneObject[] = [];
  const dash = 0.5;
  const gap = 0.32;
  const step = dash + gap;
  const hw = widthCm / 2;
  const hh = heightCm / 2;

  const nx = Math.max(1, Math.floor(widthCm / step));
  const padX = (widthCm - (nx * step - gap)) / 2;
  for (let i = 0; i < nx; i++) {
    const x = -hw + padX + dash / 2 + i * step;
    made.push(makeStroke(parent, "dashT", dash, thicknessCm, color, x, hh, z));
    made.push(makeStroke(parent, "dashB", dash, thicknessCm, color, x, -hh, z));
  }

  const ny = Math.max(1, Math.floor(heightCm / step));
  const padY = (heightCm - (ny * step - gap)) / 2;
  for (let i = 0; i < ny; i++) {
    const y = -hh + padY + dash / 2 + i * step;
    made.push(makeStroke(parent, "dashL", thicknessCm, dash, color, -hw, y, z));
    made.push(makeStroke(parent, "dashR", thicknessCm, dash, color, hw, y, z));
  }
  return made;
}

/**
 * Dashes walking the rounded outline. Each dash is a small quad rotated to lie
 * along the path, so the corners read as curved rather than mitred.
 */
export function makeDashedRoundedOutline(
  parent: SceneObject,
  widthCm: number,
  heightCm: number,
  color: vec4,
  thicknessCm: number,
  radius: number = -1
): SceneObject[] {
  const r = radius < 0 ? radiusFor(widthCm, heightCm) : radius;
  const pts = outlinePoints(widthCm, heightCm, r);
  const made: SceneObject[] = [];

  // Resample the path at a fixed spacing so dash rhythm is even all the way round.
  const dash = 0.46;
  const gap = 0.3;
  const step = dash + gap;
  let carry = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const segLen = Math.sqrt(dx * dx + dy * dy);
    if (segLen < 0.0001) continue;
    const ang = Math.atan2(dy, dx);
    let d = carry;
    while (d < segLen) {
      const cx = a[0] + (dx * (d + dash / 2)) / segLen;
      const cy = a[1] + (dy * (d + dash / 2)) / segLen;
      const q = makeQuad(parent, "dash", dash, thicknessCm, color, true, ORDER_STROKE);
      const tr = q.getTransform();
      tr.setLocalPosition(new vec3(cx, cy, 0));
      tr.setLocalRotation(
        quat.angleAxis(Math.PI / 2, vec3.right()).multiply(quat.angleAxis(ang, vec3.forward()))
      );
      made.push(q);
      d += step;
    }
    carry = d - segLen;
  }
  return made;
}

export enum Align {
  Left,
  Center,
  Right,
}

/**
 * A text label authored in centimetres of cap height.
 *
 * Every label gets two treatments it did not have before Pass 11, and they are
 * the reason text now survives a busy camera feed:
 *
 *   weight 600  — synthetic bolding. Stroke thickness matters more than contrast
 *                 on an additive display, because a hairline stem simply loses to
 *                 background detail at the same spatial frequency.
 *   dark halo   — an outline pass in near-black. On the glasses it emits nothing,
 *                 so it is free; in the preview compositor it punches a dark
 *                 contour around every glyph, which is what stops an arch or a
 *                 palm frond from running straight through a letterform.
 */
export function makeLabel(
  parent: SceneObject,
  name: string,
  text: string,
  heightCm: number,
  color: vec4,
  align: Align,
  x: number,
  y: number,
  z: number,
  halo: boolean = true
): Text {
  const obj = global.scene.createSceneObject(name);
  obj.setParent(parent);
  const t = obj.createComponent("Component.Text");
  t.text = text;
  t.font = faceFor(heightCm);
  t.size = TEXT_BASE_SIZE;
  t.weight = TEXT_WEIGHT;
  t.textFill.color = color;
  t.verticalAlignment = VerticalAlignment.Center;
  t.horizontalAlignment =
    align === Align.Left
      ? HorizontalAlignment.Left
      : align === Align.Right
      ? HorizontalAlignment.Right
      : HorizontalAlignment.Center;
  if (halo) {
    const o = t.outlineSettings;
    o.enabled = true;
    o.size = HALO_SIZE;
    o.fill.color = new vec4(SCRIM.r, SCRIM.g, SCRIM.b, color.a * 0.85);
  }
  t.setRenderOrder(ORDER_TEXT);

  // CAP_SCALE is what keeps "heightCm is cap height in cm" true for a face whose
  // cap is a different share of its em than Inter's. Identity when SERIF is off.
  const s = heightCm * CAP_SCALE * TEXT_UNITS_PER_CM;
  obj.getTransform().setLocalScale(new vec3(s, s, s));
  obj.getTransform().setLocalPosition(new vec3(x, y, z));
  return t;
}

/**
 * Give a label its own fitted scrim plate.
 *
 * For text that floats free of any panel — the recap line, a rejection message,
 * the home screen's title — a whole rectangle of geometry would be the wrong
 * shape and the wrong amount of it. The Text component's own background pass
 * hugs the actual glyph run instead, so the plate is exactly as big as the words
 * and no bigger, and it follows the text when the text changes.
 */
/**
 * A centred label with its own fitted plate behind it.
 *
 * For text that floats free of any panel — the recap line, a rejection message,
 * the home screen's title — a whole rectangle of geometry would be the wrong
 * shape, but the Text component's own `backgroundSettings` proved unusable: its
 * `margins` are in a text-local space whose relationship to centimetres is not
 * documented and did not survive being derived twice (once far too large, once
 * far too small). So the plate is real geometry, sized from textWidth(), which
 * is measured and already trusted everywhere else in this file.
 *
 * Pass 17: the plate used to be a near-black scrim meant to hold the world off
 * the words, which is the one thing it could not do. It is now the same dim
 * neutral body every other surface is made of, so a floating label reads as a
 * small piece of the same glass rather than as a smudge.
 *
 * `widthCm` overrides the measured width for labels whose text changes at
 * runtime — size those for the longest string they can hold, not the first.
 */
export function makePlatedLabel(
  parent: SceneObject,
  name: string,
  text: string,
  heightCm: number,
  color: vec4,
  x: number,
  y: number,
  z: number,
  emission: number = BODY_CHIP,
  widthCm: number = -1
): Text {
  const w = (widthCm > 0 ? widthCm : textWidth(text, heightCm)) + heightCm * 1.4;
  const h = heightCm * 2.5;
  makeBody(parent, name + "Plate", w, h, emission, ORDER_SCRIM, Math.min(0.45, h / 2))
    .getTransform()
    .setLocalPosition(new vec3(x, y, z - 0.02));
  return makeLabel(parent, name, text, heightCm, color, Align.Center, x, y, z);
}

/**
 * Every Visual under a subtree, with the render order it was BUILT with.
 *
 * Read back from the objects rather than listed by the caller, because the
 * layers of a card or a ghost are assigned in several places — some of them
 * inside this file — and a hand-written table would be a second copy of that
 * arithmetic waiting to drift. Text and RenderMeshVisual both derive from
 * Visual, so one walk catches both.
 */
export function collectVisuals(
  root: SceneObject,
  out: { visual: Visual; order: number }[]
): void {
  const mesh = root.getComponent("Component.RenderMeshVisual");
  if (mesh) out.push({ visual: mesh, order: mesh.getRenderOrder() });
  const text = root.getComponent("Component.Text");
  if (text) out.push({ visual: text, order: text.getRenderOrder() });
  const n = root.getChildrenCount();
  for (let i = 0; i < n; i++) collectVisuals(root.getChild(i), out);
}

/** An empty grouping node at a position. */
export function makeGroup(
  parent: SceneObject,
  name: string,
  x: number,
  y: number,
  z: number
): SceneObject {
  const obj = global.scene.createSceneObject(name);
  if (parent) obj.setParent(parent);
  obj.getTransform().setLocalPosition(new vec3(x, y, z));
  return obj;
}

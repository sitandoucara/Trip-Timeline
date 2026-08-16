/**
 * Rounded-rectangle geometry, built at real size.
 *
 * A stretched unit quad would give elliptical corners on a 12x16 card, so each
 * mesh is generated at its actual centimetre dimensions and cached by size —
 * corners stay circular everywhere, which is the whole point of doing this in
 * geometry rather than with a scaled texture.
 *
 * Meshes are authored in the XY plane facing +Z, so unlike the plane preset they
 * need no rotation fix.
 */

const ARC_SEGMENTS = 5;
const cache: { [key: string]: RenderMesh } = {};

function layout(): any[] {
  return [
    { name: "position", components: 3 },
    { name: "texture0", components: 2 },
  ];
}

/** Sensible, subtle radius for a given box. */
export function radiusFor(w: number, h: number): number {
  const r = Math.min(w, h) * 0.16;
  return Math.min(0.9, r);
}

/** Outline points of a rounded rect, counter-clockwise from the bottom-right corner. */
export function outlinePoints(w: number, h: number, r: number): number[][] {
  const hw = w / 2;
  const hh = h / 2;
  const rad = Math.max(0, Math.min(r, Math.min(hw, hh)));
  const cx = hw - rad;
  const cy = hh - rad;
  const centres = [
    [cx, -cy, -Math.PI / 2],
    [cx, cy, 0],
    [-cx, cy, Math.PI / 2],
    [-cx, -cy, Math.PI],
  ];
  const pts: number[][] = [];
  for (let c = 0; c < 4; c++) {
    const ox = centres[c][0];
    const oy = centres[c][1];
    const start = centres[c][2];
    for (let i = 0; i <= ARC_SEGMENTS; i++) {
      const a = start + (i / ARC_SEGMENTS) * (Math.PI / 2);
      pts.push([ox + Math.cos(a) * rad, oy + Math.sin(a) * rad]);
    }
  }
  return pts;
}

/**
 * Filled rounded rectangle, triangle-fanned from the centre. UVs span the box.
 *
 * `uScale`/`vScale` shrink the UV window about its centre, which is how a
 * photograph is COVER-fitted instead of stretched: at 0.5 the mesh samples only
 * the middle half of the texture. Every thumbnail in this Lens is 768x512 (3:2),
 * and the detail panel's photograph is a 0.82 portrait, so without this the
 * image would be squeezed to 45% of its true aspect. See makeRoundedImage.
 */
export function roundedFillMesh(
  w: number,
  h: number,
  r: number,
  uScale: number = 1,
  vScale: number = 1
): RenderMesh {
  const key =
    "f_" +
    w.toFixed(2) +
    "_" +
    h.toFixed(2) +
    "_" +
    r.toFixed(2) +
    "_" +
    uScale.toFixed(3) +
    "_" +
    vScale.toFixed(3);
  if (cache[key]) return cache[key];

  const pts = outlinePoints(w, h, r);
  const verts: number[] = [];
  // centre vertex first
  verts.push(0, 0, 0, 0.5, 0.5);
  for (let i = 0; i < pts.length; i++) {
    const x = pts[i][0];
    const y = pts[i][1];
    verts.push(x, y, 0, (x / w) * uScale + 0.5, (y / h) * vScale + 0.5);
  }

  const indices: number[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = i + 1;
    const b = ((i + 1) % n) + 1;
    indices.push(0, a, b);
  }

  const builder = new MeshBuilder(layout());
  builder.topology = MeshTopology.Triangles;
  builder.indexType = MeshIndexType.UInt16;
  builder.appendVerticesInterleaved(verts);
  builder.appendIndices(indices);
  builder.updateMesh();
  cache[key] = builder.getMesh();
  return cache[key];
}

/** Rounded-rectangle ring — the luminous outline, as one piece of geometry. */
export function roundedRingMesh(
  w: number,
  h: number,
  r: number,
  thickness: number
): RenderMesh {
  const key =
    "r_" + w.toFixed(2) + "_" + h.toFixed(2) + "_" + r.toFixed(2) + "_" + thickness.toFixed(3);
  if (cache[key]) return cache[key];

  const outer = outlinePoints(w, h, r);
  const inner = outlinePoints(
    Math.max(0.01, w - thickness * 2),
    Math.max(0.01, h - thickness * 2),
    Math.max(0, r - thickness)
  );

  const verts: number[] = [];
  for (let i = 0; i < outer.length; i++) {
    verts.push(outer[i][0], outer[i][1], 0, 0, 0);
    verts.push(inner[i][0], inner[i][1], 0, 1, 1);
  }

  const indices: number[] = [];
  const n = outer.length;
  for (let i = 0; i < n; i++) {
    const o0 = i * 2;
    const i0 = i * 2 + 1;
    const o1 = ((i + 1) % n) * 2;
    const i1 = ((i + 1) % n) * 2 + 1;
    indices.push(o0, i0, o1);
    indices.push(i0, i1, o1);
  }

  const builder = new MeshBuilder(layout());
  builder.topology = MeshTopology.Triangles;
  builder.indexType = MeshIndexType.UInt16;
  builder.appendVerticesInterleaved(verts);
  builder.appendIndices(indices);
  builder.updateMesh();
  cache[key] = builder.getMesh();
  return cache[key];
}

/**
 * Screen point -> point on a world plane facing the user.
 *
 * Every interaction in this Lens resolves the same way: the whole composition
 * lives on one plane, so a pointer is a 2D position on that plane. Sharing one
 * implementation means the home screen and the drag can never disagree about
 * where the user is pointing.
 */
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider";

const camera = WorldCameraFinderProvider.getInstance();

/** Returns null when the ray runs parallel to the plane or points away from it. */
export function screenToPlane(pos: vec2, planeZ: number): vec3 {
  const origin = camera.screenSpaceToWorldSpace(pos.x, pos.y, 0);
  const far = camera.screenSpaceToWorldSpace(pos.x, pos.y, 500);
  const dir = far.sub(origin).normalize();
  if (Math.abs(dir.z) < 0.0001) return null;
  const t = (planeZ - origin.z) / dir.z;
  if (t <= 0) return null;
  return origin.add(dir.uniformScale(t));
}

/** Axis-aligned rectangle test on the plane. */
export function withinRect(
  p: vec3,
  centreX: number,
  centreY: number,
  width: number,
  height: number
): boolean {
  return (
    Math.abs(p.x - centreX) <= width / 2 && Math.abs(p.y - centreY) <= height / 2
  );
}

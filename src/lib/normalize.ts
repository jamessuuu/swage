/**
 * normalize.ts — SPEC.md §3.3.
 *
 * ZERO dependencies: no browser API, no Node API, no framework import. This
 * file is imported UNMODIFIED by both scripts/train.ts (Node, via tsx) and
 * the browser bundle (src/lib/classifier.ts's caller). That is the load-
 * bearing boundary rule in SPEC.md §4 — if trainer and browser ever ran
 * different normalization code, the model would silently skew between train
 * and serve. Do not import anything into this file.
 *
 * Pipeline (SPEC.md §3.3): handedness canonicalization -> translate (wrist
 * to origin) -> scale (wrist->middle-MCP distance to 1) -> in-plane rotate
 * (middle-MCP to a fixed canonical angle) -> flatten to 63 floats.
 *
 * Two implementation choices SPEC.md leaves open, decided and documented
 * here so train/serve stay consistent (the only thing that actually matters
 * — the exact canonical angle is arbitrary, being consistent is not):
 *   - The scale distance (step 3) uses only x/y. MediaPipe's z is relative
 *     depth on a different, noisier scale than the normalized x/y image
 *     plane (SPEC.md §3.3 "Named limitation"); folding it into a 3D distance
 *     would let depth noise perturb the scale of every other coordinate.
 *   - The canonical angle (step 4) is -pi/2, i.e. after normalization
 *     landmark 9 sits at (0, -1): "up" in image space, where +y is down.
 */

export interface RawLandmark {
  x: number;
  y: number;
  z: number;
}

export type Handedness = "Left" | "Right";

/** Exactly 21 landmarks per MediaPipe HandLandmarker's output contract. */
export const LANDMARK_COUNT = 21;

/** wrist */
const WRIST = 0;
/** middle finger MCP (knuckle) */
const MIDDLE_MCP = 9;

/** The fixed angle (radians) landmark 9 is rotated onto. Arbitrary but fixed. */
const CANONICAL_ANGLE = -Math.PI / 2;

/** Output vector length: 21 landmarks x {x,y,z}. */
export const VECTOR_LENGTH = LANDMARK_COUNT * 3;

export class NormalizeError extends Error {}

/**
 * Turns a raw, un-normalized 21-point hand landmark set into a 63-dim
 * Float32Array that is invariant to handedness, hand position, hand size
 * (camera distance), and in-plane (2D) rotation. Out-of-plane rotation is
 * NOT corrected — SPEC.md §3.3's named limitation.
 */
export function normalizeLandmarks(
  landmarks: readonly RawLandmark[],
  handedness: Handedness,
): Float32Array {
  if (landmarks.length !== LANDMARK_COUNT) {
    throw new NormalizeError(
      `expected exactly ${LANDMARK_COUNT} landmarks, got ${landmarks.length}`,
    );
  }

  // Step 1 — handedness canonicalization: mirror Left onto Right so every
  // sample trains/infers on a canonical right hand (SPEC.md §3.3.1).
  const mirrored: { x: number; y: number; z: number }[] = landmarks.map((p) => ({
    x: handedness === "Left" ? 1 - p.x : p.x,
    y: p.y,
    z: p.z,
  }));

  const wrist = mirrored[WRIST];
  const middleMcp = mirrored[MIDDLE_MCP];
  if (!wrist || !middleMcp) {
    // Unreachable given the length check above (WRIST/MIDDLE_MCP < 21), but
    // noUncheckedIndexedAccess means the type system cannot know that.
    throw new NormalizeError("wrist or middle-MCP landmark missing");
  }

  // Step 2 — translation: wrist becomes the origin.
  const translated = mirrored.map((p) => ({
    x: p.x - wrist.x,
    y: p.y - wrist.y,
    z: p.z - wrist.z,
  }));

  // Step 3 — scale: wrist->middle-MCP distance (x/y only, see file header)
  // becomes 1. A hand with all landmarks coincident (degenerate/garbage
  // input) would divide by zero; guard rather than emit NaN into the model.
  const mcpAfterTranslate = translated[MIDDLE_MCP];
  if (!mcpAfterTranslate) {
    throw new NormalizeError("middle-MCP landmark missing after translation");
  }
  const scale = Math.hypot(mcpAfterTranslate.x, mcpAfterTranslate.y);
  if (!(scale > 1e-9)) {
    throw new NormalizeError(
      "degenerate hand: wrist and middle-MCP landmarks coincide",
    );
  }
  const scaled = translated.map((p) => ({
    x: p.x / scale,
    y: p.y / scale,
    z: p.z / scale,
  }));

  // Step 4 — in-plane rotation: rotate every (x, y) so landmark 9 lands on
  // CANONICAL_ANGLE. z is scaled but never rotated (SPEC.md §3.3.4).
  const mcpAfterScale = scaled[MIDDLE_MCP];
  if (!mcpAfterScale) {
    throw new NormalizeError("middle-MCP landmark missing after scaling");
  }
  const theta = Math.atan2(mcpAfterScale.y, mcpAfterScale.x);
  const delta = CANONICAL_ANGLE - theta;
  const cos = Math.cos(delta);
  const sin = Math.sin(delta);

  // Step 5 — flatten to a 63-dim Float32Array, landmark index order.
  const out = new Float32Array(VECTOR_LENGTH);
  for (let i = 0; i < LANDMARK_COUNT; i++) {
    const p = scaled[i];
    if (!p) {
      throw new NormalizeError(`landmark ${i} missing after scaling`);
    }
    const rx = p.x * cos - p.y * sin;
    const ry = p.x * sin + p.y * cos;
    const base = i * 3;
    out[base] = rx;
    out[base + 1] = ry;
    out[base + 2] = p.z;
  }
  return out;
}

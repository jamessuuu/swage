import { describe, expect, it } from "vitest";
import {
  LANDMARK_COUNT,
  NormalizeError,
  normalizeLandmarks,
  type RawLandmark,
} from "./normalize";

/** 21 zeroed landmarks, then override the indices a fixture cares about. */
function landmarks(overrides: Record<number, RawLandmark>): RawLandmark[] {
  const base: RawLandmark[] = Array.from({ length: LANDMARK_COUNT }, () => ({
    x: 0,
    y: 0,
    z: 0,
  }));
  for (const [idx, point] of Object.entries(overrides)) {
    base[Number(idx)] = point;
  }
  return base;
}

// The 5 fixtures below are hand-computed (SPEC.md §8.1: "5 hand-computed
// fixture vectors (translation/scale/rotation/handedness tested
// individually)"). Each is constructed so the OTHER three transform steps
// are no-ops, isolating exactly one step's arithmetic. Math shown in each
// comment so a reviewer can re-derive the expected numbers without running
// the code.

describe("normalizeLandmarks", () => {
  it("fixture 1: already-canonical input is a no-op (identity)", () => {
    // wrist at origin, middle-MCP already at distance 1, angle -pi/2 (0,-1).
    const input = landmarks({
      0: { x: 0, y: 0, z: 0 },
      9: { x: 0, y: -1, z: 0.25 },
    });
    const out = normalizeLandmarks(input, "Right");
    expect(out[0]).toBeCloseTo(0, 5); // landmark0.x
    expect(out[1]).toBeCloseTo(0, 5); // landmark0.y
    expect(out[2]).toBeCloseTo(0, 5); // landmark0.z
    expect(out[9 * 3 + 0]).toBeCloseTo(0, 5);
    expect(out[9 * 3 + 1]).toBeCloseTo(-1, 5);
    expect(out[9 * 3 + 2]).toBeCloseTo(0.25, 5); // z scaled by 1, unchanged
  });

  it("fixture 2: pure translation — wrist offset from the origin cancels out", () => {
    // Same relative geometry as fixture 1 (distance 1, angle -pi/2) but the
    // whole hand is offset by (5,5,5). Translation must recover the exact
    // fixture-1 output.
    const input = landmarks({
      0: { x: 5, y: 5, z: 5 },
      9: { x: 5, y: 4, z: 5 },
    });
    const out = normalizeLandmarks(input, "Right");
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[1]).toBeCloseTo(0, 5);
    expect(out[9 * 3 + 0]).toBeCloseTo(0, 5);
    expect(out[9 * 3 + 1]).toBeCloseTo(-1, 5);
  });

  it("fixture 3: pure scale — a wrist->MCP distance of 2 normalizes to 1", () => {
    // Already at the canonical angle (-pi/2), so only step 3 has work to do.
    const input = landmarks({
      0: { x: 0, y: 0, z: 0 },
      9: { x: 0, y: -2, z: 0 },
    });
    const out = normalizeLandmarks(input, "Right");
    expect(out[9 * 3 + 0]).toBeCloseTo(0, 5);
    expect(out[9 * 3 + 1]).toBeCloseTo(-1, 5); // -2 / scale(2) == -1
  });

  it("fixture 4: pure rotation — MCP at angle 0 rotates onto -pi/2", () => {
    // Distance from origin is already 1 (no scaling to do); angle is 0
    // (pointing along +x), which must rotate onto the canonical -pi/2.
    const input = landmarks({
      0: { x: 0, y: 0, z: 0 },
      9: { x: 1, y: 0, z: 0 },
    });
    const out = normalizeLandmarks(input, "Right");
    // delta = -pi/2 - 0 = -pi/2; rotating (1,0) by -pi/2 gives (0,-1).
    expect(out[9 * 3 + 0]).toBeCloseTo(0, 5);
    expect(out[9 * 3 + 1]).toBeCloseTo(-1, 5);
  });

  it("fixture 5: handedness — Left mirrors x before everything else", () => {
    // landmark0 and landmark9 share the same x (0.2) so their post-mirror,
    // post-translate geometry is identical to fixture 1 regardless of
    // whether mirroring ran — landmark1 is the discriminator: only mirroring
    // flips its sign relative to the wrist.
    const input = landmarks({
      0: { x: 0.2, y: 0, z: 0 },
      9: { x: 0.2, y: -1, z: 0 },
      1: { x: 0.5, y: 0, z: 0 },
    });
    const out = normalizeLandmarks(input, "Left");
    // Mirror: x -> 1-x. wrist.x: 0.8, mcp.x: 0.8, landmark1.x: 0.5.
    // Translate (subtract wrist 0.8): wrist->0, mcp->(0,-1), landmark1->(-0.3,0).
    // Scale/rotate are no-ops (mcp already at distance 1, angle -pi/2).
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[9 * 3 + 1]).toBeCloseTo(-1, 5);
    expect(out[1 * 3 + 0]).toBeCloseTo(-0.3, 5);
    // Without mirroring landmark1.x would translate to +0.3, not -0.3 — the
    // sign is the whole assertion.
  });

  it("rejects a landmark set that is not exactly 21 points", () => {
    const tooFew = landmarks({}).slice(0, 20);
    expect(() => normalizeLandmarks(tooFew, "Right")).toThrow(NormalizeError);
  });

  it("rejects a degenerate hand (wrist and middle-MCP coincide)", () => {
    const input = landmarks({ 0: { x: 0.4, y: 0.4, z: 0 }, 9: { x: 0.4, y: 0.4, z: 0 } });
    expect(() => normalizeLandmarks(input, "Right")).toThrow(NormalizeError);
  });

  it("output is always length 63 (21 landmarks x xyz)", () => {
    const input = landmarks({ 0: { x: 0, y: 0, z: 0 }, 9: { x: 0, y: -1, z: 0 } });
    expect(normalizeLandmarks(input, "Right")).toHaveLength(63);
  });
});

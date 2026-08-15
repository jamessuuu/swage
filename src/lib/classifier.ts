/**
 * classifier.ts — SPEC.md §4, §5.
 *
 * *** M1 WALKING-SKELETON STUB ***
 * SPEC.md's build order (M1 row) explicitly calls for a "stub classifier
 * (2-3 letters)" here, to derisk the camera -> landmarker -> normalize ->
 * classify -> overlay pipeline before any model exists. This file's exports
 * (`LETTERS`, `classify`) are the real, frozen API surface (SPEC.md §5) —
 * only the body of `classify()` is temporary. M4 replaces the body with the
 * committed model's hand-rolled forward pass (63 -> Dense(48, relu) ->
 * Dense(24, softmax)), parity-tested against tfjs's own predict().
 *
 * The stub below is a genuine (not faked) rule on the real normalized
 * vector — counting how many of the four non-thumb fingers are extended,
 * by comparing each fingertip's distance from the wrist (the origin, after
 * normalize.ts) against its own knuckle's distance. That is enough signal
 * to tell an open hand ("B") from a closed fist ("A") apart live, which is
 * all M1's verifier requires ("a real hand produces a live-updating
 * label") — it is not, and is never presented as, a trained classifier.
 */

export type Letter =
  | "A"
  | "B"
  | "C"
  | "D"
  | "E"
  | "F"
  | "G"
  | "H"
  | "I"
  | "K"
  | "L"
  | "M"
  | "N"
  | "O"
  | "P"
  | "Q"
  | "R"
  | "S"
  | "T"
  | "U"
  | "V"
  | "W"
  | "X"
  | "Y";

/** 24 static classes, alphabetical = softmax index order (SPEC.md §3.4). No J or Z. */
export const LETTERS: readonly Letter[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "O", "P",
  "Q", "R", "S", "T", "U", "V", "W", "X", "Y",
];

export interface ClassifyResult {
  letter: Letter;
  confidence: number;
  distribution: Float32Array;
}

// landmark index -> [tip, mcp] pairs for the four non-thumb fingers.
const FINGER_TIP_MCP: readonly [number, number][] = [
  [8, 5], // index
  [12, 9], // middle
  [16, 13], // ring
  [20, 17], // pinky
];

function distFromWrist(vec63: Float32Array, landmarkIndex: number): number {
  const base = landmarkIndex * 3;
  const x = vec63[base] ?? 0;
  const y = vec63[base + 1] ?? 0;
  return Math.hypot(x, y);
}

/**
 * M1 stub forward pass. Input must already be normalize.ts's output (63-dim,
 * wrist at the origin) — this function does no normalization itself.
 */
export function classify(vec63: Float32Array): ClassifyResult {
  if (vec63.length !== 63) {
    throw new Error(`classify() stub expects a 63-dim vector, got ${vec63.length}`);
  }

  let extended = 0;
  for (const [tip, mcp] of FINGER_TIP_MCP) {
    if (distFromWrist(vec63, tip) > distFromWrist(vec63, mcp) * 1.15) {
      extended++;
    }
  }

  const letter: Letter = extended >= 3 ? "B" : "A";
  // Confidence is a stand-in proportional to how decisive the finger count
  // was, not a real softmax probability — the stub has no distribution.
  const confidence = extended >= 3 || extended === 0 ? 0.9 : 0.6;

  const distribution = new Float32Array(LETTERS.length);
  const idx = LETTERS.indexOf(letter);
  distribution[idx] = confidence;

  return { letter, confidence, distribution };
}

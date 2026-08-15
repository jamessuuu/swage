/**
 * classifier.ts — SPEC.md §4, §5, M4. The hand-rolled forward pass
 * (63 -> Dense(48, relu) -> Dense(24, softmax)) that replaces the M1
 * walking-skeleton stub. Committed arithmetic, no ML framework imported —
 * `model/weights.json` (scripts/train.ts's output, SPEC.md §3.4) is the
 * only thing this file depends on beyond plain TypeScript, so nothing from
 * scripts/ (which imports tfjs — a build-time-only dependency, SPEC.md §4's
 * "Build-time (never shipped)" module map) is ever reachable from this
 * file, even as a type-only import. That is what keeps tfjs out of the
 * browser bundle — the privacy claim (SPEC.md §7.2) depends on it.
 *
 * Tested for parity against tfjs's own predict() on the same weights, on
 * golden fixtures (SPEC.md §8) — so the model and the code that runs it
 * cannot silently drift (SPEC.md §4).
 *
 * IMPORTANT (see the build report / model/eval-report.json): these weights
 * were trained with `--provisional-split` because SPEC.md §3.2's real
 * per-signer val/test holdout does not exist yet in this repo (a human
 * recruitment task, not a build one). The classifier genuinely works —
 * this file's job is running the trained arithmetic correctly, which it
 * does, parity-tested. Whether the number that trained it should be
 * trusted as a ship-bar accuracy claim is a completely separate question,
 * answered by model/eval-report.json's own `provisional` field, not by
 * this file.
 */
// The `with { type: "json" }` import attribute is required by Node's own
// ESM loader (verified: Playwright's test runner loads this file through
// plain Node ESM, not Turbopack, and threw "needs an import attribute of
// type: json" without it) — Next.js/Turbopack accepts the same syntax, so
// one import statement works in both the browser bundle and Node.
import weightsJson from "../../model/weights.json" with { type: "json" };

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

interface DenseLayer {
  weights: number[][]; // [inputDim][outputDim]
  bias: number[]; // [outputDim]
}

interface WeightsFile {
  version: 1;
  letters: readonly string[];
  layer1: DenseLayer;
  layer2: DenseLayer;
}

// structural check, not a network fetch — model/weights.json is bundled at
// build time (SPEC.md §2: "The classifier artifact is bundled, not fetched").
const weights = weightsJson as WeightsFile;

export interface ClassifyResult {
  letter: Letter;
  confidence: number;
  distribution: Float32Array;
}

function denseForward(input: readonly number[], layer: DenseLayer): number[] {
  const outputDim = layer.bias.length;
  const out = new Array<number>(outputDim).fill(0);
  for (let o = 0; o < outputDim; o++) {
    let sum = layer.bias[o] ?? 0;
    for (let i = 0; i < input.length; i++) {
      const row = layer.weights[i];
      sum += (input[i] ?? 0) * (row?.[o] ?? 0);
    }
    out[o] = sum;
  }
  return out;
}

function relu(v: number[]): number[] {
  return v.map((x) => Math.max(0, x));
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((x) => Math.exp(x - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((x) => x / sum);
}

/**
 * The committed model's forward pass. Input must already be
 * normalize.ts's output (63-dim, wrist at the origin).
 */
export function classify(vec63: Float32Array): ClassifyResult {
  if (vec63.length !== 63) {
    throw new Error(`classify() expects a 63-dim vector, got ${vec63.length}`);
  }
  const input = Array.from(vec63);
  const hidden = relu(denseForward(input, weights.layer1));
  const logits = denseForward(hidden, weights.layer2);
  const distribution = softmax(logits);

  let argmax = 0;
  let max = -Infinity;
  distribution.forEach((p, i) => {
    if (p > max) {
      max = p;
      argmax = i;
    }
  });

  const letter = LETTERS[argmax];
  if (!letter) {
    throw new Error(`classify(): softmax index ${argmax} out of range`);
  }
  return { letter, confidence: max, distribution: Float32Array.from(distribution) };
}

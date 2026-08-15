/**
 * train.ts — SPEC.md §3.4, §10 M3: `pnpm train` runs tfjs-WASM training
 * against the frozen split, writing model/weights.json + eval-report.json.
 *
 * SPEC.md §3.2's real credibility bar needs >=1 held-out val signer and
 * >=1 held-out test signer in data/self-collected/ (see
 * scripts/data-check.ts). As of this build that is not met — recruiting
 * volunteers is a human task (data/ATTRIBUTION.md, showcase-program/
 * PHASE-2.md). Default behaviour here matches data-check.ts's own
 * philosophy: REFUSE rather than silently produce a claim SPEC.md's own
 * words call "inflated" and "meaningless" without a genuine per-signer
 * holdout.
 *
 * `--provisional-split` is the explicit, named opt-out: trains on a
 * stratified random FILE-level split of the asl-now pool alone (never
 * signer-level, because no signer field exists for that source), and
 * marks every output (eval-report.json's own `provisional: true` field,
 * console output, and every UI surface that reads it — /docs/concept,
 * the landing page) impossible to mistake for the real ship-bar claim.
 * This is what lets M4-M9 be built and demoed for real while the actual
 * per-signer evaluation remains outstanding — see the build report.
 *
 * Usage:
 *   pnpm run train                     # refuses unless real val/test signers exist
 *   pnpm run train -- --provisional-split
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import * as tf from "@tensorflow/tfjs";
import "@tensorflow/tfjs-backend-wasm";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";
import { LETTERS, type Letter } from "../src/lib/classifier";
import { createModel, extractWeights, FIXED_SEED } from "./model";
import {
  loadAslNowSamples,
  loadSelfCollectedSamples,
  seededShuffle,
  splitBySignerAssignment,
  stratifiedRandomSplit,
  toLabeledSample,
  type LabeledSample,
  type RawSample,
  type Split,
} from "./train-data";
import { checkHeldOutCoverage, loadSplits } from "./data-check";

const REPO_ROOT = join(import.meta.dirname, "..");
const ASL_NOW_DIR = join(REPO_ROOT, "data", "asl-now");
const SELF_COLLECTED_DIR = join(REPO_ROOT, "data", "self-collected");
const WEIGHTS_PATH = join(REPO_ROOT, "model", "weights.json");
const EVAL_REPORT_PATH = join(REPO_ROOT, "model", "eval-report.json");

const PROVISIONAL_RATIOS = { val: 0.15, test: 0.15 };
const EPOCHS = 60;
const BATCH_SIZE = 32;
const CONFIDENCE_CANDIDATES = [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9];
const TOP_CONFUSABLE_PAIRS = 6;

function toXY(samples: readonly LabeledSample[]): { xs: tf.Tensor2D; ys: tf.Tensor2D } {
  const xs = tf.tensor2d(samples.map((s) => Array.from(s.vec)));
  const ys = tf.oneHot(
    tf.tensor1d(
      samples.map((s) => s.letterIndex),
      "int32",
    ),
    LETTERS.length,
  ).toFloat() as tf.Tensor2D;
  return { xs, ys };
}

/** Confusion matrix + per-letter precision/recall/F1 from raw predictions. */
export function evaluate(trueIdx: number[], predIdx: number[]) {
  const n = LETTERS.length;
  const matrix: number[][] = Array.from({ length: n }, () => Array(n).fill(0) as number[]);
  for (let i = 0; i < trueIdx.length; i++) {
    const t = trueIdx[i] as number;
    const p = predIdx[i] as number;
    const row = matrix[t] as number[];
    row[p] = (row[p] ?? 0) + 1;
  }

  const perLetter: Record<string, { precision: number; recall: number; f1: number; support: number }> = {};
  let correct = 0;
  for (let i = 0; i < n; i++) {
    const row = matrix[i] as number[];
    const support = row.reduce((a, b) => a + b, 0);
    const tp = row[i] ?? 0;
    correct += tp;
    const predictedAsI = matrix.reduce((sum, r) => sum + (r[i] ?? 0), 0);
    const precision = predictedAsI > 0 ? tp / predictedAsI : 0;
    const recall = support > 0 ? tp / support : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    perLetter[LETTERS[i] as Letter] = {
      precision: round(precision),
      recall: round(recall),
      f1: round(f1),
      support,
    };
  }
  const overallAccuracy = trueIdx.length > 0 ? correct / trueIdx.length : 0;

  const pairs: { pair: [Letter, Letter]; count: number }[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const row = matrix[i] as number[];
      const c = row[j] ?? 0;
      if (c > 0) pairs.push({ pair: [LETTERS[i] as Letter, LETTERS[j] as Letter], count: c });
    }
  }
  pairs.sort((a, b) => b.count - a.count);
  const confusablePairs = pairs.slice(0, TOP_CONFUSABLE_PAIRS).map((p) => p.pair);

  return { matrix, perLetter, overallAccuracy: round(overallAccuracy), confusablePairs };
}

function round(n: number, digits = 4): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Sweeps CONFIDENCE_CANDIDATES on the val split, picks the threshold that
 * maximizes macro-F1 among predictions kept above it (SPEC.md §12.2). */
export function tuneConfidenceThreshold(
  valTrue: number[],
  valProbs: number[][],
): number {
  let best = CONFIDENCE_CANDIDATES[0] as number;
  let bestF1 = -1;
  for (const threshold of CONFIDENCE_CANDIDATES) {
    const kept: { t: number; p: number }[] = [];
    for (let i = 0; i < valProbs.length; i++) {
      const probs = valProbs[i] as number[];
      let argmax = 0;
      let max = -Infinity;
      probs.forEach((p, idx) => {
        if (p > max) {
          max = p;
          argmax = idx;
        }
      });
      if (max >= threshold) kept.push({ t: valTrue[i] as number, p: argmax });
    }
    if (kept.length === 0) continue;
    const { perLetter } = evaluate(
      kept.map((k) => k.t),
      kept.map((k) => k.p),
    );
    const f1s = Object.values(perLetter)
      .filter((l) => l.support > 0)
      .map((l) => l.f1);
    const macroF1 = f1s.length > 0 ? f1s.reduce((a, b) => a + b, 0) / f1s.length : 0;
    // Ties broken toward the higher threshold — a stricter "held" bar is
    // the safer default for a live classifier (SPEC.md F7: never silently
    // guess below threshold).
    if (macroF1 >= bestF1) {
      bestF1 = macroF1;
      best = threshold;
    }
  }
  return best;
}

async function predictAll(model: tf.Sequential, samples: readonly LabeledSample[]) {
  if (samples.length === 0) return { trueIdx: [] as number[], predIdx: [] as number[], probs: [] as number[][] };
  const { xs } = toXY(samples);
  const predsTensor = model.predict(xs) as tf.Tensor2D;
  const probs = (await predsTensor.array()) as number[][];
  xs.dispose();
  predsTensor.dispose();
  const predIdx = probs.map((row) => row.indexOf(Math.max(...row)));
  return { trueIdx: samples.map((s) => s.letterIndex), predIdx, probs };
}

async function main(): Promise<void> {
  const provisional = process.argv.includes("--provisional-split");

  // Node, not the browser: the wasm binary has to come from the local
  // filesystem (node_modules), not a CDN URL — setWasmPaths' README-
  // documented CDN pattern is browser-only. Verified empirically: pointing
  // this at a CDN URL under Node silently fell back to the plain JS "cpu"
  // backend rather than throwing, which is exactly the kind of quiet
  // degradation the assertion right after this call exists to catch.
  const require = createRequire(import.meta.url);
  const wasmDir = dirname(require.resolve("@tensorflow/tfjs-backend-wasm/dist/tfjs-backend-wasm.wasm"));
  setWasmPaths(wasmDir + "/");
  await tf.setBackend("wasm");
  await tf.ready();
  console.log(`tfjs backend: ${tf.getBackend()}`);
  if (tf.getBackend() !== "wasm") {
    throw new Error(
      `expected the wasm backend (SPEC.md §2: "tfjs-WASM"), got "${tf.getBackend()}" instead — refusing to ` +
        "train silently on a different backend.",
    );
  }

  const aslNow = loadAslNowSamples(ASL_NOW_DIR);
  const selfCollected = loadSelfCollectedSamples(SELF_COLLECTED_DIR);
  const splitsFile = loadSplits();
  const coverage = checkHeldOutCoverage(
    splitsFile,
    Object.entries(
      selfCollected.reduce<Record<string, Record<string, number>>>((acc, s) => {
        acc[s.source] ??= {};
        const letterCounts = acc[s.source] as Record<string, number>;
        letterCounts[s.letter] = (letterCounts[s.letter] ?? 0) + 1;
        return acc;
      }, {}),
    ).map(([signerId, perLetterCounts]) => ({ signerId, perLetterCounts })),
  );

  let split: Split<RawSample>;
  let splitMethod: "per-signer" | "random-file-level";
  let provisionalReason: string | undefined;

  if (coverage.ok) {
    split = splitBySignerAssignment(aslNow, selfCollected, splitsFile.selfCollectedSigners);
    splitMethod = "per-signer";
  } else if (provisional) {
    console.warn(
      "\n*** PROVISIONAL RUN ***\n" +
        "No real per-signer val/test holdout exists yet (`pnpm run data-check` fails on\n" +
        "held-out coverage). Training on a random FILE-level split of the asl-now pool\n" +
        "alone. These numbers do NOT meet SPEC.md §3.2's credibility bar and must never\n" +
        "be presented as the product's real evaluation — every consumer of\n" +
        "model/eval-report.json must check its `provisional` field.\n",
    );
    split = stratifiedRandomSplit(aslNow, PROVISIONAL_RATIOS, FIXED_SEED);
    splitMethod = "random-file-level";
    provisionalReason =
      "No real per-signer val/test holdout exists (data/self-collected/ is empty — " +
      "volunteer recruitment is a human task, see data/ATTRIBUTION.md). This split is " +
      "a random, file-level (not signer-level) division of the single-source asl-now " +
      "pool, run only because --provisional-split was passed explicitly. It does not " +
      "test generalization to an unseen signer and must not be read as SPEC.md §3.2's " +
      "actual ship-bar claim.";
  } else {
    console.error(
      "\nRefusing to train: no real per-signer val/test holdout exists yet.\n" +
        "Run `pnpm run data-check` to see the current (honest) status.\n" +
        "This is the correct behaviour, not a bug — SPEC.md §3.2's whole credibility\n" +
        "bar depends on a genuine held-out signer, and none exists in this repo yet.\n\n" +
        "To train anyway, for pipeline development/demo purposes ONLY, with every\n" +
        "output explicitly marked provisional and unfit as the real ship claim, pass:\n" +
        "  pnpm run train -- --provisional-split\n",
    );
    process.exit(1);
    return;
  }

  const trainLabeled = split.train.map(toLabeledSample);
  const valLabeled = split.val.map(toLabeledSample);
  const testLabeled = split.test.map(toLabeledSample);
  console.log(`train=${trainLabeled.length} val=${valLabeled.length} test=${testLabeled.length} (method: ${splitMethod})`);

  const shuffledTrain = seededShuffle(trainLabeled, FIXED_SEED);
  const { xs: trainXs, ys: trainYs } = toXY(shuffledTrain);
  const { xs: valXs, ys: valYs } = toXY(valLabeled);

  const model = createModel();
  await model.fit(trainXs, trainYs, {
    epochs: EPOCHS,
    batchSize: BATCH_SIZE,
    shuffle: false, // pre-shuffled with a fixed seed above, for reproducibility
    validationData: valLabeled.length > 0 ? [valXs, valYs] : undefined,
    verbose: 0,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if (epoch === 0 || (epoch + 1) % 10 === 0) {
          console.log(
            `  epoch ${epoch + 1}/${EPOCHS} loss=${logs?.loss?.toFixed(4)} acc=${logs?.acc?.toFixed(4)}` +
              (logs?.val_acc !== undefined ? ` val_acc=${logs.val_acc.toFixed(4)}` : ""),
          );
        }
      },
    },
  });
  trainXs.dispose();
  trainYs.dispose();
  valXs.dispose();
  valYs.dispose();

  const valPred = await predictAll(model, valLabeled);
  const confidenceThreshold =
    valPred.probs.length > 0 ? tuneConfidenceThreshold(valPred.trueIdx, valPred.probs) : (CONFIDENCE_CANDIDATES[3] as number);
  console.log(`confidenceThreshold tuned on val: ${confidenceThreshold}`);

  const testPred = await predictAll(model, testLabeled);
  const { matrix, perLetter, overallAccuracy, confusablePairs } = evaluate(testPred.trueIdx, testPred.predIdx);
  console.log(`test overallAccuracy = ${(overallAccuracy * 100).toFixed(1)}%`);
  if (!provisional) {
    console.log(
      overallAccuracy >= 0.7
        ? "PASS — meets SPEC.md §3.4's >=70% ship bar."
        : "BELOW SPEC.md §3.4's >=70% ship bar — per SPEC.md, the fix is more self-collected data, never a lowered bar.",
    );
  }

  const weights = await extractWeights(model);
  writeFileSync(WEIGHTS_PATH, JSON.stringify(weights));
  console.log(`wrote ${WEIGHTS_PATH} (${(JSON.stringify(weights).length / 1024).toFixed(1)}KB)`);

  const evalReport = {
    version: 1 as const,
    provisional,
    ...(provisionalReason ? { provisionalReason } : {}),
    generatedAt: new Date().toISOString(),
    splitMethod,
    trainCount: trainLabeled.length,
    valCount: valLabeled.length,
    testCount: testLabeled.length,
    overallAccuracy,
    shipBarMet: !provisional && overallAccuracy >= 0.7,
    confidenceThreshold,
    letters: LETTERS,
    confusionMatrix: matrix,
    perLetter,
    confusablePairs,
  };
  writeFileSync(EVAL_REPORT_PATH, JSON.stringify(evalReport, null, 2));
  console.log(`wrote ${EVAL_REPORT_PATH}`);

  model.dispose();
}

// Only run when executed directly (tsx scripts/train.ts), not when the
// pure, exported helpers above are imported by scripts/train.test.ts —
// importing this file must never have the side effect of training a model.
if (process.argv[1] && process.argv[1].endsWith("train.ts")) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}

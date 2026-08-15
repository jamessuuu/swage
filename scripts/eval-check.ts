/**
 * eval-check.ts — CI stage 5/5 (SPEC.md §8): "typecheck -> lint -> unit ->
 * e2e:smoke -> eval". Three gates, deliberately different-shaped, not
 * pretending a probabilistic system is deterministic:
 *
 *  1. Classifier fixture eval (probabilistic, honest bar): the COMMITTED
 *     normalize.ts + classifier.ts against 72 frozen golden landmark
 *     samples (tests/fixtures/golden-landmarks/, scripts/
 *     freeze-golden-fixtures.ts) — never retrains. Asserts >=70% pass
 *     rate (SPEC.md §3.4/§8.1).
 *  2. Interaction/pipeline eval (deterministic, zero tolerance): the
 *     scripted stability.ts scenarios (src/lib/stability.scenarios.ts) —
 *     100% pass bar, like sluice's chaos invariants.
 *  3. eval-report.json drift check: reconstructs the exact test split
 *     that produced the committed model/eval-report.json (same seeded
 *     stratifiedRandomSplit, no retraining — only classify() runs) and
 *     fails if the recomputed numbers disagree with what's committed.
 *     "The methodology page and the repo cannot disagree."
 *
 * IMPORTANT: this gate does not, and cannot, certify SPEC.md §3.2's real
 * per-signer ship bar — that requires data that does not exist yet (see
 * data/ATTRIBUTION.md). It certifies that the COMMITTED artifacts are
 * internally consistent and that the classifier genuinely works on held-
 * out samples, which is real, checkable, and worth gating regardless.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { classify, LETTERS, type Letter } from "../src/lib/classifier";
import { normalizeLandmarks, type RawLandmark } from "../src/lib/normalize";
import { runAllScenarios } from "../src/lib/stability.scenarios";
import { loadAslNowSamples, stratifiedRandomSplit, toLabeledSample } from "./train-data";
import { evaluate } from "./train";
import { FIXED_SEED } from "./model";

const REPO_ROOT = join(import.meta.dirname, "..");
const GOLDEN_DIR = join(REPO_ROOT, "tests", "fixtures", "golden-landmarks");
const ASL_NOW_DIR = join(REPO_ROOT, "data", "asl-now");
const EVAL_REPORT_PATH = join(REPO_ROOT, "model", "eval-report.json");
const PROVISIONAL_RATIOS = { val: 0.15, test: 0.15 }; // must match scripts/train.ts

const CLASSIFIER_FIXTURE_PASS_BAR = 0.7; // SPEC.md §3.4/§8.1

let failures = 0;

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

function fail(message: string): void {
  failures++;
  console.error(`  FAIL  ${message}`);
}

// --- 1. Classifier fixture eval -------------------------------------------
function classifierFixtureEval(): void {
  section("1/3 classifier fixture eval (probabilistic)");
  let correct = 0;
  let total = 0;
  for (const letter of LETTERS) {
    const dir = join(GOLDEN_DIR, letter);
    if (!existsSync(dir)) {
      fail(`golden fixture directory missing for letter ${letter}: ${dir}`);
      continue;
    }
    for (const file of readdirSync(dir)) {
      if (!file.endsWith(".json")) continue;
      const landmarks = JSON.parse(readFileSync(join(dir, file), "utf8")) as RawLandmark[];
      const vec = normalizeLandmarks(landmarks, "Right");
      const { letter: predicted } = classify(vec);
      total++;
      if (predicted === letter) correct++;
    }
  }
  const passRate = total > 0 ? correct / total : 0;
  console.log(`  ${correct}/${total} correct (${(passRate * 100).toFixed(1)}%), bar is >=${CLASSIFIER_FIXTURE_PASS_BAR * 100}%`);
  if (total === 0) fail("no golden fixtures found — run scripts/freeze-golden-fixtures.ts");
  else if (passRate < CLASSIFIER_FIXTURE_PASS_BAR) fail(`pass rate ${(passRate * 100).toFixed(1)}% is below the bar`);
  else console.log("  PASS");
}

// --- 2. Interaction/pipeline eval ------------------------------------------
function interactionEval(): void {
  section("2/3 interaction/pipeline eval (deterministic, 100% bar)");
  const results = runAllScenarios();
  for (const r of results) {
    if (r.pass) console.log(`  PASS  ${r.name}`);
    else fail(`${r.name} — ${r.detail}`);
  }
}

// --- 3. eval-report.json drift check ---------------------------------------
function driftCheck(): void {
  section("3/3 eval-report.json drift check");
  if (!existsSync(EVAL_REPORT_PATH)) {
    fail("model/eval-report.json does not exist — run `pnpm run train` first");
    return;
  }
  const committed = JSON.parse(readFileSync(EVAL_REPORT_PATH, "utf8")) as {
    provisional: boolean;
    splitMethod: string;
    overallAccuracy: number;
    testCount: number;
  };

  if (committed.splitMethod !== "random-file-level") {
    console.log(
      `  splitMethod is "${committed.splitMethod}", not the provisional random-file-level split this ` +
        "check reconstructs — skipping the numeric recompute (would need the real per-signer test set, " +
        "which this script does not have access to reconstruct deterministically from data/ alone).",
    );
    return;
  }

  const aslNow = loadAslNowSamples(ASL_NOW_DIR);
  const { test } = stratifiedRandomSplit(aslNow, PROVISIONAL_RATIOS, FIXED_SEED);
  const labeled = test.map(toLabeledSample);
  const trueIdx = labeled.map((s) => s.letterIndex);
  const predIdx = labeled.map((s) => LETTERS.indexOf(classify(s.vec).letter as Letter));
  const { overallAccuracy } = evaluate(trueIdx, predIdx);

  console.log(`  committed: testCount=${committed.testCount} overallAccuracy=${committed.overallAccuracy}`);
  console.log(`  recomputed: testCount=${labeled.length} overallAccuracy=${overallAccuracy}`);

  if (labeled.length !== committed.testCount) {
    fail(`test split size drifted: committed ${committed.testCount}, recomputed ${labeled.length}`);
  }
  if (Math.abs(overallAccuracy - committed.overallAccuracy) > 0.001) {
    fail(`overallAccuracy drifted: committed ${committed.overallAccuracy}, recomputed ${overallAccuracy}`);
  }
  if (failures === 0) console.log("  PASS — no drift");
}

classifierFixtureEval();
interactionEval();
driftCheck();

console.log(`\n${failures === 0 ? "eval-check: PASS" : `eval-check: FAIL (${failures} failure(s))`}`);
process.exit(failures === 0 ? 0 : 1);

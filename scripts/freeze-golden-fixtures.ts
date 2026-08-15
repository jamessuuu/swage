/**
 * freeze-golden-fixtures.ts — SPEC.md §8.1: "≥72 held-out landmark samples
 * (3/letter x 24) from the test signer, never used in training."
 *
 * Frozen, not derived live: writes tests/fixtures/golden-landmarks/, a
 * committed snapshot decoupled from data/asl-now's own mutability (a
 * future re-mirror must not silently change what the eval CI stage
 * checks). Deterministic — the same 3-per-letter selection every run,
 * via the identical seeded stratifiedRandomSplit scripts/train.ts uses
 * for its own provisional test split.
 *
 * As documented throughout this build (data/ATTRIBUTION.md, scripts/
 * train.ts): "the test signer" does not exist yet — SPEC.md §3.2's real
 * per-signer holdout is blocked on volunteer recruitment. These fixtures
 * come from the same provisional, file-level split scripts/train.ts uses
 * with --provisional-split, not a genuine held-out signer. Re-run this
 * script once real self-collected test-signer data exists, to freeze
 * fixtures actually drawn from that signer instead.
 *
 * Usage: pnpm exec tsx scripts/freeze-golden-fixtures.ts
 */
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LETTERS } from "../src/lib/classifier";
import { loadAslNowSamples, stratifiedRandomSplit } from "./train-data";
import { FIXED_SEED } from "./model";

const SAMPLES_PER_LETTER = 3;
const REPO_ROOT = join(import.meta.dirname, "..");
const ASL_NOW_DIR = join(REPO_ROOT, "data", "asl-now");
const OUT_DIR = join(REPO_ROOT, "tests", "fixtures", "golden-landmarks");
const RATIOS = { val: 0.15, test: 0.15 }; // must match scripts/train.ts's PROVISIONAL_RATIOS

function main(): void {
  const aslNow = loadAslNowSamples(ASL_NOW_DIR);
  const { test } = stratifiedRandomSplit(aslNow, RATIOS, FIXED_SEED);

  rmSync(OUT_DIR, { recursive: true, force: true });
  mkdirSync(OUT_DIR, { recursive: true });

  let total = 0;
  for (const letter of LETTERS) {
    const samples = test.filter((s) => s.letter === letter).slice(0, SAMPLES_PER_LETTER);
    if (samples.length < SAMPLES_PER_LETTER) {
      throw new Error(`only ${samples.length} test samples available for letter ${letter}, need ${SAMPLES_PER_LETTER}`);
    }
    const letterDir = join(OUT_DIR, letter);
    if (!existsSync(letterDir)) mkdirSync(letterDir, { recursive: true });
    samples.forEach((sample, i) => {
      writeFileSync(join(letterDir, `${i}.json`), JSON.stringify(sample.landmarks));
      total++;
    });
  }
  console.log(`wrote ${total} golden fixture samples (${SAMPLES_PER_LETTER}/letter x ${LETTERS.length} letters) to ${OUT_DIR}`);
}

main();

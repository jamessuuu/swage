/**
 * train-data.ts — loading, labeling, and splitting samples for
 * scripts/train.ts. Filesystem reads are kept separate from the pure
 * logic (seededShuffle, stratifiedRandomSplit, toLabeledSample) so the
 * logic is unit-testable against synthetic arrays without touching
 * data/asl-now's 1,874 real files.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeLandmarks, type Handedness, type RawLandmark } from "../src/lib/normalize";
import { LETTERS, type Letter } from "../src/lib/classifier";
import { isSelfCollectedSample } from "./collect/schema";

export interface RawSample {
  letter: Letter;
  landmarks: RawLandmark[];
  handedness: Handedness;
  /** "aslNow" for the community pool; a signerId for self-collected data. */
  source: "aslNow" | string;
}

export interface LabeledSample {
  vec: Float32Array;
  letterIndex: number;
  source: RawSample["source"];
}

/**
 * asl-now's files are a bare `{x,y,z}[21]` array with no handedness field
 * (SPEC.md §3.1's stated gap). Documented assumption, not a silent guess:
 * every asl-now sample is treated as a right hand. If a contributor
 * actually signed left-handed, normalize.ts's mirror step would run
 * backwards for that one sample — a real, small, named source of label
 * noise in the train-only pool, not present in self-collected data (which
 * records real handedness). Noted for docs/limitations at M8.
 */
const ASL_NOW_ASSUMED_HANDEDNESS: Handedness = "Right";

export function loadAslNowSamples(dir: string): RawSample[] {
  const out: RawSample[] = [];
  for (const letter of LETTERS) {
    const letterDir = join(dir, letter);
    if (!existsSync(letterDir)) continue;
    for (const file of readdirSync(letterDir)) {
      if (!file.endsWith(".json")) continue;
      const landmarks = JSON.parse(readFileSync(join(letterDir, file), "utf8")) as RawLandmark[];
      if (landmarks.length !== 21) {
        throw new Error(`data/asl-now/${letter}/${file}: expected 21 landmarks, got ${landmarks.length}`);
      }
      out.push({ letter, landmarks, handedness: ASL_NOW_ASSUMED_HANDEDNESS, source: "aslNow" });
    }
  }
  return out;
}

export function loadSelfCollectedSamples(dir: string): RawSample[] {
  if (!existsSync(dir)) return [];
  const out: RawSample[] = [];
  for (const signerDir of readdirSync(dir, { withFileTypes: true })) {
    if (!signerDir.isDirectory()) continue;
    const signerPath = join(dir, signerDir.name);
    for (const letterDir of readdirSync(signerPath, { withFileTypes: true })) {
      if (!letterDir.isDirectory()) continue;
      const letterPath = join(signerPath, letterDir.name);
      for (const file of readdirSync(letterPath)) {
        if (!file.endsWith(".json")) continue;
        const parsed: unknown = JSON.parse(readFileSync(join(letterPath, file), "utf8"));
        if (!isSelfCollectedSample(parsed)) {
          throw new Error(`data/self-collected/${signerDir.name}/${letterDir.name}/${file}: invalid sample`);
        }
        out.push({
          letter: parsed.letter,
          landmarks: parsed.landmarks,
          handedness: parsed.handedness,
          source: parsed.signerId,
        });
      }
    }
  }
  return out;
}

export function toLabeledSample(sample: RawSample): LabeledSample {
  const vec = normalizeLandmarks(sample.landmarks, sample.handedness);
  const letterIndex = LETTERS.indexOf(sample.letter);
  if (letterIndex < 0) {
    throw new Error(`unknown letter "${sample.letter}" — not in the 24-class label set`);
  }
  return { vec, letterIndex, source: sample.source };
}

/** Deterministic PRNG (mulberry32) — no crypto, no Math.random, so the same
 * seed always produces the same shuffle order on this machine. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

export interface Split<T> {
  train: T[];
  val: T[];
  test: T[];
}

/**
 * Stratified per-letter random split — the PROVISIONAL fallback method
 * (scripts/train.ts's --provisional-split flag) used only because SPEC.md
 * §3.2's genuine per-signer holdout is blocked on volunteer recruitment
 * (see data/ATTRIBUTION.md). File-level, not signer-level: it does NOT
 * test generalization to an unseen signer, which is the entire point of
 * SPEC.md §3.2 — never confuse this split's numbers with that claim.
 */
export function stratifiedRandomSplit(
  samples: readonly RawSample[],
  ratios: { val: number; test: number },
  seed: number,
): Split<RawSample> {
  const byLetter = new Map<Letter, RawSample[]>();
  for (const s of samples) {
    const arr = byLetter.get(s.letter) ?? [];
    arr.push(s);
    byLetter.set(s.letter, arr);
  }

  const result: Split<RawSample> = { train: [], val: [], test: [] };
  for (const [, group] of byLetter) {
    const shuffled = seededShuffle(group, seed);
    const nVal = Math.max(1, Math.round(shuffled.length * ratios.val));
    const nTest = Math.max(1, Math.round(shuffled.length * ratios.test));
    result.val.push(...shuffled.slice(0, nVal));
    result.test.push(...shuffled.slice(nVal, nVal + nTest));
    result.train.push(...shuffled.slice(nVal + nTest));
  }
  return result;
}

/** The genuine, spec-intended split (SPEC.md §3.2): asl-now is always
 * train; self-collected signers go wherever data/splits.json assigns them. */
export function splitBySignerAssignment(
  aslNow: readonly RawSample[],
  selfCollected: readonly RawSample[],
  assignment: Record<string, "train" | "val" | "test">,
): Split<RawSample> {
  const result: Split<RawSample> = { train: [...aslNow], val: [], test: [] };
  for (const sample of selfCollected) {
    const split = assignment[sample.source];
    if (!split) continue; // orphan signer — data-check.ts is the place that flags this
    result[split].push(sample);
  }
  return result;
}

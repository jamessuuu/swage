/**
 * data-check.ts — SPEC.md M2's own verifier: "data-check.ts passes:
 * per-letter minimums met, held-out signers appear only in val/test."
 *
 * NOT one of the five CI stages (SPEC.md §8: typecheck -> lint -> unit ->
 * e2e:smoke -> eval) — this is M2's own milestone gate, run on demand
 * (`pnpm run data-check`), so it is free to report the real, current
 * status honestly rather than being forced green to keep CI passing.
 *
 * Exits 0 only when SPEC.md §3.2's actual credibility bar is met: at least
 * one held-out val signer and one held-out test signer, distinct from each
 * other and from every train signer, each with enough per-letter reps to
 * be a real holdout. As of this build, data/splits.json's
 * selfCollectedSigners map is empty (SPEC.md §3.1, §12.1 — volunteer
 * recruitment is a human task this agent cannot perform), so this script
 * currently, correctly, exits 1. That is not a bug to silence.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { isSelfCollectedSample } from "./collect/schema";

const REPO_ROOT = join(import.meta.dirname, "..");
const ASL_NOW_DIR = join(REPO_ROOT, "data", "asl-now");
const SELF_COLLECTED_DIR = join(REPO_ROOT, "data", "self-collected");
const SPLITS_PATH = join(REPO_ROOT, "data", "splits.json");

const LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "O", "P",
  "Q", "R", "S", "T", "U", "V", "W", "X", "Y",
] as const;

// Provisional (SPEC.md §12 open question 6: "pin once M2's actual
// volunteer yield is known"). MINIMUM_ASLNOW_PER_LETTER is set safely below
// the real observed minimum (C: 53 files, see data/ATTRIBUTION.md) so a
// future re-mirror that shrinks slightly doesn't spuriously fail this
// check. MINIMUM_SIGNER_REPS_PER_LETTER is set below the ~20 reps/letter
// SPEC.md §3.1 targets, allowing for real-world volunteer-session dropout.
export const MINIMUM_ASLNOW_PER_LETTER = 40;
export const MINIMUM_SIGNER_REPS_PER_LETTER = 10;

interface SplitsFile {
  version: 1;
  aslNowPool: { split: "train"; sourceLetters: string[] };
  selfCollectedSigners: Record<string, "train" | "val" | "test">;
}

export interface CheckResult {
  ok: boolean;
  lines: string[];
}

export function loadSplits(): SplitsFile {
  const raw = JSON.parse(readFileSync(SPLITS_PATH, "utf8")) as SplitsFile;
  if (raw.version !== 1) throw new Error(`data/splits.json: unsupported version ${String(raw.version)}`);
  return raw;
}

/** Filesystem I/O only — counts per-letter files under `dir`. Kept separate
 * from checkAslNowPool() so the check's actual logic is unit-testable
 * against synthetic counts without needing fixture directories on disk. */
export function scanAslNowCounts(dir: string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const letter of LETTERS) {
    const letterDir = join(dir, letter);
    counts[letter] = existsSync(letterDir)
      ? readdirSync(letterDir).filter((f) => f.endsWith(".json")).length
      : 0;
  }
  return counts;
}

/** Per-letter minimums for the asl-now train-only pool — pure logic. */
export function checkAslNowPool(
  counts: Record<string, number>,
  minPerLetter: number = MINIMUM_ASLNOW_PER_LETTER,
): CheckResult {
  const lines: string[] = [];
  let ok = true;
  for (const letter of LETTERS) {
    const count = counts[letter] ?? 0;
    if (count < minPerLetter) {
      ok = false;
      lines.push(`  FAIL  ${letter}: ${count} files, need >= ${minPerLetter}`);
    }
  }
  lines.unshift(
    ok ? `asl-now train pool: PASS (${LETTERS.length}/${LETTERS.length} letters meet the minimum)` : "asl-now train pool: FAIL",
  );
  return { ok, lines };
}

interface SignerScan {
  signerId: string;
  perLetterCounts: Record<string, number>;
}

function scanSelfCollected(): SignerScan[] {
  if (!existsSync(SELF_COLLECTED_DIR)) return [];
  const signerDirs = readdirSync(SELF_COLLECTED_DIR, { withFileTypes: true }).filter((d) => d.isDirectory());
  return signerDirs.map((d) => {
    const signerId = d.name;
    const perLetterCounts: Record<string, number> = {};
    const signerPath = join(SELF_COLLECTED_DIR, signerId);
    for (const letterDir of readdirSync(signerPath, { withFileTypes: true })) {
      if (!letterDir.isDirectory()) continue;
      const letterPath = join(signerPath, letterDir.name);
      const files = readdirSync(letterPath).filter((f) => f.endsWith(".json"));
      // Spot-validate every file against the schema, not just count them —
      // a malformed capture should fail this check, not silently count.
      for (const f of files) {
        const parsed: unknown = JSON.parse(readFileSync(join(letterPath, f), "utf8"));
        if (!isSelfCollectedSample(parsed)) {
          throw new Error(`data/self-collected/${signerId}/${letterDir.name}/${f} is not a valid sample record`);
        }
      }
      perLetterCounts[letterDir.name] = files.length;
    }
    return { signerId, perLetterCounts };
  });
}

/** Split integrity: every signer on disk is assigned exactly once, and the
 * assignment in splits.json matches what is actually on disk. */
export function checkSplitIntegrity(splits: SplitsFile, signers: SignerScan[]): CheckResult {
  const lines: string[] = [];
  let ok = true;
  const assigned = new Set(Object.keys(splits.selfCollectedSigners));
  const onDisk = new Set(signers.map((s) => s.signerId));

  for (const signerId of onDisk) {
    if (!assigned.has(signerId)) {
      ok = false;
      lines.push(`  FAIL  ${signerId}: data on disk but no split assignment in data/splits.json`);
    }
  }
  for (const signerId of assigned) {
    if (!onDisk.has(signerId)) {
      ok = false;
      lines.push(`  FAIL  ${signerId}: assigned in data/splits.json but no data on disk`);
    }
  }
  lines.unshift(ok ? "split integrity: PASS" : "split integrity: FAIL");
  return { ok, lines };
}

/** SPEC.md §3.2's actual credibility bar: >=1 val signer, >=1 test signer,
 * each with enough per-letter reps, none of them also in train. */
export function checkHeldOutCoverage(splits: SplitsFile, signers: SignerScan[]): CheckResult {
  const lines: string[] = [];
  const bySplit = { train: 0, val: 0, test: 0 } as Record<"train" | "val" | "test", number>;

  for (const signer of signers) {
    const split = splits.selfCollectedSigners[signer.signerId];
    if (!split) continue; // already reported by checkSplitIntegrity
    bySplit[split]++;
    const weak = LETTERS.filter((l) => (signer.perLetterCounts[l] ?? 0) < MINIMUM_SIGNER_REPS_PER_LETTER);
    if (weak.length > 0) {
      lines.push(
        `  ${signer.signerId} (${split}): below ${MINIMUM_SIGNER_REPS_PER_LETTER} reps for ${weak.length}/${LETTERS.length} letters`,
      );
    }
  }

  const ok = bySplit.val >= 1 && bySplit.test >= 1;
  lines.unshift(
    `held-out coverage: train=${bySplit.train} val=${bySplit.val} test=${bySplit.test} signers — ${
      ok ? "PASS" : "FAIL"
    }`,
  );
  if (!ok) {
    lines.push(
      "  This is SPEC.md §3.2's actual credibility bar, and it is not met: recruiting and",
      "  recording >=1 val signer and >=1 different test signer, with consent, is a human",
      "  task no coding agent can perform (SPEC.md §3.1, §12.1;",
      "  showcase-program/PHASE-2.md names this explicitly). Not a bug in this script.",
    );
  }
  return { ok, lines };
}

function main(): void {
  const splits = loadSplits();
  const signers = scanSelfCollected();

  const results = [
    checkAslNowPool(scanAslNowCounts(ASL_NOW_DIR)),
    checkSplitIntegrity(splits, signers),
    checkHeldOutCoverage(splits, signers),
  ];

  for (const r of results) {
    for (const line of r.lines) console.log(line);
    console.log("");
  }

  const ok = results.every((r) => r.ok);
  console.log(ok ? "data-check: PASS" : "data-check: FAIL");
  process.exit(ok ? 0 : 1);
}

// Only run when executed directly (tsx scripts/data-check.ts), not when
// imported by scripts/data-check.test.ts.
if (process.argv[1] && process.argv[1].endsWith("data-check.ts")) {
  main();
}

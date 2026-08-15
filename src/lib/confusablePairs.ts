/**
 * confusablePairs.ts — reads model/eval-report.json's own confusablePairs
 * (SPEC.md §9: "the pairs eval-report.json itself names as confused; the
 * app's own published eval decides what to drill, not a hardcoded guess")
 * for the practice UI's "commonly mixed up with X" hint (SPEC.md F11).
 *
 * IMPORTANT: eval-report.json's `provisional` field (see its own header
 * comment in scripts/train.ts) applies here too — these pairs come from
 * whatever split trained the committed model, not necessarily SPEC.md
 * §3.2's genuine per-signer holdout. Real confusion patterns either way,
 * just not yet the credibility-bar-meeting version.
 */
import evalReport from "../../model/eval-report.json" with { type: "json" };
import type { Letter } from "./classifier";

const PAIRS = evalReport.confusablePairs as [string, string][];

/** The letter(s) eval-report.json records as most often confused with `letter`, if any. */
export function getConfusedWith(letter: Letter): Letter[] {
  const matches: Letter[] = [];
  for (const [a, b] of PAIRS) {
    if (a === letter) matches.push(b as Letter);
  }
  return matches;
}

/** Whether `a` and `b` appear together as a confusable pair, in either
 * direction — eval-report.json's pairs are directional (true -> predicted),
 * but "commonly mixed up with" is inherently a symmetric statement to make
 * to a practicing user. */
export function areConfusable(a: Letter, b: Letter): boolean {
  return PAIRS.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

export const EVAL_IS_PROVISIONAL = evalReport.provisional;

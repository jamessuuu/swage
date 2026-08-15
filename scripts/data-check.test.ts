import { describe, expect, it } from "vitest";
import {
  checkAslNowPool,
  checkHeldOutCoverage,
  checkSplitIntegrity,
  MINIMUM_ASLNOW_PER_LETTER,
  MINIMUM_SIGNER_REPS_PER_LETTER,
} from "./data-check";

const LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "O", "P",
  "Q", "R", "S", "T", "U", "V", "W", "X", "Y",
];

function fullCounts(perLetter: number): Record<string, number> {
  return Object.fromEntries(LETTERS.map((l) => [l, perLetter]));
}

describe("checkAslNowPool", () => {
  it("passes when every letter meets the minimum", () => {
    const result = checkAslNowPool(fullCounts(MINIMUM_ASLNOW_PER_LETTER));
    expect(result.ok).toBe(true);
  });

  it("fails and names every letter under the minimum", () => {
    const counts = fullCounts(MINIMUM_ASLNOW_PER_LETTER);
    counts.C = 3;
    counts.Z = 0; // Z isn't even in LETTERS (excluded, SPEC.md §3.4) — ignored, not counted
    const result = checkAslNowPool(counts);
    expect(result.ok).toBe(false);
    expect(result.lines.some((l) => l.includes("C: 3 files"))).toBe(true);
  });

  it("treats a missing letter (undefined count) as zero, not a crash", () => {
    const counts = fullCounts(MINIMUM_ASLNOW_PER_LETTER);
    delete counts.A;
    const result = checkAslNowPool(counts);
    expect(result.ok).toBe(false);
    expect(result.lines.some((l) => l.includes("A: 0 files"))).toBe(true);
  });
});

describe("checkSplitIntegrity", () => {
  const splits = {
    version: 1 as const,
    aslNowPool: { split: "train" as const, sourceLetters: LETTERS },
    selfCollectedSigners: { "signer-a": "val" as const, "signer-b": "test" as const },
  };

  it("passes when disk and splits.json agree exactly", () => {
    const signers = [
      { signerId: "signer-a", perLetterCounts: {} },
      { signerId: "signer-b", perLetterCounts: {} },
    ];
    expect(checkSplitIntegrity(splits, signers).ok).toBe(true);
  });

  it("fails on a signer present on disk but unassigned in splits.json", () => {
    const signers = [
      { signerId: "signer-a", perLetterCounts: {} },
      { signerId: "signer-b", perLetterCounts: {} },
      { signerId: "signer-orphan", perLetterCounts: {} },
    ];
    const result = checkSplitIntegrity(splits, signers);
    expect(result.ok).toBe(false);
    expect(result.lines.some((l) => l.includes("signer-orphan"))).toBe(true);
  });

  it("fails on a signer assigned in splits.json but missing on disk", () => {
    const signers = [{ signerId: "signer-a", perLetterCounts: {} }];
    const result = checkSplitIntegrity(splits, signers);
    expect(result.ok).toBe(false);
    expect(result.lines.some((l) => l.includes("signer-b"))).toBe(true);
  });
});

describe("checkHeldOutCoverage", () => {
  it("fails when there are zero val/test signers (today's real repo state)", () => {
    const splits = {
      version: 1 as const,
      aslNowPool: { split: "train" as const, sourceLetters: LETTERS },
      selfCollectedSigners: {},
    };
    const result = checkHeldOutCoverage(splits, []);
    expect(result.ok).toBe(false);
    expect(result.lines[0]).toContain("val=0 test=0");
  });

  it("passes once at least one val and one test signer are both assigned and well-covered", () => {
    const splits = {
      version: 1 as const,
      aslNowPool: { split: "train" as const, sourceLetters: LETTERS },
      selfCollectedSigners: { "signer-val": "val" as const, "signer-test": "test" as const },
    };
    const wellCovered = Object.fromEntries(LETTERS.map((l) => [l, MINIMUM_SIGNER_REPS_PER_LETTER]));
    const signers = [
      { signerId: "signer-val", perLetterCounts: wellCovered },
      { signerId: "signer-test", perLetterCounts: wellCovered },
    ];
    const result = checkHeldOutCoverage(splits, signers);
    expect(result.ok).toBe(true);
  });

  it("still passes (coverage met) but flags a signer thin on a specific letter", () => {
    const splits = {
      version: 1 as const,
      aslNowPool: { split: "train" as const, sourceLetters: LETTERS },
      selfCollectedSigners: { "signer-val": "val" as const, "signer-test": "test" as const },
    };
    const wellCovered = Object.fromEntries(LETTERS.map((l) => [l, MINIMUM_SIGNER_REPS_PER_LETTER]));
    const thin = { ...wellCovered, C: 1 };
    const signers = [
      { signerId: "signer-val", perLetterCounts: thin },
      { signerId: "signer-test", perLetterCounts: wellCovered },
    ];
    const result = checkHeldOutCoverage(splits, signers);
    expect(result.ok).toBe(true); // coverage bar is signer *presence*, not perfection
    expect(result.lines.some((l) => l.includes("signer-val") && l.includes("below"))).toBe(true);
  });

  it("a train-assigned signer does not count toward val/test coverage", () => {
    const splits = {
      version: 1 as const,
      aslNowPool: { split: "train" as const, sourceLetters: LETTERS },
      selfCollectedSigners: { "signer-train": "train" as const },
    };
    const result = checkHeldOutCoverage(splits, [{ signerId: "signer-train", perLetterCounts: {} }]);
    expect(result.ok).toBe(false);
  });
});

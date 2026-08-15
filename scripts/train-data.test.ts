import { describe, expect, it } from "vitest";
import {
  seededShuffle,
  splitBySignerAssignment,
  stratifiedRandomSplit,
  toLabeledSample,
  type RawSample,
} from "./train-data";
import type { RawLandmark } from "../src/lib/normalize";

function landmarks(): RawLandmark[] {
  const out: RawLandmark[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  out[0] = { x: 0, y: 0, z: 0 };
  out[9] = { x: 0, y: -1, z: 0 };
  return out;
}

function sample(letter: "A" | "B", source: string): RawSample {
  return { letter, landmarks: landmarks(), handedness: "Right", source };
}

describe("seededShuffle", () => {
  it("is deterministic for a given seed", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect(seededShuffle(items, 42)).toEqual(seededShuffle(items, 42));
  });

  it("produces a different order for a different seed (overwhelmingly likely for n=50)", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    expect(seededShuffle(items, 1)).not.toEqual(seededShuffle(items, 2));
  });

  it("is a permutation — same elements, same length", () => {
    const items = Array.from({ length: 30 }, (_, i) => i);
    const shuffled = seededShuffle(items, 7);
    expect(shuffled).toHaveLength(items.length);
    expect([...shuffled].sort((a, b) => a - b)).toEqual(items);
  });

  it("does not mutate the input array", () => {
    const items = [1, 2, 3, 4, 5];
    const copy = [...items];
    seededShuffle(items, 1);
    expect(items).toEqual(copy);
  });
});

describe("stratifiedRandomSplit", () => {
  it("keeps every letter represented in every split (stratified, not global-random)", () => {
    const samples: RawSample[] = [
      ...Array.from({ length: 20 }, () => sample("A", "aslNow")),
      ...Array.from({ length: 20 }, () => sample("B", "aslNow")),
    ];
    const { train, val, test } = stratifiedRandomSplit(samples, { val: 0.15, test: 0.15 }, 1);
    for (const split of [train, val, test]) {
      expect(split.some((s) => s.letter === "A")).toBe(true);
      expect(split.some((s) => s.letter === "B")).toBe(true);
    }
    expect(train.length + val.length + test.length).toBe(40);
  });

  it("is deterministic for a fixed seed", () => {
    const samples = Array.from({ length: 20 }, () => sample("A", "aslNow"));
    const a = stratifiedRandomSplit(samples, { val: 0.2, test: 0.2 }, 99);
    const b = stratifiedRandomSplit(samples, { val: 0.2, test: 0.2 }, 99);
    expect(a).toEqual(b);
  });

  it("always holds out at least 1 sample per letter for val and test, even with a tiny group", () => {
    const samples = [sample("A", "aslNow"), sample("A", "aslNow"), sample("A", "aslNow")];
    const { val, test } = stratifiedRandomSplit(samples, { val: 0.1, test: 0.1 }, 1);
    expect(val.length).toBeGreaterThanOrEqual(1);
    expect(test.length).toBeGreaterThanOrEqual(1);
  });
});

describe("splitBySignerAssignment", () => {
  it("puts all of aslNow in train, and routes each signer per the assignment map", () => {
    const aslNow = [sample("A", "aslNow"), sample("B", "aslNow")];
    const selfCollected = [
      sample("A", "signer-val"),
      sample("B", "signer-val"),
      sample("A", "signer-test"),
    ];
    const result = splitBySignerAssignment(aslNow, selfCollected, {
      "signer-val": "val",
      "signer-test": "test",
    });
    expect(result.train).toHaveLength(2);
    expect(result.val).toHaveLength(2);
    expect(result.test).toHaveLength(1);
  });

  it("silently drops an unassigned (orphan) signer's samples — not this function's job to flag", () => {
    const result = splitBySignerAssignment([], [sample("A", "unassigned-signer")], {});
    expect(result.train).toHaveLength(0);
    expect(result.val).toHaveLength(0);
    expect(result.test).toHaveLength(0);
  });
});

describe("toLabeledSample", () => {
  it("normalizes landmarks and resolves the letter to its LETTERS index", () => {
    const labeled = toLabeledSample(sample("B", "aslNow"));
    expect(labeled.vec).toHaveLength(63);
    expect(labeled.letterIndex).toBeGreaterThanOrEqual(0);
    expect(labeled.source).toBe("aslNow");
  });
});

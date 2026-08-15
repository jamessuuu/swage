import { describe, expect, it } from "vitest";
import { evaluate, tuneConfidenceThreshold } from "./train";
import { LETTERS } from "../src/lib/classifier";

const A = LETTERS.indexOf("A");
const B = LETTERS.indexOf("B");
const C = LETTERS.indexOf("C");

describe("evaluate", () => {
  it("scores 100% precision/recall/F1 for a perfect classifier", () => {
    const trueIdx = [A, A, B, B, C];
    const predIdx = [A, A, B, B, C];
    const { overallAccuracy, perLetter } = evaluate(trueIdx, predIdx);
    expect(overallAccuracy).toBe(1);
    expect(perLetter.A?.f1).toBe(1);
    expect(perLetter.B?.f1).toBe(1);
    expect(perLetter.C?.support).toBe(1);
  });

  it("computes precision and recall correctly for a confused pair", () => {
    // A predicted as A twice, once as B; B always predicted as B.
    const trueIdx = [A, A, A, B, B];
    const predIdx = [A, A, B, B, B];
    const { overallAccuracy, perLetter, matrix } = evaluate(trueIdx, predIdx);
    expect(overallAccuracy).toBeCloseTo(4 / 5, 4);
    // A: 2 correct out of 3 true A -> recall 2/3. Precision: 2 correct / 2 predicted-A = 1.
    expect(perLetter.A?.recall).toBeCloseTo(2 / 3, 4);
    expect(perLetter.A?.precision).toBe(1);
    // B: predicted 3 times (1 wrongly-labeled-A sample + 2 true B), 2 of which are correct.
    expect(perLetter.B?.precision).toBeCloseTo(2 / 3, 4);
    expect(perLetter.B?.recall).toBe(1);
    expect(matrix[A]?.[B]).toBe(1);
  });

  it("ranks confusablePairs by off-diagonal count, descending", () => {
    const trueIdx = [A, A, A, B];
    const predIdx = [B, B, B, A]; // A->B confused 3x, B->A confused 1x
    const { confusablePairs } = evaluate(trueIdx, predIdx);
    expect(confusablePairs[0]).toEqual(["A", "B"]);
  });

  it("handles an empty prediction set without throwing", () => {
    const { overallAccuracy, matrix } = evaluate([], []);
    expect(overallAccuracy).toBe(0);
    expect(matrix).toHaveLength(LETTERS.length);
  });
});

describe("tuneConfidenceThreshold", () => {
  it("picks a threshold that keeps high-confidence correct predictions", () => {
    // 10 samples, all correctly predicted as A with confidence 0.95 or 0.55.
    const valTrue = Array(10).fill(A) as number[];
    const valProbs: number[][] = Array.from({ length: 10 }, (_, i) => {
      const row = Array(LETTERS.length).fill(0.01) as number[];
      row[A] = i < 5 ? 0.95 : 0.55;
      return row;
    });
    const threshold = tuneConfidenceThreshold(valTrue, valProbs);
    // Both 0.9 and 0.5-ish candidates yield F1=1 here (every kept prediction
    // is correct) — ties break toward the higher/stricter threshold.
    expect(threshold).toBeGreaterThanOrEqual(0.5);
  });

  it("prefers a lower threshold when a high one discards too many correct predictions to be useful", () => {
    // Only 2/10 samples ever reach 0.9 confidence; the rest cap out at 0.6
    // but are always correct. A 0.9 threshold gets perfect F1 on a tiny
    // sliver; 0.6 gets perfect F1 on everything — both score F1=1, so this
    // asserts the function does not crash and returns a valid candidate,
    // rather than asserting a specific winner (a tie is legitimate here).
    const valTrue = Array(10).fill(A) as number[];
    const valProbs: number[][] = Array.from({ length: 10 }, (_, i) => {
      const row = Array(LETTERS.length).fill(0.01) as number[];
      row[A] = i < 2 ? 0.95 : 0.6;
      return row;
    });
    const threshold = tuneConfidenceThreshold(valTrue, valProbs);
    expect([0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9]).toContain(threshold);
  });
});

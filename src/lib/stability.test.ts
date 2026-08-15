import { describe, expect, it } from "vitest";
import { StabilityTracker, DEFAULT_STABILITY } from "./stability";
import { SCENARIOS, runAllScenarios } from "./stability.scenarios";

// SPEC.md §8's "Interaction/pipeline eval (deterministic, zero tolerance)"
// scripted scenarios — run here for the "unit" CI stage, and again from
// scripts/eval-check.ts for the "eval" stage (same scenarios, not a copy).
describe("stability scenarios (100% pass bar)", () => {
  for (const scenario of SCENARIOS) {
    it(scenario.name, () => {
      const tracker = new StabilityTracker();
      const actual = scenario.run(tracker);
      expect(actual).toEqual(scenario.expected);
    });
  }

  it("runAllScenarios() reports every scenario passing", () => {
    const results = runAllScenarios();
    const failed = results.filter((r) => !r.pass);
    expect(failed).toEqual([]);
  });
});

describe("StabilityTracker — additional unit coverage", () => {
  it("reports not-held for every tick before the window fills", () => {
    const tracker = new StabilityTracker({ ...DEFAULT_STABILITY, windowSize: 3, minAgree: 2 });
    expect(tracker.push({ letter: "A", confidence: 0.99, ts: 0 }).held).toBe(false);
    expect(tracker.push({ letter: "A", confidence: 0.99, ts: 66 }).held).toBe(false);
  });

  it("a custom (smaller) config fires sooner", () => {
    const tracker = new StabilityTracker({
      windowSize: 3,
      minAgree: 2,
      confidenceThreshold: 0.5,
      cooldownMs: 100,
    });
    tracker.push({ letter: "A", confidence: 0.9, ts: 0 });
    tracker.push({ letter: "A", confidence: 0.9, ts: 10 });
    const result = tracker.push({ letter: "A", confidence: 0.9, ts: 20 });
    expect(result).toEqual({ held: true, letter: "A" });
  });

  it("reset() immediately zeroes the buffer, not just the fired latch", () => {
    const tracker = new StabilityTracker({ ...DEFAULT_STABILITY, windowSize: 2, minAgree: 2 });
    tracker.push({ letter: "A", confidence: 0.99, ts: 0 });
    tracker.reset();
    // Without reset, this next push would complete a 2-tick window; after
    // reset, it is the first tick of a fresh window and cannot hold yet.
    const result = tracker.push({ letter: "A", confidence: 0.99, ts: 66 });
    expect(result.held).toBe(false);
  });
});

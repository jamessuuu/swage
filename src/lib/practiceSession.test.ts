import { describe, expect, it } from "vitest";
import {
  accuracyPercent,
  createSession,
  currentTarget,
  recordCorrect,
  recordWrong,
  skip,
} from "./practiceSession";
import { LETTERS } from "./classifier";

describe("createSession", () => {
  it("shuffles all 24 letters, none lost or duplicated", () => {
    const session = createSession(1);
    expect(session.order).toHaveLength(LETTERS.length);
    expect([...session.order].sort()).toEqual([...LETTERS].sort());
  });

  it("is deterministic for a given seed (SPEC.md §9: 'a session is resumable')", () => {
    expect(createSession(42).order).toEqual(createSession(42).order);
  });

  it("different seeds (very likely) produce a different order", () => {
    expect(createSession(1).order).not.toEqual(createSession(2).order);
  });

  it("starts on the first letter of the shuffled order, not finished", () => {
    const session = createSession(7);
    expect(currentTarget(session)).toBe(session.order[0]);
    expect(session.finished).toBe(false);
  });
});

describe("recordCorrect", () => {
  it("advances to the next target and increments attempted/correct/streak", () => {
    const s0 = createSession(1);
    const s1 = recordCorrect(s0);
    expect(s1.attempted).toBe(1);
    expect(s1.correct).toBe(1);
    expect(s1.currentStreak).toBe(1);
    expect(s1.bestStreak).toBe(1);
    expect(s1.lastResult).toBe("correct");
    expect(currentTarget(s1)).toBe(s0.order[1]);
  });

  it("tracks bestStreak as the historical max, not the current value", () => {
    let s = createSession(1);
    s = recordCorrect(s); // streak 1
    s = recordCorrect(s); // streak 2
    s = recordWrong(s); // streak resets to 0
    expect(s.currentStreak).toBe(0);
    expect(s.bestStreak).toBe(2);
  });

  it("finishes the session after the last letter", () => {
    let s = createSession(3, ["A", "B"]);
    s = recordCorrect(s);
    expect(s.finished).toBe(false);
    s = recordCorrect(s);
    expect(s.finished).toBe(true);
    expect(currentTarget(s)).toBeNull();
  });

  it("is a no-op once the session has finished", () => {
    let s = createSession(3, ["A"]);
    s = recordCorrect(s);
    expect(s.finished).toBe(true);
    const after = recordCorrect(s);
    expect(after).toEqual(s);
  });
});

describe("recordWrong", () => {
  it("increments attempted but not correct, and does not advance the target", () => {
    const s0 = createSession(1);
    const target = currentTarget(s0);
    const s1 = recordWrong(s0);
    expect(s1.attempted).toBe(1);
    expect(s1.correct).toBe(0);
    expect(s1.lastResult).toBe("wrong");
    expect(currentTarget(s1)).toBe(target); // SPEC.md §9: "immediate retry"
  });
});

describe("skip", () => {
  it("advances the target without counting as an attempt", () => {
    const s0 = createSession(1);
    const s1 = skip(s0);
    expect(s1.attempted).toBe(0);
    expect(s1.correct).toBe(0);
    expect(currentTarget(s1)).toBe(s0.order[1]);
  });

  it("resets the current streak", () => {
    let s = createSession(1);
    s = recordCorrect(s);
    expect(s.currentStreak).toBe(1);
    s = skip(s);
    expect(s.currentStreak).toBe(0);
  });
});

describe("accuracyPercent", () => {
  it("is 0 with no attempts yet (not NaN or a divide-by-zero surprise)", () => {
    expect(accuracyPercent(createSession(1))).toBe(0);
  });

  it("rounds to the nearest whole percent", () => {
    let s = createSession(9, ["A", "B", "C"]);
    s = recordCorrect(s); // 1/1
    s = recordWrong(s); // 1/2 = 50%
    expect(accuracyPercent(s)).toBe(50);
  });
});

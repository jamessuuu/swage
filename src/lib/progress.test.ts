import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * progress.ts tests both real branches of SPEC.md F10 ("localStorage
 * unavailable -> practice still works in-session... never throws"):
 * vitest's default environment has no `window` at all, which IS the
 * "unavailable" case, tested as-is; the "available" case is tested by
 * stubbing a minimal, real (Map-backed) localStorage implementation
 * rather than reaching for jsdom for one object's worth of API surface.
 */

function fakeLocalStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
}

describe("progress.ts — localStorage available", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("window", { localStorage: fakeLocalStorage() });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("isPersistenceAvailable() is true", async () => {
    const { isPersistenceAvailable } = await import("./progress");
    expect(isPersistenceAvailable()).toBe(true);
  });

  it("starts empty: no sessions, zeroed perLetter for every letter", async () => {
    const { getProgress } = await import("./progress");
    const { LETTERS } = await import("./classifier");
    const progress = getProgress();
    expect(progress.sessions).toEqual([]);
    for (const letter of LETTERS) {
      expect(progress.perLetter[letter]).toEqual({ seen: 0, correct: 0 });
    }
  });

  it("recordAttempt tallies today's session and the per-letter stats", async () => {
    const { getProgress, recordAttempt } = await import("./progress");
    recordAttempt("A", true, 500);
    recordAttempt("A", false, 400);
    recordAttempt("B", true, 600);

    const progress = getProgress();
    expect(progress.sessions).toHaveLength(1);
    expect(progress.sessions[0]).toMatchObject({ attempted: 3, correct: 2 });
    expect(progress.perLetter.A).toEqual({ seen: 2, correct: 1 });
    expect(progress.perLetter.B).toEqual({ seen: 1, correct: 1 });
  });

  it("recordAttempt persists across a fresh import (genuinely written to storage)", async () => {
    const { recordAttempt } = await import("./progress");
    recordAttempt("C", true, 100);

    vi.resetModules();
    const { getProgress } = await import("./progress");
    expect(getProgress().perLetter.C).toEqual({ seen: 1, correct: 1 });
  });

  it("recordBestStreak keeps the max, not the latest, for today", async () => {
    const { getProgress, recordBestStreak } = await import("./progress");
    recordBestStreak(3);
    recordBestStreak(7);
    recordBestStreak(2);
    expect(getProgress().sessions[0]?.bestStreak).toBe(7);
  });

  it("clearProgress deletes the stored key — a fresh load is empty again", async () => {
    const { clearProgress, getProgress, recordAttempt } = await import("./progress");
    recordAttempt("A", true, 100);
    expect(getProgress().sessions).toHaveLength(1);
    clearProgress();
    expect(getProgress().sessions).toEqual([]);
  });

  describe("nextDrillLetter", () => {
    it("'random' returns a member of the 24-letter set", async () => {
      const { nextDrillLetter } = await import("./progress");
      const { LETTERS } = await import("./classifier");
      expect(LETTERS).toContain(nextDrillLetter("random"));
    });

    it("'confusable' draws from eval-report.json's own confusion pairs", async () => {
      const { nextDrillLetter } = await import("./progress");
      const evalReport = (await import("../../model/eval-report.json", { with: { type: "json" } }))
        .default;
      const pool = new Set(evalReport.confusablePairs.flat());
      expect(pool.size).toBeGreaterThan(0); // sanity: the fixture actually has pairs
      for (let i = 0; i < 20; i++) {
        expect(pool.has(nextDrillLetter("confusable"))).toBe(true);
      }
    });

    it("'weak' falls back to a uniform pick over all 24 letters with zero history", async () => {
      const { nextDrillLetter } = await import("./progress");
      const { LETTERS } = await import("./classifier");
      expect(LETTERS).toContain(nextDrillLetter("weak"));
    });

    it("'weak' is drawn only from letters with the lowest recorded accuracy", async () => {
      const { nextDrillLetter, recordAttempt } = await import("./progress");
      // A: 10/10 correct. B: 0/10 correct. Every other letter untouched.
      for (let i = 0; i < 10; i++) recordAttempt("A", true, 100);
      for (let i = 0; i < 10; i++) recordAttempt("B", false, 100);

      for (let i = 0; i < 20; i++) {
        expect(nextDrillLetter("weak")).toBe("B");
      }
    });
  });
});

describe("progress.ts — localStorage unavailable (F10)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("isPersistenceAvailable() is false with no window/localStorage", async () => {
    const { isPersistenceAvailable } = await import("./progress");
    expect(isPersistenceAvailable()).toBe(false);
  });

  it("never throws: recordAttempt, recordBestStreak, clearProgress, getProgress all work in-memory", async () => {
    const { getProgress, recordAttempt, recordBestStreak, clearProgress } = await import("./progress");
    expect(() => recordAttempt("A", true, 100)).not.toThrow();
    expect(() => recordBestStreak(5)).not.toThrow();

    const progress = getProgress();
    expect(progress.perLetter.A.seen).toBe(1);
    expect(progress.sessions[0]?.bestStreak).toBe(5);

    expect(() => clearProgress()).not.toThrow();
  });
});

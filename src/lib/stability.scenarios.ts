/**
 * stability.scenarios.ts — the scripted per-tick sequences SPEC.md §8
 * names as the "Interaction/pipeline eval (deterministic, zero
 * tolerance)... 100% pass bar, like sluice's chaos invariants." Defined
 * once here, run from two places so the scenarios themselves never drift:
 *   - src/lib/stability.test.ts (the "unit" CI stage, SPEC.md §8)
 *   - scripts/eval-check.ts (the "eval" CI stage, same section)
 */
import { DEFAULT_STABILITY, StabilityTracker, type Tick } from "./stability";
import type { Letter } from "./classifier";

const TICK_MS = 66; // SPEC.md §7.1's ~15Hz decimation

function ticksOf(letter: Letter | null, confidence: number, count: number, startTs = 0): Tick[] {
  return Array.from({ length: count }, (_, i) => ({
    letter,
    confidence,
    ts: startTs + i * TICK_MS,
  }));
}

export interface Scenario {
  name: string;
  /** Built fresh per scenario — resets() are explicit `null` entries in `actions`. */
  run: (tracker: StabilityTracker) => { held: boolean; letter?: Letter }[];
  /** One expected result per element `run()` returns, same length and order. */
  expected: { held: boolean; letter?: Letter }[];
}

export const SCENARIOS: Scenario[] = [
  {
    name: "a steady 8-tick hold fires exactly once",
    run: (t) => {
      const ticks = ticksOf("A", 0.95, 10);
      return ticks.map((tick) => t.push(tick));
    },
    expected: [
      ...Array(7).fill({ held: false }),
      { held: true, letter: "A" }, // tick 8: window first full, majority reached
      { held: false }, // tick 9: same letter, cooldown still active
      { held: false }, // tick 10: same letter, cooldown still active
    ],
  },
  {
    name: "one disagreeing frame out of 8 is tolerated (minAgree=6 of 8)",
    run: (t) => {
      const ticks: Tick[] = [
        ...ticksOf("A", 0.95, 3, 0),
        { letter: "B", confidence: 0.95, ts: 3 * TICK_MS }, // one noisy frame
        ...ticksOf("A", 0.95, 4, 4 * TICK_MS),
      ];
      return ticks.map((tick) => t.push(tick));
    },
    expected: [...Array(7).fill({ held: false }), { held: true, letter: "A" }],
  },
  {
    name: "an even split (4/4) never reaches minAgree=6 and never fires",
    run: (t) => {
      const ticks: Tick[] = [...ticksOf("A", 0.95, 4, 0), ...ticksOf("B", 0.95, 4, 4 * TICK_MS)];
      return ticks.map((tick) => t.push(tick));
    },
    expected: Array(8).fill({ held: false }),
  },
  {
    name: "a below-threshold confidence tick counts as null (F7), breaking majority",
    run: (t) => {
      const ticks: Tick[] = [
        ...ticksOf("A", 0.95, 5, 0),
        // 3 ticks classified "A" but below confidenceThreshold — effectively null.
        ...ticksOf("A", DEFAULT_STABILITY.confidenceThreshold - 0.1, 3, 5 * TICK_MS),
      ];
      return ticks.map((tick) => t.push(tick));
    },
    // Only 5 of 8 ticks are effectively "A" (below minAgree=6) — never held.
    expected: Array(8).fill({ held: false }),
  },
  {
    name: "8 consecutive null (no-hand) ticks never fire",
    run: (t) => ticksOf(null, 0, 8).map((tick) => t.push(tick)),
    expected: Array(8).fill({ held: false }),
  },
  {
    name: "a letter change after a hold fires again for the new letter, no cooldown wait",
    run: (t) => {
      const results: { held: boolean; letter?: Letter }[] = [];
      for (const tick of ticksOf("A", 0.95, 8, 0)) results.push(t.push(tick));
      for (const tick of ticksOf("B", 0.95, 8, 8 * TICK_MS)) results.push(t.push(tick));
      return results;
    },
    // Traced push-by-push (sliding window, minAgree=6/8): A holds at push 8.
    // B then displaces A one tick at a time; A's majority drops below 6 at
    // push 11 (5 A / 3 B) — "majority lost", clearing the fired latch even
    // though cooldownMs hasn't elapsed — and B doesn't itself reach 6 until
    // push 14 (2 A / 6 B), where it fires immediately (cooldown does not
    // apply to a genuinely different letter).
    expected: [
      ...Array(7).fill({ held: false }), // pushes 1-7: filling the window
      { held: true, letter: "A" }, // push 8 (ts=462): 8/8 A
      ...Array(5).fill({ held: false }), // pushes 9-13: majority transitions A -> lost -> B, none >=6
      { held: true, letter: "B" }, // push 14 (ts=858): 6/8 B
      ...Array(2).fill({ held: false }), // pushes 15-16: B still majority, cooldown not yet elapsed
    ],
  },
  {
    name: "cooldownMs elapsing allows the SAME held letter to fire again",
    run: (t) => {
      const results: { held: boolean; letter?: Letter }[] = [];
      for (const tick of ticksOf("A", 0.95, 8, 0)) results.push(t.push(tick));
      // Keep pushing "A" past the cooldown window. First hold fires at
      // ts=462 (tick 8), setting cooldownUntil=962. The second batch runs
      // ts=528..990 (8 more ticks, 66ms apart): the first 7 (528..924) are
      // all still < 962, so only the 8th (ts=990 >= 962) re-fires.
      for (const tick of ticksOf("A", 0.95, 8, 8 * TICK_MS)) results.push(t.push(tick));
      return results;
    },
    expected: [
      ...Array(7).fill({ held: false }),
      { held: true, letter: "A" }, // tick 8, ts=462, cooldownUntil becomes 962
      ...Array(7).fill({ held: false }), // ts 528..924, all < 962
      { held: true, letter: "A" }, // tick 16, ts=990 >= 962
    ],
  },
  {
    name: "reset() clears the fired latch, allowing an immediate re-fire of the same letter",
    run: (t) => {
      const results: { held: boolean; letter?: Letter }[] = [];
      for (const tick of ticksOf("A", 0.95, 8, 0)) results.push(t.push(tick));
      t.reset();
      for (const tick of ticksOf("A", 0.95, 8, 8 * TICK_MS)) results.push(t.push(tick));
      return results;
    },
    expected: [
      ...Array(7).fill({ held: false }),
      { held: true, letter: "A" },
      ...Array(7).fill({ held: false }),
      { held: true, letter: "A" },
    ],
  },
];

export function runAllScenarios(): { name: string; pass: boolean; detail?: string }[] {
  return SCENARIOS.map((scenario) => {
    const tracker = new StabilityTracker();
    const actual = scenario.run(tracker);
    if (actual.length !== scenario.expected.length) {
      return {
        name: scenario.name,
        pass: false,
        detail: `expected ${scenario.expected.length} results, got ${actual.length}`,
      };
    }
    for (let i = 0; i < actual.length; i++) {
      const a = actual[i];
      const e = scenario.expected[i];
      if (!a || !e) continue;
      if (a.held !== e.held || (e.held && a.letter !== e.letter)) {
        return {
          name: scenario.name,
          pass: false,
          detail: `tick ${i}: expected ${JSON.stringify(e)}, got ${JSON.stringify(a)}`,
        };
      }
    }
    return { name: scenario.name, pass: true };
  });
}

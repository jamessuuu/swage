/**
 * stability.ts — SPEC.md §5, §7.1. Debounce/hysteresis over a stream of
 * per-frame classifications. Knows nothing about "target letter" or
 * "session" (SPEC.md §4's isolation rule) — the practice UI decides what a
 * `held` event means; this file only decides when one has genuinely
 * happened.
 */
import type { Letter } from "./classifier";

export interface StabilityConfig {
  windowSize: number;
  minAgree: number;
  confidenceThreshold: number;
  cooldownMs: number;
}

/**
 * confidenceThreshold is the value scripts/train.ts actually tuned on the
 * val split and committed in model/eval-report.json's own
 * `confidenceThreshold` field (SPEC.md §12.2: "the mechanism is fixed...;
 * the number is an M3 output") — 0.9 on the current (provisional, see
 * model/eval-report.json) training run, not SPEC.md §5's illustrative 0.75.
 */
export const DEFAULT_STABILITY: StabilityConfig = {
  windowSize: 8,
  minAgree: 6,
  confidenceThreshold: 0.9,
  cooldownMs: 500,
};

export interface Tick {
  letter: Letter | null;
  confidence: number;
  ts: number;
}

export interface StabilityResult {
  held: boolean;
  letter?: Letter;
}

/**
 * "Held" rule (SPEC.md §7.1): the last windowSize ticks must have >=minAgree
 * agreeing on the same non-null letter at >=confidenceThreshold confidence
 * — forgiving of one noisy frame, not demanding windowSize consecutive
 * exact matches. Fires once (edge-triggered), then requires the buffer to
 * clear — the same letter re-achieving majority after briefly losing it,
 * a different letter taking over, or cooldownMs elapsing — before firing
 * again. explicit reset() (hand-exits-frame, delegate switch, explicit
 * skip) always clears immediately.
 */
export class StabilityTracker {
  private readonly config: StabilityConfig;
  private buffer: Tick[] = [];
  private firedLetter: Letter | null = null;
  private cooldownUntil = 0;

  constructor(config: StabilityConfig = DEFAULT_STABILITY) {
    this.config = config;
  }

  push(tick: Tick): StabilityResult {
    // F7: a tick's effective label is null below threshold — never a
    // silent guess, regardless of what the classifier itself reported.
    const effective: Tick =
      tick.letter !== null && tick.confidence >= this.config.confidenceThreshold
        ? tick
        : { ...tick, letter: null };

    this.buffer.push(effective);
    if (this.buffer.length > this.config.windowSize) {
      this.buffer.shift();
    }
    if (this.buffer.length < this.config.windowSize) {
      return { held: false };
    }

    const counts = new Map<Letter, number>();
    for (const t of this.buffer) {
      if (t.letter) counts.set(t.letter, (counts.get(t.letter) ?? 0) + 1);
    }
    let majorityLetter: Letter | null = null;
    let majorityCount = 0;
    for (const [letter, count] of counts) {
      if (count > majorityCount) {
        majorityCount = count;
        majorityLetter = letter;
      }
    }

    if (!majorityLetter || majorityCount < this.config.minAgree) {
      // Majority lost — one of the three "clear" conditions (SPEC.md
      // §7.1: "letter changes"). The next time any letter reaches
      // majority, it counts as a fresh hold, not a suppressed repeat.
      this.firedLetter = null;
      return { held: false };
    }

    const cooldownExpired = tick.ts >= this.cooldownUntil;
    const isDifferentLetter = majorityLetter !== this.firedLetter;
    if (isDifferentLetter || cooldownExpired) {
      this.firedLetter = majorityLetter;
      this.cooldownUntil = tick.ts + this.config.cooldownMs;
      return { held: true, letter: majorityLetter };
    }
    return { held: false };
  }

  /** Hand-exits-frame, delegate switch, or an explicit skip (SPEC.md §5). */
  reset(): void {
    this.buffer = [];
    this.firedLetter = null;
    this.cooldownUntil = 0;
  }
}

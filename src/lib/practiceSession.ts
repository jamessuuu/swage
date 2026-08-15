/**
 * practiceSession.ts — SPEC.md §9's free-practice session state machine,
 * kept pure and DOM-free (same isolation pattern as stability.ts and
 * scripts/collect/capture.ts) so it is unit-testable without React.
 *
 * SPEC.md §9: "Free practice (24 letters, shuffled with a per-session
 * fixed seed so a session is resumable)." Owns pedagogy (correct/wrong,
 * streaks, session summary); knows nothing about the camera or the
 * classifier — the practice UI feeds it StabilityTracker's `held` events.
 */
import { LETTERS, type Letter } from "./classifier";

export type SessionMode = "free" | "drill";

export interface SessionState {
  readonly mode: SessionMode;
  readonly seed: number;
  readonly order: readonly Letter[];
  readonly index: number;
  readonly attempted: number;
  readonly correct: number;
  readonly currentStreak: number;
  readonly bestStreak: number;
  readonly lastResult: "correct" | "wrong" | null;
  readonly finished: boolean;
}

/** Deterministic PRNG (mulberry32) — same algorithm as scripts/train-data.ts's
 * seededShuffle, duplicated rather than shared: that file lives under
 * scripts/ (build-time, imports tfjs transitively via sibling modules) and
 * this one ships to the browser (SPEC.md §4's isolation rule again). */
function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** SPEC.md §9's "Free practice" — the full 24-letter set, shuffled once
 * with a per-session fixed seed. */
export function createSession(seed: number, letters: readonly Letter[] = LETTERS): SessionState {
  return {
    mode: "free",
    seed,
    order: seededShuffle(letters, seed),
    index: 0,
    attempted: 0,
    correct: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastResult: null,
    finished: letters.length === 0,
  };
}

/**
 * SPEC.md §9's "Drill" — the order is supplied pre-built by the caller
 * (PracticeClient, via progress.ts's nextDrillLetter('confusable'|'weak'),
 * called once per slot so each pick can react to the visitor's own latest
 * misses) rather than shuffled here. Not seed-reproducible the way Free
 * practice is — deliberately: progress.ts's own weighting already draws on
 * localStorage state, so "resumable from a fixed seed" does not apply the
 * same way to an adaptive drill.
 */
export function createSessionFromOrder(order: readonly Letter[]): SessionState {
  return {
    mode: "drill",
    seed: 0,
    order,
    index: 0,
    attempted: 0,
    correct: 0,
    currentStreak: 0,
    bestStreak: 0,
    lastResult: null,
    finished: order.length === 0,
  };
}

export function currentTarget(state: SessionState): Letter | null {
  if (state.finished) return null;
  return state.order[state.index] ?? null;
}

/** A held prediction matching the target: SPEC.md §9's "Correct" path —
 * static confirmation, auto-advance. */
export function recordCorrect(state: SessionState): SessionState {
  if (state.finished) return state;
  const currentStreak = state.currentStreak + 1;
  const nextIndex = state.index + 1;
  return {
    ...state,
    index: nextIndex,
    attempted: state.attempted + 1,
    correct: state.correct + 1,
    currentStreak,
    bestStreak: Math.max(state.bestStreak, currentStreak),
    lastResult: "correct",
    finished: nextIndex >= state.order.length,
  };
}

/** A held prediction that does not match the target: SPEC.md §9's "Wrong"
 * path — "no penalty framing"; the target stays the same for an immediate
 * retry (index does not advance). */
export function recordWrong(state: SessionState): SessionState {
  if (state.finished) return state;
  return {
    ...state,
    attempted: state.attempted + 1,
    currentStreak: 0,
    lastResult: "wrong",
  };
}

/** SPEC.md §9: "an explicit, keyboard-reachable 'skip' is always
 * available" — advances without counting as an attempt either way. */
export function skip(state: SessionState): SessionState {
  if (state.finished) return state;
  const nextIndex = state.index + 1;
  return {
    ...state,
    index: nextIndex,
    currentStreak: 0,
    lastResult: null,
    finished: nextIndex >= state.order.length,
  };
}

export function accuracyPercent(state: SessionState): number {
  return state.attempted > 0 ? Math.round((state.correct / state.attempted) * 100) : 0;
}

/**
 * progress.ts — SPEC.md §3.6, §5, §7.3's F10 failure contract. Client-side
 * progress, `localStorage` key `swage-progress-v1`. Never transmitted
 * (SPEC.md §7.2's privacy claim covers this file too — it never imports
 * `fetch` or anything network-shaped).
 *
 * F10: "localStorage unavailable -> practice still works in-session; UI
 * says progress will not persist. Never throws." Every localStorage
 * access in this file is wrapped; `isPersistenceAvailable()` lets the UI
 * show that message instead of discovering it via a thrown exception.
 */
import type { Letter } from "./classifier";
import { LETTERS } from "./classifier";
import evalReport from "../../model/eval-report.json" with { type: "json" };

const STORAGE_KEY = "swage-progress-v1";

export interface SessionRecord {
  date: string; // ISO 8601 date
  attempted: number;
  correct: number;
  bestStreak: number;
}

export type PerLetterStats = Record<Letter, { seen: number; correct: number }>;

export interface ProgressV1 {
  version: 1;
  sessions: SessionRecord[];
  perLetter: PerLetterStats;
}

function emptyPerLetter(): PerLetterStats {
  const out = {} as PerLetterStats;
  for (const letter of LETTERS) out[letter] = { seen: 0, correct: 0 };
  return out;
}

function emptyProgress(): ProgressV1 {
  return { version: 1, sessions: [], perLetter: emptyPerLetter() };
}

function isValidProgress(value: unknown): value is ProgressV1 {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.version === 1 && Array.isArray(v.sessions) && typeof v.perLetter === "object" && v.perLetter !== null;
}

/** In-memory fallback so a session that never had localStorage still
 * behaves consistently within itself (F10: practice still works). */
let memoryFallback: ProgressV1 | null = null;

export function isPersistenceAvailable(): boolean {
  try {
    if (typeof window === "undefined" || !window.localStorage) return false;
    const probeKey = `${STORAGE_KEY}-probe`;
    window.localStorage.setItem(probeKey, "1");
    window.localStorage.removeItem(probeKey);
    return true;
  } catch {
    return false;
  }
}

function load(): ProgressV1 {
  if (memoryFallback) return memoryFallback;
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      memoryFallback = emptyProgress();
      return memoryFallback;
    }
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed: unknown = JSON.parse(raw);
    return isValidProgress(parsed) ? parsed : emptyProgress();
  } catch {
    memoryFallback = emptyProgress();
    return memoryFallback;
  }
}

function save(progress: ProgressV1): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) {
      memoryFallback = progress;
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // F10: never throws — the attempt is simply not persisted this time.
    memoryFallback = progress;
  }
}

export function getProgress(): ProgressV1 {
  return load();
}

/** Appends to today's session record (creating one if this is the first
 * attempt today), and updates the per-letter tally. `holdMs` is accepted
 * per SPEC.md §5's signature but not yet aggregated anywhere (no
 * consumer needs it yet) — kept rather than silently dropped from the
 * signature, so a future timing-based feature doesn't need a breaking
 * change here. */
export function recordAttempt(letter: Letter, correct: boolean, holdMs: number): void {
  void holdMs; // see the doc comment above — accepted, not yet aggregated
  const progress = load();
  const today = new Date().toISOString().slice(0, 10);
  let session = progress.sessions.find((s) => s.date === today);
  if (!session) {
    session = { date: today, attempted: 0, correct: 0, bestStreak: 0 };
    progress.sessions.push(session);
  }
  session.attempted += 1;
  if (correct) session.correct += 1;

  const letterStats = progress.perLetter[letter] ?? { seen: 0, correct: 0 };
  letterStats.seen += 1;
  if (correct) letterStats.correct += 1;
  progress.perLetter[letter] = letterStats;

  save(progress);
}

/** Records a new best streak for today's session, if higher than what is
 * already stored — the practice UI owns streak bookkeeping in memory
 * (src/lib/practiceSession.ts) and reports the final value here. */
export function recordBestStreak(streak: number): void {
  const progress = load();
  const today = new Date().toISOString().slice(0, 10);
  let session = progress.sessions.find((s) => s.date === today);
  if (!session) {
    session = { date: today, attempted: 0, correct: 0, bestStreak: 0 };
    progress.sessions.push(session);
  }
  session.bestStreak = Math.max(session.bestStreak, streak);
  save(progress);
}

const CONFUSABLE_PAIRS = evalReport.confusablePairs as [string, string][];

/**
 * SPEC.md §9: "the app's own published eval decides what to drill, not a
 * hardcoded guess." 'confusable' weights toward letters named in
 * model/eval-report.json's own confusion pairs; 'weak' weights toward the
 * visitor's own lowest per-letter accuracy; 'random' is a uniform pick.
 * All three fall back to a uniform pick over the full label set when
 * there is not enough data yet (F10-adjacent: never throws for "no
 * history").
 */
export function nextDrillLetter(bias: "confusable" | "weak" | "random"): Letter {
  if (bias === "random") {
    return pickUniform(LETTERS);
  }

  if (bias === "confusable") {
    const pool = CONFUSABLE_PAIRS.flat() as Letter[];
    return pool.length > 0 ? pickUniform(pool) : pickUniform(LETTERS);
  }

  // bias === "weak": weight toward letters with the lowest accuracy so
  // far (seen > 0), falling back to uniform once there is no history at
  // all for any letter yet.
  const progress = load();
  const withHistory = LETTERS.filter((l) => (progress.perLetter[l]?.seen ?? 0) > 0);
  if (withHistory.length === 0) return pickUniform(LETTERS);

  const accuracyOf = (l: Letter): number => {
    const stats = progress.perLetter[l];
    return stats && stats.seen > 0 ? stats.correct / stats.seen : 0;
  };
  const weakest = [...withHistory].sort((a, b) => accuracyOf(a) - accuracyOf(b));
  // Draw from the bottom third (at least 1 letter) rather than always the
  // single weakest, so the drill does not get stuck repeating one letter.
  const bottomThird = Math.max(1, Math.ceil(weakest.length / 3));
  return pickUniform(weakest.slice(0, bottomThird));
}

function pickUniform<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  // items is always non-empty at every call site above.
  return item as T;
}

export function clearProgress(): void {
  memoryFallback = null;
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // F10: never throws.
  }
}

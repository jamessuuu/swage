/**
 * capture.ts — the recording session state machine, deliberately separated
 * from main.ts's browser/DOM glue so it is unit-testable without a camera
 * (same pattern as src/lib/stability.ts owning no UI concept — SPEC.md §4).
 */
import { LETTERS, type Letter } from "../../src/lib/classifier";
import type { RawLandmark, Handedness } from "../../src/lib/normalize";
import { isSelfCollectedSample, type SelfCollectedSample } from "./schema";

/** SPEC.md §3.1: "~20 reps x 24 letters (~480 samples/signer)". */
export const REPS_PER_LETTER = 20;

export interface CaptureProgress {
  letter: Letter;
  rep: number; // 1-indexed, within the current letter
  repsPerLetter: number;
  letterIndex: number; // 0-indexed
  totalLetters: number;
  samplesCaptured: number;
  samplesTotal: number;
}

export class CaptureSession {
  private readonly signerId: string;
  private readonly letters: readonly Letter[];
  private letterIndex = 0;
  private rep = 0; // samples captured for the current letter so far
  private captured: SelfCollectedSample[] = [];

  constructor(signerId: string, letters: readonly Letter[] = LETTERS) {
    if (!signerId.trim()) {
      throw new Error("signerId must not be empty");
    }
    if (letters.length === 0) {
      throw new Error("letters must not be empty");
    }
    this.signerId = signerId.trim();
    this.letters = letters;
  }

  isComplete(): boolean {
    return this.letterIndex >= this.letters.length;
  }

  currentLetter(): Letter | null {
    return this.isComplete() ? null : (this.letters[this.letterIndex] ?? null);
  }

  progress(): CaptureProgress {
    const letter = this.currentLetter() ?? this.letters[this.letters.length - 1] ?? "A";
    return {
      letter,
      rep: this.rep + 1,
      repsPerLetter: REPS_PER_LETTER,
      letterIndex: this.letterIndex,
      totalLetters: this.letters.length,
      samplesCaptured: this.captured.length,
      samplesTotal: this.letters.length * REPS_PER_LETTER,
    };
  }

  /** Records one sample for the current letter/rep and advances the session. */
  recordCapture(landmarks: readonly RawLandmark[], handedness: Handedness): SelfCollectedSample {
    if (this.isComplete()) {
      throw new Error("session already complete — nothing left to capture");
    }
    if (landmarks.length !== 21) {
      throw new Error(`expected 21 landmarks, got ${landmarks.length}`);
    }
    const letter = this.currentLetter();
    if (!letter) throw new Error("no current letter");

    const sample: SelfCollectedSample = {
      version: 1,
      signerId: this.signerId,
      letter,
      handedness,
      landmarks: landmarks.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      capturedAt: new Date().toISOString(),
    };
    if (!isSelfCollectedSample(sample)) {
      // Defensive — should be unreachable given the checks above.
      throw new Error("built an invalid sample record");
    }
    this.captured.push(sample);

    this.rep++;
    if (this.rep >= REPS_PER_LETTER) {
      this.rep = 0;
      this.letterIndex++;
    }
    return sample;
  }

  /** Operator override: abandon the current letter early (SPEC.md doesn't
   * mandate this, but 20 unbroken reps of a fatiguing handshape is a real
   * volunteer-experience risk worth not hard-blocking on). */
  skipLetter(): void {
    if (this.isComplete()) return;
    this.rep = 0;
    this.letterIndex++;
  }

  samples(): readonly SelfCollectedSample[] {
    return this.captured;
  }

  /** Relative path convention: data/self-collected/<signerId>/<LETTER>/<n>.json */
  static pathFor(sample: SelfCollectedSample, index: number): string {
    return `${sample.signerId}/${sample.letter}/${String(index).padStart(4, "0")}.json`;
  }
}

import { describe, expect, it } from "vitest";
import { CaptureSession, REPS_PER_LETTER } from "./capture";
import type { RawLandmark } from "../../src/lib/normalize";

function fakeLandmarks(): RawLandmark[] {
  return Array.from({ length: 21 }, (_, i) => ({ x: i / 21, y: 0, z: 0 }));
}

describe("CaptureSession", () => {
  it("rejects an empty signerId", () => {
    expect(() => new CaptureSession("")).toThrow();
    expect(() => new CaptureSession("   ")).toThrow();
  });

  it("walks through letters in order, REPS_PER_LETTER reps each", () => {
    const session = new CaptureSession("volunteer-1", ["A", "B"]);
    expect(session.progress().letter).toBe("A");

    for (let i = 0; i < REPS_PER_LETTER; i++) {
      expect(session.isComplete()).toBe(false);
      session.recordCapture(fakeLandmarks(), "Right");
    }
    expect(session.progress().letter).toBe("B");
    expect(session.progress().rep).toBe(1);

    for (let i = 0; i < REPS_PER_LETTER; i++) {
      session.recordCapture(fakeLandmarks(), "Right");
    }
    expect(session.isComplete()).toBe(true);
  });

  it("throws once the session is complete", () => {
    const session = new CaptureSession("volunteer-1", ["A"]);
    for (let i = 0; i < REPS_PER_LETTER; i++) session.recordCapture(fakeLandmarks(), "Right");
    expect(session.isComplete()).toBe(true);
    expect(() => session.recordCapture(fakeLandmarks(), "Right")).toThrow();
  });

  it("rejects a landmark set that is not exactly 21 points", () => {
    const session = new CaptureSession("volunteer-1", ["A"]);
    expect(() => session.recordCapture(fakeLandmarks().slice(0, 5), "Right")).toThrow();
  });

  it("tags every captured sample with the signerId, letter, and handedness", () => {
    const session = new CaptureSession(" volunteer-2 ", ["A"]);
    const sample = session.recordCapture(fakeLandmarks(), "Left");
    expect(sample.signerId).toBe("volunteer-2"); // trimmed
    expect(sample.letter).toBe("A");
    expect(sample.handedness).toBe("Left");
    expect(sample.landmarks).toHaveLength(21);
    expect(sample.version).toBe(1);
  });

  it("skipLetter advances to the next letter without recording a sample", () => {
    const session = new CaptureSession("volunteer-3", ["A", "B", "C"]);
    session.skipLetter();
    expect(session.progress().letter).toBe("B");
    expect(session.samples()).toHaveLength(0);
  });

  it("pathFor builds the data/self-collected/<signer>/<letter>/<n>.json convention", () => {
    const session = new CaptureSession("volunteer-4", ["A"]);
    const sample = session.recordCapture(fakeLandmarks(), "Right");
    expect(CaptureSession.pathFor(sample, 3)).toBe("volunteer-4/A/0003.json");
  });

  it("samplesTotal matches letters.length * REPS_PER_LETTER", () => {
    const session = new CaptureSession("volunteer-5", ["A", "B", "C"]);
    expect(session.progress().samplesTotal).toBe(3 * REPS_PER_LETTER);
  });
});

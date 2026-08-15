/**
 * schema.ts — the self-collected sample record (SPEC.md §3.1). Saved
 * verbatim (one JSON file per sample) into
 * data/self-collected/<signerId>/<LETTER>/<id>.json, mirroring
 * data/asl-now/'s per-letter folder convention with an extra signerId
 * level, which is exactly the field asl-now is missing and this project
 * collects specifically to support a genuine per-signer holdout (§3.2).
 *
 * Deliberately richer than asl-now's bare landmark array: asl-now has no
 * handedness field (a real, stated gap, SPEC.md §3.1); this schema records
 * it explicitly since the capture tool controls collection and can.
 */
import type { RawLandmark, Handedness } from "../../src/lib/normalize";
import type { Letter } from "../../src/lib/classifier";

export interface SelfCollectedSample {
  version: 1;
  signerId: string;
  letter: Letter;
  handedness: Handedness;
  /** Exactly 21 raw (un-normalized) landmarks, same shape as asl-now's files. */
  landmarks: RawLandmark[];
  capturedAt: string; // ISO 8601
}

export function isSelfCollectedSample(value: unknown): value is SelfCollectedSample {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v.version === 1 &&
    typeof v.signerId === "string" &&
    v.signerId.length > 0 &&
    typeof v.letter === "string" &&
    (v.handedness === "Left" || v.handedness === "Right") &&
    Array.isArray(v.landmarks) &&
    v.landmarks.length === 21 &&
    typeof v.capturedAt === "string"
  );
}

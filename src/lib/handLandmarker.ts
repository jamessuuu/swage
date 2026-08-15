/**
 * handLandmarker.ts — thin wrapper around @mediapipe/tasks-vision's
 * HandLandmarker (SPEC.md §4 Runtime, Model Card research/phase2-model-
 * cards.md §P6).
 *
 * M1 scope: GPU delegate only, no CPU fallback yet (SPEC.md M1 row). M6
 * adds the catch-and-retry-CPU path (F3) and the manual fetch+Cache Storage
 * fix (F5) in their own commit, in this same file.
 *
 * Versions pinned to what phase2-model-cards.md §P6 actually measured:
 * @mediapipe/tasks-vision@1.0.1, hand_landmarker float16 from Google's own
 * CDN. `numHands: 1` per SPEC.md §3.4 (fingerspelling is one-handed).
 */
import {
  FilesetResolver,
  HandLandmarker,
  type HandLandmarkerResult,
} from "@mediapipe/tasks-vision";

const TASKS_VISION_VERSION = "1.0.1";
export const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
export const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

export type Delegate = "GPU" | "CPU";

export async function createHandLandmarker(
  delegate: Delegate,
): Promise<HandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: MODEL_URL,
      delegate,
    },
    runningMode: "VIDEO",
    numHands: 1,
  });
}

export type { HandLandmarkerResult };
export { HandLandmarker };

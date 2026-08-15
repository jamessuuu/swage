/**
 * handLandmarker.ts — thin wrapper around @mediapipe/tasks-vision's
 * HandLandmarker (SPEC.md §4 Runtime, Model Card research/phase2-model-
 * cards.md §P6).
 *
 * M6 adds the two pieces M1 deliberately deferred (SPEC.md §6):
 *  - F3: GPU delegate creation is caught, not left to crash the app —
 *    MediaPipe's own rejection message on a WebGL-less context is
 *    `StartGraph failed: INTERNAL Service kGpuService was not provided
 *    and cannot be created` (verified live,
 *    research/phase2-model-cards.md §P6's failure-mode table). Retried
 *    once with `delegate: 'CPU'`, which MediaPipe does NOT do on its own.
 *  - F5: the model bytes come from src/lib/modelCache.ts's manual
 *    fetch + Cache Storage path, via `modelAssetBuffer`, never
 *    `modelAssetPath` — see that file's header for why.
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
import { fetchModelBuffer } from "./modelCache";

const TASKS_VISION_VERSION = "1.0.1";
export const WASM_BASE_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`;
export const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task";

export type Delegate = "GPU" | "CPU";

async function createWithDelegate(delegate: Delegate, modelAssetBuffer: Uint8Array): Promise<HandLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE_URL);
  return HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetBuffer,
      delegate,
    },
    runningMode: "VIDEO",
    numHands: 1,
  });
}

/** Single-delegate creation, no fallback — kept for callers (and tests)
 * that want to force a specific delegate rather than the F3 ladder. */
export async function createHandLandmarker(delegate: Delegate): Promise<HandLandmarker> {
  const modelAssetBuffer = await fetchModelBuffer(MODEL_URL);
  return createWithDelegate(delegate, modelAssetBuffer);
}

export interface HandLandmarkerWithDelegate {
  landmarker: HandLandmarker;
  delegate: Delegate;
}

/**
 * SPEC.md F3: try the GPU delegate; if creation rejects (no WebGL2/WebGL1
 * context — includes SPEC.md's "one branch, not two rungs" framing, since
 * MediaPipe's CPU delegate is pure WASM and needs no WebGL either way),
 * catch it and retry once with `delegate: 'CPU'`. The model bytes are
 * fetched once and reused for both attempts.
 */
export async function createHandLandmarkerWithFallback(): Promise<HandLandmarkerWithDelegate> {
  const modelAssetBuffer = await fetchModelBuffer(MODEL_URL);
  try {
    const landmarker = await createWithDelegate("GPU", modelAssetBuffer);
    return { landmarker, delegate: "GPU" };
  } catch {
    const landmarker = await createWithDelegate("CPU", modelAssetBuffer);
    return { landmarker, delegate: "CPU" };
  }
}

export type { HandLandmarkerResult };
export { HandLandmarker };

/**
 * main.ts — browser glue for the volunteer capture tool (SPEC.md §3.1,
 * §10 M2). Reuses the exact same src/lib modules production imports:
 * createHandLandmarker, normalizeLandmarks, classify, drawHandOverlay —
 * so what gets recorded is produced by the identical code path, never a
 * hand-rolled second implementation that could quietly drift.
 *
 * Run: `pnpm run collect` (vite dev server over this directory).
 */
import { createHandLandmarker } from "../../src/lib/handLandmarker";
import { normalizeLandmarks, type Handedness } from "../../src/lib/normalize";
import { classify } from "../../src/lib/classifier";
import { drawHandOverlay, clearOverlay } from "../../src/lib/drawOverlay";
import { CaptureSession } from "./capture";
import type { SelfCollectedSample } from "./schema";
import type { HandLandmarker } from "@mediapipe/tasks-vision";

const FRAME_BUDGET_MS = 66;

const el = <T extends HTMLElement>(id: string): T => {
  const found = document.getElementById(id);
  if (!found) throw new Error(`missing #${id}`);
  return found as T;
};

const setupEl = el<HTMLDivElement>("setup");
const captureEl = el<HTMLDivElement>("capture");
const doneEl = el<HTMLDivElement>("done");
const signerIdInput = el<HTMLInputElement>("signerId");
const consentCheckbox = el<HTMLInputElement>("consent");
const startBtn = el<HTMLButtonElement>("start");
const video = el<HTMLVideoElement>("video");
const overlay = el<HTMLCanvasElement>("overlay");
const progressEl = el<HTMLParagraphElement>("progress");
const statusEl = el<HTMLParagraphElement>("status");
const captureBtn = el<HTMLButtonElement>("captureBtn");
const skipBtn = el<HTMLButtonElement>("skipBtn");
const saveDirBtn = el<HTMLButtonElement>("saveDirBtn");
const doneSummary = el<HTMLParagraphElement>("doneSummary");
const downloadAllBtn = el<HTMLButtonElement>("downloadAllBtn");

let session: CaptureSession | null = null;
let landmarker: HandLandmarker | null = null;
let lastDetect = 0;
let saveDir: FileSystemDirectoryHandle | null = null;
let latest: { landmarks: { x: number; y: number; z: number }[]; handedness: Handedness } | null = null;
let fileIndex = 0;

function setStatus(text: string, tone: "info" | "warn" = "info"): void {
  statusEl.textContent = text;
  statusEl.dataset.tone = tone;
}

function renderProgress(): void {
  if (!session) return;
  const p = session.progress();
  progressEl.textContent = `Letter ${p.letterIndex + 1}/${p.totalLetters}: "${p.letter}" — rep ${p.rep}/${p.repsPerLetter} (${p.samplesCaptured}/${p.samplesTotal} total)`;
}

async function writeSample(sample: SelfCollectedSample): Promise<void> {
  const relPath = CaptureSession.pathFor(sample, fileIndex++);
  if (saveDir) {
    const [signerDir, letterDir, fileName] = relPath.split("/") as [string, string, string];
    const signerHandle = await saveDir.getDirectoryHandle(signerDir, { create: true });
    const letterHandle = await signerHandle.getDirectoryHandle(letterDir, { create: true });
    const fileHandle = await letterHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(sample));
    await writable.close();
  }
  // Whether or not a save folder was chosen, samples also accumulate in
  // `session` (CaptureSession.samples()) so the end-of-session "download
  // all" fallback always has everything, not just what a folder write
  // captured.
}

function tick(now: number): void {
  requestAnimationFrame(tick);
  if (!landmarker || video.readyState < 2) return;
  if (now - lastDetect < FRAME_BUDGET_MS) return;
  lastDetect = now;

  let result;
  try {
    result = landmarker.detectForVideo(video, now);
  } catch {
    return;
  }

  const canvas = overlay;
  const ctx = canvas.getContext("2d");
  const landmarks = result.landmarks[0];
  const handednessCategory = result.handedness[0]?.[0];

  if (!landmarks || !handednessCategory || !ctx) {
    latest = null;
    if (ctx) clearOverlay(ctx, canvas.width, canvas.height);
    setStatus("No hand detected.", "warn");
    return;
  }

  const handedness = handednessCategory.categoryName as Handedness;
  latest = { landmarks, handedness };
  drawHandOverlay(ctx, landmarks, canvas.width, canvas.height);

  try {
    const vec = normalizeLandmarks(landmarks, handedness);
    const { letter, confidence } = classify(vec);
    setStatus(`Hand detected — live read: ${letter} (${(confidence * 100).toFixed(0)}%, stub classifier, sanity-check only).`);
  } catch {
    setStatus("Hand detected, but could not be normalized (degenerate pose).", "warn");
  }
}

async function doCapture(): Promise<void> {
  if (!session || session.isComplete()) return;
  if (!latest) {
    setStatus("No hand detected right now — nothing captured.", "warn");
    return;
  }
  const sample = session.recordCapture(latest.landmarks, latest.handedness);
  await writeSample(sample);
  renderProgress();
  if (session.isComplete()) {
    finish();
  }
}

function finish(): void {
  captureEl.hidden = true;
  doneEl.hidden = false;
  const total = session?.samples().length ?? 0;
  doneSummary.textContent = saveDir
    ? `${total} samples written to the chosen folder.`
    : `${total} samples captured in-memory — no folder was chosen, use the download button below.`;
}

startBtn.addEventListener("click", () => {
  void (async () => {
    const signerId = signerIdInput.value.trim();
    if (!signerId) {
      alert("Enter a signer ID first.");
      return;
    }
    if (!consentCheckbox.checked) {
      alert("Confirm recorded consent before capturing.");
      return;
    }

    session = new CaptureSession(signerId);
    setupEl.hidden = true;
    captureEl.hidden = false;
    renderProgress();
    setStatus("Requesting camera…");

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    });
    video.srcObject = stream;
    await video.play().catch(() => {});
    video.addEventListener(
      "loadedmetadata",
      () => {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
      },
      { once: true },
    );

    setStatus("Loading hand-tracking model…");
    landmarker = await createHandLandmarker("GPU");
    setStatus("Ready.");
    lastDetect = 0;
    requestAnimationFrame(tick);
  })();
});

captureBtn.addEventListener("click", () => void doCapture());
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !captureEl.hidden) {
    e.preventDefault();
    void doCapture();
  }
});

skipBtn.addEventListener("click", () => {
  session?.skipLetter();
  renderProgress();
  if (session?.isComplete()) finish();
});

saveDirBtn.addEventListener("click", () => {
  void (async () => {
    if (!window.showDirectoryPicker) {
      alert("This browser does not support choosing a save folder — use the download-all fallback at the end instead.");
      return;
    }
    saveDir = await window.showDirectoryPicker();
    setStatus("Save folder chosen — captures will be written live.");
  })();
});

downloadAllBtn.addEventListener("click", () => {
  const all = session?.samples() ?? [];
  const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `swage-capture-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

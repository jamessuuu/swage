/**
 * drawOverlay.ts — the landmark overlay, drawn in-brand rather than
 * MediaPipe's stock rainbow skeleton (SPEC.md §11 Brand acceptance
 * criterion). Ink strokes, one amber accent (the wrist, this pipeline's
 * anchor point for every downstream normalization step).
 */
import { HandLandmarker } from "@mediapipe/tasks-vision";
import { PALETTE } from "./brand";

export interface OverlayPoint {
  x: number;
  y: number;
  z: number;
}

const WRIST_INDEX = 0;

/**
 * Draws hand landmarks + connections onto a canvas already sized to match
 * the video element in CSS pixels. Landmarks are in MediaPipe's normalized
 * [0,1] image-space coordinates (the same, unmirrored space the video
 * frame is captured in) — the caller mirrors the *container* in CSS so
 * video and canvas flip together for a natural selfie-view.
 */
export function drawHandOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: readonly OverlayPoint[],
  width: number,
  height: number,
): void {
  ctx.clearRect(0, 0, width, height);
  if (landmarks.length === 0) return;

  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.ink;
  ctx.beginPath();
  for (const { start, end } of HandLandmarker.HAND_CONNECTIONS) {
    const a = landmarks[start];
    const b = landmarks[end];
    if (!a || !b) continue;
    ctx.moveTo(a.x * width, a.y * height);
    ctx.lineTo(b.x * width, b.y * height);
  }
  ctx.stroke();

  for (let i = 0; i < landmarks.length; i++) {
    const p = landmarks[i];
    if (!p) continue;
    const isWrist = i === WRIST_INDEX;
    ctx.beginPath();
    ctx.fillStyle = isWrist ? PALETTE.amber : PALETTE.ink;
    ctx.arc(p.x * width, p.y * height, isWrist ? 5 : 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function clearOverlay(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.clearRect(0, 0, width, height);
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createHandLandmarker,
  type Delegate,
  type HandLandmarkerResult,
} from "@/lib/handLandmarker";
import { normalizeLandmarks, type Handedness } from "@/lib/normalize";
import { classify, type ClassifyResult } from "@/lib/classifier";
import type { HandLandmarker } from "@mediapipe/tasks-vision";

/** SPEC.md §7.1: detection decimated to ~15Hz regardless of delegate. */
const FRAME_BUDGET_MS = 66;

export type TrackingStatus =
  | "idle"
  | "requesting-camera"
  | "loading-model"
  | "running"
  | "camera-denied"
  | "no-camera"
  | "model-error";

export interface TrackingState {
  status: TrackingStatus;
  errorMessage: string | null;
  delegate: Delegate | null;
  prediction: ClassifyResult | null;
  /** Raw landmarks of the most recent detection, image-space [0,1] — for overlay drawing. */
  rawLandmarks: { x: number; y: number; z: number }[] | null;
}

/**
 * Owns the camera -> HandLandmarker -> normalize -> classify pipeline
 * (SPEC.md §4 Runtime). M1: GPU delegate only. M6 adds the CPU fallback and
 * camera-denied/no-camera flashcard routing on top of the states already
 * modeled here.
 */
export function useHandTracking(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const [state, setState] = useState<TrackingState>({
    status: "idle",
    errorMessage: null,
    delegate: null,
    prediction: null,
    rawLandmarks: null,
  });

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastDetectRef = useRef(0);
  const streamRef = useRef<MediaStream | null>(null);

  const tick = useCallback((now: number) => {
    rafRef.current = requestAnimationFrame(tick);
    const video = videoRef.current;
    const landmarker = landmarkerRef.current;
    if (!video || !landmarker || video.readyState < 2) return;
    if (now - lastDetectRef.current < FRAME_BUDGET_MS) return;
    lastDetectRef.current = now;

    let result: HandLandmarkerResult;
    try {
      result = landmarker.detectForVideo(video, now);
    } catch {
      // A single bad frame should not kill the loop; skip it.
      return;
    }

    const landmarks = result.landmarks[0];
    const handednessCategory = result.handedness[0]?.[0];
    if (!landmarks || !handednessCategory) {
      setState((s) => ({ ...s, prediction: null, rawLandmarks: null }));
      return;
    }

    const handedness = handednessCategory.categoryName as Handedness;
    try {
      const vec = normalizeLandmarks(landmarks, handedness);
      const prediction = classify(vec);
      setState((s) => ({ ...s, prediction, rawLandmarks: landmarks }));
    } catch {
      setState((s) => ({ ...s, prediction: null, rawLandmarks: landmarks }));
    }
  }, [videoRef]);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setState((s) => ({ ...s, status: "requesting-camera", errorMessage: null }));
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "UnknownError";
      const status: TrackingStatus =
        name === "NotFoundError" || name === "OverconstrainedError"
          ? "no-camera"
          : "camera-denied";
      setState((s) => ({ ...s, status, errorMessage: String(err) }));
      return;
    }
    streamRef.current = stream;
    const video = videoRef.current;
    if (video) {
      video.srcObject = stream;
      await video.play().catch(() => {});
    }

    setState((s) => ({ ...s, status: "loading-model" }));
    try {
      landmarkerRef.current = await createHandLandmarker("GPU");
      setState((s) => ({ ...s, status: "running", delegate: "GPU" }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "model-error",
        errorMessage: err instanceof Error ? err.message : String(err),
      }));
      return;
    }

    lastDetectRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
  }, [tick, videoRef]);

  useEffect(() => stop, [stop]);

  return { state, start, stop };
}

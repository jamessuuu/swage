"use client";

import { useEffect, useRef } from "react";
import { useHandTracking } from "./useHandTracking";
import { drawHandOverlay, clearOverlay } from "@/lib/drawOverlay";

/**
 * M1 walking skeleton (SPEC.md M1 row), classifier upgraded to the real
 * model at M4: camera -> HandLandmarker (GPU only) -> normalize.ts ->
 * classifier.ts (the committed, trained model — see its own header for the
 * provisional-eval caveat) -> live overlay + predicted label. No
 * stability/session UI yet (M5), no CPU/flashcard fallback yet (M6), no
 * progress/drill yet (M7) — those land in their own commits on top of this
 * same page.
 */
export default function PracticeClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { state, start } = useHandTracking(videoRef);

  // Size the canvas to the video's intrinsic resolution once known, so
  // overlay coordinates (normalized [0,1] * width/height) line up exactly.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoadedMetadata = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    };
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => video.removeEventListener("loadedmetadata", onLoadedMetadata);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (state.rawLandmarks) {
      drawHandOverlay(ctx, state.rawLandmarks, canvas.width, canvas.height);
    } else {
      clearOverlay(ctx, canvas.width, canvas.height);
    }
  }, [state.rawLandmarks]);

  return (
    <main className="practice">
      <h1>Practice</h1>
      <p className="honesty-line">
        This checks handshapes, not ASL. ASL is a full language with its own
        grammar and facial and body grammar this tool doesn&apos;t see.
      </p>

      {state.status === "idle" && (
        <button type="button" onClick={() => void start()} data-testid="start-camera">
          Start camera
        </button>
      )}

      {(state.status === "camera-denied" || state.status === "no-camera") && (
        <p role="alert" data-testid="camera-error">
          {state.status === "no-camera"
            ? "No camera was found on this device."
            : "Camera access was denied."}{" "}
          A non-camera practice mode is coming (SPEC.md F1/F2) — not built yet
          in this milestone.
        </p>
      )}

      {state.status === "model-error" && (
        <p role="alert" data-testid="model-error">
          Could not load the hand-tracking model: {state.errorMessage}
        </p>
      )}

      <div className="camera-frame" data-status={state.status}>
        <video
          ref={videoRef}
          data-testid="camera-video"
          autoPlay
          playsInline
          muted
        />
        <canvas ref={canvasRef} data-testid="overlay-canvas" />
      </div>

      <p data-testid="predicted-letter" className="predicted-letter">
        {state.status === "loading-model" && "Loading hand-tracking model…"}
        {state.status === "running" && state.prediction && (
          <>
            Handshape match: <strong>{state.prediction.letter}</strong>
          </>
        )}
        {state.status === "running" && !state.prediction && "No hand detected."}
      </p>

      {state.delegate && (
        <p className="delegate-badge" data-testid="delegate-badge" data-delegate={state.delegate}>
          {state.delegate === "GPU"
            ? "Running on GPU."
            : "Running on CPU — same result, about 15 frames a second instead of 35."}
        </p>
      )}
    </main>
  );
}

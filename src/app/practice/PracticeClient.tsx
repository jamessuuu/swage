"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useHandTracking } from "./useHandTracking";
import { drawHandOverlay, clearOverlay } from "@/lib/drawOverlay";
import {
  accuracyPercent,
  createSession,
  currentTarget,
  recordCorrect,
  recordWrong,
  skip as skipTarget,
  type SessionState,
} from "@/lib/practiceSession";
import { HANDSHAPE_HINTS } from "@/lib/handshapeHints";
import { areConfusable } from "@/lib/confusablePairs";
import type { Letter } from "@/lib/classifier";

function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/**
 * M1 walking skeleton (SPEC.md M1 row), classifier upgraded to the real
 * model at M4, free-practice session added at M5: camera -> HandLandmarker
 * (GPU only) -> normalize.ts -> classifier.ts -> stability.ts -> the
 * target picker / feedback / session-summary loop SPEC.md §9 describes.
 * M6 adds the degradation ladder: GPU-rejection -> CPU (handled inside
 * useHandTracking/handLandmarker.ts, F3) and camera-denied/no-camera ->
 * the keyboard-operable flashcard path below (F1/F2). No persisted
 * progress/drill yet (M7) — that lands in its own commit on top of this
 * same page.
 */
export default function PracticeClient() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Seed 0 (not Math.random()) for the very first session: this component
  // is server-rendered before hydration, and picking a random seed during
  // that first render would not match what the client's own first render
  // picks independently — a real React hydration-mismatch error, caught
  // by this project's own e2e suite (two different shuffled orders, SSR
  // vs. client, landed in the DOM for the same node). A fixed opening
  // order is a perfectly legitimate SPEC.md §9 session on its own; real
  // per-visit variety starts the moment the visitor hits "Practice again"
  // (handlePracticeAgain below), which reseeds from a genuine user
  // interaction, not a render — no mismatch is possible there.
  const [session, setSession] = useState<SessionState>(() => createSession(0));
  const [confusableHint, setConfusableHint] = useState<Letter | null>(null);

  const handleHeld = useCallback(
    (letter: Letter) => {
      setSession((prev) => {
        const target = currentTarget(prev);
        if (target === null) return prev;
        if (letter === target) {
          setConfusableHint(null);
          return recordCorrect(prev);
        }
        setConfusableHint(areConfusable(target, letter) ? letter : null);
        return recordWrong(prev);
      });
    },
    [],
  );

  const { state, start, resetStability } = useHandTracking(videoRef, handleHeld);

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

  const target = currentTarget(session);
  // SPEC.md F1/F2: camera permission denied or no camera hardware -> the
  // flashcard path — reference + text description + a manual,
  // keyboard-operable advance. "No dead end": every visitor reaches a
  // working practice loop, camera or not.
  const isFlashcardMode = state.status === "camera-denied" || state.status === "no-camera";

  const handleSkip = () => {
    setConfusableHint(null);
    resetStability();
    setSession((prev) => skipTarget(prev));
  };

  const handlePracticeAgain = () => {
    setConfusableHint(null);
    resetStability();
    setSession(createSession(randomSeed()));
  };

  // SPEC.md §9's flashcard path is explicitly "no grading" — self-reported
  // advancement, not a graded correct/wrong outcome, so it reuses skip()'s
  // state transition (advance, don't touch attempted/correct) rather than
  // recordCorrect()'s.
  const handleMadeThisShape = () => {
    resetStability();
    setSession((prev) => skipTarget(prev));
  };

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

      {isFlashcardMode && (
        <p role="alert" data-testid="camera-error">
          {state.status === "no-camera"
            ? "No camera was found on this device."
            : "Camera access was denied."}{" "}
          Switched to flashcard mode below — no grading, but the same
          letters and hints, fully usable with a keyboard.
        </p>
      )}

      {state.status === "model-error" && (
        <p role="alert" data-testid="model-error">
          Could not load the hand-tracking model: {state.errorMessage}
        </p>
      )}

      {session.finished ? (
        <section data-testid="session-summary">
          <h2>Session complete</h2>
          <p>
            {session.correct}/{session.attempted} correct ({accuracyPercent(session)}%),
            best streak {session.bestStreak}.
          </p>
          <button type="button" onClick={handlePracticeAgain} data-testid="practice-again">
            Practice again
          </button>
        </section>
      ) : (
        target && (
          <section data-testid="target-panel">
            <p data-testid="target-letter">
              Show me: <strong>{target}</strong>
            </p>
            <p data-testid="target-hint">{HANDSHAPE_HINTS[target]}</p>
            <p data-testid="session-progress">
              {session.correct}/{session.attempted} correct this session
              {session.currentStreak > 1 ? ` — streak ${session.currentStreak}` : ""}
            </p>
          </section>
        )
      )}

      {!isFlashcardMode && (
        <div className="camera-frame" data-status={state.status}>
          <video ref={videoRef} data-testid="camera-video" autoPlay playsInline muted />
          <canvas ref={canvasRef} data-testid="overlay-canvas" />
        </div>
      )}

      {!isFlashcardMode && (
        <p data-testid="predicted-letter" className="predicted-letter">
          {state.status === "loading-model" && "Loading hand-tracking model…"}
          {state.status === "running" && state.prediction && (
            <>
              Handshape match:{" "}
              <strong data-testid="predicted-letter-value">{state.prediction.letter}</strong>
            </>
          )}
          {state.status === "running" && !state.prediction && "No hand detected."}
        </p>
      )}

      {session.lastResult === "wrong" && !session.finished && (
        <p data-testid="feedback-wrong">
          Not quite — try again.
          {confusableHint && (
            <> Commonly mixed up with {target} — check your hand position.</>
          )}
        </p>
      )}

      {!session.finished && isFlashcardMode && (
        <button type="button" onClick={handleMadeThisShape} data-testid="made-this-shape">
          I made this shape
        </button>
      )}

      {!session.finished && (
        <button type="button" onClick={handleSkip} data-testid="skip-target">
          Skip
        </button>
      )}

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

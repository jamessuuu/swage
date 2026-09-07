"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useHandTracking } from "./useHandTracking";
import { drawHandOverlay, clearOverlay } from "@/lib/drawOverlay";
import {
  accuracyPercent,
  createSession,
  createSessionFromOrder,
  currentTarget,
  recordCorrect,
  recordWrong,
  skip as skipTarget,
  type SessionState,
} from "@/lib/practiceSession";
import { HANDSHAPE_HINTS } from "@/lib/handshapeHints";
import { areConfusable } from "@/lib/confusablePairs";
import {
  clearProgress,
  getProgress,
  isPersistenceAvailable,
  nextDrillLetter,
  recordAttempt,
  recordBestStreak,
} from "@/lib/progress";
import type { Letter } from "@/lib/classifier";

const DRILL_LENGTH = 24; // matches Free practice's session length

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
  // SPEC.md §5's recordAttempt(letter, correct, holdMs) — holdMs is
  // measured as time-since-this-target-first-appeared, reset whenever the
  // target changes (correct/skip/drill) — StabilityTracker itself does
  // not expose how long a specific hold took, only that it happened.
  // Date.now() is impure, so the ref starts at a fixed 0 (render must stay
  // pure/idempotent) and is set for real by the mount effect just below —
  // the only consequence of the gap is that a hold completed in the first
  // instant after mount, before the effect runs, would report an
  // unrealistically large holdMs, which nothing currently reads.
  const targetShownAtRef = useRef(0);
  const persistedThisSessionRef = useRef(false);
  // null until the post-mount effect below reads it: getProgress() reads
  // window.localStorage, which does not exist during server rendering —
  // computing it in this component's first render (or a useState lazy
  // initializer) would mismatch the client's real first render the same
  // way the session seed did (see the comment above createSession(0)).
  // Reading persisted state from an external store on mount is exactly
  // the case React's own set-state-in-effect guidance carves out
  // ("subscribe for updates from an external system"), unlike that
  // earlier case (generating a *new* random value) — eslint's stricter
  // react-hooks/set-state-in-effect can't tell the two apart, so it is
  // silenced here with that reasoning on record rather than contorting
  // the code around a false positive.
  const [progressSnapshot, setProgressSnapshot] = useState<ReturnType<typeof getProgress> | null>(
    null,
  );
  // Same reasoning as progressSnapshot above — isPersistenceAvailable()
  // also reads `window`, and calling it directly in render (rather than
  // through this same mount effect) mismatched for the identical reason:
  // caught live by this project's own e2e suite, a real bug, not just a
  // lint nag.
  const [persistenceAvailable, setPersistenceAvailable] = useState<boolean | null>(null);
  const refreshProgress = useCallback(() => setProgressSnapshot(getProgress()), []);
  useEffect(() => {
    targetShownAtRef.current = Date.now();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshProgress();
    setPersistenceAvailable(isPersistenceAvailable());
  }, [refreshProgress]);

  const handleHeld = useCallback(
    (letter: Letter) => {
      setSession((prev) => {
        const target = currentTarget(prev);
        if (target === null) return prev;
        const holdMs = Date.now() - targetShownAtRef.current;
        if (letter === target) {
          setConfusableHint(null);
          recordAttempt(letter, true, holdMs);
          targetShownAtRef.current = Date.now();
          return recordCorrect(prev);
        }
        setConfusableHint(areConfusable(target, letter) ? letter : null);
        recordAttempt(target, false, holdMs);
        return recordWrong(prev);
      });
      refreshProgress();
    },
    [refreshProgress],
  );

  // SPEC.md §3.6/M7: persist the session's best streak once it ends —
  // guarded so a re-render doesn't record the same finished session twice.
  useEffect(() => {
    if (session.finished && session.attempted > 0 && !persistedThisSessionRef.current) {
      persistedThisSessionRef.current = true;
      recordBestStreak(session.bestStreak);
      refreshProgress();
    }
    if (!session.finished) {
      persistedThisSessionRef.current = false;
    }
  }, [session.finished, session.attempted, session.bestStreak, refreshProgress]);

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
    targetShownAtRef.current = Date.now();
    setSession((prev) => skipTarget(prev));
  };

  const handlePracticeAgain = () => {
    setConfusableHint(null);
    resetStability();
    targetShownAtRef.current = Date.now();
    setSession(createSession(randomSeed()));
  };

  // SPEC.md §9: "the app's own published eval decides what to drill, not
  // a hardcoded guess" — each of the 24 slots is chosen live via
  // progress.ts's nextDrillLetter(bias), reading model/eval-report.json's
  // confusablePairs and/or the visitor's own localStorage accuracy.
  const handleStartDrill = (bias: "confusable" | "weak") => {
    setConfusableHint(null);
    resetStability();
    targetShownAtRef.current = Date.now();
    const order = Array.from({ length: DRILL_LENGTH }, () => nextDrillLetter(bias));
    setSession(createSessionFromOrder(order));
  };

  // SPEC.md §9's flashcard path is explicitly "no grading" — self-reported
  // advancement, not a graded correct/wrong outcome, so it reuses skip()'s
  // state transition (advance, don't touch attempted/correct) rather than
  // recordCorrect()'s.
  const handleMadeThisShape = () => {
    resetStability();
    targetShownAtRef.current = Date.now();
    setSession((prev) => skipTarget(prev));
  };

  const handleClearProgress = () => {
    clearProgress();
    refreshProgress();
  };

  return (
    <main className="practice">
      <div className="shell practice-shell">
        <div className="practice-head">
          <h1>Practice</h1>
          <p className="honesty-line" style={{ flex: "1 1 22rem" }}>
            This checks handshapes, not ASL. ASL is a full language with its own
            grammar and facial and body grammar this tool doesn&apos;t see.
          </p>
        </div>

        <div className="practice-grid">
          {/* ---- the stage: camera + overlay, the brightest object here ---- */}
          <div>
            {!isFlashcardMode ? (
              <div className="stage">
                <div className="stage-bar">
                  <span className="lights">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>
                    {state.status === "idle" && "camera off"}
                    {state.status === "loading-model" && "loading model"}
                    {state.status === "running" && "live · on-device"}
                    {state.status === "model-error" && "model error"}
                  </span>
                  {state.delegate && (
                    <span
                      className="delegate-badge"
                      data-testid="delegate-badge"
                      data-delegate={state.delegate}
                    >
                      {state.delegate === "GPU"
                        ? "Running on GPU."
                        : "Running on CPU — same result, about 15 frames a second instead of 35."}
                    </span>
                  )}
                </div>

                <div className="stage-media">
                  <div className="camera-frame" data-status={state.status}>
                    <video ref={videoRef} data-testid="camera-video" autoPlay playsInline muted />
                    <canvas ref={canvasRef} data-testid="overlay-canvas" />
                  </div>

                  {/* Sits OUTSIDE .camera-frame on purpose: that element is
                      scaleX(-1) so the selfie view reads naturally, and any
                      text inside it would render mirrored. */}
                  {state.status === "idle" && (
                    <div className="stage-idle">
                      <svg width="46" height="46" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M8 11V6.5a1.5 1.5 0 0 1 3 0V11m0-.5V5a1.5 1.5 0 0 1 3 0v5.5m0-.5V6.5a1.5 1.5 0 0 1 3 0V13m-9-2v3l-1.6-1.8a1.5 1.5 0 0 0-2.3 1.9l3.2 4.4A5 5 0 0 0 12.6 21h1.9a4.5 4.5 0 0 0 4.5-4.5V10.5"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      <p>Nothing is recorded and nothing is uploaded.</p>
                      <p className="sub">
                        The frame is graded on this device by a 39KB classifier and discarded.
                      </p>
                      <button
                        type="button"
                        className="primary"
                        onClick={() => void start()}
                        data-testid="start-camera"
                      >
                        Start camera
                      </button>
                    </div>
                  )}

                  {state.status === "loading-model" && (
                    <div className="stage-idle">
                      <span className="spinner" aria-hidden="true" />
                      <p>Loading the hand-tracking model…</p>
                      <p className="sub">One fetch. After this, no network at all.</p>
                    </div>
                  )}
                </div>

                <p data-testid="predicted-letter" className="predicted-letter">
                  {state.status === "idle" && "Camera is off — start it to be graded live."}
                  {state.status === "loading-model" && "Loading hand-tracking model…"}
                  {state.status === "running" && state.prediction && (
                    <>
                      match{" "}
                      <strong data-testid="predicted-letter-value">
                        {state.prediction.letter}
                      </strong>
                    </>
                  )}
                  {state.status === "running" && !state.prediction && "No hand detected."}
                </p>
              </div>
            ) : (
              <div className="stage">
                <div className="stage-bar">flashcard mode · no camera</div>
                <p
                  role="alert"
                  data-testid="camera-error"
                  style={{ margin: "1rem", boxShadow: "none" }}
                >
                  {state.status === "no-camera"
                    ? "No camera was found on this device."
                    : "Camera access was denied."}{" "}
                  Switched to flashcard mode — no grading, but the same
                  letters and hints, fully usable with a keyboard.
                </p>
              </div>
            )}

            {state.status === "model-error" && (
              <p role="alert" data-testid="model-error" style={{ marginTop: "1rem" }}>
                Could not load the hand-tracking model: {state.errorMessage}
              </p>
            )}
          </div>

          {/* ---- the HUD: what to show, and how you are doing ---- */}
          <div className="hud">
            {session.finished ? (
              <section data-testid="session-summary">
                <h2>Session complete</h2>
                <p>
                  {session.mode === "drill" ? "Drill: " : ""}
                  {session.correct}/{session.attempted} correct ({accuracyPercent(session)}%),
                  best streak {session.bestStreak}.
                </p>
                <div className="summary-actions">
                  <button
                    type="button"
                    className="primary"
                    onClick={handlePracticeAgain}
                    data-testid="practice-again"
                  >
                    Practice again
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartDrill("confusable")}
                    data-testid="drill-confusable"
                  >
                    Drill confusable letters
                  </button>
                  <button
                    type="button"
                    onClick={() => handleStartDrill("weak")}
                    data-testid="drill-weak"
                  >
                    Drill my weak letters
                  </button>
                </div>
              </section>
            ) : (
              target && (
                <section data-testid="target-panel">
                  <p data-testid="target-letter">
                    Show me <strong>{target}</strong>
                  </p>
                  <p data-testid="target-hint">{HANDSHAPE_HINTS[target]}</p>
                  <p data-testid="session-progress">
                    {session.correct}/{session.attempted} correct this session
                    {session.currentStreak > 1 ? ` — streak ${session.currentStreak}` : ""}
                  </p>
                </section>
              )
            )}

            {session.lastResult === "wrong" && !session.finished && (
              <p data-testid="feedback-wrong">
                Not quite — try again.
                {confusableHint && (
                  <> Commonly mixed up with {target} — check your hand position.</>
                )}
              </p>
            )}

            {!session.finished && (
              <div className="hud-actions">
                {isFlashcardMode && (
                  <button
                    type="button"
                    className="primary"
                    onClick={handleMadeThisShape}
                    data-testid="made-this-shape"
                  >
                    I made this shape
                  </button>
                )}
                <button type="button" onClick={handleSkip} data-testid="skip-target">
                  Skip
                </button>
              </div>
            )}

            <section data-testid="progress-summary">
              <h2>Your progress</h2>
              {progressSnapshot === null ? null : progressSnapshot.sessions.length === 0 ? (
                <p>No sessions recorded yet on this device.</p>
              ) : (
                <p data-testid="progress-summary-text">
                  {progressSnapshot.sessions.length} session
                  {progressSnapshot.sessions.length === 1 ? "" : "s"} recorded. Last session:{" "}
                  {(() => {
                    const last = progressSnapshot.sessions[progressSnapshot.sessions.length - 1];
                    return last
                      ? `${last.correct}/${last.attempted} in a session, best streak ${last.bestStreak}.`
                      : "";
                  })()}
                </p>
              )}
              {persistenceAvailable === false && (
                <p role="alert" data-testid="no-persistence-warning" style={{ marginTop: "0.75rem" }}>
                  Your browser is not letting this page save progress (SPEC.md
                  F10) — practice still works, but nothing here will be
                  remembered after you leave.
                </p>
              )}
              <div className="hud-actions" style={{ marginTop: "1rem" }}>
                <button type="button" onClick={handleClearProgress} data-testid="clear-progress">
                  Clear my progress
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

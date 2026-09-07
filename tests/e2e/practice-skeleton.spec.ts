import { test, expect } from "@playwright/test";
import { LETTERS } from "../../src/lib/classifier";

/**
 * M1 walking-skeleton verifier (SPEC.md M1 row): "a real hand produces a
 * live-updating label." Runs against tests/fixtures/hand-a.mjpeg — a real
 * hand photo (Google's own MediaPipe Hand Landmarker demo asset,
 * storage.googleapis.com/mediapipe-assets/woman_hands.jpg, see
 * tests/fixtures/ATTRIBUTION.md), fed through Chromium's fake video capture
 * device so the whole camera -> HandLandmarker -> normalize -> classify ->
 * overlay pipeline runs against a real decoded frame, not a mock.
 *
 * Since the M4 commit this exercises the real, committed
 * model/weights.json (M1's original 2-letter stub rule is gone) — so the
 * assertion below only checks the label is a real member of the 24-class
 * set, not a specific letter. This photo is an out-of-training-
 * distribution "presentational hands" demo image, not a clean held ASL
 * letter, so whatever the model reads it as is not itself a claim about
 * accuracy — model/eval-report.json's own (provisional) numbers are that
 * claim. This test's job is proving the pipeline runs end to end on real
 * input, which it does.
 *
 * The M6 commit adds a second Playwright project (playwright.config.ts,
 * --disable-webgl2 --disable-webgl) that exercises the F3
 * catch-and-retry-CPU fallback against this same test file.
 */
test("a real hand in the fake camera feed produces a live handshape match", async ({
  page,
}) => {
  await page.goto("/practice");
  await page.getByTestId("start-camera").click();

  // Model load (WASM + ~7.8MB .task file, cold) can take a few seconds even
  // on CI; the delegate badge only appears once HandLandmarker is ready.
  await expect(page.getByTestId("delegate-badge")).toBeVisible({ timeout: 30_000 });

  const predicted = page.getByTestId("predicted-letter");
  // 2026-09-07: the readout label shortened to "match <LETTER>" when the
  // stage became a real instrument panel. Assert on the VALUE node rather
  // than a substring of the whole line — stronger than the old check, which
  // would have passed on any letter appearing anywhere in the sentence.
  await expect(predicted).toContainText("match", { timeout: 15_000 });
  await expect(predicted).not.toContainText("No hand detected");

  const value = page.getByTestId("predicted-letter-value");
  await expect(value).toBeVisible({ timeout: 15_000 });

  // A real letter from the real, committed 24-class model (SPEC.md M4).
  const text = (await value.innerText()).trim();
  expect(LETTERS.some((letter) => letter === text)).toBe(true);
});

test("the delegate badge reports the GPU delegate", async ({ page }) => {
  await page.goto("/practice");
  await page.getByTestId("start-camera").click();

  const badge = page.getByTestId("delegate-badge");
  await expect(badge).toBeVisible({ timeout: 30_000 });
  await expect(badge).toHaveAttribute("data-delegate", "GPU");
});

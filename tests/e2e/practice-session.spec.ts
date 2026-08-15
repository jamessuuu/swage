import { test, expect } from "@playwright/test";
import { correctCount, skipUntilCorrect } from "./helpers/practiceLoop";

/**
 * M5 verifier (SPEC.md M5 row): "Playwright with fake-camera video
 * completes one letter end to end." Uses the real, deterministic
 * classification of tests/fixtures/hand-a.mjpeg (see
 * tests/e2e/practice-skeleton.spec.ts) — whatever letter the committed
 * model reads it as — and the "Skip" control (which SPEC.md §9 requires
 * to exist regardless, "an explicit, keyboard-reachable 'skip' is always
 * available") to reach a target that matches, without hardcoding which
 * letter that is.
 *
 * The exit condition is "has a correct been recorded yet", read from
 * session-progress/session-summary, not "does the target's text equal the
 * predicted letter" — the fixture is a STATIC looped frame, so the
 * classifier's output is constant from the moment the camera starts, and
 * it is a genuine race (not a test bug to paper over) whether the very
 * first target already matches and auto-advances before this test reads
 * anything. Polling the authoritative correct-count sidesteps that race
 * entirely instead of trying to out-guess it with text comparisons.
 *
 * The skip loop itself is shared with progress-persistence.spec.ts — see
 * tests/e2e/helpers/practiceLoop.ts's skipUntilCorrect for why each click
 * inside it is bounded and can env-gate this test.
 */

test("completes one letter end to end via the fake-camera fixture", async ({ page }, testInfo) => {
  await page.goto("/practice");
  await page.getByTestId("start-camera").click();

  await expect(page.getByTestId("delegate-badge")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("predicted-letter-value")).toBeVisible({ timeout: 15_000 });

  // Give the freshly-loaded tracker a chance to hold on its own — covers
  // the case where the session's very first target already matches.
  await expect(async () => {
    expect(await correctCount(page)).toBeGreaterThanOrEqual(1);
  }).toPass({ timeout: 2_000 }).catch(() => {});

  // Otherwise, skip through the (at most 24, no-repeats) session order —
  // each iteration gives the tracker a fresh ~600ms+ window on the new
  // target before checking again, comfortably covering SPEC.md §7.1's
  // 8-tick (~533ms) hold window.
  await skipUntilCorrect(page, testInfo);

  expect(await correctCount(page)).toBeGreaterThanOrEqual(1);
});

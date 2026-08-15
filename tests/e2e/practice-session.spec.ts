import { test, expect, type Page } from "@playwright/test";

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
 */

async function correctCount(page: Page): Promise<number> {
  const progress = page.getByTestId("session-progress");
  const summary = page.getByTestId("session-summary");
  const text = (await progress.count())
    ? await progress.innerText()
    : (await summary.count())
      ? await summary.innerText()
      : "";
  const match = /(\d+)\/(\d+) correct/.exec(text);
  return match?.[1] ? Number(match[1]) : 0;
}

test("completes one letter end to end via the fake-camera fixture", async ({ page }) => {
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
  for (let i = 0; i < 24 && (await correctCount(page)) < 1; i++) {
    if ((await page.getByTestId("session-summary").count()) > 0) break;
    await page.getByTestId("skip-target").click();
    await page.waitForTimeout(600);
  }

  expect(await correctCount(page)).toBeGreaterThanOrEqual(1);
});

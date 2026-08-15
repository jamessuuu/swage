import { test, expect } from "@playwright/test";

/**
 * M6 verifier (SPEC.md M6 row, F1/F2): camera-denied/no-camera -> flashcard
 * mode. Runs only under the "smoke-no-camera" Playwright project
 * (playwright.config.ts), which launches with neither fake-media-stream
 * flag. Empirically (not assumed) that combination makes headless
 * Chromium report zero enumerable video input devices at all — a genuine
 * F2 ("no camera hardware"), not F1 ("permission denied") — so
 * useHandTracking.ts's NotFoundError branch is what actually runs here,
 * confirmed by the exact copy asserted below.
 *
 * F1 and F2 share the exact same `isFlashcardMode` branch in
 * PracticeClient.tsx and the same useHandTracking.ts catch block, split
 * only by which DOMException name is inspected
 * (NotFoundError/OverconstrainedError -> "no-camera", everything else ->
 * "camera-denied", see useHandTracking.ts) — genuinely exercising F1
 * specifically would need a fake device to exist (so enumeration
 * succeeds) while the permission prompt itself is denied, which needs a
 * third distinct browser launch config for one more line of a ternary
 * already covered by this same code path; not built, to keep M6's e2e
 * surface proportionate to what actually differs.
 */
test("no camera hardware switches to a working, keyboard-operable flashcard loop", async ({
  page,
}) => {
  await page.goto("/practice");
  await page.getByTestId("start-camera").click();

  await expect(page.getByTestId("camera-error")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId("camera-error")).toContainText("No camera was found on this device");

  // No dead end: the flashcard controls exist and camera-only UI is gone.
  await expect(page.getByTestId("target-panel")).toBeVisible();
  await expect(page.getByTestId("made-this-shape")).toBeVisible();
  await expect(page.getByTestId("skip-target")).toBeVisible();
  await expect(page.getByTestId("camera-video")).toHaveCount(0);
  await expect(page.getByTestId("predicted-letter")).toHaveCount(0);

  const firstTarget = (await page.locator('[data-testid="target-letter"] strong').innerText()).trim();

  // Keyboard-only activation (SPEC.md F1/F2: "keyboard-operable"), not a
  // mouse click — focus the button, then Space to activate it.
  await page.getByTestId("made-this-shape").focus();
  await page.keyboard.press("Space");

  await expect(page.locator('[data-testid="target-letter"] strong')).not.toHaveText(firstTarget);
  // SPEC.md §9: flashcard advancement is ungraded — never counted as an attempt.
  await expect(page.getByTestId("session-progress")).toContainText("0/0 correct");
});

test("skip also works without a camera", async ({ page }) => {
  await page.goto("/practice");
  await page.getByTestId("start-camera").click();
  await expect(page.getByTestId("target-panel")).toBeVisible({ timeout: 15_000 });

  const firstTarget = (await page.locator('[data-testid="target-letter"] strong').innerText()).trim();
  await page.getByTestId("skip-target").click();
  await expect(page.locator('[data-testid="target-letter"] strong')).not.toHaveText(firstTarget);
});

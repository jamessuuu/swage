import { test, expect } from "@playwright/test";
import { correctCount, skipUntilCorrect } from "./helpers/practiceLoop";

/**
 * M7 verifier (SPEC.md M7 row): "Unit tests; Playwright two-session return
 * flow." src/lib/progress.test.ts covers the unit side (including both
 * halves of F10); this file proves the real, end-to-end version — record
 * at least one real attempt against the fake-camera fixture, reload the
 * page (a genuine second "session" against the same localStorage, not a
 * mock), and confirm the summary reflects what the first session recorded.
 *
 * The skip loop itself is shared with practice-session.spec.ts — see
 * tests/e2e/helpers/practiceLoop.ts's skipUntilCorrect for why each click
 * inside it is bounded and can env-gate these tests.
 */

test("progress from a first session is visible after returning (reload)", async ({ page }, testInfo) => {
  await page.goto("/practice");

  // Before any attempt: no sessions recorded yet.
  await expect(page.getByTestId("progress-summary")).toContainText(
    "No sessions recorded yet on this device",
  );

  await page.getByTestId("start-camera").click();
  await expect(page.getByTestId("predicted-letter-value")).toBeVisible({ timeout: 30_000 });

  await skipUntilCorrect(page, testInfo);
  expect(await correctCount(page)).toBeGreaterThanOrEqual(1);

  // "Return" — a fresh navigation in the same browser context, so
  // localStorage persists but no in-memory React state does.
  await page.reload();

  await expect(page.getByTestId("progress-summary")).not.toContainText(
    "No sessions recorded yet on this device",
  );
  await expect(page.getByTestId("progress-summary-text")).toContainText("1 session recorded");
});

test("Clear my progress removes the record on this device", async ({ page }, testInfo) => {
  await page.goto("/practice");
  await page.getByTestId("start-camera").click();
  await expect(page.getByTestId("predicted-letter-value")).toBeVisible({ timeout: 30_000 });

  await skipUntilCorrect(page, testInfo);
  expect(await correctCount(page)).toBeGreaterThanOrEqual(1);

  await page.reload();
  await expect(page.getByTestId("progress-summary-text")).toBeVisible();

  await page.getByTestId("clear-progress").click();
  await expect(page.getByTestId("progress-summary")).toContainText(
    "No sessions recorded yet on this device",
  );

  await page.reload();
  await expect(page.getByTestId("progress-summary")).toContainText(
    "No sessions recorded yet on this device",
  );
});

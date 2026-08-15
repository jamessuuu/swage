import { test, expect, type Page } from "@playwright/test";

/**
 * M7 verifier (SPEC.md M7 row): "Unit tests; Playwright two-session return
 * flow." src/lib/progress.test.ts covers the unit side (including both
 * halves of F10); this file proves the real, end-to-end version — record
 * at least one real attempt against the fake-camera fixture, reload the
 * page (a genuine second "session" against the same localStorage, not a
 * mock), and confirm the summary reflects what the first session recorded.
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

test("progress from a first session is visible after returning (reload)", async ({ page }) => {
  await page.goto("/practice");

  // Before any attempt: no sessions recorded yet.
  await expect(page.getByTestId("progress-summary")).toContainText(
    "No sessions recorded yet on this device",
  );

  await page.getByTestId("start-camera").click();
  await expect(page.getByTestId("predicted-letter-value")).toBeVisible({ timeout: 30_000 });

  for (let i = 0; i < 24 && (await correctCount(page)) < 1; i++) {
    if ((await page.getByTestId("session-summary").count()) > 0) break;
    await page.getByTestId("skip-target").click();
    await page.waitForTimeout(600);
  }
  expect(await correctCount(page)).toBeGreaterThanOrEqual(1);

  // "Return" — a fresh navigation in the same browser context, so
  // localStorage persists but no in-memory React state does.
  await page.reload();

  await expect(page.getByTestId("progress-summary")).not.toContainText(
    "No sessions recorded yet on this device",
  );
  await expect(page.getByTestId("progress-summary-text")).toContainText("1 session recorded");
});

test("Clear my progress removes the record on this device", async ({ page }) => {
  await page.goto("/practice");
  await page.getByTestId("start-camera").click();
  await expect(page.getByTestId("predicted-letter-value")).toBeVisible({ timeout: 30_000 });

  for (let i = 0; i < 24 && (await correctCount(page)) < 1; i++) {
    if ((await page.getByTestId("session-summary").count()) > 0) break;
    await page.getByTestId("skip-target").click();
    await page.waitForTimeout(600);
  }
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

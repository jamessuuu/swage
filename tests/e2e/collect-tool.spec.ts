import { test, expect } from "@playwright/test";
import { COLLECT_URL } from "../../playwright.config";

/**
 * scripts/collect/ smoke test (SPEC.md §3.1, M2): the volunteer capture
 * tool actually detects a real hand (same fixture as
 * tests/e2e/practice-skeleton.spec.ts) and records a sample, reusing the
 * production src/lib pipeline. Does not exercise the File System Access
 * API directory-write path — headless Chromium has no native folder-picker
 * UI to drive — only the in-memory capture + progress advancement, which is
 * the part that proves the pipeline (not the OS integration) works.
 *
 * Server lifecycle is Playwright's own managed `webServer` array
 * (playwright.config.ts), not a manually spawned child process — the first
 * version of this test spawned Vite itself and flaked on Windows
 * (`shell: true` argument quoting plus stdout-string-matching for
 * readiness), which is exactly the kind of thing Playwright's built-in
 * webServer health-check (poll the URL, not parse output) exists to avoid.
 */
test("captures one real sample and advances progress", async ({ page }) => {
  await page.goto(COLLECT_URL);
  await page.fill("#signerId", "e2e-test-signer");
  await page.check("#consent");
  await page.click("#start");

  await expect(page.locator("#progress")).toContainText('Letter 1/24: "A" — rep 1/20', {
    timeout: 30_000,
  });
  // Live hand-detection status (from the real fixture photo) before capturing.
  await expect(page.locator("#status")).toContainText("Hand detected", { timeout: 15_000 });

  await page.click("#captureBtn");
  await expect(page.locator("#progress")).toContainText("rep 2/20");
  await expect(page.locator("#progress")).toContainText("(1/480 total)");
});

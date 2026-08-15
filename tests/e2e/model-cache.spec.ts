import { test, expect } from "@playwright/test";
import { MODEL_URL } from "../../src/lib/handLandmarker";

/**
 * M6 verifier (SPEC.md M6 row, F5): "second-visit capture shows ~0 model
 * bytes." GCS caps hand_landmarker.task's freshness at
 * Cache-Control: public, max-age=3600 (measured,
 * research/phase2-model-cards.md §P6), so a plain modelAssetPath fetch
 * re-downloads the full ~7.8MB file on every visit within the hour
 * regardless of the browser's own HTTP cache. src/lib/modelCache.ts fixes
 * this by fetching manually and storing the bytes in the Cache Storage
 * API — this test proves the fix by capturing real network requests
 * across two navigations in the SAME browser context (Cache Storage is
 * origin-scoped and persists across navigations, unlike a fresh context
 * per test) and asserting the model URL is requested on the first visit
 * but not the second.
 */
test("the model is fetched once and served from Cache Storage on a second visit", async ({
  page,
}) => {
  const modelRequests: string[] = [];
  page.on("request", (req) => {
    if (req.url() === MODEL_URL) modelRequests.push(req.url());
  });

  await page.goto("/practice");
  await page.getByTestId("start-camera").click();
  await expect(page.getByTestId("delegate-badge")).toBeVisible({ timeout: 30_000 });

  expect(modelRequests, "first visit must fetch the model over the network").toHaveLength(1);

  // Second visit, same context/origin — Cache Storage persists.
  modelRequests.length = 0;
  await page.reload();
  await page.getByTestId("start-camera").click();
  await expect(page.getByTestId("delegate-badge")).toBeVisible({ timeout: 30_000 });

  expect(
    modelRequests,
    "second visit must be served from Cache Storage, not the network — ~0 model bytes",
  ).toHaveLength(0);
});

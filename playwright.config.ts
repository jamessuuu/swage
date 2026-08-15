import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAKE_VIDEO = path.join(__dirname, "tests/fixtures/hand-a.mjpeg");
const PORT = 3417;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const COLLECT_PORT = 5183;
export const COLLECT_URL = `http://127.0.0.1:${COLLECT_PORT}`;

/**
 * "smoke-gpu" is the only project through M1-M5: normal launch, WebGL2
 * available, so HandLandmarker uses the GPU delegate (SPEC.md M1 row —
 * "GPU only, no fallback yet"). It uses
 * --use-fake-device-for-media-stream plus --use-file-for-fake-video-capture
 * so getUserMedia() serves a real, deterministic video
 * (tests/fixtures/hand-a.mjpeg, see tests/fixtures/ATTRIBUTION.md) instead
 * of asking for a physical camera. MJPEG, not the MP4 SPEC.md §8 names:
 * verified empirically that this Chromium build's fake capture device
 * silently reports "no camera" (getUserMedia rejects NotFoundError) for an
 * .mp4 file; .mjpeg (like raw .y4m) actually works. Documented as a spec
 * deviation in tests/fixtures/ATTRIBUTION.md.
 *
 * The M6 commit adds a second "smoke-cpu" project
 * (--disable-webgl2 --disable-webgl) alongside the F3 catch-and-retry-CPU
 * fallback it introduces — added here, not before, so this config never
 * describes a project with no passing test behind it.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    video: "off",
  },
  webServer: [
    {
      command: `pnpm exec next dev --port ${PORT}`,
      url: BASE_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // scripts/collect/ (SPEC.md §3.1 M2) — a standalone Vite page, not
      // part of the Next.js app, exercised by tests/e2e/collect-tool.spec.ts.
      command: `pnpm exec vite --config scripts/collect/vite.config.ts --port ${COLLECT_PORT} --strictPort`,
      url: COLLECT_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
  projects: [
    {
      name: "smoke-gpu",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            `--use-file-for-fake-video-capture=${FAKE_VIDEO}`,
          ],
        },
      },
    },
  ],
});

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
 * "smoke-cpu" (added at M6, alongside the F3 catch-and-retry-CPU fallback
 * it exists to test) launches with --disable-webgl2 --disable-webgl,
 * forcing HandLandmarker's GPU delegate creation to reject so the
 * catch-and-retry-CPU path in src/lib/handLandmarker.ts actually runs.
 * Scoped via testMatch to tests/e2e/degradation-cpu.spec.ts only — the
 * other specs don't test GPU-vs-CPU behaviour and would just double the
 * suite's runtime for no signal if run under both projects.
 *
 * "smoke-no-camera" (M6, F1/F2) launches with NEITHER fake-media-stream
 * flag. Verified empirically, not assumed: with no fake device configured,
 * headless Chromium enumerates zero video input devices at all, so
 * getUserMedia() rejects NotFoundError — useHandTracking.ts's genuine F2
 * ("no camera hardware") branch, not F1 ("permission denied", which would
 * need a device to exist but its permission prompt to be denied). Both
 * render through the same flashcard UI; see flashcard-mode.spec.ts's own
 * header for why only one is exercised end to end. Scoped via testMatch to
 * tests/e2e/flashcard-mode.spec.ts only, same reasoning as smoke-cpu.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // tests/e2e/practice-session.spec.ts's skip-loop can legitimately take
  // ~30s locally (up to 24 x 600ms waits plus model load) — 60s keeps
  // real headroom on a slower CI runner rather than sitting right at the
  // edge of the default.
  timeout: 60_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // 2, not 1, on CI specifically: CI run 31895600129 (2026-08-15) showed a
  // real Chromium renderer crash ("Protocol error: session closed") on one
  // attempt of a reload-heavy test, immediately followed by a clean pass on
  // retry #1 of a structurally identical sibling test in the same file —
  // never reproduced locally across multiple full-suite runs. That is
  // GitHub's shared, GPU-less runner running low on headroom partway
  // through 11 sequential MediaPipe WASM+GPU test contexts in one browser
  // process, not a deterministic bug a single retry can't already tell
  // apart from one. See also launchOptions' --disable-dev-shm-usage below,
  // the standard companion fix for this exact crash signature in CI.
  retries: process.env.CI ? 2 : 0,
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
      // degradation-cpu.spec.ts and flashcard-mode.spec.ts belong to their
      // own projects below — running them here too would launch them
      // under a browser config where the exact thing they test (CPU
      // fallback; a genuinely denied/no camera permission) never triggers.
      testIgnore: ["degradation-cpu.spec.ts", "flashcard-mode.spec.ts"],
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            `--use-file-for-fake-video-capture=${FAKE_VIDEO}`,
            // Standard CI-hardening flag (Playwright's own Docker images
            // pass it by default): Chromium's default /dev/shm usage for a
            // WASM+GPU-heavy pipeline like this one is exactly the known
            // trigger for the renderer-crash signature ("Protocol error:
            // session closed") seen on CI run 31895600129 — never
            // reproduced locally. Zero effect on any assertion; every row
            // in every project gets it for the same reason.
            "--disable-dev-shm-usage",
          ],
        },
      },
    },
    {
      name: "smoke-cpu",
      testMatch: "degradation-cpu.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            `--use-file-for-fake-video-capture=${FAKE_VIDEO}`,
            "--disable-webgl2",
            "--disable-webgl",
            "--disable-gpu",
            "--disable-software-rasterizer",
            "--disable-dev-shm-usage",
          ],
        },
      },
    },
    {
      name: "smoke-no-camera",
      testMatch: "flashcard-mode.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        // No fake-media-stream args: getUserMedia() hits Chromium's real
        // (headless-auto-denied) permission path.
        launchOptions: {
          args: ["--disable-dev-shm-usage"],
        },
      },
    },
  ],
});

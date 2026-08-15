import { describe, expect, it, vi, beforeEach } from "vitest";

/**
 * F3's catch-and-retry-CPU logic, tested at the unit level with the real
 * browser/WASM dependencies mocked out.
 *
 * Why a mock, not only the browser e2e test (tests/e2e/degradation-cpu.spec.ts):
 * verified directly while building this — a headless Chromium launched
 * with --disable-webgl(2) --disable-gpu still creates a MediaPipe GPU
 * context via a software (SwiftShader) WebGL fallback UNLESS
 * --disable-software-rasterizer is also set; with that fourth flag added,
 * GPU creation genuinely fails and this fallback genuinely runs (proven —
 * the e2e test's delegate badge shows CPU) but headless video-frame
 * compositing breaks too, independent of delegate (confirmed by testing:
 * a GPU-labeled run under the same rasterizer-disabled flag also detects
 * nothing). That is an environment limitation on requestVideoFrame
 * compositing, not evidence about this function's own retry logic — which
 * this file tests directly and deterministically instead.
 */
const detectForVideo = vi.fn();
const close = vi.fn();
const createFromOptions = vi.fn();
const forVisionTasks = vi.fn().mockResolvedValue({});

vi.mock("@mediapipe/tasks-vision", () => ({
  FilesetResolver: { forVisionTasks: (...args: unknown[]) => forVisionTasks(...args) },
  HandLandmarker: { createFromOptions: (...args: unknown[]) => createFromOptions(...args) },
}));

vi.mock("./modelCache", () => ({
  fetchModelBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
}));

describe("createHandLandmarkerWithFallback", () => {
  beforeEach(async () => {
    createFromOptions.mockReset();
    forVisionTasks.mockClear();
    detectForVideo.mockReset();
    close.mockReset();
    const { fetchModelBuffer } = await import("./modelCache");
    vi.mocked(fetchModelBuffer).mockClear();
  });

  it("returns the GPU delegate when GPU creation succeeds", async () => {
    const fakeLandmarker = { detectForVideo, close };
    createFromOptions.mockResolvedValueOnce(fakeLandmarker);

    const { createHandLandmarkerWithFallback } = await import("./handLandmarker");
    const result = await createHandLandmarkerWithFallback();

    expect(result.delegate).toBe("GPU");
    expect(result.landmarker).toBe(fakeLandmarker);
    expect(createFromOptions).toHaveBeenCalledTimes(1);
    expect(createFromOptions.mock.calls[0]?.[1]).toMatchObject({ baseOptions: { delegate: "GPU" } });
  });

  it("catches a GPU creation rejection and retries once with CPU", async () => {
    const fakeLandmarker = { detectForVideo, close };
    createFromOptions
      .mockRejectedValueOnce(
        new Error(
          'StartGraph failed: INTERNAL Service kGpuService was not provided and cannot be created',
        ),
      )
      .mockResolvedValueOnce(fakeLandmarker);

    const { createHandLandmarkerWithFallback } = await import("./handLandmarker");
    const result = await createHandLandmarkerWithFallback();

    expect(result.delegate).toBe("CPU");
    expect(result.landmarker).toBe(fakeLandmarker);
    expect(createFromOptions).toHaveBeenCalledTimes(2);
    expect(createFromOptions.mock.calls[0]?.[1]).toMatchObject({ baseOptions: { delegate: "GPU" } });
    expect(createFromOptions.mock.calls[1]?.[1]).toMatchObject({ baseOptions: { delegate: "CPU" } });
  });

  it("fetches the model bytes once and reuses them for both attempts (SPEC.md F5: modelAssetBuffer)", async () => {
    createFromOptions
      .mockRejectedValueOnce(new Error("no GPU"))
      .mockResolvedValueOnce({ detectForVideo, close });
    const { fetchModelBuffer } = await import("./modelCache");

    const { createHandLandmarkerWithFallback } = await import("./handLandmarker");
    await createHandLandmarkerWithFallback();

    expect(fetchModelBuffer).toHaveBeenCalledTimes(1);
    const firstCallBuffer = createFromOptions.mock.calls[0]?.[1]?.baseOptions?.modelAssetBuffer;
    const secondCallBuffer = createFromOptions.mock.calls[1]?.[1]?.baseOptions?.modelAssetBuffer;
    expect(firstCallBuffer).toBe(secondCallBuffer);
    expect(firstCallBuffer).toBeInstanceOf(Uint8Array);
  });

  it("propagates the error if the CPU retry also fails (no silent third path)", async () => {
    createFromOptions.mockRejectedValueOnce(new Error("no GPU")).mockRejectedValueOnce(new Error("no CPU either"));

    const { createHandLandmarkerWithFallback } = await import("./handLandmarker");
    await expect(createHandLandmarkerWithFallback()).rejects.toThrow("no CPU either");
  });
});

# Test fixture attribution

## `hand-a.mjpeg`

An 8-second, silent, looped-still-frame Motion JPEG video generated from
`source/woman_hands.jpg`, itself downloaded unmodified from
`https://storage.googleapis.com/mediapipe-assets/woman_hands.jpg`.

That image is Google's own official demo/test asset for MediaPipe's Hand
Landmarker — the same `storage.googleapis.com` bucket family this project
already fetches `hand_landmarker.task` from at runtime (SPEC.md §7.2), used
across MediaPipe's own published Hand Landmarker samples and CodePens. It
shows two real human hands and is correctly detected by Hand Landmarker
(confirmed live during this project's own Model Card research,
`showcase-program/research/phase2-model-cards.md` §P6: "2/2 hands correctly
detected on a real photo (woman_hands.jpg)"), and again live in this repo's
own e2e suite (`tests/e2e/practice-skeleton.spec.ts`): the M1 stub
classifier correctly reads it as an open hand ("B").

**Why a real photo turned into a fake-camera feed, not a synthetic
drawing:** MediaPipe's Hand Landmarker is a trained CNN expecting real hand
imagery — a programmatically drawn stick figure will not reliably trigger
detection, so it would not actually exercise the pipeline. This asset lets
`tests/e2e/*.spec.ts` drive Chromium's real `getUserMedia()` path
(`--use-fake-device-for-media-stream --use-file-for-fake-video-capture`)
against a real, licensed hand image end to end, deterministically, with no
physical camera or human volunteer required for CI.

**Format — a spec deviation, verified empirically.** SPEC.md §8/§10 names
`tests/fixtures/hand-a.mp4`. Built and tried first; this Chromium build's
fake video capture device accepts the file (no launch error) but then
reports zero cameras at runtime — `getUserMedia()` rejects with
`NotFoundError`, so the whole pipeline never starts. Chromium's
`FileVideoCaptureDevice` only documents Y4M and MJPEG support; MP4 is not
one of them, and empirically was not decoded here. `.mjpeg` was chosen over
raw `.y4m` for the same 8-second clip purely on file size: y4m is
uncompressed (~88MB for 640x480x24fps x 8s); mjpeg (~2.9MB) is a per-frame
JPEG sequence and just as directly supported by Chromium's fake capture
device. Re-verify if `next dev`/Chromium/Playwright versions change —
this is empirical, not a documented guarantee.

**Not a substitute for SPEC.md §3's training/eval data.** This fixture
exists only to prove the tracking + UI pipeline runs against real input; it
contributes zero rows to `data/`, `model/weights.json`, or
`model/eval-report.json`.

**Regenerate:**

```sh
ffmpeg -y -loop 1 -i source/woman_hands.jpg -t 8 \
  -vf "scale=640:480:force_original_aspect_ratio=decrease,pad=640:480:(ow-iw)/2:(oh-ih)/2:color=white,fps=24" \
  -c:v mjpeg -q:v 4 hand-a.mjpeg
```

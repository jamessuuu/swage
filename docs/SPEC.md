# swage — SPEC

**Real-time ASL fingerspelling handshape practice, graded by a classifier trained and published as
part of this repo, on a device that never sends your camera feed anywhere.**

P6 of the showcase program (vision/tracking + education). Binding upstream:
`showcase-program/PHASE-2.md`, `SELECTION-2.md` (P6 definition, death condition, and the "Decisions
from the Model Cards" section — MediaPipe tracks hands, it does not read letters),
`research/phase2-model-cards.md` §P6 (measured numbers, all captioned to a non-Tier-A/B desktop),
`research/phase2-creative-tech.md` §1/§4, `QUALITY-BAR.md`, `DESIGN-DIRECTION.md`, `BRAND-KIT.md`.
Platform baseline per `PROGRAM.md` D1–D6. Spec author: architect, 2026-08-09.

**Name:** *swage* — the die a blacksmith presses a blank into to force it to a precise target form.
The exact metaphor for "shape your hand to match a reference until it is correct," and a new trade
family (metalworking) distinct from the existing five. npm holds an obscure semi-dead 2020 CLI in an
unrelated domain — the same dead-squat shape as sluice's, resolved the same way; `swage` remains the
repo and CLI identity.

---

## 1. Goal + non-goals

**Goal.** A web app that watches a visitor's hand through their own webcam, tells them which ASL
fingerspelling letter their handshape matches, and grades a practice session — using a small
classifier this project trains, evaluates and publishes an honest confusion matrix for, not a
downloaded "ASL AI." Everything runs on the visitor's device; the only network traffic is the
one-time MediaPipe download.

**Non-goals (death condition — refusals, not backlog).**
1. **No language understanding claim, anywhere.** This reads a static handshape, not ASL. It never
   claims to translate, understand or read sign language. ASL grammar, facial grammar and non-manual
   markers are out of scope by definition, not by omission — §7.
2. **No J or Z.** Both require traced motion a single-frame classifier cannot see. 24 classes, not
   26, structurally — not a bug to fix later.
3. **No accounts, no server-side write path, no analytics.** Progress lives in the visitor's browser.
4. **No LLM anywhere.** No prompt, no model SDK, no "AI coach" copy.
5. **No spaced-repetition engine.** Frequency-weighted resampling from the visitor's own miss data is
   enough; SM-2-style scheduling is scope creep for a portfolio piece.

---

## 2. Repo layout and what ships

```
swage/                              GitHub jamessuuu/swage (public, MIT + brand + data carve-outs)
  data/
    asl-now/                        mirrored MIT-licensed landmark JSON (§3.1) — community pool, TRAIN ONLY
    self-collected/                 volunteer-recorded landmark JSON, signer_id-tagged — supplies val/test
    splits.json                     frozen signer_id -> {train,val,test}, committed
    ATTRIBUTION.md                  asl-now-fingerspelling MIT notice + DOI
  scripts/
    train.ts                        tfjs (WASM backend, no native bindings — §2 decisions) fixed-seed training
    data-check.ts                   asserts per-letter counts + split integrity; run in CI
    collect/                        volunteer capture tool (reuses src/lib/* — same pipeline as production)
    brand.mjs                       BRAND-KIT generator
  model/
    weights.json                    committed trained artifact, target < 50KB
    eval-report.json                confusion matrix + per-letter precision/recall/F1, CI-regenerated
  src/
    lib/
      normalize.ts                  ZERO deps — imported by scripts/train.ts AND the browser bundle
      classifier.ts                 hand-rolled forward pass, imports model/weights.json, no ML framework
      stability.ts                  debounce/hysteresis tracker, target-agnostic
      progress.ts                   localStorage schema v1, versioned
    app/
      page.tsx                      landing — honesty line above the fold, §7.3
      practice/page.tsx             the graded loop + non-camera flashcard fallback
      docs/{quickstart,concept,failure-modes,limitations}/page.tsx
  public/brand/                     BRAND-KIT assets
  tests/fixtures/                   golden landmark fixtures + a fake-camera video clip (§8, §10)
  docs/SPEC.md  README.md  LICENSE  .github/workflows/ci.yml
```

**Decisions.**
- **Single Next.js app, no monorepo.** Nothing here is a published library.
- **Zero API routes, zero database.** There is nothing server-side to secure, pause or bill. The D2
  cost-ceiling gate is **N/A, stated with the reason** — no model call, no server compute, no metered
  path at all.
- **No Zod boundary.** Zod validates external HTTP/JSON input; this app has none — the only external
  inputs are camera frames (typed by browser APIs) and CDN-fetched model bytes (typed fetch wrapper,
  §7.2). Named explicitly rather than adding Zod to match a table.
- **Training runs on pure-JS TensorFlow.js (`@tensorflow/tfjs` + `-backend-wasm`), not `tfjs-node`.**
  Native bindings are a known cross-platform pain point (node-gyp on Windows). ~4,000 rows on a 63-dim
  input into a two-layer MLP trains in seconds under WASM. Boring beats clever at 2h/week.
- **The classifier artifact is bundled, not fetched.** `model/weights.json` (<50KB) is imported
  directly into the bundle. The only network request in the product is MediaPipe's.

---

## 3. Data model

### 3.1 Dataset — the sourcing task, done, not deferred

**Primary source: `sid220/asl-now-fingerspelling` (Hugging Face), MIT licence — verified live
2026-08-09** via the HF API. It is **already in the exact shape this project needs**: 21 hand
landmarks per sample, `x`/`y` normalized to [0,1], `z` wrist-relative — the same schema Hand Landmarker
emits, so zero extraction work. Verified structure: per-letter folders A–Z, ~71 UUID-named JSON files
each for the letters checked (A through V confirmed live; **W–Z counts must be re-confirmed at build
time, M2** — the listing fetch truncated). MIT permits redistribution, so needed files are **mirrored
into `data/asl-now/` at build time**, not fetched live at runtime.

**Known gap, stated plainly: no signer/participant field.** That makes it unusable for a genuine
per-signer holdout — exactly what this project's credibility depends on (§3.2). **Decision: use it as
`train`-only, never `val`/`test`.**

**The signer-holdout gap is filled by self-collected data.** `scripts/collect/` runs the *exact same*
Hand Landmarker → `normalize.ts` pipeline production uses, so what is captured is landmarks only —
**no video or image is ever written to disk.** Target: **4–6 volunteer signers**, explicit consent per
signer kept privately, each recording ~20 reps × 24 letters (~480 samples/signer). One signer held out
entirely for `val`, a different one for `test`. **This is a build-time task requiring a human, not
something an agent completes alone — a blocker at M2, named rather than assumed away.**

**Fallback (Plan B), named now.** If asl-now's licence/content does not hold up at M2 (small hobby
dataset, 36 downloads at check time — real risk it moves), ship on **self-collected data alone**: 6–8
signers × ~30 reps/letter (~4,000–6,000 samples) is enough for this network's size and removes the
third-party licence question entirely. Invoke explicitly, not silently.

**Licence note carried forward:** MediaPipe's `.task` weight file has no standalone licence document
(flagged to counsel, pending). That concerns the *tracking* model fetched from Google's own CDN — the
standard distribution path for every MediaPipe Tasks Vision consumer, not something this repo
redistributes. Unrelated to the classifier's training-data licence above.

### 3.2 Split policy — per-signer, not random, and honest about the pool that cannot be verified

| Split | Source | Purpose |
|---|---|---|
| `train` | asl-now pool (J/Z folders excluded) + N−2 self-collected signers | model fitting |
| `val` | 1 self-collected signer, never in `train` | threshold tuning, early stopping |
| `test` | 1 different self-collected signer, never in `train` or `val` | the published numbers, touched once |

`data/splits.json` freezes the assignment; changing it is a reviewable diff. **Stated on the
methodology page:** the asl-now pool's internal signer composition is unverified (no such field
exists), so published val/test accuracy comes exclusively from the self-collected holdout, which is
real and per-signer. That is the honest version of "per-signer splits" given what the data supports.

### 3.3 Normalization — the part that matters more than the architecture

Raw output (21 landmarks × `{x,y,z}` + a `Left`/`Right` label) is **not** hand-size, rotation or
handedness invariant. `normalize.ts` (zero dependencies, imported unmodified by both trainer and
browser — **the most load-bearing boundary rule in this spec, guarding against train/serve skew**):

1. **Handedness canonicalization.** If `Left`, mirror `x → 1 − x`. All training and inference happens
   on a canonical right hand — halves the data requirement and generalizes instead of memorizing two
   mirror clusters per letter.
2. **Translation.** Subtract landmark 0 (wrist).
3. **Scale.** Divide by `distance(landmark 0, landmark 9)` (wrist → middle-finger MCP) — invariant to
   hand size and camera distance.
4. **In-plane rotation.** `θ = atan2(y9, x9)` after 2–3; rotate every `(x,y)` so landmark 9 sits at a
   fixed canonical angle. `z` is scaled but not rotated.
5. **Flatten** to a 63-dim `Float32Array`.

**Named limitation:** this corrects in-plane (2D) rotation only. MediaPipe's `z` is relative-depth,
not metric, so true out-of-plane rotation (hand turned toward/away from camera) is not corrected —
stated on `/docs/limitations`, not silently assumed solved.

### 3.4 Model architecture and artifact

63 → Dense(48, relu) → Dense(24, softmax); 24 static classes
(`A B C D E F G H I K L M N O P Q R S T U V W X Y`, alphabetical = softmax index order). ~4,200
parameters. `numHands: 1` (ASL fingerspelling is one-handed; removes a "which hand" ambiguity — a
stray second hand's flicker is absorbed by the stability window, §5, not solved bespoke).

**Reproducibility:** `pnpm train` runs `scripts/train.ts` (tfjs-WASM, fixed seed) against `data/` per
the frozen split, writing `model/weights.json` + `eval-report.json` + `confusion-matrix.json`. No cloud
step, no GPU. **CI does not retrain** — floating-point variance across runners would make the gate
flaky; CI runs the **committed** weights against frozen fixtures and checks `eval-report.json` has not
drifted from what is committed (§8), the same drift discipline sluice uses for its chaos numbers.

**Ship bar:** ≥70% overall top-1 accuracy on the held-out `test` signer. The 24-way random baseline is
~4.2%, so 70% is meaningful without pretending the M/N/S/T family will not drag the average down. If
M3 undershoots, the fix is more self-collected data — **never a quietly lowered bar.**

### 3.5 The eval — published, not summarized

`model/eval-report.json` (rendered on `/docs/concept`) carries the full 24×24 confusion matrix and a
per-letter precision/recall/F1 table generated from the actual `test`-signer run, not asserted in
prose. **Stated prominently, not as a caveat:** M, N, S and T are genuinely similar closed-fist
handshapes differing mainly in thumb position, and elevated confusion among them is expected — the
page shows the *real measured numbers* for that family, whatever they are, beside that claim. J and Z
are not in the label set; the page states why rather than showing permanent zeros.

### 3.6 Client-side progress schema

`progress.ts`, `localStorage` key `swage-progress-v1`:
```ts
interface ProgressV1 {
  version: 1;
  sessions: { date: string; attempted: number; correct: number; bestStreak: number }[];
  perLetter: Record<Letter, { seen: number; correct: number }>; // drives the confusable-letters drill
}
```
Never transmitted. A visible **"Clear my progress"** control deletes the key. If `localStorage` is
unavailable, practice still works in-session and the UI says progress will not persist, rather than
throwing.

---

## 4. Module / boundary map

```
Runtime (100% browser, no server compute):
 getUserMedia (640x480 ideal, no audio) -> <video>
   -> capture loop (rAF, DECIMATED to ~15Hz — §7.1)
   -> MediaPipe HandLandmarker.detectForVideo()  [WASM+WebGL2, or WASM CPU delegate]
   -> src/lib/normalize.ts   (pure, zero deps, SAME file the trainer imports)
   -> src/lib/classifier.ts  (hand-rolled forward pass; no tfjs shipped to the browser)
   -> src/lib/stability.ts   (debounce/hysteresis; knows nothing about "practice")
   -> React practice UI      (compares held letter to target; owns pedagogy)
   -> src/lib/progress.ts    (localStorage)

Build-time (never shipped):
 data/ -> scripts/train.ts -> model/weights.json + eval-report.json -> committed -> /docs/concept
```

**Isolation rules.** `normalize.ts` imports nothing — no browser API, no Node API, no framework — so it
runs unmodified in the trainer and in the bundle. `classifier.ts` never imports a training framework;
the forward pass is committed arithmetic, tested for parity against tfjs's own `predict()` on golden
fixtures (§8), so the model and the code that runs it cannot silently drift. `stability.ts` has no
concept of "target letter" or "session," so the CV pipeline and the teaching product stay separately
testable.

---

## 5. API surface

No HTTP API. Auth model: **none** — no accounts, no server write path, meeting the "no unauthenticated
write path, ever" bar by having no write path at all.

```ts
// normalize.ts
export function normalizeLandmarks(landmarks: RawLandmark[] /* exactly 21 */, handedness: Handedness): Float32Array; // len 63

// classifier.ts
export const LETTERS: readonly Letter[]; // 24, fixed softmax order
export function classify(vec63: Float32Array): { letter: Letter; confidence: number; distribution: Float32Array };

// stability.ts
export const DEFAULT_STABILITY: StabilityConfig; // { windowSize: 8, minAgree: 6, confidenceThreshold: 0.75 (tuned on val, frozen), cooldownMs: 500 }
export class StabilityTracker {
  push(tick: { letter: Letter | null; confidence: number; ts: number }): { held: boolean; letter?: Letter };
  reset(): void; // on hand-exits-frame, delegate switch, explicit skip
}

// progress.ts
export function recordAttempt(letter: Letter, correct: boolean, holdMs: number): void;
export function nextDrillLetter(bias: 'confusable' | 'weak' | 'random'): Letter; // confusable seeded from eval-report.json's own confusion pairs
export function clearProgress(): void;
```

**Routes.** `/` · `/practice` · `/docs/quickstart` · `/docs/concept` (normalization diagram +
confusion matrix + per-letter table + split policy — the eval, rendered) · `/docs/failure-modes` ·
`/docs/limitations`.

---

## 6. Failure contracts

| # | Fault | Contract |
|---|---|---|
| F1 | Camera permission denied | Non-camera flashcard mode (§9): reference diagram + text description + manual "I made this shape" advance, keyboard-operable. No dead end. |
| F2 | No camera hardware | Same fallback, distinct copy. |
| F3 | GPU (WebGL2) delegate rejected, **including no WebGL at all** | MediaPipe's CPU delegate is pure WASM and needs no WebGL, so these are **one branch, not two rungs**. Catch the rejection, retry `delegate:'CPU'`. Label: *"Running on CPU — same result, about 15 frames a second instead of 35."* Never "reduced accuracy" (it isn't), never "identical" (frame rate visibly differs). |
| F4 | Model fetch fails mid-load | Loud on-page error + retry, never a stuck spinner. Flashcard mode needs no model and stays available. |
| F5 | **Cache bug** — `.task` re-downloads every visit (measured: GCS caps freshness at `max-age=3600`) | Fixed at the fetch layer: manual `fetch()` + `caches.open()/.put()`, pass the `ArrayBuffer` via `modelAssetBuffer`, not `modelAssetPath`. Verified by a second-visit network capture showing ~0 model bytes. |
| F6 | Two hands in frame with `numHands:1` | MediaPipe may flicker its choice. Absorbed by the stability window; copy asks for one hand. |
| F7 | Low-confidence prediction | Tick's effective label is `null` below threshold — never silently guesses. |
| F8 | Hand exits frame mid-hold | `reset()` — a gap always breaks a streak. No partial credit across a gap. |
| F9 | `prefers-reduced-motion` | Feedback becomes an instant static state change. Landing hero shows a poster frame + the confusion-matrix table instead of an autoplaying loop. |
| F10 | `localStorage` unavailable | Practice works in-session; UI says progress will not persist. Never throws. |
| F11 | Classifier wrong on a genuinely confusable letter | Not a bug. Normal miss; hint references the published confusion pair ("commonly mixed up with M — check thumb position"), never phrased as the user being wrong. |
| F12 | J or Z requested | Structurally impossible — never offered. `/docs/limitations` states why. |

---

## 7. Degradation ladder, privacy, and the honesty surface

### 7.1 Frame budget and the "held" rule

Detection is **deliberately decimated to ~15Hz** (one detect per ~66ms) regardless of delegate. It
matches the CPU fallback's natural ceiling (~65.8ms/frame measured on a non-Tier-A/B desktop; Tier A/B
remain **unverified**, carried forward, not resolved here), so visible behaviour barely changes across
the ladder — only the badge does. It also leaves main-thread headroom without a worker, which this
spec deliberately does not add (Worker + OffscreenCanvas is real complexity for zero measured benefit
at this budget).

**"Held" rule:** the last 8 ticks (~533ms) must have ≥6 agreeing on the same non-null letter at ≥0.75
confidence — a majority vote that is forgiving of one noisy frame rather than demanding 8 consecutive
exact matches. On "held," fire a single edge-triggered match, then require the buffer to clear (letter
changes, hand leaves, or 500ms cooldown) before firing again — so one held shape cannot register as
dozens of matches.

### 7.2 Privacy — the precise claim, not the flattering one

**The claim: "Your camera feed and hand landmarks never leave your device."** Not "nothing leaves your
device" — that would be false. A cold visit genuinely shows requests to `cdn.jsdelivr.net` (~3.2MB
WASM runtime) and `storage.googleapis.com` (~7.5–8MB `hand_landmarker.task`), both named on the
methodology page with byte counts — the receipt, not hidden. **What makes the claim false, precisely:**
any request whose body, URL or payload embeds a landmark coordinate, a predicted letter, a confidence
score or a frame capture. **Decision: zero third-party analytics in v1.** If any is ever added, this
claim is the review gate it must pass. The demonstrable proof, and the beat the demo recording leads
with: once the one-time model load finishes, the Network tab stays empty while letters classify live.

### 7.3 The honesty surface — non-negotiable, and it is the death condition

**Placement (three places, none optional, none a dismissible toast):**
1. **Above the fold on `/`**, beside the primary CTA, permanent and non-collapsible.
2. **Restated on `/practice`**, near the camera view, every session.
3. **In full on `/docs/limitations`**: 24 letters not 26 and why, the M/N/S/T family with real measured
   numbers, the asl-now signer-composition caveat, the in-plane-only rotation correction.

**Wording constraints (binding):**
- Must state plainly this is fingerspelling-**handshape** practice, not sign-language translation or
  understanding.
- Must name that ASL is a full language with its own grammar and non-manual markers (facial
  expression, mouth morphemes, body shift) this tool does not observe or evaluate.
- **Banned anywhere on the site in connection with this tool:** "understands," "translates," "reads,"
  "speaks" (ASL/sign language). Output is a "handshape match," never a "grade on your ASL."
- Framing is "ASL fingerspelling handshape practice" — never "Learn ASL" or "ASL Translator."

Illustrative line satisfying the above: *"This checks handshapes, not ASL. ASL is a full language with
its own grammar and facial and body grammar this tool doesn't see."*

**A genuine, stated accessibility limit, not a performed claim:** the camera-graded loop is inherently
unusable by a blind or low-vision visitor — no technical substitute exists for "does your hand visually
match this shape." The flashcard mode is offered as the accessible path for *keyboard/no-camera* users,
**not** framed as solving this for visually-impaired users, because it does not. Stated on
`/docs/limitations`, not glossed over.

---

## 8. Eval / golden set for CI

Two deliberately different-shaped gates plus a drift check — not pretending a probabilistic system is
deterministic.

1. **Classifier fixture eval (probabilistic, honest bar).** ≥72 held-out landmark samples (3/letter ×
   24) from the `test` signer, never used in training. CI runs them through the **committed**
   `normalize.ts` + `classifier.ts` (no retraining) and asserts **≥70% pass rate**, matching §3.4. A
   100% bar here would be dishonest given M/N/S/T are genuinely confusable.
2. **Interaction/pipeline eval (deterministic, zero tolerance).** Scripted per-tick
   `{letter, confidence}` sequences with expected `held` events at expected ticks. Pure logic —
   **100% pass bar**, like sluice's chaos invariants.
3. **`eval-report.json` drift check.** CI recomputes the confusion matrix from committed weights
   against the frozen `test` split and fails on drift. The methodology page and the repo cannot
   disagree.

**CI, five stages:** `typecheck → lint → unit → e2e:smoke → eval`.
- unit: `normalize.ts` against 5 hand-computed fixture vectors (translation/scale/rotation/handedness
  tested individually), `classifier.ts` parity against tfjs `predict()`, the `stability.ts` state
  machine.
- e2e:smoke: Playwright with `--use-fake-device-for-media-stream
  --use-file-for-fake-video-capture=tests/fixtures/hand-a.mp4` (the deterministic Chromium pattern for
  `getUserMedia` apps — also what generates the demo recording), and separately with
  `--disable-webgl2 --disable-webgl` to exercise the CPU branch (F3).

---

## 9. The teaching product

A **session** picks **Free practice** (24 letters, shuffled with a per-session fixed seed so a session
is resumable) or **Drill** (`nextDrillLetter('confusable'|'weak')` — weighted toward the visitor's own
lowest-accuracy letters and toward the pairs `eval-report.json` itself names as confused; **the app's
own published eval decides what to drill, not a hardcoded guess**).

Each letter shows a reference diagram + "Show me: `<letter>`". **Correct** = `held` with
`letter === target` → static (or brief) confirmation, `recordAttempt(letter, true, holdMs)`,
auto-advance. **Wrong** = held-stable prediction ≠ target — **no penalty framing, no scolding.** Show
the target again; if the held letter is a known confusable pair, say so plainly ("commonly mixed up
with M — check your thumb position"); immediate retry; `recordAttempt(letter, false, holdMs)`. **No
forced retry loop** — an explicit, keyboard-reachable "skip" is always available.

**Non-camera path (F1/F2, and the accessibility requirement):** the same reference diagrams with a
keyboard-operable "I made this shape" advance and a skip — no grading, but genuine letter-learning
value, reachable without a camera.

**Why someone returns:** a locally-persisted summary ("last time: 18/24 in 3:40, best streak 9"), a
Drill mode genuinely specific to that visitor's own misses, and a real graded webcam tool for a skill
whose closest comparable prior art is from 2021.

---

## 10. Build order

| M | Deliverable | Verified by |
|---|---|---|
| **M0** | Next.js 16.3/React 19.2/TS strict + `noUncheckedIndexedAccess`, ESLint 9, Vitest 4, Playwright, five-stage CI, MIT + brand carve-out, README stub with lockup | CI green on an empty repo |
| **M1** | **WALKING SKELETON:** camera → Hand Landmarker (GPU only, no fallback yet) → `normalize.ts` → stub classifier (2–3 letters) → live overlay + predicted label. Deployed. | Live URL; a real hand produces a live-updating label; derisks the browser-ML toolchain |
| **M2** | **Dataset gate (human-in-the-loop).** Re-verify asl-now MIT licence + W–Z contents live; mirror to `data/asl-now/`; build `scripts/collect/`; recruit ≥4 volunteer signers with consent; freeze `splits.json` | `data-check.ts` passes: per-letter minimums met, held-out signers appear only in val/test |
| **M3** | `normalize.ts` fixture tests; `scripts/train.ts` → weights + eval-report + confusion matrix | `pnpm train` reproduces committed weights; test-signer accuracy ≥70% or loop back to M2 — never silently lower the bar |
| **M4** | `classifier.ts` forward pass replacing the stub; parity-tested against tfjs `predict()` | Live demo classifies real letters for a live hand |
| **M5** | `stability.ts` + free-practice UI (target picker, feedback, session summary) | Playwright with fake-camera video completes one letter end to end |
| **M6** | Degradation ladder: GPU-rejection → CPU with correct labelling (F3); camera-denied/no-camera → flashcard (F1/F2); cache fix (F5) | Playwright with `--disable-webgl2 --disable-webgl` shows the CPU label and still classifies; second-visit capture shows ~0 model bytes |
| **M7** | `progress.ts`, Drill seeded from `eval-report.json`, session summary, "Clear my progress" | Unit tests; Playwright two-session return flow |
| **M8** | Content + brand: `/docs/*`, `/docs/concept` rendering the real confusion matrix, hero honesty line, footer/brand, OG, README, mechanism diagram (raw landmarks → mirror → translate → scale → rotate → 63-dim → MLP → letter, one amber accent on the "held" moment) | QUALITY-BAR checklist; ten-second test |
| **M9** | Freeze + polish: full CI green, accessibility pass, scripted demo recording (cold load → practice → one correct hold → Drill teaser, **Network tab visibly idle during live classification** — the proof beat), live deploy verification in a real browser | Full acceptance checklist §11 |

**Cut line.** M0–M6 is the non-negotiable floor. If tight, cut **M7** (persistence/Drill) — free
practice alone still teaches and grades. **Never cut M2's per-signer holdout, M6's degradation ladder,
or M8's honesty surface and brand/QUALITY-BAR items.**

---

## 11. Acceptance criteria

**Platform.** ☐ TS strict + `noUncheckedIndexedAccess`, no `as any` at a boundary ☐ no API routes, no
database — cost ceiling N/A with the reason stated ☐ zero third-party analytics ☐ honest error/fallback
states, never a stuck spinner or blank page ☐ README failure-mode table (F1–F12) ☐ data-licence
attribution alongside the code and brand carve-outs.

**Product.** ☐ test-signer accuracy ≥70%, published confusion matrix + per-letter table generated from
the repo ☐ per-signer split honestly scoped (§3.2 caveat stated) ☐ J/Z structurally absent, stated why
☐ degradation ladder covers GPU-rejection/no-WebGL (consolidated), no camera, permission denied, cache
re-download ☐ non-camera flashcard path exists and is keyboard-reachable ☐ honesty-surface wording
constraints satisfied in all three placements ☐ privacy claim stated precisely, never the unqualified
"nothing leaves your device."

**Brand.** ☐ per-project glyph from a committed deterministic generator — *a swage block die closing on
a blank, ink strokes, one amber accent where the shape resolves true* ☐ compact-glyph favicon hierarchy
per BRAND-KIT ☐ footer attribution + backlink + repo link on every page, no hire-me CTA (D1) ☐ README
lockup + portfolio footer ☐ build-time OG ☐ palette compliance — **including the landmark overlay,
drawn in-brand, not MediaPipe's stock rainbow skeleton.**

**Accessibility.** ☐ 320px ☐ contrast ≥4.5:1 ☐ every non-camera control keyboard-reachable ☐
`prefers-reduced-motion` honoured ☐ the camera-grading accessibility limit stated honestly, not glossed.

**The ten-second test.** Show the landing page to a senior engineer for ten seconds. If they cannot say
"it grades your ASL handshape practice with a classifier this project trained and evaluated itself" —
not "translates ASL" — the page failed.

---

## 12. Open questions (deferred to the main session / James)

1. **Volunteer signer recruitment for M2** — who beyond James, how many, consent process. A people
   task, not a build one.
2. **`confidenceThreshold` exact value** — the mechanism is fixed (tuned on `val` to maximise F1, then
   frozen and committed with the weights); the number is an M3 output.
3. **W–Z folder verification in asl-now** — the live listing truncated before those four; re-check at
   M2 and invoke Plan B if it does not hold.
4. **MediaPipe `.task` licence ambiguity** — inherited unresolved from the Model Card, routed to
   counsel there; this spec continues fetching from Google's CDN rather than redistributing the file.
5. **Real Tier A/B device numbers** — every latency figure here is inherited from a non-Tier-A/B
   desktop measurement. A real mid-range-Android pass is an inherited open dependency.
6. **`data-check.ts` minimum per-letter count** — pin once M2's actual volunteer yield is known.

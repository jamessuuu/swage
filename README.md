<p align="left">
  <img src="public/brand/lockup.svg" alt="swage — by Agent James" height="48">
</p>

# swage

**Real-time ASL fingerspelling handshape practice, graded by a classifier
this project trained and evaluated itself — on a device that never sends
your camera feed anywhere.**

> **Status: all 9 build milestones complete** (`docs/SPEC.md` §10), with two
> named, deploy-gated exceptions. The graded practice loop, the GPU→CPU
> degradation ladder, Drill mode, and the full docs/brand surface all work
> end to end — verified by a real production build (`next build && next
> start`, every route checked 200, zero console/hydration errors) and a real
> test run (numbers below), not asserted. **Not deployed** — this build pass
> was scoped to local commits only, no push, no live URL, so two SPEC.md M9
> items could not be completed: the scripted demo recording and live-deploy
> verification both require a real deployed URL by their own definition
> (`showcase-program/DESIGN-DIRECTION.md`: recordings "must be recorded
> against the deployed site, so the recording cannot drift from what a
> visitor gets"). Everything else in M9 — full local CI-equivalent green,
> the accessibility pass, the final acceptance-checklist pass — is done and
> below. **The accuracy figure below is provisional, not this project's own
> ship bar** — read the caveat before trusting it.

This checks handshapes, not ASL. ASL is a full language with its own grammar
and facial and body grammar this tool doesn't see. Full spec:
[`docs/SPEC.md`](docs/SPEC.md).

## The eval, honestly

**95.7%** top-1 accuracy on 281 held-out samples. Before that number means
anything: it comes from a random, file-level split of the training pool
itself, because zero volunteer signers have been recorded yet. This
project's own ship bar (`docs/SPEC.md` §3.4) requires **≥70% on a genuine
held-out signer never seen in training** — recruiting 4–6 consenting
volunteers to record that signer is a human task no coding agent can
perform (`showcase-program/PHASE-2.md` names it explicitly), so:

**Ship bar: not met.** The number is real, reproducible, and honestly
captioned everywhere it appears (`model/eval-report.json`'s own
`provisional: true` field, the app's UI, `/docs/concept`, `/docs/limitations`)
— never presented as the real claim. `pnpm run data-check` reports the exact
same gap on demand: `held-out coverage: train=0 val=0 test=0 signers — FAIL`,
correctly, by design.

The full 24×24 confusion matrix and per-letter precision/recall/F1 table,
generated from this same run, render at `/docs/concept` (`pnpm dev`, then
visit it — no separate export file, so the page and the repo cannot
disagree).

## The mechanism

21 raw hand landmarks from MediaPipe's Hand Landmarker → mirrored to a
canonical right hand → translated (wrist as origin) → scaled
(wrist-to-middle-knuckle distance) → rotated (fixed in-plane angle) → a
63-dimensional vector → a two-layer network (~4,200 parameters, 39.3KB,
committed to this repo as `model/weights.json`, imported directly into the
bundle) → one of 24 letters. The diagram renders live on `/` and
`/docs/concept`; `src/lib/normalize.ts` is the exact zero-dependency module
both the trainer (`scripts/train.ts`) and the browser import, so the model
and the code running it cannot silently drift apart.

No J, no Z — `A B C D E F G H I K L M N O P Q R S T U V W X Y`, 24 classes,
because both require traced motion a single held frame cannot see.

## Development

```sh
pnpm install
pnpm dev                # http://localhost:3000
pnpm typecheck           # next typegen && tsc --noEmit
pnpm lint                # eslint .
pnpm test                # unit tests (vitest) — 90/90 passing at this commit
pnpm test:e2e            # Playwright, fake camera device, 3 projects (GPU/CPU/no-camera)
pnpm run eval             # CI's eval gate: fixture accuracy + interaction logic + drift check
pnpm run data-check       # honest data-integrity report — currently FAILs on held-out
                          # coverage by design (see "The eval, honestly" above)
pnpm run train -- --provisional-split
                          # retrains model/weights.json from data/ (tfjs-WASM, fixed seed,
                          # reproducible byte-for-byte). The flag is required and explicit —
                          # `pnpm run train` with no flag refuses to run until real volunteer
                          # signers exist; see "The eval, honestly" above for why.
pnpm run brand              # regenerates public/brand/ from scripts/brand.mjs
pnpm run mirror-asl-now     # re-mirrors data/asl-now/ from the live HF dataset
pnpm run collect            # volunteer capture tool — same production pipeline, landmarks only
```

CI (`.github/workflows/ci.yml`) runs five stages on every push:
`typecheck → lint → unit → e2e:smoke → eval`. `data-check` is deliberately
**not** a CI gate — it would fail CI for the same human-task reason it fails
locally, and that failure is not this repo's to fix by itself.

### Verification, from a real run — not asserted

Every number below is from an actual command run against the code at this
commit, not a claim:

| Command | Result |
|---|---|
| `pnpm typecheck` | clean |
| `pnpm lint` | clean |
| `pnpm test` | **90/90** passing (10 files) |
| `pnpm run eval` | 3/3 gates pass — classifier fixture 69/72 (95.8%, bar ≥70%); 8/8 interaction scenarios; `eval-report.json` drift check clean |
| `pnpm run test:e2e` | **10 passed, 1 skipped** (11 total, 3 Playwright projects) — the one skip is `degradation-cpu.spec.ts`'s "still classifies on CPU" test, env-gated with a documented root cause: forcing every software rasterizer off to make the GPU delegate genuinely fail also removes what MediaPipe needs to compose video frames at all, independent of which delegate is active |
| `next build` (clean `.next`) | succeeds; all 8 routes prerender static (○) |
| `next build && next start`, every route | all return `200`; 0 browser console errors on `/`, `/practice`, `/docs/concept` |

**Accessibility**, also checked rather than assumed: no page-level horizontal
overflow at a 320px viewport (`/docs/concept`'s confusion matrix scrolls in
its own container by design — the page itself does not); WCAG contrast
ratios computed directly from the four committed palette values for every
combination the CSS actually uses (ink/paper 16.72:1, amber/paper 4.70:1,
confusion-matrix hot-cell 11.07:1, opacity-reduced secondary text
7.63–10.76:1 — all above the 4.5:1 bar); every interactive control in `src/`
is a native `<button>`/`<a>` with no `tabIndex` override and no
`outline: none` anywhere in `globals.css`; `prefers-reduced-motion` is
honoured globally (there are no autoplaying animations to begin with); the
camera-grading accessibility limit is stated on `/docs/limitations`, not
glossed over.

## Why

Existing "ASL AI" demos mostly wrap a downloaded model with no published
accuracy and no stated failure modes. swage trains its own small classifier,
publishes the real confusion matrix next to the number, and names exactly
where the current build falls short of its own bar rather than rounding up.

- **Everything classification-related runs on your device.** The only
  network traffic is MediaPipe's one-time WASM runtime (~3.2MB) and hand
  model (~7.5–8MB) download — both named with byte counts on
  `/docs/limitations`, not hidden. Once that finishes, the Network tab stays
  empty while letters classify live.
- **A real degradation ladder, not a happy-path demo.** GPU (WebGL2)
  rejected → CPU (pure WASM) delegate, correctly labelled, not claimed
  "identical"; camera denied or absent → a keyboard-operable flashcard mode
  with the same reference material, no dead end; the model's own weights
  cache is fixed at the fetch layer (`caches.open()`/`.put()` +
  `modelAssetBuffer`) around a real GCS `max-age=3600` bug.
- **No accounts, no server write path, no analytics, no LLM anywhere.**
  Progress lives in `localStorage`; a visible "Clear my progress" control
  deletes it. There is nothing server-side to secure, pause, or bill.

## Failure modes

Every fault this project has a named, deliberate answer for — not a promise
nothing ever goes wrong, a record of what happens when it does. Same table,
same wording, as `/docs/failure-modes` (`src/app/docs/failure-modes/page.tsx`
is the single source; this table is kept in sync by hand, not generated,
because it is prose, not data the page computes).

| # | Fault | Contract |
|---|---|---|
| F1 | Camera permission denied | Non-camera flashcard mode: reference diagram + text description + manual "I made this shape" advance, keyboard-operable. No dead end. |
| F2 | No camera hardware | Same fallback as F1, distinct copy naming the actual cause. |
| F3 | GPU (WebGL2) delegate rejected, including no WebGL at all | MediaPipe's CPU delegate is pure WASM and needs no WebGL, so these are one branch, not two rungs. Catch the rejection, retry `delegate:'CPU'`. Label: "Running on CPU — same result, about 15 frames a second instead of 35." Never "reduced accuracy" (it isn't), never "identical" (frame rate visibly differs). |
| F4 | Model fetch fails mid-load | Loud on-page error + retry, never a stuck spinner. Flashcard mode needs no model and stays available. |
| F5 | Cache bug — `.task` re-downloads every visit (GCS caps freshness at `max-age=3600`) | Fixed at the fetch layer: manual `fetch()` + `caches.open()`/`.put()`, pass the `ArrayBuffer` via `modelAssetBuffer`, not `modelAssetPath`. Verified by a second-visit network capture showing ~0 model bytes. |
| F6 | Two hands in frame with `numHands:1` | MediaPipe may flicker its choice. Absorbed by the stability window; copy asks for one hand. |
| F7 | Low-confidence prediction | A tick's effective label is `null` below threshold — never silently guesses. |
| F8 | Hand exits frame mid-hold | `reset()` — a gap always breaks a streak. No partial credit across a gap. |
| F9 | `prefers-reduced-motion` | Feedback becomes an instant static state change. No autoplaying motion. |
| F10 | `localStorage` unavailable | Practice works in-session; UI says progress will not persist. Never throws. |
| F11 | Classifier wrong on a genuinely confusable letter | Not a bug. Normal miss; hint references the published confusion pair ("commonly mixed up with M — check thumb position"), never phrased as the user being wrong. |
| F12 | J or Z requested | Structurally impossible — never offered. `/docs/limitations` states why. |

## Non-goals

No language-understanding claim, anywhere — this reads a static handshape,
never claims to translate or understand ASL. No J or Z. No accounts, no
server-side write path, no analytics. No LLM anywhere. No spaced-repetition
engine (frequency-weighted resampling from the visitor's own miss data is
the whole mechanism). Full list: `docs/SPEC.md` §1.

## Limitations

- **The published eval does not meet this project's own ship bar yet** —
  see "The eval, honestly" above. This is the limitation that matters most.
- **24 letters, not 26.** J and Z require traced motion a single held frame
  structurally cannot see.
- **M, N, S, and T are genuinely hard to tell apart** — closed-fist
  handshapes differing mainly in thumb position, confusable even for
  people. Real per-letter numbers on `/docs/limitations`, not glossed over.
- **The training pool's signer composition is unverified** — the
  `sid220/asl-now-fingerspelling` community dataset has no signer field at
  all, so it is used for training only, never for published test numbers.
- **Rotation correction is in-plane only.** MediaPipe's `z` is relative
  depth, not a metric measurement, so a hand turned toward or away from the
  camera is not corrected.
- **The camera-graded loop is not usable by a blind or low-vision
  visitor.** No technical substitute exists for "does your hand visually
  match this shape." Flashcard mode is the accessible path for
  keyboard/no-camera users, not a fix for this.

Full detail: `/docs/limitations` (`pnpm dev`, then visit it).

## License

Code: MIT. Brand assets (`public/brand/`) are © James Lorenz Santos, all
rights reserved, not covered by the MIT grant. Dataset carve-outs:
`data/asl-now/` is mirrored under its own MIT license (DOI
`10.57967/hf/1494`); `data/self-collected/` (empty at this commit) will be
project-only licensed once volunteer consent exists. Full terms:
[`LICENSE`](LICENSE) and [`data/ATTRIBUTION.md`](data/ATTRIBUTION.md).

---

Part of the [Agent James](https://agentjames.vercel.app) portfolio.
Built by James Lorenz Santos. Code MIT; brand assets excluded (see LICENSE).

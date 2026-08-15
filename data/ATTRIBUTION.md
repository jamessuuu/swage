# Data attribution

## `data/asl-now/` — `sid220/asl-now-fingerspelling`

Source: https://huggingface.co/datasets/sid220/asl-now-fingerspelling
License: **MIT** (verified live against the Hugging Face API, 2026-08-15 —
`cardData.license: "mit"`, `tags: ["license:mit", ...]`).
DOI: `10.57967/hf/1494`.

> ASLNow! is a web app designed to make learning ASL fingerspelling easy and
> fun. […] This dataset, used to train the fingerspelling model, is licensed
> under the MIT License. It will be updated frequently as more data is
> collected. The dataset is collected from multiple participants told to
> sign ASL letters into a camera and detecting hand landmarks […]

Mirrored unmodified: one JSON file per sample, each a bare array of 21
`{x, y, z}` objects — 21 MediaPipe hand landmarks, `x`/`y` normalized to
`[0,1]`, `z` wrist-relative. Verified against a live sample file
(`A/0080e8c9-b34c-4a1d-885d-ec336790349b.json`) before mirroring: exactly 21
points, no `handedness` field, no signer/participant field of any kind.

**Per-letter counts at mirror time** (live HF listing, 2026-08-15 — resolves
SPEC.md §12 open question 3, "W-Z folder verification… the live listing
truncated before those four"):

| Letter | Files | Letter | Files | Letter | Files |
|---|---|---|---|---|---|
| A | 65 | J | 93 (unused) | S | 83 |
| B | 69 | K | 64 | T | 68 |
| C | 53 | L | 84 | U | 106 |
| D | 72 | M | 88 | V | 83 |
| E | 57 | N | 84 | W | 75 |
| F | 61 | O | 98 | X | 106 |
| G | 95 | P | 72 | Y | 82 |
| H | 69 | Q | 97 | Z | 155 (unused) |
| I | 68 | R | 75 | | |

W, X, Y all comfortably above the ~70/letter ballpark of the other letters —
Plan B (SPEC.md §3.1, self-collected-only) is **not** invoked; the pool
holds up. J and Z are mirrored nowhere near as thoroughly needed since this
project's 24-class label set excludes both structurally (SPEC.md §1.2) —
their real, non-trivial file counts above are recorded for completeness,
not used.

**Known gap, unchanged from SPEC.md §3.1: no signer/participant field
exists anywhere in this dataset.** `data/asl-now/` is `train`-only, never
`val`/`test` (SPEC.md §3.2) — recorded in `data/splits.json`
(`aslNowPool.split: "train"`) and enforced by `scripts/data-check.ts`.

**Re-mirror:** `pnpm run mirror-asl-now` (network + `git` required;
shallow-clones the current live dataset repo and overwrites the 24 used
letter folders under `data/asl-now/` — see `scripts/mirror-asl-now.ts` for
why a git clone, not ~1,900 individual HTTPS GETs).

## `data/self-collected/`

SPEC.md §3.1: volunteer-recorded landmark JSON, signer-tagged, supplying the
genuine per-signer `val`/`test` holdout this project's published accuracy
depends on for credibility (SPEC.md §3.2). **Recruiting and recording
consenting volunteer signers is a human task** —
`showcase-program/PHASE-2.md` names it explicitly as one only James can do
("Human-only blockers now on the list… swage adds one an agent structurally
cannot do: recruiting 4-6 volunteer ASL signers with recorded consent").

**Status: this directory is currently empty.** `scripts/collect/` is built,
reuses the exact production src/lib pipeline, and is verified end to end
against a real (non-volunteer) hand photo in
`tests/e2e/collect-tool.spec.ts` — camera capture, live MediaPipe detection,
and sample recording all genuinely work. What it has never done is run
against a real consenting volunteer, because none exists yet in this build
session. Run `pnpm run collect` to start a real session once one does; run
`pnpm run data-check` at any time for the current, honest status
(currently: `held-out coverage: train=0 val=0 test=0 signers — FAIL`, which
is correct, not a bug).

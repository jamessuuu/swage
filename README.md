# swage

Real-time ASL fingerspelling handshape practice, graded by a classifier
trained and evaluated as part of this project — on a device that never
sends your camera feed anywhere.

This checks handshapes, not ASL. ASL is a full language with its own
grammar and facial and body grammar this tool doesn't see. Full spec:
[`docs/SPEC.md`](docs/SPEC.md).

## Status

Early build. See the build report in the project's commit history for the
current milestone and what remains — this README grows into the full
brand/docs/failure-mode surface `docs/SPEC.md` M8 describes as the project
reaches it.

## Development

```sh
pnpm install
pnpm dev            # http://localhost:3000
pnpm typecheck
pnpm lint
pnpm test           # unit tests (vitest)
pnpm test:e2e       # Playwright, fake camera device
pnpm train          # trains model/weights.json from data/ (needs data — see docs/SPEC.md §3)
pnpm data-check      # validates data/splits.json + per-letter counts
pnpm eval            # CI's eval gate: committed weights vs. frozen fixtures
```

## License

Code: MIT. Brand assets (`public/brand/`) and dataset carve-outs are
licensed separately — see [`LICENSE`](LICENSE) and
[`data/ATTRIBUTION.md`](data/ATTRIBUTION.md).

---

Part of [the Agent James portfolio](https://agentjames.vercel.app).

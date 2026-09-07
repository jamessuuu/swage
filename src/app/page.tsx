import type { Metadata } from "next";
import Link from "next/link";
import evalReport from "../../model/eval-report.json" with { type: "json" };
import splits from "../../data/splits.json" with { type: "json" };
import { MechanismDiagram } from "@/components/MechanismDiagram";
import { LETTERS } from "@/lib/classifier";

export const metadata: Metadata = {
  title: "swage — ASL fingerspelling handshape practice",
  description:
    "Show your hand to your webcam. swage names the ASL fingerspelling handshape it matches, graded live by a classifier this project trained and evaluated itself — entirely on your device.",
};

const WEIGHTS_KB = 39.3; // model/weights.json — read at commit time, not asserted; re-check if the model changes

type PerLetter = Record<string, { precision: number; recall: number; f1: number; support: number }>;

/** Three buckets, not a continuous ramp: a reader needs "solid / watch / weak",
 * not 24 shades. Thresholds are stated on the page so the colour is readable
 * as a fact rather than a vibe. */
function bucket(f1: number): "hi" | "mid" | "lo" {
  if (f1 >= 0.95) return "hi";
  if (f1 >= 0.85) return "mid";
  return "lo";
}

export default function Home() {
  const selfCollectedSignerCount = Object.keys(splits.selfCollectedSigners).length;
  const perLetter = evalReport.perLetter as PerLetter;
  const accuracy = (evalReport.overallAccuracy * 100).toFixed(1);
  const pairs = evalReport.confusablePairs as [string, string][];

  return (
    <main>
      {/* ══════════════════════════════════════════════════════ HERO ═════ */}
      <section className="hero">
        <div className="shell hero-grid">
          <div>
            <p className="eyebrow rise">
              <span className="dot" />
              on-device · no upload · 24 handshapes
            </p>

            <h1 className="display rise d1">
              Show your hand. It names the <em>handshape</em>, live.
            </h1>

            <p className="hero-sub rise d2">
              A classifier this project trained and evaluated itself — 4,200 parameters, {WEIGHTS_KB}KB,
              committed to the repo — grades your webcam frame in the browser. The camera feed never
              leaves your device.
            </p>

            <p className="honesty-line rise d2" style={{ marginTop: "1.25rem", maxWidth: "34rem" }}>
              This checks handshapes, not ASL. ASL is a full language with its own grammar and facial
              and body grammar this tool doesn&apos;t see.
            </p>

            <div className="cta rise d3">
              <Link href="/practice" className="btn btn-primary">
                Start practicing
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path
                    d="M3 8h10M9 4l4 4-4 4"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Link>
              <Link href="/docs/concept" className="btn">
                Concept &amp; eval
              </Link>
            </div>

            <p className="hero-foot rise d4">
              <span>
                <span className="tick">✓</span> no accounts
              </span>
              <span>
                <span className="tick">✓</span> no server write path
              </span>
              <span>
                <span className="tick">✓</span> no LLM
              </span>
            </p>
          </div>

          {/* The instrument: the whole alphabet, scored by the project's own
              eval. Every tile's number is model/eval-report.json's per-letter
              F1 — not a rating, a measurement. */}
          <div className="instrument rise d2">
            <div className="inst-bar">
              <span className="lights">
                <i />
                <i />
                <i />
              </span>
              eval-report.json · {evalReport.testCount} held-out samples
              <span className="right">provisional</span>
            </div>

            <div className="alpha-grid">
              {LETTERS.map((letter) => {
                const m = perLetter[letter];
                const f1 = m ? m.f1 : 0;
                return (
                  <div
                    key={letter}
                    className="glyph"
                    data-f={bucket(f1)}
                    title={`${letter} — F1 ${f1.toFixed(2)}, ${m ? m.support : 0} test samples`}
                  >
                    {letter}
                    <span className="f">{f1.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>

            <p className="alpha-legend">
              <span>
                <i style={{ background: "var(--color-ok)" }} />
                F1 ≥ 0.95
              </span>
              <span>
                <i style={{ background: "var(--color-amber)" }} />
                0.85–0.95
              </span>
              <span>
                <i style={{ background: "var(--color-fail)" }} />
                below 0.85
              </span>
              <span>J and Z are absent: both need traced motion</span>
            </p>

            <p className="inst-foot">
              Confusable pairs the eval actually found:{" "}
              {pairs.map(([a, b], i) => (
                <span key={`${a}${b}`}>
                  {i > 0 ? " · " : ""}
                  {a}/{b}
                </span>
              ))}
              . The practice drill picks from this list — the published eval decides what to drill, not a
              hardcoded guess.
            </p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ READOUTS ═════ */}
      <section className="readouts">
        <div className="readout-grid">
          <div className="readout">
            <span className="n sig">{accuracy}%</span>
            <span className="k">provisional accuracy</span>
            <span className="s">{evalReport.testCount} held-out samples</span>
          </div>
          <div className="readout">
            <span className="n">{LETTERS.length}</span>
            <span className="k">handshapes</span>
            <span className="s">J and Z need motion</span>
          </div>
          <div className="readout">
            <span className="n">{WEIGHTS_KB}</span>
            <span className="k">KB of weights</span>
            <span className="s">~4,200 parameters, committed</span>
          </div>
          <div className="readout">
            <span className="n ok">0</span>
            <span className="k">frames uploaded</span>
            <span className="s">one model fetch, then nothing</span>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════ THE EVAL ═════ */}
      <section className="band">
        <div className="shell">
          <div className="band-head">
            <p className="kicker">the number, with its caveat attached</p>
            <h2>{accuracy}% — and why that is not the ship bar.</h2>
          </div>

          {evalReport.provisional && (
            <div className="provisional-banner" role="alert" style={{ marginTop: "1.75rem", maxWidth: "50rem" }}>
              <strong>This number is provisional.</strong>{" "}
              {selfCollectedSignerCount === 0
                ? "Zero volunteer signers have been recorded yet"
                : `Only ${selfCollectedSignerCount} volunteer signer(s) recorded so far`}
              , so it comes from a{" "}
              {evalReport.splitMethod === "random-file-level"
                ? "random, file-level split of the training pool itself"
                : evalReport.splitMethod}
              , not the genuine held-out signer this project&apos;s own ship bar requires. Ship bar is ≥70%
              on a per-signer test set — <strong>{evalReport.shipBarMet ? "met" : "not met"}</strong>, for
              exactly that reason.
            </div>
          )}

          <p style={{ marginTop: "1.5rem", maxWidth: "44rem", color: "var(--color-ink-2)" }}>
            The full 24×24 confusion matrix and the per-letter precision/recall/F1 table come from this
            same run and are published in full on{" "}
            <Link href="/docs/concept" style={{ textDecorationLine: "underline" }}>
              Concept &amp; eval
            </Link>{" "}
            — not summarised in prose here.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ THE MECHANISM ════ */}
      <section className="band" data-tone="1">
        <div className="shell">
          <div className="band-head">
            <p className="kicker">no black box</p>
            <h2>Every prediction runs these seven steps, in your browser.</h2>
            <p>
              The page imports the same <code>normalize.ts</code> the trainer imports, so the model and the
              code running it cannot silently drift apart.
            </p>
          </div>

          <div className="panel" style={{ marginTop: "2rem", overflow: "hidden" }}>
            <div className="inst-bar">21 landmarks → 63-dim vector → MLP (63 · 48 · 24) → held letter</div>
            <div style={{ overflowX: "auto", padding: "1.5rem 1.25rem" }}>
              <div style={{ minWidth: "760px" }}>
                <MechanismDiagram />
              </div>
            </div>
          </div>

          <p style={{ marginTop: "1.25rem", maxWidth: "44rem", color: "var(--color-ink-3)", fontSize: "0.9rem" }}>
            MediaPipe&apos;s Hand Landmarker produces 21 raw points. They are mirrored to a canonical right
            hand, translated to the wrist, scaled by the wrist-to-knuckle distance and rotated to a fixed
            angle. The only network request this product makes is MediaPipe&apos;s one-time download.
          </p>
        </div>
      </section>

      {/* ══════════════════════════════════════════════ WHAT IT ISN'T ════ */}
      <section className="band">
        <div className="shell">
          <div className="band-head">
            <p className="kicker">stated up front</p>
            <h2>What it deliberately does not do.</h2>
          </div>

          <div
            style={{
              marginTop: "2rem",
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 17rem), 1fr))",
            }}
          >
            <article className="card">
              <h3>Translate or understand ASL</h3>
              <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "var(--color-ink-3)" }}>
                It matches a static handshape against a target letter. Nothing more.
              </p>
            </article>
            <article className="card">
              <h3>Offer J or Z</h3>
              <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "var(--color-ink-3)" }}>
                <code>{LETTERS.join(" ")}</code> — 24 classes. Both missing letters need traced motion a
                single held frame cannot see.
              </p>
            </article>
            <article className="card">
              <h3>Keep accounts or send analytics</h3>
              <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "var(--color-ink-3)" }}>
                Progress lives in your browser&apos;s <code>localStorage</code> and nowhere else.
              </p>
            </article>
            <article className="card">
              <h3>Call an LLM</h3>
              <p style={{ marginTop: "0.5rem", fontSize: "0.9rem", color: "var(--color-ink-3)" }}>
                The classifier is ~4,200 numbers, trained once and committed to the repo.
              </p>
            </article>
          </div>

          <p style={{ marginTop: "1.75rem", fontSize: "0.92rem", color: "var(--color-ink-2)" }}>
            Twelve named failure modes — no camera, GPU rejected, model fetch fails, low-confidence
            prediction, <code>localStorage</code> unavailable, and eight more — each with a stated contract
            instead of a silent broken state.{" "}
            <Link href="/docs/failure-modes" style={{ textDecorationLine: "underline" }}>
              The full table
            </Link>{" "}
            ·{" "}
            <Link href="/docs/limitations" style={{ textDecorationLine: "underline" }}>
              Limitations
            </Link>{" "}
            ·{" "}
            <a href="https://github.com/jamessuuu/swage" style={{ textDecorationLine: "underline" }}>
              Source
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}

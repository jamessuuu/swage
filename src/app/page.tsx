import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
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

export default function Home() {
  const selfCollectedSignerCount = Object.keys(splits.selfCollectedSigners).length;

  return (
    <main>
      <header className="hero">
        <div className="hero-mark">
          <Image src="/brand/glyph.svg" alt="" width={40} height={40} />
          <h1>swage</h1>
        </div>
        <p className="hero-claim">
          Show your hand to your webcam. swage names the ASL fingerspelling
          handshape it matches, graded live by a classifier this project
          trained and evaluated itself — on a device that never sends your
          camera feed anywhere.
        </p>
        <p className="honesty-line">
          This checks handshapes, not ASL. ASL is a full language with its
          own grammar and facial and body grammar this tool doesn&apos;t see.
        </p>
        <p className="hero-cta">
          <Link href="/practice">Start practicing →</Link>{" "}
          <Link href="/docs/quickstart">Quickstart</Link>
        </p>
      </header>

      <section>
        <h2>The mechanism, not a black box</h2>
        <p>
          Every prediction runs this exact seven-step pipeline, live, in your
          browser — the same <code>normalize.ts</code> code the trainer
          imports, so the model and the code running it cannot silently
          drift apart:
        </p>
        <MechanismDiagram />
        <p>
          21 raw hand landmarks from MediaPipe&apos;s Hand Landmarker become a
          63-dimensional vector (mirrored to a canonical right hand,
          translated, scaled, and rotated — see{" "}
          <Link href="/docs/concept">Concept &amp; eval</Link>), fed through a
          two-layer network of about 4,200 parameters. The whole thing is{" "}
          {WEIGHTS_KB}KB, committed to this repo as JSON and imported
          directly into the page — the only network request this product
          makes is MediaPipe&apos;s one-time download.
        </p>
      </section>

      <section>
        <h2>The eval, honestly</h2>
        {evalReport.provisional && (
          <p className="provisional-banner" role="alert">
            The number below is <strong>provisional</strong>.{" "}
            {selfCollectedSignerCount === 0
              ? "Zero volunteer signers have been recorded yet"
              : `Only ${selfCollectedSignerCount} volunteer signer(s) recorded so far`}
            , so it comes from a{" "}
            {evalReport.splitMethod === "random-file-level"
              ? "random, file-level split of the training pool itself"
              : evalReport.splitMethod}
            , not the genuine held-out signer this project&apos;s own ship bar
            requires. Full explanation on{" "}
            <Link href="/docs/limitations">Limitations</Link>.
          </p>
        )}
        <p>
          <strong>{(evalReport.overallAccuracy * 100).toFixed(1)}%</strong> on{" "}
          {evalReport.testCount} held-out samples. Ship bar is ≥70% on a
          genuine per-signer test set —{" "}
          <strong>
            {evalReport.shipBarMet ? "met" : "not met, for the reason above"}
          </strong>
          . The full 24×24 confusion matrix and per-letter precision/recall/
          F1 table, generated from this same run, are on{" "}
          <Link href="/docs/concept">Concept &amp; eval</Link> — not
          summarized in prose here, published in full there.
        </p>
      </section>

      <section>
        <h2>What this deliberately doesn&apos;t do</h2>
        <ul>
          <li>
            Doesn&apos;t claim to translate or understand ASL — it matches a
            static handshape against a target letter, nothing more.
          </li>
          <li>
            Doesn&apos;t offer J or Z — <code>{LETTERS.join(" ")}</code>, 24
            classes, because both require traced motion a single held frame
            cannot see.
          </li>
          <li>
            Doesn&apos;t have accounts, a server write path, or analytics —
            progress lives in your browser&apos;s <code>localStorage</code>{" "}
            and nowhere else.
          </li>
          <li>
            Doesn&apos;t call an LLM or any hosted model API — the classifier
            is ~4,200 numbers, trained once and committed.
          </li>
        </ul>
      </section>

      <section>
        <h2>Handled, not hidden</h2>
        <p>
          Twelve named failure modes, each with a stated contract instead of
          a silent broken state — no camera, GPU rejected, model fetch fails,
          low-confidence prediction, <code>localStorage</code> unavailable,
          and eight more. See{" "}
          <Link href="/docs/failure-modes">the full table</Link>.
        </p>
      </section>

      <section>
        <h2>Read more</h2>
        <ul>
          <li>
            <Link href="/docs/quickstart">Quickstart</Link> — practicing in
            under a minute.
          </li>
          <li>
            <Link href="/docs/concept">Concept &amp; eval</Link> — the
            pipeline, the split policy, the confusion matrix.
          </li>
          <li>
            <Link href="/docs/failure-modes">Failure modes</Link> — every
            named fault and its contract.
          </li>
          <li>
            <Link href="/docs/limitations">Limitations</Link> — what this
            tool honestly can&apos;t do, stated plainly.
          </li>
          <li>
            <a href="https://github.com/jamessuuu/swage">
              Source on GitHub
            </a>{" "}
            — every number above is generated from this repo.
          </li>
        </ul>
      </section>
    </main>
  );
}

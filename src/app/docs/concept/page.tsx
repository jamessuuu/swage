import type { Metadata } from "next";
import Link from "next/link";
import evalReport from "../../../../model/eval-report.json" with { type: "json" };
import splits from "../../../../data/splits.json" with { type: "json" };
import { MechanismDiagram } from "@/components/MechanismDiagram";
import { ConfusionMatrix } from "@/components/ConfusionMatrix";
import { LETTERS } from "@/lib/classifier";

export const metadata: Metadata = {
  title: "Concept & eval",
  description: "How the classifier works, and the real, published numbers behind it.",
};

export default function ConceptPage() {
  const selfCollectedSignerCount = Object.keys(splits.selfCollectedSigners).length;

  return (
    <>
      <h1>Concept &amp; eval</h1>

      {evalReport.provisional && (
        <p className="provisional-banner" role="alert">
          The numbers on this page are <strong>provisional</strong>. SPEC.md
          §3.2&apos;s real credibility bar — a genuine per-signer held-out
          test set — is not met yet:{" "}
          {selfCollectedSignerCount === 0
            ? "zero volunteer signers have been recorded"
            : `only ${selfCollectedSignerCount} volunteer signer(s) recorded`}
          . Recruiting consenting volunteers is a human task this build
          could not complete on its own. Full explanation on{" "}
          <Link href="/docs/limitations">Limitations</Link>.
        </p>
      )}

      <h2>The mechanism</h2>
      <p>
        Every prediction runs the same seven-step pipeline, live, in your
        browser — the exact code trainer and browser share (
        <code>src/lib/normalize.ts</code>) so they can never quietly drift
        apart:
      </p>
      <MechanismDiagram />
      <p>
        MediaPipe&apos;s Hand Landmarker outputs 21 (x, y, z) points per
        hand. A left hand is mirrored onto a canonical right hand, the
        wrist becomes the coordinate origin, the whole hand is scaled so
        the wrist-to-middle-knuckle distance is 1 (invariant to hand size
        and camera distance), and the hand is rotated so that same
        reference point lands at a fixed angle (invariant to how the hand
        is tilted in-plane — see{" "}
        <Link href="/docs/limitations">Limitations</Link> for what this
        does not correct). The resulting 63 numbers feed a tiny neural
        network — Dense(48, relu) then Dense(24, softmax), about 4,200
        parameters, &lt;50KB committed as JSON — that outputs a letter and a
        confidence. A held-stable prediction (SPEC.md §7.1: 6 of the last 8
        frames agreeing at ≥{evalReport.confidenceThreshold} confidence)
        fires once, shown in amber above.
      </p>

      <h2>Split policy</h2>
      <table>
        <thead>
          <tr>
            <th scope="col">Split</th>
            <th scope="col">Source</th>
            <th scope="col">Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>train</td>
            <td>asl-now community pool (MIT), J/Z folders excluded</td>
            <td>model fitting</td>
          </tr>
          <tr>
            <td>val</td>
            <td>1 self-collected signer, never in train</td>
            <td>threshold tuning, early stopping</td>
          </tr>
          <tr>
            <td>test</td>
            <td>1 different self-collected signer, never in train or val</td>
            <td>the published numbers, touched once</td>
          </tr>
        </tbody>
      </table>
      <p>
        That is the design. What this build actually has: the asl-now
        pool&apos;s own signer composition is unverified — no such field
        exists in that dataset, so it is used for training only, never for
        published val/test numbers (matches the design above). The
        self-collected val/test signers do not exist yet in this repo — see
        the provisional banner above. The numbers below come from a{" "}
        {evalReport.splitMethod === "random-file-level"
          ? "random, file-level split of the asl-now pool itself"
          : evalReport.splitMethod}
        , train={evalReport.trainCount} / val={evalReport.valCount} / test=
        {evalReport.testCount} samples — real numbers, honestly captioned,
        not the design&apos;s actual claim.
      </p>

      <h2>Per-letter precision / recall / F1</h2>
      <p>
        Test-set accuracy: <strong>{(evalReport.overallAccuracy * 100).toFixed(1)}%</strong>{" "}
        ({evalReport.testCount} samples). Ship bar is ≥70% on a genuine
        per-signer test set (SPEC.md §3.4) —{" "}
        <strong>{evalReport.shipBarMet ? "met" : "not met, because the split above is provisional"}</strong>.
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Letter</th>
            <th scope="col">Precision</th>
            <th scope="col">Recall</th>
            <th scope="col">F1</th>
            <th scope="col">Support</th>
          </tr>
        </thead>
        <tbody>
          {LETTERS.map((letter) => {
            const row = evalReport.perLetter[letter];
            return (
              <tr key={letter}>
                <td>{letter}</td>
                <td>{row.precision}</td>
                <td>{row.recall}</td>
                <td>{row.f1}</td>
                <td>{row.support}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h2>Confusion matrix</h2>
      <p>
        Rows are the true letter, columns the predicted letter. The
        diagonal (correct predictions) is shaded; off-diagonal cells above
        40% of this matrix&apos;s highest confusion count are highlighted in
        amber.
      </p>
      <ConfusionMatrix matrix={evalReport.confusionMatrix} />

      <h2>Most confused pairs</h2>
      <p>
        Ranked by raw confusion count in the matrix above — this is exactly
        what Drill mode&apos;s &quot;confusable&quot; bias draws from (
        <Link href="/practice">try it</Link>):
      </p>
      <ul>
        {evalReport.confusablePairs.map(([a, b]) => (
          <li key={`${a}-${b}`}>
            {a} → predicted as {b}
          </li>
        ))}
      </ul>

      <h2>No J, no Z — by design, not by omission</h2>
      <p>
        24 classes, not 26: <code>{LETTERS.join(" ")}</code>. Both excluded
        letters require traced motion a single held frame cannot see. More
        on <Link href="/docs/limitations">Limitations</Link>.
      </p>
    </>
  );
}

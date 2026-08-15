import type { Metadata } from "next";
import Link from "next/link";
import evalReport from "../../../../model/eval-report.json" with { type: "json" };

export const metadata: Metadata = {
  title: "Limitations",
  description: "Stated plainly, not glossed over.",
};

export default function LimitationsPage() {
  const m = evalReport.perLetter.M;
  const n = evalReport.perLetter.N;
  const s = evalReport.perLetter.S;
  const t = evalReport.perLetter.T;

  return (
    <>
      <h1>Limitations</h1>
      <p className="honesty-line">
        This checks handshapes, not ASL. ASL is a full language with its own
        grammar and facial and body grammar this tool doesn&apos;t see — no
        facial expression, no mouth morpheme, no body shift, none of it.
        &quot;Handshape match&quot; is the only claim this tool makes.
      </p>

      <h2>The published eval does not meet this project&apos;s own ship bar yet</h2>
      <p>
        This is the limitation that matters most, so it leads. The model
        currently shipped was evaluated against a{" "}
        <strong>{evalReport.splitMethod === "random-file-level"
          ? "random, file-level split of a single-source community dataset"
          : evalReport.splitMethod}</strong>
        , not a genuine held-out signer.{" "}
        {evalReport.provisional && "provisionalReason" in evalReport
          ? (evalReport as { provisionalReason: string }).provisionalReason
          : ""}
      </p>
      <p>
        Concretely: the {(evalReport.overallAccuracy * 100).toFixed(1)}%
        figure on the <Link href="/docs/concept">concept page</Link> almost
        certainly overstates real accuracy on a genuinely new signer, because
        a file-level split lets near-duplicate samples from the same
        capture session leak between training and test data. Recruiting and
        recording consenting volunteer signers — the fix — is a human task,
        not something this build could complete on its own. Ship-bar status:{" "}
        <strong>{evalReport.shipBarMet ? "met" : "not met"}</strong>.
      </p>

      <h2>24 letters, not 26</h2>
      <p>
        J and Z are structurally absent, not missing by oversight. Both
        require traced motion — a single held frame cannot show a
        trajectory. A classifier built on one static image per prediction
        has no way to distinguish J from I, or Z from nothing at all,
        without motion data this project does not capture.
      </p>

      <h2>M, N, S, and T are genuinely hard to tell apart</h2>
      <p>
        These four are closed-fist handshapes differing mainly in thumb
        position — genuinely confusable even for people, not just this
        model. The real, measured numbers from this build&apos;s own eval:
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">Letter</th>
            <th scope="col">Precision</th>
            <th scope="col">Recall</th>
            <th scope="col">F1</th>
            <th scope="col">Test samples</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>M</td><td>{m.precision}</td><td>{m.recall}</td><td>{m.f1}</td><td>{m.support}</td></tr>
          <tr><td>N</td><td>{n.precision}</td><td>{n.recall}</td><td>{n.f1}</td><td>{n.support}</td></tr>
          <tr><td>S</td><td>{s.precision}</td><td>{s.recall}</td><td>{s.f1}</td><td>{s.support}</td></tr>
          <tr><td>T</td><td>{t.precision}</td><td>{t.recall}</td><td>{t.f1}</td><td>{t.support}</td></tr>
        </tbody>
      </table>
      <p>
        The Drill mode&apos;s &quot;confusable&quot; bias exists specifically
        because of families like this one — see{" "}
        <Link href="/docs/concept">the full confusion matrix</Link>.
      </p>

      <h2>The training pool&apos;s signer composition is unverified</h2>
      <p>
        The <code>sid220/asl-now-fingerspelling</code> community dataset
        that supplies this project&apos;s training data has no
        signer/participant field at all — it cannot be checked for how many
        distinct people contributed, or how evenly. It is used for training
        only, never for the published test numbers, for exactly this
        reason.
      </p>

      <h2>Rotation correction is in-plane only</h2>
      <p>
        <code>normalize.ts</code> corrects 2D (in-plane) rotation — a hand
        tilted sideways in the camera&apos;s view gets straightened out.
        MediaPipe&apos;s <code>z</code> coordinate is relative depth, not a
        metric measurement, so true out-of-plane rotation (the hand turned
        toward or away from the camera) is not corrected. A handshape held
        at a steep angle to the camera is more likely to be misread.
      </p>

      <h2>The camera-graded loop is not usable by a blind or low-vision visitor</h2>
      <p>
        This is a genuine, stated accessibility limit, not a performed one:
        there is no technical substitute for &quot;does your hand visually
        match this shape,&quot; and this project does not have one. The
        flashcard mode (camera denied or absent) is offered as the
        accessible path for keyboard/no-camera users —{" "}
        <strong>not</strong> as a solution for visually-impaired users,
        because it is not one. It still requires seeing the reference
        description and confirming a shape was made by sight.
      </p>

      <h2>Every network request this product makes</h2>
      <p>
        A cold visit fetches MediaPipe&apos;s WASM runtime
        (~3.2MB, cdn.jsdelivr.net) and hand-tracking model
        (~7.5–8MB, storage.googleapis.com) — real, visible requests, named
        here rather than hidden. Once that one-time load finishes, no
        further request happens during live classification: your camera
        feed and hand landmarks never leave your device. See{" "}
        <Link href="/docs/concept">Concept &amp; eval</Link> for the exact
        claim and what would make it false.
      </p>
    </>
  );
}

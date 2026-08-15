import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Quickstart",
  description: "Start practicing ASL fingerspelling handshapes in under a minute.",
};

export default function QuickstartPage() {
  return (
    <>
      <h1>Quickstart</h1>
      <p className="honesty-line">
        This checks handshapes, not ASL. ASL is a full language with its own
        grammar and facial and body grammar this tool doesn&apos;t see.
      </p>

      <h2>1. Open Practice</h2>
      <p>
        Go to <Link href="/practice">/practice</Link> and select{" "}
        <strong>Start camera</strong>. Your browser will ask for camera
        permission — nothing you allow here leaves your device (see{" "}
        <Link href="/docs/concept">Concept &amp; eval</Link> for exactly what
        that claim does and doesn&apos;t cover).
      </p>

      <h2>2. Show the target letter</h2>
      <p>
        The page names a letter (&quot;Show me: A&quot;) and gives a short
        text description of the standard handshape. Hold your hand up in
        frame, form the shape, and hold it steady for under a second.
      </p>

      <h2>3. Get graded live</h2>
      <p>
        Once the classifier holds on a stable reading, it either advances
        automatically (correct) or asks you to try again, naming the letter
        you actually held and — if it&apos;s a letter commonly confused with
        the target — saying so plainly.
      </p>

      <h2>4. No camera? No problem</h2>
      <p>
        If camera access is denied or your device has no camera, the same
        letters and hints are available as a keyboard-operable flashcard
        loop — no grading, but the same reference material.
      </p>

      <h2>What&apos;s next</h2>
      <p>
        A full free-practice session runs all 24 letters once, shuffled.
        Finish one and you can start a <strong>Drill</strong> instead —
        weighted toward the letters this project&apos;s own published eval
        says are most confusable, or toward your own weakest letters so far.
        See <Link href="/docs/concept">how the eval actually works</Link>,{" "}
        <Link href="/docs/failure-modes">what happens when something goes
        wrong</Link>, or <Link href="/docs/limitations">what this tool
        honestly can&apos;t do</Link>.
      </p>
    </>
  );
}

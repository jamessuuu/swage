import Link from "next/link";

/**
 * M0/M1 stub landing page. The real hero (evidence-dense, per
 * showcase-program/DESIGN-DIRECTION.md), mechanism diagram, and full
 * honesty-surface placement land at M8 — but SPEC.md §7.3 makes the
 * honesty line non-negotiable from the start, so it is here now rather
 * than arriving late as a "polish" item.
 */
export default function Home() {
  return (
    <main>
      <h1>swage</h1>
      <p>
        Real-time ASL fingerspelling handshape practice, graded by a
        classifier trained and evaluated as part of this project — on a
        device that never sends your camera feed anywhere.
      </p>
      <p className="honesty-line">
        This checks handshapes, not ASL. ASL is a full language with its own
        grammar and facial and body grammar this tool doesn&apos;t see.
      </p>
      <p>
        <Link href="/practice">Start practicing →</Link>
      </p>
    </main>
  );
}

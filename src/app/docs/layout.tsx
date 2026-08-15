import Link from "next/link";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="docs">
      <nav className="docs-nav" aria-label="Documentation">
        <Link href="/docs/quickstart">Quickstart</Link>
        <Link href="/docs/concept">Concept &amp; eval</Link>
        <Link href="/docs/failure-modes">Failure modes</Link>
        <Link href="/docs/limitations">Limitations</Link>
        <Link href="/practice">← Back to practice</Link>
      </nav>
      {children}
    </main>
  );
}

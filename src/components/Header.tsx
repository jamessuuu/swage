import Image from "next/image";
import Link from "next/link";

/**
 * Site chrome. Added 2026-09-07: the app previously had a footer and no
 * header, so /practice and the four docs pages were reachable only from
 * links inside the landing page's prose. A product surface names itself and
 * shows its own routes on every page.
 *
 * Server-rendered, no client JS — it renders identically with JavaScript off,
 * which is the same bar the rest of this app holds itself to.
 */
export function Header() {
  return (
    <header className="topbar">
      <div className="shell topbar-in">
        <Link href="/" className="wordmark">
          <Image src="/brand/glyph-inv.svg" alt="swage" width={26} height={26} priority />
          swage
        </Link>
        <span className="chip">handshape practice</span>
        <nav aria-label="primary" className="topnav">
          <Link href="/practice">practice</Link>
          <Link href="/docs/concept">concept</Link>
          <Link href="/docs/limitations">limits</Link>
          <Link href="/docs/quickstart">quickstart</Link>
        </nav>
      </div>
    </header>
  );
}

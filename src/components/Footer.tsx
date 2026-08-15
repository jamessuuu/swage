import Image from "next/image";

/**
 * showcase-program/BRAND-KIT.md: "Site footer on every page — chip mark +
 * 'Built by James Lorenz Santos' + link to agentjames.vercel.app + link to
 * the GitHub repo." No hire-me CTA (PROGRAM.md D1) — this is identity, not
 * advertising.
 *
 * The repo link points at the spec-defined public identity
 * (docs/SPEC.md's own header: "GitHub jamessuuu/swage (public…)") — not
 * yet live, since this build makes local commits only (no git push, no
 * new remotes, per this agent's hard scope rules). The URL is correct for
 * where this project is headed, not a claim that it resolves today.
 */
export function Footer() {
  return (
    <footer className="site-footer">
      <a href="https://agentjames.vercel.app" className="footer-mark" aria-label="Agent James portfolio">
        <Image src="/brand/mark.svg" alt="" width={20} height={20} />
        Built by James Lorenz Santos
      </a>
      <nav aria-label="Footer links">
        <a href="https://agentjames.vercel.app">agentjames.vercel.app</a>
        <a href="https://github.com/jamessuuu/swage">Source on GitHub</a>
      </nav>
    </footer>
  );
}

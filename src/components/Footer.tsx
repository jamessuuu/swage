import { Attribution } from "./Attribution";

/**
 * showcase-program/BRAND-KIT.md: "Site footer on every page — chip mark +
 * 'Built by James Lorenz Santos' + link to agentjames.vercel.app + link to
 * the GitHub repo." No hire-me CTA (PROGRAM.md D1) — this is identity, not
 * advertising.
 *
 * The maker line is the shared attribution kit (attribution-kit v1): the chip mark
 * inline in currentColor, the portfolio and LinkedIn links with rel="me".
 * The repo link points at the spec-defined public identity (docs/SPEC.md's
 * own header: "GitHub jamessuuu/swage").
 */
export function Footer() {
  return (
    <footer className="site-footer">
      <Attribution />
      <nav aria-label="Footer links">
        <a href="https://github.com/jamessuuu/swage">Source on GitHub</a>
      </nav>
    </footer>
  );
}

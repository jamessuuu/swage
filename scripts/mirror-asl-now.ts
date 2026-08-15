/**
 * mirror-asl-now.ts — SPEC.md §3.1: mirrors the needed files of
 * `sid220/asl-now-fingerspelling` (Hugging Face, MIT licence — verified
 * live, see data/ATTRIBUTION.md) into data/asl-now/, once, at build time.
 * MIT permits redistribution, which is exactly why this project commits
 * the mirror instead of fetching it live at train time.
 *
 * Only the 24 letters this project's label set actually uses are copied
 * (SPEC.md §3.4 excludes J and Z structurally — both require traced motion
 * a single-frame classifier cannot see). J/ and Z/ exist in the upstream
 * dataset and are deliberately left unmirrored.
 *
 * Implementation: a shallow `git clone` of the HF dataset repo into a temp
 * directory, rather than paginating the HF listing API and issuing ~1,900
 * individual HTTPS GETs — empirically ~2.5s for the whole 2,122-file
 * dataset (HF dataset repos are plain git repos over the git protocol) vs.
 * an unmeasured but certainly much slower one-file-at-a-time fetch loop,
 * and it sidesteps the exact truncated-listing problem SPEC.md §12 open
 * question 3 already ran into once with the plain REST API.
 *
 * Usage: pnpm exec tsx scripts/mirror-asl-now.ts
 * Requires: git, network access to huggingface.co.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, cpSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REPO_URL = "https://huggingface.co/datasets/sid220/asl-now-fingerspelling";

// SPEC.md §3.4's 24-class label set, alphabetical (no J, no Z).
const LETTERS = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "K", "L", "M", "N", "O", "P",
  "Q", "R", "S", "T", "U", "V", "W", "X", "Y",
];

function main(): void {
  const repoRoot = join(import.meta.dirname, "..");
  const destRoot = join(repoRoot, "data", "asl-now");
  const tmp = mkdtempSync(join(tmpdir(), "swage-aslnow-"));

  console.log(`cloning ${REPO_URL} -> ${tmp} ...`);
  execFileSync("git", ["clone", "--depth", "1", REPO_URL, tmp], { stdio: "inherit" });

  let copied = 0;
  for (const letter of LETTERS) {
    const src = join(tmp, letter);
    const dest = join(destRoot, letter);
    if (!existsSync(src)) {
      throw new Error(`expected letter folder missing from clone: ${letter}`);
    }
    rmSync(dest, { recursive: true, force: true });
    mkdirSync(dest, { recursive: true });
    cpSync(src, dest, { recursive: true });
    const n = readdirSync(dest).length;
    copied += n;
    console.log(`  ${letter}: ${n} files`);
  }

  rmSync(tmp, { recursive: true, force: true });
  console.log(`done — ${copied} files mirrored across ${LETTERS.length} letters into ${destRoot}`);
}

main();

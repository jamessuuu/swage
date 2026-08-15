import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

// This tool's index.html imports straight from ../../src/lib/* (SPEC.md
// §3.1: "reuses src/lib/* — same pipeline as production"), which lives
// outside this directory — Vite's dev server blocks filesystem reads
// outside `root` by default, so the repo root has to be added explicitly.
const here = fileURLToPath(new URL(".", import.meta.url));
const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root: here,
  server: {
    fs: { allow: [repoRoot] },
    // Vite's default host binds ::1 (IPv6) only on this machine, which
    // playwright.config.ts's explicit 127.0.0.1 URLs (chosen for the same
    // reason as its allowedDevOrigins comment on next.config.ts) cannot
    // reach — verified empirically (curl 127.0.0.1 refused, curl localhost
    // 200, netstat showed only ::1 listening).
    host: "127.0.0.1",
  },
});

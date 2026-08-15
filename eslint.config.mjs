import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // SPEC.md §11: "no `as any` at a boundary". Enforced repo-wide, not just
    // at boundaries, since a stray `any` anywhere defeats noUncheckedIndexedAccess.
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // data/asl-now/*.json are mirrored dataset rows (SPEC.md §3.1/§2), not
    // source — never hand-edited, never linted.
    ignores: ["data/asl-now/**", "model/*.json"],
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Playwright's HTML report and raw test-results embed a minified,
    // bundled report-viewer app — caught this the hard way: eslint tried
    // to apply react-hooks/rules-of-hooks to a single-line minified bundle
    // (3,031 problems) the first time this wasn't ignored.
    "playwright-report/**",
    "test-results/**",
    "blob-report/**",
    "coverage/**",
  ]),
]);

export default eslintConfig;

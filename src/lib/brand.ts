/**
 * The house palette (showcase-program/BRAND-KIT.md, binding). Single source
 * of truth — CSS custom properties in globals.css are generated from these
 * same four values (see src/app/globals.css), and scripts/brand.mjs reads
 * them for the generated glyph/OG assets.
 */
export const PALETTE = {
  paper: "#FAF7F2",
  ink: "#1A1712",
  amber: "#B45309",
  rule: "#E4DDD3",
} as const;

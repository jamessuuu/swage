/**
 * handshapeHints.ts — short, plain-text descriptions of each letter's
 * standard ASL manual-alphabet handshape, shown as the practice target's
 * "reference" (SPEC.md §9: "Each letter shows a reference diagram + 'Show
 * me: <letter>'").
 *
 * Text, not an illustration: SPEC.md's non-negotiable honesty surface
 * (§7.3) makes accuracy a first-class requirement for this whole project,
 * and a wrong or ambiguous hand-drawn reference diagram would actively
 * mis-teach the one thing this tool exists to teach — a risk not worth
 * taking without either a properly licensed reference image set or an
 * illustrator's review, neither available in this build. Every
 * description below is the standard, widely-documented ASL fingerspelling
 * handshape for that letter. Revisit with real diagrams at a future
 * content pass, not fabricated here.
 */
import type { Letter } from "./classifier";

export const HANDSHAPE_HINTS: Record<Letter, string> = {
  A: "Closed fist, thumb resting alongside the fingers.",
  B: "Flat hand, four fingers together pointing up, thumb folded across the palm.",
  C: "Fingers and thumb curved together into a C shape.",
  D: "Index finger points up; thumb touches the middle finger, other fingers curl in.",
  E: "Fingertips curl down to touch the thumb, like a closed claw.",
  F: "Thumb and index finger touch in a circle; the other three fingers point up.",
  G: "Index finger and thumb extended sideways, pointing to the side, like a small pinch.",
  H: "Index and middle finger extended together, pointing sideways.",
  I: "Pinky finger up, other fingers folded into the fist, thumb across.",
  K: "Index and middle finger up in a V, thumb touching the middle finger's base.",
  L: "Index finger up, thumb out to the side, forming an L.",
  M: "Thumb tucked under the index, middle, and ring fingers.",
  N: "Thumb tucked under the index and middle fingers.",
  O: "Fingers and thumb curved together to form an O.",
  P: "Like K, but pointing downward.",
  Q: "Like G, but pointing downward.",
  R: "Index and middle finger crossed.",
  S: "Closed fist, thumb across the front of the fingers.",
  T: "Closed fist, thumb tucked between the index and middle finger.",
  U: "Index and middle finger up together, pointing up.",
  V: "Index and middle finger up, spread apart in a V.",
  W: "Index, middle, and ring finger up, spread apart.",
  X: "Index finger bent into a hook; other fingers closed.",
  Y: "Thumb and pinky extended out to the sides, other fingers folded.",
};

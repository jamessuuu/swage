import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Failure modes",
  description: "Every named failure mode this project handles, and exactly how.",
};

interface FailureMode {
  id: string;
  fault: string;
  contract: string;
}

// SPEC.md §6 — the failure-contract table this page renders. Kept as data
// here so its text can never quietly drift from what SPEC.md says without
// someone noticing the diff.
const FAILURE_MODES: FailureMode[] = [
  {
    id: "F1",
    fault: "Camera permission denied",
    contract:
      'Non-camera flashcard mode: reference diagram + text description + manual "I made this shape" advance, keyboard-operable. No dead end.',
  },
  {
    id: "F2",
    fault: "No camera hardware",
    contract: "Same fallback as F1, distinct copy naming the actual cause.",
  },
  {
    id: "F3",
    fault: "GPU (WebGL2) delegate rejected, including no WebGL at all",
    contract:
      "MediaPipe's CPU delegate is pure WASM and needs no WebGL, so these are one branch, not two rungs. Catch the rejection, retry delegate:'CPU'. Label: \"Running on CPU — same result, about 15 frames a second instead of 35.\" Never \"reduced accuracy\" (it isn't), never \"identical\" (frame rate visibly differs).",
  },
  {
    id: "F4",
    fault: "Model fetch fails mid-load",
    contract: "Loud on-page error + retry, never a stuck spinner. Flashcard mode needs no model and stays available.",
  },
  {
    id: "F5",
    fault: "Cache bug — .task re-downloads every visit (GCS caps freshness at max-age=3600)",
    contract:
      "Fixed at the fetch layer: manual fetch() + caches.open()/.put(), pass the ArrayBuffer via modelAssetBuffer, not modelAssetPath. Verified by a second-visit network capture showing ~0 model bytes.",
  },
  {
    id: "F6",
    fault: "Two hands in frame with numHands:1",
    contract: "MediaPipe may flicker its choice. Absorbed by the stability window; copy asks for one hand.",
  },
  {
    id: "F7",
    fault: "Low-confidence prediction",
    contract: "A tick's effective label is null below threshold — never silently guesses.",
  },
  {
    id: "F8",
    fault: "Hand exits frame mid-hold",
    contract: "reset() — a gap always breaks a streak. No partial credit across a gap.",
  },
  {
    id: "F9",
    fault: "prefers-reduced-motion",
    contract: "Feedback becomes an instant static state change. No autoplaying motion.",
  },
  {
    id: "F10",
    fault: "localStorage unavailable",
    contract: "Practice works in-session; UI says progress will not persist. Never throws.",
  },
  {
    id: "F11",
    fault: "Classifier wrong on a genuinely confusable letter",
    contract:
      'Not a bug. Normal miss; hint references the published confusion pair ("commonly mixed up with M — check thumb position"), never phrased as the user being wrong.',
  },
  {
    id: "F12",
    fault: "J or Z requested",
    contract: "Structurally impossible — never offered. /docs/limitations states why.",
  },
];

export default function FailureModesPage() {
  return (
    <>
      <h1>Failure modes</h1>
      <p>
        Every fault this project has a named, deliberate answer for — not a
        promise nothing ever goes wrong, a record of what happens when it
        does.
      </p>
      <table>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col">Fault</th>
            <th scope="col">Contract</th>
          </tr>
        </thead>
        <tbody>
          {FAILURE_MODES.map((f) => (
            <tr key={f.id}>
              <td>{f.id}</td>
              <td>{f.fault}</td>
              <td>{f.contract}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

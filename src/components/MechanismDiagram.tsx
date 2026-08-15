/**
 * The one diagram this project's mechanism actually needs (SPEC.md M8):
 * raw landmarks -> mirror -> translate -> scale -> rotate -> 63-dim ->
 * MLP -> letter, one amber accent on the "held" moment — the same
 * ink-strokes-on-paper house line language as the brand glyphs
 * (scripts/brand.mjs), generated inline rather than as a raster so it
 * stays crisp and text-searchable.
 */
const STAGES = [
  "21 raw landmarks",
  "mirror (L→R)",
  "translate",
  "scale",
  "rotate",
  "63-dim vector",
  "MLP (48 hidden)",
];

const BOX_W = 108;
const BOX_H = 44;
const GAP = 28;
const H = 90;

export function MechanismDiagram() {
  const stageCount = STAGES.length + 1; // + the final "letter" box
  const width = stageCount * BOX_W + (stageCount - 1) * GAP + 4;

  return (
    <svg
      viewBox={`0 0 ${width} ${H}`}
      role="img"
      aria-label="Pipeline: 21 raw landmarks, mirrored if left-handed, translated, scaled, rotated, flattened to a 63-dimensional vector, run through a small MLP, producing a held letter."
      style={{ width: "100%", height: "auto" }}
    >
      <title>normalize.ts + classifier.ts pipeline</title>
      <desc>
        Twenty-one raw hand landmarks are mirrored to a canonical right
        hand, translated so the wrist is the origin, scaled by the
        wrist-to-middle-knuckle distance, and rotated to a fixed angle,
        producing a 63-dimensional vector. A small MLP (63 to 48 to 24)
        turns that vector into a letter, shown in amber once the
        prediction is held stable.
      </desc>
      {STAGES.map((label, i) => {
        const x = i * (BOX_W + GAP) + 2;
        const y = H / 2 - BOX_H / 2;
        return (
          <g key={label}>
            <rect
              x={x}
              y={y}
              width={BOX_W}
              height={BOX_H}
              fill="none"
              stroke="var(--color-ink)"
              strokeWidth={2}
            />
            <text
              x={x + BOX_W / 2}
              y={H / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={11}
              fill="var(--color-ink)"
            >
              {label}
            </text>
            {i < STAGES.length && (
              <path
                d={`M${x + BOX_W} ${H / 2} h${GAP}`}
                stroke="var(--color-ink)"
                strokeWidth={2}
                markerEnd="url(#swage-arrow)"
              />
            )}
          </g>
        );
      })}
      {/* the held-letter box — the one amber accent, where the shape resolves true */}
      {(() => {
        const i = STAGES.length;
        const x = i * (BOX_W + GAP) + 2;
        const y = H / 2 - BOX_H / 2;
        return (
          <g>
            <path
              d={`M${x - GAP} ${H / 2} h${GAP}`}
              stroke="var(--color-ink)"
              strokeWidth={2}
              markerEnd="url(#swage-arrow)"
            />
            <rect x={x} y={y} width={BOX_W} height={BOX_H} fill="var(--color-amber)" />
            <text
              x={x + BOX_W / 2}
              y={H / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={12}
              fontWeight="bold"
              fill="var(--color-paper)"
            >
              held letter
            </text>
          </g>
        );
      })()}
      <defs>
        <marker id="swage-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
          <path d="M0 0 L8 4 L0 8 Z" fill="var(--color-ink)" />
        </marker>
      </defs>
    </svg>
  );
}

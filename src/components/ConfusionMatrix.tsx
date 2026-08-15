import { LETTERS } from "@/lib/classifier";

/**
 * The full 24x24 confusion matrix, rendered from model/eval-report.json —
 * SPEC.md §3.5: "carries the full 24x24 confusion matrix… generated from
 * the actual test-signer run, not asserted in prose." Rows are the true
 * letter, columns the predicted letter.
 */
export function ConfusionMatrix({ matrix }: { matrix: number[][] }) {
  const max = Math.max(...matrix.flat().map((v, i) => (i % LETTERS.length === Math.floor(i / LETTERS.length) ? 0 : v)));

  return (
    <div className="confusion-matrix-wrap">
      <table className="confusion-matrix">
        <caption className="visually-hidden">
          Confusion matrix: rows are the true letter, columns the predicted letter.
        </caption>
        <thead>
          <tr>
            <th scope="col" aria-label="true letter \ predicted letter">
              ↓true \ pred→
            </th>
            {LETTERS.map((l) => (
              <th scope="col" key={l}>
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {LETTERS.map((rowLetter, r) => (
            <tr key={rowLetter}>
              <th scope="row">{rowLetter}</th>
              {LETTERS.map((colLetter, c) => {
                const value = matrix[r]?.[c] ?? 0;
                const isDiag = r === c;
                const isHot = !isDiag && max > 0 && value / max > 0.4;
                return (
                  <td
                    key={colLetter}
                    className={isDiag ? "diag" : isHot ? "hot" : undefined}
                    title={`true ${rowLetter}, predicted ${colLetter}: ${value}`}
                  >
                    {value || ""}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

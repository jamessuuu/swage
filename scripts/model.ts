/**
 * model.ts — the architecture (SPEC.md §3.4): 63 -> Dense(48, relu) ->
 * Dense(24, softmax), ~4,200 parameters. Used only at build time by
 * scripts/train.ts; never shipped to the browser (src/lib/classifier.ts's
 * forward pass is hand-rolled arithmetic, no tfjs in the bundle).
 */
import * as tf from "@tensorflow/tfjs";
import { LETTERS, type Letter } from "../src/lib/classifier";
import { VECTOR_LENGTH } from "../src/lib/normalize";

export const HIDDEN_UNITS = 48;
export const INPUT_DIM = VECTOR_LENGTH; // 63
export const OUTPUT_CLASSES = LETTERS.length; // 24

/**
 * Fixed seed for reproducibility (SPEC.md §3.4: "tfjs-WASM, fixed seed").
 * Seeds both Dense layers' kernel initializers. Documented limitation,
 * same one SPEC.md §3.4 itself names for why CI never retrains: tfjs/WASM
 * floating-point ops are not guaranteed bit-identical across machines, so
 * this buys same-machine reproducibility, not a cross-platform guarantee.
 */
export const FIXED_SEED = 20260809;

export function createModel(): tf.Sequential {
  const model = tf.sequential();
  model.add(
    tf.layers.dense({
      units: HIDDEN_UNITS,
      activation: "relu",
      inputShape: [INPUT_DIM],
      kernelInitializer: tf.initializers.glorotUniform({ seed: FIXED_SEED }),
      biasInitializer: "zeros",
    }),
  );
  model.add(
    tf.layers.dense({
      units: OUTPUT_CLASSES,
      activation: "softmax",
      kernelInitializer: tf.initializers.glorotUniform({ seed: FIXED_SEED + 1 }),
      biasInitializer: "zeros",
    }),
  );
  model.compile({
    optimizer: tf.train.adam(0.01),
    loss: "categoricalCrossentropy",
    metrics: ["accuracy"],
  });
  return model;
}

export interface WeightsFile {
  version: 1;
  letters: readonly Letter[];
  layer1: { weights: number[][]; bias: number[] }; // [INPUT_DIM][HIDDEN_UNITS]
  layer2: { weights: number[][]; bias: number[] }; // [HIDDEN_UNITS][OUTPUT_CLASSES]
}

function round(n: number, digits = 6): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/** Extracts a tfjs model's weights into the plain-JSON shape
 * src/lib/classifier.ts's hand-rolled forward pass reads directly (M4). */
export async function extractWeights(model: tf.Sequential): Promise<WeightsFile> {
  const [k1, b1, k2, b2] = model.getWeights();
  if (!k1 || !b1 || !k2 || !b2) {
    throw new Error("model does not have the expected 4 weight tensors (2 Dense layers)");
  }
  const [k1Data, b1Data, k2Data, b2Data] = await Promise.all([
    k1.array() as Promise<number[][]>,
    b1.array() as Promise<number[]>,
    k2.array() as Promise<number[][]>,
    b2.array() as Promise<number[]>,
  ]);
  return {
    version: 1,
    letters: LETTERS,
    layer1: {
      weights: k1Data.map((row) => row.map((v) => round(v))),
      bias: b1Data.map((v) => round(v)),
    },
    layer2: {
      weights: k2Data.map((row) => row.map((v) => round(v))),
      bias: b2Data.map((v) => round(v)),
    },
  };
}

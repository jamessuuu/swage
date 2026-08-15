import { describe, expect, it, beforeAll } from "vitest";
import * as tf from "@tensorflow/tfjs"; // bundles and registers the "cpu" backend itself
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { classify, LETTERS } from "./classifier";
import { normalizeLandmarks, type RawLandmark } from "./normalize";
import { createModel } from "../../scripts/model";

/**
 * Parity test (SPEC.md §4, §8.1): classifier.ts's hand-rolled forward pass
 * must agree with tfjs's own predict() on the exact same committed
 * weights, so the model and the code that runs it cannot silently drift.
 * This is the ONE test in the repo allowed to import scripts/model.ts (a
 * build-time, tfjs-dependent module) from src/lib — test files are never
 * shipped to the browser, unlike classifier.ts itself, which deliberately
 * has zero import relationship with scripts/ (see classifier.ts's header).
 */

function seededVec(seed: number): Float32Array {
  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Float32Array.from({ length: 63 }, () => rand() * 2 - 1);
}

function loadRealSample(letter: string): Float32Array {
  const dir = join(import.meta.dirname, "..", "..", "data", "asl-now", letter);
  const files = existsSync(dir) ? readdirSync(dir) : [];
  const file = files.find((f: string) => f.endsWith(".json"));
  if (!file) throw new Error(`no fixture available for letter ${letter}`);
  const landmarks = JSON.parse(readFileSync(join(dir, file), "utf8")) as RawLandmark[];
  return normalizeLandmarks(landmarks, "Right");
}

describe("classifier.ts parity with tfjs predict()", () => {
  let tfModel: tf.Sequential;

  beforeAll(async () => {
    await tf.setBackend("cpu");
    await tf.ready();
    tfModel = createModel();
    const weights = JSON.parse(
      readFileSync(join(import.meta.dirname, "..", "..", "model", "weights.json"), "utf8"),
    ) as {
      layer1: { weights: number[][]; bias: number[] };
      layer2: { weights: number[][]; bias: number[] };
    };
    tfModel.setWeights([
      tf.tensor2d(weights.layer1.weights),
      tf.tensor1d(weights.layer1.bias),
      tf.tensor2d(weights.layer2.weights),
      tf.tensor1d(weights.layer2.bias),
    ]);
  });

  async function tfPredict(vec: Float32Array): Promise<number[]> {
    const input = tf.tensor2d([Array.from(vec)]);
    const output = tfModel.predict(input) as tf.Tensor2D;
    const result = (await output.array())[0] as number[];
    input.dispose();
    output.dispose();
    return result;
  }

  it("agrees with tfjs on 10 seeded synthetic vectors (distribution close, argmax exact)", async () => {
    for (let seed = 1; seed <= 10; seed++) {
      const vec = seededVec(seed);
      const handRolled = classify(vec);
      const tfDist = await tfPredict(vec);

      const tfArgmax = tfDist.indexOf(Math.max(...tfDist));
      expect(LETTERS.indexOf(handRolled.letter)).toBe(tfArgmax);

      for (let i = 0; i < LETTERS.length; i++) {
        expect(handRolled.distribution[i]).toBeCloseTo(tfDist[i] as number, 5);
      }
    }
  });

  it("agrees with tfjs on real, normalized asl-now samples", async () => {
    for (const letter of ["A", "B", "M", "S"]) {
      const vec = loadRealSample(letter);
      const handRolled = classify(vec);
      const tfDist = await tfPredict(vec);
      const tfArgmax = tfDist.indexOf(Math.max(...tfDist));
      expect(LETTERS.indexOf(handRolled.letter)).toBe(tfArgmax);
      expect(handRolled.confidence).toBeCloseTo(Math.max(...tfDist), 5);
    }
  });

  it("distribution always sums to ~1 (a real softmax, not an arbitrary score)", () => {
    const vec = seededVec(99);
    const { distribution } = classify(vec);
    const sum = Array.from(distribution).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 5);
  });
});

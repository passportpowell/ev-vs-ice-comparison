// Server-side ONNX inference for the synthetic charger-connector CNN.
// The PyTorch model is exported to ONNX during the data:build step
// (pipeline/ev_ice_pipeline/cv.py) and lives at public/models/.
//
// The session is created lazily and cached at module scope so subsequent
// requests pay no startup cost.

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import * as ort from "onnxruntime-node";
import { PNG } from "pngjs";

const MODEL_PATH = resolve(process.cwd(), "public/models/connector-classifier.onnx");

export const CONNECTOR_CLASSES = [
  "Type 2 AC",
  "CCS Combo",
  "CHAdeMO",
  "Tesla NACS",
  "Domestic 3-pin",
] as const;

const IMG_SIZE = 64;

let sessionPromise: Promise<ort.InferenceSession> | null = null;

async function getSession(): Promise<ort.InferenceSession> {
  if (!sessionPromise) {
    sessionPromise = ort.InferenceSession.create(MODEL_PATH, {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
    });
  }
  return sessionPromise;
}

function decodePng(buffer: Buffer): { width: number; height: number; data: Buffer } {
  return PNG.sync.read(buffer);
}

function nearestNeighbourResize(
  src: { width: number; height: number; data: Buffer },
  targetSize: number
): Float32Array {
  // The ONNX model expects (1, 3, IMG_SIZE, IMG_SIZE) RGB float in [0, 1].
  // Nearest-neighbour is fine here because the synthetic samples are
  // already 64×64 — this only kicks in for user uploads.
  const out = new Float32Array(3 * targetSize * targetSize);
  const xRatio = src.width / targetSize;
  const yRatio = src.height / targetSize;
  for (let y = 0; y < targetSize; y += 1) {
    const sy = Math.min(src.height - 1, Math.floor(y * yRatio));
    for (let x = 0; x < targetSize; x += 1) {
      const sx = Math.min(src.width - 1, Math.floor(x * xRatio));
      const srcIdx = (sy * src.width + sx) * 4; // RGBA
      const r = src.data[srcIdx] / 255;
      const g = src.data[srcIdx + 1] / 255;
      const b = src.data[srcIdx + 2] / 255;
      // Channel-first layout: (channel, y, x)
      out[0 * targetSize * targetSize + y * targetSize + x] = r;
      out[1 * targetSize * targetSize + y * targetSize + x] = g;
      out[2 * targetSize * targetSize + y * targetSize + x] = b;
    }
  }
  return out;
}

function softmax(values: Float32Array | number[]): number[] {
  const max = Math.max(...values);
  const exps = Array.from(values, (v) => Math.exp(v - max));
  const sum = exps.reduce((acc, value) => acc + value, 0);
  return exps.map((value) => value / sum);
}

export type ConnectorPrediction = {
  predicted: (typeof CONNECTOR_CLASSES)[number];
  confidence: number;
  probabilities: Record<(typeof CONNECTOR_CLASSES)[number], number>;
  inference_ms: number;
  model_input_size: [number, number];
};

export async function classifyConnectorImage(
  pngBuffer: Buffer
): Promise<ConnectorPrediction> {
  const session = await getSession();
  const decoded = decodePng(pngBuffer);
  const tensorData = nearestNeighbourResize(decoded, IMG_SIZE);
  const tensor = new ort.Tensor("float32", tensorData, [1, 3, IMG_SIZE, IMG_SIZE]);

  const start = performance.now();
  const result = await session.run({ image: tensor });
  const inferenceMs = performance.now() - start;

  const logits = Array.from(result.logits.data as Float32Array);
  const probs = softmax(logits);
  let topIdx = 0;
  for (let i = 1; i < probs.length; i += 1) {
    if (probs[i] > probs[topIdx]) topIdx = i;
  }

  const probabilities = Object.fromEntries(
    CONNECTOR_CLASSES.map((label, idx) => [label, Number(probs[idx].toFixed(4))])
  ) as ConnectorPrediction["probabilities"];

  return {
    predicted: CONNECTOR_CLASSES[topIdx],
    confidence: Number(probs[topIdx].toFixed(4)),
    probabilities,
    inference_ms: Number(inferenceMs.toFixed(2)),
    model_input_size: [IMG_SIZE, IMG_SIZE],
  };
}

export async function classifySampleByName(
  sampleName: string
): Promise<ConnectorPrediction> {
  const safeName = sampleName.replace(/[^a-z0-9-]/gi, "");
  const path = resolve(
    process.cwd(),
    "public/images/cv/samples",
    `${safeName}.png`
  );
  const buffer = await readFile(path);
  return classifyConnectorImage(buffer);
}

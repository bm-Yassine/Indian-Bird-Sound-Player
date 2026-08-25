// Running both models in the browser.
//
// The detector is a YOLOv11 exported to ONNX: it takes a 640x640 image and
// returns (1, 5, 8400) - for each of 8400 candidate boxes, the centre x/y,
// width, height and a confidence. Ultralytics normally does the filtering and
// overlap removal for you; in the browser we do it ourselves below.

// the /wasm entry is the CPU-only build. Importing the default entry pulls in
// the WebGPU (jsep) runtime, which is a 27 MB binary we would have to ship.
import * as ort from "onnxruntime-web/wasm";
// Let the bundler resolve the runtime binary: one copy, correct URL in both
// dev and the build. Hardcoding a /public path works in dev but ends up
// shipping the file twice; letting it resolve itself only works in the build.
import wasmUrl from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";

ort.env.wasm.wasmPaths = { wasm: wasmUrl };
ort.env.wasm.numThreads = 1; // keeps us off cross-origin isolation headers

export type Box = { x1: number; y1: number; x2: number; y2: number };

export type Guess = { species: string; confidence: number };

export type Bird = {
  box: Box;
  detectionConfidence: number;
  guesses: Guess[];
};

export type ClassifierMeta = {
  classes: string[];
  input_size: number;
  mean: [number, number, number];
  std: [number, number, number];
  detector_input_size: number;
  architecture?: string;
  val_accuracy?: number;
};

const DETECTOR_URL = "/models/bird_detector.onnx";
const CLASSIFIER_URL = "/models/bird_classifier.onnx";
const META_URL = "/models/classifier_meta.json";

export const DETECTION_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.45;

let detector: ort.InferenceSession | null = null;
let classifier: ort.InferenceSession | null = null;
let meta: ClassifierMeta | null = null;

export function isReady(): boolean {
  return detector !== null && classifier !== null && meta !== null;
}

export function classifierMeta(): ClassifierMeta {
  if (!meta) throw new Error("models are not loaded yet");
  return meta;
}

/** Downloads and prepares both models. ~16 MB the first time, cached after. */
export async function loadModels(onProgress?: (message: string) => void): Promise<void> {
  if (isReady()) return;

  onProgress?.("fetching the species list…");
  meta = (await fetch(META_URL).then((r) => r.json())) as ClassifierMeta;

  onProgress?.("loading the detector (10 MB)…");
  detector = await ort.InferenceSession.create(DETECTOR_URL, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });

  onProgress?.("loading the classifier (6 MB)…");
  classifier = await ort.InferenceSession.create(CLASSIFIER_URL, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });

  onProgress?.("ready");
}

// ---------------------------------------------------------------- preprocess

/** Draws the image into a square canvas, letterboxed so nothing is stretched. */
function letterbox(image: HTMLImageElement, size: number) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, size, size);

  const scale = Math.min(size / image.naturalWidth, size / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  const dx = (size - width) / 2;
  const dy = (size - height) / 2;

  ctx.drawImage(image, dx, dy, width, height);
  return { canvas, scale, dx, dy };
}

/** Canvas pixels -> the NCHW float tensor the models expect. */
function toTensor(
  canvas: HTMLCanvasElement,
  size: number,
  mean?: [number, number, number],
  std?: [number, number, number],
): ort.Tensor {
  const { data } = canvas.getContext("2d")!.getImageData(0, 0, size, size);
  const out = new Float32Array(3 * size * size);
  const pixels = size * size;

  for (let i = 0; i < pixels; i++) {
    for (let c = 0; c < 3; c++) {
      let value = data[i * 4 + c] / 255;
      if (mean && std) value = (value - mean[c]) / std[c];
      out[c * pixels + i] = value;
    }
  }
  return new ort.Tensor("float32", out, [1, 3, size, size]);
}

// ---------------------------------------------------------------- detection

function iou(a: Box, b: Box): number {
  const x1 = Math.max(a.x1, b.x1);
  const y1 = Math.max(a.y1, b.y1);
  const x2 = Math.min(a.x2, b.x2);
  const y2 = Math.min(a.y2, b.y2);

  const overlap = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  if (overlap === 0) return 0;

  const areaA = (a.x2 - a.x1) * (a.y2 - a.y1);
  const areaB = (b.x2 - b.x1) * (b.y2 - b.y1);
  return overlap / (areaA + areaB - overlap);
}

/** Greedy non-maximum suppression: keep the best box, drop what overlaps it. */
function suppress(boxes: { box: Box; confidence: number }[]): { box: Box; confidence: number }[] {
  const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const kept: { box: Box; confidence: number }[] = [];

  for (const candidate of sorted) {
    if (kept.every((k) => iou(k.box, candidate.box) < IOU_THRESHOLD)) {
      kept.push(candidate);
    }
  }
  return kept;
}

async function detect(image: HTMLImageElement, threshold: number) {
  const size = meta!.detector_input_size;
  const { canvas, scale, dx, dy } = letterbox(image, size);
  const tensor = toTensor(canvas, size);

  const output = await detector!.run({ [detector!.inputNames[0]]: tensor });
  const raw = output[detector!.outputNames[0]];
  const data = raw.data as Float32Array;

  // shape is (1, 5, N): all the xs, then all the ys, then w, h, confidence
  const candidates = raw.dims[2];
  const found: { box: Box; confidence: number }[] = [];

  for (let i = 0; i < candidates; i++) {
    const confidence = data[4 * candidates + i];
    if (confidence < threshold) continue;

    const cx = data[i];
    const cy = data[candidates + i];
    const w = data[2 * candidates + i];
    const h = data[3 * candidates + i];

    // undo the letterbox so the box lands on the original photo
    found.push({
      confidence,
      box: {
        x1: (cx - w / 2 - dx) / scale,
        y1: (cy - h / 2 - dy) / scale,
        x2: (cx + w / 2 - dx) / scale,
        y2: (cy + h / 2 - dy) / scale,
      },
    });
  }

  return suppress(found);
}

// ------------------------------------------------------------- classification

/** Crops a bird out of the photo, with a little margin, ready for the CNN. */
function cropToBox(image: HTMLImageElement, box: Box, size: number): HTMLCanvasElement {
  const padX = (box.x2 - box.x1) * 0.05;
  const padY = (box.y2 - box.y1) * 0.05;

  const x1 = Math.max(0, box.x1 - padX);
  const y1 = Math.max(0, box.y1 - padY);
  const x2 = Math.min(image.naturalWidth, box.x2 + padX);
  const y2 = Math.min(image.naturalHeight, box.y2 + padY);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  canvas
    .getContext("2d")!
    .drawImage(image, x1, y1, Math.max(1, x2 - x1), Math.max(1, y2 - y1), 0, 0, size, size);
  return canvas;
}

function softmax(values: Float32Array): number[] {
  const max = Math.max(...values);
  const exps = Array.from(values, (v) => Math.exp(v - max));
  const total = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / total);
}

async function classify(image: HTMLImageElement, box: Box, topK: number): Promise<Guess[]> {
  const size = meta!.input_size;
  const canvas = cropToBox(image, box, size);
  const tensor = toTensor(canvas, size, meta!.mean, meta!.std);

  const output = await classifier!.run({ [classifier!.inputNames[0]]: tensor });
  const logits = output[classifier!.outputNames[0]].data as Float32Array;

  return softmax(logits)
    .map((confidence, index) => ({ species: meta!.classes[index], confidence }))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, topK);
}

// ---------------------------------------------------------------------- api

/** Find every bird in the photo and name each one. */
export async function findBirds(
  image: HTMLImageElement,
  threshold = DETECTION_THRESHOLD,
  topK = 3,
): Promise<Bird[]> {
  if (!isReady()) throw new Error("models are not loaded yet");

  const detections = await detect(image, threshold);
  const birds: Bird[] = [];

  for (const { box, confidence } of detections) {
    birds.push({
      box,
      detectionConfidence: confidence,
      guesses: await classify(image, box, topK),
    });
  }
  return birds;
}

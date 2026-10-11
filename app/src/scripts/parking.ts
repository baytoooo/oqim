// The parking page: free and taken spaces in one still image of a car park, in this browser.
// The detector is the audit's: public/pipeline/model_n.onnx (YOLO26n, input 544 x 960) run by
// onnxruntime-web, loaded as the pipeline worker loads it (src/pipeline/worker.ts) and fed through
// the same letterbox and output parsing (src/pipeline/detector.ts). A space is taken when one
// vehicle box (car, bus, truck) covers enough of its polygon: the rule and its two numbers are
// in public/data/parking.json, chosen offline on PKLot (samples_src/parking_eval.py).

import cpuWasm from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import { ASSET_CDN } from "../config";
import { OnnxDetector, letterbox, parseOutput, type OrtModule } from "../pipeline/detector";
import type { Scene } from "../pipeline/scene";

type Pt = [number, number];
interface Space {
  id: number | string;
  poly: Pt[];
  /** Hand label (samples only). */
  occupied?: boolean;
}
interface Sample {
  id: string;
  src: string;
  w: number;
  h: number;
  camera: string;
  weather: string;
  time: string;
  spaces: Space[];
}
interface Stat {
  spaces: number;
  accuracy: number | null;
  precision: number | null;
  recall: number | null;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
  images?: number;
}
interface ParkingData {
  dataset: { name: string; licence: string; licenceUrl: string; source: string; official: string; citation: string };
  rule: { conf: number; coverage: number; classes: number[]; grid: number; text: string };
  eval: {
    detector: string;
    calibration: Stat;
    test: Stat;
    by_weather: Record<string, Stat>;
    by_camera: Record<string, Stat>;
    free_count_error: { median: number; p90: number; mean: number };
  };
  samples: Sample[];
}
interface Lot {
  name: string;
  lat: number;
  lon: number;
  capacity: number;
  capacitySource: string;
  osm: string;
}
type Box = { x1: number; y1: number; x2: number; y2: number; conf: number; cls: number };

const ORT_CDN = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
const MODEL = "model_n.onnx";
const INPUT: [number, number] = [544, 960];
const MAX_UPLOAD_W = 1920;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("pk-canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
const statusEl = $("pk-status");
const freeEl = $("pk-free");
const freeOf = $("pk-free-of");
const agreeEl = $("pk-agree");
const feedEl = $("pk-feed");
const drawTools = $("pk-draw-tools");
const boxesToggle = $<HTMLInputElement>("pk-boxes");

let data: ParkingData | null = null;
let detector: Promise<OnnxDetector> | null = null;
let image: HTMLImageElement | HTMLCanvasElement | null = null;
let imgW = 0;
let imgH = 0;
let label = "";
let spaces: Space[] = [];
let pending: Pt[] = [];
let boxes: Box[] | null = null;
let drawing = false;
/** Bumped on every new image, so a slow detection of an old one is dropped. */
let generation = 0;

// ------------------------------------------------------------------ detector

async function reachable(url: string, ms = 6000): Promise<boolean> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { headers: { Range: "bytes=0-1023" }, signal: ctl.signal, cache: "no-store" });
    await r.arrayBuffer();
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function download(urls: string[]): Promise<Uint8Array> {
  let last: unknown = null;
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("Could not load the detector.");
}

function loadDetector(): Promise<OnnxDetector> {
  if (detector) return detector;
  detector = (async () => {
    const ort = await import("onnxruntime-web/wasm");
    const cdn = `${ORT_CDN}ort-wasm-simd-threaded.wasm`;
    const local = new URL(cpuWasm, location.href).href;
    ort.env.wasm.wasmPaths = { wasm: (await reachable(cdn)) ? cdn : local };
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
    ort.env.logLevel = "error";
    // the local copy first on a dev server, the GitHub copy first elsewhere (as the worker does)
    const urls = [`${ASSET_CDN}/pipeline/${MODEL}`, `/pipeline/${MODEL}`];
    if (/^(localhost|127\.)/.test(location.hostname)) urls.reverse();
    const bytes = await download(urls);
    // OnnxDetector reads only scene.c.detector; this page applies its own classes and confidence
    const scene = { c: { detector: { input: INPUT, conf: 0.05, keep_classes: [2, 5, 7] } } } as unknown as Scene;
    return OnnxDetector.create(ort as unknown as OrtModule, bytes, scene, ["wasm"]);
  })();
  detector.catch(() => (detector = null));
  return detector;
}

async function detect(): Promise<void> {
  if (!image || !data) return;
  const gen = generation;
  status("Loading the detector (YOLO26n, 10 MB) ...");
  let det: OnnxDetector;
  try {
    det = await loadDetector();
  } catch (e) {
    status(`Could not load the detector: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  if (gen !== generation) return;
  status("Detecting vehicles ...");
  const c = document.createElement("canvas");
  c.width = imgW;
  c.height = imgH;
  const cx = c.getContext("2d", { willReadFrequently: true })!;
  cx.drawImage(image, 0, 0, imgW, imgH);
  const t0 = performance.now();
  const found: Box[] = [];
  const crops = tiles(imgW, imgH, data.rule.grid);
  for (const [x0, y0, x1, y1] of crops) {
    const w = x1 - x0, h = y1 - y0;
    const px = cx.getImageData(x0, y0, w, h).data;
    const lb = letterbox(px, w, h, 4, det.input);
    const out = await det.infer(lb);
    if (gen !== generation) return;
    for (const b of parseOutput(out, lb, w, h, data.rule.conf, data.rule.classes, 1))
      found.push({ ...b, x1: b.x1 + x0, x2: b.x2 + x0, y1: b.y1 + y0, y2: b.y2 + y0 });
  }
  const ms = performance.now() - t0;
  boxes = found;
  status(`${crops.length} detector runs (the whole frame and ${crops.length - 1} tiles) in ${(ms / 1000).toFixed(1)} s, on this device (WebAssembly). Nothing was uploaded.`);
  render();
}

// ------------------------------------------------------------------ geometry

/** The whole frame, then n x n tiles of 1.25 / n of each side, evenly spread (parking_eval.py tiles()).
 * A far car park's cars are 20 to 40 px wide; a tile gives the detector them larger. */
function tiles(w: number, h: number, n: number): [number, number, number, number][] {
  const out: [number, number, number, number][] = [[0, 0, w, h]];
  if (n > 1) {
    const f = Math.min(1, 1.25 / n);
    const tw = Math.round(w * f), th = Math.round(h * f);
    for (let j = 0; j < n; j++)
      for (let i = 0; i < n; i++) {
        const x0 = Math.round((i * (w - tw)) / (n - 1)), y0 = Math.round((j * (h - th)) / (n - 1));
        out.push([x0, y0, x0 + tw, y0 + th]);
      }
  }
  return out;
}

function area(P: Pt[]): number {
  let s = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[(i + P.length - 1) % P.length], b = P[i];
    s += a[0] * b[1] - b[0] * a[1];
  }
  return Math.abs(s) / 2;
}

/** The part of polygon P inside the box (Sutherland-Hodgman), as samples_src/parking_eval.py. */
function clip(P: Pt[], b: Box): Pt[] {
  const edges: [(p: Pt) => boolean, (a: Pt, q: Pt) => Pt][] = [
    [(p) => p[0] >= b.x1, (a, q) => [b.x1, a[1] + ((q[1] - a[1]) * (b.x1 - a[0])) / (q[0] - a[0])]],
    [(p) => p[0] <= b.x2, (a, q) => [b.x2, a[1] + ((q[1] - a[1]) * (b.x2 - a[0])) / (q[0] - a[0])]],
    [(p) => p[1] >= b.y1, (a, q) => [a[0] + ((q[0] - a[0]) * (b.y1 - a[1])) / (q[1] - a[1]), b.y1]],
    [(p) => p[1] <= b.y2, (a, q) => [a[0] + ((q[0] - a[0]) * (b.y2 - a[1])) / (q[1] - a[1]), b.y2]],
  ];
  for (const [inside, cut] of edges) {
    const out: Pt[] = [];
    for (let i = 0; i < P.length; i++) {
      const a = P[(i + P.length - 1) % P.length], q = P[i];
      const ia = inside(a), iq = inside(q);
      if (iq) {
        if (!ia) out.push(cut(a, q));
        out.push(q);
      } else if (ia) out.push(cut(a, q));
    }
    P = out;
    if (!P.length) return [];
  }
  return P;
}

function coverage(poly: Pt[], bs: Box[]): number {
  const a = area(poly);
  if (a <= 0) return 0;
  let best = 0;
  for (const b of bs) {
    const q = clip(poly, b);
    if (q.length >= 3) best = Math.max(best, area(q) / a);
  }
  return best;
}

// ------------------------------------------------------------------ drawing

function status(s: string): void {
  statusEl.textContent = s;
}

function taken(s: Space): boolean | null {
  if (!boxes || !data) return null;
  return coverage(s.poly, boxes) >= data.rule.coverage;
}

function render(): void {
  if (!image) return;
  ctx.drawImage(image, 0, 0, imgW, imgH);
  const lw = Math.max(1.5, imgW / 640);
  let free = 0, known = 0, agree = 0, labelled = 0;
  for (const s of spaces) {
    const t = taken(s);
    if (t !== null) {
      known++;
      if (!t) free++;
      if (s.occupied !== undefined) {
        labelled++;
        if (s.occupied === t) agree++;
      }
    }
    ctx.beginPath();
    s.poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    const col = t === null ? "241,238,230" : t ? "255,91,76" : "63,210,127";
    ctx.fillStyle = `rgba(${col},${t === null ? 0.12 : 0.32})`;
    ctx.fill();
    ctx.lineWidth = lw;
    ctx.strokeStyle = `rgb(${col})`;
    ctx.setLineDash([]);
    ctx.stroke();
    if (t !== null && s.occupied !== undefined && s.occupied !== t) {
      // the hand label says otherwise
      ctx.lineWidth = lw * 1.6;
      ctx.strokeStyle = "rgb(255,178,36)";
      ctx.setLineDash([lw * 3, lw * 2]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  if (boxes && boxesToggle.checked) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = "rgba(243,195,22,.9)";
    for (const b of boxes) ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
  }
  if (pending.length) {
    ctx.strokeStyle = "rgb(243,195,22)";
    ctx.fillStyle = "rgb(243,195,22)";
    ctx.lineWidth = lw;
    ctx.beginPath();
    pending.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    for (const [x, y] of pending) {
      ctx.beginPath();
      ctx.arc(x, y, lw * 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const M = spaces.length;
  if (!M) {
    freeEl.textContent = "0";
    freeOf.textContent = drawing ? "Draw a space: click its 4 corners." : "No spaces.";
  } else if (known < M) {
    freeEl.textContent = "...";
    freeOf.textContent = `of ${M} spaces`;
  } else {
    freeEl.textContent = String(free);
    freeOf.textContent = `of ${M} free`;
  }
  agreeEl.textContent = labelled
    ? `The hand labels of this frame: ${spaces.filter((s) => s.occupied === false).length} free. The detector agrees with them on ${agree} of ${labelled} spaces; dashed amber outlines mark the others.`
    : drawing
      ? "Your photo has no hand labels, so there is nothing to check the count against."
      : "";
  const now = new Date();
  now.setSeconds(0, 0);
  feedEl.textContent = JSON.stringify(
    { carPark: label, capacity: M, free: known === M ? free : null, updated: now.toISOString().replace(".000Z", "Z"), source: "camera, OQIM parking detector" },
    null,
    2,
  );
}

function setImage(img: HTMLImageElement | HTMLCanvasElement, w: number, h: number): void {
  generation++;
  image = img;
  imgW = canvas.width = w;
  imgH = canvas.height = h;
  boxes = null;
  pending = [];
  render();
  void detect();
}

// ------------------------------------------------------------------ samples and uploads

function pressed(btn: HTMLElement | null): void {
  document.querySelectorAll<HTMLElement>("[data-pk-sample]").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
}

async function showSample(s: Sample, btn: HTMLElement): Promise<void> {
  pressed(btn);
  drawing = false;
  drawTools.hidden = true;
  canvas.classList.remove("drawing");
  label = `PKLot ${s.camera}, ${s.weather}, ${s.time}`;
  spaces = s.spaces.map((x) => ({ ...x, poly: x.poly.map((p) => [p[0], p[1]] as Pt) }));
  status("Loading the image ...");
  const img = new Image();
  img.src = s.src;
  await img.decode();
  setImage(img, s.w, s.h);
}

async function showUpload(file: File): Promise<void> {
  pressed(null);
  drawing = true;
  drawTools.hidden = false;
  canvas.classList.add("drawing");
  label = file.name.replace(/\.[^.]+$/, "") || "your car park";
  spaces = [];
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const k = Math.min(1, MAX_UPLOAD_W / img.naturalWidth);
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    setImage(c, w, h);
  } catch {
    status("This browser could not open that file as an image.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

canvas.addEventListener("click", (ev) => {
  if (!drawing || !image) return;
  const r = canvas.getBoundingClientRect();
  pending.push([((ev.clientX - r.left) / r.width) * imgW, ((ev.clientY - r.top) / r.height) * imgH]);
  if (pending.length === 4) {
    spaces.push({ id: spaces.length + 1, poly: pending });
    pending = [];
  }
  render();
});

$("pk-undo").addEventListener("click", () => {
  if (pending.length) pending.pop();
  else spaces.pop();
  render();
});
$("pk-clear").addEventListener("click", () => {
  pending = [];
  spaces = [];
  render();
});
boxesToggle.addEventListener("change", render);
$<HTMLInputElement>("pk-file").addEventListener("change", (ev) => {
  const f = (ev.target as HTMLInputElement).files?.[0];
  if (f) void showUpload(f);
});

// ------------------------------------------------------------------ accuracy and car parks

const pct = (v: number | null) => (v === null ? "n/a" : `${(v * 100).toFixed(1)}%`);

function row(name: string, s: Stat): string {
  return `<tr><td>${name}</td><td class="num">${s.images ?? ""}</td><td class="num">${s.spaces}</td><td class="num">${pct(s.accuracy)}</td><td class="num">${pct(s.precision)}</td><td class="num">${pct(s.recall)}</td><td class="num">${s.tp} / ${s.fp} / ${s.fn} / ${s.tn}</td></tr>`;
}

function fillEval(d: ParkingData): void {
  const e = d.eval;
  $("pk-acc").textContent = pct(e.test.accuracy);
  $("pk-prec").textContent = pct(e.test.precision);
  $("pk-rec").textContent = pct(e.test.recall);
  $("pk-cnt").textContent = String(e.free_count_error.median);
  $("pk-n").textContent = `${e.test.spaces.toLocaleString("en-GB")} spaces in ${e.test.images} images`;
  $("pk-rule").textContent = d.rule.text;
  const rows = [row("All test images", e.test)];
  for (const [k, v] of Object.entries(e.by_weather)) rows.push(row(`Weather: ${k}`, v));
  for (const [k, v] of Object.entries(e.by_camera)) rows.push(row(`Camera: ${k.toUpperCase()}`, v));
  rows.push(row("Calibration images (not in the test)", e.calibration));
  $("pk-table").innerHTML = rows.join("");
  $("pk-count-err").textContent = `Free-space count per image, test images: median error ${e.free_count_error.median}, mean ${e.free_count_error.mean}, 90th percentile ${e.free_count_error.p90} spaces.`;
}

function fillLots(lots: Lot[]): void {
  $("pk-lots").innerHTML = lots
    .map(
      (l) =>
        `<tr><td>${l.name}</td><td class="num">${l.capacity}</td><td class="note">${l.capacitySource}</td><td class="num">${l.lat.toFixed(5)}, ${l.lon.toFixed(5)}</td><td><a href="https://www.openstreetmap.org/${l.osm}" rel="noopener">${l.osm}</a></td></tr>`,
    )
    .join("");
}

async function main(): Promise<void> {
  try {
    data = (await (await fetch("/data/parking.json")).json()) as ParkingData;
  } catch {
    status("Could not load /data/parking.json.");
    return;
  }
  fillEval(data);
  const box = $("pk-samples");
  data.samples.forEach((s, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn small sample";
    b.dataset.pkSample = s.id;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `<span class="mono">${s.camera.toUpperCase()}</span> <span>${s.weather}, ${s.time.slice(11, 16)}</span>`;
    b.addEventListener("click", () => void showSample(s, b));
    box.append(b);
    if (i === 0) void showSample(s, b);
  });
  fetch("/data/parking_lots.json")
    .then((r) => r.json())
    .then((lots: Lot[]) => fillLots(lots))
    .catch(() => undefined);
}

void main();

// The road condition page (src/pages/roads.astro): road damage found in still photos, in this browser,
// and each photo as a point on a map of Tashkent coloured by the worst damage in it.
// The detector is public/roads/model.onnx: YOLOv8n fine-tuned on RDD2022 by dronefreak
// (huggingface.co/dronefreak/rdd2022-yolov8n, AGPL-3.0), exported by samples_src/roads_eval.py with
// NMS in the graph, so its output is [1, 300, 6] like the audit's model. It runs through the same
// onnxruntime-web loading and the same letterbox and output parsing as the parking page
// (src/scripts/parking.ts, src/pipeline/detector.ts).

import cpuWasm from "onnxruntime-web/ort-wasm-simd-threaded.wasm?url";
import maplibregl, { type GeoJSONSource, type Map as MlMap } from "maplibre-gl";
import { OnnxDetector, letterbox, parseOutput, type OrtModule } from "../pipeline/detector";
import type { Scene } from "../pipeline/scene";

type Box = { x1: number; y1: number; x2: number; y2: number; conf: number; cls: number };
interface ClassInfo {
  id: number;
  code: string;
  name: string;
  rank: number;
  color: string;
}
interface Sample {
  id: string;
  src: string;
  w: number;
  h: number;
  country: string;
  original: string;
  demo: { street: string; lat: number; lon: number };
  /** Hand labels: [class, x1, y1, x2, y2] in the sample's pixels. */
  labels: number[][];
  /** The offline run of the same file: [class, x1, y1, x2, y2, conf]. */
  offline: number[][];
  offline_hits: number;
}
interface RoadsData {
  classes: ClassInfo[];
  conf: number;
  input: number;
  model: string;
  map_center: [number, number];
  dataset: string;
  samples: Sample[];
}
interface ClassEval {
  code: string;
  name: string;
  instances: number;
  images: number;
  precision: number;
  recall: number;
  ap50: number;
  ap50_95: number;
}
interface EvalData {
  model: { name: string; source: string; licence: string; trained_by: string; card_reports: { map50: number; precision: number; recall: number } };
  dataset: { name: string; source: string; original: string; licence: string; split: string; images: number; instances: number; note: string };
  method: { tool: string; imgsz: number; match_iou: number; precision_recall: string };
  overall: { map50: number; map50_95: number; precision: number; recall: number };
  per_class: ClassEval[];
}
type Where = "demo" | "exif" | "click" | null;
interface Photo {
  key: string;
  name: string;
  img: HTMLImageElement | HTMLCanvasElement;
  w: number;
  h: number;
  lat: number | null;
  lon: number | null;
  where: Where;
  street?: string;
  labels?: number[][];
  boxes: Box[] | null;
  tiled: boolean;
  sample?: Sample;
}

const ORT_CDN = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.30.0/dist/";
const MAX_UPLOAD_W = 2048;
const NONE_COLOR = "#3fd27f";
const WAIT_COLOR = "#a2a5ab";

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("rd-canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
const statusEl = $("rd-status");
const foundEl = $("rd-found");
const whereEl = $("rd-where");
const labelsToggle = $<HTMLInputElement>("rd-labels");
const tilesToggle = $<HTMLInputElement>("rd-tiles");
const placeBtn = $<HTMLButtonElement>("rd-place");

let data: RoadsData | null = null;
let classes = new Map<number, ClassInfo>();
let detector: Promise<OnnxDetector> | null = null;
let map: MlMap | null = null;
const photos: Photo[] = [];
let current: Photo | null = null;
/** The photo the next map click places. */
let placing: Photo | null = null;
let uploads = 0;

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

function loadDetector(): Promise<OnnxDetector> {
  if (detector) return detector;
  detector = (async () => {
    const ort = await import("onnxruntime-web/wasm");
    const cdn = `${ORT_CDN}ort-wasm-simd-threaded.wasm`;
    const local = new URL(cpuWasm, location.href).href;
    ort.env.wasm.wasmPaths = { wasm: (await reachable(cdn)) ? cdn : local };
    ort.env.wasm.numThreads = self.crossOriginIsolated ? Math.min(4, navigator.hardwareConcurrency || 1) : 1;
    ort.env.logLevel = "error";
    const r = await fetch(data!.model);
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${data!.model}`);
    const bytes = new Uint8Array(await r.arrayBuffer());
    // OnnxDetector reads only scene.c.detector; this page applies its own confidence and keeps every class
    const n = data!.input;
    const scene = { c: { detector: { input: [n, n], conf: data!.conf, keep_classes: [0, 1, 2, 3] } } } as unknown as Scene;
    return OnnxDetector.create(ort as unknown as OrtModule, bytes, scene, ["wasm"]);
  })();
  detector.catch(() => (detector = null));
  return detector;
}

function iou(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const i = ix * iy;
  const u = (a.x2 - a.x1) * (a.y2 - a.y1) + (b.x2 - b.x1) * (b.y2 - b.y1) - i;
  return u > 0 ? i / u : 0;
}

/** Greedy per-class NMS, for merging the whole-frame run with the tile runs. */
function nms(bs: Box[], thr = 0.5): Box[] {
  const out: Box[] = [];
  for (const b of [...bs].sort((p, q) => q.conf - p.conf)) if (!out.some((k) => k.cls === b.cls && iou(k, b) > thr)) out.push(b);
  return out;
}

/** The whole photo, then 2 x 2 overlapping tiles of 0.6 of each side (only when asked for). */
function crops(w: number, h: number, tiled: boolean): [number, number, number, number][] {
  const out: [number, number, number, number][] = [[0, 0, w, h]];
  if (tiled) {
    const tw = Math.round(w * 0.6), th = Math.round(h * 0.6);
    for (const y0 of [0, h - th]) for (const x0 of [0, w - tw]) out.push([x0, y0, x0 + tw, y0 + th]);
  }
  return out;
}

async function detect(p: Photo): Promise<void> {
  if (!data) return;
  status("Loading the detector (YOLOv8n, 12 MB) ...");
  let det: OnnxDetector;
  try {
    det = await loadDetector();
  } catch (e) {
    status(`Could not load the detector: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }
  status(`Looking for road damage in ${p.name} ...`);
  const c = document.createElement("canvas");
  c.width = p.w;
  c.height = p.h;
  const cx = c.getContext("2d", { willReadFrequently: true })!;
  cx.drawImage(p.img, 0, 0, p.w, p.h);
  const tiled = tilesToggle.checked;
  const t0 = performance.now();
  const found: Box[] = [];
  const parts = crops(p.w, p.h, tiled);
  for (const [x0, y0, x1, y1] of parts) {
    const w = x1 - x0, h = y1 - y0;
    const px = cx.getImageData(x0, y0, w, h).data;
    const lb = letterbox(px, w, h, 4, det.input);
    const out = await det.infer(lb);
    for (const b of parseOutput(out, lb, w, h, data.conf, null, 1)) found.push({ ...b, x1: b.x1 + x0, x2: b.x2 + x0, y1: b.y1 + y0, y2: b.y2 + y0 });
  }
  p.boxes = parts.length > 1 ? nms(found) : found;
  p.tiled = tiled;
  const ms = performance.now() - t0;
  status(`${parts.length === 1 ? "One detector run" : `${parts.length} detector runs (the photo and 4 tiles)`} in ${(ms / 1000).toFixed(2)} s on this device (WebAssembly). Nothing was uploaded.`);
  refresh();
}

// ------------------------------------------------------------------ EXIF GPS

/** Latitude and longitude from a JPEG's EXIF GPS tags, or null. Reads only APP1 "Exif". */
function exifGps(buf: ArrayBuffer): { lat: number; lon: number } | null {
  const v = new DataView(buf);
  if (v.byteLength < 4 || v.getUint16(0) !== 0xffd8) return null;
  let o = 2;
  while (o + 4 <= v.byteLength) {
    if (v.getUint8(o) !== 0xff) return null;
    const marker = v.getUint8(o + 1);
    const len = v.getUint16(o + 2);
    if (marker === 0xda || marker === 0xd9) return null; // image data starts: no EXIF before it
    if (marker === 0xe1 && o + 10 <= v.byteLength && v.getUint32(o + 4) === 0x45786966) return tiffGps(v, o + 10);
    o += 2 + len;
  }
  return null;
}

function tiffGps(v: DataView, t: number): { lat: number; lon: number } | null {
  try {
    const le = v.getUint16(t) === 0x4949;
    const u16 = (p: number) => v.getUint16(t + p, le);
    const u32 = (p: number) => v.getUint32(t + p, le);
    const ifd = (p: number) => {
      const n = u16(p);
      const m = new Map<number, number>(); // tag -> offset of its entry
      for (let i = 0; i < n; i++) m.set(u16(p + 2 + i * 12), p + 2 + i * 12);
      return m;
    };
    const ifd0 = ifd(u32(4));
    const gpsAt = ifd0.get(0x8825);
    if (gpsAt === undefined) return null;
    const gps = ifd(u32(gpsAt + 8));
    const ref = (tag: number) => {
      const e = gps.get(tag);
      return e === undefined ? "" : String.fromCharCode(v.getUint8(t + e + 8));
    };
    const dms = (tag: number) => {
      const e = gps.get(tag);
      if (e === undefined) return null;
      const at = u32(e + 8);
      let deg = 0;
      for (let i = 0; i < 3; i++) {
        const den = u32(at + i * 8 + 4);
        if (den) deg += u32(at + i * 8) / den / 60 ** i;
      }
      return deg;
    };
    const lat = dms(2), lon = dms(4);
    if (lat === null || lon === null || (lat === 0 && lon === 0)) return null;
    return { lat: ref(1) === "S" ? -lat : lat, lon: ref(3) === "W" ? -lon : lon };
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ drawing

function status(s: string): void {
  statusEl.textContent = s;
}

function worst(p: Photo): ClassInfo | null {
  if (!p.boxes) return null;
  let w: ClassInfo | null = null;
  for (const b of p.boxes) {
    const c = classes.get(b.cls);
    if (c && (!w || c.rank > w.rank)) w = c;
  }
  return w;
}

function counts(p: Photo): Map<number, number> {
  const m = new Map<number, number>();
  for (const b of p.boxes ?? []) m.set(b.cls, (m.get(b.cls) ?? 0) + 1);
  return m;
}

function whereText(p: Photo): string {
  if (p.where === "demo") return `${p.street}, demo location (the photo was taken in ${p.sample!.country})`;
  if (p.where === "exif") return `${p.lat!.toFixed(5)}, ${p.lon!.toFixed(5)}, from the photo's GPS`;
  if (p.where === "click") return `${p.lat!.toFixed(5)}, ${p.lon!.toFixed(5)}, placed by hand`;
  return "Not on the map yet: click the map where it was taken.";
}

function render(): void {
  const p = current;
  if (!p) return;
  if (canvas.width !== p.w || canvas.height !== p.h) {
    canvas.width = p.w;
    canvas.height = p.h;
  }
  ctx.drawImage(p.img, 0, 0, p.w, p.h);
  const lw = Math.max(2, p.w / 320);
  const font = Math.max(12, Math.round(p.w / 45));
  ctx.font = `700 ${font}px "Overpass", Arial, sans-serif`;
  ctx.textBaseline = "top";
  if (p.labels && labelsToggle.checked) {
    ctx.setLineDash([lw * 3, lw * 2]);
    ctx.lineWidth = lw;
    ctx.strokeStyle = "rgba(241,238,230,.9)";
    for (const [, x1, y1, x2, y2] of p.labels) ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.setLineDash([]);
  }
  for (const b of p.boxes ?? []) {
    const c = classes.get(b.cls);
    const col = c?.color ?? "#ffffff";
    ctx.lineWidth = lw;
    ctx.strokeStyle = col;
    ctx.strokeRect(b.x1, b.y1, b.x2 - b.x1, b.y2 - b.y1);
    const text = `${c?.name ?? b.cls} ${b.conf.toFixed(2)}`;
    const tw = ctx.measureText(text).width + 8;
    const ty = b.y1 - font - 6 >= 0 ? b.y1 - font - 6 : b.y1;
    const tx = Math.min(b.x1, p.w - tw);
    ctx.fillStyle = col;
    ctx.fillRect(tx, ty, tw, font + 6);
    ctx.fillStyle = "#111214";
    ctx.fillText(text, tx + 4, ty + 3);
  }
  // the side panel
  if (!p.boxes) foundEl.innerHTML = `<li class="muted">Looking ...</li>`;
  else if (!p.boxes.length) foundEl.innerHTML = `<li><i class="sw" style="background:${NONE_COLOR}"></i> No damage found above ${Math.round(data!.conf * 100)}% confidence.</li>`;
  else {
    const m = counts(p);
    foundEl.innerHTML = data!.classes
      .filter((c) => m.has(c.id))
      .map((c) => `<li><i class="sw" style="background:${c.color}"></i> <b>${m.get(c.id)}</b> ${c.name.toLowerCase()}${m.get(c.id)! > 1 ? "s" : ""} <span class="mono muted">${c.code}</span></li>`)
      .join("");
  }
  if (p.sample && p.boxes) {
    const n = p.labels!.length;
    foundEl.innerHTML += `<li class="muted">Hand labels in this photo: ${n}. ${p.tiled ? "" : `The offline run of the same model matched ${p.sample.offline_hits} of them (IoU 0.5).`}</li>`;
  }
  whereEl.textContent = whereText(p);
  placeBtn.hidden = !!p.sample;
  placeBtn.textContent = placing === p ? "Now click the map" : p.where ? "Move it on the map" : "Place it on the map";
}

function priorityRows(): Photo[] {
  return [...photos]
    .filter((p) => p.boxes)
    .sort((a, b) => (worst(b)?.rank ?? 0) - (worst(a)?.rank ?? 0) || (b.boxes!.length - a.boxes!.length) || a.name.localeCompare(b.name));
}

function table(): void {
  const rows = priorityRows();
  $("rd-table").innerHTML = rows.length
    ? rows
        .map((p, i) => {
          const w = worst(p);
          const m = counts(p);
          const cell = (id: number) => `<td class="num">${m.get(id) ?? 0}</td>`;
          const where = p.where === "demo" ? `${p.street} <span class="tag">demo location</span>` : p.where ? `${p.lat!.toFixed(4)}, ${p.lon!.toFixed(4)} <span class="tag">${p.where === "exif" ? "GPS" : "placed"}</span>` : `<span class="muted">not placed</span>`;
          return `<tr data-key="${p.key}" class="${p === current ? "sel" : ""}"><td class="num">${i + 1}</td><td><button type="button" class="linkish" data-open="${p.key}">${escapeHtml(p.name)}</button></td><td>${where}</td>${cell(3)}${cell(2)}${cell(1)}${cell(0)}<td><i class="sw" style="background:${w?.color ?? NONE_COLOR}"></i> ${w ? w.name : "none found"}</td></tr>`;
        })
        .join("")
    : `<tr><td colspan="8" class="muted">Running the detector on the sample photos ...</td></tr>`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
}

/** The GeoJSON a source takes, without depending on the global GeoJSON types. */
type PhotoPoints = Extract<Parameters<GeoJSONSource["setData"]>[0], { type: "FeatureCollection" }>;

function mapData(): PhotoPoints {
  const rank = new Map(priorityRows().map((p, i) => [p.key, i + 1]));
  return {
    type: "FeatureCollection",
    features: photos
      .filter((p) => p.lat !== null && p.lon !== null)
      .map((p) => {
        const w = worst(p);
        return {
          type: "Feature",
          geometry: { type: "Point", coordinates: [p.lon!, p.lat!] },
          properties: { key: p.key, color: p.boxes ? (w?.color ?? NONE_COLOR) : WAIT_COLOR, n: String(rank.get(p.key) ?? ""), sel: p === current ? 1 : 0 },
        };
      }),
  };
}

function refresh(): void {
  render();
  table();
  (map?.getSource("photos") as GeoJSONSource | undefined)?.setData(mapData());
}

function select(p: Photo): void {
  current = p;
  document.querySelectorAll<HTMLElement>("[data-rd-sample]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.rdSample === p.key)));
  refresh();
  if (map && p.lat !== null && p.lon !== null) map.easeTo({ center: [p.lon, p.lat], duration: 600 });
}

// ------------------------------------------------------------------ samples and uploads

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function addUpload(file: File): Promise<void> {
  const url = URL.createObjectURL(file);
  try {
    const [img, buf] = await Promise.all([loadImage(url), file.arrayBuffer()]);
    if (!img) throw new Error("not an image");
    const k = Math.min(1, MAX_UPLOAD_W / img.naturalWidth);
    const w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    c.getContext("2d")!.drawImage(img, 0, 0, w, h);
    const gps = exifGps(buf);
    const p: Photo = {
      key: `u${++uploads}`,
      name: file.name || `photo ${uploads}`,
      img: c,
      w,
      h,
      lat: gps?.lat ?? null,
      lon: gps?.lon ?? null,
      where: gps ? "exif" : null,
      boxes: null,
      tiled: false,
    };
    photos.push(p);
    if (!gps) placing = p;
    select(p);
    await detect(p);
    if (!gps) status(`${statusEl.textContent} No GPS in this photo: click the map where it was taken.`);
  } catch {
    status(`This browser could not open ${file.name} as an image.`);
  } finally {
    URL.revokeObjectURL(url);
  }
}

placeBtn.addEventListener("click", () => {
  if (current && !current.sample) {
    placing = current;
    render();
  }
});
labelsToggle.addEventListener("change", render);
tilesToggle.addEventListener("change", () => {
  if (current) void detect(current);
});
$<HTMLInputElement>("rd-file").addEventListener("change", async (ev) => {
  const input = ev.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = "";
  for (const f of files) await addUpload(f);
});
$("rd-table").addEventListener("click", (ev) => {
  const k = (ev.target as HTMLElement).closest<HTMLElement>("[data-open]")?.dataset.open;
  const p = photos.find((x) => x.key === k);
  if (p) select(p);
});

// ------------------------------------------------------------------ map

/** OpenFreeMap's style, as the 3D corridor page loads it; without it, a plain dark background. */
async function baseStyle(): Promise<maplibregl.StyleSpecification> {
  for (let i = 0; i < 3; i++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 7000);
    try {
      const r = await fetch("https://tiles.openfreemap.org/styles/liberty", { signal: ctl.signal });
      if (r.ok) return (await r.json()) as maplibregl.StyleSpecification;
    } catch {
      /* try again */
    } finally {
      clearTimeout(timer);
    }
    await new Promise((ok) => setTimeout(ok, 500));
  }
  return {
    version: 8,
    glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
    sources: {},
    layers: [{ id: "bg", type: "background", paint: { "background-color": "#15171a" } }],
  };
}

async function initMap(center: [number, number]): Promise<void> {
  const style = await baseStyle();
  const m = new maplibregl.Map({ container: "rd-map", style, center, zoom: 11.3, attributionControl: { compact: true } });
  m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
  await new Promise<void>((ok) => {
    if (m.isStyleLoaded()) ok();
    else m.once("style.load", () => ok());
  });
  m.addSource("photos", { type: "geojson", data: mapData() });
  m.addLayer({ id: "photos-sel", type: "circle", source: "photos", filter: ["==", ["get", "sel"], 1], paint: { "circle-radius": 17, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": "#f1eee6", "circle-stroke-width": 2 } });
  m.addLayer({ id: "photos", type: "circle", source: "photos", paint: { "circle-radius": 11, "circle-color": ["get", "color"], "circle-stroke-color": "#111214", "circle-stroke-width": 2 } });
  m.addLayer({ id: "photos-n", type: "symbol", source: "photos", layout: { "text-field": ["get", "n"], "text-size": 12, "text-font": ["Noto Sans Bold"], "text-allow-overlap": true }, paint: { "text-color": "#111214" } });
  m.on("click", "photos", (e) => {
    const k = e.features?.[0]?.properties?.key as string | undefined;
    const p = photos.find((x) => x.key === k);
    if (p && !placing) select(p);
  });
  m.on("click", (e) => {
    if (!placing) return;
    const p = placing;
    placing = null;
    p.lat = e.lngLat.lat;
    p.lon = e.lngLat.lng;
    p.where = "click";
    select(p);
  });
  m.on("mouseenter", "photos", () => (m.getCanvas().style.cursor = "pointer"));
  m.on("mouseleave", "photos", () => (m.getCanvas().style.cursor = ""));
  map = m;
}

// ------------------------------------------------------------------ accuracy

const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

function fillEval(e: EvalData): void {
  $("rd-map50").textContent = pct(e.overall.map50);
  $("rd-prec").textContent = pct(e.overall.precision);
  $("rd-rec").textContent = pct(e.overall.recall);
  $("rd-n").textContent = String(e.dataset.images);
  $("rd-eval-table").innerHTML = e.per_class
    .map((c) => `<tr><td><span class="mono">${c.code}</span> ${c.name}</td><td class="num">${c.images}</td><td class="num">${c.instances}</td><td class="num">${pct(c.precision)}</td><td class="num">${pct(c.recall)}</td><td class="num">${pct(c.ap50)}</td></tr>`)
    .join("");
  $("rd-eval-note").textContent =
    `${e.dataset.note} ${e.dataset.instances} hand-labelled damages. Measured with ${e.method.tool} at ${e.method.imgsz} px, a detection counts when it has the right class and IoU of at least ${e.method.match_iou} with a hand label; precision and recall are ${e.method.precision_recall}. ` +
    `The model card reports ${pct(e.model.card_reports.map50)} mAP50, ${pct(e.model.card_reports.precision)} precision and ${pct(e.model.card_reports.recall)} recall on the whole test split, so this sample came out easier than the average.`;
}

// ------------------------------------------------------------------ start

async function main(): Promise<void> {
  try {
    data = (await (await fetch("/data/roads.json")).json()) as RoadsData;
  } catch {
    status("Could not load /data/roads.json.");
    return;
  }
  classes = new Map(data.classes.map((c) => [c.id, c]));
  $("rd-legend").innerHTML = data.classes.map((c) => `<span><i class="sw" style="background:${c.color}"></i> ${c.name}</span>`).join("") + `<span><i class="sw" style="background:${NONE_COLOR}"></i> none found</span>`;
  fetch("/data/roads_eval.json")
    .then((r) => r.json())
    .then((e: EvalData) => fillEval(e))
    .catch(() => ($("rd-eval-note").textContent = "Could not load /data/roads_eval.json."));
  table();
  const box = $("rd-samples");
  const imgs = await Promise.all(data.samples.map((s) => loadImage(s.src)));
  data.samples.forEach((s, i) => {
    const img = imgs[i];
    if (!img) return;
    const p: Photo = { key: s.id, name: s.id.replace(/_/g, " "), img, w: s.w, h: s.h, lat: s.demo.lat, lon: s.demo.lon, where: "demo", street: s.demo.street, labels: s.labels, boxes: null, tiled: false, sample: s };
    photos.push(p);
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn small sample";
    b.dataset.rdSample = p.key;
    b.setAttribute("aria-pressed", "false");
    b.innerHTML = `<span class="mono">${i + 1}</span> <span>${escapeHtml(s.country)}</span>`;
    b.addEventListener("click", () => {
      select(p);
      if (!p.boxes) void detect(p);
    });
    box.append(b);
  });
  if (photos.length) select(photos[0]);
  initMap(data.map_center).catch(() => ($("rd-map-note").textContent = "The map could not load in this browser; the photos and the table still work."));
  for (const p of [...photos]) if (p.sample) await detect(p);
  if (current) refresh();
}

void main();

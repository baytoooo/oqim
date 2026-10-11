// The billboard traffic page (src/pages/banner.astro): choose a video, draw the counting line on its
// first frame, run the browser pipeline (local_api.ts, the audit's detector and tracker), count the
// vehicles that cross the line (src/oqim/count.ts), play the video with every counted vehicle
// marked, and keep a log of counts per billboard in this browser.

import { CLASS_NAME, countFrames, type Count } from "../oqim/count";
import { SAMPLE_CONFIG, SAMPLES } from "../oqim/samples";
import type { Pt } from "../oqim/types";
import type { ClipResult } from "../lib/types";
import { ASSET_CDN } from "../config";
import { LocalApi, WORK_WIDTH } from "./local_api";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const api = new LocalApi();
const LOG_KEY = "oqim:banner-log";

let source: File | null = null;
let sourceName = "";
let work: [number, number] = [WORK_WIDTH, 1080];
let line: Pt[] = [];
let still: HTMLCanvasElement | null = null;
let result: ClipResult | null = null;
let count: Count | null = null;
/** Corrections by eye: vehicles the model missed, and boxes it counted that were not vehicles. */
let plus = 0, minus = 0;

function renderTotal(): void {
  if (!count) return;
  const n = count.total + plus - minus;
  $("bn-total").textContent = String(n);
  $("bn-fix-note").textContent = plus || minus
    ? `${count.total} counted by the model, ${plus ? `+${plus} missed` : ""}${plus && minus ? ", " : ""}${minus ? `-${minus} not vehicles` : ""}: ${n} after checking by eye.`
    : "Counted by the model. Check by eye while the video plays, and correct:";
  renderDay();
}

const show = (id: string, on = true) => ($(id).hidden = !on);

// ---------------------------------------------------------------- choosing a video

async function firstFrame(url: string): Promise<HTMLCanvasElement> {
  const v = document.createElement("video");
  v.muted = true;
  v.playsInline = true;
  v.preload = "auto";
  v.src = url;
  await new Promise<void>((ok, bad) => {
    v.onloadeddata = () => ok();
    v.onerror = () => bad(new Error("This browser cannot open the video. Try an MP4 (H.264) file."));
  });
  await new Promise<void>((ok) => {
    v.onseeked = () => ok();
    v.currentTime = Math.min(1, (v.duration || 2) / 2);
  });
  work = [WORK_WIDTH, Math.round((v.videoHeight * WORK_WIDTH) / v.videoWidth)];
  const c = document.createElement("canvas");
  c.width = work[0] / 2;
  c.height = work[1] / 2;
  c.getContext("2d")!.drawImage(v, 0, 0, c.width, c.height);
  return c;
}

async function choose(file: File, preset: Pt[] | null): Promise<void> {
  $("bn-pick").textContent = "Opening the video...";
  source = file;
  sourceName = file.name.replace(/\.[^.]+$/, "");
  const url = URL.createObjectURL(file);
  try {
    still = await firstFrame(url);
  } catch (e) {
    $("bn-pick").textContent = e instanceof Error ? e.message : String(e);
    return;
  } finally {
    URL.revokeObjectURL(url);
  }
  line = preset ? preset.map((p) => [...p] as Pt) : [];
  $("bn-pick").textContent = `${file.name}: ${work[0]} x ${work[1]} work pixels. ${preset ? "The line is set; click twice to move it." : "Click two points to draw the line."}`;
  show("bn-setup");
  show("bn-report", false);
  drawSetup();
  $("bn-setup").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function download(urls: string[], onProgress: (got: number, total: number) => void): Promise<Blob> {
  let last: unknown = null;
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (!r.ok || !r.body) throw new Error(`HTTP ${r.status}`);
      const total = Number(r.headers.get("content-length")) || 0;
      const reader = r.body.getReader();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let got = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value as Uint8Array<ArrayBuffer>);
        got += value.length;
        onProgress(got, total);
      }
      return new Blob(chunks, { type: "video/mp4" });
    } catch (e) {
      last = e;
    }
  }
  throw last instanceof Error ? last : new Error("download failed");
}

$<HTMLInputElement>("bn-file").addEventListener("change", (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) void choose(f, null);
});

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-sample]")) {
  b.addEventListener("click", async () => {
    const s = SAMPLES.find((x) => x.name === b.dataset.sample)!;
    $("bn-pick").textContent = `Downloading ${s.name}...`;
    try {
      const blob = await download([`${ASSET_CDN}${s.url}`, s.url], (got, total) => {
        $("bn-pick").textContent = `Downloading ${s.name}: ${(got / 1e6).toFixed(1)}${total ? ` of ${(total / 1e6).toFixed(0)}` : ""} MB`;
      });
      if (!$<HTMLInputElement>("bn-place").value) $<HTMLInputElement>("bn-place").value = `Sample junction ${s.name}, southbound`;
      await choose(new File([blob], `${s.name}.mp4`, { type: "video/mp4" }), SAMPLE_CONFIG.approaches[0].line as Pt[]);
    } catch (e) {
      $("bn-pick").textContent = `Could not download the sample (${e instanceof Error ? e.message : e}).`;
    }
  });
}

// ---------------------------------------------------------------- the line

const frame = $<HTMLCanvasElement>("bn-frame");

function drawSetup(): void {
  if (!still) return;
  frame.width = still.width;
  frame.height = still.height;
  const g = frame.getContext("2d")!;
  g.drawImage(still, 0, 0);
  const k = still.width / work[0];
  g.strokeStyle = "#f3c316";
  g.fillStyle = "#f3c316";
  g.lineWidth = 4;
  if (line.length === 2) {
    g.beginPath();
    g.moveTo(line[0][0] * k, line[0][1] * k);
    g.lineTo(line[1][0] * k, line[1][1] * k);
    g.stroke();
  }
  for (const [x, y] of line) {
    g.beginPath();
    g.arc(x * k, y * k, 6, 0, Math.PI * 2);
    g.fill();
  }
}

frame.addEventListener("click", (e) => {
  const r = frame.getBoundingClientRect();
  const p: Pt = [((e.clientX - r.left) / r.width) * work[0], ((e.clientY - r.top) / r.height) * work[1]];
  line = line.length >= 2 ? [p] : [...line, p];
  drawSetup();
});

// ---------------------------------------------------------------- running

async function run(): Promise<void> {
  if (!source) return;
  if (line.length !== 2) {
    $("bn-pick").textContent = "Draw the counting line first: two clicks on the frame.";
    return;
  }
  show("bn-running");
  show("bn-report", false);
  $("bn-running").scrollIntoView({ behavior: "smooth", block: "start" });
  const health = await api.health();
  if (health !== "ok") {
    $("bn-stage").textContent = "This browser cannot run the pipeline (it needs Web Workers, WebAssembly and a canvas).";
    return;
  }
  $("bn-backend").textContent = api.backend === "webgpu" ? "The detector runs on this device's GPU (WebGPU)." : "No WebGPU here: the detector runs on the CPU (WebAssembly), which is several times slower. Chrome or Edge on a laptop is faster.";
  api.heads = [];
  api.model = $<HTMLSelectElement>("bn-model").value;
  let id: string;
  try {
    id = await api.submitFile(source, new AbortController().signal, 600);
  } catch (e) {
    $("bn-stage").textContent = e instanceof Error ? e.message : String(e);
    return;
  }
  const started = performance.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, 400));
    const j = await api.job(id).catch(() => null);
    if (!j) return;
    $("bn-fill").style.width = `${Math.round(j.progress * 100)}%`;
    $("bn-stage").textContent = `${j.stage} ${Math.round(j.progress * 100)}%${j.eta_sec ? `, about ${j.eta_sec} s left` : ""}`;
    if (j.status === "error") {
      $("bn-stage").textContent = j.error ?? "The analysis failed.";
      return;
    }
    if (j.status === "done" && j.result) {
      $("bn-stage").textContent = `Done in ${Math.round((performance.now() - started) / 1000)} s.`;
      finish(j.result);
      return;
    }
  }
}
$("bn-run").addEventListener("click", () => void run());

// ---------------------------------------------------------------- report

function finish(r: ClipResult): void {
  result = r;
  count = countFrames(r.overlay?.frames ?? [], [line[0], line[1]], r.duration);
  show("bn-running", false);
  show("bn-report");
  const c = count;
  plus = minus = 0;
  renderTotal();
  $("bn-rate").textContent = `In ${fmtDur(c.duration)} of video: ${c.perHour.toFixed(0)} vehicles an hour at this rate.`;
  const rows = Object.entries(c.byClass).sort((a, b) => b[1] - a[1]);
  $("bn-classes").innerHTML = `<tr><th>Type</th><th>Vehicles</th><th>Share</th></tr>` + rows.map(([k, v]) => `<tr><td>${k}</td><td class="num">${v}</td><td class="num">${c.total ? Math.round((100 * v) / c.total) : 0}%</td></tr>`).join("");
  $("bn-dir").textContent = c.byDir.a && c.byDir.b ? `Each way: ${c.byDir.a} and ${c.byDir.b}.` : `All ${c.total} went the same way across the line.`;
  renderDay();
  renderMinutes();
  setupVideo();
  $("bn-report").scrollIntoView({ behavior: "smooth", block: "start" });
}

const fmtDur = (s: number) => `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`;

function renderDay(): void {
  if (!count) return;
  const h = Math.max(1, Number($<HTMLInputElement>("bn-hours").value) || 16);
  const perHour = count.duration > 0 ? ((count.total + plus - minus) * 3600) / count.duration : 0;
  $("bn-day").textContent = `about ${Math.round(perHour * h).toLocaleString("en")} vehicles`;
}
$("bn-hours").addEventListener("input", renderDay);
$("bn-plus").addEventListener("click", () => {
  plus++;
  renderTotal();
});
$("bn-minus").addEventListener("click", () => {
  if (count && count.total + plus - minus > 0) minus++;
  renderTotal();
});
$("bn-reset").addEventListener("click", () => {
  plus = minus = 0;
  renderTotal();
});

function renderMinutes(): void {
  if (!count) return;
  const v = count.perMinute;
  const W = 640, H = 140, B = 18, max = Math.max(1, ...v);
  const bw = (W - 30) / v.length;
  let s = "";
  v.forEach((n, i) => {
    const h = ((H - B - 14) * n) / max;
    const x = 30 + i * bw;
    s += `<rect x="${x + 2}" y="${H - B - h}" width="${Math.max(2, bw - 4)}" height="${h}" fill="#f3c316"/><text x="${x + bw / 2}" y="${H - B - h - 3}" fill="#c9cdd2" font-size="11" text-anchor="middle">${n}</text><text x="${x + bw / 2}" y="${H - 4}" fill="#8b9096" font-size="10" text-anchor="middle">${i + 1}</text>`;
  });
  $("bn-minutes").innerHTML = s;
}

function setupVideo(): void {
  if (!result || !count) return;
  const v = $<HTMLVideoElement>("bn-video");
  const ov = $<HTMLCanvasElement>("bn-overlay");
  if (result.video) v.src = result.video;
  const frames = result.overlay?.frames ?? [];
  const passAt = new Map(count.passes.map((p) => [p.track, p.t]));
  const times = count.passes.map((p) => p.t);
  const paint = () => {
    const bw = v.clientWidth, bh = v.clientHeight;
    const vw = v.videoWidth || work[0], vh = v.videoHeight || work[1];
    const scale = Math.min(bw / vw, bh / vh);
    const pw = vw * scale, ph = vh * scale;
    const dpr = window.devicePixelRatio || 1;
    ov.style.left = `${(bw - pw) / 2}px`;
    ov.style.top = `${(bh - ph) / 2}px`;
    ov.style.width = `${pw}px`;
    ov.style.height = `${ph}px`;
    ov.width = Math.round(pw * dpr);
    ov.height = Math.round(ph * dpr);
    const g = ov.getContext("2d")!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, pw, ph);
    const k = pw / work[0];
    const t = v.currentTime;
    let lo = 0, hi = frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (frames[mid].t < t) lo = mid + 1;
      else hi = mid;
    }
    const f = frames[lo];
    let flash = false;
    if (f && Math.abs(f.t - t) < 0.5) {
      for (const [x1, y1, x2, y2, id, cls] of f.boxes) {
        if (!(cls in CLASS_NAME)) continue;
        const pt = passAt.get(id);
        const counted = pt !== undefined && pt <= t;
        if (pt !== undefined && Math.abs(pt - t) < 0.4) flash = true;
        g.lineWidth = counted ? 2.5 : 1.5;
        g.strokeStyle = counted ? "#3fd27f" : pt !== undefined ? "#f3c316" : "rgba(241,238,230,.55)";
        g.strokeRect(x1 * k, y1 * k, (x2 - x1) * k, (y2 - y1) * k);
      }
    }
    g.strokeStyle = flash ? "#3fd27f" : "#f3c316";
    g.lineWidth = flash ? 6 : 4;
    g.beginPath();
    g.moveTo(line[0][0] * k, line[0][1] * k);
    g.lineTo(line[1][0] * k, line[1][1] * k);
    g.stroke();
    let n = 0;
    while (n < times.length && times[n] <= t) n++;
    $("bn-live").textContent = String(n);
  };
  v.ontimeupdate = paint;
  v.onseeked = paint;
  v.onloadeddata = paint;
  const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback;
  if (rvfc) {
    const loop = () => {
      paint();
      rvfc.call(v, loop);
    };
    rvfc.call(v, loop);
  }
  window.addEventListener("resize", paint);
}

// ---------------------------------------------------------------- the log

interface LogRow {
  place: string;
  video: string;
  savedAt: string;
  seconds: number;
  vehicles: number;
  perHour: number;
  /** The model's count before the corrections by eye. */
  model?: number;
  plus?: number;
  minus?: number;
  byClass: Record<string, number>;
  detector: string;
}

function readLog(): LogRow[] {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? "[]") as LogRow[];
  } catch {
    return [];
  }
}

function renderLog(): void {
  const rows = readLog();
  const t = $("bn-log");
  if (!rows.length) {
    t.innerHTML = "<tr><td>No counts saved yet. Count a video and press Save.</td></tr>";
    return;
  }
  const places = new Map<string, LogRow[]>();
  for (const r of rows) places.set(r.place, [...(places.get(r.place) ?? []), r]);
  t.innerHTML =
    `<tr><th>Billboard</th><th>Saved</th><th>Video</th><th>Minutes counted</th><th>Vehicles</th><th>Per hour</th><th>Cars / buses / trucks / motorcycles (model)</th><th>Fixed by eye</th></tr>` +
    rows
      .map((r) => `<tr><td>${esc(r.place)}</td><td>${r.savedAt.replace("T", " ").slice(0, 16)}</td><td>${esc(r.video)}</td><td class="num">${(r.seconds / 60).toFixed(1)}</td><td class="num">${r.vehicles}</td><td class="num">${Math.round(r.perHour)}</td><td class="num">${r.byClass.car ?? 0} / ${r.byClass.bus ?? 0} / ${r.byClass.truck ?? 0} / ${r.byClass.motorcycle ?? 0}</td><td class="num">${r.plus || r.minus ? `+${r.plus ?? 0} / -${r.minus ?? 0}` : "none"}</td></tr>`)
      .join("") +
    [...places.entries()]
      .map(([p, rs]) => {
        const sec = rs.reduce((s, r) => s + r.seconds, 0), n = rs.reduce((s, r) => s + r.vehicles, 0);
        return `<tr><th>${esc(p)}: all counts</th><th></th><th>${rs.length} videos</th><th class="num">${(sec / 60).toFixed(1)}</th><th class="num">${n}</th><th class="num">${Math.round((n * 3600) / Math.max(1, sec))}</th><th></th><th></th></tr>`;
      })
      .join("");
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function csv(rows: (string | number)[][], name: string): void {
  const text = rows.map((r) => r.map((x) => (typeof x === "string" && /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x)).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

$("bn-save").addEventListener("click", () => {
  if (!count) return;
  const rows = readLog();
  rows.push({
    place: $<HTMLInputElement>("bn-place").value.trim() || "Unnamed billboard",
    video: sourceName,
    savedAt: new Date().toISOString(),
    seconds: Math.round(count.duration),
    vehicles: count.total + plus - minus,
    perHour: count.duration > 0 ? ((count.total + plus - minus) * 3600) / count.duration : 0,
    model: count.total,
    plus,
    minus,
    byClass: count.byClass,
    detector: $<HTMLSelectElement>("bn-model").value,
  });
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(rows));
  } catch {
    /* storage blocked: the CSV still works */
  }
  renderLog();
});

$("bn-csv").addEventListener("click", () => {
  if (!count) return;
  csv([["seconds", "type", "direction", "track"], ...count.passes.map((p) => [p.t.toFixed(1), CLASS_NAME[p.cls] ?? "other", p.dir > 0 ? "a" : "b", p.track])], `${sourceName || "video"}_passes.csv`);
});
$("bn-log-csv").addEventListener("click", () => {
  const rows = readLog();
  csv([["billboard", "saved", "video", "seconds", "vehicles", "per_hour", "model_count", "missed_added", "removed", "cars", "buses", "trucks", "motorcycles", "detector"], ...rows.map((r) => [r.place, r.savedAt, r.video, r.seconds, r.vehicles, Math.round(r.perHour), r.model ?? r.vehicles, r.plus ?? 0, r.minus ?? 0, r.byClass.car ?? 0, r.byClass.bus ?? 0, r.byClass.truck ?? 0, r.byClass.motorcycle ?? 0, r.detector])], "billboard_log.csv");
});

// ---------------------------------------------------------------- how exact

fetch("/data/banner.json")
  .then((r) => (r.ok ? r.json() : null))
  .then((d: { text?: string } | null) => {
    if (d?.text) $("bn-check").textContent = d.text;
  })
  .catch(() => undefined);
renderLog();

// The audit page (src/pages/audit.astro): choose a video, mark the stop lines and signal heads on
// its first frame, run the browser pipeline (local_api.ts: detector and tracker in a worker, the
// signal heads read on every frame), then the audit (src/oqim/audit.ts) and its report.

import { audit, type Audit, type ModeResult } from "../oqim/audit";
import { SAMPLE_CONFIG, SAMPLES } from "../oqim/samples";
import type { AuditConfig, Pt, Rect } from "../oqim/types";
import type { ClipResult } from "../lib/types";
import { CLASSES } from "../lib/classes";
import { ASSET_CDN } from "../config";
import { LocalApi, WORK_WIDTH } from "./local_api";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const COLORS = ["#f3c316", "#5ab0ff", "#ff7ac6", "#7ef0c6", "#ffa45b", "#c39bff"];
const api = new LocalApi();

let source: File | null = null;
let sourceUrl: string | null = null;
let work: [number, number] = [WORK_WIDTH, 1080];
let config: AuditConfig = { approaches: [], heads: [] };
let tool: "line" | "head" = "line";
let pending: Pt | null = null;
let hover: Pt | null = null;
let drag: Pt | null = null;
let still: HTMLCanvasElement | null = null;
let controller: AbortController | null = null;
let lastAudit: Audit | null = null;
let lastResult: ClipResult | null = null;
let n = 0;

const show = (id: string, on = true) => ($(id).hidden = !on);
const fmt = (x: number, d = 1) => (Number.isFinite(x) ? x.toFixed(d) : "n/a");
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

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
  v.removeAttribute("src");
  v.load();
  return c;
}

async function choose(file: File, preset: AuditConfig | null): Promise<void> {
  $("pick-status").textContent = "Opening the video...";
  if (sourceUrl) URL.revokeObjectURL(sourceUrl);
  source = file;
  sourceUrl = URL.createObjectURL(file);
  try {
    still = await firstFrame(sourceUrl);
  } catch (e) {
    $("pick-status").textContent = e instanceof Error ? e.message : String(e);
    return;
  }
  config = preset ? structuredClone(preset) : { approaches: [], heads: [] };
  n = config.approaches.length;
  pending = null;
  $("pick-status").textContent = `${file.name}: ${work[0]} x ${work[1]} work pixels.`;
  show("setup");
  show("report", false);
  draw();
  renderApproaches();
  $("setup").scrollIntoView({ behavior: "smooth", block: "start" });
}

$<HTMLInputElement>("file").addEventListener("change", (e) => {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (f) void choose(f, null);
});

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-sample]")) {
  b.addEventListener("click", async () => {
    const s = SAMPLES.find((x) => x.name === b.dataset.sample)!;
    $("pick-status").textContent = `Downloading ${s.name}...`;
    try {
      const blob = await download([`${ASSET_CDN}${s.url}`, s.url], (got, total) => {
        $("pick-status").textContent = `Downloading ${s.name}: ${(got / 1e6).toFixed(1)}${total ? ` of ${(total / 1e6).toFixed(0)}` : ""} MB`;
      });
      await choose(new File([blob], `${s.name}.mp4`, { type: "video/mp4" }), SAMPLE_CONFIG);
    } catch (e) {
      $("pick-status").textContent = `Could not download the sample (${e instanceof Error ? e.message : e}).`;
    }
  });
}

/** Of `urls` (one file on two hosts), the one that sends its first 256 KB fastest now, first on ties. */
async function fastest(urls: string[]): Promise<string[]> {
  const probe = async (url: string): Promise<number> => {
    const t0 = performance.now();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch(url, { headers: { Range: "bytes=0-262143" }, signal: ctl.signal, cache: "no-store" });
      if (!r.ok) return Infinity;
      await r.arrayBuffer();
      return performance.now() - t0;
    } catch {
      return Infinity;
    } finally {
      clearTimeout(timer);
    }
  };
  const t = await Promise.all(urls.map(probe));
  const order = urls.map((u, i) => [u, t[i]] as const).sort((a, b) => (b[1] < a[1] * 0.8 ? 1 : a[1] < b[1] * 0.8 ? -1 : 0));
  return order.map(([u]) => u);
}

/** The file at the fastest of `urls`, read with progress; the others are fallbacks. */
async function download(urls: string[], onProgress: (got: number, total: number) => void): Promise<Blob> {
  let last: unknown = null;
  for (const url of await fastest(urls)) {
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

// ---------------------------------------------------------------- marking

const canvas = $<HTMLCanvasElement>("frame");

function toWork(e: PointerEvent): Pt {
  const r = canvas.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * work[0], ((e.clientY - r.top) / r.height) * work[1]];
}

function draw(): void {
  if (!still) return;
  canvas.width = still.width;
  canvas.height = still.height;
  const g = canvas.getContext("2d")!;
  g.drawImage(still, 0, 0);
  const k = canvas.width / work[0];
  g.lineCap = "round";
  config.approaches.forEach((ap, i) => {
    const col = COLORS[i % COLORS.length];
    const [[x1, y1], [x2, y2]] = ap.line;
    g.strokeStyle = "rgba(0,0,0,.6)";
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(x1 * k, y1 * k);
    g.lineTo(x2 * k, y2 * k);
    g.stroke();
    g.strokeStyle = col;
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = col;
    g.font = "600 14px system-ui, sans-serif";
    g.fillText(`${i + 1} ${ap.name}`, Math.min(x1, x2) * k, Math.min(y1, y2) * k - 8);
  });
  config.heads.forEach((h, i) => {
    const used = config.approaches.findIndex((a) => a.head === i);
    g.strokeStyle = used >= 0 ? COLORS[used % COLORS.length] : "#f1eee6";
    g.lineWidth = 2;
    g.strokeRect(h[0] * k, h[1] * k, (h[2] - h[0]) * k, (h[3] - h[1]) * k);
    g.fillStyle = g.strokeStyle;
    g.font = "600 12px system-ui, sans-serif";
    g.fillText(`head ${i + 1}`, h[0] * k, h[3] * k + 14);
  });
  if (pending && hover) {
    g.strokeStyle = "#f3c316";
    g.setLineDash([6, 6]);
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(pending[0] * k, pending[1] * k);
    g.lineTo(hover[0] * k, hover[1] * k);
    g.stroke();
    g.setLineDash([]);
  }
  if (drag && hover && tool === "head") {
    g.strokeStyle = "#f1eee6";
    g.setLineDash([4, 4]);
    g.strokeRect(drag[0] * k, drag[1] * k, (hover[0] - drag[0]) * k, (hover[1] - drag[1]) * k);
    g.setLineDash([]);
  }
}

canvas.addEventListener("pointerdown", (e) => {
  const p = toWork(e);
  if (tool === "line") {
    if (!pending) pending = p;
    else {
      if (Math.hypot(p[0] - pending[0], p[1] - pending[1]) > 10) {
        n++;
        config.approaches.push({ id: `a${n}`, name: `Approach ${n}`, line: [pending, p], head: null });
        renderApproaches();
      }
      pending = null;
    }
  } else drag = p;
  draw();
});
canvas.addEventListener("pointermove", (e) => {
  hover = toWork(e);
  if (pending || drag) draw();
});
canvas.addEventListener("pointerup", (e) => {
  if (tool !== "head" || !drag) return;
  const p = toWork(e);
  let r: Rect;
  if (Math.hypot(p[0] - drag[0], p[1] - drag[1]) > 8)
    r = [Math.min(p[0], drag[0]), Math.min(p[1], drag[1]), Math.max(p[0], drag[0]), Math.max(p[1], drag[1])];
  else r = [p[0] - 18, p[1] - 36, p[0] + 18, p[1] + 36];
  drag = null;
  config.heads.push(r);
  // to the last approach that has no head yet
  const free = [...config.approaches].reverse().find((a) => a.head === null);
  if (free) free.head = config.heads.length - 1;
  renderApproaches();
  draw();
});

for (const b of document.querySelectorAll<HTMLButtonElement>("[data-tool]")) {
  b.addEventListener("click", () => {
    tool = b.dataset.tool as "line" | "head";
    pending = null;
    for (const x of document.querySelectorAll<HTMLButtonElement>("[data-tool]")) x.setAttribute("aria-pressed", String(x === b));
    draw();
  });
}
$("undo").addEventListener("click", () => {
  if (pending) pending = null;
  else if (tool === "head" && config.heads.length) {
    const k = config.heads.length - 1;
    config.heads.pop();
    for (const a of config.approaches) if (a.head === k) a.head = null;
  } else config.approaches.pop();
  renderApproaches();
  draw();
});
$("clear").addEventListener("click", () => {
  config = { approaches: [], heads: [] };
  pending = null;
  renderApproaches();
  draw();
});

function renderApproaches(): void {
  const list = $("approaches");
  list.innerHTML = "";
  config.approaches.forEach((ap, i) => {
    const li = document.createElement("li");
    li.className = "ap-item";
    const opts = [`<option value="">no head: from the traffic</option>`]
      .concat(config.heads.map((_, k) => `<option value="${k}" ${ap.head === k ? "selected" : ""}>head ${k + 1}</option>`))
      .join("");
    li.innerHTML = `<span class="sw" style="background:${COLORS[i % COLORS.length]}"></span>
      <input type="text" value="${esc(ap.name)}" aria-label="Name of approach ${i + 1}" />
      <button class="x" type="button" aria-label="Remove approach ${i + 1}">&times;</button>
      <span class="row2">Lights <select aria-label="Signal head of approach ${i + 1}">${opts}</select></span>`;
    li.querySelector("input")!.addEventListener("input", (e) => {
      ap.name = (e.target as HTMLInputElement).value || `Approach ${i + 1}`;
      draw();
    });
    li.querySelector("select")!.addEventListener("change", (e) => {
      const v = (e.target as HTMLSelectElement).value;
      ap.head = v === "" ? null : Number(v);
      draw();
    });
    li.querySelector(".x")!.addEventListener("click", () => {
      config.approaches.splice(i, 1);
      renderApproaches();
      draw();
    });
    list.append(li);
  });
  const ok = config.approaches.length > 0;
  $<HTMLButtonElement>("run").disabled = !ok;
  $("run-hint").textContent = ok
    ? `${config.approaches.length} approach${config.approaches.length > 1 ? "es" : ""}, ${config.approaches.filter((a) => a.head !== null).length} with a signal head.`
    : "Mark at least one stop line.";
}

// ---------------------------------------------------------------- running

$("run").addEventListener("click", () => void run());
$("cancel").addEventListener("click", () => controller?.abort());
$("again").addEventListener("click", () => {
  show("report", false);
  $("pick").scrollIntoView({ behavior: "smooth" });
});

async function run(): Promise<void> {
  if (!source) return;
  show("running");
  show("report", false);
  $("running").scrollIntoView({ behavior: "smooth", block: "start" });
  controller = new AbortController();
  const health = await api.health();
  if (health !== "ok") {
    $("stage").textContent = "This browser cannot run the pipeline (it needs Web Workers, WebAssembly and a canvas).";
    return;
  }
  $("backend").textContent = api.backend === "webgpu" ? "The detector runs on this device's GPU (WebGPU)." : "No WebGPU here: the detector runs on the CPU (WebAssembly), which is several times slower. Chrome or Edge on a laptop is faster.";
  api.heads = config.heads.map((h) => [...h] as Rect);
  api.model = $<HTMLSelectElement>("model").value;
  const limit = Number($<HTMLSelectElement>("limit").value);
  let id: string;
  try {
    id = await api.submitFile(source, controller.signal, limit);
  } catch (e) {
    $("stage").textContent = e instanceof Error ? e.message : String(e);
    return;
  }
  const started = performance.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, 400));
    const j = await api.job(id).catch(() => null);
    if (!j) return;
    $("fill").style.width = `${Math.round(j.progress * 100)}%`;
    $("stage").textContent = j.stage;
    $("pct").textContent = `${Math.round(j.progress * 100)}%`;
    $("eta").textContent = j.eta_sec ? `about ${j.eta_sec} s left` : "";
    if (j.status === "error") {
      $("stage").textContent = j.error ?? "The analysis failed.";
      return;
    }
    if (j.status === "done" && j.result) {
      $("stage").textContent = `Done in ${fmt((performance.now() - started) / 1000, 0)} s. Building the audit...`;
      await new Promise((r) => setTimeout(r, 30));
      finish(j.result);
      return;
    }
  }
}

function finish(result: ClipResult): void {
  lastResult = result;
  const a = audit({
    config,
    frames: result.overlay?.frames ?? [],
    heads: result.heads ?? { t: [], scores: [] },
    duration: result.duration,
  });
  lastAudit = a;
  try {
    sessionStorage.setItem("oqim:last", JSON.stringify(networkInput(a, result)));
  } catch {
    /* private mode: the network page falls back to the sample */
  }
  show("running", false);
  show("report");
  renderReport(a, result);
  $("report").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------------------------------------------------------- report

function bestPlan(a: Audit): { now: ModeResult; best: ModeResult } {
  const now = a.modes.find((m) => m.key === "measured")!;
  const best = a.modes.filter((m) => m.key !== "measured").sort((x, y) => x.sim.vehHours - y.sim.vehHours)[0];
  return { now, best };
}

function planText(a: Audit, m: ModeResult): string {
  if (!m.greens) return m.note;
  const names = a.order.map((g) => a.approaches.filter((x) => x.group === g).map((x) => x.name).join(" + "));
  return `cycle ${fmt(m.cycle ?? 0, 0)} s: ` + m.greens.map((g, o) => `${esc(names[o])} green ${fmt(g, 0)} s`).join(", ") + (a.hidden > 0 ? ", the rest to the phases out of view" : "");
}

function renderReport(a: Audit, r: ClipResult): void {
  const { now, best } = bestPlan(a);
  const gain = now.sim.meanDelay > 0 ? 1 - best.sim.meanDelay / now.sim.meanDelay : 0;
  const runs = a.approaches.reduce((s, x) => s + x.redRuns.length, 0);
  const vehicles = a.approaches.reduce((s, x) => s + x.vehicles, 0);
  $("verdict").innerHTML =
    gain > 0.05
      ? `<strong>${esc(best.label)}</strong> cuts the mean wait at the stop line from <strong>${fmt(now.sim.meanDelay)} s</strong> to <strong class="good">${fmt(best.sim.meanDelay)} s</strong> per vehicle (${fmt(gain * 100, 0)}% less) on this clip's own ${vehicles} vehicles. Plan: ${planText(a, best)}.`
      : `<strong>Keep the current timing.</strong> None of the plans we tried beats it by more than 5% on this clip's own ${vehicles} vehicles: the best one, ${esc(best.label)}, gives ${fmt(best.sim.meanDelay)} s of waiting per vehicle against ${fmt(now.sim.meanDelay)} s now. ${a.oversaturated ? "Demand is near capacity, so retiming alone will not help." : ""}`;
  const stat = (v: string, l: string) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`;
  const first = a.approaches[0];
  $("stats").innerHTML = [
    stat(a.cycle ? `${fmt(a.cycle, 0)} s` : "n/a", "signal cycle"),
    stat(String(vehicles), `vehicles over the stop lines in ${fmt(a.duration / 60, 1)} min`),
    stat(`${fmt(now.sim.meanDelay)} s`, "mean wait now, per vehicle"),
    stat(first ? `${fmt(first.arrivalsOnGreen * 100, 0)}%` : "n/a", `arrive on green (${esc(first?.name ?? "")})`),
    stat(String(runs), "crossed more than 1 s into red"),
    stat(`${fmt(a.check.departureError)} s`, "model check: median error"),
  ].join("");

  // plans
  const maxD = Math.max(...a.modes.map((m) => m.sim.meanDelay), 1);
  $("plans").innerHTML = `<div class="scroll-x"><table class="t"><thead><tr><th>Plan</th><th>What it does</th><th>Mean wait, s per vehicle</th><th class="num">vs now</th><th class="num">Vehicle-hours waiting</th><th class="num">Left waiting at the end</th></tr></thead><tbody>${a.modes
    .map((m) => {
      const d = now.sim.meanDelay > 0 ? m.sim.meanDelay / now.sim.meanDelay - 1 : 0;
      return `<tr class="${m === best && gain > 0.05 ? "best" : ""}"><td><strong>${esc(m.label)}</strong></td><td class="note">${m.greens ? planText(a, m) : esc(m.note)}</td>
        <td><div style="display:flex;gap:8px;align-items:center"><span class="mono">${fmt(m.sim.meanDelay)}</span><div class="delay-bar" style="width:${(120 * m.sim.meanDelay) / maxD}px"></div></div></td>
        <td class="num ${m.key === "measured" ? "" : d < -0.02 ? "good" : d > 0.02 ? "bad" : ""}">${m.key === "measured" ? "" : `${d > 0 ? "+" : ""}${fmt(d * 100, 0)}%`}</td>
        <td class="num">${fmt(m.sim.vehHours, 2)}</td><td class="num">${m.sim.leftWaiting}</td></tr>`;
    })
    .join("")}</tbody></table></div>`;
  $("check").textContent = `Model check: replayed under the lights read from the video, the model sends ${a.check.vehicles} vehicles over the line with a median error of ${fmt(a.check.departureError, 2)} s against the video, and gives a mean wait of ${fmt(a.check.modelWait)} s against ${fmt(a.check.measuredWait)} s measured (time standing before the line). Plans are judged only after this check.`;

  renderEvents(a, r);
  renderPcd(a);
  renderTimeline(a);
  renderApproachTable(a);
  setupVideo(a, r);
  renderMoney();
  $("warnings").innerHTML = a.warnings.map((w) => `<li>${esc(w)}</li>`).join("");
}

function renderTimeline(a: Audit): void {
  const W = 1000, rowH = 54, left = 120, top = 10;
  const H = top + a.approaches.length * rowH + 28;
  const x = (t: number) => left + ((W - left - 10) * t) / Math.max(1, a.duration);
  const now = a.modes.find((m) => m.key === "measured")!;
  const parts: string[] = [];
  a.approaches.forEach((ap, i) => {
    const y = top + i * rowH;
    parts.push(`<g class="tl-row"><text x="0" y="${y + 30}">${esc(ap.name.slice(0, 14))}</text>`);
    parts.push(`<rect x="${left}" y="${y + 22}" width="${W - left - 10}" height="12" fill="${ap.source === "head" ? "var(--asphalt-3)" : "var(--sig-red-soft)"}" />`);
    for (const r of ap.reds ?? []) parts.push(`<rect x="${x(r.start)}" y="${y + 22}" width="${Math.max(1, x(r.end) - x(r.start))}" height="12" fill="var(--sig-red)" opacity=".75" />`);
    for (const g of ap.greens) parts.push(`<rect x="${x(g.start)}" y="${y + 22}" width="${Math.max(1, x(g.end) - x(g.start))}" height="12" fill="var(--sig-green)" opacity=".85" />`);
    for (const c of ap.crossings) parts.push(`<line x1="${x(c.t)}" x2="${x(c.t)}" y1="${y + 36}" y2="${y + 44}" stroke="${c.light === "red" ? "var(--sig-red)" : "var(--paint)"}" stroke-width="1" />`);
    const q = now.sim.queue[i] ?? [];
    const qmax = Math.max(1, ...q);
    const pts = q.map((v, s) => `${x(s)},${y + 20 - (16 * v) / qmax}`).join(" ");
    parts.push(`<polyline points="${pts}" fill="none" stroke="var(--zebra)" stroke-width="1.2" /><text x="${W - 8}" y="${y + 12}" text-anchor="end">queue up to ${qmax}</text></g>`);
  });
  for (let t = 0; t <= a.duration; t += 30) parts.push(`<text x="${x(t)}" y="${H - 6}" text-anchor="middle" fill="var(--muted)" font-size="11" font-family="monospace">${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}</text>`);
  $("timeline").innerHTML = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Signal lights per approach over the clip, with each vehicle crossing as a tick and the queue as a line">${parts.join("")}</svg>
    <p class="hint">Green and red: the lights${a.approaches.some((p) => p.source === "motion") ? " (pale red row: read from the traffic, not from a head)" : ""}. Ticks: vehicles over the stop line, red when on red. Yellow line: vehicles waiting. Click to jump the video there.</p>`;
  $("timeline").querySelector("svg")!.addEventListener("click", (e) => {
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    const t = ((vx - left) / (W - left - 10)) * a.duration;
    const v = $<HTMLVideoElement>("video");
    if (t >= 0 && t <= a.duration) v.currentTime = t;
  });
}

function renderApproachTable(a: Audit): void {
  const rows = a.approaches.map(
    (ap) => `<tr><td><strong>${esc(ap.name)}</strong><div class="note">${ap.source === "head" ? "lights from its head" : "lights from its traffic"}</div></td>
      <td class="num">${ap.vehicles}</td><td class="num">${fmt(ap.flowPerHour, 0)}</td><td class="num">${fmt(ap.meanWait)}</td>
      <td class="num">${fmt(ap.arrivalsOnGreen * 100, 0)}%</td><td class="num">${ap.greenMean ? fmt(ap.greenMean, 0) : "n/a"}</td>
      <td class="num">${fmt(3600 / ap.headway, 0)}${ap.headwayMeasured ? "" : "*"}</td><td class="num">${ap.maxQueue}</td><td class="num">${ap.redRuns.length}</td></tr>`,
  );
  $("approach-table").innerHTML = `<div class="scroll-x"><table class="t"><thead><tr><th>Approach</th><th class="num">Vehicles</th><th class="num">Per hour</th><th class="num">Wait, s</th><th class="num">On green</th><th class="num">Green, s</th><th class="num">Discharge, veh/h of green</th><th class="num">Max queue</th><th class="num">On red</th></tr></thead><tbody>${rows.join("")}</tbody></table></div>
    <p class="hint">Wait: seconds standing before the line, per vehicle. On green: share of vehicles that reached the line on green. Discharge: the busiest 10 s of each green${a.approaches.some((p) => !p.headwayMeasured) ? "; * assumed, too few queues" : ""}. On red: crossed the line more than 1 s after red began (a free right turn shows here too).</p>`;
}

function setupVideo(a: Audit, r: ClipResult): void {
  const v = $<HTMLVideoElement>("video");
  const ov = $<HTMLCanvasElement>("overlay");
  if (r.video) v.src = r.video;
  const frames = r.overlay?.frames ?? [];
  const paint = () => {
    // the canvas covers the picture exactly: the video's box, minus letterboxing, at device pixels
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
    // the analysed frame nearest t
    let lo = 0, hi = frames.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (frames[mid].t < t) lo = mid + 1;
      else hi = mid;
    }
    const f = frames[lo];
    if (f && Math.abs(f.t - t) < 0.5) {
      g.lineWidth = 1.5;
      for (const [x1, y1, x2, y2, , cls] of f.boxes) {
        if (![2, 3, 5, 7].includes(cls)) continue;
        g.strokeStyle = "rgba(241,238,230,.8)";
        g.strokeRect(x1 * k, y1 * k, (x2 - x1) * k, (y2 - y1) * k);
      }
    }
    a.approaches.forEach((ap, i) => {
      const cfg = config.approaches.find((c) => c.id === ap.id);
      if (!cfg) return;
      const green = ap.greens.some((gr) => t >= gr.start && t < gr.end);
      const [[x1, y1], [x2, y2]] = cfg.line;
      g.strokeStyle = green ? "#3fd27f" : "#ff5b4c";
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(x1 * k, y1 * k);
      g.lineTo(x2 * k, y2 * k);
      g.stroke();
      g.fillStyle = COLORS[i % COLORS.length];
      g.font = "600 13px system-ui, sans-serif";
      g.fillText(ap.name, Math.min(x1, x2) * k, Math.min(y1, y2) * k - 6);
    });
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

function renderMoney(): void {
  const a = lastAudit;
  if (!a) return;
  const { now, best } = bestPlan(a);
  const val = (id: string) => Number($<HTMLInputElement>(id).value) || 0;
  const perHour = Math.max(0, now.sim.vehHours - best.sim.vehHours) / Math.max(1e-6, a.duration / 3600);
  const vehH = perHour * val("m-hours") * val("m-days");
  const litres = vehH * val("m-fuel");
  const usd = vehH * val("m-occ") * val("m-vot") + litres * val("m-price");
  $("money-out").innerHTML =
    perHour > 0
      ? `${esc(best.label)} saves <strong>${fmt(perHour, 2)}</strong> vehicle-hours of waiting per hour of this traffic, so about <strong>${fmt(vehH, 0)}</strong> vehicle-hours, <strong>${fmt(litres, 0)}</strong> litres of fuel (${fmt((litres * 2.31) / 1000, 1)} t of CO2 at 2.31 kg a litre) and <strong>USD ${fmt(usd, 0)}</strong> a year at this one junction.`
      : "No plan we tried saves waiting time on this clip, so there is nothing to count.";
}
for (const id of ["m-hours", "m-days", "m-occ", "m-vot", "m-fuel", "m-price"]) $(id).addEventListener("input", renderMoney);

$("export").addEventListener("click", () => {
  if (!lastAudit) return;
  const slim = {
    ...lastAudit,
    config,
    clip: lastResult?.clip,
    modes: lastAudit.modes.map((m) => ({ ...m, sim: { ...m.sim, departures: undefined, queue: undefined } })),
  };
  const blob = new Blob([JSON.stringify(slim, null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `oqim_audit_${(lastResult?.clip ?? "clip").replace(/\.[^.]+$/, "")}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

/** What the 3D corridor page (src/scripts/network.ts) needs from an audit: the first approach's
 * measured arrivals (as gaps), its lights and the plans, and each vehicle's class. */
function networkInput(a: Audit, r: ClipResult) {
  const ap = a.approaches[0];
  const byTrack = new Map<number, number>();
  for (const f of r.overlay?.frames ?? []) for (const b of f.boxes) if (!byTrack.has(b[4])) byTrack.set(b[4], b[5]);
  const tuned = a.modes.find((m) => m.key === "tuned");
  const pred = a.modes.find((m) => m.key === "predictive");
  return {
    clip: r.clip,
    duration: a.duration,
    approach: ap?.name ?? "",
    arrivals: (ap?.crossings ?? []).map((c) => ({ t: c.arrival, cls: byTrack.get(c.track) ?? 2 })).sort((x, y) => x.t - y.t),
    cycle: a.cycle ?? 90,
    green: ap?.greenMean ?? 30,
    headway: ap?.headway ?? 2,
    tunedCycle: tuned?.cycle ?? a.cycle ?? 90,
    tunedGreen: tuned?.greens?.[0] ?? ap?.greenMean ?? 30,
    nowWait: a.modes[0].sim.meanDelay,
    predictiveWait: pred?.sim.meanDelay ?? null,
  };
}

// ---------------------------------------------------------------- events and the coordination diagram

const EVENT_COLOR: Record<string, string> = {
  red_light: "#ff5b4c", stop_line: "#ffa45b", failure_to_yield: "#ff7ac6", wrong_way: "#c39bff", accident: "#ff3b30",
  congestion: "#ffb224", jaywalking: "#5ab0ff", stopped_vehicle: "#9aa0a8", red_light_run: "#ff5b4c",
};
const eventName = (k: string) => CLASSES.find((c) => c.key === k)?.name ?? k.replace(/_/g, " ");

/** The elimination rules' events (src/pipeline: every rule on our junction's map, or on any other
 * view the rules that need no map: wrong way and collisions), plus the audit's red-light runs. */
function renderEvents(a: Audit, r: ClipResult): void {
  const items: { start: number; end: number; label: string; note: string }[] = (r.events ?? []).map(([s0, e0, l]) => ({ start: s0, end: e0, label: l, note: "" }));
  const ev = r.evidence ?? [];
  for (const it of items) {
    const e = ev.find((x) => x.label === it.label && x.start < it.end && x.end > it.start);
    if (e) it.note = e.note;
  }
  // the audit's own red-light runs, on any view with a signal head marked
  if (r.mode === "generic")
    for (const ap of a.approaches) for (const c of ap.redRuns) items.push({ start: c.t, end: c.t + 1.5, label: "red_light", note: `${ap.name}: crossed ${(c.t).toFixed(1)} s, on red` });
  items.sort((x, y) => x.start - y.start);
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it.label, (counts.get(it.label) ?? 0) + 1);
  const W = 1000, H = 40, x = (t: number) => (W * t) / Math.max(1, a.duration);
  const bars = items.map((it) => `<rect x="${x(it.start)}" y="8" width="${Math.max(2, x(it.end) - x(it.start))}" height="24" fill="${EVENT_COLOR[it.label] ?? "#f1eee6"}" opacity=".85"><title>${esc(eventName(it.label))} ${it.start.toFixed(1)} to ${it.end.toFixed(1)} s</title></rect>`).join("");
  const scope = r.mode === "junction"
    ? "All the elimination rules ran: this is our junction's view, with its map of lanes, crossings and the signal."
    : "A view that is not our junction: the rules that need no map ran (wrong way learned from the traffic itself, collisions in metres from the vehicle sizes), plus the red-light runs the audit found at each marked signal head.";
  $("events").innerHTML = items.length
    ? `<div class="ev-chips">${[...counts].map(([k, n]) => `<span class="ev-chip"><span class="swatch" style="background:${EVENT_COLOR[k] ?? "#f1eee6"}"></span>${esc(eventName(k))}<b>${n}</b></span>`).join("")}</div>
       <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Events along the clip"><rect x="0" y="8" width="${W}" height="24" fill="var(--asphalt-3)" />${bars}</svg>
       <ul class="ev-list">${items.map((it, i) => `<li><button type="button" data-ev="${i}"><span class="mono">${fmt(it.start)} to ${fmt(it.end)} s</span><span><span class="swatch" style="background:${EVENT_COLOR[it.label] ?? "#f1eee6"}"></span>${esc(eventName(it.label))}</span><span class="note">${esc(it.note)}</span></button></li>`).join("")}</ul>
       <p class="hint">${scope} Click an event to jump the video there.</p>`
    : `<p class="hint">No events found. ${scope}</p>`;
  for (const b of $("events").querySelectorAll<HTMLButtonElement>("[data-ev]"))
    b.addEventListener("click", () => {
      const v = $<HTMLVideoElement>("video");
      v.currentTime = Math.max(0, items[Number(b.dataset.ev)].start - 1);
      v.scrollIntoView({ behavior: "smooth", block: "center" });
    });
}

/**
 * Purdue coordination diagram (the ATSPM chart): one column per signal cycle, starting at the
 * start of red; each vehicle is a dot at the second of its cycle it reached the stop line, green
 * when the light was green. Dots above the green line arrived on green.
 */
function renderPcd(a: Audit): void {
  const parts: string[] = [];
  const W = 1000, rowH = 150, left = 120;
  const usable = a.approaches.filter((ap) => ap.greens.length >= 2);
  if (!usable.length) {
    $("pcd").innerHTML = `<p class="hint">Needs at least two greens on one approach.</p>`;
    return;
  }
  const H = usable.length * (rowH + 30) + 24;
  const x = (t: number) => left + ((W - left - 10) * t) / Math.max(1, a.duration);
  usable.forEach((ap, k) => {
    const top = 10 + k * (rowH + 30);
    // starts of red: the end of every green
    const reds = ap.greens.map((g) => g.end).filter((t) => t < a.duration);
    const cycleMax = Math.max(60, ...reds.slice(1).map((r0, i) => r0 - reds[i]));
    const y = (s: number) => top + rowH - (rowH * Math.min(s, cycleMax)) / cycleMax;
    parts.push(`<text x="0" y="${top + 14}">${esc(ap.name.slice(0, 14))}</text><text x="0" y="${top + 30}">${fmt(ap.arrivalsOnGreen * 100, 0)}% on green</text>`);
    parts.push(`<line x1="${left}" x2="${W - 10}" y1="${top + rowH}" y2="${top + rowH}" stroke="var(--line-2)" />`);
    for (let i = 0; i < reds.length; i++) {
      const r0 = reds[i], r1 = reds[i + 1] ?? a.duration;
      const g = ap.greens.find((gr) => gr.start >= r0 - 0.5 && gr.start < r1);
      if (g) parts.push(`<line x1="${x(r0)}" x2="${x(r1)}" y1="${y(g.start - r0)}" y2="${y(g.start - r0)}" stroke="var(--sig-green)" stroke-width="2" />`);
      parts.push(`<line x1="${x(r0)}" x2="${x(r0)}" y1="${top}" y2="${top + rowH}" stroke="var(--line)" />`);
      for (const c of ap.crossings) {
        if (c.arrival < r0 || c.arrival >= r1) continue;
        const onGreen = g ? c.arrival >= g.start : false;
        parts.push(`<circle cx="${x(r0) + ((x(r1) - x(r0)) * 0.5) + ((c.track % 7) - 3)}" cy="${y(c.arrival - r0)}" r="2.6" fill="${onGreen ? "var(--sig-green)" : "var(--sig-red)"}" />`);
      }
    }
    parts.push(`<text x="${left - 6}" y="${top + 4}" text-anchor="end">${fmt(cycleMax, 0)} s</text><text x="${left - 6}" y="${top + rowH}" text-anchor="end">0</text>`);
  });
  // per green: vehicles waiting when it began, served during it, and left for the next one
  const cyc: string[] = [];
  const CH = 110;
  usable.forEach((ap, k) => {
    const rows = ap.greens.filter((g) => g.end <= a.duration).map((g) => {
      const queued = ap.crossings.filter((c) => c.arrival < g.start - 0.5 && c.t >= g.start - 0.5).length;
      const served = ap.crossings.filter((c) => c.t >= g.start && c.t < g.end + 3).length;
      const left = ap.crossings.filter((c) => c.arrival < g.start - 0.5 && c.t > g.end + 3).length;
      return { g, queued, served, left };
    });
    const maxN = Math.max(1, ...rows.map((r) => Math.max(r.served, r.queued)));
    const top = 10 + k * (CH + 34);
    cyc.push(`<text x="0" y="${top + 14}">${esc(ap.name.slice(0, 14))}</text>`);
    rows.forEach((r) => {
      const cx = x(r.g.start), w = Math.max(6, x(r.g.end) - x(r.g.start) - 4);
      const hS = (CH * r.served) / maxN, hQ = (CH * r.queued) / maxN;
      cyc.push(`<rect x="${cx}" y="${top + CH - hS}" width="${w}" height="${hS}" fill="var(--sig-green)" opacity=".75"><title>${r.served} served</title></rect>`);
      cyc.push(`<rect x="${cx + w * 0.25}" y="${top + CH - hQ}" width="${w * 0.5}" height="${hQ}" fill="var(--zebra)" opacity=".9"><title>${r.queued} waiting at the start of green</title></rect>`);
      if (r.left) cyc.push(`<text x="${cx + w / 2}" y="${top - 2}" text-anchor="middle" fill="var(--sig-red)">${r.left} left</text>`);
    });
    cyc.push(`<line x1="${left}" x2="${W - 10}" y1="${top + CH}" y2="${top + CH}" stroke="var(--line-2)" />`);
  });
  const cycH = usable.length * (CH + 34) + 10;
  $("pcd").innerHTML = `<div class="pcd-wrap"><svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Purdue coordination diagram per approach">${parts.join("")}</svg></div>
    <p class="k" style="margin-top:16px">Each green: vehicles waiting when it began (yellow), served during it (green), left for the next green (red, a split failure)</p>
    <div class="pcd-wrap"><svg viewBox="0 0 ${W} ${cycH}" width="100%" role="img" aria-label="Vehicles served and left per green">${cyc.join("")}</svg></div>
    <p class="hint">The chart traffic engineers in the US read from controller logs (ATSPM); here it comes from the video. One column per cycle, from the start of red. Dots: vehicles reaching the stop line, at the second of the cycle they arrived; green when the light was green. Green line: when the green began. Dots below it waited at a red; coordination with the junction upstream moves them above it.</p>`;
}

// The parking tracker page: three PKLot car-park cameras replayed on one clock, the free spaces
// each sees, the cars coming in and leaving, the forecast for the minute a driver arrives, and the
// advice of where to park, for one driver and for many asking at once.

import { ASSET_CDN } from "../config";
import { clock, forecast, frameAt, minutes, options, spread, taken, takenTrue, wholeLot, type Lot, type Trip } from "../oqim/tracker";

interface Data {
  source: string;
  detector: string;
  clock: { start: string; end: string };
  lots: Lot[];
  eval: {
    frames: number;
    spaces: number;
    accuracy: number;
    freeErr: { median: number; p90: number; mean: number };
    events: { in: number; out: number };
    whole: { labelled: number; extra: number; labelledUsed: number; labelledFound: number; text: string };
    forecast: { h: number; mae: number; naiveMae: number; rmse: number; n: number };
    forecastByH: { h: number; mae: number; naiveMae: number; rmse: number; n: number }[];
  };
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const canvas = $<HTMLCanvasElement>("tr-canvas");
const ctx = canvas.getContext("2d")!;
const TRIPS: Trip[] = [
  { drive: 6, walk: 2 },
  { drive: 8, walk: 4 },
  { drive: 9, walk: 5 },
];

let data: Data;
let whole: Lot[] = [];
let mode: "whole" | "labelled" = "whole";
/** The car parks as shown: every space the camera found, or the hand-labelled ones only. */
const L = () => (mode === "whole" ? whole : data.lots);
let sel = 0;
let t0 = 0, t1 = 0, now = 0;
let playing = true;
let speed = 5; // minutes of the morning per second
let shownFrame = -1;
const images = new Map<string, HTMLImageElement>();

function img(src: string): HTMLImageElement {
  let im = images.get(src);
  if (!im) {
    im = new Image();
    im.decoding = "async";
    im.src = ASSET_CDN + src;
    im.onerror = () => {
      if (im!.src.startsWith(ASSET_CDN)) im!.src = src; // not pushed yet: this site's copy
    };
    im.onload = () => draw(true);
    images.set(src, im);
  }
  return im;
}

function sigma(h: number) {
  const B = data.eval.forecastByH;
  if (h <= B[0].h) return Math.max(1, (B[0].rmse * h) / B[0].h);
  for (let i = 0; i + 1 < B.length; i++) if (h <= B[i + 1].h) return B[i].rmse + ((B[i + 1].rmse - B[i].rmse) * (h - B[i].h)) / (B[i + 1].h - B[i].h);
  return B[B.length - 1].rmse;
}

function recentSlope(lot: Lot, k: number) {
  const m = minutes(lot.frames[k].t);
  const j = frameAt(lot, m - 15);
  if (j < 0 || j >= k) return 0;
  return (taken(lot.frames[k]) - taken(lot.frames[j])) / (m - minutes(lot.frames[j].t));
}

// ---------------------------------------------------------------- camera

function draw(force = false) {
  const lot = L()[sel];
  const k = frameAt(lot, now);
  $("tr-cam-name").textContent = `${lot.name}, ${lot.weekday} ${lot.date}`;
  if (k < 0) {
    ctx.fillStyle = "#0d0e10";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#9aa0a6";
    ctx.font = "20px system-ui, sans-serif";
    ctx.fillText(`This camera's recording starts at ${lot.frames[0].t}`, 40, canvas.height / 2);
    $("tr-cam-time").textContent = "";
    $("tr-cam-free").textContent = "..";
    $("tr-cam-of").textContent = "";
    shownFrame = -1;
    return;
  }
  const f = lot.frames[k];
  const key = sel * 1000 + k;
  const im = img(f.src);
  if (!im.complete || !im.naturalWidth) {
    // keep the last frame until this one arrives
    if (!force) return;
  }
  if (key !== shownFrame && k > 0 && shownFrame >= 0 && Math.floor(shownFrame / 1000) === sel) flash(lot, k);
  if (im.complete && im.naturalWidth) {
    canvas.width = lot.w;
    canvas.height = lot.h;
    ctx.drawImage(im, 0, 0, lot.w, lot.h);
    const prev = k > 0 ? lot.frames[k - 1].det : f.det;
    lot.spaces.forEach((poly, i) => {
      const on = f.det[i] === "1";
      const changed = prev[i] !== f.det[i];
      ctx.beginPath();
      poly.forEach(([x, y], j) => (j ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = on ? "rgba(255, 91, 76, 0.32)" : "rgba(63, 210, 127, 0.38)";
      ctx.fill();
      ctx.setLineDash(lot.labelled !== undefined && i >= lot.labelled && !changed ? [5, 3] : []);
      ctx.lineWidth = changed ? 3.5 : 1.4;
      ctx.strokeStyle = changed ? (on ? "#ffb224" : "#ffffff") : on ? "rgba(255, 91, 76, 0.9)" : "rgba(63, 210, 127, 0.95)";
      ctx.stroke();
    });
    ctx.setLineDash([]);
    shownFrame = key;
  }
  $("tr-cam-time").textContent = f.t;
  $("tr-cam-free").textContent = String(lot.capacity - taken(f));
  $("tr-cam-of").textContent = `free of ${lot.capacity}`;
}

function flash(lot: Lot, k: number) {
  const f = lot.frames[k];
  const box = $("tr-flash");
  const add = (text: string) => {
    const s = document.createElement("span");
    s.textContent = text;
    box.append(s);
    setTimeout(() => s.remove(), 1700);
  };
  if (f.in) add(`${f.t}  ${f.in} came in`);
  if (f.out) add(`${f.t}  ${f.out} left`);
}

// ---------------------------------------------------------------- side panels

function lotCards() {
  const box = $("tr-lots");
  box.innerHTML = "";
  L().forEach((lot, i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "lot";
    b.dataset.i = String(i);
    b.innerHTML = `<img alt="" /><div><div class="nm"></div><div class="sub"></div><div class="fr"></div><div class="bar"><i></i></div><div class="tr"></div></div>`;
    b.querySelector(".nm")!.textContent = lot.name;
    b.querySelector(".sub")!.textContent = `${lot.capacity} spaces, ${lot.weekday} ${lot.date}`;
    b.addEventListener("click", () => {
      sel = i;
      shownFrame = -1;
      update(true);
    });
    box.append(b);
  });
}

function updateCards() {
  L().forEach((lot, i) => {
    const b = $("tr-lots").children[i] as HTMLElement;
    b.setAttribute("aria-pressed", String(i === sel));
    const k = frameAt(lot, now);
    const im = b.querySelector("img")!;
    if (k < 0) {
      b.querySelector(".fr")!.textContent = `recording starts ${lot.frames[0].t}`;
      b.querySelector(".tr")!.textContent = "";
      (b.querySelector(".bar i") as HTMLElement).style.width = "0";
      return;
    }
    const f = lot.frames[k];
    const src = img(f.src).src;
    if (im.src !== src) im.src = src;
    const free = lot.capacity - taken(f);
    b.querySelector(".fr")!.textContent = `${free} free`;
    (b.querySelector(".bar i") as HTMLElement).style.width = `${(100 * taken(f)) / lot.capacity}%`;
    let cin = 0, cout = 0;
    for (let j = 0; j <= k; j++) if (minutes(lot.frames[j].t) > now - 15) [cin, cout] = [cin + lot.frames[j].in, cout + lot.frames[j].out];
    const s = recentSlope(lot, k);
    const trend = s > 0.3 ? `filling, ${s.toFixed(1)} a minute` : s < -0.3 ? `emptying, ${(-s).toFixed(1)} a minute` : "steady";
    b.querySelector(".tr")!.textContent = `last 15 min: ${cin} in, ${cout} out; ${trend}`;
  });
}

function events() {
  const rows: { m: number; text: string }[] = [];
  L().forEach((lot) =>
    lot.frames.forEach((f) => {
      const m = minutes(f.t);
      if (m <= now && (f.in || f.out)) rows.push({ m, text: `${f.t}  ${lot.name}: ${f.in ? `${f.in} in` : ""}${f.in && f.out ? ", " : ""}${f.out ? `${f.out} out` : ""}` });
    }),
  );
  rows.sort((a, b) => b.m - a.m);
  const ol = $("tr-events");
  ol.innerHTML = "";
  for (const r of rows.slice(0, 12)) {
    const li = document.createElement("li");
    li.textContent = r.text;
    ol.append(li);
  }
  if (!rows.length) ol.innerHTML = "<li>No arrivals yet.</li>";
}

function chart() {
  const lot = L()[sel];
  $("tr-chart-name").textContent = lot.name;
  const W = 640, H = 220, L = 36, R = 10, T = 10, B = 24;
  const x = (m: number) => L + ((m - t0) / (t1 - t0)) * (W - L - R);
  const y = (v: number) => T + (1 - v / lot.capacity) * (H - T - B);
  const path = (pts: [number, number][]) => pts.map(([a, b], i) => `${i ? "L" : "M"}${x(a).toFixed(1)},${y(b).toFixed(1)}`).join("");
  const det = lot.frames.filter((f) => minutes(f.t) <= now).map((f) => [minutes(f.t), lot.capacity - taken(f)] as [number, number]);
  const gt = lot.frames.filter((f) => minutes(f.t) <= now).map((f) => [minutes(f.t), lot.capacity - takenTrue(f)] as [number, number]);
  const k = frameAt(lot, now);
  let fc = "";
  if (k >= 0) {
    const m0 = minutes(lot.frames[k].t);
    const pts: [number, number][] = [];
    for (let h = 0; h <= 30; h += 2) if (m0 + h <= t1) pts.push([m0 + h, lot.capacity - forecast(lot, k, h)]);
    fc = path(pts);
  }
  let grid = "";
  for (let m = Math.ceil(t0 / 30) * 30; m <= t1; m += 30) grid += `<line x1="${x(m)}" x2="${x(m)}" y1="${T}" y2="${H - B}" stroke="rgba(255,255,255,.07)"/><text x="${x(m)}" y="${H - 6}" fill="#8b9096" font-size="11" text-anchor="middle">${clock(m)}</text>`;
  for (const v of [0, Math.round(lot.capacity / 2), lot.capacity]) grid += `<text x="${L - 6}" y="${y(v) + 4}" fill="#8b9096" font-size="11" text-anchor="end">${v}</text><line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.07)"/>`;
  $("tr-chart").innerHTML =
    grid +
    (mode === "labelled" ? `<path d="${path(gt)}" fill="none" stroke="#c9cdd2" stroke-width="1.5" stroke-dasharray="2 3"/>` : "") +
    `<path d="${path(det)}" fill="none" stroke="#ffb224" stroke-width="2.5"/>` +
    (fc ? `<path d="${fc}" fill="none" stroke="#57a6ff" stroke-width="2.5" stroke-dasharray="6 4"/>` : "") +
    `<line x1="${x(now)}" x2="${x(now)}" y1="${T}" y2="${H - B}" stroke="#fff" stroke-opacity=".5"/>`;
}

function tripTable() {
  const t = $("tr-trip");
  t.innerHTML = "<tr><th>Car park</th><th>Drive, min</th><th>Walk to the door, min</th></tr>";
  L().forEach((lot, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td></td><td><input type="number" min="1" max="40" data-k="drive" /></td><td><input type="number" min="0" max="20" data-k="walk" /></td>`;
    tr.querySelector("td")!.textContent = lot.name;
    tr.querySelectorAll("input").forEach((inp) => {
      const key = inp.dataset.k as keyof Trip;
      inp.value = String(TRIPS[i][key]);
      inp.addEventListener("change", () => {
        TRIPS[i][key] = Math.max(0, Number(inp.value) || 0);
        update(true);
      });
    });
    t.append(tr);
  });
}

function advice() {
  const opts = options(L(), now, TRIPS, sigma);
  const ok = opts.filter((o) => Number.isFinite(o.cost));
  const box = $("tr-advice");
  if (!ok.length) {
    box.innerHTML = "<p class='why'>No camera is recording yet.</p>";
    return;
  }
  const best = ok.reduce((b, o) => (o.cost < b.cost ? o : b));
  const nearest = ok.reduce((b, o) => (TRIPS[o.lot].drive + TRIPS[o.lot].walk < TRIPS[b.lot].drive + TRIPS[b.lot].walk ? o : b));
  const name = (i: number) => L()[i].name;
  const pct = (c: number) => `${Math.round(c * 100)}%`;
  const free = (v: number) => Math.max(0, Math.round(v));
  let why = `About ${free(best.freeAtArrival)} spaces free when you get there at ${clock(now + TRIPS[best.lot].drive)}, a ${pct(best.chance)} chance of a space.`;
  if (nearest.lot !== best.lot)
    why += ` ${name(nearest.lot)} is closer, but it has ${free(nearest.freeNow)} free now and about ${free(nearest.freeAtArrival)} expected when you would get there (${pct(nearest.chance)} chance).`;
  box.innerHTML = `<p class="go"></p><p class="why"></p><table class="t"><tr><th>Car park</th><th>Free now</th><th>Expected on arrival</th><th>Chance of a space</th><th>Minutes to the door</th></tr></table>`;
  box.querySelector(".go")!.textContent = `Drive to ${name(best.lot)}`;
  box.querySelector(".why")!.textContent = why;
  const tbl = box.querySelector("table")!;
  for (const o of opts) {
    const tr = document.createElement("tr");
    const c = Number.isFinite(o.cost);
    tr.innerHTML = `<td></td><td class="num"></td><td class="num"></td><td class="num"></td><td class="num"></td>`;
    const td = tr.querySelectorAll("td");
    td[0].textContent = name(o.lot) + (o.lot === best.lot ? " (go)" : "");
    td[1].textContent = c ? String(o.freeNow) : "no frame yet";
    td[2].textContent = c ? String(free(o.freeAtArrival)) : "";
    td[3].textContent = c ? pct(o.chance) : "";
    td[3].className = "num " + (o.chance >= 0.9 ? "good" : o.chance >= 0.5 ? "warn" : "bad");
    td[4].textContent = c ? o.cost.toFixed(1) : "";
    tbl.append(tr);
  }
}

function spreadPanel() {
  const n = Number(($("tr-n") as HTMLInputElement).value);
  $("tr-n-out").textContent = String(n);
  const ok = L().some((l) => frameAt(l, now) >= 0);
  const box = $("tr-spread");
  if (!ok) {
    box.innerHTML = "";
    return;
  }
  const s = spread(L(), now, TRIPS, sigma, n);
  const list = (c: number[]) => c.map((v, i) => (v ? `${L()[i].name} ${v}` : "")).filter(Boolean).join(", ");
  box.innerHTML = `<div class="cmp"><div><div class="h">Every navigator: the nearest car park</div><div class="big bad-n"></div><div class="s a"></div></div><div><div class="h">OQIM: one by one, counting the drivers already sent</div><div class="big good-n"></div><div class="s b"></div></div></div>`;
  const big = box.querySelectorAll(".big");
  big[0].textContent = `${s.nearest.full} of ${n}`;
  big[0].className = "big " + (s.nearest.full ? "bad" : "good");
  big[1].textContent = `${s.oqim.full} of ${n}`;
  big[1].className = "big " + (s.oqim.full ? "bad" : "good");
  box.querySelector(".a")!.textContent = `find it full. ${list(s.nearest.counts)}. ${s.nearest.minutes.toFixed(1)} min to the door on average.`;
  box.querySelector(".b")!.textContent = `find it full. ${list(s.oqim.counts)}. ${s.oqim.minutes.toFixed(1)} min to the door on average.`;
}

function stats() {
  const e = data.eval;
  const items: [string, string][] = [
    [`${(e.accuracy * 100).toFixed(1)}%`, `of ${e.spaces.toLocaleString("en")} space checks on ${e.frames} frames agree with the hand labels`],
    [`${e.freeErr.median} / ${e.freeErr.p90}`, "spaces off in the free count: median / 90th percentile"],
    [`${e.forecast.mae.toFixed(1)}`, `spaces off, forecast ${e.forecast.h} minutes ahead, against ${e.forecast.naiveMae.toFixed(1)} for "as many as now"`],
    [`${e.events.in} / ${e.events.out}`, "cars seen coming in / leaving the labelled spaces over the three mornings"],
    [`+${e.whole.extra}`, `spaces found outside the ${e.whole.labelled} hand-labelled ones, from where cars stay; the same method finds ${e.whole.labelledFound} of the ${e.whole.labelledUsed} labelled spaces that cars used (${Math.round((100 * e.whole.labelledFound) / e.whole.labelledUsed)}%)`],
  ];
  const box = $("tr-stats");
  box.innerHTML = "";
  for (const [v, l] of items) {
    const d = document.createElement("div");
    d.innerHTML = `<span class="v"></span><span class="l"></span>`;
    d.querySelector(".v")!.textContent = v;
    d.querySelector(".l")!.textContent = l;
    box.append(d);
  }
  const days = data.lots.map((l) => `${l.name} on ${l.weekday} ${l.date} (${l.capacity} spaces, ${l.frames.length} frames, typical day from ${l.profileDays.length} other weekdays)`).join("; ");
  $("tr-notes").textContent =
    `A replay of real camera frames from the PKLot dataset: car parks of two universities in Curitiba, Brazil, one frame every 5 minutes (UFPR04 every 5 to 15). Each car park was recorded on a different morning; here they run on one clock: ${days}. ` +
    `Spaces taken: ${data.detector}. Whole car park (dashed spaces): ${data.eval.whole.text}; a space nobody parked in this morning is not found. These counts were computed from the frames before; the forecast, the chance of a space and the advice run in this page. ` +
    `Forecast: ${(data.eval as unknown as { forecastText: string }).forecastText}. Drive and walk times are an example trip; a driver who finds the car park full is counted as losing 8 minutes looking in the street. Source: ${data.source}.`;
}

// ---------------------------------------------------------------- loop

function update(force = false) {
  ($("tr-time") as HTMLInputElement).value = String(Math.round(now - t0));
  $("tr-clock").textContent = clock(now);
  draw(force);
  updateCards();
  chart();
  events();
  advice();
  spreadPanel();
}

function preload() {
  // the selected camera first, then the others, a few at a time
  const order = [sel, ...L().map((_, i) => i).filter((i) => i !== sel)];
  const srcs = order.flatMap((i) => L()[i].frames.map((f) => f.src));
  let i = 0;
  const next = () => {
    if (i >= srcs.length) return;
    const im = img(srcs[i++]);
    if (im.complete) next();
    else {
      im.addEventListener("load", next, { once: true });
      im.addEventListener("error", next, { once: true });
    }
  };
  for (let j = 0; j < 4; j++) next();
}

async function main() {
  data = (await (await fetch("/data/tracker.json")).json()) as Data;
  // the clock starts when the first two cameras are recording
  whole = data.lots.map(wholeLot);
  const starts = L().map((l) => minutes(l.frames[0].t)).sort((a, b) => a - b);
  t0 = Math.max(minutes(data.clock.start), starts[Math.min(1, starts.length - 1)]);
  t1 = minutes(data.clock.end);
  now = t0;
  const range = $("tr-time") as HTMLInputElement;
  range.max = String(t1 - t0);
  lotCards();
  tripTable();
  stats();
  preload();
  update(true);

  const play = $("tr-play");
  play.addEventListener("click", () => {
    playing = !playing;
    play.textContent = playing ? "Pause" : "Play";
    play.setAttribute("aria-pressed", String(playing));
    if (playing && now >= t1) now = t0;
  });
  range.addEventListener("input", () => {
    now = t0 + Number(range.value);
    update(true);
  });
  $("tr-speed").addEventListener("change", (e) => (speed = Number((e.target as HTMLSelectElement).value)));
  $("tr-n").addEventListener("input", () => spreadPanel());
  document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((b) =>
    b.addEventListener("click", () => {
      mode = b.dataset.view as typeof mode;
      document.querySelectorAll<HTMLButtonElement>("[data-view]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      lotCards();
      shownFrame = -1;
      update(true);
    }),
  );

  // a timer, not requestAnimationFrame: the replay goes on when the page is in a background pane
  let last = performance.now();
  let lastMinute = -1;
  setInterval(() => {
    const ts = performance.now();
    const dt = Math.min(1.5, (ts - last) / 1000);
    last = ts;
    if (!playing) return;
    now = Math.min(t1, now + dt * speed);
    if (now >= t1) {
      playing = false;
      play.textContent = "Play";
    }
    const mm = Math.floor(now);
    if (mm !== lastMinute) {
      lastMinute = mm;
      update();
    }
  }, 100);
}

main().catch((e) => {
  $("tr-cam-name").textContent = `Could not load the tracker data: ${e}`;
});

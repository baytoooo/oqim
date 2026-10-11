// The 3D corridor page (src/pages/network.astro): a MapLibre map of Tashkent with OpenStreetMap
// buildings in 3D, the signalised junctions of public/data/tashkent_roads.json to pick, the route
// between them on the road graph, and the corridor model (src/oqim/corridor.ts) drawn as boxes.

import maplibregl, { type GeoJSONSource, type Map as MlMap } from "maplibre-gl";
import { ASSET_CDN } from "../config";
import { Corridor, corridorSignals, IDM, LENGTH, lightAt, runCorridor, type Demand, type Signal } from "../oqim/corridor";

interface Roads {
  source: string;
  nodes: [number, number][];
  edges: [number, number, number, number, number, number][];
  junctions: { node: number; lon: number; lat: number; name: string }[];
}
interface Input {
  clip: string;
  duration: number;
  approach: string;
  arrivals: { t: number; cls: number }[];
  cycle: number;
  green: number;
  headway: number;
  tunedCycle: number;
  tunedGreen: number;
  nowWait: number;
  predictiveWait: number | null;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const R = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;
const SIM_SECONDS = 600;
const LEAD = 250; // metres of road before the first junction and after the last
const STOP_BACK = 18; // stop line this far before the junction centre

function haversine(a: [number, number], b: [number, number]): number {
  const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
function bearing(a: [number, number], b: [number, number]): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return Math.atan2(y, x);
}
/** A point `d` m from p on bearing th (radians from north), flat earth. */
function offset(p: [number, number], east: number, north: number): [number, number] {
  return [p[0] + east / (111320 * Math.cos(rad(p[1]))), p[1] + north / 110540];
}

// ---------------------------------------------------------------- road graph

let roads: Roads | null = null;
let out: [number, number][][] = []; // out[a] = [b, metres]
let back: [number, number][][] = [];

function buildGraph(r: Roads): void {
  out = r.nodes.map(() => []);
  back = r.nodes.map(() => []);
  for (const [a, b, m, , oneway] of r.edges) {
    out[a].push([b, m]);
    back[b].push([a, m]);
    if (!oneway) {
      out[b].push([a, m]);
      back[a].push([b, m]);
    }
  }
}

function dijkstra(src: number, dst: number): number[] | null {
  const n = out.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const heap: [number, number][] = [[0, src]];
  dist[src] = 0;
  const push = (x: [number, number]) => {
    heap.push(x);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length) {
    const [d, u] = pop();
    if (d > dist[u]) continue;
    if (u === dst) break;
    for (const [v, m] of out[u]) {
      const nd = d + m;
      if (nd < dist[v]) {
        dist[v] = nd;
        prev[v] = u;
        push([nd, v]);
      }
    }
  }
  if (!Number.isFinite(dist[dst])) return null;
  const path = [dst];
  while (path[path.length - 1] !== src) path.push(prev[path[path.length - 1]]);
  return path.reverse();
}

/** Walks `metres` along the graph from node u, as straight on as the roads allow (`forward`: with
 * the traffic; else against it, onto the road the traffic comes from). */
function extend(u: number, fromBearing: number, metres: number, forward: boolean): number[] {
  const nodes = roads!.nodes;
  const path: number[] = [];
  let cur = u, dir = fromBearing, left = metres;
  const seen = new Set([u]);
  while (left > 0) {
    const options = (forward ? out[cur] : back[cur]).filter(([v]) => !seen.has(v));
    if (!options.length) break;
    let best = options[0], bestTurn = Infinity;
    for (const o of options) {
      const b = bearing(nodes[cur], nodes[o[0]]);
      const want = forward ? dir : dir + Math.PI;
      const turn = Math.abs(Math.atan2(Math.sin(b - want), Math.cos(b - want)));
      if (turn < bestTurn) [best, bestTurn] = [o, turn];
    }
    if (bestTurn > Math.PI / 3) break;
    path.push(best[0]);
    seen.add(best[0]);
    left -= best[1];
    dir = forward ? bearing(nodes[cur], nodes[best[0]]) : bearing(nodes[best[0]], nodes[cur]);
    cur = best[0];
  }
  return path;
}

// ---------------------------------------------------------------- corridor geometry

interface Route {
  coords: [number, number][];
  cum: number[];
  /** Distance of each picked junction's stop line along the route. */
  stops: number[];
  length: number;
}

/** Graph nodes within `m` metres of a junction: on a dual carriageway each side has its own. */
function near(lon: number, lat: number, m = 55): number[] {
  const nodes = roads!.nodes;
  const out_: [number, number][] = [];
  for (let i = 0; i < nodes.length; i++) {
    const d = haversine([lon, lat], nodes[i]);
    if (d < m && out[i].length) out_.push([d, i]);
  }
  return out_.sort((a, b) => a[0] - b[0]).slice(0, 8).map(([, i]) => i);
}

/** The shortest drivable route through the junctions in order, each passed at one of its nodes. */
function routeThrough(junctions: { lon: number; lat: number }[]): Route | null {
  const cands = junctions.map((j) => near(j.lon, j.lat));
  if (cands.some((c) => !c.length)) return null;
  // Viterbi over the candidate nodes: best[k][c] = shortest route ending at candidate c of junction k
  type Best = { len: number; path: number[] };
  let best: (Best | null)[] = cands[0].map((c) => ({ len: 0, path: [c] }));
  for (let k = 1; k < cands.length; k++) {
    const next: (Best | null)[] = cands[k].map(() => null);
    best.forEach((b, i) => {
      if (!b) return;
      cands[k].forEach((c, ci) => {
        if (c === cands[k - 1][i]) return;
        const p = dijkstra(cands[k - 1][i], c);
        if (!p) return;
        let len = 0;
        for (let q = 1; q < p.length; q++) len += haversine(roads!.nodes[p[q - 1]], roads!.nodes[p[q]]);
        if (!next[ci] || b.len + len < next[ci]!.len) next[ci] = { len: b.len + len, path: b.path.concat(p.slice(1)) };
      });
    });
    best = next;
  }
  const done = best.filter((b): b is Best => !!b).sort((a, b) => a.len - b.len)[0];
  if (!done) return null;
  const nodes = roads!.nodes;
  const path = done.path;
  const junctionNodes = junctions.map((j) => {
    // the node of the route closest to the junction
    let bi = 0, bd = Infinity;
    path.forEach((n, i) => {
      const d = haversine([j.lon, j.lat], nodes[n]);
      if (d < bd) [bd, bi] = [d, i];
    });
    return path[bi];
  });
  const b0 = path.length > 1 ? bearing(nodes[path[0]], nodes[path[1]]) : 0;
  const pre = extend(path[0], b0, LEAD, false).reverse();
  const n = path.length;
  const b1 = n > 1 ? bearing(nodes[path[n - 2]], nodes[path[n - 1]]) : 0;
  const post = extend(path[n - 1], b1, LEAD, true);
  const all = [...pre, ...path, ...post];
  const coords = all.map((i) => nodes[i]);
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
  const stops = junctionNodes.map((jn) => {
    const idx = all.indexOf(jn, pre.length);
    return Math.max(5, cum[idx] - STOP_BACK);
  });
  return { coords, cum, stops, length: cum[cum.length - 1] };
}

/** Point and heading at distance s along the route, `right` m to the right of the centreline. */
function along(r: Route, s: number, right: number): { p: [number, number]; th: number } {
  let i = 1;
  while (i < r.cum.length - 1 && r.cum[i] < s) i++;
  const a = r.coords[i - 1], b = r.coords[i];
  const f = Math.min(1, Math.max(0, (s - r.cum[i - 1]) / Math.max(1e-6, r.cum[i] - r.cum[i - 1])));
  const p: [number, number] = [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])];
  const th = bearing(a, b);
  return { p: offset(p, right * Math.cos(th), -right * Math.sin(th)), th };
}

function box(c: [number, number], th: number, len: number, wid: number): [number, number][] {
  const fx = Math.sin(th), fy = Math.cos(th); // forward, east and north
  const rx = Math.cos(th), ry = -Math.sin(th); // right
  const pts: [number, number][] = [
    [len / 2, wid / 2],
    [len / 2, -wid / 2],
    [-len / 2, -wid / 2],
    [-len / 2, wid / 2],
  ].map(([f, r]) => offset(c, f * fx + r * rx, f * fy + r * ry));
  return [...pts, pts[0]];
}

const WIDTH: Record<number, number> = { 2: 1.9, 3: 0.8, 5: 2.55, 7: 2.5 };
/** Vehicles are drawn this many times their size so they can be seen from above; the model uses their real size. */
const DRAW = 1.7;
const HEIGHT: Record<number, number> = { 2: 1.5, 3: 1.3, 5: 3.2, 7: 3.0 };
const COLOR: Record<number, string> = { 2: "#f1eee6", 3: "#ffa45b", 5: "#3fd27f", 7: "#5ab0ff" };

// ---------------------------------------------------------------- state

let map: MlMap;
let input: Input;
let picked: number[] = []; // indices into roads.junctions
let route: Route | null = null;
let mode: "now" | "oqim" = "now";
let sims: Corridor[] = [];
/** Lanes of the corridor: from the discharge rate measured on the video, 1900 vehicles an hour of
 * green per lane (HCM's base saturation flow). */
let lanes = 1;
let playing = true;
let lastFrame = 0;
let lastDraw = 0;

/** The demand of the corridor, dealt to its lanes in turn. */
function laneDemands(r: Route): Demand[] {
  const all = demandFor(r);
  return Array.from({ length: lanes }, (_, k) => ({
    enter: all.enter.filter((_, i) => i % lanes === k),
    cls: all.cls.filter((_, i) => i % lanes === k),
  }));
}

function demandFor(r: Route): Demand {
  const mid = Math.floor((r.stops.length - 1) / 2);
  const lead = r.stops[mid] / IDM.v0;
  const enter: number[] = [], cls: number[] = [];
  const period = Math.max(30, input.duration);
  // demand scale: x1 is the video; more adds a copy of every vehicle (x2) or of every second one
  // (x1.5) 1.3 s behind it, as at a busier hour
  const scale = Number(($("demand") as HTMLSelectElement | null)?.value ?? 1);
  for (let k = 0; k * period < SIM_SECONDS; k++)
    input.arrivals.forEach((a, n) => {
      const copies = scale >= 2 ? 2 : scale > 1 && n % 2 === 0 ? 2 : 1;
      for (let c = 0; c < copies; c++) {
        const e = a.t + k * period - lead + c * 1.3; // at the entry, `lead` s before the middle junction
        if (e + lead < SIM_SECONDS) {
          enter.push(e);
          cls.push(a.cls);
        }
      }
    });
  const shift = Math.max(0, -Math.min(...enter));
  const order = enter.map((_, i) => i).sort((x, y) => enter[x] - enter[y]);
  return { enter: order.map((i) => enter[i] + shift), cls: order.map((i) => cls[i]) };
}

function signalsFor(r: Route, m: "now" | "oqim"): Signal[] {
  return corridorSignals(r.stops, m, input);
}

function restart(): void {
  if (!route) return;
  const sg = signalsFor(route, mode);
  sims = laneDemands(route).map((d) => new Corridor(route!.length, sg, d));
}

/** Corridor statistics over all lanes. */
function runAll(r: Route, m: "now" | "oqim") {
  const sg = signalsFor(r, m);
  const parts = laneDemands(r).map((d) => runCorridor(r.length, sg, d));
  const n = parts.reduce((a, p) => a + p.finished, 0);
  const w = (k: "meanTravel" | "meanDelay" | "meanStops") => (n ? parts.reduce((a, p) => a + p[k] * p.finished, 0) / n : 0);
  return { finished: n, meanTravel: w("meanTravel"), meanDelay: w("meanDelay"), meanStops: w("meanStops") };
}

function renderKpi(): void {
  if (!route) {
    $("kpi").innerHTML = `<p class="hint">Pick at least two junctions, or press Sample corridor.</p>`;
    return;
  }
  const now = runAll(route, "now");
  const oq = runAll(route, "oqim");
  const ch = (a: number, b: number) => (a > 0 ? `${b <= a ? "" : "+"}${(((b - a) / a) * 100).toFixed(0)}%` : "");
  const cls = (a: number, b: number) => (b < a * 0.98 ? "good" : b > a * 1.02 ? "bad" : "");
  $("kpi").innerHTML = `<table class="t"><thead><tr><th></th><th class="num">Timing now</th><th class="num">OQIM</th><th class="num">Change</th></tr></thead><tbody>
    <tr><td>Vehicles through, ${SIM_SECONDS / 60} min${Number($<HTMLSelectElement>("demand").value) > 1 ? ` (demand x${$<HTMLSelectElement>("demand").value})` : ""}</td><td class="num">${now.finished}</td><td class="num">${oq.finished}</td><td class="num"></td></tr>
    <tr><td>Mean time on the corridor, s</td><td class="num">${now.meanTravel.toFixed(0)}</td><td class="num">${oq.meanTravel.toFixed(0)}</td><td class="num ${cls(now.meanTravel, oq.meanTravel)}">${ch(now.meanTravel, oq.meanTravel)}</td></tr>
    <tr><td>Mean delay at the signals, s</td><td class="num">${now.meanDelay.toFixed(0)}</td><td class="num">${oq.meanDelay.toFixed(0)}</td><td class="num ${cls(now.meanDelay, oq.meanDelay)}">${ch(now.meanDelay, oq.meanDelay)}</td></tr>
    <tr><td>Stops per vehicle</td><td class="num">${now.meanStops.toFixed(2)}</td><td class="num">${oq.meanStops.toFixed(2)}</td><td class="num ${cls(now.meanStops, oq.meanStops)}">${ch(now.meanStops, oq.meanStops)}</td></tr>
    </tbody></table>
    <p class="hint">${(route.length / 1000).toFixed(2)} km, ${route.stops.length} signals, ${lanes} lane${lanes > 1 ? "s" : ""} (from the discharge rate on the video, ${(3600 / input.headway).toFixed(0)} vehicles an hour of green). Both: cycle ${input.cycle.toFixed(0)} s, green ${input.green.toFixed(0)} s as measured on the video. OQIM changes only the offsets, for a green wave at 45 km/h, so the cross streets keep their time.</p>`;
}

function renderPicked(): void {
  const list = $("picked");
  const mid = Math.floor((picked.length - 1) / 2);
  list.innerHTML = picked
    .map((j, i) => `<li class="${picked.length >= 3 && i === mid ? "mid" : ""}">${roads!.junctions[j].name || "Junction"}${picked.length >= 3 && i === mid ? " (your video)" : ""}</li>`)
    .join("");
  $("count").textContent = `${picked.length} of 5`;
  const src = map.getSource("picked") as GeoJSONSource | undefined;
  src?.setData({
    type: "FeatureCollection",
    features: picked.map((j, i) => ({ type: "Feature", properties: { n: String(i + 1) }, geometry: { type: "Point", coordinates: [roads!.junctions[j].lon, roads!.junctions[j].lat] } })),
  });
}

function setRoute(): void {
  route = picked.length >= 2 ? routeThrough(picked.map((j) => roads!.junctions[j])) : null;
  if (picked.length >= 2 && !route) $("demand-note").textContent = "No drivable route links these junctions in this order (one-way streets). Try another order.";
  (map.getSource("route") as GeoJSONSource).setData({
    type: "FeatureCollection",
    features: route ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: route.coords } }] : [],
  });
  restart();
  renderKpi();
  if (route) {
    // close over the middle junction, looking down the corridor: the vehicles are a few metres long
    const th = bearing(route.coords[0], route.coords[route.coords.length - 1]);
    const mid = route.stops[Math.floor((route.stops.length - 1) / 2)];
    map.flyTo({ center: along(route, mid - 90, 0).p, zoom: 17.7, pitch: 62, bearing: (th * 180) / Math.PI, duration: 1500 });
  }
}

function draw(): void {
  if (!route || !sims.length) return;
  const r = route;
  const sim = sims[0];
  const cars = sims.flatMap((lane, k) =>
    lane.cars.map((c) => {
      const { p, th } = along(r, c.s - c.length / 2, 2.2 + 3.9 * k);
      return {
        type: "Feature" as const,
        properties: { h: DRAW * (HEIGHT[c.cls] ?? 1.5), color: c.stopped ? "#ff5b4c" : COLOR[c.cls] ?? "#f1eee6" },
        geometry: { type: "Polygon" as const, coordinates: [box(p, th, DRAW * (LENGTH[c.cls] ?? 4.5) * 0.9, DRAW * (WIDTH[c.cls] ?? 1.9))] },
      };
    }),
  );
  (map.getSource("cars") as GeoJSONSource).setData({ type: "FeatureCollection", features: cars });
  const edge = 2.2 + 3.9 * (lanes - 1) + 3;
  const sigs = sim.signals.map((sg) => {
    const { p, th } = along(r, sg.at, edge + 1);
    const light = lightAt(sg, sim.t);
    return {
      type: "Feature" as const,
      properties: { h: 6, color: light === "green" ? "#3fd27f" : light === "amber" ? "#ffb224" : "#ff5b4c" },
      geometry: { type: "Polygon" as const, coordinates: [box(p, th, 1.2, 1.2)] },
    };
  });
  const lines = sim.signals.map((sg) => {
    const a = along(r, sg.at, 0.2).p, b = along(r, sg.at, edge).p;
    return { type: "Feature" as const, properties: { color: lightAt(sg, sim.t) === "green" ? "#3fd27f" : "#ff5b4c" }, geometry: { type: "LineString" as const, coordinates: [a, b] } };
  });
  (map.getSource("signals") as GeoJSONSource).setData({ type: "FeatureCollection", features: sigs });
  // vehicles standing within 200 m before each signal
  const queues = sim.signals.map((sg, i) => {
    const prev = i > 0 ? sim.signals[i - 1].at : -Infinity;
    const n = sims.reduce((acc, l) => acc + l.cars.filter((c) => c.stopped && c.s <= sg.at + 1 && c.s > Math.max(prev, sg.at - 200)).length, 0);
    return { type: "Feature" as const, properties: { label: n ? `${n} waiting` : "" }, geometry: { type: "Point" as const, coordinates: along(r, sg.at - 25, edge + 10).p } };
  });
  (map.getSource("queues") as GeoJSONSource).setData({ type: "FeatureCollection", features: queues });
  (map.getSource("stoplines") as GeoJSONSource).setData({ type: "FeatureCollection", features: lines });
  const m = Math.floor(sim.t / 60), s = Math.floor(sim.t % 60);
  $("clock").textContent = `${m}:${String(s).padStart(2, "0")}`;
  const onRoad = sims.reduce((a, l) => a + l.cars.length, 0);
  const standing = sims.reduce((a, l) => a + l.waiting, 0);
  const through = sims.reduce((a, l) => a + l.finished.length, 0);
  $("live").textContent = `${mode === "now" ? "Timing now" : "OQIM green wave"} · on the road ${onRoad} · standing ${standing} · through ${through}`;
}

function tick(ts: number): void {
  const dt = Math.min(0.1, (ts - (lastFrame || ts)) / 1000);
  lastFrame = ts;
  if (playing && sims.length && route) {
    const steps = Math.round((dt * Number($<HTMLSelectElement>("speed").value)) / 0.1);
    for (let i = 0; i < steps && sims[0].t < SIM_SECONDS + 200; i++) for (const l of sims) l.step();
    if (ts - lastDraw > 66) {
      draw();
      lastDraw = ts;
    }
  }
  requestAnimationFrame(tick);
}

// ---------------------------------------------------------------- data and setup

async function json<T>(urls: string[]): Promise<T> {
  let last: unknown;
  for (const u of urls) {
    try {
      const r = await fetch(u);
      if (r.ok) return (await r.json()) as T;
      last = new Error(`HTTP ${r.status}`);
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

/** Five junctions on Amir Temur Avenue, going north (graph node ids of public/data/tashkent_roads.json). */
const SAMPLE_NODES = [3039, 1782, 1778, 578, 1316];

function sampleCorridor(): number[] {
  const js = roads!.junctions;
  const pick = SAMPLE_NODES.map((n) => js.findIndex((j) => j.node === n)).filter((i) => i >= 0);
  return pick.length >= 2 ? pick : [];
}

/** OpenFreeMap's style (OpenStreetMap with buildings in 3D), tried three times; without it, a plain
 * dark map on which the page draws its own road graph. */
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

async function main(): Promise<void> {
  try {
    const stored = sessionStorage.getItem("oqim:last");
    if (stored) input = JSON.parse(stored) as Input;
  } catch {
    /* no storage */
  }
  if (!input || !input.arrivals?.length) input = await json<Input>(["/data/sample_demand.json"]);
  lanes = Math.max(1, Math.min(4, Math.round(3600 / input.headway / 1900)));
  $("demand-note").textContent = `Demand: the ${input.arrivals.length} vehicles measured on ${input.clip} (${input.approach}, ${(input.duration / 60).toFixed(1)} min), repeated to fill ${SIM_SECONDS / 60} min.${input.clip.includes("sample") ? " Run an audit first to use your own video." : ""}`;

  roads = await json<Roads>([`${ASSET_CDN}/data/tashkent_roads.json`, "/data/tashkent_roads.json"]).catch(() => json<Roads>(["/data/tashkent_roads.json"]));
  buildGraph(roads);
  const style = await baseStyle();
  map = new maplibregl.Map({
    container: "map",
    style,
    center: [69.2797, 41.3111],
    zoom: 13.2,
    pitch: 55,
    bearing: -20,
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  // our layers go on as soon as the style is in; the basemap tiles may still be on their way
  await new Promise<void>((ok) => {
    if (map.isStyleLoaded()) return ok();
    map.once("style.load", () => ok());
    map.once("load", () => ok());
  });
  {
    // our road graph under everything: it shows while the basemap tiles are still on their way, and
    // stands in for them when they do not come
    map.addSource("roads", {
      type: "geojson",
      data: { type: "FeatureCollection", features: roads.edges.map(([a, b, , cls]) => ({ type: "Feature", properties: { cls }, geometry: { type: "LineString", coordinates: [roads!.nodes[a], roads!.nodes[b]] } })) },
    });
    const before = map.getLayer("building-3d") ? "building-3d" : undefined;
    map.addLayer({ id: "roads", type: "line", source: "roads", paint: { "line-color": style.sources.openmaptiles ? "#9aa0a8" : "#4a4f57", "line-opacity": style.sources.openmaptiles ? 0.35 : 1, "line-width": ["match", ["get", "cls"], 0, 4, 1, 3, 2, 2, 1.5] } }, before);
  }

  const empty = { type: "FeatureCollection" as const, features: [] };
  map.addSource("junctions", {
    type: "geojson",
    data: { type: "FeatureCollection", features: roads.junctions.map((j, i) => ({ type: "Feature", properties: { i, name: j.name }, geometry: { type: "Point", coordinates: [j.lon, j.lat] } })) },
  });
  for (const id of ["route", "cars", "signals", "stoplines", "picked", "queues"]) map.addSource(id, { type: "geojson", data: empty });
  map.addLayer({ id: "route", type: "line", source: "route", paint: { "line-color": "#f3c316", "line-width": 6, "line-opacity": 0.55 } });
  map.addLayer({ id: "stoplines", type: "line", source: "stoplines", paint: { "line-color": ["get", "color"], "line-width": 4 } });
  map.addLayer({ id: "junctions", type: "circle", source: "junctions", paint: { "circle-radius": 6, "circle-color": "#ff5b4c", "circle-stroke-color": "#111214", "circle-stroke-width": 2 } });
  map.addLayer({ id: "picked", type: "circle", source: "picked", paint: { "circle-radius": 11, "circle-color": "#f3c316", "circle-stroke-color": "#111214", "circle-stroke-width": 2 } });
  map.addLayer({ id: "picked-n", type: "symbol", source: "picked", layout: { "text-field": ["get", "n"], "text-size": 13, "text-font": ["Noto Sans Bold"] }, paint: { "text-color": "#111214" } });
  map.addLayer({ id: "cars", type: "fill-extrusion", source: "cars", paint: { "fill-extrusion-color": ["get", "color"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 0.2, "fill-extrusion-opacity": 0.95 } });
  map.addLayer({ id: "queues", type: "symbol", source: "queues", layout: { "text-field": ["get", "label"], "text-size": 15, "text-font": ["Noto Sans Bold"], "text-allow-overlap": true }, paint: { "text-color": "#ff5b4c", "text-halo-color": "#111214", "text-halo-width": 2 } });
  map.addLayer({ id: "signals", type: "fill-extrusion", source: "signals", paint: { "fill-extrusion-color": ["get", "color"], "fill-extrusion-height": ["get", "h"], "fill-extrusion-base": 4.5 } });

  map.on("click", "junctions", (e) => {
    const f = e.features?.[0];
    if (!f) return;
    const i = Number(f.properties?.i);
    if (picked.includes(i) || picked.length >= 5) return;
    picked.push(i);
    renderPicked();
    if (picked.length >= 2) setRoute();
  });
  map.on("mouseenter", "junctions", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "junctions", () => (map.getCanvas().style.cursor = ""));

  $("sample").addEventListener("click", () => {
    picked = sampleCorridor();
    renderPicked();
    setRoute();
  });
  $("clear").addEventListener("click", () => {
    picked = [];
    renderPicked();
    setRoute();
  });
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
    b.addEventListener("click", () => {
      mode = b.dataset.mode as "now" | "oqim";
      for (const x of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) x.setAttribute("aria-pressed", String(x === b));
      restart();
    });
  }
  $("play").addEventListener("click", () => {
    playing = !playing;
    $("play").textContent = playing ? "Pause" : "Play";
  });
  $("restart").addEventListener("click", restart);
  $("demand").addEventListener("change", () => {
    restart();
    renderKpi();
  });

  renderPicked();
  renderKpi();
  picked = sampleCorridor();
  renderPicked();
  if (picked.length) setRoute();
  requestAnimationFrame(tick);
}

main().catch((e) => {
  $("kpi").innerHTML = `<p class="hint">Could not load the map or the roads: ${e instanceof Error ? e.message : String(e)}</p>`;
});

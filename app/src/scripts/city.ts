// The district model page (src/pages/city.astro): Kwun Tong, Hong Kong. Traffic cameras with the
// vehicles counted on each snapshot (public/data/hongkong.json, from samples_src/), live car park
// vacancy (Transport Department, via /api/hkparking), the OpenStreetMap road graph, the load on each
// road now and forecast 10 minutes ahead, and drivers placed on car parks by src/oqim/allocate.ts.

import maplibregl, { type GeoJSONSource, type Map as MlMap } from "maplibre-gl";
import { adjacency, capacity, coordinated, evaluate, holt, nearest, shortest, WINDOW_H, type CarPark, type Driver, type Graph, type Outcome } from "../oqim/allocate";

interface Camera {
  id: string;
  name: string;
  lat: number;
  lon: number;
  imageUrl: string;
  node?: number;
  /** Vehicle boxes on the last counted snapshot, media/hongkong/<id>.jpg (320 x 240). */
  last?: { t: string | null; boxes: number[][] };
  series: { t: string; vehicles: number; standing?: number; density?: number }[];
}
interface District {
  source: string;
  district: string;
  center: [number, number];
  cameras: Camera[];
}
interface Roads extends Graph {
  source: string;
}
interface Park {
  id: string;
  name: string;
  lat: number;
  lon: number;
  capacity: number | null;
  vacancy: number;
  lastupdate?: string;
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const rad = (d: number) => (d * Math.PI) / 180;
const hav = (a: [number, number], b: [number, number]) => {
  const dLat = rad(b[1] - a[1]), dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
};
const PALETTE = ["#5ab0ff", "#ff7ac6", "#7ef0c6", "#ffa45b", "#c39bff", "#f3c316", "#9ad0ff", "#ff9a8a"];
const STEPS_AHEAD = 5; // snapshots about 2 min apart: 10 minutes

let map: MlMap;
let district: District;
let roads: Roads;
let parksAll: Park[] = [];
let dest: [number, number] = [114.2263, 22.3122]; // Kwun Tong MTR station
let mode: "nearest" | "oqim" = "oqim";
let last: { nearest: Outcome; oqim: Outcome; parks: CarPark[]; parkMeta: Park[]; bg: Float64Array } | null = null;
/** How many drivers are drawn (the animation adds them one by one, in order of departure). */
let shown = Infinity;
let timer = 0;

async function getJson<T>(urls: string[]): Promise<T> {
  let err: unknown;
  for (const u of urls) {
    try {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), 8000);
      const r = await fetch(u, { signal: ctl.signal });
      clearTimeout(timer);
      if (r.ok) return (await r.json()) as T;
      err = new Error(`HTTP ${r.status}`);
    } catch (e) {
      err = e;
    }
  }
  throw err;
}

// ---------------------------------------------------------------- cameras and road load

function cameraLoad(c: Camera, ahead: boolean): { rel: number; now: number; forecast: number; mae: number; naive: number; n: number } {
  const v = c.series.map((p) => p.vehicles);
  const sorted = [...v].sort((a, b) => a - b);
  const p90 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(0.9 * sorted.length))] : 1;
  const ref = Math.max(3, p90);
  const h = holt(v, STEPS_AHEAD);
  const now = v[v.length - 1] ?? 0;
  const val = ahead && Number.isFinite(h.forecast) ? h.forecast : now;
  return { rel: Math.min(1.3, val / ref), now, forecast: h.forecast, mae: h.mae, naive: h.naiveMae, n: h.n };
}

/** v/c of every road: from the nearest camera within 300 m (load relative to the busiest tenth of
 * its snapshots), else a quiet default. An estimate: cameras count vehicles, not flow. */
function background(ahead: boolean): Float64Array {
  const loads = district.cameras.map((c) => ({ c, l: cameraLoad(c, ahead).rel }));
  const vc = new Float64Array(roads.edges.length);
  roads.edges.forEach(([a, b], e) => {
    const m: [number, number] = [(roads.nodes[a][0] + roads.nodes[b][0]) / 2, (roads.nodes[a][1] + roads.nodes[b][1]) / 2];
    let best = Infinity, rel = 0;
    for (const { c, l } of loads) {
      const d = hav(m, [c.lon, c.lat]);
      if (d < best) [best, rel] = [d, l];
    }
    vc[e] = best < 300 ? 0.3 + 0.65 * rel : 0.35;
  });
  return vc;
}

function nearestNode(p: [number, number], needOut = true): number {
  let best = 0, bd = Infinity;
  const hasOut = new Set<number>();
  if (needOut) roads.edges.forEach(([a, b, , , oneway]) => (hasOut.add(a), oneway ? 0 : hasOut.add(b)));
  roads.nodes.forEach((n, i) => {
    if (needOut && !hasOut.has(i)) return;
    const d = hav(p, n);
    if (d < bd) [bd, best] = [d, i];
  });
  return best;
}

// ---------------------------------------------------------------- drivers and car parks

function seeded(seed: number) {
  let s = seed;
  return () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

function boundaryOrigins(): number[] {
  const lons = roads.nodes.map((n) => n[0]), lats = roads.nodes.map((n) => n[1]);
  const [x0, x1, y0, y1] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const deg = new Map<number, number>();
  roads.edges.forEach(([a, b, , cls]) => {
    if (cls > 2) return;
    deg.set(a, (deg.get(a) ?? 0) + 1);
    deg.set(b, (deg.get(b) ?? 0) + 1);
  });
  return roads.nodes
    .map((n, i) => [n, i] as const)
    .filter(([n, i]) => deg.has(i) && (Math.min(n[0] - x0, x1 - n[0]) * 102000 < 150 || Math.min(n[1] - y0, y1 - n[1]) * 111000 < 150))
    .map(([, i]) => i);
}

function carParks(): { parks: CarPark[]; meta: Park[] } {
  const near = parksAll.filter((p) => hav([p.lon, p.lat], dest) < 1100);
  const parks: CarPark[] = [];
  const meta: Park[] = [];
  for (const p of near) {
    const node = nearestNode([p.lon, p.lat]);
    parks.push({ name: p.name, node, capacity: p.capacity ?? p.vacancy, free: p.vacancy, walk: 1.3 * hav([p.lon, p.lat], dest) });
    meta.push(p);
  }
  return { parks, meta };
}

function run(): void {
  if (!roads || !parksAll.length) return;
  const ahead = $<HTMLSelectElement>("when").value === "ahead";
  const bg = background(ahead);
  const { parks, meta } = carParks();
  if (!parks.length) {
    $("kpi").innerHTML = `<p class="hint">No car park with live data within 1.1 km of this destination.</p>`;
    return;
  }
  const N = Number($<HTMLInputElement>("n").value);
  const win = Number($<HTMLSelectElement>("window").value) * 60;
  const rnd = seeded(7);
  // starts from which every car park can be reached (one-way carriageways leaving the district are not)
  const adj = adjacency(roads);
  const starts = boundaryOrigins();
  const reach = starts.map((o) => shortest(roads, adj, o, (e) => roads.edges[e][2]).dist);
  // car parks most starts can reach, then the starts that reach all of them
  const keep = parks.map((p) => reach.filter((d) => Number.isFinite(d[p.node])).length >= 0.6 * starts.length);
  for (let i = parks.length - 1; i >= 0; i--) if (!keep[i]) { parks.splice(i, 1); meta.splice(i, 1); }
  const origins = starts.filter((_, k) => parks.every((p) => Number.isFinite(reach[k][p.node])));
  if (!origins.length) {
    $("kpi").innerHTML = `<p class="hint">No start at the edge of the district reaches these car parks; move the destination.</p>`;
    return;
  }
  const drivers: Driver[] = Array.from({ length: N }, (_, i) => ({ id: i, origin: origins[Math.floor(rnd() * origins.length)], depart: (i / N) * win }));
  const a = evaluate(roads, bg, parks, drivers, nearest(roads, bg, parks, drivers));
  const b = evaluate(roads, bg, parks, drivers, coordinated(roads, bg, parks, drivers));
  last = { nearest: a, oqim: b, parks, parkMeta: meta, bg };
  renderKpi(a, b);
  draw();
}

function renderKpi(a: Outcome, b: Outcome): void {
  const ch = (x: number, y: number) => (x > 0 ? `${y <= x ? "" : "+"}${(((y - x) / x) * 100).toFixed(0)}%` : "");
  const c = (x: number, y: number) => (y < x * 0.98 ? "good" : y > x * 1.02 ? "bad" : "");
  $("kpi").innerHTML = `<table class="t"><thead><tr><th></th><th class="num">Nearest</th><th class="num">OQIM</th><th class="num">Change</th></tr></thead><tbody>
  <tr><td>Door to door, min (drive, search, walk)</td><td class="num">${(a.meanDoorToDoor / 60).toFixed(1)}</td><td class="num">${(b.meanDoorToDoor / 60).toFixed(1)}</td><td class="num ${c(a.meanDoorToDoor, b.meanDoorToDoor)}">${ch(a.meanDoorToDoor, b.meanDoorToDoor)}</td></tr>
  <tr><td>Arrive to a full car park</td><td class="num">${a.arrivedFull}</td><td class="num">${b.arrivedFull}</td><td class="num ${c(a.arrivedFull + 0.01, b.arrivedFull + 0.01)}"></td></tr>
  <tr><td>Busiest road on their routes, v/c</td><td class="num">${a.maxVc.toFixed(2)}</td><td class="num">${b.maxVc.toFixed(2)}</td><td class="num ${c(a.maxVc, b.maxVc)}">${ch(a.maxVc, b.maxVc)}</td></tr>
  <tr><td>Vehicle-km driven, with searching</td><td class="num">${a.vehKm.toFixed(0)}</td><td class="num">${b.vehKm.toFixed(0)}</td><td class="num ${c(a.vehKm, b.vehKm)}">${ch(a.vehKm, b.vehKm)}</td></tr>
  </tbody></table>`;
}

function draw(): void {
  if (!last) return;
  const full = mode === "nearest" ? last.nearest : last.oqim;
  // the first `shown` drivers (in order of arrival), and the load their routes put on the roads
  const out = { ...full, assignments: full.assignments.slice(0, Math.min(shown, full.assignments.length)) };
  const vc = Float64Array.from(last.bg);
  for (const s of out.assignments) for (const e of s.path) vc[e] += 1 / WINDOW_H / capacity(roads, e);
  (map.getSource("roads") as GeoJSONSource).setData({
    type: "FeatureCollection",
    features: roads.edges.map(([a, b], e) => ({ type: "Feature", properties: { vc: vc[e] }, geometry: { type: "LineString", coordinates: [roads.nodes[a], roads.nodes[b]] } })),
  });
  $("status").textContent = `${district.district} · ${mode === "nearest" ? "everyone to the nearest" : "OQIM"} · drivers placed ${out.assignments.length} of ${full.assignments.length} · arrived to a full car park ${out.assignments.filter((s) => s.full).length}`;
  // routes
  const routeFeatures = out.assignments.map((s) => {
    const coords: [number, number][] = [];
    for (const e of s.path) {
      const [a, b] = roads.edges[e];
      const pa = roads.nodes[a], pb = roads.nodes[b];
      const prev = coords[coords.length - 1];
      if (!prev || prev[0] !== pa[0] || prev[1] !== pa[1]) {
        if (prev && prev[0] === pb[0] && prev[1] === pb[1]) coords.push(pa);
        else coords.push(pa, pb);
      } else coords.push(pb);
    }
    return { type: "Feature" as const, properties: { color: s.full ? "#ff5b4c" : PALETTE[s.park % PALETTE.length] }, geometry: { type: "LineString" as const, coordinates: coords } };
  });
  (map.getSource("routes") as GeoJSONSource).setData({ type: "FeatureCollection", features: routeFeatures });
  // car parks
  const got = last.parks.map((_, i) => out.assignments.filter((s) => s.park === i && !s.full).length);
  (map.getSource("parks") as GeoJSONSource).setData({
    type: "FeatureCollection",
    features: last.parkMeta.map((p, i) => ({
      type: "Feature",
      properties: { label: `${p.vacancy} free${got[i] ? `, +${got[i]}` : ""}`, color: PALETTE[i % PALETTE.length], r: 6 + Math.min(14, Math.sqrt(p.vacancy) * 1.6) },
      geometry: { type: "Point", coordinates: [p.lon, p.lat] },
    })),
  });
  (map.getSource("dest") as GeoJSONSource).setData({ type: "FeatureCollection", features: [{ type: "Feature", properties: {}, geometry: { type: "Point", coordinates: dest } }] });
  $("parks").innerHTML = `<table class="t"><thead><tr><th>Car park</th><th class="num">Free now</th><th class="num">Walk</th><th class="num">Sent: nearest</th><th class="num">OQIM</th></tr></thead><tbody>${last.parkMeta
    .map((p, i) => {
      const n1 = last!.nearest.assignments.filter((s) => s.park === i).length;
      const n2 = last!.oqim.assignments.filter((s) => s.park === i).length;
      return `<tr><td><span class="swatch" style="background:${PALETTE[i % PALETTE.length]}"></span>${p.name}</td><td class="num">${p.vacancy}${p.capacity ? ` / ${p.capacity}` : ""}</td><td class="num">${Math.round(last!.parks[i].walk / 1.3 / 60 * 10) / 10} min</td><td class="num">${n1}</td><td class="num">${n2}</td></tr>`;
    })
    .join("")}</tbody></table>`;
}

/** The counted snapshot with the boxes the detector found on it (SVG over the image, 320 x 240). */
function counted(c: Camera, cls = ""): string {
  const boxes = (c.last?.boxes ?? []).map(([x1, y1, x2, y2]) => `<rect x="${x1}" y="${y1}" width="${x2 - x1}" height="${y2 - y1}" fill="none" stroke="#ffb224" stroke-width="2"/>`).join("");
  return `<div class="snap ${cls}"><img src="/media/hongkong/${c.id}.jpg" alt="Snapshot of the camera ${c.name} as counted" loading="lazy" /><svg viewBox="0 0 320 240" preserveAspectRatio="none" aria-hidden="true">${boxes}</svg></div>`;
}
const hkt = (t: string | null | undefined) => (t ? new Date(t).toLocaleTimeString("en-GB", { timeZone: "Asia/Hong_Kong", hour: "2-digit", minute: "2-digit" }) + " HKT" : "");
let flyTo: (c: Camera) => void = () => undefined;

function showCamera(c: Camera): void {
  const l = cameraLoad(c, false);
  const v = c.series.map((p) => p.vehicles);
  const max = Math.max(1, ...v);
  const W = 300, H = 48;
  const pts = v.map((y, i) => `${(i / Math.max(1, v.length - 1)) * W},${H - (y / max) * (H - 4) - 2}`).join(" ");
  const live = c.imageUrl.includes("tdcctv") ? `${c.imageUrl}?t=${Math.floor(Date.now() / 60000)}` : c.imageUrl;
  const n = c.last?.boxes.length ?? l.now;
  $("camera").innerHTML = `<p><strong>${c.name}</strong></p>
    ${counted(c)}
    <p class="hint">Counted by OQIM at ${hkt(c.last?.t)}: <strong>${n} vehicle${n === 1 ? "" : "s"}</strong> (orange boxes). <a href="${live}" target="_blank" rel="noopener">This camera now, live from the Transport Department</a>.</p>
    <svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="#f3c316" stroke-width="2" /></svg>
    <p class="hint">Vehicles on each of its ${v.length} snapshots today. Forecast for 10 minutes ahead (Holt's smoothing): <strong>${Number.isFinite(l.forecast) ? l.forecast.toFixed(1) : "n/a"}</strong>. Backtest on ${l.n} snapshots: mean error ${Number.isFinite(l.mae) ? l.mae.toFixed(2) : "n/a"} vehicles, against ${Number.isFinite(l.naive) ? l.naive.toFixed(2) : "n/a"} for "same as last".</p>`;
  document.querySelectorAll<HTMLElement>("#camwall .cw").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === c.id)));
}

/** Every camera of the district with what it counted, busiest first. */
function cameraWall(): void {
  const box = $("camwall");
  const cams = [...district.cameras].sort((a, b) => (b.last?.boxes.length ?? 0) - (a.last?.boxes.length ?? 0));
  box.innerHTML = "";
  for (const c of cams) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "cw";
    b.dataset.id = c.id;
    const n = c.last?.boxes.length ?? 0;
    b.innerHTML = `${counted(c, "small")}<span class="cw-n">${n}</span><span class="cw-name"></span>`;
    b.querySelector(".cw-name")!.textContent = c.name.replace(/\s*\[.*\]$/, "");
    b.addEventListener("click", () => {
      showCamera(c);
      flyTo(c);
    });
    box.append(b);
  }
}

// ---------------------------------------------------------------- setup

async function baseStyle(): Promise<maplibregl.StyleSpecification> {
  for (let i = 0; i < 2; i++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    try {
      const r = await fetch("https://tiles.openfreemap.org/styles/dark", { signal: ctl.signal });
      if (r.ok) return (await r.json()) as maplibregl.StyleSpecification;
    } catch {
      /* again */
    } finally {
      clearTimeout(timer);
    }
  }
  return { version: 8, glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf", sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": "#15171a" } }] };
}

function dedupeParks(list: Park[]): Park[] {
  const out: Park[] = [];
  for (const p of [...list].sort((a, b) => (b.lastupdate ?? "").localeCompare(a.lastupdate ?? ""))) {
    const key = (n: string) => n.toLowerCase().replace(/car ?park|\(.*?\)|[^a-z0-9]/g, "");
    if (out.some((q) => hav([q.lon, q.lat], [p.lon, p.lat]) < 40 || (key(q.name) === key(p.name) && hav([q.lon, q.lat], [p.lon, p.lat]) < 250))) continue;
    out.push(p);
  }
  return out;
}

async function main(): Promise<void> {
  $("status").textContent = "Loading cameras, roads, car parks and the map";
  // the basemap style loads alongside the data
  const stylePromise = baseStyle();
  const livePromise = getJson<{ results: { park_Id: string; privateCar?: { vacancy: number; lastupdate: string }[] }[] }>(["/api/hkparking"]).catch(() => null);
  const [d, r, snap] = await Promise.all([
    getJson<District>(["/data/hongkong.json"]),
    getJson<Roads>(["/data/hongkong_roads.json"]),
    getJson<{ source: string; fetched: string; carparks: Park[] }>(["/data/hk_carparks.json"]),
  ]);
  district = d;
  roads = r;
  let liveNote = `car park vacancy as fetched at ${snap.fetched}`;
  parksAll = snap.carparks;
  const live = await livePromise;
  if (live) {
    const byId = new Map(live.results.map((x) => [x.park_Id, x.privateCar?.[0]]));
    parksAll = parksAll.map((p) => {
      const v = byId.get(p.id);
      return v && v.vacancy >= 0 ? { ...p, vacancy: v.vacancy, lastupdate: v.lastupdate } : p;
    });
    liveNote = "car park vacancy live from the Transport Department";
  }
  // vacancy older than 6 hours is not live: leave it out
  const newest = Math.max(...parksAll.map((p) => Date.parse((p.lastupdate ?? "").replace(" ", "T") + "+08:00") || 0));
  parksAll = dedupeParks(parksAll.filter((p) => newest - (Date.parse((p.lastupdate ?? "").replace(" ", "T") + "+08:00") || 0) < 6 * 3600e3));
  const points = district.cameras.reduce((s, c) => s + c.series.length, 0);
  // the forecast checked on every camera: one snapshot ahead, against "same as the last one"
  let errH = 0, errN = 0, steps = 0;
  for (const c of district.cameras) {
    const h = holt(c.series.map((p) => p.vehicles), 1);
    if (h.n) [errH, errN, steps] = [errH + h.mae * h.n, errN + h.naiveMae * h.n, steps + h.n];
  }
  const backtest = steps ? ` Forecast check over ${steps} snapshots: mean error ${(errH / steps).toFixed(2)} vehicles one snapshot ahead, against ${(errN / steps).toFixed(2)} for "same as the last one".` : "";
  $("notes").textContent = `Sources: ${district.source}; ${snap.source}; roads ${roads.source}. ${district.cameras.length} cameras, ${points} snapshots counted. Road load is an estimate: the vehicles a camera sees, relative to the busiest tenth of its snapshots, mapped to a volume-to-capacity ratio (0.3 to 0.95) on the roads within 300 m; travel times follow the BPR function. Drivers and their origins are simulated (seeded); free spaces are real, and in the model 1% of the occupied spaces of a car park free up each minute (an assumption). A driver who finds the car park full searches for 8 minutes. Both strategies are judged by the same model.${backtest}`;

  const style = await stylePromise;
  map = new maplibregl.Map({ container: "map", style, center: district.center, zoom: 15, pitch: 45, bearing: -15, attributionControl: { compact: true } });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  await new Promise<void>((ok) => {
    if (map.isStyleLoaded()) return ok();
    map.once("style.load", () => ok());
    map.once("load", () => ok());
  });
  const empty = { type: "FeatureCollection" as const, features: [] };
  for (const id of ["roads", "routes", "parks", "dest", "cameras"]) map.addSource(id, { type: "geojson", data: empty });
  map.addLayer({ id: "roads", type: "line", source: "roads", paint: { "line-width": 3, "line-opacity": 0.8, "line-color": ["step", ["get", "vc"], "#3fd27f", 0.6, "#ffb224", 0.9, "#ff5b4c"] } });
  map.addLayer({ id: "routes", type: "line", source: "routes", paint: { "line-width": 2, "line-opacity": 0.55, "line-color": ["get", "color"] } });
  map.addLayer({ id: "parks", type: "circle", source: "parks", paint: { "circle-radius": ["get", "r"], "circle-color": ["get", "color"], "circle-opacity": 0.85, "circle-stroke-color": "#111214", "circle-stroke-width": 2 } });
  map.addLayer({ id: "parks-l", type: "symbol", source: "parks", layout: { "text-field": ["get", "label"], "text-size": 12, "text-offset": [0, 1.6], "text-font": ["Noto Sans Regular"] }, paint: { "text-color": "#f1eee6", "text-halo-color": "#111214", "text-halo-width": 1.5 } });
  map.addLayer({ id: "cameras", type: "circle", source: "cameras", paint: { "circle-radius": 7, "circle-color": ["step", ["get", "rel"], "#3fd27f", 0.5, "#ffb224", 0.85, "#ff5b4c"], "circle-stroke-color": "#f1eee6", "circle-stroke-width": 1.5 } });
  map.addLayer({ id: "dest", type: "circle", source: "dest", paint: { "circle-radius": 10, "circle-color": "#f3c316", "circle-stroke-color": "#111214", "circle-stroke-width": 3 } });
  const camFeatures = () => ({
    type: "FeatureCollection" as const,
    features: district.cameras.map((c, i) => ({ type: "Feature" as const, properties: { i, rel: cameraLoad(c, $<HTMLSelectElement>("when").value === "ahead").rel }, geometry: { type: "Point" as const, coordinates: [c.lon, c.lat] } })),
  });
  (map.getSource("cameras") as GeoJSONSource).setData(camFeatures());

  map.on("click", (e) => {
    const hit = map.queryRenderedFeatures(e.point, { layers: ["cameras"] })[0];
    if (hit) {
      showCamera(district.cameras[Number(hit.properties?.i)]);
      return;
    }
    dest = [e.lngLat.lng, e.lngLat.lat];
    run();
  });
  map.on("mouseenter", "cameras", () => (map.getCanvas().style.cursor = "pointer"));
  map.on("mouseleave", "cameras", () => (map.getCanvas().style.cursor = ""));
  $<HTMLInputElement>("n").addEventListener("input", (e) => ($("n-out").textContent = (e.target as HTMLInputElement).value));
  $<HTMLInputElement>("n").addEventListener("change", run);
  $("window").addEventListener("change", run);
  $("when").addEventListener("change", () => {
    (map.getSource("cameras") as GeoJSONSource).setData(camFeatures());
    run();
  });
  for (const b of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) {
    b.addEventListener("click", () => {
      mode = b.dataset.mode as "nearest" | "oqim";
      for (const x of document.querySelectorAll<HTMLButtonElement>("[data-mode]")) x.setAttribute("aria-pressed", String(x === b));
      draw();
    });
  }
  $("play").addEventListener("click", () => {
    clearInterval(timer);
    shown = 0;
    draw();
    timer = window.setInterval(() => {
      shown++;
      draw();
      if (last && shown >= (mode === "nearest" ? last.nearest : last.oqim).assignments.length) {
        clearInterval(timer);
        shown = Infinity;
      }
    }, 180);
  });
  $("status").textContent = `${district.district}: ${district.cameras.length} cameras, ${parksAll.length} car parks, ${liveNote}. Placing drivers`;
  await new Promise((ok) => setTimeout(ok, 30));
  run();
  flyTo = (c) => map.easeTo({ center: [c.lon, c.lat], zoom: Math.max(map.getZoom(), 15) });
  cameraWall();
  const busiest = [...district.cameras].sort((a, b) => (b.last?.boxes.length ?? 0) - (a.last?.boxes.length ?? 0))[0];
  if (busiest) showCamera(busiest);
}

main().catch((e) => {
  $("status").textContent = `Could not load the district: ${e instanceof Error ? e.message : String(e)}`;
});

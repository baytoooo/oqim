// Drivers heading to one destination, and the car parks around it. Each driver gets a car park and
// a route. "nearest": everyone to the car park closest to the destination by the shortest route,
// as a navigator would do. "oqim": drivers are placed one by one, each on the car park and route
// that cost least given the traffic the cameras see AND the drivers already placed: their routes
// load the roads (BPR travel times) and their cars fill the car parks, so the next driver is not
// sent into the same queue. Both are then judged by the same evaluation. No DOM.

export interface Graph {
  nodes: [number, number][];
  /** [a, b, metres, class, oneway, lanes] */
  edges: [number, number, number, number, number, number][];
}

export interface CarPark {
  name: string;
  node: number;
  capacity: number;
  /** Free spaces when the first driver sets off. */
  free: number;
  /** Metres to walk from it to the destination. */
  walk: number;
}

export interface Driver {
  id: number;
  origin: number;
  /** Seconds after the start when the driver sets off. */
  depart: number;
}

export interface Assignment {
  driver: number;
  park: number;
  path: number[]; // edge indices
  arrive: number;
  full: boolean;
}

export interface Outcome {
  assignments: Assignment[];
  meanDoorToDoor: number; // s: drive + search when full + walk
  arrivedFull: number;
  maxVc: number;
  vehKm: number;
  /** v/c per edge at the end (background + these drivers). */
  vc: number[];
}

// urban speeds by OSM class (motorway/trunk, primary, secondary, tertiary, link), km/h
const SPEED = [40, 30, 30, 25, 25];
const LANES = [2, 2, 1, 1, 1];
/** Vehicles an hour a signalised urban lane carries (about half of 1900 for the red time). */
export const LANE_CAPACITY = 900;
export const BPR = { alpha: 0.15, beta: 4 };
/** Window over which the drivers' own trips add to the hourly flow on a road. */
export const WINDOW_H = 0.25;
/** Seconds a driver spends looking for a space once the chosen car park turns out full. */
export const SEARCH_S = 480;
const WALK_MS = 1.3;

export function freeTime(g: Graph, e: number): number {
  const [, , m, cls] = g.edges[e];
  return m / (SPEED[cls] / 3.6);
}
export function capacity(g: Graph, e: number): number {
  const [, , , cls, , lanes] = g.edges[e];
  return (lanes > 0 ? lanes : LANES[cls]) * LANE_CAPACITY;
}
export function bpr(t0: number, vc: number): number {
  return t0 * (1 + BPR.alpha * Math.pow(Math.max(0, vc), BPR.beta));
}

/** Directed adjacency: out[node] = [[next node, edge index], ...]. */
export function adjacency(g: Graph): [number, number][][] {
  const out: [number, number][][] = g.nodes.map(() => []);
  g.edges.forEach(([a, b, , , oneway], e) => {
    out[a].push([b, e]);
    if (!oneway) out[b].push([a, e]);
  });
  return out;
}

/** Shortest paths from `src` by edge cost; returns the previous edge and node of every node. */
export function shortest(g: Graph, out: [number, number][][], src: number, cost: (e: number) => number) {
  const n = g.nodes.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prevE = new Int32Array(n).fill(-1);
  const prevN = new Int32Array(n).fill(-1);
  dist[src] = 0;
  const heap: [number, number][] = [[0, src]];
  while (heap.length) {
    // small binary heap
    let i = 0;
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
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
    const [d, u] = top;
    if (d > dist[u]) continue;
    for (const [v, e] of out[u]) {
      const nd = d + cost(e);
      if (nd < dist[v]) {
        dist[v] = nd;
        prevE[v] = e;
        prevN[v] = u;
        heap.push([nd, v]);
        let k = heap.length - 1;
        while (k > 0) {
          const p = (k - 1) >> 1;
          if (heap[p][0] <= heap[k][0]) break;
          [heap[p], heap[k]] = [heap[k], heap[p]];
          k = p;
        }
      }
    }
  }
  return { dist, prevE, prevN };
}

function pathTo(prevE: Int32Array, prevN: Int32Array, src: number, dst: number): number[] | null {
  if (src === dst) return [];
  if (prevE[dst] < 0) return null;
  const path: number[] = [];
  for (let v = dst; v !== src; v = prevN[v]) {
    if (prevE[v] < 0) return null;
    path.push(prevE[v]);
  }
  return path.reverse();
}

/** Drive time along a path under v/c `vc`. */
function driveTime(g: Graph, path: number[], vc: Float64Array): number {
  return path.reduce((s, e) => s + bpr(freeTime(g, e), vc[e]), 0);
}

/**
 * Judges a set of assignments: every driver's path loads the roads (for WINDOW_H hours), travel
 * times follow BPR on background + these loads, car parks fill in order of arrival, and a driver
 * who finds the car park full searches for SEARCH_S s. Same for both strategies.
 */
export function evaluate(g: Graph, background: Float64Array, parks: CarPark[], drivers: Driver[], plan: { driver: number; park: number; path: number[] }[], leaveRate = 0.01): Outcome {
  const load = new Float64Array(g.edges.length);
  for (const p of plan) for (const e of p.path) load[e] += 1 / WINDOW_H;
  const vc = new Float64Array(g.edges.length);
  for (let e = 0; e < vc.length; e++) vc[e] = background[e] + load[e] / capacity(g, e);
  const byId = new Map(drivers.map((d) => [d.id, d]));
  const timed = plan.map((p) => ({ ...p, arrive: byId.get(p.driver)!.depart + driveTime(g, p.path, vc) })).sort((a, b) => a.arrive - b.arrive);
  // spaces free at time t: the free ones, plus those that leaveRate frees each minute, minus the cars in
  const used = parks.map(() => 0);
  const available = (i: number, t: number) => {
    const occ = parks[i].capacity - parks[i].free;
    return parks[i].free + Math.floor(Math.min(occ, (occ * leaveRate * t) / 60)) - used[i];
  };
  let total = 0, full = 0, metres = 0;
  const assignments: Assignment[] = timed.map((p) => {
    const isFull = available(p.park, p.arrive) <= 0;
    if (isFull) full++;
    else used[p.park]++;
    const d = byId.get(p.driver)!;
    total += p.arrive - d.depart + (isFull ? SEARCH_S : 0) + parks[p.park].walk / WALK_MS;
    metres += p.path.reduce((s, e) => s + g.edges[e][2], 0) + (isFull ? (SEARCH_S * 15) / 3.6 : 0);
    return { driver: p.driver, park: p.park, path: p.path, arrive: p.arrive, full: isFull };
  });
  let maxVc = 0;
  for (const p of plan) for (const e of p.path) maxVc = Math.max(maxVc, vc[e]);
  return { assignments, meanDoorToDoor: plan.length ? total / plan.length : 0, arrivedFull: full, maxVc, vehKm: metres / 1000, vc: Array.from(vc) };
}

/** Everyone to the car park nearest the destination, on the shortest route at today's traffic. */
export function nearest(g: Graph, background: Float64Array, parks: CarPark[], drivers: Driver[]) {
  const out = adjacency(g);
  const target = parks.reduce((b, p, i) => (p.walk < parks[b].walk ? i : b), 0);
  const cost = (e: number) => bpr(freeTime(g, e), background[e]);
  return drivers.map((d) => {
    const { prevE, prevN } = shortest(g, out, d.origin, cost);
    return { driver: d.id, park: target, path: pathTo(prevE, prevN, d.origin, parks[target].node) ?? [] };
  });
}

/**
 * OQIM: drivers in order of departure; each takes the car park and route of least expected
 * door-to-door time given the roads loaded by the drivers already placed and the spaces they will
 * take, and then adds their own load. `leaveRate`: share of occupied spaces freed per minute.
 */
export function coordinated(g: Graph, background: Float64Array, parks: CarPark[], drivers: Driver[], leaveRate = 0.01) {
  const out = adjacency(g);
  const load = new Float64Array(g.edges.length);
  const vc = new Float64Array(g.edges.length);
  const refresh = () => {
    for (let e = 0; e < vc.length; e++) vc[e] = background[e] + load[e] / capacity(g, e);
  };
  refresh();
  // expected arrivals per car park, for its predicted free spaces at a later arrival
  const taken: number[][] = parks.map(() => []);
  const plan: { driver: number; park: number; path: number[] }[] = [];
  for (const d of [...drivers].sort((a, b) => a.depart - b.depart)) {
    const { prevE, prevN } = shortest(g, out, d.origin, (e) => bpr(freeTime(g, e), vc[e]));
    let best = -1, bestCost = Infinity, bestPath: number[] = [];
    parks.forEach((p, i) => {
      const path = pathTo(prevE, prevN, d.origin, p.node);
      if (!path) return;
      const arrive = d.depart + driveTime(g, path, vc);
      const occupied0 = p.capacity - p.free;
      const freedBy = Math.floor(Math.min(occupied0, (occupied0 * leaveRate * arrive) / 60));
      const predictedFree = p.free + freedBy - taken[i].filter((t) => t <= arrive).length;
      const risk = predictedFree <= 0 ? SEARCH_S : predictedFree < 3 ? SEARCH_S * 0.3 : 0;
      const cost = arrive - d.depart + p.walk / WALK_MS + risk;
      if (cost < bestCost) [best, bestCost, bestPath] = [i, cost, path];
    });
    if (best < 0) continue;
    plan.push({ driver: d.id, park: best, path: bestPath });
    taken[best].push(d.depart + driveTime(g, bestPath, vc));
    for (const e of bestPath) load[e] += 1 / WINDOW_H;
    refresh();
  }
  return plan;
}

/**
 * Holt's linear smoothing of a series (one value per step) and its forecast `ahead` steps on;
 * backtest: mean absolute error of the one-step forecasts against the naive "same as last".
 */
export function holt(series: number[], ahead = 3, a = 0.5, b = 0.3) {
  if (!series.length) return { forecast: NaN, mae: NaN, naiveMae: NaN, n: 0 };
  let level = series[0], trend = 0;
  let err = 0, naive = 0, n = 0;
  for (let i = 1; i < series.length; i++) {
    const f = level + trend;
    err += Math.abs(series[i] - f);
    naive += Math.abs(series[i] - series[i - 1]);
    n++;
    const prev = level;
    level = a * series[i] + (1 - a) * (level + trend);
    trend = b * (level - prev) + (1 - b) * trend;
  }
  return { forecast: Math.max(0, level + ahead * trend), mae: n ? err / n : NaN, naiveMae: n ? naive / n : NaN, n };
}

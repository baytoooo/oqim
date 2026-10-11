// The signal audit of one clip: lights, crossings and measures per approach, the phase groups and
// cycle, a new plan (Webster 1958, then checked and tuned by replaying the clip's own vehicles), and
// the replay under four controllers. Pure functions; the page (src/scripts/oqim.ts) feeds them the
// tracker boxes and the head colours it collected while the clip was analysed.

import { cycleLength, greensOf, headLights, inferGreens, lightAt, percentile, redsOf } from "./phases.ts";
import { simulate, type Controller, type Junction, type SimResult } from "./sim.ts";
import { crossings as findCrossings, queueAt, vehicleTracks } from "./tracks.ts";
import type { AuditConfig, Crossing, HeadSeries, Interval, Light } from "./types.ts";

export const DEFAULTS = {
  headway: 2.0, // s, a single lane (HCM's base saturation flow of 1900 veh/h/lane is 1.9 s)
  startup: 2.0, // s
  intergreen: 4.0, // s, amber 3 + all red 1
  minGreen: 7, // s: a driver who has stopped expects at least this; also a pedestrian's walk
  maxCycle: 150,
  minCycle: 40,
};

export interface ApproachAudit {
  id: string;
  name: string;
  /** Where the lights come from. */
  source: "head" | "motion";
  greens: Interval[];
  reds: Interval[] | null;
  crossings: Crossing[];
  vehicles: number;
  flowPerHour: number;
  /** Measured: mean seconds a vehicle stood before the line. */
  meanWait: number;
  stoppedShare: number;
  arrivalsOnGreen: number;
  headway: number;
  headwayMeasured: boolean;
  startup: number;
  greenMean: number | null;
  redRuns: Crossing[];
  maxQueue: number;
  group: number;
}

export interface ModeResult {
  key: "measured" | "webster" | "tuned" | "actuated" | "maxpressure" | "predictive";
  label: string;
  note: string;
  sim: SimResult;
  /** Green seconds per group in cycle order, for the plans that have them. */
  greens?: number[];
  cycle?: number;
}

export interface Audit {
  duration: number;
  approaches: ApproachAudit[];
  groups: number;
  order: number[];
  cycle: number | null;
  intergreen: number;
  hidden: number;
  /** Sum of the critical flow ratios (Webster's Y). */
  Y: number;
  oversaturated: boolean;
  modes: ModeResult[];
  /** The replay under the measured lights against what the video shows. */
  check: { departureError: number; measuredWait: number; modelWait: number; vehicles: number };
  warnings: string[];
}

const median = (v: number[]) => (v.length ? percentile(v, 50) : NaN);
const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);

function overlap(a: Interval[], b: Interval[]): number {
  let s = 0;
  for (const x of a) for (const y of b) s += Math.max(0, Math.min(x.end, y.end) - Math.max(x.start, y.start));
  return s;
}
const total = (v: Interval[]) => v.reduce((s, g) => s + g.end - g.start, 0);

/** Saturation headway and start-up time from the queues that moved off on each green. */
function discharge(cs: Crossing[], greens: Interval[]): { headway: number | null; startup: number | null } {
  const hs: number[] = [];
  const st: number[] = [];
  for (const g of greens) {
    const q = cs.filter((c) => c.arrival <= g.start + 0.5 && c.t >= g.start && c.t <= g.end + 3).sort((a, b) => a.t - b.t);
    if (!q.length) continue;
    st.push(q[0].t - g.start);
    // the busiest WINDOW s of the green: the rate the approach can discharge at, all its lanes
    // together (the point queue of sim.ts holds a standing queue at the line, so it needs the rate,
    // not the headway of one lane)
    const WINDOW = 10;
    const inGreen = cs.filter((c) => c.t >= g.start && c.t <= g.end + 3).map((c) => c.t).sort((a, b) => a - b);
    if (q.length >= 4 && g.end - g.start >= WINDOW) {
      let most = 0;
      for (let i = 0, k = 0; i < inGreen.length; i++) {
        while (inGreen[i] - inGreen[k] > WINDOW) k++;
        most = Math.max(most, i - k + 1);
      }
      if (most >= 3) hs.push(WINDOW / most);
    }
  }
  return {
    headway: hs.length >= 2 ? Math.min(5, Math.max(0.3, median(hs))) : null,
    startup: st.length >= 2 ? Math.min(6, Math.max(0, median(st))) : null,
  };
}

/** Groups of approaches that have green together (union of pairs whose greens overlap by half). */
function phaseGroups(greens: Interval[][]): number[] {
  const n = greens.length;
  const parent = greens.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < n; i++)
    for (let k = i + 1; k < n; k++) {
      const small = Math.min(total(greens[i]), total(greens[k]));
      if (small > 0 && overlap(greens[i], greens[k]) >= 0.5 * small) parent[find(i)] = find(k);
    }
  const ids = new Map<number, number>();
  return greens.map((_, i) => {
    const r = find(i);
    if (!ids.has(r)) ids.set(r, ids.size);
    return ids.get(r)!;
  });
}

export interface AuditInput {
  config: AuditConfig;
  frames: { t: number; boxes: [number, number, number, number, number, number][] }[];
  heads: HeadSeries;
  duration: number;
}

export function audit(input: AuditInput): Audit {
  const { config, frames, heads, duration } = input;
  const warnings: string[] = [];
  const tracks = vehicleTracks(frames);
  const byId = new Map(tracks.map((t) => [t.id, t]));
  const all = findCrossings(tracks, config.approaches);

  // lights per approach
  const lights = config.approaches.map((ap) => {
    const cs = all.filter((c) => c.approach === ap.id);
    if (ap.head !== null && heads.t.length) {
      const l = headLights(heads, ap.head);
      const greens = greensOf(heads.t, l, duration);
      const reds = redsOf(heads.t, l, duration);
      if (greens.length && reds.length) return { source: "head" as const, greens, reds, cs };
      warnings.push(`${ap.name}: the signal head did not show both red and green; its lights come from the traffic instead.`);
    }
    return { source: "motion" as const, greens: inferGreens(cs), reds: null as Interval[] | null, cs };
  });
  for (const [k, ap] of config.approaches.entries()) {
    for (const c of lights[k].cs) c.light = lightAt(lights[k].greens, lights[k].reds, c.t) as Light;
    if (lights[k].cs.length < 10) warnings.push(`${ap.name}: only ${lights[k].cs.length} vehicles crossed its line; check that the line spans its lanes.`);
  }

  const group = phaseGroups(lights.map((l) => l.greens));
  const groups = Math.max(0, ...group) + 1;

  // cycle, intergreen and order from the approaches with heads first
  const headGreens = lights.filter((l) => l.source === "head").map((l) => l.greens);
  const cycles = (headGreens.length ? headGreens : lights.map((l) => l.greens)).map(cycleLength).filter((x): x is number => x !== null);
  const cycle = cycles.length ? median(cycles) : null;
  if (cycle === null) warnings.push("Fewer than two full signal cycles in the clip: the cycle length is unknown. A clip of 3 minutes or more is safer.");

  const firstGreen = (gi: number) =>
    Math.min(...lights.filter((_, k) => group[k] === gi).flatMap((l) => l.greens.filter((g) => g.start > 0.5).map((g) => g.start)), Infinity);
  const order = [...Array(groups).keys()].sort((a, b) => firstGreen(a) - firstGreen(b));
  const start = Math.min(...order.map(firstGreen));

  // gaps between one group's green and the next group's
  const gaps: number[] = [];
  for (let o = 0; order.length > 1 && o < order.length; o++) {
    const a = order[o], b = order[(o + 1) % order.length];
    const ends = lights.filter((_, k) => group[k] === a).flatMap((l) => l.greens.map((g) => g.end));
    const starts = lights.filter((_, k) => group[k] === b).flatMap((l) => l.greens.map((g) => g.start));
    for (const e of ends) {
      const nxt = starts.filter((s) => s >= e - 0.5).sort((x, y) => x - y)[0];
      if (nxt !== undefined && nxt - e < 15) gaps.push(Math.max(0, nxt - e));
    }
  }
  const intergreen = gaps.length >= 2 ? Math.min(8, Math.max(2, median(gaps))) : DEFAULTS.intergreen;

  const approaches: ApproachAudit[] = config.approaches.map((ap, k) => {
    const { source, greens, reds, cs } = lights[k];
    const d = discharge(cs, greens);
    if (d.headway === null) warnings.push(`${ap.name}: too few queues moved off to measure the saturation headway; ${DEFAULTS.headway} s assumed.`);
    let maxQueue = 0;
    for (let t = 0; t < duration; t += 1) maxQueue = Math.max(maxQueue, queueAt(cs, byId, ap.id, t));
    const inGreen = (x: number) => greens.some((g) => x >= g.start && x < g.end);
    return {
      id: ap.id,
      name: ap.name,
      source,
      greens,
      reds,
      crossings: cs,
      vehicles: cs.length,
      flowPerHour: (cs.length / Math.max(1, duration)) * 3600,
      meanWait: mean(cs.map((c) => c.stopped)),
      stoppedShare: cs.length ? cs.filter((c) => c.stopped > 1).length / cs.length : 0,
      arrivalsOnGreen: cs.length ? cs.filter((c) => inGreen(c.arrival)).length / cs.length : 0,
      headway: d.headway ?? DEFAULTS.headway,
      headwayMeasured: d.headway !== null,
      startup: d.startup ?? DEFAULTS.startup,
      greenMean: greens.length ? mean(greens.filter((g) => g.start > 0 && g.end < duration).map((g) => g.end - g.start)) || null : null,
      // a red-light run: crossing on red, more than 1 s after it turned red (not a late amber)
      redRuns: source === "head" ? cs.filter((c) => reds?.some((r) => c.t >= r.start + 1 && c.t < r.end)) : [],
      maxQueue,
      group: group[k],
    };
  });

  // time of the phases not in view: what is left of the cycle after the groups we see
  const greenOf = (gi: number) => Math.max(0, ...approaches.filter((a) => a.group === gi).map((a) => a.greenMean ?? 0));
  const seen = order.reduce((s, gi) => s + greenOf(gi) + intergreen, 0);
  const hidden = cycle !== null && cycle - seen > 3 ? cycle - seen : 0;

  // the measured lights go on after the clip as its last cycle did, so the replay can let the last
  // queue go (sim.ts runs on until every vehicle has left)
  const extend = (greens: Interval[]): Interval[] => {
    const period = cycle ?? 90;
    const full = greens.filter((g) => g.end < duration - 0.5);
    const last = full[full.length - 1];
    if (!last) return greens;
    const out = greens.filter((g) => g.start < duration - 0.5).map((g) => ({ ...g, end: Math.min(g.end, duration) }));
    // the green running at the end of the clip runs as long as the last full one
    const tail = out[out.length - 1];
    if (tail && tail !== last && tail.end >= duration - 0.5) tail.end = tail.start + (last.end - last.start);
    for (let k = 1; last.start + k * period < duration + 600; k++) {
      const g = { start: last.start + k * period, end: last.end + k * period };
      if (g.start > (out[out.length - 1]?.end ?? 0)) out.push(g);
    }
    return out;
  };
  const redRunIds = new Set(approaches.flatMap((a) => a.redRuns));
  const controlled = (a: ApproachAudit) => a.crossings.filter((c) => !redRunIds.has(c));
  const junction: Junction = {
    approaches: approaches.map((a) => ({
      id: a.id,
      // vehicles that crossed on red (a free right turn, or a violation) do not wait for this signal
      arrivals: controlled(a).map((c) => c.arrival).sort((x, y) => x - y),
      headway: a.headway,
      startup: a.startup,
      group: a.group,
      greens: extend(a.greens),
    })),
    order,
    intergreen,
    hidden,
    start: Number.isFinite(start) ? start : 0,
    duration,
  };

  // Webster: y = q / s of the busiest approach of each group. The phases out of view (the cross
  // street the camera does not see) count as one more group, loaded as much as the groups we see
  // (the same degree of saturation): their demand is unknown, so this keeps their share of the cycle.
  const yObs = order.map((gi) =>
    Math.max(0, ...approaches.filter((a) => a.group === gi).map((a) => ((controlled(a).length / Math.max(1, duration)) * 3600) / (3600 / a.headway))),
  );
  const startups = order.map((gi) => Math.max(0, ...approaches.filter((a) => a.group === gi).map((a) => a.startup)));
  const greenNow = order.map((gi) => Math.max(1, ...approaches.filter((a) => a.group === gi).map((a) => a.greenMean ?? 0)));
  const xObs = cycle ? Math.max(...yObs.map((v, o) => v / Math.max(0.05, (greenNow[o] - startups[o]) / cycle))) : 0.8;
  const hiddenLost = hidden > 0 ? intergreen + DEFAULTS.startup : 0;
  const yHidden = hidden > 0 && cycle ? Math.min(0.6, (Math.max(0, hidden - hiddenLost) / cycle) * xObs) : 0;
  const Y = yObs.reduce((s, v) => s + v, 0) + yHidden;
  const oversaturated = Y >= 0.9;
  const lost = order.length * intergreen + startups.reduce((s, v) => s + v, 0) + hiddenLost;
  const plan = (C: number) => {
    const effective = Math.max(0, C - lost);
    const greens = order.map((_, o) => Math.max(DEFAULTS.minGreen, effective * (Y > 0 ? yObs[o] / Y : 1 / order.length) + startups[o]));
    const hid = hidden > 0 ? hiddenLost + effective * (yHidden / Y) : 0;
    return { greens, hidden: hid };
  };
  const websterCycle = Math.min(DEFAULTS.maxCycle, Math.max(DEFAULTS.minCycle, oversaturated ? DEFAULTS.maxCycle : (1.5 * lost + 5) / (1 - Y)));
  if (oversaturated) warnings.push(`Demand is near capacity (Y = ${Y.toFixed(2)}): retiming helps little; the junction needs capacity or less traffic.`);
  if (hidden > 0) warnings.push(`About ${hidden.toFixed(0)} s of each cycle go to phases out of view; the plans keep them loaded as much as the approaches in view.`);

  const run = (c: Controller) => simulate(junction, c);
  const measured = run({ kind: "measured" });
  const w = plan(websterCycle);
  const webster = run({ kind: "fixed", ...w });

  // the cycle that loses least on this clip's own vehicles, split as Webster's; the current timing,
  // run as a fixed plan, is a candidate too
  let best = { C: websterCycle, ...w, sim: webster };
  if (cycle !== null) {
    const cur = { greens: greenNow, hidden };
    const sim = run({ kind: "fixed", ...cur });
    if (sim.vehHours < best.sim.vehHours - 1e-9) best = { C: cycle, ...cur, sim };
  }
  // search: every cycle from 40 to 150 s, the green split by demand raised to a power (sharper or
  // flatter than Webster's) and the time of the phases out of view scaled up or down
  const shaped = (C: number, power: number, hiddenScale: number) => {
    const hid = hidden > 0 ? hiddenLost + Math.max(0, C - lost) * (yHidden / Math.max(1e-6, Y)) * hiddenScale : 0;
    const effective = Math.max(0, C - lost - (hid > 0 ? hid - hiddenLost : 0));
    const wts = yObs.map((v) => Math.pow(Math.max(1e-6, v), power));
    const tot = wts.reduce((a, b) => a + b, 0);
    const greens = order.map((_, o) => Math.max(DEFAULTS.minGreen, (effective * wts[o]) / tot + startups[o]));
    return { greens, hidden: hid };
  };
  let tried = 0;
  for (let C = DEFAULTS.minCycle; C <= DEFAULTS.maxCycle; C += 5)
    for (const power of order.length > 1 ? [0.5, 1, 1.5] : [1])
      for (const hs of hidden > 0 ? [0.7, 0.85, 1, 1.15, 1.3] : [1]) {
        const p = shaped(C, power, hs);
        const sim = run({ kind: "fixed", ...p });
        tried++;
        if (sim.vehHours < best.sim.vehHours - 1e-9) best = { C, ...p, sim };
      }
  const maxGreen = Math.max(30, ...best.greens.map((g) => 1.6 * g));
  const actuated = run({ kind: "actuated", min: DEFAULTS.minGreen, max: maxGreen, gap: 3 });
  const pressure = run({ kind: "maxpressure", min: DEFAULTS.minGreen, max: maxGreen, step: 5, hidden: best.hidden });
  const predictive = run({ kind: "predictive", min: DEFAULTS.minGreen, max: maxGreen, horizon: 30, greens: best.greens, hidden: best.hidden });

  const sum = (g: number[], hid: number) => g.reduce((s, v) => s + v, 0) + order.length * intergreen + hid;
  const modes: ModeResult[] = [
    { key: "measured", label: "Now", note: "the lights as read from the video", sim: measured, cycle: cycle ?? undefined },
    { key: "webster", label: "Webster formula (1958)", note: "the textbook cycle and split for the measured demand", sim: webster, greens: w.greens, cycle: sum(w.greens, w.hidden) },
    { key: "tuned", label: "Searched fixed plan", note: `the best of ${tried + 2} fixed plans (cycle 40 to 150 s, split and the phases out of view varied) replayed on this clip`, sim: best.sim, greens: best.greens, cycle: sum(best.greens, best.hidden) },
    { key: "actuated", label: "Actuated", note: "green held while vehicles keep coming (3 s gap), as a loop detector controller", sim: actuated },
    { key: "maxpressure", label: "Max-pressure", note: "every 5 s, green to the group with the longest queue (Varaiya 2013); it needs no plan and works junction by junction in a network", sim: pressure },
    { key: "predictive", label: "OQIM predictive", note: "starts from the searched plan and, each second, ends or holds the green by the next 30 s of arrivals (in the field: the camera upstream)", sim: predictive },
  ];

  // the check: the replay under the measured lights against the crossings on the video
  const err: number[] = [];
  junction.approaches.forEach((ap, a) => {
    const cs = [...controlled(approaches[a])].sort((x, y) => x.arrival - y.arrival);
    cs.forEach((c, i) => {
      const d = measured.departures[a][i];
      if (!Number.isNaN(d) && !c.censored) err.push(Math.abs(d - c.t));
    });
  });
  const real = approaches.flatMap((a) => controlled(a).map((c) => c.stopped));
  const check = {
    departureError: err.length ? median(err) : NaN,
    measuredWait: mean(real),
    modelWait: measured.meanDelay,
    vehicles: err.length,
  };

  return { duration, approaches, groups, order, cycle, intergreen, hidden, Y, oversaturated, modes, check, warnings };
}

// Vehicle tracks from the tracker boxes of every analysed frame (PipelineResult.overlay), and the
// moments they cross the stop lines.

import type { Approach, Crossing, Pt, VTrack } from "./types.ts";

/** COCO ids of the vehicles: car, motorcycle, bus, truck. */
export const VEHICLES = new Set([2, 3, 5, 7]);

/** A vehicle stands still below this speed, in its own sizes per second (a car is about 4.5 m long,
 * so 0.15 is about 0.7 m/s). Relative to its size, so it holds near and far from the camera. */
export const STOP_REL = 0.15;

type Box = [number, number, number, number, number, number];

function movingAverage(v: number[], size: number): number[] {
  const h = Math.floor(size / 2);
  return v.map((_, i) => {
    let s = 0, n = 0;
    for (let j = Math.max(0, i - h); j <= Math.min(v.length - 1, i + h); j++) {
      s += v[j];
      n++;
    }
    return s / n;
  });
}

function gradient(f: number[], t: number[]): number[] {
  const n = f.length;
  if (n < 2) return f.map(() => 0);
  return f.map((_, i) => {
    const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
    return (f[b] - f[a]) / Math.max(1e-6, t[b] - t[a]);
  });
}

/** Tracks of vehicles seen in at least `minLen` frames. `frames` are the overlay frames: the boxes
 * [x1, y1, x2, y2, track id, COCO class] of each analysed frame, in time order. */
export function vehicleTracks(frames: { t: number; boxes: Box[] }[], minLen = 5, smooth = 5): VTrack[] {
  const raw = new Map<number, { t: number[]; box: number[][]; cls: Map<number, number> }>();
  for (const f of frames) {
    for (const [x1, y1, x2, y2, id, cls] of f.boxes) {
      let r = raw.get(id);
      if (!r) raw.set(id, (r = { t: [], box: [], cls: new Map() }));
      r.t.push(f.t);
      r.box.push([x1, y1, x2, y2]);
      r.cls.set(cls, (r.cls.get(cls) ?? 0) + 1);
    }
  }
  const out: VTrack[] = [];
  for (const [id, r] of raw) {
    if (r.t.length < minLen) continue;
    const cls = [...r.cls.entries()].sort((a, b) => b[1] - a[1])[0][0];
    if (!VEHICLES.has(cls)) continue;
    const fx = movingAverage(r.box.map(([x1, , x2]) => (x1 + x2) / 2), smooth);
    const fy = movingAverage(r.box.map(([, y1, , y2]) => y2 - 0.15 * (y2 - y1)), smooth);
    const size = movingAverage(r.box.map(([x1, y1, x2, y2]) => Math.sqrt(Math.max(1, (x2 - x1) * (y2 - y1)))), 2 * smooth + 1);
    const vx = gradient(fx, r.t), vy = gradient(fy, r.t);
    out.push({
      id,
      cls,
      t: r.t,
      foot: fx.map((x, i): Pt => [x, fy[i]]),
      size,
      speed: vx.map((v, i) => Math.hypot(v, vy[i])),
    });
  }
  return out;
}

const cross = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

/** Where the step a -> b crosses the line p -> q: the fraction along a -> b and the side it came from
 * (+1 or -1), or null. `slack` lets the crossing fall a little beyond the line's ends (fraction of its length). */
export function segmentCrossing(a: Pt, b: Pt, p: Pt, q: Pt, slack = 0.08): { f: number; dir: number } | null {
  const sa = cross(p, q, a), sb = cross(p, q, b);
  if (sa === 0 || sa * sb > 0) return null;
  const f = sa / (sa - sb);
  const x: Pt = [a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])];
  const len2 = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
  const u = ((x[0] - p[0]) * (q[0] - p[0]) + (x[1] - p[1]) * (q[1] - p[1])) / Math.max(1e-9, len2);
  if (u < -slack || u > 1 + slack) return null;
  return { f, dir: sb > 0 ? 1 : -1 };
}

/** The tracks that cross each approach's stop line, the way the approach's traffic goes. That way is
 * the one most crossings take (draw the line over the lanes of one approach only); a track counts
 * once per line, at its first crossing. Light is filled in later (phases.ts lightAt). */
export function crossings(tracks: VTrack[], approaches: Approach[]): Crossing[] {
  const out: Crossing[] = [];
  for (const ap of approaches) {
    const [p, q] = ap.line;
    const hits: { tr: VTrack; i: number; t: number; dir: number }[] = [];
    for (const tr of tracks) {
      for (let i = 0; i + 1 < tr.t.length; i++) {
        const c = segmentCrossing(tr.foot[i], tr.foot[i + 1], p, q);
        if (!c) continue;
        hits.push({ tr, i, t: tr.t[i] + c.f * (tr.t[i + 1] - tr.t[i]), dir: c.dir });
        break;
      }
    }
    const fwd = hits.filter((h) => h.dir > 0).length >= hits.filter((h) => h.dir < 0).length ? 1 : -1;
    for (const h of hits) {
      if (h.dir !== fwd) continue;
      const { tr, i } = h;
      // time stood still before the line, over the track so far
      let stopped = 0;
      for (let k = 1; k <= i; k++) {
        if (tr.speed[k] < STOP_REL * tr.size[k]) stopped += tr.t[k] - tr.t[k - 1];
      }
      const censored = tr.speed[0] < STOP_REL * tr.size[0];
      out.push({ track: tr.id, approach: ap.id, t: h.t, stopped, arrival: h.t - stopped, censored, light: "other" });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Vehicles standing before each line at time t: tracks that will cross it later and are still at t. */
export function queueAt(cs: Crossing[], tracks: Map<number, VTrack>, approach: string, t: number): number {
  let n = 0;
  for (const c of cs) {
    if (c.approach !== approach || c.t <= t || c.arrival > t) continue;
    const tr = tracks.get(c.track);
    if (!tr || tr.t[0] > t) continue;
    n++;
  }
  return n;
}

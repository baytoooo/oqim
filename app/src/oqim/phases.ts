// The lights of each approach: read from a signal head in view, or, with no head in view, from how
// the approach's traffic moves (it stands at the line on red and crosses it on green).

import type { Crossing, HeadScores, HeadSeries, Interval, Light, Rect } from "./types.ts";

/** Pixels of the head that decide its scores: the mean of the strongest TOP_K, so a lamp that lights
 * a small part of a loose rectangle still counts in full. */
const TOP_K = 12;

/**
 * Colour contrast of a head in one frame: [red, amber, green], each the mean of the TOP_K strongest
 * pixels in `rect` of r - max(g, b), min(r, g) - b and g - r. `rgba` is a crop whose top-left
 * corner is at `origin` in work pixels. Green LEDs here are bluish, so green is measured against red only.
 */
export function headScores(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number, rect: Rect, origin: [number, number] = [0, 0]): HeadScores {
  const x0 = Math.max(0, Math.round(rect[0] - origin[0])), x1 = Math.min(width, Math.round(rect[2] - origin[0]));
  const y0 = Math.max(0, Math.round(rect[1] - origin[1])), y1 = Math.min(height, Math.round(rect[3] - origin[1]));
  const red: number[] = [], amber: number[] = [], green: number[] = [];
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * width + x) * 4;
      const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2];
      red.push(r - Math.max(g, b));
      amber.push(Math.min(r, g) - b);
      green.push(g - r);
    }
  }
  const top = (v: number[]) => {
    if (!v.length) return 0;
    v.sort((a, b) => b - a);
    const k = Math.min(TOP_K, v.length);
    let s = 0;
    for (let i = 0; i < k; i++) s += v[i];
    return s / k;
  };
  return [top(red), top(amber), top(green)];
}

function percentile(v: number[], q: number): number {
  if (!v.length) return 0;
  const s = [...v].sort((a, b) => a - b);
  const pos = ((s.length - 1) * q) / 100;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

/** Runs of one value as intervals; each run ends where the next begins (or at `end`). */
export function runsOf<T>(t: number[], v: T[], end: number): { value: T; start: number; end: number }[] {
  const out: { value: T; start: number; end: number }[] = [];
  for (let i = 0; i < t.length; i++) {
    const last = out[out.length - 1];
    if (last && last.value === v[i]) continue;
    if (last) last.end = t[i];
    out.push({ value: v[i], start: t[i], end });
  }
  return out;
}

/**
 * The light of head k in every frame. Each colour is scaled between its dark level (20th percentile
 * over the clip) and its lit level (97th); a colour whose two levels are close never lights and is
 * left out. LED heads flicker on camera (a lit lamp looks dark in some frames), so each colour takes
 * the brightest value within `hold` s around the frame; the stronger colour wins if it is at least a
 * quarter lit. Then: runs shorter than `blip` s between two runs of the same light take that light
 * (no signal phase is that short, amber aside),
 * and dark spells of up to `flash` s inside green (the flashing green before amber) stay green.
 */
export function headLights(series: HeadSeries, k: number, blip = 3, flash = 3, hold = 0.6): Light[] {
  const n = series.t.length;
  const tt = series.t;
  const ch = [0, 2].map((c) => {
    const v = series.scores.map((s) => s[k][c]);
    const lo = percentile(v, 20), hi = percentile(v, 97);
    if (hi - lo < 12) return null;
    const norm = v.map((x) => (x - lo) / (hi - lo));
    // running maximum over +-hold s
    return norm.map((_, i) => {
      let m = -Infinity;
      for (let j = i; j >= 0 && tt[i] - tt[j] <= hold; j--) m = Math.max(m, norm[j]);
      for (let j = i + 1; j < n && tt[j] - tt[i] <= hold; j++) m = Math.max(m, norm[j]);
      return m;
    });
  });
  const [nr, ng] = ch;
  const raw: Light[] = Array.from({ length: n }, (_, i) => {
    const r = nr ? nr[i] : 0, g = ng ? ng[i] : 0;
    if (g >= 0.25 && g > r + 0.08) return "green";
    if (r >= 0.25 && r > g + 0.08) return "red";
    return "other";
  });
  const t = series.t;
  const fix = (maxLen: number, ok: (prev: Light, cur: Light, next: Light) => boolean) => {
    const runs = runsOf(t, raw, t[n - 1] ?? 0);
    for (let j = 1; j + 1 < runs.length; j++) {
      const [a, b, c] = [runs[j - 1], runs[j], runs[j + 1]];
      if (b.end - b.start <= maxLen && ok(a.value, b.value, c.value)) {
        for (let i = 0; i < n; i++) if (t[i] >= b.start && t[i] < b.end) raw[i] = a.value;
        b.value = a.value;
      }
    }
  };
  fix(blip, (a, _b, c) => a === c);
  fix(flash, (a, b, c) => a === "green" && b === "other" && c === "green");
  return raw;
}

/** Green intervals from a light per frame. */
export function greensOf(t: number[], lights: Light[], end: number, minLen = 2): Interval[] {
  return runsOf(t, lights, end)
    .filter((r) => r.value === "green" && r.end - r.start >= minLen)
    .map((r) => ({ start: r.start, end: r.end }));
}

/** Red intervals from a light per frame. */
export function redsOf(t: number[], lights: Light[], end: number, minLen = 2): Interval[] {
  return runsOf(t, lights, end)
    .filter((r) => r.value === "red" && r.end - r.start >= minLen)
    .map((r) => ({ start: r.start, end: r.end }));
}

/**
 * Green intervals of an approach with no head in view, from its crossings. Crossings form one green
 * while they follow each other within `gap` s, unless a vehicle stood at the line through a pause of
 * more than `standGap` s with nothing crossing: that pause was red. A green opens `startup` s before
 * its first crossing when that vehicle had been standing (a queue moves off a little after the
 * light changes), `lead` s before it otherwise, and closes `tail` s after its last crossing.
 */
export function inferGreens(cs: Crossing[], gap = 7, standGap = 3, startup = 2, lead = 1, tail = 1.5): Interval[] {
  const c = [...cs].sort((a, b) => a.t - b.t);
  if (!c.length) return [];
  const bursts: Crossing[][] = [[c[0]]];
  for (let i = 1; i < c.length; i++) {
    const pause = c[i].t - c[i - 1].t;
    // someone standing at the line during the pause: it crossed later and arrived before the pause began
    const standing = pause > standGap && c.slice(i).some((x) => x.stopped > 1 && x.arrival <= c[i - 1].t + 0.5);
    if (pause > gap || standing) bursts.push([c[i]]);
    else bursts[bursts.length - 1].push(c[i]);
  }
  return bursts.map((b) => ({
    start: b[0].t - (b[0].stopped > 1 ? startup : lead),
    end: b[b.length - 1].t + tail,
  }));
}

export function lightAt(greens: Interval[], reds: Interval[] | null, t: number): Light {
  if (greens.some((g) => t >= g.start && t < g.end)) return "green";
  if (!reds) return "red"; // inferred: whatever is not green
  return reds.some((r) => t >= r.start && t < r.end) ? "red" : "other";
}

/** Median time between the starts of consecutive greens: the cycle length, or null. */
export function cycleLength(greens: Interval[]): number | null {
  const starts = greens.filter((g) => g.end - g.start >= 4).map((g) => g.start);
  const d = starts.slice(1).map((s, i) => s - starts[i]).filter((x) => x > 20 && x < 300);
  return d.length ? percentile(d, 50) : null;
}

export { percentile };

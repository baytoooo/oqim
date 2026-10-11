// Parking tracker: how many spaces a car park will have free when a driver gets there, and where
// to send the driver. Each car park is one camera, one frame every 5 minutes; per frame a string
// with one character per space, "1" taken as the detector sees it. No DOM.

export interface LotFrame {
  t: string; // "HH:MM"
  src: string;
  /** Spaces taken (detector, a space changes state when two frames in a row agree). */
  det: string;
  /** Spaces taken by the detector on this frame alone. */
  raw: string;
  /** Spaces taken by the PKLot hand labels. */
  gt: string;
  in: number;
  out: number;
  /** The whole car park: `det` and then the spaces found outside the labelled ones. */
  whole?: string;
  inW?: number;
  outW?: number;
}

export interface Lot {
  id: string;
  name: string;
  long: string;
  date: string;
  weekday: string;
  weather: string;
  capacity: number;
  w: number;
  h: number;
  spaces: [number, number][][];
  frames: LotFrame[];
  /** Typical share of spaces taken on this camera's other weekdays, by 10-minute bin. */
  profile: { m: number; share: number; n: number }[];
  profileDays: string[];
  /** Spaces found outside the labelled ones, [x1, y1, x2, y2] in the frame's pixels. */
  extra?: number[][];
  /** How many of `spaces` are hand-labelled (the rest were found by the camera). */
  labelled?: number;
}

/** The car park with every space the camera found, labelled or not. */
export function wholeLot(lot: Lot): Lot {
  const extra = lot.extra ?? [];
  const inset = (a: number, b: number, f: number) => [a + (b - a) * f, b - (b - a) * f];
  return {
    ...lot,
    labelled: lot.spaces.length,
    capacity: lot.capacity + extra.length,
    spaces: [
      ...lot.spaces,
      ...extra.map(([x1, y1, x2, y2]) => {
        const [a, b] = inset(x1, x2, 0.08), [c, d] = inset(y1, y2, 0.08);
        return [[a, c], [b, c], [b, d], [a, d]] as [number, number][];
      }),
    ],
    frames: lot.frames.map((f) => ({ ...f, det: f.whole ?? f.det, raw: f.whole ?? f.raw, gt: "", in: f.inW ?? f.in, out: f.outW ?? f.out })),
  };
}

export interface Trip {
  /** Minutes to drive there. */
  drive: number;
  /** Minutes to walk from it to the door. */
  walk: number;
}

/** Minutes lost looking for a space in the street when the car park is full. */
export const SEARCH_MIN = 8;
/** Minutes of the recent trend the forecast reads. */
export const RECENT_MIN = 20;

export const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(Math.round(m % 60)).padStart(2, "0")}`;
const ones = (s: string) => {
  let n = 0;
  for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 49) n++;
  return n;
};
export const taken = (f: LotFrame) => ones(f.det);
export const takenTrue = (f: LotFrame) => ones(f.gt);

/** Index of the last frame at or before minute m; -1 before the first. */
export function frameAt(lot: Lot, m: number): number {
  let k = -1;
  for (let i = 0; i < lot.frames.length; i++) {
    if (minutes(lot.frames[i].t) <= m) k = i;
    else break;
  }
  return k;
}

/** Typical share taken at minute m, linear between bin centres; NaN outside the profile. */
export function typical(lot: Lot, m: number): number {
  const P = lot.profile.filter((b) => b.n >= 2);
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i].m + 5, b = P[i + 1].m + 5;
    if (m >= a && m <= b && b - a <= 30) return P[i].share + ((P[i + 1].share - P[i].share) * (m - a)) / (b - a);
  }
  return NaN;
}

/**
 * Spaces taken h minutes after frame i: taken now plus h times the mean of two slopes, the camera's
 * own last RECENT_MIN minutes and the typical day of the same car park at this time.
 */
export function forecast(lot: Lot, i: number, h: number): number {
  const f = lot.frames[i];
  const now = taken(f), m = minutes(f.t);
  const j = frameAt(lot, m - RECENT_MIN);
  const recent = j >= 0 && j < i ? (now - taken(lot.frames[j])) / (m - minutes(lot.frames[j].t)) : NaN;
  const p0 = typical(lot, m), p1 = typical(lot, m + h);
  const prof = Number.isFinite(p0) && Number.isFinite(p1) && h > 0 ? ((p1 - p0) * lot.capacity) / h : NaN;
  const slopes = [recent, prof].filter(Number.isFinite);
  const slope = slopes.length ? slopes.reduce((a, b) => a + b, 0) / slopes.length : 0;
  return Math.min(lot.capacity, Math.max(0, now + h * slope));
}

/**
 * Backtest on the replayed mornings: the forecast made from the detector's counts at each frame
 * against the hand labels of the frame h minutes later (within tol), and the naive forecast
 * "as many as now". Errors in spaces.
 */
export function backtest(lots: Lot[], h = 10, tol = 3) {
  let err = 0, naive = 0, sq = 0, n = 0;
  for (const lot of lots) {
    lot.frames.forEach((f, i) => {
      const target = minutes(f.t) + h;
      let k = -1, best = Infinity;
      lot.frames.forEach((g, j) => {
        const d = Math.abs(minutes(g.t) - target);
        if (j > i && d <= tol && d < best) [k, best] = [j, d];
      });
      if (k < 0) return;
      const truth = takenTrue(lot.frames[k]);
      const e = forecast(lot, i, h) - truth;
      err += Math.abs(e);
      sq += e * e;
      naive += Math.abs(taken(f) - truth);
      n++;
    });
  }
  return { h, mae: n ? err / n : NaN, naiveMae: n ? naive / n : NaN, rmse: n ? Math.sqrt(sq / n) : NaN, n };
}

function phi(z: number) {
  // standard normal CDF (Abramowitz and Stegun 26.2.17)
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}

/** Chance of at least one free space when `free` are expected and the forecast errs by sigma. */
export function chance(free: number, sigma: number) {
  return 1 - phi((0.5 - free) / Math.max(0.5, sigma));
}

export interface Option {
  lot: number;
  freeNow: number;
  freeAtArrival: number;
  chance: number;
  /** Expected minutes to the door: drive + walk + SEARCH_MIN times the chance it is full. */
  cost: number;
}

/**
 * Every car park for a driver asking at minute m: free spaces expected on arrival (minus the
 * drivers already sent there who arrive first), the chance of a space and the expected minutes
 * to the door. `sigma(h)`: forecast error in spaces h minutes ahead.
 */
export function options(lots: Lot[], m: number, trips: Trip[], sigma: (h: number) => number, sent: number[] = lots.map(() => 0)): Option[] {
  return lots.map((lot, i) => {
    const k = frameAt(lot, m);
    if (k < 0) return { lot: i, freeNow: NaN, freeAtArrival: NaN, chance: 0, cost: Infinity };
    const ahead = trips[i].drive + (m - minutes(lot.frames[k].t));
    const freeNow = lot.capacity - taken(lot.frames[k]);
    const freeAtArrival = lot.capacity - forecast(lot, k, ahead) - sent[i];
    const c = chance(freeAtArrival, sigma(ahead));
    return { lot: i, freeNow, freeAtArrival, chance: c, cost: trips[i].drive + trips[i].walk + (1 - c) * SEARCH_MIN };
  });
}

/**
 * n drivers asking at once. "nearest": all to the car park with the shortest drive and walk, as a
 * navigator does. "oqim": one by one, each to the car park of least expected minutes given the
 * drivers sent before. Returns the count per car park and how many are expected to find theirs
 * full.
 */
export function spread(lots: Lot[], m: number, trips: Trip[], sigma: (h: number) => number, n: number) {
  const base = options(lots, m, trips, sigma);
  const near = base.filter((o) => Number.isFinite(o.freeNow)).reduce((b, o) => (trips[o.lot].drive + trips[o.lot].walk < trips[b.lot].drive + trips[b.lot].walk ? o : b));
  const nearest = lots.map((_, i) => (i === near.lot ? n : 0));
  const sent = lots.map(() => 0);
  for (let d = 0; d < n; d++) {
    const o = options(lots, m, trips, sigma, sent).reduce((b, x) => (x.cost < b.cost ? x : b));
    sent[o.lot]++;
  }
  const freeOn = (i: number) => (Number.isFinite(base[i].freeAtArrival) ? Math.max(0, Math.floor(base[i].freeAtArrival)) : 0);
  const full = (counts: number[]) => counts.reduce((s, c, i) => s + Math.max(0, c - freeOn(i)), 0);
  const minutesTo = (counts: number[]) => {
    let total = 0;
    counts.forEach((c, i) => {
      if (!c) return;
      const free = freeOn(i);
      total += c * (trips[i].drive + trips[i].walk) + Math.max(0, c - free) * SEARCH_MIN;
    });
    return n ? total / n : 0;
  };
  return {
    nearest: { counts: nearest, full: full(nearest), minutes: minutesTo(nearest) },
    oqim: { counts: sent, full: full(sent), minutes: minutesTo(sent) },
  };
}

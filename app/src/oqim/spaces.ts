// Parking spaces suggested from one photo, with no hand marking. Every parked vehicle the detector
// finds is a taken space. Vehicles are chained into rows (next one to the right, at about the same
// height and size), the row's pitch is read from its neighbouring cars, and every gap in a row
// wide enough for one or more cars becomes that many free spaces. A free space outside every row
// (an empty row, the ends of a row) cannot be seen in one photo. No DOM.

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  conf: number;
  cls?: number;
}

export interface Suggested {
  taken: Box[];
  free: Box[];
  rows: number;
}

const cxOf = (b: Box) => (b.x1 + b.x2) / 2;
const cyOf = (b: Box) => (b.y1 + b.y2) / 2;
const wOf = (b: Box) => b.x2 - b.x1;
const hOf = (b: Box) => b.y2 - b.y1;
const median = (v: number[]) => {
  const s = [...v].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN;
};

export function iou(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const i = ix * iy;
  const u = wOf(a) * hOf(a) + wOf(b) * hOf(b) - i;
  return u > 0 ? i / u : 0;
}

/** The same vehicle seen by several tiles: keep the most confident box. */
export function nms(boxes: Box[], thr = 0.45): Box[] {
  const out: Box[] = [];
  for (const b of [...boxes].sort((a, c) => c.conf - a.conf)) {
    // a box mostly inside a kept one is the same car cut by a tile edge
    if (out.some((k) => iou(k, b) > thr || inside(b, k) > 0.7)) continue;
    out.push(b);
  }
  return out;
}

/** Share of box a inside box b. */
function inside(a: Box, b: Box): number {
  const ix = Math.max(0, Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1));
  const iy = Math.max(0, Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1));
  const s = wOf(a) * hOf(a);
  return s > 0 ? (ix * iy) / s : 0;
}

/** Rows of vehicles, left to right: each car joins the row whose last car is just to its left. */
export function rows(cars: Box[]): Box[][] {
  const R: Box[][] = [];
  for (const c of [...cars].sort((a, b) => cxOf(a) - cxOf(b))) {
    let best = -1, bestCost = Infinity;
    R.forEach((row, i) => {
      const l = row[row.length - 1];
      const size = (hOf(l) + hOf(c)) / 2, width = (wOf(l) + wOf(c)) / 2;
      const dx = cxOf(c) - cxOf(l), dy = Math.abs(cyOf(c) - cyOf(l));
      const ratio = hOf(c) / hOf(l);
      if (dx <= 0 || dx > 6 * width || dy > 0.45 * size || ratio < 0.6 || ratio > 1.65) return;
      const cost = dy / size + dx / (6 * width);
      if (cost < bestCost) [best, bestCost] = [i, cost];
    });
    if (best >= 0) R[best].push(c);
    else R.push([c]);
  }
  return R;
}

/**
 * Spaces from the detector's boxes on one photo of w x h. `minConf`: boxes taken as parked cars.
 * A gap between two cars of a row holds round(gap / pitch) - 1 free spaces, where the pitch is the
 * median distance between neighbouring cars of that row (or 1.15 car widths when it has none).
 */
export function suggest(boxes: Box[], w: number, h: number, minConf = 0.1, maxGap = 10, minRow = 2): Suggested {
  const cars = nms(boxes.filter((b) => b.conf >= minConf && wOf(b) * hOf(b) < 0.04 * w * h));
  const R = rows(cars);
  const free: Box[] = [];
  for (const row of R) {
    if (row.length < minRow) continue;
    const near: number[] = [];
    for (let i = 1; i < row.length; i++) {
      const g = cxOf(row[i]) - cxOf(row[i - 1]);
      if (g < 1.6 * ((wOf(row[i]) + wOf(row[i - 1])) / 2)) near.push(g);
    }
    for (let i = 1; i < row.length; i++) {
      const a = row[i - 1], b = row[i];
      const width = (wOf(a) + wOf(b)) / 2;
      const pitch = near.length >= 2 ? median(near) : 1.15 * width;
      const g = cxOf(b) - cxOf(a);
      const k = Math.round(g / pitch) - 1;
      if (k < 1 || g > maxGap * pitch) continue;
      for (let j = 1; j <= k; j++) {
        const f = j / (k + 1);
        const cx = cxOf(a) + f * g, cy = cyOf(a) + f * (cyOf(b) - cyOf(a));
        const bw = wOf(a) + f * (wOf(b) - wOf(a)), bh = hOf(a) + f * (hOf(b) - hOf(a));
        free.push({ x1: cx - bw / 2, y1: cy - bh / 2, x2: cx + bw / 2, y2: cy + bh / 2, conf: 0 });
      }
    }
  }
  return { taken: cars, free, rows: R.filter((r) => r.length >= 2).length };
}

// Check of the suggested spaces (app/src/oqim/spaces.ts) on PKLot: the browser detector's boxes
// (YOLO26n ONNX, whole frame + 3 x 3 tiles, cached by parking_eval.py) on every image, against
// the hand labels. A labelled space counts as found free when its centre is inside a suggested free
// space, found taken when inside a car box. Writes eval.suggest into app/public/data/parking.json.
//   node samples_src/spaces_eval.ts <dir with selected.json and dets_onnx_960_g3.json>
import { readFileSync, writeFileSync } from "node:fs";
import { suggest, type Box } from "../app/src/oqim/spaces.ts";

const dir = process.argv[2];
const [MC, MG, MR] = (process.argv[3] ?? "0.1,10,2").split(",").map(Number);
const sel = JSON.parse(readFileSync(`${dir}/selected.json`, "utf8"));
const dets = JSON.parse(readFileSync(`${dir}/dets_onnx_960_g3.json`, "utf8"));
const inBox = (p: [number, number], b: Box) => p[0] >= b.x1 && p[0] <= b.x2 && p[1] >= b.y1 && p[1] <= b.y2;
function inPoly(p: [number, number], P: [number, number][]) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++)
    if (P[i][1] > p[1] !== P[j][1] > p[1] && p[0] < ((P[j][0] - P[i][0]) * (p[1] - P[i][1])) / (P[j][1] - P[i][1]) + P[i][0]) c = !c;
  return c;
}
let freeN = 0, freeFound = 0, takenN = 0, takenFound = 0, sugIn = 0, sugRight = 0, sugAll = 0, images = 0;
for (const r of sel) {
  const d = dets[r.file];
  if (!d) continue;
  images++;
  const boxes: Box[] = d.boxes.map((b: number[]) => ({ x1: b[0], y1: b[1], x2: b[2], y2: b[3], conf: b[4] }));
  const s = suggest(boxes, d.w, d.h, MC, MG, MR);
  const polys = r.spaces.map((sp: { poly: [number, number][]; occ: string }) => ({ P: sp.poly.map(([x, y]) => [x * d.w, y * d.h] as [number, number]), free: sp.occ !== "occupied" }));
  for (const { P, free } of polys) {
    const c: [number, number] = [P.reduce((a, p) => a + p[0], 0) / P.length, P.reduce((a, p) => a + p[1], 0) / P.length];
    if (free) {
      freeN++;
      if (s.free.some((b) => inBox(c, b))) freeFound++;
    } else {
      takenN++;
      if (s.taken.some((b) => inBox(c, b))) takenFound++;
    }
  }
  const cover = (b: Box) => Math.max(0, ...boxes.map((x) => {
    const ix = Math.max(0, Math.min(b.x2, x.x2) - Math.max(b.x1, x.x1)), iy = Math.max(0, Math.min(b.y2, x.y2) - Math.max(b.y1, x.y1));
    return (ix * iy) / ((b.x2 - b.x1) * (b.y2 - b.y1));
  }));
  for (const b of s.free.filter((x) => cover(x) < 0.4)) {
    sugAll++;
    const c: [number, number] = [(b.x1 + b.x2) / 2, (b.y1 + b.y2) / 2];
    const hit = polys.find((p: { P: [number, number][] }) => inPoly(c, p.P));
    if (hit) {
      sugIn++;
      if (hit.free) sugRight++;
    }
  }
}
const r3 = (x: number) => Math.round(x * 1000) / 1000;
const out = {
  images, rule: "every car box with confidence 0.1 or more is a taken space; cars are chained into rows; a gap in a row that fits k cars at the row pitch is k free spaces, unless a vehicle box covers 40% of it",
  takenFound: r3(takenFound / takenN), takenN,
  freeFound: r3(freeFound / freeN), freeN,
  suggestedRight: r3(sugRight / sugIn), suggestedInLabelled: sugIn, suggested: sugAll,
};
console.log(JSON.stringify({ MC, MG, MR, t: out.takenFound, f: out.freeFound, right: out.suggestedRight, n: out.suggestedInLabelled }));
if (process.argv[4] !== "write") process.exit(0);
const p = new URL("../app/public/data/parking.json", import.meta.url);
const pk = JSON.parse(readFileSync(p, "utf8"));
pk.eval.suggest = out;
writeFileSync(p, JSON.stringify(pk));

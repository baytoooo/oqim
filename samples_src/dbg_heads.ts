import { readFileSync } from "node:fs";
import { headScores, headLights, greensOf, cycleLength } from "../app/src/oqim/phases.ts";
const raw = readFileSync(new URL("./heads_C3896.raw", import.meta.url));
const W = 32, H = 68, F = W * H * 4;
const n = raw.length / F;
const t: number[] = [], scores: any[] = [];
for (let i = 0; i < n; i++) {
  const px = new Uint8ClampedArray(raw.buffer, raw.byteOffset + i * F, F);
  t.push(i / 5);
  scores.push([headScores(px, W, H, [0, 0, W, H])]);
}
const lights = headLights({ t, scores }, 0);
const d = JSON.parse(readFileSync(new URL("./C3896_tracks.json", import.meta.url), "utf8"));
const py = (x: number) => { let best = d.signal[0]; for (const s of d.signal) if (Math.abs(s[0] - x) < Math.abs(best[0] - x)) best = s; return best[1]; };
let agree = 0, tot = 0;
const runs: string[] = []; let last = ""; let since = 0;
for (let i = 0; i < n; i++) {
  const p = py(t[i]); const m = lights[i];
  const pm = p === "green" ? "green" : p === "red" ? "red" : "other";
  if (pm !== "other") { tot++; if (pm === m) agree++; }
  if (m !== last) { if (last) runs.push(`${last[0]}${(t[i] - since).toFixed(1)}`); last = m; since = t[i]; }
}
console.log("agree", (agree / tot).toFixed(3), "n", n);
console.log(runs.slice(0, 60).join(" "));
const g = greensOf(t, lights, n / 5);
console.log("cycle", cycleLength(g), g.map((x) => `${x.start.toFixed(0)}-${x.end.toFixed(0)}`).join(" "));
const r = scores.map((s: any) => s[0].map((v: number) => v.toFixed(0)).join(",")).filter((_: any, i: number) => i % 25 === 0);
console.log(r.join(" | "));

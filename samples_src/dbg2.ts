import { readFileSync } from "node:fs";
import { audit } from "../app/src/oqim/audit.ts";
const clip = process.argv[2];
const d = JSON.parse(readFileSync(new URL(`./${clip}_tracks.json`, import.meta.url), "utf8"));
const heads = { t: d.signal.map((s: any) => s[0]), scores: d.signal.map((s: any) => [s[1] === "green" ? [0, 0, 100] : s[1] === "red" ? [100, 0, 0] : [0, 50, 0]]) };
const a = audit({ config: { approaches: [{ id: "sb", name: "SB", line: [[285, 527], [930, 457]], head: 0 }], heads: [[0, 0, 1, 1]] }, frames: d.frames, heads, duration: d.duration });
const ap = a.approaches[0];
console.log("greens", ap.greens.map((g) => `${g.start.toFixed(1)}-${g.end.toFixed(1)}`).join(" "));
const phases: string[] = []; let last = ""; for (const [t, p] of d.signal) { if (p !== last) phases.push(`${t}:${p}`); last = p; }
console.log("phases", phases.join(" "));
const cs = [...ap.crossings].sort((x, y) => x.arrival - y.arrival);
const dep = a.modes[0].sim.departures[0];
console.log(cs.slice(0, 60).map((c, i) => `${c.t.toFixed(1)}/${c.light[0]}/st${c.stopped.toFixed(0)}/m${dep[i]?.toFixed(1)}`).join(" "));

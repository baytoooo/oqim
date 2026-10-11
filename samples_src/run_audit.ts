import { readFileSync } from "node:fs";
import { audit } from "../app/src/oqim/audit.ts";
import type { HeadSeries } from "../app/src/oqim/types.ts";
const clip = process.argv[2] ?? "C3896";
const d = JSON.parse(readFileSync(new URL(`./${clip}_tracks.json`, import.meta.url), "utf8"));
// the elimination lamp reader's phases as fake head scores, to test the rest
const heads: HeadSeries = { t: d.signal.map((s: [number, string]) => s[0]), scores: d.signal.map((s: [number, string]) => [s[1] === "green" ? [0, 0, 100] : s[1] === "red" ? [100, 0, 0] : [0, 50, 0]]) };
const approaches = JSON.parse(process.argv[3] ?? "[]");
const a = audit({ config: { approaches, heads: [[0, 0, 1, 1]] }, frames: d.frames, heads, duration: d.duration });
console.log("cycle", a.cycle, "groups", a.groups, "intergreen", a.intergreen, "hidden", a.hidden, "Y", a.Y.toFixed(2));
for (const ap of a.approaches) console.log(ap.name, ap.source, "n", ap.vehicles, "flow", ap.flowPerHour.toFixed(0), "wait", ap.meanWait.toFixed(1), "AoG", ap.arrivalsOnGreen.toFixed(2), "hw", ap.headway.toFixed(2), ap.headwayMeasured, "startup", ap.startup.toFixed(1), "green", ap.greenMean?.toFixed(1), "redRuns", ap.redRuns.length, "maxQ", ap.maxQueue, "group", ap.group, "greens", ap.greens.map((g) => `${g.start.toFixed(0)}-${g.end.toFixed(0)}`).join(" "));
for (const m of a.modes) console.log(m.key, "delay", m.sim.meanDelay.toFixed(1), "vehh", m.sim.vehHours.toFixed(2), "left", m.sim.leftWaiting, "sf", m.sim.splitFailures, "/", m.sim.greensGiven, m.greens?.map((g) => g.toFixed(0)).join("/"), m.cycle?.toFixed(0));
console.log("check", a.check, a.warnings);

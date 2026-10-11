// Audits of the four sample clips from the elimination pipeline's tracks and lamp readings, for the
// site's Method page (public/data/audits.json).
import { readFileSync, writeFileSync } from "node:fs";
import { audit } from "../app/src/oqim/audit.ts";
import type { HeadSeries } from "../app/src/oqim/types.ts";
const r = (x: number, n = 1) => Math.round(x * 10 ** n) / 10 ** n;
const clips = ["C3896", "C3897", "C3902", "C3905"].map((clip) => {
  const d = JSON.parse(readFileSync(new URL(`./${clip}_tracks.json`, import.meta.url), "utf8"));
  const heads: HeadSeries = { t: d.signal.map((s: [number, string]) => s[0]), scores: d.signal.map((s: [number, string]) => [s[1] === "green" ? [0, 0, 100] : s[1] === "red" ? [100, 0, 0] : [0, 50, 0]]) };
  const a = audit({ config: { approaches: [{ id: "sb", name: "Southbound", line: [[285, 527], [930, 457]], head: 0 }], heads: [[0, 0, 1, 1]] }, frames: d.frames, heads, duration: d.duration });
  return {
    clip, duration: r(d.duration), cycle: a.cycle === null ? null : r(a.cycle), hidden: r(a.hidden), Y: r(a.Y, 2),
    approaches: a.approaches.map((x) => ({ name: x.name, vehicles: x.vehicles, flowPerHour: Math.round(x.flowPerHour), meanWait: r(x.meanWait), arrivalsOnGreen: r(x.arrivalsOnGreen, 2), headway: r(x.headway, 2), greenMean: x.greenMean === null ? null : r(x.greenMean), redRuns: x.redRuns.length, maxQueue: x.maxQueue })),
    modes: a.modes.map((m) => ({ key: m.key, label: m.label, meanDelay: r(m.sim.meanDelay), vehHours: r(m.sim.vehHours, 3), leftWaiting: m.sim.leftWaiting, cycle: m.cycle === undefined ? null : r(m.cycle) })),
    check: { departureError: r(a.check.departureError, 2), measuredWait: r(a.check.measuredWait), modelWait: r(a.check.modelWait), vehicles: a.check.vehicles },
  };
});
writeFileSync(new URL("../app/public/data/audits.json", import.meta.url), JSON.stringify({ source: "tracks of the elimination pipeline (YOLO26m at 1280 px, 10 frames per second, ByteTrack) and its signal lamp reader, southbound approach of the sample junction", clips }, null, 1));
for (const c of clips) console.log(c.clip, c.cycle, c.check, c.modes.map((m) => `${m.key}:${m.meanDelay}`).join(" "));

// the 3D corridor page's demand when the visitor has not run an audit yet: C3896's southbound vehicles
{
  const d = JSON.parse(readFileSync(new URL("./C3896_tracks.json", import.meta.url), "utf8"));
  const heads: HeadSeries = { t: d.signal.map((s: [number, string]) => s[0]), scores: d.signal.map((s: [number, string]) => [s[1] === "green" ? [0, 0, 100] : s[1] === "red" ? [100, 0, 0] : [0, 50, 0]]) };
  const a = audit({ config: { approaches: [{ id: "sb", name: "Southbound", line: [[285, 527], [930, 457]], head: 0 }], heads: [[0, 0, 1, 1]] }, frames: d.frames, heads, duration: d.duration });
  const cls = new Map<number, number>();
  for (const f of d.frames) for (const b of f.boxes) if (!cls.has(b[4])) cls.set(b[4], b[5]);
  const ap = a.approaches[0];
  const tuned = a.modes.find((m) => m.key === "tuned")!;
  const pred = a.modes.find((m) => m.key === "predictive")!;
  const out = {
    clip: "C3896 (sample)", duration: d.duration, approach: ap.name,
    arrivals: ap.crossings.map((c) => ({ t: r(c.arrival, 2), cls: cls.get(c.track) ?? 2 })).sort((x, y) => x.t - y.t),
    cycle: r(a.cycle ?? 90), green: r(ap.greenMean ?? 30), headway: r(ap.headway, 2),
    tunedCycle: r(tuned.cycle ?? 90), tunedGreen: r(tuned.greens?.[0] ?? 30),
    nowWait: r(a.modes[0].sim.meanDelay), predictiveWait: r(pred.sim.meanDelay),
  };
  writeFileSync(new URL("../app/public/data/sample_demand.json", import.meta.url), JSON.stringify(out));
  console.log("sample demand", out.arrivals.length, out.cycle, out.green, out.tunedCycle, out.tunedGreen);
}

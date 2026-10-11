// The audit on a junction simulated here: vehicles drive down two approaches, queue on red and move
// off on green one headway apart, under a fixed signal whose head the test paints in a fake frame.

import assert from "node:assert/strict";
import { test } from "node:test";
import { audit } from "../src/oqim/audit.ts";
import { headLights, headScores, inferGreens } from "../src/oqim/phases.ts";
import { simulate } from "../src/oqim/sim.ts";
import { segmentCrossing } from "../src/oqim/tracks.ts";
import type { HeadSeries } from "../src/oqim/types.ts";

const FPS = 5;

/** A deterministic stream of arrivals, `perHour` vehicles an hour with some spread. */
function arrivals(perHour: number, duration: number, seed: number): number[] {
  let s = seed;
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const out: number[] = [];
  let t = rnd() * 5;
  while (t < duration) {
    out.push(t);
    t += -Math.log(1 - rnd() * 0.999) * (3600 / perHour);
  }
  return out;
}

/** Two approaches (A going down the frame, B going right), each with its green, cycle 60 s:
 * A green 0-25, B green 29-56; intergreen 4. */
function scenario(duration = 300) {
  const C = 60;
  const greenA = (t: number) => t % C < 25;
  const greenB = (t: number) => t % C >= 29 && t % C < 56;
  const H = 2.0, STARTUP = 2.0, SPEED = 200; // px/s
  type V = { id: number; arr: number; dep: number; ap: "A" | "B" };
  const vs: V[] = [];
  let id = 1;
  for (const [ap, rate, green] of [["A", 500, greenA], ["B", 350, greenB]] as const) {
    let last = -Infinity;
    let since = -Infinity;
    for (const a of arrivals(rate, duration, ap === "A" ? 7 : 11)) {
      // point queue at the line: leave on green, startup after the green began, a headway apart
      let t = Math.max(a, last + H);
      for (;;) {
        if (!green(t)) {
          t = Math.ceil(t * 10) / 10;
          while (!green(t)) t = Math.round((t + 0.1) * 10) / 10;
          since = t;
          t = Math.max(t + STARTUP, last + H);
          continue;
        }
        // the green started before t: find its start
        let gs = t;
        while (gs > 0 && green(gs - 0.1)) gs = Math.round((gs - 0.1) * 10) / 10;
        since = gs;
        if (a < since && t < since + STARTUP) {
          t = since + STARTUP;
          continue;
        }
        break;
      }
      last = t;
      vs.push({ id: id++, arr: a, dep: t, ap });
    }
  }
  // positions: the line of A is y = 600 (moving down), of B x = 800 (moving right); a vehicle drives
  // at SPEED until its queue spot, stands, then drives over the line at its departure
  const frames: { t: number; boxes: [number, number, number, number, number, number][] }[] = [];
  for (let k = 0; k < duration * FPS; k++) {
    const t = k / FPS;
    const boxes: [number, number, number, number, number, number][] = [];
    for (const v of vs) {
      const before = 500; // px it drives before the line
      let d: number; // distance past the line (negative before)
      if (t < v.arr - before / SPEED) continue;
      if (t <= v.arr) d = Math.min(-10, -SPEED * (v.arr - t));
      else if (t < v.dep) d = -10; // standing just before the line
      else d = SPEED * (t - v.dep);
      if (d > 300) continue;
      // foot points: A at y = 600 + d (box bottom 600 + d + 7.5), B at x = 800 + d
      if (v.ap === "A") boxes.push([460, 600 + d + 7.5 - 50, 540, 600 + d + 7.5, v.id, 2]);
      else boxes.push([800 + d - 40, 340, 800 + d + 40, 400, v.id, 2]);
    }
    frames.push({ t, boxes });
  }
  // head colours: head 0 for A, head 1 for B, scores as headScores would give them
  const heads: HeadSeries = { t: frames.map((f) => f.t), scores: frames.map((f) => [greenA(f.t) ? [5, 0, 120] : [150, 10, -60], greenB(f.t) ? [5, 0, 120] : [150, 10, -60]]) as never };
  return { vs, frames, heads, duration };
}

test("segmentCrossing finds the step over a line and its side", () => {
  assert.deepEqual(segmentCrossing([0, 0], [0, 10], [-5, 5], [5, 5]), { f: 0.5, dir: 1 });
  assert.equal(segmentCrossing([0, 0], [0, 4], [-5, 5], [5, 5]), null);
  assert.equal(segmentCrossing([20, 0], [20, 10], [-5, 5], [5, 5]), null);
});

test("headScores and headLights read a lit lamp in a loose rectangle", () => {
  const w = 20, h = 40;
  const frame = (lamp: "red" | "green") => {
    const px = new Uint8ClampedArray(w * h * 4).fill(60);
    const y0 = lamp === "red" ? 2 : 30;
    for (let y = y0; y < y0 + 6; y++)
      for (let x = 7; x < 13; x++) {
        const i = (y * w + x) * 4;
        if (lamp === "red") [px[i], px[i + 1], px[i + 2]] = [240, 40, 30];
        else [px[i], px[i + 1], px[i + 2]] = [30, 230, 200];
      }
    return headScores(px, w, h, [0, 0, w, h]);
  };
  const t = Array.from({ length: 100 }, (_, i) => i / 5);
  const scores = t.map((x) => [frame(x % 10 < 5 ? "green" : "red")]);
  const lights = headLights({ t, scores } as HeadSeries, 0);
  assert.equal(lights[0], "green");
  assert.equal(lights[30], "red");
});

test("the audit measures the simulated junction and the replay gives its crossings back", () => {
  const sc = scenario();
  const a = audit({
    config: {
      approaches: [
        { id: "A", name: "A", line: [[400, 600], [600, 600]], head: 0 },
        { id: "B", name: "B", line: [[800, 300], [800, 440]], head: 1 },
      ],
      heads: [[0, 0, 10, 10], [0, 0, 10, 10]],
    },
    frames: sc.frames,
    heads: sc.heads,
    duration: sc.duration,
  });
  assert.equal(a.groups, 2);
  assert.ok(a.cycle !== null && Math.abs(a.cycle - 60) < 0.5, `cycle ${a.cycle}`);
  assert.ok(Math.abs(a.intergreen - 4) < 1.2, `intergreen ${a.intergreen}`);
  const A = a.approaches[0], B = a.approaches[1];
  const nA = sc.vs.filter((v) => v.ap === "A" && v.dep < sc.duration - 2).length;
  assert.ok(Math.abs(A.vehicles - nA) <= 2, `A ${A.vehicles} vs ${nA}`);
  assert.ok(Math.abs(A.headway - 2) < 0.5, `headway ${A.headway}`);
  assert.ok(Math.abs(B.greenMean! - 27) < 1.5, `B green ${B.greenMean}`);
  assert.equal(a.hidden, 0);
  if (process.env.DBG) console.log(JSON.stringify(a.modes.map((m) => [m.key, m.sim.meanDelay.toFixed(1), m.sim.leftWaiting, m.sim.splitFailures, m.greens?.map((g) => g.toFixed(0)), m.cycle?.toFixed(0)]).concat([[a.Y.toFixed(2), a.check]] as never)));
  if (process.env.DBG_X) { const A0 = a.approaches[0]; console.log(JSON.stringify({ hw: a.approaches.map((x) => [x.headway, x.startup, x.greenMean, x.vehicles]), greens: A0.greens.slice(0, 4), cs: A0.crossings.slice(0, 12).map((c) => [c.t.toFixed(1), c.arrival.toFixed(1), c.stopped.toFixed(1)]), dep: a.modes[0].sim.departures[0].slice(0, 12).map((d) => d.toFixed(1)), real: sc.vs.filter((v) => v.ap === "A").slice(0, 12).map((v) => [v.arr.toFixed(1), v.dep.toFixed(1)]) })); }
  assert.ok(a.check.departureError < 1.0, `departure error ${a.check.departureError}`);
  assert.ok(Math.abs(a.check.modelWait - a.check.measuredWait) < 2, JSON.stringify(a.check));
  const now = a.modes.find((m) => m.key === "measured")!.sim;
  const tuned = a.modes.find((m) => m.key === "tuned")!.sim;
  assert.ok(tuned.vehHours <= now.vehHours + 1e-6);
  for (const m of a.modes) assert.ok(Number.isFinite(m.sim.meanDelay));
});

test("with no head the greens come from the traffic", () => {
  const sc = scenario();
  const a = audit({
    config: { approaches: [{ id: "A", name: "A", line: [[400, 600], [600, 600]], head: null }], heads: [] },
    frames: sc.frames,
    heads: { t: [], scores: [] },
    duration: sc.duration,
  });
  const A = a.approaches[0];
  assert.equal(A.source, "motion");
  assert.ok(a.cycle !== null && Math.abs(a.cycle - 60) < 4, `cycle ${a.cycle}`);
  assert.ok(A.greens.length >= 4 && A.greens.length <= 6, `greens ${A.greens.length}`);
  void inferGreens;
});

test("an actuated plan gives way to the other group when its own traffic stops", () => {
  const j = {
    approaches: [
      { id: "a", arrivals: [1, 2, 3], headway: 2, startup: 2, group: 0, greens: [] },
      { id: "b", arrivals: [1, 2, 3, 4, 5, 6], headway: 2, startup: 2, group: 1, greens: [] },
    ],
    order: [0, 1],
    intergreen: 4,
    hidden: 0,
    start: 0,
    duration: 120,
  };
  const r = simulate(j, { kind: "actuated", min: 7, max: 40, gap: 3 });
  assert.equal(r.leftWaiting, 0);
  assert.ok(r.departures[1][5] < 40, String(r.departures[1]));
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { countFrames } from "../src/oqim/count.ts";

// boxes [x1, y1, x2, y2, id, cls]; vehicles drive down the frame across a line at y = 500
function drive(id: number, cls: number, x: number, t0: number, dy: number) {
  return Array.from({ length: 12 }, (_, k) => ({ t: t0 + k * 0.2, box: [x, 300 + k * dy, x + 80, 360 + k * dy, id, cls] as [number, number, number, number, number, number] }));
}

test("each vehicle that crosses the line counts once, by type and way", () => {
  const steps = [...drive(1, 2, 100, 0, 30), ...drive(2, 7, 400, 1, 30), ...drive(3, 2, 700, 2, -30).map((s) => ({ ...s, box: [s.box[0], s.box[1] + 400, s.box[2], s.box[3] + 400, 3, 2] as typeof s.box })), ...drive(4, 2, 900, 0, 2)];
  const byT = new Map<number, [number, number, number, number, number, number][]>();
  for (const s of steps) byT.set(s.t, [...(byT.get(s.t) ?? []), s.box]);
  const frames = [...byT.entries()].sort((a, b) => a[0] - b[0]).map(([t, boxes]) => ({ t, boxes }));
  const c = countFrames(frames, [[0, 500], [1200, 500]], 60);
  assert.equal(c.total, 3); // vehicle 4 creeps and never reaches the line
  assert.equal(c.byClass.car, 2);
  assert.equal(c.byClass.truck, 1);
  assert.equal(c.byDir.a + c.byDir.b, 3);
  assert.ok(c.byDir.a >= 1 && c.byDir.b >= 1);
  assert.equal(c.perMinute[0], 3);
  assert.equal(Math.round(c.perHour), 180);
});

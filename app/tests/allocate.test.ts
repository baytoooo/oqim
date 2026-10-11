// Drivers to car parks on a small grid: sending everyone to the nearest one overfills it; placing
// them one by one with the loads of the others spreads them and saves time.

import assert from "node:assert/strict";
import { test } from "node:test";
import { coordinated, evaluate, holt, nearest, type Graph } from "../src/oqim/allocate.ts";

function grid(n: number, step: number): Graph {
  const nodes: [number, number][] = [];
  const edges: Graph["edges"] = [];
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) nodes.push([x * 0.001, y * 0.001]);
  const id = (x: number, y: number) => y * n + x;
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      if (x + 1 < n) edges.push([id(x, y), id(x + 1, y), step, 1, 0, 1]);
      if (y + 1 < n) edges.push([id(x, y), id(x, y + 1), step, 1, 0, 1]);
    }
  return { nodes, edges };
}

test("coordinated placement fills car parks no faster than they have room", () => {
  const g = grid(8, 150);
  const bg = new Float64Array(g.edges.length).fill(0.6);
  const parks = [
    { name: "near", node: 27, capacity: 60, free: 8, walk: 80 },
    { name: "far", node: 36, capacity: 200, free: 60, walk: 350 },
  ];
  const drivers = Array.from({ length: 40 }, (_, i) => ({ id: i, origin: [0, 7, 56, 63][i % 4], depart: i * 10 }));
  const a = evaluate(g, bg, parks, drivers, nearest(g, bg, parks, drivers));
  const b = evaluate(g, bg, parks, drivers, coordinated(g, bg, parks, drivers));
  assert.ok(a.arrivedFull >= 25, `nearest: ${a.arrivedFull} arrived to a full car park`);
  assert.ok(b.arrivedFull <= 2, `coordinated: ${b.arrivedFull}`);
  assert.ok(b.meanDoorToDoor < a.meanDoorToDoor, `${b.meanDoorToDoor} vs ${a.meanDoorToDoor}`);
});

test("holt follows a trend better than repeating the last value", () => {
  const s = Array.from({ length: 20 }, (_, i) => 10 + i * 2);
  const h = holt(s, 1);
  assert.ok(h.mae < h.naiveMae, `${h.mae} vs ${h.naiveMae}`);
  assert.ok(Math.abs(h.forecast - 50) < 3, String(h.forecast));
});

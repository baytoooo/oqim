import { test } from "node:test";
import assert from "node:assert/strict";
import { nms, rows, suggest, type Box } from "../src/oqim/spaces.ts";

const car = (x: number, y: number, w = 40, h = 30, conf = 0.8): Box => ({ x1: x, y1: y, x2: x + w, y2: y + h, conf });

test("a gap of two cars in a row is two free spaces", () => {
  // pitch 45 px; cars at 0, 45, 90, then a gap, then 225, 270
  const row = [0, 45, 90, 225, 270].map((x) => car(x, 100));
  const s = suggest(row, 1000, 600);
  assert.equal(s.taken.length, 5);
  assert.equal(s.free.length, 2);
  assert.ok(s.free.every((b) => b.x1 > 90 && b.x2 < 265));
});

test("two rows are kept apart, and a tile's duplicate box is dropped", () => {
  const boxes = [car(0, 100), car(45, 102), car(0, 200), car(45, 198), car(1, 101, 39, 29, 0.5)];
  assert.equal(nms(boxes).length, 4);
  assert.equal(rows(nms(boxes)).length, 2);
});

test("a full row has no free space", () => {
  const s = suggest([0, 45, 90, 135].map((x) => car(x, 50)), 1000, 600);
  assert.equal(s.free.length, 0);
});

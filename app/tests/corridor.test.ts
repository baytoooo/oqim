// The corridor model: vehicles stop for red, and a green wave with the same demand stops them less.

import assert from "node:assert/strict";
import { test } from "node:test";
import { Corridor, corridorSignals, lightAt, runCorridor } from "../src/oqim/corridor.ts";

const demand = (perHour: number, seconds: number) => {
  const enter: number[] = [];
  for (let t = 0; t < seconds; t += 3600 / perHour) enter.push(t);
  return { enter, cls: enter.map(() => 2) };
};

test("lights cycle green, amber, red", () => {
  const sg = { at: 0, cycle: 60, green: 30, offset: 10, amber: 3 };
  assert.equal(lightAt(sg, 10), "green");
  assert.equal(lightAt(sg, 41), "amber");
  assert.equal(lightAt(sg, 50), "red");
  assert.equal(lightAt(sg, 5), "red");
});

test("a car stops at a red light and goes on green", () => {
  const c = new Corridor(500, [{ at: 200, cycle: 100, green: 40, offset: 50, amber: 3 }], { enter: [0], cls: [2] });
  for (let i = 0; i < 400; i++) c.step();
  const car = c.cars[0];
  assert.ok(car.s < 200 && car.s > 180, `stood at ${car.s}`);
  for (let i = 0; i < 400; i++) c.step();
  assert.equal(c.finished.length, 1);
  assert.equal(c.finished[0].stops, 1);
});

test("a green wave stops vehicles less than uncoordinated signals", () => {
  const at = [300, 650, 1000, 1350, 1700];
  const plan = { cycle: 75, green: 36, tunedCycle: 75, tunedGreen: 36 };
  const d = demand(700, 600);
  const now = runCorridor(1900, corridorSignals(at, "now", plan), d);
  const wave = runCorridor(1900, corridorSignals(at, "oqim", plan), d);
  assert.ok(wave.meanStops < now.meanStops, `${wave.meanStops} vs ${now.meanStops}`);
  assert.ok(wave.meanDelay < now.meanDelay, `${wave.meanDelay} vs ${now.meanDelay}`);
});

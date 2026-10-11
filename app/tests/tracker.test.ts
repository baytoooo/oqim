import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { backtest, chance, forecast, frameAt, options, spread, taken, type Lot } from "../src/oqim/tracker.ts";

const data = JSON.parse(readFileSync(new URL("../public/data/tracker.json", import.meta.url), "utf8"));
const lots: Lot[] = data.lots;
const trips = [{ drive: 6, walk: 2 }, { drive: 8, walk: 4 }, { drive: 9, walk: 5 }];
const sigma = () => 4;

test("forecast stays inside the car park and follows a filling morning", () => {
  const pucpr = lots[0];
  const k = frameAt(pucpr, 7 * 60 + 30);
  const f10 = forecast(pucpr, k, 10);
  assert.ok(f10 >= taken(pucpr.frames[k]) && f10 <= pucpr.capacity);
});

test("the forecast beats 'as many as now' on the replayed mornings", () => {
  const b = backtest(lots, 10);
  assert.ok(b.n > 50 && b.mae < b.naiveMae);
});

test("chance of a space falls as fewer are expected", () => {
  assert.ok(chance(10, 3) > chance(2, 3) && chance(2, 3) > chance(-3, 3));
});

test("spreading drivers sends fewer of them to a full car park than the nearest one does", () => {
  const m = 8 * 60 + 15;
  const s = spread(lots, m, trips, sigma, 30);
  assert.equal(s.oqim.counts.reduce((a, b) => a + b, 0), 30);
  assert.ok(s.oqim.full <= s.nearest.full);
  const o = options(lots, m, trips, sigma);
  assert.equal(o.length, 3);
});

// Forecast check for the parking tracker: writes eval.forecast (10 minutes ahead) and
// eval.forecastByH into app/public/data/tracker.json, from app/src/oqim/tracker.ts.
//   node samples_src/tracker_eval.ts
import { readFileSync, writeFileSync } from "node:fs";
import { backtest, type Lot } from "../app/src/oqim/tracker.ts";

const path = new URL("../app/public/data/tracker.json", import.meta.url);
const data = JSON.parse(readFileSync(path, "utf8"));
const lots: Lot[] = data.lots;
const r = (x: number) => Math.round(x * 100) / 100;
const byH = [5, 10, 15, 20, 30].map((h) => {
  const b = backtest(lots, h);
  return { h, mae: r(b.mae), naiveMae: r(b.naiveMae), rmse: r(b.rmse), n: b.n };
});
data.eval.forecast = byH.find((b) => b.h === 10);
data.eval.forecastByH = byH;
data.eval.forecastText = "spaces taken h minutes ahead: taken now plus h times the mean of the last 20 minutes' slope and the typical-day slope of the same car park (PKLot labels of its other weekdays); checked against the hand labels of the frame h minutes later; naive: as many as now";
writeFileSync(path, JSON.stringify(data));
console.log(byH);

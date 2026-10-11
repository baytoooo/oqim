// A corridor of up to five signalised junctions, one direction of travel: the vehicles measured on
// the video enter upstream and drive through every junction with the Intelligent Driver Model
// (Treiber, Hennecke and Helbing 2000). A red light is a standing obstacle at its stop line for a
// vehicle that can still stop. Plain TypeScript, no DOM: the 3D page (src/scripts/network.ts)
// draws it, tests/corridor.test.ts checks it.

export interface Signal {
  /** Distance of the stop line from the start of the corridor, metres. */
  at: number;
  cycle: number;
  green: number;
  /** Seconds into the simulation when this signal's green first begins. */
  offset: number;
  amber: number;
}

export interface Demand {
  /** Seconds when each vehicle enters at the start of the corridor, sorted. */
  enter: number[];
  /** COCO class of each: 2 car, 3 motorcycle, 5 bus, 7 truck. */
  cls: number[];
}

export interface Car {
  id: number;
  cls: number;
  s: number;
  v: number;
  enter: number;
  stops: number;
  stopped: boolean;
  done: number | null;
  length: number;
}

export const IDM = { v0: 50 / 3.6, a: 1.5, b: 2.0, T: 1.2, s0: 2.0 };
export const LENGTH: Record<number, number> = { 2: 4.5, 3: 2.2, 5: 12, 7: 9 };
export const DT = 0.1;

/** Light of a signal at time t. */
export function lightAt(sg: Signal, t: number): "green" | "amber" | "red" {
  const u = (((t - sg.offset) % sg.cycle) + sg.cycle) % sg.cycle;
  if (u < sg.green) return "green";
  if (u < sg.green + sg.amber) return "amber";
  return "red";
}

export class Corridor {
  readonly length: number;
  readonly signals: Signal[];
  readonly demand: Demand;
  cars: Car[] = [];
  finished: Car[] = [];
  t = 0;
  private next = 0;
  private ids = 0;

  constructor(length: number, signals: Signal[], demand: Demand) {
    this.length = length;
    this.signals = [...signals].sort((a, b) => a.at - b.at);
    this.demand = demand;
  }

  /** One step of DT seconds. */
  step(): void {
    const t = this.t;
    // entries: a vehicle enters when its time has come and the entry is clear
    while (this.next < this.demand.enter.length && this.demand.enter[this.next] <= t) {
      const last = this.cars[this.cars.length - 1];
      if (last && last.s - last.length < IDM.s0 + 4) break; // queue back to the entry: it waits off the map
      const cls = this.demand.cls[this.next];
      this.cars.push({ id: ++this.ids, cls, s: 0, v: last ? Math.min(IDM.v0, last.v) : IDM.v0, enter: this.demand.enter[this.next], stops: 0, stopped: false, done: null, length: LENGTH[cls] ?? 4.5 });
      this.next++;
    }
    // accelerations, front to back (cars[] is ordered by position, the first is the furthest)
    const acc = this.cars.map((c, i) => {
      let gap = Infinity;
      let dv = 0;
      if (i > 0) {
        const lead = this.cars[i - 1];
        gap = lead.s - lead.length - c.s;
        dv = c.v - lead.v;
      }
      // the next signal ahead that shows red or amber, if the car can still stop for it
      for (const sg of this.signals) {
        if (sg.at < c.s - 0.5) continue;
        const d = sg.at - c.s;
        const light = lightAt(sg, t);
        if (light !== "green") {
          const canStop = d > (c.v * c.v) / (2 * 4.0) || light === "red";
          if (canStop && d < gap) {
            gap = Math.max(0.1, d);
            dv = c.v;
          }
        }
        break;
      }
      const sStar = IDM.s0 + Math.max(0, c.v * IDM.T + (c.v * dv) / (2 * Math.sqrt(IDM.a * IDM.b)));
      return IDM.a * (1 - Math.pow(c.v / IDM.v0, 4) - (Number.isFinite(gap) ? Math.pow(sStar / Math.max(0.1, gap), 2) : 0));
    });
    this.cars.forEach((c, i) => {
      c.v = Math.max(0, c.v + acc[i] * DT);
      c.s += c.v * DT;
      const stoppedNow = c.v < 0.5;
      if (stoppedNow && !c.stopped) c.stops++;
      c.stopped = stoppedNow;
    });
    // leavers
    while (this.cars.length && this.cars[0].s > this.length) {
      const c = this.cars.shift()!;
      c.done = t;
      this.finished.push(c);
    }
    this.t = Math.round((t + DT) * 1e6) / 1e6;
  }

  /** Vehicles standing anywhere on the corridor. */
  get waiting(): number {
    return this.cars.filter((c) => c.stopped).length;
  }

  stats(): { finished: number; meanTravel: number; meanDelay: number; meanStops: number } {
    const f = this.finished;
    const free = this.length / IDM.v0;
    const travel = f.map((c) => (c.done ?? 0) - c.enter);
    const mean = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0);
    return { finished: f.length, meanTravel: mean(travel), meanDelay: Math.max(0, mean(travel) - free), meanStops: mean(f.map((c) => c.stops)) };
  }
}

/** Runs a corridor to the end of its demand plus `tail` s, with no drawing. */
export function runCorridor(length: number, signals: Signal[], demand: Demand, tail = 300) {
  const c = new Corridor(length, signals, demand);
  const end = (demand.enter[demand.enter.length - 1] ?? 0) + tail;
  while (c.t < end && (c.t < (demand.enter[demand.enter.length - 1] ?? 0) || c.cars.length)) c.step();
  return c.stats();
}

/**
 * Signals of a corridor. "now": every junction runs the cycle and green measured on the video,
 * not coordinated (each starts its cycle at its own time, a fixed pseudo-random offset: we do not
 * know the real ones). "oqim": the same cycle and green, with offsets for a green wave at `wave`
 * m/s from the first junction. Only the offsets change, so the cross streets, which are not
 * simulated, keep their time: the difference is the coordination alone.
 */
export function corridorSignals(at: number[], mode: "now" | "oqim", plan: { cycle: number; green: number; tunedCycle: number; tunedGreen: number }, wave = 45 / 3.6): Signal[] {
  return at.map((x, i) => {
    if (mode === "now") {
      const offset = ((i * 0.61803398875) % 1) * plan.cycle;
      return { at: x, cycle: plan.cycle, green: plan.green, offset, amber: 3 };
    }
    return { at: x, cycle: plan.cycle, green: plan.green, offset: (x - at[0]) / wave, amber: 3 };
  });
}

// Replays the vehicles of the clip through the junction under a signal plan. Each approach is a
// queue at its stop line (a point queue): a vehicle joins it when it reaches the line, at the
// arrival time measured on the video, and leaves on green, the first of a standing queue `startup`
// s after the green begins and the rest one saturation headway apart, both measured on the video.
// The same replay under the measured lights must give back the measured crossings: that is how the
// model is checked before it judges a new plan.

import type { Interval } from "./types.ts";

export const DT = 0.1;

export interface SimApproach {
  id: string;
  /** Sorted arrival times at the stop line (s). */
  arrivals: number[];
  /** Seconds between vehicles leaving a standing queue. */
  headway: number;
  /** Seconds from green to the first vehicle of a standing queue leaving. */
  startup: number;
  /** Phase group: approaches of one group have green together. */
  group: number;
  /** Measured greens (used by the "measured" controller only). */
  greens: Interval[];
}

export interface Junction {
  approaches: SimApproach[];
  /** Phase groups in the order they get green. */
  order: number[];
  /** Seconds between the end of one group's green and the start of the next (amber + all red). */
  intergreen: number;
  /** Seconds of phases not in view (cross streets the camera does not see), kept as they are. */
  hidden: number;
  /** When the first group's first green began on the video. */
  start: number;
  duration: number;
}

export type Controller =
  | { kind: "measured" }
  /** Green seconds per group, in `order`, and seconds of the phases out of view (default: as measured). */
  | { kind: "fixed"; greens: number[]; hidden?: number }
  | { kind: "actuated"; min: number; max: number; gap: number }
  /** Every `step` s after `min`, the green goes to the group with the most vehicles waiting (the
   * current one keeps it on a tie); the phases out of view keep `hidden` s once a cycle. */
  | { kind: "maxpressure"; min: number; max: number; step: number; hidden: number }
  /** Starts from a fixed plan and, once a second after `min`, ends the green or holds it. */
  | { kind: "predictive"; min: number; max: number; horizon: number; greens: number[]; hidden?: number };

export interface SimResult {
  /** Departure time per vehicle per approach (NaN: still waiting at the end). */
  departures: number[][];
  meanDelay: number;
  /** Vehicle-hours of waiting of the clip's vehicles, the ones still waiting when it ends included
   * (the replay runs on until they have left). */
  vehHours: number;
  served: number;
  /** Vehicles still waiting when the clip ends. */
  leftWaiting: number;
  maxQueue: number[];
  /** Greens that ended with vehicles left that had waited since before they began. */
  splitFailures: number;
  greensGiven: number;
  /** Greens per approach as the controller gave them. */
  greens: Interval[][];
  /** Queue per approach, once a second. */
  queue: number[][];
}

interface State {
  t: number;
  next: number[]; // index of the next vehicle to leave, per approach
  lastDep: number[];
  /** Phase position: index into `order` (or order.length for the hidden phases), and since when. */
  phase: number;
  since: number;
  /** In the intergreen before `phase`. */
  between: boolean;
  greenStart: number[]; // per approach, start of its current green, or NaN
  /** Departures the approach may still make now: it earns one per headway on green, up to BURST,
   * so the lanes of a wide approach can leave side by side. */
  tokens: number[];
}

/** Vehicles that may leave side by side: lanes of one approach. */
export const BURST = 3;

function cloneState(s: State): State {
  return { ...s, next: [...s.next], lastDep: [...s.lastDep], greenStart: [...s.greenStart], tokens: [...s.tokens] };
}

function waiting(j: Junction, s: State, a: number): number {
  const arr = j.approaches[a].arrivals;
  let n = 0;
  for (let i = s.next[a]; i < arr.length && arr[i] <= s.t; i++) n++;
  return n;
}

function arrivedWithin(j: Junction, a: number, from: number, to: number): boolean {
  const arr = j.approaches[a].arrivals;
  for (const x of arr) if (x > from && x <= to) return true;
  return false;
}

/** Discharge one step on the approaches that have green. */
function discharge(j: Junction, s: State, green: (a: number) => boolean, dep?: number[][]): void {
  j.approaches.forEach((ap, a) => {
    if (!green(a)) {
      s.greenStart[a] = NaN;
      s.tokens[a] = 0;
      return;
    }
    if (Number.isNaN(s.greenStart[a])) s.greenStart[a] = s.t;
    s.tokens[a] = Math.min(BURST, s.tokens[a] + DT / ap.headway);
    for (;;) {
      const i = s.next[a];
      if (i >= ap.arrivals.length || s.tokens[a] < 1 - 1e-9) return;
      const arr = ap.arrivals[i];
      if (arr > s.t) return;
      const ready = arr < s.greenStart[a] ? s.greenStart[a] + ap.startup : arr;
      if (s.t + 1e-9 < ready) return;
      if (dep) dep[a][i] = s.t;
      s.next[a] = i + 1;
      s.lastDep[a] = s.t;
      s.tokens[a] -= 1;
    }
  });
}

const groupsOf = (j: Junction) => j.order.length;

/** Phase step for the actuated logic: end the green of the current group when it has run its
 * minimum and no vehicle of the group waits or has arrived within `gap` s, or at its maximum. */
function actuatedWantsEnd(j: Junction, s: State, c: { min: number; max: number; gap: number }): boolean {
  const el = s.t - s.since;
  if (el < c.min) return false;
  if (el >= c.max) return true;
  const g = j.order[s.phase];
  for (let a = 0; a < j.approaches.length; a++) {
    if (j.approaches[a].group !== g) continue;
    if (waiting(j, s, a) > 0 || arrivedWithin(j, a, s.t - c.gap, s.t)) return false;
  }
  return true;
}

/** Moves the phase machine one step. `endGreen` decides whether the running green ends now. */
function advancePhase(j: Junction, s: State, endGreen: () => boolean, onGreenEnd?: (group: number) => void, hidden = j.hidden): void {
  const n = groupsOf(j);
  if (s.between) {
    if (s.t - s.since >= j.intergreen - 1e-9) {
      s.between = false;
      s.since = s.t;
    }
    return;
  }
  if (s.phase === n) {
    // the hidden phases run their fixed time
    if (s.t - s.since >= hidden - 1e-9) {
      s.phase = 0;
      s.between = true;
      s.since = s.t;
    }
    return;
  }
  if (endGreen()) {
    onGreenEnd?.(j.order[s.phase]);
    s.phase = s.phase + 1 < n ? s.phase + 1 : hidden > 0 ? n : 0;
    s.between = s.phase !== n; // the hidden phases bring their own intergreens
    s.since = s.t;
  }
}

function activeGroup(j: Junction, s: State): number | null {
  return s.between || s.phase >= groupsOf(j) ? null : j.order[s.phase];
}

/** Waiting vehicle-seconds over `span` s from state `s0` if the running green ends now (`endNow`)
 * or is held 1 s more, the fixed plan `base` running after that, plus a charge of 10 s for every
 * vehicle still waiting at the end of the span. */
function rollout(j: Junction, s0: State, base: { greens: number[]; hidden: number }, span: number, endNow: boolean): number {
  const s = cloneState(s0);
  let cost = 0;
  let first = true;
  const holdUntil = s0.t + 1;
  const until = s.t + span;
  const phase0 = s0.phase;
  while (s.t < until) {
    if (first && endNow) advancePhase(j, s, () => true, undefined, base.hidden);
    else if (!endNow && s.t < holdUntil) advancePhase(j, s, () => false, undefined, base.hidden);
    else
      advancePhase(
        j,
        s,
        // the held green ends once it has had its planned time (at once if it already has)
        () => s.t - s.since >= base.greens[s.phase] - 1e-9 || (s.phase === phase0 && s.since === s0.since && s.t >= holdUntil && s.t - s.since >= base.greens[s.phase]),
        undefined,
        base.hidden,
      );
    first = false;
    const g = activeGroup(j, s);
    discharge(j, s, (a) => g !== null && j.approaches[a].group === g);
    for (let a = 0; a < j.approaches.length; a++) cost += waiting(j, s, a) * DT;
    s.t = Math.round((s.t + DT) * 1e6) / 1e6;
  }
  for (let a = 0; a < j.approaches.length; a++) cost += waiting(j, s, a) * 10;
  return cost;
}

export function simulate(j: Junction, c: Controller): SimResult {
  const A = j.approaches.length;
  const dep = j.approaches.map((ap) => ap.arrivals.map(() => NaN));
  const s: State = {
    t: 0,
    next: Array(A).fill(0),
    lastDep: Array(A).fill(-Infinity),
    phase: 0,
    since: 0,
    between: false,
    greenStart: Array(A).fill(NaN),
    tokens: Array(A).fill(0),
  };
  const greens: Interval[][] = j.approaches.map(() => []);
  const queue: number[][] = j.approaches.map(() => []);
  const maxQueue = Array(A).fill(0);
  let splitFailures = 0;
  let greensGiven = 0;

  // A fixed or adaptive plan starts its first green when the video's first green began; before that
  // every plan runs the measured lights, so all start from the same queues.
  const plan = c.kind !== "measured";
  let started = !plan;
  let decideAt = 0;

  const greenEnded = (group: number) => {
    greensGiven++;
    const failed = j.approaches.some((ap, a) => {
      if (ap.group !== group) return false;
      const i = s.next[a];
      const gs = Number.isNaN(s.greenStart[a]) ? s.t : s.greenStart[a];
      return i < ap.arrivals.length && ap.arrivals[i] < gs - 0.5;
    });
    if (failed) splitFailures++;
  };

  const measuredGreen = (a: number) => j.approaches[a].greens.some((g) => s.t >= g.start && s.t < g.end);

  // past the end of the clip the replay runs on, with no more arrivals, until every vehicle has left:
  // a plan must not look better for leaving vehicles waiting when the clip stops
  const end = j.duration + 600;
  const allServed = () => j.approaches.every((ap, a) => s.next[a] >= ap.arrivals.length);
  while (s.t < end && !(s.t >= j.duration && allServed())) {
    if (plan && !started && s.t >= j.start) {
      started = true;
      s.phase = 0;
      s.between = false;
      s.since = s.t;
    }
    let green: (a: number) => boolean;
    if (!started || c.kind === "measured") green = measuredGreen;
    else {
      if (c.kind === "fixed") {
        advancePhase(j, s, () => s.t - s.since >= c.greens[s.phase] - 1e-9, greenEnded, c.hidden ?? j.hidden);
      } else if (c.kind === "actuated") {
        advancePhase(j, s, () => actuatedWantsEnd(j, s, c), greenEnded);
      } else if (c.kind === "maxpressure") {
        advancePhase(
          j,
          s,
          () => {
            const el = s.t - s.since;
            if (el < c.min) return false;
            if (el >= c.max) return true;
            if (s.t < decideAt) return false;
            decideAt = s.t + c.step;
            const queueOf = (g: number) => j.approaches.reduce((q, ap, a) => q + (ap.group === g ? waiting(j, s, a) / ap.headway : 0), 0);
            const here = queueOf(j.order[s.phase]);
            // the other groups' pressure; with one group in view, its green ends once its queue is gone
            const others = j.order.filter((_, o) => o !== s.phase).map(queueOf);
            return others.length ? Math.max(...others) > here : here === 0 && !arrivedWithin(j, j.approaches.findIndex((ap) => ap.group === j.order[s.phase]), s.t - 3, s.t);
          },
          greenEnded,
          c.hidden,
        );
      } else if (c.kind === "predictive") {
        // once a second after the minimum green: end it now or hold it, whichever leaves less waiting
        // over the next `horizon` s of known arrivals (in the field, from the camera of the junction upstream)
        advancePhase(
          j,
          s,
          () => {
            const el = s.t - s.since;
            if (el < c.min) return false;
            if (el >= c.max) return true;
            if (s.t < decideAt) return false;
            decideAt = s.t + 1;
            const base = { greens: c.greens, hidden: c.hidden ?? j.hidden };
            // follow the plan unless leaving it saves at least MARGIN vehicle-seconds over the horizon
            const MARGIN = 2;
            const end = rollout(j, s, base, c.horizon, true);
            const hold = rollout(j, s, base, c.horizon, false);
            return el < c.greens[s.phase] ? end < hold - MARGIN : !(hold < end - MARGIN);
          },
          greenEnded,
          c.hidden ?? j.hidden,
        );
      }
      const g = activeGroup(j, s);
      green = (a) => g !== null && j.approaches[a].group === g;
    }
    discharge(j, s, green, dep);
    // the greens as given, for drawing
    for (let a = 0; a < A; a++) {
      const on = green(a) && s.t < j.duration;
      const list = greens[a];
      const last = list[list.length - 1];
      if (on) {
        if (last && Math.abs(last.end - s.t) < DT / 2) last.end = s.t + DT;
        else list.push({ start: s.t, end: s.t + DT });
      }
      if (s.t >= j.duration) continue;
      const q = waiting(j, s, a);
      if (q > maxQueue[a]) maxQueue[a] = q;
      if (Math.abs(s.t - Math.round(s.t)) < DT / 2) queue[a].push(q);
    }
    s.t = Math.round((s.t + DT) * 1e6) / 1e6;
  }
  if (c.kind === "measured") {
    // split failures of the measured lights, per green
    j.approaches.forEach((ap, a) => {
      for (const g of ap.greens) {
        if (g.start < 0 || g.end > j.duration) continue;
        greensGiven++;
        if (ap.arrivals.some((x, i) => x < g.start - 0.5 && (Number.isNaN(dep[a][i]) || dep[a][i] > g.end + 3))) splitFailures++;
      }
    });
  }

  let total = 0, count = 0, served = 0, left = 0;
  j.approaches.forEach((ap, a) => {
    ap.arrivals.forEach((x, i) => {
      if (x > j.duration) return;
      const d = dep[a][i];
      count++;
      if (Number.isNaN(d)) total += end - x;
      else total += d - x;
      if (Number.isNaN(d) || d > j.duration) left++;
      else served++;
    });
  });
  return {
    departures: dep,
    meanDelay: count ? total / count : 0,
    vehHours: total / 3600,
    served,
    leftWaiting: left,
    maxQueue,
    splitFailures,
    greensGiven,
    greens,
    queue,
  };
}

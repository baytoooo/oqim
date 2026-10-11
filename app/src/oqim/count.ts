// Vehicles passing a billboard: every tracked vehicle whose path crosses a line drawn across the
// road in front of it, once per vehicle, by type and by direction, and per minute. No DOM.

import { segmentCrossing, vehicleTracks } from "./tracks.ts";
import type { Pt, VTrack } from "./types.ts";

export interface Pass {
  track: number;
  /** Seconds from the start of the video. */
  t: number;
  /** +1 or -1: the side of the line the vehicle moved to. */
  dir: number;
  /** COCO class: 2 car, 3 motorcycle, 5 bus, 7 truck. */
  cls: number;
}

export interface Count {
  passes: Pass[];
  total: number;
  byClass: Record<string, number>;
  /** Vehicles each way: `a` moved to the left side of the line (looking from its first point to
   * its second), `b` to its right side. */
  byDir: { a: number; b: number };
  /** Vehicles per minute of video, minute 0 first. */
  perMinute: number[];
  /** Vehicles an hour at the rate of this video. */
  perHour: number;
  duration: number;
}

export const CLASS_NAME: Record<number, string> = { 2: "car", 3: "motorcycle", 5: "bus", 7: "truck" };

/**
 * The vehicles that cross `line`, each counted once at its first crossing. A vehicle's point is the
 * bottom centre of its box raised by 15% of its height (where its wheels touch the road), as the
 * audit uses.
 */
export function countPasses(tracks: VTrack[], line: [Pt, Pt], duration: number): Count {
  const [p, q] = line;
  const passes: Pass[] = [];
  for (const tr of tracks) {
    for (let i = 0; i + 1 < tr.t.length; i++) {
      const c = segmentCrossing(tr.foot[i], tr.foot[i + 1], p, q, 0.04);
      if (!c) continue;
      passes.push({ track: tr.id, t: tr.t[i] + c.f * (tr.t[i + 1] - tr.t[i]), dir: c.dir, cls: tr.cls });
      break;
    }
  }
  passes.sort((a, b) => a.t - b.t);
  const byClass: Record<string, number> = {};
  for (const x of passes) byClass[CLASS_NAME[x.cls] ?? "other"] = (byClass[CLASS_NAME[x.cls] ?? "other"] ?? 0) + 1;
  const minutes = Math.max(1, Math.ceil(duration / 60));
  const perMinute = Array.from({ length: minutes }, () => 0);
  for (const x of passes) perMinute[Math.min(minutes - 1, Math.floor(x.t / 60))]++;
  return {
    passes,
    total: passes.length,
    byClass,
    byDir: { a: passes.filter((x) => x.dir > 0).length, b: passes.filter((x) => x.dir < 0).length },
    perMinute,
    perHour: duration > 0 ? (passes.length * 3600) / duration : 0,
    duration,
  };
}

/** From the pipeline's overlay frames: tracks seen in 3 frames or more, then the passes. */
export function countFrames(frames: { t: number; boxes: [number, number, number, number, number, number][] }[], line: [Pt, Pt], duration: number): Count {
  return countPasses(vehicleTracks(frames, 3), line, duration);
}

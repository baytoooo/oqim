// Shared types of the signal audit. Pixels are work pixels (the frame scaled to 1920 px wide), as
// the detector and tracker of src/pipeline/ give them; times are seconds from the start of the clip.

export type Pt = [number, number];
export type Rect = [number, number, number, number]; // x0, y0, x1, y1

/** One approach to the junction: the stop line across its lanes, and the signal head that controls
 * it if one is in view. */
export interface Approach {
  id: string;
  name: string;
  line: [Pt, Pt];
  /** Index into AuditConfig.heads, or null: the phases are then read from how the traffic moves. */
  head: number | null;
}

export interface AuditConfig {
  approaches: Approach[];
  /** Rectangles around the vehicle signal heads. */
  heads: Rect[];
}

/** Colour contrast of one head in one frame: [red, amber, green] (signal.ts headScores). */
export type HeadScores = [number, number, number];

export interface HeadSeries {
  t: number[];
  /** scores[i][k]: head k at t[i]. */
  scores: HeadScores[][];
}

export type Light = "red" | "green" | "other";

/** [start, end) of one light. */
export interface Interval {
  start: number;
  end: number;
}

/** A vehicle track from the tracker's boxes, reduced to what the audit needs. */
export interface VTrack {
  id: number;
  cls: number;
  t: number[];
  /** Bottom centre of the box, raised by 15% of its height, smoothed. */
  foot: Pt[];
  /** sqrt of the box area, smoothed: the vehicle's size in pixels. */
  size: number[];
  /** px per second. */
  speed: number[];
}

/** A vehicle that crossed an approach's stop line. */
export interface Crossing {
  track: number;
  approach: string;
  /** When it crossed the line. */
  t: number;
  /** Seconds it stood still before the line. */
  stopped: number;
  /** When it would have reached the line without stopping: t - stopped. */
  arrival: number;
  /** It was already standing when the clip (or its track) began, so `arrival` is too late. */
  censored: boolean;
  /** Light of its approach when it crossed. */
  light: Light;
}

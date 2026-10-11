// Build-time access to public/data/audits.json: the audits of the sample clips that the home and
// Method pages quote (written by samples_src/make_audits.ts with src/oqim/audit.ts).
import fs from "node:fs";
import path from "node:path";

export type ModeKey = "measured" | "webster" | "tuned" | "actuated" | "predictive";

export interface SampleMode {
  key: ModeKey;
  label: string;
  /** Mean seconds a vehicle waits in the replay. */
  meanDelay: number;
  vehHours: number;
  leftWaiting: number;
  cycle: number | null;
}

export interface SampleApproach {
  name: string;
  vehicles: number;
  flowPerHour: number;
  meanWait: number;
  arrivalsOnGreen: number;
  headway: number;
  greenMean: number | null;
  redRuns: number;
  maxQueue: number;
}

export interface SampleAudit {
  clip: string;
  duration: number;
  cycle: number | null;
  hidden: number;
  Y: number;
  approaches: SampleApproach[];
  modes: SampleMode[];
  check: { departureError: number; measuredWait: number; modelWait: number; vehicles: number };
}

export interface SampleAudits {
  source: string;
  clips: SampleAudit[];
}

export function loadAudits(): SampleAudits {
  const file = path.resolve(process.cwd(), "public", "data", "audits.json");
  if (!fs.existsSync(file)) return { source: "", clips: [] };
  return JSON.parse(fs.readFileSync(file, "utf8")) as SampleAudits;
}

export const modeOf = (a: SampleAudit, key: ModeKey) => a.modes.find((m) => m.key === key);

/** The mode with the lowest mean delay. */
export const bestMode = (a: SampleAudit) => [...a.modes].sort((x, y) => x.meanDelay - y.meanDelay)[0];

export const vehiclesOf = (a: SampleAudit) => a.approaches.reduce((s, x) => s + x.vehicles, 0);

/** "5:40" */
export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;

/** Fixed digits, or a dash for a missing number. */
export const f = (v: number | null | undefined, d = 1) => (typeof v === "number" && Number.isFinite(v) ? v.toFixed(d) : "-");

/** A clip whose replay does not give back its crossings closely (median departure error over 2 s):
 * its plan numbers are shown, but not trusted. */
export const weakCheck = (a: SampleAudit) => !(a.check.departureError <= 2);

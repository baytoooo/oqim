// The sample clips of the audit page: the organisers' footage of one Tashkent junction from the
// elimination task (960 x 540, 10 fps copies), with its southbound stop line and the vehicle signal
// head on the median that controls it, in work pixels (the clip scaled to 1920 px wide).

import type { AuditConfig } from "./types.ts";

export interface SampleClip {
  name: string;
  label: string;
  seconds: number;
  url: string;
}

export const SAMPLES: SampleClip[] = [
  { name: "C3896", label: "Midday, 5:40", seconds: 340, url: "/media/samples/C3896.mp4" },
  { name: "C3897", label: "Afternoon, 5:18", seconds: 318, url: "/media/samples/C3897.mp4" },
  { name: "C3902", label: "Evening, 5:18", seconds: 318, url: "/media/samples/C3902.mp4" },
  { name: "C3905", label: "Dusk, 2:08", seconds: 128, url: "/media/samples/C3905.mp4" },
];

export const SAMPLE_CONFIG: AuditConfig = {
  approaches: [{ id: "a1", name: "Southbound", line: [[285, 527], [930, 457]], head: 0 }],
  heads: [[1141, 354, 1173, 422]],
};

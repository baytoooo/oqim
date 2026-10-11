# OQIM

A traffic signal audit from one video. Team PariVision, WIUT Hackathon 2026, Computer Vision track final.

**Mode: Startup.**

You open a video of a signalised junction and mark it: a stop line across each approach, a click on each vehicle signal head. In the browser, OQIM then reads the signal lights from the pixels, counts every vehicle over the stop lines, measures waits, queues and the discharge rate, and finds red-light runs. It replays the clip's own vehicles through a queue model, checks that the replay gives back the crossings it measured, and then compares signal plans on that replay: the current timing, the Webster (1958) formula, a tuned fixed plan, an actuated controller and a predictive one.

US cities measure the same kind of thing (arrivals on green, split failures) from controller logs with a system called ATSPM. Most controllers in our city are not connected, so OQIM measures it from video, with no access to the controller.

## Run it

```sh
cd app
pnpm install
pnpm dev      # http://localhost:4321
pnpm test     # node --test, the audit core on a simulated junction
pnpm build    # static site in app/dist
```

Node 22.18 or newer and pnpm 11 (see `app/package.json`).

## Where inference runs

On the visitor's device, in the browser tab. The page draws frames from a `<video>` element at 5 frames per second and sends them to a Web Worker. The worker runs YOLO26s (exported to ONNX, 960 x 544 input) in ONNX Runtime Web on WebGPU, or on WebAssembly where WebGPU is missing, and tracks the boxes with ByteTrack. The audit core (`app/src/oqim/`) is plain TypeScript with no DOM. If the browser cannot decode a file, ffmpeg.wasm converts it in the browser first.

The video is never uploaded. No number plates or faces are read.

## Speed and cost

* Analysis at 5 frames per second of video.
* About 1 minute of processing per minute of 1080p video on an Apple M5 laptop with WebGPU. Slower on WebAssembly and on phones.
* Zero server cost per audit: inference runs on the user's device, and the site is static files.

## Data and licences

| what | where it comes from | licence |
|---|---|---|
| Sample clips C3896, C3897, C3902, C3905 (`app/public/media/samples/`) | The organisers' footage of one Tashkent junction, given for the elimination task. Used as samples. | No licence stated |
| Sample tracks (`samples_src/*_tracks.json`) and `app/public/data/audits.json` | Tracks and lamp readings from our elimination-stage pipeline (YOLO26m at 1280 px, 10 frames per second, ByteTrack) on those clips, audited by `samples_src/make_audits.ts` | Derived from the clips above |
| Detector weights (`app/public/pipeline/model.onnx`) | Ultralytics YOLO26s, pretrained on COCO, exported to ONNX | AGPL-3.0 |
| Classes | COCO class ids (car 2, motorcycle 3, bus 5, truck 7 for the audit) | |
| ByteTrack port (`app/src/pipeline/tracker.ts`) | Ported from Ultralytics 8.4 (AGPL-3.0), which builds on ByteTrack by Zhang et al. (MIT); lapjv from the lap package (BSD-2-Clause) | AGPL-3.0 |
| onnxruntime-web | npm | MIT |
| ffmpeg.wasm | npm: `@ffmpeg/ffmpeg` (MIT), `@ffmpeg/core-mt` (GPL-2.0-or-later) | MIT, GPL-2.0-or-later |
| Overpass and Barlow Condensed fonts | npm, Fontsource | OFL-1.1 |

No other data is used. Because the weights are AGPL-3.0, the site source is AGPL-3.0 too (`app/package.json`).

## Reused from the elimination stage, and built for the final

Reused, declared: from our elimination-stage system, https://github.com/baytoooo/parivision-traffic

* the in-browser detector and the ONNX worker (`app/src/pipeline/`)
* the ByteTrack port
* the video conversion with ffmpeg.wasm (`app/src/scripts/transcode.ts`)
* the site design: tokens, layout and components

Built during the final:

* the audit core, `app/src/oqim/`: tracks and stop line crossings (`tracks.ts`), lights from a head or from the traffic (`phases.ts`), the point-queue replay and its controllers (`sim.ts`), the audit, the plans and the model check (`audit.ts`)
* the audit page (`app/src/pages/audit.astro`)
* the landing page and the Method page (`app/src/pages/index.astro`, `app/src/pages/method.astro`)

## What is measured

The Method page (`/method`) lists every measure with its formula and constants. In short:

* A vehicle stands still below 0.15 of its own size per second (`STOP_REL`).
* Its arrival at the line is its crossing time minus the time it stood still.
* The discharge rate comes from the busiest 10 s of each green; up to 3 vehicles may leave side by side in the replay (`BURST`).
* Webster's cycle is C0 = (1.5L + 5) / (1 - Y), kept between 40 and 150 s. Phases out of view are loaded at the same degree of saturation as the approaches in view.
* The tuned plan tries cycles from 40 to 150 s in 5 s steps on the replay.
* The predictive mode decides each second whether to end or hold the green, from the next 30 s of arrivals.

On the four sample clips, the Webster formula gave more delay than the current timing on every clip. That is why OQIM checks every plan on the replay before it recommends one.

## Known limits

* The camera must see the stop line, and ideally the vehicle signal head.
* The clip needs at least 2 cycles, about 3 minutes. On C3905 (2:08) the replay does not fit.
* Occlusion breaks tracks in long queues.
* A wide approach is drawn as one line.
* Free right turns on red count as red crossings.
* Night and rain are not yet measured on our own test set.
* The predictive mode assumes the arrivals of the next 30 s are known. In the field that needs a camera at the junction upstream.

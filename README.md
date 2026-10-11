# OQIM

A parking tracker from car park cameras. Team PariVision, WIUT Hackathon 2026, Computer Vision track final.

**Mode: Startup.**

Cameras over a car park count the free spaces and see each car come in and leave. OQIM forecasts how many spaces will be free at the minute you arrive, and tells each driver which car park to go to, so the drivers do not all go to the same one.

* `/tracker`, the product: three PKLot car park cameras over a morning. Every space is marked free or taken from the frame, the cars coming in and leaving are counted, and the free spaces are forecast for your arrival. The evaluation against the dataset's hand labels is in `app/public/data/tracker.json`.
* `/parking`: how well the detector marks spaces, measured on 240 held-out PKLot images (`app/public/data/parking.json`).
* `/city`: a whole district with live open data from Hong Kong (car park vacancy and traffic cameras in Kwun Tong); drivers are sent to car parks with the roads and spaces of the drivers before them counted.
* `/banner`, billboard traffic: a video from a camera by a billboard. You draw a line across the road, and the browser pipeline (YOLO26s in ONNX, 5 frames per second, ByteTrack) counts every vehicle once when its track crosses the line, by type (car, bus, truck, motorcycle) and direction, per minute and per hour. The video plays with each counted vehicle turning green, and the Missed (+1) and Not a vehicle (-1) buttons correct the count by eye. Counts are saved to a log per billboard in the browser (localStorage) and export as CSV. For outdoor advertising companies and billboard owners who need proof of traffic for advertisers. On two sample clips of the Tashkent junction it counted 130 vehicles against 130 at midday (5 min 40 s) and 55 against 59 at dusk (2 min 8 s), 185 against 189 in all (97.9%). The reference is our offline pipeline from the elimination stage (YOLO26m at 1280 px, 10 frames per second, ByteTrack) on the same clips and line, so this is agreement between two models, not a hand count (`app/public/data/banner.json`).

**Next stage: the same cameras can later time the lights.** The signal audit (`/audit`) opens a video of a signalised junction and, in the browser, reads the signal lights from the pixels, counts every vehicle over the stop lines, measures waits, queues and the discharge rate, and finds red-light runs. It replays the clip's own vehicles through a queue model, checks that the replay gives back the crossings it measured, and then compares signal plans on that replay: the current timing, the Webster (1958) formula, a tuned fixed plan, an actuated controller and a predictive one. `/network` drives the same vehicles through up to five real junctions of Tashkent in 3D, under the timing now and with a green wave. US cities measure the same kind of thing (arrivals on green, split failures) from controller logs with a system called ATSPM; most controllers in our city are not connected, so OQIM measures it from video, with no access to the controller.

`/roads` is a side tool: road damage found in phone photos and put on a map.

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
| Detector weights, light (`app/public/pipeline/model_n.onnx`, the default) | Ultralytics YOLO26n, pretrained on COCO, exported to ONNX at 544 x 960 | AGPL-3.0 |
| Road graphs of Tashkent, Kwun Tong (Hong Kong) and Kennington (London) (`app/public/data/*_roads.json`) | OpenStreetMap via the Overpass API, fetched 11 October 2026 (`samples_src/make_roads*.py`) | ODbL 1.0, © OpenStreetMap contributors |
| Basemap with buildings in 3D on `/network` and `/city` | OpenFreeMap tiles (OpenMapTiles schema, OpenStreetMap data), loaded by the page | OpenFreeMap terms; ODbL data |
| Hong Kong traffic camera images and the counts made from them (`app/public/data/hongkong.json`, `app/public/media/hongkong/`) | Transport Department, Hong Kong SAR Government, traffic snapshot images, via DATA.GOV.HK; counted by YOLO26m at 960 px in `samples_src/hongkong_detect.py`; the page also loads the live image | DATA.GOV.HK terms of use (attribution) |
| Hong Kong car park vacancy (`app/public/data/hk_carparks.json`, live through `app/api/hkparking.js`) | Transport Department, car park information and vacancy for private cars, via DATA.GOV.HK | DATA.GOV.HK terms of use (attribution) |
| London JamCam clips and counts (`app/public/data/london.json`, `app/public/media/london/`, live through `app/api/jamcam.js`) | Transport for London JamCams, "Powered by TfL Open Data" | TfL open data terms (based on the Open Government Licence) |
| Car park frames and space labels on `/parking` (`app/public/media/parking/`, `app/public/data/parking.json`) | PKLot (Almeida et al., Expert Systems with Applications 42(11), 2015), via the Voxel51 copy on Hugging Face; accuracy measured on 240 held-out images in `samples_src/parking_eval.py` | CC BY 4.0 |
| Car park frames and space labels on `/tracker` (`app/public/media/tracker/`, `app/public/data/tracker.json`) | PKLot (Almeida et al., Expert Systems with Applications 42(11), 2015): frames of 3 cameras, one morning each (PUCPR 2012-10-17, UFPR05 2013-03-22, UFPR04 2013-01-18), via the Voxel51/PKLot mirror on Hugging Face (https://huggingface.co/datasets/Voxel51/PKLot); the typical-day forecast uses the labels of the same car parks on other weekdays | CC BY 4.0 |
| Road damage model on `/roads` (`app/public/roads/model.onnx`) | YOLOv8n trained on RDD2022 by dronefreak (https://huggingface.co/dronefreak/rdd2022-yolov8n), exported to ONNX with NMS | AGPL-3.0 |
| Road damage photos and the test sample on `/roads` (`app/public/media/roads/`, `app/public/data/roads_eval.json`) | RDD2022 (Arya et al., arXiv:2209.08538), via https://huggingface.co/datasets/dronefreak/RDD2022; 300 images of the test split for the measured mAP50 | CC BY-SA 4.0 |
| Published results on `/elsewhere` | The articles and reports linked on that page | Quoted with links |

No other data is used. Drivers, their origins and departure times on `/city` are simulated (seeded) and marked as such; so is the traffic on `/network`. Because the weights are AGPL-3.0, the site source is AGPL-3.0 too (`app/package.json`).

## Reused from the elimination stage, and built for the final

Reused, declared: from our elimination-stage system, https://github.com/baytoooo/parivision-traffic

* the in-browser detector and the ONNX worker (`app/src/pipeline/`)
* the ByteTrack port
* the video conversion with ffmpeg.wasm (`app/src/scripts/transcode.ts`)
* the site design: tokens, layout and components

Built during the final:

* the parking tracker (`app/src/pages/tracker.astro`, `app/src/scripts/tracker.ts`, `app/public/data/tracker.json`, `app/public/media/tracker/`)
* the billboard counter (`app/src/pages/banner.astro`, `app/src/scripts/banner.ts`, `app/src/oqim/count.ts` with `app/tests/count.test.ts`, `app/public/data/banner.json`)
* the audit core, `app/src/oqim/`: tracks and stop line crossings (`tracks.ts`), lights from a head or from the traffic (`phases.ts`), the point-queue replay and its controllers (`sim.ts`), the audit, the plans and the model check (`audit.ts`)
* the audit page (`app/src/pages/audit.astro`)
* the landing page and the Method page (`app/src/pages/index.astro`, `app/src/pages/method.astro`)
* the 3D corridor (`app/src/oqim/corridor.ts`, `app/src/pages/network.astro`, `app/src/scripts/network.ts`): the audited vehicles drive up to five real junctions of Tashkent with the Intelligent Driver Model, timing now against a green wave
* the district model (`app/src/oqim/allocate.ts`, `app/src/pages/city.astro`, `app/src/scripts/city.ts`, `app/api/`): Kwun Tong cameras and live car park vacancy, road load now and forecast, drivers sent to car parks with their own loads counted
* the camera collectors and counters (`samples_src/hongkong_*.py`, `samples_src/london_*.py`)
* the Elsewhere page (`app/src/pages/elsewhere.astro`)
* the parking page (`app/src/pages/parking.astro`, `app/src/scripts/parking.ts`, `samples_src/parking_eval.py`) and the road condition page (`app/src/pages/roads.astro`, `app/src/scripts/roads.ts`, `samples_src/roads_*.py`)
* the audit dashboard: traffic events from the elimination rules, the Purdue coordination diagram and the vehicles served and left at each green
* the defence deck (`deck/build.js`, `deck/OQIM_defence.pptx`, `deck/OQIM_defence.pdf`)

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

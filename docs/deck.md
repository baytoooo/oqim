# OQIM defence deck: slide text and speaker notes

7 minutes of talk, hard stop, then 3 minutes of questions. 11 main slides, about 2.5 minutes of them live in the browser (4 demos), then 6 backup slides (B1 to B6, slides 12 to 17) for the questions.
Slide text is in English; the full speaker notes (what to say, what to click) are in the notes of each slide in `deck/OQIM_defence.pptx`.

The deck is built by `deck/build.js` (`cd deck && node build.js`, then the PDF with soffice). It reads its numbers from `app/public/data/` (tracker.json, parking.json, audits.json, hongkong.json, hk_carparks.json, roads_eval.json, banner.json, tashkent_roads.json, team.json). The 40-driver example on slide 3 is computed by build.js with the page's own code (`app/src/oqim/tracker.ts`) on tracker.json at 10:13, the moment of the screenshots. The recorded runs that are in no data file (the Kwun Tong snapshot, the corridor, the lamp agreement) are in `RECORDED` at the top of build.js. The numbers below are the ones in the data files when this was written; if a file changes, rebuild the deck and update this page.

Screenshots in `deck/img/` taken from the site on 11 October 2026: `tracker_stage.jpg`, `tracker_ask.jpg`, `tracker_spread.jpg` (/tracker at 10:13, whole car park, 40 drivers), `parking_upload.jpg` (/parking, a PKLot frame loaded as your own photo), `city_wall_row.jpg` (/city camera wall), `banner_video.jpg` and `banner_minutes.jpg` (/banner after counting sample C3896 in the browser), `roads_detect.jpg` (/roads, sample India). They are the fallback if the internet is slow.

## Plan

| # | Slide | Time | Speaker | Demo |
|---|---|---|---|---|
| 1 | OQIM. A parking tracker from car park cameras | 0:00 to 0:15 | Amal | |
| 2 | Drivers circle because they cannot see free spaces | 0:15 to 0:50 | Amal | |
| 3 | Free spaces now, and when you arrive | 0:50 to 2:00 | Komronbek | 1 of 4, /tracker, 1:00 |
| 4 | 98.8% of space readings right | 2:00 to 2:30 | Komronbek | |
| 5 | From a camera frame to advice | 2:30 to 3:00 | Komronbek | |
| 6 | Your own photo, no hand marking | 3:00 to 3:35 | Aziza (Komronbek clicks) | 2 of 4, /parking, 0:30 |
| 7 | A district: 22 live cameras and car parks | 3:35 to 4:15 | Aziza (Komronbek clicks) | 3 of 4, /city, 0:35 |
| 8 | How many vehicles pass your billboard | 4:15 to 4:50 | Aziza (Komronbek clicks) | 4 of 4, /banner, 0:25 |
| 9 | Next: the same cameras time the lights | 4:50 to 5:20 | Aziza | |
| 10 | Who pays, and the pilot | 5:20 to 6:25 | Amal | |
| 11 | Team PariVision (ask, next steps, questions) | 6:25 to 7:00 | Amal | |
| 12 to 17 | Backup B1 to B6 | Q&A | whoever is asked | |

Speaking time: Amal 2:30, Komronbek 2:10, Aziza 2:20. Komronbek drives the laptop for the whole talk.

---

## 1. OQIM. A parking tracker from car park cameras (Amal, 0:00 to 0:15)

- Mode: **Startup** (say it out loud).
- Team PariVision, Webster University in Tashkent: Amal Karimov, Komronbek Qodirov, Aziza Adizova.
- Live: https://oqim-audit.vercel.app/tracker · Code: https://github.com/baytoooo/oqim
- Picture: the PUCPR camera at 09:04 on 17 October 2012 (PKLot), 55 free of 260 spaces of the whole car park as our detector read it.
- Live today: /tracker, /parking, /city, /banner.

## 2. Drivers circle because they cannot see free spaces (Amal, 0:15 to 0:50)

- **17 hours** a year a US driver spends searching for parking ([INRIX, 2017](https://inrix.com/press-releases/parking-pain-us/)).
- **About 5%** of off-street car parks publish live free spaces ([Parkopedia](https://business.parkopedia.com/blog/parking-availability-how-predictive-and-responsive-data-work-together-to-provide-drivers-with-the-best-possible-parking-experience)).
- **Tashkent:** Poytaxt Parking plans paid parking on 86 streets with 13,208 spaces, first come, first served ([Spot.uz](https://www.spot.uz/ru/2025/05/06/poytaxt-parking)).
- SFpark cut cruising for parking by 50% on its pilot blocks ([ACCESS](https://accessmagazine.org/fall-2016/cruising-for-parking-lessons-from-san-francisco/)).
- User: drivers going to malls, offices, hospitals and stations. Who pays: car park operators, the city, outdoor advertising companies.

## 3. Live demo 1 of 4: /tracker, free spaces now and when you arrive (Komronbek, 0:50 to 2:00)

https://oqim-audit.vercel.app/tracker. Screenshots: the camera and the three car parks, "Ask now" and "Many drivers asking at the same time", all at 10:13.

- 3 PKLot cameras on one clock, 06:55 to 10:35, a frame every 5 minutes. Labelled spaces: PUCPR 100 (2012-10-17), UFPR05 40 (2013-03-22), UFPR04 28 (2013-01-18).
- Demo order: 1 Play the morning (orange: car in, white: car out). 2 Labelled spaces, then Whole car park (dashed: found where cars stay 20 minutes, +198 spaces). 3 Drag the clock to about 10:13, Pause: one driver is told PUCPR, about 23 spaces free on arrival. 4 40 drivers at once: every navigator sends all 40 to PUCPR and 17 find it full; OQIM places them one by one (PUCPR 27, UFPR05 3, UFPR04 10) and 4 find it full.

## 4. 98.8% of space readings right (Komronbek, 2:00 to 2:30)

- **98.8%** of 6,844 space readings right, 112 frames of 3 cameras, against the PKLot hand labels.
- Free count off by a median of **1** space, **4** at the 90th percentile.
- Whole car park: **+198** spaces found outside the 168 hand-labelled ones; on the labelled part the same method finds **139 of the 142** spaces cars used.
- Chart: forecast error by minutes ahead, OQIM against "same as now": 5 min 2.39 / 3.39, 10 min 3.03 / 4.63, 15 min 4.05 / 6.24, 20 min 4.82 / 7.59, 30 min 6.52 / 10.31 spaces. At 10 minutes: 3.0 against 4.6 over 101 forecasts.
- Same rule as /parking, picked on its 96 calibration images. Cars seen on the labelled spaces: 146 in, 11 out. Recorded mornings of a public dataset, not a live feed yet.

## 5. From a camera frame to advice (Komronbek, 2:30 to 3:00)

Frames, Detect (YOLO26m on the tracker frames, YOLO26n 10 MB in the browser, whole frame plus 3 x 3 tiles at 960 px), Space state (one box covers 40%, two frames in a row agree), Forecast (10 min ahead from the last 20 minutes and the usual weekday), Advise (drivers placed one by one). Cards: 10 MB detector in ONNX Runtime Web (WebGPU or WebAssembly); 0 GPU servers; no plates, no faces; 4 pages, one pipeline.

## 6. Live demo 2 of 4: /parking, your own photo, no hand marking (Aziza, 3:00 to 3:35)

https://oqim-audit.vercel.app/parking. Komronbek presses "Choose a photo" and picks a car park photo saved on the desktop.

- Red: every car found is a taken space. Dashed green: a gap in a row of cars that fits a car is a suggested free space. On your own photo the far rows are also read on 5 x 5 tiles, each enlarged.
- **88.4%** of taken spaces found and **83.5%** of suggested free spaces really free, on **336** PKLot images: the same images its settings were picked on, not held out.
- Held out, with the spaces marked: **97.4%** of 13,447 spaces right on 240 images; the rule was picked on 96 other images.
- Limit: it suggests 12.2% of all free spaces; an empty row has no cars to line up against, so it must be drawn (4 clicks).

## 7. Live demo 3 of 4: /city, a district, 22 live cameras and car parks (Aziza, 3:35 to 4:15)

https://oqim-audit.vercel.app/city (needs the internet: live data and map tiles).

- 22 Transport Department cameras (DATA.GOV.HK), 1,116 snapshots counted by YOLO26m; live vacancy of 28 car parks.
- Snapshot at 13:45 Hong Kong time, 11 October, 60 drivers to Kwun Tong MTR: **60 → 5** arrive to a full car park (nearest against OQIM); door to door 15.5 to 12.7 min (**−18%**); vehicle-km with searching 305 to 181 (**−41%**). The live page shows today's numbers, which differ.
- Measured: camera counts and vacancy. Simulated: the drivers.

## 8. Live demo 4 of 4 (new): /banner, how many vehicles pass your billboard (Aziza, 4:15 to 4:50)

https://oqim-audit.vercel.app/banner (count sample C3896 before the talk and keep the tab open).

- Draw one line in front of the billboard; each tracked vehicle is counted once when it crosses; by type (car, bus, truck, motorcycle) and direction; per minute and per hour; a log per billboard; CSV. The video stays in the browser.
- From banner.json: **185 vs 189** vehicles on 2 sample clips, YOLO26s in the browser (5 frames a second) against our offline YOLO26m pipeline (1280 px, 10 frames a second), 97.9%. C3896 (midday, 5:40): 130 against 130; C3905 (dusk, 2:08): 55 against 59.
- Two models agreeing, not a hand count (`handCount` is null). A hand count is still to do.
- Who pays: outdoor advertising companies.

## 9. Next: the same cameras time the lights (Aziza, 4:50 to 5:20)

- Signal audit (/audit, measured): replay departure error 0.29 to 0.55 s on 3 of 4 clips; C3905 too short, fails (4.54 s). Webster's textbook plan worse than the timing now on 4 of 4 clips (29.7 s against 10.0 s on C3897).
- Green wave (/network, simulation): Amir Temur Avenue, 1.46 km, 5 signals, 224 vehicles in 10 min; mean delay 141 s → 24 s; stops per vehicle 4.58 → 0.60.
- Road damage (/roads, measured): YOLOv8n fine-tuned on RDD2022, mAP50 0.66, precision 66%, on a 300-image sample of the test split.

## 10. Who pays, and the pilot (Amal, 5:20 to 6:25)

All numbers are assumptions to check with the customer.

- **Car park operators:** free spaces now and on arrival; price per camera per month, set in the pilot; value a month = extra spaces filled × hours × tariff, plus drivers no longer turned away at the gate.
- **The city:** a district view from its cameras, less searching traffic counted in vehicle-km; later the signal audit and green wave.
- **Outdoor advertising:** vehicles past each billboard by type, direction and hour; price per billboard per month, set in the pilot.
- Pilot 3 months with one operator on its own cameras. People: 3 engineers part time, the main cost. Hosting: static, free to USD 20 a month, no GPU server. No sensors in the ground. Payback = price ÷ value a month, stated from the pilot inputs, not before.

## 11. Team PariVision (Amal, 6:25 to 7:00)

- Amal Karimov: captain; scene layout and the signal and vehicle rules. Komronbek Qodirov: pipeline, live demo and website. Aziza Adizova: dev set, pedestrian rules and report.
- Our ask: a 3-month pilot with one car park operator on its own cameras; one outdoor advertising company to test the billboard counter; frames from live cameras in Tashkent.
- Next steps: a night test set of our own (PKLot has no night frames); a hand count for the billboard counter; then the signals.
- Thank you. Questions?

---

## Backup for questions (slides 12 to 17)

- **B1 (12). Accuracy, and how each number was measured.** A table: what, checked on, result, how fair the check is (green held out, grey checked but not held out, amber picked on the same data or two models agreeing). Rows: /parking held out, by weather, tracker, forecast, whole car park, spaces from a photo, billboard counter, signal audit replay, road damage (its model card: mAP50 0.588 on the full split).
- **B2 (13). What is measured, and what is simulated.** Measured: PKLot frames and labels, 22 Hong Kong cameras and 28 car parks, the audit tracks, the billboard counts, the road damage test. Simulated or assumed: the /city drivers, the /tracker trip times (6 + 2, 8 + 4, 9 + 5 min) and the 40 drivers, the /network traffic, the daily figure on /banner, the predictive mode, all business numbers.
- **B3 (14). Privacy, night, rain and other limits.** No plates or faces; photos and videos stay in the browser; a car park publishes counts only. Night not measured; rain 96.1% on 62 rainy held-out images (cloudy 99.0%, sunny 97.0%); far rows PUCPR 96.1% against UFPR04 99.6% and UFPR05 99.3%; Hong Kong counts are a lower bound; long queues and moving cameras.
- **B4 (15). Cost and speed.** 10 MB YOLO26n, 38 MB YOLO26s, 0 GPU servers, hosting USD 0 to 20 a month (assumption). About 1 minute of processing per minute of 1080p video on our M5 laptop with WebGPU (README); 5 frames a second; 10 detector runs per photo, more on an uploaded one.
- **B5 (16). How it scales to Tashkent.** 13,208 Poytaxt Parking spaces on 86 streets; about 1,000 signalised junctions, 125 on adaptive control, 545 planned for 2026; 309 signalised junctions and 519 km of road of central Tashkent already in the app (tashkent_roads.json). What a new car park needs; SFpark and Copenhagen as evidence (sources on /elsewhere).
- **B6 (17). Reused from the elimination, built in the final.** As in the README.

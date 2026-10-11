# OQIM defence deck: slide text and speaker notes

7 minutes, hard stop. Split: title and problem 1:00, live demo (tracker, accuracy, district) 2:50, how it works 0:40, business 1:00, next stage 0:50, team 0:30.
Slide text is in English; the notes under each slide are for the speaker.

The deck is built by `deck/build.js`. It reads its numbers from `app/public/data/` (tracker.json, parking.json, audits.json, hongkong.json, hk_carparks.json, roads_eval.json, team.json). The numbers below are the ones in those files when this was written; if a file changes, rebuild the deck and update this page.

---

## 1. OQIM. A parking tracker from car park cameras (0:10)

- Mode: **Startup**
- Team PariVision, Webster University in Tashkent: Amal Karimov, Komronbek Qodirov, Aziza Adizova
- Live: https://oqim-audit.vercel.app/tracker · Code: https://github.com/baytoooo/oqim
- Picture: the PUCPR car park camera at 09:04 on 17 October 2012 (PKLot), 6 free of 100 spaces as our detector read it.

Notes: say the mode out loud on this slide, the rules ask for it. OQIM is a parking tracker: cameras over a car park count the free spaces, see cars come in and leave, forecast the free spaces for the minute you arrive, and tell each driver which car park to go to.

---

## 2. The problem (0:50)

- A driver picks a car park by distance or habit, and learns it is full at the gate.
- Then they drive on to the next one. While searching, the car is part of the traffic.
- A navigator sends every driver to the same nearest car park.
- **17 hours** a year a US driver spends searching for parking ([INRIX, 2017](https://inrix.com/press-releases/parking-pain-us/)).
- **About 5%** of off-street car parks publish live free spaces ([Parkopedia](https://business.parkopedia.com/blog/parking-availability-how-predictive-and-responsive-data-work-together-to-provide-drivers-with-the-best-possible-parking-experience)).
- **Tashkent:** Poytaxt Parking plans paid parking on 86 streets with 13,208 spaces, first come, first served ([Spot.uz](https://www.spot.uz/ru/2025/05/06/poytaxt-parking)).
- Where drivers are shown the space, it works: SFpark cut cruising for parking by 50% on its pilot blocks ([ACCESS](https://accessmagazine.org/fall-2016/cruising-for-parking-lessons-from-san-francisco/)).

**User:** drivers going to busy places (malls, business centres, hospitals, stations).
**Who pays:** car park operators, and the city, which wants less searching traffic.

---

## 3. Live demo: the tracker (1:40)

https://oqim-audit.vercel.app/tracker

- 3 PKLot cameras, one morning each, 06:55 to 10:35, a frame every 5 minutes: PUCPR (100 spaces, 2012-10-17), UFPR05 (40 spaces, 2013-03-22), UFPR04 (28 spaces, 2013-01-18).
- **98.8%** of space readings right: 112 frames, 6,844 readings, against the dataset's hand labels.
- Free count off by a median of **1** space, **4** at the 90th percentile.
- Forecast 10 minutes ahead: off by **3.0** spaces on average, against **4.6** for "same as now" (101 forecasts).
- Cars seen: **146 in, 11 out**.

Notes: press play. Every space is marked free or taken from the frame; a space that turns taken is a car coming in, one that turns free is a car leaving. Then pick an arrival time and show which car park the tracker advises. Say clearly: these are recorded mornings of a public dataset, not a live feed yet.

---

## 4. Measured: space detection (/parking) (0:30)

https://oqim-audit.vercel.app/parking

- **97.4%** of 13,447 spaces right on 240 held-out PKLot images.
- Precision for taken 99.1%, recall for taken 95.3%.
- By weather: sunny 97.0%, cloudy 99.0%, rainy 96.1%.
- Free count per image off by a median of 0, 4 at the 90th percentile.
- Rule: a space is taken when one car, bus or truck box with confidence above 0.05 covers at least 40% of the space's area; the detector runs on the whole frame and on 3 x 3 overlapping tiles.
- Not measured: night. PKLot has no night frames.

Notes: these images were not used to tune the rule. It runs in the browser on /parking, with YOLO26n, the same model as the tracker.

---

## 5. Live demo: a district, Kwun Tong, Hong Kong (0:40)

https://oqim-audit.vercel.app/city

- 22 Transport Department traffic cameras (open data, DATA.GOV.HK), counted by YOLO26m; live vacancy of the car parks around the destination (28 in the stored file).
- 60 drivers heading to Kwun Tong MTR station (simulated, seeded). "Nearest": every driver to the closest car park, as a navigator does. "OQIM": drivers placed one by one; each gets the car park and route of least door-to-door time, given the roads and spaces already taken by the drivers placed before.
- At 13:45 Hong Kong time on 11 October: the nearest car park had 0 free spaces, so all 60 "nearest" drivers arrived to a full car park; with OQIM 5 did. Door to door 15.5 min against 12.7 min (minus 18%), vehicle-km with searching 305 against 181 (minus 41%).

Notes: the drivers are simulated, the free spaces and the camera counts are real, and both strategies are judged by the same model (BPR travel times, 8 minutes of searching at a full car park). The "Add drivers one by one" button shows each new route loading the roads the next driver sees.

---

## 6. How it works (technology, 0:40)

For each car park camera:

1. **Frames:** one frame every 5 minutes from an ordinary fixed camera. The spaces are outlined once per camera.
2. **Detect:** YOLO26n (10 MB), whole frame plus 3 x 3 tiles at 960 px; cars, buses and trucks.
3. **Space state:** taken when one box covers 40% of the space; it changes only when two frames in a row agree.
4. **Forecast:** spaces taken now, plus the trend: the mean of the last 20 minutes' slope and the typical-day slope of the same car park (PKLot labels of its other weekdays). Checked against the hand labels of the frame that many minutes later.
5. **Advise:** drivers placed one by one on the car park and route of least door-to-door time, counting the drivers already sent (the district model).

The detector runs in ONNX Runtime Web (WebGPU or WebAssembly). No GPU server. No number plates or faces are read.
Reused, declared: the detector and ONNX worker from our elimination system. Built for the final: the tracker, the space rule and its test, the district model, the signal audit.

---

## 7. Budget and ROI (0:45)

All numbers are assumptions to be checked with the customer.

**Pilot, 3 months, with one car park operator, on cameras it already has**
- People: 3 engineers part time (main cost).
- Hosting: static, free to USD 20 a month. No GPU server.
- Data: frames from the operator's own cameras; no data licences to buy.

**Per camera**
- No sensors in the ground: one camera covers the spaces it sees.
- Our cost: outlining the spaces once, and checking a sample of frames by hand.
- Price: per camera per month, set in the pilot.

**Value and payback**
- Value a month = extra spaces filled × hours × tariff, plus drivers no longer turned away at the gate.
- Payback = price ÷ value a month. We state it from the pilot inputs, not before.
- For the city: less searching traffic, which the district model counts in vehicle-km.

---

## 8. Why it is hard to copy (0:15)

- **A forecast, not only a count:** free spaces for the minute you arrive, checked against "same as now" (3.0 against 4.6 spaces off, 10 minutes ahead).
- **Drivers spread, not herded:** each driver counts against the spaces and roads of the next.
- **Ordinary cameras:** no sensor per space; the detector runs in a browser tab; no plates or faces read.
- **The same cameras, more products:** our signal audit reads traffic lights from pixels with no controller access. In the browser it agrees with our elimination lamp reader on 98.8% of frames of C3896.

---

## 9. Next stage: the same cameras can later time the lights (/audit) (0:30)

Signal audit from one video: the lights read from pixels, every vehicle over the stop line, then signal plans checked on a replay of the junction's own vehicles. Four clips of one Tashkent junction (the organisers' footage, 18 minutes), southbound approach:

| Clip | Length | Cycle read | Vehicles | Replay check: median departure error | Wait now | Webster (1958) | OQIM predictive |
|---|---|---|---|---|---|---|---|
| C3896 | 5:40 | 75 s | 130 | 0.50 s | 9.3 s | 32.6 s | 9.1 s |
| C3897 | 5:18 | 75 s | 127 | 0.29 s | 10.0 s | 29.7 s | 8.7 s |
| C3902 | 5:18 | 80 s | 170 | 0.55 s | 12.3 s | 28.8 s | 10.1 s |
| C3905 | 2:08 | 80 s | 59 | 4.54 s | 10.3 s | 11.9 s | 7.3 s |

- Webster's textbook plan was worse than the current timing on all four clips (29.7 s against 10.0 s on C3897). So OQIM never recommends a plan before it replays it.
- Predictive assumes the next 30 s of arrivals are known, which needs a camera upstream.
- C3905 is under 2 cycles and fails the replay check; the page says so.
- Tracks: our elimination pipeline (YOLO26m at 1280 px, 10 fps). Night and rain not yet measured on a test set of our own.

---

## 10. Next stage: a green wave in 3D, and road damage on a map (0:20)

- https://oqim-audit.vercel.app/network: Amir Temur Avenue northbound, 1.46 km, 5 signals, 224 vehicles in 10 minutes (simulation, Intelligent Driver Model, one direction; only the offsets change, the real offsets are unknown to us). Mean delay at the signals 141 s to 24 s; stops per vehicle 4.58 to 0.60.
- https://oqim-audit.vercel.app/roads, a side tool: YOLOv8n fine-tuned on RDD2022, in the browser, mAP50 0.66 and precision 66% on a 300-image sample of the RDD2022 test split.
- Elsewhere: Copenhagen's green wave cut travel time by 17% ([Centre for Public Impact](https://www.centreforpublicimpact.org/case-study/green-waves-bicycles-copenhagen)); Google Project Green Light, up to 30% fewer stops ([Seattle DOT](https://sdotblog.seattle.gov/2024/01/04/project-green-light)).

---

## 11. Team and next steps (0:30)

- Amal Karimov: captain; scene layout and the signal and vehicle rules.
- Komronbek Qodirov: pipeline, live demo and website.
- Aziza Adizova: dev set, pedestrian rules and report.

Next steps:
1. Pilot: one car park operator, its own cameras, 3 months.
2. Live feed: frames from a live camera, not a recorded morning.
3. Night test: PKLot has no night frames; a test set of our own, with hand labels.
4. Signals: then the same cameras time the lights, with the audit and the green wave.

Thank you. Questions?

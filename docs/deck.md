# OQIM defence deck: slide text and speaker notes

7 minutes, hard stop. Split: problem 1:00, live demo 2:00, technology 2:00, budget and ROI 1:30, next steps 0:30.
Slide text is in English; the notes under each slide are for the speaker.

---

## 1. OQIM. A traffic signal audit from one video

- Mode: **Startup**
- Team PariVision, Webster University in Tashkent: Amal Karimov, Komronbek Qodirov, Aziza Adizova
- Live: https://oqim.vercel.app · Code: https://github.com/baytoooo/oqim

Notes: say the mode out loud on this slide, the rules ask for it.

---

## 2. The problem (1:00)

- Signal timing at a junction is set once and rarely checked against today's traffic.
- Checking it today means a manual study: people at the roadside counting vehicles, then an engineer's calculation.
- Most controllers are not connected, so their timing cannot be read from a central system.
- US cities measure signal performance (arrivals on green, split failures) from controller logs (ATSPM). Here those logs are not available.

**User:** the traffic engineer of the city's traffic management service, and the contractors who do junction studies for it.
**Who pays:** the city (studies are already bought), road-safety and transport projects.

---

## 3. Live demo (2:00)

1. Open https://oqim.vercel.app/audit on the jury's laptop or phone.
2. Take the jury's video (or a sample). Draw the stop line (2 clicks), click the signal head.
3. Run. A 2-minute clip takes about 25 s on a laptop GPU; the video never leaves the device.
4. Show: the lights read from the head, every crossing as a tick, the queue line, the plans table, the model check line.

Notes: if the jury's video has no signal head in view, leave the head unset; OQIM reads the lights from the traffic. Backup: the recorded run of C3896.

---

## 4. How it works (technology, 1:00)

Browser only. Inference on the user's device (WebGPU, or WebAssembly on the CPU).

1. **Detect and track:** YOLO26s (ONNX Runtime Web), ByteTrack port, 5 frames per second. Reused from our elimination system.
2. **Read the lights:** colour contrast of the lit lamp inside the head's box, scaled per clip; if no head is visible, greens come from when the queue moves off.
3. **Measure:** stop-line crossings by side, time stood before the line, arrivals on green, discharge rate (busiest 10 s of each green), red-light runs, queue.
4. **Replay:** a point-queue model runs the clip's own vehicles through the junction. It must first reproduce the measured crossings.
5. **Plans:** now, Webster (1958), a fixed plan searched on the replay (cycle, split and the phases out of view), actuated, max-pressure (Varaiya 2013), and OQIM predictive (rollout over the next 30 s of arrivals).
6. **Corridor:** the same vehicles on up to five real junctions of Tashkent in 3D, with a green wave.

---

## 5. Measured on our clips (technology, 1:00)

Four clips of one Tashkent junction (the organisers' footage, 18 minutes), southbound approach:

| Clip | Length | Cycle read | Vehicles | Model check: median departure error | Wait: model / measured |
|---|---|---|---|---|---|
| C3896 | 5:40 | 75 s | 130 | 0.50 s | 9.3 / 12.8 s |
| C3897 | 5:18 | 75 s | 127 | 0.09 s | 10.0 / 10.4 s |
| C3902 | 5:18 | 80 s | 170 | 0.57 s | 13.1 / 12.0 s |
| C3905 | 2:08 | 80 s | 59 | 5.04 s | 11.5 / 6.6 s |

- Webster's textbook plan was **worse** than the current timing on all four clips (for example 13.5 s against 10.0 s on C3897). That is why OQIM never recommends a plan before replaying it on the junction's own vehicles.
- The current timing of this approach is close to the best fixed plan we found; the predictive mode cut the mean wait by 17% on C3897 (10.0 to 8.3 s) and changed little on the others.
- Known failure cases: short clips (under 2 cycles, see C3905), long queues where tracks break, a stop line drawn over two directions, free right turns counted as red crossings, night and rain not yet measured on a test set of our own.

Source: these numbers were computed with the elimination pipeline's tracks (YOLO26m at 1280 px, 10 fps); the browser runs YOLO26s at 5 fps. Re-run in the browser before the defence and update if they differ.

---

## 5b. From one junction to a corridor (simulation, 0:30 inside the demo)

https://oqim-audit.vercel.app/network: pick up to five signalised junctions of Tashkent on the map (OpenStreetMap road graph, 309 signalised junctions in the centre); the vehicles measured on the video drive them in 3D, two junctions before the audited one and two after.

Sample corridor, Amir Temur Avenue northbound, 1.46 km, 5 signals, 3 lanes (from the discharge rate on the video), 224 vehicles in 10 minutes:

| | Timing now (offsets unknown, taken pseudo-random) | OQIM green wave (same cycle and green) |
|---|---|---|
| Mean delay at the signals | 141 s | 24 s |
| Stops per vehicle | 4.58 | 0.60 |

Say clearly: this is a simulation (Intelligent Driver Model), one direction, cross streets not simulated; only the offsets change, so the cross streets keep their time. The real offsets of these junctions are unknown to us.

---

## 6. Why it is hard to copy

- **Reading the lights from pixels**, with no controller access: our elimination work (signal reader, registration, rules, 98 labelled events) made this possible in a day.
- **The replay check:** plans are judged on the junction's own vehicles, and the model must reproduce the measured crossings first.
- **Runs in the browser:** no server, no GPU bill, the video stays on the device (Uzbekistan's personal data law asks for local storage of personal data; we store none).
- Domain knowledge: Webster's method, saturation flow, ATSPM measures.

---

## 7. Budget and ROI (1:30)

All numbers are assumptions to be checked with the customer.

**Pilot, 3 months, 20 junctions in Tashkent with the city's traffic management service**
- People: 3 engineers part time (main cost).
- Infrastructure: static hosting (free to USD 20 a month). No GPU server: inference runs on the user's laptop.
- Data: videos the service already records or films for us; no data licences to buy.

**Unit economics, per junction audit**
- Our cost: an engineer's 30 minutes to film and check; compute is zero.
- Price: below the cost of a manual study of the same junction (assumption: price per audit set after the pilot).
- Value to the city: the page turns saved vehicle-hours into money with inputs the engineer sets (hours a day at this traffic, value of an hour, fuel while idling at 0.8 litres an hour, 2.31 kg CO2 a litre).

**Payback:** state it from the pilot inputs; do not quote a number we have not measured.

---

## 8. Next steps (0:30)

- Pilot with the traffic management service: 20 junctions, their videos, their engineer marks the lines.
- Test set of our own at night and in rain, with manual counts.
- Network: link neighbouring junctions (the predictive mode needs the camera upstream) and offsets for green waves.
- Export a timing sheet the engineer can enter into the controller.

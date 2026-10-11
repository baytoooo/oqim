// OQIM defence deck, team PariVision, WIUT Hackathon 2026, Computer Vision final.
// Run from this folder: node build.js   (writes OQIM_defence.pptx)
// Numbers come only from ../docs/deck.md, ../README.md and ../app/public/data/audits.json.
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require("./apply_theme.js");
const audits = require("../app/public/data/audits.json");

const OUT = path.join(__dirname, "OQIM_defence.pptx");
const IMG = (f) => path.join(__dirname, "img", f);
const MEDIA = (f) => path.join(__dirname, "..", "app", "public", "media", f);

const THEME = {
  name: "OQIM Signal",
  headFontFace: "Arial",
  bodyFontFace: "Calibri",
  colors: {
    dk1: "F1EEE6", // text on the dark page
    lt1: "151618", // page
    dk2: "A9A59C", // muted text
    lt2: "1C1E21", // panels
    accent1: "F3C316", // yellow
    accent2: "FF5B4C", // signal red
    accent3: "FFB224", // amber
    accent4: "3FD27F", // green
    accent5: "2A2D31", // panel edge, table header
    accent6: "6E737B", // grey
    hlink: "F3C316",
    folHlink: "FFB224",
  },
};
const HEX = THEME.colors;

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5 in
pres.title = "OQIM: a traffic signal audit from one video";
pres.author = "Team PariVision";
pres.company = "Webster University in Tashkent";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const S = pres.shapes;

const W = 13.333;
const M = 0.6;
const CW = W - 2 * M;

// ---------- motif: a signal head with three lamps ----------
function addLamps(slide, x, y, d, name) {
  const pad = d * 0.5;
  const gap = d * 0.45;
  const w = pad * 2 + d * 3 + gap * 2;
  const h = d + pad * 0.9 * 2;
  slide.addShape(S.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: h / 2, fill: { color: C.background2 }, line: { color: C.accent5, width: 0.75 }, objectName: name + " housing" });
  [C.accent2, C.accent3, C.accent4].forEach((c, i) => {
    slide.addShape(S.OVAL, { x: x + pad + i * (d + gap), y: y + (h - d) / 2, w: d, h: d, fill: { color: c }, line: { type: "none" }, objectName: `${name} lamp ${i + 1}` });
  });
  return { w, h };
}
function lamp(slide, x, y, d, color, name, label) {
  if (label) {
    slide.addText(label, { shape: S.OVAL, x, y, w: d, h: d, fill: { color }, line: { type: "none" }, fontFace: "Arial", bold: true, fontSize: Math.round(d * 36), color: C.background1, align: "center", valign: "middle", margin: 0, objectName: name });
  } else {
    slide.addShape(S.OVAL, { x, y, w: d, h: d, fill: { color }, line: { type: "none" }, objectName: name });
  }
}

// ---------- layouts ----------
const FOOTER = "OQIM  ·  Team PariVision  ·  WIUT Hackathon 2026, Computer Vision final  ·  Mode: Startup";

pres.defineSlideMaster({
  title: "OQIM Title",
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "kicker", type: "body", x: M + 1.0, y: 0.72, w: 8, h: 0.4, fontFace: "Arial", fontSize: 13, bold: true, color: C.accent1, charSpacing: 3, valign: "middle", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 1.3, w: 6.0, h: 1.55, fontFace: "Arial", fontSize: 96, bold: true, color: C.text1, align: "left", valign: "middle", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "subtitle", type: "body", x: M, y: 2.9, w: 6.0, h: 1.0, fontFace: "Arial", fontSize: 26, bold: true, color: C.text1, align: "left", valign: "top", margin: 0 }, text: "" } },
  ],
});

pres.defineSlideMaster({
  title: "OQIM Content",
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "kicker", type: "body", x: M + 0.98, y: 0.34, w: 9.5, h: 0.34, fontFace: "Arial", fontSize: 12, bold: true, color: C.accent1, charSpacing: 3, valign: "middle", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.78, w: CW, h: 0.8, fontFace: "Arial", fontSize: 36, bold: true, color: C.text1, align: "left", valign: "middle", margin: 0 }, text: "" } },
    { text: { text: FOOTER, options: { x: M, y: 7.0, w: 9.5, h: 0.3, fontFace: "Calibri", fontSize: 10, color: C.text2, margin: 0, valign: "middle" } } },
  ],
  slideNumber: { x: W - M - 0.8, y: 7.0, w: 0.8, h: 0.3, fontFace: "Calibri", fontSize: 10, color: HEX.dk2, align: "right" },
});

// helper: every slide adds the lamp housing itself (layout shapes cannot be rounded pills reliably)
function header(slide) {
  addLamps(slide, M, 0.35, 0.16, "Signal lamps");
}

// helper: panel
function panel(slide, x, y, w, h, name, fill) {
  slide.addShape(S.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill || C.background2 }, line: { color: C.accent5, width: 0.75 }, objectName: name });
}
// helper: big stat with label
function stat(slide, x, y, w, value, label, opts = {}) {
  const vs = opts.size || 44;
  const vh = opts.vh || vs / 72 + 0.12;
  slide.addText(value, { x, y, w, h: vh, fontFace: "Arial", bold: true, fontSize: vs, color: opts.color || C.accent1, margin: 0, valign: "bottom", isTextBox: true, fit: "none", objectName: (opts.name || "Stat") + " value" });
  slide.addText(label, { x, y: y + vh + 0.06, w, h: opts.lh || 0.6, fontFace: "Calibri", fontSize: opts.ls || 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: (opts.name || "Stat") + " label" });
}

// ---------- slide 1: title ----------
pres.addSection({ title: "Opening" });
{
  const s = pres.addSlide({ masterName: "OQIM Title", sectionTitle: "Opening" });
  addLamps(s, M, 0.75, 0.2, "Signal lamps");
  s.addText("WIUT HACKATHON 2026  ·  COMPUTER VISION FINAL", { placeholder: "kicker" });
  s.addText("OQIM", { placeholder: "title" });
  s.addText([{ text: "A traffic signal audit", options: { breakLine: true } }, { text: "from one video" }], { placeholder: "subtitle" });

  s.addText("MODE: STARTUP", { shape: S.ROUNDED_RECTANGLE, x: M, y: 4.05, w: 3.0, h: 0.62, rectRadius: 0.12, fill: { color: C.accent1 }, line: { type: "none" }, fontFace: "Arial", bold: true, fontSize: 22, color: C.background1, align: "center", valign: "middle", charSpacing: 2, margin: 0, objectName: "Mode badge" });

  s.addText(
    [
      { text: "Team PariVision", options: { bold: true, fontSize: 18, color: C.text1, breakLine: true } },
      { text: "Amal Karimov, Komronbek Qodirov, Aziza Adizova", options: { fontSize: 16, color: C.text1, breakLine: true } },
      { text: "Webster University in Tashkent", options: { fontSize: 16, color: C.text2 } },
    ],
    { x: M, y: 4.95, w: 6.0, h: 1.05, fontFace: "Calibri", margin: 0, valign: "top", paraSpaceAfter: 2, isTextBox: true, objectName: "Team" }
  );
  s.addText(
    [
      { text: "Live   ", options: { color: C.text2 } },
      { text: "https://oqim-audit.vercel.app", options: { color: C.accent1, hyperlink: { url: "https://oqim-audit.vercel.app" }, breakLine: true } },
      { text: "Code   ", options: { color: C.text2 } },
      { text: "https://github.com/baytoooo/oqim", options: { color: C.accent1, hyperlink: { url: "https://github.com/baytoooo/oqim" } } },
    ],
    { x: M, y: 6.15, w: 6.0, h: 0.7, fontFace: "Calibri", fontSize: 15, margin: 0, valign: "top", paraSpaceAfter: 4, isTextBox: true, objectName: "Links" }
  );

  panel(s, 6.85, 1.25, 5.88, 3.43, "Frame panel");
  s.addImage({ path: IMG("c3896_frame.jpg"), x: 6.92, y: 1.32, w: 5.74, h: 3.29, sizing: { type: "cover", w: 5.74, h: 3.29 }, altText: "Camera frame of the Tashkent junction, clip C3896", objectName: "Junction frame" });
  s.addText("A real frame of the Tashkent junction (organisers' footage, clip C3896), with detections from our elimination-stage system.", { x: 6.85, y: 4.8, w: 5.88, h: 0.55, fontFace: "Calibri", fontSize: 11, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: "Frame caption" });

  const c96 = audits.clips.find((c) => c.clip === "C3896");
  ["C3896", `cycle ${Math.round(c96.cycle)}\u00A0s`, `${c96.approaches[0].vehicles} vehicles southbound`].forEach((t, i) => {
    const widths = [1.0, 1.35, 2.6];
    const x = 6.85 + widths.slice(0, i).reduce((a, b) => a + b + 0.15, 0);
    s.addText(t, { shape: S.ROUNDED_RECTANGLE, x, y: 5.55, w: widths[i], h: 0.42, rectRadius: 0.06, fill: { color: C.background2 }, line: { color: C.accent5, width: 0.75 }, fontFace: "Arial", bold: true, fontSize: 13, color: i === 0 ? C.accent1 : C.text1, align: "center", valign: "middle", margin: 0, objectName: `Frame chip ${i + 1}` });
  });

  s.addNotes(
    "0:10. Good morning. We are team PariVision from Webster University in Tashkent. Our mode is Startup (say it out loud, the rules ask for it). OQIM is a traffic signal audit from one video."
  );
}

// ---------- slide 2: problem and user ----------
pres.addSection({ title: "Problem" });
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Problem" });
  header(s);
  s.addText("PROBLEM AND USER", { placeholder: "kicker" });
  s.addText("Signal timing is rarely checked", { placeholder: "title" });

  const cw = (CW - 2 * 0.3) / 3;
  const stats = [
    ["~1,000", "signalised junctions in Tashkent", C.accent1],
    ["125", "connected to TsODD's adaptive system", C.accent4],
    ["545", "planned to be connected in 2026", C.accent3],
  ];
  stats.forEach(([v, l, col], i) => {
    const x = M + i * (cw + 0.3);
    panel(s, x, 1.85, cw, 1.6, `Stat card ${i + 1}`);
    stat(s, x + 0.3, 1.97, cw - 0.6, v, l, { size: 48, color: col, lh: 0.4, name: `Stat ${i + 1}` });
  });
  s.addText(
    [
      { text: "Presidential decree of 4 December 2025 on congestion. No measured results published so far.  ", options: { color: C.text1 } },
      { text: "Sources: Anhor.uz, Yuz.uz", options: { color: C.text2 } },
    ],
    { x: M, y: 3.58, w: CW, h: 0.35, fontFace: "Calibri", fontSize: 14, margin: 0, valign: "middle", isTextBox: true, objectName: "Decree line" }
  );

  // lower panels
  const lw = 6.9;
  panel(s, M, 4.15, lw, 2.6, "Why panel");
  s.addText("How a junction is checked today", { x: M + 0.3, y: 4.3, w: lw - 0.6, h: 0.4, fontFace: "Arial", bold: true, fontSize: 18, color: C.text1, margin: 0, isTextBox: true, objectName: "Why heading" });
  s.addText(
    [
      { text: "A manual study: people at the roadside count vehicles, then an engineer calculates.", options: { bullet: { indent: 16 }, breakLine: true } },
      { text: "Most controllers are not connected, so their timing cannot be read centrally.", options: { bullet: { indent: 16 }, breakLine: true } },
      { text: "US cities measure arrivals on green and split failures from controller logs (ATSPM). Here those logs are not available.", options: { bullet: { indent: 16 } } },
    ],
    { x: M + 0.3, y: 4.78, w: lw - 0.6, h: 1.85, fontFace: "Calibri", fontSize: 15, color: C.text1, margin: 0, valign: "top", paraSpaceAfter: 6, isTextBox: true, objectName: "Why bullets" }
  );

  const ux = M + lw + 0.3;
  const uw = CW - lw - 0.3;
  panel(s, ux, 4.15, uw, 2.6, "User panel");
  lamp(s, ux + 0.3, 4.36, 0.22, C.accent4, "User lamp");
  s.addText("The user", { x: ux + 0.65, y: 4.3, w: uw - 1, h: 0.36, fontFace: "Arial", bold: true, fontSize: 18, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: "User heading" });
  s.addText(
    [
      { text: "TsODD's traffic engineer, and the contractors who do junction studies for it.", options: { breakLine: true } },
      { text: "Who pays: ", options: { bold: true, color: C.accent1 } },
      { text: "the city, which already buys studies; road-safety and transport projects." },
    ],
    { x: ux + 0.3, y: 4.78, w: uw - 0.6, h: 1.85, fontFace: "Calibri", fontSize: 15, color: C.text1, margin: 0, valign: "top", paraSpaceAfter: 8, isTextBox: true, objectName: "User text" }
  );

  s.addNotes(
    "0:50. Tashkent has about 1,000 signalised junctions. 125 are connected to TsODD's adaptive system and 545 are planned for 2026, after the presidential decree of 4 December 2025. No measured results have been published. Today a junction is checked by a manual study: people count at the roadside, then an engineer calculates. Most controllers are not connected, so their timing cannot be read centrally. US cities measure this from controller logs (ATSPM); we do not have those logs. Our user is TsODD's traffic engineer and the contractors who do junction studies. The city pays: it already buys studies."
  );
}

// ---------- slide 3: product in one picture ----------
pres.addSection({ title: "Product and demo" });
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Product and demo" });
  header(s);
  s.addText("THE PRODUCT IN ONE PICTURE", { placeholder: "kicker" });
  s.addText("One video in, a checked plan out", { placeholder: "title" });

  const steps = [
    ["Video in", "A clip of the junction. Draw the stop line, click the signal head."],
    ["Lights from pixels", "The lit lamp inside the head's box. No controller access needed."],
    ["Measure", "Crossings by side, waits before the line, arrivals on green, discharge, red-light runs, queue."],
    ["Replay check", "The clip's own vehicles run through a queue model. It must give back the measured crossings."],
    ["Report out", "Six plans checked on the replay, traffic events, and a Purdue coordination diagram from video."],
  ];
  const gap = 0.36;
  const cw = (CW - 4 * gap) / 5;
  const y = 1.95;
  const h = 3.25;
  const lampCols = [C.accent2, C.accent3, C.accent4, C.accent3, C.accent4];
  steps.forEach(([t, d], i) => {
    const x = M + i * (cw + gap);
    panel(s, x, y, cw, h, `Step ${i + 1} card`);
    lamp(s, x + 0.25, y + 0.25, 0.5, lampCols[i], `Step ${i + 1} lamp`, String(i + 1));
    s.addText(t, { x: x + 0.25, y: y + 0.9, w: cw - 0.4, h: 0.65, fontFace: "Arial", bold: true, fontSize: 17, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: `Step ${i + 1} title` });
    s.addText(d, { x: x + 0.25, y: y + 1.55, w: cw - 0.4, h: h - 1.7, fontFace: "Calibri", fontSize: 15, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: `Step ${i + 1} text` });
    if (i < 4) {
      s.addShape(S.ISOSCELES_TRIANGLE, { x: x + cw + gap / 2 - 0.07, y: y + h / 2 - 0.09, w: 0.18, h: 0.14, rotate: 90, fill: { color: C.accent1 }, line: { type: "none" }, objectName: `Arrow ${i + 1}` });
    }
  });

  panel(s, M, 5.55, CW, 1.15, "Device banner");
  lamp(s, M + 0.3, 5.88, 0.48, C.accent4, "Device lamp");
  s.addText(
    [
      { text: "Runs on the user's device. ", options: { bold: true, color: C.text1, fontFace: "Arial", fontSize: 20 } },
      { text: "The video is never uploaded. No number plates or faces are read.", options: { color: C.text1, fontSize: 18 } },
    ],
    { x: M + 1.0, y: 5.6, w: CW - 1.3, h: 1.05, fontFace: "Calibri", margin: 0, valign: "middle", isTextBox: true, objectName: "Device text" }
  );

  s.addNotes(
    "0:20. This is the whole product. Video in. OQIM reads the lights from the pixels, then counts crossings, waits and discharge. It replays the clip's own vehicles and checks that the replay gives back what it measured. Only then does it compare plans. All of it runs on the user's device; the video is never uploaded."
  );
}

// ---------- slide 4: live demo ----------
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Product and demo" });
  header(s);
  s.addText("LIVE DEMO", { placeholder: "kicker" });
  s.addText("Live demo: five pages", { placeholder: "title" });

  const iw = 7.0;
  const ih = iw / 1.6;
  panel(s, M, 1.85, iw + 0.14, ih + 0.14, "Screenshot panel");
  s.addImage({ path: IMG("home.png"), x: M + 0.07, y: 1.92, w: iw, h: ih, altText: "OQIM home page", objectName: "Home screenshot" });
  s.addText(
    [
      { text: "https://oqim-audit.vercel.app", options: { color: C.accent1, hyperlink: { url: "https://oqim-audit.vercel.app" } } },
      { text: "   Backup: the recorded run of C3896.", options: { color: C.text2 } },
    ],
    { x: M, y: 6.4, w: iw + 0.14, h: 0.35, fontFace: "Calibri", fontSize: 14, margin: 0, valign: "middle", isTextBox: true, objectName: "Demo link" }
  );

  const rx = M + iw + 0.5;
  const rw = W - M - rx;
  const pages = [
    ["/audit", "The jury's video: stop line, signal head, run.", C.accent2],
    ["/network", "Five real junctions of Tashkent, in 3D.", C.accent3],
    ["/city", "Kwun Tong: cameras and car park spaces.", C.accent4],
    ["/parking", "Car park spaces from camera frames.", C.accent3],
    ["/roads", "Road damage from phone photos, on a map.", C.accent1],
  ];
  const rgap = 0.1;
  const rh = (ih + 0.14 - 4 * rgap) / 5;
  pages.forEach(([p, d, col], i) => {
    const y = 1.85 + i * (rh + rgap);
    panel(s, rx, y, rw, rh, `Page ${i + 1} card`);
    lamp(s, rx + 0.22, y + 0.14, 0.2, col, `Page ${i + 1} lamp`);
    s.addText(p, { x: rx + 0.55, y: y + 0.07, w: rw - 0.75, h: 0.32, fontFace: "Arial", bold: true, fontSize: 16, color: C.accent1, margin: 0, valign: "middle", isTextBox: true, objectName: `Page ${i + 1} path` });
    s.addText(d, { x: rx + 0.55, y: y + 0.4, w: rw - 0.75, h: 0.34, fontFace: "Calibri", fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: `Page ${i + 1} text` });
  });

  s.addNotes(
    "1:40, live. Open https://oqim-audit.vercel.app/audit on the jury's laptop or phone. Take the jury's video, or a sample. Draw the stop line (2 clicks), click the signal head. Run. Show: the lights read from the head, every crossing as a tick, the queue line, the plans table, the model check line, the traffic events and the Purdue coordination diagram. If the jury's video has no signal head in view, leave the head unset; OQIM reads the lights from the traffic. Then a few seconds each on /network, /city, /parking and /roads (road damage from phone photos: RDD2022 YOLOv8n, mAP50 0.66 on a 300-image sample of the test split; /elsewhere has the results of other cities). Backup if anything fails: the recorded run of C3896."
  );
}

// ---------- slide 5: technology and architecture ----------
pres.addSection({ title: "Technology" });
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Technology" });
  header(s);
  s.addText("TECHNOLOGY AND ARCHITECTURE", { placeholder: "kicker" });
  s.addText("Everything runs in the browser", { placeholder: "title" });

  // browser frame
  panel(s, M, 1.85, CW, 3.15, "Browser frame");
  s.addText("Browser tab on the user's laptop or phone", { x: M + 0.3, y: 1.95, w: 7, h: 0.35, fontFace: "Arial", bold: true, fontSize: 14, color: C.text2, margin: 0, valign: "middle", isTextBox: true, objectName: "Browser label" });
  const boxes = [
    ["Video frames", "5 frames per second, sent to a Web Worker. ffmpeg.wasm converts files the browser cannot decode."],
    ["Detect and track", "YOLO26n (10 MB) by default, YOLO26s (38 MB) as an option. ONNX Runtime Web, WebGPU or WebAssembly. ByteTrack."],
    ["Audit core", "TypeScript, no DOM. Lights, crossings, waits, discharge (busiest 10 s of each green), queue."],
    ["Replay", "Point-queue model with the clip's own vehicles. Checked against the measured crossings."],
    ["Plans", "Now, Webster (1958), searched fixed, actuated, max-pressure (Varaiya 2013), OQIM predictive."],
  ];
  const gap = 0.3;
  const bx0 = M + 0.3;
  const bw = (CW - 0.6 - 4 * gap) / 5;
  boxes.forEach(([t, d], i) => {
    const x = bx0 + i * (bw + gap);
    panel(s, x, 2.42, bw, 2.4, `Arch box ${i + 1}`, C.background1);
    s.addText(t, { x: x + 0.18, y: 2.55, w: bw - 0.36, h: 0.38, fontFace: "Arial", bold: true, fontSize: 15, color: C.accent1, margin: 0, valign: "middle", isTextBox: true, objectName: `Arch box ${i + 1} title` });
    s.addText(d, { x: x + 0.18, y: 2.98, w: bw - 0.36, h: 1.78, fontFace: "Calibri", fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: `Arch box ${i + 1} text` });
    if (i < 4) {
      s.addShape(S.ISOSCELES_TRIANGLE, { x: x + bw + gap / 2 - 0.08, y: 3.55, w: 0.16, h: 0.12, rotate: 90, fill: { color: C.accent1 }, line: { type: "none" }, objectName: `Arch arrow ${i + 1}` });
    }
  });

  // lower row: stats and reuse
  const cw = (CW - 3 * 0.3) / 4;
  const y = 5.25;
  const h = 1.5;
  const cards = [
    ["5 fps", "frames analysed per second of video"],
    ["~65 s", "to audit C3896 (5:40 of video) with YOLO26n on an Apple M5 laptop, WebGPU"],
    ["0", "server cost per audit. The site is static files."],
  ];
  cards.forEach(([v, l], i) => {
    const x = M + i * (cw + 0.3);
    panel(s, x, y, cw, h, `Tech stat ${i + 1}`);
    stat(s, x + 0.25, y + 0.1, cw - 0.5, v, l, { size: 32, vh: 0.55, lh: 0.75, ls: 13, color: i === 2 ? C.accent4 : C.accent1, name: `Tech stat ${i + 1}` });
  });
  const x4 = M + 3 * (cw + 0.3);
  panel(s, x4, y, cw, h, "Reuse card");
  s.addText(
    [
      { text: "Reused, declared: ", options: { bold: true, color: C.accent1 } },
      { text: "detector, ONNX worker, ByteTrack port from our elimination system.", options: { breakLine: true } },
      { text: "Built for the final: ", options: { bold: true, color: C.accent1 } },
      { text: "audit core, replay, plans, corridor, district." },
    ],
    { x: x4 + 0.2, y: y + 0.1, w: cw - 0.4, h: h - 0.2, fontFace: "Calibri", fontSize: 13, color: C.text1, margin: 0, valign: "middle", paraSpaceAfter: 4, isTextBox: true, objectName: "Reuse text" }
  );

  s.addNotes(
    "0:40. Browser only. Frames at 5 per second go to a Web Worker. YOLO26n (10 MB) runs by default, YOLO26s (38 MB) as an option, in ONNX Runtime Web on WebGPU, or WebAssembly on the CPU, then a ByteTrack port. Measured today: the 5:40 clip C3896 is audited in about 65 s on an Apple M5 laptop. Detector, worker and tracker are reused from our elimination system, and we say so. The audit core reads the lights from the colour contrast of the lit lamp, scaled per clip; with no head in view, greens come from when the queue moves off. It measures crossings by side, waits, arrivals on green, discharge from the busiest 10 s of each green, red-light runs and the queue. The replay is a point-queue model. Plans: now, Webster 1958, a fixed plan searched on the replay, actuated, max-pressure (Varaiya 2013), and OQIM predictive, a rollout over the next 30 s of arrivals."
  );
}

// ---------- slide 6: measured on our clips (table) ----------
const clips = audits.clips;
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const f1 = (v) => Number(v).toFixed(1);
const f2 = (v) => Number(v).toFixed(2);
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Technology" });
  header(s);
  s.addText("MEASURED ON OUR CLIPS", { placeholder: "kicker" });
  s.addText("The replay gives back what we measured", { placeholder: "title" });

  s.addText("Organisers' footage of one Tashkent junction, 18 minutes, southbound. Tracks: our elimination pipeline (YOLO26m, 1280 px, 10 fps).", { x: M, y: 1.75, w: CW, h: 0.35, fontFace: "Calibri", fontSize: 15, color: C.text2, margin: 0, valign: "middle", isTextBox: true, objectName: "Table intro" });

  const head = ["Clip", "Length", "Cycle read", "Vehicles", "Model check: median departure error", "Wait: model / measured"];
  const hcell = (t) => ({ text: t, options: { bold: true, fontFace: "Arial", fontSize: 12, color: C.text2, fill: { color: C.accent5 }, valign: "middle" } });
  const rows = [head.map(hcell)];
  clips.forEach((c) => {
    const bad = c.check.departureError > 2;
    const col = bad ? C.accent2 : C.text1;
    const cell = (t, extra = {}) => ({ text: t, options: Object.assign({ color: col, fill: { color: C.background2 }, valign: "middle" }, extra) });
    rows.push([
      cell(c.clip, { bold: true }),
      cell(mmss(c.duration)),
      cell(`${Math.round(c.cycle)} s`),
      cell(String(c.approaches[0].vehicles)),
      cell(`${f2(c.check.departureError)} s`, { bold: true }),
      cell(`${f1(c.check.modelWait)} / ${f1(c.check.measuredWait)} s`),
    ]);
  });
  const colW = [1.15, 1.1, 1.3, 1.2, 1.85, 1.9];
  const tw = colW.reduce((a, b) => a + b, 0);
  s.addTable(rows, {
    x: M, y: 2.25, w: tw, colW, rowH: [0.62, 0.5, 0.5, 0.5, 0.5],
    fontFace: "Calibri", fontSize: 16, color: C.text1,
    border: { type: "solid", pt: 0.75, color: HEX.accent5 },
    margin: [0.04, 0.12, 0.04, 0.12],
    objectName: "Model check table",
  });

  panel(s, M, 5.2, tw, 1.55, "Failure panel");
  s.addText(
    [
      { text: "Known failure cases: ", options: { bold: true, color: C.accent2 } },
      { text: "short clips (under 2 cycles, see C3905), long queues where tracks break, a stop line drawn over two directions, free right turns counted as red crossings. Night and rain not yet measured on a test set of our own." },
    ],
    { x: M + 0.25, y: 5.3, w: tw - 0.5, h: 1.35, fontFace: "Calibri", fontSize: 14, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: "Failure text" }
  );

  const rx = M + tw + 0.4;
  const rw = W - M - rx;
  panel(s, rx, 2.25, rw, 2.65, "Browser callout");
  stat(s, rx + 0.3, 2.4, rw - 0.6, "0.07 s", "median departure error, browser run on C3896 today with YOLO26n (pipeline tracks: 0.50 s).", { size: 44, color: C.accent4, lh: 1.3, ls: 14, name: "Browser check" });
  panel(s, rx, 5.2, rw, 1.55, "Browser run callout");
  s.addText("Same browser run: cycle 76 s, green 36 s, 127 vehicles over the line (Python pipeline: 130).", { x: rx + 0.25, y: 5.3, w: rw - 0.5, h: 1.35, fontFace: "Calibri", fontSize: 14, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: "Browser run text" });

  s.addNotes(
    "0:30. Four clips of one Tashkent junction, the organisers' footage, 18 minutes, southbound approach. On three clips the replay gives back when each vehicle left within about half a second, and the modelled wait is close to the measured one. C3905 is 2:08, under 2 cycles, and the check fails; OQIM shows that instead of hiding it. Known failure cases are on the slide. The table uses the elimination pipeline's tracks (YOLO26m at 1280 px, 10 fps). Today we re-ran C3896 in the browser with YOLO26n: cycle 76 s, green 36 s, 127 vehicles over the stop line against 130 in the Python pipeline, and a median departure error of 0.07 s."
  );
}

// ---------- slide 7: plans chart ----------
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Technology" });
  header(s);
  s.addText("MEASURED ON OUR CLIPS", { placeholder: "kicker" });
  s.addText("The textbook plan was worse than now", { placeholder: "title" });

  const keys = ["measured", "webster", "tuned", "actuated", "maxpressure", "predictive"];
  const names = { measured: "Now", webster: "Webster (1958)", tuned: "Searched fixed plan", actuated: "Actuated", maxpressure: "Max-pressure", predictive: "OQIM predictive" };
  const chartClips = ["C3896", "C3897", "C3902"].map((id) => clips.find((c) => c.clip === id));
  const data = keys.map((k) => ({
    name: names[k],
    labels: chartClips.map((c) => c.clip),
    values: chartClips.map((c) => c.modes.find((m) => m.key === k).meanDelay),
  }));
  const cwid = 8.25;
  panel(s, M, 1.85, cwid, 4.9, "Chart panel");
  s.addChart(pres.charts.BAR, data, {
    x: M + 0.1, y: 1.95, w: cwid - 0.2, h: 4.7,
    barDir: "col", barGrouping: "clustered", barGapWidthPct: 55, barOverlapPct: -8,
    chartColors: ["D9D4C9", HEX.accent2, HEX.accent3, "5E636B", "8C9098", HEX.accent4],
    showTitle: true, title: "Mean wait per vehicle on the replay, seconds", titleFontFace: "+mn-lt", titleFontSize: 14, titleColor: HEX.dk1,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 10, dataLabelColor: HEX.dk1, dataLabelFontFace: "+mn-lt", dataLabelFormatCode: "0.0",
    catAxisLabelColor: HEX.dk1, catAxisLabelFontSize: 14, catAxisLabelFontFace: "+mn-lt", catAxisLineShow: false,
    valAxisLabelColor: HEX.dk2, valAxisLabelFontSize: 11, valAxisLabelFontFace: "+mn-lt", valAxisMinVal: 0, valAxisMaxVal: 35, valAxisMajorUnit: 10, valAxisLineShow: false,
    valGridLine: { color: HEX.accent5, size: 0.75 }, catGridLine: { style: "none" },
    showLegend: true, legendPos: "b", legendFontSize: 12, legendColor: HEX.dk1, legendFontFace: "+mn-lt",
    objectName: "Mean wait per plan chart",
  });

  const rx = M + cwid + 0.35;
  const rw = W - M - rx;
  const c97 = clips.find((c) => c.clip === "C3897");
  const md = (k) => f1(c97.modes.find((m) => m.key === k).meanDelay);
  panel(s, rx, 1.85, rw, 1.75, "Webster callout");
  stat(s, rx + 0.25, 1.95, rw - 0.5, `${md("webster")}\u00A0s vs ${md("measured")}\u00A0s`, "Webster (1958) against the timing now, C3897. Worse on all four clips.", { size: 30, color: C.accent2, vh: 0.55, lh: 0.85, ls: 14, name: "Webster" });
  panel(s, rx, 3.8, rw, 1.75, "Predictive callout");
  stat(s, rx + 0.25, 3.9, rw - 0.5, `${md("predictive")}\u00A0s`, `OQIM predictive, C3897. Now: ${md("measured")}\u00A0s. Searched fixed plan: ${md("tuned")}\u00A0s.`, { size: 30, color: C.accent4, vh: 0.55, lh: 0.85, ls: 14, name: "Predictive" });
  s.addText("So OQIM never recommends a plan before replaying it on the junction's own vehicles. Predictive assumes the next 30 s of arrivals are known.", { x: rx, y: 5.7, w: rw, h: 1.05, fontFace: "Calibri", fontSize: 13, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: "Chart takeaway" });

  s.addNotes(
    "0:30. Mean wait per vehicle for each plan, on the replay of each clip. Webster's textbook plan was worse than the current timing on all four clips, for example 29.7 s against 10 s on C3897. That is why OQIM never recommends a plan before replaying it on the junction's own vehicles. Every plan keeps the share of the cycle the cross street has today, because its traffic is out of view. The searched fixed plan is close to the current timing; the predictive mode cuts the wait on C3897 from 10 s to 8.7 s. Be honest: predictive assumes the arrivals of the next 30 s are known; in the field that needs a camera at the junction upstream."
  );
}

// ---------- slide 8: corridor, district, parking ----------
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Technology" });
  header(s);
  s.addText("BEYOND ONE JUNCTION", { placeholder: "kicker" });
  s.addText("A corridor, a district, a car park", { placeholder: "title" });

  const gap = 0.3;
  const colw = (CW - 2 * gap) / 3;
  const ih = 2.1;
  const cols = [
    {
      img: IMG("network.png"), alt: "3D corridor of Tashkent", tag: "SIMULATION",
      label: "Amir Temur Avenue, Tashkent: 1.46 km, 5 signals, 224 vehicles in 10 min. Green wave against timing now.",
      top: ["141 s → 24 s", "mean delay at the signals"],
      pair: [["4.58 → 0.60", "stops per vehicle"]],
    },
    {
      img: IMG("city.png"), alt: "Kwun Tong district model", tag: "SIMULATION",
      label: "Kwun Tong, Hong Kong: 22 traffic cameras, about 20 car parks, 60 drivers to the MTR station.",
      top: ["60 → 5", "drivers arriving to a full car park"],
      pair: [["−18%", "door to door"], ["−41%", "vehicle-km"]],
    },
    {
      img: IMG("parking_pklot.jpg"), alt: "PKLot car park frame with labelled spaces", tag: "HAND LABELS",
      label: "/parking: free and taken spaces from ordinary car park camera frames, in the browser.",
      top: ["97.4%", "of spaces right, 240 held-out images (13,447 spaces)"],
      pair: [["99.1%", "precision, taken"], ["95.3%", "recall, taken"]],
    },
  ];
  cols.forEach((c, ci) => {
    const x = M + ci * (colw + gap);
    panel(s, x, 1.85, colw, ih + 0.14, `Image panel ${ci + 1}`);
    s.addImage({ path: c.img, x: x + 0.07, y: 1.92, w: colw - 0.14, h: ih, sizing: { type: "cover", w: colw - 0.14, h: ih }, altText: c.alt, objectName: `Image ${ci + 1}` });
    s.addText(c.tag, { shape: S.ROUNDED_RECTANGLE, x: x + 0.17, y: 1.99 + ih - 0.42, w: 1.25, h: 0.3, rectRadius: 0.05, fill: { color: C.background1 }, line: { type: "none" }, fontFace: "Arial", bold: true, fontSize: 10, color: ci === 2 ? C.accent4 : C.accent3, align: "center", valign: "middle", charSpacing: 2, margin: 0, objectName: `Image ${ci + 1} tag` });
    s.addText(c.label, { x, y: 4.1, w: colw, h: 0.55, fontFace: "Calibri", fontSize: 12, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: `Column ${ci + 1} label` });
    stat(s, x, 4.72, colw, c.top[0], c.top[1], { size: 28, vh: 0.48, lh: 0.3, ls: 13, color: C.accent4, name: `Column ${ci + 1} stat` });
    const n = c.pair.length;
    const sw = (colw - (n - 1) * 0.25) / n;
    c.pair.forEach(([v, l], i) => {
      stat(s, x + i * (sw + 0.25), 5.6, sw, v, l, { size: 24, vh: 0.42, lh: 0.3, ls: 13, color: C.accent4, name: `Column ${ci + 1} stat ${i + 2}` });
    });
  });
  // live camera thumbnails over the district map
  ["K810F.jpg", "K813F.jpg", "AID02207.jpg"].forEach((f, i) => {
    const tw = 0.8;
    const th = tw * 0.75;
    const x = M + 2 * colw + gap - 0.07 - tw;
    const y = 1.92 + i * (th + 0.05);
    s.addImage({ path: MEDIA(path.join("hongkong", f)), x, y, w: tw, h: th, altText: "Hong Kong traffic camera snapshot", objectName: `Camera thumb ${i + 1}` });
  });

  s.addText("Corridor and district are simulations. Tashkent: Intelligent Driver Model, one direction, only offsets change, real offsets unknown. Kwun Tong: drivers simulated; camera counts (YOLO26m, 960 px) and free spaces real, 13:45 Hong Kong time, 11 October. Parking: PKLot (CC BY 4.0, Almeida et al. 2015); sunny 97.0%, cloudy 99.0%, rainy 96.1%; no night frames in the dataset.", { x: M, y: 6.42, w: CW, h: 0.52, fontFace: "Calibri", fontSize: 10, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: "Simulation note" });

  s.addNotes(
    "0:20 (often shown live in the demo). Corridor and district are simulations. Corridor: Amir Temur Avenue northbound, 1.46 km, 5 signals, 3 lanes from the discharge rate on the video, 224 vehicles in 10 minutes, Intelligent Driver Model, one direction. Only the offsets change, so cross streets keep their time; the real offsets are unknown to us. Mean delay 141 s to 24 s, stops per vehicle 4.58 to 0.60. Kwun Tong: 22 Transport Department cameras counted by YOLO26m at 960 px every 2 minutes, live car park spaces, 60 simulated drivers. At 13:45 Hong Kong time on 11 October the nearest car park had 0 free spaces: all 60 'nearest' drivers arrived to a full car park; with OQIM 5 did. Door to door 15.5 against 12.7 minutes, minus 18%; vehicle-km 305 against 181, minus 41%. Parking is measured, not simulated: free and taken spaces from ordinary car park camera frames (PKLot dataset), detected in the browser. 97.4% of spaces right on 240 held-out images, 13,447 spaces; precision 99.1% and recall 95.3% for taken. Sunny 97.0%, cloudy 99.0%, rainy 96.1%. No night frames in the dataset."
  );
}

// ---------- slide 9: it works elsewhere ----------
pres.addSection({ title: "Business" });
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Business" });
  header(s);
  s.addText("EVIDENCE", { placeholder: "kicker" });
  s.addText("It already works elsewhere", { placeholder: "title" });

  const cards = [
    ["Google Project Green Light", "Up to 30%", "fewer stops, up to 10% less emissions; about 70 junctions, 12 cities", "Seattle DOT"],
    ["Surtrac, Pittsburgh", ">25%", "less travel time, idling down 40%", "Smart Cities Dive"],
    ["SCOOT, UK", "12%", "less delay than up-to-date fixed plans, 20% than typical ones", "DfT TAL 7/99"],
    ["Utah ATSPM", "USD 108M", "projected savings over 10 years, from the same measures as OQIM", "FHWA"],
    ["Copenhagen green wave", "17%", "less travel time; stops from six to under one", "Centre for Public Impact"],
    ["SFpark, San Francisco", "50%", "less cruising for parking, search time down 43%", "ACCESS Magazine"],
  ];
  const gap = 0.3;
  const cw = (CW - 2 * gap) / 3;
  const ch = 2.08;
  cards.forEach(([name, v, l, src], i) => {
    const x = M + (i % 3) * (cw + gap);
    const y = 1.85 + Math.floor(i / 3) * (ch + gap);
    panel(s, x, y, cw, ch, `Evidence card ${i + 1}`);
    s.addText(name, { x: x + 0.25, y: y + 0.15, w: cw - 0.5, h: 0.32, fontFace: "Arial", bold: true, fontSize: 14, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: `Evidence ${i + 1} name` });
    s.addText(v, { x: x + 0.25, y: y + 0.5, w: cw - 0.5, h: 0.58, fontFace: "Arial", bold: true, fontSize: 32, color: C.accent1, margin: 0, valign: "middle", isTextBox: true, objectName: `Evidence ${i + 1} value` });
    s.addText(l, { x: x + 0.25, y: y + 1.1, w: cw - 0.5, h: 0.62, fontFace: "Calibri", fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: `Evidence ${i + 1} text` });
    s.addText(`Source: ${src}`, { x: x + 0.25, y: y + ch - 0.33, w: cw - 0.5, h: 0.24, fontFace: "Calibri", fontSize: 10, color: C.text2, margin: 0, valign: "middle", isTextBox: true, objectName: `Evidence ${i + 1} source` });
  });
  s.addText("They can do it because they measure. Most junctions in Tashkent cannot be measured today. OQIM measures them from one video.", { x: M, y: 6.38, w: CW, h: 0.45, fontFace: "Calibri", fontSize: 16, bold: true, color: C.accent1, margin: 0, valign: "middle", isTextBox: true, objectName: "Evidence line" });

  s.addNotes(
    "0:30. Line to say: cities that retime and coordinate signals cut stops and delay. They can do it because they measure. Most junctions in Tashkent cannot be measured today; OQIM measures them from one video. Sources, if asked: Seattle DOT blog on Project Green Light; Smart Cities Dive on Surtrac; DfT Traffic Advisory Leaflet 7/99 on SCOOT; FHWA on Utah ATSPM; Centre for Public Impact on Copenhagen; ACCESS Magazine on SFpark."
  );
}

// ---------- slide 10: why it is hard to copy ----------
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Business" });
  header(s);
  s.addText("OUR EDGE", { placeholder: "kicker" });
  s.addText("Why it is hard to copy", { placeholder: "title" });

  const rows = [
    ["Lights read from pixels", "No controller access. Built on our elimination work: signal reader, registration, rules, 98 labelled events.", C.accent2],
    ["The replay check", "Plans are judged on the junction's own vehicles. The model must give back the measured crossings first.", C.accent3],
    ["Runs in the browser", "No server, no GPU bill. The video stays on the device, which suits Uzbekistan's personal data law; we store none.", C.accent4],
    ["Domain knowledge", "Webster's method, saturation flow, ATSPM measures.", C.accent1],
  ];
  const lw = 6.9;
  const rh = 1.1;
  rows.forEach(([t, d, col], i) => {
    const y = 1.85 + i * (rh + 0.17);
    lamp(s, M, y + 0.08, 0.5, col, `Moat ${i + 1} lamp`, String(i + 1));
    s.addText(t, { x: M + 0.75, y, w: lw - 0.75, h: 0.4, fontFace: "Arial", bold: true, fontSize: 18, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: `Moat ${i + 1} title` });
    s.addText(d, { x: M + 0.75, y: y + 0.42, w: lw - 0.75, h: 0.66, fontFace: "Calibri", fontSize: 15, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: `Moat ${i + 1} text` });
  });

  const rx = M + lw + 0.4;
  const rw = W - M - rx;
  const ih = rw / 1.6;
  panel(s, rx, 1.85, rw, ih + 0.14, "Reader panel");
  s.addImage({ path: IMG("c3896_reader.jpg"), x: rx + 0.07, y: 1.92, w: rw - 0.14, h: ih, sizing: { type: "cover", w: rw - 0.14, h: ih }, altText: "Signal lamp reader on the Tashkent junction", objectName: "Reader frame" });
  s.addText("Our lamp reader on the organisers' footage, from pixels only.", { x: rx, y: 1.85 + ih + 0.2, w: rw, h: 0.26, fontFace: "Calibri", fontSize: 12, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: "Reader caption" });
  panel(s, rx, 5.45, rw, 1.3, "Agreement panel");
  stat(s, rx + 0.25, 5.52, rw - 0.5, "98.8%", "of frames of C3896: the browser's signal reading agrees with our elimination lamp reader.", { size: 28, vh: 0.48, lh: 0.62, ls: 13, color: C.accent4, name: "Agreement" });

  s.addNotes(
    "0:20. Four reasons. One: we read the lights from pixels with no controller access; our elimination work (signal reader, registration, rules, 98 labelled events) made this possible in a day. In the browser it agrees with the elimination lamp reader on 98.8% of frames of C3896. Two: the replay check; plans are judged on the junction's own vehicles, and the model must reproduce the measured crossings first. Three: it runs in the browser; no server, no GPU bill, and the video stays on the device, which fits Uzbekistan's personal data law. Four: domain knowledge, Webster's method, saturation flow, ATSPM measures."
  );
}

// ---------- slide 11: budget and ROI ----------
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Business" });
  header(s);
  s.addText("ALL NUMBERS ARE ASSUMPTIONS TO CHECK WITH THE CUSTOMER", { placeholder: "kicker" });
  s.addText("Budget and ROI", { placeholder: "title" });

  const gap = 0.3;
  const cw = (CW - 2 * gap) / 3;
  const y = 1.85;
  const h = 4.9;
  const xs = [0, 1, 2].map((i) => M + i * (cw + gap));

  // column 1: pilot
  panel(s, xs[0], y, cw, h, "Pilot card");
  s.addText("Pilot with TsODD", { x: xs[0] + 0.3, y: y + 0.2, w: cw - 0.6, h: 0.38, fontFace: "Arial", bold: true, fontSize: 18, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: "Pilot heading" });
  stat(s, xs[0] + 0.3, y + 0.62, 1.6, "3", "months", { size: 48, vh: 0.75, lh: 0.32, ls: 14, name: "Pilot months" });
  stat(s, xs[0] + 1.95, y + 0.62, 1.6, "20", "junctions", { size: 48, vh: 0.75, lh: 0.32, ls: 14, name: "Pilot junctions" });
  s.addText(
    [
      { text: "People: ", options: { bold: true, color: C.accent1 } },
      { text: "3 engineers part time. The main cost.", options: { breakLine: true } },
      { text: "Hosting: ", options: { bold: true, color: C.accent1 } },
      { text: "static, free to USD 20 a month. No GPU server.", options: { breakLine: true } },
      { text: "Data: ", options: { bold: true, color: C.accent1 } },
      { text: "videos the service already records or films for us. No licences to buy." },
    ],
    { x: xs[0] + 0.3, y: y + 1.95, w: cw - 0.6, h: h - 2.1, fontFace: "Calibri", fontSize: 14, color: C.text1, margin: 0, valign: "top", paraSpaceAfter: 8, isTextBox: true, objectName: "Pilot costs" }
  );

  // column 2: per audit
  panel(s, xs[1], y, cw, h, "Unit card");
  s.addText("Per junction audit", { x: xs[1] + 0.3, y: y + 0.2, w: cw - 0.6, h: 0.38, fontFace: "Arial", bold: true, fontSize: 18, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: "Unit heading" });
  stat(s, xs[1] + 0.3, y + 0.62, cw - 0.6, "0", "compute cost. Inference runs on the user's device.", { size: 48, vh: 0.75, lh: 0.6, ls: 14, color: C.accent4, name: "Compute" });
  s.addText(
    [
      { text: "Our cost: ", options: { bold: true, color: C.accent1 } },
      { text: "an engineer's 30 minutes to film and check.", options: { breakLine: true } },
      { text: "Price: ", options: { bold: true, color: C.accent1 } },
      { text: "below the cost of a manual study of the same junction. Price set in the pilot." },
    ],
    { x: xs[1] + 0.3, y: y + 2.2, w: cw - 0.6, h: h - 2.35, fontFace: "Calibri", fontSize: 14, color: C.text1, margin: 0, valign: "top", paraSpaceAfter: 8, isTextBox: true, objectName: "Unit costs" }
  );

  // column 3: value and payback formula
  panel(s, xs[2], y, cw, h, "Value card");
  s.addText("Value and payback", { x: xs[2] + 0.3, y: y + 0.2, w: cw - 0.6, h: 0.38, fontFace: "Arial", bold: true, fontSize: 18, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: "Value heading" });
  const fx = xs[2] + 0.3;
  const fw = cw - 0.6;
  panel(s, fx, y + 0.72, fw, 1.95, "Formula box", C.background1);
  s.addText(
    [
      { text: "Value a day =", options: { bold: true, color: C.accent1, breakLine: true } },
      { text: "vehicle-hours saved per hour × hours a day at this traffic × (value of an hour + 0.8 l × fuel price)", options: { breakLine: true } },
      { text: "Payback = price ÷ value a day", options: { bold: true, color: C.accent1 } },
    ],
    { x: fx + 0.18, y: y + 0.8, w: fw - 0.36, h: 1.8, fontFace: "Calibri", fontSize: 14, color: C.text1, margin: 0, valign: "middle", paraSpaceAfter: 6, isTextBox: true, objectName: "Formula" }
  );
  s.addText(
    [
      { text: "CO2: 2.31 kg per litre of fuel; idling at 0.8 litres an hour.", options: { breakLine: true } },
      { text: "The engineer sets the inputs on the page. We state payback from the pilot inputs, not before." },
    ],
    { x: fx, y: y + 2.85, w: fw, h: h - 3.0, fontFace: "Calibri", fontSize: 14, color: C.text1, margin: 0, valign: "top", paraSpaceAfter: 8, isTextBox: true, objectName: "Value notes" }
  );

  s.addNotes(
    "0:40. All numbers here are assumptions to check with the customer. Pilot: 3 months, 20 junctions in Tashkent with TsODD. The main cost is people, 3 engineers part time. Hosting is static, free to USD 20 a month; no GPU server, inference runs on the user's laptop. Data: videos the service already records or films for us, no licences. Per audit our cost is an engineer's 30 minutes to film and check; compute is zero. Price: below a manual study of the same junction, set in the pilot. Value: the page turns saved vehicle-hours into money with inputs the engineer sets: hours a day at this traffic, value of an hour, fuel while idling at 0.8 litres an hour, 2.31 kg CO2 a litre. Payback: we state it from the pilot inputs; we do not quote a number we have not measured."
  );
}

// ---------- slide 12: next steps ----------
pres.addSection({ title: "Next steps" });
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Next steps" });
  header(s);
  s.addText("AFTER THE HACKATHON", { placeholder: "kicker" });
  s.addText("Next steps", { placeholder: "title" });

  const steps = [
    ["Pilot", "With TsODD: 20 junctions, their videos, their engineer marks the lines."],
    ["Test set", "Our own, at night and in rain, with manual counts."],
    ["Network", "Link neighbouring junctions (predictive needs the camera upstream), offsets for green waves."],
    ["Timing sheet", "Export a sheet the engineer can enter into the controller."],
  ];
  const gap = 0.3;
  const cw = (CW - 3 * gap) / 4;
  const y = 1.95;
  const h = 2.75;
  const cols = [C.accent2, C.accent3, C.accent3, C.accent4];
  // track line through the lamps
  s.addShape(S.LINE, { x: M + 0.3, y: y + 0.5, w: 3 * (cw + gap), h: 0, line: { color: C.accent5, width: 2 }, objectName: "Step track" });
  steps.forEach(([t, d], i) => {
    const x = M + i * (cw + gap);
    lamp(s, x, y + 0.2, 0.6, cols[i], `Next ${i + 1} lamp`, String(i + 1));
    s.addText(t, { x, y: y + 1.0, w: cw, h: 0.42, fontFace: "Arial", bold: true, fontSize: 20, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: `Next ${i + 1} title` });
    s.addText(d, { x, y: y + 1.48, w: cw - 0.15, h: 1.25, fontFace: "Calibri", fontSize: 15, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: `Next ${i + 1} text` });
  });

  panel(s, M, 5.15, CW, 1.6, "Closing panel");
  addLamps(s, M + 0.35, 5.62, 0.36, "Closing lamps");
  s.addText(
    [
      { text: "Thank you. Questions?", options: { bold: true, fontFace: "Arial", fontSize: 24, color: C.text1, breakLine: true } },
      { text: "Try it: ", options: { color: C.text2 } },
      { text: "https://oqim-audit.vercel.app", options: { color: C.accent1, hyperlink: { url: "https://oqim-audit.vercel.app" } } },
      { text: "     Code: ", options: { color: C.text2 } },
      { text: "https://github.com/baytoooo/oqim", options: { color: C.accent1, hyperlink: { url: "https://github.com/baytoooo/oqim" } } },
    ],
    { x: M + 2.25, y: 5.25, w: CW - 2.55, h: 1.4, fontFace: "Calibri", fontSize: 16, margin: 0, valign: "middle", paraSpaceAfter: 6, isTextBox: true, objectName: "Closing text" }
  );

  s.addNotes(
    "0:30. Next: a pilot with TsODD on 20 junctions, with their videos, where their engineer marks the lines. A test set of our own at night and in rain, with manual counts. The network: link neighbouring junctions, because the predictive mode needs the camera upstream, and set offsets for green waves. And export a timing sheet the engineer can enter into the controller. Thank you; we are ready for questions."
  );
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

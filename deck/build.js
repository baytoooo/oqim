// OQIM defence deck, team PariVision, WIUT Hackathon 2026, Computer Vision final.
// Run from this folder: node build.js   (writes OQIM_defence.pptx)
// The story: the parking tracker first, the signal audit and green wave as the next stage.
// Numbers come only from the data files in ../app/public/data (tracker.json, parking.json,
// audits.json, hongkong.json, hk_carparks.json, roads_eval.json, team.json) and from
// ../docs/deck.md for the recorded runs (the corridor, the Kwun Tong snapshot, the lamp agreement).
const path = require("path");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require("./apply_theme.js");
const fs = require("fs");
const DATA = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app", "public", "data", f), "utf8"));
const audits = DATA("audits.json");
const tracker = DATA("tracker.json");
const parking = DATA("parking.json");
const team = DATA("team.json");
const hk = DATA("hongkong.json");
const hkParks = DATA("hk_carparks.json");
const roads = DATA("roads_eval.json");

const OUT = path.join(__dirname, "OQIM_defence.pptx");
const IMG = (f) => path.join(__dirname, "img", f);
const MEDIA = (f) => path.join(__dirname, "..", "app", "public", "media", f);
const roadsImg = fs.readdirSync(MEDIA("roads")).filter((f) => /\.jpe?g$/i.test(f)).sort()[0];

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
pres.title = "OQIM: a parking tracker from car park cameras";
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

// ---------- numbers, all read from the data files ----------
const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
const int = (x) => Number(x).toLocaleString("en-US");
const f1 = (v) => Number(v).toFixed(1);
const f2 = (v) => Number(v).toFixed(2);
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const tEval = tracker.eval;
const fc = tEval.forecast || null;
const lots = tracker.lots;
const capacity = lots.reduce((a, l) => a + l.capacity, 0);
const lotFrames = lots.reduce((a, l) => a + l.frames.length, 0);
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const frameStep = lots[0].frames.length > 1 ? toMin(lots[0].frames[1].t) - toMin(lots[0].frames[0].t) : null;
const heroLot = lots[0];
const heroFrame = heroLot.frames.find((x) => x.t >= "09:00") || heroLot.frames[heroLot.frames.length - 1];
const heroFree = [...heroFrame.det].filter((c) => c === "0").length;
const longDate = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const pTest = parking.eval.test;
const pFree = parking.eval.free_count_error;
const pW = parking.eval.by_weather;
const clips = audits.clips;

// ---------- slide 1: title ----------
pres.addSection({ title: "Opening" });
{
  const s = pres.addSlide({ masterName: "OQIM Title", sectionTitle: "Opening" });
  addLamps(s, M, 0.75, 0.2, "Signal lamps");
  s.addText("WIUT HACKATHON 2026  ·  COMPUTER VISION FINAL", { placeholder: "kicker" });
  s.addText("OQIM", { placeholder: "title" });
  s.addText([{ text: "A parking tracker", options: { breakLine: true } }, { text: "from car park cameras" }], { placeholder: "subtitle" });

  s.addText("MODE: STARTUP", { shape: S.ROUNDED_RECTANGLE, x: M, y: 4.05, w: 3.0, h: 0.62, rectRadius: 0.12, fill: { color: C.accent1 }, line: { type: "none" }, fontFace: "Arial", bold: true, fontSize: 22, color: C.background1, align: "center", valign: "middle", charSpacing: 2, margin: 0, objectName: "Mode badge" });

  s.addText(
    [
      { text: `Team ${team.team}`, options: { bold: true, fontSize: 18, color: C.text1, breakLine: true } },
      { text: team.members.map((m) => m.name).join(", "), options: { fontSize: 16, color: C.text1, breakLine: true } },
      { text: team.university, options: { fontSize: 16, color: C.text2 } },
    ],
    { x: M, y: 4.95, w: 6.0, h: 1.05, fontFace: "Calibri", margin: 0, valign: "top", paraSpaceAfter: 2, isTextBox: true, objectName: "Team" }
  );
  s.addText(
    [
      { text: "Live   ", options: { color: C.text2 } },
      { text: "https://oqim-audit.vercel.app/tracker", options: { color: C.accent1, hyperlink: { url: "https://oqim-audit.vercel.app/tracker" }, breakLine: true } },
      { text: "Code   ", options: { color: C.text2 } },
      { text: "https://github.com/baytoooo/oqim", options: { color: C.accent1, hyperlink: { url: "https://github.com/baytoooo/oqim" } } },
    ],
    { x: M, y: 6.15, w: 6.0, h: 0.7, fontFace: "Calibri", fontSize: 15, margin: 0, valign: "top", paraSpaceAfter: 4, isTextBox: true, objectName: "Links" }
  );

  panel(s, 6.85, 1.25, 5.88, 3.43, "Frame panel");
  s.addImage({ path: IMG("tracker_frame.jpg"), x: 6.92, y: 1.32, w: 5.74, h: 3.29, sizing: { type: "cover", w: 5.74, h: 3.29 }, altText: "PKLot camera frame of the PUCPR car park with every space marked free or taken", objectName: "Car park frame" });
  s.addText(`The ${heroLot.name} car park camera at ${heroFrame.t} on ${longDate(heroLot.date)} (PKLot dataset). Green: free, red: taken, as our detector read the frame.`, { x: 6.85, y: 4.8, w: 5.88, h: 0.55, fontFace: "Calibri", fontSize: 11, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: "Frame caption" });

  [heroLot.name, heroFrame.t, `${heroFree} free of ${heroLot.capacity}`].forEach((t, i) => {
    const widths = [1.2, 1.0, 2.0];
    const x = 6.85 + widths.slice(0, i).reduce((a, b) => a + b + 0.15, 0);
    s.addText(t, { shape: S.ROUNDED_RECTANGLE, x, y: 5.55, w: widths[i], h: 0.42, rectRadius: 0.06, fill: { color: C.background2 }, line: { color: C.accent5, width: 0.75 }, fontFace: "Arial", bold: true, fontSize: 13, color: i === 0 ? C.accent1 : C.text1, align: "center", valign: "middle", margin: 0, objectName: `Frame chip ${i + 1}` });
  });

  s.addNotes(
    `0:10. Good morning. We are team ${team.team} from ${team.university}. Our mode is Startup (say it out loud, the rules ask for it). OQIM is a parking tracker. Cameras over a car park count the free spaces, see cars come in and leave, forecast the free spaces for the minute you arrive, and tell each driver which car park to go to. On the right: a real car park at ${heroFrame.t}, ${heroFree} free spaces of ${heroLot.capacity}.`
  );
}

// ---------- slide 2: problem and user ----------
pres.addSection({ title: "Problem" });
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Problem" });
  header(s);
  s.addText("PROBLEM AND USER", { placeholder: "kicker" });
  s.addText("Drivers circle because they cannot see free spaces", { placeholder: "title" });

  const cw = (CW - 2 * 0.3) / 3;
  const stats = [
    ["17 h", "a year a US driver spends searching for parking (INRIX, 2017)", C.accent2],
    ["~5%", "of off-street car parks publish live free spaces (Parkopedia)", C.accent3],
    ["13,208", "paid spaces on 86 streets planned by Poytaxt Parking, Tashkent", C.accent1],
  ];
  stats.forEach(([v, l, col], i) => {
    const x = M + i * (cw + 0.3);
    panel(s, x, 1.85, cw, 1.75, `Stat card ${i + 1}`);
    stat(s, x + 0.3, 1.97, cw - 0.6, v, l, { size: 48, color: col, lh: 0.6, name: `Stat ${i + 1}` });
  });
  s.addText(
    [
      { text: "SFpark in San Francisco cut cruising for parking by 50% on its pilot blocks.  ", options: { color: C.text1 } },
      { text: "Sources: INRIX, Parkopedia, Spot.uz, ACCESS Magazine", options: { color: C.text2 } },
    ],
    { x: M, y: 3.72, w: CW, h: 0.35, fontFace: "Calibri", fontSize: 14, margin: 0, valign: "middle", isTextBox: true, objectName: "Evidence line" }
  );

  const lw = 6.9;
  panel(s, M, 4.25, lw, 2.5, "Why panel");
  s.addText("How a driver finds a space today", { x: M + 0.3, y: 4.4, w: lw - 0.6, h: 0.4, fontFace: "Arial", bold: true, fontSize: 18, color: C.text1, margin: 0, isTextBox: true, objectName: "Why heading" });
  s.addText(
    [
      { text: "Picks a car park by distance or habit, and learns it is full at the gate.", options: { bullet: { indent: 16 }, breakLine: true } },
      { text: "Drives on to the next one. While searching, the car is part of the traffic.", options: { bullet: { indent: 16 }, breakLine: true } },
      { text: "A navigator sends every driver to the same nearest car park.", options: { bullet: { indent: 16 } } },
    ],
    { x: M + 0.3, y: 4.88, w: lw - 0.6, h: 1.75, fontFace: "Calibri", fontSize: 15, color: C.text1, margin: 0, valign: "top", paraSpaceAfter: 6, isTextBox: true, objectName: "Why bullets" }
  );

  const ux = M + lw + 0.3;
  const uw = CW - lw - 0.3;
  panel(s, ux, 4.25, uw, 2.5, "User panel");
  lamp(s, ux + 0.3, 4.46, 0.22, C.accent4, "User lamp");
  s.addText("The user", { x: ux + 0.65, y: 4.4, w: uw - 1, h: 0.36, fontFace: "Arial", bold: true, fontSize: 18, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: "User heading" });
  s.addText(
    [
      { text: "Drivers going to busy places: malls, business centres, hospitals, stations.", options: { breakLine: true } },
      { text: "Who pays: ", options: { bold: true, color: C.accent1 } },
      { text: "car park operators, and the city, which wants less searching traffic." },
    ],
    { x: ux + 0.3, y: 4.88, w: uw - 0.6, h: 1.75, fontFace: "Calibri", fontSize: 15, color: C.text1, margin: 0, valign: "top", paraSpaceAfter: 8, isTextBox: true, objectName: "User text" }
  );

  s.addNotes(
    "0:50. A driver picks a car park by distance or habit and finds out it is full at the gate. Then they drive on to the next one, and while they search, that car is part of the traffic. INRIX found US drivers spend 17 hours a year searching for parking. Parkopedia says only about 5% of off-street car parks publish live free spaces. In Tashkent, Poytaxt Parking plans paid parking on 86 streets with 13,208 spaces, first come, first served. Where cities do show drivers where the space is, it works: SFpark cut cruising by 50% on its pilot blocks. Our user is the driver. Who pays: the car park operator, and the city, which wants less searching traffic."
  );
}

// ---------- slide 3: the tracker (live demo) ----------
pres.addSection({ title: "Product and demo" });
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Product and demo" });
  header(s);
  s.addText("LIVE DEMO  ·  /tracker", { placeholder: "kicker" });
  s.addText("Free spaces now, and when you arrive", { placeholder: "title" });

  const iw = 6.9;
  const ih = iw * 9 / 16;
  panel(s, M, 1.85, iw + 0.14, ih + 0.14, "Tracker frame panel");
  s.addImage({ path: IMG("tracker_frame.jpg"), x: M + 0.07, y: 1.92, w: iw, h: ih, sizing: { type: "cover", w: iw, h: ih }, altText: "Tracker reading of the PUCPR car park", objectName: "Tracker frame" });
  s.addText(
    lots.map((l) => `${l.name}: ${l.capacity} spaces, ${l.date}`).join("   ·   "),
    { x: M, y: 1.85 + ih + 0.22, w: iw + 0.14, h: 0.3, fontFace: "Calibri", fontSize: 12, color: C.text2, margin: 0, valign: "middle", isTextBox: true, objectName: "Lots line" }
  );
  s.addText(
    [
      { text: "https://oqim-audit.vercel.app/tracker", options: { color: C.accent1, hyperlink: { url: "https://oqim-audit.vercel.app/tracker" } } },
      { text: `   ${lots.length} PKLot cameras, ${tracker.clock.start} to ${tracker.clock.end}${frameStep ? `, a frame every ${frameStep} min` : ""}`, options: { color: C.text2 } },
    ],
    { x: M, y: 6.42, w: iw + 0.14, h: 0.32, fontFace: "Calibri", fontSize: 13, margin: 0, valign: "middle", isTextBox: true, objectName: "Demo link" }
  );

  const rx = M + iw + 0.45;
  const rw = W - M - rx;
  const cards = [
    [pct(tEval.accuracy), `of space readings right: ${int(tEval.frames)} frames, ${int(tEval.spaces)} readings`, C.accent4],
    [`${tEval.freeErr.median} / ${tEval.freeErr.p90}`, "free count off by, median / 90th percentile, spaces per frame", C.accent1],
  ];
  if (fc) cards.push([`${f1(fc.mae)} vs ${f1(fc.naiveMae)}`, `forecast error ${fc.h} min ahead, in spaces; "same as now" gives ${f1(fc.naiveMae)}`, C.accent4]);
  cards.push([`${int(tEval.events.in)} in, ${int(tEval.events.out)} out`, "cars seen coming in and leaving", C.accent3]);
  const rgap = 0.15;
  const rh = (4.9 - (cards.length - 1) * rgap) / cards.length;
  cards.forEach(([v, l, col], i) => {
    const y = 1.85 + i * (rh + rgap);
    panel(s, rx, y, rw, rh, `Tracker stat ${i + 1}`);
    stat(s, rx + 0.25, y + 0.08, rw - 0.5, v, l, { size: 28, vh: 0.5, lh: rh - 0.7, ls: 13, color: col, name: `Tracker stat ${i + 1}` });
  });

  s.addNotes(
    `1:40, live. Open https://oqim-audit.vercel.app/tracker. These are ${lots.length} real car park cameras from the PKLot dataset: ${lots.map((l) => `${l.name} with ${l.capacity} spaces`).join(", ")}, one morning each from ${tracker.clock.start} to ${tracker.clock.end}. Press play. Every space is marked free or taken from the camera frame; when a space turns taken, a car came in, when it turns free, a car left. Over ${int(tEval.frames)} frames, ${pct(tEval.accuracy)} of ${int(tEval.spaces)} space readings match the dataset's hand labels. The free count is off by a median of ${tEval.freeErr.median} spaces, ${tEval.freeErr.p90} at the 90th percentile. The tracker saw ${int(tEval.events.in)} cars come in and ${int(tEval.events.out)} leave.${fc ? ` The forecast for ${fc.h} minutes ahead is off by ${f1(fc.mae)} spaces on average, against ${f1(fc.naiveMae)} for "same as now", over ${int(fc.n)} forecasts.` : ""} Then pick an arrival time and show which car park the tracker advises.`
  );
}

// ---------- slide 4: space detection accuracy (/parking) ----------
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Product and demo" });
  header(s);
  s.addText("MEASURED  ·  /parking", { placeholder: "kicker" });
  s.addText(`${pct(pTest.accuracy)} of spaces right on held-out images`, { placeholder: "title" });

  const iw = 6.9;
  const ih = iw * 9 / 16;
  panel(s, M, 1.85, iw + 0.14, ih + 0.14, "PKLot panel");
  s.addImage({ path: IMG("parking_pklot.jpg"), x: M + 0.07, y: 1.92, w: iw, h: ih, sizing: { type: "cover", w: iw, h: ih }, altText: "PKLot car park frame with labelled spaces", objectName: "PKLot frame" });
  s.addText(`Rule: ${parking.eval.rule.text}.`, { x: M, y: 1.85 + ih + 0.24, w: iw + 0.14, h: 0.7, fontFace: "Calibri", fontSize: 12, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: "Rule text" });

  const rx = M + iw + 0.45;
  const rw = W - M - rx;
  panel(s, rx, 1.85, rw, 1.45, "Accuracy card");
  stat(s, rx + 0.25, 1.93, rw - 0.5, pct(pTest.accuracy), `of ${int(pTest.spaces)} spaces right on ${int(pTest.images)} held-out images`, { size: 32, vh: 0.55, lh: 0.6, ls: 13, color: C.accent4, name: "Accuracy" });
  const hw = (rw - 0.2) / 2;
  panel(s, rx, 3.45, hw, 1.35, "Precision card");
  stat(s, rx + 0.2, 3.53, hw - 0.4, pct(pTest.precision), "precision, taken", { size: 26, vh: 0.48, lh: 0.6, ls: 13, color: C.accent1, name: "Precision" });
  panel(s, rx + hw + 0.2, 3.45, hw, 1.35, "Recall card");
  stat(s, rx + hw + 0.4, 3.53, hw - 0.4, pct(pTest.recall), "recall, taken", { size: 26, vh: 0.48, lh: 0.6, ls: 13, color: C.accent1, name: "Recall" });
  panel(s, rx, 4.95, rw, 1.8, "Weather card");
  s.addText(
    [
      { text: "By weather: ", options: { bold: true, color: C.accent1 } },
      { text: `sunny ${pct(pW.sunny.accuracy)}, cloudy ${pct(pW.cloudy.accuracy)}, rainy ${pct(pW.rainy.accuracy)}.`, options: { breakLine: true } },
      { text: "Free count: ", options: { bold: true, color: C.accent1 } },
      { text: `off by a median of ${pFree.median}, ${pFree.p90} at the 90th percentile.`, options: { breakLine: true } },
      { text: "Not measured: ", options: { bold: true, color: C.accent2 } },
      { text: "night. PKLot has no night frames." },
    ],
    { x: rx + 0.25, y: 5.02, w: rw - 0.5, h: 1.66, fontFace: "Calibri", fontSize: 14, color: C.text1, margin: 0, valign: "middle", paraSpaceAfter: 4, isTextBox: true, objectName: "Weather text" }
  );

  s.addNotes(
    `0:30. The detector itself, measured on images we did not tune on. ${int(pTest.images)} held-out PKLot images, ${int(pTest.spaces)} spaces: ${pct(pTest.accuracy)} right. When it calls a space taken it is right ${pct(pTest.precision)} of the time, and it finds ${pct(pTest.recall)} of the taken spaces. Sunny ${pct(pW.sunny.accuracy)}, cloudy ${pct(pW.cloudy.accuracy)}, rainy ${pct(pW.rainy.accuracy)}. The free count per image is off by a median of ${pFree.median} spaces. Be honest: PKLot has no night frames, so night is not measured. It runs in the browser on /parking; YOLO26n, the same model as the tracker.`
  );
}

// ---------- slide 5: the district (/city) ----------
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Product and demo" });
  header(s);
  s.addText("LIVE DEMO  ·  /city", { placeholder: "kicker" });
  s.addText("A district: drivers spread over the car parks", { placeholder: "title" });

  const iw = 6.9;
  const ih = iw / 1.6;
  panel(s, M, 1.85, iw + 0.14, ih + 0.14, "City panel");
  s.addImage({ path: IMG("city.png"), x: M + 0.07, y: 1.92, w: iw, h: ih, sizing: { type: "cover", w: iw, h: ih }, altText: "Kwun Tong district model", objectName: "City screenshot" });
  ["K810F.jpg", "K813F.jpg", "AID02207.jpg"].forEach((f, i) => {
    const tw = 1.1;
    const th = tw * 0.75;
    s.addImage({ path: MEDIA(path.join("hongkong", f)), x: M + iw + 0.07 - tw - 0.1, y: 2.02 + i * (th + 0.08), w: tw, h: th, altText: "Hong Kong traffic camera snapshot", objectName: `Camera thumb ${i + 1}` });
  });
  s.addText(`Kwun Tong, Hong Kong: ${hk.cameras.length} open traffic cameras counted by YOLO26m, live vacancy of ${hkParks.carparks.length} car parks (DATA.GOV.HK). Drivers simulated.`, { x: M, y: 1.85 + ih + 0.24, w: iw + 0.14, h: 0.55, fontFace: "Calibri", fontSize: 12, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: "City caption" });

  const rx = M + iw + 0.45;
  const rw = W - M - rx;
  panel(s, rx, 1.85, rw, 1.55, "Full car park card");
  stat(s, rx + 0.25, 1.93, rw - 0.5, "60 → 5", "drivers arriving to a full car park: nearest car park against OQIM", { size: 30, vh: 0.55, lh: 0.6, ls: 13, color: C.accent4, name: "Full" });
  const hw = (rw - 0.2) / 2;
  panel(s, rx, 3.55, hw, 1.35, "Door card");
  stat(s, rx + 0.2, 3.63, hw - 0.4, "−18%", "door to door, 15.5 to 12.7 min", { size: 26, vh: 0.48, lh: 0.6, ls: 13, color: C.accent4, name: "Door" });
  panel(s, rx + hw + 0.2, 3.55, hw, 1.35, "Km card");
  stat(s, rx + hw + 0.4, 3.63, hw - 0.4, "−41%", "vehicle-km with searching, 305 to 181", { size: 26, vh: 0.48, lh: 0.6, ls: 13, color: C.accent4, name: "Km" });
  panel(s, rx, 5.05, rw, 1.7, "How card");
  s.addText(
    [
      { text: "How: ", options: { bold: true, color: C.accent1 } },
      { text: "drivers are placed one by one. Each gets the car park and route of least door-to-door time, with the roads and spaces already taken by the drivers placed before.", options: { breakLine: true } },
      { text: "Snapshot: 13:45 Hong Kong time, 11 October.", options: { color: C.text2 } },
    ],
    { x: rx + 0.25, y: 5.12, w: rw - 0.5, h: 1.56, fontFace: "Calibri", fontSize: 13, color: C.text1, margin: 0, valign: "middle", paraSpaceAfter: 4, isTextBox: true, objectName: "How text" }
  );

  s.addNotes(
    `0:40, live. Open https://oqim-audit.vercel.app/city. One car park is not enough to advise a driver, so here is a whole district with live open data: Kwun Tong in Hong Kong, ${hk.cameras.length} Transport Department traffic cameras counted by YOLO26m, and the live free spaces of the car parks. 60 drivers head to Kwun Tong MTR station. "Nearest" sends every driver to the closest car park, as a navigator does. OQIM places drivers one by one; each gets the car park and route of least door-to-door time, counting the roads and spaces the drivers before them already took. At 13:45 Hong Kong time on 11 October the nearest car park had 0 free spaces: all 60 "nearest" drivers arrived to a full car park; with OQIM 5 did. Door to door 15.5 against 12.7 minutes, minus 18%; vehicle-km with searching 305 against 181, minus 41%. Say it clearly: the drivers are simulated, the free spaces and the camera counts are real. Press "Add drivers one by one" to show each route loading the roads the next driver sees.`
  );
}

// ---------- slide 6: how it works ----------
pres.addSection({ title: "Technology" });
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Technology" });
  header(s);
  s.addText("TECHNOLOGY AND ARCHITECTURE", { placeholder: "kicker" });
  s.addText("From a camera frame to advice", { placeholder: "title" });

  panel(s, M, 1.85, CW, 3.15, "Pipeline frame");
  s.addText("For each car park camera", { x: M + 0.3, y: 1.95, w: 7, h: 0.35, fontFace: "Arial", bold: true, fontSize: 14, color: C.text2, margin: 0, valign: "middle", isTextBox: true, objectName: "Pipeline label" });
  const boxes = [
    ["Frames", `One frame${frameStep ? ` every ${frameStep} min` : ""} from an ordinary fixed camera. The spaces are outlined once per camera.`],
    ["Detect", "YOLO26n (10 MB), whole frame plus 3 x 3 tiles at 960 px. Cars, buses and trucks."],
    ["Space state", "Taken when one box covers 40% of the space. It changes only when two frames in a row agree."],
    ["Forecast", `Free spaces, cars in and out. Free spaces ${fc ? `${fc.h} min ` : ""}ahead from the last 20 minutes' trend and the usual weekday morning.`],
    ["Advise", "Drivers placed one by one on the car park and route of least door-to-door time, counting those already sent."],
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

  const cw = (CW - 3 * 0.3) / 4;
  const y = 5.25;
  const h = 1.5;
  const cards = [
    ["10 MB", "detector, YOLO26n in ONNX Runtime Web: WebGPU or WebAssembly"],
    ["0", "GPU servers. The detector runs in a browser tab."],
    ["No plates", "and no faces are read. Only boxes over spaces."],
  ];
  cards.forEach(([v, l], i) => {
    const x = M + i * (cw + 0.3);
    panel(s, x, y, cw, h, `Tech stat ${i + 1}`);
    stat(s, x + 0.25, y + 0.1, cw - 0.5, v, l, { size: 32, vh: 0.55, lh: 0.75, ls: 13, color: i === 1 ? C.accent4 : C.accent1, name: `Tech stat ${i + 1}` });
  });
  const x4 = M + 3 * (cw + 0.3);
  panel(s, x4, y, cw, h, "Reuse card");
  s.addText(
    [
      { text: "Reused, declared: ", options: { bold: true, color: C.accent1 } },
      { text: "detector and ONNX worker from our elimination system.", options: { breakLine: true } },
      { text: "Built for the final: ", options: { bold: true, color: C.accent1 } },
      { text: "tracker, space rule and its test, district model, signal audit." },
    ],
    { x: x4 + 0.2, y: y + 0.1, w: cw - 0.4, h: h - 0.2, fontFace: "Calibri", fontSize: 13, color: C.text1, margin: 0, valign: "middle", paraSpaceAfter: 4, isTextBox: true, objectName: "Reuse text" }
  );

  s.addNotes(
    `0:40. For each car park camera: one frame${frameStep ? ` every ${frameStep} minutes` : ""}, from an ordinary fixed camera. The spaces are outlined once per camera. YOLO26n, 10 MB, finds cars, buses and trucks on the whole frame and on 3 by 3 tiles at 960 pixels, so small cars at the back are not missed. A space is taken when one box covers 40% of it, and it changes state only when two frames in a row agree, which removes most flicker. From the states we get the free count and every car in and out. The forecast takes the spaces taken now and adds the trend: half from the last 20 minutes, half from the car park's typical weekday morning, from the PKLot labels of its other weekdays. It is checked against the hand labels of the frame that many minutes later. The advice is the district model: drivers placed one by one, counting the ones already sent. The detector runs in ONNX Runtime Web, on WebGPU or WebAssembly; no GPU server, no number plates or faces read. Detector and worker are reused from our elimination system, and we say so.`
  );
}

// ---------- slide 7: budget and ROI ----------
pres.addSection({ title: "Business" });
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

  panel(s, xs[0], y, cw, h, "Pilot card");
  s.addText("Pilot with an operator", { x: xs[0] + 0.3, y: y + 0.2, w: cw - 0.6, h: 0.38, fontFace: "Arial", bold: true, fontSize: 18, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: "Pilot heading" });
  stat(s, xs[0] + 0.3, y + 0.62, cw - 0.6, "3", "months, on the operator's own cameras", { size: 48, vh: 0.75, lh: 0.32, ls: 14, name: "Pilot months" });
  s.addText(
    [
      { text: "People: ", options: { bold: true, color: C.accent1 } },
      { text: "3 engineers part time. The main cost.", options: { breakLine: true } },
      { text: "Hosting: ", options: { bold: true, color: C.accent1 } },
      { text: "static, free to USD 20 a month. No GPU server.", options: { breakLine: true } },
      { text: "Data: ", options: { bold: true, color: C.accent1 } },
      { text: "frames from cameras the operator already has. No licences to buy." },
    ],
    { x: xs[0] + 0.3, y: y + 1.95, w: cw - 0.6, h: h - 2.1, fontFace: "Calibri", fontSize: 14, color: C.text1, margin: 0, valign: "top", paraSpaceAfter: 8, isTextBox: true, objectName: "Pilot costs" }
  );

  panel(s, xs[1], y, cw, h, "Unit card");
  s.addText("Per camera", { x: xs[1] + 0.3, y: y + 0.2, w: cw - 0.6, h: 0.38, fontFace: "Arial", bold: true, fontSize: 18, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: "Unit heading" });
  stat(s, xs[1] + 0.3, y + 0.62, cw - 0.6, "0", "sensors in the ground. One camera covers the spaces it sees.", { size: 48, vh: 0.75, lh: 0.6, ls: 14, color: C.accent4, name: "Sensors" });
  s.addText(
    [
      { text: "Our cost: ", options: { bold: true, color: C.accent1 } },
      { text: "outlining the spaces once, and checking a sample of frames by hand.", options: { breakLine: true } },
      { text: "Price: ", options: { bold: true, color: C.accent1 } },
      { text: "per camera per month, set in the pilot." },
    ],
    { x: xs[1] + 0.3, y: y + 2.2, w: cw - 0.6, h: h - 2.35, fontFace: "Calibri", fontSize: 14, color: C.text1, margin: 0, valign: "top", paraSpaceAfter: 8, isTextBox: true, objectName: "Unit costs" }
  );

  panel(s, xs[2], y, cw, h, "Value card");
  s.addText("Value and payback", { x: xs[2] + 0.3, y: y + 0.2, w: cw - 0.6, h: 0.38, fontFace: "Arial", bold: true, fontSize: 18, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: "Value heading" });
  const fx = xs[2] + 0.3;
  const fw = cw - 0.6;
  panel(s, fx, y + 0.72, fw, 1.95, "Formula box", C.background1);
  s.addText(
    [
      { text: "Value a month =", options: { bold: true, color: C.accent1, breakLine: true } },
      { text: "extra spaces filled × hours × tariff, plus drivers no longer turned away at the gate", options: { breakLine: true } },
      { text: "Payback = price ÷ value a month", options: { bold: true, color: C.accent1 } },
    ],
    { x: fx + 0.18, y: y + 0.8, w: fw - 0.36, h: 1.8, fontFace: "Calibri", fontSize: 14, color: C.text1, margin: 0, valign: "middle", paraSpaceAfter: 6, isTextBox: true, objectName: "Formula" }
  );
  s.addText(
    [
      { text: "For the city: less searching traffic. The district model counts it in vehicle-km.", options: { breakLine: true } },
      { text: "We state payback from the pilot inputs, not before." },
    ],
    { x: fx, y: y + 2.85, w: fw, h: h - 3.0, fontFace: "Calibri", fontSize: 14, color: C.text1, margin: 0, valign: "top", paraSpaceAfter: 8, isTextBox: true, objectName: "Value notes" }
  );

  s.addNotes(
    "0:45. All numbers here are assumptions to check with the customer. Pilot: 3 months with one car park operator, on cameras it already has. The main cost is people, 3 engineers part time. Hosting is static, free to USD 20 a month, with no GPU server. No sensors in the ground: one camera covers the spaces it sees. Our cost per camera is outlining the spaces once and checking a sample of frames by hand. Price: per camera per month, set in the pilot. Value for the operator: extra spaces filled times hours times the tariff, plus drivers who are no longer turned away at the gate. For the city: less searching traffic, which the district model counts in vehicle-km. Payback: we state it from the pilot inputs; we do not quote a number we have not measured."
  );
}

// ---------- slide 8: why it is hard to copy ----------
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Business" });
  header(s);
  s.addText("OUR EDGE", { placeholder: "kicker" });
  s.addText("Why it is hard to copy", { placeholder: "title" });

  const rows = [
    ["A forecast, not only a count", `Free spaces for the minute you arrive${fc ? `, checked against "same as now" (${f1(fc.mae)} vs ${f1(fc.naiveMae)} spaces off, ${fc.h} min ahead)` : ""}.`, C.accent4],
    ["Drivers spread, not herded", "Each driver counts against the spaces and roads of the next. A navigator sends all of them to the nearest car park.", C.accent3],
    ["Ordinary cameras", "No sensor per space. The detector runs in a browser tab; no plates or faces are read.", C.accent1],
    ["The same cameras, more products", "Our signal audit reads traffic lights from pixels, with no controller access. That is the next stage.", C.accent2],
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
    `0:15. Four reasons. One: a forecast for the minute you arrive, not only a count${fc ? `, and it beats "same as now"` : ""}. Two: drivers are spread; each one counts against the spaces and roads of the next, while a navigator sends everyone to the nearest car park. Three: ordinary cameras, no sensor in every space, and the detector runs in a browser tab with no plates or faces read. Four: the same cameras give more products. Our signal audit reads the lights from pixels with no controller access; in the browser it agrees with our elimination lamp reader on 98.8% of frames of C3896.`
  );
}

// ---------- slide 9: next stage, the signal audit ----------
pres.addSection({ title: "Next stage" });
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Next stage" });
  header(s);
  s.addText("NEXT STAGE  ·  /audit", { placeholder: "kicker" });
  s.addText("The same cameras can later time the lights", { placeholder: "title" });

  s.addText("Signal audit from one video: the lights read from pixels, every vehicle over the stop line, then signal plans checked on a replay of the junction's own vehicles. Organisers' footage of one Tashkent junction, southbound.", { x: M, y: 1.72, w: CW, h: 0.55, fontFace: "Calibri", fontSize: 14, color: C.text2, margin: 0, valign: "middle", isTextBox: true, objectName: "Audit intro" });

  const head = ["Clip", "Length", "Cycle read", "Vehicles", "Replay check: median departure error", "Wait now", "Webster (1958)", "OQIM predictive"];
  const hcell = (t) => ({ text: t, options: { bold: true, fontFace: "Arial", fontSize: 11, color: C.text2, fill: { color: C.accent5 }, valign: "middle" } });
  const rows = [head.map(hcell)];
  const md = (c, k) => c.modes.find((m) => m.key === k).meanDelay;
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
      cell(`${f1(md(c, "measured"))} s`),
      cell(`${f1(md(c, "webster"))} s`, { color: bad ? col : C.accent2 }),
      cell(`${f1(md(c, "predictive"))} s`, { color: bad ? col : (md(c, "predictive") < md(c, "measured") ? C.accent4 : C.text1) }),
    ]);
  });
  const colW = [1.2, 1.1, 1.35, 1.25, 2.6, 1.4, 1.55, 1.68];
  const tw = colW.reduce((a, b) => a + b, 0);
  s.addTable(rows, {
    x: M, y: 2.4, w: tw, colW, rowH: [0.62, 0.46, 0.46, 0.46, 0.46],
    fontFace: "Calibri", fontSize: 15, color: C.text1,
    border: { type: "solid", pt: 0.75, color: HEX.accent5 },
    margin: [0.04, 0.1, 0.04, 0.1],
    objectName: "Audit table",
  });

  const c97 = clips.find((c) => c.clip === "C3897");
  const ww = 3.3;
  panel(s, M, 5.1, ww, 1.65, "Webster callout");
  stat(s, M + 0.25, 5.18, ww - 0.5, `${f1(md(c97, "webster"))} vs ${f1(md(c97, "measured"))} s`, `C3897: the textbook plan against the timing now. Worse on all ${clips.length} clips.`, { size: 28, vh: 0.5, lh: 0.8, ls: 13, color: C.accent2, name: "Webster" });

  const nx = M + ww + 0.3;
  panel(s, nx, 5.1, W - M - nx, 1.65, "Audit notes panel");
  s.addText(
    [
      { text: "So OQIM never recommends a plan before it replays it. ", options: { bold: true, color: C.accent1 } },
      { text: "Mean wait per vehicle on the replay, lower is better. Predictive assumes the next 30 s of arrivals are known, which needs a camera upstream. C3905 (2:08, under 2 cycles) fails the replay check, and the page says so.", options: { breakLine: true } },
      { text: "Tracks: our elimination pipeline (YOLO26m, 1280 px, 10 fps). Night and rain not yet measured on a test set of our own.", options: { color: C.text2 } },
    ],
    { x: nx + 0.25, y: 5.18, w: W - M - nx - 0.5, h: 1.5, fontFace: "Calibri", fontSize: 13, color: C.text1, margin: 0, valign: "middle", paraSpaceAfter: 4, isTextBox: true, objectName: "Audit notes" }
  );

  s.addNotes(
    `0:30. The next stage. Cameras that watch car parks and streets can also watch junctions. Our signal audit already works from one video: it reads the lights from the pixels, counts every vehicle over the stop line, and replays the junction's own vehicles to check signal plans. On ${clips.length} clips of one Tashkent junction from the organisers, the replay gives back when each vehicle left within about half a second on three clips; C3905 is too short and fails the check, and the page says so. Webster's textbook plan was worse than the timing now on all ${clips.length} clips, for example ${f1(md(c97, "webster"))} s against ${f1(md(c97, "measured"))} s on C3897. The predictive mode cut the wait on C3897 to ${f1(md(c97, "predictive"))} s, but it assumes the next 30 s of arrivals are known, which needs a camera upstream.`
  );
}

// ---------- slide 10: next stage, green wave and side tools ----------
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Next stage" });
  header(s);
  s.addText("NEXT STAGE  ·  /network AND /roads", { placeholder: "kicker" });
  s.addText("A green wave in 3D, and road damage on a map", { placeholder: "title" });

  const gap = 0.3;
  const colw = (CW - gap) / 2;
  const ih = 2.55;
  const cols = [
    {
      img: IMG("network.png"), alt: "3D corridor of Tashkent", tag: "SIMULATION",
      label: "Amir Temur Avenue, Tashkent: 1.46 km, 5 signals, 224 vehicles in 10 min, Intelligent Driver Model. Green wave against the timing now; only offsets change.",
      stats: [["141 s → 24 s", "mean delay at the signals"], ["4.58 → 0.60", "stops per vehicle"]],
    },
    {
      img: MEDIA(path.join("roads", roadsImg)), alt: "Road damage photo", tag: "MEASURED",
      label: `${roads.model.name}, in the browser, on phone photos. Measured on a ${roads.dataset.images}-image sample of the RDD2022 test split.`,
      stats: [[roads.overall.map50.toFixed(2), "mAP50"], [pct(roads.overall.precision, 0), "precision"]],
    },
  ];
  cols.forEach((c, ci) => {
    const x = M + ci * (colw + gap);
    panel(s, x, 1.85, colw, ih + 0.14, `Image panel ${ci + 1}`);
    s.addImage({ path: c.img, x: x + 0.07, y: 1.92, w: colw - 0.14, h: ih, sizing: { type: "cover", w: colw - 0.14, h: ih }, altText: c.alt, objectName: `Image ${ci + 1}` });
    s.addText(c.tag, { shape: S.ROUNDED_RECTANGLE, x: x + 0.17, y: 1.99 + ih - 0.42, w: 1.25, h: 0.3, rectRadius: 0.05, fill: { color: C.background1 }, line: { type: "none" }, fontFace: "Arial", bold: true, fontSize: 10, color: ci === 1 ? C.accent4 : C.accent3, align: "center", valign: "middle", charSpacing: 2, margin: 0, objectName: `Image ${ci + 1} tag` });
    s.addText(c.label, { x, y: 4.62, w: colw, h: 0.62, fontFace: "Calibri", fontSize: 13, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: `Column ${ci + 1} label` });
    const sw = (colw - 0.3) / 2;
    c.stats.forEach(([v, l], i) => {
      stat(s, x + i * (sw + 0.3), 5.3, sw, v, l, { size: 28, vh: 0.5, lh: 0.32, ls: 13, color: C.accent4, name: `Column ${ci + 1} stat ${i + 1}` });
    });
  });
  s.addText("Elsewhere: Copenhagen's green wave cut travel time by 17% (Centre for Public Impact); Google Project Green Light, up to 30% fewer stops (Seattle DOT).", { x: M, y: 6.42, w: CW, h: 0.45, fontFace: "Calibri", fontSize: 12, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: "Elsewhere note" });

  s.addNotes(
    `0:20. Two more pieces for later. The green wave: the vehicles from the video drive five real junctions of Amir Temur Avenue in 3D. It is a simulation, one direction, and only the offsets change, so the cross streets keep their time; the real offsets are unknown to us. Mean delay 141 s down to 24 s, stops per vehicle 4.58 down to 0.60. Copenhagen's green wave cut travel time by 17%. And a side tool: road damage from phone photos on a map, ${roads.model.name}, mAP50 ${roads.overall.map50.toFixed(2)} on a ${roads.dataset.images}-image sample of the RDD2022 test split.`
  );
}

// ---------- slide 11: team, next steps, close ----------
pres.addSection({ title: "Team" });
{
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: "Team" });
  header(s);
  s.addText("TEAM AND NEXT STEPS", { placeholder: "kicker" });
  s.addText(`Team ${team.team}`, { placeholder: "title" });

  const gap = 0.3;
  const cw = (CW - 2 * gap) / 3;
  const cols = [C.accent2, C.accent3, C.accent4];
  team.members.forEach((m, i) => {
    const x = M + i * (cw + gap);
    panel(s, x, 1.85, cw, 1.3, `Member ${i + 1} card`);
    lamp(s, x + 0.25, 2.05, 0.3, cols[i % 3], `Member ${i + 1} lamp`);
    s.addText(m.name, { x: x + 0.7, y: 1.98, w: cw - 0.9, h: 0.42, fontFace: "Arial", bold: true, fontSize: 18, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: `Member ${i + 1} name` });
    s.addText(m.role, { x: x + 0.7, y: 2.42, w: cw - 0.9, h: 0.62, fontFace: "Calibri", fontSize: 13, color: C.text2, margin: 0, valign: "top", isTextBox: true, objectName: `Member ${i + 1} role` });
  });

  const steps = [
    ["Pilot", "One car park operator, its own cameras, 3 months."],
    ["Live feed", "Frames from a live camera, not a recorded morning."],
    ["Night test", "PKLot has no night frames. A test set of our own, with hand labels."],
    ["Signals", "Then the same cameras time the lights: audit and green wave."],
  ];
  const sw = (CW - 3 * gap) / 4;
  const y = 3.45;
  s.addShape(S.LINE, { x: M + 0.3, y: y + 0.3, w: 3 * (sw + gap), h: 0, line: { color: C.accent5, width: 2 }, objectName: "Step track" });
  const scol = [C.accent4, C.accent4, C.accent3, C.accent2];
  steps.forEach(([t, d], i) => {
    const x = M + i * (sw + gap);
    lamp(s, x, y, 0.6, scol[i], `Next ${i + 1} lamp`, String(i + 1));
    s.addText(t, { x, y: y + 0.75, w: sw, h: 0.4, fontFace: "Arial", bold: true, fontSize: 18, color: C.text1, margin: 0, valign: "middle", isTextBox: true, objectName: `Next ${i + 1} title` });
    s.addText(d, { x, y: y + 1.17, w: sw - 0.15, h: 0.62, fontFace: "Calibri", fontSize: 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: `Next ${i + 1} text` });
  });

  panel(s, M, 5.55, CW, 1.2, "Closing panel");
  addLamps(s, M + 0.35, 5.9, 0.3, "Closing lamps");
  s.addText(
    [
      { text: "Thank you. Questions?", options: { bold: true, fontFace: "Arial", fontSize: 22, color: C.text1, breakLine: true } },
      { text: "Try it: ", options: { color: C.text2 } },
      { text: "https://oqim-audit.vercel.app/tracker", options: { color: C.accent1, hyperlink: { url: "https://oqim-audit.vercel.app/tracker" } } },
      { text: "     Code: ", options: { color: C.text2 } },
      { text: "https://github.com/baytoooo/oqim", options: { color: C.accent1, hyperlink: { url: "https://github.com/baytoooo/oqim" } } },
    ],
    { x: M + 2.0, y: 5.6, w: CW - 2.3, h: 1.1, fontFace: "Calibri", fontSize: 15, margin: 0, valign: "middle", paraSpaceAfter: 4, isTextBox: true, objectName: "Closing text" }
  );

  s.addNotes(
    `0:30. We are ${team.members.map((m) => m.name).join(", ")}. Next: a 3-month pilot with one car park operator on its own cameras; frames from a live camera instead of a recorded morning; a night test set of our own, because PKLot has no night frames; and then the same cameras time the lights, with the signal audit and the green wave. Thank you; we are ready for questions.`
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

// OQIM defence deck, team PariVision, WIUT Hackathon 2026, Computer Vision final.
// Run from this folder: node build.js   (writes OQIM_defence.pptx)
//
// 7 minutes of talk (11 main slides, about 2.5 minutes of it live in the browser), then a
// "Backup for questions" section (B1 to B6) for the 3 minutes of Q&A.
// The story: the parking tracker first, then the own photo, the district, the billboard counter,
// and the signal audit and green wave as the next stage.
//
// Numbers come from the data files in ../app/public/data (tracker.json, parking.json, audits.json,
// hongkong.json, hk_carparks.json, roads_eval.json, banner.json, tashkent_roads.json, team.json).
// The 40-driver example on the tracker slide is computed here with the page's own code
// (app/src/oqim/tracker.ts) on tracker.json. The few recorded runs that are in no data file (the
// Kwun Tong snapshot, the corridor, the lamp agreement) are in RECORDED below, as in docs/deck.md.
// Published facts (INRIX, Parkopedia, Tashkent) are quoted with their sources, as on /elsewhere.
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");
const pptxgen = require("pptxgenjs");
const { applyTheme } = require("./apply_theme.js");

const APP = path.join(__dirname, "..", "app");
const DATA_DIR = path.join(APP, "public", "data");
const DATA = (f) => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), "utf8"));
const MAYBE = (f) => (fs.existsSync(path.join(DATA_DIR, f)) ? DATA(f) : null);
const audits = DATA("audits.json");
const tracker = DATA("tracker.json");
const parking = DATA("parking.json");
const team = DATA("team.json");
const hk = DATA("hongkong.json");
const hkParks = DATA("hk_carparks.json");
const roads = DATA("roads_eval.json");
const tash = DATA("tashkent_roads.json");
const banner = MAYBE("banner.json");

const OUT = path.join(__dirname, "OQIM_defence.pptx");
const IMG = (f) => path.join(__dirname, "img", f);
const HAS_IMG = (f) => fs.existsSync(IMG(f));
const MEDIA = (f) => path.join(APP, "public", "media", f);
const roadsImg = fs.readdirSync(MEDIA("roads")).filter((f) => /\.jpe?g$/i.test(f)).sort()[0];
const SITE = "https://oqim-audit.vercel.app";
const CODE = "https://github.com/baytoooo/oqim";

// Recorded runs that live in no data file (docs/deck.md has the same numbers and where they come from).
const RECORDED = {
  // /city with hk_carparks.json (fetched 13:45 Hong Kong time, 11 October), 60 drivers to Kwun Tong MTR
  city: { drivers: 60, fullNearest: 60, fullOqim: 5, doorNearest: 15.5, doorOqim: 12.7, kmNearest: 305, kmOqim: 181, when: "13:45 Hong Kong time, 11 October" },
  // /network, Amir Temur Avenue northbound, Intelligent Driver Model
  corridor: { km: 1.46, signals: 5, vehicles: 224, minutes: 10, delayNow: 141, delayWave: 24, stopsNow: 4.58, stopsWave: 0.6 },
  // the browser's signal reading against our elimination lamp reader on C3896
  lampAgreement: 0.988,
};
// The moment of the tracker screenshots (img/tracker_stage.jpg, tracker_ask.jpg, tracker_spread.jpg)
const DEMO_TIME = "10:13";
const DEMO_DRIVERS = 40;

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
// chart series, checked with the dataviz validator on the panel colour (1C1E21, dark)
const SERIES = { oqim: "3D8EE6", naive: "C2831A" };

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
const Y0 = 1.85; // content top
const YB = 6.8; // content bottom

// ---------- numbers, all read from the data files ----------
const pct = (x, d = 1) => `${(x * 100).toFixed(d)}%`;
const int = (x) => Number(x).toLocaleString("en-US");
const f1 = (v) => Number(v).toFixed(1);
const f2 = (v) => Number(v).toFixed(2);
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}`;
const modelOf = (s) => (String(s).match(/YOLO[0-9a-z]+/i) || ["YOLO"])[0];
const tEval = tracker.eval;
const fc = tEval.forecast;
const fcH = tEval.forecastByH || [];
const whole = tEval.whole;
const lots = tracker.lots;
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const frameStep = lots[0].frames.length > 1 ? toMin(lots[0].frames[1].t) - toMin(lots[0].frames[0].t) : null;
const heroLot = lots[0];
const heroFrame = heroLot.frames.find((x) => x.t >= "09:00") || heroLot.frames[heroLot.frames.length - 1];
const heroWhole = heroFrame.whole || heroFrame.det;
const heroFree = [...heroWhole].filter((c) => c === "0").length;
const heroCap = heroWhole.length;
const longDate = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const trackerModel = modelOf(tracker.detector);
const pEval = parking.eval;
const pTest = pEval.test;
const pCal = pEval.calibration;
const pFree = pEval.free_count_error;
const pW = pEval.by_weather;
const pCam = pEval.by_camera;
const sug = pEval.suggest;
const parkModel = modelOf(pEval.detector);
const clips = audits.clips;
const md = (c, k) => c.modes.find((m) => m.key === k).meanDelay;
const okClips = clips.filter((c) => c.check.departureError <= 2);
const badClips = clips.filter((c) => c.check.departureError > 2);
const websterWorse = clips.filter((c) => md(c, "webster") > md(c, "measured")).length;
const depErrs = okClips.map((c) => c.check.departureError);
const hkModel = modelOf(hk.source);
const hkSnapshots = hk.cameras.reduce((a, c) => a + c.series.length, 0);
const tashJunctions = tash.junctions.length;
const tashKm = tash.edges.reduce((a, e) => a + e[2], 0) / 1000;
const B = banner || {};
const bClips = B.clips || [];
const bModel = B.method ? modelOf(B.method) : "YOLO26s";
const bRefModel = B.reference ? modelOf(B.reference) : "";
const bHand = B.handCount;
const rec = RECORDED;
const cityDrop = (a, b) => `${Math.round(((b - a) / a) * 100)}%`.replace("-", "−");

// ---------- the clock: 7:00 of talk ----------
const T = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const PLAN = [
  // [slide key, start s, end s, speaker, demo s]
  ["title", 0, 15, "Amal", 0],
  ["problem", 15, 50, "Amal", 0],
  ["tracker", 50, 120, "Komronbek", 60],
  ["measured", 120, 150, "Komronbek", 0],
  ["how", 150, 180, "Komronbek", 0],
  ["photo", 180, 215, "Aziza", 30],
  ["city", 215, 255, "Aziza", 35],
  ["banner", 255, 290, "Aziza", 25],
  ["next", 290, 320, "Aziza", 0],
  ["business", 320, 385, "Amal", 0],
  ["team", 385, 420, "Amal", 0],
];
{
  const demo = PLAN.reduce((a, p) => a + p[4], 0);
  if (PLAN[PLAN.length - 1][2] !== 420) throw new Error("the talk must end at 7:00");
  for (let i = 1; i < PLAN.length; i++) if (PLAN[i][1] !== PLAN[i - 1][2]) throw new Error("gap in the plan at " + PLAN[i][0]);
  if (demo < 140 || demo > 160) throw new Error("demo time is " + demo + " s, plan about 2.5 min");
}
const DEMO_N = Object.fromEntries(PLAN.filter((p) => p[4]).map((p, i) => [p[0], i + 1]));
const DEMO_COUNT = Object.keys(DEMO_N).length;
function timing(key) {
  const p = PLAN.find((x) => x[0] === key);
  const demo = p[4] ? ` LIVE DEMO ${DEMO_N[key]} of ${DEMO_COUNT}, about ${T(p[4])} in the browser.` : "";
  return `${T(p[1])} to ${T(p[2])} (${p[2] - p[1]} s). Speaker: ${p[3]}.${demo}`;
}

// ---------- the 40-driver example, run with the page's own code ----------
async function spreadExample() {
  try {
    const TR = await import(pathToFileURL(path.join(APP, "src", "oqim", "tracker.ts")).href);
    const src = fs.readFileSync(path.join(APP, "src", "scripts", "tracker.ts"), "utf8");
    const block = src.match(/const TRIPS: Trip\[\] = \[([\s\S]*?)\];/);
    const trips = [...block[1].matchAll(/drive:\s*([\d.]+),\s*walk:\s*([\d.]+)/g)].map((m) => ({ drive: +m[1], walk: +m[2] }));
    const sigma = (h) => {
      const b = fcH;
      if (h <= b[0].h) return Math.max(1, (b[0].rmse * h) / b[0].h);
      for (let i = 0; i + 1 < b.length; i++) if (h <= b[i + 1].h) return b[i].rmse + ((b[i + 1].rmse - b[i].rmse) * (h - b[i].h)) / (b[i + 1].h - b[i].h);
      return b[b.length - 1].rmse;
    };
    const wl = lots.map(TR.wholeLot);
    const m = TR.minutes(DEMO_TIME);
    const sp = TR.spread(wl, m, trips, sigma, DEMO_DRIVERS);
    const opts = TR.options(wl, m, trips, sigma);
    const best = opts.reduce((b, o) => (o.cost < b.cost ? o : b));
    return { ...sp, best: { name: lots[best.lot].name, free: Math.round(best.freeAtArrival), chance: best.chance }, trips };
  } catch (e) {
    console.warn("spread example skipped:", e.message);
    return null;
  }
}

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
    { placeholder: { options: { name: "kicker", type: "body", x: M + 0.98, y: 0.34, w: 10.5, h: 0.34, fontFace: "Arial", fontSize: 12, bold: true, color: C.accent1, charSpacing: 3, valign: "middle", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.78, w: CW, h: 0.8, fontFace: "Arial", fontSize: 36, bold: true, color: C.text1, align: "left", valign: "middle", margin: 0 }, text: "" } },
    { text: { text: FOOTER, options: { x: M, y: 7.0, w: 9.5, h: 0.3, fontFace: "Calibri", fontSize: 10, color: C.text2, margin: 0, valign: "middle" } } },
  ],
  slideNumber: { x: W - M - 0.8, y: 7.0, w: 0.8, h: 0.3, fontFace: "Calibri", fontSize: 10, color: HEX.dk2, align: "right" },
});

function content(section, kicker, title) {
  const s = pres.addSlide({ masterName: "OQIM Content", sectionTitle: section });
  addLamps(s, M, 0.35, 0.16, "Signal lamps");
  s.addText(kicker, { placeholder: "kicker" });
  s.addText(title, { placeholder: "title" });
  return s;
}
function panel(slide, x, y, w, h, name, fill) {
  slide.addShape(S.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill || C.background2 }, line: { color: C.accent5, width: 0.75 }, objectName: name });
}
// an image in a panel; h is the image height
function shot(slide, file, x, y, w, h, alt, name) {
  panel(slide, x, y, w + 0.14, h + 0.14, name + " panel");
  slide.addImage({ path: file, x: x + 0.07, y: y + 0.07, w, h, sizing: { type: "cover", w, h }, altText: alt, objectName: name });
}
function stat(slide, x, y, w, value, label, opts = {}) {
  const vs = opts.size || 44;
  const vh = opts.vh || vs / 72 + 0.12;
  slide.addText(value, { x, y, w, h: vh, fontFace: "Arial", bold: true, fontSize: vs, color: opts.color || C.accent1, margin: 0, valign: "bottom", isTextBox: true, fit: "none", objectName: (opts.name || "Stat") + " value" });
  slide.addText(label, { x, y: y + vh + 0.06, w, h: opts.lh || 0.6, fontFace: "Calibri", fontSize: opts.ls || 14, color: C.text1, margin: 0, valign: "top", isTextBox: true, objectName: (opts.name || "Stat") + " label" });
}
// a card: panel plus stat
function card(slide, x, y, w, h, value, label, opts = {}) {
  panel(slide, x, y, w, h, (opts.name || "Card") + " panel");
  const size = opts.size || 28;
  const vh = opts.vh || size / 72 + 0.1;
  stat(slide, x + 0.22, y + 0.1, w - 0.44, value, label, { size, vh, lh: h - vh - 0.25, ls: opts.ls || 13, color: opts.color, name: opts.name });
}
function text(slide, runs, x, y, w, h, opts = {}) {
  slide.addText(runs, Object.assign({ x, y, w, h, fontFace: "Calibri", fontSize: 13, color: C.text1, margin: 0, valign: "top", isTextBox: true, paraSpaceAfter: 4 }, opts));
}
function heading(slide, t, x, y, w, opts = {}) {
  slide.addText(t, Object.assign({ x, y, w, h: 0.36, fontFace: "Arial", bold: true, fontSize: 16, color: C.text1, margin: 0, valign: "middle", isTextBox: true }, opts));
}
const B_ = (t, color) => ({ text: t, options: { bold: true, color: color || C.accent1 } });
const P_ = (t, extra = {}) => ({ text: t, options: Object.assign({ breakLine: true }, extra) });
const bullet = (t, extra = {}) => ({ text: t, options: Object.assign({ bullet: { indent: 14 }, breakLine: true }, extra) });
function tag(slide, t, x, y, color, w = 1.3) {
  slide.addText(t, { shape: S.ROUNDED_RECTANGLE, x, y, w, h: 0.3, rectRadius: 0.05, fill: { color: C.background1 }, line: { type: "none" }, fontFace: "Arial", bold: true, fontSize: 10, color, align: "center", valign: "middle", charSpacing: 2, margin: 0, objectName: `Tag ${t}` });
}

async function build() {
  const ex = await spreadExample();

  // ================= 1. title =================
  pres.addSection({ title: "Opening" });
  {
    const s = pres.addSlide({ masterName: "OQIM Title", sectionTitle: "Opening" });
    addLamps(s, M, 0.75, 0.2, "Signal lamps");
    s.addText("WIUT HACKATHON 2026  ·  COMPUTER VISION FINAL", { placeholder: "kicker" });
    s.addText("OQIM", { placeholder: "title" });
    s.addText([{ text: "A parking tracker", options: { breakLine: true } }, { text: "from car park cameras" }], { placeholder: "subtitle" });
    s.addText("MODE: STARTUP", { shape: S.ROUNDED_RECTANGLE, x: M, y: 4.05, w: 3.0, h: 0.62, rectRadius: 0.12, fill: { color: C.accent1 }, line: { type: "none" }, fontFace: "Arial", bold: true, fontSize: 22, color: C.background1, align: "center", valign: "middle", charSpacing: 2, margin: 0, objectName: "Mode badge" });
    text(s, [
      { text: `Team ${team.team}`, options: { bold: true, fontSize: 18, color: C.text1, breakLine: true } },
      { text: team.members.map((m) => m.name).join(", "), options: { fontSize: 16, color: C.text1, breakLine: true } },
      { text: team.university, options: { fontSize: 16, color: C.text2 } },
    ], M, 4.95, 6.0, 1.05, { paraSpaceAfter: 2, objectName: "Team" });
    text(s, [
      { text: "Live   ", options: { color: C.text2 } },
      { text: `${SITE}/tracker`, options: { color: C.accent1, hyperlink: { url: `${SITE}/tracker` }, breakLine: true } },
      { text: "Code   ", options: { color: C.text2 } },
      { text: CODE, options: { color: C.accent1, hyperlink: { url: CODE } } },
    ], M, 6.15, 6.0, 0.7, { fontSize: 15, objectName: "Links" });

    panel(s, 6.85, 1.25, 5.88, 3.43, "Frame panel");
    s.addImage({ path: IMG("tracker_frame.jpg"), x: 6.92, y: 1.32, w: 5.74, h: 3.29, sizing: { type: "cover", w: 5.74, h: 3.29 }, altText: "PKLot camera frame of the PUCPR car park with every space marked free or taken", objectName: "Car park frame" });
    text(s, `The ${heroLot.name} car park camera at ${heroFrame.t} on ${longDate(heroLot.date)} (PKLot dataset). Green: free, red: taken, as our detector read the frame; dashed: spaces the camera found outside the hand labels.`, 6.85, 4.8, 5.88, 0.55, { fontSize: 11, color: C.text2, objectName: "Frame caption" });
    [heroLot.name, heroFrame.t, `${heroFree} free of ${heroCap}`].forEach((t, i) => {
      const widths = [1.2, 1.0, 2.0];
      const x = 6.85 + widths.slice(0, i).reduce((a, b) => a + b + 0.15, 0);
      s.addText(t, { shape: S.ROUNDED_RECTANGLE, x, y: 5.55, w: widths[i], h: 0.42, rectRadius: 0.06, fill: { color: C.background2 }, line: { color: C.accent5, width: 0.75 }, fontFace: "Arial", bold: true, fontSize: 13, color: i === 0 ? C.accent1 : C.text1, align: "center", valign: "middle", margin: 0, objectName: `Frame chip ${i + 1}` });
    });
    text(s, [B_("Live today:  ", C.text2), { text: "/tracker   /parking   /city   /banner", options: { color: C.text1, bold: true } }], 6.85, 6.15, 5.88, 0.35, { fontSize: 14, valign: "middle", objectName: "Demo pages" });

    s.addNotes(`${timing("title")} Good morning. We are team ${team.team} from ${team.university}: ${team.members.map((m) => m.name).join(", ")}. Our mode is Startup (say it out loud, the rules ask for it). OQIM turns cameras that already watch car parks and roads into counts: free spaces, cars in and out, vehicles past a billboard. The main product is a parking tracker. On the right: a real car park at ${heroFrame.t}, ${heroFree} free spaces of ${heroCap}. Today we show four live pages in the browser.`);
  }

  // ================= 2. problem =================
  pres.addSection({ title: "Problem" });
  {
    const s = content("Problem", "PROBLEM AND USER", "Drivers circle because they cannot see free spaces");
    const cw = (CW - 2 * 0.3) / 3;
    [
      ["17 h", "a year a US driver spends searching for parking (INRIX, 2017)", C.accent2],
      ["~5%", "of off-street car parks publish live free spaces (Parkopedia)", C.accent3],
      ["13,208", "paid spaces on 86 streets planned by Poytaxt Parking, Tashkent", C.accent1],
    ].forEach(([v, l, col], i) => {
      const x = M + i * (cw + 0.3);
      panel(s, x, Y0, cw, 1.75, `Stat card ${i + 1}`);
      stat(s, x + 0.3, 1.97, cw - 0.6, v, l, { size: 48, color: col, lh: 0.6, name: `Stat ${i + 1}` });
    });
    text(s, [
      { text: "SFpark in San Francisco cut cruising for parking by 50% on its pilot blocks.  ", options: { color: C.text1 } },
      { text: "Sources: INRIX, Parkopedia, Spot.uz, ACCESS Magazine", options: { color: C.text2 } },
    ], M, 3.72, CW, 0.35, { fontSize: 14, valign: "middle", objectName: "Evidence line" });

    const lw = 6.2;
    panel(s, M, 4.25, lw, 2.5, "Why panel");
    heading(s, "How a driver finds a space today", M + 0.3, 4.4, lw - 0.6, { fontSize: 18 });
    text(s, [
      bullet("Picks a car park by distance or habit, and learns it is full at the gate."),
      bullet("Drives on to the next one. While searching, the car is part of the traffic."),
      bullet("A navigator sends every driver to the same nearest car park.", { breakLine: false }),
    ], M + 0.3, 4.88, lw - 0.6, 1.75, { fontSize: 15, paraSpaceAfter: 6, objectName: "Why bullets" });

    const ux = M + lw + 0.3;
    const uw = CW - lw - 0.3;
    panel(s, ux, 4.25, uw, 2.5, "User panel");
    lamp(s, ux + 0.3, 4.46, 0.22, C.accent4, "User lamp");
    heading(s, "The user, and who pays", ux + 0.65, 4.4, uw - 1, { fontSize: 18 });
    text(s, [
      P_("User: drivers going to malls, offices, hospitals and stations."),
      { text: "Who pays:", options: { bold: true, color: C.accent1, breakLine: true } },
      bullet("car park operators: fewer drivers turned away"),
      bullet("the city: less searching traffic"),
      bullet("outdoor advertising: traffic past each billboard", { breakLine: false }),
    ], ux + 0.3, 4.86, uw - 0.6, 1.8, { fontSize: 14, paraSpaceAfter: 3, objectName: "User text" });

    s.addNotes(`${timing("problem")} A driver picks a car park by distance or habit and finds out it is full at the gate. Then they drive on to the next one, and while they search, that car is part of the traffic. INRIX found US drivers spend 17 hours a year searching for parking. Parkopedia says only about 5% of off-street car parks publish live free spaces. In Tashkent, Poytaxt Parking plans paid parking on 86 streets with 13,208 spaces, first come, first served. Where drivers are shown the space, it works: SFpark cut cruising by 50% on its pilot blocks. Our user is the driver. Three customers pay: car park operators, the city, and outdoor advertising companies, who need counted traffic past each billboard. Hand over to Komronbek for the demo.`);
  }

  // ================= 3. tracker, live =================
  pres.addSection({ title: "Product and demo" });
  {
    const s = content("Product and demo", `LIVE DEMO ${DEMO_N.tracker} OF ${DEMO_COUNT}  ·  /tracker  ·  THE MAIN PRODUCT`, "Free spaces now, and when you arrive");
    const rw = 3.9;
    const lw = CW - rw - 0.3;
    const iw = lw - 0.14;
    const ih = (iw * 1078) / 2400;
    shot(s, IMG("tracker_stage.jpg"), M, Y0, iw, ih, `The tracker page at ${DEMO_TIME}: the PUCPR camera with every space marked, and the three car parks`, "Tracker stage");
    const steps = ["Play the morning", "Whole car park", "One driver asks", `${DEMO_DRIVERS} drivers ask`];
    const chipW = (lw - 3 * 0.12) / 4;
    const cy = Y0 + ih + 0.14 + 0.13;
    steps.forEach((t, i) => {
      const x = M + i * (chipW + 0.12);
      panel(s, x, cy, chipW, 0.5, `Step ${i + 1} chip`);
      lamp(s, x + 0.1, cy + 0.11, 0.28, C.accent1, `Step ${i + 1} lamp`, String(i + 1));
      text(s, t, x + 0.46, cy, chipW - 0.52, 0.5, { fontSize: 12, bold: true, valign: "middle", objectName: `Step ${i + 1} text` });
    });
    text(s, [
      { text: `${SITE}/tracker`, options: { color: C.accent1, hyperlink: { url: `${SITE}/tracker` } } },
      { text: `   ${lots.length} PKLot cameras, one clock, ${tracker.clock.start} to ${tracker.clock.end}${frameStep ? `, a frame every ${frameStep} min` : ""}`, options: { color: C.text2 } },
    ], M, cy + 0.62, lw, 0.3, { fontSize: 13, valign: "middle", objectName: "Demo link" });
    text(s, "Labelled spaces: " + lots.map((l) => `${l.name} ${l.capacity} (${l.date})`).join(",  "), M, cy + 0.94, lw, 0.28, { fontSize: 11, color: C.text2, valign: "middle", objectName: "Lots line" });

    const rx = M + lw + 0.3;
    const riw = rw - 0.14;
    const ah = (riw * 732) / 1082;
    const sh = (riw * 500) / 1082;
    shot(s, IMG("tracker_ask.jpg"), rx, Y0, riw, ah, "Advice for one driver: the car park to drive to, free spaces expected on arrival and the chance of a space", "Ask now");
    shot(s, IMG("tracker_spread.jpg"), rx, Y0 + ah + 0.24, riw, sh, `${DEMO_DRIVERS} drivers asking at once: every navigator to the nearest car park against OQIM`, "Spread");
    const cap = ex ? `At ${DEMO_TIME}, ${DEMO_DRIVERS} drivers: the nearest car park leaves ${ex.nearest.full} of ${DEMO_DRIVERS} at a full gate, OQIM ${ex.oqim.full} of ${DEMO_DRIVERS}.` : `At ${DEMO_TIME}, ${DEMO_DRIVERS} drivers asking at once.`;
    text(s, cap, rx, Y0 + ah + sh + 0.45, rw, 0.42, { fontSize: 11, color: C.text2, objectName: "Spread caption" });

    const exNote = ex ? ` At ${DEMO_TIME} it says: drive to ${ex.best.name}, about ${ex.best.free} spaces free when you get there. With ${DEMO_DRIVERS} drivers, every navigator sends all of them to ${lots[ex.nearest.counts.indexOf(DEMO_DRIVERS)].name} and ${ex.nearest.full} find it full; OQIM places them one by one, counting the drivers already sent (${ex.oqim.counts.map((c, i) => `${lots[i].name} ${c}`).join(", ")}), and ${ex.oqim.full} find it full.` : "";
    s.addNotes(`${timing("tracker")} CLICK: switch to the browser, tab 1, ${SITE}/tracker (opened before the talk). Press Play if it stopped; it restarts at ${tracker.clock.start}. SAY: These are ${lots.length} real car park cameras from the PKLot dataset, one morning each, replayed on one clock. Every space is free or taken from the camera frame. Orange flash: a car came in. White: a car left. The number top right is the free spaces now. CLICK "Labelled spaces", then "Whole car park": the dataset labels only part of each car park; the dashed spaces are the ones the tracker found itself, wherever a car stays 20 minutes. That adds ${int(whole.extra)} spaces. CLICK: drag the time slider to about ${DEMO_TIME}, press Pause. SAY: Ask now: the right panel tells one driver where to go, with the free spaces forecast for the minute they arrive.${exNote} CLICK: leave the Drivers slider at ${DEMO_DRIVERS}, point at the two boxes. Back to the slides. If the internet is slow, stay on this slide: the screenshots are the same page at ${DEMO_TIME}.`);
  }

  // ================= 4. tracker, measured =================
  {
    const s = content("Product and demo", "MEASURED  ·  /tracker AGAINST THE PKLOT HAND LABELS", `${pct(tEval.accuracy)} of space readings right`);
    const lw = 6.6;
    const cw = (lw - 0.2) / 2;
    const ch = 1.5;
    card(s, M, Y0, cw, ch, pct(tEval.accuracy), `of ${int(tEval.spaces)} space readings right, ${int(tEval.frames)} frames of ${lots.length} cameras`, { color: C.accent4, name: "Accuracy" });
    card(s, M + cw + 0.2, Y0, cw, ch, `${tEval.freeErr.median} / ${tEval.freeErr.p90}`, "spaces the free count is off by, median / 90th percentile, per frame", { name: "Free count" });
    card(s, M, Y0 + ch + 0.15, cw, ch, `+${int(whole.extra)} spaces`, `found outside the ${int(whole.labelled)} hand-labelled ones, from where cars stay 20 min`, { color: C.accent3, name: "Whole" });
    card(s, M + cw + 0.2, Y0 + ch + 0.15, cw, ch, `${int(whole.labelledFound)} of ${int(whole.labelledUsed)}`, "labelled spaces that cars used, found the same way: the check for the method", { color: C.accent4, name: "Whole check" });
    const ny = Y0 + 2 * (ch + 0.15);
    panel(s, M, ny, lw, YB - ny, "Method panel");
    text(s, [
      B_("How it was checked: "), P_(`every frame against the dataset's hand labels. Same rule as /parking, picked on its ${int(pCal.images)} calibration images. Cars seen on the labelled spaces: ${int(tEval.events.in)} in, ${int(tEval.events.out)} out.`),
      B_("Be clear: ", C.accent2), { text: "recorded mornings of a public dataset, not a live feed yet." },
    ], M + 0.25, ny + 0.12, lw - 0.5, YB - ny - 0.2, { fontSize: 13, valign: "middle", objectName: "Method text" });

    const rx = M + lw + 0.3;
    const rw = W - M - rx;
    panel(s, rx, Y0, rw, YB - Y0, "Chart panel");
    heading(s, "Forecast error by minutes ahead", rx + 0.25, Y0 + 0.12, rw - 0.5, { fontSize: 15 });
    text(s, "mean spaces off, three car parks", rx + 0.25, Y0 + 0.47, rw - 0.5, 0.26, { fontSize: 12, color: C.text2, objectName: "Chart subtitle" });
    s.addChart(pres.charts.LINE, [
      { name: "OQIM forecast", labels: fcH.map((x) => String(x.h)), values: fcH.map((x) => x.mae) },
      { name: '"Same as now"', labels: fcH.map((x) => String(x.h)), values: fcH.map((x) => x.naiveMae) },
    ], {
      x: rx + 0.15, y: Y0 + 0.78, w: rw - 0.3, h: 3.05,
      chartColors: [SERIES.oqim, SERIES.naive], lineSize: 2, lineDataSymbol: "circle", lineDataSymbolSize: 8,
      showLegend: true, legendPos: "t", legendFontFace: "Calibri", legendFontSize: 12, legendColor: HEX.dk1,
      catAxisLabelColor: HEX.dk2, valAxisLabelColor: HEX.dk2, catAxisLabelFontFace: "Calibri", valAxisLabelFontFace: "Calibri", catAxisLabelFontSize: 11, valAxisLabelFontSize: 11,
      showCatAxisTitle: true, catAxisTitle: "minutes ahead", catAxisTitleColor: HEX.dk2, catAxisTitleFontSize: 11,
      valAxisMinVal: 0, valGridLine: { color: HEX.accent5, size: 0.5 }, catGridLine: { style: "none" },
      catAxisLineShow: false, valAxisLineShow: false,
      showValue: false, plotArea: { fill: { color: HEX.lt2 } }, objectName: "Forecast chart",
    });
    text(s, [
      B_(`${fc.h} min ahead: `), P_(`${f1(fc.mae)} spaces off, against ${f1(fc.naiveMae)} for "same as now", over ${int(fc.n)} forecasts.`),
      { text: "Trend: half the last 20 minutes, half the car park's typical weekday, from the labels of its other days.", options: { color: C.text2 } },
    ], rx + 0.25, Y0 + 3.92, rw - 0.5, YB - Y0 - 4.0, { fontSize: 12.5, objectName: "Chart caption" });

    s.addNotes(`${timing("measured")} How well it works, against the dataset's hand labels. Over ${int(tEval.frames)} frames, ${pct(tEval.accuracy)} of ${int(tEval.spaces)} space readings are right. The free count is off by a median of ${tEval.freeErr.median} space, ${tEval.freeErr.p90} at the 90th percentile. The whole car park: ${int(whole.extra)} spaces found outside the ${int(whole.labelled)} labelled ones; on the labelled part, the same method finds ${int(whole.labelledFound)} of the ${int(whole.labelledUsed)} spaces cars used, which is how we know it works. The forecast ${fc.h} minutes ahead is off by ${f1(fc.mae)} spaces against ${f1(fc.naiveMae)} for "same as now", over ${int(fc.n)} forecasts, and it stays better at every horizon on the chart. Say clearly: these are recorded mornings of a public dataset, not a live feed yet.`);
  }

  // ================= 5. how it works =================
  {
    const s = content("Product and demo", "TECHNOLOGY AND ARCHITECTURE", "From a camera frame to advice");
    panel(s, M, Y0, CW, 3.15, "Pipeline frame");
    text(s, "For each camera, the same pipeline on every page", M + 0.3, 1.95, 8, 0.35, { fontFace: "Arial", bold: true, fontSize: 14, color: C.text2, valign: "middle", objectName: "Pipeline label" });
    const boxes = [
      ["Frames", `One frame${frameStep ? ` every ${frameStep} min` : ""} from an ordinary fixed camera, or a photo, or a video.`],
      ["Detect", `${trackerModel} on the tracker frames; ${parkModel} (10 MB) in the browser. Whole frame plus 3 x 3 tiles at 960 px.`],
      ["Space state", `Taken when one box covers ${Math.round(parking.rule.coverage * 100)}% of the space. It changes only when two frames in a row agree.`],
      ["Forecast", `Free spaces, cars in and out. Free spaces ${fc.h} min ahead from the last 20 minutes and the usual weekday.`],
      ["Advise", "Drivers placed one by one on the car park and route of least door-to-door time, counting those already sent."],
    ];
    const gap = 0.3;
    const bw = (CW - 0.6 - 4 * gap) / 5;
    boxes.forEach(([t, d], i) => {
      const x = M + 0.3 + i * (bw + gap);
      panel(s, x, 2.42, bw, 2.4, `Arch box ${i + 1}`, C.background1);
      text(s, t, x + 0.18, 2.55, bw - 0.36, 0.38, { fontFace: "Arial", bold: true, fontSize: 15, color: C.accent1, valign: "middle", objectName: `Arch box ${i + 1} title` });
      text(s, d, x + 0.18, 2.98, bw - 0.36, 1.78, { fontSize: 14, objectName: `Arch box ${i + 1} text` });
      if (i < 4) s.addShape(S.ISOSCELES_TRIANGLE, { x: x + bw + gap / 2 - 0.08, y: 3.55, w: 0.16, h: 0.12, rotate: 90, fill: { color: C.accent1 }, line: { type: "none" }, objectName: `Arch arrow ${i + 1}` });
    });
    const cw = (CW - 3 * 0.3) / 4;
    const y = 5.25;
    const h = 1.5;
    [
      ["10 MB", `detector, ${parkModel} in ONNX Runtime Web: WebGPU or WebAssembly`, C.accent1],
      ["0", "GPU servers. The detector runs in a browser tab.", C.accent4],
      ["No plates", "and no faces are read. Only vehicle boxes.", C.accent1],
      ["4 pages", "one pipeline: tracker, own photo, district, billboard counter", C.accent3],
    ].forEach(([v, l, col], i) => card(s, M + i * (cw + 0.3), y, cw, h, v, l, { size: 32, vh: 0.55, ls: 13, color: col, name: `Tech stat ${i + 1}` }));

    s.addNotes(`${timing("how")} One pipeline for every page. A frame from an ordinary fixed camera${frameStep ? `, one every ${frameStep} minutes on PKLot` : ""}. ${trackerModel} on the tracker frames, and the 10 MB ${parkModel} in the browser, find cars, buses and trucks on the whole frame and on 3 by 3 tiles at 960 pixels, so small cars at the back are not missed. A space is taken when one box covers ${Math.round(parking.rule.coverage * 100)}% of it, and it changes state only when two frames in a row agree, which removes most flicker. From the states we get the free count and every car in and out. The forecast adds the trend: half from the last 20 minutes, half from the car park's typical weekday. The advice places drivers one by one. Everything runs in ONNX Runtime Web on WebGPU or WebAssembly: no GPU server, no plates or faces read. Hand over to Aziza.`);
  }

  // ================= 6. own photo, live =================
  {
    const s = content("Product and demo", `LIVE DEMO ${DEMO_N.photo} OF ${DEMO_COUNT}  ·  /parking`, "Your own photo, no hand marking");
    const lw = 7.0;
    const iw = lw - 0.14;
    const ih = (iw * 932) / 1656;
    shot(s, IMG("parking_upload.jpg"), M, Y0, iw, ih, "A car park photo loaded on /parking: cars marked as taken spaces and gaps in rows of cars as suggested free spaces", "Own photo");
    text(s, [
      B_("Red: ", C.accent2), { text: "every car found is a taken space.  " },
      B_("Dashed green: ", C.accent4), P_("a gap in a row of cars that fits a car is a suggested free space."),
      { text: "A PKLot frame loaded as your own photo, no hand labels used. Far rows are also read on 5 x 5 tiles, each enlarged.", options: { color: C.text2 } },
    ], M, Y0 + ih + 0.24, lw, YB - Y0 - ih - 0.24, { fontSize: 12, objectName: "Photo caption" });

    const rx = M + lw + 0.3;
    const rw = W - M - rx;
    const hw = (rw - 0.2) / 2;
    card(s, rx, Y0, hw, 1.45, pct(sug.takenFound), "of taken spaces found from the photo alone", { color: C.accent4, name: "Taken found" });
    card(s, rx + hw + 0.2, Y0, hw, 1.45, pct(sug.suggestedRight), "of suggested free spaces really are free", { color: C.accent4, name: "Suggested right" });
    text(s, [B_("Checked on ", C.accent3), B_(`${int(sug.images)} PKLot images`, C.accent3), { text: ": the same images its settings were picked on. Not held out.", options: { color: C.accent3 } }], rx, Y0 + 1.55, rw, 0.55, { fontSize: 13, valign: "middle", objectName: "Suggest caveat" });
    card(s, rx, Y0 + 2.2, rw, 1.45, pct(pTest.accuracy), `of ${int(pTest.spaces)} spaces right on ${int(pTest.images)} held-out images when the spaces are marked; the rule was picked on ${int(pCal.images)} other images`, { name: "Held out" });
    panel(s, rx, Y0 + 3.8, rw, YB - Y0 - 3.8, "Limit panel");
    text(s, [B_("Limit: ", C.accent2), { text: `it suggests ${pct(sug.freeFound)} of all free spaces. A free space with no car on either side, such as an empty row, cannot be seen in one photo: draw it with 4 clicks.` }], rx + 0.22, Y0 + 3.9, rw - 0.44, YB - Y0 - 4.0, { fontSize: 13, valign: "middle", objectName: "Limit text" });

    s.addNotes(`${timing("photo")} CLICK (Komronbek): tab 2, ${SITE}/parking. Press "Choose a photo" and pick the car park photo saved on the desktop. Wait a few seconds; the status line says how many detector runs it made and how long they took, on this laptop. SAY (Aziza): A new car park should not need anyone to draw every space by hand. From one photo, every car is a taken space and every gap in a row of cars that fits a car is a suggested free space. The far rows are read again on 5 by 5 tiles, each enlarged. Click a space to remove it, or 4 corners to add one. Be honest about the numbers: on ${int(sug.images)} PKLot images it finds ${pct(sug.takenFound, 0)} of the taken spaces, and ${pct(sug.suggestedRight, 0)} of the free spaces it suggests are free, but its settings were picked on those same images. The held-out number is for marked spaces: ${pct(pTest.accuracy)} on ${int(pTest.images)} images it never saw. It suggests only ${pct(sug.freeFound, 0)} of all free spaces: an empty row has no cars to line up against.`);
  }

  // ================= 7. district, live =================
  {
    const s = content("Product and demo", `LIVE DEMO ${DEMO_N.city} OF ${DEMO_COUNT}  ·  /city  ·  KWUN TONG, HONG KONG`, `A district: ${hk.cameras.length} live cameras and car parks`);
    const lw = 6.9;
    const iw = lw - 0.14;
    const wh = (iw * 335) / 2285;
    const mh = YB - Y0 - wh - 0.14 - 0.14 - 0.12 - 0.34;
    shot(s, IMG("city.png"), M, Y0, iw, mh, "Kwun Tong district model: roads coloured by load, car parks with free spaces", "City map");
    shot(s, IMG("city_wall_row.jpg"), M, Y0 + mh + 0.26, iw, wh, "The district's cameras as OQIM counted their last snapshot, with vehicle boxes", "Camera wall");
    text(s, `Transport Department cameras (DATA.GOV.HK), ${int(hkSnapshots)} snapshots counted by ${hkModel}; boxes in orange. Live vacancy of ${hkParks.carparks.length} car parks.`, M, YB - 0.32, lw, 0.32, { fontSize: 11, color: C.text2, valign: "middle", objectName: "City caption" });

    const rx = M + lw + 0.3;
    const rw = W - M - rx;
    const c = rec.city;
    card(s, rx, Y0, rw, 1.5, `${c.fullNearest} → ${c.fullOqim}`, `of ${c.drivers} drivers arrive to a full car park: nearest car park against OQIM`, { size: 30, vh: 0.55, color: C.accent4, name: "Full" });
    const hw = (rw - 0.2) / 2;
    card(s, rx, Y0 + 1.65, hw, 1.35, cityDrop(c.doorNearest, c.doorOqim), `door to door, ${f1(c.doorNearest)} to ${f1(c.doorOqim)} min`, { size: 26, vh: 0.48, color: C.accent4, name: "Door" });
    card(s, rx + hw + 0.2, Y0 + 1.65, hw, 1.35, cityDrop(c.kmNearest, c.kmOqim), `vehicle-km with searching, ${c.kmNearest} to ${c.kmOqim}`, { size: 26, vh: 0.48, color: C.accent4, name: "Km" });
    panel(s, rx, Y0 + 3.15, rw, YB - Y0 - 3.15, "How card");
    text(s, [
      B_("How: "), P_("drivers are placed one by one. Each gets the car park and route of least door-to-door time, with the roads and spaces already taken by the drivers before."),
      B_("Measured: ", C.accent4), P_("camera counts and car park vacancy.  "),
      B_("Simulated: ", C.accent3), P_("the drivers."),
      { text: `Snapshot: ${c.when}. The live page shows today's numbers.`, options: { color: C.text2 } },
    ], rx + 0.25, Y0 + 3.25, rw - 0.5, YB - Y0 - 3.35, { fontSize: 13, valign: "middle", paraSpaceAfter: 3, objectName: "How text" });

    s.addNotes(`${timing("city")} CLICK (Komronbek): tab 3, ${SITE}/city (opened before; the map and live data need the internet). SAY (Aziza): One car park is not enough to advise a driver, so here is a whole district with live open data: Kwun Tong in Hong Kong. ${hk.cameras.length} Transport Department cameras, counted by ${hkModel}; the road colours come from those counts. The circles are car parks with their live free spaces. CLICK "Everyone to the nearest car park", then "OQIM: spread by cost", and point at the table: arrive to a full car park, door to door, vehicle-km. SAY: the nearest car park is what a navigator does; OQIM counts the drivers it already sent. On the slide is our snapshot at ${c.when}: ${c.fullNearest} of ${c.drivers} drivers to a full car park against ${c.fullOqim}, door to door ${f1(c.doorNearest)} against ${f1(c.doorOqim)} minutes, vehicle-km ${c.kmNearest} against ${c.kmOqim}. The live numbers now will be different, because the car parks are live. The drivers are simulated; the camera counts and free spaces are real. If there is time, scroll down to the camera wall: every box is a vehicle the detector found.`);
  }

  // ================= 8. billboard counter, live =================
  {
    const s = content("Product and demo", `NEW  ·  LIVE DEMO ${DEMO_N.banner} OF ${DEMO_COUNT}  ·  /banner`, "How many vehicles pass your billboard");
    const lw = 6.2;
    const iw = lw - 0.14;
    if (HAS_IMG("banner_video.jpg") && HAS_IMG("banner_minutes.jpg")) {
      // screenshots of /banner after counting sample C3896 in the browser
      const vh = (iw * 710) / 1468;
      const mh = (iw * 510) / 2320;
      shot(s, IMG("banner_video.jpg"), M, Y0, iw, vh, "The billboard counter on sample C3896: boxes on the vehicles, green when a vehicle crosses the line", "Banner video");
      text(s, "Vehicles per minute past the line, sample C3896 (5 min 40 s)", M, Y0 + vh + 0.17, lw, 0.24, { fontSize: 11, color: C.text2, valign: "middle", objectName: "Minutes label" });
      shot(s, IMG("banner_minutes.jpg"), M, YB - mh - 0.14, iw, mh, "Vehicles that passed the line in each minute of the sample clip", "Banner minutes");
    } else {
      const ih = (iw * 540) / 960;
      shot(s, IMG("c3896_frame.jpg"), M, Y0, iw, ih, "Sample clip C3896, the organisers' footage of a Tashkent junction", "Banner frame");
    }

    const rx = M + lw + 0.3;
    const rw = W - M - rx;
    const ph = 1.62;
    panel(s, rx, Y0, rw, ph, "Counts panel");
    heading(s, "Draw one line in front of the billboard", rx + 0.25, Y0 + 0.08, rw - 0.5, { fontSize: 15 });
    text(s, [
      bullet("each tracked vehicle is counted once, when it crosses the line"),
      bullet("by type (car, bus, truck, motorcycle) and direction"),
      bullet("per minute and per hour; a log per billboard; CSV", { breakLine: false }),
    ], rx + 0.25, Y0 + 0.48, rw - 0.5, ph - 0.55, { fontSize: 13, paraSpaceAfter: 3, objectName: "Counts list" });

    const ay = Y0 + ph + 0.12;
    if (banner && B.browserTotal != null) {
      const ah = 2.05;
      panel(s, rx, ay, rw, ah, "Agreement panel");
      stat(s, rx + 0.25, ay + 0.08, rw - 0.5, `${int(B.browserTotal)} vs ${int(B.referenceTotal)}`, `vehicles on ${bClips.length} sample clips: ${bModel} in the browser against our offline ${bRefModel} pipeline, ${pct(B.agreement)}`, { size: 28, vh: 0.5, lh: 0.45, ls: 13, color: C.accent4, name: "Banner agreement" });
      text(s, [
        P_(bClips.map((c) => `${c.clip} (${c.light}, ${mmss(c.seconds)}): ${c.browser} against ${c.reference}`).join(";  ")),
        { text: bHand == null ? "Two models agreeing, not a hand count. A hand count is still to do." : `Hand count: ${bHand}.`, options: { color: C.accent3, bold: true } },
      ], rx + 0.25, ay + 1.12, rw - 0.5, ah - 1.18, { fontSize: 12, paraSpaceAfter: 2, objectName: "Banner clips" });
    } else {
      panel(s, rx, ay, rw, 2.05, "Banner no numbers");
      text(s, "Accuracy against a count by hand: not measured yet.", rx + 0.25, ay + 0.1, rw - 0.5, 1.85, { fontSize: 14, color: C.accent3, valign: "middle" });
    }
    const py = ay + 2.05 + 0.12;
    panel(s, rx, py, rw, YB - py, "Payer panel");
    text(s, [B_("Who pays: "), { text: "outdoor advertising companies, to show advertisers the traffic past each billboard, hour by hour, from a fixed camera or a phone video." }], rx + 0.25, py + 0.08, rw - 0.5, YB - py - 0.16, { fontSize: 13, valign: "middle", objectName: "Banner payer" });

    const clipNote = bClips.length ? ` To check it, we ran the browser count against our heavier offline pipeline on the same line: ${bClips.map((c) => `${c.clip} at ${c.light}, ${c.browser} against ${c.reference}`).join("; ")}; ${int(B.browserTotal)} against ${int(B.referenceTotal)} in all, ${pct(B.agreement)}. ${bHand == null ? "That is two models agreeing, not a hand count; a hand count is still to do." : ""}` : " The accuracy against a hand count is not measured yet.";
    s.addNotes(`${timing("banner")} CLICK (Komronbek): tab 4, ${SITE}/banner, where sample C3896 was counted before the talk (it takes a few minutes; do not reload the tab). Press play on the video. SAY (Aziza): New in the final: the same detector and tracker count the traffic past a billboard. Draw one line across the road in front of it; every vehicle is counted once when it crosses: cars, buses, trucks, motorcycles, each way, minute by minute. Each counted vehicle turns green on the video, so anyone can check the count by eye. CLICK "Save to the billboard's log". SAY: the log builds the statistics place by place and hour by hour; that is what an outdoor advertising company sells to advertisers.${clipNote} The daily figure on the page assumes every hour is like this one, and the page says so.`);
  }

  // ================= 9. next stage =================
  pres.addSection({ title: "Next stage" });
  {
    const s = content("Next stage", "NEXT STAGE  ·  /audit, /network AND /roads", "Next: the same cameras time the lights");
    const gap = 0.3;
    const colw = (CW - 2 * gap) / 3;
    const ih = 1.95;
    const cols = [
      {
        img: IMG("c3896_reader.jpg"), alt: "Signal lamp reader on the Tashkent junction", tagT: "MEASURED", tagC: C.accent4, head: "Signal audit  ·  /audit",
        label: `The lights read from pixels, every vehicle over the stop line, signal plans checked on a replay. ${clips.length} clips of one Tashkent junction (organisers' footage).`,
        stats: [[depErrs.length ? `${f2(Math.min(...depErrs))} to ${f2(Math.max(...depErrs))} s` : "", `replay error on ${okClips.length} of ${clips.length} clips${badClips.length ? `; ${badClips.map((c) => c.clip).join(", ")} too short, fails` : ""}`], [`${websterWorse} of ${clips.length}`, "clips where the textbook Webster plan is worse than now"]],
      },
      {
        img: IMG("network.png"), alt: "3D corridor of Tashkent", tagT: "SIMULATION", tagC: C.accent3, head: "Green wave  ·  /network",
        label: `Amir Temur Avenue, Tashkent: ${rec.corridor.km} km, ${rec.corridor.signals} signals, ${rec.corridor.vehicles} vehicles in ${rec.corridor.minutes} min. Only the offsets change.`,
        stats: [[`${rec.corridor.delayNow} s → ${rec.corridor.delayWave} s`, "mean delay at the signals"], [`${f2(rec.corridor.stopsNow)} → ${f2(rec.corridor.stopsWave)}`, "stops per vehicle"]],
      },
      {
        img: HAS_IMG("roads_detect.jpg") ? IMG("roads_detect.jpg") : MEDIA(path.join("roads", roadsImg)), alt: "Road damage found on a sample photo: a pothole, an alligator crack and a longitudinal crack", tagT: "MEASURED", tagC: C.accent4, head: "Road damage  ·  /roads",
        label: `${roads.model.name}, in the browser, on phone photos. A ${roads.dataset.images}-image sample of the RDD2022 test split.`,
        stats: [[f2(roads.overall.map50), "mAP50"], [pct(roads.overall.precision, 0), "precision"]],
      },
    ];
    cols.forEach((c, ci) => {
      const x = M + ci * (colw + gap);
      shot(s, c.img, x, Y0, colw - 0.14, ih, c.alt, `Next ${ci + 1} image`);
      tag(s, c.tagT, x + 0.17, Y0 + ih - 0.33, c.tagC);
      heading(s, c.head, x, Y0 + ih + 0.24, colw, { fontSize: 15 });
      text(s, c.label, x, Y0 + ih + 0.64, colw, 0.82, { fontSize: 12, color: C.text2, objectName: `Next ${ci + 1} label` });
      c.stats.forEach(([v, l], i) => {
        const y = Y0 + ih + 1.5 + i * 0.75;
        text(s, v, x, y, colw, 0.38, { fontFace: "Arial", bold: true, fontSize: 22, color: C.accent4, valign: "bottom", objectName: `Next ${ci + 1} stat ${i + 1} value` });
        text(s, l, x, y + 0.39, colw, 0.3, { fontSize: 12, objectName: `Next ${ci + 1} stat ${i + 1} label` });
      });
    });

    const c97 = clips.find((c) => c.clip === "C3897") || clips[0];
    s.addNotes(`${timing("next")} The next stage, in one slide. Cameras that watch car parks and streets can also watch junctions. The signal audit reads the lights from the pixels, counts every vehicle over the stop line, and replays the junction's own vehicles to check a signal plan before anyone recommends it. On ${clips.length} clips of one Tashkent junction the replay gives back when each vehicle left within ${depErrs.length ? `${f2(Math.min(...depErrs))} to ${f2(Math.max(...depErrs))}` : ""} seconds on ${okClips.length} clips${badClips.length ? `; ${badClips.map((c) => c.clip).join(", ")} is too short and fails the check, and the page says so` : ""}. The textbook Webster plan was worse than the timing now on ${websterWorse} of ${clips.length} clips, for example ${f1(md(c97, "webster"))} s against ${f1(md(c97, "measured"))} s on ${c97.clip}. The green wave on Amir Temur Avenue is a simulation: mean delay ${rec.corridor.delayNow} s down to ${rec.corridor.delayWave} s, stops per vehicle ${f2(rec.corridor.stopsNow)} down to ${f2(rec.corridor.stopsWave)}. Road damage from phone photos: mAP50 ${f2(roads.overall.map50)} on a ${roads.dataset.images}-image sample. Hand over to Amal.`);
  }

  // ================= 10. business =================
  pres.addSection({ title: "Business" });
  {
    const s = content("Business", "ALL NUMBERS ARE ASSUMPTIONS TO CHECK WITH THE CUSTOMER", "Who pays, and the pilot");
    const gap = 0.3;
    const cw = (CW - 2 * gap) / 3;
    const h = 2.95;
    const payers = [
      ["Car park operators", C.accent4, [
        ["Gets: ", "free spaces now and on arrival, drivers sent to the car park with room."],
        ["Price: ", "per camera per month, set in the pilot."],
        ["Value a month = ", "extra spaces filled × hours × tariff, plus drivers no longer turned away at the gate."],
      ]],
      ["The city", C.accent3, [
        ["Gets: ", "a district view from cameras it already has; less searching traffic, counted in vehicle-km."],
        ["Later: ", "the signal audit and green wave on the same cameras."],
        ["Value: ", "vehicle-km and minutes saved, measured in the pilot."],
      ]],
      ["Outdoor advertising", C.accent1, [
        ["Gets: ", "vehicles past each billboard by type, direction and hour, with a log and CSV."],
        ["Price: ", "per billboard per month, set in the pilot."],
        ["Value: ", "counted traffic to show advertisers, from a camera or a phone video."],
      ]],
    ];
    payers.forEach(([t, col, rows], i) => {
      const x = M + i * (cw + gap);
      panel(s, x, Y0, cw, h, `Payer ${i + 1}`);
      lamp(s, x + 0.25, Y0 + 0.2, 0.26, col, `Payer ${i + 1} lamp`);
      heading(s, t, x + 0.62, Y0 + 0.15, cw - 0.85, { fontSize: 17 });
      text(s, rows.flatMap(([k, v], j) => [B_(k), { text: v, options: { breakLine: j < rows.length - 1 } }]), x + 0.25, Y0 + 0.62, cw - 0.5, h - 0.75, { fontSize: 13, paraSpaceAfter: 7, objectName: `Payer ${i + 1} text` });
    });
    const y = Y0 + h + 0.2;
    const bh = YB - y;
    panel(s, M, y, cw, bh, "Pilot card");
    stat(s, M + 0.25, y + 0.08, cw - 0.5, "3 months", "pilot with one operator, on the cameras it already has", { size: 30, vh: 0.55, lh: 0.7, ls: 13, name: "Pilot" });
    panel(s, M + cw + gap, y, cw, bh, "Cost card");
    text(s, [
      B_("People: "), P_("3 engineers part time. The main cost."),
      B_("Hosting: "), P_("static, free to USD 20 a month. No GPU server."),
      B_("Hardware: "), { text: "no sensors in the ground; one camera covers the spaces it sees." },
    ], M + cw + gap + 0.25, y + 0.1, cw - 0.5, bh - 0.2, { fontSize: 13, valign: "middle", paraSpaceAfter: 3, objectName: "Costs" });
    panel(s, M + 2 * (cw + gap), y, cw, bh, "Payback card");
    text(s, [
      B_("Payback = price ÷ value a month."), { text: "", options: { breakLine: true } },
      { text: "We state it from the pilot inputs, not before. Our cost per camera: outlining the spaces once, or checking the suggested ones, and a sample of frames by hand." },
    ], M + 2 * (cw + gap) + 0.25, y + 0.1, cw - 0.5, bh - 0.2, { fontSize: 13, valign: "middle", objectName: "Payback" });

    s.addNotes(`${timing("business")} All numbers here are assumptions to check with the customer, and the slide says so. Three customers. Car park operators: free spaces now and on arrival, and drivers sent to the car park with room; priced per camera per month, set in the pilot; the value is extra spaces filled times hours times the tariff, plus drivers no longer turned away. The city: less searching traffic, counted in vehicle-km, and later the signal audit on the same cameras. Outdoor advertising companies: counted traffic past each billboard, by type, direction and hour, priced per billboard per month. Costs: the pilot is 3 months with one operator on its own cameras; 3 engineers part time are the main cost; hosting is static, free to USD 20 a month, no GPU server, no sensors in the ground. Payback is price divided by value a month: we state it from the pilot inputs, not before.`);
  }

  // ================= 11. team and ask =================
  pres.addSection({ title: "Team" });
  {
    const s = content("Team", "TEAM, ASK AND NEXT STEPS", `Team ${team.team}`);
    const gap = 0.3;
    const cw = (CW - 2 * gap) / 3;
    const cols = [C.accent2, C.accent3, C.accent4];
    team.members.forEach((m, i) => {
      const x = M + i * (cw + gap);
      panel(s, x, Y0, cw, 1.2, `Member ${i + 1} card`);
      lamp(s, x + 0.25, Y0 + 0.2, 0.3, cols[i % 3], `Member ${i + 1} lamp`);
      heading(s, m.name, x + 0.7, Y0 + 0.13, cw - 0.9, { fontSize: 18, h: 0.42 });
      text(s, m.role, x + 0.7, Y0 + 0.57, cw - 0.9, 0.55, { fontSize: 13, color: C.text2, objectName: `Member ${i + 1} role` });
    });

    const ay = Y0 + 1.4;
    const aw = 7.4;
    panel(s, M, ay, aw, 2.35, "Ask panel");
    heading(s, "Our ask", M + 0.3, ay + 0.12, aw - 0.6, { fontSize: 18, color: C.accent1 });
    const asks = [
      "A 3-month pilot with one car park operator, on its own cameras.",
      "One outdoor advertising company to test the billboard counter on its sites.",
      "Frames from live cameras in Tashkent, to replace the recorded mornings.",
    ];
    asks.forEach((t, i) => {
      const yy = ay + 0.6 + i * 0.55;
      lamp(s, M + 0.3, yy + 0.04, 0.36, C.accent1, `Ask ${i + 1} lamp`, String(i + 1));
      text(s, t, M + 0.85, yy, aw - 1.15, 0.45, { fontSize: 15, valign: "middle", objectName: `Ask ${i + 1}` });
    });
    const nx = M + aw + 0.3;
    const nw = W - M - nx;
    panel(s, nx, ay, nw, 2.35, "Next panel");
    heading(s, "Next steps", nx + 0.3, ay + 0.12, nw - 0.6, { fontSize: 18 });
    text(s, [
      bullet("Night test: PKLot has no night frames. A test set of our own, with hand labels."),
      bullet("A hand count for the billboard counter."),
      bullet("Then the same cameras time the lights: audit and green wave.", { breakLine: false }),
    ], nx + 0.3, ay + 0.55, nw - 0.6, 1.7, { fontSize: 13, paraSpaceAfter: 5, objectName: "Next steps" });

    const ky = ay + 2.5;
    panel(s, M, ky, CW, YB - ky, "Closing panel");
    addLamps(s, M + 0.35, ky + (YB - ky) / 2 - 0.2, 0.3, "Closing lamps");
    text(s, [
      { text: "Thank you. Questions?", options: { bold: true, fontFace: "Arial", fontSize: 22, color: C.text1, breakLine: true } },
      { text: "Try it: ", options: { color: C.text2 } },
      { text: `${SITE}/tracker`, options: { color: C.accent1, hyperlink: { url: `${SITE}/tracker` } } },
      { text: "     Code: ", options: { color: C.text2 } },
      { text: CODE, options: { color: C.accent1, hyperlink: { url: CODE } } },
    ], M + 2.0, ky + 0.05, CW - 2.3, YB - ky - 0.1, { fontSize: 15, valign: "middle", objectName: "Closing text" });

    s.addNotes(`${timing("team")} We are ${team.members.map((m) => `${m.name}, ${m.role.toLowerCase()}`).join("; ")}. Our ask: a 3-month pilot with one car park operator on its own cameras; one outdoor advertising company to test the billboard counter on its sites; and frames from live cameras in Tashkent, to replace the recorded mornings. Next steps: a night test set of our own, because PKLot has no night frames; a hand count for the billboard counter; then the same cameras time the lights. Thank you; we are ready for questions. (Backup slides 12 to 17 answer the likely questions: accuracy, measured against simulated, privacy and limits, cost and speed, Tashkent, reused against built.)`);
  }

  // ================= backup for questions =================
  pres.addSection({ title: "Backup for questions" });
  const BK = (n, k, title) => content("Backup for questions", `BACKUP FOR QUESTIONS  ·  B${n}  ·  ${k}`, title);
  const hcell = (t) => ({ text: t, options: { bold: true, fontFace: "Arial", fontSize: 11, color: C.text2, fill: { color: C.accent5 }, valign: "middle" } });
  const cell = (t, extra = {}) => ({ text: t, options: Object.assign({ color: C.text1, fill: { color: C.background2 }, valign: "middle" }, extra) });

  // B1 accuracy
  {
    const s = BK(1, "ACCURACY", "Accuracy, and how each number was measured");
    const fair = { held: C.accent4, same: C.accent3, other: C.text2 };
    const rows = [
      ["Spaces marked, /parking", `${int(pTest.images)} held-out PKLot images, ${int(pTest.spaces)} spaces`, `${pct(pTest.accuracy)} right; precision ${pct(pTest.precision)}, recall ${pct(pTest.recall)}`, `Held out. Rule picked on ${int(pCal.images)} other images (${pct(pCal.accuracy)} there)`, "held"],
      ["Same, by weather", `sunny ${pW.sunny.images}, cloudy ${pW.cloudy.images}, rainy ${pW.rainy.images} images`, `${pct(pW.sunny.accuracy)} / ${pct(pW.cloudy.accuracy)} / ${pct(pW.rainy.accuracy)}`, "Held out. No night frames in PKLot", "held"],
      ["Tracker readings", `${int(tEval.frames)} frames, ${int(tEval.spaces)} readings, ${lots.length} mornings`, `${pct(tEval.accuracy)} right; free count off by ${tEval.freeErr.median} (median), ${tEval.freeErr.p90} (90th pct.)`, "Same rule as /parking, picked on its calibration images", "other"],
      [`Forecast, ${fc.h} min`, `${int(fc.n)} forecasts`, `${f1(fc.mae)} spaces off; "same as now" ${f1(fc.naiveMae)}`, "Typical day from other weekdays; against \"same as now\"", "other"],
      ["Whole car park", `${int(whole.labelledUsed)} labelled spaces cars used`, `${int(whole.labelledFound)} found; +${int(whole.extra)} outside the labels`, "Checked on the labelled part only", "other"],
      ["Spaces from a photo", `${int(sug.images)} PKLot images`, `taken found ${pct(sug.takenFound)}; suggested free right ${pct(sug.suggestedRight)}; free found ${pct(sug.freeFound)}`, "Settings picked on these same images. Not held out", "same"],
    ];
    if (banner && B.browserTotal != null) rows.push(["Billboard counter", `${bClips.length} sample clips, ${bClips.map((c) => c.light).join(" and ")}`, `${int(B.browserTotal)} vs ${int(B.referenceTotal)} vehicles (${pct(B.agreement)})`, `Browser ${bModel} against our offline ${bRefModel}. ${bHand == null ? "No hand count yet" : "Hand count " + bHand}`, "same"]);
    else rows.push(["Billboard counter", "", "not measured yet", "", "same"]);
    rows.push(
      ["Signal audit replay", `${clips.length} clips, one junction`, depErrs.length ? `departure error ${f2(Math.min(...depErrs))} to ${f2(Math.max(...depErrs))} s on ${okClips.length} clips` : "", badClips.length ? `${badClips.map((c) => `${c.clip} ${f2(c.check.departureError)} s`).join(", ")}: too short, fails` : "", "other"],
      ["Road damage, /roads", `${roads.dataset.images}-image sample, RDD2022 test`, `mAP50 ${f2(roads.overall.map50)}, precision ${pct(roads.overall.precision, 0)}`, `Model trained by others; its card says mAP50 ${roads.model.card_reports.map50} on the full split`, "other"],
    );
    const head = ["What", "Checked on", "Result", "How fair the check is"].map(hcell);
    const colW = [2.25, 3.0, 3.6, 3.28];
    s.addTable([head, ...rows.map(([a, b, c, d, f]) => [cell(a, { bold: true }), cell(b), cell(c), cell(d, { color: fair[f] })])], {
      x: M, y: Y0 - 0.05, w: colW.reduce((a, b) => a + b, 0), colW, rowH: [0.38, ...rows.map(() => 0.47)],
      fontFace: "Calibri", fontSize: 12, color: C.text1, border: { type: "solid", pt: 0.75, color: HEX.accent5 }, margin: [0.03, 0.08, 0.03, 0.08], objectName: "Accuracy table",
    });
    text(s, [B_("Green: ", C.accent4), { text: "held out.  " }, B_("Grey: ", C.text2), { text: "checked, but not on a held-out set.  " }, B_("Amber: ", C.accent3), { text: "picked on the same data, or two models agreeing: a sanity check." }], M, YB - 0.28, CW, 0.3, { fontSize: 12, color: C.text2, valign: "middle", objectName: "Table key" });
    s.addNotes(`B1. If asked how accurate it is: the fair number is ${pct(pTest.accuracy)} of ${int(pTest.spaces)} spaces on ${int(pTest.images)} held-out PKLot images; the rule was picked on ${int(pCal.images)} other images. The tracker gets ${pct(tEval.accuracy)} on its ${int(tEval.frames)} frames with the same rule. The photo suggestion numbers (${pct(sug.takenFound, 0)} and ${pct(sug.suggestedRight, 0)}) were picked on the same ${int(sug.images)} images, so they are a sanity check, not a test. ${banner ? `The billboard counter agrees with our offline pipeline on ${pct(B.agreement)} of vehicles; there is no hand count yet.` : ""}`);
  }

  // B2 measured vs simulated
  {
    const s = BK(2, "MEASURED AND SIMULATED", "What is measured, and what is simulated");
    const gap = 0.3;
    const cw = (CW - gap) / 2;
    const cols = [
      ["Measured, from real data", C.accent4, [
        `PKLot frames and hand labels: ${lots.length} car park mornings on /tracker, ${int(pTest.images + pCal.images)} images on /parking.`,
        `Kwun Tong: ${hk.cameras.length} Transport Department cameras, ${int(hkSnapshots)} snapshots counted by ${hkModel}; live vacancy of ${hkParks.carparks.length} car parks.`,
        `Signal audit: vehicle tracks and lamp readings on ${clips.length} clips of the organisers' footage.`,
        `Billboard counter: vehicles crossing the line in the video${bClips.length ? `, checked on ${bClips.length} clips against our offline pipeline` : ""}.`,
        `Road damage: mAP50 on ${roads.dataset.images} RDD2022 test images.`,
      ]],
      ["Simulated or assumed", C.accent3, [
        "The drivers on /city: origins and departure times are seeded.",
        `The trip times on /tracker (${ex ? ex.trips.map((t) => `${t.drive} + ${t.walk}`).join(", ") : "example"} min drive + walk): example times you can change; the ${DEMO_DRIVERS} drivers too.`,
        "The traffic on /network: Intelligent Driver Model, one direction; the real offsets are unknown to us.",
        "The daily figure on /banner assumes every hour is like the one in the video.",
        "The predictive signal mode assumes the next 30 s of arrivals are known.",
        "All business numbers: assumptions to check with the customer.",
      ]],
    ];
    cols.forEach(([t, col, items], i) => {
      const x = M + i * (cw + gap);
      panel(s, x, Y0, cw, YB - Y0, `Column ${i + 1}`);
      lamp(s, x + 0.3, Y0 + 0.24, 0.26, col, `Column ${i + 1} lamp`);
      heading(s, t, x + 0.7, Y0 + 0.19, cw - 1, { fontSize: 18 });
      text(s, items.map((it, j) => bullet(it, { breakLine: j < items.length - 1 })), x + 0.3, Y0 + 0.75, cw - 0.6, YB - Y0 - 0.95, { fontSize: 16, paraSpaceAfter: 12, objectName: `Column ${i + 1} list` });
    });
    s.addNotes("B2. If asked what is real: every count comes from real frames, photos or video; the drivers and the corridor traffic are simulated, and the pages label them. The tracker replays recorded mornings of PKLot, not a live feed yet.");
  }

  // B3 privacy, night, rain
  {
    const s = BK(3, "PRIVACY AND LIMITS", "Privacy, night, rain and other limits");
    const gap = 0.3;
    const cw = (CW - gap) / 2;
    const cols = [
      ["Privacy", C.accent4, [
        "No number plates and no faces are read. The detector gives vehicle boxes only.",
        "Photos and videos stay in the browser tab: they are not uploaded (/parking, /banner, /audit).",
        "A car park would publish counts only: free spaces per car park, every minute. No video is stored or sent.",
        "Hong Kong snapshots are public 320 x 240 images; the Transport Department greys out all but the road.",
      ]],
      ["Limits", C.accent2, [
        "Night: not measured. PKLot has no night frames; a hand-labelled night set is our next step.",
        `Rain: measured on ${pW.rainy.images} rainy held-out images, ${pct(pW.rainy.accuracy)}, against ${pct(pW.cloudy.accuracy)} cloudy and ${pct(pW.sunny.accuracy)} sunny.`,
        `Far rows: PUCPR ${pct(pCam.pucpr.accuracy)} (small cars at the back) against UFPR04 ${pct(pCam.ufpr04.accuracy)} and UFPR05 ${pct(pCam.ufpr05.accuracy)}.`,
        "Small, masked Hong Kong snapshots: the counts are a lower bound.",
        "Long queues hide vehicles behind each other; the camera must not move.",
      ]],
    ];
    cols.forEach(([t, col, items], i) => {
      const x = M + i * (cw + gap);
      panel(s, x, Y0, cw, YB - Y0, `Column ${i + 1}`);
      lamp(s, x + 0.3, Y0 + 0.24, 0.26, col, `Column ${i + 1} lamp`);
      heading(s, t, x + 0.7, Y0 + 0.19, cw - 1, { fontSize: 18 });
      text(s, items.map((it, j) => bullet(it, { breakLine: j < items.length - 1 })), x + 0.3, Y0 + 0.75, cw - 0.6, YB - Y0 - 0.95, { fontSize: 16, paraSpaceAfter: 12, objectName: `Column ${i + 1} list` });
    });
    s.addNotes(`B3. Privacy: boxes only, no plates or faces; the photo or video never leaves the browser tab. Night is not measured, and we say it. Rain is measured: ${pct(pW.rainy.accuracy)} on ${pW.rainy.images} rainy held-out images.`);
  }

  // B4 cost and speed
  {
    const s = BK(4, "COST AND SPEED", "Cost and speed: in the browser, no GPU server");
    const cw = (CW - 3 * 0.3) / 4;
    [
      ["10 MB", `${parkModel} for photos and car parks, in ONNX Runtime Web`, C.accent1],
      ["38 MB", "YOLO26s for video: billboard counter and signal audit", C.accent1],
      ["0", "GPU servers. Inference runs on the visitor's device; the site is static files.", C.accent4],
      ["USD 0 to 20", "hosting a month, static (assumption to check)", C.accent3],
    ].forEach(([v, l, col], i) => card(s, M + i * (cw + 0.3), Y0, cw, 1.7, v, l, { size: 30, vh: 0.55, color: col, name: `Cost ${i + 1}` }));
    const y = Y0 + 1.95;
    const hw = (CW - 0.3) / 2;
    panel(s, M, y, hw, YB - y, "Speed panel");
    heading(s, "Speed", M + 0.3, y + 0.15, hw - 0.6, { fontSize: 18 });
    text(s, [
      bullet("Video: about 1 minute of processing per minute of 1080p video on our Apple M5 laptop with WebGPU; slower on WebAssembly and on phones."),
      bullet("Video is analysed at 5 frames a second."),
      bullet(`A photo: the whole frame plus 3 x 3 tiles, ${1 + parking.rule.grid * parking.rule.grid} detector runs; an uploaded photo adds 5 x 5 tiles over the far rows. The page prints the time it took.`),
      bullet("A car park needs one image a minute, not video.", { breakLine: false }),
    ], M + 0.3, y + 0.6, hw - 0.6, YB - y - 0.75, { fontSize: 13, paraSpaceAfter: 6, objectName: "Speed list" });
    const rx = M + hw + 0.3;
    panel(s, rx, y, hw, YB - y, "Cost panel");
    heading(s, "Cost per camera", rx + 0.3, y + 0.15, hw - 0.6, { fontSize: 18 });
    text(s, [
      bullet("No sensor in each space: one camera covers the spaces it sees."),
      bullet("Setup: the spaces are suggested from one photo and checked by hand once."),
      bullet("Running: the operator's own PC or a browser tab; no cloud GPU bill."),
      bullet("The main cost is people: 3 engineers part time for the pilot (assumption).", { breakLine: false }),
    ], rx + 0.3, y + 0.6, hw - 0.6, YB - y - 0.75, { fontSize: 13, paraSpaceAfter: 6, objectName: "Cost list" });
    s.addNotes("B4. If asked about cost: there is no GPU server. The detector runs in the browser with ONNX Runtime Web on WebGPU or WebAssembly, so the server cost per audit is zero and the site is static files. Speed from the README: about a minute per minute of 1080p video on our M5 laptop with WebGPU. A car park needs one image a minute.");
  }

  // B5 Tashkent
  {
    const s = BK(5, "SCALE", "How it scales to Tashkent");
    const gap = 0.3;
    const cw = (CW - 2 * gap) / 3;
    const cards = [
      ["13,208", "paid street spaces on 86 streets planned by Poytaxt Parking; paid in an app since 8 May 2025, 5,000 to 12,000 sum an hour (Spot.uz)", C.accent1],
      ["~1,000", "signalised junctions; 125 on the adaptive control system of TsODD, 545 planned for 2026 (Anhor.uz, Yuz.uz)", C.accent3],
      [`${int(tashJunctions)}`, `signalised junctions and ${int(Math.round(tashKm))} km of road of central Tashkent already in the app, from OpenStreetMap`, C.accent4],
    ];
    cards.forEach(([v, l, col], i) => card(s, M + i * (cw + gap), Y0, cw, 1.95, v, l, { size: 36, vh: 0.62, color: col, ls: 13, name: `Scale ${i + 1}` }));
    const y = Y0 + 2.2;
    panel(s, M, y, CW, YB - y, "Steps panel");
    heading(s, "What a new car park or district needs", M + 0.3, y + 0.15, CW - 0.6, { fontSize: 18 });
    text(s, [
      bullet("One fixed camera that sees the spaces. Spaces suggested from one photo, checked by hand once."),
      bullet("One image a minute, read in a browser tab or on the operator's PC. The free count goes to drivers."),
      bullet(`The district model is the one on /city: in Kwun Tong the vacancy comes from DATA.GOV.HK; in Tashkent it would come from the operators' cameras.`),
      bullet("Billboards: any fixed camera or a phone video, one line per billboard."),
      bullet("Elsewhere it works: SFpark cut cruising for parking by 50% on its pilot blocks; a Copenhagen green wave cut travel time by 17% on one street (sources on /elsewhere).", { breakLine: false }),
    ], M + 0.3, y + 0.6, CW - 0.6, YB - y - 0.75, { fontSize: 14, paraSpaceAfter: 6, objectName: "Scale steps" });
    s.addNotes(`B5. Tashkent: Poytaxt Parking plans 13,208 paid spaces on 86 streets, first come, first served, so a driver cannot see a free space before driving there. The city has about 1,000 signalised junctions, 125 connected to adaptive control and 545 planned for 2026; the rest have no measurement, which our audit gives from video. The Tashkent road graph is already in the app: ${int(tashJunctions)} signalised junctions and about ${int(Math.round(tashKm))} km of road from OpenStreetMap. Scaling is per camera, with no GPU server.`);
  }

  // B6 reused vs built
  {
    const s = BK(6, "ELIMINATION AND FINAL", "Reused from the elimination, built in the final");
    const gap = 0.3;
    const lw = 4.6;
    panel(s, M, Y0, lw, YB - Y0, "Reused panel");
    lamp(s, M + 0.3, Y0 + 0.24, 0.26, C.accent3, "Reused lamp");
    heading(s, "Reused, declared", M + 0.7, Y0 + 0.19, lw - 1, { fontSize: 18 });
    text(s, [
      bullet("the in-browser detector and the ONNX worker"),
      bullet("the ByteTrack port"),
      bullet("the video conversion with ffmpeg.wasm"),
      bullet("the site design: tokens, layout and components"),
      bullet("the tracks and lamp readings of the sample clips (YOLO26m at 1280 px, 10 fps)", { breakLine: false }),
    ], M + 0.3, Y0 + 0.75, lw - 0.6, YB - Y0 - 0.95, { fontSize: 16, paraSpaceAfter: 11, objectName: "Reused list" });
    text(s, "github.com/baytoooo/parivision-traffic", M + 0.3, YB - 0.45, lw - 0.6, 0.3, { fontSize: 12, color: C.text2, objectName: "Elimination repo" });
    const rx = M + lw + gap;
    const rw = W - M - rx;
    panel(s, rx, Y0, rw, YB - Y0, "Built panel");
    lamp(s, rx + 0.3, Y0 + 0.24, 0.26, C.accent4, "Built lamp");
    heading(s, "Built during the final", rx + 0.7, Y0 + 0.19, rw - 1, { fontSize: 18 });
    text(s, [
      bullet("the parking tracker: replay, whole car park, forecast, advice for one and for many drivers"),
      bullet("the parking page: the space rule and its held-out test, spaces suggested from a photo"),
      bullet("the district model: Kwun Tong cameras, live car park vacancy, drivers spread by cost"),
      bullet("the billboard counter: line crossings by type and direction, log and CSV"),
      bullet("the signal audit core and page, the 3D corridor, the road damage page"),
      bullet("the camera collectors and counters, the Elsewhere page, this deck", { breakLine: false }),
    ], rx + 0.3, Y0 + 0.75, rw - 0.6, YB - Y0 - 0.95, { fontSize: 16, paraSpaceAfter: 11, objectName: "Built list" });
    s.addNotes("B6. If asked what is new: the detector, worker, tracker port, video conversion and site design come from our elimination system, and we declare it in the README. Everything product-side was built in the final: the tracker, the parking page and its test, the district model, the billboard counter, the signal audit and corridor.");
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
  if (ex) console.log(`spread at ${DEMO_TIME}: nearest ${ex.nearest.full}/${DEMO_DRIVERS}, oqim ${ex.oqim.full}/${DEMO_DRIVERS}`);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});

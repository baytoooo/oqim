#!/usr/bin/env python3
"""Count vehicles in collected TfL JamCams clips and build app/public/data/london.json.

Run with /Users/bayto/Desktop/claude/traffic-events/.venv/bin/python (ultralytics + OpenCV).
For every clip in samples_src/london/<camera id>/*.mp4 not processed yet:
  - sample frames at 2 per second
  - YOLO26n (imgsz 640, conf 0.3, classes car/motorcycle/bus/truck) per frame
  - vehicles = median count per frame
  - standing = boxes in the first and last sampled frame matched with IoU >= 0.6
  - density  = mean over frames of (sum of box areas / frame area)
  - offline  = true when TfL shows its grey placeholder card instead of video
Loops every 2 minutes until 12:15 local time or until samples_src/london/STOP exists.

  python london_detect.py [--once] [--until HH:MM]
"""
import datetime as dt
import glob
import json
import math
import os
import shutil
import statistics
import sys
import time

import cv2
import numpy as np
from ultralytics import YOLO

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "london")
STOP = os.path.join(DATA, "STOP")
STATE = os.path.join(DATA, "detect_state.json")
CAMS_FILE = os.path.join(DATA, "cameras.json")
APP = os.path.join(HERE, "..", "app", "public")
OUT = os.path.join(APP, "data", "london.json")
ROADS = os.path.join(APP, "data", "london_roads.json")
MEDIA = os.path.join(APP, "media", "london")
WEIGHTS = "/Users/bayto/Desktop/claude/traffic-events/weights/yolo26n.pt"
CLASSES = [2, 3, 5, 7]
CENTER = [-0.11599, 51.4830]
PERIOD_S = 120
SOURCE = ("TfL JamCams, Powered by TfL Open Data (Open Government Licence v2.0 based TfL terms); "
          "detection: YOLO26n (Ultralytics, AGPL-3.0)")


def log(msg):
    print("%s %s" % (dt.datetime.now().strftime("%H:%M:%S"), msg), flush=True)


def write_json(path, obj, **kw):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, **kw)
    os.replace(tmp, path)


def iou(a, b):
    x1, y1 = max(a[0], b[0]), max(a[1], b[1])
    x2, y2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, x2 - x1) * max(0.0, y2 - y1)
    if inter <= 0:
        return 0.0
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0.0


def standing_count(first, last, thr=0.6):
    pairs = sorted(((iou(a, b), i, j) for i, a in enumerate(first) for j, b in enumerate(last)),
                   reverse=True)
    used_a, used_b, n = set(), set(), 0
    for v, i, j in pairs:
        if v < thr:
            break
        if i in used_a or j in used_b:
            continue
        used_a.add(i)
        used_b.add(j)
        n += 1
    return n


def read_frames(path, per_sec=2.0):
    cap = cv2.VideoCapture(path)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    if not (0 < fps < 240):
        fps = 25.0
    step = max(1, int(round(fps / per_sec)))
    frames, k = [], 0
    while True:
        ok, fr = cap.read()
        if not ok:
            break
        if k % step == 0:
            frames.append(fr)
        k += 1
    cap.release()
    return frames


def is_placeholder(frame):
    """TfL shows a flat grey card ("Camera ... in use keeping London moving") when the
    camera is panned by an operator or offline."""
    im = frame.astype(int)
    b, g, r = im[..., 0], im[..., 1], im[..., 2]
    grey = (abs(b - g) < 8) & (abs(g - r) < 8)
    if not grey.any():
        return False
    mode = int(np.bincount(g[grey].ravel(), minlength=256).argmax())
    flat = grey & (abs(g - mode) < 6)
    return 100 <= mode <= 150 and flat.mean() > 0.6


def analyse(model, path):
    frames = read_frames(path)
    if not frames:
        return None
    if is_placeholder(frames[0]) and is_placeholder(frames[-1]):
        return {"vehicles": 0, "standing": 0, "density": 0.0, "frames": len(frames),
                "offline": True}
    h, w = frames[0].shape[:2]
    area = float(h * w)
    counts, dens, boxes = [], [], []
    for i in range(0, len(frames), 16):
        res = model.predict(frames[i:i + 16], imgsz=640, conf=0.3, classes=CLASSES, verbose=False)
        for r in res:
            b = r.boxes.xyxy.cpu().numpy().tolist() if r.boxes is not None else []
            boxes.append(b)
            counts.append(len(b))
            dens.append(min(1.0, sum((x2 - x1) * (y2 - y1) for x1, y1, x2, y2 in b) / area))
    return {"vehicles": int(round(statistics.median(counts))),
            "standing": standing_count(boxes[0], boxes[-1]) if len(boxes) > 1 else 0,
            "density": round(sum(dens) / len(dens), 4),
            "frames": len(frames)}


def stamp_to_iso(name):
    t = dt.datetime.strptime(name, "%Y%m%dT%H%M%S")
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


def load_nodes():
    if not os.path.exists(ROADS):
        return None
    try:
        with open(ROADS) as fh:
            return json.load(fh)["nodes"]
    except Exception:  # noqa: BLE001
        return None


def nearest_node(nodes, lon, lat):
    kx = 111320.0 * math.cos(math.radians(lat))
    best, bi = 1e18, None
    for i, (x, y) in enumerate(nodes):
        d = ((x - lon) * kx) ** 2 + ((y - lat) * 110574.0) ** 2
        if d < best:
            best, bi = d, i
    return bi


def one_round(model, cams, state, series):
    new = 0
    for c in cams:
        clips = sorted(glob.glob(os.path.join(DATA, c["id"], "*.mp4")))
        for p in clips:
            key = os.path.relpath(p, DATA)
            if key in state:
                continue
            try:
                r = analyse(model, p)
            except Exception as ex:  # noqa: BLE001
                log("error %s: %s" % (key, ex))
                r = None
            state[key] = 1 if r else 0
            if not r:
                continue
            t = stamp_to_iso(os.path.splitext(os.path.basename(p))[0])
            pts = series.setdefault(c["id"], [])
            pt = {"t": t, "vehicles": r["vehicles"], "standing": r["standing"],
                  "density": r["density"]}
            if r.get("offline"):
                pt["offline"] = True
            pts[:] = [x for x in pts if x["t"] != t] + [pt]
            new += 1
        jpgs = sorted(glob.glob(os.path.join(DATA, c["id"], "*.jpg")))
        if jpgs:
            dst = os.path.join(MEDIA, c["id"] + ".jpg")
            shutil.copyfile(jpgs[-1], dst + ".tmp")
            os.replace(dst + ".tmp", dst)
    return new


def build(cams, series):
    nodes = load_nodes()
    out = []
    for c in cams:
        pts = sorted(series.get(c["id"], []), key=lambda x: x["t"])
        out.append({"id": c["id"], "name": c["name"], "lat": c["lat"], "lon": c["lon"],
                    "view": c["view"], "imageUrl": c["imageUrl"], "videoUrl": c["videoUrl"],
                    "node": nearest_node(nodes, c["lon"], c["lat"]) if nodes else None,
                    "series": pts})
    return {"source": SOURCE, "district": "Kennington, London", "center": CENTER,
            "cameras": out}


def main():
    args = sys.argv[1:]
    until = "12:15"
    if "--until" in args:
        until = args[args.index("--until") + 1]
    hh, mm = map(int, until.split(":"))
    end = dt.datetime.now().replace(hour=hh, minute=mm, second=0, microsecond=0)
    os.makedirs(MEDIA, exist_ok=True)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(CAMS_FILE) as fh:
        cams = json.load(fh)
    state = {}
    if os.path.exists(STATE):
        with open(STATE) as fh:
            state = json.load(fh)
    series = {}
    if os.path.exists(OUT):
        with open(OUT) as fh:
            for c in json.load(fh).get("cameras", []):
                series[c["id"]] = c.get("series", [])
    model = YOLO(WEIGHTS)
    log("detector start: %d cameras, until %s, pid %d" % (len(cams), until, os.getpid()))
    while True:
        t0 = time.time()
        new = one_round(model, cams, state, series)
        write_json(STATE, state)
        obj = build(cams, series)
        write_json(OUT, obj, separators=(",", ":"))
        total = sum(len(c["series"]) for c in obj["cameras"])
        log("round: %d new points, %d total, %.0f s" % (new, total, time.time() - t0))
        if "--once" in args or dt.datetime.now() >= end or os.path.exists(STOP):
            break
        while time.time() - t0 < PERIOD_S:
            if os.path.exists(STOP):
                break
            time.sleep(3)
        if os.path.exists(STOP):
            break
    log("detector stop")


if __name__ == "__main__":
    main()

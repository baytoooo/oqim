#!/usr/bin/env python3
"""Count vehicles in collected Hong Kong TD snapshots and build app/public/data/hongkong.json.

Run with /Users/bayto/Desktop/claude/traffic-events/.venv/bin/python (ultralytics + OpenCV).
For every image in samples_src/hongkong/<key>/*.jpg not processed yet (in time order):
  - YOLO26n (imgsz 640, conf 0.25, classes car/motorcycle/bus/truck)
  - vehicles = box count
  - density  = sum of box areas / image area
  - standing = boxes that overlap a box of the previous image of the same camera with
               IoU >= 0.6 (stopped or queued vehicles); 0 for a camera's first image
Loops every 2 minutes until 12:15 local time or until samples_src/hongkong/STOP exists.

  python hongkong_detect.py [--once] [--until HH:MM]
"""
import datetime as dt
import glob
import json
import os
import shutil
import sys
import time

import cv2
from ultralytics import YOLO

from london_detect import iou, nearest_node, write_json

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "hongkong")
STOP = os.path.join(DATA, "STOP")
STATE = os.path.join(DATA, "detect_state.json")
CAMS_FILE = os.path.join(DATA, "cameras.json")
APP = os.path.join(HERE, "..", "app", "public")
OUT = os.path.join(APP, "data", "hongkong.json")
ROADS = os.path.join(APP, "data", "hongkong_roads.json")
MEDIA = os.path.join(APP, "media", "hongkong")
WEIGHTS = "/Users/bayto/Desktop/claude/traffic-events/weights/yolo26n.pt"
CLASSES = [2, 3, 5, 7]
CENTER = [114.2155, 22.3162]
PERIOD_S = 120
SOURCE = ("Transport Department, Hong Kong SAR Government, traffic snapshot images via "
          "DATA.GOV.HK; detection: YOLO26n (Ultralytics, AGPL-3.0)")


def log(msg):
    print("%s %s" % (dt.datetime.now().strftime("%H:%M:%S"), msg), flush=True)


def standing(cur, prev, thr=0.6):
    return sum(1 for a in cur if any(iou(a, b) >= thr for b in prev))


def load_nodes():
    if not os.path.exists(ROADS):
        return None
    try:
        with open(ROADS) as fh:
            return json.load(fh)["nodes"]
    except Exception:  # noqa: BLE001
        return None


def one_round(model, cams, state, series):
    new = 0
    done, boxes = state.setdefault("done", {}), state.setdefault("boxes", {})
    for c in cams:
        imgs = sorted(glob.glob(os.path.join(DATA, c["id"], "*.jpg")))
        todo = [p for p in imgs if os.path.relpath(p, DATA) not in done]
        for p in todo:
            key = os.path.relpath(p, DATA)
            im = cv2.imread(p)
            if im is None:
                done[key] = 0
                continue
            h, w = im.shape[:2]
            r = model.predict(im, imgsz=640, conf=0.25, classes=CLASSES, verbose=False)[0]
            b = [[round(v, 1) for v in bb] for bb in r.boxes.xyxy.cpu().numpy().tolist()]
            prev = boxes.get(c["id"])
            st = standing(b, prev) if prev is not None else 0
            boxes[c["id"]] = b
            done[key] = 1
            name = os.path.splitext(os.path.basename(p))[0]
            t = dt.datetime.strptime(name, "%Y%m%dT%H%M%S").strftime("%Y-%m-%dT%H:%M:%SZ")
            dens = min(1.0, sum((x2 - x1) * (y2 - y1) for x1, y1, x2, y2 in b) / float(h * w))
            pts = series.setdefault(c["id"], [])
            pts[:] = [x for x in pts if x["t"] != t] + [
                {"t": t, "vehicles": len(b), "standing": st, "density": round(dens, 4)}]
            new += 1
        if imgs:
            dst = os.path.join(MEDIA, c["id"] + ".jpg")
            shutil.copyfile(imgs[-1], dst + ".tmp")
            os.replace(dst + ".tmp", dst)
    return new


def build(cams, series):
    nodes = load_nodes()
    out = []
    for c in cams:
        out.append({"id": c["id"], "name": c["name"], "lat": c["lat"], "lon": c["lon"],
                    "imageUrl": c["imageUrl"],
                    "node": nearest_node(nodes, c["lon"], c["lat"]) if nodes else None,
                    "series": sorted(series.get(c["id"], []), key=lambda x: x["t"])})
    return {"source": SOURCE, "district": "Kwun Tong, Hong Kong", "center": CENTER,
            "cameras": out}


def main():
    args = sys.argv[1:]
    until = "12:15"
    if "--until" in args:
        until = args[args.index("--until") + 1]
    hh, mm = map(int, until.split(":"))
    end = dt.datetime.now().replace(hour=hh, minute=mm, second=0, microsecond=0)
    os.makedirs(MEDIA, exist_ok=True)
    with open(CAMS_FILE) as fh:
        cams = json.load(fh)
    state = {}
    if os.path.exists(STATE):
        with open(STATE) as fh:
            state = json.load(fh)
    series = {}
    if os.path.exists(OUT) and state:
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
        while time.time() - t0 < PERIOD_S and not os.path.exists(STOP):
            time.sleep(3)
        if os.path.exists(STOP):
            break
    log("detector stop")


if __name__ == "__main__":
    main()

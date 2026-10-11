#!/usr/bin/env python3
"""Build app/public/data/tracker.json and app/public/media/tracker/: one morning of three PKLot cameras.

PKLot (Almeida et al., Expert Systems with Applications 42(11), 2015), CC BY 4.0, read from the
FiftyOne mirror https://huggingface.co/datasets/Voxel51/PKLot. PKLot cameras take one frame every
5 minutes (UFPR04 every 5 to 15). Three recorded mornings, played on one clock:
  PUCPR  2012-10-17 (Wed, 100 spaces), UFPR05 2013-03-22 (Fri, 40), UFPR04 2013-01-18 (Fri, 28).
Detector and rule are the ones of the /parking page: YOLO26n, whole frame plus 3 x 3 tiles at 960,
conf 0.05, a space is taken when one vehicle box covers 40% of it. A space changes state only when
two frames in a row agree (one wrong frame does not make an arrival). The typical day of each camera
(share of spaces taken by time of day) comes from the PKLot labels of its other weekdays.

  .venv/bin/python samples_src/make_tracker.py --data <dir with allrecs.json>
"""
import argparse, collections, concurrent.futures as cf, json, os, subprocess, sys, datetime as dt
import cv2

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from parking_eval import coverage, tiles, MIRROR, MAX_TILE_BOX, VEHICLES, WEIGHTS

HERE = os.path.dirname(os.path.abspath(__file__))
APP = os.path.join(HERE, "..", "app", "public")
LOTS = [
    {"id": "pucpr", "name": "PUCPR", "day": "2012-10-17"},
    {"id": "ufpr05", "name": "UFPR05", "day": "2013-03-22"},
    {"id": "ufpr04", "name": "UFPR04", "day": "2013-01-18"},
]
NAMES = {"pucpr": "PUCPR campus car park (Pontifical Catholic University of Parana), Curitiba",
         "ufpr05": "UFPR car park, 5th floor view (Federal University of Parana), Curitiba",
         "ufpr04": "UFPR car park, 4th floor view (Federal University of Parana), Curitiba"}
T0, T1 = "06:55", "10:35"
CONF, COVER = 0.05, 0.4
OUT_W, OUT_H = 800, 450


def hm(ts):
    return ts[11:16]


def minutes(s):
    return int(s[:2]) * 60 + int(s[3:5])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--weights", default="/Users/bayto/Desktop/claude/traffic-events/weights/yolo26m.pt")
    a = ap.parse_args()
    recs = json.load(open(os.path.join(a.data, "allrecs.json")))
    by = collections.defaultdict(list)
    for r in recs:
        by[(r["source"], r["ts"][:10])].append(r)
    imgdir = os.path.join(a.data, "img")
    os.makedirs(imgdir, exist_ok=True)

    sel = {}
    for L in LOTS:
        rs = sorted(by[(L["id"], L["day"])], key=lambda r: r["ts"])
        sel[L["id"]] = [r for r in rs if T0 <= hm(r["ts"]) <= T1]

    def get(r):
        p = os.path.join(imgdir, r["file"].replace("/", "__"))
        if not os.path.exists(p) or os.path.getsize(p) < 1000:
            subprocess.run(["curl", "-sL", "-m", "90", "--retry", "3", "-o", p, MIRROR + r["file"]])
        return p

    with cf.ThreadPoolExecutor(12) as ex:
        list(ex.map(get, [r for v in sel.values() for r in v]))

    from ultralytics import YOLO
    model = YOLO(a.weights)
    cache_p = os.path.join(a.data, "tracker_dets_%s.json" % os.path.basename(a.weights).split(".")[0])
    cache = json.load(open(cache_p)) if os.path.exists(cache_p) else {}
    media = os.path.join(APP, "media", "tracker")
    os.makedirs(media, exist_ok=True)

    lots_out, allrows, free_err, ev_in, ev_out = [], [], [], 0, 0
    for L in LOTS:
        rs = sel[L["id"]]
        os.makedirs(os.path.join(media, L["id"]), exist_ok=True)
        frames, ids, prev_raw, state = [], None, None, None
        for r in rs:
            p = get(r)
            im = cv2.imread(p)
            h, w = im.shape[:2]
            if r["file"] not in cache:
                out = []
                for ti, (x0, y0, x1, y1) in enumerate(tiles(w, h, 3)):
                    res = model.predict(im[y0:y1, x0:x1], imgsz=960, conf=CONF, classes=list(VEHICLES), verbose=False)[0]
                    for b in res.boxes:
                        bx = list(map(float, b.xyxy[0].tolist()))
                        if ti and (bx[2] - bx[0]) * (bx[3] - bx[1]) > MAX_TILE_BOX * (x1 - x0) * (y1 - y0):
                            continue
                        out.append([bx[0] + x0, bx[1] + y0, bx[2] + x0, bx[3] + y0])
                cache[r["file"]] = out
            boxes = cache[r["file"]]
            sp = sorted(r["spaces"], key=lambda s: int(s["id"]) if str(s["id"]).isdigit() else 0)
            if ids is None:
                ids = [s["id"] for s in sp]
                polys = [[[round(x * OUT_W, 1), round(y * OUT_H, 1)] for x, y in s["poly"]] for s in sp]
            byid = {s["id"]: s for s in sp}
            raw = [1 if (s := byid.get(i)) and coverage([(x * w, y * h) for x, y in s["poly"]], boxes) >= COVER else 0 for i in ids]
            gt = [1 if (s := byid.get(i)) and s["occ"] == "occupied" else 0 for i in ids]
            # a space changes state when two frames in a row agree
            if state is None:
                state = raw[:]
            else:
                state = [raw[k] if raw[k] == prev_raw[k] else state[k] for k in range(len(ids))]
            prev_raw = raw
            t = hm(r["ts"])
            src = f"/media/tracker/{L['id']}/{t.replace(':', '')}.jpg"
            small = cv2.resize(im, (OUT_W, OUT_H), interpolation=cv2.INTER_AREA)
            cv2.imwrite(os.path.join(APP, src.lstrip("/")), small, [cv2.IMWRITE_JPEG_QUALITY, 62])
            frames.append({"t": t, "src": src, "det": "".join(map(str, state)), "raw": "".join(map(str, raw)), "gt": "".join(map(str, gt))})
            allrows += [(g, d) for g, d in zip(gt, raw)]
            free_err.append(abs(sum(state) - sum(gt)))
        for k in range(1, len(frames)):
            a_, b_ = frames[k - 1]["det"], frames[k]["det"]
            frames[k]["in"] = sum(1 for x, y in zip(a_, b_) if x == "0" and y == "1")
            frames[k]["out"] = sum(1 for x, y in zip(a_, b_) if x == "1" and y == "0")
            ev_in += frames[k]["in"]; ev_out += frames[k]["out"]
        frames[0]["in"] = frames[0]["out"] = 0
        # typical day: share taken by 10-minute bin on this camera's other weekdays (labels)
        bins = collections.defaultdict(list)
        days = []
        for (src_, day), rr in by.items():
            if src_ != L["id"] or day == L["day"] or dt.date.fromisoformat(day).weekday() >= 5:
                continue
            occs = [(minutes(hm(x["ts"])), sum(1 for s in x["spaces"] if s["occ"] == "occupied") / max(1, len(x["spaces"]))) for x in rr]
            if max(o for _, o in occs) < 0.2:
                continue  # a holiday: the car park stayed empty
            days.append(day)
            for m, o in occs:
                bins[m // 10 * 10].append(o)
        profile = [{"m": m, "share": round(sum(v) / len(v), 3), "n": len(v)} for m, v in sorted(bins.items())]
        first = rs[0]
        lots_out.append({"id": L["id"], "name": L["name"], "long": NAMES[L["id"]], "date": L["day"],
                         "weekday": dt.date.fromisoformat(L["day"]).strftime("%A"),
                         "weather": collections.Counter(x["weather"] for x in rs).most_common(1)[0][0],
                         "capacity": len(ids), "w": OUT_W, "h": OUT_H, "spaces": polys,
                         "frames": frames, "profile": profile, "profileDays": sorted(days)})
    json.dump(cache, open(cache_p, "w"))
    tp = sum(1 for g, d in allrows if g and d); tn = sum(1 for g, d in allrows if not g and not d)
    fe = sorted(free_err)
    out = {
        "source": "PKLot (Almeida et al., Expert Systems with Applications 42(11), 2015, doi:10.1016/j.eswa.2015.02.009), CC BY 4.0, via https://huggingface.co/datasets/Voxel51/PKLot",
        "detector": "%s (Ultralytics, AGPL-3.0)" % os.path.basename(a.weights).split(".")[0].replace("yolo", "YOLO") + ", whole frame plus 3 x 3 tiles at 960 px, conf 0.05; a space is taken when one car, bus or truck box covers 40% of it; it changes state when two frames in a row agree",
        "clock": {"start": T0, "end": T1},
        "lots": lots_out,
        "eval": {"frames": len(free_err), "spaces": len(allrows), "accuracy": round((tp + tn) / len(allrows), 4),
                 "freeErr": {"median": fe[len(fe) // 2], "p90": fe[int(len(fe) * 0.9)], "mean": round(sum(fe) / len(fe), 2)},
                 "events": {"in": ev_in, "out": ev_out}},
    }
    os.makedirs(os.path.join(APP, "data"), exist_ok=True)
    json.dump(out, open(os.path.join(APP, "data", "tracker.json"), "w"), separators=(",", ":"))
    print(json.dumps(out["eval"]), [(l["id"], len(l["frames"]), l["profileDays"]) for l in lots_out])


if __name__ == "__main__":
    main()

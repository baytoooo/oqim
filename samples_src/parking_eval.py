# Parking-space occupancy from ordinary car-park camera images, measured on PKLot.
#
# Data: PKLot (Almeida et al., "PKLot: A robust dataset for parking lot classification", Expert
# Systems with Applications 42(11), 2015, doi:10.1016/j.eswa.2015.02.009), CC BY 4.0, from the
# FiftyOne mirror on Hugging Face (https://huggingface.co/datasets/Voxel51/PKLot), which keeps the
# full 1280x720 frames, the per-space 4-point polygons, the occupied flag and the weather label.
# The official archive (web.inf.ufpr.br/vri/databases/parking-lot-database/) is 4.6 GB, so this
# script reads 16 slices of 1.2 MB spread across the mirror's samples.json (266 MB), keeps the sample
# records that are whole inside a slice, and downloads up to 42 frames per (camera, weather) group.
#
# Detector: YOLO26n (the weights the browser model_n.onnx was exported from), classes car 2, bus 5,
# truck 7, imgsz 960 (Ultralytics letterboxes 1280x720 to 960x544, the browser model's input).
# A space is occupied when some vehicle box covers at least T of the space polygon's area
# (area(polygon inside box) / area(polygon)). The confidence and T are picked on a calibration
# split (every image whose name hashes to 0 mod 4), and measured on the rest.
#
# Usage:
#   .venv/bin/python samples_src/parking_eval.py --data <dir> [--fetch] [--out app/public/data/parking.json]

import argparse
import collections
import concurrent.futures as cf
import hashlib
import json
import os
import random
import re
import subprocess
import sys

MIRROR = "https://huggingface.co/datasets/Voxel51/PKLot/resolve/main/"
SAMPLES_SIZE = 266961322
N_CHUNKS, CHUNK = 16, 1_200_000
PER_GROUP = 42
VEHICLES = (2, 5, 7)
IMGSZ = 960
WEIGHTS = "/Users/bayto/Desktop/claude/traffic-events/weights/yolo26n.pt"
MAX_TILE_BOX = 0.25  # tile runs drop boxes larger than this share of the tile (src/scripts/parking.ts)


# ------------------------------------------------------------------ data

def fetch(data):
    os.makedirs(f"{data}/img", exist_ok=True)

    def chunk(off):
        p = f"{data}/chunk_{off}.json"
        if not os.path.exists(p) or os.path.getsize(p) < CHUNK:
            subprocess.run(["curl", "-sL", "-m", "120", "--retry", "3", "-r", f"{off}-{off + CHUNK - 1}", "-o", p, MIRROR + "samples.json"], check=True)
        return open(p, encoding="utf-8", errors="replace").read()

    offs = [int(i * (SAMPLES_SIZE - CHUNK) / (N_CHUNKS - 1)) for i in range(N_CHUNKS)]
    with cf.ThreadPoolExecutor(4) as ex:
        texts = list(ex.map(chunk, offs))
    start = re.compile(r'\{"_id": \{"\$oid": "[0-9a-f]+"\}, "filepath": "data/')
    recs, seen = [], set()
    for t in texts:
        for m in start.finditer(t):
            i, depth, instr, esc = m.start(), 0, False, False
            for j in range(i, len(t)):
                c = t[j]
                if instr:
                    if esc:
                        esc = False
                    elif c == "\\":
                        esc = True
                    elif c == '"':
                        instr = False
                elif c == '"':
                    instr = True
                elif c == "{":
                    depth += 1
                elif c == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            r = json.loads(t[i:j + 1])
                        except ValueError:
                            break
                        if r["filepath"] not in seen:
                            seen.add(r["filepath"])
                            recs.append({
                                "file": r["filepath"], "source": r.get("source"),
                                "weather": (r.get("weather") or {}).get("label"),
                                "ts": (r.get("parking_timestamp") or {}).get("$date"),
                                "spaces": [{"id": p.get("space_id"), "poly": p["points"][0], "occ": p.get("occupancy_status")}
                                           for p in r["parking_spaces"]["polylines"]],
                            })
                        break
    random.seed(7)
    groups = collections.defaultdict(list)
    for r in recs:
        groups[(r["source"], r["weather"])].append(r)
    sel = []
    for _, L in sorted(groups.items()):
        random.shuffle(L)
        sel += L[:PER_GROUP]

    def image(r):
        p = f"{data}/img/" + r["file"].replace("/", "__")
        if not os.path.exists(p) or os.path.getsize(p) < 1000:
            subprocess.run(["curl", "-sL", "-m", "90", "--retry", "3", "-o", p, MIRROR + r["file"]])

    with cf.ThreadPoolExecutor(8) as ex:
        list(ex.map(image, sel))
    json.dump(sel, open(f"{data}/selected.json", "w"))


# ------------------------------------------------------------------ geometry

def poly_area(P):
    return abs(sum(P[i][0] * P[i - 1][1] - P[i - 1][0] * P[i][1] for i in range(len(P)))) / 2


def clip_to_box(P, x1, y1, x2, y2):
    """Sutherland-Hodgman: the part of polygon P inside the axis-aligned box."""
    def clip(P, inside, cut):
        out = []
        for i in range(len(P)):
            a, b = P[i - 1], P[i]
            ia, ib = inside(a), inside(b)
            if ib:
                if not ia:
                    out.append(cut(a, b))
                out.append(b)
            elif ia:
                out.append(cut(a, b))
        return out

    def at_x(x):
        return lambda a, b: (x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0]))

    def at_y(y):
        return lambda a, b: (a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y)

    for inside, cut in ((lambda p: p[0] >= x1, at_x(x1)), (lambda p: p[0] <= x2, at_x(x2)),
                        (lambda p: p[1] >= y1, at_y(y1)), (lambda p: p[1] <= y2, at_y(y2))):
        P = clip(P, inside, cut)
        if not P:
            return []
    return P


def coverage(poly, boxes):
    """For each box, area(poly inside box) / area(poly); the largest."""
    a = poly_area(poly)
    if a <= 0:
        return 0.0
    best = 0.0
    xs, ys = [p[0] for p in poly], [p[1] for p in poly]
    for b in boxes:
        if b[2] <= min(xs) or b[0] >= max(xs) or b[3] <= min(ys) or b[1] >= max(ys):
            continue
        q = clip_to_box(poly, *b[:4])
        if len(q) >= 3:
            best = max(best, poly_area(q) / a)
    return best


# ------------------------------------------------------------------ eval

def tiles(w, h, n):
    """The whole frame, then n x n tiles of 1.25 / n of each side, evenly spread (src/scripts/parking.ts)."""
    out = [(0, 0, w, h)]
    if n > 1:
        f = min(1.0, 1.25 / n)
        tw, th = round(w * f), round(h * f)
        for j in range(n):
            for i in range(n):
                x0 = round(i * (w - tw) / (n - 1))
                y0 = round(j * (h - th) / (n - 1))
                out.append((x0, y0, x0 + tw, y0 + th))
    return out


def stats(rows):
    tp = sum(1 for g, p in rows if g and p)
    fp = sum(1 for g, p in rows if not g and p)
    fn = sum(1 for g, p in rows if g and not p)
    tn = sum(1 for g, p in rows if not g and not p)
    n = tp + fp + fn + tn
    return {"spaces": n, "accuracy": round((tp + tn) / n, 4) if n else None,
            "precision": round(tp / (tp + fp), 4) if tp + fp else None,
            "recall": round(tp / (tp + fn), 4) if tp + fn else None,
            "tp": tp, "fp": fp, "fn": fn, "tn": tn}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True)
    ap.add_argument("--fetch", action="store_true")
    ap.add_argument("--out", default=None, help="write the page's parking.json here, and its sample frames to --media")
    ap.add_argument("--media", default=None, help="directory for the sample frames (app/public/media/parking)")
    ap.add_argument("--imgsz", type=int, default=IMGSZ)
    ap.add_argument("--weights", default=WEIGHTS, help="yolo26n.pt, or app/public/pipeline/model_n.onnx (what the page runs)")
    ap.add_argument("--grid", type=int, default=1, help="also detect on N x N overlapping tiles (as the page does)")
    a = ap.parse_args()
    if a.fetch:
        fetch(a.data)
    sel = json.load(open(f"{a.data}/selected.json"))
    sel = [r for r in sel if os.path.exists(f"{a.data}/img/" + r["file"].replace("/", "__"))]

    from ultralytics import YOLO
    onnx = a.weights.endswith(".onnx")
    model = YOLO(a.weights, task="detect")
    # the browser model has a fixed 544 x 960 input; the .pt letterboxes 1280 x 720 to the same size
    imgsz = [544, 960] if onnx else a.imgsz
    tag = "onnx" if onnx else "pt"
    cache = f"{a.data}/dets_{tag}_{a.imgsz}_g{a.grid}.json"
    dets = json.load(open(cache)) if os.path.exists(cache) else {}
    for k, r in enumerate(sel):
        if r["file"] in dets:
            continue
        p = f"{a.data}/img/" + r["file"].replace("/", "__")
        import cv2
        im = cv2.imread(p)
        h, w = im.shape[:2]
        out = []
        for ti, (x0, y0, x1, y1) in enumerate(tiles(w, h, a.grid)):
            res = model.predict(im[y0:y1, x0:x1], imgsz=imgsz, conf=0.05, classes=list(VEHICLES), verbose=False)[0]
            for b in res.boxes:
                bx = list(map(float, b.xyxy[0].tolist()))
                # a tile sees part of the car park: a box over a quarter of it is not one vehicle
                if ti and (bx[2] - bx[0]) * (bx[3] - bx[1]) > MAX_TILE_BOX * (x1 - x0) * (y1 - y0):
                    continue
                out.append([bx[0] + x0, bx[1] + y0, bx[2] + x0, bx[3] + y0, float(b.conf[0]), int(b.cls[0])])
        dets[r["file"]] = {"w": w, "h": h, "boxes": out}
        if k % 50 == 0:
            print(k, len(sel), file=sys.stderr)
    json.dump(dets, open(cache, "w"))

    def calib(r):
        return int(hashlib.md5(r["file"].encode()).hexdigest(), 16) % 4 == 0

    # per space: (image, ground truth occupied, coverage at each confidence)
    CONFS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4]
    TS = [0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6]
    spaces = []
    for r in sel:
        d = dets[r["file"]]
        for s in r["spaces"]:
            if s["occ"] not in ("occupied", "not occupied"):
                continue
            poly = [(x * d["w"], y * d["h"]) for x, y in s["poly"]]
            cov = {c: coverage(poly, [b for b in d["boxes"] if b[4] > c]) for c in CONFS}
            spaces.append((r, s["occ"] == "occupied", cov))
    cal = [x for x in spaces if calib(x[0])]
    test = [x for x in spaces if not calib(x[0])]
    grid = []
    for c in CONFS:
        for t in TS:
            st = stats([(g, cov[c] >= t) for _, g, cov in cal])
            grid.append((st["accuracy"], c, t))
    grid.sort(reverse=True)
    _, conf, thr = grid[0]
    print("calibration best", grid[:5], file=sys.stderr)

    def measure(xs):
        return {"images": len({x[0]["file"] for x in xs}), **stats([(g, cov[conf] >= thr) for _, g, cov in xs])}

    by_weather = {w: measure([x for x in test if x[0]["weather"] == w]) for w in sorted({x[0]["weather"] for x in test})}
    by_camera = {c: measure([x for x in test if x[0]["source"] == c]) for c in sorted({x[0]["source"] for x in test})}
    imgs_test = sorted({x[0]["file"] for x in test})
    imgs_cal = sorted({x[0]["file"] for x in cal})
    # per image: error in the free count
    count_err = []
    for f in imgs_test:
        xs = [x for x in test if x[0]["file"] == f]
        count_err.append(abs(sum(1 for _, g, _c in xs if not g) - sum(1 for _, g, cov in xs if cov[conf] < thr)))
    count_err.sort()
    ev = {
        "dataset": "PKLot (Almeida et al., Expert Systems with Applications, 2015)",
        "licence": "CC BY 4.0",
        "source": "https://huggingface.co/datasets/Voxel51/PKLot (FiftyOne copy of the official PKLot release, web.inf.ufpr.br/vri/databases/parking-lot-database/)",
        "detector": f"YOLO26n ({os.path.basename(a.weights)}), classes car, bus, truck, input 960 x 544" + (f", whole frame plus {a.grid} x {a.grid} overlapping tiles" if a.grid > 1 else ", whole frame"),
        "rule": {"conf": conf, "coverage": thr, "text": f"a space is taken when one car, bus or truck box with confidence above {conf} covers at least {round(thr * 100)}% of the space's area" + (f"; the detector runs on the whole frame and on {a.grid} x {a.grid} overlapping tiles" if a.grid > 1 else "")},
        "calibration": measure(cal),
        "test": measure(test),
        "by_weather": by_weather,
        "by_camera": by_camera,
        "free_count_error": {"median": count_err[len(count_err) // 2], "p90": count_err[int(len(count_err) * 0.9)], "mean": round(sum(count_err) / len(count_err), 2)},
        "grid_top": [{"accuracy": g[0], "conf": g[1], "coverage": g[2]} for g in grid[:5]],
    }
    print(json.dumps(ev, indent=1))
    if a.out:
        export(a, sel, dets, ev, conf, thr, set(imgs_test))
    json.dump({"eval": ev, "conf": conf, "thr": thr, "test_files": imgs_test}, open(f"{a.data}/eval_{tag}_{a.imgsz}_g{a.grid}.json", "w"))


def export(a, sel, dets, ev, conf, thr, test_files):
    """12 test frames for the page: per (camera, weather), the frame with mixed occupancy whose
    agreement with the hand labels is the group's median (not the best one)."""
    from PIL import Image
    os.makedirs(a.media, exist_ok=True)
    groups = collections.defaultdict(list)
    for r in sel:
        if r["file"] not in test_files:
            continue
        d = dets[r["file"]]
        lab = [s for s in r["spaces"] if s["occ"] in ("occupied", "not occupied")]
        taken = sum(1 for s in lab if s["occ"] == "occupied") / max(1, len(lab))
        mixed = 0.25 <= taken <= 0.85
        good = 0
        for s in lab:
            poly = [(x * d["w"], y * d["h"]) for x, y in s["poly"]]
            good += (coverage(poly, [b for b in d["boxes"] if b[4] > conf]) >= thr) == (s["occ"] == "occupied")
        groups[(r["source"], r["weather"])].append((good / max(1, len(lab)), mixed, r))
    extra = {("pucpr", "sunny"), ("ufpr04", "sunny"), ("ufpr05", "cloudy"), ("ufpr05", "rainy")}
    picks = []
    for k in sorted(groups):
        # frames with a mix of free and taken spaces, when the group has any
        L = sorted([x for x in groups[k] if x[1]] or groups[k], key=lambda x: x[0])
        idx = [len(L) // 2] + ([len(L) // 4] if k in extra and len(L) > 3 else [])
        picks += [L[i][2] for i in idx]
    samples = []
    for r in picks[:12]:
        d = dets[r["file"]]
        ts = (r["ts"] or "")[:16].replace("T", " ")
        name = f'{r["source"]}_{r["weather"]}_{ts.replace(" ", "_").replace(":", "")}.jpg'
        im = Image.open(f"{a.data}/img/" + r["file"].replace("/", "__")).convert("RGB")
        k = 1280 / im.width
        if k != 1:
            im = im.resize((1280, round(im.height * k)), Image.LANCZOS)
        im.save(f"{a.media}/{name}", quality=82, optimize=True)
        samples.append({
            "id": name[:-4], "src": f"/media/parking/{name}", "w": im.width, "h": im.height,
            "camera": r["source"], "weather": r["weather"], "time": ts, "pklot": r["file"],
            "spaces": [{"id": s["id"], "occupied": s["occ"] == "occupied",
                        "poly": [[round(x * im.width, 1), round(y * im.height, 1)] for x, y in s["poly"]]}
                       for s in r["spaces"] if s["occ"] in ("occupied", "not occupied")],
        })
    doc = {
        "dataset": {
            "name": "PKLot", "licence": "CC BY 4.0", "licenceUrl": "https://creativecommons.org/licenses/by/4.0/",
            "source": "https://huggingface.co/datasets/Voxel51/PKLot",
            "official": "https://web.inf.ufpr.br/vri/databases/parking-lot-database/",
            "citation": "P. R. L. de Almeida, L. S. Oliveira, A. S. Britto Jr., E. J. Silva Jr., A. L. Koerich. PKLot: A robust dataset for parking lot classification. Expert Systems with Applications 42(11), 2015. doi:10.1016/j.eswa.2015.02.009",
            "note": "Cameras PUCPR, UFPR04 and UFPR05 in Curitiba, Brazil. Sample frames recompressed (JPEG quality 82); polygons and occupied flags as in the dataset.",
        },
        "rule": {"conf": conf, "coverage": thr, "classes": list(VEHICLES), "grid": a.grid, "maxTileBox": MAX_TILE_BOX, "text": ev["rule"]["text"]},
        "eval": ev,
        "samples": samples,
    }
    json.dump(doc, open(a.out, "w"), separators=(",", ":"))
    print("wrote", a.out, len(samples), "samples", file=sys.stderr)


if __name__ == "__main__":
    main()

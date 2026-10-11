"""Pick 6 sample photos for the /roads page from the evaluated RDD2022 test images, copy them
(resized, recompressed) to app/public/media/roads/, and write app/public/data/roads.json with
their hand labels, the offline detections of the browser model (app/public/roads/model.onnx) and a
demo location in Tashkent for each. The locations are made up for the demo: RDD2022 photos were
taken in Japan, India, the Czech Republic, Norway, the United States and China.

Usage: python samples_src/roads_samples.py <dir with ds/images/test, ds/labels/test>
"""
import json, sys
from pathlib import Path
from PIL import Image
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
work = Path(sys.argv[1]).resolve()
ds = work / "ds"
CONF = 0.25
MAXW = 1024
NAMES = ["Longitudinal crack", "Transverse crack", "Alligator crack", "Pothole"]

# made-up demo locations on real Tashkent streets (approximate points from OpenStreetMap)
DEMO = [
    ("Amir Temur Avenue, Yunusobod", 41.3405, 69.2853),
    ("Bunyodkor Avenue, Chilonzor", 41.2846, 69.2104),
    ("Shota Rustaveli Street", 41.2937, 69.2668),
    ("Buyuk Ipak Yuli Street", 41.3265, 69.3335),
    ("Alisher Navoi Street", 41.3227, 69.2503),
    ("Mustaqillik Avenue", 41.3247, 69.2960),
]

def gt(path: Path, w: int, h: int):
    out = []
    for l in path.read_text().splitlines():
        if not l.strip():
            continue
        c, x, y, bw, bh = l.split()[:5]
        x, y, bw, bh = float(x) * w, float(y) * h, float(bw) * w, float(bh) * h
        out.append([int(c), round(x - bw / 2), round(y - bh / 2), round(x + bw / 2), round(y + bh / 2)])
    return out

def iou(a, b):
    ix = max(0, min(a[2], b[2]) - max(a[0], b[0])); iy = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    i = ix * iy
    u = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - i
    return i / u if u > 0 else 0

model = YOLO(str(ROOT / "app" / "public" / "roads" / "model.onnx"), task="detect")
cands = []
for img in sorted((ds / "images" / "test").glob("*.jpg")):
    if "Drone" in img.name:  # top-down drone views, unlike a phone on a dashboard
        continue
    w, h = Image.open(img).size
    labels = gt(ds / "labels" / "test" / (img.stem + ".txt"), w, h)
    if not labels:
        continue
    r = model.predict(str(img), imgsz=640, conf=CONF, verbose=False)[0]
    dets = [[int(c), *[round(float(v)) for v in xyxy], round(float(s), 3)]
            for xyxy, s, c in zip(r.boxes.xyxy.tolist(), r.boxes.conf.tolist(), r.boxes.cls.tolist())]
    hit = sum(any(d[0] == g[0] and iou(d[1:5], g[1:5]) >= 0.5 for d in dets) for g in labels)
    fp = sum(not any(d[0] == g[0] and iou(d[1:5], g[1:5]) >= 0.5 for g in labels) for d in dets)
    cands.append(dict(img=img, w=w, h=h, labels=labels, dets=dets, hit=hit, fp=fp,
                      worst=max(g[0] for g in labels), country=img.stem.rsplit("_", 1)[0].replace("_", " ")))

# 2 with a pothole, 1 alligator, 1 transverse, 1 longitudinal, 1 where the model misses something;
# different countries where possible. Picked by a fixed rule, not by eye.
chosen, used = [], set()
def take(pred, n=1):
    for c in sorted(cands, key=lambda c: (-(c["hit"] / len(c["labels"])), c["fp"], -len(c["labels"]), c["img"].name)):
        if n == 0:
            return
        if c["img"] in [x["img"] for x in chosen] or c["country"] in used or not pred(c):
            continue
        chosen.append(c); used.add(c["country"]); n -= 1
take(lambda c: c["worst"] == 3 and c["hit"] >= 1, 2)
take(lambda c: c["worst"] == 2 and c["hit"] >= 1)
take(lambda c: c["worst"] == 1 and c["hit"] >= 1)
take(lambda c: c["worst"] == 0 and c["hit"] >= 1)
used.clear()
for c in sorted(cands, key=lambda c: (-len(c["labels"]), c["img"].name)):
    if c["img"] not in [x["img"] for x in chosen] and c["hit"] < len(c["labels"]) and c["hit"] >= 1:
        chosen.append(c); break

dst = ROOT / "app" / "public" / "media" / "roads"
dst.mkdir(parents=True, exist_ok=True)
samples = []
for (street, lat, lon), c in zip(DEMO, chosen):
    k = min(1, MAXW / c["w"])
    W, H = round(c["w"] * k), round(c["h"] * k)
    im = Image.open(c["img"]).convert("RGB")
    if k < 1:
        im = im.resize((W, H), Image.LANCZOS)
    im.save(dst / c["img"].name, quality=88)
    sc = lambda b: [b[0], *[round(v * k) for v in b[1:5]], *b[5:]]
    samples.append({
        "id": c["img"].stem, "src": f"/media/roads/{c['img'].name}", "w": W, "h": H,
        "country": c["country"], "original": f"RDD2022 test, {c['img'].name}, {c['w']} x {c['h']}",
        "demo": {"street": street, "lat": lat, "lon": lon},
        "labels": [sc(g) for g in c["labels"]],
        "offline": [sc(d) for d in c["dets"]],
        "offline_hits": c["hit"],
    })
    print(c["img"].name, "labels", [g[0] for g in c["labels"]], "dets", [d[0] for d in c["dets"]], "hit", c["hit"], "fp", c["fp"])

out = {
    "classes": [
        {"id": 3, "code": "D40", "name": "Pothole", "rank": 4, "color": "#ff5b4c"},
        {"id": 2, "code": "D20", "name": "Alligator crack", "rank": 3, "color": "#ff9f1c"},
        {"id": 1, "code": "D10", "name": "Transverse crack", "rank": 2, "color": "#f3c316"},
        {"id": 0, "code": "D00", "name": "Longitudinal crack", "rank": 1, "color": "#5fb4ff"},
    ],
    "conf": CONF,
    "input": 640,
    "model": "/roads/model.onnx",
    "map_center": [69.2797, 41.3111],
    "dataset": "RDD2022 (Arya et al., arXiv:2209.08538), CC BY-SA 4.0, via https://huggingface.co/datasets/dronefreak/RDD2022",
    "samples": samples,
}
(ROOT / "app" / "public" / "data" / "roads.json").write_text(json.dumps(out, indent=1))
print("wrote", len(samples))

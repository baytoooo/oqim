"""Evaluate the RDD2022 YOLOv8n road damage detector on a 300-image sample of the RDD2022 test
split and export it to ONNX (NMS in the graph) for the /roads page.

Model: https://huggingface.co/dronefreak/rdd2022-yolov8n (best.pt, AGPL-3.0, sha256 d1c3536d...)
Data:  https://huggingface.co/datasets/dronefreak/RDD2022 (CC BY-SA 4.0), test split, 300 images.

Usage: python samples_src/roads_eval.py <dir with yolov8n_best.pt and ds/images/test, ds/labels/test>
Writes app/public/data/roads_eval.json and app/public/roads/model.onnx.
"""
import json, shutil, sys, hashlib
from collections import Counter
from pathlib import Path
from ultralytics import YOLO, __version__ as ul_version

ROOT = Path(__file__).resolve().parents[1]
work = Path(sys.argv[1]).resolve()
pt = work / "yolov8n_best.pt"
ds = work / "ds"
sha = hashlib.sha256(pt.read_bytes()).hexdigest()

yaml = work / "rdd_test.yaml"
yaml.write_text(
    f"path: {ds}\ntrain: images/test\nval: images/test\n"
    "names:\n  0: longitudinal_crack\n  1: transverse_crack\n  2: alligator_crack\n  3: pothole\n"
)

model = YOLO(str(pt))
names = model.names
m = model.val(data=str(yaml), imgsz=640, batch=16, conf=0.001, iou=0.7, device="cpu",
              plots=False, verbose=False, project=str(work / "val"), name="run", exist_ok=True)
box = m.box

inst = Counter()
imgs_with = Counter()
for f in (ds / "labels" / "test").glob("*.txt"):
    cls = [int(l.split()[0]) for l in f.read_text().splitlines() if l.strip()]
    inst.update(cls)
    imgs_with.update(set(cls))
n_images = len(list((ds / "images" / "test").glob("*.jpg")))

codes = {0: "D00", 1: "D10", 2: "D20", 3: "D40"}
labels = {0: "Longitudinal crack", 1: "Transverse crack", 2: "Alligator crack", 3: "Pothole"}
per_class = []
for i, c in enumerate(box.ap_class_index):
    c = int(c)
    per_class.append({
        "class_id": c, "code": codes[c], "name": labels[c],
        "instances": inst[c], "images": imgs_with[c],
        "precision": round(float(box.p[i]), 3), "recall": round(float(box.r[i]), 3),
        "ap50": round(float(box.ap50[i]), 3), "ap50_95": round(float(box.ap[i]), 3),
    })

out = {
    "model": {
        "name": "YOLOv8n fine-tuned on RDD2022 (4 classes)",
        "source": "https://huggingface.co/dronefreak/rdd2022-yolov8n",
        "file": "best.pt",
        "sha256": sha,
        "licence": "AGPL-3.0 (stated on the model card)",
        "trained_by": "dronefreak, DetectionBench (https://github.com/dronefreak/DetectionBench)",
        "card_reports": {"split": "full RDD2022 test split", "map50": 0.588, "map50_95": 0.3205,
                         "precision": 0.6203, "recall": 0.5608},
        "browser_file": "/roads/model.onnx",
        "input": 640,
    },
    "dataset": {
        "name": "RDD2022, 4-class CRDDC2022 taxonomy, YOLO export",
        "source": "https://huggingface.co/datasets/dronefreak/RDD2022",
        "original": "https://github.com/sekilab/RoadDamageDetector (Arya et al., arXiv:2209.08538)",
        "licence": "CC BY-SA 4.0",
        "split": "test",
        "images": n_images,
        "instances": sum(inst.values()),
        "note": f"A {n_images}-image sample of the test split (Japan, India, Czech, Norway, United States, China), "
                "not the whole split. Numbers on the full split will differ.",
    },
    "method": {
        "tool": f"ultralytics {ul_version} model.val",
        "imgsz": 640, "conf": 0.001, "nms_iou": 0.7, "match_iou": 0.5,
        "precision_recall": "per class at the confidence that maximises mean F1 (ultralytics default)",
    },
    "overall": {
        "map50": round(float(box.map50), 3), "map50_95": round(float(box.map), 3),
        "precision": round(float(box.mp), 3), "recall": round(float(box.mr), 3),
    },
    "per_class": per_class,
}
dst = ROOT / "app" / "public" / "data" / "roads_eval.json"
dst.write_text(json.dumps(out, indent=2))
print(json.dumps(out["overall"]), json.dumps(per_class))

if "--no-export" not in sys.argv:
    onnx = YOLO(str(pt)).export(format="onnx", imgsz=640, nms=True, simplify=True, device="cpu")
    (ROOT / "app" / "public" / "roads").mkdir(parents=True, exist_ok=True)
    shutil.copy(onnx, ROOT / "app" / "public" / "roads" / "model.onnx")
    print("exported", onnx)

#!/usr/bin/env python3
"""Collect Hong Kong Transport Department traffic snapshots (DATA.GOV.HK) for Kwun Tong.

Standard library only. Every 60 s, for each camera within 700 m of (22.3162, 114.2155),
GET the JPG with If-Modified-Since; when Last-Modified is new, save
samples_src/hongkong/<key>/<YYYYmmddTHHMMSS>.jpg (timestamp = Last-Modified, UTC).
Runs until 12:15 local time or until samples_src/hongkong/STOP exists.

  python3 hongkong_collect.py [--until HH:MM] [--once]
"""
import datetime as dt
import email.utils
import json
import math
import os
import sys
import time
import urllib.error
import urllib.request
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(HERE, "hongkong")
STOP = os.path.join(OUTDIR, "STOP")
CAMS_FILE = os.path.join(OUTDIR, "cameras.json")
LIST_XML = os.environ.get("HK_XML", "")
LIST_URL = "https://static.data.gov.hk/td/traffic-snapshot-images/code/Traffic_Camera_Locations_En.xml"
CENTER = (22.3162, 114.2155)   # Kwun Tong / Ngau Tau Kok (lat, lon)
RADIUS_M = 700.0
PERIOD_S = 60
UA = "oqim-hackathon-hk-cctv/1.0 (python urllib)"


def log(msg):
    print("%s %s" % (dt.datetime.now().strftime("%H:%M:%S"), msg), flush=True)


def hav(lat1, lon1, lat2, lon2):
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def load_cameras():
    if os.path.exists(CAMS_FILE):
        with open(CAMS_FILE) as fh:
            return json.load(fh)
    if LIST_XML and os.path.exists(LIST_XML):
        root = ET.parse(LIST_XML).getroot()
    else:
        req = urllib.request.Request(LIST_URL, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            root = ET.fromstring(r.read())
    cams = []
    for im in root.iter("image"):
        d = {c.tag: (c.text or "").strip() for c in im}
        lat, lon = float(d["latitude"]), float(d["longitude"])
        dist = hav(CENTER[0], CENTER[1], lat, lon)
        if dist > RADIUS_M:
            continue
        cams.append({"id": d["key"], "name": d["description"], "lat": round(lat, 6),
                     "lon": round(lon, 6), "district": d.get("district", ""),
                     "imageUrl": d["url"], "dist_m": round(dist)})
    cams.sort(key=lambda c: c["dist_m"])
    os.makedirs(OUTDIR, exist_ok=True)
    with open(CAMS_FILE, "w") as fh:
        json.dump(cams, fh, indent=1, ensure_ascii=False)
    return cams


last_seen = {}


def fetch(cam):
    url = cam["imageUrl"]
    hdr = {"User-Agent": UA}
    if url in last_seen:
        hdr["If-Modified-Since"] = last_seen[url]
    try:
        req = urllib.request.Request(url, headers=hdr)
        with urllib.request.urlopen(req, timeout=30) as r:
            lm = r.headers.get("Last-Modified")
            body = r.read()
    except urllib.error.HTTPError as ex:
        if ex.code == 304:
            return None
        return "%s: HTTP %s" % (cam["id"], ex.code)
    except Exception as ex:  # noqa: BLE001
        return "%s: %s" % (cam["id"], ex)
    if not lm or not body:
        return None
    t = email.utils.parsedate_to_datetime(lm).astimezone(dt.timezone.utc)
    d = os.path.join(OUTDIR, cam["id"])
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, t.strftime("%Y%m%dT%H%M%S") + ".jpg")
    last_seen[url] = lm
    if os.path.exists(path):
        return None
    tmp = path + ".part"
    with open(tmp, "wb") as fh:
        fh.write(body)
    os.replace(tmp, path)
    return "saved %s/%s" % (cam["id"], os.path.basename(path))


def main():
    args = sys.argv[1:]
    until = "12:15"
    if "--until" in args:
        until = args[args.index("--until") + 1]
    hh, mm = map(int, until.split(":"))
    end = dt.datetime.now().replace(hour=hh, minute=mm, second=0, microsecond=0)
    cams = load_cameras()
    log("collector start: %d cameras, until %s, pid %d" % (len(cams), until, os.getpid()))
    with ThreadPoolExecutor(max_workers=8) as pool:
        while True:
            t0 = time.time()
            res = list(pool.map(fetch, cams))
            new = [r for r in res if r and r.startswith("saved")]
            for r in res:
                if r and not r.startswith("saved"):
                    log("error " + r)
            log("round: %d new images" % len(new))
            if "--once" in args or dt.datetime.now() >= end or os.path.exists(STOP):
                break
            while time.time() - t0 < PERIOD_S and not os.path.exists(STOP):
                time.sleep(2)
            if os.path.exists(STOP):
                break
    log("collector stop")


if __name__ == "__main__":
    main()

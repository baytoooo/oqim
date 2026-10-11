#!/usr/bin/env python3
"""Collect TfL JamCams clips (mp4 + jpg) around Kennington Oval, London.

Powered by TfL Open Data. Standard library only.
Every 60 s, for each camera, GET the mp4 and jpg with If-Modified-Since; when the
Last-Modified header is new, save samples_src/london/<camera id>/<YYYYmmddTHHMMSS>.mp4/.jpg
(timestamp = Last-Modified, UTC). Runs until 12:10 local time or until
samples_src/london/STOP exists.

  python3 london_collect.py [--until HH:MM] [--once]
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
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
OUTDIR = os.path.join(HERE, "london")
STOP = os.path.join(OUTDIR, "STOP")
CAMS_FILE = os.path.join(OUTDIR, "cameras.json")
JAMCAMS = os.environ.get("JAMCAMS_JSON", "")
API = "https://api.tfl.gov.uk/Place/Type/JamCam"
CENTER = (51.4830, -0.11599)   # Kennington Oval (lat, lon)
RADIUS_M = 650.0
PERIOD_S = 60
UA = "oqim-hackathon-jamcams/1.0 (python urllib)"


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
    if JAMCAMS and os.path.exists(JAMCAMS):
        with open(JAMCAMS) as fh:
            places = json.load(fh)
    else:
        req = urllib.request.Request(API, headers={"User-Agent": UA})
        with urllib.request.urlopen(req, timeout=60) as r:
            places = json.load(r)
    cams = []
    for p in places:
        ap = {a["key"]: a["value"] for a in p.get("additionalProperties", [])}
        d = hav(CENTER[0], CENTER[1], p["lat"], p["lon"])
        if d > RADIUS_M or ap.get("available") != "true":
            continue
        cams.append({"id": p["id"], "name": p["commonName"], "lat": p["lat"], "lon": p["lon"],
                     "view": ap.get("view", "").replace("\\/", "/"),
                     "imageUrl": ap.get("imageUrl"), "videoUrl": ap.get("videoUrl"),
                     "dist_m": round(d)})
    cams.sort(key=lambda c: c["dist_m"])
    os.makedirs(OUTDIR, exist_ok=True)
    with open(CAMS_FILE, "w") as fh:
        json.dump(cams, fh, indent=1)
    return cams


last_seen = {}   # url -> Last-Modified header string


def fetch(cam, url, ext):
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
        return "%s %s: HTTP %s" % (cam["id"], ext, ex.code)
    except Exception as ex:  # noqa: BLE001
        return "%s %s: %s" % (cam["id"], ext, ex)
    if not lm or not body:
        return None
    t = email.utils.parsedate_to_datetime(lm).astimezone(dt.timezone.utc)
    d = os.path.join(OUTDIR, cam["id"])
    os.makedirs(d, exist_ok=True)
    path = os.path.join(d, t.strftime("%Y%m%dT%H%M%S") + "." + ext)
    last_seen[url] = lm
    if os.path.exists(path):
        return None
    tmp = path + ".part"
    with open(tmp, "wb") as fh:
        fh.write(body)
    os.replace(tmp, path)
    return "saved %s/%s (%d B)" % (cam["id"], os.path.basename(path), len(body))


def main():
    args = sys.argv[1:]
    until = "12:10"
    if "--until" in args:
        until = args[args.index("--until") + 1]
    hh, mm = map(int, until.split(":"))
    end = dt.datetime.now().replace(hour=hh, minute=mm, second=0, microsecond=0)
    cams = load_cameras()
    log("collector start: %d cameras, until %s, pid %d" % (len(cams), until, os.getpid()))
    jobs = [(c, c["videoUrl"], "mp4") for c in cams] + [(c, c["imageUrl"], "jpg") for c in cams]
    with ThreadPoolExecutor(max_workers=8) as pool:
        while True:
            t0 = time.time()
            res = list(pool.map(lambda j: fetch(*j), jobs))
            new = [r for r in res if r and r.startswith("saved")]
            for r in res:
                if r and not r.startswith("saved"):
                    log("error " + r)
            log("round: %d new files (%s)" % (len(new), ", ".join(
                r.split()[1] for r in new if r.endswith(")") and ".mp4" in r)[:400]))
            if "--once" in args or dt.datetime.now() >= end or os.path.exists(STOP):
                break
            while time.time() - t0 < PERIOD_S:
                if os.path.exists(STOP):
                    break
                time.sleep(2)
            if os.path.exists(STOP):
                break
    log("collector stop")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build a compact road graph of Kennington (London) from OpenStreetMap (Overpass API).

Adapted from make_roads.py. Standard library only. Writes app/public/data/london_roads.json.

  python3 make_roads.py                 # fetch (or reuse cache) and build
  python3 make_roads.py --refresh       # ignore cache, fetch again
  python3 make_roads.py --cache FILE    # where to keep the raw Overpass JSON

Output format (no indentation):
  source, bbox [minLon, minLat, maxLon, maxLat],
  nodes [[lon, lat], ...]                       index = node id
  edges [[a, b, metres, cls, oneway, lanes], ...]
        cls 0 motorway/trunk, 1 primary, 2 secondary, 3 tertiary, 4 link
        oneway 1 = only a -> b allowed, 0 = both directions
        lanes = OSM lanes tag as a number, 0 if missing
  names ["street", ...]                         names[i] for edge i (dropped if file > 4 MB)
  junctions [{"node", "lon", "lat", "name"}, ...] signalised junctions
"""
import heapq
import json
import math
import os
import sys
import tempfile
import time
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "app", "public", "data", "london_roads.json")

SOUTH, WEST, NORTH, EAST = 51.472, -0.133, 51.494, -0.098
ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]
TIMEOUT = 180
SOURCE = "OpenStreetMap contributors (ODbL 1.0), via the Overpass API, fetched 2026-10-11"
MAX_BYTES = 4 * 1024 * 1024

CLS = {"motorway": 0, "trunk": 0, "primary": 1, "secondary": 2, "tertiary": 3,
       "motorway_link": 4, "trunk_link": 4, "primary_link": 4}
SIMPLIFY_M = 1.5        # Douglas-Peucker tolerance for dropping shape points
CLUSTER_M = 60.0        # signal nodes closer than this form one junction
SNAP_MAX_M = 50.0       # a junction must have a graph node within this distance
NAME_RADIUS_M = 50.0    # streets "near" a junction for naming


def query(bbox):
    s, w, n, e = bbox
    b = "%.3f,%.3f,%.3f,%.3f" % (s, w, n, e)
    hw = "|".join(CLS)
    return ("[out:json][timeout:%d];"
            "way[\"highway\"~\"^(%s)$\"](%s);out body geom;"
            "node[\"highway\"=\"traffic_signals\"](%s);out body;") % (TIMEOUT, hw, b, b)


def fetch(q):
    body = urllib.parse.urlencode({"data": q}).encode()
    last = None
    for attempt in range(2):
        for url in ENDPOINTS:
            t0 = time.time()
            try:
                print("fetching %s (try %d)" % (url, attempt + 1), flush=True)
                req = urllib.request.Request(url, data=body, headers={
                    "User-Agent": "oqim-hackathon-roads-london/1.0 (python urllib)",
                    "Content-Type": "application/x-www-form-urlencoded"})
                with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
                    raw = r.read()
                data = json.loads(raw)
                if not data.get("elements"):
                    raise RuntimeError("empty response: %s" % data.get("remark", ""))
                print("  ok, %.1f MB in %.0f s" % (len(raw) / 1e6, time.time() - t0), flush=True)
                return data
            except Exception as ex:  # noqa: BLE001 - try the next mirror
                last = ex
                print("  failed after %.0f s: %s" % (time.time() - t0, ex), flush=True)
        time.sleep(5)
    raise SystemExit("all Overpass endpoints failed: %s" % last)


def hav(lon1, lat1, lon2, lat2):
    r = 6371008.8
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


KX = 111320.0 * math.cos(math.radians((SOUTH + NORTH) / 2))
KY = 110574.0


def xy(lon, lat):
    return lon * KX, lat * KY


def dp_keep(pts, keep, tol):
    """Douglas-Peucker on a run of (x, y); marks indices to keep in `keep`."""
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        if j <= i + 1:
            continue
        ax, ay = pts[i]
        bx, by = pts[j]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        best, bk = -1.0, -1
        for k in range(i + 1, j):
            px, py = pts[k]
            if L2 == 0:
                d = math.hypot(px - ax, py - ay)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L2))
                d = math.hypot(px - ax - t * dx, py - ay - t * dy)
            if d > best:
                best, bk = d, k
        if best > tol:
            keep[bk] = True
            stack.append((i, bk))
            stack.append((bk, j))


def parse_lanes(v):
    if not v:
        return 0
    num = ""
    for ch in v.split(";")[0].strip():
        if ch.isdigit() or (ch == "." and "." not in num):
            num += ch
        else:
            break
    try:
        return int(float(num)) if num else 0
    except ValueError:
        return 0


def way_name(t):
    for k in ("name", "name:en", "ref"):
        if t.get(k):
            return t[k].strip()
    return ""


def oneway_dir(t):
    """+1 forward only, -1 reverse only, 0 both."""
    o = (t.get("oneway") or "").lower()
    if o in ("yes", "true", "1"):
        return 1
    if o in ("-1", "reverse"):
        return -1
    if o in ("no", "false", "0"):
        return 0
    if t.get("junction") in ("roundabout", "circular"):
        return 1
    if t.get("highway") in ("motorway", "motorway_link"):
        return 1
    return 0


def inside(lat, lon):
    return SOUTH <= lat <= NORTH and WEST <= lon <= EAST


def build(data):
    coord = {}      # osm node id -> (lon, lat)
    ways = []
    signals = []
    for el in data["elements"]:
        if el["type"] == "way" and el.get("geometry"):
            ways.append(el)
            for nid, g in zip(el["nodes"], el["geometry"]):
                if g:
                    coord[nid] = (g["lon"], g["lat"])
        elif el["type"] == "node":
            signals.append((el["id"], el["lon"], el["lat"]))
    print("raw: %d ways, %d signal nodes" % (len(ways), len(signals)))

    # nodes that must survive simplification: shared by ways, way ends, clip ends
    use = {}
    runs = []       # (way, [osm ids inside bbox, consecutive])
    for w in ways:
        cur = []
        for nid in w["nodes"]:
            c = coord.get(nid)
            if c and inside(c[1], c[0]):
                cur.append(nid)
            else:
                if len(cur) >= 2:
                    runs.append((w, cur))
                cur = []
        if len(cur) >= 2:
            runs.append((w, cur))
    for w, run in runs:
        for k, nid in enumerate(run):
            use[nid] = use.get(nid, 0) + (2 if k in (0, len(run) - 1) else 1)

    # keep signal nodes on the roads as graph nodes as well
    sigset = {sid for sid, _lon, _lat in signals if sid in coord}

    idx = {}
    nodes = []
    edges = []      # [a, b, metres, cls, oneway, lanes, name]

    def nid_index(nid):
        i = idx.get(nid)
        if i is None:
            i = idx[nid] = len(nodes)
            nodes.append(coord[nid])
        return i

    def seg_len(a, b):
        return hav(*coord[a], *coord[b])

    seen = set()
    for w, run in runs:
        t = w.get("tags", {})
        cls = CLS[t["highway"]]
        ow = oneway_dir(t)
        lanes = parse_lanes(t.get("lanes"))
        name = way_name(t)
        pts = [xy(*coord[n]) for n in run]
        keep = [use[n] > 1 or n in sigset for n in run]
        keep[0] = keep[-1] = True
        hard = [k for k, v in enumerate(keep) if v]
        for i, j in zip(hard, hard[1:]):
            if j > i + 1:
                sub = [False] * (j - i + 1)
                dp_keep(pts[i:j + 1], sub, SIMPLIFY_M)
                for k, v in enumerate(sub):
                    if v:
                        keep[i + k] = True
        ks = [k for k, v in enumerate(keep) if v]
        for i, j in zip(ks, ks[1:]):
            a, b = run[i], run[j]
            if a == b:
                continue
            m = sum(seg_len(run[k], run[k + 1]) for k in range(i, j))
            if ow == -1:
                a, b = b, a
            key = (a, b, cls)
            if key in seen:
                continue
            seen.add(key)
            edges.append([a, b, m, cls, 1 if ow else 0, lanes, name])

    # largest connected component (undirected)
    parent = {}

    def find(x):
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    for e in edges:
        ra, rb = find(e[0]), find(e[1])
        if ra != rb:
            parent[ra] = rb
    size = {}
    allnodes = {n for e in edges for n in (e[0], e[1])}
    for n in allnodes:
        r = find(n)
        size[r] = size.get(r, 0) + 1
    big = max(size, key=size.get)
    print("components: %d, largest has %d of %d nodes" % (len(size), size[big], len(allnodes)))
    edges = [e for e in edges if find(e[0]) == big]

    # renumber nodes in edge order
    for e in edges:
        e[0] = nid_index(e[0])
        e[1] = nid_index(e[1])
    return nodes, edges, signals


def make_junctions(nodes, edges, signals):
    # grid for graph nodes
    cell = 100.0
    grid = {}
    pxy = [xy(lon, lat) for lon, lat in nodes]
    for i, (x, y) in enumerate(pxy):
        grid.setdefault((int(x // cell), int(y // cell)), []).append(i)

    def near(x, y, r):
        cx, cy = int(x // cell), int(y // cell)
        rr = int(r // cell) + 1
        for gx in range(cx - rr, cx + rr + 1):
            for gy in range(cy - rr, cy + rr + 1):
                for i in grid.get((gx, gy), ()):
                    d = math.hypot(pxy[i][0] - x, pxy[i][1] - y)
                    if d <= r:
                        yield i, d

    # cluster signals (single linkage, 60 m)
    sxy = [xy(lon, lat) for _sid, lon, lat in signals]
    par = list(range(len(sxy)))

    def f(x):
        while par[x] != x:
            par[x] = par[par[x]]
            x = par[x]
        return x

    sg = {}
    for i, (x, y) in enumerate(sxy):
        sg.setdefault((int(x // CLUSTER_M), int(y // CLUSTER_M)), []).append(i)
    for i, (x, y) in enumerate(sxy):
        cx, cy = int(x // CLUSTER_M), int(y // CLUSTER_M)
        for gx in (cx - 1, cx, cx + 1):
            for gy in (cy - 1, cy, cy + 1):
                for j in sg.get((gx, gy), ()):
                    if j > i and math.hypot(sxy[j][0] - x, sxy[j][1] - y) <= CLUSTER_M:
                        ri, rj = f(i), f(j)
                        if ri != rj:
                            par[ri] = rj
    clusters = {}
    for i in range(len(sxy)):
        clusters.setdefault(f(i), []).append(i)

    adj = {}
    inc = {}
    for k, e in enumerate(edges):
        adj.setdefault(e[0], set()).add(e[1])
        adj.setdefault(e[1], set()).add(e[0])
        inc.setdefault(e[0], []).append(k)
        inc.setdefault(e[1], []).append(k)

    out = {}
    for members in clusters.values():
        cx = sum(sxy[i][0] for i in members) / len(members)
        cy = sum(sxy[i][1] for i in members) / len(members)
        best = min(near(cx, cy, SNAP_MAX_M), key=lambda t: t[1], default=None)
        if best is None:
            continue
        n = best[0]
        deg = len(adj.get(n, ()))
        major = any(edges[k][3] <= 2 for k in inc.get(n, ()))
        if deg < 3 and not major:
            continue
        # names: streets at the node first, then nearby, higher class first
        # rank: edges touching the junction node, then road class, then how
        # many edges of that street are nearby, then distance
        at, cl, cnt, dist = {}, {}, {}, {}
        for m, d in near(cx, cy, NAME_RADIUS_M):
            for k in inc.get(m, ()):
                nm = edges[k][6]
                if not nm:
                    continue
                if m == n:
                    at[nm] = at.get(nm, 0) + 1
                cl[nm] = min(cl.get(nm, 9), edges[k][3])
                cnt[nm] = cnt.get(nm, 0) + 1
                dist[nm] = min(dist.get(nm, 1e9), d)
        names = sorted(cl, key=lambda nm: (-at.get(nm, 0), cl[nm], -cnt[nm], dist[nm]))[:2]
        if n not in out or len(members) > out[n][1]:
            out[n] = (" / ".join(names), len(members))
    js = [{"node": n, "lon": round(nodes[n][0], 6), "lat": round(nodes[n][1], 6),
           "name": nm} for n, (nm, _) in sorted(out.items())]
    return js


def dijkstra(nodes, edges, s, t):
    g = {}
    for a, b, m, _c, ow, _l, *_ in edges:
        g.setdefault(a, []).append((b, m))
        if not ow:
            g.setdefault(b, []).append((a, m))
    dist = {s: 0.0}
    pq = [(0.0, s)]
    while pq:
        d, u = heapq.heappop(pq)
        if u == t:
            return d
        if d > dist.get(u, 1e18):
            continue
        for v, m in g.get(u, ()):
            nd = d + m
            if nd < dist.get(v, 1e18):
                dist[v] = nd
                heapq.heappush(pq, (nd, v))
    return None


def sanity(nodes, edges, junctions):
    inc_names = {}
    for a, b, m, c, ow, l, nm in edges:
        if c == 1 and nm:
            inc_names.setdefault(a, set()).add(nm)
            inc_names.setdefault(b, set()).add(nm)
    cand = [j for j in junctions if j["node"] in inc_names]
    best = None
    for i, x in enumerate(cand):
        for y in cand[i + 1:]:
            common = inc_names[x["node"]] & inc_names[y["node"]]
            if not common:
                continue
            d = hav(x["lon"], x["lat"], y["lon"], y["lat"])
            score = abs(d - 1000)
            if best is None or score < best[0]:
                best = (score, x, y, d, sorted(common)[0])
    if not best:
        print("sanity: no pair of junctions on a shared primary road")
        return
    _, x, y, d, road = best
    r1 = dijkstra(nodes, edges, x["node"], y["node"])
    r2 = dijkstra(nodes, edges, y["node"], x["node"])
    print("sanity: %s, junction %d (%s) <-> %d (%s), straight %.0f m" %
          (road, x["node"], x["name"], y["node"], y["name"], d))
    print("  route a->b: %s m, b->a: %s m" %
          ("%.1f" % r1 if r1 is not None else "unreachable",
           "%.1f" % r2 if r2 is not None else "unreachable"))


def main():
    args = sys.argv[1:]
    cache = os.path.join(tempfile.gettempdir(), "oqim_overpass_london.json")
    if "--cache" in args:
        cache = args[args.index("--cache") + 1]
    if "--refresh" not in args and os.path.exists(cache):
        print("using cached Overpass response %s" % cache)
        with open(cache) as fh:
            data = json.load(fh)
    else:
        data = fetch(query((SOUTH, WEST, NORTH, EAST)))
        with open(cache, "w") as fh:
            json.dump(data, fh)

    nodes, edges, signals = build(data)
    junctions = make_junctions(nodes, edges, signals)
    sanity(nodes, edges, junctions)

    def render(with_names, edge_list):
        obj = {
            "source": SOURCE,
            "bbox": [WEST, SOUTH, EAST, NORTH],
            "nodes": [[round(lon, 6), round(lat, 6)] for lon, lat in nodes],
            "edges": [[a, b, round(m, 1), c, ow, l] for a, b, m, c, ow, l, _ in edge_list],
        }
        if with_names:
            obj["names"] = [e[6] for e in edge_list]
        obj["junctions"] = junctions
        return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))

    txt = render(True, edges)
    note = "with names"
    if len(txt.encode()) > MAX_BYTES:
        txt = render(False, edges)
        note = "names dropped"
    if len(txt.encode()) > MAX_BYTES:
        print("still over 4 MB; rerun with tertiary removed (edit CLS) if needed")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(txt)
    print("nodes %d, edges %d, junctions %d, file %.2f MB (%s) -> %s" %
          (len(nodes), len(edges), len(junctions), os.path.getsize(OUT) / 1e6,
           note, os.path.abspath(OUT)))


if __name__ == "__main__":
    main()

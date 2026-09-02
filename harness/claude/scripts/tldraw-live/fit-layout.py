#!/usr/bin/env python3
"""Search cluster-local cell assignments that minimise elbow-arrow crossings.

Mirrors index.html's geometry exactly: same cell size, same gutters, same
auto-height, same both-L-routes-blocked crossing test. Reads a seed, reassigns
row/col within each cluster, writes the seed back.
"""
import json, math, random, sys
from pathlib import Path

CELL_W, CELL_H, GUTTER, GUTTER_Y = 330, 150, 90, 190
LINE_H, TEXT_PAD, CLUSTER_PAD, CLUSTER_GAP = 26, 26, 45, CELL_W + GUTTER


def text_h(t, w):
    per = max(1, int((w - TEXT_PAD) // 8.4))
    return sum(max(1, math.ceil(len(l) / per)) for l in str(t or "").split("\n")) * LINE_H + TEXT_PAD


def absolute(seed):
    """Cluster-local row/col -> absolute rects, exactly as the page does it."""
    order = [c["id"] for c in seed.get("clusters", [])]
    for b in seed["boxes"]:
        k = b.get("cluster")
        if k is not None and k not in order:
            order.append(k)
    out, pen = {}, 0
    for key in order:
        mem = [b for b in seed["boxes"] if b.get("cluster") == key]
        if not mem:
            continue
        rects = []
        for b in mem:
            w = CELL_W
            rects.append((b, b["col"] * (CELL_W + GUTTER), b["row"] * (CELL_H + GUTTER_Y), w,
                          max(CELL_H, text_h(b["text"], w))))
        fw = max(x + w for _, x, _, w, _ in rects) + CLUSTER_PAD * 2
        for b, x, y, w, h in rects:
            out[b["id"]] = dict(id=b["id"], x=pen + x + CLUSTER_PAD, y=y + CLUSTER_PAD, w=w, h=h)
        pen += fw + CLUSTER_GAP
    return out


def _h(y, x0, x1, b):
    return b["y"] < y < b["y"] + b["h"] and b["x"] < max(x0, x1) and b["x"] + b["w"] > min(x0, x1)


def _v(x, y0, y1, b):
    return b["x"] < x < b["x"] + b["w"] and b["y"] < max(y0, y1) and b["y"] + b["h"] > min(y0, y1)


def faults(seed):
    pos = absolute(seed)
    cross, clash = [], []
    for a in seed["arrows"]:
        A, B = pos.get(a["from"]), pos.get(a["to"])
        if not A or not B:
            continue
        ax, ay = A["x"] + A["w"] / 2, A["y"] + A["h"] / 2
        bx, by = B["x"] + B["w"] / 2, B["y"] + B["h"] / 2
        others = [o for o in pos.values() if o is not A and o is not B]
        viaX = [o for o in others if _h(ay, ax, bx, o) or _v(bx, ay, by, o)]
        viaY = [o for o in others if _v(ax, ay, by, o) or _h(by, ax, bx, o)]
        if viaX and viaY:
            cross.append(f"{a['from']}->{a['to']}")
        # A label is a rect, not a point: test its whole box, at the straight
        # midpoint and at both elbow corners, and flag only when every candidate
        # placement lands on a box.
        text = a.get("text") or ""
        if text:
            lw, lh = len(text) * 8.4, 30.0
            spots = [((ax + bx) / 2, (ay + by) / 2), (bx, ay), (ax, by)]
            blocked = 0
            for cx, cy in spots:
                r = dict(x=cx - lw / 2, y=cy - lh / 2, w=lw, h=lh)
                if any(o["x"] < r["x"] + r["w"] and o["x"] + o["w"] > r["x"]
                       and o["y"] < r["y"] + r["h"] and o["y"] + o["h"] > r["y"] for o in others):
                    blocked += 1
            if blocked == len(spots):
                clash.append(f"{a['from']}->{a['to']}")
    ids = list(pos.values())
    tight = []
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            A, B = ids[i], ids[j]
            gx = max(B["x"] - (A["x"] + A["w"]), A["x"] - (B["x"] + B["w"]))
            gy = max(B["y"] - (A["y"] + A["h"]), A["y"] - (B["y"] + B["h"]))
            if gx < GUTTER and gy < GUTTER:
                tight.append(f"{A['id']}~{B['id']}")
    return cross, clash, tight


def band_of(box):
    """The row band a box's own kind asks for: entry points read at the top, the
    things data rests in below them, requests leaving the system at the bottom."""
    t = box["text"].lower()
    if "entry point" in t:
        return 0
    if "api call" in t:
        return 2
    return 1


def cost(seed):
    """Crossings dominate, then a box sitting outside the band its kind asks for.
    A diagram with no crossings that reads bottom-up is not the cheaper one."""
    c, l, t = faults(seed)
    pos = absolute(seed)
    span = 0
    for a in seed["arrows"]:
        A, B = pos.get(a["from"]), pos.get(a["to"])
        if A and B:
            span += abs(A["x"] - B["x"]) + abs(A["y"] - B["y"])

    return len(c) * 1000 + len(l) * 600 + len(t) * 400 + span / 300


def band_rows(seed):
    """Each band gets a contiguous RANGE of rows, in band order, wide enough to
    stack the band's own boxes. A band is a region, not a single row: one row per
    band forces a hub to fan across its siblings, and every one of those arrows
    crosses. Returns {(cluster, band): [allowed rows]}."""
    per = {}
    for b in seed["boxes"]:
        per.setdefault(b.get("cluster"), {}).setdefault(band_of(b), []).append(b)
    allowed = {}
    for cluster, bands in per.items():
        row = 0
        for band in sorted(bands):
            members = bands[band]
            depth = 1 if len(members) <= 3 else 2
            allowed[(cluster, band)] = list(range(row, row + depth))
            row += depth
    return allowed


def search(seed, rounds=30000, seed_val=7):
    """Place each box on a free cell inside its own band's row range."""
    rng = random.Random(seed_val)
    allowed = band_rows(seed)
    width = 4
    for b in seed["boxes"]:
        b["_lane"] = (b.get("cluster"), band_of(b))
    # seed a starting placement: fill each band's cells in order
    used = {}
    for b in seed["boxes"]:
        rows = allowed[b["_lane"]]
        for r in rows:
            for c in range(width):
                if (b.get("cluster"), r, c) not in used:
                    b["row"], b["col"] = r, c
                    used[(b.get("cluster"), r, c)] = b
                    break
            else:
                continue
            break
    best = cost(seed)
    boxes = seed["boxes"]
    for _ in range(rounds):
        box = rng.choice(boxes)
        rows = allowed[box["_lane"]]
        orow, ocol = box["row"], box["col"]
        nrow, ncol = rng.choice(rows), rng.randint(0, width - 1)
        occupant = next((o for o in boxes
                         if o is not box and o.get("cluster") == box.get("cluster")
                         and o["row"] == nrow and o["col"] == ncol), None)
        if occupant is not None and occupant["_lane"] != box["_lane"]:
            continue
        if occupant is not None:
            occupant["row"], occupant["col"] = orow, ocol
        box["row"], box["col"] = nrow, ncol
        now = cost(seed)
        if now <= best:
            best = now
        else:
            box["row"], box["col"] = orow, ocol
            if occupant is not None:
                occupant["row"], occupant["col"] = nrow, ncol
    for b in seed["boxes"]:
        b.pop("_lane", None)
    return best


def compact(seed):
    """Close empty leading rows/cols per cluster so a frame has no dead margin."""
    clusters = {}
    for b in seed["boxes"]:
        clusters.setdefault(b.get("cluster"), []).append(b)
    for members in clusters.values():
        for axis in ("row", "col"):
            used = sorted({m[axis] for m in members})
            remap = {v: i for i, v in enumerate(used)}
            for m in members:
                m[axis] = remap[m[axis]]


if __name__ == "__main__":
    path = Path(sys.argv[1])
    seed = json.loads(path.read_text())
    print("before:", [len(x) for x in faults(seed)], "cost %.2f" % cost(seed))

    def attempt(s):
        d = json.loads(path.read_text())
        return search(d, seed_val=s), d

    _, seed = min((attempt(s) for s in range(12)), key=lambda pair: pair[0])
    compact(seed)
    c, l, t = faults(seed)
    print("after :", f"crossings={len(c)} labels={len(l)} crowded={len(t)}", "cost %.2f" % cost(seed))
    if c:
        print("  remaining crossings:", " ".join(c))
    path.write_text(json.dumps(seed, indent=2) + "\n")
    print("wrote", path)

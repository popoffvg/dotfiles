#!/usr/bin/env python3
"""Draw a board seed as ASCII, with the same layout and fault checks as index.html.

Usage: seed-ascii.py <topic>.seed.json [--match <topic>.json]

  default  the ASCII picture, the page's status line, and the box and arrow listing
  --match  compare a built tldraw document with the seed; exit 1 on any difference

The geometry constants and the layout MUST stay equal to the ones in index.html,
or the ASCII picture stops being the board the page builds.
"""

import argparse
import importlib.util
import json
import sys
import textwrap
from pathlib import Path

CELL_W, CELL_H = 330, 150
GUTTER, GUTTER_Y = 90, 190
LINE_H, TEXT_PAD = 26, 26
CLUSTER_PAD = 45
CLUSTER_GAP = CELL_W + GUTTER

# Pixels per character cell of the picture.
PX_X, PX_Y = 15, 30


def text_height(text, w):
    per_line = max(1, int((w - TEXT_PAD) // 8.4))
    lines = sum(max(1, -(-len(line) // per_line)) for line in str(text or "").split("\n"))
    return lines * LINE_H + TEXT_PAD


def rect_of(box):
    if box.get("row") is not None and box.get("col") is not None:
        col_span, row_span = box.get("colSpan", 1), box.get("rowSpan", 1)
        w = col_span * CELL_W + (col_span - 1) * GUTTER
        return {
            "x": box["col"] * (CELL_W + GUTTER),
            "y": box["row"] * (CELL_H + GUTTER_Y),
            "w": w,
            "h": max(row_span * CELL_H + (row_span - 1) * GUTTER_Y, text_height(box.get("text"), w)),
        }
    if all(box.get(k) is not None for k in ("x", "y", "w", "h")):
        return {k: box[k] for k in ("x", "y", "w", "h")}
    sys.exit(f'seed-ascii: box "{box.get("id")}" needs row+col, or x+y+w+h')


def layout(seed):
    """Return (frames, boxes) in page pixels, the same as layout() in index.html."""
    declared = [c["id"] for c in seed.get("clusters", [])]
    invented = []
    for box in seed.get("boxes", []):
        key = box.get("cluster")
        if key is not None and key not in declared and key not in invented:
            invented.append(key)

    frames, boxes, pen_x = [], [], 0
    for key in declared + invented:
        members = [b for b in seed.get("boxes", []) if b.get("cluster") == key]
        if not members:
            continue
        rects = [(b, rect_of(b)) for b in members]
        w = max(r["x"] + r["w"] for _, r in rects) + CLUSTER_PAD * 2
        h = max(r["y"] + r["h"] for _, r in rects) + CLUSTER_PAD * 2
        meta = next((c for c in seed.get("clusters", []) if c["id"] == key), {"id": key})
        frames.append({"x": pen_x, "y": 0, "w": w, "h": h, "name": meta.get("text", key)})
        for box, r in rects:
            boxes.append({**r, "id": box["id"], "text": box.get("text", ""),
                          "x": pen_x + r["x"] + CLUSTER_PAD, "y": r["y"] + CLUSTER_PAD})
        pen_x += w + CLUSTER_GAP

    for box in seed.get("boxes", []):
        if box.get("cluster") is None:
            boxes.append({**rect_of(box), "id": box["id"], "text": box.get("text", "")})
    return frames, boxes


def center(r):
    return r["x"] + r["w"] / 2, r["y"] + r["h"] / 2


def h_blocked(y, x0, x1, b):
    return b["y"] < y < b["y"] + b["h"] and b["x"] < max(x0, x1) and b["x"] + b["w"] > min(x0, x1)


def v_blocked(x, y0, y1, b):
    return b["x"] < x < b["x"] + b["w"] and b["y"] < max(y0, y1) and b["y"] + b["h"] > min(y0, y1)


def routes(a, b, others):
    """Blockers of the two elbow routes: horizontal leg first, and vertical leg first."""
    ax, ay = center(a)
    bx, by = center(b)
    via_x = [o for o in others if h_blocked(ay, ax, bx, o) or v_blocked(bx, ay, by, o)]
    via_y = [o for o in others if v_blocked(ax, ay, by, o) or h_blocked(by, ax, bx, o)]
    return via_x, via_y


def faults(seed, boxes):
    by_id = {b["id"]: b for b in boxes}
    tight, crossings, clashes = [], [], []
    for i, a in enumerate(boxes):
        for b in boxes[i + 1:]:
            gap_x = max(b["x"] - (a["x"] + a["w"]), a["x"] - (b["x"] + b["w"]))
            gap_y = max(b["y"] - (a["y"] + a["h"]), a["y"] - (b["y"] + b["h"]))
            if gap_x < GUTTER and gap_y < GUTTER:
                tight.append(f"{a['id']}~{b['id']}")
    for arrow in seed.get("arrows", []):
        a, b = by_id.get(arrow["from"]), by_id.get(arrow["to"])
        if not a or not b:
            continue
        others = [o for o in boxes if o is not a and o is not b]
        via_x, via_y = routes(a, b, others)
        if via_x and via_y:
            named = [o["id"] for o in via_x if o in via_y] or [o["id"] for o in via_x]
            crossings.append(f"{arrow['from']}->{arrow['to']} through {','.join(named)}")
        if arrow.get("text"):
            (ax, ay), (bx, by) = center(a), center(b)
            mx, my = (ax + bx) / 2, (ay + by) / 2
            for o in others:
                if o["x"] < mx < o["x"] + o["w"] and o["y"] < my < o["y"] + o["h"]:
                    clashes.append(f"{arrow['from']}->{arrow['to']} on {o['id']}")
                    break
    found = [
        f"crowded: {' '.join(tight)}" if tight else "",
        f"arrow crosses a box: {' '.join(crossings)}" if crossings else "",
        f"label on a box: {' '.join(clashes)}" if clashes else "",
    ]
    found = [f for f in found if f]
    return "built from seed — " + (" | ".join(found) if found else "clean")


def label_point(arrow, a, b, others, placed, ends=None):
    """Where the page puts the label: the first clear spot along the elbow."""
    (ax, ay), (bx, by) = ends or (center(a), center(b))
    legs = [(ax, ay, bx, ay), (bx, ay, bx, by)]
    lengths = [abs(x1 - x0) + abs(y1 - y0) for x0, y0, x1, y1 in legs]
    total = sum(lengths) or 1

    def point_at(t):
        want = t * total
        for i, (x0, y0, x1, y1) in enumerate(legs):
            if want <= lengths[i] or i == len(legs) - 1:
                f = min(1, want / lengths[i]) if lengths[i] else 0
                return x0 + (x1 - x0) * f, y0 + (y1 - y0) * f
            want -= lengths[i]
        return bx, by

    lw, lh = len(arrow["text"]) * 8.4, 30

    def hits(r, o):
        return r["x"] < o["x"] + o["w"] and r["x"] + r["w"] > o["x"] and r["y"] < o["y"] + o["h"] and r["y"] + r["h"] > o["y"]

    for t in (0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85):
        cx, cy = point_at(t)
        rect = {"x": cx - lw / 2, "y": cy - lh / 2, "w": lw, "h": lh}
        if any(hits(rect, o) for o in others) or any(hits(rect, o) for o in placed):
            continue
        placed.append(rect)
        return cx, cy
    return point_at(0.5)


class Canvas:
    def __init__(self, w, h):
        self.rows = [[" "] * w for _ in range(h)]

    def put(self, col, row, ch):
        if 0 <= row < len(self.rows) and 0 <= col < len(self.rows[0]):
            self.rows[row][col] = ch

    def text(self, col, row, s):
        for i, ch in enumerate(s):
            self.put(col + i, row, ch)

    def render(self):
        return "\n".join("".join(r).rstrip() for r in self.rows)


def cells(r):
    """A pixel rect as character bounds: left, top, right, bottom (inclusive)."""
    left, top = round(r["x"] / PX_X), round(r["y"] / PX_Y)
    return left, top, round((r["x"] + r["w"]) / PX_X) - 1, round((r["y"] + r["h"]) / PX_Y) - 1


def inside(c, col, row):
    return c[0] <= col <= c[2] and c[1] <= row <= c[3]


def draw(seed):
    frames, boxes = layout(seed)
    by_id = {b["id"]: b for b in boxes}
    status = faults(seed, boxes)

    # Box text can need more rows than the page height gives it: grow the box down.
    box_cells = {}
    box_lines = {}
    for b in boxes:
        c = cells(b)
        width = max(1, c[2] - c[0] - 3)
        lines = [w for line in b["text"].split("\n") for w in (textwrap.wrap(line, width) or [""])]
        box_lines[b["id"]] = lines
        box_cells[b["id"]] = (c[0], c[1], c[2], max(c[3], c[1] + len(lines) + 1))

    rights = [cells(f)[2] for f in frames] + [c[2] for c in box_cells.values()]
    bottoms = [cells(f)[3] for f in frames] + [c[3] for c in box_cells.values()]
    canvas = Canvas(max(rights, default=0) + 30, max(bottoms, default=0) + 2)

    for f in frames:
        left, top, right, bottom = cells(f)
        for col in range(left, right + 1):
            canvas.put(col, top, ".")
            canvas.put(col, bottom, ".")
        for row in range(top, bottom + 1):
            canvas.put(left, row, ":")
            canvas.put(right, row, ":")
        canvas.text(left + 2, top, f" {f['name']} ")

    crossings = []
    arrow_ends = {}
    pair_total, pair_seen = {}, {}
    for arrow in seed.get("arrows", []):
        key = tuple(sorted((arrow["from"], arrow["to"])))
        pair_total[key] = pair_total.get(key, 0) + 1

    for arrow in seed.get("arrows", []):
        a, b = by_id.get(arrow["from"]), by_id.get(arrow["to"])
        if not a or not b:
            continue
        key = tuple(sorted((arrow["from"], arrow["to"])))
        index = pair_seen.get(key, 0)
        pair_seen[key] = index + 1
        total = pair_total[key]

        (ax, ay), (bx, by) = center(a), center(b)
        if total > 1:
            t = (index + 1) / (total + 1)
            if abs(ax - bx) >= abs(ay - by):
                ay, by = a["y"] + a["h"] * t, b["y"] + b["h"] * t
            else:
                ax, bx = a["x"] + a["w"] * t, b["x"] + b["w"] * t
        arrow_ends[id(arrow)] = ((ax, ay), (bx, by))
        others = [o for o in boxes if o is not a and o is not b]
        via_x, _ = routes(a, b, others)
        corner = (bx, ay) if not via_x else (ax, by)

        ca, cb = box_cells[a["id"]], box_cells[b["id"]]
        points = [(round(ax / PX_X), round(ay / PX_Y)),
                  (round(corner[0] / PX_X), round(corner[1] / PX_Y)),
                  (round(bx / PX_X), round(by / PX_Y))]
        path = []
        for (c0, r0), (c1, r1) in zip(points, points[1:]):
            step_c = (c1 > c0) - (c1 < c0)
            step_r = (r1 > r0) - (r1 < r0)
            col, row = c0, r0
            while (col, row) != (c1, r1):
                path.append((col, row, "-" if step_c else "|"))
                col, row = col + step_c, row + step_r
        path.append((points[-1][0], points[-1][1], "|"))

        line_char = "~" if arrow.get("kind") == "arc" else None
        outside = [(col, row, ch) for col, row, ch in path if not inside(ca, col, row) and not inside(cb, col, row)]
        for i, (col, row, ch) in enumerate(outside):
            if i and (outside[i - 1][2] != ch):
                ch = "+"
            canvas.put(col, row, line_char or ch)
            for o in others:
                c = box_cells[o["id"]]
                # Mark only the border, so the box text stays readable.
                if inside(c, col, row) and (col in (c[0], c[2]) or row in (c[1], c[3])):
                    crossings.append((col, row))
        if outside:
            col, row, _ = outside[-1]
            head = {(1, 0): "<", (-1, 0): ">", (0, 1): "^", (0, -1): "v"}
            for (dc, dr), ch in head.items():
                if inside(cb, col + dc * -1, row + dr * -1):
                    canvas.put(col, row, ch)

    for b in boxes:
        left, top, right, bottom = box_cells[b["id"]]
        for col in range(left, right + 1):
            canvas.put(col, top, "-")
            canvas.put(col, bottom, "-")
        for row in range(top, bottom + 1):
            canvas.put(left, row, "|")
            canvas.put(right, row, "|")
            if top < row < bottom:
                canvas.text(left + 1, row, " " * (right - left - 1))
        for corner_col, corner_row in ((left, top), (right, top), (left, bottom), (right, bottom)):
            canvas.put(corner_col, corner_row, "+")
        for i, line in enumerate(box_lines[b["id"]]):
            canvas.text(left + 2, top + 1 + i, line)

    for col, row in crossings:
        canvas.put(col, row, "#")

    placed = []
    for arrow in seed.get("arrows", []):
        a, b = by_id.get(arrow["from"]), by_id.get(arrow["to"])
        if not a or not b or not arrow.get("text"):
            continue
        others = [o for o in boxes if o is not a and o is not b]
        cx, cy = label_point(arrow, a, b, others, placed, arrow_ends.get(id(arrow)))
        col0, row = round(cx / PX_X) - len(arrow["text"]) // 2, round(cy / PX_Y)
        for i, ch in enumerate(arrow["text"]):
            if not any(inside(c, col0 + i, row) for c in box_cells.values()):
                canvas.put(col0 + i, row, ch)

    return canvas.render(), status, boxes


def listing(seed):
    first = {b["id"]: (b.get("text", "").split("\n")[0].strip() or b["id"]) for b in seed.get("boxes", [])}
    boxes = sorted(first.values())
    arrows = sorted((first.get(a["from"], a["from"]), first.get(a["to"], a["to"]), a.get("text", ""))
                    for a in seed.get("arrows", []))
    return boxes, arrows


def match(seed, doc_path):
    """Compare the built document with the seed: box names, arrows, and box corners."""
    spec = importlib.util.spec_from_file_location("read_doc", Path(__file__).with_name("read-doc.py"))
    read_doc = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(read_doc)
    doc_boxes, doc_arrows = read_doc.load(Path(doc_path))

    want_boxes, want_arrows = listing(seed)
    got_boxes = sorted(read_doc.label(doc_boxes, k) for k in doc_boxes)
    got_arrows = sorted((read_doc.label(doc_boxes, a["from"]), read_doc.label(doc_boxes, a["to"]), a["text"])
                        for a in doc_arrows)

    diffs = []
    for name in sorted(set(want_boxes) ^ set(got_boxes)):
        diffs.append(f"box {name}: {'only in seed' if name in want_boxes else 'only on board'}")
    for arrow in sorted(set(want_arrows) ^ set(got_arrows)):
        where = "only in seed" if arrow in want_arrows else "only on board"
        diffs.append(f"arrow {arrow[0]} -> {arrow[1]} — {arrow[2]}: {where}")

    _, laid = layout(seed)
    corners = {(b["text"].split("\n")[0].strip() or b["id"]): (round(b["x"]), round(b["y"])) for b in laid}
    for box in doc_boxes.values():
        name = read_doc.label(doc_boxes, box["id"])
        want = corners.get(name)
        if want and (abs(want[0] - box["x"]) > 2 or abs(want[1] - box["y"]) > 2):
            diffs.append(f"box {name}: at {box['x']},{box['y']}, seed puts it at {want[0]},{want[1]}")
    return diffs


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("seed")
    parser.add_argument("--match", metavar="DOCUMENT")
    args = parser.parse_args()
    seed = json.loads(Path(args.seed).read_text())

    if args.match:
        diffs = match(seed, args.match)
        for d in diffs:
            print(d)
        print("board matches the seed" if not diffs else f"{len(diffs)} differences")
        sys.exit(1 if diffs else 0)

    picture, status, _ = draw(seed)
    print(picture)
    print()
    print(status)
    boxes, arrows = listing(seed)
    print(f"\n{len(boxes)} boxes: {', '.join(boxes)}")
    print(f"{len(arrows)} arrows")
    for a, b, text in arrows:
        print(f"  {a} -> {b}" + (f"  — {text}" if text else ""))


if __name__ == "__main__":
    main()

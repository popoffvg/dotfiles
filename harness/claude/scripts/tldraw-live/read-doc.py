#!/usr/bin/env python3
"""Print a tldraw-live document as boxes and arrows.

The saved document is a full tldraw snapshot — tens of kilobytes of records.
This reads it back as the same plain shape the seed file uses, so a diagram can
be reviewed or re-seeded without loading the whole snapshot.

Usage: read-doc.py <document.json> [--seed]

  default  a readable listing
  --seed   seed-format JSON, ready to write back as <name>.seed.json
"""

import argparse
import json
from pathlib import Path


def plain_text(rich):
    """Flatten a rich-text document down to its text, newline per paragraph."""
    if not isinstance(rich, dict):
        return ""
    lines = []
    for block in rich.get("content", []):
        parts = [run.get("text", "") for run in block.get("content", [])]
        lines.append("".join(parts))
    return "\n".join(lines).strip()


def load(path: Path):
    store = json.loads(path.read_text())["document"]["store"]
    shapes = {k: v for k, v in store.items() if v.get("typeName") == "shape"}
    bindings = [v for v in store.values() if v.get("typeName") == "binding"]

    boxes = {}
    for shape_id, shape in shapes.items():
        if shape["type"] == "arrow":
            continue
        boxes[shape_id] = {
            "id": shape_id,
            "x": round(shape.get("x", 0)),
            "y": round(shape.get("y", 0)),
            "w": round(shape["props"].get("w", 0)),
            "h": round(shape["props"].get("h", 0)),
            "color": shape["props"].get("color", "black"),
            "text": plain_text(shape["props"].get("richText")),
        }

    ends = {}
    for binding in bindings:
        if binding.get("type") != "arrow":
            continue
        ends.setdefault(binding["fromId"], {})[binding["props"]["terminal"]] = binding["toId"]

    arrows = []
    for shape_id, shape in shapes.items():
        if shape["type"] != "arrow":
            continue
        pair = ends.get(shape_id, {})
        arrows.append({
            "from": pair.get("start"),
            "to": pair.get("end"),
            "text": plain_text(shape["props"].get("richText")),
        })
    return boxes, arrows


def label(boxes, shape_id):
    """Name a box by the first line of its text, falling back to its id."""
    box = boxes.get(shape_id)
    if not box:
        return "(loose end)"
    first = box["text"].split("\n")[0].strip()
    return first or shape_id


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("document")
    parser.add_argument("--seed", action="store_true")
    args = parser.parse_args()

    boxes, arrows = load(Path(args.document))

    if args.seed:
        names = {shape_id: label(boxes, shape_id) for shape_id in boxes}
        print(json.dumps({
            "boxes": [{**box, "id": names[box["id"]]} for box in boxes.values()],
            "arrows": [
                {"from": names.get(a["from"]), "to": names.get(a["to"]), "text": a["text"]}
                for a in arrows
            ],
        }, indent=2))
        return

    print(f"{len(boxes)} boxes")
    for box in sorted(boxes.values(), key=lambda b: (b["y"], b["x"])):
        head = box["text"].split("\n")[0] or "(no text)"
        rest = " | ".join(line for line in box["text"].split("\n")[1:] if line.strip())
        print(f"  [{box['color']:>12}] ({box['x']:>5},{box['y']:>5}) {head}")
        if rest:
            print(f"                 {rest}")

    print(f"\n{len(arrows)} arrows")
    for arrow in arrows:
        text = f"  — {arrow['text']}" if arrow["text"] else ""
        print(f"  {label(boxes, arrow['from'])} -> {label(boxes, arrow['to'])}{text}")


if __name__ == "__main__":
    main()

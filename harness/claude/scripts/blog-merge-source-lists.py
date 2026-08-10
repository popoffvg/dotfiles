#!/usr/bin/env python3
"""Merge the blog-add source list into the config the blogs pipeline actually reads, converting
legacy `source`/`rss` entries to the current `id`/`discovery.url` schema.

The two lists drifted because the skill wrote $TELEPI_WORKSPACE/blogs/scrapers.json while the
pipeline reads $BLOG_CONFIG_PATH. Sources present only in the skill's file were never scraped.

Dedups on discovery URL and on id. Preserves the target's `settings` and existing source order —
new entries are appended. Writes a timestamped backup next to the target before saving.

Usage: blog-merge-source-lists.py <from.json> <into.json> [--apply]
Without --apply it prints the plan and writes nothing.
"""
import hashlib
import json
import re
import shutil
import sys
from datetime import datetime, timezone

DEFAULT_EXTRACT = {"mainSelector": "article", "excludeSelectors": ["script", "style"]}


def host_slug(url):
    host = re.sub(r"^https?://", "", url).split("/")[0]
    host = re.sub(r"^www\.", "", host)
    return re.sub(r"[^a-z0-9]+", "-", host.lower()).strip("-")


def make_id(url):
    return f"{host_slug(url)}-{hashlib.sha1(url.encode()).hexdigest()[:4]}"


def discovery_url(src):
    d = src.get("discovery") or {}
    if d.get("url"):
        return d["url"]
    rss = src.get("rss")
    if rss and rss.startswith("http"):
        return rss
    return src.get("source")


VALID_FETCH_MODES = {"rss", "firecrawl-required"}


def normalize_fetch_mode(src):
    """Older writers emitted fetchMode values outside the schema enum (e.g. `rss-first`). The whole
    source is rejected for it, so map anything unknown onto the mode its discovery type implies."""
    if src.get("fetchMode") in VALID_FETCH_MODES:
        return False
    src["fetchMode"] = "rss" if (src.get("discovery") or {}).get("type") == "rss" else "firecrawl-required"
    return True


def convert(src):
    """Return a current-schema source, or None if it is already valid."""
    if (src.get("discovery") or {}).get("url") and src.get("id"):
        normalize_fetch_mode(src)
        return src
    origin = src.get("source")
    rss = src.get("rss")
    if rss and rss.startswith("http"):
        url, dtype, mode, firecrawl = rss, "rss", "rss", False
    elif origin:
        url, dtype, mode, firecrawl = origin.rstrip("/"), "index", "firecrawl-required", True
    else:
        return None
    out = {
        "id": make_id(url),
        "enabled": bool(src.get("enabled", True)),
        "discovery": {"type": dtype, "url": url},
        "extract": dict(DEFAULT_EXTRACT),
        "fallback": {"firecrawlEnabled": firecrawl, "firecrawlFormats": ["markdown"]},
        "fetchMode": mode,
        "modeRationale": "converted from legacy source/rss entry",
    }
    paths = [p for p in (src.get("include_paths") or []) if p not in ("/", "")]
    if dtype == "index" and paths:
        out["articlePattern"] = "|".join(re.escape(p) for p in paths)
    return out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    apply = "--apply" in sys.argv
    if len(args) != 2:
        print(__doc__)
        return 2
    src_path, dst_path = args

    src_doc = json.load(open(src_path))
    dst_doc = json.load(open(dst_path))
    dst_sources = dst_doc["sources"]

    have_urls = {discovery_url(s) for s in dst_sources}
    have_ids = {s.get("id") for s in dst_sources}

    added, converted_in_place, skipped, unconvertible = [], 0, 0, []
    remoded = 0

    # Repair legacy entries already sitting in the target — they parse as JSON but fail the schema,
    # so the pipeline drops them silently.
    for i, s in enumerate(dst_sources):
        if (s.get("discovery") or {}).get("url") and s.get("id"):
            if normalize_fetch_mode(s):
                remoded += 1
            continue
        fixed = convert(s)
        if not fixed:
            unconvertible.append(json.dumps(s)[:80])
            continue
        dst_sources[i] = fixed
        converted_in_place += 1
        have_urls.add(fixed["discovery"]["url"])
        have_ids.add(fixed["id"])

    for s in src_doc["sources"]:
        url = discovery_url(s)
        if not url:
            unconvertible.append(json.dumps(s)[:80])
            continue
        if url in have_urls:
            skipped += 1
            continue
        fixed = convert(s)
        if not fixed:
            unconvertible.append(json.dumps(s)[:80])
            continue
        if fixed["id"] in have_ids:
            fixed["id"] = make_id(url + "#dedup")
        have_urls.add(url)
        have_ids.add(fixed["id"])
        dst_sources.append(fixed)
        added.append(f'{fixed["id"]}\t{url}')

    print(f"target had      : {len(dst_doc['sources']) - len(added)} sources")
    print(f"repaired in place: {converted_in_place} legacy entries")
    print(f"fetchMode fixed : {remoded}")
    print(f"appended        : {len(added)}")
    print(f"already present : {skipped}")
    print(f"unconvertible   : {len(unconvertible)}")
    for u in unconvertible:
        print("  !", u)
    for a in added:
        print("  +", a)
    print(f"target now      : {len(dst_sources)} sources")

    if not apply:
        print("\nDRY RUN — pass --apply to write.")
        return 0

    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = f"{dst_path}.bak-{stamp}"
    shutil.copy2(dst_path, backup)
    with open(dst_path, "w") as fh:
        json.dump(dst_doc, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"\nbackup: {backup}\nwrote : {dst_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

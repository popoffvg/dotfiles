#!/usr/bin/env python3
"""Probe the openclaw blogs scrapers.json: for each enabled source, fetch its feed/index and
report how many entries are newer than the stored watermark. Read-only — never writes state,
never ingests, never posts. Run on the openclaw box.

Usage: blog-discovery-probe.py [scrapers.json] [watermarks.json] [--hours N]
Defaults to the vault-hosted config and the live extension state.
"""
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

SCRAPERS = "/home/deploy/.openclaw/workspace/obsidian/Z-Core/.services/blogs/scrapers.json"
WATERMARKS = "/home/deploy/.pi/agent/extensions/blogs/state/watermarks.json"
UA = "Mozilla/5.0 (compatible; openclaw-probe/1.0)"


def fetch(url, timeout=20):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", "replace")


def entry_dates(body):
    """Pull pubDate/updated/published timestamps out of an RSS or Atom body."""
    out = []
    for tag in ("pubDate", "published", "updated", "dc:date"):
        out += re.findall(rf"<{tag}[^>]*>([^<]+)</{tag}>", body)
    return out


def parse_date(raw):
    raw = raw.strip()
    for fmt in ("%a, %d %b %Y %H:%M:%S %z", "%a, %d %b %Y %H:%M:%S %Z",
                "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%d"):
        try:
            d = datetime.strptime(raw.replace("GMT", "+0000"), fmt)
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    hours = 24
    for a in sys.argv[1:]:
        if a.startswith("--hours"):
            hours = int(a.split("=", 1)[1]) if "=" in a else 24
    scrapers = args[0] if args else SCRAPERS
    watermarks = args[1] if len(args) > 1 else WATERMARKS

    cfg = json.load(open(scrapers))
    sources = cfg.get("sources", cfg if isinstance(cfg, list) else [])
    wm = json.load(open(watermarks))
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)

    ok = err = 0
    fresh_total = 0
    for s in sources:
        if not s.get("enabled", True):
            continue
        sid = s.get("id", "?")
        url = (s.get("discovery") or {}).get("url")
        if not url:
            print(f"{sid}\tNO-URL")
            continue
        try:
            body = fetch(url)
        except Exception as e:  # noqa: BLE001 - probe reports every failure shape
            err += 1
            print(f"{sid}\tFETCH-FAIL\t{type(e).__name__}: {str(e)[:60]}")
            continue
        ok += 1
        dates = [d for d in (parse_date(r) for r in entry_dates(body)) if d]
        recent = [d for d in dates if d >= cutoff]
        fresh_total += len(recent)
        mark = wm.get(sid, {})
        print(f"{sid}\tentries={len(dates)}\trecent{hours}h={len(recent)}\t"
              f"watermark={mark.get('date', 'seen-set' if 'seen' in mark else 'NONE')}")

    print(f"\nSOURCES ok={ok} fetch-fail={err} entries-published-last-{hours}h={fresh_total}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Convert a YouTube VTT caption file into deduplicated [HH:MM:SS] transcript lines.

YouTube auto-caption VTT carries two kinds of bloat: rolling text (each cue repeats the
previous cue's tail so the on-screen caption scrolls) and inline word-level timing tags
(<00:00:01.234><c>word</c>). Both must go before the text is usable as an article body.

Usage:
  vtt-to-transcript.py <file.vtt> [--stats]

Writes the transcript to stdout. With --stats, writes a size report to stderr instead of
being silent, so the shrink factor is visible.
"""
import html
import re
import sys

CUE_TIME = re.compile(r"^(\d{2}):(\d{2}):(\d{2})\.\d{3}\s+-->")
INLINE_TAG = re.compile(r"<[^>]*>")
# YouTube writes speaker changes as an HTML-escaped ">>" and scores non-speech as bracketed
# markers. Both are transport artifacts, not content, and neither is worth a model call to remove.
SPEAKER_MARK = re.compile(r"\s*>>\s*")
NON_SPEECH = re.compile(r"\[(?:music|applause|laughter|inaudible|sound effects?)\]", re.I)


def parse(text):
    """Yield (seconds, line) for each cue, tags stripped, consecutive repeats dropped."""
    stamp = None
    seen_last = None
    for raw in text.splitlines():
        m = CUE_TIME.match(raw)
        if m:
            h, mi, s = (int(g) for g in m.groups())
            stamp = h * 3600 + mi * 60 + s
            continue
        # unescape BEFORE stripping tags: an escaped ">>" must not survive as literal text, and
        # unescaping afterwards would turn "&lt;c&gt;" into a tag the stripper has already passed.
        line = INLINE_TAG.sub("", html.unescape(raw))
        line = NON_SPEECH.sub("", SPEAKER_MARK.sub(" ", line)).strip()
        line = re.sub(r"\s{2,}", " ", line)
        if not line or line.startswith(("WEBVTT", "Kind:", "Language:")):
            continue
        # rolling captions repeat the previous cue's text verbatim
        if line == seen_last:
            continue
        seen_last = line
        yield stamp, line


def group(cues, window=30):
    """Collapse cues into one paragraph per `window` seconds, stamped at the window start."""
    out = []
    bucket, bucket_start = [], None
    for stamp, line in cues:
        if stamp is None:
            continue
        if bucket_start is None:
            bucket_start = stamp - (stamp % window)
        if stamp >= bucket_start + window:
            out.append((bucket_start, " ".join(bucket)))
            bucket, bucket_start = [], stamp - (stamp % window)
        bucket.append(line)
    if bucket:
        out.append((bucket_start, " ".join(bucket)))
    return out


def hms(total):
    return f"{total // 3600:02d}:{(total % 3600) // 60:02d}:{total % 60:02d}"


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        sys.exit(__doc__)
    raw = open(args[0], encoding="utf-8").read()
    paragraphs = group(parse(raw))
    body = "\n\n".join(f"[{hms(t)}] {text}" for t, text in paragraphs)
    sys.stdout.write(body + "\n")
    if "--stats" in sys.argv:
        print(
            f"vtt {len(raw):,} chars -> transcript {len(body):,} chars "
            f"({len(raw) / max(len(body), 1):.1f}x smaller), {len(paragraphs)} paragraphs",
            file=sys.stderr,
        )


if __name__ == "__main__":
    main()

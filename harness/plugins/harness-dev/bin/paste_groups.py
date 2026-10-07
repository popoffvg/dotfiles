"""Group instruction blocks the operator pastes again and again.

A paste is a `<pasted_content>` block, or a whole prompt longer than PASTE_MIN_CHARS. Ticket ids,
TODO numbers, paths, hashes, and numbers become placeholders first, so two pastes that differ only
in them land in one group, and the placeholders are the arguments a skill made from the group takes.
"""
from __future__ import annotations

import hashlib
import json
import re
import time
from pathlib import Path

PASTE_MIN_CHARS = 600
SHINGLE_WORDS = 5
MINHASH_SIZE = 64
SAME_GROUP_JACCARD = 0.6

PASTED_BLOCK = re.compile(r"<pasted_content[^>]*>(.*?)</pasted_content[^>]*>", re.S)
PLACEHOLDERS = [
    (re.compile(r"\bTODO-\d+\b"), "{todo}"),
    (re.compile(r"\b[A-Z][A-Z0-9]+-(?:\d+|X+)\b"), "{ticket}"),
    (re.compile(r"(?:~|\.{0,2})?/[\w.@-]+(?:/[\w.@{}-]+)+"), "{path}"),
    (re.compile(r"\b[0-9a-f]{7,40}\b"), "{hash}"),
    (re.compile(r"\b\d+\b"), "{n}"),
]


def paste_blocks(prompt: str) -> list[str]:
    blocks = [b.strip() for b in PASTED_BLOCK.findall(prompt) if b.strip()]
    if blocks:
        return blocks
    return [prompt.strip()] if len(prompt) >= PASTE_MIN_CHARS else []


def normalize(text: str) -> str:
    for pattern, placeholder in PLACEHOLDERS:
        text = pattern.sub(placeholder, text)
    return re.sub(r"\s+", " ", text).strip().lower()


def minhash(text: str) -> list[int]:
    words = text.split()
    shingles = {" ".join(words[i:i + SHINGLE_WORDS]) for i in range(max(1, len(words) - SHINGLE_WORDS + 1))}
    hashed = [int.from_bytes(hashlib.blake2b(s.encode(), digest_size=8).digest(), "big") for s in shingles]
    # Each seed derives a permutation by xor; min over the set estimates Jaccard per slot.
    seeds = [int.from_bytes(hashlib.blake2b(str(i).encode(), digest_size=8).digest(), "big") for i in range(MINHASH_SIZE)]
    return [min(h ^ seed for h in hashed) for seed in seeds]


def similarity(a: list[int], b: list[int]) -> float:
    return sum(x == y for x, y in zip(a, b)) / MINHASH_SIZE


def record_pastes(store: Path, session: str, prompt: str) -> list[dict]:
    """Store every paste of the prompt and return one match summary per paste."""
    blocks = paste_blocks(prompt)
    if not blocks:
        return []
    earlier = []
    if store.exists():
        for line in store.read_text(errors="replace").splitlines():
            try:
                earlier.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    results = []
    with store.open("a") as out:
        for block in blocks:
            text = normalize(block)
            signature = minhash(text)
            best = max(earlier, key=lambda e: similarity(signature, e["minhash"]), default=None)
            matched = best is not None and similarity(signature, best["minhash"]) >= SAME_GROUP_JACCARD
            paste_id = hashlib.blake2b(f"{session}:{text}".encode(), digest_size=6).hexdigest()
            group = best["group"] if matched else paste_id
            row = {"id": paste_id, "group": group, "session": session, "ts": int(time.time()),
                   "chars": len(block), "minhash": signature, "sample": text[:400]}
            out.write(json.dumps(row) + "\n")
            earlier.append(row)
            members = [e for e in earlier if e["group"] == group]
            results.append({"id": paste_id, "group": group, "count": len(members),
                            "sessions": len({e["session"] for e in members}),
                            "dates": sorted({time.strftime("%Y-%m-%d", time.localtime(e["ts"])) for e in members})})
    return results

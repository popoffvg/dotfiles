"""Spike: validate cocoindex 1.0.2 chain for commit-example search.

Dump first-parent commits (pl+platforma) -> per-commit JSON -> cocoindex
localfs source -> embed (cached MiniLM) -> sqlite vec0 -> KNN query.

Goal: de-risk the API only. Embedder is the cached all-MiniLM-L6-v2 (384d),
NOT the production nomic-embed-text-v1.5 (mechanics are identical).
"""

from __future__ import annotations

import asyncio
import json
import re
import subprocess
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated, Any

import numpy as np
import numpy.typing as npt

import cocoindex as coco
from cocoindex.connectors import localfs, sqlite as coco_sqlite
from cocoindex.connectors.sqlite import Vec0TableDef
from cocoindex.ops.sentence_transformers import SentenceTransformerEmbedder
from cocoindex.resources.file import PatternFilePathMatcher

WORKSPACE = Path("/Users/popoffvg/Documents/git/mil")
REPOS = {"pl": WORKSPACE / "pl", "platforma": WORKSPACE / "platforma"}
DUMP_DIR = Path("/tmp/claude/commit-index-dump")
DB_DIR = Path("/tmp/claude/commit-index-db")
N_PER_REPO = 40  # small sample for the spike

# ---- context keys (mirror cocoindex_code/shared.py) ----
EMBEDDER = coco.ContextKey[SentenceTransformerEmbedder]("embedder", detect_change=True)
SQLITE_DB = coco.ContextKey[coco_sqlite.ManagedConnection]("index_db")
DUMP_DIR_CTX = coco.ContextKey[Path]("dump_dir")

TRAILER_RE = re.compile(
    r"^(Co-authored-by|Signed-off-by|Reviewed-by|Co-Authored-By):.*$",
    re.IGNORECASE | re.MULTILINE,
)


def clean_body(body: str) -> str:
    body = TRAILER_RE.sub("", body)
    # collapse squash bullet lists "* ..." into nothing-special; keep prose
    lines = [ln for ln in body.splitlines() if ln.strip()]
    return "\n".join(lines).strip()


def dump_commits() -> int:
    DUMP_DIR.mkdir(parents=True, exist_ok=True)
    fmt = "%H%x1f%an%x1f%aI%x1f%s%x1f%b%x1e"
    total = 0
    for repo, path in REPOS.items():
        branch = subprocess.run(
            ["git", "-C", str(path), "symbolic-ref", "--short", "refs/remotes/origin/HEAD"],
            capture_output=True, text=True,
        ).stdout.strip() or "main"
        out = subprocess.run(
            ["git", "-C", str(path), "log", "--first-parent", branch,
             f"-n{N_PER_REPO}", f"--format={fmt}"],
            capture_output=True, text=True,
        ).stdout
        for rec in out.split("\x1e"):
            rec = rec.strip("\n")
            if not rec:
                continue
            sha, author, date, subject, body = (rec.split("\x1f") + ["", "", "", "", ""])[:5]
            files = subprocess.run(
                ["git", "-C", str(path), "show", "--name-only", "--format=", sha],
                capture_output=True, text=True,
            ).stdout.split()
            doc = {
                "repo": repo, "sha": sha, "author": author, "date": date,
                "subject": subject, "body": clean_body(body),
                "files": files[:50],
            }
            (DUMP_DIR / f"{repo}-{sha}.json").write_text(json.dumps(doc))
            total += 1
    return total


@dataclass
class CommitDoc:
    id: int
    repo: str
    sha: str
    author: str
    date: str
    subject: str
    files: str  # joined paths
    embedding: Annotated[npt.NDArray[np.float32], EMBEDDER]


@coco.fn(memo=True)
async def process_commit(file: localfs.File, table: coco_sqlite.TableTarget[CommitDoc]) -> None:
    embedder = coco.use_context(EMBEDDER)
    raw = await file.read_text()
    d = json.loads(raw)
    files_str = " ".join(d.get("files", []))
    # passage = subject + cleaned body + file paths (the Q8 decision)
    passage = f"{d['subject']}\n{d.get('body','')}\n{files_str}".strip()
    table.declare_row(
        row=CommitDoc(
            id=abs(hash(d["sha"])) % (2**62),
            repo=d["repo"], sha=d["sha"], author=d["author"], date=d["date"],
            subject=d["subject"], files=files_str,
            embedding=await embedder.embed(passage),
        )
    )


@coco.fn
async def index_main() -> None:
    table = await coco_sqlite.mount_table_target(
        db=SQLITE_DB,
        table_name="commits_vec",
        table_schema=await coco_sqlite.TableSchema.from_class(CommitDoc, primary_key=["id"]),
        virtual_table_def=Vec0TableDef(
            partition_key_columns=["repo"],
            auxiliary_columns=["sha", "author", "date", "subject", "files"],
        ),
    )
    matcher = PatternFilePathMatcher(included_patterns=["**/*.json"], excluded_patterns=[])
    files = localfs.walk_dir(DUMP_DIR_CTX, recursive=True, path_matcher=matcher)
    await coco.mount_each(
        coco.component_subpath(coco.Symbol("process_commit")),
        process_commit, files.items(), table,
    )


def build_app(embedder):
    DB_DIR.mkdir(parents=True, exist_ok=True)
    settings = coco.Settings.from_env(str(DB_DIR / "cocoindex.db"))
    ctx = coco.ContextProvider()
    ctx.provide(DUMP_DIR_CTX, DUMP_DIR)
    ctx.provide(SQLITE_DB, coco_sqlite.connect(str(DB_DIR / "target.db"), load_vec=True))
    ctx.provide(EMBEDDER, embedder)
    env = coco.Environment(settings, context_provider=ctx)
    app = coco.App(coco.AppConfig(name="CommitIndexSpike", environment=env), index_main)
    return app


async def query(embedder, q: str, k: int = 5, repo: str | None = None):
    conn = sqlite3.connect(str(DB_DIR / "target.db"))
    conn.enable_load_extension(True)
    import sqlite_vec
    sqlite_vec.load(conn)
    vec = (await embedder.embed(q)).astype("float32").tobytes()
    if repo:
        rows = conn.execute(
            "SELECT repo, sha, author, date, subject, files, distance FROM commits_vec "
            "WHERE embedding MATCH ? AND k = ? AND repo = ? ORDER BY distance",
            (vec, k, repo),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT repo, sha, author, date, subject, files, distance FROM commits_vec "
            "WHERE embedding MATCH ? AND k = ? ORDER BY distance",
            (vec, k),
        ).fetchall()
    conn.close()
    return rows


async def main():
    n = dump_commits()
    print(f"[dump] wrote {n} commit JSON files to {DUMP_DIR}")

    embedder = SentenceTransformerEmbedder("all-MiniLM-L6-v2")
    app = build_app(embedder)

    print("[index] running app.update() ...")
    handle = app.update()
    async for snap in handle.watch():
        st = snap.stats.by_component.get("process_commit")
        if st is not None:
            print(f"  adds={st.num_adds} unchanged={st.num_unchanged} "
                  f"errors={st.num_errors} starts={st.num_execution_starts}")
            if st.num_execution_starts and st.num_adds + st.num_unchanged >= n:
                break

    for q in ["OIDC session refresh logging", "localfs staging storage url"]:
        print(f"\n[query] {q!r}")
        for repo, sha, author, date, subject, files, dist in await query(embedder, q, k=3):
            score = 1.0 - dist * dist / 2.0
            print(f"  {score:.3f} [{repo}] {sha[:9]} {subject[:60]}")


if __name__ == "__main__":
    asyncio.run(main())

"""Commit-example index — cocoindex 1.0.2 flow + query.

Pipeline: per-commit JSON (dumped by commit-index-refresh.sh)
  -> cocoindex localfs source
  -> embed (subject + body + changed-file paths)  [nomic-embed-text-v1.5]
  -> SQLite vec0 target (partitioned by repo)

Subcommands:
  python flow.py index            # (re)build index from dump dir (incremental)
  python flow.py search "<query>" [--repo pl|platforma] [-k N]

Design decisions live in engram (grill-me session). API shape validated by
flow_spike.py against cocoindex 1.0.2 (reactive runtime, NOT the 0.x flow API).

NOTE: must run UNSANDBOXED — cocoindex's Rust Environment fails with
"os error 1" under the command sandbox.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated

import numpy as np
import numpy.typing as npt

import cocoindex as coco
from cocoindex.connectors import localfs, sqlite as coco_sqlite
from cocoindex.connectors.sqlite import Vec0TableDef
from cocoindex.ops.sentence_transformers import SentenceTransformerEmbedder
from cocoindex.resources.file import PatternFilePathMatcher

# ---- config (overridable via env) ----
HOME = Path(os.path.expanduser("~"))
DUMP_DIR = Path(os.environ.get("COMMIT_INDEX_DUMP", HOME / ".cache/commit-index"))
DB_DIR = Path(os.environ.get("COMMIT_INDEX_DB", HOME / ".claude/scripts/commit-index/db"))
# Snowflake/snowflake-arctic-embed-xs: same model ccc uses — tiny, fast on CPU,
# prose-tuned, 384-dim, prompts {'query','document'}. nomic-embed-text-v1.5 is
# better quality but far too slow to embed thousands of commits on CPU.
MODEL = os.environ.get("COMMIT_INDEX_MODEL", "Snowflake/snowflake-arctic-embed-xs")
# models exposing ['query','document'] prompt names (NOT nomic-v1's 'passage')
_PROMPTED = ("nomic", "arctic")
TABLE = "commits_vec"

# ---- context keys (mirror cocoindex_code/shared.py) ----
EMBEDDER = coco.ContextKey[SentenceTransformerEmbedder]("embedder", detect_change=True)
SQLITE_DB = coco.ContextKey[coco_sqlite.ManagedConnection]("index_db")
DUMP_DIR_CTX = coco.ContextKey[Path]("dump_dir")


@dataclass
class CommitDoc:
    id: int
    repo: str
    sha: str
    author: str
    date: str
    subject: str
    files: str
    embedding: Annotated[npt.NDArray[np.float32], EMBEDDER]


def _embed_params(side: str) -> dict:
    """Map index/query side to the model's prompt_name.

    side is "index" or "query". nomic-embed-text-v1.5 uses 'document'/'query';
    models without prompts (e.g. MiniLM in tests) get no kwargs.
    """
    if any(m in MODEL.lower() for m in _PROMPTED):
        return {"prompt_name": "document" if side == "index" else "query"}
    return {}


@coco.fn(memo=True)
async def process_commit(file: localfs.File, table: coco_sqlite.TableTarget[CommitDoc]) -> None:
    embedder = coco.use_context(EMBEDDER)
    d = json.loads(await file.read_text())
    files_str = " ".join(d.get("files", []))
    passage = f"{d['subject']}\n{d.get('body', '')}\n{files_str}".strip()
    table.declare_row(
        row=CommitDoc(
            id=int(d["sha"][:15], 16),  # stable id from sha prefix
            repo=d["repo"], sha=d["sha"], author=d["author"], date=d["date"],
            subject=d["subject"], files=files_str,
            embedding=await embedder.embed(passage, **_embed_params("index")),
        )
    )


@coco.fn
async def index_main() -> None:
    table = await coco_sqlite.mount_table_target(
        db=SQLITE_DB,
        table_name=TABLE,
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


def _make_embedder() -> SentenceTransformerEmbedder:
    return SentenceTransformerEmbedder(MODEL, trust_remote_code=True)


def _build_app(embedder):
    DB_DIR.mkdir(parents=True, exist_ok=True)
    settings = coco.Settings.from_env(str(DB_DIR / "cocoindex.db"))
    ctx = coco.ContextProvider()
    ctx.provide(DUMP_DIR_CTX, DUMP_DIR)
    ctx.provide(SQLITE_DB, coco_sqlite.connect(str(DB_DIR / "target.db"), load_vec=True))
    ctx.provide(EMBEDDER, embedder)
    env = coco.Environment(settings, context_provider=ctx)
    return coco.App(coco.AppConfig(name="CommitIndex", environment=env), index_main)


async def run_index() -> None:
    if not DUMP_DIR.exists():
        raise SystemExit(f"dump dir not found: {DUMP_DIR} (run commit-index-refresh.sh first)")
    embedder = _make_embedder()
    app = _build_app(embedder)
    handle = app.update()
    last = None
    async for snap in handle.watch():
        st = snap.stats.by_component.get("process_commit")
        if st is not None:
            last = st
    if last is not None:
        print(f"[index] adds={last.num_adds} unchanged={last.num_unchanged} "
              f"deletes={last.num_deletes} errors={last.num_errors}")
    else:
        print("[index] no commits processed (empty dump dir?)")


REPO_PATH = {"pl": HOME / "Documents/git/mil/pl",
             "platforma": HOME / "Documents/git/mil/platforma"}


async def search(query: str, k: int = 5, repo: str | None = None,
                 since: str | None = None, embedder=None) -> list[dict]:
    """Return up to k commit hits semantically similar to *query*.

    *since* is an ISO date (YYYY-MM-DD); only commits on/after it are returned.
    Pass a warm *embedder* to avoid reloading the model (used by the MCP server).
    """
    db_path = DB_DIR / "target.db"
    if not db_path.exists():
        raise FileNotFoundError(f"index not found: {db_path} (run `flow.py index` first)")
    embedder = embedder or _make_embedder()
    vec = (await embedder.embed(query, **_embed_params("query"))).astype("float32").tobytes()

    conn = sqlite3.connect(str(db_path))
    conn.enable_load_extension(True)
    import sqlite_vec
    sqlite_vec.load(conn)
    base = "repo, sha, author, date, subject, files"
    if since:
        # vec0 forbids WHERE on auxiliary cols (date) in a KNN MATCH query;
        # use a full scan with SQL-level distance instead.
        where = ["date >= ?"]                       # ISO dates sort lexically
        params: list = [since]
        if repo:
            where.append("repo = ?"); params.append(repo)
        params.insert(0, vec)
        rows = conn.execute(
            f"SELECT {base}, vec_distance_L2(embedding, ?) AS distance FROM {TABLE} "
            f"WHERE {' AND '.join(where)} ORDER BY distance LIMIT ?", params + [k],
        ).fetchall()
    else:
        where = ["embedding MATCH ?", "k = ?"]      # KNN; repo is a partition key (allowed)
        params = [vec, k]
        if repo:
            where.append("repo = ?"); params.append(repo)
        rows = conn.execute(
            f"SELECT {base}, distance FROM {TABLE} WHERE {' AND '.join(where)} ORDER BY distance",
            params,
        ).fetchall()
    conn.close()

    hits = []
    for repo_, sha, author, date, subject, files, dist in rows:
        hits.append({
            "repo": repo_, "sha": sha, "author": author, "date": date,
            "subject": subject, "score": round(1.0 - dist * dist / 2.0, 4),
            "changed_files": files.split()[:15],
            "show": f"git -C {REPO_PATH.get(repo_, repo_)} show {sha}",
        })
    return hits


async def run_search(query: str, k: int, repo: str | None) -> None:
    print(json.dumps(await search(query, k, repo), indent=2))


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    sub.add_parser("index")
    s = sub.add_parser("search")
    s.add_argument("query")
    s.add_argument("-k", type=int, default=5)
    s.add_argument("--repo", choices=["pl", "platforma"], default=None)
    args = ap.parse_args()

    if args.cmd == "index":
        asyncio.run(run_index())
    else:
        asyncio.run(run_search(args.query, args.k, args.repo))


if __name__ == "__main__":
    main()

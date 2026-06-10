"""MCP server exposing `search_commits` over the commit-example index.

One tool: given a task description, return the most similar past commits in
pl/platforma (message + metadata + a ready-to-run `git show`). The agent reads
the diffs itself via git — diffs are NOT stored (grill-me decision).

The nomic embedder is loaded once at startup and kept warm across calls.

Run UNSANDBOXED (cocoindex/sentence-transformers). Launched via ccc venv python.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import flow  # noqa: E402  (flow.py in same dir)

from mcp.server import Server  # noqa: E402
from mcp.server.stdio import stdio_server  # noqa: E402
import mcp.types as types  # noqa: E402

app = Server("commit-index")
_embedder = None  # warmed on first use


def _get_embedder():
    global _embedder
    if _embedder is None:
        _embedder = flow._make_embedder()
    return _embedder


@app.list_tools()
async def list_tools() -> list[types.Tool]:
    return [
        types.Tool(
            name="search_commits",
            description=(
                "Find past commits in pl/platforma semantically similar to a task "
                "description, to use as concrete examples. Returns commit message + "
                "metadata + changed files + a ready-to-run `git show` command per hit. "
                "Read the diff yourself via the returned `show` command — diffs are not "
                "included. Use BEFORE implementing a task to mimic prior work."
            ),
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string",
                              "description": "Task description / intent to match against commit messages."},
                    "top_k": {"type": "integer", "default": 5, "minimum": 1, "maximum": 25},
                    "repo": {"type": "string", "enum": ["pl", "platforma"],
                             "description": "Restrict to one repo. Omit for both."},
                    "since": {"type": "string",
                              "description": "ISO date (YYYY-MM-DD); only commits on/after it."},
                },
                "required": ["query"],
            },
        )
    ]


@app.call_tool()
async def call_tool(name: str, arguments: dict) -> list[types.TextContent]:
    if name != "search_commits":
        raise ValueError(f"unknown tool: {name}")
    try:
        hits = await flow.search(
            query=arguments["query"],
            k=int(arguments.get("top_k", 5)),
            repo=arguments.get("repo"),
            since=arguments.get("since"),
            embedder=_get_embedder(),
        )
        payload = json.dumps(hits, indent=2)
    except FileNotFoundError as e:
        payload = json.dumps({"error": str(e)})
    return [types.TextContent(type="text", text=payload)]


async def _main() -> None:
    async with stdio_server() as (read, write):
        await app.run(read, write, app.create_initialization_options())


if __name__ == "__main__":
    import asyncio
    asyncio.run(_main())

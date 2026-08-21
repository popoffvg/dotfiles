#!/usr/bin/env python3
"""Benchmark judge-style LLM calls across backends with a byte-identical prompt.

Backends
  claude          `claude -p` one-shot, full harness (cold process each run)
  claude-bare     `claude -p --bare` one-shot, harness stripped
  claude-live     one long-lived `claude -p --input-format stream-json` process,
                  N sequential turns down the same stdin (amortizes startup+harness)
  ollama:<model>  local HTTP to 127.0.0.1:11434/api/generate (e.g. ollama:phi4-mini)

The fixture is written once to --prompt-dir and reused, so every backend sees the
same bytes. Reports per-run wall clock plus, where the backend exposes them,
API-side duration, token usage and cost.

Usage: bench-judge-latency.py <backend> [--runs N] [--prompt-dir DIR] [--json]
"""
import argparse
import json
import os
import pathlib
import statistics
import subprocess
import sys
import time
import urllib.error
import urllib.request

SYSTEM = """\
You judge which neighbouring code locations carry a product workflow's main path.

For every candidate, assign exactly one highlight:
  happy-path      carries the workflow described by the intent, on the direct route
  decision-point  the workflow forks here; a reader must choose which branch to walk
  periphery       reachable but not worth walking: utility, generated, vendored, logging
  plain           relevant to the codebase but not to this intent

Rules:
  - Judge relative to the other candidates, not in isolation. A list of forty callers
    has few happy-path members, not twenty.
  - An exact-engine hop is stronger evidence than an approximate name match, but the
    intent decides the highlight, not the engine.
  - Say nothing about your confidence. Assign the highlight and one short reason.

Reply with JSON only, no prose, no code fence:
{"verdicts":[{"id":<int>,"highlight":"<one of the four>","reason":"<max 12 words>"}]}
Include exactly one entry per candidate, in the order given.
"""

INTENT = "How does an uploaded file get validated, stored, and indexed for search?"

SYMBOL = """\
current location: src/http/upload.rs:142  fn handle_upload

pub async fn handle_upload(
    state: Arc<AppState>,
    mut multipart: Multipart,
    actor: ActorAuth,
) -> Result<Json<UploadReceipt>, ApiError> {
    let field = multipart
        .next_field()
        .await
        .map_err(ApiError::malformed_multipart)?
        .ok_or(ApiError::EmptyUpload)?;

    let declared_name = field.file_name().unwrap_or("unnamed").to_owned();
    let content_type = field.content_type().map(str::to_owned);
    let bytes = field.bytes().await.map_err(ApiError::truncated_upload)?;

    metrics::upload_bytes_total().inc_by(bytes.len() as u64);
    tracing::debug!(name = %declared_name, size = bytes.len(), "upload received");

    let checked = validate_upload(&state.limits, &declared_name, content_type.as_deref(), &bytes)?;

    if state.dedup.contains(&checked.digest).await? {
        return Ok(Json(UploadReceipt::deduplicated(checked.digest)));
    }

    let stored = state.blobs.put(&checked.digest, bytes.clone()).await?;
    let record = state
        .db
        .insert_document(&actor.tenant_id, &checked, &stored.location)
        .await?;

    state.search.enqueue_index(record.id, bytes).await?;
    audit::record_upload(&actor, &record);

    Ok(Json(UploadReceipt::stored(record.id, checked.digest)))
}
"""

CANDIDATES = [
    ("down", "exact", "src/upload/validate.rs:31", "fn validate_upload(limits: &Limits, name: &str, ct: Option<&str>, bytes: &[u8]) -> Result<CheckedUpload, ApiError>"),
    ("down", "exact", "src/store/blobs.rs:88", "async fn put(&self, digest: &Digest, bytes: Bytes) -> Result<StoredBlob, StoreError>"),
    ("down", "exact", "src/db/documents.rs:204", "async fn insert_document(&self, tenant: &TenantId, checked: &CheckedUpload, loc: &BlobLocation) -> Result<DocumentRecord, DbError>"),
    ("down", "exact", "src/search/queue.rs:57", "async fn enqueue_index(&self, id: DocumentId, bytes: Bytes) -> Result<(), SearchError>"),
    ("down", "exact", "src/dedup/index.rs:44", "async fn contains(&self, digest: &Digest) -> Result<bool, DedupError>"),
    ("down", "exact", "src/audit/mod.rs:19", "fn record_upload(actor: &ActorAuth, record: &DocumentRecord)"),
    ("down", "exact", "src/api/error.rs:112", "fn malformed_multipart(e: MultipartError) -> ApiError"),
    ("down", "exact", "src/api/error.rs:120", "fn truncated_upload(e: MultipartError) -> ApiError"),
    ("down", "exact", "src/api/receipt.rs:28", "fn deduplicated(digest: Digest) -> UploadReceipt"),
    ("down", "exact", "src/api/receipt.rs:34", "fn stored(id: DocumentId, digest: Digest) -> UploadReceipt"),
    ("down", "exact", "src/metrics/counters.rs:73", "fn upload_bytes_total() -> &'static IntCounter"),
    ("down", "approximate", "src/telemetry/macros.rs:12", "macro_rules! debug"),
    ("down", "exact", "vendor/multipart/src/field.rs:301", "async fn bytes(self) -> Result<Bytes, MultipartError>"),
    ("down", "exact", "vendor/multipart/src/lib.rs:145", "async fn next_field(&mut self) -> Result<Option<Field>, MultipartError>"),
    ("down", "exact", "vendor/multipart/src/field.rs:88", "fn file_name(&self) -> Option<&str>"),
    ("down", "exact", "vendor/multipart/src/field.rs:96", "fn content_type(&self) -> Option<&str>"),
    ("up", "exact", "src/http/routes.rs:78", "fn upload_routes(state: Arc<AppState>) -> Router"),
    ("up", "exact", "src/http/routes.rs:203", "fn build_router(state: Arc<AppState>) -> Router"),
    ("up", "approximate", "tests/upload_integration.rs:41", "async fn uploads_and_indexes_a_pdf()"),
    ("up", "approximate", "tests/upload_integration.rs:96", "async fn rejects_oversized_upload()"),
    ("up", "approximate", "tests/upload_integration.rs:134", "async fn deduplicates_identical_bytes()"),
    ("up", "approximate", "tests/common/harness.rs:22", "async fn spawn_test_server() -> TestServer"),
    ("up", "approximate", "benches/upload_throughput.rs:18", "fn bench_upload(c: &mut Criterion)"),
    ("up", "exact", "src/http/middleware/auth.rs:64", "async fn require_actor<B>(req: Request<B>, next: Next<B>) -> Result<Response, ApiError>"),
    ("up", "exact", "src/http/middleware/limits.rs:29", "fn body_limit_layer(max: usize) -> RequestBodyLimitLayer"),
    ("down", "approximate", "src/config/limits.rs:15", "struct Limits { max_bytes: usize, allowed_types: Vec<Mime> }"),
    ("down", "exact", "src/store/digest.rs:41", "fn compute(bytes: &[u8]) -> Digest"),
    ("down", "approximate", "src/store/blobs.rs:139", "async fn get(&self, digest: &Digest) -> Result<Bytes, StoreError>"),
    ("down", "approximate", "src/store/blobs.rs:167", "async fn delete(&self, digest: &Digest) -> Result<(), StoreError>"),
    ("down", "approximate", "src/db/documents.rs:288", "async fn find_document(&self, id: DocumentId) -> Result<Option<DocumentRecord>, DbError>"),
    ("down", "approximate", "src/db/pool.rs:52", "async fn acquire(&self) -> Result<PoolConn, DbError>"),
    ("down", "approximate", "src/search/indexer.rs:112", "async fn index_document(&self, id: DocumentId, bytes: Bytes) -> Result<(), SearchError>"),
    ("down", "approximate", "src/search/tokenize.rs:24", "fn tokenize(text: &str) -> Vec<Token>"),
    ("down", "approximate", "src/search/queue.rs:98", "async fn drain_batch(&self, max: usize) -> Vec<QueuedJob>"),
    ("down", "approximate", "src/auth/actor.rs:71", "struct ActorAuth { tenant_id: TenantId, subject: String }"),
    ("down", "approximate", "src/util/bytes_ext.rs:9", "fn human_size(n: u64) -> String"),
    ("down", "approximate", "src/util/mime.rs:33", "fn sniff(bytes: &[u8]) -> Option<Mime>"),
    ("down", "approximate", "target/generated/proto/upload.rs:401", "impl Message for UploadReceipt"),
    ("down", "approximate", "src/api/json.rs:17", "struct Json<T>(pub T)"),
    ("down", "approximate", "src/state.rs:38", "struct AppState { limits: Limits, blobs: BlobStore, db: Db, search: SearchQueue, dedup: DedupIndex }"),
]


def build_prompt() -> str:
    lines = [
        f"intent: {INTENT}",
        "",
        SYMBOL,
        "",
        f"candidates ({len(CANDIDATES)}):",
    ]
    for i, (direction, engine, loc, sig) in enumerate(CANDIDATES, start=1):
        lines.append(f"{i}. [{direction}/{engine}] {loc}  {sig}")
    lines += [
        "",
        "trail so far: src/main.rs:22 -> src/http/routes.rs:203 -> src/http/upload.rs:142",
        "",
        "Judge all candidates now. JSON only.",
    ]
    return "\n".join(lines)


def write_fixture(prompt_dir: pathlib.Path) -> tuple[pathlib.Path, pathlib.Path]:
    prompt_dir.mkdir(parents=True, exist_ok=True)
    sys_path = prompt_dir / "judge-system.txt"
    user_path = prompt_dir / "judge-user.txt"
    if not sys_path.exists():
        sys_path.write_text(SYSTEM)
    if not user_path.exists():
        user_path.write_text(build_prompt())
    return sys_path, user_path


def valid_json_verdicts(text: str, expected: int) -> bool:
    """A run only counts if the backend produced usable verdicts."""
    t = text.strip()
    if t.startswith("```"):
        t = t.split("\n", 1)[-1].rsplit("```", 1)[0]
    start, end = t.find("{"), t.rfind("}")
    if start == -1 or end == -1:
        return False
    try:
        obj = json.loads(t[start : end + 1])
    except json.JSONDecodeError:
        return False
    v = obj.get("verdicts")
    if not isinstance(v, list) or not v:
        return False
    allowed = {"happy-path", "decision-point", "periphery", "plain"}
    ok = sum(
        1
        for e in v
        if isinstance(e, dict) and e.get("highlight") in allowed and "id" in e
    )
    return ok == expected


def run_claude_oneshot(sys_p, user_p, bare: bool, model: str):
    cmd = ["claude", "-p", "--model", model, "--output-format", "json",
           "--append-system-prompt", sys_p.read_text(),
           "--no-session-persistence"]
    if bare:
        cmd.append("--bare")
    t0 = time.perf_counter()
    proc = subprocess.run(cmd, stdin=user_p.open("rb"), capture_output=True, text=True)
    wall = (time.perf_counter() - t0) * 1000
    if proc.returncode != 0:
        return {"wall_ms": wall, "error": (proc.stderr or proc.stdout)[:400]}
    try:
        r = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return {"wall_ms": wall, "error": f"unparseable harness output: {proc.stdout[:300]}"}
    u = r.get("usage", {}) or {}
    return {
        "wall_ms": wall,
        "api_ms": r.get("duration_api_ms"),
        "harness_ms": r.get("duration_ms"),
        "ttft_ms": r.get("ttft_ms"),
        "in_tok": u.get("input_tokens"),
        "cache_write": u.get("cache_creation_input_tokens"),
        "cache_read": u.get("cache_read_input_tokens"),
        "out_tok": u.get("output_tokens"),
        "cost_usd": r.get("total_cost_usd"),
        "ok_json": valid_json_verdicts(r.get("result") or "", len(CANDIDATES)),
    }


def _live_turn(proc, text, save_path=None):
    """Push one user message, drain until the harness emits `result`."""
    msg = {"type": "user", "message": {"role": "user",
           "content": [{"type": "text", "text": text}]}}
    t0 = time.perf_counter()
    proc.stdin.write(json.dumps(msg) + "\n")
    proc.stdin.flush()
    rec, out = None, ""
    while True:
        line = proc.stdout.readline()
        if not line:
            break
        try:
            ev = json.loads(line)
        except json.JSONDecodeError:
            continue
        if ev.get("type") == "assistant":
            for b in ev.get("message", {}).get("content", []):
                if b.get("type") == "text":
                    out += b.get("text", "")
        if ev.get("type") == "result":
            rec = ev
            break
    wall = (time.perf_counter() - t0) * 1000
    if rec is not None and save_path:
        save_path.write_text(rec.get("result") or out)
    return rec, out, wall


def run_claude_live(sys_p, user_p, runs: int, model: str, save_dir=None,
                    clear_between: bool = False):
    """One process, `runs` sequential turns on the same stdin.

    clear_between=True sends `/clear` before each judging turn, so every turn
    starts from an empty conversation while the process — and the API-side
    prompt cache for the system prefix — stay warm.
    """
    cmd = ["claude", "-p", "--model", model,
           "--input-format", "stream-json", "--output-format", "stream-json",
           "--verbose", "--append-system-prompt", sys_p.read_text(),
           "--no-session-persistence"]
    prompt = user_p.read_text()
    results = []
    t_spawn = time.perf_counter()
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                            stderr=subprocess.PIPE, text=True, bufsize=1)
    spawn_ms = (time.perf_counter() - t_spawn) * 1000
    if save_dir:
        pathlib.Path(save_dir).mkdir(parents=True, exist_ok=True)
    try:
        for turn in range(runs):
            clear_ms = None
            if clear_between:
                crec, _, clear_ms = _live_turn(proc, "/clear")
                if crec is None:
                    results.append({"wall_ms": clear_ms,
                                    "error": "stream ended during /clear"})
                    break
            save_path = (pathlib.Path(save_dir) / f"turn{turn + 1}.txt") if save_dir else None
            rec, text, wall = _live_turn(proc, prompt, save_path)
            if rec is None:
                results.append({"wall_ms": wall, "error": "stream ended before result"})
                break
            u = rec.get("usage", {}) or {}
            results.append({
                "clear_ms": round(clear_ms, 1) if clear_ms is not None else None,
                "wall_ms": wall,
                "api_ms": rec.get("duration_api_ms"),
                "harness_ms": rec.get("duration_ms"),
                "ttft_ms": rec.get("ttft_ms"),
                "in_tok": u.get("input_tokens"),
                "cache_write": u.get("cache_creation_input_tokens"),
                "cache_read": u.get("cache_read_input_tokens"),
                "out_tok": u.get("output_tokens"),
                "cost_usd": rec.get("total_cost_usd"),
                "ok_json": valid_json_verdicts(rec.get("result") or text, len(CANDIDATES)),
            })
    finally:
        try:
            proc.stdin.close()
        except Exception:
            pass
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()
    if results:
        results[0]["spawn_ms"] = spawn_ms
    return results


def run_ollama(sys_p, user_p, model: str, host: str):
    body = json.dumps({
        "model": model,
        "system": sys_p.read_text(),
        "prompt": user_p.read_text(),
        "stream": False,
        "options": {"temperature": 0.7, "num_predict": 2048},
    }).encode()
    req = urllib.request.Request(f"{host}/api/generate", data=body,
                                 headers={"Content-Type": "application/json"})
    t0 = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=600) as resp:
            r = json.loads(resp.read())
    except (urllib.error.URLError, TimeoutError, OSError) as e:
        return {"wall_ms": (time.perf_counter() - t0) * 1000, "error": f"{type(e).__name__}: {e}"}
    wall = (time.perf_counter() - t0) * 1000
    ns = r.get("eval_duration") or 0
    out_tok = r.get("eval_count") or 0
    return {
        "wall_ms": wall,
        "api_ms": (r.get("total_duration") or 0) / 1e6 or None,
        "ttft_ms": ((r.get("prompt_eval_duration") or 0) + (r.get("load_duration") or 0)) / 1e6 or None,
        "in_tok": r.get("prompt_eval_count"),
        "out_tok": out_tok,
        "tok_per_s": round(out_tok / (ns / 1e9), 1) if ns and out_tok else None,
        "cost_usd": 0.0,
        "ok_json": valid_json_verdicts(r.get("response") or "", len(CANDIDATES)),
    }


def summarize(backend: str, rows: list[dict]) -> dict:
    good = [r for r in rows if "error" not in r]
    def stat(key):
        vals = [r[key] for r in good if isinstance(r.get(key), (int, float))]
        if not vals:
            return None
        return {"min": round(min(vals), 1), "median": round(statistics.median(vals), 1),
                "max": round(max(vals), 1)}
    return {
        "backend": backend,
        "runs": len(rows),
        "errors": [r["error"] for r in rows if "error" in r],
        "valid_json_runs": sum(1 for r in good if r.get("ok_json")),
        "wall_ms": stat("wall_ms"),
        "api_ms": stat("api_ms"),
        "ttft_ms": stat("ttft_ms"),
        "spawn_ms": next((r["spawn_ms"] for r in rows if "spawn_ms" in r), None),
        "cache_write_tok": stat("cache_write"),
        "cache_read_tok": stat("cache_read"),
        "in_tok": stat("in_tok"),
        "out_tok": stat("out_tok"),
        "tok_per_s": stat("tok_per_s"),
        "cost_usd_total": round(sum(r.get("cost_usd") or 0 for r in good), 6),
        "cost_usd_per_run": stat("cost_usd"),
        "rows": rows,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("backend",
                    help="claude | claude-bare | claude-live | claude-live-clear "
                         "| ollama:<model>")
    ap.add_argument("--runs", type=int, default=5)
    ap.add_argument("--model", default="haiku", help="claude model alias/id")
    ap.add_argument("--ollama-host", default="http://127.0.0.1:11434")
    ap.add_argument("--prompt-dir",
                    default=os.environ.get("BENCH_PROMPT_DIR", "/tmp/judge-bench"))
    ap.add_argument("--json", action="store_true", help="emit the full report as JSON")
    ap.add_argument("--save-dir", default=None,
                    help="write each run's raw reply text here (claude-live only)")
    args = ap.parse_args()

    sys_p, user_p = write_fixture(pathlib.Path(args.prompt_dir))
    b = args.backend

    if b in ("claude-live", "claude-live-clear"):
        rows = run_claude_live(sys_p, user_p, args.runs, args.model, args.save_dir,
                               clear_between=(b == "claude-live-clear"))
    elif b in ("claude", "claude-bare"):
        rows = [run_claude_oneshot(sys_p, user_p, b == "claude-bare", args.model)
                for _ in range(args.runs)]
    elif b.startswith("ollama:"):
        rows = [run_ollama(sys_p, user_p, b.split(":", 1)[1], args.ollama_host)
                for _ in range(args.runs)]
    else:
        sys.exit(f"unknown backend: {b}")

    rep = summarize(b, rows)
    rep["fixture"] = {
        "system_bytes": sys_p.stat().st_size,
        "user_bytes": user_p.stat().st_size,
        "candidates": len(CANDIDATES),
    }
    if args.json:
        print(json.dumps(rep, indent=2))
    else:
        print(json.dumps({k: v for k, v in rep.items() if k != "rows"}, indent=2))


if __name__ == "__main__":
    main()

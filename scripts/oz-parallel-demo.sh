#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  scripts/oz-parallel-demo.sh [--cloud --env ENV_ID] [--outdir DIR] [--rounds N]

What it demonstrates:
  1) Parallel fan-out: launches 3 Oz agents concurrently.
  2) Ping-pong interconnection: orchestrates 2 Oz agents exchanging messages for N rounds.

Options:
  --cloud        Use "oz agent run-cloud" instead of local "oz agent run".
  --env ENV_ID   Required when --cloud is set.
  --outdir DIR   Output directory (default: .tmp/oz-orchestration-demo)
  --rounds N     Ping-pong rounds (default: 3)
  -h, --help     Show help.
EOF
}

MODE="local"
OZ_ENV_ID=""
OUTDIR=".tmp/oz-orchestration-demo"
ROUNDS=3
PIDS=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --cloud)
      MODE="cloud"
      shift
      ;;
    --env)
      OZ_ENV_ID="${2:-}"
      shift 2
      ;;
    --outdir)
      OUTDIR="${2:-}"
      shift 2
      ;;
    --rounds)
      ROUNDS="${2:-}"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v oz >/dev/null 2>&1; then
  echo "Error: 'oz' CLI is not installed or not in PATH." >&2
  exit 1
fi

if [[ "$MODE" == "cloud" && -z "$OZ_ENV_ID" ]]; then
  echo "Error: --env ENV_ID is required when using --cloud." >&2
  exit 1
fi

if ! [[ "$ROUNDS" =~ ^[0-9]+$ ]] || [[ "$ROUNDS" -lt 1 ]]; then
  echo "Error: --rounds must be a positive integer." >&2
  exit 1
fi

mkdir -p "$OUTDIR"

cleanup() {
  local pid
  for pid in "${PIDS[@]:-}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}
trap cleanup EXIT

run_oz_prompt() {
  local prompt="$1"
  if [[ "$MODE" == "cloud" ]]; then
    oz agent run-cloud --env "$OZ_ENV_ID" --prompt "$prompt"
  else
    oz agent run --prompt "$prompt"
  fi
}

run_task_to_file() {
  local name="$1"
  local prompt="$2"
  local stdout_file="$OUTDIR/${name}.out.txt"
  local stderr_file="$OUTDIR/${name}.err.txt"

  {
    echo "----- $name prompt -----"
    echo "$prompt"
    echo "----- $name output -----"
    run_oz_prompt "$prompt"
  } >"$stdout_file" 2>"$stderr_file"
}

print_phase_banner() {
  local title="$1"
  echo
  echo "============================================================"
  echo "$title"
  echo "============================================================"
}

summarize_task_result() {
  local name="$1"
  local status="$2"
  local out_file="$OUTDIR/${name}.out.txt"
  local err_file="$OUTDIR/${name}.err.txt"
  if [[ "$status" -eq 0 ]]; then
    echo "✓ $name succeeded (output: $out_file)"
  else
    echo "✗ $name failed (stderr: $err_file)"
  fi
}

run_parallel_fanout() {
  print_phase_banner "Phase 1: Parallel fan-out demo"
  echo "Launching 3 agents concurrently..."

  local prompts=(
    "You are worker A. Analyze backend risks for feature X and return 5 bullet points."
    "You are worker B. Propose a migration plan for feature X in 6 concise steps."
    "You are worker C. Draft a test strategy for feature X with unit/integration/e2e split."
  )

  local names=("fanout-a" "fanout-b" "fanout-c")
  local i
  PIDS=()

  for i in "${!names[@]}"; do
    run_task_to_file "${names[$i]}" "${prompts[$i]}" &
    PIDS+=("$!")
    echo "Started ${names[$i]} (pid=${PIDS[$i]})"
  done

  local statuses=()
  for i in "${!PIDS[@]}"; do
    if wait "${PIDS[$i]}"; then
      statuses+=(0)
    else
      statuses+=(1)
    fi
  done

  PIDS=()
  for i in "${!names[@]}"; do
    summarize_task_result "${names[$i]}" "${statuses[$i]}"
  done
}

build_ping_prompt() {
  local round="$1"
  local pong_context="$2"
  cat <<EOF
You are Ping Agent. This is round $round.
Respond with a short "PING" message (max 2 lines) that advances the conversation.
Use this latest Pong context:
$pong_context
EOF
}

build_pong_prompt() {
  local round="$1"
  local ping_context="$2"
  cat <<EOF
You are Pong Agent. This is round $round.
Respond with a short "PONG" message (max 2 lines) to the Ping context below:
$ping_context
EOF
}

read_context() {
  local file="$1"
  if [[ -f "$file" ]]; then
    sed -n '1,40p' "$file"
  else
    echo "(no previous context)"
  fi
}

run_ping_pong() {
  print_phase_banner "Phase 2: Ping-pong interconnection demo"

  local round
  local ping_file
  local pong_file
  local ping_context
  local pong_context="(start: say hello from Pong side)"

  for (( round=1; round<=ROUNDS; round++ )); do
    ping_file="$OUTDIR/ping-round-${round}.txt"
    pong_file="$OUTDIR/pong-round-${round}.txt"

    run_oz_prompt "$(build_ping_prompt "$round" "$pong_context")" >"$ping_file" 2>"$OUTDIR/ping-round-${round}.err.txt"
    ping_context="$(read_context "$ping_file")"

    run_oz_prompt "$(build_pong_prompt "$round" "$ping_context")" >"$pong_file" 2>"$OUTDIR/pong-round-${round}.err.txt"
    pong_context="$(read_context "$pong_file")"

    echo "Round $round complete (ping: $ping_file, pong: $pong_file)"
  done
}

main() {
  run_parallel_fanout
  run_ping_pong
  print_phase_banner "Done"
  echo "Artifacts saved in: $OUTDIR"
}

main

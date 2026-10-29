#!/usr/bin/env python3
"""PreToolUse guard on Agent: deny a fork whose prompt starts agents or picks a model.

A fork runs on the parent model, ignores `model`, and must not start agents, so such a
prompt runs every nested step on the parent model inside the fork.
"""
import json
import re
import sys

NESTED_AGENT_SIGNS = [
    (r"\b(sonnet|haiku)\b", "names a cheaper model"),
    (r"\bsub-?agents?\b|\bspawn", "asks for subagents"),
    (r"@[a-z][a-z-]+\b|\bwm:[a-z-]+(er|critic|checker|tester)\b", "names an agent type"),
    (r"/code (impl|auto|review)\b|/review\b|\bgate (wave|chain)\b", "runs a loop that starts agents"),
]

call = json.load(sys.stdin)
tool_input = call.get("tool_input", {})
if tool_input.get("subagent_type") != "fork":
    sys.exit(0)

prompt = tool_input.get("prompt", "")
hits = [why for pattern, why in NESTED_AGENT_SIGNS if re.search(pattern, prompt, re.IGNORECASE)]
if not hits:
    sys.exit(0)

reason = (
    f"Fork denied: the prompt {', '.join(hits)}. A fork always runs on the parent model, "
    "ignores `model`, and must not start agents. "
    "Triage the task first. Estimate how much of the current context the task needs. "
    "If it needs 70% or more: fork again, and give the fork only work it does itself, "
    "with no nested agents and no model name. Run each nested agent from this session. "
    "If it needs less than 70%: start a new named agent (`general-purpose`, `wm:implementer`, ...) "
    "with `model`. It starts with an empty context, so list in the prompt the files it must read "
    "first, as absolute paths, each with one line that says why. "
    "Add the facts from this session that no file holds."
)
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason,
    }
}))

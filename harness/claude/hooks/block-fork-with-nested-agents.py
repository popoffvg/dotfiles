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
    "ignores `model`, and must not start agents, so every nested step would run on the parent model. "
    "Do one of these: run the loop in this session and start each named agent from here with its "
    "`model`; or start a named agent (`general-purpose`, `wm:implementer`, ...) with `model` and a "
    "self-contained prompt. Give a fork only work it does itself on the parent model."
)
print(json.dumps({
    "hookSpecificOutput": {
        "hookEventName": "PreToolUse",
        "permissionDecision": "deny",
        "permissionDecisionReason": reason,
    }
}))

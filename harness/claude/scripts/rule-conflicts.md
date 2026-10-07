---
name: rule-conflicts.py
description: Group the rule sentences of the instruction corpus by the artifact they govern with a local embedding model, batch the groups for judge agents, and score the judges' recall on planted conflicts.
args: "group --out DIR [--planted FILE] [--source GLOB ...] [--model M] [--batches N] [--labels-per-rule N] | report --out DIR [--planted FILE] [--min-recall R]"
needs: uv, ollama with qwen3-embedding:4b
used_by: harness-dev rule-conflicts skill
---

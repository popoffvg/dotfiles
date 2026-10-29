---
name: wm-spec-code-names.py
description: Diff the names that a wm spec corpus (spec.md, GLOSSARY.md, todos/, adr/) uses against the names that the Go, Rust, JS, and TS code declares.
args: "[notes-dir] [--root DIR] [--todo N] [--include GLOB]... [--all] [--json]"
needs: python3, ast-grep
used_by: wm verify and impl
---

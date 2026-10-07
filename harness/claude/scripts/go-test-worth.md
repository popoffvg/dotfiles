---
name: go-test-worth.py
description: Run mutants against a Go package's unit tests with per-test kill tracking, use the E2E tests as the reference, and mark each candidate unit test or table row KEEP, USELESS, E2E-COVERED, REDUNDANT, or NO-VERDICT.
args: "--checkout DIR --mutants TSV --unit CMD --candidates FILE [--e2e CMD] [-j N] [-t SEC] [--e2e-timeout SEC]"
needs: python3, go, perl
used_by: wm mutation-tester agent
---

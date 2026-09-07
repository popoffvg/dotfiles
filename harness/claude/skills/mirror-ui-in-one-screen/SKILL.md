---
name: mirror-ui-in-one-screen
description: Use when building a new front-end for an existing tool — porting or mirroring a CLI/TUI/app's interface into another host (a Raycast or Alfred command, a browser extension, a web page, a GUI) — or when a view navigates/pushes automatically on mount. Keeps the original's single-screen layout and stops an auto-opened view from hiding the primary input.
metadata:
  origin: self-improvement
---

# Mirror a UI in one screen

When the ask is "build X with the same interface as Y", the layout is part of the
interface. Y showing input and output **on one screen** is a design fact to copy, not an
implementation detail to improve on.

## The rule

**Do not redistribute one screen across several.** If the original shows input on top and
results below it, the replica shows input on top and results below it — in a single view
that updates in place. Splitting it into a submit-then-push/navigate flow is a different
interface, even when every feature is present.

**Never let mount-time auto-navigation cover the primary input.** If the replica prefills
input (from the clipboard, a selection, an argument) and acts on it immediately, render the
result *beside or below* the still-visible input. Pushing a result view on mount means the
user lands on the result and never sees the input field.

## Why

A hidden input reads as a **removed** input. The user cannot tell "the field is one
`Esc` behind this view" from "the field is gone" — they only see that what they used to
type into is missing, and report it as deleted functionality.

## How to apply

- Pick the host primitive that holds input *and* output in one view. Prefer the one with a
  multiline/editable field plus read-only result slots over a list whose only input is a
  single-line search bar.
- Update result state in place on submit; do not navigate.
- Keep the input populated and editable after a result arrives, so the next edit is a
  keystroke away rather than a back-navigation.
- Reserve a pushed/secondary view for genuinely secondary detail the original also put
  behind an extra step.

## Check before claiming parity

Walk the original's screen top to bottom and name where each element lives in the replica.
Any element that answers "one navigation away" is a parity gap. If the host's rendering
cannot be inspected (no screenshot permission, headless), say the layout is unverified
rather than implying it was seen — a build that compiles proves the data path, not the
arrangement.

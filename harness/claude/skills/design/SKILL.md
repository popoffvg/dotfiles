---
name: design
description: House rules for designing a solution — reuse what exists, keep the smallest shape that works, and name the option you rejected. Use when designing, proposing an approach, comparing options, or choosing where a change goes.
---

# Design

## Reuse before invention

Find the existing tool, script, skill, pattern, or component that does the job. Propose a new mechanism only after you name the existing ones and say why each one fails.

## Smallest shape that works

Pick the design with the fewest new parts. A new file, flag, layer, or abstraction must earn its place with a fact the current shape cannot carry.

## One responsibility per part

Each component does one kind of work. When a description needs "and", the design has two parts.

## Say what you rejected

Give the chosen option and at least one option you dropped, with the reason. A design with no rejected option was not a choice.

## Follow the local pattern

When the request says "do X like Y", copy Y's exact structure from the real code. Do not substitute a better variant.

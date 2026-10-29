---
name: quint-statechart
script: quint-statechart.py
description: Draws a Quint model as a Mermaid statechart in the reader's words from sampled ITF traces, marks the states where an invariant broke, and writes each bug as a numbered path.
usage: quint-statechart.py MODEL.qnt --main INSTANCE --view view.py [--invariant NAME]... [--traces 3000] [--samples 200000] [--steps 15] [--out DIR]
---

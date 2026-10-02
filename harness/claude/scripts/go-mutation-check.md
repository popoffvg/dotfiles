---
name: go-mutation-check.sh
description: Apply mutants to sandbox copies of a Go checkout in parallel, run the covering tests with a timeout, and report which mutants survived.
args: "[-j N] [-t DURATION] [-n] [-F] <checkout> <mutants-file>"
needs: go, perl
used_by: wm mutation-tester agent
---

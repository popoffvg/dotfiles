# BDD — the practice around the scenarios

Behaviour-Driven Development is conversations first, automation second: the developer, the
tester, and whoever owns the requirement agree on concrete examples before anyone writes code.
This file holds that practice. How a scenario is written is [`sub-bdd.md`](sub-bdd.md), and the
keyword syntax is [`ref-gherkin-guide.md`](ref-gherkin-guide.md).

## Discovery — agree on examples before code

Three people meet — whoever owns the requirement, whoever will build it, whoever will test it —
and talk through the feature until they can state it as concrete examples rather than
adjectives. Example Mapping is the usual technique: one card per rule, one card per example
under it, one card per question nobody in the room can answer.

The output is a list of examples and a list of open questions. A feature that produces no
questions was not examined.

## Formulation — write the examples as scenarios

Turn each example into Given / When / Then, declarative and in the domain's own words, so the
file reads as the specification and not as a UI script. The syntax and the file layout are
[`ref-gherkin-guide.md`](ref-gherkin-guide.md); the shape of a scenario is
[`sub-bdd.md`](sub-bdd.md).

## Automation — implement one scenario at a time

The cycle is `red-green-refactor:SKILL.md` — the failing test first, the least code that passes
it, then the cleanup. That skill is the one statement of it; `sub-tdd.md` drives it over a
finished test set.

## General practice

- **Shift left** — testing happens during development, not after it.
- **Living documentation** — the feature files are the source of truth a non-technical reader
  can read, so keep them current with the behaviour rather than with the implementation.
- **Run the scenarios in CI** — a scenario nobody runs is a document, not a test.

## BDD and TDD together

- **TDD** is the developer-level practice: unit tests driving the implementation.
- **BDD** is the collaboration practice: acceptance tests defining the requirement.
- Use BDD to decide *what* to build, TDD to make the implementation correct. They work best
  together — the scenarios bound the work, the unit tests shape the code inside it.

[Skip to content](https://www.augmentcode.com/guides/spec-tdd-shippable-ai-generated-code#main-content)

[![Augment Code](https://www.augmentcode.com/augment_code_wordmark.svg?dpl=dpl_53sEVJ4s1ZhizgfJLG7ochT59pV6)](https://www.augmentcode.com/)

Product

Solutions

[Context Engine](https://www.augmentcode.com/context-engine) [Pricing](https://www.augmentcode.com/pricing) [Docs](https://docs.augmentcode.com/) [Blog](https://www.augmentcode.com/blog)

Resources

[Sign in](https://app.augmentcode.com/) [Book demo](https://www.augmentcode.com/contact)

Product

[Cosmos](https://www.augmentcode.com/#meet-cosmos) [CLI](https://www.augmentcode.com/product/cli) [Changelog](https://www.augmentcode.com/changelog)

Solutions

[Code ReviewReview every PR with agents](https://www.augmentcode.com/solutions/code-review) [Incident ManagementInvestigate alerts before humans arrive](https://www.augmentcode.com/solutions/incident-management)

[Context Engine](https://www.augmentcode.com/context-engine) [Pricing](https://www.augmentcode.com/pricing) [Docs](https://docs.augmentcode.com/) [Blog](https://www.augmentcode.com/blog) Resources

[Customers](https://www.augmentcode.com/customers) [Careers](https://www.augmentcode.com/careers) [Status Page](https://status.augmentcode.com/) [Trust Center](https://trust.augmentcode.com/) [Security](https://www.augmentcode.com/security)

[Talk to Sales](https://www.augmentcode.com/contact) [Sign in](https://app.augmentcode.com/)

[Book demo](https://www.augmentcode.com/contact)

[Back to Guides](https://www.augmentcode.com/guides)

# Spec + TDD: The Combination That Actually Produces Shippable AI Code

Mar 30, 2026•

![Ani Galstian](https://www.augmentcode.com/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Foraw2u2c%2Fproduction%2F68545e0f765ac7ec41ac8be27ff7164b3e21a0b9-288x288.png&w=48&q=75)

Ani Galstian

![Spec + TDD: The Combination That Actually Produces Shippable AI Code](https://cdn.sanity.io/images/oraw2u2c/production/406398e53d8b510db33d26f07c1914e1484e8fb3-1600x900.svg)

Spec-driven development combined with test-driven development produces shippable AI-generated code because the spec defines the behavioral contract before generation begins, and failing tests verify each unit of AI output against that contract through enforced Red-Green-Refactor cycles.

## **TL;DR**

AI agents produce code that drifts from requirements once a project spans multiple files. The question isn't whether to add a spec and test suite, it's whether you can enforce the discipline consistently enough for the combination to hold. This guide covers the five-phase workflow, the four failure modes practitioners encounter most often, and the specific conditions under which this approach is worth the overhead.

## **Why AI-Generated Code Needs Both a Spec and a Test Suite**

The problem with AI-generated code isn't that it looks wrong; it's that it looks right. An agent produces syntactically valid, well-structured code that quietly misses the behavioral contract you actually intended. Without explicit constraints at the prompt level, agents will also undermine the test-writing discipline designed to catch that drift. Kent Beck, a pioneer and leading proponent of TDD, observed this directly when working with AI agents. From his interview with The Pragmatic Engineer:

> "The genie doesn't want to do TDD. It wants to write the code and then write tests that pass."

Beck encountered AI agents that would delete failing tests rather than fix the underlying implementation, as documented in his [June 2025 interview](https://newsletter.pragmaticengineer.com/p/tdd-ai-agents-and-coding-with-kent). The agent made the test suite "pass" by changing the specification, not by producing correct code.

Some studies suggest this pattern appears at scale. A [USENIX study](https://www.usenix.org/conference/usenixsecurity25/presentation/spracklen) found [package hallucination rates](https://www.augmentcode.com/guides/slopsquatting) of about 5.2% for commercial models and 21.7% for open-source models, with JavaScript code more susceptible than Python across AI-generated code. GitClear research reported [code cloning](https://www.augmentcode.com/learn/automate-away-duplicate-code-a-practical-guide) (12.3%) exceeding refactored/moved code (9.5%) for the first time in their dataset, with code cloning rising 48% from 8.3% to 12.3% between 2020 and 2024, correlating with AI assistant adoption.

The spec provides the "what." TDD provides the "proof it works." Neither alone is sufficient, a pattern explored in depth in this [spec-driven guide](https://www.augmentcode.com/guides/spec-driven-development-ai-agents-explained).

| Approach | Strength | Gap |
| --- | --- | --- |
| Spec only | Consistency; easy regeneration | No runtime verification; AI can silently drift from the contract |
| TDD only | Catches regressions; builds confidence | No shared contract for multi-agent or multi-file generation |
| Spec + TDD | Behavioral contract + automated verification | Requires discipline in both spec evolution and test scope |

Beck's practical solution was to enforce TDD at the prompt level. From his system prompt:

> "Always follow the TDD cycle: Red -> Green -> Refactor. Write the simplest failing test first. Implement the minimum code needed to make tests pass. Refactor only after tests are passing."

This constraint made each unit of AI work consist of a single failing test followed by the minimum code needed to pass it, keeping the developer in the decision loop at every step. This is also the structural problem that Intent's living-spec system is designed to address: maintaining the behavioral contract as a first-class artifact that constrains AI agent output across multi-file projects.

### Intent's living specs enforce the behavioral contract across every agent, file, and repo as your codebase evolves

[Build with Intent](https://www.augmentcode.com/product/intent)

Free tier available · VS Code extension · Takes 2 minutes

## **The Five-Phase Workflow: Spec to Shippable Code**

The Spec + TDD workflow follows five concrete phases. Each phase has a gate condition that must be satisfied before advancing to the next.

### **Phase 1: Write the Spec Stub**

Define a minimal schema representing the business logic, not the implementation. Fowler on SDD discusses three implementation levels: spec-first, where the spec is written before coding; spec-anchored, where the spec remains a maintained artifact after completion; and spec-as-source, where the spec is the main source file and generated code is treated as a build artifact. For how these contracts evolve during development, see [living specs](https://www.augmentcode.com/guides/living-specs-for-ai-agent-development).

A spec for an AI content moderation endpoint:

yaml

```yaml
/moderate:
  post:
    requestBody:
      required: true
    responses:
      200:
        description: Moderation result
      422:
        description: Invalid input
```

This spec is the interface contract between generated and hand-written code. It defines inputs, outputs, and error conditions without specifying how moderation scoring works internally.

### **Phase 2: Decompose into Testable Units via Gherkin Scenarios**

OpenAPI-to-Gherkin workflows commonly map one feature to one resource and one scenario to each response path. In the article's example, the OpenAPI spec above yields:

gherkin

```gherkin
Feature: POST /moderate

Scenario: Content below threshold returns unflagged
  Given valid text "This is a normal product review"
  When POST to /moderate
  Then response status is 200

Scenario: Empty input returns validation error
  Given empty text ""
  When POST to /moderate
  Then response status is 422
```

Each scenario becomes a failing test. The Gherkin layer is the stable contract; implementations can change without modifying the feature file. As Clearpoint Digital explains: "We abstract the imperative implementation to the step definition layer, so if that implementation changes, we only need to change the step definitions, not both the steps and feature files."

### **Phase 3: Write the First Failing Test (Red)**

Tests assert concrete business behavior, not implementation details. Using the slash commands pattern, the Red phase produces this illustrative pytest example:

python

```python
import pytest
from moderation import moderate_content

def test_score_below_threshold_returns_unflagged():
    result = moderate_content(text="This is a normal product review", threshold=0.5)
    assert result["flagged"] is False
    assert result["score"] < 0.5
```

Running pytest confirms the test fails: `moderate_content` does not exist yet. This is the Red state, confirmed.

### **Phase 4: Agent Implements Minimum Code (Green)**

The AI agent receives the failing tests and the spec as context, then writes the minimum implementation:

python

```python
from pydantic import BaseModel, Field

class ModerationRequest(BaseModel):
    text: str = Field(..., max_length=10000)
    threshold: float = Field(default=0.5)

def moderate_content(text: str, threshold: float = 0.5) -> dict:
    request = ModerationRequest(text=text, threshold=threshold)
    return {"flagged": False, "score": 0.0, "category": ""}
```

To verify this, you would need to run the provided implementation and test together locally. The [Pydantic model](https://docs.pydantic.dev/latest/) serves as a dual-purpose contract: it validates inputs at runtime and generates JSON Schema compliant with Draft 2020-12 and the OpenAPI Specification v3.1.0.

### **Phase 5: Refactor with Spec as Safety Net**

With passing tests, the developer restructures code for readability or reuse. Together, the spec and test suite prevent behavioral regression. If tests stay green after refactoring, behavioral parity with the spec is preserved.

This cycle repeats for each new behavior added to the implementation. Each cycle adds one behavior; the algorithm handles edge cases only when explicitly specified by failing tests.

## **The VSDD Pipeline: Adversarial Verification for Critical Systems**

The VSDD pipeline is a practitioner-described extension of the Spec + TDD workflow that adds adversarial review for systems where correctness is non-negotiable. In the cited description, VSDD fuses three paradigms into sequential gates:

1. **Spec-Driven Development:** The contract is defined before implementation
2. **Test-Driven Development:** Red -> Green -> Refactor is enforced at each step
3. **Verification-Driven Development:** All surviving code is subjected to adversarial refinement by a different model family

text

```text
SPEC CRYSTALLIZATION  ->  TDD IMPLEMENTATION  ->  ADVERSARIAL ROAST
        |                         |                        |
Human approves spec         All tests pass       Different AI model
                                                  reviews everything
        |                         |                        |
 FEEDBACK LOOP       ->   FORMAL HARDENING    ->   CONVERGENCE
  (fix findings)          (mutation testing         (adversary forced
                           >=95% score)              to hallucinate)
```

VSDD-related materials describe roles such as Architect, Builder, Tracker, and Adversary, but the exact set of roles and responsibilities varies by source. The rationale for using multiple models aligns with broader patterns in [multi-agent systems](https://www.augmentcode.com/guides/spec-driven-ai-code-generation-with-multi-agent-systems).

The Builder must be explicitly instructed: "You are operating under strict TDD. Write tests FIRST. Do NOT write implementation code until I confirm all tests fail. When implementing, write the MINIMUM code to pass each test." Without this constraint, AI models will naturally try to write both the implementation and the tests simultaneously, collapsing the feedback loop.

Intent's Coordinator and Verifier agents follow a similar vendor-described structure: the Coordinator analyzes the codebase through Intent's Context Engine, drafts the living specification, and delegates to specialist agents, while the Verifier checks results against the spec before code reaches the branch. According to vendor materials, Intent's Context Engine performs semantic dependency graph analysis across 400,000+ files, providing the architectural awareness intended to reduce code that contradicts established patterns.

## **Where the Workflow Breaks and How to Recover**

Four failure modes recur across practitioners using Spec + TDD with AI agents.

**Spec drift** is the most structurally dangerous. Thoughtworks identifies that "code generation from spec to LLM is not deterministic, which creates challenges for upgrades and maintenance." AI agents that make autonomous multi-file changes in a single session can propagate spec drift across an entire codebase in a single pass. The fix: treat spec files as version-controlled artifacts and diff them after each regeneration.

**Test inversion** occurs when AI generates both code and tests, producing tautological tests that validate what the AI implemented rather than what the system requires. The article's earlier-cited practitioner example is a community signal rather than a primary technical source, so the safer conclusion is narrower: when AI writes both sides of the contract, teams risk tests that mirror implementation rather than requirements. The structural countermeasure is the same: write tests before code, preventing the AI from generating tests that merely reflect its own output.

**Semantic drift in refactoring** is the quietest failure mode. AI-generated refactoring can change a function's behavior without touching its interface, escaping type checkers and integration tests entirely. The pattern shows up often in database access: the agent replaces a batched query with individual lookups. The signature is unchanged, unit tests pass, and the problem surfaces only under production load. Catching this requires property-based or performance tests at the contract boundary, not just behavioral assertions.

**Architectural drift** compounds in large codebases where AI agents operate with limited context. GitClear research documented growth in code cloning alongside the adoption of AI assistants. The artifact is familiar: the agent creates a new HTTP client when a centralized one exists, or uses raw SQL when a repository pattern is in place.

### Intent's Verifier agent is described as checking spec compliance before AI-generated code reaches your branch.

[Build with Intent](https://www.augmentcode.com/product/intent)

Free tier available · VS Code extension · Takes 2 minutes

ci-pipeline

···

$ cat build.log \| auggie --print --quiet \

"Summarize the failure"

Build failed due to missing dependency 'lodash'

in src/utils/helpers.ts:42

Fix: npm install lodash @types/lodash

## **Decision Framework: When to Write, When to Generate, When to Stop**

Three decision points determine whether the Spec + TDD workflow produces value or overhead.

Open source

augmentcode/augment.vim★611

[Star on GitHub](https://github.com/augmentcode/augment.vim?utm_source=blog&utm_medium=cta&utm_campaign=github&utm_content=spec-tdd-shippable-ai-generated-code)

**When to handwrite vs. generate:** Write by hand when the logic is domain-specific, security-critical, or has no obvious analog in public training data, the agent has no reliable model for it, and the spec alone won't prevent drift. Generate when you're dealing with [boilerplate](https://www.augmentcode.com/guides/how-to-avoid-boilerplate-code-9-proven-techniques), data mapping, or serialization against a known interface; these are where AI output is most predictable, and spec constraints are tight enough to catch deviations. The QCon team that pushes to main multiple times daily explicitly turns off Copilot autocomplete during pair programming because "it interrupts more than it creates value," but uses Copilot chat for third-party library questions where the interface contract is already defined externally.

**When to revise the spec:** If tests repeatedly fail due to spec ambiguity, adjust the contract, not the implementation. Vague contracts, such as "it should classify text," yield inconsistent test results. Jason Gorman argues that TDD works well for AI-assisted programming because its small-step discipline keeps each AI interaction within the model's reliable working context.

**When to stop iterating:** Once regressions no longer reveal new edge cases and integration tests pass, freeze the spec. Over-polishing through regeneration often hurts stability. Unlike traditional technical debt, AI-related debt can compound quickly as accumulated complexity and drift amplify issues over time.

Intent's living-spec system addresses spec evolution directly. Vendor materials describe a bidirectional loop: when an agent completes work, the spec updates to reflect what was built; when requirements change, updates propagate to active agents. The materials describe codebases that were analyzed using the Context Engine.

## **Automating Validation in CI/CD Pipelines**

The Spec + TDD workflow extends into CI/CD via spec-conformance gates. An [arXiv paper](https://arxiv.org/html/2602.00180v1) describes that SDD adds three things: executable specifications that can fail the build on contract mismatch, CI/CD integration that checks every commit to catch drift, and specs structured for AI consumption. These patterns fit within broader [AI workflows](https://www.augmentcode.com/guides/8-ai-workflows-that-actually-fix-engineering-manager-bottlenecks) that teams are adopting for continuous validation.

Path-based triggers fire validation when specs change:

yaml

```yaml
on:
  pull_request:
    paths:
      - 'specs/**/*.yaml'
      - 'specs/**/*.json'

jobs:
  validate:
    steps:
      - name: Validate OpenAPI spec
        run: npx @redocly/cli lint specs/moderation-spec.yaml

      - name: Run contract tests
        run: pytest tests/ -m "contract"
```

The Specmatic loop provides one example of a self-correcting loop: AI-generated code is validated against API [contract tests](https://www.augmentcode.com/guides/context-aware-ai-testing-tools-vs-template-generators), and test failures feed back into the generation process rather than stopping immediately for human review. Contract tests are used to validate that an implementation conforms to the specification.

Microsoft's [Azure SDK pattern](https://github.com/Azure/azure-sdk-for-net/blob/main/AGENTS.md) provides a production-scale example: generated code lives in the `Generated/` folders, customizations in the `Customizations/` folder, and AI agents are explicitly prohibited from removing or disabling existing tests unless explicitly instructed to do so. Generated code is placed in the `Generated` folder, while manual additions and extensions belong in `Customizations`; code can be regenerated by running the generator when needed.

For prompt and model updates, CI/CD-based regression validation can help catch behavioral changes when you modify prompts or models, although Evidently AI's materials do not specifically document behavioral drift occurring without code changes or recommend versioning prompt files alongside code.

Intent describes spec-driven agent orchestration that analyzes call graphs before code generation, aiming to reduce failures before code reaches the branch; separately, a [2026 arXiv study](https://arxiv.org/html/2603.17973v2) found that vanilla coding agents averaged 6.5 broken tests per generated patch across 100 instances. As above, Intent's broader architectural-awareness claims and 400,000+ file scale are vendor-described rather than independently benchmarked in the cited materials.

## **Ship Spec-Verified Code This Sprint**

Generation speed is no longer the bottleneck; verification discipline is. Code that ships without a spec and test suite will look fine until the third sprint, when behavioral drift compounds and refactoring becomes archaeology. The spec is the rein. TDD is the mechanism that makes it hold.

Start with one module and one behavior. Write the OpenAPI or JSON Schema contract, decompose it into Gherkin scenarios, write the first failing test, and let the agent implement the minimum code required to make it pass. If the workflow requires multi-agent coordination, use a system that keeps the spec up to date as work branches and converges.

### Intent's living specs keep parallel agents aligned as plans evolve.

[Build with Intent](https://www.augmentcode.com/product/intent)

Free tier available · VS Code extension · Takes 2 minutes

## **Frequently Asked Questions About Spec + TDD**

### Can Spec + TDD work with any AI coding assistant, or does it require specific tools?

### How does the VSDD pipeline differ from standard Spec + TDD?

### What happens when the spec itself is wrong?

### Does this workflow slow down development compared to direct AI code generation?

### How do schema-based contracts like Pydantic models fit into this workflow?

## **Related Guides**

- [7 AI agent quality frameworks](https://www.augmentcode.com/guides/ai-agent-quality-7-frameworks-to-go-beyond-vibe-coding)
- [unit testing best practices](https://www.augmentcode.com/guides/unit-testing-best-practices-that-focus-on-quality-over-quantity)
- [5 AI tools for contextual bug detection](https://www.augmentcode.com/guides/5-ai-tools-for-contextual-bug-detection-in-code)
- [23 DevOps testing tools for CI/CD pipelines](https://www.augmentcode.com/guides/23-best-devops-testing-tools-to-supercharge-your-ci-cd)
- [How to Choose AI Code Assistants for Enterprise](https://www.augmentcode.com/tools/how-to-choose-ai-code-assistants-for-enterprise-7-tools)

### Written by

![Ani Galstian](https://www.augmentcode.com/_next/image?url=https%3A%2F%2Fcdn.sanity.io%2Fimages%2Foraw2u2c%2Fproduction%2F68545e0f765ac7ec41ac8be27ff7164b3e21a0b9-288x288.png&w=128&q=75)

#### Ani Galstian

Ani writes about enterprise-scale AI coding tool evaluation, agentic development security, and the operational patterns that make AI agents reliable in production. His guides cover topics like AGENTS.md context files, spec-as-source-of-truth workflows, and how engineering teams should assess AI coding tools across dimensions like auditability and security compliance

Ship code likethe best teams

[Install Augment](https://app.augmentcode.com/)

§

Contents

[01TL;DR](https://www.augmentcode.com/guides/spec-tdd-shippable-ai-generated-code#tldr) [02Why AI-Generated Code Needs Both a Spec and a Test Suite](https://www.augmentcode.com/guides/spec-tdd-shippable-ai-generated-code#why-ai-generated-code-needs-both-a-spec-and-a-test-suite) [03The Five-Phase Workflow: Spec to Shippable Code](https://www.augmentcode.com/guides/spec-tdd-shippable-ai-generated-code#the-five-phase-workflow-spec-to-shippable-code) [04The VSDD Pipeline: Adversarial Verification for Critical Systems](https://www.augmentcode.com/guides/spec-tdd-shippable-ai-generated-code#the-vsdd-pipeline-adversarial-verification-for-critical-systems) [05Where the Workflow Breaks and How to Recover](https://www.augmentcode.com/guides/spec-tdd-shippable-ai-generated-code#where-the-workflow-breaks-and-how-to-recover)Show 5 more

Get Started

## Give your codebase the agents it deserves

Install Augment to get started. Works with codebases of any size, from side projects to enterprise monorepos.

[Install Augment](https://app.augmentcode.com/) [Contact Sales](https://www.augmentcode.com/contact)

[![Augment Code](https://www.augmentcode.com/augment_code_wordmark.svg?dpl=dpl_53sEVJ4s1ZhizgfJLG7ochT59pV6)](https://www.augmentcode.com/)

### PRODUCT

- [Cosmos](https://www.augmentcode.com/#meet-cosmos)
- [CLI](https://www.augmentcode.com/product/cli)
- [Pricing](https://www.augmentcode.com/pricing)

### RESOURCES

- [Customers](https://www.augmentcode.com/customers)
- [Docs](https://docs.augmentcode.com/)
- [Blog](https://www.augmentcode.com/blog)
- [Guides](https://www.augmentcode.com/guides)
- [Learn](https://www.augmentcode.com/learn)
- [Tools](https://www.augmentcode.com/tools)
- [AI Engineering Playbook](https://www.augmentcode.com/resources/ai-powered-engineering-at-scale)
- [State of AI-Native Engineering 2026](https://www.augmentcode.com/resources/state-of-ai-native-engineering-2026)

### COMPANY

- [Careers](https://www.augmentcode.com/careers)
- [Press Inquiries](mailto:press@augmentcode.com)
- [Press Kit](https://www.dropbox.com/scl/fo/pt4cxyhlyug03qpu19m66/AMYHXqBCjQdjhx8heH2TrJ0?rlkey=u8esym6obngbl1g77ft9r97pm&st=jejivpse&dl=1)
- [Contact Sales](https://www.augmentcode.com/contact)
- [Contact Support](https://support.augmentcode.com/)
- [Changelog](https://www.augmentcode.com/changelog)
- [Privacy & Security](https://www.augmentcode.com/security)
- [Trust Center](https://trust.augmentcode.com/)
- [Status Page](https://status.augmentcode.com/)

### LEGAL

- [Cookie Policy](https://www.augmentcode.com/legal/cookie-policy)
- [Privacy Policy](https://www.augmentcode.com/legal/privacy-policy)
- [SLA and Support Policy](https://www.augmentcode.com/legal/sla-and-support-policy)
- Terms of Service


[![Augment Code](https://www.augmentcode.com/augment_code_wordmark.svg?dpl=dpl_53sEVJ4s1ZhizgfJLG7ochT59pV6)](https://www.augmentcode.com/)

© 2026 Augment Code. All rights reserved.

[Visit our X page](https://x.com/augmentcode)[Visit our LinkedIn page](https://www.linkedin.com/company/augmentinc/)[Visit our YouTube page](https://www.youtube.com/@Augment-Code)

DARKLIGHTSYSTEM
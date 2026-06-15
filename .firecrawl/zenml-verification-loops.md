[![ZenML](https://www.zenml.io/images/zenml-logo.svg)](https://www.zenml.io/)

Product

[ZenML \\
\\
Pipelines for ML workflows](https://www.zenml.io/product/zenml) [Kitaru \\
\\
Durable runtime for AI agents](https://www.zenml.io/product/kitaru)

[ZenML Pro \\
\\
Unified managed control plane for ZenML and Kitaru workspaces](https://www.zenml.io/pro)

Docs

[ZenML docs \\
\\
Pipelines, components, integrations](https://docs.zenml.io/) [Kitaru docs \\
\\
Agent runtime primitives and APIs](https://docs.zenml.io/kitaru)

Case Studies

[Customer stories \\
\\
How teams ship ML and agents with ZenML](https://www.zenml.io/case-studies) [LLMOps Database \\
\\
1,728 LLMOps case studies, searchable](https://www.zenml.io/llmops-database)

[Compare](https://www.zenml.io/compare) [Pricing](https://www.zenml.io/pricing) [Blog](https://www.zenml.io/blog)

[Star·5,441](https://github.com/zenml-io/zenml)

[Read Docs](https://www.zenml.io/docs) [Book a demo](https://www.zenml.io/book-your-demo)

Product

Products

[ZenML](https://www.zenml.io/product/zenml) [Kitaru](https://www.zenml.io/product/kitaru) [ZenML Pro](https://www.zenml.io/pro)

Docs

Documentation

[ZenML docs](https://docs.zenml.io/) [Kitaru docs](https://docs.zenml.io/kitaru)

Case Studies

Case studies

[Customer stories](https://www.zenml.io/case-studies) [LLMOps Database](https://www.zenml.io/llmops-database)

[Compare](https://www.zenml.io/compare) [Pricing](https://www.zenml.io/pricing) [Blog](https://www.zenml.io/blog)

[Read Docs](https://www.zenml.io/docs) [Book a demo](https://www.zenml.io/book-your-demo)

[LLMOps Database](https://www.zenml.io/llmops-database) Building Reliable Background Coding Agents with Verification Loops

# Building Reliable Background Coding Agents with Verification Loops

Spotify·2025

[View original source](https://engineering.atspotify.com/2025/12/feedback-loops-background-coding-agents-part-3)

Spotify developed a background coding agent system to automate large-scale software maintenance across thousands of components, addressing the challenge of ensuring reliable and correct code changes without direct human supervision. The solution centers on implementing strong verification loops consisting of deterministic verifiers (for formatting, building, and testing) and an LLM-as-judge layer to prevent the agent from making out-of-scope changes. After generating over 1,500 pull requests, the system demonstrates that verification loops are essential for maintaining predictability, with the judge layer vetoing approximately 25% of proposed changes and the agent successfully course-correcting about half the time, significantly reducing the risk of functionally incorrect code reaching production.

## Industry

[Media & Entertainment](https://www.zenml.io/industry-tags/media-entertainment)

## Technologies

[code\_generation](https://www.zenml.io/llmops-tags/code-generation) [poc](https://www.zenml.io/llmops-tags/poc) [agent\_based](https://www.zenml.io/llmops-tags/agent-based) [prompt\_engineering](https://www.zenml.io/llmops-tags/prompt-engineering) [human\_in\_the\_loop](https://www.zenml.io/llmops-tags/human-in-the-loop) [error\_handling](https://www.zenml.io/llmops-tags/error-handling) [evals](https://www.zenml.io/llmops-tags/evals) [cicd](https://www.zenml.io/llmops-tags/cicd) [continuous\_integration](https://www.zenml.io/llmops-tags/continuous-integration) [continuous\_deployment](https://www.zenml.io/llmops-tags/continuous-deployment) [docker](https://www.zenml.io/llmops-tags/docker) [devops](https://www.zenml.io/llmops-tags/devops) [reliability](https://www.zenml.io/llmops-tags/reliability) [guardrails](https://www.zenml.io/llmops-tags/guardrails) [anthropic](https://www.zenml.io/llmops-tags/anthropic)

## Overview

Spotify has developed and deployed a sophisticated background coding agent system designed to perform automated code changes across thousands of software components at scale. This case study, published as Part 3 of a series in December 2025, focuses specifically on the LLMOps infrastructure required to make such agents produce predictable, reliable, and correct results in production without direct human supervision. The initiative stems from Spotify’s Fleet Management system and represents a mature approach to operationalizing LLM-powered coding agents for large-scale software maintenance.

The core challenge Spotify addresses is ensuring that autonomous coding agents can consistently generate correct code changes across a highly heterogeneous codebase comprising thousands of components. This is fundamentally an LLMOps problem: how to deploy LLM-based systems that operate reliably at scale in production environments where mistakes can have significant consequences.

## Problem Space and Failure Modes

Spotify identifies three primary failure modes when running agentic code changes at scale, each with different severity levels and operational implications:

The first failure mode occurs when the background agent fails to produce a pull request entirely. Spotify considers this a minor annoyance with acceptable tolerance, as the worst-case scenario simply requires manual intervention to perform the changes.

The second failure mode happens when the agent produces a PR that fails in continuous integration. This creates friction for engineers who must decide whether to invest time fixing partially completed work or abandoning the automated attempt. This failure mode represents a productivity drain and can erode confidence in the automation.

The third and most serious failure mode occurs when the agent produces a PR that passes CI but is functionally incorrect. This is particularly dangerous at scale because such changes are difficult to spot during code review when dealing with thousands of components, and if merged, can break production functionality. This failure mode poses the greatest risk to trust in the automation system.

These failures can stem from multiple root causes: insufficient test coverage in target components, agents making creative changes beyond the scope of their prompts, or agents struggling to properly execute builds and tests. The second and third failure modes also represent significant time sinks for engineers, as reviewing nonsensical or incorrect PRs is expensive.

## Solution Architecture: Verification Loops

To address these challenges, Spotify implemented what they call “verification loops” - a multi-layered feedback system that guides agents toward correct results before committing changes. This represents a thoughtful LLMOps pattern that recognizes the limitations and unpredictability of LLMs while providing structured guardrails.

The verification loop architecture consists of multiple independent verifiers that activate automatically based on the contents of the software component being modified. For example, a Maven verifier activates when it detects a pom.xml file in the codebase root. This automatic activation is a clever design choice that reduces the cognitive load on the agent while ensuring appropriate verification steps are applied.

A key architectural principle is that the agent doesn’t know what individual verifiers do or how they work - it only knows that it can (and sometimes must) call verification tools. This abstraction is exposed through the Model Context Protocol (MCP), which presents a unified verification interface to the agent while hiding the underlying complexity of different build systems, test frameworks, and validation logic.

The verification system provides two critical benefits for production LLM operations. First, it enables incremental feedback that guides the agent toward correct solutions through iterative refinement. Second, it abstracts away noise and complexity that would otherwise consume the agent’s context window. Rather than requiring the agent to understand the specifics of different build systems or parse complex test output, verifiers handle these tasks and return concise, actionable feedback. Spotify notes that their verifiers use regular expressions to extract only the most relevant error messages on failure while returning very short success messages otherwise - a practical implementation detail that optimizes context usage.

The verification loop can be triggered explicitly as a tool call by the agent, but Spotify also runs all relevant verifiers automatically before attempting to open a PR. When using Claude Code, they implement this through a “stop hook” - if any verifier fails at this stage, the PR isn’t opened and an error message is presented instead. This prevents premature PR creation and reduces noise in the development workflow.

## LLM-as-Judge Pattern

On top of the deterministic verifiers for syntax, building, and testing, Spotify added another protection layer: an LLM acting as a judge. This additional layer emerged from observed behavior where some agents were “too ambitious,” attempting to solve problems outside their prompt scope, such as refactoring code or disabling flaky tests.

The judge implementation is relatively straightforward but effective. It receives the diff of the proposed change along with the original prompt and sends both to an LLM for evaluation. The judge integrates into the standard verification loop and runs after all other verifiers have completed successfully. This sequencing is important - it ensures that only syntactically correct, buildable, tested code reaches the judge, making its evaluation task more focused.

The judge’s system prompt (shown in the article) guides the LLM to evaluate whether the proposed changes align with the original instructions and don’t introduce out-of-scope modifications. While Spotify acknowledges they haven’t yet invested in formal evaluations for the judge, they have internal metrics showing meaningful impact: across thousands of agent sessions, the judge vetoes approximately 25% of proposed changes. When vetoed, agents successfully course-correct about half the time. Empirically, the most common trigger for judge intervention is agents exceeding the scope outlined in their prompts.

This LLM-as-judge pattern represents a practical application of using one LLM to validate another’s output, though Spotify’s balanced presentation acknowledges the lack of rigorous evaluation. The 25% veto rate with 50% subsequent correction suggests the judge is catching real issues, but without formal evals, it’s difficult to assess false positive/negative rates or optimal calibration.

## Agent Design Philosophy: Focused and Sandboxed

Spotify’s approach to agent design emphasizes simplicity and constraint rather than flexibility. Their background coding agent is purpose-built to do one thing: accept a prompt and perform a code change to the best of its ability. The agent has deliberately limited access - it can see the relevant codebase, use tools to edit files, and execute verifiers as tools, but nothing more.

Many complex tasks are intentionally handled outside the agent itself. Operations like pushing code, interacting with users on Slack, and even authoring prompts are managed by surrounding infrastructure rather than exposed to the agent. Spotify explicitly states this is intentional, believing that reduced flexibility makes agents more predictable.

This design philosophy has secondary security benefits. The agent runs in a container with limited permissions, minimal binaries, and virtually no access to surrounding systems. It’s highly sandboxed, reducing the attack surface and blast radius of potential agent misbehavior or compromise.

This represents a mature LLMOps perspective that recognizes the value of constraint. Rather than building maximally capable agents with broad access, Spotify constrains agent capabilities to a specific, well-defined task and surrounds it with infrastructure that handles orchestration, communication, and other concerns. This separation of concerns improves both predictability and security.

## Production Results and Scale

Spotify’s system has generated over 1,500 merged pull requests across their codebase (mentioned in the series title and referenced content). The verification loop infrastructure has proven essential - Spotify explicitly states that without these feedback loops, agents often produce code that simply doesn’t work.

The quantitative metrics shared provide some insight into production performance:

- The judge layer vetoes approximately 25% of proposed changes
- Of vetoed changes, agents successfully course-correct about 50% of the time
- The system operates across thousands of software components
- The most common judge trigger is out-of-scope changes

While these metrics indicate meaningful filtering and correction, Spotify’s presentation is appropriately measured. They don’t claim perfection or provide detailed success rates for final merged PRs. The focus on failure modes and mitigation strategies suggests a realistic understanding that operating LLMs in production requires defensive design.

## Technical Stack and Tools

The case study reveals several specific technical choices:

Spotify uses Claude Code as their agent platform, leveraging its stop hook functionality for pre-PR verification. They expose tools to the agent using the Model Context Protocol (MCP), which provides a standardized interface for tool calling. The system includes verifiers for specific build systems like Maven, with automatic detection and activation based on project structure.

The infrastructure runs agents in containers with limited permissions on Linux x86 architecture (with plans to expand). The surrounding system integrates with GitHub for PR creation and Slack for user communication, though these integrations are deliberately kept outside the agent itself.

## Future Directions and Limitations

Spotify candidly outlines several areas for future development, which also reveal current limitations:

First, they plan to expand verifier infrastructure to support additional hardware and operating systems. Currently, verifiers only run on Linux x86, which serves backend and web infrastructure but doesn’t support iOS applications (which require macOS hosts) or ARM64 backend systems. This architectural constraint limits broader adoption across Spotify’s full technology stack.

Second, they aim to integrate the background agent more deeply with existing CI/CD pipelines, specifically by enabling it to act on CI checks in GitHub pull requests. They envision this as a complementary “outer loop” to the verifiers’ “inner loop,” adding another validation layer. This suggests the current system is somewhat separate from standard CI/CD workflows.

Third, and perhaps most importantly from an LLMOps maturity perspective, Spotify recognizes the need for more structured evaluations. They explicitly state they want to implement robust evals to systematically assess changes to system prompts, experiment with new agent architectures, and benchmark different LLM providers. The absence of formal evals is a notable gap in their current LLMOps practice, though their transparency about this limitation is commendable.

## LLMOps Maturity Assessment

This case study demonstrates several hallmarks of mature LLMOps practice while also revealing areas for growth:

**Strengths:**

- Production deployment at significant scale (thousands of components, 1,500+ PRs)
- Thoughtful failure mode analysis and mitigation strategies
- Multi-layered verification with both deterministic and LLM-based components
- Strong sandboxing and security considerations
- Separation of concerns between agent capabilities and orchestration infrastructure
- Iterative feedback loops that optimize context window usage
- Transparency about limitations and areas for improvement

**Areas for Development:**

- Lack of formal evaluation frameworks for system components
- Limited platform support (Linux x86 only currently)
- Incomplete CI/CD integration
- Absence of detailed success metrics or error analysis
- No discussion of monitoring, observability, or incident response for agent misbehavior
- Limited discussion of cost considerations or optimization

## Critical Perspective

While Spotify’s approach demonstrates thoughtful engineering, it’s important to maintain critical perspective on several aspects:

The verification loop pattern, while elegant, essentially builds deterministic scaffolding around LLM behavior to constrain it toward correct outcomes. This raises questions about the value proposition - much of the system’s reliability comes from traditional software engineering practices (building, testing, output parsing) rather than LLM capabilities per se. The LLM primarily handles the code generation task, with extensive guardrails ensuring correctness.

The LLM-as-judge pattern, while showing promising metrics (25% veto rate), lacks rigorous evaluation. Without understanding false positive and false negative rates, it’s difficult to assess whether the judge is optimally calibrated or whether it might be rejecting valid changes or accepting problematic ones at unknown rates.

The system’s scope is also somewhat limited - it handles specific, well-defined code changes across a codebase rather than open-ended software development. This is appropriate for the use case but represents a narrower application of coding agents than some hype might suggest.

Finally, the absence of cost discussion is notable. Running verification loops with builds, tests, and LLM judge evaluations across thousands of components likely incurs significant computational and API costs. The economic viability of this approach compared to manual or traditional automated approaches isn’t addressed.

## Conclusion

Spotify’s background coding agent system represents a pragmatic, production-oriented approach to LLMOps for code generation at scale. The emphasis on verification loops, constrained agent design, and defensive engineering reflects lessons learned from actual production deployment rather than theoretical considerations. The system has achieved meaningful scale and demonstrates that with appropriate guardrails, LLM-based coding agents can reliably perform bounded tasks across large codebases.

However, the case study also illustrates that reliable LLM operation in production requires substantial infrastructure investment, careful failure mode analysis, and defensive design patterns. The reliability comes not from the LLM alone but from the complete system that guides, verifies, and constrains LLM behavior. This is an important lesson for organizations considering similar deployments: production LLMOps success requires treating LLMs as probabilistic components within deterministic systems rather than autonomous intelligent agents.

## More Like This

[**Background Coding Agents with Strong Feedback Loops for Large-Scale Code Transformations**\\
Spotify·2025\\
\\
Spotify deployed background coding agents across thousands of software components to automate large-scale code transformations and maintenance tasks, addressing the challenge of ensuring correctness and reliability when agents operate without direct human supervision. The solution centered on implementing strong verification loops consisting of deterministic verifiers (for syntax, building, and testing) and an LLM-as-a-judge component to prevent scope creep. The system successfully generated over 1,500 merged pull requests, with the judge component catching roughly a quarter of problematic changes and enabling course correction in half of those cases, demonstrating that verification loops are essential for predictable agent behavior at scale.\\
\\
code\_generation  poc  prompt\_engineering \\
+16](https://www.zenml.io/llmops-database/background-coding-agents-with-strong-feedback-loops-for-large-scale-code-transformations) [**Building a Software Factory with AI Agents at Scale**\\
Cursor·2026\\
\\
Cursor, a developer tool company, shares their journey of building what they call a "software factory" where AI agents handle increasingly autonomous software development tasks. The presentation outlines how they progressed through levels of autonomy from basic autocomplete to spawning hundreds of agents working asynchronously across their codebase. Their solution involves establishing guardrails through rules that emerge dynamically, creating verifiable systems with automated testing, and building skills and integrations that enable agents to work independently. Results include engineers managing fleets of agents rather than writing code directly, with some features being developed entirely by agents from feature flagging through testing to deployment, though significant work remains in observability, orchestration, and preventing agents from going off-track.\\
\\
code\_generation  code\_interpretation  chatbot \\
+37](https://www.zenml.io/llmops-database/building-a-software-factory-with-ai-agents-at-scale) [**Building an Autonomous Software Factory for Notion-like Application Development**\\
Software Factory·2026\\
\\
Software Factory demonstrates a fully automated software development lifecycle where AI agents autonomously build, test, review, and deploy a Notion-like collaborative editing application called Memo over a two-week period. The project showcases how agents can handle the complete SDLC from planning through operations, achieving 88% of pull requests completed without human intervention. The system leverages multiple specialized automations running on scheduled triggers to handle different stages of development, integrating GitHub as the state engine and using observability tools like Sentry for automated incident response and bug fixing.\\
\\
code\_generation  poc  code\_interpretation \\
+26](https://www.zenml.io/llmops-database/building-an-autonomous-software-factory-for-notion-like-application-development)

[![ZenML](https://www.zenml.io/images/zenml-logo.svg)](https://www.zenml.io/)

The single layer for ML and AI workloads.

[LinkedIn](https://www.linkedin.com/company/zenml)[X (Twitter)](https://twitter.com/zenml_io)[Slack](https://www.zenml.io/slack-invite)[YouTube](https://www.youtube.com/@ZenML)

![Linux Foundation Member](https://www.zenml.io/images/lf-member.svg)![CNCF Member](https://www.zenml.io/images/cncf-member.svg)

Product

- [ZenML](https://www.zenml.io/product/zenml)
- [Kitaru](https://www.zenml.io/product/kitaru)
- [ZenML Pro  New](https://www.zenml.io/pro)
- [Pricing](https://www.zenml.io/pricing)

Compare & deploy

- [All comparisons](https://www.zenml.io/compare)
- [Open Source vs Pro](https://www.zenml.io/open-source-vs-pro)
- [Deployment scenarios](https://www.zenml.io/deployments)
- [Integrations](https://www.zenml.io/integrations)

Resources

- [Blog](https://www.zenml.io/blog)
- [Docs](https://docs.zenml.io/getting-started/introduction)
- [Changelog](https://docs.zenml.io/changelog)
- [LLMOps Database](https://www.zenml.io/llmops-database)
- [Customer stories](https://www.zenml.io/case-studies)

Company

- [Careers](https://www.zenml.io/careers)
- [About](https://www.zenml.io/company)
- [Newsletter](https://www.zenml.io/newsletter-signup)
- [Community Slack](https://www.zenml.io/slack)

© 2026 ZenML. All rights reserved.

[Imprint](https://www.zenml.io/imprint) \| [Privacy Policy](https://www.zenml.io/privacy-policy) \| [Terms of Service](https://www.zenml.io/terms-of-service) \| [Status](https://status.zenml.io/)

We use cookies to improve your experience and analyze site traffic. See our [privacy policy](https://www.zenml.io/privacy-policy).

ManageReject allAccept all
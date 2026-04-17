export interface WorkNextPromptInput {
  plan: string;
  recentWorklog?: string;
  skill?: string;
}

export function buildWorkNextPrompt(input: WorkNextPromptInput): string {
  const { plan, recentWorklog, skill } = input;

  if (!plan.trim()) {
    return "No plan found at _notes/plan.md.";
  }

  return [
    "## /work:next — Execute TODOs continuously",
    "",
    "Execute TODOs in order without pausing for commit approval.",
    "",
    skill ? "### Skill: work-implement\n" + skill : "",
    "",
    "### Plan",
    "```markdown",
    plan,
    "```",
    "",
    recentWorklog ? `### Recent progress\n\`\`\`\n${recentWorklog}\n\`\`\`\n` : "",
    "Read `_notes/plan.md`, find the first unchecked `- [ ]` TODO, and execute it.",
    "After each TODO: run tests, commit, check off TODO, log to worklog, and call work_compact.",
    "Do NOT ask for commit approval even if approveCommits is enabled.",
    "After committing one TODO, immediately continue to the next unchecked TODO.",
    "When all TODOs are checked off, notify the user and stop. Use /work:abandon to end the flow.",
  ].filter(Boolean).join("\n");
}

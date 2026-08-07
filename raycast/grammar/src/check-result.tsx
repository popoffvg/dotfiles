import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { CheckResult, logPath } from "./grammar";

// Newlines survive only inside a fence, and the fence must be longer than any
// backtick run in the text itself.
function fenced(text: string): string {
  const longestRun = [...text.matchAll(/`+/g)].reduce((max, match) => Math.max(max, match[0].length), 0);
  const fence = "`".repeat(Math.max(3, longestRun + 1));
  return `${fence}\n${text}\n${fence}`;
}

function markdown(result: CheckResult): string {
  const parts = [`## Corrected`, fenced(result.corrected)];

  if (result.fixes.length === 0) {
    parts.push(`## Fixes`, `No grammar mistakes found.`);
    return parts.join("\n\n");
  }

  parts.push(
    `## Fixes`,
    result.fixes
      .map((fix) => (fix.explanation ? `- **${fix.slug}** — ${fix.explanation}` : `- **${fix.slug}**`))
      .join("\n"),
  );
  return parts.join("\n\n");
}

export function CheckResultView({ result }: { result: CheckResult }) {
  const topicList = result.fixes.map((fix) => fix.slug).join(", ");

  return (
    <Detail
      navigationTitle="Grammar Result"
      markdown={markdown(result)}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Fixes" text={String(result.fixes.length)} />
          {result.fixes.length > 0 && (
            <Detail.Metadata.TagList title="Topics">
              {result.fixes.map((fix) => (
                <Detail.Metadata.TagList.Item key={fix.slug} text={fix.slug} />
              ))}
            </Detail.Metadata.TagList>
          )}
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Topic Log" text={logPath()} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.CopyToClipboard title="Copy Corrected Text" content={result.corrected} />
          <Action.Paste title="Paste Corrected Text" content={result.corrected} />
          {topicList.length > 0 && (
            <Action.CopyToClipboard
              title="Copy Fix Topics"
              content={topicList}
              icon={Icon.Tag}
              shortcut={{ modifiers: ["cmd", "shift"], key: "t" }}
            />
          )}
          <Action.CopyToClipboard title="Copy Raw Model Output" content={result.raw} icon={Icon.Terminal} />
        </ActionPanel>
      }
    />
  );
}

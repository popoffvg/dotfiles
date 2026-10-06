import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { useEffect, useState } from "react";
import { fenced } from "./fenced";
import type { LanguageToolResult } from "./languagetool";
import { pasteIntoFrontApp } from "./paste-into-front-app";
import { polishText } from "./polish";
import { languagesPreferences } from "./preferences";

function markdown(
  result: LanguageToolResult,
  polished: string | undefined,
  polishError: string | undefined,
): string {
  const parts = [`## Corrected`, fenced(result.corrected)];
  parts.push(
    `## Polished`,
    polishError
      ? `Polish failed: ${polishError}`
      : polished
        ? fenced(polished)
        : "Polishing…",
  );
  return parts.join("\n\n");
}

export function CheckResultView({
  result,
  savedPath,
}: {
  result: LanguageToolResult;
  savedPath?: string;
}) {
  const [polished, setPolished] = useState<string>();
  const [polishError, setPolishError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    polishText(result.corrected)
      .then((text) => !cancelled && setPolished(text))
      .catch(
        (failure) =>
          !cancelled &&
          setPolishError(
            failure instanceof Error ? failure.message : String(failure),
          ),
      );
    return () => {
      cancelled = true;
    };
  }, [result.corrected]);

  const categories = [
    ...new Set(result.mistakes.map((mistake) => mistake.category)),
  ];

  return (
    <Detail
      navigationTitle="Grammar Result"
      isLoading={polished === undefined && polishError === undefined}
      markdown={markdown(result, polished, polishError)}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label
            title="Mistakes"
            text={String(result.mistakes.length)}
          />
          {categories.length > 0 && (
            <Detail.Metadata.TagList title="Categories">
              {categories.map((category) => (
                <Detail.Metadata.TagList.Item key={category} text={category} />
              ))}
            </Detail.Metadata.TagList>
          )}
          {result.mistakes.map((mistake, index) => (
            <Detail.Metadata.Label
              key={index}
              title={`${mistake.wrong} → ${mistake.fix}`}
              text={mistake.ruleDescription}
            />
          ))}
          <Detail.Metadata.Separator />
          <Detail.Metadata.Label title="Saved To" text={savedPath ?? "—"} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action
            title="Paste Corrected Text"
            icon={Icon.Clipboard}
            onAction={async () => {
              await pasteIntoFrontApp(result.corrected);
            }}
          />
          <Action.CopyToClipboard
            title="Copy Corrected Text"
            content={result.corrected}
          />
          {polished && (
            <>
              <Action.CopyToClipboard
                title="Copy Polished Text"
                content={polished}
                icon={Icon.Wand}
                shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
              />
              <Action
                title="Paste Polished Text"
                icon={Icon.Wand}
                shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
                onAction={async () => {
                  await pasteIntoFrontApp(polished);
                }}
              />
            </>
          )}
          {savedPath && (
            <Action.Open
              title="Open Saved Check"
              target={savedPath}
              icon={Icon.Document}
              shortcut={{ modifiers: ["cmd"], key: "o" }}
            />
          )}
          <Action.ShowInFinder
            title="Show Inbox in Finder"
            path={languagesPreferences().inboxDir}
          />
        </ActionPanel>
      }
    />
  );
}

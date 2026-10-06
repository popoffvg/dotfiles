import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { fenced } from "./fenced";
import { pasteIntoFrontApp } from "./paste-into-front-app";
import type { VocabPair } from "./vocab";

export function TranslateResultView({ pair }: { pair: VocabPair }) {
  const markdown = [
    "## English",
    fenced(pair.en),
    "## Russian",
    fenced(pair.ru),
  ].join("\n\n");

  return (
    <Detail
      navigationTitle="Translation"
      markdown={markdown}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label
            title="Vocab"
            text={pair.dup ? "Already in the file" : "Added"}
          />
          <Detail.Metadata.Label title="Saved To" text={pair.path} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action
            title="Paste English"
            icon={Icon.Clipboard}
            onAction={async () => {
              await pasteIntoFrontApp(pair.en);
            }}
          />
          <Action.CopyToClipboard title="Copy English" content={pair.en} />
          <Action
            title="Paste Russian"
            icon={Icon.Clipboard}
            shortcut={{ modifiers: ["cmd", "shift"], key: "v" }}
            onAction={async () => {
              await pasteIntoFrontApp(pair.ru);
            }}
          />
          <Action.CopyToClipboard
            title="Copy Russian"
            content={pair.ru}
            shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
          />
          <Action.Open
            title="Open Vocab File"
            target={pair.path}
            icon={Icon.Document}
            shortcut={{ modifiers: ["cmd"], key: "o" }}
          />
        </ActionPanel>
      }
    />
  );
}

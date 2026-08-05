import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useMemo, useState } from "react";
import { collectTopics, logPath, readFixLog } from "./grammar";

export default function GrammarTopicsCommand() {
  const [reloadKey, setReloadKey] = useState(0);
  const topics = useMemo(() => collectTopics(), [reloadKey]);
  const total = useMemo(() => readFixLog().length, [reloadKey]);

  return (
    <List
      navigationTitle="Grammar Fix Topics"
      searchBarPlaceholder="Filter topics"
      isShowingDetail={false}
    >
      {topics.length === 0 ? (
        <List.EmptyView
          icon={Icon.Text}
          title="No fixes logged yet"
          description={`Run Check Grammar first. Log: ${logPath()}`}
        />
      ) : (
        <List.Section title={`${topics.length} topics · ${total} fixes`}>
          {topics.map((topic) => (
            <List.Item
              key={topic.slug}
              icon={Icon.Tag}
              title={topic.slug}
              subtitle={topic.lastExplanation}
              accessories={[{ text: `×${topic.count}` }, { text: topic.lastDate }]}
              actions={
                <ActionPanel>
                  <Action.CopyToClipboard title="Copy Topic" content={topic.slug} />
                  <Action.CopyToClipboard
                    title="Copy Last Example"
                    content={topic.lastExplanation}
                    icon={Icon.Clipboard}
                  />
                  <Action.Open title="Open Topic Log" target={logPath()} icon={Icon.Document} />
                  <Action
                    title="Reload"
                    icon={Icon.ArrowClockwise}
                    shortcut={{ modifiers: ["cmd"], key: "r" }}
                    onAction={() => setReloadKey((key) => key + 1)}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}
    </List>
  );
}

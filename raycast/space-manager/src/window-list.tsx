import { List, Action, ActionPanel, Icon, closeMainWindow, popToRoot } from "@raycast/api";
import { usePromise } from "@raycast/utils";
import { listWindowsForSpace, focusWindow, gotoSpace, Window } from "./hammerspoon";
import { useRef, useCallback } from "react";

interface Props {
  spaceID: number;
  spaceName: string;
  isActive: boolean;
}

export function WindowList({ spaceID, spaceName, isActive }: Props) {
  const switched = useRef(false);

  const loadWindows = useCallback(async (sid: number) => {
    if (!isActive && !switched.current) {
      gotoSpace(sid);
      switched.current = true;
      await new Promise((r) => setTimeout(r, 800));
    }
    return listWindowsForSpace(sid);
  }, [isActive]);

  const { data: windows, isLoading } = usePromise(loadWindows, [spaceID]);

  const handleFocus = async (win: Window) => {
    popToRoot();
    await closeMainWindow();
    focusWindow(win.id);
  };

  return (
    <List isLoading={isLoading} navigationTitle={spaceName} searchBarPlaceholder="Search windows...">
      {windows?.map((win) => (
        <List.Item
          key={win.id}
          title={win.title || "(untitled)"}
          subtitle={win.app}
          icon={{ fileIcon: `/Applications/${win.app}.app` }}
          actions={
            <ActionPanel>
              <Action title="Focus Window" icon={Icon.Eye} onAction={() => handleFocus(win)} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

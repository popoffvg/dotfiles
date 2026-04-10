import { List, Action, ActionPanel, showToast, Toast, Icon, Color, closeMainWindow, LocalStorage } from "@raycast/api";
import { useState, useCallback, useEffect } from "react";
import { usePromise } from "@raycast/utils";
import { listSpaces, gotoSpace, removeSpace, createSpace, Space } from "./hammerspoon";
import { RenameForm } from "./rename-form";

const ALL_SCREENS_KEY = "allScreens";

export default function ListSpacesCommand() {
  const [renaming, setRenaming] = useState<Space | null>(null);
  const [allScreens, setAllScreens] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    LocalStorage.getItem<boolean>(ALL_SCREENS_KEY).then((val) => {
      if (val !== undefined) setAllScreens(val);
      setLoaded(true);
    });
  }, []);

  const { data: spaces, isLoading, revalidate } = usePromise(listSpaces, [allScreens], { execute: loaded });

  const handleSwitch = useCallback(async (space: Space) => {
    try {
      await closeMainWindow();
      gotoSpace(space.id);
      revalidate();
    } catch {
      await showToast({ style: Toast.Style.Failure, title: "Failed to switch" });
    }
  }, [revalidate]);

  const handleDelete = useCallback(async (space: Space) => {
    try {
      removeSpace(space.id);
      await showToast({ style: Toast.Style.Success, title: `Removed ${space.name}` });
      revalidate();
    } catch {
      await showToast({ style: Toast.Style.Failure, title: "Failed to remove" });
    }
  }, [revalidate]);

  const handleCreate = useCallback(async () => {
    try {
      createSpace();
      await showToast({ style: Toast.Style.Success, title: "Space created" });
      revalidate();
    } catch {
      await showToast({ style: Toast.Style.Failure, title: "Failed to create" });
    }
  }, [revalidate]);

  const toggleScreens = useCallback(() => {
    setAllScreens((prev) => {
      const next = !prev;
      LocalStorage.setItem(ALL_SCREENS_KEY, next);
      return next;
    });
  }, []);

  if (renaming) {
    return (
      <RenameForm
        space={renaming}
        onDone={() => {
          setRenaming(null);
          revalidate();
        }}
      />
    );
  }

  // Group spaces by screen when showing all
  const screens = new Map<string, Space[]>();
  for (const space of spaces ?? []) {
    const list = screens.get(space.screen) ?? [];
    list.push(space);
    screens.set(space.screen, list);
  }

  const renderItem = (space: Space) => (
    <List.Item
      key={space.id}
      title={space.name}
      subtitle={space.type === "user" ? `Space ${space.index}` : "Fullscreen"}
      icon={space.active
        ? { source: Icon.CircleFilled, tintColor: Color.Green }
        : space.type === "fullscreen"
          ? { source: Icon.AppWindowGrid2x2, tintColor: Color.SecondaryText }
          : { source: Icon.Circle, tintColor: Color.SecondaryText }
      }
      accessories={[
        ...(space.index <= 9 ? [{ text: `⌃${space.index}` }] : []),
        ...(space.active ? [{ tag: { value: "active", color: Color.Green } }] : []),
      ]}
      actions={
        <ActionPanel>
          <Action title="Switch to Space" icon={Icon.ArrowRight} onAction={() => handleSwitch(space)} />
          {space.type === "user" && (
            <Action title="Rename" icon={Icon.Pencil} shortcut={{ modifiers: ["cmd"], key: "r" }} onAction={() => setRenaming(space)} />
          )}
          <Action
            title={allScreens ? "Current Screen Only" : "All Screens"}
            icon={Icon.Monitor}
            shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
            onAction={toggleScreens}
          />
          <Action title="Create New Space" icon={Icon.Plus} shortcut={{ modifiers: ["cmd"], key: "n" }} onAction={handleCreate} />
          <Action title="Refresh" icon={Icon.ArrowClockwise} shortcut={{ modifiers: ["cmd"], key: "e" }} onAction={revalidate} />
          {space.type === "user" && (
            <Action
              title="Delete Space"
              icon={Icon.Trash}
              style={Action.Style.Destructive}
              shortcut={{ modifiers: ["ctrl"], key: "x" }}
              onAction={() => handleDelete(space)}
            />
          )}
        </ActionPanel>
      }
    />
  );

  return (
    <List isLoading={isLoading} searchBarPlaceholder="Search spaces...">
      {allScreens
        ? Array.from(screens.entries()).map(([screenName, screenSpaces]) => (
            <List.Section key={screenName} title={screenName}>
              {screenSpaces.map(renderItem)}
            </List.Section>
          ))
        : spaces?.map(renderItem)
      }
    </List>
  );
}

import {
  List,
  Action,
  ActionPanel,
  Form,
  showToast,
  Toast,
  Icon,
  Color,
  closeMainWindow,
  popToRoot,
  LocalStorage,
} from "@raycast/api";
import { useState, useCallback, useEffect, useMemo } from "react";
import { readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { usePromise } from "@raycast/utils";
import {
  listSpaces,
  gotoSpace,
  removeSpace,
  createSpace,
  renameSpace,
  Space,
  createCodeSpace,
  syncCmuxForSpace,
} from "./hammerspoon";
import { RenameForm } from "./rename-form";
import { WindowList } from "./window-list";

const ALL_SCREENS_KEY = "allScreens";

function listFolderOptions(): string[] {
  const roots = [process.cwd(), join(homedir(), "Documents", "git")];
  const out = new Set<string>();

  for (const root of roots) {
    out.add(root);
    try {
      const entries = readdirSync(root, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) out.add(join(root, entry.name));
      }
    } catch {
      // ignore unavailable roots
    }
  }

  return Array.from(out).sort((a, b) => a.localeCompare(b));
}

function subsystemFromErrorCode(code?: string): string {
  switch (code) {
    case "vscode":
      return "VS Code";
    case "chrome":
      return "Chrome";
    case "tmux":
      return "tmux";
    case "cmux":
      return "cmux";
    case "space":
      return "Space";
    default:
      return "Unknown subsystem";
  }
}

export default function ListSpacesCommand() {
  const [renaming, setRenaming] = useState<Space | null>(null);
  const [creating, setCreating] = useState(false);
  const [creatingCodeSpace, setCreatingCodeSpace] = useState(false);
  const [allScreens, setAllScreens] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const folderOptions = useMemo(() => listFolderOptions(), []);

  useEffect(() => {
    LocalStorage.getItem<boolean>(ALL_SCREENS_KEY).then((val) => {
      if (val !== undefined) setAllScreens(val);
      setLoaded(true);
    });
  }, []);

  const {
    data: spaces,
    isLoading,
    revalidate,
  } = usePromise(listSpaces, [allScreens], { execute: loaded });

  const handleSwitch = useCallback(async (space: Space) => {
    try {
      popToRoot();
      await closeMainWindow();
      gotoSpace(space.id);

      const cmuxResults = syncCmuxForSpace(space.id);
      const cmuxFailure = cmuxResults.find((r) => !r.ok);
      if (cmuxFailure) {
        await showToast({
          style: Toast.Style.Failure,
          title: `${subsystemFromErrorCode(cmuxFailure.errorCode)} sync failed`,
          message: cmuxFailure.detail,
        });
      }
    } catch {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to switch",
      });
    }
  }, []);

  const handleDelete = useCallback(
    async (space: Space) => {
      try {
        removeSpace(space.id);
        await showToast({
          style: Toast.Style.Success,
          title: `Removed ${space.name}`,
        });
        revalidate();
      } catch {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to remove",
        });
      }
    },
    [revalidate],
  );

  const handleCreateSubmit = useCallback(async (values: { name: string }) => {
    try {
      const newID = createSpace();
      if (values.name.trim()) {
        renameSpace(newID, values.name.trim());
      }
      await showToast({
        style: Toast.Style.Success,
        title: `Created: ${values.name.trim() || "Unnamed"}`,
      });
      setCreating(false);
      await closeMainWindow();
      gotoSpace(newID);
    } catch {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to create space",
      });
    }
  }, []);

  const handleCreateCodeSpaceSubmit = useCallback(
    async (values: { name: string; codePath?: string }) => {
      const name = values.name.trim();
      const codePath = values.codePath?.trim();
      if (!name) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Space name is required",
        });
        return;
      }

      if (!codePath) {
        await showToast({
          style: Toast.Style.Failure,
          title: "VS Code path is required",
        });
        return;
      }

      try {
        const result = createCodeSpace(name, codePath);
        setCreatingCodeSpace(false);
        await closeMainWindow();
        gotoSpace(result.spaceID);

        const failed = result.stepResults.filter((s) => !s.ok);
        if (failed.length === 0) {
          await showToast({
            style: Toast.Style.Success,
            title: `Code space created: ${name}`,
          });
        } else {
          const first = failed[0];
          await showToast({
            style: Toast.Style.Failure,
            title: `${subsystemFromErrorCode(first?.errorCode)} setup failed`,
            message: first?.detail,
          });
        }

        revalidate();
      } catch (error) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to create code space",
          message: String(error),
        });
      }
    },
    [revalidate],
  );

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

  if (creating) {
    return (
      <Form
        navigationTitle="Create Space"
        actions={
          <ActionPanel>
            <Action.SubmitForm title="Create" onSubmit={handleCreateSubmit} />
          </ActionPanel>
        }
      >
        <Form.TextField
          id="name"
          title="Space Name"
          placeholder="e.g. Work, Personal, Music"
          autoFocus
        />
      </Form>
    );
  }

  if (creatingCodeSpace) {
    return (
      <Form
        navigationTitle="Create Code Space"
        actions={
          <ActionPanel>
            <Action.SubmitForm
              title="Create Code Space"
              onSubmit={handleCreateCodeSpaceSubmit}
            />
          </ActionPanel>
        }
      >
        <Form.TextField
          id="name"
          title="Space Name"
          placeholder="e.g. feature-auth, client-bugfix"
          autoFocus
        />
        <Form.Dropdown id="codePath" title="VS Code Folder" defaultValue={process.cwd()}>
          {folderOptions.map((path) => (
            <Form.Dropdown.Item key={path} value={path} title={path} />
          ))}
        </Form.Dropdown>
      </Form>
    );
  }

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
      icon={
        space.active
          ? { source: Icon.CircleFilled, tintColor: Color.Green }
          : space.type === "fullscreen"
            ? { source: Icon.AppWindowGrid2x2, tintColor: Color.SecondaryText }
            : { source: Icon.Circle, tintColor: Color.SecondaryText }
      }
      accessories={[
        { text: "⌘O switch" },
        ...(space.index <= 9 ? [{ text: `⌃${space.index}` }] : []),
        ...(space.active
          ? [{ tag: { value: "active", color: Color.Green } }]
          : []),
      ]}
      actions={
        <ActionPanel>
          <Action.Push
            title="Show Windows"
            icon={Icon.AppWindowList}
            target={
              <WindowList
                spaceID={space.id}
                spaceName={space.name}
                isActive={space.active}
              />
            }
          />
          <Action
            title="Switch to Space"
            icon={Icon.ArrowRight}
            shortcut={{ modifiers: ["cmd"], key: "o" }}
            onAction={() => handleSwitch(space)}
          />

          {space.type === "user" && (
            <Action
              title="Rename"
              icon={Icon.Pencil}
              shortcut={{ modifiers: ["cmd"], key: "r" }}
              onAction={() => setRenaming(space)}
            />
          )}
          <Action
            title={allScreens ? "Current Screen Only" : "All Screens"}
            icon={Icon.Monitor}
            shortcut={{ modifiers: ["cmd", "shift"], key: "a" }}
            onAction={toggleScreens}
          />
          <Action
            title="Create New Space"
            icon={Icon.Plus}
            shortcut={{ modifiers: ["cmd"], key: "n" }}
            onAction={() => setCreating(true)}
          />
          <Action
            title="Create Code Space"
            icon={Icon.Code}
            shortcut={{ modifiers: ["cmd", "shift"], key: "n" }}
            onAction={() => setCreatingCodeSpace(true)}
          />
          <Action
            title="Refresh"
            icon={Icon.ArrowClockwise}
            shortcut={{ modifiers: ["cmd"], key: "e" }}
            onAction={revalidate}
          />
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
        : spaces?.map(renderItem)}
    </List>
  );
}

import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const HS_PATH = "/opt/homebrew/bin/hs";
const NAMES_DIR = join(homedir(), ".config", "hammerspoon");
const NAMES_FILE = join(NAMES_DIR, "space_names.json");

export type SpaceType = "user" | "fullscreen";

export interface Space {
  index: number;
  id: number;
  name: string;
  active: boolean;
  type: SpaceType;
  screen: string;
}

export interface StepResult {
  step: string;
  ok: boolean;
  errorCode?: "vscode" | "chrome" | "tmux" | "cmux" | "space";
  detail?: string;
}

export interface CodeSpaceResult {
  spaceID: number;
  workspaceName: string;
  stepResults: StepResult[];
}

function hs(lua: string): string {
  return execSync(`${HS_PATH} -c '${lua.replace(/'/g, "'\\''")}'`, {
    encoding: "utf-8",
    timeout: 10000,
  }).trim();
}

function run(command: string, timeout = 10000): string {
  return execSync(command, {
    encoding: "utf-8",
    timeout,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function loadNames(): Record<string, string> {
  try {
    return JSON.parse(readFileSync(NAMES_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveNames(names: Record<string, string>) {
  mkdirSync(NAMES_DIR, { recursive: true });
  writeFileSync(NAMES_FILE, JSON.stringify(names, null, 2));
}

export function normalizeWorkspaceName(
  name: string,
  fallbackID?: number,
): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");

  if (normalized.length > 0) return normalized;
  return fallbackID ? `space-${fallbackID}` : "space-work";
}

function escapeShellArg(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function ensureTmuxSession(sessionName: string): void {
  const target = escapeShellArg(sessionName);
  run(
    `/opt/homebrew/bin/tmux has-session -t ${target} 2>/dev/null || /opt/homebrew/bin/tmux new-session -d -s ${target}`,
  );
}

interface CmuxWorkspace {
  ref: string;
  title: string;
}

function listCmuxWorkspaces(): CmuxWorkspace[] {
  const raw = run("cmux list-workspaces --json", 15000);
  const parsed = JSON.parse(raw) as {
    workspaces?: Array<{ ref?: string; title?: string }>;
  };
  return (parsed.workspaces ?? [])
    .filter((w) => typeof w.ref === "string")
    .map((w) => ({ ref: w.ref!, title: w.title ?? "" }));
}

function findCmuxWorkspaceByTitle(title: string): CmuxWorkspace | undefined {
  const normalizedTitle = normalizeWorkspaceName(title);
  const workspaces = listCmuxWorkspaces();
  return workspaces.find(
    (w) => normalizeWorkspaceName(w.title) === normalizedTitle,
  );
}

function ensureCmuxWorkspace(title: string, cwd: string): string {
  run(`cmux ${escapeShellArg(cwd)}`, 15000);

  const existing = findCmuxWorkspaceByTitle(title);
  if (existing) {
    run(`cmux select-workspace --workspace ${escapeShellArg(existing.ref)}`);
    return existing.ref;
  }

  const created = run(`cmux new-workspace --cwd ${escapeShellArg(cwd)}`);
  const refMatch = created.match(/workspace:\d+/);
  const createdRef = refMatch?.[0] ?? "";

  if (createdRef) {
    run(
      `cmux rename-workspace --workspace ${escapeShellArg(createdRef)} ${escapeShellArg(title)}`,
    );
    run(`cmux select-workspace --workspace ${escapeShellArg(createdRef)}`);
    return createdRef;
  }

  const afterCreate = findCmuxWorkspaceByTitle(title);
  if (!afterCreate)
    throw new Error("Could not resolve newly created cmux workspace");
  run(`cmux select-workspace --workspace ${escapeShellArg(afterCreate.ref)}`);
  return afterCreate.ref;
}

export function openVSCodeNewWindow(cwd: string): void {
  run(`code -n ${escapeShellArg(cwd)}`);
}

export function openChromeNewWindow(): void {
  run(`open -na 'Google Chrome' --args --new-window about:blank`);
}

export function createCodeSpace(
  spaceName: string,
  cwd = process.cwd(),
): CodeSpaceResult {
  const stepResults: StepResult[] = [];

  let spaceID: number;
  try {
    spaceID = createSpace();
    stepResults.push({ step: "create-space", ok: true });
  } catch (error) {
    stepResults.push({
      step: "create-space",
      ok: false,
      errorCode: "space",
      detail: String(error),
    });
    throw new Error("Failed to create macOS space");
  }

  const workspaceName = normalizeWorkspaceName(spaceName, spaceID);

  try {
    renameSpace(spaceID, spaceName.trim() || workspaceName);
    stepResults.push({ step: "rename-space", ok: true });
  } catch (error) {
    stepResults.push({
      step: "rename-space",
      ok: false,
      errorCode: "space",
      detail: String(error),
    });
  }

  try {
    openVSCodeNewWindow(cwd);
    stepResults.push({ step: "open-vscode", ok: true });
  } catch (error) {
    stepResults.push({
      step: "open-vscode",
      ok: false,
      errorCode: "vscode",
      detail: String(error),
    });
  }

  try {
    openChromeNewWindow();
    stepResults.push({ step: "open-chrome", ok: true });
  } catch (error) {
    stepResults.push({
      step: "open-chrome",
      ok: false,
      errorCode: "chrome",
      detail: String(error),
    });
  }

  try {
    ensureTmuxSession(workspaceName);
    stepResults.push({ step: "ensure-tmux", ok: true });
  } catch (error) {
    stepResults.push({
      step: "ensure-tmux",
      ok: false,
      errorCode: "tmux",
      detail: String(error),
    });
  }

  try {
    ensureCmuxWorkspace(workspaceName, cwd);
    stepResults.push({ step: "ensure-cmux", ok: true });
  } catch (error) {
    stepResults.push({
      step: "ensure-cmux",
      ok: false,
      errorCode: "cmux",
      detail: String(error),
    });
  }

  return { spaceID, workspaceName, stepResults };
}

export function syncCmuxForSpace(
  spaceID: number,
  cwd = process.cwd(),
): StepResult[] {
  const stepResults: StepResult[] = [];
  const spaceName = getSpaceName(spaceID);
  const workspaceName = normalizeWorkspaceName(
    spaceName || `space-${spaceID}`,
    spaceID,
  );

  try {
    ensureCmuxWorkspace(workspaceName, cwd);
    stepResults.push({ step: "sync-cmux", ok: true });
  } catch (error) {
    stepResults.push({
      step: "sync-cmux",
      ok: false,
      errorCode: "cmux",
      detail: String(error),
    });
  }

  return stepResults;
}

export async function listSpaces(allScreens = false): Promise<Space[]> {
  const mode = allScreens ? "all" : "current";
  const raw = hs(`
    local focused = hs.spaces.focusedSpace()
    local mode = "${mode}"
    local result = {}
    if mode == "all" then
      for _, screen in ipairs(hs.screen.allScreens()) do
        local screenName = screen:name()
        local spaces = hs.spaces.spacesForScreen(screen)
        local active = hs.spaces.activeSpaceOnScreen(screen)
        for i, id in ipairs(spaces) do
          local t = hs.spaces.spaceType(id)
          table.insert(result, { index = i, id = id, active = (id == active), type = t, screen = screenName })
        end
      end
    else
      local allSpaces = hs.spaces.allSpaces()
      local targetScreen = nil
      for uuid, list in pairs(allSpaces) do
        for _, id in ipairs(list) do
          if id == focused then
            targetScreen = hs.screen.find(uuid)
            break
          end
        end
        if targetScreen then break end
      end
      if not targetScreen then targetScreen = hs.screen.mainScreen() end
      local screenName = targetScreen:name()
      local spaces = hs.spaces.spacesForScreen(targetScreen)
      for i, id in ipairs(spaces) do
        local t = hs.spaces.spaceType(id)
        table.insert(result, { index = i, id = id, active = (id == focused), type = t, screen = screenName })
      end
    end
    print(hs.json.encode(result))
  `);
  const spaces: {
    index: number;
    id: number;
    active: boolean;
    type: string;
    screen: string;
  }[] = JSON.parse(raw);
  const names = loadNames();
  return spaces.map((s) => ({
    ...s,
    type: s.type === "user" ? ("user" as const) : ("fullscreen" as const),
    name:
      names[String(s.id)] ||
      (s.type === "user" ? `Desktop ${s.index}` : "Fullscreen"),
  }));
}

export function gotoSpace(spaceID: number) {
  hs(`
    local focused = hs.spaces.focusedSpace()
    local targetScreen, focusedScreen = nil, nil
    for _, screen in ipairs(hs.screen.allScreens()) do
      for _, id in ipairs(hs.spaces.spacesForScreen(screen)) do
        if id == ${spaceID} then targetScreen = screen end
        if id == focused then focusedScreen = screen end
      end
    end
    local crossScreen = targetScreen and focusedScreen and targetScreen:getUUID() ~= focusedScreen:getUUID()
    hs.spaces.gotoSpace(${spaceID})
    if crossScreen then
      hs.timer.doAfter(0.7, function()
        local f = targetScreen:frame()
        hs.eventtap.leftClick(hs.geometry.point(f.x + f.w / 2, f.y + f.h / 2))
      end)
    end
  `);
}

export function createSpace(): number {
  const raw = hs(`
    local win = hs.window.frontmostWindow()
    local screen = win and win:screen() or hs.screen.mainScreen()
    hs.spaces.addSpaceToScreen(screen, true)
    local spaces = hs.spaces.spacesForScreen(screen)
    print(spaces[#spaces])
  `);
  return parseInt(raw, 10);
}

export function removeSpace(spaceID: number) {
  hs(`hs.spaces.removeSpace(${spaceID}, true)`);
}

export function renameSpace(spaceID: number, name: string) {
  const names = loadNames();
  names[String(spaceID)] = name;
  saveNames(names);
}

export function getSpaceName(spaceID: number): string {
  const names = loadNames();
  return names[String(spaceID)] || "";
}

export function moveWindowToSpace(_spaceID: number) {
  // hs.spaces.moveWindowToSpace is broken on macOS 26 (Tahoe)
  // SkyLight private APIs (SLSAddWindowsToSpaces, SLSMoveWindowsToManagedSpace,
  // SLSSetWindowListWorkspace) are all silently blocked.
  // TODO: revisit when Hammerspoon or macOS fixes this
  throw new Error("Move window to space is not supported on macOS 26");
}

export interface Window {
  id: number;
  title: string;
  app: string;
  appBundleID: string;
}

export async function listWindowsForSpace(spaceID: number): Promise<Window[]> {
  const raw = hs(`
    local wids = hs.spaces.windowsForSpace(${spaceID})
    local widSet = {}
    for _, wid in ipairs(wids) do widSet[wid] = true end
    local result = {}
    for _, app in ipairs(hs.application.runningApplications()) do
      if app:kind() == 1 then
        for _, win in ipairs(app:allWindows()) do
          if widSet[win:id()] and win:title() ~= "" then
            table.insert(result, { id = win:id(), title = win:title(), app = app:name(), appBundleID = app:bundleID() })
          end
        end
      end
    end
    print(hs.json.encode(result))
  `);
  if (!raw || raw === "") return [];
  return JSON.parse(raw);
}

export function focusWindow(windowID: number) {
  hs(`
    local targetWin = nil
    for _, app in ipairs(hs.application.runningApplications()) do
      if app:kind() == 1 then
        for _, win in ipairs(app:allWindows()) do
          if win:id() == ${windowID} then targetWin = win; break end
        end
      end
      if targetWin then break end
    end
    if targetWin then targetWin:focus() end
  `);
}

export function moveSpecificWindowToSpace(_windowID: number, _spaceID: number) {
  // hs.spaces.moveWindowToSpace is broken on macOS 26 (Tahoe)
  throw new Error("Move window to space is not supported on macOS 26");
}

export function activeSpaceID(): number {
  const raw = hs(`
    local win = hs.window.frontmostWindow()
    local screen = win and win:screen() or hs.screen.mainScreen()
    print(hs.spaces.activeSpaceOnScreen(screen))
  `);
  return parseInt(raw, 10);
}

-- Hammerspoon config: spaces management
-- Callable from Raycast via hs CLI or Hammerspoon extension

require("hs.ipc")
hs.allowAppleScript(true)

local DESIRED_SPACES = 5
local NAMES_FILE = os.getenv("HOME") .. "/.config/hammerspoon/space_names.json"

-- Persistent space names storage
local function loadNames()
  local f = io.open(NAMES_FILE, "r")
  if not f then return {} end
  local data = f:read("*a")
  f:close()
  return hs.json.decode(data) or {}
end

local function saveNames(names)
  local f = io.open(NAMES_FILE, "w")
  if not f then return end
  f:write(hs.json.encode(names, true))
  f:close()
end

-- Sync Mission Control names into the JSON file (for fullscreen apps etc.)
local syncing = false
function syncSpaceNames()
  if syncing then return end
  syncing = true
  local mcNames = hs.spaces.missionControlSpaceNames(true)
  syncing = false
  if not mcNames then return end
  local names = loadNames()
  -- Build set of user (desktop) space IDs
  local userSpaces = {}
  for _, screen in ipairs(hs.screen.allScreens()) do
    for _, id in ipairs(hs.spaces.spacesForScreen(screen)) do
      if hs.spaces.spaceType(id) == "user" then
        userSpaces[id] = true
      end
    end
  end
  for _, map in pairs(mcNames) do
    for id, mcName in pairs(map) do
      local key = tostring(id)
      -- Always update fullscreen names, only set user names if not already custom-named
      if not userSpaces[id] then
        names[key] = mcName
      elseif not names[key] then
        names[key] = mcName
      end
    end
  end
  saveNames(names)
end

-- Get current space ID
local function currentSpaceID()
  return hs.spaces.activeSpaceOnScreen(hs.screen.mainScreen())
end

-- Rename current space via dialog prompt
function renameCurrentSpace()
  local spaceID = tostring(currentSpaceID())
  local names = loadNames()
  local current = names[spaceID] or ""
  local btn, name = hs.dialog.textPrompt("Rename Space", "Name for space " .. spaceID .. ":", current, "Save", "Cancel")
  if btn == "Save" and name ~= "" then
    names[spaceID] = name
    saveNames(names)
    hs.alert.show("Space → " .. name)
  end
end

-- Rename a space by ID (callable from Raycast: hs -c "renameSpace(123, 'Work')")
function renameSpace(spaceID, name)
  local names = loadNames()
  names[tostring(spaceID)] = name
  saveNames(names)
  hs.alert.show("Space " .. spaceID .. " → " .. name)
end

-- Show all spaces with custom names
function showSpaceNames()
  local screen = hs.screen.mainScreen()
  local spaces = hs.spaces.spacesForScreen(screen)
  local names = loadNames()
  local active = currentSpaceID()
  local lines = {}
  for i, id in ipairs(spaces) do
    local label = names[tostring(id)] or ("Desktop " .. i)
    local marker = (id == active) and " ←" or ""
    table.insert(lines, string.format("%d: %s%s", i, label, marker))
  end
  hs.alert.show(table.concat(lines, "\n"), 5)
end

-- Ensure desired number of spaces
function ensureSpaces()
  local screen = hs.screen.mainScreen()
  local spaces = hs.spaces.spacesForScreen(screen)
  local current = #spaces
  if current < DESIRED_SPACES then
    for i = 1, DESIRED_SPACES - current do
      hs.spaces.addSpaceToScreen(screen, false)
    end
    hs.spaces.closeMissionControl()
    hs.alert.show(string.format("Created %d spaces (total: %d)", DESIRED_SPACES - current, DESIRED_SPACES))
  else
    hs.alert.show(string.format("Already have %d spaces", current))
  end
end

-- Create new space and prompt for name
function createAndNameSpace()
  local screen = hs.screen.mainScreen()
  hs.spaces.addSpaceToScreen(screen, true)
  local spaces = hs.spaces.spacesForScreen(screen)
  local newID = spaces[#spaces]
  local btn, name = hs.dialog.textPrompt("Name New Space", "Enter a name:", "", "Save", "Skip")
  if btn == "Save" and name ~= "" then
    local names = loadNames()
    names[tostring(newID)] = name
    saveNames(names)
    hs.alert.show("Created space → " .. name)
  else
    hs.alert.show("Created space (unnamed)")
  end
end

-- Run on startup
ensureSpaces()
syncSpaceNames()

-- Re-sync names when spaces change
hs.spaces.watcher.new(syncSpaceNames):start()

-- Hotkeys: Cmd+7 ensure spaces, Cmd+8 show names, Cmd+9 create & name, Cmd+0 rename current
hs.hotkey.bind({"cmd"}, "7", ensureSpaces)
hs.hotkey.bind({"cmd"}, "8", showSpaceNames)
hs.hotkey.bind({"cmd"}, "9", createAndNameSpace)
hs.hotkey.bind({"cmd"}, "0", renameCurrentSpace)

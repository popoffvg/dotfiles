-- Hammerspoon config: auto-create spaces on launch
-- Renaming must be done manually in Mission Control (right-click space name)

local DESIRED_SPACES = 5 -- change this to the number of spaces you want

local function ensureSpaces()
  local screen = hs.screen.mainScreen()
  local spaces = hs.spaces.spacesForScreen(screen)
  local current = #spaces

  if current < DESIRED_SPACES then
    for i = 1, DESIRED_SPACES - current do
      hs.spaces.addSpaceToScreen(screen, false)
    end
    -- close Mission Control after last space added
    hs.spaces.closeMissionControl()
    hs.alert.show(string.format("Created %d spaces (total: %d)", DESIRED_SPACES - current, DESIRED_SPACES))
  else
    hs.alert.show(string.format("Already have %d spaces", current))
  end
end

-- Run on startup
ensureSpaces()

-- Hotkey to re-run manually: Ctrl+Alt+Cmd+S
hs.hotkey.bind({"ctrl", "alt", "cmd"}, "S", ensureSpaces)

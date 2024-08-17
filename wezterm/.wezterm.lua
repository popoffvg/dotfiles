-- Pull in the wezterm API
local wezterm = require("wezterm")
local act = wezterm.action

-- This table will hold the configuration.
local config = {}

-- In newer versions of wezterm, use the config_builder which will
-- help provide clearer error messages
if wezterm.config_builder then
	config = wezterm.config_builder()
end

-- This is where you actually apply your config choices

-- For example, changing the color scheme:
-- config.color_scheme = "Vs Code Dark+ (Gogh)"
config.colors = require("cyberdream")
config.font = wezterm.font("FiraCode Nerd Font")
config.font_size = 14.0
config.enable_tab_bar = false
config.audible_bell = "Disabled"
config.keys = {
	{
		key = "n",
		mods = "CMD",
		action = act.SendKey({
			key = "LeftArrow",
		}),
	},
	{
		key = "p",
		mods = "CMD",
		action = act.SendKey({ key = "RightArrow" }),
	},
	{
		key = "j",
		mods = "CMD",
		action = act.SendKey({
			key = "DownArrow",
		}),
	},
	{
		key = "k",
		mods = "CMD",
		action = act.SendKey({ key = "UpArrow" }),
	},
}

config.window_background_capacity = 0.9
config.macos_window_background_opacity = 10

-- and finally, return the configuration to wezterm
return config

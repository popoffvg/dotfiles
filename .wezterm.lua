-- Pull in the wezterm API
local wezterm = require("wezterm")
local act = wezterm.action
local mux = wezterm.mux
wezterm.on("gui-startup", function()
	local tab, pane, window = mux.spawn_window({})
	window:gui_window():maximize()
end)
-- This table will hold the configuration.
local config = {}

-- In newer versions of wezterm, use the config_builder which will
-- help provide clearer error messages
if wezterm.config_builder then
	config = wezterm.config_builder()
end

-- This is where you actually apply your config choices

-- For example, changing the color scheme:
local custom = wezterm.color.get_builtin_schemes()["catppuccin-macchiato"]
custom.background = "#000000"
-- custom.tab_bar.background = "#040404"
-- custom.tab_bar.inactive_tab.bg_color = "#0f0f0f"
-- custom.tab_bar.new_tab.bg_color = "#080808"
config.enable_kitty_graphics = true
config.color_schemes = {
	["OLEDppuccin"] = custom,
}
config.color_scheme = "OLEDppuccin"
config.font = wezterm.font("FiraCode Nerd Font")
config.font_size = 14.0
-- config.enable_tab_bar = false
config.audible_bell = "Disabled"
-- config.window_decorations = "NONE"
local wezterm = require("wezterm")
config.window_padding = {
	left = 0,
	right = 0,
	top = 0,
	bottom = 0,
}
config.window_decorations = "NONE"
-- config.native_macos_fullscreen_mode = true
local function is_vim(pane)
	local process_info = pane:get_foreground_process_info()
	local process_name = process_info and process_info.name

	return process_name == "nvim" or process_name == "vim"
end

local direction_keys = {
	Left = "h",
	Down = "j",
	Up = "k",
	Right = "l",
	-- reverse lookup
	h = "Left",
	j = "Down",
	k = "Up",
	l = "Right",
}

local function split_nav(resize_or_move, key)
	return {
		key = key,
		mods = resize_or_move == "resize" and "META" or "CTRL",
		action = wezterm.action_callback(function(win, pane)
			if is_vim(pane) then
				-- pass the keys through to vim/nvim
				win:perform_action({
					SendKey = { key = key, mods = resize_or_move == "resize" and "META" or "CTRL" },
				}, pane)
			else
				if resize_or_move == "resize" then
					win:perform_action({ AdjustPaneSize = { direction_keys[key], 3 } }, pane)
				else
					win:perform_action({ ActivatePaneDirection = direction_keys[key] }, pane)
				end
			end
		end),
	}
end

-- wezterm config

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
	{
		key = "r",
		mods = "CMD|SHIFT",
		action = wezterm.action.ReloadConfiguration,
	},
	{
		key = "x",
		mods = "CMD|SHIFT",
		action = wezterm.action.CloseCurrentPane({ confirm = true }),
	},
	{
		key = "-",
		mods = "CMD|SHIFT",
		action = wezterm.action.SplitVertical({
			-- command = { args = { "sh" } },
			domain = "CurrentPaneDomain",
		}),
	},
	{
		key = "|",
		mods = "CMD|SHIFT",
		action = wezterm.action.SplitPane({
			direction = "Right",
			-- command = act.DetachDomain("CurrentPaneDomain"),
			-- action =
			-- size = { Percent = 50 },
		}),
	},
	{

		key = "p",
		mods = "CMD|SHIFT",
		action = wezterm.action.QuickSelect,
	},
	{
		key = "l",
		mods = "CMD|SHIFT",
		action = wezterm.action.ShowLauncherArgs({ flags = "FUZZY|WORKSPACES" }),
	},
	{
		key = "s",
		mods = "CMD|SHIFT",
		action = act.PromptInputLine({
			action = wezterm.action_callback(function(window, pane, line)
				if line == "" then
					return
				end
				wezterm.mux.rename_workspace(wezterm.mux.get_active_workspace(), line)
			end),
			description = "New workspace name",
		}),
	},
	{
		key = "8",
		mods = "CMD|SHIFT",
		action = act.PaneSelect,
	},
	{
		key = "Z",
		mods = "CMD|SHIFT",
		action = wezterm.action.TogglePaneZoomState,
	},
	{ key = "t", mods = "CMD|SHIFT", action = act.SpawnTab("DefaultDomain") },
	{
		key = "c",
		mods = "CMD|SHIFT",
		action = act.ActivateCopyMode,
	},
	{
		key = "f",
		mods = "CMD|SHIFT",
		action = wezterm.action.ToggleFullScreen,
	},
	split_nav("move", "h"),
	split_nav("move", "j"),
	split_nav("move", "k"),
	split_nav("move", "l"),
	-- resize panes
	split_nav("resize", "h"),
	split_nav("resize", "j"),
	split_nav("resize", "k"),
	split_nav("resize", "l"),
}

local tabline = wezterm.plugin.require("https://github.com/michaelbrusegard/tabline.wez")
tabline.setup({
	options = {
		icons_enabled = true,
		theme = "catppuccin-macchiato",
		section_separators = {
			left = "",
			right = "",
		},
		component_separators = {
			left = "",
			right = "",
		},
		tab_separators = {
			left = " ",
			right = " ",
		},
		color_overrides = {
			-- Default colors from Catppuccin Mocha
			normal_mode = {
				a = { fg = "#181825", bg = "#89b4fa" },
				b = { fg = "#89b4fa", bg = "#313244" },
				c = { fg = "#cdd6f4", bg = "#181825" },
			},
			copy_mode = {
				a = { fg = "#181825", bg = "#f9e2af" },
				b = { fg = "#f9e2af", bg = "#313244" },
				c = { fg = "#cdd6f4", bg = "#181825" },
			},
			search_mode = {
				a = { fg = "#181825", bg = "#a6e3a1" },
				b = { fg = "#a6e3a1", bg = "#313244" },
				c = { fg = "#cdd6f4", bg = "#181825" },
			},
			-- Defining colors for a new key table
			window_mode = {
				a = { fg = "#181825", bg = "#cba6f7" },
				b = { fg = "#cba6f7", bg = "#313244" },
				c = { fg = "#cdd6f4", bg = "#181825" },
			},
			-- Default tab colors
			tab = {
				active = { fg = "#89b4fa", bg = "#313244" },
				inactive = { fg = "#cdd6f4", bg = "#181825" },
				inactive_hover = { fg = "#f5c2e7", bg = "#313244" },
			},
		},
	},
	sections = {
		-- tabline_a = { "mode" },
		tabline_a = { "workspace" },
		tabline_b = { "" },
		tabline_c = { "" },
		tab_active = {
			{
				"process",
				process_to_icon = {
					["apt"] = wezterm.nerdfonts.dev_debian,
					["bash"] = wezterm.nerdfonts.cod_terminal_bash,
					["bat"] = wezterm.nerdfonts.md_bat,
					["cmd.exe"] = wezterm.nerdfonts.md_console_line,
					["curl"] = wezterm.nerdfonts.md_flattr,
					["debug"] = wezterm.nerdfonts.cod_debug,
					["default"] = wezterm.nerdfonts.md_application,
					["docker"] = wezterm.nerdfonts.linux_docker,
					["docker-compose"] = wezterm.nerdfonts.linux_docker,
					["git"] = wezterm.nerdfonts.dev_git,
					["go"] = wezterm.nerdfonts.md_language_go,
					["lazydocker"] = wezterm.nerdfonts.linux_docker,
					["lazygit"] = wezterm.nerdfonts.cod_github,
					["lua"] = wezterm.nerdfonts.seti_lua,
					["make"] = wezterm.nerdfonts.seti_makefile,
					["nix"] = wezterm.nerdfonts.linux_nixos,
					["node"] = wezterm.nerdfonts.md_nodejs,
					["npm"] = wezterm.nerdfonts.md_npm,
					["nvim"] = wezterm.nerdfonts.custom_neovim,
					["psql"] = wezterm.nerdfonts.dev_postgresql,
					["zsh"] = wezterm.nerdfonts.dev_terminal,
					-- ["k9s"] = wezterm.nerdfonts.dev_terminal,
				},
				-- process_to_icon is a table that maps process to icons
			},
			{ "parent", padding = 0 },
			"/",
			{ "cwd", padding = { left = 0, right = 1 } },
			{ "zoomed", padding = 0 },
		},
		tab_inactive = {
			{ "index" },
			{ "cwd", padding = { left = 0, right = 1 } },
		},
		tabline_y = { "datetime", "battery" },
	},
	extensions = {},
})

-- and finally, return the configuration to wezterm
return config
